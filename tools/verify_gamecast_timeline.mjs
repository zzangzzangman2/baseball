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
  GAMECAST2_TIMELINE_TEMPLATES
} from "../src/gamecast2/timeline.js";
import {
  buildTimelineVisualPlay,
  derivePlateActor,
  GAMECAST2_THROW_GLOVE_LIFT,
  gamecast2FlyResolutionCue,
  gamecast2TimelineCueFacing,
  timelineBallPoint
} from "../src/gamecast2/scene.js";
import { gamecastEventPlayDuration, gamecastPlaybackPosition, gamecastTotalDuration } from "../src/ui.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const ATLAS_PATHS = [
  "player-home.json",
  "player-home-night.json",
  "player-away.json",
  "player-away-night.json"
].map((name) => path.join(ROOT_DIR, "assets", "gamecast", name));
const FIELD_ANCHOR_PATHS = [
  "field-jamsil-day.anchors.json",
  "field-jamsil-night.anchors.json",
  "field-gocheok-dome.anchors.json"
].map((name) => path.join(ROOT_DIR, "assets", "gamecast2", name));
const BATTER_BOX_BOUNDS = Object.freeze({
  "field-jamsil-day": Object.freeze({ xMin: 497, xMax: 536, yMin: 603, yMax: 642 }),
  "field-jamsil-night": Object.freeze({ xMin: 496, xMax: 529, yMin: 577, yMax: 609 }),
  "field-gocheok-dome": Object.freeze({ xMin: 493, xMax: 522, yMin: 599, yMax: 630 })
});
const DEFENSE_POSITIONS = Object.freeze(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const OUTFIELD_POSITIONS = new Set(["LF", "CF", "RF"]);
// Keep aligned with src/gamecast2/scene.js. This catches timeline endpoints
// that would otherwise be silently clamped to a different visible location.
const DEFENDER_MOVE_ZONES = Object.freeze({
  P: { x: 300, yTop: 110, yBottom: 220 },
  C: { x: 30, yTop: 42, yBottom: 12 },
  "1B": { x: 54, yTop: 42, yBottom: 45 },
  "2B": { x: 132, yTop: 80, yBottom: 80 },
  "3B": { x: 54, yTop: 42, yBottom: 45 },
  SS: { x: 184, yTop: 80, yBottom: 80 },
  LF: { x: 96, yTop: 58, yBottom: 160 },
  CF: { x: 116, yTop: 62, yBottom: 84 },
  RF: { x: 96, yTop: 58, yBottom: 160 }
});

const ANCHORS = deepFreeze({
  home: { x: 480, y: 617, scale: 1.01 },
  first: { x: 758, y: 415, scale: 0.86 },
  second: { x: 480, y: 321, scale: 0.79 },
  third: { x: 202, y: 415, scale: 0.86 },
  mound: { x: 480, y: 407, scale: 0.85 },
  P: { x: 480, y: 414, scale: 0.86 },
  C: { x: 480, y: 646, scale: 1.03 },
  "1B": { x: 724, y: 438, scale: 0.88 },
  "2B": { x: 592, y: 400, scale: 0.85 },
  "3B": { x: 236, y: 438, scale: 0.88 },
  SS: { x: 368, y: 400, scale: 0.85 },
  LF: { x: 260, y: 306, scale: 0.78 },
  CF: { x: 480, y: 264, scale: 0.75 },
  RF: { x: 700, y: 306, scale: 0.78 },
  leftPole: { x: 42, y: 252, scale: 0.74 },
  rightPole: { x: 918, y: 252, scale: 0.74 }
});

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
  verifyPlaybackClock();
  verifyDefensiveRotation(compiled);
  verifyFlyBallResolution();
  verifyTrajectoryRealismRegressions();
  verifyBuntChoreography();
  verifyGroundBallResponsibilityZones();
  verifyFielderPositionMatrix();
  verifyThrowTargetRegressionCases();
  verifyArmDrivenThrows();
  verifyStealVisualActors();
  verifyPurity(cases[3].event);

  return `${compiled.length}개 플레이, ${GAMECAST2_TIMELINE_TEMPLATES.length * DEFENSE_POSITIONS.length}개 수비 조합, atlas anim ${GAMECAST2_ATLAS_ANIMATION_KEYS.length}키`;
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
  const pitcherCover = firstBaseOut.tracks.fielders.find((cue) => cue.who === "P" && cue.assignment === "receiver" && cue.path?.at(-1) === "first");
  assert(pitcherCover, "Pitcher does not cover first when 1B fields the ground ball.");
  const pitcherCoverDistance = pointDistance(ANCHORS.P, ANCHORS.first);
  const pitcherCoverSeconds = (Number(pitcherCover.endT) - Number(pitcherCover.t)) * firstBaseOut.durationMs / 1000;
  assert(
    pitcherCoverDistance / pitcherCoverSeconds <= 250,
    `Pitcher first-base coverage is too fast (${(pitcherCoverDistance / pitcherCoverSeconds).toFixed(1)}px/s).`
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
  assert.equal(safeFirstAttempt.meta.fielding?.throwTarget, "first", "1B ground-ball single throws across the diamond instead of trying first.");
  assert.equal(safeFirstAttempt.meta.fielding?.throwOrdering, "runner-safe-first", "1B ground-ball single throw beats a batter recorded safe.");

  const thirdBaseThrow = compilePlayTimeline({
    ...BASE_EVENT,
    id: "ground-zone-third-backup",
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "2B",
    fieldingZone: "first-hole",
    fieldingLane: 0.38,
    defensiveThrowTarget: "third",
    basesBefore: [false, true, false],
    baseRunnerIdsBefore: ["", "r2", ""],
    basesAfter: [true, false, true],
    baseRunnerIdsAfter: ["batter", "", "r2"]
  }, { anchors: ANCHORS });
  const thirdBackup = thirdBaseThrow.tracks.fielders.find((cue) => cue.assignment === "backup" && cue.supportTarget === "third");
  assert.equal(thirdBackup?.who, "LF", "Third-base backup should be LF, not P/SS/2B.");
  for (const timeline of [firstBaseOut, thirdBaseThrow]) {
    assert(
      !timeline.tracks.fielders.some((cue) => cue.assignment === "backup" && ["SS", "2B"].includes(cue.who)),
      "A middle infielder is still used as a generic base backup."
    );
  }
}

function verifyFieldAnchorContract() {
  for (const anchorPath of FIELD_ANCHOR_PATHS) {
    const payload = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
    const first = payload.anchors?.first;
    const second = payload.anchors?.second;
    const third = payload.anchors?.third;
    const batter = payload.anchors?.batter;
    const shortstop = payload.anchors?.SS;
    const secondBaseman = payload.anchors?.["2B"];
    const leftFielder = payload.anchors?.LF;
    const centerFielder = payload.anchors?.CF;
    const rightFielder = payload.anchors?.RF;
    assert(first && second && third, `${path.basename(anchorPath)}: first/second/third base anchors are missing.`);
    assert(batter, `${path.basename(anchorPath)}: authored batter-box anchor is missing.`);
    assert(shortstop && secondBaseman, `${path.basename(anchorPath)}: SS/2B anchors are missing.`);
    assert(leftFielder && centerFielder && rightFielder, `${path.basename(anchorPath)}: LF/CF/RF anchors are missing.`);
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
      centerFieldDepth >= 85,
      `${path.basename(anchorPath)}: CF is too close to the middle infield (${centerFieldDepth.toFixed(1)}px).`
    );
    assert(
      sideFieldDepths.every((depth) => depth >= 135),
      `${path.basename(anchorPath)}: corner outfielders are too close to the infield (${sideFieldDepths.map((depth) => depth.toFixed(1)).join(", ")}px).`
    );
    if (payload.fieldId === "field-gocheok-dome") {
      assert.deepEqual(
        { first: [Number(first.x), Number(first.y)], third: [Number(third.x), Number(third.y)] },
        { first: [724, 445], third: [236, 445] },
        "Gocheok first/third anchors no longer match the visible base-bag centers."
      );
    }
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
    assert.equal(recovery?.endT, fielding.fielderArrivalT, `${name}: safe-hit recovery arrival does not match metadata.`);
    assert.equal(ball.endT, fielding.ballLandingT, `${name}: safe-hit landing metadata differs from the ball cue.`);
    assert(fielding.fielderArrivalT > fielding.ballLandingT, `${name}: safe-hit fielder controls the ball before landing.`);
    assert(Number(fielding.landingSeparationPx) >= 41.5, `${name}: safe-hit landing separation is ${fielding.landingSeparationPx}px.`);
  } else {
    assert.equal(fielder.path.at(-1), fielding.landingPoint, `${name}: 수비수 도착지점 불일치`);
    assert.equal(ball.endT, fielder.endT, `${name}: 공 낙하와 수비수 도착 시점 불일치`);
  }
  assert.equal(fielding.ballArrivalT, fielding.fielderArrivalT, `${name}: fielding 메타 시점 불일치`);
  assert.equal(timeline.meta.invariants.fieldingArrivalMatchesBall, true, `${name}: fielding 도착 불변식 실패`);

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
    fieldingPosition: "CF",
    hitTrajectory: "fly-bloop",
    sprayLane: 0.04,
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
    ) <= 20,
    "직선타 안타가 착지 후 너무 멀리 이동합니다."
  );
  assert(
    postLandingDirectionDot(safeLine.points) > 0,
    "직선타 안타가 착지 후 홈 쪽으로 역주행합니다."
  );

  const safeFlight = safe.tracks.ball.find((cue) => cue.phase === "batted");
  const settle = safe.tracks.ball.find((cue) => cue.phase === "safe-settle");
  const approach = safe.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "approach");
  const recover = safe.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "recover");
  const pickup = safe.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "pickup");
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
    ) <= 20,
    "뜬공 안타가 착지 후 외야수 쪽으로 너무 멀리 이동합니다."
  );
  assert(postLandingDirectionDot(safe.points) > 0, "뜬공 안타가 착지 후 홈 쪽으로 역주행합니다.");
  assert.equal(safe.meta.fielding.fieldingStyle, "run-through", "일반 뜬공 안타가 불필요한 다이빙으로 분류됩니다.");
  assert.deepEqual(approach?.path, ["CF", "miss"], "일반 뜬공 안타 수비수가 낙하 순간 포구 반경을 침범합니다.");
  assert.deepEqual(recover?.path, ["miss", "pickup"], "일반 뜬공 안타 수비수가 떨어진 공을 회수하지 않습니다.");
  assert(!safe.tracks.fielders.some((cue) => cue.who === "CF" && cue.anim === "dive"), "일반 뜬공 안타 수비수가 강제로 다이빙합니다.");
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
      Math.abs(actualMsPerBase - 1400) <= 210,
      `${item.name}: existing runner pace is ${actualMsPerBase.toFixed(0)}ms/base instead of about 1400ms/base.`
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
      legacyLandingT: 0.46,
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
      actualRunMsPerBase >= 850,
      `${timeline.template}: batter is too fast at ${actualRunMsPerBase.toFixed(0)}ms/base.`
    );
    if (timeline.template === "single") {
      oneBaseRunTimes.set("single", actualRunMsPerBase);
      assert(actualRunMsPerBase >= 1300, `ground-ball single reaches first too quickly: ${actualRunMsPerBase.toFixed(0)}ms.`);
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
        timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
        item.legacyThrowEndT * item.legacyDurationMs + item.fieldingDelayMs + Number(item.safeFlyRecoveryMs ?? 0)
      ]);
    }
    for (const [phase, cueEntry, legacyMs] of actionCues) {
      assert(cueEntry, `${timeline.template}: ${phase} cue is missing.`);
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
  assert(rightFieldFlight && rightFielderRoute, "empty-bases right-field single has no RF flight/route cues.");
  const rightFieldFlightMs = (Number(rightFieldFlight.endT) - Number(rightFieldFlight.t)) * emptyBasesRightFieldSingle.durationMs;
  const rightFielderRouteMs = (Number(rightFielderRoute.endT) - Number(rightFielderRoute.t)) * emptyBasesRightFieldSingle.durationMs;
  const rightFielderReactionMs = (Number(rightFielderRoute.t) - Number(rightFieldFlight.t)) * emptyBasesRightFieldSingle.durationMs;
  assert(
    rightFieldFlightMs >= 850 && rightFieldFlightMs <= 1450,
    `right-field line drive has an unrealistic ${rightFieldFlightMs.toFixed(0)}ms flight.`
  );
  assert(
    rightFielderRouteMs >= 650 && rightFielderRouteMs <= 1600,
    `right fielder has an unrealistic ${rightFielderRouteMs.toFixed(0)}ms read route.`
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
    const receive = timeline.tracks.fielders.find((cue) => cue.phase === `receive-${target}`);
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
    pointDistance(firstBackupDestination, infieldOut?.points?.first) <= 14.1,
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
      assert(
        targetDistance <= 42.01,
        `${name}: ${cue.who} backs up ${cue.supportTarget} from ${targetDistance.toFixed(2)}px away.`
      );
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

function verifyThrowTargetSemantics(name, event, timeline) {
  const fieldingThrow = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const fieldingTarget = fieldingThrow?.path?.at(-1) ?? null;
  const runnerTarget = leadRunnerDestination(timeline);
  const canonicalTargetRaw = String(event?.defensiveThrowTarget ?? "").trim().toLowerCase();
  const canonicalTarget = ["first", "second", "third", "home"].includes(canonicalTargetRaw)
    ? canonicalTargetRaw
    : null;
  const battedType = String(event?.battedBallType ?? "").toLowerCase();
  const caughtBattedOut = timeline.outcome === "out"
    && timeline.template !== "doublePlay"
    && (battedType.includes("fly") || battedType.includes("line"));

  if (timeline.template === "single") {
    assert.equal(
      fieldingTarget,
      canonicalTarget ?? runnerTarget,
      `${name}: single throw must follow the lead existing runner; empty bases require no competitive throw.`
    );
    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    const field = timeline.tracks.fielders.find((cue) => ["field", "pickup", "trap", "short-hop"].includes(cue.phase));
    const outfieldSingle = OUTFIELD_POSITIONS.has(String(timeline.meta.fielding?.fielder ?? ""));
    assert(batterRun && field, `${name}: single has no batter-run/fielding cues.`);
    if (outfieldSingle) {
      assert(batterRun.endT <= field.endT, `${name}: outfielder completes the pickup unrealistically before the batter reaches first.`);
    } else {
      assert(batterRun.endT >= field.endT, `${name}: infield single batter reaches first before the fielding play develops.`);
    }
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
        || timeline.template === "doublePlay"
        || runnerTarget === "second"
        || canonicalTarget === "second",
      `${name}: unjustified throw to second without a double play or an actual runner destination.`
    );
  }
  if (fieldingTarget === "third") {
    assert(
      timeline.template === "triple" || runnerTarget === "third" || canonicalTarget === "third",
      `${name}: unjustified throw to third without a triple or an actual runner destination.`
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
  assert(arrivalLeadT >= 0.119999, `${name}: first-base receiver arrives only ${arrivalLeadT.toFixed(3)}T before the ball.`);
  assert(settleT >= 0.059999, `${name}: first-base receiver has no visible foot-plant interval before the catch.`);
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
  const tripleThrow = safeTriple.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const tripleArrival = Math.max(...safeTriple.tracks.batter
    .filter((cue) => cue.path?.at(-1) === "third" || cue.at === "third")
    .map((cue) => Number(cue.endT ?? cue.t)));
  assert.equal(tripleThrow.ordering, "runner-safe-first", "Safe triple throw lacks safe-order metadata.");
  assert(Number(tripleThrow.endT) >= tripleArrival + 0.014999, "Safe triple visually shows the throw beating the runner.");

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
  assert.equal(
    emptyBasesSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: empty-bases single still throws to second."
  );
  verifyThrowTargetSemantics("regression-empty-bases-single", emptyBasesSingle.event, emptyBasesSingle.timeline);

  const infieldChopper = compile({
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    fieldingZone: "third-hole",
    fieldingLane: -0.36,
    hitTrajectory: "infield-chopper",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  });
  const chopperThrow = infieldChopper.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  assert.equal(chopperThrow?.path?.at(-1), "first", "Infield hit fielder keeps the ball instead of making the late throw to first.");
  assert.equal(chopperThrow?.ordering, "runner-safe-first", "Infield-hit throw reaches first before the recorded safe runner.");

  const firstToThirdSingle = compile({
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [true, false, true],
    baseRunnerIdsAfter: ["batter", "", "r1"]
  });
  assert.equal(
    firstToThirdSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "third",
    "Regression: single ignored a first-to-third runner and threw to second."
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
    forcedFirstToSecondSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "second",
    "Regression: an actual first-to-second forced advance did not permit a second-base throw."
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
  assert.equal(
    canonicalEmptyDouble.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "second",
    "Regression: canonical empty-bases double target was not second."
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
  assert.equal(
    canonicalEmptyTriple.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "third",
    "Regression: canonical empty-bases triple target was not third."
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
    canonicalScoringThrow.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "home",
    "Regression: scoring runner did not produce the canonical throw home."
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
  const tagUpThrow = canonicalTagUpThrow.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const tagUpCatch = canonicalTagUpThrow.timeline.tracks.ball.find((cue) => cue.phase === "batted");
  const tagUpRunner = canonicalTagUpThrow.timeline.tracks.runners.find((cue) => (
    cue.phase === "runner-advance" && cue.runnerId === "r3"
  ));
  const tagUpReceiver = canonicalTagUpThrow.timeline.tracks.fielders.find((cue) => (
    cue.anim === "catch"
    && cue.at === "home"
    && Number(cue.endT ?? cue.t) >= Number(tagUpThrow?.endT ?? 2)
  ));
  assert(tagUpCatch && tagUpRunner, "Regression: tag-up play has no caught-ball/runner cues.");
  assert(
    Number(tagUpRunner.t) >= Number(tagUpCatch.endT),
    `Regression: tag-up runner leaves before the catch (${tagUpRunner.t} < ${tagUpCatch.endT}).`
  );
  const tagUpRunMsPerBase = (
    (Number(tagUpRunner.endT) - Number(tagUpRunner.t)) * canonicalTagUpThrow.timeline.durationMs
  ) / Number(tagUpRunner.basesAdvanced ?? 1);
  assert(
    Math.abs(tagUpRunMsPerBase - 1400) <= 12,
    `Regression: tag-up runner pace is ${tagUpRunMsPerBase.toFixed(0)}ms/base instead of 1400ms/base.`
  );
  const tagUpHelperStartMs = getGamecast2RunnerStartMs(canonicalTagUpThrow.event);
  const tagUpTimelineStartMs = Number(tagUpRunner.t) * canonicalTagUpThrow.timeline.durationMs;
  assert(
    Math.abs(Number(tagUpHelperStartMs) - tagUpTimelineStartMs) <= 0.01,
    `Regression: tag-up helper (${tagUpHelperStartMs}ms) disagrees with timeline (${tagUpTimelineStartMs}ms).`
  );
  assert.equal(tagUpThrow?.path?.at(-1), "home", "Regression: tag-up scoring play ignored the canonical throw home.");
  assert(tagUpReceiver, "Regression: tag-up throw reaches home after the catcher cue has ended.");
  assert(Number(tagUpThrow.endT) <= 0.985, `Regression: tag-up throw exceeds the timeline throw boundary (${tagUpThrow.endT}).`);
  assert(
    Number(tagUpThrow.endT) >= Number(tagUpRunner.endT) + 0.014999,
    `Regression: safe tag-up shows the throw beating the scoring runner (${tagUpThrow.endT} < ${tagUpRunner.endT} + .015).`
  );
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
  assert(errorField && errorThrow, "Regression: error event has no visible misplay-followed-by-throw sequence.");
  assert.equal(errorThrow.path?.at(-1), "first", "Regression: error throw ignored its canonical first-base target.");
  assert(
    Number(errorThrow.t) >= Number(errorField.endT),
    "Regression: error throw starts before the misplay finishes."
  );

  const legacyDoubleTarget = compile({
    outcome: "double",
    battedBallType: "lineDrive",
    fieldingPosition: "LF",
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  });
  assert.equal(
    legacyDoubleTarget.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "second",
    "Regression: legacy double inference does not hold the batter at second."
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
    const zone = DEFENDER_MOVE_ZONES[cue.who];
    if (!destination || !origin || !zone) continue;
    const dx = Number(destination.x) - Number(origin.x);
    const dy = Number(destination.y) - Number(origin.y);
    assert(
      dx >= -zone.x - 0.000001 && dx <= zone.x + 0.000001 &&
        dy >= -zone.yTop - 0.000001 && dy <= zone.yBottom + 0.000001,
      `${name}: ${cue.who} ${cue.phase} endpoint is clamped by the scene (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}).`
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
      if (pointDistance(timeline.points[attemptedFielder], timeline.points.infieldAttempt) >= 4) {
        assert(
          timeline.tracks.fielders.some((cue) => cue.who === attemptedFielder && cue.phase === "infield-react"),
          `${label}: a close ${attemptedFielder} attempt has no reaction movement.`
        );
      }
    }
  }
  assert(closeInfieldAttempts >= 12, `Only ${closeInfieldAttempts} close infield-attempt lanes were exercised.`);

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
    if (pickupToReleaseMs > 450.5) {
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
  assert(flights.bloop.flightMs >= flights.line.flightMs + 350, "A bloop has no meaningful hang-time separation from a line drive.");
  assert(flights.gap.flightMs >= flights.bloop.flightMs + 250, "A gap-drop fly has no meaningful hang-time separation from a bloop.");
  assert(flights.caught.flightMs >= flights.gap.flightMs + 150, "A caught fly has no meaningful hang-time separation from a gap drop.");
  assert(flights.line.arc <= 0.3, `Line-drive arc ${flights.line.arc} is too high.`);
  assert(flights.bloop.arc >= flights.line.arc + 0.2, "A bloop arc is indistinguishable from a line drive.");
  assert(flights.gap.arc >= flights.bloop.arc + 0.15, "A gap-drop arc is indistinguishable from a bloop.");
  assert(flights.caught.arc >= flights.bloop.arc + 0.15, "A caught-fly arc is indistinguishable from a bloop.");
  assert(flights.bloop.maxHeight >= flights.line.maxHeight + 25, "Bloop height is visually indistinguishable from a line drive.");
  assert(flights.gap.maxHeight >= flights.bloop.maxHeight + 15, "Gap-drop height is visually indistinguishable from a bloop.");
  assert(flights.caught.maxHeight >= flights.bloop.maxHeight + 15, "Caught-fly height is visually indistinguishable from a bloop.");
  assert.equal(
    excessivePickupHolds.length,
    0,
    `Extra-base pickup-to-release hold exceeds 450ms: ${excessivePickupHolds.join(", ")}`
  );
}

function allCues(timeline) {
  return Object.values(timeline.tracks).flat();
}

function pointDistance(a, b) {
  return Math.hypot(Number(a?.x ?? 0) - Number(b?.x ?? 0), Number(a?.y ?? 0) - Number(b?.y ?? 0));
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
