import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createInitialState } from "../src/data.js";
import { groundBallFieldingAssignment, simulateDay, simulateNextUserGame } from "../src/engine.js";
import { compilePlayTimeline } from "../src/gamecast2/timeline.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const GOCHEOK_ANCHORS = JSON.parse(fs.readFileSync(
  path.join(ROOT_DIR, "assets", "gamecast2", "field-gocheok-dome.anchors.json"),
  "utf8"
));

const GAME_COUNT = 10;
const MINIMUM_EVENT_COUNT = 600;
const SAFE_WALL_MARGIN_PX = 4;
const HOME_RUN_WALL_CLEARANCE_PX = 8;
const DEFENSE_POSITIONS = new Set(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const INFIELD_POSITIONS = new Set(["P", "C", "1B", "2B", "3B", "SS"]);
const OUTFIELD_POSITIONS = new Set(["LF", "CF", "RF"]);
const GROUND_ZONE_PRIMARY = Object.freeze({
  "third-line": "3B",
  "third-corner": "3B",
  "third-hole": "SS",
  "shortstop-middle": "SS",
  "second-middle": "2B",
  "first-hole": "2B",
  "first-corner": "1B",
  "first-line": "1B"
});
// Keep aligned with the endpoint guard in src/gamecast2/scene.js and the
// authored-timeline matrix in tools/verify_gamecast_timeline.mjs.
const DEFENDER_MOVE_ZONES = Object.freeze({
  P: { x: 300, yTop: 110, yBottom: 220 },
  C: { x: 30, yTop: 42, yBottom: 12 },
  "1B": { x: 54, yTop: 42, yBottom: 45 },
  "2B": { x: 132, yTop: 80, yBottom: 80 },
  "3B": { x: 54, yTop: 42, yBottom: 45 },
  SS: { x: 184, yTop: 80, yBottom: 80 },
  // A gap hit can legitimately pull an outfielder much farther laterally than
  // a routine catch. These limits still reject a corner outfielder crossing
  // most of the field because the engine selected the wrong spray-side actor.
  LF: { x: 240, yTop: 90, yBottom: 180 },
  CF: { x: 190, yTop: 90, yBottom: 120 },
  RF: { x: 240, yTop: 90, yBottom: 180 }
});

export function verifyGamecastTenGames() {
  verifyGroundBallAssignmentFunction();
  const state = createInitialState();
  state.selectedTeamId = "kiwoom";
  advanceToRegularSeason(state);

  const games = [];
  for (let index = 0; index < GAME_COUNT; index += 1) {
    const result = simulateNextUserGame(state, {
      teamId: state.selectedTeamId,
      mode: "watch"
    });
    assert(result.ok && result.game, `Game ${index + 1}/${GAME_COUNT} did not simulate: ${result.message ?? result.code}`);
    games.push(result.game);
  }

  const coverage = {
    games: games.length,
    events: 0,
    plateAppearances: 0,
    steals: 0,
    fly: 0,
    line: 0,
    ground: 0,
    bunt: 0,
    doublePlay: 0,
    safeAir: 0,
    safeFlyDives: 0,
    safeFlyRunThroughs: 0,
    safeLineDives: 0,
    safeLineShortHops: 0,
    safeHits: 0,
    safeHitMisses: 0,
    safeHitGates: 0,
    safeHitReactionChecks: 0,
    groundThrough: 0,
    infieldChoppers: 0,
    lineThroughSingles: 0,
    safeWallEvents: 0,
    safeWallPoints: 0,
    homeRunWallExits: 0,
    minimumSafeWallMarginPx: Number.POSITIVE_INFINITY,
    minimumHomeRunWallClearancePx: Number.POSITIVE_INFINITY,
    baseBackups: 0,
    behindBaseBackups: 0,
    groundZones: Object.fromEntries(Object.keys(GROUND_ZONE_PRIMARY).map((zone) => [zone, 0])),
    fallback: 0,
    positionViolations: 0,
    maximumConcurrentDefenders: 0
  };
  const problems = [];

  for (const game of games) {
    const events = Array.isArray(game.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
    verifyMergedEventOrder(game, events, problems);
    auditDefenseMap(game, problems);
    for (const event of events) {
      coverage.events += 1;
      if (event.type === "plateAppearance") coverage.plateAppearances += 1;
      if (event.type === "stolenBase") coverage.steals += 1;

      const label = `${game.id}/${event.id ?? `${event.half}:${event.inning}:${event.sequence}`}`;
      auditDefenseSlot(label, game, event, problems);
      auditHitTrajectorySemantics(label, event, coverage, problems);
      let timeline;
      try {
        timeline = compilePlayTimeline(event, GOCHEOK_ANCHORS);
      } catch (error) {
        problems.push(`${label}: timeline compile failed (${error.message})`);
        continue;
      }

      auditOutfieldWallSemantics(label, event, timeline, coverage, problems);
      auditTimeline(label, event, timeline, coverage, problems);
    }
  }

  assert.equal(games.length, GAME_COUNT, `Expected ${GAME_COUNT} games, received ${games.length}.`);
  assert(coverage.events >= MINIMUM_EVENT_COUNT, `Only ${coverage.events} Gamecast events were audited.`);
  assert(coverage.plateAppearances >= MINIMUM_EVENT_COUNT, `Only ${coverage.plateAppearances} plate appearances were audited.`);
  assert.equal(coverage.fallback, 0, `${coverage.fallback} event(s) fell through the timeline semantic map.`);
  for (const key of ["fly", "line", "ground", "bunt", "doublePlay", "safeAir"]) {
    assert(coverage[key] > 0, `10-game audit did not cover ${key}.`);
  }
  for (const key of ["safeFlyDives", "safeFlyRunThroughs", "safeLineDives", "safeLineShortHops"]) {
    assert(coverage[key] > 0, `10-game audit did not cover ${key}.`);
  }
  for (const key of ["safeHits", "safeHitMisses", "safeHitGates", "safeHitReactionChecks", "groundThrough", "infieldChoppers", "lineThroughSingles"]) {
    assert(coverage[key] > 0, `10-game audit did not cover ${key}.`);
  }
  for (const key of ["safeWallEvents", "safeWallPoints", "homeRunWallExits"]) {
    assert(coverage[key] > 0, `10-game audit did not cover ${key}.`);
  }
  assert(coverage.baseBackups > 0, "10-game audit did not exercise a base-backup route.");
  assert(coverage.behindBaseBackups > 0, "10-game audit did not exercise a behind-base backup route.");
  for (const [zone, count] of Object.entries(coverage.groundZones)) {
    assert(count > 0, `10-game audit did not cover ground-ball zone ${zone}.`);
  }
  assert.deepEqual(
    problems,
    [],
    `10-game Gamecast audit found ${problems.length} issue(s), coverage=${JSON.stringify(coverage)}:\n${problems.slice(0, 30).join("\n")}`
  );
  assert.equal(coverage.positionViolations, 0, `${coverage.positionViolations} defender endpoint(s) exceed the scene bounds.`);

  return coverage;
}

function advanceToRegularSeason(state) {
  for (let guard = 0; state.phase === "preseason" && guard < 40; guard += 1) {
    simulateDay(state);
  }
  assert.equal(state.phase, "regular", `Could not reach the regular season (phase=${state.phase}).`);
  assert.equal(state.gamesPlayed, 0, `Preseason advancement unexpectedly played ${state.gamesPlayed} games.`);
}

function verifyGroundBallAssignmentFunction() {
  const covered = new Set();
  for (let index = 0; index < 1024; index += 1) {
    const assignment = groundBallFieldingAssignment({
      seed: `ground-zone-seed-${index % 31}`,
      plateAppearance: index,
      hitter: { id: `ground-zone-hitter-${index}`, bats: index % 3 === 0 ? "L" : index % 3 === 1 ? "R" : "S" }
    });
    covered.add(assignment.zone);
    assert.equal(
      assignment.position,
      GROUND_ZONE_PRIMARY[assignment.zone],
      `${assignment.zone}/${assignment.lane}: engine assigned the wrong primary ${assignment.position}.`
    );
    if (Math.abs(Number(assignment.lane)) >= 0.58) {
      assert(
        ["1B", "3B"].includes(assignment.position),
        `${assignment.zone}/${assignment.lane}: corner lane assigned to ${assignment.position}.`
      );
    }
  }
  assert.deepEqual(covered, new Set(Object.keys(GROUND_ZONE_PRIMARY)), "Ground-ball assignment helper did not exercise every responsibility zone.");
}

function auditDefenseMap(game, problems) {
  for (const [teamId, defense] of Object.entries(game.gamecast?.defenseByTeamId ?? {})) {
    const ids = Object.values(defense ?? {}).map(String).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      problems.push(`${game.id}/${teamId}: Gamecast defense map reuses a player in multiple positions.`);
    }
  }
}

function auditDefenseSlot(label, game, event, problems) {
  const position = normalizePosition(event.fieldingPosition);
  const defenderId = String(event.defenderId ?? "");
  const mappedId = String(game.gamecast?.defenseByTeamId?.[event.defenseTeamId]?.[position] ?? "");
  if (defenderId && mappedId && defenderId !== mappedId) {
    problems.push(`${label}: raw ${position} defender ${defenderId} disagrees with Gamecast slot ${mappedId}.`);
  }
}

function auditHitTrajectorySemantics(label, event, coverage, problems) {
  if (event.type !== "plateAppearance") return;
  const outcome = canonicalOutcome(event);
  if (!["single", "double", "triple"].includes(outcome)) return;

  const type = normalizedToken(event.battedBallType);
  if (!type) return;
  const finalFielder = normalizePosition(event.fieldingPosition);
  const attemptedFielder = normalizePosition(event.attemptedFieldingPosition);
  const trajectory = normalizedToken(event.hitTrajectory);
  const sprayLane = Number(event.sprayLane);

  if (!Number.isFinite(sprayLane) || sprayLane < -1 || sprayLane > 1) {
    problems.push(`${label}: safe hit has invalid sprayLane ${String(event.sprayLane)}.`);
  }

  if (outcome === "single" && type.includes("line")) {
    if (!OUTFIELD_POSITIONS.has(finalFielder)) {
      problems.push(`${label}: safe line single is finally fielded by infielder ${finalFielder || "(missing)"}.`);
    }
    if (trajectory === "linethrough") {
      coverage.lineThroughSingles += 1;
      if (!INFIELD_POSITIONS.has(attemptedFielder) || attemptedFielder === "C") {
        problems.push(`${label}: line-through single has no valid attempted infielder (${attemptedFielder || "missing"}).`);
      }
    } else if (attemptedFielder) {
      problems.push(`${label}: line single records attempted ${attemptedFielder} but trajectory is ${event.hitTrajectory || "missing"}.`);
    }
  }

  if (outcome === "single" && type.includes("ground")) {
    if (trajectory === "groundthrough") {
      coverage.groundThrough += 1;
      if (!OUTFIELD_POSITIONS.has(finalFielder)) {
        problems.push(`${label}: ground-through single is finally fielded by ${finalFielder || "missing"}, expected an outfielder.`);
      }
      if (!INFIELD_POSITIONS.has(attemptedFielder) || attemptedFielder === "C") {
        problems.push(`${label}: ground-through single has no valid attempted infielder (${attemptedFielder || "missing"}).`);
      }
    } else if (trajectory === "infieldchopper") {
      coverage.infieldChoppers += 1;
      if (!INFIELD_POSITIONS.has(finalFielder) || finalFielder === "C") {
        problems.push(`${label}: infield-chopper single is finally fielded by ${finalFielder || "missing"}.`);
      }
      if (attemptedFielder) {
        problems.push(`${label}: infield chopper incorrectly separates attempted ${attemptedFielder} from final ${finalFielder}.`);
      }
    } else {
      problems.push(`${label}: ground single has unsupported hitTrajectory ${event.hitTrajectory || "missing"}.`);
    }
  }
}

function auditOutfieldWallSemantics(label, event, timeline, coverage, problems) {
  if (event.type !== "plateAppearance") return;
  const outcome = canonicalOutcome(event);
  const home = timeline.points?.home ?? GOCHEOK_ANCHORS.anchors?.home;

  if (outcome === "homeRun") {
    coverage.homeRunWallExits += 1;
    const exit = timeline.points?.homeRunExit;
    const boundary = wallBoundaryAlongRay(home, exit);
    const outsideBy = boundary ? boundary.distance - pointDistance(home, exit) : Number.NaN;
    if (Number.isFinite(outsideBy)) {
      coverage.minimumHomeRunWallClearancePx = Math.min(
        coverage.minimumHomeRunWallClearancePx,
        -outsideBy
      );
    }
    if (!boundary || !Number.isFinite(outsideBy) || outsideBy > -HOME_RUN_WALL_CLEARANCE_PX) {
      problems.push(`${label}: home-run exit clears its spray-lane wall by only ${Number.isFinite(outsideBy) ? (-outsideBy).toFixed(2) : "NaN"}px (minimum ${HOME_RUN_WALL_CLEARANCE_PX}px).`);
    }
    const flight = timeline.tracks.ball.find((cue) => cue.phase === "home-run-flight");
    if (flight?.clearsWall !== true || flight.path?.at(-1) !== "homeRunExit") {
      problems.push(`${label}: home-run flight does not terminate at the authored wall-clearing exit.`);
    }
    return;
  }

  if (!["single", "double", "triple"].includes(outcome)) return;
  coverage.safeWallEvents += 1;
  const landing = timeline.points?.landing;
  const pickup = timeline.points?.pickup;
  const actualFielder = normalizePosition(timeline.meta?.fielding?.fielder ?? event.fieldingPosition);
  const points = [["landing", landing]];
  if (pickup) points.push(["pickup", pickup]);
  if (OUTFIELD_POSITIONS.has(actualFielder) && !pickup) {
    problems.push(`${label}: outfield safe hit has no pickup point to keep inside the wall.`);
  }

  for (const [name, point] of points) {
    coverage.safeWallPoints += 1;
    const boundary = wallBoundaryAlongRay(home, point);
    const margin = boundary ? boundary.distance - pointDistance(home, point) : Number.NaN;
    if (Number.isFinite(margin)) {
      coverage.minimumSafeWallMarginPx = Math.min(coverage.minimumSafeWallMarginPx, margin);
    }
    if (!boundary || !Number.isFinite(margin) || margin < SAFE_WALL_MARGIN_PX) {
      problems.push(`${label}: safe-hit ${name} has only ${Number.isFinite(margin) ? margin.toFixed(2) : "NaN"}px inside its spray-lane wall (minimum ${SAFE_WALL_MARGIN_PX}px).`);
      continue;
    }
    auditSprayLaneBand(label, event, name, home, boundary, problems);
  }

  if (landing && pickup) {
    const sameLaneDot = normalizedDot(pointVector(home, landing), pointVector(home, pickup));
    if (!Number.isFinite(sameLaneDot) || sameLaneDot < 0.997) {
      problems.push(`${label}: landing and pickup diverge across spray lanes (direction dot ${Number.isFinite(sameLaneDot) ? sameLaneDot.toFixed(4) : "NaN"}).`);
    }
  }
}

function auditSprayLaneBand(label, event, pointName, home, boundary, problems) {
  const lane = Number(event.sprayLane);
  if (!Number.isFinite(lane)) return;
  const center = GOCHEOK_ANCHORS.anchors?.CF;
  const pole = lane < 0
    ? GOCHEOK_ANCHORS.anchors?.leftPole
    : GOCHEOK_ANCHORS.anchors?.rightPole;
  if (!center || !pole) return;

  const lateral = Number(boundary.point.x) - Number(center.x);
  if (Math.abs(lane) >= 0.08 && lateral * lane <= 0) {
    problems.push(`${label}: ${pointName} reaches the opposite wall side for sprayLane ${lane}.`);
    return;
  }
  const fullSideWidth = Math.max(0.001, Math.abs(Number(pole.x) - Number(center.x)));
  const wallBand = Math.abs(lateral) / fullSideWidth;
  if (Math.abs(lane) <= 0.2 && wallBand > 0.32) {
    problems.push(`${label}: ${pointName} leaves the center-field band for sprayLane ${lane} (wall band ${wallBand.toFixed(3)}).`);
  }
  if (Math.abs(lane) >= 0.6 && wallBand < 0.25) {
    problems.push(`${label}: ${pointName} collapses into center field for pull sprayLane ${lane} (wall band ${wallBand.toFixed(3)}).`);
  }
}

function auditTimeline(label, event, timeline, coverage, problems) {
  const type = normalizedToken(event.battedBallType);
  const canonical = canonicalOutcome(event);
  const expectedTemplate = expectedTimelineTemplate(event, canonical);
  const isFly = type.includes("fly");
  const isLine = type.includes("line");
  const isGround = type.includes("ground");
  const isAir = isFly || isLine;
  const safeAir = isAir && ["single", "double", "triple", "error"].includes(canonical);
  const isBunt = canonical === "sacrificeBunt" || type.includes("bunt");

  if (isFly) coverage.fly += 1;
  if (isLine) coverage.line += 1;
  if (isGround) coverage.ground += 1;
  if (isBunt) coverage.bunt += 1;
  if (timeline.template === "doublePlay") coverage.doublePlay += 1;
  if (safeAir) coverage.safeAir += 1;

  if (!expectedTemplate) {
    coverage.fallback += 1;
  } else if (timeline.template !== expectedTemplate) {
    problems.push(`${label}: template ${timeline.template}, expected ${expectedTemplate}.`);
  }
  if (timeline.outcome !== canonical) {
    problems.push(`${label}: timeline outcome ${timeline.outcome}, event outcome ${canonical}.`);
  }
  const resultCue = timeline.tracks?.result?.find((cue) => cue.commit === true);
  if (resultCue?.outcome !== canonical) {
    problems.push(`${label}: committed outcome ${resultCue?.outcome}, expected ${canonical}.`);
  }

  for (const [key, value] of Object.entries(timeline.meta?.invariants ?? {})) {
    if (value !== true) problems.push(`${label}: invariant ${key}=${String(value)}.`);
  }
  if (Object.keys(timeline.meta?.invariants ?? {}).length === 0) {
    problems.push(`${label}: timeline exposes no invariants.`);
  }

  const batted = timeline.tracks?.ball?.find((cue) => cue.phase === "batted");
  const safeTrajectory = String(timeline.meta?.fielding?.resolution ?? "").startsWith("safe-");
  if (isAir && canonical === "out") auditCaughtAirBall(label, timeline, batted, problems);
  if (safeTrajectory) auditSafeHitTrajectory(label, event, timeline, batted, coverage, problems);
  if (isFly && safeAir) auditSafeFlyBall(label, timeline, batted, coverage, problems);
  if (isLine && safeAir) auditSafeLineDrive(label, timeline, batted, coverage, problems);
  if (isGround && batted) auditGroundBall(label, batted, problems);
  if (isGround) auditGroundBallResponsibility(label, event, timeline, coverage, problems);
  if (isBunt) auditSacrificeBunt(label, event, timeline, batted, problems);

  auditThrowTarget(label, event, timeline, problems);
  auditReceiverArrivals(label, timeline, problems);
  auditDefensiveSupport(label, timeline, coverage, problems);
  auditTagUpOrdering(label, event, timeline, batted, problems);
  if (event.type === "stolenBase") auditStealOrdering(label, event, timeline, problems);

  const concurrent = maximumConcurrentMovingDefenders(timeline);
  coverage.maximumConcurrentDefenders = Math.max(coverage.maximumConcurrentDefenders, concurrent);
  if (concurrent > 4) problems.push(`${label}: ${concurrent} defenders move concurrently.`);

  coverage.positionViolations += countPositionViolations(label, timeline, problems);
}

function auditSacrificeBunt(label, event, timeline, batted, problems) {
  const position = normalizePosition(event.fieldingPosition);
  if (!["1B", "3B", "C"].includes(position)) {
    problems.push(`${label}: sacrifice bunt is fielded by unrealistic position ${position}.`);
  }
  if (!timeline.tracks.batter.some((cue) => cue.phase === "bunt-contact")) {
    problems.push(`${label}: sacrifice bunt uses a full swing instead of the short bunt cue.`);
  }
  if (!batted || Number(batted.arc) > 0.02 || batted.flightProfile === "hang") {
    problems.push(`${label}: sacrifice bunt trajectory is not low (${batted?.arc}/${batted?.flightProfile}).`);
  }
  const landing = timeline.points?.landing;
  const home = timeline.points?.home;
  const fielder = timeline.points?.[position];
  if (!(pointDistance(landing, home) < pointDistance(fielder, home))) {
    problems.push(`${label}: sacrifice bunt does not die in front of the plate.`);
  }
}

function auditCaughtAirBall(label, timeline, batted, problems) {
  if (!batted) {
    problems.push(`${label}: caught air out has no batted-ball flight.`);
    return;
  }
  if (batted.caughtDirectly !== true) problems.push(`${label}: air out is not marked caughtDirectly.`);
  if (batted.path?.at(-1) !== "catchGlove") problems.push(`${label}: air out does not terminate at catchGlove.`);
  if (timeline.tracks.ball.some((cue) => cue.bounce === true || String(cue.phase).includes("bounce"))) {
    problems.push(`${label}: caught air out contains a bounce.`);
  }
}

function auditSafeHitTrajectory(label, event, timeline, batted, coverage, problems) {
  coverage.safeHits += 1;
  const fielding = timeline.meta?.fielding ?? {};
  const primary = fielding.fielder;
  const landing = timeline.points?.landing;
  const miss = timeline.points?.miss;
  const pickup = timeline.points?.pickup;
  const home = timeline.points?.home;
  const landingT = Number(fielding.ballLandingT ?? batted?.endT);
  const separation = pointDistance(miss, landing);
  const reportedSeparation = Number(fielding.landingSeparationPx);

  if (!batted) {
    problems.push(`${label}: safe hit has no batted-ball cue.`);
    return;
  }
  if (!landing || !miss || !pickup) {
    problems.push(`${label}: safe hit lacks landing/miss/pickup geometry.`);
    return;
  }
  if (!Number.isFinite(separation) || separation < 41.5) {
    problems.push(`${label}: fielder is only ${Number.isFinite(separation) ? separation.toFixed(2) : "NaN"}px from the safe-hit landing (minimum 41.5px).`);
  } else {
    coverage.safeHitMisses += 1;
  }
  if (!Number.isFinite(reportedSeparation) || Math.abs(reportedSeparation - separation) > 0.51) {
    problems.push(`${label}: reported landing separation ${String(fielding.landingSeparationPx)} disagrees with geometry ${separation.toFixed(2)}.`);
  }

  const arrival = timeline.tracks.fielders.find((cue) => (
    cue.who === primary
    && cue.path?.at(-1) === "miss"
    && Math.abs(Number(cue.endT) - landingT) <= 0.001001
  ));
  if (!arrival) {
    problems.push(`${label}: ${primary} does not finish at the miss point when the ball lands.`);
  }
  const recovery = timeline.tracks.fielders.find((cue) => (
    cue.who === primary
    && cue.phase === "recover"
    && cue.path?.[0] === "miss"
    && cue.path?.at(-1) === "pickup"
  ));
  if (!recovery || Number(recovery.t) + 0.001001 < landingT || Number(recovery.endT) <= landingT) {
    problems.push(`${label}: ${primary} does not recover miss-to-pickup after landing.`);
  }
  const settle = timeline.tracks.ball.find((cue) => (
    cue.grounded === true
    && cue.path?.[0] === "landing"
    && cue.path?.at(-1) === "pickup"
  ));
  if (!settle || Math.abs(Number(settle.t) - landingT) > 0.001001 || Number(settle.endT) <= landingT) {
    problems.push(`${label}: safe-hit ball does not continue landing-to-pickup after touching down.`);
  }

  const incoming = pointVector(home, landing);
  const outgoing = pointVector(landing, pickup);
  const outwardDot = normalizedDot(incoming, outgoing);
  if (!Number.isFinite(outwardDot) || outwardDot <= 0) {
    problems.push(`${label}: post-landing ball reverses toward home (direction dot ${Number.isFinite(outwardDot) ? outwardDot.toFixed(3) : "NaN"}).`);
  }

  const firstReaction = timeline.tracks.fielders
    .filter((cue) => cue.who === primary && Array.isArray(cue.path) && cue.path.length > 1)
    .sort((left, right) => Number(left.t) - Number(right.t))[0];
  const reactionMs = (Number(firstReaction?.t) - Number(batted.t)) * Number(timeline.durationMs);
  if (!Number.isFinite(reactionMs) || reactionMs < 119.5) {
    problems.push(`${label}: ${primary} reacts in ${Number.isFinite(reactionMs) ? reactionMs.toFixed(1) : "NaN"}ms (minimum 120ms).`);
  } else {
    coverage.safeHitReactionChecks += 1;
  }

  const trajectory = normalizedToken(event.hitTrajectory);
  const type = normalizedToken(event.battedBallType);
  const needsGate = trajectory === "groundthrough" || type.includes("line") || type.includes("fly");
  if (needsGate) {
    const gateIndex = batted.path?.indexOf("infieldGate") ?? -1;
    const landingIndex = batted.path?.indexOf("landing") ?? -1;
    const gate = timeline.points?.infieldGate;
    if (gateIndex <= 0 || landingIndex <= gateIndex || !isFinitePoint(gate)) {
      problems.push(`${label}: through/drop trajectory lacks a finite home-to-gate-to-landing path.`);
    } else {
      coverage.safeHitGates += 1;
    }
  }
}

function auditSafeFlyBall(label, timeline, batted, coverage, problems) {
  const primary = timeline.meta?.fielding?.fielder;
  const style = timeline.meta?.fielding?.fieldingStyle;
  const settle = timeline.tracks.ball.find((cue) => cue.grounded === true && cue.path?.[0] === "landing");
  if (batted?.flightProfile !== "hang") problems.push(`${label}: safe fly has no hang flight profile.`);
  if (batted?.path?.at(-1) !== "landing") problems.push(`${label}: safe fly does not land before fielding.`);
  if (!settle || settle.path?.at(-1) !== "pickup") problems.push(`${label}: safe fly has no grounded landing-to-pickup settle.`);
  if (timeline.tracks.ball.some((cue) => cue.bounce === true || String(cue.phase).includes("bounce"))) {
    problems.push(`${label}: safe fly still contains a bounce.`);
  }
  assertShortGroundedSettle(label, timeline, settle, problems);
  const primaryDives = timeline.tracks.fielders.filter((cue) => cue.who === primary && cue.anim === "dive");
  const approach = timeline.tracks.fielders.find((cue) => cue.who === primary && cue.phase === "approach");
  if (style === "dive") {
    coverage.safeFlyDives += 1;
    if (!primaryDives.some((cue) => cue.phase === "miss")) problems.push(`${label}: challenging safe fly has no dive miss.`);
    if (!timeline.tracks.fielders.some((cue) => cue.who === primary && cue.phase === "recover")) {
      problems.push(`${label}: diving safe-fly fielder never recovers to the ball.`);
    }
  } else if (style === "run-through") {
    coverage.safeFlyRunThroughs += 1;
    if (primaryDives.length > 0) problems.push(`${label}: routine safe fly forces a dive.`);
    if (approach?.path?.at(-1) !== "miss") problems.push(`${label}: routine safe fly does not stop outside catch range at landing.`);
    const recovery = timeline.tracks.fielders.find((cue) => cue.who === primary && cue.phase === "recover");
    if (recovery?.path?.[0] !== "miss" || recovery?.path?.at(-1) !== "pickup") {
      problems.push(`${label}: routine safe fly does not recover from miss to pickup.`);
    }
  } else {
    problems.push(`${label}: safe fly has unknown fielding style ${String(style)}.`);
  }
  const pickup = timeline.tracks.fielders.find((cue) => cue.who === primary && cue.phase === "pickup");
  if (!pickup || Number(pickup.t) <= Number(batted?.endT)) {
    problems.push(`${label}: safe-fly pickup occurs before the ball lands.`);
  }
}

function auditSafeLineDrive(label, timeline, batted, coverage, problems) {
  const primary = timeline.meta?.fielding?.fielder;
  const style = timeline.meta?.fielding?.fieldingStyle;
  const settle = timeline.tracks.ball.find((cue) => cue.grounded === true && cue.path?.[0] === "landing");
  const trap = timeline.tracks.fielders.find((cue) => cue.who === primary && cue.phase === "trap");
  const shortHop = timeline.tracks.fielders.find((cue) => cue.who === primary && cue.phase === "short-hop");
  if (batted?.path?.at(-1) !== "landing") problems.push(`${label}: safe line drive does not hit the turf first.`);
  if (!settle || settle.path?.at(-1) !== "pickup") problems.push(`${label}: safe line drive has no grounded trap route.`);
  if (style === "dive") {
    coverage.safeLineDives += 1;
    const diveRecovery = timeline.tracks.fielders.find((cue) => cue.who === primary && cue.phase === "recover");
    if (diveRecovery?.anim !== "dive" || !trap || trap.anim !== "catch") {
      problems.push(`${label}: challenging safe line drive does not dive past the landing and then trap the ball.`);
    }
  } else if (style === "short-hop") {
    coverage.safeLineShortHops += 1;
    if (!shortHop || shortHop.anim !== "catch") problems.push(`${label}: routine safe line drive has no short-hop fielding cue.`);
    if (timeline.tracks.fielders.some((cue) => cue.who === primary && cue.anim === "dive")) {
      problems.push(`${label}: routine safe line drive forces a dive.`);
    }
  } else {
    problems.push(`${label}: safe line drive has unknown fielding style ${String(style)}.`);
  }
  const fieldingCue = trap ?? shortHop;
  if (!fieldingCue || Number(fieldingCue.t) <= Number(batted?.endT)) {
    problems.push(`${label}: safe line-drive fielding begins before the ball lands.`);
  }
  assertShortGroundedSettle(label, timeline, settle, problems);
}

function auditDefensiveSupport(label, timeline, coverage, problems) {
  const supportRoles = new Set(["relay", "base-cover", "backup"]);
  const baseTargets = new Set(["home", "first", "second", "third"]);
  for (const cue of timeline.tracks.fielders.filter((entry) => supportRoles.has(entry.assignment))) {
    const start = timeline.points?.[cue.path?.[0]];
    const destination = timeline.points?.[cue.arrivesAt ?? cue.path?.at(-1)];
    const routeDistance = pointDistance(start, destination);
    if (!Number.isFinite(routeDistance) || routeDistance < 13.9) {
      problems.push(`${label}: ${cue.who} ${cue.assignment} route moves only ${routeDistance.toFixed(2)}px.`);
    }
    const baseBackup = cue.assignment === "backup" && baseTargets.has(cue.supportTarget);
    if (["backup", "relay"].includes(cue.assignment) && !baseBackup && routeDistance < 17.9) {
      problems.push(`${label}: ${cue.who} ${cue.assignment} route is not visibly meaningful (${routeDistance.toFixed(2)}px).`);
    }
    if (!baseBackup) continue;

    coverage.baseBackups += 1;
    const target = timeline.points?.[cue.supportTarget];
    const targetDistance = pointDistance(destination, target);
    if (!Number.isFinite(targetDistance) || targetDistance > 42.01) {
      problems.push(`${label}: ${cue.who} backs up ${cue.supportTarget} from ${targetDistance.toFixed(2)}px away.`);
    }
    const incoming = timeline.points?.[cue.toward];
    const incomingVector = {
      x: Number(target?.x) - Number(incoming?.x),
      y: Number(target?.y) - Number(incoming?.y)
    };
    const backupVector = {
      x: Number(destination?.x) - Number(target?.x),
      y: Number(destination?.y) - Number(target?.y)
    };
    if (targetDistance <= 14.1 && incomingVector.x * backupVector.x + incomingVector.y * backupVector.y > 0) {
      coverage.behindBaseBackups += 1;
    }
  }
}

function assertShortGroundedSettle(label, timeline, settle, problems) {
  if (!settle) return;
  const start = timeline.points?.[settle.path?.[0]];
  const end = timeline.points?.[settle.path?.at(-1)];
  const distance = pointDistance(start, end);
  if (!Number.isFinite(distance) || distance > 42.000001) {
    problems.push(`${label}: grounded settle travels ${Number.isFinite(distance) ? distance.toFixed(2) : "NaN"}px (limit 42px).`);
  }
}

function auditGroundBall(label, batted, problems) {
  if (Number(batted.arc) > 0.08) problems.push(`${label}: ground-ball arc ${batted.arc} is too high.`);
  if (batted.flightProfile === "hang") problems.push(`${label}: ground ball uses the hang flight profile.`);
}

function auditGroundBallResponsibility(label, event, timeline, coverage, problems) {
  const zone = String(event.fieldingZone ?? "").trim().toLowerCase();
  const expected = GROUND_ZONE_PRIMARY[zone];
  const actual = normalizePosition(event.fieldingPosition);
  const attempted = normalizePosition(event.attemptedFieldingPosition);
  const trajectory = normalizedToken(event.hitTrajectory);
  const groundThrough = canonicalOutcome(event) === "single" && trajectory === "groundthrough";
  const responsibilityFielder = groundThrough ? attempted : actual;
  if (!expected) {
    problems.push(`${label}: ground ball has no valid fielding zone (${String(event.fieldingZone)}).`);
    return;
  }
  coverage.groundZones[zone] += 1;
  if (responsibilityFielder !== expected) {
    problems.push(`${label}: ${zone} belongs to ${expected}, event records ${responsibilityFielder || "missing"} as the responsible infielder.`);
  }
  if (timeline.meta?.fielding?.fielder !== actual) {
    problems.push(`${label}: timeline primary ${timeline.meta?.fielding?.fielder}, expected final fielder ${actual}.`);
  }
  if (groundThrough && timeline.meta?.fielding?.attemptedFielder !== expected) {
    problems.push(`${label}: timeline loses attempted ${expected} on a ground-through hit.`);
  }
  const lane = Number(event.fieldingLane);
  if (!Number.isFinite(lane) || lane < -1 || lane > 1) {
    problems.push(`${label}: invalid ground-ball lane ${String(event.fieldingLane)}.`);
  } else if (Math.abs(lane) >= 0.58 && !["1B", "3B"].includes(responsibilityFielder)) {
    problems.push(`${label}: corner lane ${lane} assigned to ${responsibilityFielder}.`);
  }
  if (!groundThrough) {
    const landing = timeline.points?.landing;
    const origin = timeline.points?.[expected];
    const routeDistance = pointDistance(landing, origin);
    if (!Number.isFinite(routeDistance) || routeDistance > 54.01) {
      problems.push(`${label}: ${expected} leaves its responsibility zone by ${routeDistance.toFixed(2)}px.`);
    }
  }

  if (!groundThrough && !event.defensiveThrowTarget) {
    const middleChaser = timeline.tracks.fielders.find((cue) => (
      ["SS", "2B"].includes(cue.who)
      && cue.who !== expected
      && cue.path?.at(-1) === "landing"
    ));
    if (middleChaser) problems.push(`${label}: non-primary ${middleChaser.who} chases a no-throw ground ball.`);
  }

  if (canonicalOutcome(event) === "single" && trajectory === "infieldchopper" && actual === "1B") {
    if (event.defensiveThrowTarget !== "first") {
      problems.push(`${label}: 1B ground-ball single throws to ${String(event.defensiveThrowTarget)} instead of first.`);
    }
    if (timeline.meta?.fielding?.throwOrdering !== "runner-safe-first") {
      problems.push(`${label}: 1B ground-ball single does not preserve batter-safe ordering (${String(timeline.meta?.fielding?.throwOrdering)}).`);
    }
  }

  for (const cue of timeline.tracks.fielders.filter((entry) => entry.assignment === "backup")) {
    if (["SS", "2B"].includes(cue.who)) {
      problems.push(`${label}: middle infielder ${cue.who} is used as a generic base backup.`);
    }
    if (cue.supportTarget === "first" && cue.who !== "RF") {
      problems.push(`${label}: first-base backup is ${cue.who}, expected RF.`);
    }
    if (cue.supportTarget === "third" && cue.who !== "LF") {
      problems.push(`${label}: third-base backup is ${cue.who}, expected LF.`);
    }
    if (["first", "third"].includes(cue.supportTarget) && cue.who === "P") {
      problems.push(`${label}: pitcher is used as a long-distance ${cue.supportTarget}-base backup.`);
    }
  }
}

function auditThrowTarget(label, event, timeline, problems) {
  const expected = event.defensiveThrowTarget ?? null;
  const actual = timeline.meta?.fielding?.throwTarget ?? null;
  if (actual !== expected) problems.push(`${label}: throw target ${actual}, event target ${expected}.`);
  const competitiveThrow = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  if (expected && competitiveThrow?.path?.at(-1) !== expected) {
    problems.push(`${label}: fielding throw ends at ${competitiveThrow?.path?.at(-1)}, expected ${expected}.`);
  }
  if (!expected && competitiveThrow) problems.push(`${label}: event has no defensive target but timeline creates a fielding throw.`);
}

function auditReceiverArrivals(label, timeline, problems) {
  const throws = timeline.tracks.ball.filter((cue) => ["fielding-throw", "relay-throw", "steal-throw"].includes(cue.phase));
  for (const ball of throws) {
    const target = ball.path?.at(-1);
    const receiverRoutes = timeline.tracks.fielders.filter((cue) => (
      cue.path?.length > 1
      && cue.path.at(-1) === target
      && Number(cue.endT) <= Number(ball.endT) + 0.000001
    ));
    if (receiverRoutes.length === 0) {
      problems.push(`${label}: no receiver reaches ${target} before ${ball.phase} arrives at ${ball.endT}.`);
    }
    for (const receiver of receiverRoutes.filter((cue) => cue.who === "P" && target === "first")) {
      const start = timeline.points?.[receiver.path?.[0]];
      const destination = timeline.points?.[receiver.path?.at(-1)];
      const seconds = (Number(receiver.endT) - Number(receiver.t)) * Number(timeline.durationMs) / 1000;
      const speed = pointDistance(start, destination) / seconds;
      if (!Number.isFinite(speed) || speed > 250.01) {
        problems.push(`${label}: pitcher covers first at ${speed.toFixed(1)}px/s (limit 250).`);
      }
    }
  }
}

function auditTagUpOrdering(label, event, timeline, batted, problems) {
  if (canonicalOutcome(event) !== "out" || !batted?.caughtDirectly) return;
  for (const runner of timeline.tracks.runners.filter((cue) => cue.phase === "runner-advance")) {
    if (Number(runner.t) + 0.000001 < Number(batted.endT)) {
      problems.push(`${label}: tag-up runner ${runner.runnerId} leaves at ${runner.t} before catch ${batted.endT}.`);
    }
  }
}

function auditStealOrdering(label, event, timeline, problems) {
  const success = event.success === true && event.outcome !== "caughtStealing";
  const runnerArrival = Math.max(
    0,
    ...timeline.tracks.runners
      .filter((cue) => cue.phase === "runner-advance" || cue.phase === "tag-play" || cue.phase === "slide")
      .map((cue) => Number(cue.endT ?? cue.t))
  );
  const throwCue = timeline.tracks.ball.find((cue) => cue.phase === "steal-throw");
  const homeTag = timeline.tracks.catcher.find((cue) => String(cue.phase).includes("tag-home"));
  const defensiveArrival = Number(throwCue?.endT ?? homeTag?.endT);
  if (!(runnerArrival > 0) || !Number.isFinite(defensiveArrival)) {
    problems.push(`${label}: steal lacks runner/defensive arrival timing.`);
    return;
  }
  if (success && !(runnerArrival < defensiveArrival)) {
    problems.push(`${label}: successful steal runner ${runnerArrival} does not beat defense ${defensiveArrival}.`);
  }
  if (!success && !(defensiveArrival < runnerArrival)) {
    problems.push(`${label}: caught-stealing defense ${defensiveArrival} does not beat runner ${runnerArrival}.`);
  }
}

function maximumConcurrentMovingDefenders(timeline) {
  const moving = timeline.tracks.fielders.filter((cue) => cue.path?.length > 1);
  const boundaries = [...new Set(moving.flatMap((cue) => [Number(cue.t), Number(cue.endT)]))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  let maximum = 0;
  for (let index = 1; index < boundaries.length; index += 1) {
    const sampleT = (boundaries[index - 1] + boundaries[index]) / 2;
    const actors = new Set(moving
      .filter((cue) => sampleT >= Number(cue.t) && sampleT <= Number(cue.endT))
      .map((cue) => cue.who));
    maximum = Math.max(maximum, actors.size);
  }
  return maximum;
}

function countPositionViolations(label, timeline, problems) {
  let count = 0;
  for (const cue of timeline.tracks.fielders) {
    if (!DEFENSE_POSITIONS.has(cue.who)) {
      count += 1;
      problems.push(`${label}: unknown defender ${cue.who}.`);
      continue;
    }
    const destinationName = cue.at ?? cue.path?.at(-1);
    const destination = timeline.points?.[destinationName];
    const origin = GOCHEOK_ANCHORS.anchors?.[cue.who];
    const zone = DEFENDER_MOVE_ZONES[cue.who];
    if (!destination || !origin || !zone) continue;
    const dx = Number(destination.x) - Number(origin.x);
    const dy = Number(destination.y) - Number(origin.y);
    const within = dx >= -zone.x - 0.000001
      && dx <= zone.x + 0.000001
      && dy >= -zone.yTop - 0.000001
      && dy <= zone.yBottom + 0.000001;
    if (!within) {
      count += 1;
      problems.push(`${label}: ${cue.who} ${cue.phase} endpoint exceeds bounds (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}).`);
    }
  }
  return count;
}

function verifyMergedEventOrder(game, events, problems) {
  let previous = null;
  for (const event of events) {
    const tuple = [
      finiteNumber(event.inning),
      event.side === "home" || event.half === "bottom" ? 1 : 0,
      finiteNumber(event.sequence),
      finiteNumber(event.eventOrder)
    ];
    if (previous && compareTuple(previous.tuple, tuple) > 0) {
      problems.push(`${game.id}: merged event order regressed ${previous.event.id} -> ${event.id}.`);
    }
    previous = { tuple, event };
  }
}

function expectedTimelineTemplate(event, outcome) {
  if (outcome === "strikeout") return "strikeout";
  if (outcome === "walk") return "walk";
  if (outcome === "hitByPitch") return "hitByPitch";
  if (["single", "double", "triple", "homeRun", "error", "steal"].includes(outcome)) return outcome;
  if (outcome === "sacrificeBunt") return "infieldOut";
  if (outcome !== "out") return null;
  if (isValidDoublePlay(event)) return "doublePlay";
  return isOutfieldEvent(event) ? "outfieldOut" : "infieldOut";
}

function canonicalOutcome(event) {
  const token = normalizedToken(event.outcome ?? event.result ?? event.playType ?? event.type);
  return {
    k: "strikeout",
    so: "strikeout",
    strikeout: "strikeout",
    bb: "walk",
    walk: "walk",
    hbp: "hitByPitch",
    hitbypitch: "hitByPitch",
    single: "single",
    double: "double",
    triple: "triple",
    hr: "homeRun",
    homerun: "homeRun",
    error: "error",
    roe: "error",
    out: "out",
    sacrificebunt: "sacrificeBunt",
    steal: "steal",
    stolenbase: "steal",
    caughtstealing: "steal",
    cs: "steal"
  }[token] ?? "unsupported";
}

function isValidDoublePlay(event) {
  return event.doublePlay === true
    && normalizedToken(event.battedBallType).includes("ground")
    && Number(event.outsAfter) - Number(event.outsBefore) >= 2
    && Boolean(event.basesBefore?.[0] || event.baseRunnerIdsBefore?.[0]);
}

function isOutfieldEvent(event) {
  const position = normalizePosition(event.fieldingPosition ?? event.defenderPosition);
  if (OUTFIELD_POSITIONS.has(position)) return true;
  if (INFIELD_POSITIONS.has(position)) return false;
  const type = normalizedToken(event.battedBallType);
  return type.includes("fly") || type.includes("line");
}

function normalizePosition(value) {
  const raw = String(value ?? "").trim().toUpperCase().replaceAll(" ", "");
  return {
    "1": "P",
    "2": "C",
    "3": "1B",
    "4": "2B",
    "5": "3B",
    "6": "SS",
    "7": "LF",
    "8": "CF",
    "9": "RF",
    OF: "CF",
    IF: "SS"
  }[raw] ?? raw;
}

function compareTuple(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = finiteNumber(left[index]) - finiteNumber(right[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

function pointDistance(left, right) {
  if (!left || !right) return Number.NaN;
  return Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y));
}

function wallBoundaryAlongRay(home, point) {
  if (!isFinitePoint(home) || !isFinitePoint(point)) return null;
  const ray = pointVector(home, point);
  const rayLength = Math.hypot(ray.x, ray.y);
  if (rayLength < 0.001) return null;
  const direction = { x: ray.x / rayLength, y: ray.y / rayLength };
  const center = GOCHEOK_ANCHORS.anchors?.CF;
  const left = GOCHEOK_ANCHORS.anchors?.leftPole;
  const right = GOCHEOK_ANCHORS.anchors?.rightPole;
  if (![center, left, right].every(isFinitePoint)) return null;

  const intersections = [
    raySegmentIntersection(home, direction, left, center),
    raySegmentIntersection(home, direction, center, right)
  ].filter(Boolean).sort((a, b) => a.distance - b.distance);
  return intersections[0] ?? null;
}

function raySegmentIntersection(origin, direction, start, end) {
  const segment = pointVector(start, end);
  const offset = pointVector(origin, start);
  const denominator = cross2d(direction, segment);
  if (!segment || !offset || Math.abs(denominator) < 0.000001) return null;
  const distance = cross2d(offset, segment) / denominator;
  const segmentT = cross2d(offset, direction) / denominator;
  if (distance <= 0 || segmentT < -0.000001 || segmentT > 1.000001) return null;
  return {
    distance,
    point: {
      x: Number(origin.x) + direction.x * distance,
      y: Number(origin.y) + direction.y * distance
    }
  };
}

function cross2d(left, right) {
  return Number(left?.x) * Number(right?.y) - Number(left?.y) * Number(right?.x);
}

function pointVector(from, to) {
  if (!isFinitePoint(from) || !isFinitePoint(to)) return null;
  return {
    x: Number(to.x) - Number(from.x),
    y: Number(to.y) - Number(from.y)
  };
}

function normalizedDot(left, right) {
  if (!left || !right) return Number.NaN;
  const leftLength = Math.hypot(left.x, left.y);
  const rightLength = Math.hypot(right.x, right.y);
  if (leftLength < 0.001 || rightLength < 0.001) return Number.NaN;
  return (left.x * right.x + left.y * right.y) / (leftLength * rightLength);
}

function isFinitePoint(point) {
  return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
}

function normalizedToken(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const coverage = verifyGamecastTenGames();
  console.log(
    `Gamecast 10-game audit passed: ${coverage.games} games, ${coverage.events} events `
      + `(${coverage.plateAppearances} PA, ${coverage.steals} steals), `
      + `fly ${coverage.fly}, line ${coverage.line}, ground ${coverage.ground}, `
      + `bunt ${coverage.bunt}, DP ${coverage.doublePlay}, safe-air ${coverage.safeAir}, fallback ${coverage.fallback}, `
      + `safe fielding fly ${coverage.safeFlyDives}/${coverage.safeFlyRunThroughs} dive/run, `
      + `line ${coverage.safeLineDives}/${coverage.safeLineShortHops} dive/short-hop, `
      + `safe trajectory ${coverage.safeHits} hits/${coverage.safeHitMisses} misses/${coverage.safeHitGates} gates/${coverage.safeHitReactionChecks} reactions, `
      + `ground ${coverage.groundThrough}/${coverage.infieldChoppers} through/chopper, line-through ${coverage.lineThroughSingles}, `
      + `wall ${coverage.safeWallEvents} safe events/${coverage.safeWallPoints} points (min ${coverage.minimumSafeWallMarginPx.toFixed(1)}px inside), `
      + `HR ${coverage.homeRunWallExits} exits (min ${coverage.minimumHomeRunWallClearancePx.toFixed(1)}px outside), `
      + `base backups ${coverage.baseBackups} (${coverage.behindBaseBackups} behind), `
      + `position violations ${coverage.positionViolations}, max moving defenders ${coverage.maximumConcurrentDefenders}.`
  );
}
