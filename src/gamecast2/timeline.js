/**
 * Declarative Gamecast v2 play choreography.
 *
 * Times are normalized to the returned durationMs. A moving cue uses `t` as
 * its start and `endT` as its end. Every `at` and every entry in `path`
 * resolves through `points`, so the scene never needs play-specific geometry.
 */

export const GAMECAST2_ATLAS_ANIMATION_CONTRACT = Object.freeze({
  swing: "swing",
  pitch: "pitch",
  run: "run",
  walk: "walk",
  throw: "throw",
  catch: "catch",
  dive: "dive",
  slide: "slide",
  catcher: "catcher"
});

export const GAMECAST2_ATLAS_ANIMATION_KEYS = Object.freeze(
  Object.values(GAMECAST2_ATLAS_ANIMATION_CONTRACT)
);

export const GAMECAST2_TIMELINE_TEMPLATES = Object.freeze([
  "strikeout",
  "walk",
  "hitByPitch",
  "single",
  "double",
  "triple",
  "homeRun",
  "infieldOut",
  "outfieldOut",
  "doublePlay",
  "error",
  "steal"
]);

const ANIM = GAMECAST2_ATLAS_ANIMATION_CONTRACT;
const BASE_ROUTE = Object.freeze(["home", "first", "second", "third", "home"]);
const INFIELDERS = Object.freeze(["SS", "2B", "3B", "1B", "P", "C"]);
const OUTFIELDERS = Object.freeze(["CF", "LF", "RF"]);
const DEFENDERS = Object.freeze(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const RESULT_BADGES = Object.freeze({
  strikeout: "삼진",
  walk: "볼넷",
  hitByPitch: "몸에 맞는 공",
  single: "안타!",
  double: "2루타!",
  triple: "3루타!",
  homeRun: "홈런!",
  infieldOut: "내야 아웃",
  outfieldOut: "외야 아웃",
  doublePlay: "병살!",
  error: "실책",
  steal: "도루 성공!",
  caughtStealing: "도루 실패",
  sacrificeBunt: "희생번트"
});

const BATTED_SPECS = Object.freeze({
  single: Object.freeze({ durationMs: 3900, landingT: 0.46, fieldEndT: 0.54, throwEndT: 0.68, batterEndT: 0.72, runnerEndT: 0.82, throwTarget: "second" }),
  double: Object.freeze({ durationMs: 4400, landingT: 0.48, fieldEndT: 0.56, throwEndT: 0.72, batterEndT: 0.83, runnerEndT: 0.87, throwTarget: "third", slide: true, camera: true }),
  triple: Object.freeze({ durationMs: 4800, landingT: 0.51, fieldEndT: 0.59, throwEndT: 0.76, batterEndT: 0.9, runnerEndT: 0.88, throwTarget: "home", slide: true, camera: true }),
  infieldOut: Object.freeze({ durationMs: 3500, landingT: 0.41, fieldEndT: 0.49, throwEndT: 0.64, batterEndT: 0.67, runnerEndT: 0.7, throwTarget: "first" }),
  outfieldOut: Object.freeze({ durationMs: 3900, landingT: 0.51, fieldEndT: 0.59, throwEndT: 0.73, batterEndT: 0.67, runnerEndT: 0.8, throwTarget: "second" }),
  error: Object.freeze({ durationMs: 3900, landingT: 0.45, fieldEndT: 0.57, batterEndT: 0.76, runnerEndT: 0.84, fieldAnim: "dive" })
});

/**
 * Compile one engine event into scene-agnostic tracks.
 *
 * The function accepts either an anchor map or a normalized anchor payload
 * (`{ anchors, paths }`). It never mutates either argument.
 */
export function compilePlayTimeline(event, anchors) {
  const sourceEvent = event && typeof event === "object" ? event : {};
  const points = normalizeAnchorMap(anchors);
  requireCoreAnchors(points);

  const outcome = canonicalOutcome(sourceEvent);
  const template = selectTemplate(sourceEvent, outcome);
  const tracks = createTracks();
  const context = {
    event: sourceEvent,
    outcome,
    template,
    points,
    tracks,
    fielding: null,
    suggestedResultT: 0.8,
    durationMs: 3400
  };

  if (template === "strikeout") buildStrikeout(context);
  else if (template === "walk" || template === "hitByPitch") buildFreePass(context);
  else if (template === "homeRun") buildHomeRun(context);
  else if (template === "doublePlay") buildDoublePlay(context);
  else if (template === "steal") buildSteal(context);
  else buildFieldedBall(context, BATTED_SPECS[template] ?? BATTED_SPECS.infieldOut);

  return finalizeTimeline(context);
}

function createTracks() {
  return {
    pitcher: [],
    catcher: [],
    ball: [],
    batter: [],
    fielders: [],
    runners: [],
    camera: [],
    captions: [],
    result: [],
    sfx: []
  };
}

function buildStrikeout(context) {
  const starts = [0, 0.23, 0.46];
  starts.forEach((start, index) => addPitch(context, start, index + 1, true));
  context.tracks.batter.push(cue(0.515, 0.65, {
    anim: ANIM.swing,
    at: "home",
    phase: "miss"
  }));
  context.durationMs = 3200;
  context.suggestedResultT = 0.75;
}

function buildFreePass(context) {
  const hitByPitch = context.template === "hitByPitch";
  const starts = hitByPitch ? [0] : [0, 0.2, 0.4];
  starts.forEach((start, index) => addPitch(context, start, index + 1, true));

  const runStart = hitByPitch ? 0.27 : 0.61;
  const batterEnd = hitByPitch ? 0.62 : 0.85;
  addBatterAdvance(context, runStart, batterEnd, {
    anim: ANIM.walk,
    targetBase: 1,
    phase: hitByPitch ? "take-base-hbp" : "take-base-walk"
  });
  addExistingRunnerAdvances(context, runStart, hitByPitch ? 0.66 : 0.88);

  context.durationMs = hitByPitch ? 3200 : 3900;
  context.suggestedResultT = hitByPitch ? 0.72 : 0.93;
}

function buildFieldedBall(context, spec) {
  addPitch(context, 0, 1, false);
  context.tracks.batter.push(cue(0.105, 0.3, {
    anim: ANIM.swing,
    at: "home",
    phase: "contact"
  }));
  context.tracks.sfx.push(cue(0.22, null, { id: "bat-crack" }));

  const fielderKey = selectFielderKey(context.event, context.points);
  context.points.landing = fieldingLandingPoint(context.event, context.points, fielderKey);
  context.tracks.ball.push(cue(0.22, spec.landingT, {
    path: ["home", "landing"],
    arc: ballArc(context.event),
    phase: "batted",
    arrivesAt: "landing"
  }));
  context.tracks.fielders.push(cue(0.235, spec.landingT, {
    who: fielderKey,
    anim: ANIM.run,
    path: [fielderKey, "landing"],
    phase: "approach",
    arrivesAt: "landing"
  }));

  const fieldAnim = ANIM[spec.fieldAnim] ?? ANIM.catch;
  context.tracks.fielders.push(cue(spec.landingT, spec.fieldEndT, {
    who: fielderKey,
    anim: fieldAnim,
    at: "landing",
    phase: context.template === "error" ? "misplay" : "field"
  }));

  let throwTarget = spec.throwTarget;
  if (context.template === "outfieldOut" && Number(context.event?.runs ?? 0) > 0) {
    throwTarget = "home";
  }
  let defensiveRotation = null;
  if (throwTarget && spec.throwEndT) {
    defensiveRotation = addDefensiveRotation(context, {
      primary: fielderKey,
      landing: "landing",
      landingT: spec.landingT,
      fieldEndT: spec.fieldEndT,
      throwTarget,
      throwEndT: spec.throwEndT
    });
    addFieldingThrow(context, {
      who: fielderKey,
      from: "landing",
      to: throwTarget,
      startT: spec.fieldEndT,
      endT: spec.throwEndT
    });
  } else {
    addDefensiveSupport(context, {
      primary: fielderKey,
      receiver: "",
      landing: "landing",
      landingT: spec.landingT,
      fieldEndT: spec.fieldEndT
    });
  }

  addBatterAdvance(context, 0.27, spec.batterEndT, {
    anim: ANIM.run,
    targetBase: batterTargetBase(context),
    out: context.template === "infieldOut" || context.template === "outfieldOut" || context.template === "doublePlay",
    slide: Boolean(spec.slide),
    phase: "batter-run"
  });
  addExistingRunnerAdvances(context, 0.255, spec.runnerEndT);

  if (spec.camera) {
    context.tracks.camera.push(cue(0.22, Math.min(0.84, spec.batterEndT), {
      follow: "ball",
      zoom: 1.1,
      ease: "easeInOut"
    }));
  }

  context.fielding = {
    fielder: fielderKey,
    landingPoint: "landing",
    ballArrivalT: roundTime(spec.landingT),
    fielderArrivalT: roundTime(spec.landingT),
    throwTarget: throwTarget || null,
    receiver: defensiveRotation?.receiver ?? null,
    receiverArrivalT: defensiveRotation?.arrivalT ?? null
  };
  context.durationMs = spec.durationMs;
  context.suggestedResultT = Math.max(spec.runnerEndT, spec.throwEndT ?? spec.fieldEndT) + 0.05;
}

function buildDoublePlay(context) {
  const spec = {
    durationMs: 4300,
    landingT: 0.4,
    fieldEndT: 0.47,
    throwEndT: 0.59,
    batterEndT: 0.75,
    runnerEndT: 0.6,
    throwTarget: "second"
  };
  buildFieldedBall(context, spec);

  const primary = context.fielding?.fielder ?? selectFielderKey(context.event, context.points);
  const relay = context.fielding?.receiver ?? selectRelayFielder(context.points, primary);
  context.tracks.fielders.push(cue(0.63, 0.7, {
    who: relay,
    anim: ANIM.throw,
    at: "second",
    toward: "first",
    phase: "relay-throw"
  }));
  context.tracks.ball.push(cue(0.64, 0.72, {
    path: ["second", "first"],
    arc: 0.08,
    phase: "relay-throw"
  }));
  addThrowReceiver(context, {
    primary: relay,
    receiver: primary === "1B" ? "P" : "",
    to: "first",
    moveStartT: 0.46,
    throwEndT: 0.72,
    phasePrefix: "relay-"
  });
  context.durationMs = spec.durationMs;
  context.suggestedResultT = 0.8;
}

function buildHomeRun(context) {
  addPitch(context, 0, 1, false);
  context.tracks.batter.push(cue(0.105, 0.31, {
    anim: ANIM.swing,
    at: "home",
    phase: "contact"
  }));
  context.tracks.sfx.push(cue(0.22, null, { id: "bat-crack" }));

  const fielderKey = selectFielderKey({ ...context.event, battedBallType: "flyBall" }, context.points);
  const wallPoint = homeRunWallPoint(context.event, context.points);
  context.points.wallTrack = interpolatePoint(context.points[fielderKey], wallPoint, 0.72);
  context.points.homeRunExit = extendFromPoint(context.points.home, wallPoint, 1.08);

  context.tracks.ball.push(cue(0.22, 0.59, {
    path: ["home", "homeRunExit"],
    arc: 1.2,
    phase: "home-run-flight",
    clearsWall: true
  }));
  context.tracks.fielders.push(cue(0.24, 0.57, {
    who: fielderKey,
    anim: ANIM.run,
    path: [fielderKey, "wallTrack"],
    phase: "warning-track"
  }));
  context.tracks.camera.push(cue(0.22, 0.66, {
    follow: "ball",
    zoom: 1.12,
    ease: "easeInOut"
  }));
  context.tracks.sfx.push(cue(0.6, null, { id: "crowd-rise" }));

  addBatterAdvance(context, 0.29, 0.93, {
    anim: ANIM.run,
    targetBase: 4,
    phase: "home-run-trot"
  });
  addExistingRunnerAdvances(context, 0.27, 0.89);

  context.durationMs = 5600;
  context.suggestedResultT = 0.97;
}

function buildSteal(context) {
  const success = stealSucceeded(context.event);
  addPitch(context, 0, 1, true);

  let transitions = existingRunnerTransitions(context.event, context.outcome, context.template);
  if (transitions.length === 0) {
    const runnerId = String(context.event?.runnerId ?? context.event?.runner?.id ?? "steal-runner");
    transitions = [{ id: runnerId, fromBase: 1, toBase: 2, out: !success }];
  }
  for (const transition of transitions) {
    addRunnerMovement(context, transition, 0.115, 0.5, true);
  }

  context.tracks.catcher.push(cue(0.2, 0.34, {
    anim: ANIM.throw,
    at: "C",
    toward: "second",
    phase: "steal-throw"
  }));
  context.tracks.ball.push(cue(0.28, 0.45, {
    path: ["home", "second"],
    arc: 0.1,
    phase: "steal-throw"
  }));

  const receiver = firstAvailableAnchor(context.points, ["2B", "SS", "second"]);
  context.tracks.fielders.push(cue(0.23, 0.43, {
    who: receiver,
    anim: ANIM.run,
    path: receiver === "second" ? ["second"] : [receiver, "second"],
    phase: "cover-steal"
  }));
  context.tracks.fielders.push(cue(0.43, 0.51, {
    who: receiver,
    anim: ANIM.catch,
    at: "second",
    phase: success ? "late-tag" : "tag"
  }));

  context.durationMs = 3400;
  context.suggestedResultT = 0.59;
}

function addPitch(context, startT, pitchNumber, caught) {
  const releaseT = startT + 0.065;
  const plateT = startT + 0.2;
  context.tracks.pitcher.push(cue(startT, startT + 0.16, {
    anim: ANIM.pitch,
    at: "mound",
    pitchNumber,
    phase: "pitch"
  }));
  context.tracks.ball.push(cue(releaseT, plateT, {
    path: ["mound", "home"],
    arc: 0.05,
    pitchNumber,
    phase: "pitch"
  }));
  if (caught) {
    context.tracks.catcher.push(cue(plateT - 0.02, plateT + 0.055, {
      anim: ANIM.catcher,
      at: "C",
      pitchNumber,
      phase: "receive"
    }));
  }
}

function addFieldingThrow(context, { who, from, to, startT, endT }) {
  const releaseT = startT + Math.min(0.07, (endT - startT) * 0.48);
  context.tracks.fielders.push(cue(startT, releaseT + 0.025, {
    who,
    anim: ANIM.throw,
    at: from,
    toward: to,
    phase: "throw"
  }));
  context.tracks.ball.push(cue(releaseT, endT, {
    path: [from, to],
    arc: 0.12,
    phase: "fielding-throw"
  }));
}

function addDefensiveRotation(context, {
  primary,
  landing,
  landingT,
  fieldEndT,
  throwTarget,
  throwEndT
}) {
  const receiver = selectThrowReceiver(context.points, primary, throwTarget);
  addDefensiveSupport(context, {
    primary,
    receiver,
    landing,
    landingT,
    fieldEndT
  });
  if (!receiver) return null;
  return addThrowReceiver(context, {
    primary,
    receiver,
    to: throwTarget,
    moveStartT: Math.max(0.235, Math.min(0.31, landingT - 0.1)),
    throwEndT
  });
}

function addDefensiveSupport(context, { primary, receiver, landing, landingT, fieldEndT }) {
  const target = context.points[landing];
  if (!target) return;
  const moveStartT = 0.245;
  const moveEndT = Math.min(fieldEndT + 0.015, landingT + 0.055);
  for (const key of DEFENDERS) {
    if (key === primary || key === receiver || !context.points[key]) continue;
    const amount = OUTFIELDERS.includes(key) ? 0.075 : ["P", "C"].includes(key) ? 0.08 : 0.12;
    const pointName = defensiveShiftPointName(key);
    context.points[pointName] = interpolatePoint(context.points[key], target, amount);
    if (pointDistance(context.points[key], context.points[pointName]) < 4) continue;
    context.tracks.fielders.push(cue(moveStartT, moveEndT, {
      who: key,
      anim: ANIM.run,
      path: [key, pointName],
      phase: "defensive-shift",
      assignment: "cover"
    }));
  }
}

function addThrowReceiver(context, {
  primary,
  receiver = "",
  to,
  moveStartT,
  throwEndT,
  phasePrefix = ""
}) {
  const selected = receiver || selectThrowReceiver(context.points, primary, to);
  if (!selected || !context.points[selected] || !context.points[to]) return null;
  const shiftedStart = defensiveShiftPointName(selected);
  const from = context.points[shiftedStart] ? shiftedStart : selected;
  const arrivalT = roundTime(Math.max(moveStartT + 0.08, throwEndT - 0.05));
  context.tracks.fielders.push(cue(moveStartT, arrivalT, {
    who: selected,
    anim: ANIM.run,
    path: [from, to],
    phase: `${phasePrefix}cover-${to}`,
    assignment: "receiver"
  }));
  context.tracks.fielders.push(cue(arrivalT, Math.min(0.97, throwEndT + 0.04), {
    who: selected,
    anim: ANIM.catch,
    at: to,
    phase: `${phasePrefix}receive-${to}`,
    assignment: "receiver"
  }));
  return { receiver: selected, arrivalT };
}

function defensiveShiftPointName(key) {
  return `defenseShift${String(key).replace(/[^A-Za-z0-9]/g, "")}`;
}

function addBatterAdvance(context, startT, endT, options) {
  const targetBase = Number(options.targetBase ?? 1);
  if (targetBase <= 0) return;
  const path = basePath(0, targetBase);
  const slideDuration = options.slide ? Math.min(0.075, (endT - startT) * 0.18) : 0;
  const runEndT = endT - slideDuration;
  context.tracks.batter.push(cue(startT, runEndT, {
    who: "batter",
    anim: options.anim ?? ANIM.run,
    path,
    fromBase: "home",
    toBase: targetBase === 4 ? "home" : BASE_ROUTE[targetBase],
    basesAdvanced: targetBase,
    out: Boolean(options.out),
    phase: options.phase ?? "advance"
  }));
  if (options.slide) {
    context.tracks.batter.push(cue(runEndT, endT, {
      who: "batter",
      anim: ANIM.slide,
      at: path[path.length - 1],
      out: Boolean(options.out),
      phase: "slide"
    }));
  }
}

function addExistingRunnerAdvances(context, startT, latestEndT) {
  const transitions = existingRunnerTransitions(context.event, context.outcome, context.template);
  for (const transition of transitions) {
    const distance = Math.max(1, transitionDistance(transition));
    const endT = Math.min(latestEndT, startT + 0.14 + distance * 0.105);
    addRunnerMovement(context, transition, startT, endT, distance >= 2 || transition.out);
  }
}

function addRunnerMovement(context, transition, startT, endT, slide) {
  const path = basePath(transition.fromBase, transition.toBase);
  if (path.length < 2) return;
  const slideDuration = slide ? Math.min(0.065, (endT - startT) * 0.18) : 0;
  const runEndT = endT - slideDuration;
  context.tracks.runners.push(cue(startT, runEndT, {
    who: transition.id,
    runnerId: transition.id,
    anim: ANIM.run,
    path,
    fromBase: BASE_ROUTE[transition.fromBase],
    toBase: transition.toBase === 4 ? "home" : BASE_ROUTE[transition.toBase],
    basesAdvanced: transitionDistance(transition),
    out: Boolean(transition.out),
    phase: "runner-advance"
  }));
  if (slide) {
    context.tracks.runners.push(cue(runEndT, endT, {
      who: transition.id,
      runnerId: transition.id,
      anim: ANIM.slide,
      at: path[path.length - 1],
      out: Boolean(transition.out),
      phase: transition.out ? "tag-play" : "slide"
    }));
  }
}

function existingRunnerTransitions(event, outcome, template) {
  const before = baseOccupants(event, "Before");
  const after = baseOccupants(event, "After");
  if (before.length === 0) return [];

  const afterById = new Map(after.filter((entry) => entry.explicitId).map((entry) => [entry.id, entry.base]));
  const hitterId = String(event?.hitterId ?? event?.batterId ?? "");
  const scoredIds = new Set(
    (Array.isArray(event?.scoredRunners) ? event.scoredRunners : [])
      .map((runner) => String(runner?.id ?? runner?.runnerId ?? runner?.name ?? runner ?? ""))
      .filter(Boolean)
  );
  const explicitIdentity = before.some((entry) => entry.explicitId) && (afterById.size > 0 || scoredIds.size > 0);
  const claimedAfterBases = new Set();
  const batterAfterBase = after.find((entry) => hitterId && entry.id === hitterId)?.base ?? defaultBatterTarget(outcome, template);
  if (!after.some((entry) => entry.explicitId) && batterAfterBase > 0 && batterAfterBase < 4) {
    claimedAfterBases.add(batterAfterBase);
  }

  let anonymousScores = inferredExistingRunCount(event, outcome, hitterId, scoredIds);
  const transitions = [];
  const ordered = [...before].sort((a, b) => b.base - a.base);
  for (const runner of ordered) {
    let toBase = null;
    let out = false;

    if (explicitIdentity && runner.explicitId) {
      if (afterById.has(runner.id)) toBase = afterById.get(runner.id);
      else if (scoredIds.has(runner.id)) toBase = 4;
      else if (template === "doublePlay" && runner.base === 1) {
        toBase = 2;
        out = true;
      } else if (template === "steal") {
        toBase = Math.min(3, runner.base + 1);
        out = !stealSucceeded(event);
      }
    } else {
      if (anonymousScores > 0) {
        toBase = 4;
        anonymousScores -= 1;
      } else if (template === "doublePlay" && runner.base === 1) {
        toBase = 2;
        out = true;
      } else if (template === "steal") {
        toBase = Math.min(3, runner.base + 1);
        out = !stealSucceeded(event);
      } else {
        const openAfter = after
          .map((entry) => entry.base)
          .filter((base) => base >= runner.base && !claimedAfterBases.has(base))
          .sort((a, b) => a - b);
        toBase = openAfter.find((base) => base > runner.base) ?? openAfter[0] ?? runner.base;
      }
    }

    if (toBase === null) continue;
    if (toBase > 0 && toBase < 4 && !out) claimedAfterBases.add(toBase);
    if (toBase !== runner.base || out) {
      transitions.push({ id: runner.id, fromBase: runner.base, toBase, out });
    }
  }

  return transitions.sort((a, b) => a.fromBase - b.fromBase);
}

function baseOccupants(event, suffix) {
  const bases = Array.isArray(event?.[`bases${suffix}`]) ? event[`bases${suffix}`] : [];
  const ids = Array.isArray(event?.[`baseRunnerIds${suffix}`]) ? event[`baseRunnerIds${suffix}`] : [];
  const entries = [];
  for (let index = 0; index < 3; index += 1) {
    const baseValue = bases[index];
    const explicit = String(ids[index] ?? identityFromBaseValue(baseValue) ?? "").trim();
    if (!baseValue && !explicit) continue;
    entries.push({
      id: explicit || `runner-${index + 1}`,
      explicitId: Boolean(explicit),
      base: index + 1
    });
  }
  return entries;
}

function identityFromBaseValue(value) {
  if (!value || value === true) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return value.id ?? value.playerId ?? value.runnerId ?? value.name ?? "";
  return "";
}

function inferredExistingRunCount(event, outcome, hitterId, scoredIds) {
  if (scoredIds.size > 0) {
    return [...scoredIds].filter((id) => !hitterId || id !== hitterId).length;
  }
  const runs = Math.max(0, Number(event?.runs ?? 0) || 0);
  return Math.max(0, runs - (outcome === "homeRun" ? 1 : 0));
}

function batterTargetBase(context) {
  const hitterId = String(context.event?.hitterId ?? context.event?.batterId ?? "");
  if (hitterId) {
    const after = baseOccupants(context.event, "After");
    const occupied = after.find((runner) => runner.id === hitterId);
    if (occupied) return occupied.base;
  }
  return defaultBatterTarget(context.outcome, context.template);
}

function defaultBatterTarget(outcome, template) {
  if (outcome === "homeRun") return 4;
  if (outcome === "triple") return 3;
  if (outcome === "double") return 2;
  if (["single", "walk", "hitByPitch", "error"].includes(outcome)) return 1;
  if (["infieldOut", "outfieldOut", "doublePlay"].includes(template)) return 1;
  return 0;
}

function basePath(fromBase, toBase) {
  const start = clampInteger(fromBase, 0, 3);
  const end = clampInteger(toBase, start, 4);
  return BASE_ROUTE.slice(start, end + 1);
}

function transitionDistance(transition) {
  return Math.max(0, Number(transition?.toBase ?? 0) - Number(transition?.fromBase ?? 0));
}

function selectFielderKey(event, points) {
  const explicit = normalizeFielderKey(event?.fieldingPosition ?? event?.defenderPosition);
  if (explicit && points[explicit]) return explicit;
  const outfield = isOutfieldBall(event);
  return firstAvailableAnchor(points, outfield ? OUTFIELDERS : INFIELDERS);
}

function normalizeFielderKey(value) {
  const raw = String(value ?? "").trim().toUpperCase().replaceAll(" ", "");
  const aliases = {
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
  };
  return aliases[raw] ?? raw;
}

function selectRelayFielder(points, primary) {
  const candidates = primary === "2B" ? ["SS", "2B", "second"] : ["2B", "SS", "second"];
  return firstAvailableAnchor(points, candidates);
}

function selectThrowReceiver(points, primary, target) {
  const candidates = {
    first: ["1B", "P", "2B"],
    second: ["2B", "SS", "CF"],
    third: ["3B", "SS", "LF"],
    home: ["C", "P", "1B"]
  }[target] ?? ["1B", "2B", "SS", "3B", "P", "C"];
  return candidates.find((candidate) => candidate !== primary && points[candidate]) ?? "";
}

function firstAvailableAnchor(points, candidates) {
  const key = candidates.find((candidate) => points[candidate]);
  if (key) return key;
  if (points.P) return "P";
  return "mound";
}

function pointDistance(a, b) {
  return Math.hypot(Number(a?.x ?? 0) - Number(b?.x ?? 0), Number(a?.y ?? 0) - Number(b?.y ?? 0));
}

function fieldingLandingPoint(event, points, fielderKey) {
  const fielder = points[fielderKey];
  const ground = normalizedToken(event?.battedBallType).includes("ground");
  const line = normalizedToken(event?.battedBallType).includes("line");
  const towardHome = ground ? 0.22 : line ? 0.13 : 0.08;
  return interpolatePoint(fielder, points.home, towardHome);
}

function homeRunWallPoint(event, points) {
  const left = points.leftPole ?? points.LF ?? points.CF ?? points.third;
  const right = points.rightPole ?? points.RF ?? points.CF ?? points.first;
  const center = points.CF ?? interpolatePoint(left, right, 0.5);
  const lane = deterministicUnit(event);
  if (lane < -0.34) return interpolatePoint(left, center, 0.42);
  if (lane > 0.34) return interpolatePoint(center, right, 0.58);
  return interpolatePoint(center, lane < 0 ? left : right, Math.abs(lane) * 0.18);
}

function interpolatePoint(from, to, amount) {
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  return {
    x: roundCoordinate(from.x + (to.x - from.x) * t),
    y: roundCoordinate(from.y + (to.y - from.y) * t),
    scale: roundCoordinate(from.scale + (to.scale - from.scale) * t)
  };
}

function extendFromPoint(origin, point, amount) {
  const factor = Number(amount) || 1;
  return {
    x: roundCoordinate(origin.x + (point.x - origin.x) * factor),
    y: roundCoordinate(origin.y + (point.y - origin.y) * factor),
    scale: roundCoordinate(point.scale)
  };
}

function ballArc(event) {
  const type = normalizedToken(event?.battedBallType);
  if (type.includes("ground")) return 0.04;
  if (type.includes("line")) return 0.35;
  return 0.78;
}

function isOutfieldBall(event) {
  const key = normalizeFielderKey(event?.fieldingPosition ?? event?.defenderPosition);
  if (OUTFIELDERS.includes(key)) return true;
  if (INFIELDERS.includes(key)) return false;
  const type = normalizedToken(event?.battedBallType);
  return type.includes("fly") || type.includes("line");
}

function normalizeAnchorMap(payload) {
  const source = payload?.anchors && typeof payload.anchors === "object" ? payload.anchors : payload;
  const points = {};
  if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) {
      const x = Number(value?.x);
      const y = Number(value?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      points[key] = {
        x,
        y,
        scale: Number.isFinite(Number(value?.scale)) ? Number(value.scale) : 1
      };
    }
  }
  if (!points.mound && points.P) points.mound = { ...points.P };
  if (!points.P && points.mound) points.P = { ...points.mound };
  if (!points.C && points.home) points.C = { ...points.home };
  return points;
}

