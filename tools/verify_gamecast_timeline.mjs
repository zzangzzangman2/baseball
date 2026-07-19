import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  compilePlayTimeline,
  getGamecast2PlayDurationMs,
  getGamecast2RunnerStartMs,
  GAMECAST2_ATLAS_ANIMATION_KEYS,
  GAMECAST2_DEFENDER_MOVE_ZONES,
  GAMECAST2_TIMELINE_TEMPLATES
} from "../src/gamecast2/timeline.js";
import {
  buildTimelineBallState,
  buildTimelineVisualPlay,
  clampGamecast2DefenderDesignPoint,
  derivePlateActor,
  GAMECAST2_THROW_GLOVE_LIFT,
  gamecast2FlyResolutionCue,
  gamecast2TimelineCueFacing,
  timelineBallPoint
} from "../src/gamecast2/scene.js";
import {
  buildGamecastActionBurst,
  buildGamecastThrowLines,
  gamecastEventPlayDuration,
  gamecastMovementSettleProgress,
  gamecastPlaybackPosition,
  gamecastResultRevealProgress,
  gamecastSideInfoSummary,
  gamecastStepHoldProgress,
  gamecastTotalDuration,
  GAMECAST_WATCH_GAP_MS
} from "../src/ui.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const ATLAS_PATHS = [
  "player-home.json",
  "player-home-night.json",
  "player-away.json",
  "player-away-night.json"
].map((name) => path.join(ROOT_DIR, "assets", "gamecast", name));
const JAMSIL_DAY_ANCHOR_PATH = path.join(
  ROOT_DIR,
  "assets",
  "gamecast2",
  "field-jamsil-day.anchors.json"
);
const FIELD_ANCHOR_PATHS = Object.freeze([JAMSIL_DAY_ANCHOR_PATH]);
const JAMSIL_DAY_ANCHOR_PAYLOAD = deepFreeze(
  JSON.parse(fs.readFileSync(JAMSIL_DAY_ANCHOR_PATH, "utf8"))
);
const BATTER_BOX_BOUNDS = Object.freeze({
  "field-jamsil-day": Object.freeze({ xMin: 497, xMax: 536, yMin: 603, yMax: 642 })
});
const DEFENSE_POSITIONS = Object.freeze(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const OUTFIELD_POSITIONS = new Set(["LF", "CF", "RF"]);
// The timeline, wall, and defensive-movement matrices all use the same
// canonical Jamsil day anchors that the live Gamecast scene loads.
const ANCHORS = JAMSIL_DAY_ANCHOR_PAYLOAD.anchors;

const BASE_EVENT = Object.freeze({
  type: "plateAppearance",
  gameId: "verify-game",
  sequence: 7,
  hitterId: "batter",
  hitterName: "검증 타자",
  outsBefore: 0,
  outsAfter: 0,
  basesBefore: [false, false, false],
  basesAfter: [false, false, false],
  baseRunnerIdsBefore: ["", "", ""],
  baseRunnerIdsAfter: ["", "", ""],
  scoredRunners: [],
  runs: 0
});

export function verifyGamecastTimeline() {
  verifyAtlasContract();
  verifyFieldAnchorContract();

  const cases = timelineCases();
  const compiled = cases.map(({ name, event }) => ({
    name,
    event,
    timeline: compilePlayTimeline(event, { anchors: ANCHORS })
  }));

  assert.deepEqual(
    new Set(compiled.map(({ timeline }) => timeline.template)),
    new Set(GAMECAST2_TIMELINE_TEMPLATES),
    "게임캐스트 타임라인 템플릿 커버리지가 다릅니다."
  );

  for (const item of compiled) {
    assert.equal(
      getGamecast2PlayDurationMs(item.event),
      item.timeline.durationMs,
      `${item.name}: duration helper and compiled timeline disagree.`
    );
    verifyTimelineContract(item);
    verifyThrowTargetSemantics(item.name, item.event, item.timeline);
  }
  verifyExistingRunnerPaths(compiled);
  verifyRunnerSpeedScaling();
  verifyHomeRunRunnerOrder();
  verifyThrowGatherLimit(compiled);
  verifyLongOutfieldRelays();
  verifyRecoveredMiddleInfielderReceivers();
  verifyPlaybackClock();
  verifyShortResultBurstTiming();
  verifyDefensiveRotation(compiled);
  verifyFlyBallResolution();
  verifySafeHitRollout();
  verifyCenterFieldSingleTiming();
  verifyMovementSpeedWindows(compiled);
  verifyTrajectoryRealismRegressions();
  verifyBuntChoreography();
  verifyGroundBallResponsibilityZones();
  verifyFirstBaseDoublePlayRotations();
  verifyFielderPositionMatrix();
  verifyThrowTargetRegressionCases();
  verifyArmDrivenThrows();
  verifyStealVisualActors();
  verifyPurity(cases[3].event);

  return `${compiled.length}개 플레이, ${GAMECAST2_TIMELINE_TEMPLATES.length * DEFENSE_POSITIONS.length}개 수비 조합, atlas anim ${GAMECAST2_ATLAS_ANIMATION_KEYS.length}키`;
}

function verifyShortResultBurstTiming() {
  const strikeout = {
    ...BASE_EVENT,
    outcome: "strikeout",
    outsAfter: 1
  };
  {
    const label = "strikeout";
    const event = strikeout;
    const durationMs = getGamecast2PlayDurationMs(event);
    const visible = [];
    for (let index = 0; index <= 4000; index += 1) {
      const progress = index / 4000;
      if (buildGamecastActionBurst(event, progress)?.text) visible.push(progress);
    }
    assert(visible.length > 0, `${label}: result banner never appears.`);
    const first = visible[0];
    const last = visible.at(-1);
    const visibleMs = (last - first) * durationMs;
    const originalPerceivedMs = (1 - first) * durationMs + GAMECAST_WATCH_GAP_MS;
    const fraction = visibleMs / originalPerceivedMs;
    assert(
      fraction >= 0.49 && fraction <= 0.51,
      `${label}: result banner is not half of its old gap-inclusive dwell (${visibleMs.toFixed(1)}ms, ${(fraction * 100).toFixed(1)}%).`
    );
    assert(
      visibleMs >= 1500 && visibleMs <= 1650,
      `${label}: shortened result banner is outside the readable 1500-1650ms range (${visibleMs.toFixed(1)}ms).`
    );
    assert.equal(buildGamecastActionBurst(event, Math.min(1, last + 0.01)), null, `${label}: result banner remains after its short window.`);
  }

  const walk = {
    ...BASE_EVENT,
    outcome: "walk",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  };
  const durationMs = getGamecast2PlayDurationMs(walk);
  const reveal = gamecastResultRevealProgress(walk);
  const movementSettle = gamecastMovementSettleProgress(walk);
  const stepHold = gamecastStepHoldProgress(walk);
  assert.equal(reveal, 0.2, "walk: BB is not revealed on the ball-four plate frame.");
  assert.equal(buildGamecastActionBurst(walk, reveal - 0.001), null, "walk: BB appears before ball four reaches the plate.");
  const immediate = buildGamecastActionBurst(walk, reveal);
  assert(immediate?.text, "walk: BB banner is missing on the ball-four frame.");
  assert.equal(immediate.opacity, 1, "walk: BB banner does not appear at full opacity immediately.");
  assert(movementSettle >= reveal + 0.25, "walk: runner movement is still coupled to the immediate BB call.");
  assert.equal(stepHold, movementSettle, "walk: step mode pauses before the batter finishes taking first.");
  assert(buildGamecastActionBurst(walk, stepHold)?.text, "walk: BB banner is gone at the post-movement step hold.");
  assert(buildGamecastActionBurst(walk, movementSettle)?.text, "walk: BB banner disappears before the batter finishes taking first.");

  const visible = [];
  for (let index = 0; index <= 4000; index += 1) {
    const progress = index / 4000;
    if (buildGamecastActionBurst(walk, progress)?.text) visible.push(progress);
  }
  const first = visible[0];
  const last = visible.at(-1);
  const visibleMs = (last - first) * durationMs;
  assert(Math.abs(first - reveal) <= 0.000251, `walk: BB starts at ${first}, expected ${reveal}.`);
  assert(visibleMs >= 3000 && visibleMs <= 3600, `walk: BB dwell is not readable (${visibleMs.toFixed(1)}ms).`);
  assert(last > movementSettle, "walk: BB does not remain visible through the walk to first.");
  assert.equal(buildGamecastActionBurst(walk, Math.min(1, last + 0.01)), null, "walk: BB banner remains after its intended window.");
}

function verifySafeHitRollout() {
  const lanes = [
    ["LF", -0.58],
    ["CF", 0],
    ["RF", 0.58]
  ];
  const variants = [
    ["fly", "flyBall", "fly-bloop", "safe-settle", 22, 28],
    ["line", "lineDrive", "line-through", "line-settle", 30, 36],
    ["ground", "groundBall", "ground-through", "ground-through", 40, 46]
  ];

  for (const [fielder, sprayLane] of lanes) {
    for (const [label, battedBallType, hitTrajectory, phase, minDistance, maxDistance] of variants) {
      const event = {
        ...BASE_EVENT,
        id: `roll-${fielder}-${label}`,
        sequence: 820 + lanes.findIndex(([key]) => key === fielder) * 10 + variants.findIndex(([key]) => key === label),
        outcome: "single",
        battedBallType,
        hitTrajectory,
        fieldingPosition: fielder,
        sprayLane,
        basesAfter: [true, false, false],
        baseRunnerIdsAfter: ["batter", "", ""]
      };
      const timeline = compilePlayTimeline(event, { anchors: ANCHORS });
      const settle = timeline.tracks.ball.find((cue) => cue.phase === phase);
      const caseLabel = `${fielder} ${label} single`;
      assert(settle, `${caseLabel}: post-landing roll cue is missing.`);
      assert.deepEqual(settle.path, ["landing", "pickup"], `${caseLabel}: roll does not connect landing to pickup.`);
      assert.equal(settle.grounded, true, `${caseLabel}: post-landing travel is not grounded.`);
      assert.equal(settle.flightProfile, "roll", `${caseLabel}: natural roll deceleration profile is missing.`);

      const rollDistance = pointDistance(timeline.points.landing, timeline.points.pickup);
      assert(
        rollDistance >= minDistance && rollDistance <= maxDistance,
        `${caseLabel}: rollout ${rollDistance.toFixed(2)}px is outside ${minDistance}-${maxDistance}px.`
      );
      assert(postLandingDirectionDot(timeline.points) > 0, `${caseLabel}: ball rolls back toward home.`);

      const cueDurationMs = (Number(settle.endT) - Number(settle.t)) * Number(timeline.durationMs);
      const sampleProgress = Number(settle.t) + Math.min(100, cueDurationMs * 0.45) / Number(timeline.durationMs);
      const start = timelineBallPoint(settle, timeline.points, 0);
      const after100 = buildTimelineBallState(timeline, sampleProgress, event);
      const firstQuarter = timelineBallPoint(settle, timeline.points, 0.25);
      const thirdQuarter = timelineBallPoint(settle, timeline.points, 0.75);
      const end = timelineBallPoint(settle, timeline.points, 1);
      assert(pointDistance(start, after100) >= 5, `${caseLabel}: ball moves less than 5px in its first 100ms.`);
      assert(
        pointDistance(start, firstQuarter) > pointDistance(thirdQuarter, end) * 3,
        `${caseLabel}: rollout does not visibly decelerate.`
      );
      assert(pointDistance(end, timeline.points.pickup) <= 0.01, `${caseLabel}: rollout does not finish at pickup.`);
      assert.equal(Number(end.height ?? 0), 0, `${caseLabel}: rolled ball remains above the turf.`);
      assert.equal(after100?.trail?.length, 2, `${caseLabel}: grounded rollout trail classification is wrong.`);
      assert(Number(timeline.meta.fielding?.wallClearancePx) >= 4, `${caseLabel}: rollout escapes the playable wall.`);
      assert.equal(timeline.meta.invariants?.wallOutcomeMatches, true, `${caseLabel}: safe-hit wall invariant failed.`);
    }
  }
}

function verifyCenterFieldSingleTiming() {
  const variants = [
    ["bloop", "flyBall", "fly-bloop", 1150, 1300, "safe-fly-drop"],
    ["gap drop", "flyBall", "fly-gap-drop", 1250, 1400, "safe-fly-drop"],
    ["line drop", "lineDrive", "line-drop", 850, 1200, "safe-line-short-hop"],
    ["ground through", "groundBall", "ground-through", 450, 700, "safe-ground-through"]
  ];

  for (const [label, battedBallType, hitTrajectory, minimumFlightMs, maximumFlightMs, resolution] of variants) {
    const event = {
      ...BASE_EVENT,
      id: `cf-single-${hitTrajectory}`,
      sequence: 851 + variants.findIndex((variant) => variant[2] === hitTrajectory),
      outcome: "single",
      battedBallType,
      hitTrajectory,
      fieldingPosition: "CF",
      sprayLane: 0,
      basesAfter: [true, false, false],
      baseRunnerIdsAfter: ["batter", "", ""]
    };
    const timeline = compilePlayTimeline(event, { anchors: ANCHORS });
    const flight = timeline.tracks.ball.find((cue) => cue.phase === "batted");
    const approach = timeline.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "approach");
    const recovery = timeline.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "recover");
    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    const flightMs = (Number(flight?.endT) - Number(flight?.t)) * Number(timeline.durationMs);

    assert(flight, `CF ${label} single: batted-ball cue is missing.`);
    assert(approach && recovery, `CF ${label} single: CF approach/recovery route is missing.`);
    assert(
      flightMs >= minimumFlightMs && flightMs <= maximumFlightMs,
      `CF ${label} single: ${flightMs.toFixed(0)}ms flight is outside ${minimumFlightMs}-${maximumFlightMs}ms.`
    );
    assert(
      Number(flight.endT) < Number(batterRun?.endT),
      `CF ${label} single: the ball is still airborne after the batter reaches first.`
    );
    if (battedBallType !== "groundBall") {
      const landingLeadMs = (Number(batterRun?.endT) - Number(flight.endT)) * Number(timeline.durationMs);
      assert(
        landingLeadMs >= 149,
        `CF ${label} single: the ball lands only ${landingLeadMs.toFixed(1)}ms before first base.`
      );
    }
    assert.equal(timeline.meta.fielding?.resolution, resolution, `CF ${label} single: wrong fielding resolution.`);
    assert(
      Number(timeline.meta.fielding?.fielderArrivalT) > Number(timeline.meta.fielding?.ballLandingT),
      `CF ${label} single: CF controls the ball before it lands.`
    );
    assert.equal(approach.path?.[0], "CF", `CF ${label} single: another fielder starts the outfield approach.`);
    assert.equal(recovery.path?.at(-1), "pickup", `CF ${label} single: CF never reaches the pickup point.`);
    assert.equal(batterRun?.basesAdvanced, 1, `CF ${label} single: batter advances beyond first.`);
    assert.equal(batterRun?.toBase, "first", `CF ${label} single: batter target base is not first.`);
    assert.deepEqual(batterRun?.path, ["home", "first"], `CF ${label} single: batter path does not stop at first.`);
  }

  // Guard against an old/temporarily inconsistent base-state payload turning
  // the scored single into a visual double. The outcome remains authoritative.
  const inconsistentAfterState = compilePlayTimeline({
    ...BASE_EVENT,
    id: "cf-single-inconsistent-after-state",
    sequence: 855,
    outcome: "single",
    battedBallType: "flyBall",
    hitTrajectory: "fly-bloop",
    fieldingPosition: "CF",
    sprayLane: 0,
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  }, { anchors: ANCHORS });
  const inconsistentBatterRun = inconsistentAfterState.tracks.batter.find((cue) => cue.phase === "batter-run");
  assert.equal(inconsistentBatterRun?.basesAdvanced, 1, "A single became a visual double from basesAfter state.");
  assert.deepEqual(inconsistentBatterRun?.path, ["home", "first"], "A single batter runs through first to second.");
}

function verifyMovementSpeedWindows(compiled) {
  const supplemental = [
    ["speed-safe-fly", {
      outcome: "single",
      battedBallType: "flyBall",
      hitTrajectory: "fly-gap-drop",
      fieldingPosition: "CF"
    }],
    ["speed-safe-line", {
      outcome: "single",
      battedBallType: "lineDrive",
      hitTrajectory: "line-drop",
      fieldingPosition: "RF"
    }],
    ["speed-safe-ground", {
      outcome: "single",
      battedBallType: "groundBall",
      hitTrajectory: "ground-through",
      attemptedFieldingPosition: "2B",
      fieldingPosition: "CF"
    }],
    // A single with the runner forced to second keeps the no-throw hold and
    // therefore exercises the 1B base-cover route.
    ["speed-held-single", {
      outcome: "single",
      battedBallType: "lineDrive",
      hitTrajectory: "line-drop",
      fieldingPosition: "LF",
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""],
      basesAfter: [true, true, false],
      baseRunnerIdsAfter: ["batter", "r1", ""]
    }]
  ].map(([name, event], index) => ({
    name,
    timeline: compilePlayTimeline({
      ...BASE_EVENT,
      id: name,
      sequence: 970 + index,
      basesAfter: [true, false, false],
      baseRunnerIdsAfter: ["batter", "", ""],
      ...event
    }, { anchors: ANCHORS })
  }));
  const items = [...compiled, ...supplemental];
  const coverage = {
    primary: 0,
    recover: 0,
    relay: 0,
    "base-cover": 0,
    backup: 0,
    receiver: 0,
    fly: 0,
    line: 0,
    ground: 0
  };
  const supportLimits = {
    relay: [55, 210],
    "base-cover": [55, 230],
    backup: [45, 220]
  };
  const settleKinds = {
    "safe-settle": ["fly", 145, 220],
    "line-settle": ["line", 160, 260],
    "ground-through": ["ground", 220, 320]
  };

  for (const { name, timeline } of items) {
    const primary = timeline.meta.fielding?.fielder;
    for (const cue of timeline.tracks.fielders.filter((entry) => entry.path?.length > 1)) {
      const distance = timelineCueRouteDistance(timeline, cue);
      if (cue.anim === "run") {
        assert(distance >= 7.99, `${name}: ${cue.who} ${cue.phase} runs only ${distance.toFixed(2)}px.`);
      }
      if (cue.who === primary && cue.phase === "approach" && distance >= 14) {
        assertTimelineCueSpeed(name, timeline, cue, 45, 300, "primary approach");
        coverage.primary += 1;
      }
      if (cue.phase === "recover" && distance >= 8) {
        assertTimelineCueSpeed(name, timeline, cue, 55, 260, "fielder recovery");
        coverage.recover += 1;
      }
      if (supportLimits[cue.assignment] && distance >= 14) {
        const [minimum, maximum] = supportLimits[cue.assignment];
        assertTimelineCueSpeed(name, timeline, cue, minimum, maximum, `support ${cue.assignment}`);
        coverage[cue.assignment] += 1;
      }
      if (cue.assignment === "receiver" && distance >= 14) {
        const maximum = cue.who === "P" && cue.path?.at(-1) === "first" ? 360.5 : 220;
        assertTimelineCueSpeed(name, timeline, cue, 50, maximum, "throw receiver");
        coverage.receiver += 1;
      }
    }

    for (const cue of timeline.tracks.ball) {
      const settle = settleKinds[cue.phase];
      if (!settle || cue.path?.length < 2) continue;
      const [kind, minimum, maximum] = settle;
      const distance = timelineCueRouteDistance(timeline, cue);
      if (distance < 10) continue;
      const durationMs = (Number(cue.endT) - Number(cue.t)) * Number(timeline.durationMs);
      assert(durationMs <= 1200.5, `${name}: ${kind} settle lasts ${durationMs.toFixed(1)}ms.`);
      assertTimelineCueSpeed(name, timeline, cue, minimum, maximum, `${kind} ball settle`);
      coverage[kind] += 1;
    }
  }

  for (const [key, count] of Object.entries(coverage)) {
    assert(count > 0, `movement speed regression lacks ${key} coverage.`);
  }
}

function assertTimelineCueSpeed(name, timeline, cue, minimum, maximum, role) {
  const distance = timelineCueRouteDistance(timeline, cue);
  const seconds = (Number(cue.endT) - Number(cue.t)) * Number(timeline.durationMs) / 1000;
  const speed = distance / Math.max(0.001, seconds);
  assert(
    Number.isFinite(speed) && speed >= minimum - 0.01 && speed <= maximum + 0.01,
    `${name}: ${role} ${cue.who ?? cue.phase} moves at ${speed.toFixed(1)}px/s (${minimum}-${maximum}).`
  );
}

function timelineCueRouteDistance(timeline, cue) {
  let distance = 0;
  for (let index = 1; index < (cue.path?.length ?? 0); index += 1) {
    distance += pointDistance(timeline.points?.[cue.path[index - 1]], timeline.points?.[cue.path[index]]);
  }
  return distance;
}

function verifyStealVisualActors() {
  const runtime = { anchors: { anchors: ANCHORS } };
  for (const [label, outcome] of [["success", "stolenBase"], ["caught", "caughtStealing"]]) {
    const success = outcome === "stolenBase";
    const event = {
      ...BASE_EVENT,
      type: "stolenBase",
      outcome,
      success,
      caught: !success,
      out: !success,
      runnerId: "r1",
      hitterId: "",
      hitterName: "",
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""],
      basesAfter: success ? [false, true, false] : [false, false, false],
      baseRunnerIdsAfter: success ? ["", "r1", ""] : ["", "", ""]
    };
    const timeline = compilePlayTimeline(event, { anchors: ANCHORS });
    const beforeResult = [0, 0.1, 0.2, 0.4, Math.max(0, timeline.resultAt - 0.001)];

    for (const progress of beforeResult) {
      const play = buildTimelineVisualPlay(runtime, event, progress, timeline);
      assert.notEqual(
        play.actors.get("batter")?.visible,
        false,
        `Steal visual (${label}) incorrectly removes the real plate batter at progress ${progress}.`
      );
      assert(
        play.actors.has("runner:r1") && play.actors.get("runner:r1")?.visible !== false,
        `Steal runner (${label}) is missing at progress ${progress}.`
      );
    }
    const stealThrow = timeline.tracks.ball.find((cue) => cue.phase === "steal-throw" && cue.path?.at(-1) === "second");
    assert(stealThrow, `Steal visual (${label}) has no throw arriving at second.`);
    verifyTerminalPossessionHold(`steal-second-${label}`, timeline, {
      at: "second",
      who: "2B",
      startT: stealThrow.endT
    });
  }
}

