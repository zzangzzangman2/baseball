import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createInitialState } from "../src/data.js";
import { simulateDay, simulateNextUserGame } from "../src/engine.js";
import { compilePlayTimeline } from "../src/gamecast2/timeline.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const GOCHEOK_ANCHORS = JSON.parse(fs.readFileSync(
  path.join(ROOT_DIR, "assets", "gamecast2", "field-gocheok-dome.anchors.json"),
  "utf8"
));

const GAME_COUNT = 10;
const MINIMUM_EVENT_COUNT = 600;
const DEFENSE_POSITIONS = new Set(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const INFIELD_POSITIONS = new Set(["P", "C", "1B", "2B", "3B", "SS"]);
const OUTFIELD_POSITIONS = new Set(["LF", "CF", "RF"]);
// Keep aligned with the endpoint guard in src/gamecast2/scene.js and the
// authored-timeline matrix in tools/verify_gamecast_timeline.mjs.
const DEFENDER_MOVE_ZONES = Object.freeze({
  P: { x: 300, yTop: 110, yBottom: 220 },
  C: { x: 30, yTop: 42, yBottom: 12 },
  "1B": { x: 54, yTop: 42, yBottom: 45 },
  "2B": { x: 132, yTop: 80, yBottom: 80 },
  "3B": { x: 54, yTop: 42, yBottom: 45 },
  SS: { x: 184, yTop: 80, yBottom: 80 },
  LF: { x: 96, yTop: 58, yBottom: 74 },
  CF: { x: 116, yTop: 62, yBottom: 84 },
  RF: { x: 96, yTop: 58, yBottom: 74 }
});

export function verifyGamecastTenGames() {
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
    baseBackups: 0,
    behindBaseBackups: 0,
    fallback: 0,
    positionViolations: 0,
    maximumConcurrentDefenders: 0
  };
  const problems = [];

  for (const game of games) {
    const events = Array.isArray(game.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
    verifyMergedEventOrder(game, events, problems);
    for (const event of events) {
      coverage.events += 1;
      if (event.type === "plateAppearance") coverage.plateAppearances += 1;
      if (event.type === "stolenBase") coverage.steals += 1;

      const label = `${game.id}/${event.id ?? `${event.half}:${event.inning}:${event.sequence}`}`;
      let timeline;
      try {
        timeline = compilePlayTimeline(event, GOCHEOK_ANCHORS);
      } catch (error) {
        problems.push(`${label}: timeline compile failed (${error.message})`);
        continue;
      }

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
  assert(coverage.baseBackups > 0, "10-game audit did not exercise a base-backup route.");
  assert(coverage.behindBaseBackups > 0, "10-game audit did not exercise a behind-base backup route.");
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
  if (isAir && canonical === "out") auditCaughtAirBall(label, timeline, batted, problems);
  if (isFly && safeAir) auditSafeFlyBall(label, timeline, batted, coverage, problems);
  if (isLine && safeAir) auditSafeLineDrive(label, timeline, batted, coverage, problems);
  if (isGround && batted) auditGroundBall(label, batted, problems);
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
    if (approach?.path?.at(-1) !== "pickup") problems.push(`${label}: routine safe fly does not run through to pickup.`);
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
    if (!trap || trap.anim !== "dive") problems.push(`${label}: challenging safe line drive has no dive trap.`);
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
  if (!Number.isFinite(distance) || distance > 8.000001) {
    problems.push(`${label}: grounded settle travels ${Number.isFinite(distance) ? distance.toFixed(2) : "NaN"}px (limit 8px).`);
  }
}

function auditGroundBall(label, batted, problems) {
  if (Number(batted.arc) > 0.08) problems.push(`${label}: ground-ball arc ${batted.arc} is too high.`);
  if (batted.flightProfile === "hang") problems.push(`${label}: ground ball uses the hang flight profile.`);
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
      + `base backups ${coverage.baseBackups} (${coverage.behindBaseBackups} behind), `
      + `position violations ${coverage.positionViolations}, max moving defenders ${coverage.maximumConcurrentDefenders}.`
  );
}