function requireCoreAnchors(points) {
  const missing = ["home", "mound", "first", "second", "third"].filter((key) => !points[key]);
  if (missing.length > 0) {
    throw new TypeError(`Gamecast timeline anchors missing: ${missing.join(", ")}`);
  }
}

function canonicalOutcome(event) {
  if (event?.hitByPitch === true) return "hitByPitch";
  const token = normalizedToken(event?.outcome ?? event?.result ?? event?.playType ?? event?.type);
  const aliases = {
    k: "strikeout",
    strikeout: "strikeout",
    walk: "walk",
    bb: "walk",
    hbp: "hitByPitch",
    hitbypitch: "hitByPitch",
    hitbypitched: "hitByPitch",
    single: "single",
    double: "double",
    triple: "triple",
    homerun: "homeRun",
    homer: "homeRun",
    hr: "homeRun",
    error: "error",
    reachedonerror: "error",
    out: "out",
    sacrificebunt: "sacrificeBunt",
    steal: "steal",
    stolenbase: "steal",
    caughtstealing: "steal",
    cs: "steal"
  };
  return aliases[token] ?? "out";
}

function selectTemplate(event, outcome) {
  if (outcome === "strikeout") return "strikeout";
  if (outcome === "walk") return "walk";
  if (outcome === "hitByPitch") return "hitByPitch";
  if (["single", "double", "triple", "homeRun", "error", "steal"].includes(outcome)) return outcome;
  if (event?.doublePlay) return "doublePlay";
  return isOutfieldBall(event) ? "outfieldOut" : "infieldOut";
}