function verifyBuntChoreography() {
  const timeline = compilePlayTimeline({
    ...BASE_EVENT,
    outcome: "sacrificeBunt",
    battedBallType: "bunt",
    fieldingPosition: "3B",
    defensiveThrowTarget: "first",
    outsAfter: 1,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "r1", ""]
  }, { anchors: ANCHORS });
  const contact = timeline.tracks.batter.find((cue) => cue.phase === "bunt-contact");
  const flight = timeline.tracks.ball.find((cue) => cue.phase === "batted");
  assert(contact, "Sacrifice bunt does not use the short bat-presentation cue.");
  assert(Number(flight?.arc) <= 0.02, `Sacrifice bunt arc is too high (${flight?.arc}).`);
  assert.notEqual(flight?.flightProfile, "hang", "Sacrifice bunt incorrectly uses a fly-ball hang profile.");
  assert(
    Math.hypot(timeline.points.landing.x - timeline.points.home.x, timeline.points.landing.y - timeline.points.home.y)
      < Math.hypot(timeline.points["3B"].x - timeline.points.home.x, timeline.points["3B"].y - timeline.points.home.y),
    "Sacrifice bunt does not die in front of the plate."
  );
  assert(
    timeline.tracks.fielders.filter((cue) => cue.path?.length > 1).length <= 4,
    "Sacrifice bunt still sends too many defenders into motion."
  );
}

function verifyGroundBallResponsibilityZones() {
  const cases = [
    { zone: "third-line", lane: -0.9, position: "3B", rival: "SS" },
    { zone: "third-corner", lane: -0.68, position: "3B", rival: "SS" },
    { zone: "third-hole", lane: -0.38, position: "SS", rival: "3B" },
    { zone: "shortstop-middle", lane: -0.08, position: "SS", rival: "2B" },
    { zone: "second-middle", lane: 0.08, position: "2B", rival: "SS" },
    { zone: "first-hole", lane: 0.38, position: "2B", rival: "1B" },
    { zone: "first-corner", lane: 0.68, position: "1B", rival: "2B" },
    { zone: "first-line", lane: 0.9, position: "1B", rival: "2B" }
  ];

  for (const item of cases) {
    const event = {
      ...BASE_EVENT,
      id: `ground-zone-${item.zone}`,
      outcome: "single",
      battedBallType: "groundBall",
      fieldingPosition: item.position,
      fieldingZone: item.zone,
      fieldingLane: item.lane,
      basesAfter: [true, false, false],
      baseRunnerIdsAfter: ["batter", "", ""]
    };
    const timeline = compilePlayTimeline(event, { anchors: ANCHORS });
    const primary = timeline.meta.fielding?.fielder;
    const landing = timeline.points.landing;
    const approach = timeline.tracks.fielders.find((cue) => cue.who === item.position && cue.phase === "approach");

    assert.equal(primary, item.position, `${item.zone}: wrong primary ground-ball fielder ${primary}.`);
    assert.equal(timeline.meta.fielding?.fieldingZone, item.zone, `${item.zone}: timeline lost the authored fielding zone.`);
    assert.equal(approach?.path?.at(-1), "landing", `${item.zone}: primary does not own the ground-ball landing point.`);
    assert(
      pointDistance(landing, ANCHORS[item.position]) < pointDistance(landing, ANCHORS[item.rival]),
      `${item.zone}: landing point is closer to ${item.rival} than assigned ${item.position}.`
    );
    assert(
      pointDistance(landing, ANCHORS[item.position]) <= 54.01,
      `${item.zone}: primary leaves its realistic corner/middle range (${pointDistance(landing, ANCHORS[item.position]).toFixed(2)}px).`
    );
    const middleChaser = timeline.tracks.fielders.find((cue) => (
      ["SS", "2B"].includes(cue.who)
      && cue.who !== item.position
      && cue.path?.at(-1) === "landing"
    ));
    assert(!middleChaser, `${item.zone}: non-primary ${middleChaser?.who} still chases the same ground ball.`);

    if (Math.abs(item.lane) >= 0.58) {
      assert(["1B", "3B"].includes(primary), `${item.zone}: a line/corner grounder was not owned by 1B/3B.`);
    }
  }

  // A grounder gloved on the first-base line right next to the bag is a 3U
  // putout: no pitcher cover, no 21px toss — the first baseman steps on first.
  const firstBaseOut = compilePlayTimeline({
    ...BASE_EVENT,
    id: "ground-zone-first-backup",
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "1B",
    fieldingZone: "first-line",
    fieldingLane: 0.9,
    outsAfter: 1
  }, { anchors: ANCHORS });
  const firstBackup = firstBaseOut.tracks.fielders.find((cue) => cue.assignment === "backup" && cue.supportTarget === "first");
  assert.equal(firstBackup?.who, "RF", "First-base backup should be RF, not P/SS/2B.");
  const firstBackupDistance = pointDistance(firstBaseOut.points[firstBackup?.arrivesAt], firstBaseOut.points.first);
  assert(
    firstBackupDistance >= 88 && firstBackupDistance <= 132.01,
    `RF first-base backup is not visibly separated from the receiver (${firstBackupDistance.toFixed(2)}px).`
  );
  assert.equal(firstBaseOut.meta.fielding?.unassisted, true, "Near-bag 1B grounder is not recorded as an unassisted putout.");
  assert(
    !firstBaseOut.tracks.fielders.some((cue) => cue.who === "P" && cue.assignment === "receiver"),
    "Pitcher still covers first on an unassisted 3U putout."
  );
  assert.equal(
    firstBaseOut.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Unassisted 3U putout still throws the ball."
  );
  const unassistedStep = firstBaseOut.tracks.fielders.find((cue) => cue.who === "1B" && cue.phase === "unassisted-first");
  const unassistedBatter = firstBaseOut.tracks.batter.find((cue) => cue.phase === "batter-run");
  assert(unassistedStep && unassistedBatter, "Unassisted 3U putout lacks the step-on-bag or batter cue.");
  assert(
    Number(unassistedStep.endT) <= Number(unassistedBatter.endT),
    "1B does not reach the bag ahead of the retired batter-runner."
  );
  const unassistedCarry = firstBaseOut.tracks.ball.find((cue) => cue.phase === "fielding-carry" && cue.path?.at(-1) === "first");
  assert(unassistedCarry, "Unassisted 3U putout does not carry the ball to the bag.");
  const unassistedTerminalHold = firstBaseOut.tracks.ball.find((cue) => (
    cue.phase === "fielding-hold"
    && cue.terminal === true
    && cue.at === "first"
  ));
  assert(unassistedTerminalHold, "Unassisted 3U ball disappears after the first baseman steps on the bag.");
  assert.equal(unassistedTerminalHold.t, unassistedCarry.endT, "Unassisted 3U carry and terminal hold are not continuous.");
  assert.equal(unassistedTerminalHold.t, firstBaseOut.meta.fielding?.throwArrivalT, "Unassisted 3U terminal hold does not begin at the recorded bag arrival.");
  assert.equal(unassistedTerminalHold.possessedBy, "1B", "Unassisted 3U terminal ball is not possessed by the first baseman.");
  assert(
    Number(unassistedTerminalHold.endT) >= Number(firstBaseOut.resultAt) - 0.000001,
    "Unassisted 3U terminal hold ends before resultAt."
  );
  const unassistedHoldFrame = buildTimelineBallState(
    firstBaseOut,
    (Number(unassistedTerminalHold.t) + Number(firstBaseOut.resultAt)) / 2,
    BASE_EVENT
  );
  assert.equal(unassistedHoldFrame?.phase, "fielding-hold", "Unassisted 3U midpoint does not render the held ball.");
  assert.equal(Number(unassistedHoldFrame?.height), GAMECAST2_THROW_GLOVE_LIFT, "Unassisted 3U terminal ball is not held at glove height.");
  assert.equal(firstBaseOut.meta.invariants?.terminalPossessionVisible, true, "Unassisted 3U terminal possession invariant failed.");

  // A grounder fielded well off the bag stays a classic 3-1 with the pitcher
  // covering first at a plausible sprint speed.
  const deepFirstBaseOut = compilePlayTimeline({
    ...BASE_EVENT,
    id: "ground-zone-first-cover",
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "1B",
    fieldingZone: "first-corner",
    fieldingLane: 0.62,
    outsAfter: 1
  }, { anchors: ANCHORS });
  assert.equal(deepFirstBaseOut.meta.fielding?.unassisted ?? false, false, "A deep 1B grounder must remain a 3-1 pitcher-cover play.");
  const pitcherCover = deepFirstBaseOut.tracks.fielders.find((cue) => cue.who === "P" && cue.assignment === "receiver" && cue.path?.at(-1) === "first");
  assert(pitcherCover, "Pitcher does not cover first when 1B fields the ground ball away from the bag.");
  const pitcherCoverDistance = pointDistance(ANCHORS.P, ANCHORS.first);
  const pitcherCoverSeconds = (Number(pitcherCover.endT) - Number(pitcherCover.t)) * deepFirstBaseOut.durationMs / 1000;
  assert(
    pitcherCoverDistance / pitcherCoverSeconds <= 360,
    `Pitcher first-base coverage is too fast (${(pitcherCoverDistance / pitcherCoverSeconds).toFixed(1)}px/s).`
  );

  const legacyConflictingZone = compilePlayTimeline({
    ...BASE_EVENT,
    id: "ground-out-recorded-first-baseman-conflicting-zone",
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "1B",
    // A stale saved event can carry geometry from an older SS assignment.
    // The concrete recorded fielder must still own the play.
    fieldingZone: "shortstop-middle",
    fieldingLane: -0.08,
    defensiveThrowTarget: "first",
    outsAfter: 1
  }, { anchors: ANCHORS });
  assert.equal(
    legacyConflictingZone.meta.fielding?.fielder,
    "1B",
    "A stale ground-ball zone overrides the recorded first baseman."
  );
  assert(
    legacyConflictingZone.tracks.fielders.some((cue) => cue.who === "1B" && cue.phase === "approach"),
    "Recorded 1B does not move to field a conflicting legacy ground-ball event."
  );
  assert(
    !legacyConflictingZone.tracks.fielders.some((cue) => cue.who === "SS" && cue.phase === "approach"),
    "Shortstop incorrectly becomes the primary fielder for a recorded 1B groundout."
  );

  const safeFirstAttempt = compilePlayTimeline({
    ...BASE_EVENT,
    id: "ground-zone-first-safe-attempt",
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "1B",
    fieldingZone: "first-corner",
    fieldingLane: 0.68,
    defensiveThrowTarget: "first",
    basesBefore: [false, true, false],
    baseRunnerIdsBefore: ["", "r2", ""],
    basesAfter: [true, false, true],
    baseRunnerIdsAfter: ["batter", "", "r2"]
  }, { anchors: ANCHORS });
  assert.equal(safeFirstAttempt.meta.fielding?.throwTarget, null, "1B ground-ball single chases an already-safe runner/base.");
  assert.equal(safeFirstAttempt.tracks.ball.find((cue) => cue.phase === "fielding-throw"), undefined, "1B ground-ball single invents a late throw.");

  const thirdBaseThrow = compilePlayTimeline({
    ...BASE_EVENT,
    id: "ground-zone-third-backup",
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "RF",
    defensiveThrowTarget: "third",
    basesBefore: [false, true, false],
    baseRunnerIdsBefore: ["", "r2", ""],
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "r2"],
    outsAfter: 1
  }, { anchors: ANCHORS });
  const thirdBackup = thirdBaseThrow.tracks.fielders.find((cue) => cue.assignment === "backup" && cue.supportTarget === "third");
  assert.equal(thirdBackup?.who, "LF", "Third-base backup should be LF, not P/SS/2B.");
  const thirdBackupDistance = pointDistance(thirdBaseThrow.points[thirdBackup?.arrivesAt], thirdBaseThrow.points.third);
  assert(
    thirdBackupDistance >= 88 && thirdBackupDistance <= 132.01,
    `LF third-base backup is not visibly separated from the receiver (${thirdBackupDistance.toFixed(2)}px).`
  );
  for (const timeline of [firstBaseOut, deepFirstBaseOut, thirdBaseThrow]) {
    assert(
      !timeline.tracks.fielders.some((cue) => cue.assignment === "backup" && ["SS", "2B"].includes(cue.who)),
      "A middle infielder is still used as a generic base backup."
    );
  }
}

function verifyFirstBaseDoublePlayRotations() {
  const compileDoublePlay = (id, fieldingZone, fieldingLane) => compilePlayTimeline({
    ...BASE_EVENT,
    id,
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "1B",
    fieldingZone,
    fieldingLane,
    defensiveThrowTarget: "second",
    doublePlay: true,
    outsBefore: 0,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [false, false, false],
    baseRunnerIdsAfter: ["", "", ""]
  }, { anchors: ANCHORS });

  const nearBag = compileDoublePlay("double-play-3-6-3", "first-line", 0.9);
  const nearReceiver = nearBag.tracks.fielders.find((cue) => cue.phase === "relay-receive-first");
  const nearCover = nearBag.tracks.fielders.find((cue) => cue.phase === "relay-cover-first");
  const nearRelayThrow = nearBag.tracks.ball.find((cue) => cue.phase === "relay-throw");
  assert.equal(nearReceiver?.who, "1B", "Near-bag 1B double play is not completed as a 3-6-3.");
  assert.deepEqual(nearCover?.path, [nearBag.meta.fielding?.fieldingPoint, "first"], "3-6-3 first baseman does not return from the fielding point to first.");
  assert.equal(
    nearBag.tracks.fielders.find((cue) => cue.who === "P" && cue.assignment === "receiver"),
    undefined,
    "Pitcher overlaps the first baseman on a near-bag 3-6-3."
  );
  assert(nearRelayThrow && Number(nearCover?.endT) <= Number(nearRelayThrow.endT), "3-6-3 first baseman is not set before the return throw arrives.");
  verifyFielderCueIntervals("near-bag 3-6-3", nearBag);
  verifyThrowChains("near-bag 3-6-3", nearBag);

  const deepBag = compileDoublePlay("double-play-3-6-1", "first-corner", 0.62);
  const deepReceiver = deepBag.tracks.fielders.find((cue) => cue.phase === "relay-receive-first");
  const deepCover = deepBag.tracks.fielders.find((cue) => cue.phase === "relay-cover-first");
  const deepRelayThrow = deepBag.tracks.ball.find((cue) => cue.phase === "relay-throw");
  assert.equal(deepReceiver?.who, "P", "Deep 1B double play is not completed as a 3-6-1.");
  assert.deepEqual(deepCover?.path, ["P", "first"], "Pitcher does not cover first on the deep 3-6-1.");
  assert.equal(
    deepBag.tracks.fielders.find((cue) => cue.who === "1B" && cue.assignment === "receiver"),
    undefined,
    "First baseman unrealistically races back to cover a deep 3-6-1."
  );
  assert(deepRelayThrow && Number(deepCover?.endT) <= Number(deepRelayThrow.endT), "3-6-1 pitcher is not set before the return throw arrives.");
  verifyFielderCueIntervals("deep 3-6-1", deepBag);
  verifyThrowChains("deep 3-6-1", deepBag);
}

function verifyFieldAnchorContract() {
  assert.equal(FIELD_ANCHOR_PATHS.length, 1, "Only the Jamsil day field may be active.");
  for (const anchorPath of FIELD_ANCHOR_PATHS) {
    const payload = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
    const first = payload.anchors?.first;
    const second = payload.anchors?.second;
    const third = payload.anchors?.third;
    const batter = payload.anchors?.batter;
    const shortstop = payload.anchors?.SS;
    const secondBaseman = payload.anchors?.["2B"];
    const firstBaseman = payload.anchors?.["1B"];
    const thirdBaseman = payload.anchors?.["3B"];
    const leftFielder = payload.anchors?.LF;
    const centerFielder = payload.anchors?.CF;
    const rightFielder = payload.anchors?.RF;
    const centerWall = payload.anchors?.centerWall;
    assert(first && second && third, `${path.basename(anchorPath)}: first/second/third base anchors are missing.`);
    assert(batter, `${path.basename(anchorPath)}: authored batter-box anchor is missing.`);
    assert(shortstop && secondBaseman, `${path.basename(anchorPath)}: SS/2B anchors are missing.`);
    assert(leftFielder && centerFielder && rightFielder, `${path.basename(anchorPath)}: LF/CF/RF anchors are missing.`);
    assert(firstBaseman && thirdBaseman, `${path.basename(anchorPath)}: 1B/3B anchors are missing.`);
    assert(centerWall, `${path.basename(anchorPath)}: independent center-wall anchor is missing.`);
    const batterBounds = BATTER_BOX_BOUNDS[payload.fieldId];
    assert(batterBounds, `${path.basename(anchorPath)}: batter-box bounds are missing.`);
    assert(
      Number(batter.x) >= batterBounds.xMin && Number(batter.x) <= batterBounds.xMax
        && Number(batter.y) >= batterBounds.yMin && Number(batter.y) <= batterBounds.yMax,
      `${path.basename(anchorPath)}: batter anchor is outside the painted box (${batter.x}, ${batter.y}).`
    );
    const resolvedBatter = derivePlateActor(payload.anchors, "batter");
    assert(
      Math.hypot(Number(resolvedBatter?.x) - Number(batter.x), Number(resolvedBatter?.y) - Number(batter.y)) <= 0.001,
      `${path.basename(anchorPath)}: scene does not honor the authored batter anchor.`
    );
    assert(Math.abs(Number(first.y) - Number(third.y)) <= 1, `${path.basename(anchorPath)}: first/third base depth is asymmetric.`);
    assert(Math.abs(Number(shortstop.y) - Number(secondBaseman.y)) <= 1, `${path.basename(anchorPath)}: SS/2B depth is asymmetric.`);
    const middleDepths = [
      [shortstop, second, third],
      [secondBaseman, second, first]
    ].map(([fielder, upperBase, lowerBase]) => {
      const t = (Number(fielder.x) - Number(upperBase.x)) / (Number(lowerBase.x) - Number(upperBase.x));
      const baselineY = Number(upperBase.y) + (Number(lowerBase.y) - Number(upperBase.y)) * t;
      return baselineY - Number(fielder.y);
    });
    assert(
      middleDepths.every((depth) => depth >= 8 && depth <= 16),
      `${path.basename(anchorPath)}: SS/2B must play 8-16px behind the adjacent baseline (${middleDepths.map((depth) => depth.toFixed(2)).join(", ")}).`
    );
    const centerFieldDepth = Number(second.y) - Number(centerFielder.y);
    const sideFieldDepths = [
      Number(payload.anchors?.["3B"]?.y) - Number(leftFielder.y),
      Number(payload.anchors?.["1B"]?.y) - Number(rightFielder.y)
    ];
    assert(
      centerFieldDepth >= 36,
      `${path.basename(anchorPath)}: CF is too close to the middle infield (${centerFieldDepth.toFixed(1)}px).`
    );
    assert(
      sideFieldDepths.every((depth) => depth >= 105),
      `${path.basename(anchorPath)}: corner outfielders are too close to the infield (${sideFieldDepths.map((depth) => depth.toFixed(1)).join(", ")}px).`
    );
    assert(
      Math.abs(Number(centerWall.x) - 480) <= 1 && Math.abs(Number(centerWall.y) - 214) <= 2,
      `${path.basename(anchorPath)}: center wall is not authored at the actual center-field fence (${centerWall.x}, ${centerWall.y}).`
    );
    assert(
      pointDistance(centerWall, centerFielder) >= 50,
      `${path.basename(anchorPath)}: CF is still being reused as the center-field wall.`
    );
    const wallRatios = [leftFielder, centerFielder, rightFielder].map((fielder) => {
      const wallDistance = outfieldWallDistanceAlongRay(
        payload.anchors.home,
        fielder,
        payload.anchors.leftPole,
        centerWall,
        payload.anchors.rightPole
      );
      return pointDistance(payload.anchors.home, fielder) / wallDistance;
    });
    assert(
      wallRatios.every((ratio) => Number.isFinite(ratio) && ratio >= 0.72 && ratio <= 0.88),
      `${path.basename(anchorPath)}: outfielder wall-depth ratios are outside 0.72-0.88 (${wallRatios.map((ratio) => ratio.toFixed(3)).join(", ")}).`
    );
    assert(
      Math.abs(wallRatios[0] - wallRatios[2]) <= 0.01,
      `${path.basename(anchorPath)}: LF/RF wall-depth ratios are asymmetric (${wallRatios[0].toFixed(3)}, ${wallRatios[2].toFixed(3)}).`
    );
    const cornerBaseDistances = [
      pointDistance(firstBaseman, first),
      pointDistance(thirdBaseman, third)
    ];
    const cornerBasepathClearances = [
      pointToSegmentDistance(firstBaseman, first, second),
      pointToSegmentDistance(thirdBaseman, third, second)
    ];
    assert(
      cornerBaseDistances.every((distance) => distance >= 44 && distance <= 52),
      `${path.basename(anchorPath)}: 1B/3B are not in a realistic hold/fielding distance from their bags (${cornerBaseDistances.map((distance) => distance.toFixed(2)).join(", ")}px).`
    );
    assert(
      cornerBasepathClearances.every((distance) => distance >= 14 && distance <= 24),
      `${path.basename(anchorPath)}: 1B/3B sit on or too far from the basepath (${cornerBasepathClearances.map((distance) => distance.toFixed(2)).join(", ")}px).`
    );
    assert.deepEqual(
      Object.fromEntries(["LF", "CF", "RF"].map((key) => [key, GAMECAST2_DEFENDER_MOVE_ZONES[key]])),
      {
        LF: { x: 240, yTop: 90, yBottom: 180 },
        CF: { x: 190, yTop: 90, yBottom: 120 },
        RF: { x: 240, yTop: 90, yBottom: 180 }
      },
      "Production and verifier outfield movement zones no longer share the audited contract."
    );
    assert.equal(payload.fieldId, "field-jamsil-day", "A non-Jamsil field is active in the timeline contract.");
    assert.deepEqual(
      Object.fromEntries([
        "home",
        "first",
        "second",
        "third",
        "mound",
        "P",
        "C",
        "1B",
        "2B",
        "3B",
        "SS",
        "LF",
        "CF",
        "RF",
        "centerWall",
        "leftPole",
        "rightPole",
        "batter"
      ].map((key) => [key, [Number(payload.anchors[key]?.x), Number(payload.anchors[key]?.y)]])),
      {
        home: [480, 617],
        first: [758, 415],
        second: [480, 321],
        third: [202, 415],
        mound: [480, 407],
        P: [480, 414],
        C: [480, 646],
        "1B": [710, 416],
        "2B": [592, 347],
        "3B": [250, 416],
        SS: [368, 347],
        LF: [263, 298],
        CF: [480, 279],
        RF: [697, 298],
        centerWall: [480, 214],
        leftPole: [42, 252],
        rightPole: [918, 252],
        batter: [516, 622]
      },
      "Jamsil day anchors no longer match the canonical field coordinates."
    );
  }
}