function stealSucceeded(event) {
  const token = normalizedToken(event?.outcome ?? event?.result ?? event?.playType ?? event?.type);
  if (token === "caughtstealing" || token === "cs") return false;
  if (event?.success === false || event?.caught === true || event?.out === true) return false;
  return true;
}

function resultBadge(context) {
  if (context.template === "steal" && !stealSucceeded(context.event)) return RESULT_BADGES.caughtStealing;
  if (context.outcome === "sacrificeBunt") return RESULT_BADGES.sacrificeBunt;
  return RESULT_BADGES[context.template] ?? RESULT_BADGES.infieldOut;
}

function finalizeTimeline(context) {
  for (const entries of Object.values(context.tracks)) {
    entries.sort((a, b) => a.t - b.t || Number(a.endT ?? a.t) - Number(b.endT ?? b.t));
  }

  const runningEndT = latestAnimationEnd(context.tracks, new Set([ANIM.run, ANIM.walk, ANIM.slide]));
  const actionEndT = latestCueEnd(context.tracks, ["pitcher", "catcher", "ball", "batter", "fielders", "runners"]);
  const resultT = roundTime(Math.min(0.985, Math.max(
    context.suggestedResultT,
    runningEndT > 0 ? runningEndT + 0.035 : 0,
    actionEndT + 0.025
  )));

  context.tracks.captions.push(cue(resultT, null, {
    badge: resultBadge(context),
    outcome: context.outcome,
    phase: "result-caption"
  }));
  context.tracks.result.push(cue(resultT, null, {
    outcome: context.outcome,
    runs: Math.max(0, Number(context.event?.runs ?? 0) || 0),
    outsBefore: finiteNumberOrNull(context.event?.outsBefore),
    outsAfter: finiteNumberOrNull(context.event?.outsAfter),
    scoreAfter: cloneScore(context.event?.scoreAfter),
    commit: true
  }));

  const allAnimationKeysValid = allAnimationKeys(context.tracks).every((key) => GAMECAST2_ATLAS_ANIMATION_KEYS.includes(key));
  const fieldingArrivalMatchesBall = !context.fielding
    || context.fielding.ballArrivalT === context.fielding.fielderArrivalT;

  return {
    version: 1,
    template: context.template,
    outcome: context.outcome,
    durationMs: context.durationMs,
    resultAt: resultT,
    points: context.points,
    tracks: context.tracks,
    meta: {
      pitchFirst: context.tracks.pitcher[0]?.t === 0,
      runningEndT,
      fielding: context.fielding,
      invariants: {
        animationContract: allAnimationKeysValid,
        fieldingArrivalMatchesBall,
        resultAfterRunning: runningEndT === 0 || resultT > runningEndT
      }
    }
  };
}