function verifyAtlasContract() {
  const forbiddenThrowSources = new Set(["stance", "swing", "follow", "miss", "take"]);
  for (const atlasPath of ATLAS_PATHS) {
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
    const label = path.basename(atlasPath);
    assert.equal(atlas.meta?.registrationScaleMode, "sheet-common", `${label}: sheet-common registration is missing.`);
    const available = new Set(Object.keys(atlas.animations ?? {}));
    const missing = GAMECAST2_ATLAS_ANIMATION_KEYS.filter((key) => !available.has(key));
    assert.deepEqual(missing, [], `${label}: missing timeline atlas keys: ${missing.join(", ")}`);

    const throwFrames = atlas.animations?.throw?.frames ?? [];
    assert(throwFrames.length >= 3, `${label}: throw animation has too few frames.`);
    assert(throwFrames.every((frameName) => String(frameName).startsWith("throw_")), `${label}: throw animation references a foreign frame.`);
    const throwSources = atlas.meta?.motionSourcePoses?.throw ?? [];
    assert.equal(throwSources.length, 3, `${label}: throw equipment source contract is missing.`);
    assert(
      throwSources.every((pose) => !forbiddenThrowSources.has(String(pose))),
      `${label}: batting pose drives a fielding throw: ${throwSources.join(", ")}`
    );
  }
}

function verifyTimelineContract({ name, timeline }) {
  assert(Number.isFinite(timeline.durationMs) && timeline.durationMs > 0, `${name}: durationMs 오류`);
  assert.equal(timeline.tracks.pitcher[0]?.t, 0, `${name}: 투구가 타임라인 첫 동작이 아닙니다.`);
  assert.equal(timeline.tracks.pitcher[0]?.anim, "pitch", `${name}: 첫 투수 애니메이션이 pitch가 아닙니다.`);
  assert.equal(timeline.tracks.ball[0]?.phase, "pitch", `${name}: 공 트랙이 투구로 시작하지 않습니다.`);
  assert.equal(timeline.meta.pitchFirst, true, `${name}: pitch-first 메타 불변식 실패`);
  assert.equal(timeline.meta.invariants.animationContract, true, `${name}: animation atlas 계약 실패`);
  assert.equal(timeline.meta.invariants.resultAfterRunning, true, `${name}: 결과가 주루보다 먼저 표시됩니다.`);

  assert.equal(timeline.meta.invariants.terminalBallVisible, true, `${name}: terminal ball disappears before the result.`);
  assert.equal(timeline.meta.invariants.errorBallRemainsLoose, true, `${name}: error ball is incorrectly assigned to a fielder.`);

  const animationKeys = allCues(timeline)
    .map((cue) => cue.anim)
    .filter(Boolean);
  assert(
    animationKeys.every((key) => GAMECAST2_ATLAS_ANIMATION_KEYS.includes(key)),
    `${name}: 미선언 animation 키가 있습니다.`
  );

  for (const cue of allCues(timeline)) {
    assert(cue.t >= 0 && cue.t <= 1, `${name}: cue.t 범위 오류 ${cue.t}`);
    if (cue.endT !== undefined) {
      assert(cue.endT >= cue.t && cue.endT <= 1, `${name}: cue.endT 범위/순서 오류 ${cue.t}→${cue.endT}`);
    }
    for (const pointName of cue.path ?? []) {
      assert(timeline.points[pointName], `${name}: path 점 '${pointName}'가 points에 없습니다.`);
    }
    if (cue.at) assert(timeline.points[cue.at], `${name}: at 점 '${cue.at}'가 points에 없습니다.`);
  }

  const runningEndT = Math.max(0, ...allCues(timeline)
    .filter((cue) => ["run", "walk", "slide"].includes(cue.anim))
    .map((cue) => Number(cue.endT ?? cue.t)));
  assert(timeline.resultAt > runningEndT, `${name}: resultAt ${timeline.resultAt} <= runningEndT ${runningEndT}`);
  assert.equal(timeline.tracks.captions[0]?.t, timeline.resultAt, `${name}: caption/result 시점 불일치`);
  assert.equal(timeline.tracks.result[0]?.t, timeline.resultAt, `${name}: result commit 시점 불일치`);

  if (timeline.meta.fielding) verifyFieldingArrival(name, timeline);
  verifyFielderCueIntervals(name, timeline);

  const batterRun = timeline.tracks.batter.find((cue) => cue.path?.[0] === "home" && cue.path?.includes("first"));
  if (batterRun) {
    assert.deepEqual(batterRun.path.slice(0, 2), ["home", "first"], `${name}: 타자 첫 주루가 home→first가 아닙니다.`);
    assert(timeline.points.first.x > timeline.points.home.x, `${name}: 1루 진행 방향이 x 증가가 아닙니다.`);
  }
}

function verifyFieldingArrival(name, timeline) {
  const fielding = timeline.meta.fielding;
  const ball = timeline.tracks.ball.find((cue) => cue.phase === "batted");
  const fielder = timeline.tracks.fielders.find((cue) => cue.phase === "approach" && cue.who === fielding.fielder);
  assert(ball, `${name}: 타구 ball cue가 없습니다.`);
  assert(fielder, `${name}: 수비 접근 cue가 없습니다.`);
  assert.equal(ball.path.at(-1), fielding.ballPoint ?? fielding.landingPoint, `${name}: 타구 도착지점 불일치`);
  if (["safe-fly-drop", "safe-line-trap", "safe-line-short-hop", "safe-ground-through"].includes(fielding.resolution)) {
    const landingArrival = fielding.fieldingStyle === "dive" && fielding.resolution === "safe-fly-drop"
      ? timeline.tracks.fielders.find((cue) => cue.who === fielding.fielder && cue.phase === "miss")
      : fielder;
    const recovery = timeline.tracks.fielders.find((cue) => cue.who === fielding.fielder && cue.phase === "recover");
    assert.equal(landingArrival?.path?.at(-1), fielding.missPoint, `${name}: safe-hit landing enters the fielder body radius.`);
    assert.equal(landingArrival?.endT, fielding.ballLandingT, `${name}: safe-hit miss timing does not match landing.`);
    assert.deepEqual(recovery?.path, [fielding.missPoint, fielding.pickupPoint], `${name}: safe-hit recovery route is incomplete.`);
    assert.equal(recovery?.endT, fielding.fielderRouteArrivalT, `${name}: safe-hit recovery arrival does not match route metadata.`);
    assert.equal(ball.endT, fielding.ballLandingT, `${name}: safe-hit landing metadata differs from the ball cue.`);
    assert(fielding.fielderArrivalT > fielding.ballLandingT, `${name}: safe-hit fielder controls the ball before landing.`);
    const settle = timeline.tracks.ball.find((cue) => (
      cue.path?.[0] === fielding.landingPoint && cue.path?.at(-1) === fielding.pickupPoint
    ));
    assert.equal(settle?.endT, fielding.ballPickupArrivalT, `${name}: safe-hit ball pickup arrival does not match metadata.`);
    assert(Number(fielding.fielderRouteArrivalT) <= Number(fielding.fielderArrivalT), `${name}: possession precedes the fielder route arrival.`);
    assert(Number(fielding.ballPickupArrivalT) <= Number(fielding.ballArrivalT), `${name}: possession precedes the ball pickup arrival.`);
    assert(Number(fielding.landingSeparationPx) >= 41.5, `${name}: safe-hit landing separation is ${fielding.landingSeparationPx}px.`);
  } else {
    assert.equal(fielder.path.at(-1), fielding.landingPoint, `${name}: 수비수 도착지점 불일치`);
    assert(Number(fielder.endT) <= Number(ball.endT), `${name}: 수비수가 공보다 늦게 도착합니다.`);
  }
  assert.equal(fielding.ballArrivalT, fielding.fielderArrivalT, `${name}: fielding 메타 시점 불일치`);
  assert.equal(timeline.meta.invariants.fieldingArrivalMatchesBall, true, `${name}: fielding 도착 불변식 실패`);
  assert.equal(timeline.meta.invariants.possessionAfterBallAndFielder, true, `${name}: possession이 공/수비수보다 먼저 확정됩니다.`);

  const field = timeline.tracks.fielders.find((cue) => ["field", "catch", "pickup", "trap", "short-hop", "misplay"].includes(cue.phase) && cue.who === fielding.fielder);
  assert(field && field.t >= fielder.endT, `${name}: 포구/실책 동작이 수비 도착보다 빠릅니다.`);
  const fieldThrow = timeline.tracks.fielders.find((cue) => cue.phase === "throw" && cue.who === fielding.fielder);
  if (fieldThrow) assert(fieldThrow.t >= field.endT, `${name}: 송구가 포구보다 빠릅니다.`);
}

function verifyFlyBallResolution() {
  const caught = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 801,
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    outsAfter: 1
  }, { anchors: ANCHORS });
  const safe = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 802,
    outcome: "single",
    battedBallType: "flyBall",
    fieldingPosition: "RF",
    hitTrajectory: "fly-bloop",
    sprayLane: 0.6,
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  }, { anchors: ANCHORS });
  const caughtLine = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 803,
    outcome: "out",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    outsAfter: 1
  }, { anchors: ANCHORS });
  const safeLine = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 804,
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    attemptedFieldingPosition: "2B",
    hitTrajectory: "line-through",
    sprayLane: 0.45,
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  }, { anchors: ANCHORS });
  const challengingFly = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 805,
    outcome: "triple",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    hitTrajectory: "fly-gap",
    sprayLane: 0.55,
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "batter"]
  }, { anchors: ANCHORS });
  const challengingLine = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 806,
    outcome: "triple",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    hitTrajectory: "line-gap",
    sprayLane: 0.24,
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "batter"]
  }, { anchors: ANCHORS });

  const caughtFlight = caught.tracks.ball.find((cue) => cue.phase === "batted");
  const caughtField = caught.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "catch");
  assert.equal(caught.meta.fielding.resolution, "caught-fly", "뜬공 아웃이 포구 판정으로 표시되지 않습니다.");
  assert.equal(caughtFlight?.flightProfile, "hang", "뜬공 아웃 타구에 체공 프로필이 없습니다.");
  assert.equal(caughtFlight?.caughtDirectly, true, "뜬공 아웃 타구가 직접 포구로 표시되지 않습니다.");
  assert.equal(caughtFlight?.path?.at(-1), "catchGlove", "뜬공 아웃 타구가 글러브로 직접 향하지 않습니다.");
  assert.equal(caughtFlight?.arrivesAt, "catchGlove", "뜬공 아웃 타구의 도착점이 글러브가 아닙니다.");
  assert(!caught.tracks.ball.some((cue) => cue.bounce === true || String(cue.phase).includes("bounce")), "뜬공 아웃에 바운드 cue가 섞였습니다.");
  assert(
    Number(caught.points.catchGlove?.y) < Number(caught.points.landing?.y) - 20,
    "뜬공 아웃의 공이 야수 발밑까지 내려가 원바운드처럼 보입니다."
  );
  assert.equal(caughtField?.at, "landing", "뜬공 아웃 포구가 낙하지점에서 이뤄지지 않습니다.");
  assert.equal(caughtField?.anim, "catch", "뜬공 아웃 수비수가 포구 동작을 하지 않습니다.");
  assert(!caught.tracks.batter.some((cue) => cue.phase === "batter-run"), "뜬공 아웃 타자가 1루로 계속 달립니다.");

  const caughtLineFlight = caughtLine.tracks.ball.find((cue) => cue.phase === "batted");
  assert.equal(caughtLineFlight?.path?.at(-1), "catchGlove", "직선타 아웃 타구가 글러브로 직접 향하지 않습니다.");
  assert.equal(caughtLineFlight?.caughtDirectly, true, "직선타 아웃이 직접 포구로 표시되지 않습니다.");
  assert(!caughtLine.tracks.ball.some((cue) => cue.bounce === true), "직선타 아웃에 바운드 cue가 섞였습니다.");

  const safeLineFlight = safeLine.tracks.ball.find((cue) => cue.phase === "batted");
  const safeLineSettle = safeLine.tracks.ball.find((cue) => cue.phase === "line-settle");
  const safeLineShortHop = safeLine.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "short-hop");
  const safeLineRecovery = safeLine.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "recover");
  assert.equal(safeLine.meta.fielding.resolution, "safe-line-short-hop", "일반 직선타 안타가 숏바운드 처리로 표시되지 않습니다.");
  assert.equal(safeLine.meta.fielding.fieldingStyle, "short-hop", "일반 직선타 안타가 불필요한 다이빙으로 분류됩니다.");
  assert.equal(safeLine.meta.fielding.fielder, "RF", "직선타 안타의 실제 회수자가 외야수가 아닙니다.");
  assert.equal(safeLine.meta.fielding.attemptedFielder, "2B", "직선타가 지나간 내야수 정보가 보존되지 않습니다.");
  assert(safeLineFlight?.path?.includes("infieldGate"), "직선타 안타가 내야수 사이 통과점을 사용하지 않습니다.");
  assert.equal(safeLineFlight?.path?.at(-1), "landing", "직선타 안타가 지면에 먼저 도달하지 않습니다.");
  assert.equal(safeLineFlight?.caughtDirectly, false, "직선타 안타가 직접 포구로 잘못 표시됩니다.");
  assert.deepEqual(safeLineSettle?.path, ["landing", "pickup"], "직선타 안타의 짧은 지면 이동 경로가 없습니다.");
  assert.equal(safeLineSettle?.grounded, true, "직선타 안타의 착지 후 이동이 지면 이동이 아닙니다.");
  assert.equal(safeLineShortHop?.anim, "catch", "일반 직선타 안타 수비수가 숏바운드 처리 동작을 하지 않습니다.");
  assert.deepEqual(safeLineRecovery?.path, ["miss", "pickup"], "직선타 안타 외야수가 안전거리에서 회수하지 않습니다.");
  assert(
    !safeLine.tracks.fielders.some((cue) => cue.who === "RF" && cue.anim === "dive"),
    "일반 직선타 안타 수비수가 강제로 다이빙합니다."
  );
  assert(
    Number(safeLine.meta.fielding.ballLandingT) < Number(safeLineShortHop?.t),
    "직선타 안타가 땅에 닿기 전에 수비수가 숏바운드를 처리합니다."
  );
  assert(
    Math.hypot(
      Number(safeLine.points.pickup?.x) - Number(safeLine.points.landing?.x),
      Number(safeLine.points.pickup?.y) - Number(safeLine.points.landing?.y)
    ) >= 30 && Math.hypot(
      Number(safeLine.points.pickup?.x) - Number(safeLine.points.landing?.x),
      Number(safeLine.points.pickup?.y) - Number(safeLine.points.landing?.y)
    ) <= 36,
    "직선타 안타의 착지 후 롤이 30-36px 범위를 벗어납니다."
  );
  assert(
    postLandingDirectionDot(safeLine.points) > 0,
    "직선타 안타가 착지 후 홈 쪽으로 역주행합니다."
  );

  const safeFlight = safe.tracks.ball.find((cue) => cue.phase === "batted");
  const settle = safe.tracks.ball.find((cue) => cue.phase === "safe-settle");
  const approach = safe.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "approach");
  const recover = safe.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "recover");
  const pickup = safe.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "pickup");
  const batterRun = safe.tracks.batter.find((cue) => cue.phase === "batter-run");
  assert.equal(safe.meta.fielding.resolution, "safe-fly-drop", "뜬공 안타가 안전 낙하 판정으로 표시되지 않습니다.");
  assert.equal(safeFlight?.flightProfile, "hang", "뜬공 안타 타구가 체공 없이 땅볼처럼 직선 이동합니다.");
  assert.equal(safeFlight?.path?.at(-1), "landing", "뜬공 안타가 땅에 먼저 떨어지지 않습니다.");
  assert.equal(settle?.path?.[0], "landing", "뜬공 안타의 착지 후 이동이 낙하지점에서 시작하지 않습니다.");
  assert.equal(settle?.path?.at(-1), "pickup", "뜬공 안타의 착지 후 이동이 픽업 지점으로 이어지지 않습니다.");
  assert.equal(settle?.grounded, true, "뜬공 안타의 착지 후 이동이 지면 이동으로 표시되지 않습니다.");
  assert(
    !safe.tracks.ball.some((cue) => cue.bounce === true || String(cue.phase).includes("bounce")),
    "뜬공 안타가 외야수 앞에서 다시 튀어 땅볼처럼 보입니다."
  );
  assert(
    Math.hypot(
      Number(safe.points.pickup?.x) - Number(safe.points.landing?.x),
      Number(safe.points.pickup?.y) - Number(safe.points.landing?.y)
    ) >= 22 && Math.hypot(
      Number(safe.points.pickup?.x) - Number(safe.points.landing?.x),
      Number(safe.points.pickup?.y) - Number(safe.points.landing?.y)
    ) <= 28,
    "뜬공 안타의 착지 후 롤이 22-28px 범위를 벗어납니다."
  );
  assert(postLandingDirectionDot(safe.points) > 0, "뜬공 안타가 착지 후 홈 쪽으로 역주행합니다.");
  assert.equal(safe.meta.fielding.fieldingStyle, "run-through", "일반 뜬공 안타가 불필요한 다이빙으로 분류됩니다.");
  assert.deepEqual(approach?.path, ["RF", "miss"], "일반 뜬공 안타 수비수가 낙하 순간 포구 반경을 침범합니다.");
  assert.deepEqual(recover?.path, ["miss", "pickup"], "일반 뜬공 안타 수비수가 떨어진 공을 회수하지 않습니다.");
  assert(!safe.tracks.fielders.some((cue) => cue.who === "RF" && cue.anim === "dive"), "일반 뜬공 안타 수비수가 강제로 다이빙합니다.");
  assert.equal(pickup?.at, "pickup", "뜬공 안타 픽업 동작이 공 위치와 다릅니다.");
  assert(Number(pickup?.t) > Number(safe.meta.fielding.ballLandingT), "뜬공 안타 수비수가 낙하 전에 포구 동작을 합니다.");
  assert(batterRun && batterRun.out !== true, "뜬공 안타 타자 주루가 이어지지 않습니다.");
  assert(Number(safe.meta.fielding.fielderArrivalT) > Number(safe.meta.fielding.ballLandingT), "뜬공 안타 수비수가 낙하보다 늦게 도착하지 않습니다.");

  const challengingFlyMiss = challengingFly.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "miss");
  const challengingFlyRecover = challengingFly.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "recover");
  assert.equal(challengingFly.meta.fielding.fieldingStyle, "dive", "어려운 뜬공 안타에 다이빙 판단이 없습니다.");
  assert.equal(challengingFlyMiss?.anim, "dive", "어려운 뜬공 안타 수비수가 다이빙하지 않습니다.");
  assert.deepEqual(challengingFlyRecover?.path, ["miss", "pickup"], "다이빙한 수비수가 공으로 회복하지 않습니다.");

  const challengingLineTrap = challengingLine.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "trap");
  const challengingLineDive = challengingLine.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "recover");
  assert.equal(challengingLine.meta.fielding.resolution, "safe-line-trap", "어려운 직선타 안타가 다이빙 트랩으로 표시되지 않습니다.");
  assert.equal(challengingLine.meta.fielding.fieldingStyle, "dive", "어려운 직선타 안타에 다이빙 판단이 없습니다.");
  assert.equal(challengingLineDive?.anim, "dive", "어려운 직선타 안타 수비수가 공을 향해 다이빙하지 않습니다.");
  assert.equal(challengingLineTrap?.anim, "catch", "다이빙 후 공을 제어하는 동작이 없습니다.");
  assert(Number(challengingLineTrap?.t) > Number(challengingLine.meta.fielding.ballLandingT), "직선타 다이빙 트랩이 착지 전에 시작됩니다.");

  assert.equal(gamecast2FlyResolutionCue(caught, caught.meta.fielding.ballLandingT + 0.02)?.label, "OUT", "뜬공 아웃 현장 cue가 없습니다.");
  assert.equal(gamecast2FlyResolutionCue(safe, safe.meta.fielding.ballLandingT + 0.02)?.label, "SAFE HIT", "뜬공 안타 현장 cue가 없습니다.");
  assert.equal(gamecast2FlyResolutionCue(safe, safe.meta.fielding.ballLandingT - 0.02), null, "공이 떨어지기 전에 안타 cue가 표시됩니다.");
}

function verifyExistingRunnerPaths(compiled) {
  const single = compiled.find(({ name }) => name === "single-loaded")?.timeline;
  assert(single, "단타 만루 검증 타임라인이 없습니다.");
  const runnerMoves = single.tracks.runners.filter((cue) => cue.phase === "runner-advance");
  assert.equal(runnerMoves.length, 3, "단타에서 기존 주자 3명의 진루를 모두 만들지 못했습니다.");
  assert.deepEqual(
    runnerMoves.find((cue) => cue.runnerId === "r1")?.path,
    ["first", "second", "third"],
    "1루 주자의 3루 진루 경로가 다릅니다."
  );
  assert.deepEqual(
    runnerMoves.find((cue) => cue.runnerId === "r2")?.path,
    ["second", "third", "home"],
    "2루 득점 주자의 경로가 다릅니다."
  );
  assert.deepEqual(
    runnerMoves.find((cue) => cue.runnerId === "r3")?.path,
    ["third", "home"],
    "3루 득점 주자의 경로가 다릅니다."
  );

  const walk = compiled.find(({ name }) => name === "walk-loaded")?.timeline;
  const walkMoves = walk?.tracks.runners.filter((cue) => cue.phase === "runner-advance") ?? [];
  assert.deepEqual(walkMoves.find((cue) => cue.runnerId === "r1")?.path, ["first", "second"], "볼넷 밀어내기 1루 주자 경로 오류");
  assert.deepEqual(walkMoves.find((cue) => cue.runnerId === "r2")?.path, ["second", "third"], "볼넷 밀어내기 2루 주자 경로 오류");
  assert.deepEqual(walkMoves.find((cue) => cue.runnerId === "r3")?.path, ["third", "home"], "볼넷 밀어내기 3루 주자 경로 오류");

  const walkPitcherNumbers = walk?.tracks.pitcher
    .filter((cue) => cue.phase === "pitch")
    .map((cue) => cue.pitchNumber);
  const walkBallCues = walk?.tracks.ball.filter((cue) => cue.phase === "pitch") ?? [];
  assert.deepEqual(walkPitcherNumbers, [4], "Walk choreography must show only the decisive fourth-ball motion.");
  assert.deepEqual(walkBallCues.map((cue) => cue.pitchNumber), [4], "Walk choreography must contain only the decisive fourth pitch.");
  const walkAdvance = walk?.tracks.batter.find((cue) => cue.phase === "take-base-walk");
  assert(walkBallCues.at(-1)?.endT <= walkAdvance?.t, "The batter starts walking before ball four reaches the plate.");
  assert(walkAdvance?.t < walk?.resultAt, "The walk result appears before the batter is awarded first base.");
  assert(Number(walk?.durationMs) >= 4800, "Walk choreography is too short for a natural walk to first.");

  const strikeout = compiled.find(({ name }) => name === "strikeout")?.timeline;
  assert.deepEqual(
    strikeout?.tracks.pitcher.filter((cue) => cue.phase === "pitch").map((cue) => cue.pitchNumber),
    [3],
    "Strikeout choreography must show only the decisive third-strike motion."
  );
  assert.deepEqual(
    strikeout?.tracks.ball.filter((cue) => cue.phase === "pitch").map((cue) => cue.pitchNumber),
    [3],
    "Strikeout choreography must contain only the decisive third pitch."
  );

  const steal = compiled.find(({ name }) => name === "steal-success")?.timeline;
  assert.deepEqual(
    steal?.tracks.runners.find((cue) => cue.phase === "runner-advance")?.path,
    ["first", "second"],
    "도루 주자 경로 오류"
  );

  const doublePlay = compiled.find(({ name }) => name === "double-play")?.timeline;
  const forcedRunner = doublePlay?.tracks.runners.find((cue) => cue.phase === "runner-advance");
  assert.equal(forcedRunner?.out, true, "병살 선행주자가 out으로 표시되지 않았습니다.");
  assert.equal(doublePlay?.tracks.batter.find((cue) => cue.phase === "batter-run")?.out, true, "병살 타자가 out으로 표시되지 않았습니다.");
}

function verifyRunnerSpeedScaling() {
  const cases = [
    {
      name: "ground-single-1-to-2",
      distance: 1,
      path: ["first", "second"],
      event: {
        ...BASE_EVENT,
        outcome: "single",
        battedBallType: "groundBall",
        fieldingPosition: "2B",
        basesBefore: [true, false, false],
        baseRunnerIdsBefore: ["r1", "", ""],
        basesAfter: [true, true, false],
        baseRunnerIdsAfter: ["batter", "r1", ""]
      }
    },
    {
      name: "outfield-single-1-to-3",
      distance: 2,
      path: ["first", "second", "third"],
      event: {
        ...BASE_EVENT,
        outcome: "single",
        battedBallType: "lineDrive",
        fieldingPosition: "RF",
        basesBefore: [true, false, false],
        baseRunnerIdsBefore: ["r1", "", ""],
        basesAfter: [true, false, true],
        baseRunnerIdsAfter: ["batter", "", "r1"]
      }
    },
    ...["double", "triple"].map((outcome) => ({
      name: `${outcome}-runner-1-to-home`,
      distance: 3,
      path: ["first", "second", "third", "home"],
      event: {
        ...BASE_EVENT,
        outcome,
        battedBallType: outcome === "double" ? "lineDrive" : "flyBall",
        fieldingPosition: outcome === "double" ? "RF" : "CF",
        runs: 1,
        basesBefore: [true, false, false],
        baseRunnerIdsBefore: ["r1", "", ""],
        basesAfter: outcome === "double" ? [false, true, false] : [false, false, true],
        baseRunnerIdsAfter: outcome === "double" ? ["", "batter", ""] : ["", "", "batter"],
        scoredRunners: [{ id: "r1" }]
      }
    }))
  ];
  const runMsPerBase = new Map();

  for (const item of cases) {
    const timeline = compilePlayTimeline(item.event, { anchors: ANCHORS });
    assert.equal(
      getGamecast2PlayDurationMs(item.event),
      timeline.durationMs,
      `${item.name}: dynamic runner duration does not match the compiled timeline.`
    );
    const run = timeline.tracks.runners.find((cue) => cue.phase === "runner-advance" && cue.runnerId === "r1");
    const slide = timeline.tracks.runners.find((cue) => ["slide", "tag-play"].includes(cue.phase) && cue.runnerId === "r1");
    assert(run, `${item.name}: existing-runner cue is missing.`);
    const helperStartMs = getGamecast2RunnerStartMs(item.event);
    const timelineStartMs = Number(run.t) * timeline.durationMs;
    assert(
      Math.abs(Number(helperStartMs) - timelineStartMs) <= 0.01,
      `${item.name}: runner-start helper (${helperStartMs}ms) disagrees with timeline (${timelineStartMs}ms).`
    );
    assert.equal(run.basesAdvanced, item.distance, `${item.name}: existing runner advances the wrong number of bases.`);
    assert.deepEqual(run.path, item.path, `${item.name}: existing runner follows the wrong base path.`);
    const actualMsPerBase = ((Number(run.endT) - Number(run.t)) * timeline.durationMs) / item.distance;
    runMsPerBase.set(item.name, actualMsPerBase);
    assert(
      Math.abs(actualMsPerBase - 2600) <= 210,
      `${item.name}: existing runner pace is ${actualMsPerBase.toFixed(0)}ms/base instead of about 2600ms/base.`
    );
    if (item.distance >= 2) {
      assert(slide, `${item.name}: multi-base advance has no finishing slide.`);
      const slideMs = (Number(slide.endT) - Number(slide.t)) * timeline.durationMs;
      assert(Math.abs(slideMs - 270) <= 12, `${item.name}: slide duration is ${slideMs.toFixed(0)}ms instead of 270ms.`);
    }
    assert(
      Number(timeline.resultAt) >= Number(slide?.endT ?? run.endT),
      `${item.name}: result appears before the existing runner finishes.`
    );
  }

  const values = [...runMsPerBase.values()];
  assert(
    Math.max(...values) / Math.min(...values) <= 1.15,
    `existing-runner speed changes by play or distance: ${JSON.stringify(Object.fromEntries(runMsPerBase))}`
  );
}

function verifyHomeRunRunnerOrder() {
  const timeline = compilePlayTimeline({
    ...BASE_EVENT,
    id: "bases-loaded-home-run-order",
    outcome: "homeRun",
    runs: 4,
    basesBefore: [true, true, true],
    baseRunnerIdsBefore: ["r1", "r2", "r3"],
    scoredRunners: [{ id: "r3" }, { id: "r2" }, { id: "r1" }, { id: "batter" }]
  }, { anchors: ANCHORS });
  const batter = timeline.tracks.batter.find((cue) => cue.phase === "home-run-trot");
  const runnerArrival = (runnerId) => Math.max(
    0,
    ...timeline.tracks.runners
      .filter((cue) => cue.runnerId === runnerId)
      .map((cue) => Number(cue.endT ?? cue.t))
  );
  const arrivals = [runnerArrival("r3"), runnerArrival("r2"), runnerArrival("r1"), Number(batter?.endT)];

  assert(batter, "Bases-loaded home run has no batter trot cue.");
  assert.deepEqual(batter.path, ["home", "first", "second", "third", "home"], "Home-run batter does not complete all four bases.");
  assert(
    arrivals.every((value, index) => index === 0 || value > arrivals[index - 1]),
    `Home-run scoring order is not lead-runner first / batter last (${arrivals.join(" < ")}).`
  );
  const batterMsPerBase = ((Number(batter.endT) - Number(batter.t)) * timeline.durationMs) / 4;
  assert(
    Math.abs(batterMsPerBase - 3000) <= 12,
    `Home-run batter pace is ${batterMsPerBase.toFixed(1)}ms/base instead of 3000ms/base.`
  );
  assert(Number(timeline.resultAt) > Number(batter.endT), "Home-run result appears before the batter finishes scoring.");
}

function verifyThrowGatherLimit(compiled) {
  for (const { name, timeline } of compiled) {
    for (const throwCue of timeline.tracks.ball.filter((cue) => ["fielding-throw", "relay-throw"].includes(cue.phase))) {
      assert(Number.isFinite(Number(throwCue.gatherMs)), `${name}: ${throwCue.phase} has no gatherMs metadata.`);
      assert(
        Number(throwCue.gatherMs) >= -0.5 && Number(throwCue.gatherMs) <= 300.5,
        `${name}: ${throwCue.phase} gather is ${throwCue.gatherMs}ms (limit 300ms).`
      );
    }
  }
}

function verifyLongOutfieldRelays() {
  // Hits walk the ball back through the cutoff man. When the return would
  // beat the recorded-safe runner it stops at the cutoff; an uncontested
  // return completes the two-hop to the bag.
  const cases = [
    {
      label: "RF double cutoff return",
      cutoffOnly: true,
      event: {
        outcome: "double",
        battedBallType: "lineDrive",
        hitTrajectory: "line-gap",
        fieldingPosition: "RF",
        defensiveThrowTarget: "home",
        runs: 1,
        basesBefore: [false, true, false],
        baseRunnerIdsBefore: ["", "r2", ""],
        basesAfter: [false, true, false],
        baseRunnerIdsAfter: ["", "batter", ""],
        scoredRunners: [{ id: "r2" }]
      }
    },
    {
      label: "CF triple cutoff return",
      cutoffOnly: true,
      event: {
        outcome: "triple",
        battedBallType: "flyBall",
        hitTrajectory: "fly-gap",
        sprayLane: 0.4,
        fieldingLane: 0.4,
        fieldingPosition: "CF",
        defensiveThrowTarget: "third",
        basesAfter: [false, false, true],
        baseRunnerIdsAfter: ["", "", "batter"]
      }
    },
    {
      label: "RF deep single two-hop return",
      cutoffOnly: false,
      target: "second",
      event: {
        outcome: "single",
        battedBallType: "flyBall",
        hitTrajectory: "fly-gap-drop",
        sprayLane: 0.9,
        fieldingPosition: "RF",
        defensiveThrowTarget: "second",
        basesAfter: [true, false, false],
        baseRunnerIdsAfter: ["batter", "", ""]
      }
    }
  ];

  for (const [index, item] of cases.entries()) {
    const timeline = compilePlayTimeline({
      ...BASE_EVENT,
      id: `long-outfield-relay-${index}`,
      sequence: 910 + index,
      defenderProfile: { id: "primary", arm: 180 },
      defenseProfilesByPosition: {
        "2B": { id: "cutoff-2b", arm: 55 },
        SS: { id: "cutoff-ss", arm: 55 }
      },
      ...item.event
    }, { anchors: ANCHORS });
    const throws = timeline.tracks.ball.filter((cue) => ["fielding-throw", "relay-throw"].includes(cue.phase));
    const [firstLeg, finalLeg] = throws;
    const relay = timeline.meta.fielding?.relay;

    assert(relay?.fielder && relay?.point, `${item.label}: relay metadata is missing.`);
    assert.equal(firstLeg?.phase, "fielding-throw", `${item.label}: missing outfielder-to-cutoff leg.`);
    assert.equal(firstLeg.path?.at(-1), relay.point, `${item.label}: first leg bypasses the cutoff point.`);
    assert.equal(firstLeg.armScore, 180, `${item.label}: first leg ignored the outfielder arm.`);
    if (item.cutoffOnly) {
      assert.equal(relay.cutoffOnly, true, `${item.label}: contested return did not stop at the cutoff.`);
      assert.equal(throws.length, 1, `${item.label}: cutoff-only return still throws on to the base.`);
      assert.equal(timeline.meta.fielding?.throwTarget, null, `${item.label}: cutoff-only return advertises a contested base.`);
      assert.equal(firstLeg.ordering, "cutoff-return", `${item.label}: cutoff-only return has the wrong ordering metadata.`);
    } else {
      assert.equal(relay.cutoffOnly ?? false, false, `${item.label}: uncontested return collapsed to cutoff-only.`);
      assert.equal(throws.length, 2, `${item.label}: uncontested return is not a two-hop relay.`);
      assert.equal(finalLeg?.phase, "relay-throw", `${item.label}: missing cutoff-to-base leg.`);
      assert.equal(finalLeg.path?.[0], relay.point, `${item.label}: second leg does not leave the cutoff point.`);
      assert.equal(finalLeg.path?.at(-1), item.target, `${item.label}: relay does not finish at ${item.target}.`);
      assert.equal(finalLeg.armScore, 55, `${item.label}: second leg ignored the cutoff arm.`);
      assert(Number(firstLeg.arc) < Number(finalLeg.arc), `${item.label}: per-fielder arm does not change throw arc.`);
      const cutoffToReleaseMs = (Number(finalLeg.t) - Number(firstLeg.endT)) * timeline.durationMs;
      assert(cutoffToReleaseMs <= 300.5, `${item.label}: cutoff holds the ball ${cutoffToReleaseMs.toFixed(1)}ms.`);
      const baseReceiver = timeline.tracks.fielders.find((cue) => (
        cue.anim === "catch"
        && cue.at === item.target
        && Number(cue.t) <= Number(finalLeg.endT)
        && Number(cue.endT) >= Number(finalLeg.endT)
      ));
      assert(baseReceiver, `${item.label}: final receiver is not set before the relay arrives.`);
    }

    for (const throwCue of throws) {
      assert(Number(throwCue.gatherMs) <= 300.5, `${item.label}: ${throwCue.phase} gather exceeds 300ms.`);
      const flightMs = (Number(throwCue.endT) - Number(throwCue.t)) * timeline.durationMs;
      assert(flightMs <= 620.5, `${item.label}: ${throwCue.phase} is stretched to ${flightMs.toFixed(1)}ms.`);
    }
    const pickupToReleaseMs = (Number(firstLeg.t) - Number(timeline.meta.fielding.fielderArrivalT)) * timeline.durationMs;
    assert(pickupToReleaseMs <= 300.5, `${item.label}: outfielder holds the ball ${pickupToReleaseMs.toFixed(1)}ms.`);

    const support = timeline.tracks.fielders.filter((cue) => (
      cue.phase === "support-relay"
      && cue.who === relay.fielder
      && cue.path?.at(-1) === relay.point
    ));
    assert.equal(support.length, 1, `${item.label}: cutoff support route is missing or duplicated.`);
    assert(Number(support[0].endT) <= Number(firstLeg.endT), `${item.label}: cutoff arrives after the first throw.`);
    const cutoffCatch = timeline.tracks.fielders.find((cue) => (
      cue.phase === "relay-receive"
      && cue.who === relay.fielder
      && cue.at === relay.point
      && Number(cue.t) <= Number(firstLeg.endT)
      && Number(cue.endT) >= Number(firstLeg.endT)
    ));
    assert(cutoffCatch, `${item.label}: cutoff has no catch cue covering first-leg arrival.`);
    if (item.cutoffOnly) {
      verifyTerminalPossessionHold(item.label, timeline, {
        at: relay.point,
        who: relay.fielder,
        startT: relay.receiveT
      });
    }
    verifyThrowChains(`long-relay-${item.label}`, timeline);
  }
}

function verifyRecoveredMiddleInfielderReceivers() {
  const cases = [
    {
      label: "RF ground-through / recovered 2B",
      fieldingPosition: "RF",
      attemptedFieldingPosition: "2B",
      cutoff: "SS",
      receiver: "2B",
      fieldingZone: "first-hole",
      lane: 0.38
    },
    {
      label: "LF ground-through / recovered SS",
      fieldingPosition: "LF",
      attemptedFieldingPosition: "SS",
      cutoff: "2B",
      receiver: "SS",
      fieldingZone: "third-hole",
      lane: -0.38
    }
  ];

  for (const [index, item] of cases.entries()) {
    const timeline = compilePlayTimeline({
      ...BASE_EVENT,
      id: `recovered-middle-receiver-${index}`,
      sequence: 940 + index,
      outcome: "single",
      battedBallType: "groundBall",
      hitTrajectory: "ground-through",
      fieldingPosition: item.fieldingPosition,
      attemptedFieldingPosition: item.attemptedFieldingPosition,
      fieldingZone: item.fieldingZone,
      fieldingLane: item.lane,
      sprayLane: item.lane,
      basesAfter: [true, false, false],
      baseRunnerIdsAfter: ["batter", "", ""]
    }, { anchors: ANCHORS });

    const relay = timeline.meta.fielding?.relay;
    const receiverRoute = timeline.tracks.fielders.find((cue) => (
      cue.who === item.receiver
      && cue.assignment === "receiver"
      && cue.path?.at(-1) === "second"
    ));
    const receiverCatch = timeline.tracks.fielders.find((cue) => (
      cue.who === item.receiver
      && cue.assignment === "receiver"
      && cue.at === "second"
      && cue.anim === "catch"
    ));
    const attemptedMiss = timeline.tracks.fielders.find((cue) => (
      cue.who === item.attemptedFieldingPosition
      && cue.phase === "infield-attempt-miss"
    ));
    const centerFieldReceiver = timeline.tracks.fielders.find((cue) => (
      cue.who === "CF"
      && cue.assignment === "receiver"
      && (cue.at === "second" || cue.path?.at(-1) === "second")
    ));

    assert.equal(relay?.fielder, item.cutoff, `${item.label}: the other middle infielder is not the cutoff man.`);
    assert.equal(timeline.meta.fielding?.receiver, item.receiver, `${item.label}: recovered middle infielder is not the second-base receiver.`);
    assert(receiverRoute && receiverCatch, `${item.label}: receiver lacks a complete cover/catch sequence at second.`);
    assert.equal(centerFieldReceiver, undefined, `${item.label}: CF incorrectly becomes the second-base receiver.`);
    assert(attemptedMiss, `${item.label}: attempted middle-infield miss cue is missing.`);
    assert(
      Number(receiverRoute.t) >= Number(attemptedMiss.endT) - 0.000001,
      `${item.label}: receiver starts covering second before recovering from the miss.`
    );
    const finalRelayThrow = timeline.tracks.ball.find((cue) => cue.phase === "relay-throw" && cue.path?.at(-1) === "second");
    assert(finalRelayThrow, `${item.label}: bases-empty single does not complete its full relay to second.`);
    assert.equal(relay?.cutoffOnly ?? false, false, `${item.label}: uncontested return unexpectedly stops at the cutoff.`);
    verifyTerminalPossessionHold(item.label, timeline, {
      at: "second",
      who: item.receiver,
      startT: finalRelayThrow.endT
    });
    verifyFielderCueIntervals(item.label, timeline);
    verifyThrowChains(item.label, timeline);
  }
}