function cue(t, endT, details) {
  const value = { t: roundTime(t), ...details };
  if (endT !== null && endT !== undefined) value.endT = roundTime(endT);
  return value;
}

function latestAnimationEnd(tracks, animations) {
  let latest = 0;
  for (const entries of Object.values(tracks)) {
    for (const entry of entries) {
      if (animations.has(entry.anim)) latest = Math.max(latest, Number(entry.endT ?? entry.t ?? 0));
    }
  }
  return roundTime(latest);
}

function latestCueEnd(tracks, names) {
  let latest = 0;
  for (const name of names) {
    for (const entry of tracks[name] ?? []) latest = Math.max(latest, Number(entry.endT ?? entry.t ?? 0));
  }
  return roundTime(latest);
}

function allAnimationKeys(tracks) {
  return Object.values(tracks).flatMap((entries) => entries.map((entry) => entry.anim).filter(Boolean));
}

function cloneScore(value) {
  if (!value || typeof value !== "object") return null;
  const clone = {};
  for (const [key, entry] of Object.entries(value)) {
    if (["string", "number", "boolean"].includes(typeof entry) || entry === null) clone[key] = entry;
  }
  return clone;
}

function normalizedToken(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deterministicUnit(event) {
  const seed = [event?.gameId, event?.sequence, event?.hitterId, event?.outcome].join("|");
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * 2 - 1;
}

function clampInteger(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Math.trunc(Number(value) || 0)));
}

function finiteNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundTime(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function roundCoordinate(value) {
  return Math.round(Number(value) * 100) / 100;
}