function verifyPlaybackClock() {
  const cases = [
    {
      event: {
        ...BASE_EVENT,
        outcome: "single",
        battedBallType: "groundBall",
        fieldingPosition: "SS",
        basesAfter: [true, false, false],
        baseRunnerIdsAfter: ["batter", "", ""]
      },
      basesAdvanced: 1,
      expectedPath: ["home", "first"],
      legacyDurationMs: 3900,
      legacyLandingT: 0.38,
      legacyThrowEndT: null,
      fieldingDelayMs: 0
    },
    {
      event: {
        ...BASE_EVENT,
        outcome: "out",
        battedBallType: "groundBall",
        fieldingPosition: "2B",
        outsAfter: 1
      },
      basesAdvanced: 1,
      expectedPath: ["home", "first"],
      legacyDurationMs: 3500,
      legacyLandingT: 0.41,
      legacyThrowEndT: 0.64,
      fieldingDelayMs: 0
    },
    {
      event: {
        ...BASE_EVENT,
        outcome: "double",
        battedBallType: "lineDrive",
        fieldingPosition: "RF",
        basesAfter: [false, true, false],
        baseRunnerIdsAfter: ["", "batter", ""]
      },
      basesAdvanced: 2,
      expectedPath: ["home", "first", "second"],
      legacyDurationMs: 4400,
      legacyLandingT: 0.48,
      legacyThrowEndT: 0.72,
      landingDelayMs: 250,
      fieldingDelayMs: 1450
    },
    {
      event: {
        ...BASE_EVENT,
        outcome: "triple",
        battedBallType: "flyBall",
        fieldingPosition: "CF",
        basesAfter: [false, false, true],
        baseRunnerIdsAfter: ["", "", "batter"]
      },
      basesAdvanced: 3,
      expectedPath: ["home", "first", "second", "third"],
      legacyDurationMs: 4800,
      legacyLandingT: 0.51,
      legacyThrowEndT: 0.76,
      landingDelayMs: 1550,
      fieldingDelayMs: 2500,
      safeFlyRecoveryMs: 216
    }
  ];
  const sequence = {
    mode: "watch",
    paMs: 2600,
    gapMs: 340,
    events: []
  };
  const batterRunTimes = new Map();
  const oneBaseRunTimes = new Map();

  for (const item of cases) {
    const timeline = compilePlayTimeline(item.event, { anchors: ANCHORS });
    const event = {
      ...item.event,
      gamecastDurationMs: getGamecast2PlayDurationMs(item.event)
    };
    sequence.events.push(event);
    const playbackMs = gamecastEventPlayDuration(sequence, event);
    assert.equal(playbackMs, timeline.durationMs, `${timeline.template}: authored timeline duration is not used by watch playback.`);
    const run = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    assert(run, `${timeline.template}: batter-run cue is missing.`);
    assert.equal(run.basesAdvanced, item.basesAdvanced, `${timeline.template}: batter advances the wrong number of bases.`);
    assert.deepEqual(run.path, item.expectedPath, `${timeline.template}: batter follows the wrong base path.`);
    const actualRunMsPerBase = ((Number(run.endT) - Number(run.t)) * playbackMs) / item.basesAdvanced;
    batterRunTimes.set(timeline.template, actualRunMsPerBase);
    assert(
      Math.abs(actualRunMsPerBase - 3000) <= 15,
      `${timeline.template}: batter pace is ${actualRunMsPerBase.toFixed(0)}ms/base instead of 3000ms/base.`
    );
    if (timeline.template === "single") {
      oneBaseRunTimes.set("single", actualRunMsPerBase);
      assert(actualRunMsPerBase >= 2985, `ground-ball single reaches first too quickly: ${actualRunMsPerBase.toFixed(0)}ms.`);
    } else if (timeline.template === "infieldOut") {
      oneBaseRunTimes.set("infieldOut", actualRunMsPerBase);
    }

    const actionCues = [
      ["pitch", timeline.tracks.ball.find((cue) => cue.phase === "pitch"), 0.2 * item.legacyDurationMs],
      ["landing", timeline.tracks.ball.find((cue) => cue.phase === "batted"), item.legacyLandingT * item.legacyDurationMs + Number(item.landingDelayMs ?? 0)]
    ];
    if (item.legacyThrowEndT !== null) {
      actionCues.push([
        "throw",
        fieldingDecisionThrow(timeline),
        item.legacyThrowEndT * item.legacyDurationMs + item.fieldingDelayMs + Number(item.safeFlyRecoveryMs ?? 0)
      ]);
    }
    for (const [phase, cueEntry, legacyMs] of actionCues) {
      assert(cueEntry, `${timeline.template}: ${phase} cue is missing.`);
      if (phase === "throw") {
        const firstLeg = timeline.tracks.ball.find((cue) => (
          cue.phase === "fielding-throw" && cue.path?.at(-1) === cueEntry.path?.[0]
        ));
        const possessionT = Number(firstLeg?.endT ?? timeline.meta.fielding?.fielderArrivalT);
        const pickupToReleaseMs = (Number(cueEntry.t) - possessionT) * playbackMs;
        assert(
          pickupToReleaseMs >= -0.5 && pickupToReleaseMs <= 300.5,
          `${timeline.template}: pickup-to-release is ${pickupToReleaseMs.toFixed(1)}ms (limit 300ms).`
        );
        assert(Number(cueEntry.flightMs) >= 150, `${timeline.template}: throw has no realistic flight interval.`);
        assert(Number(cueEntry.flightMs) <= 620, `${timeline.template}: throw is stretched to ${cueEntry.flightMs}ms.`);
        if (timeline.outcome === "out") {
          assert.equal(cueEntry.ordering, "out-first", `${timeline.template}: force throw loses recorded out ordering.`);
        }
        continue;
      }
      const actualMs = Number(cueEntry.endT) * playbackMs;
      const toleranceMs = Math.max(20, legacyMs * 0.03);
      assert(
        Math.abs(actualMs - legacyMs) <= toleranceMs,
        `${timeline.template}: ${phase} timing drifted from ${legacyMs.toFixed(0)}ms to ${actualMs.toFixed(0)}ms.`
      );
    }
  }

  const oneBaseTimes = [...oneBaseRunTimes.values()];
  assert(
    Math.max(...oneBaseTimes) / Math.min(...oneBaseTimes) <= 1.15,
    `ground-ball one-base running speed changes by outcome: ${JSON.stringify(Object.fromEntries(oneBaseRunTimes))}`
  );
  const allBatterRunTimes = [...batterRunTimes.values()];
  assert(
    Math.max(...allBatterRunTimes) / Math.min(...allBatterRunTimes) <= 1.15,
    `batter running speed changes by distance: ${JSON.stringify(Object.fromEntries(batterRunTimes))}`
  );

  const emptyBasesRightFieldSingle = compilePlayTimeline({
    ...BASE_EVENT,
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    basesBefore: [false, false, false],
    baseRunnerIdsBefore: ["", "", ""],
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  }, { anchors: ANCHORS });
  const rightFieldFlight = emptyBasesRightFieldSingle.tracks.ball.find((cue) => cue.phase === "batted");
  const rightFielderRoute = emptyBasesRightFieldSingle.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "approach");
  const rightFielderRead = emptyBasesRightFieldSingle.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "read");
  assert(rightFieldFlight && rightFielderRoute && rightFielderRead, "empty-bases right-field single has no RF flight/read/route cues.");
  const rightFieldFlightMs = (Number(rightFieldFlight.endT) - Number(rightFieldFlight.t)) * emptyBasesRightFieldSingle.durationMs;
  const rightFielderRouteMs = (Number(rightFielderRoute.endT) - Number(rightFielderRoute.t)) * emptyBasesRightFieldSingle.durationMs;
  const rightFielderRoutePx = pointDistance(
    emptyBasesRightFieldSingle.points[rightFielderRoute.path?.[0]],
    emptyBasesRightFieldSingle.points[rightFielderRoute.path?.at(-1)]
  );
  const rightFielderRouteSpeed = rightFielderRoutePx / Math.max(0.001, rightFielderRouteMs / 1000);
  const rightFielderReactionMs = (Number(rightFielderRead.t) - Number(rightFieldFlight.t)) * emptyBasesRightFieldSingle.durationMs;
  assert(
    rightFieldFlightMs >= 850 && rightFieldFlightMs <= 1450,
    `right-field line drive has an unrealistic ${rightFieldFlightMs.toFixed(0)}ms flight.`
  );
  assert(
    rightFielderRouteSpeed >= 45 && rightFielderRouteSpeed <= 240,
    `right fielder has an unrealistic ${rightFielderRouteSpeed.toFixed(1)}px/s route.`
  );
  assert(
    rightFielderReactionMs >= 120 && rightFielderReactionMs <= 260,
    `right fielder reacts ${rightFielderReactionMs.toFixed(0)}ms after contact.`
  );

  const expectedTotal = sequence.events.reduce((total, event) => total + event.gamecastDurationMs + sequence.gapMs, 0);
  assert.equal(gamecastTotalDuration(sequence), expectedTotal, "watch total duration does not accumulate per-play timeline durations.");
  const firstSlotMs = sequence.events[0].gamecastDurationMs + sequence.gapMs;
  const endOfFirst = gamecastPlaybackPosition(sequence, firstSlotMs - 1);
  const startOfSecond = gamecastPlaybackPosition(sequence, firstSlotMs);
  assert.equal(endOfFirst.index, 0, "playback leaves the first variable-duration event too early.");
  assert.equal(startOfSecond.index, 1, "playback does not advance at the accumulated event boundary.");
  assert.equal(startOfSecond.localMs, 0, "second event does not start at local time zero.");
  assert.equal(startOfSecond.playMs, sequence.events[1].gamecastDurationMs, "second event uses the wrong authored duration.");
  assert.equal(
    gamecastEventPlayDuration({ ...sequence, mode: "summary" }, sequence.events[0]),
    sequence.paMs,
    "summary playback no longer uses its compact fixed duration."
  );
}

function verifyFielderCueIntervals(name, timeline) {
  const grouped = new Map();
  for (const cue of timeline.tracks.fielders) {
    const entries = grouped.get(cue.who) ?? [];
    entries.push(cue);
    grouped.set(cue.who, entries);
  }
  for (const [who, entries] of grouped) {
    const ordered = [...entries].sort((a, b) => a.t - b.t || Number(a.endT ?? a.t) - Number(b.endT ?? b.t));
    for (let index = 1; index < ordered.length; index += 1) {
      const previousEnd = Number(ordered[index - 1].endT ?? ordered[index - 1].t);
      assert(
        ordered[index].t >= previousEnd - 0.000001,
        `${name}: ${who} 수비 cue가 겹칩니다 (${ordered[index - 1].phase} -> ${ordered[index].phase}).`
      );
    }
  }
}

function verifyDefensiveRotation(compiled) {
  const fielded = compiled.filter(({ timeline }) => timeline.meta.fielding);
  for (const { name, event, timeline } of fielded) {
    verifyRoleBasedDefensiveMotion(name, event, timeline);
    const throwBall = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
    if (!throwBall) continue;
    const target = throwBall.path?.at(-1);
    const receive = timeline.tracks.fielders.find((cue) => (
      cue.phase === `receive-${target}`
      || (cue.phase === "relay-receive" && cue.at === target)
    ));
    assert(receive, `${name}: ${target} 송구를 받는 수비수 포구 cue가 없습니다.`);
    assert(receive.t <= throwBall.endT && receive.endT >= throwBall.endT, `${name}: 포구 cue가 공 도착 시점을 감싸지 않습니다.`);
    assert.equal(receive.at, target, `${name}: 수신 수비수와 송구 도착 베이스가 다릅니다.`);
  }

  const infieldOut = compiled.find(({ name }) => name === "infield-out")?.timeline;
  const firstCover = infieldOut?.tracks.fielders.find((cue) => cue.who === "1B" && cue.phase === "cover-first");
  assert.deepEqual(firstCover?.path, ["1B", "first"], "내야 땅볼에서 1루수가 1루 포구 위치로 움직이지 않습니다.");
  const infieldSupportRoles = new Set(
    infieldOut?.tracks.fielders
      .filter((cue) => ["relay", "base-cover", "backup"].includes(cue.assignment))
      .map((cue) => cue.assignment)
  );
  assert(infieldSupportRoles.has("backup"), "내야 땅볼에 베이스/타구 백업 역할이 없습니다.");
  const firstBackup = infieldOut?.tracks.fielders.find((cue) => cue.assignment === "backup" && cue.supportTarget === "first");
  const firstBackupDestination = infieldOut?.points?.[firstBackup?.arrivesAt];
  assert.equal(firstBackup?.who, "RF", "1루 백업은 투수/키스톤의 횡단 질주 대신 우익수가 맡아야 합니다.");
  assert(
    pointDistance(firstBackupDestination, infieldOut?.points?.first) >= 88
      && pointDistance(firstBackupDestination, infieldOut?.points?.first) <= 132.01,
    "투수의 1루 백업 동선이 베이스 근처까지 도달하지 않습니다."
  );
  const incomingToFirst = {
    x: Number(infieldOut?.points?.first?.x) - Number(infieldOut?.points?.[firstBackup?.toward]?.x),
    y: Number(infieldOut?.points?.first?.y) - Number(infieldOut?.points?.[firstBackup?.toward]?.y)
  };
  const firstToBackup = {
    x: Number(firstBackupDestination?.x) - Number(infieldOut?.points?.first?.x),
    y: Number(firstBackupDestination?.y) - Number(infieldOut?.points?.first?.y)
  };
  assert(
    incomingToFirst.x * firstToBackup.x + incomingToFirst.y * firstToBackup.y > 0,
    "투수의 1루 백업 위치가 송구 연장선 뒤쪽이 아닙니다."
  );

  const doublePlay = compiled.find(({ name }) => name === "double-play")?.timeline;
  assert(
    doublePlay?.tracks.fielders.some((cue) => cue.phase === "relay-receive-first" && cue.at === "first"),
    "병살 릴레이에서 1루 포구 수비수가 움직이지 않습니다."
  );
  const relayBall = doublePlay?.tracks.ball.find((cue) => cue.phase === "relay-throw");
  const relayReceive = doublePlay?.tracks.fielders.find((cue) => cue.phase === "relay-receive-first");
  assert(
    relayBall && relayReceive && relayReceive.t <= relayBall.endT && relayReceive.endT >= relayBall.endT,
    "병살 1루 포구 cue가 릴레이 공 도착 시점을 감싸지 않습니다."
  );
}

function verifyRoleBasedDefensiveMotion(name, event, timeline) {
  if (!timeline?.meta?.fielding) return;
  const supportRoles = new Set(["relay", "base-cover", "backup"]);
  const supports = timeline.tracks.fielders.filter((cue) => supportRoles.has(cue.assignment));
  const supportActors = new Set();
  for (const cue of supports) {
    assert(!supportActors.has(cue.who), `${name}: ${cue.who} has multiple support assignments.`);
    supportActors.add(cue.who);
    assert.equal(cue.path?.length, 2, `${name}: ${cue.who} ${cue.assignment} route is not purposeful.`);
    assert.equal(cue.arrivesAt, cue.path?.at(-1), `${name}: ${cue.who} ${cue.assignment} has no explicit destination.`);
    assert(timeline.points?.[cue.arrivesAt], `${name}: ${cue.who} ${cue.assignment} destination is missing.`);
    assert(cue.supportTarget && timeline.points?.[cue.supportTarget], `${name}: ${cue.who} ${cue.assignment} has no baseball target.`);
    const routeDistance = pointDistance(timeline.points?.[cue.path?.[0]], timeline.points?.[cue.arrivesAt]);
    assert(routeDistance >= 13.9, `${name}: ${cue.who} ${cue.assignment} route moves only ${routeDistance.toFixed(2)}px.`);
    const baseBackup = cue.assignment === "backup" && ["home", "first", "second", "third"].includes(cue.supportTarget);
    if (["backup", "relay"].includes(cue.assignment) && !baseBackup) {
      assert(routeDistance >= 17.9, `${name}: ${cue.who} ${cue.assignment} route is not visibly meaningful.`);
    }
    if (baseBackup) {
      const targetDistance = pointDistance(timeline.points?.[cue.arrivesAt], timeline.points?.[cue.supportTarget]);
      if (["first", "third"].includes(cue.supportTarget)) {
        assert(
          targetDistance >= 88 && targetDistance <= 132.01,
          `${name}: ${cue.who} overlaps the ${cue.supportTarget} receiver at ${targetDistance.toFixed(2)}px.`
        );
      } else if (cue.supportTarget === "second") {
        assert(
          targetDistance >= 40 && targetDistance <= 78.01,
          `${name}: ${cue.who} second-base backup distance ${targetDistance.toFixed(2)}px is outside 40-78px.`
        );
      } else {
        assert(
          targetDistance <= 42.01,
          `${name}: ${cue.who} backs up ${cue.supportTarget} from ${targetDistance.toFixed(2)}px away.`
        );
      }
    }
  }

  if (supports.length > 1) {
    const schedules = new Set(supports.map((cue) => `${cue.t}:${cue.endT}`));
    assert.equal(
      schedules.size,
      supports.length,
      `${name}: support defenders still start and stop as one synchronized group.`
    );
  }

  const moving = timeline.tracks.fielders.filter((cue) => cue.path?.length > 1);
  const boundaries = [...new Set(moving.flatMap((cue) => [Number(cue.t), Number(cue.endT)]))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let maximumConcurrent = 0;
  for (let index = 1; index < boundaries.length; index += 1) {
    const sampleT = (boundaries[index - 1] + boundaries[index]) / 2;
    const activeActors = new Set(
      moving
        .filter((cue) => sampleT >= Number(cue.t) && sampleT <= Number(cue.endT))
        .map((cue) => cue.who)
    );
    maximumConcurrent = Math.max(maximumConcurrent, activeActors.size);
  }
  assert(
    maximumConcurrent <= 4,
    `${name}: ${maximumConcurrent} defenders move at once; role rotation must stay at four or fewer.`
  );

  const catcherSupport = supports.find((cue) => cue.who === "C");
  if (catcherSupport) {
    assert(
      String(event?.battedBallType ?? "").toLowerCase().includes("bunt"),
      `${name}: catcher abandons home on a non-bunt support route.`
    );
  }
  for (const pitcherSupport of supports.filter((cue) => cue.who === "P")) {
    assert.equal(pitcherSupport.assignment, "backup", `${name}: pitcher is not assigned to a backup route.`);
  }
}

function verifyFielderPositionMatrix() {
  const plays = matrixPlayCases();
  let matrixCount = 0;
  for (const [playName, overrides] of plays) {
    for (const fieldingPosition of DEFENSE_POSITIONS) {
      matrixCount += 1;
      const timeline = compilePlayTimeline(
        { ...BASE_EVENT, ...overrides, sequence: matrixCount, fieldingPosition },
        { anchors: ANCHORS }
      );
      const event = { ...BASE_EVENT, ...overrides, sequence: matrixCount, fieldingPosition };
      const label = `${playName}-${fieldingPosition}`;
      verifyTimelineContract({ name: label, timeline });
      verifyThrowChains(label, timeline);
      verifyThrowTargetSemantics(label, event, timeline);
      verifyRoleBasedDefensiveMotion(label, event, timeline);
      verifyMovementCoverage(label, playName, timeline);
      verifyDefenderEndpoints(label, timeline, ANCHORS);
      if (playName === "double-play" && fieldingPosition === "1B") {
        const firstReceiver = timeline.tracks.fielders.find((cue) => cue.phase === "relay-receive-first");
        assert.equal(firstReceiver?.who, "P", "1B double-play ball must end with the pitcher covering first.");
      }
    }
  }
  assert.equal(
    matrixCount,
    GAMECAST2_TIMELINE_TEMPLATES.length * DEFENSE_POSITIONS.length,
    "The verifier did not cover the complete 12x9 play/position matrix."
  );

  for (const anchorPath of FIELD_ANCHOR_PATHS) {
    const payload = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
    const anchors = payload.anchors ?? payload;
    for (const [playName, overrides] of plays) {
      for (const fieldingPosition of DEFENSE_POSITIONS) {
        const label = `${path.basename(anchorPath)}-${playName}-${fieldingPosition}`;
        const event = { ...BASE_EVENT, ...overrides, fieldingPosition };
        const timeline = compilePlayTimeline(event, { anchors });
        verifyFielderCueIntervals(label, timeline);
        verifyThrowChains(label, timeline);
        verifyThrowTargetSemantics(label, event, timeline);
        verifyRoleBasedDefensiveMotion(label, event, timeline);
        verifyDefenderEndpoints(label, timeline, anchors);
      }
    }
  }
}

function matrixPlayCases() {
  return [
    ["strikeout", { outcome: "strikeout", outsAfter: 1 }],
    ["walk", { outcome: "walk", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["hit-by-pitch", { outcome: "HBP", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["single", { outcome: "single", battedBallType: "lineDrive", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["double", { outcome: "double", battedBallType: "lineDrive", basesAfter: [false, true, false], baseRunnerIdsAfter: ["", "batter", ""] }],
    ["triple", { outcome: "triple", battedBallType: "flyBall", basesAfter: [false, false, true], baseRunnerIdsAfter: ["", "", "batter"] }],
    ["home-run", { outcome: "homeRun", battedBallType: "flyBall", runs: 1, scoredRunners: [{ id: "batter" }] }],
    ["infield-out", { outcome: "out", battedBallType: "groundBall", outsAfter: 1 }],
    ["outfield-out", { outcome: "out", battedBallType: "flyBall", outsAfter: 1 }],
    ["double-play", {
      outcome: "out",
      battedBallType: "groundBall",
      doublePlay: true,
      outsAfter: 2,
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""]
    }],
    ["error", { outcome: "error", battedBallType: "groundBall", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["steal", {
      type: "stolenBase",
      outcome: "stolenBase",
      success: true,
      runnerId: "r1",
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""],
      basesAfter: [false, true, false],
      baseRunnerIdsAfter: ["", "r1", ""]
    }]
  ];
}

function verifyThrowChains(name, timeline) {
  const actorThrows = [...timeline.tracks.fielders, ...timeline.tracks.catcher]
    .filter((cue) => cue.anim === "throw" || String(cue.phase ?? "").includes("throw"));
  for (const cue of actorThrows) {
    assert.equal(cue.anim, "throw", `${name}: ${cue.who ?? "C"} throw cue uses '${cue.anim}' instead of throw.`);
    verifyCueFacing(name, cue, timeline.points, "thrower");
  }

  const ballThrows = timeline.tracks.ball.filter((cue) => ["fielding-throw", "relay-throw", "steal-throw"].includes(cue.phase));
  for (const ball of ballThrows) {
    const from = ball.path?.[0];
    const target = ball.path?.at(-1);
    const visualStart = timelineBallPoint(ball, timeline.points, 0);
    const visualEnd = timelineBallPoint(ball, timeline.points, 1);
    if (["fielding-throw", "relay-throw"].includes(ball.phase)) {
      assert(
        Number(timeline.points?.[from]?.y) - Number(visualStart?.y) >= GAMECAST2_THROW_GLOVE_LIFT - 0.01,
        `${name}: ${ball.phase} still launches from the fielder's feet.`
      );
    }
    assert(
      Number(timeline.points?.[target]?.y) - Number(visualEnd?.y) >= GAMECAST2_THROW_GLOVE_LIFT - 0.01,
      `${name}: ${ball.phase} still arrives at the receiver's feet.`
    );
    const thrower = actorThrows.find((cue) => {
      const cueFrom = cue.at === "C" ? "home" : cue.at;
      const end = Number(cue.endT ?? cue.t);
      return cueFrom === from && cue.toward === target && cue.t <= ball.t + 0.000001 && end >= ball.t - 0.000001;
    });
    assert(thrower, `${name}: ${ball.phase} ball departs without a matching throw release cue.`);

    const receiver = timeline.tracks.fielders.find((cue) => {
      const end = Number(cue.endT ?? cue.t);
      return cue.anim === "catch" && cue.at === target && cue.t <= ball.endT + 0.000001 && end >= ball.endT - 0.000001;
    });
    assert(receiver, `${name}: ${target} receiver does not cover the ${ball.phase} arrival.`);
    assert(receiver.toward, `${name}: ${target} receiver has no incoming-throw facing point.`);
    verifyCueFacing(name, receiver, timeline.points, "receiver");
  }
}

function fieldingDecisionThrow(timeline) {
  const throws = timeline.tracks.ball.filter((cue) => ["fielding-throw", "relay-throw"].includes(cue.phase));
  const target = timeline.meta?.fielding?.throwTarget;
  return throws.find((cue) => target && cue.path?.at(-1) === target)
    ?? throws.find((cue) => cue.phase === "fielding-throw")
    ?? null;
}

function verifyTerminalPossessionHold(label, timeline, { at, who, startT }) {
  const hold = timeline.tracks.ball.find((cue) => (
    cue.phase === "fielding-hold"
    && cue.terminal === true
    && cue.at === at
    && cue.possessedBy === who
  ));
  assert(hold, `${label}: terminal possession has no fielding-hold cue.`);
  assert(
    Math.abs(Number(hold.t) - Number(startT)) <= 0.000001,
    `${label}: terminal hold is not continuous with the final action (${hold.t} != ${startT}).`
  );
  assert(
    Number(hold.endT) >= Number(timeline.resultAt) - 0.000001,
    `${label}: terminal hold ends before resultAt (${hold.endT} < ${timeline.resultAt}).`
  );
  assert.equal(
    timeline.meta.invariants?.terminalPossessionVisible,
    true,
    `${label}: terminalPossessionVisible invariant failed.`
  );
  const midpoint = (Number(startT) + Number(timeline.resultAt)) / 2;
  const renderedBall = buildTimelineBallState(timeline, midpoint, {});
  assert.equal(renderedBall?.phase, "fielding-hold", `${label}: midpoint render does not show the held ball.`);
  assert.equal(renderedBall?.trail?.length, 0, `${label}: stationary terminal hold still renders a motion trail.`);
}

function verifyThrowTargetSemantics(name, event, timeline) {
  const fieldingThrow = fieldingDecisionThrow(timeline);
  const fieldingTarget = fieldingThrow?.path?.at(-1) ?? null;
  const cutoffRelay = timeline.meta?.fielding?.relay;
  if (cutoffRelay?.cutoffOnly) {
    assert.equal(timeline.meta.fielding?.throwTarget, null, `${name}: cutoff-only play still advertises a contested base.`);
    assert.equal(fieldingTarget, cutoffRelay.point, `${name}: cutoff-only throw does not finish at the relay point.`);
    assert.equal(fieldingThrow?.ordering, "cutoff-return", `${name}: cutoff-only return has the wrong ordering metadata.`);
    assert(
      !timeline.tracks.ball.some((cue) => cue.phase === "relay-throw" && cue.path?.[0] === cutoffRelay.point),
      `${name}: cutoff-only play still throws on to the already-safe base.`
    );
    verifyTerminalPossessionHold(name, timeline, {
      at: cutoffRelay.point,
      who: cutoffRelay.fielder,
      startT: cutoffRelay.receiveT
    });
    return;
  }
  if (timeline.meta?.fielding?.unassisted === true) {
    // 3U putout: the first baseman carries the ball to the bag himself.
    assert.equal(timeline.meta.fielding?.throwTarget, "first", `${name}: unassisted putout is not recorded at first.`);
    assert.equal(fieldingThrow, null, `${name}: unassisted putout still contains a throw.`);
    const step = timeline.tracks.fielders.find((cue) => cue.phase === "unassisted-first");
    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    assert(step && batterRun, `${name}: unassisted putout lacks step/batter cues.`);
    assert(
      Number(step.endT) <= Number(batterRun.endT),
      `${name}: 1B reaches the bag after the retired batter-runner.`
    );
    return;
  }
  const runnerTarget = leadRunnerDestination(timeline);
  const canonicalTargetRaw = String(event?.defensiveThrowTarget ?? "").trim().toLowerCase();
  const canonicalTarget = ["first", "second", "third", "home"].includes(canonicalTargetRaw)
    ? canonicalTargetRaw
    : null;
  const battedType = String(event?.battedBallType ?? "").toLowerCase();
  const caughtBattedOut = timeline.outcome === "out"
    && timeline.template !== "doublePlay"
    && (battedType.includes("fly") || battedType.includes("line"));

  if (timeline.meta?.fielding?.throwSuppressed === true) {
    verifyTerminalPossessionHold(name, timeline, {
      at: timeline.meta.fielding.fieldingPoint,
      who: timeline.meta.fielding.fielder,
      startT: timeline.meta.fielding.fielderArrivalT
    });
  }

  if (timeline.template === "single") {
    const outfieldSingle = OUTFIELD_POSITIONS.has(String(timeline.meta.fielding?.fielder ?? ""));
    const runnerMoves = timeline.tracks.runners.filter((cue) => cue.phase === "runner-advance");
    const secondBaseIsLive = runnerMoves.some((cue) => cue.toBase === "second" && !cue.out)
      || Boolean(event?.basesAfter?.[1] || event?.baseRunnerIdsAfter?.[1]);
    const suppressedHit = timeline.meta?.fielding?.throwSuppressed === true && fieldingTarget === null;
    const expectedTarget = outfieldSingle && !secondBaseIsLive ? "second" : null;
    assert(
      fieldingTarget === expectedTarget || suppressedHit,
      `${name}: single return throw disagrees with the second-base/hold rule.`
    );
    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    const field = timeline.tracks.fielders.find((cue) => ["field", "pickup", "trap", "short-hop"].includes(cue.phase));
    assert(batterRun && field, `${name}: single has no batter-run/fielding cues.`);
    assert(
      field.endT <= batterRun.endT + 0.001,
      `${name}: the defense still has not controlled a routine single when the batter reaches first.`
    );
  }

  if (caughtBattedOut) {
    assert.equal(
      fieldingTarget,
      canonicalTarget ?? runnerTarget,
      `${name}: caught fly/line may throw only behind an actually advancing runner.`
    );
    assert(
      !timeline.tracks.batter.some((cue) => cue.phase === "batter-run"),
      `${name}: batter runs to first after already being retired on a catch.`
    );
    assert.equal(timeline.meta.fielding?.outRecordedAt, "landing", `${name}: caught-ball out is not recorded at the catch point.`);
  } else if (timeline.outcome === "out") {
    if (timeline.template === "doublePlay") {
      assert.equal(fieldingTarget, "second", `${name}: valid double play must take the lead force at second first.`);
    } else {
      assert.equal(fieldingTarget, canonicalTarget ?? "first", `${name}: ordinary ground-ball out uses the wrong defensive target.`);
    }

    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    const firstBaseOutThrow = timeline.tracks.ball.find((cue) => (
      ["fielding-throw", "relay-throw"].includes(cue.phase)
      && cue.path?.at(-1) === "first"
    ));
    if (fieldingTarget === "first") {
      assert(
        batterRun && firstBaseOutThrow && firstBaseOutThrow.endT <= batterRun.endT,
        `${name}: first-base force arrives after the retired batter-runner.`
      );
      verifyFirstBaseReceiverSet(name, timeline, firstBaseOutThrow);
    }
  }

  if (fieldingTarget === "second") {
    assert(
      timeline.template === "double"
        || timeline.template === "triple"
        || timeline.template === "doublePlay"
        || runnerTarget === "second"
        || canonicalTarget === "second"
        || (
          timeline.template === "single"
          && OUTFIELD_POSITIONS.has(String(timeline.meta.fielding?.fielder ?? ""))
          && !timeline.tracks.runners.some((cue) => cue.phase === "runner-advance" && cue.toBase === "second" && !cue.out)
        ),
      `${name}: unjustified throw to second without a double play or an actual runner destination.`
    );
  }
  if (fieldingTarget === "third") {
    assert(
      ["double", "triple"].includes(timeline.template) || runnerTarget === "third" || canonicalTarget === "third",
      `${name}: unjustified throw to third without an extra-base containment play or an actual runner destination.`
    );
  }

  const stealThrow = timeline.tracks.ball.find((cue) => cue.phase === "steal-throw");
  if (timeline.template === "steal") {
    if (runnerTarget === "home") {
      assert.equal(stealThrow, undefined, `${name}: steal of home creates a zero-length home-to-home throw.`);
      assert(
        timeline.tracks.catcher.some((cue) => String(cue.phase ?? "").endsWith("tag-home")),
        `${name}: steal of home has no catcher plate-tag cue.`
      );
    } else {
      assert.equal(
        stealThrow?.path?.at(-1),
        runnerTarget,
        `${name}: steal throw does not follow the runner's actual destination.`
      );
    }
  }
}

function verifyFirstBaseReceiverSet(name, timeline, throwBall) {
  const receive = timeline.tracks.fielders.find((cue) => {
    const end = Number(cue.endT ?? cue.t);
    return cue.anim === "catch"
      && cue.at === "first"
      && cue.t <= throwBall.endT + 0.000001
      && end >= throwBall.endT - 0.000001;
  });
  assert(receive, `${name}: first-base throw has no receiver planted at first.`);

  const cover = timeline.tracks.fielders.find((cue) => (
    cue.who === receive.who
    && cue.assignment === "receiver"
    && cue.path?.at(-1) === "first"
    && Number(cue.endT ?? cue.t) <= receive.t + 0.000001
  ));
  assert(cover, `${name}: first-base receiver never runs all the way to first.`);
  assert.equal(cover.arrivesAt, "first", `${name}: first-base cover lacks an explicit baseline arrival contract.`);

  const coverPoint = timeline.points?.[cover.path.at(-1)];
  const receivePoint = timeline.points?.[receive.at];
  const first = timeline.points?.first;
  assert.deepEqual(coverPoint, first, `${name}: receiver feet do not finish on the first-base anchor.`);
  assert.deepEqual(receivePoint, first, `${name}: catch pose is not rooted on the first-base anchor.`);

  const arrivalLeadT = Number(throwBall.endT) - Number(cover.endT ?? cover.t);
  const settleT = Number(receive.t) - Number(cover.endT ?? cover.t);
  const arrivalLeadMs = arrivalLeadT * Number(timeline.durationMs);
  const settleMs = settleT * Number(timeline.durationMs);
  assert(arrivalLeadMs >= 395, `${name}: first-base receiver arrives only ${arrivalLeadMs.toFixed(0)}ms before the ball.`);
  assert(settleMs >= 195, `${name}: first-base receiver has no visible foot-plant interval before the catch.`);
}

function leadRunnerDestination(timeline) {
  const rank = { first: 1, second: 2, third: 3, home: 4 };
  return timeline.tracks.runners
    .filter((cue) => cue.phase === "runner-advance")
    .map((cue) => cue.path?.at(-1))
    .filter(Boolean)
    .sort((a, b) => Number(rank[b] ?? 0) - Number(rank[a] ?? 0))[0]
    ?? null;
}

function verifyArmDrivenThrows() {
  const groundOut = (arm) => compilePlayTimeline({
    ...BASE_EVENT,
    id: `arm-ground-out-${arm}`,
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    defenderProfile: { id: "ss", arm },
    outsAfter: 1
  }, { anchors: ANCHORS });
  const weak = groundOut(60);
  const strong = groundOut(180);
  const weakThrow = weak.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const strongThrow = strong.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  assert(weakThrow && strongThrow, "Arm regression setup has no fielding throw.");
  assert.equal(weakThrow.armScore, 60, "Weak arm score was not preserved on the throw cue.");
  assert.equal(strongThrow.armScore, 180, "Strong arm score was not preserved on the throw cue.");
  assert(Number(strongThrow.arc) < Number(weakThrow.arc), "Strong arm throw is not flatter than weak arm throw.");
  assert(Number(strongThrow.flightMs) < Number(weakThrow.flightMs), "Strong arm throw is not faster than weak arm throw.");
  assert(Number(weakThrow.arc) <= 0.055 && Number(strongThrow.arc) >= 0.015, "Arm throw arc escaped the flat 0.015-0.055 range.");
  for (const timeline of [weak, strong]) {
    const throwBall = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
    const retired = timeline.tracks.batter.find((cue) => cue.phase === "batter-run" && cue.out);
    assert(
      Number(throwBall.endT) <= Number(retired.endT) - 0.014999,
      "Recorded first-base out does not show the ball arriving .015T before the runner."
    );
  }

  const safeTriple = compilePlayTimeline({
    ...BASE_EVENT,
    id: "arm-safe-triple",
    outcome: "triple",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    defenderProfile: { id: "cf", arm: 180 },
    defensiveThrowTarget: "third",
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "batter"]
  }, { anchors: ANCHORS });
  const tripleThrow = fieldingDecisionThrow(safeTriple);
  const tripleArrival = Math.max(...safeTriple.tracks.batter
    .filter((cue) => cue.path?.at(-1) === "third" || cue.at === "third")
    .map((cue) => Number(cue.endT ?? cue.t)));
  assert(Number(tripleThrow.flightMs) <= 620, "Safe triple throw is slowed down to preserve the result.");
  assert(Number(safeTriple.resultAt) >= tripleArrival, "Safe triple result appears before the runner reaches third.");

  const doublePlay = compilePlayTimeline({
    ...BASE_EVENT,
    id: "arm-double-play",
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    defenderProfile: { id: "ss", arm: 180 },
    defenseProfilesByPosition: { SS: { id: "ss", arm: 180 }, "2B": { id: "2b", arm: 60 } },
    doublePlay: true,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""]
  }, { anchors: ANCHORS });
  const firstLeg = doublePlay.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const relay = doublePlay.tracks.ball.find((cue) => cue.phase === "relay-throw");
  assert.equal(firstLeg?.armScore, 180, "Double-play first leg ignored the primary fielder arm.");
  assert.equal(relay?.armScore, 60, "Double-play relay ignored the pivot fielder arm.");
  assert(Number(firstLeg.arc) < Number(relay.arc), "Double-play relay arc does not vary by each thrower's arm.");
}

function verifyThrowTargetRegressionCases() {
  const compile = (overrides) => {
    const event = { ...BASE_EVENT, ...overrides };
    const timeline = compilePlayTimeline(event, { anchors: ANCHORS });
    return { event, timeline };
  };

  const groundOutByRightFielder = compile({
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "RF",
    outsAfter: 1
  });
  assert.equal(
    groundOutByRightFielder.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "first",
    "Regression: RF ground-ball out was thrown to second instead of first."
  );

  const caughtFly = compile({
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    outsAfter: 1
  });
  assert.equal(
    caughtFly.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: routine caught fly created an unnecessary competitive throw."
  );
  assert(!caughtFly.timeline.tracks.batter.some((cue) => cue.phase === "batter-run"), "Regression: caught-fly batter still ran to first.");
  const caughtFielding = caughtFly.timeline.meta.fielding;
  const caughtHold = caughtFly.timeline.tracks.ball.find((cue) => cue.phase === "catch-hold" && cue.terminal === true);
  assert(caughtHold, "Regression: caught fly disappears from the glove before the result.");
  assert.equal(caughtHold.at, caughtFielding?.catchPoint, "Regression: caught-fly hold is not anchored to the authored glove point.");
  assert.equal(caughtHold.possessedBy, caughtFielding?.fielder, "Regression: caught-fly hold is not possessed by the catching fielder.");
  assert(Number(caughtHold.t) <= Number(caughtFielding?.fielderArrivalT) + 0.000001, "Regression: caught-fly hold starts after the catch.");
  assert(Number(caughtHold.endT) >= Number(caughtFly.timeline.resultAt) - 0.000001, "Regression: caught-fly hold ends before resultAt.");
  const caughtHoldFrame = buildTimelineBallState(
    caughtFly.timeline,
    (Number(caughtHold.t) + Number(caughtFly.timeline.resultAt)) / 2,
    caughtFly.event
  );
  const caughtGlovePoint = caughtFly.timeline.points[caughtFielding?.catchPoint];
  assert.equal(caughtHoldFrame?.phase, "catch-hold", "Regression: caught-fly midpoint does not render the held ball.");
  assert.equal(caughtHoldFrame?.trail?.length, 0, "Regression: stationary caught ball still renders a motion trail.");
  assert(Math.abs(Number(caughtHoldFrame?.x) - Number(caughtGlovePoint?.x)) <= 0.001, "Regression: caught ball drifts horizontally away from the glove.");
  assert(Math.abs(Number(caughtHoldFrame?.y) - Number(caughtGlovePoint?.y)) <= 0.001, "Regression: catch-hold receives a second glove lift.");
  assert.equal(Number(caughtHoldFrame?.height), 0, "Regression: catch-hold is lifted above its already-raised glove anchor.");
  assert.equal(caughtFly.timeline.meta.invariants?.terminalPossessionVisible, true, "Regression: caught-fly possession invariant failed.");

  const emptyBasesSingle = compile({
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "RF",
    attemptedFieldingPosition: "SS",
    fieldingZone: "third-hole",
    fieldingLane: -0.36,
    sprayLane: -0.36,
    hitTrajectory: "ground-through",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  });
  // A bases-empty single is walked back in toward second (directly or through
  // the cutoff man) — the outfielder never just stands holding the ball.
  const emptySingleRelay = emptyBasesSingle.timeline.meta.fielding?.relay;
  const emptySingleReturn = fieldingDecisionThrow(emptyBasesSingle.timeline);
  assert(emptySingleReturn, "Regression: empty-bases single has no return throw at all.");
  assert(
    emptySingleRelay?.cutoffOnly
      ? emptySingleReturn.path?.at(-1) === emptySingleRelay.point
      : emptySingleReturn.path?.at(-1) === "second",
    "Regression: empty-bases single return neither reaches second nor stops at the cutoff."
  );
  verifyThrowTargetSemantics("regression-empty-bases-single", emptyBasesSingle.event, emptyBasesSingle.timeline);

  const infieldChopper = compile({
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    fieldingZone: "third-hole",
    fieldingLane: -0.36,
    hitTrajectory: "infield-chopper",
    defensiveThrowTarget: "third",
    basesBefore: [false, true, false],
    baseRunnerIdsBefore: ["", "r2", ""],
    basesAfter: [true, false, true],
    baseRunnerIdsAfter: ["batter", "", "r2"]
  });
  const chopperThrow = infieldChopper.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  assert.equal(chopperThrow, undefined, "Infield hit chases a non-force runner at third.");
  assert.equal(infieldChopper.timeline.meta.fielding?.throwTarget, null, "Stale infield-hit target was not sanitized.");
  const pickupWait = infieldChopper.timeline.tracks.ball.find((cue) => cue.phase === "pickup-wait");
  if (Number(infieldChopper.timeline.meta.fielding?.ballPickupArrivalT) < Number(infieldChopper.timeline.meta.fielding?.fielderRouteArrivalT)) {
    assert(pickupWait, "Infield-hit ball disappears before the fielder reaches the pickup point.");
  }

  const firstToThirdSingle = compile({
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [true, false, true],
    baseRunnerIdsAfter: ["batter", "", "r1"]
  });
  const firstToThirdRelay = firstToThirdSingle.timeline.meta.fielding?.relay;
  const cutoffReturn = fieldingDecisionThrow(firstToThirdSingle.timeline);
  assert(firstToThirdRelay?.cutoffOnly, "Regression: first-to-third single still sends the ball to second ahead of the safe runner.");
  assert.equal(cutoffReturn?.path?.at(-1), firstToThirdRelay.point, "Regression: first-to-third return misses the cutoff man.");
  assert.equal(firstToThirdSingle.timeline.meta.fielding?.throwTarget, null, "Regression: first-to-third cutoff-only return still advertises second base.");
  assert(
    !firstToThirdSingle.timeline.tracks.ball.some((cue) => cue.path?.at(-1) === "second"),
    "Regression: first-to-third single still lets the ball arrive at second before the runner passes through."
  );
  assert(Number(cutoffReturn?.flightMs) <= 620, "Regression: cutoff return is slowed to preserve a safe runner result.");
  assert.equal(cutoffReturn?.ordering, "cutoff-return", "Regression: first-to-third return is not labeled as cutoff-only.");
  verifyTerminalPossessionHold("regression-first-to-third-single", firstToThirdSingle.timeline, {
    at: firstToThirdRelay.point,
    who: firstToThirdRelay.fielder,
    startT: firstToThirdRelay.receiveT
  });

  const suppressedDirectDouble = compile({
    id: "suppressed-direct-double",
    outcome: "double",
    battedBallType: "flyBall",
    hitTrajectory: "fly-bloop",
    fieldingPosition: "LF",
    sprayLane: -0.2,
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  });
  const suppressedFielding = suppressedDirectDouble.timeline.meta.fielding;
  assert.equal(suppressedFielding?.throwSuppressed, true, "Regression: noncompetitive direct double return was not suppressed.");
  assert.equal(suppressedFielding?.throwSuppressionReason, "physical-first", "Regression: direct suppression lacks the physical-first reason.");
  assert.equal(fieldingDecisionThrow(suppressedDirectDouble.timeline), null, "Regression: suppressed direct double still contains a throw.");
  assert(
    pointDistance(
      suppressedDirectDouble.timeline.points[suppressedFielding?.fieldingPoint],
      suppressedDirectDouble.timeline.points.second
    ) > 44,
    "Regression fixture accidentally exercises near-target suppression instead of physical-first suppression."
  );
  verifyTerminalPossessionHold("regression-suppressed-direct-double", suppressedDirectDouble.timeline, {
    at: suppressedFielding.fieldingPoint,
    who: suppressedFielding.fielder,
    startT: suppressedFielding.fielderArrivalT
  });
  verifyThrowTargetSemantics(
    "regression-suppressed-direct-double",
    suppressedDirectDouble.event,
    suppressedDirectDouble.timeline
  );

  const forcedFirstToSecondSingle = compile({
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "2B",
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [true, true, false],
    baseRunnerIdsAfter: ["batter", "r1", ""]
  });
  assert.equal(
    forcedFirstToSecondSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: an infield single invents a force/late throw after the hit is already safe."
  );
  verifyThrowTargetSemantics(
    "regression-forced-first-to-second-single",
    forcedFirstToSecondSingle.event,
    forcedFirstToSecondSingle.timeline
  );

  const canonicalEmptyDouble = compile({
    outcome: "double",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    defensiveThrowTarget: "second",
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  });
  // The return goes in behind the batter at second; because he is recorded
  // safe, the ball must die at the cutoff man, never fly to an empty far base.
  const emptyDoubleRelay = canonicalEmptyDouble.timeline.meta.fielding?.relay;
  const emptyDoubleReturn = fieldingDecisionThrow(canonicalEmptyDouble.timeline);
  assert(emptyDoubleReturn, "Regression: empty-bases double has no return throw.");
  assert(
    !["third", "home"].includes(emptyDoubleReturn.path?.at(-1)),
    "Regression: empty-bases double still fires at an empty far base."
  );
  assert(
    emptyDoubleRelay?.cutoffOnly
      ? emptyDoubleReturn.path?.at(-1) === emptyDoubleRelay.point
      : emptyDoubleReturn.path?.at(-1) === "second",
    "Regression: empty-bases double return neither stops at the cutoff nor arrives behind the runner at second."
  );
  verifyThrowTargetSemantics("regression-canonical-empty-double", canonicalEmptyDouble.event, canonicalEmptyDouble.timeline);

  const canonicalEmptyTriple = compile({
    outcome: "triple",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    defensiveThrowTarget: "third",
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "batter"]
  });
  // A triple's return heads for third behind the runner and dies at the cutoff
  // (the batter is recorded safe); it must never target home with nobody going.
  const emptyTripleRelay = canonicalEmptyTriple.timeline.meta.fielding?.relay;
  const emptyTripleReturn = fieldingDecisionThrow(canonicalEmptyTriple.timeline);
  assert(emptyTripleReturn, "Regression: empty-bases triple has no return throw.");
  assert(
    emptyTripleReturn.path?.at(-1) !== "home",
    "Regression: empty-bases triple still fires home with nobody scoring."
  );
  assert(
    emptyTripleRelay?.cutoffOnly
      ? emptyTripleReturn.path?.at(-1) === emptyTripleRelay.point
      : emptyTripleReturn.path?.at(-1) === "third",
    "Regression: empty-bases triple return neither stops at the cutoff nor arrives behind the runner at third."
  );
  verifyThrowTargetSemantics("regression-canonical-empty-triple", canonicalEmptyTriple.event, canonicalEmptyTriple.timeline);

  const canonicalScoringThrow = compile({
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    defensiveThrowTarget: "home",
    runs: 1,
    basesBefore: [false, true, false],
    baseRunnerIdsBefore: ["", "r2", ""],
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""],
    scoredRunners: [{ id: "r2" }]
  });
  assert.equal(
    fieldingDecisionThrow(canonicalScoringThrow.timeline)?.path?.at(-1),
    "second",
    "Regression: a runner already scoring makes the outfielder float an impossible throw home."
  );
  assert.equal(
    fieldingDecisionThrow(canonicalScoringThrow.timeline)?.ordering,
    "neutral",
    "Regression: scoring-runner cutoff return is treated as a late plate contest."
  );
  verifyThrowTargetSemantics("regression-canonical-scoring-throw", canonicalScoringThrow.event, canonicalScoringThrow.timeline);

  const canonicalTagUpThrow = compile({
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "RF",
    defensiveThrowTarget: "home",
    runs: 1,
    outsBefore: 0,
    outsAfter: 1,
    basesBefore: [false, false, true],
    baseRunnerIdsBefore: ["", "", "r3"],
    basesAfter: [false, false, false],
    baseRunnerIdsAfter: ["", "", ""],
    scoredRunners: [{ id: "r3" }]
  });
  const tagUpThrow = fieldingDecisionThrow(canonicalTagUpThrow.timeline);
  const tagUpCatch = canonicalTagUpThrow.timeline.tracks.ball.find((cue) => cue.phase === "batted");
  const tagUpRunner = canonicalTagUpThrow.timeline.tracks.runners.find((cue) => (
    cue.phase === "runner-advance" && cue.runnerId === "r3"
  ));
  const tagUpRelay = canonicalTagUpThrow.timeline.meta.fielding?.relay;
  assert(tagUpCatch && tagUpRunner, "Regression: tag-up play has no caught-ball/runner cues.");
  assert(
    Number(tagUpRunner.t) >= Number(tagUpCatch.endT),
    `Regression: tag-up runner leaves before the catch (${tagUpRunner.t} < ${tagUpCatch.endT}).`
  );
  const tagUpRunMsPerBase = (
    (Number(tagUpRunner.endT) - Number(tagUpRunner.t)) * canonicalTagUpThrow.timeline.durationMs
  ) / Number(tagUpRunner.basesAdvanced ?? 1);
  assert(
    Math.abs(tagUpRunMsPerBase - 2600) <= 12,
    `Regression: tag-up runner pace is ${tagUpRunMsPerBase.toFixed(0)}ms/base instead of 2600ms/base.`
  );
  const tagUpHelperStartMs = getGamecast2RunnerStartMs(canonicalTagUpThrow.event);
  const tagUpTimelineStartMs = Number(tagUpRunner.t) * canonicalTagUpThrow.timeline.durationMs;
  assert(
    Math.abs(Number(tagUpHelperStartMs) - tagUpTimelineStartMs) <= 0.01,
    `Regression: tag-up helper (${tagUpHelperStartMs}ms) disagrees with timeline (${tagUpTimelineStartMs}ms).`
  );
  assert(tagUpRelay?.cutoffOnly, "Regression: noncompetitive tag-up throw was not stopped at the cutoff.");
  assert.equal(tagUpThrow?.path?.at(-1), tagUpRelay.point, "Regression: tag-up cutoff return misses the relay point.");
  assert.equal(tagUpThrow?.ordering, "cutoff-return", "Regression: tag-up cutoff return is labeled as a plate contest.");
  assert(
    !canonicalTagUpThrow.timeline.tracks.ball.some((cue) => cue.phase === "relay-throw"),
    "Regression: noncompetitive tag-up play still sends the relay home."
  );
  assert(
    Array.from({ length: 101 }, (_, index) => index / 100)
      .every((progress) => buildGamecastThrowLines(canonicalTagUpThrow.event, progress).length === 0),
    "Regression: legacy Gamecast still holds and throws home on the noncompetitive tag-up."
  );
  assert.equal(
    gamecastSideInfoSummary(canonicalTagUpThrow.event).showThrow,
    false,
    "Regression: side info still advertises a futile home throw."
  );
  assert(Number(tagUpThrow.endT) <= 0.985, `Regression: tag-up throw exceeds the timeline throw boundary (${tagUpThrow.endT}).`);
  const tagUpFlightMs = (Number(tagUpThrow.endT) - Number(tagUpThrow.t)) * canonicalTagUpThrow.timeline.durationMs;
  assert(tagUpFlightMs <= 620.5, `Regression: tag-up throw is stretched to ${tagUpFlightMs.toFixed(1)}ms.`);
  assert(Number(canonicalTagUpThrow.timeline.resultAt) >= Number(tagUpThrow.endT), "Regression: tag-up result appears before the throw home arrives.");
  assert(
    Number(canonicalTagUpThrow.timeline.resultAt) >= Number(tagUpRunner.endT),
    "Regression: tag-up result appears before the runner reaches home."
  );
  verifyThrowChains("regression-canonical-tag-up-throw", canonicalTagUpThrow.timeline);
  verifyThrowTargetSemantics("regression-canonical-tag-up-throw", canonicalTagUpThrow.event, canonicalTagUpThrow.timeline);

  const canonicalErrorThrow = compile({
    outcome: "error",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    defensiveThrowTarget: "first",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  });
  const errorField = canonicalErrorThrow.timeline.tracks.fielders.find((cue) => cue.phase === "misplay");
  const errorThrow = canonicalErrorThrow.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  assert(errorField, "Regression: error event has no visible misplay sequence.");
  assert.equal(errorThrow, undefined, "Regression: error play throws to first after the batter is already recorded safe.");
  assert.equal(canonicalErrorThrow.timeline.meta.fielding?.throwTarget, null, "Regression: futile error throw remains advertised as a first-base contest.");
  const errorFielding = canonicalErrorThrow.timeline.meta.fielding;
  const looseBall = canonicalErrorThrow.timeline.tracks.ball.find((cue) => cue.phase === "error-loose" && cue.terminal === true);
  assert(looseBall, "Regression: error ball disappears before the result.");
  assert.equal(looseBall.at, errorFielding?.ballPoint, "Regression: loose error ball is not left at the authored ball point.");
  assert.equal(Object.prototype.hasOwnProperty.call(looseBall, "possessedBy"), false, "Regression: misplaying fielder is incorrectly given possession of the error ball.");
  assert(Number(looseBall.t) <= Number(errorFielding?.ballArrivalT) + 0.000001, "Regression: loose-ball hold starts after the error arrives.");
  assert(Number(looseBall.endT) >= Number(canonicalErrorThrow.timeline.resultAt) - 0.000001, "Regression: loose error ball disappears before resultAt.");
  const looseBallFrame = buildTimelineBallState(
    canonicalErrorThrow.timeline,
    (Number(looseBall.t) + Number(canonicalErrorThrow.timeline.resultAt)) / 2,
    canonicalErrorThrow.event
  );
  const looseBallPoint = canonicalErrorThrow.timeline.points[errorFielding?.ballPoint];
  assert.equal(looseBallFrame?.phase, "error-loose", "Regression: error midpoint does not render the loose ball.");
  assert.equal(looseBallFrame?.trail?.length, 0, "Regression: stationary loose error ball still renders a motion trail.");
  assert(Math.abs(Number(looseBallFrame?.x) - Number(looseBallPoint?.x)) <= 0.001, "Regression: loose error ball drifts horizontally.");
  assert(Math.abs(Number(looseBallFrame?.y) - Number(looseBallPoint?.y)) <= 0.001, "Regression: loose error ball leaves the ground anchor.");
  assert.equal(Number(looseBallFrame?.height), 0, "Regression: loose error ball is lifted off the turf.");
  assert.equal(canonicalErrorThrow.timeline.meta.invariants?.terminalBallVisible, true, "Regression: error terminal-ball invariant failed.");
  assert.equal(canonicalErrorThrow.timeline.meta.invariants?.errorBallRemainsLoose, true, "Regression: error loose-ball invariant failed.");

  const legacyDoubleTarget = compile({
    outcome: "double",
    battedBallType: "lineDrive",
    fieldingPosition: "LF",
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  });
  // Even without a recorded target, a legacy double returns toward second and
  // dies at the cutoff because the batter is already recorded safe there.
  const legacyDoubleRelay = legacyDoubleTarget.timeline.meta.fielding?.relay;
  const legacyDoubleReturn = fieldingDecisionThrow(legacyDoubleTarget.timeline);
  assert(legacyDoubleReturn, "Regression: legacy double inference has no return throw.");
  assert(
    !["third", "home"].includes(legacyDoubleReturn.path?.at(-1)),
    "Regression: legacy double inference still fires at an empty far base."
  );
  assert(
    legacyDoubleRelay?.cutoffOnly
      ? legacyDoubleReturn.path?.at(-1) === legacyDoubleRelay.point
      : legacyDoubleReturn.path?.at(-1) === "second",
    "Regression: legacy double return neither stops at the cutoff nor arrives behind the runner at second."
  );

  for (const [label, overrides] of [
    ["no-runner", { basesBefore: [false, false, false], baseRunnerIdsBefore: ["", "", ""] }],
    ["one-out-delta", { basesBefore: [true, false, false], baseRunnerIdsBefore: ["r1", "", ""] }]
  ]) {
    const invalidDoublePlay = compile({
      outcome: "out",
      battedBallType: "groundBall",
      fieldingPosition: "SS",
      doublePlay: true,
      outsBefore: 0,
      outsAfter: 1,
      ...overrides
    });
    assert.notEqual(invalidDoublePlay.timeline.template, "doublePlay", `Regression: invalid DP (${label}) was not downgraded.`);
    assert.equal(
      invalidDoublePlay.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
      "first",
      `Regression: invalid DP (${label}) did not become a first-base out.`
    );
  }

  const airBallDoublePlayFlag = compile({
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    doublePlay: true,
    outsBefore: 0,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""]
  });
  assert.equal(airBallDoublePlayFlag.timeline.template, "outfieldOut", "Regression: fly-ball DP flag was not downgraded to a caught out.");
  assert.equal(
    airBallDoublePlayFlag.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: invalid fly-ball DP still created a second-base throw."
  );

  const validDoublePlay = compile({
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    doublePlay: true,
    outsBefore: 0,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""]
  });
  assert.deepEqual(
    validDoublePlay.timeline.tracks.ball
      .filter((cue) => ["fielding-throw", "relay-throw"].includes(cue.phase))
      .map((cue) => cue.path?.at(-1)),
    ["second", "first"],
    "Regression: valid double play no longer goes second-to-first."
  );
  const doublePlayFinalThrow = validDoublePlay.timeline.tracks.ball.find((cue) => cue.phase === "relay-throw" && cue.path?.at(-1) === "first");
  const doublePlayFirstReceiver = validDoublePlay.timeline.tracks.fielders.find((cue) => (
    cue.who === "1B"
    && cue.at === "first"
    && cue.anim === "catch"
    && Number(cue.t) <= Number(doublePlayFinalThrow?.endT) + 0.000001
    && Number(cue.endT ?? cue.t) >= Number(doublePlayFinalThrow?.endT) - 0.000001
  ));
  assert(doublePlayFinalThrow && doublePlayFirstReceiver, "Regression: SS double play has no final first-base receiver.");
  verifyTerminalPossessionHold("regression-SS-double-play", validDoublePlay.timeline, {
    at: "first",
    who: "1B",
    startT: doublePlayFinalThrow.endT
  });

  for (const [label, overrides] of [
    ["success", { outcome: "stolenBase", success: true, basesAfter: [false, false, true], baseRunnerIdsAfter: ["", "", "r2"] }],
    ["caught", { outcome: "caughtStealing", success: false, caught: true, out: true, outsAfter: 1, basesAfter: [false, false, false], baseRunnerIdsAfter: ["", "", ""] }]
  ]) {
    const stealThird = compile({
      type: "stolenBase",
      runnerId: "r2",
      basesBefore: [false, true, false],
      baseRunnerIdsBefore: ["", "r2", ""],
      ...overrides
    });
    assert.equal(
      stealThird.timeline.tracks.ball.find((cue) => cue.phase === "steal-throw")?.path?.at(-1),
      "third",
      `Regression: steal of third (${label}) was thrown to second.`
    );
    const runnerArrivalT = Math.max(
      ...stealThird.timeline.tracks.runners.map((cue) => Number(cue.endT ?? cue.t))
    );
    const throwArrivalT = Number(
      stealThird.timeline.tracks.ball.find((cue) => cue.phase === "steal-throw")?.endT
    );
    const tagEndT = Number(
      stealThird.timeline.tracks.fielders.find((cue) => ["tag", "late-tag"].includes(cue.phase))?.endT
    );
    if (label === "success") {
      assert(
        runnerArrivalT < throwArrivalT && runnerArrivalT < tagEndT,
        `Regression: successful steal runner did not beat throw/tag (${runnerArrivalT}/${throwArrivalT}/${tagEndT}).`
      );
    } else {
      assert(
        throwArrivalT < runnerArrivalT && tagEndT < runnerArrivalT,
        `Regression: caught stealing runner beat ball/tag (${runnerArrivalT}/${throwArrivalT}/${tagEndT}).`
      );
    }
    verifyThrowChains(`regression-steal-third-${label}`, stealThird.timeline);
    verifyThrowTargetSemantics(`regression-steal-third-${label}`, stealThird.event, stealThird.timeline);
  }

  for (const [label, overrides] of [
    ["success", { outcome: "stolenBase", success: true, runs: 1, scoredRunners: [{ id: "r3" }] }],
    ["caught", { outcome: "caughtStealing", success: false, caught: true, out: true, outsAfter: 1 }]
  ]) {
    const stealHome = compile({
      type: "stolenBase",
      runnerId: "r3",
      basesBefore: [false, false, true],
      baseRunnerIdsBefore: ["", "", "r3"],
      basesAfter: [false, false, false],
      baseRunnerIdsAfter: ["", "", ""],
      ...overrides
    });
    assert.equal(
      stealHome.timeline.tracks.ball.find((cue) => cue.phase === "steal-throw"),
      undefined,
      `Regression: steal of home (${label}) created a home-to-home throw.`
    );
    const homeStealPitch = stealHome.timeline.tracks.ball.find((cue) => cue.phase === "pitch" && cue.path?.at(-1) === "home");
    assert(homeStealPitch, `Regression: steal of home (${label}) has no pitch reaching the catcher.`);
    verifyTerminalPossessionHold(`regression-steal-home-${label}`, stealHome.timeline, {
      at: "C",
      who: "C",
      startT: homeStealPitch.endT
    });
    verifyThrowTargetSemantics(`regression-steal-home-${label}`, stealHome.event, stealHome.timeline);
  }
}

function verifyCueFacing(name, cue, points, role) {
  if (!cue.at || !cue.toward || !points?.[cue.at] || !points?.[cue.toward]) return;
  const deltaX = Number(points[cue.toward].x) - Number(points[cue.at].x);
  const expected = Math.abs(deltaX) < 0.01 ? 1 : deltaX > 0 ? 1 : -1;
  const actual = gamecast2TimelineCueFacing(cue, points, 0.5, "fielder");
  assert.equal(actual, expected, `${name}: ${role} faces away from '${cue.toward}'.`);
}

function verifyMovementCoverage(name, playName, timeline) {
  const movers = new Set(timeline.tracks.fielders.filter((cue) => (cue.path?.length ?? 0) > 1).map((cue) => cue.who));
  if (["single", "double", "triple", "infield-out", "outfield-out", "double-play", "error"].includes(playName)) {
    assert(movers.size >= 2, `${name}: the primary fielder has no receiver or purposeful backup movement.`);
    assert(movers.size <= 6, `${name}: ${movers.size} defenders are still scripted into the same play.`);
  }
  if (playName === "home-run") {
    const chaser = timeline.tracks.fielders.find((cue) => cue.phase === "warning-track");
    assert(chaser && OUTFIELD_POSITIONS.has(chaser.who), `${name}: a non-outfielder chases the home-run ball to the wall.`);
  }
}

function verifyDefenderEndpoints(name, timeline, anchors) {
  for (const cue of timeline.tracks.fielders) {
    assert(DEFENSE_POSITIONS.includes(cue.who), `${name}: unknown defender '${cue.who}'.`);
    const destinationName = cue.at ?? cue.path?.at(-1);
    const destination = timeline.points?.[destinationName];
    const origin = anchors?.[cue.who];
    const zone = GAMECAST2_DEFENDER_MOVE_ZONES[cue.who];
    if (!destination || !origin || !zone) continue;
    const clamped = clampGamecast2DefenderDesignPoint(destination, anchors, cue.who);
    const dx = Number(clamped.x) - Number(destination.x);
    const dy = Number(clamped.y) - Number(destination.y);
    assert(
      Math.abs(dx) <= 0.000001 && Math.abs(dy) <= 0.000001,
      `${name}: ${cue.who} ${cue.phase} endpoint is changed by the production scene clamp (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}).`
    );
  }
}

function verifyPurity(event) {
  const frozenEvent = deepFreeze(structuredClone(event));
  const first = compilePlayTimeline(frozenEvent, { anchors: ANCHORS });
  const second = compilePlayTimeline(frozenEvent, { anchors: ANCHORS });
  assert.deepEqual(first, second, "동일 입력의 타임라인 결과가 결정적이지 않습니다.");
  assert.notEqual(first.points.home, ANCHORS.home, "출력 points가 입력 anchor 객체를 공유합니다.");
}

function timelineCases() {
  return [
    named("strikeout", { outcome: "strikeout", outsAfter: 1 }),
    named("walk-loaded", loadedBases({
      outcome: "walk",
      basesAfter: [true, true, true],
      baseRunnerIdsAfter: ["batter", "r1", "r2"],
      scoredRunners: [{ id: "r3" }],
      runs: 1
    })),
    named("hit-by-pitch", { outcome: "HBP", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }),
    named("single-loaded", loadedBases({
      outcome: "single",
      battedBallType: "lineDrive",
      fieldingPosition: "RF",
      basesAfter: [true, false, true],
      baseRunnerIdsAfter: ["batter", "", "r1"],
      scoredRunners: [{ id: "r2" }, { id: "r3" }],
      runs: 2
    })),
    named("double", { outcome: "double", battedBallType: "lineDrive", fieldingPosition: "LF", basesAfter: [false, true, false], baseRunnerIdsAfter: ["", "batter", ""] }),
    named("triple", { outcome: "triple", battedBallType: "flyBall", fieldingPosition: "CF", basesAfter: [false, false, true], baseRunnerIdsAfter: ["", "", "batter"] }),
    named("home-run", { outcome: "homeRun", battedBallType: "flyBall", runs: 1, scoredRunners: [{ id: "batter" }] }),
    named("infield-out", { outcome: "out", battedBallType: "groundBall", fieldingPosition: "SS", outsAfter: 1 }),
    named("outfield-out", { outcome: "out", battedBallType: "flyBall", fieldingPosition: "CF", outsAfter: 1 }),
    named("double-play", {
      outcome: "out",
      battedBallType: "groundBall",
      fieldingPosition: "SS",
      doublePlay: true,
      outsAfter: 2,
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""]
    }),
    named("error", { outcome: "error", battedBallType: "groundBall", fieldingPosition: "3B", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }),
    named("steal-success", {
      type: "stolenBase",
      outcome: "stolenBase",
      success: true,
      runnerId: "r1",
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""],
      basesAfter: [false, true, false],
      baseRunnerIdsAfter: ["", "r1", ""]
    })
  ];
}

function named(name, overrides) {
  return {
    name,
    event: deepFreeze({ ...BASE_EVENT, ...overrides })
  };
}

function loadedBases(overrides) {
  return {
    basesBefore: [true, true, true],
    baseRunnerIdsBefore: ["r1", "r2", "r3"],
    ...overrides
  };
}

function verifyTrajectoryRealismRegressions() {
  const sprayLanes = [-0.86, -0.58, -0.28, -0.08, 0, 0.08, 0.28, 0.58, 0.86];
  const safeHitTypes = [
    { type: "groundBall", trajectory: "ground-through", attempted: true },
    { type: "lineDrive", trajectory: "line-through", attempted: true },
    { type: "flyBall", trajectory: "fly-bloop", attempted: false }
  ];
  let sequence = 9100;
  let closeInfieldAttempts = 0;

  for (const spec of safeHitTypes) {
    for (const lane of sprayLanes) {
      const actualFielder = outfielderForSprayLane(lane);
      const attemptedFielder = spec.attempted ? infielderForSprayLane(lane) : "";
      const timeline = compilePlayTimeline({
        ...BASE_EVENT,
        sequence: sequence += 1,
        outcome: "single",
        battedBallType: spec.type,
        hitTrajectory: spec.trajectory,
        sprayLane: lane,
        fieldingLane: lane,
        fieldingPosition: actualFielder,
        attemptedFieldingPosition: attemptedFielder || undefined,
        basesAfter: [true, false, false],
        baseRunnerIdsAfter: ["batter", "", ""]
      }, { anchors: ANCHORS });
      const label = `${spec.type} safe hit at spray lane ${lane}`;

      assert.equal(timeline.meta.fielding?.fielder, actualFielder, `${label}: the wrong outfielder retrieves the hit.`);
      verifyPlanViewTrajectory(label, timeline);

      const preLandingDistance = pointDistance(timeline.points[actualFielder], timeline.points.miss);
      assert(
        preLandingDistance >= 20,
        `${label}: ${actualFielder} moves only ${preLandingDistance.toFixed(1)}px before the ball lands.`
      );
      const preLandingArrival = timeline.tracks.fielders.find((cue) => (
        cue.who === actualFielder
        && cue.arrivesAt === "miss"
        && Math.abs(Number(cue.endT) - Number(timeline.meta.fielding?.ballLandingT)) <= 0.0005
      ));
      assert(preLandingArrival, `${label}: the retrieving outfielder has no visible pre-landing approach/miss cue.`);

      if (!attemptedFielder) continue;
      assert.equal(
        timeline.meta.fielding?.attemptedFielder,
        attemptedFielder,
        `${label}: the recorded infielder attempt was discarded.`
      );
      const distanceToBallPath = pointToSegmentDistance(
        timeline.points[attemptedFielder],
        timeline.points.home,
        timeline.points.landing
      );
      if (distanceToBallPath > 72.25) continue;

      closeInfieldAttempts += 1;
      const missCue = timeline.tracks.fielders.find((cue) => (
        cue.who === attemptedFielder && cue.phase === "infield-attempt-miss"
      ));
      assert(missCue, `${label}: a close ${attemptedFielder} attempt has no reach/miss cue.`);
      assert(
        Number(missCue.endT) <= Number(timeline.meta.fielding?.ballLandingT) + 0.0005,
        `${label}: the infielder reacts only after the ball has already landed.`
      );
      if (pointDistance(timeline.points[attemptedFielder], timeline.points.infieldAttempt) >= 8) {
        assert(
          timeline.tracks.fielders.some((cue) => cue.who === attemptedFielder && cue.phase === "infield-react"),
          `${label}: a close ${attemptedFielder} attempt has no reaction movement.`
        );
      }
    }
  }
  assert(closeInfieldAttempts >= 12, `Only ${closeInfieldAttempts} close infield-attempt lanes were exercised.`);

  const wallMatrixLanes = [-0.82, -0.42, 0, 0.42, 0.82];
  const wallMatrixHitTypes = [
    { type: "groundBall", trajectory: "ground-through" },
    { type: "lineDrive", trajectory: "line-gap" },
    { type: "flyBall", trajectory: "fly-gap" }
  ];
  const wallMatrixOutcomes = [
    {
      outcome: "single",
      basesAfter: [true, false, false],
      baseRunnerIdsAfter: ["batter", "", ""],
      defensiveThrowTarget: "first"
    },
    {
      outcome: "double",
      basesAfter: [false, true, false],
      baseRunnerIdsAfter: ["", "batter", ""],
      defensiveThrowTarget: "second"
    },
    {
      outcome: "triple",
      basesAfter: [false, false, true],
      baseRunnerIdsAfter: ["", "", "batter"],
      defensiveThrowTarget: "third"
    }
  ];

  for (const result of wallMatrixOutcomes) {
    for (const hit of wallMatrixHitTypes) {
      for (const lane of wallMatrixLanes) {
        const timeline = compilePlayTimeline({
          ...BASE_EVENT,
          sequence: sequence += 1,
          ...result,
          battedBallType: hit.type,
          hitTrajectory: hit.trajectory,
          sprayLane: lane,
          fieldingLane: lane,
          fieldingPosition: outfielderForSprayLane(lane)
        }, { anchors: ANCHORS });
        const label = `${result.outcome} ${hit.type} at wall-matrix lane ${lane}`;
        const wallDistance = pointDistance(timeline.points.home, timeline.points.outfieldWall);

        assert(Number.isFinite(wallDistance) && wallDistance > 0, `${label}: missing outfield-wall geometry.`);
        if (lane === 0) {
          assert(
            pointDistance(timeline.points.outfieldWall, ANCHORS.centerWall) <= 0.01,
            `${label}: center-field fence calculation does not use centerWall.`
          );
        }
        for (const pointName of ["landing", "pickup"]) {
          assert(timeline.points[pointName], `${label}: missing ${pointName} point.`);
          const clearance = wallDistance - pointDistance(timeline.points.home, timeline.points[pointName]);
          assert(
            clearance >= 4 - 0.01,
            `${label}: ${pointName} is only ${clearance.toFixed(2)}px inside the outfield wall.`
          );
        }
        assert.equal(timeline.meta.wall?.clearsWall, false, `${label}: a safe hit is marked as clearing the wall.`);
        assert.equal(
          timeline.meta.invariants?.wallOutcomeMatches,
          true,
          `${label}: wall/outcome invariant does not match the safe-hit result.`
        );
      }
    }
  }

  const homeRunTimelines = wallMatrixLanes.map((lane) => {
    const timeline = compilePlayTimeline({
      ...BASE_EVENT,
      sequence: sequence += 1,
      outcome: "homeRun",
      battedBallType: "flyBall",
      hitTrajectory: "home-run",
      sprayLane: lane,
      fieldingLane: lane,
      runs: 1,
      scoredRunners: [{ id: "batter" }]
    }, { anchors: ANCHORS });
    const label = `home run at wall-matrix lane ${lane}`;
    const wallDistance = pointDistance(timeline.points.home, timeline.points.outfieldWall);
    const exitDistance = pointDistance(timeline.points.home, timeline.points.homeRunExit);

    assert(exitDistance > wallDistance + 0.01, `${label}: the flight does not finish beyond the outfield wall.`);
    assert.equal(timeline.meta.wall?.clearsWall, true, `${label}: home-run metadata does not clear the wall.`);
    assert.equal(timeline.meta.invariants?.wallOutcomeMatches, true, `${label}: wall/outcome invariant rejects the home run.`);
    const flightCue = timeline.tracks.ball.find((cue) => cue.phase === "home-run-flight");
    assert.equal(flightCue?.clearsWall, true, `${label}: the home-run flight cue is not marked clearsWall.`);
    const chaser = timeline.tracks.fielders.find((cue) => cue.phase === "warning-track");
    const chaseDistance = pointDistance(
      timeline.points?.[chaser?.path?.[0]],
      timeline.points?.[chaser?.path?.at(-1)]
    );
    assert(
      Number.isFinite(chaseDistance) && chaseDistance >= 18 && chaseDistance <= 80,
      `${label}: home-run chase distance ${chaseDistance.toFixed(2)}px is not a visible, plausible warning-track route.`
    );
    return timeline;
  });

  for (const legacyLane of [null, ""]) {
    const laneLabel = legacyLane === null ? "null" : "empty";
    const legacyCases = [
      {
        label: `legacy ${laneLabel} line lane`,
        type: "lineDrive",
        trajectory: "line-through",
        recorded: "2B",
        expectedFielder: "RF",
        expectedAttempt: "2B",
        direction: 1
      },
      {
        label: `legacy ${laneLabel} ground lane`,
        type: "groundBall",
        trajectory: "ground-through",
        recorded: "SS",
        expectedFielder: "LF",
        expectedAttempt: "SS",
        direction: -1
      },
      {
        label: `legacy ${laneLabel} fly lane`,
        type: "flyBall",
        trajectory: "fly-bloop",
        recorded: "RF",
        expectedFielder: "RF",
        expectedAttempt: "",
        direction: 1
      }
    ];

    for (const legacy of legacyCases) {
      const timeline = compilePlayTimeline({
        ...BASE_EVENT,
        sequence: sequence += 1,
        outcome: "single",
        battedBallType: legacy.type,
        hitTrajectory: legacy.trajectory,
        sprayLane: legacyLane,
        fieldingLane: legacyLane,
        fieldingPosition: legacy.recorded,
        basesAfter: [true, false, false],
        baseRunnerIdsAfter: ["batter", "", ""]
      }, { anchors: ANCHORS });

      assert.equal(timeline.meta.fielding?.sprayLane, null, `${legacy.label}: missing sprayLane became a numeric center lane.`);
      assert.equal(timeline.meta.fielding?.fieldingLane, null, `${legacy.label}: missing fieldingLane became a numeric center lane.`);
      assert.equal(timeline.meta.fielding?.fielder, legacy.expectedFielder, `${legacy.label}: semantic lane fallback chose the wrong outfielder.`);
      assert.equal(timeline.meta.fielding?.attemptedFielder, legacy.expectedAttempt, `${legacy.label}: semantic lane fallback lost the attempted infielder.`);
      assert(
        (Number(timeline.points.landing.x) - Number(timeline.points.home.x)) * legacy.direction > 70,
        `${legacy.label}: a missing lane collapsed the hit into center field.`
      );
      verifyPlanViewTrajectory(legacy.label, timeline);
    }
  }

  const errorCases = [
    { position: "2B", type: "lineDrive", lane: null },
    { position: "SS", type: "lineDrive", lane: "" },
    { position: "3B", type: "groundBall", lane: null }
  ];
  for (const errorCase of errorCases) {
    const timeline = compilePlayTimeline({
      ...BASE_EVENT,
      sequence: sequence += 1,
      outcome: "error",
      battedBallType: errorCase.type,
      hitTrajectory: errorCase.type === "groundBall" ? "ground-through" : "line-through",
      sprayLane: errorCase.lane,
      fieldingLane: errorCase.lane,
      fieldingPosition: errorCase.position,
      basesAfter: [true, false, false],
      baseRunnerIdsAfter: ["batter", "", ""]
    }, { anchors: ANCHORS });
    const label = `${errorCase.position} ${errorCase.type} error`;

    assert.equal(timeline.meta.fielding?.fielder, errorCase.position, `${label}: the recorded error was rerouted to an outfielder.`);
    assert(!OUTFIELD_POSITIONS.has(timeline.meta.fielding?.fielder), `${label}: an infield error became a safe-hit outfield pickup.`);
    assert.equal(timeline.meta.fielding?.attemptedFielder, "", `${label}: an error was mislabeled as a through-ball attempt.`);
    assert(
      !["safe-fly-drop", "safe-line-trap", "safe-line-short-hop", "safe-ground-through"].includes(timeline.meta.fielding?.resolution),
      `${label}: an error received a safe-hit resolution.`
    );
  }

  const excessivePickupHolds = [];
  const extraBaseCases = [
    { outcome: "double", type: "lineDrive", trajectory: "line-gap", lane: 0.45, fielder: "RF", target: "second" },
    { outcome: "double", type: "flyBall", trajectory: "fly-gap", lane: -0.55, fielder: "LF", target: "second" },
    { outcome: "triple", type: "lineDrive", trajectory: "line-gap", lane: 0.55, fielder: "RF", target: "third" },
    { outcome: "triple", type: "flyBall", trajectory: "fly-gap", lane: 0, fielder: "CF", target: "third" }
  ];
  for (const extraBase of extraBaseCases) {
    const thirdBase = extraBase.outcome === "triple";
    const timeline = compilePlayTimeline({
      ...BASE_EVENT,
      sequence: sequence += 1,
      outcome: extraBase.outcome,
      battedBallType: extraBase.type,
      hitTrajectory: extraBase.trajectory,
      sprayLane: extraBase.lane,
      fieldingPosition: extraBase.fielder,
      defensiveThrowTarget: extraBase.target,
      basesAfter: thirdBase ? [false, false, true] : [false, true, false],
      baseRunnerIdsAfter: thirdBase ? ["", "", "batter"] : ["", "batter", ""]
    }, { anchors: ANCHORS });
    const throwCue = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
    const label = `${extraBase.type} ${extraBase.outcome}`;

    assert(throwCue, `${label}: the outfielder never releases the relay throw.`);
    const pickupToReleaseMs = (
      Number(throwCue.t) - Number(timeline.meta.fielding?.fielderArrivalT)
    ) * Number(timeline.durationMs);
    assert(pickupToReleaseMs >= -0.5, `${label}: the throw is released before the pickup.`);
    if (pickupToReleaseMs > 300.5) {
      excessivePickupHolds.push(`${label} ${pickupToReleaseMs.toFixed(1)}ms`);
    }
  }

  const flightCases = [
    {
      key: "line",
      event: { outcome: "single", battedBallType: "lineDrive", hitTrajectory: "line-through", fieldingPosition: "CF", sprayLane: 0 }
    },
    {
      key: "bloop",
      event: { outcome: "single", battedBallType: "flyBall", hitTrajectory: "fly-bloop", fieldingPosition: "CF", sprayLane: 0 }
    },
    {
      key: "gap",
      event: { outcome: "single", battedBallType: "flyBall", hitTrajectory: "fly-gap-drop", fieldingPosition: "CF", sprayLane: 0 }
    },
    {
      key: "caught",
      event: { outcome: "out", battedBallType: "flyBall", fieldingPosition: "CF", sprayLane: 0, outsAfter: 1 }
    }
  ];
  const flights = Object.fromEntries(flightCases.map(({ key, event }) => {
    const safe = event.outcome !== "out";
    const timeline = compilePlayTimeline({
      ...BASE_EVENT,
      sequence: sequence += 1,
      ...event,
      basesAfter: safe ? [true, false, false] : [false, false, false],
      baseRunnerIdsAfter: safe ? ["batter", "", ""] : ["", "", ""]
    }, { anchors: ANCHORS });
    return [key, battedFlightMetrics(timeline)];
  }));

  assert(flights.line.flightMs >= 800 && flights.line.flightMs <= 1400, `Line-drive flight is ${flights.line.flightMs.toFixed(0)}ms.`);
  assert(flights.bloop.flightMs >= flights.line.flightMs + 160, "A bloop has no meaningful hang-time separation from a line drive.");
  assert(flights.gap.flightMs >= flights.bloop.flightMs + 100, "A gap-drop fly has no meaningful hang-time separation from a bloop.");
  assert(flights.caught.flightMs >= flights.gap.flightMs + 150, "A caught fly has no meaningful hang-time separation from a gap drop.");
  assert(flights.line.arc <= 0.3, `Line-drive arc ${flights.line.arc} is too high.`);
  assert(flights.bloop.arc >= flights.line.arc + 0.2, "A bloop arc is indistinguishable from a line drive.");
  assert(flights.gap.arc >= flights.bloop.arc + 0.15, "A gap-drop arc is indistinguishable from a bloop.");
  assert(flights.caught.arc >= flights.bloop.arc + 0.15, "A caught-fly arc is indistinguishable from a bloop.");
  assert(flights.bloop.maxHeight >= flights.line.maxHeight + 25, "Bloop height is visually indistinguishable from a line drive.");
  assert(flights.gap.maxHeight >= flights.bloop.maxHeight + 15, "Gap-drop height is visually indistinguishable from a bloop.");
  assert(flights.caught.maxHeight >= flights.bloop.maxHeight + 15, "Caught-fly height is visually indistinguishable from a bloop.");

  const regularTrailTimeline = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: sequence += 1,
    outcome: "double",
    battedBallType: "lineDrive",
    hitTrajectory: "line-gap",
    sprayLane: 0.42,
    fieldingLane: 0.42,
    fieldingPosition: "RF",
    defensiveThrowTarget: "second",
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  }, { anchors: ANCHORS });
  verifyBattedFlightTrail("regular batted flight", regularTrailTimeline, {
    outcome: "double",
    phase: "batted",
    minimumScale: 1.14
  });
  verifyBattedFlightTrail("home-run batted flight", homeRunTimelines[2], {
    outcome: "homeRun",
    phase: "home-run-flight",
    minimumScale: 1.22
  });

  assert.equal(
    excessivePickupHolds.length,
    0,
    `Extra-base pickup-to-release hold exceeds 300ms: ${excessivePickupHolds.join(", ")}`
  );
}

function verifyBattedFlightTrail(label, timeline, { outcome, phase, minimumScale }) {
  const cue = timeline.tracks.ball.find((entry) => entry.phase === phase);
  assert(cue, `${label}: missing ${phase} cue.`);
  const localT = 0.62;
  const progress = Number(cue.t) + (Number(cue.endT) - Number(cue.t)) * localT;
  const state = buildTimelineBallState(timeline, progress, { outcome });

  assert(state, `${label}: buildTimelineBallState returned no visible ball.`);
  assert.equal(state.trail?.length, 7, `${label}: batted flight must expose seven trail samples.`);
  assert(Number(state.scale) >= minimumScale, `${label}: ball scale ${state.scale} is below ${minimumScale}.`);
  assert.equal(state.clearsWall, phase === "home-run-flight", `${label}: clearsWall state disagrees with the flight phase.`);

  const cueDurationMs = (Number(cue.endT) - Number(cue.t)) * Number(timeline.durationMs);
  const firstTrailPoint = state.trail[0];
  let firstTrailLocalT = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  // Recover the first sample's authored local time from its plan-view ground
  // coordinates so the public state, rather than a private renderer constant,
  // proves that the visible trail spans no more than 120ms.
  for (let index = 0; index <= 12000; index += 1) {
    const candidateT = localT * index / 12000;
    const candidate = timelineBallPoint(cue, timeline.points, candidateT);
    const distance = Math.hypot(
      Number(candidate?.groundX ?? candidate?.x) - Number(firstTrailPoint?.groundX ?? firstTrailPoint?.x),
      Number(candidate?.groundY ?? candidate?.y) - Number(firstTrailPoint?.groundY ?? firstTrailPoint?.y)
    );
    if (distance < closestDistance) {
      closestDistance = distance;
      firstTrailLocalT = candidateT;
    }
  }
  const trailWindowMs = (localT - firstTrailLocalT) * cueDurationMs;
  assert(closestDistance <= 0.05, `${label}: could not map the first public trail sample back to the flight cue.`);
  assert(
    trailWindowMs <= 120.75,
    `${label}: seven-sample trail spans ${trailWindowMs.toFixed(2)}ms, exceeding the 120ms cap.`
  );
}

function allCues(timeline) {
  return Object.values(timeline.tracks).flat();
}

function pointDistance(a, b) {
  return Math.hypot(Number(a?.x ?? 0) - Number(b?.x ?? 0), Number(a?.y ?? 0) - Number(b?.y ?? 0));
}

function outfieldWallDistanceAlongRay(home, point, leftPole, centerWall, rightPole) {
  const rayX = Number(point?.x ?? 0) - Number(home?.x ?? 0);
  const rayY = Number(point?.y ?? 0) - Number(home?.y ?? 0);
  const rayLength = Math.hypot(rayX, rayY);
  if (rayLength < 0.001) return Number.NaN;
  const direction = { x: rayX / rayLength, y: rayY / rayLength };
  return [
    raySegmentDistance(home, direction, leftPole, centerWall),
    raySegmentDistance(home, direction, centerWall, rightPole)
  ].filter(Number.isFinite).sort((left, right) => left - right)[0] ?? Number.NaN;
}

function raySegmentDistance(origin, direction, start, end) {
  const segmentX = Number(end?.x ?? 0) - Number(start?.x ?? 0);
  const segmentY = Number(end?.y ?? 0) - Number(start?.y ?? 0);
  const offsetX = Number(start?.x ?? 0) - Number(origin?.x ?? 0);
  const offsetY = Number(start?.y ?? 0) - Number(origin?.y ?? 0);
  const denominator = direction.x * segmentY - direction.y * segmentX;
  if (Math.abs(denominator) < 0.000001) return Number.NaN;
  const distance = (offsetX * segmentY - offsetY * segmentX) / denominator;
  const segmentT = (offsetX * direction.y - offsetY * direction.x) / denominator;
  return distance > 0 && segmentT >= -0.000001 && segmentT <= 1.000001
    ? distance
    : Number.NaN;
}

function outfielderForSprayLane(lane) {
  if (lane <= -0.22) return "LF";
  if (lane >= 0.22) return "RF";
  return "CF";
}

function infielderForSprayLane(lane) {
  if (lane <= -0.72) return "3B";
  if (lane < -0.2) return "SS";
  if (Math.abs(lane) <= 0.2) return "P";
  if (lane < 0.72) return "2B";
  return "1B";
}

function pointToSegmentDistance(point, from, to) {
  const dx = Number(to?.x ?? 0) - Number(from?.x ?? 0);
  const dy = Number(to?.y ?? 0) - Number(from?.y ?? 0);
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 0.001) return pointDistance(point, from);
  const projection = Math.max(0, Math.min(1, (
    (Number(point?.x ?? 0) - Number(from?.x ?? 0)) * dx
    + (Number(point?.y ?? 0) - Number(from?.y ?? 0)) * dy
  ) / lengthSquared));
  return pointDistance(point, {
    x: Number(from?.x ?? 0) + dx * projection,
    y: Number(from?.y ?? 0) + dy * projection
  });
}

function verifyPlanViewTrajectory(label, timeline) {
  const ball = timeline.tracks.ball.find((cue) => cue.phase === "batted");
  assert(ball, `${label}: missing batted-ball cue.`);
  const start = timeline.points.home;
  const end = timeline.points.landing;
  const dx = Number(end?.x) - Number(start?.x);
  const dy = Number(end?.y) - Number(start?.y);
  const routeLength = Math.hypot(dx, dy);
  assert(routeLength > 1, `${label}: batted-ball route has no plan-view distance.`);

  let previousProjection = -Infinity;
  let maxLateralDeviation = 0;
  let finalPoint = null;
  for (let index = 0; index <= 64; index += 1) {
    const point = timelineBallPoint(ball, timeline.points, index / 64);
    assert(point, `${label}: batted-ball route cannot be sampled at ${index}/64.`);
    const groundPoint = { x: Number(point.groundX), y: Number(point.groundY) };
    const rx = groundPoint.x - Number(start.x);
    const ry = groundPoint.y - Number(start.y);
    const projection = (rx * dx + ry * dy) / routeLength;
    const lateralDeviation = Math.abs(rx * dy - ry * dx) / routeLength;
    assert(
      projection >= previousProjection - 0.15,
      `${label}: plan-view direction reverses at sample ${index}/64.`
    );
    previousProjection = projection;
    maxLateralDeviation = Math.max(maxLateralDeviation, lateralDeviation);
    finalPoint = groundPoint;
  }

  assert(
    maxLateralDeviation <= 3,
    `${label}: plan-view route bends ${maxLateralDeviation.toFixed(1)}px away from its spray line.`
  );
  assert(pointDistance(finalPoint, end) <= 0.75, `${label}: plan-view flight does not finish at the landing point.`);
}

function battedFlightMetrics(timeline) {
  const cue = timeline.tracks.ball.find((item) => item.phase === "batted");
  assert(cue, "Flight comparison case has no batted-ball cue.");
  let maxHeight = 0;
  for (let index = 0; index <= 64; index += 1) {
    maxHeight = Math.max(
      maxHeight,
      Number(timelineBallPoint(cue, timeline.points, index / 64)?.height ?? 0)
    );
  }
  return {
    flightMs: (Number(cue.endT) - Number(cue.t)) * Number(timeline.durationMs),
    arc: Number(cue.arc ?? 0),
    maxHeight
  };
}

function postLandingDirectionDot(points) {
  const flightX = Number(points?.landing?.x) - Number(points?.home?.x);
  const flightY = Number(points?.landing?.y) - Number(points?.home?.y);
  const settleX = Number(points?.pickup?.x) - Number(points?.landing?.x);
  const settleY = Number(points?.pickup?.y) - Number(points?.landing?.y);
  return flightX * settleX + flightY * settleY;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(verifyGamecastTimeline());
}
