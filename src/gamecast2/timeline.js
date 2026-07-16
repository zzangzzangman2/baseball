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
const BATTER_RUN_MS_PER_BASE = 1400;
const BATTER_SLIDE_MS = 270;
const RUNNER_RUN_MS_PER_BASE = 1400;
const RUNNER_SLIDE_MS = 270;
const RUNNER_RESULT_LATEST_T = 0.95;
const OUTFIELD_ACTION_LATEST_T = 0.94;
const THROW_ARM_MIN = 20;
const THROW_ARM_MAX = 200;
const THROW_SAFE_LEAD_T = 0.015;
const THROW_OUT_LEAD_T = 0.015;
const THROW_ARRIVAL_LATEST_T = 0.985;
const OUTFIELD_FIELDING_DELAY_MS = Object.freeze({
  ground: 700,
  line: 900,
  fly: 1000,
  default: 850
});
const INFIELDERS = Object.freeze(["SS", "2B", "3B", "1B", "P", "C"]);
const OUTFIELDERS = Object.freeze(["CF", "LF", "RF"]);
const BASE_SUPPORT_TARGETS = new Set(["home", "first", "second", "third"]);
const BASE_BACKUP_OFFSET_PX = 14;
const BASE_BACKUP_MAX_DISTANCE_PX = 42;
const MIN_SUPPORT_ROUTE_PX = 14;
const MIN_PURPOSEFUL_SUPPORT_ROUTE_PX = 18;
// Keep these support-route bounds aligned with scene.js. Timeline-authored
// destinations must stay inside them so the renderer never silently clamps a
// defender somewhere other than the declared arrival point.
const DEFENDER_SUPPORT_MOVE_ZONES = Object.freeze({
  P: Object.freeze({ x: 300, yTop: 110, yBottom: 220 }),
  C: Object.freeze({ x: 30, yTop: 42, yBottom: 12 }),
  "1B": Object.freeze({ x: 54, yTop: 42, yBottom: 45 }),
  "2B": Object.freeze({ x: 132, yTop: 80, yBottom: 80 }),
  "3B": Object.freeze({ x: 54, yTop: 42, yBottom: 45 }),
  SS: Object.freeze({ x: 184, yTop: 80, yBottom: 80 }),
  LF: Object.freeze({ x: 96, yTop: 58, yBottom: 74 }),
  CF: Object.freeze({ x: 116, yTop: 62, yBottom: 84 }),
  RF: Object.freeze({ x: 96, yTop: 58, yBottom: 74 })
});
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
  single: Object.freeze({ durationMs: 3900, landingT: 0.46, fieldEndT: 0.54, throwEndT: 0.68, batterEndT: 0.63, runnerEndT: 0.82 }),
  double: Object.freeze({ durationMs: 4400, landingT: 0.48, fieldEndT: 0.56, throwEndT: 0.72, batterEndT: 0.83, runnerEndT: 0.87, throwTarget: "third", slide: true, camera: true }),
  triple: Object.freeze({ durationMs: 6400, actionTimeScale: 0.75, landingT: 0.51, fieldEndT: 0.59, throwEndT: 0.76, batterEndT: 0.9, runnerEndT: 0.88, throwTarget: "home", slide: true, camera: true }),
  infieldOut: Object.freeze({ durationMs: 3500, landingT: 0.41, fieldEndT: 0.49, throwEndT: 0.64, batterEndT: 0.67, runnerEndT: 0.7, throwTarget: "first" }),
  outfieldOut: Object.freeze({ durationMs: 3900, landingT: 0.51, fieldEndT: 0.59, throwEndT: 0.73, batterEndT: 0.77, runnerEndT: 0.8, throwTarget: "first" }),
  error: Object.freeze({ durationMs: 3900, landingT: 0.45, fieldEndT: 0.57, throwEndT: 0.74, batterEndT: 0.76, runnerEndT: 0.84, fieldAnim: "dive" })
});

export function getGamecast2PlayDurationMs(event) {
  const sourceEvent = event && typeof event === "object" ? event : {};
  const outcome = canonicalOutcome(sourceEvent);
  const template = selectTemplate(sourceEvent, outcome);
  return resolvedPlayDurationMs(sourceEvent, outcome, template);
}

export function getGamecast2RunnerStartMs(event, options = {}) {
  const sourceEvent = event && typeof event === "object" ? event : {};
  const outcome = canonicalOutcome(sourceEvent);
  const template = selectTemplate(sourceEvent, outcome);
  const rawStartMs = resolvedRunnerStartMs(sourceEvent, outcome, template, options);
  if (!Number.isFinite(Number(rawStartMs))) return null;
  const durationMs = resolvedPlayDurationMs(sourceEvent, outcome, template);
  return roundTime(Number(rawStartMs) / durationMs) * durationMs;
}

function resolvedPlayDurationMs(event, outcome, template) {
  const spec = BATTED_SPECS[template];
  const baseDurationMs = basePlayDurationMs(template, spec);
  const actionDurationMs = actionPlayDurationMs(template, spec);
  const explicitFielder = normalizeFielderKey(event?.fieldingPosition ?? event?.defenderPosition);
  const fielderKey = explicitFielder || (isOutfieldBall(event) ? "CF" : "");
  const fieldingDelayMs = spec ? outfieldFieldingDelayMs(event, fielderKey, template) : 0;
  let resolvedDurationMs = baseDurationMs;

  const runnerStartMs = resolvedRunnerStartMs(event, outcome, template);
  if (runnerStartMs !== null) {
    const transitions = existingRunnerTransitions(event, outcome, template);
    const latestRunnerEndMs = transitions.reduce((latest, transition) => {
      const distance = Math.max(1, transitionDistance(transition));
      const slideMs = distance >= 2 || transition.out ? RUNNER_SLIDE_MS : 0;
      return Math.max(
        latest,
        runnerStartMs + distance * RUNNER_RUN_MS_PER_BASE + slideMs
      );
    }, 0);
    if (latestRunnerEndMs > 0) {
      resolvedDurationMs = Math.max(
        resolvedDurationMs,
        Math.ceil(latestRunnerEndMs / RUNNER_RESULT_LATEST_T)
      );
    }
  }

  if (spec) {
    if (fieldingDelayMs > 0) {
      const latestActionT = Number.isFinite(Number(spec.throwEndT))
        ? Number(spec.throwEndT)
        : Number(spec.fieldEndT);
      const latestFieldingActionMs = latestActionT * actionDurationMs + fieldingDelayMs;
      resolvedDurationMs = Math.max(
        resolvedDurationMs,
        Math.ceil(latestFieldingActionMs / OUTFIELD_ACTION_LATEST_T)
      );
    }
  }

  return resolvedDurationMs;
}

function basePlayDurationMs(template, spec = BATTED_SPECS[template]) {
  return spec?.durationMs
    ?? (template === "strikeout" ? 3200
      : template === "walk" ? 4800
        : template === "hitByPitch" ? 3200
          : template === "homeRun" ? 5600
            : template === "doublePlay" ? 4300
              : 3400);
}

function actionPlayDurationMs(template, spec = BATTED_SPECS[template]) {
  return spec
    ? spec.durationMs * Math.max(0.1, Number(spec.actionTimeScale ?? 1))
    : basePlayDurationMs(template, spec);
}

function resolvedRunnerStartMs(event, outcome, template, options = {}) {
  const spec = BATTED_SPECS[template];
  const runnerStartT = spec || template === "doublePlay"
    ? 0.255
      : template === "homeRun" || template === "hitByPitch"
      ? 0.27
      : template === "walk"
        ? 0.27
        : null;
  if (runnerStartT === null) return null;

  const battedType = normalizedToken(event?.battedBallType);
  const inferredTagUp = outcome === "out"
    && template !== "doublePlay"
    && (battedType.includes("fly") || battedType.includes("line"));
  const tagUp = typeof options?.tagUp === "boolean" ? options.tagUp : inferredTagUp;
  const actionDurationMs = actionPlayDurationMs(template, spec);
  if (tagUp && spec) {
    const explicitFielder = normalizeFielderKey(event?.fieldingPosition ?? event?.defenderPosition);
    const fielderKey = explicitFielder || (isOutfieldBall(event) ? "CF" : "");
    const fieldingDelayMs = outfieldFieldingDelayMs(event, fielderKey, template);
    return Number(spec.landingT) * actionDurationMs + fieldingDelayMs;
  }
  return runnerStartT * actionDurationMs;
}

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
    durationMs: resolvedPlayDurationMs(sourceEvent, outcome, template)
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
  // A plate appearance is one simulation event. Show only its decisive third
  // strike, with the score bug already carrying the two-strike context.
  addPitch(context, 0, 3, true);
  context.tracks.batter.push(cue(0.135, 0.34, {
    anim: ANIM.swing,
    at: "home",
    phase: "miss"
  }));
  context.durationMs = 3200;
  context.suggestedResultT = 0.46;
}

function buildFreePass(context) {
  const hitByPitch = context.template === "hitByPitch";
  const baseDurationMs = hitByPitch ? 3200 : 4800;
  context.durationMs = Math.max(baseDurationMs, Number(context.durationMs) || 0);
  context.actionTimeScale = baseDurationMs / context.durationMs;
  const actionT = (value) => roundTime(scaleActionTime(context, value));
  // As with contact plays, render one decisive pitch. For a walk this is ball
  // four; the preceding three balls are conveyed by the count display.
  addPitch(context, 0, hitByPitch ? 1 : 4, true, context.actionTimeScale);

  const runStart = actionT(0.27);
  const batterEnd = actionT(hitByPitch ? 0.62 : 0.565);
  addBatterAdvance(context, runStart, batterEnd, {
    anim: ANIM.walk,
    targetBase: 1,
    phase: hitByPitch ? "take-base-hbp" : "take-base-walk"
  });
  addExistingRunnerAdvances(context, runStart);

  context.suggestedResultT = actionT(hitByPitch ? 0.72 : 0.62);
}

function buildFieldedBall(context, spec) {
  context.durationMs = Math.max(spec.durationMs, Number(context.durationMs) || 0);
  const actionDurationMs = spec.durationMs * Math.max(0.1, Number(spec.actionTimeScale ?? 1));
  context.actionTimeScale = actionDurationMs / context.durationMs;
  const actionT = (value) => roundTime(scaleActionTime(context, value));
  const buntPlay = isBuntPlay(context);
  spec = {
    ...spec,
    landingT: actionT(spec.landingT),
    fieldEndT: actionT(spec.fieldEndT),
    throwEndT: Number.isFinite(Number(spec.throwEndT)) ? actionT(spec.throwEndT) : spec.throwEndT,
    batterEndT: actionT(spec.batterEndT),
    runnerEndT: actionT(spec.runnerEndT)
  };

  addPitch(context, 0, 1, false, context.actionTimeScale);
  context.tracks.batter.push(cue(actionT(0.105), actionT(buntPlay ? 0.255 : 0.3), {
    anim: ANIM.swing,
    at: "home",
    phase: buntPlay ? "bunt-contact" : "contact"
  }));
  context.tracks.sfx.push(cue(actionT(0.22), null, { id: "bat-crack" }));

  const fielderKey = selectFielderKey(context.event, context.points);
  const fieldingDelayT = outfieldFieldingDelayMs(context.event, fielderKey, context.template) / context.durationMs;
  if (fieldingDelayT > 0) {
    spec = {
      ...spec,
      landingT: roundTime(spec.landingT + fieldingDelayT),
      fieldEndT: roundTime(spec.fieldEndT + fieldingDelayT),
      throwEndT: Number.isFinite(Number(spec.throwEndT))
        ? roundTime(spec.throwEndT + fieldingDelayT)
        : spec.throwEndT
    };
  }
  const caughtBattedOut = isCaughtBattedOut(context);
  const safeFlyHit = isSafeFlyBallHit(context);
  const safeLineHit = isSafeLineDriveHit(context);
  context.points.landing = fieldingLandingPoint(context.event, context.points, fielderKey);
  const safeFlyStyle = safeFlyHit
    ? safeBallFieldingStyle(context, fielderKey, context.points.landing, "fly")
    : null;
  const safeLineStyle = safeLineHit
    ? safeBallFieldingStyle(context, fielderKey, context.points.landing, "line")
    : null;
  if (caughtBattedOut) {
    // The fielder anchor is the player's feet. Sending a caught fly to that
    // ground point makes the last frame look like a one-hop catch even though
    // the cue has no bounce. Give caught air balls a distinct glove endpoint;
    // the defender still runs to the ground anchor directly below it.
    context.points.catchGlove = caughtBallGlovePoint(context.event, context.points.landing);
  }

  // A fly-ball hit must not read like a completed catch. The ball lands before
  // the defender fields it; only genuinely difficult balls add a dive/recovery.
  // Keep the post-landing travel grounded and short: a pronounced rebound
  // makes the entire flight read like a grounder.
  let fieldingPoint = "landing";
  let missEndT = spec.landingT;
  let pickupArrivalT = spec.landingT;
  if (safeFlyHit) {
    if (safeFlyStyle === "dive") {
      context.points.miss = safeFlyMissPoint(context.event, context.points, fielderKey, context.points.landing);
    }
    context.points.pickup = safeFlyPickupPoint(context.points, fielderKey, context.points.landing);
    fieldingPoint = "pickup";
    missEndT = roundTime(Math.min(0.86, spec.landingT + scaleActionTime(context, 0.065)));
    pickupArrivalT = roundTime(Math.min(
      0.89,
      Math.max(spec.fieldEndT + scaleActionTime(context, 0.055), spec.landingT + scaleActionTime(context, 0.15))
    ));
    spec = {
      ...spec,
      fieldEndT: roundTime(Math.min(0.92, pickupArrivalT + scaleActionTime(context, 0.045))),
      throwEndT: Number.isFinite(Number(spec.throwEndT))
        ? roundTime(Math.min(0.965, Math.max(spec.throwEndT, pickupArrivalT + scaleActionTime(context, 0.16))))
        : spec.throwEndT
    };
  } else if (safeLineHit) {
    // A safe line drive has already hit the turf before the defender controls
    // it. Give the ball a short deadened roll, then choose a routine short-hop
    // pickup or a dive trap according to the authored challenge score.
    context.points.pickup = safeFlyPickupPoint(context.points, fielderKey, context.points.landing);
    fieldingPoint = "pickup";
    pickupArrivalT = roundTime(Math.min(
      0.89,
      Math.max(spec.fieldEndT + scaleActionTime(context, 0.02), spec.landingT + scaleActionTime(context, 0.075))
    ));
    spec = {
      ...spec,
      fieldEndT: roundTime(Math.min(0.92, pickupArrivalT + scaleActionTime(context, 0.035))),
      throwEndT: Number.isFinite(Number(spec.throwEndT))
        ? roundTime(Math.min(0.965, Math.max(spec.throwEndT, pickupArrivalT + scaleActionTime(context, 0.13))))
        : spec.throwEndT
    };
  }
  context.tracks.ball.push(cue(actionT(0.22), spec.landingT, {
    path: ["home", caughtBattedOut ? "catchGlove" : "landing"],
    arc: ballArc(context.event),
    flightProfile: caughtBattedOut || safeFlyHit ? "hang" : "direct",
    phase: "batted",
    arrivesAt: caughtBattedOut ? "catchGlove" : "landing",
    caughtDirectly: caughtBattedOut
  }));
  if (safeFlyHit) {
    context.tracks.ball.push(cue(spec.landingT, pickupArrivalT, {
      path: ["landing", "pickup"],
      grounded: true,
      phase: "safe-settle",
      arrivesAt: "pickup"
    }));
    if (safeFlyStyle === "dive") {
      context.tracks.fielders.push(cue(actionT(0.235), spec.landingT, {
        who: fielderKey,
        anim: ANIM.run,
        path: [fielderKey, "miss"],
        phase: "approach",
        arrivesAt: "miss"
      }));
      context.tracks.fielders.push(cue(spec.landingT, missEndT, {
        who: fielderKey,
        anim: ANIM.dive,
        at: "miss",
        toward: "landing",
        phase: "miss"
      }));
      context.tracks.fielders.push(cue(missEndT, pickupArrivalT, {
        who: fielderKey,
        anim: ANIM.run,
        path: ["miss", "pickup"],
        phase: "recover",
        arrivesAt: "pickup"
      }));
    } else {
      // Routine drops are played on the run. The ball reaches the turf before
      // the defender, so this cannot read as a completed catch or forced dive.
      context.tracks.fielders.push(cue(actionT(0.235), pickupArrivalT, {
        who: fielderKey,
        anim: ANIM.run,
        path: [fielderKey, "pickup"],
        phase: "approach",
        arrivesAt: "pickup"
      }));
    }
    context.tracks.fielders.push(cue(pickupArrivalT, spec.fieldEndT, {
      who: fielderKey,
      anim: ANIM.catch,
      at: "pickup",
      phase: "pickup"
    }));
  } else if (safeLineHit) {
    context.tracks.ball.push(cue(spec.landingT, pickupArrivalT, {
      path: ["landing", "pickup"],
      grounded: true,
      phase: "line-settle",
      arrivesAt: "pickup"
    }));
    context.tracks.fielders.push(cue(actionT(0.235), pickupArrivalT, {
      who: fielderKey,
      anim: ANIM.run,
      path: [fielderKey, "pickup"],
      phase: "approach",
      arrivesAt: "pickup"
    }));
    context.tracks.fielders.push(cue(pickupArrivalT, spec.fieldEndT, {
      who: fielderKey,
      anim: safeLineStyle === "dive" ? ANIM.dive : ANIM.catch,
      at: "pickup",
      toward: "landing",
      phase: safeLineStyle === "dive" ? "trap" : "short-hop"
    }));
  } else {
    context.tracks.fielders.push(cue(actionT(0.235), spec.landingT, {
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
      phase: context.template === "error" ? "misplay" : caughtBattedOut ? "catch" : "field"
    }));
  }

  if (!caughtBattedOut) {
    addBatterAdvance(context, actionT(0.27), spec.batterEndT, {
      anim: ANIM.run,
      targetBase: batterTargetBase(context),
      out: context.template === "infieldOut" || context.template === "outfieldOut" || context.template === "doublePlay",
      slide: Boolean(spec.slide),
      paceByDistance: !["doublePlay", "outfieldOut"].includes(context.template),
      phase: "batter-run"
    });
  }
  addExistingRunnerAdvances(context, caughtBattedOut ? spec.landingT : actionT(0.255));

  // Runner paths are authored before the throw so the ball can honor the
  // already-recorded call. An out throw must beat the retired runner; a safe
  // throw must arrive just after the runner instead of visually reversing the
  // simulation result.
  const throwTarget = fieldedBallThrowTarget(context, spec);
  let defensiveRotation = null;
  let throwPlan = null;
  if (throwTarget && spec.throwEndT) {
    throwPlan = resolveFieldingThrowPlan(context, {
      who: fielderKey,
      from: fieldingPoint,
      to: throwTarget,
      startT: spec.fieldEndT,
      nominalEndT: spec.throwEndT
    });
    defensiveRotation = addDefensiveRotation(context, {
      primary: fielderKey,
      landing: fieldingPoint,
      landingT: spec.landingT,
      fieldEndT: spec.fieldEndT,
      throwTarget,
      throwEndT: throwPlan.endT
    });
    addFieldingThrow(context, {
      who: fielderKey,
      from: fieldingPoint,
      to: throwTarget,
      startT: spec.fieldEndT,
      plan: throwPlan
    });
  } else {
    addDefensiveSupport(context, {
      primary: fielderKey,
      receiver: "",
      landing: fieldingPoint,
      landingT: spec.landingT,
      fieldEndT: spec.fieldEndT,
      throwTarget: null
    });
  }

  if (spec.camera) {
    context.tracks.camera.push(cue(actionT(0.22), Math.min(actionT(0.84), spec.batterEndT), {
      follow: "ball",
      zoom: 1.1,
      ease: "easeInOut"
    }));
  }

  context.fielding = {
    fielder: fielderKey,
    landingPoint: "landing",
    ballPoint: caughtBattedOut ? "catchGlove" : "landing",
    catchPoint: caughtBattedOut ? "catchGlove" : null,
    fieldingPoint,
    pickupPoint: safeFlyHit || safeLineHit ? "pickup" : null,
    missPoint: safeFlyHit && safeFlyStyle === "dive" ? "miss" : null,
    fieldingStyle: safeFlyStyle ?? safeLineStyle,
    resolution: caughtBattedOut
      ? "caught-fly"
      : safeFlyHit
        ? "safe-fly-drop"
        : safeLineHit
          ? safeLineStyle === "dive" ? "safe-line-trap" : "safe-line-short-hop"
          : "fielded",
    ballLandingT: roundTime(spec.landingT),
    ballArrivalT: roundTime(safeFlyHit || safeLineHit ? pickupArrivalT : spec.landingT),
    fielderArrivalT: roundTime(safeFlyHit || safeLineHit ? pickupArrivalT : spec.landingT),
    throwTarget: throwTarget || null,
    throwArmScore: throwPlan?.armScore ?? null,
    throwArc: throwPlan?.arc ?? null,
    throwArrivalT: throwPlan?.endT ?? null,
    throwOrdering: throwPlan?.ordering ?? null,
    receiver: defensiveRotation?.receiver ?? null,
    receiverArrivalT: defensiveRotation?.arrivalT ?? null,
    outRecordedAt: caughtBattedOut
      ? "landing"
      : ["infieldOut", "outfieldOut", "doublePlay"].includes(context.template)
        ? context.template === "doublePlay" ? "second" : throwTarget
        : null
  };
  const actualRunnerEndT = Math.max(0, ...context.tracks.runners.map((cue) => Number(cue.endT ?? cue.t ?? 0)));
  context.suggestedResultT = Math.max(
    spec.fieldEndT,
    caughtBattedOut ? 0 : spec.batterEndT,
    throwTarget ? Number(throwPlan?.endT ?? spec.throwEndT ?? 0) : 0,
    actualRunnerEndT
  ) + 0.05;
}

function fieldedBallThrowTarget(context, spec) {
  const canonicalTarget = defensiveThrowTarget(context.event);
  if (canonicalTarget) return canonicalTarget;

  const leadTransition = leadRunnerTransition(
    existingRunnerTransitions(context.event, context.outcome, context.template)
  );

  // A caught fly/line already records the batter out at the landing point. Only
  // make a competitive throw when the event says an existing runner advanced.
  if (isCaughtBattedOut(context)) {
    return baseAnchorForIndex(leadTransition?.toBase);
  }

  // On a hit, throw behind the lead advancing runner. With the bases empty the
  // batter is already safe before fielding completes, so there is no fake throw
  // to second (or a visually tempting but impossible throw to first).
  if (context.template === "single") {
    return baseAnchorForIndex(leadTransition?.toBase);
  }

  // Every ordinary ground-ball out is the batter-runner force at first. The
  // double-play builder is the only batted-out path that starts at second.
  if (["infieldOut", "outfieldOut"].includes(context.template)) return "first";

  return spec.throwTarget ?? null;
}

function defensiveThrowTarget(event) {
  const target = String(event?.defensiveThrowTarget ?? "").trim().toLowerCase();
  return ["first", "second", "third", "home"].includes(target) ? target : null;
}

function isCaughtBattedOut(context) {
  if (context.outcome !== "out" || context.template === "doublePlay") return false;
  const type = normalizedToken(context.event?.battedBallType);
  return type.includes("fly") || type.includes("line");
}

function leadRunnerTransition(transitions) {
  return [...(transitions ?? [])]
    .filter((transition) => Number(transition?.toBase) > Number(transition?.fromBase))
    .sort((a, b) => Number(b.toBase) - Number(a.toBase) || Number(b.fromBase) - Number(a.fromBase))[0]
    ?? null;
}

function baseAnchorForIndex(baseIndex) {
  const index = Number(baseIndex);
  if (!Number.isInteger(index) || index < 1 || index > 4) return null;
  return BASE_ROUTE[index];
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
  const relayPlan = resolveFieldingThrowPlan(context, {
    who: relay,
    from: "second",
    to: "first",
    startT: 0.63,
    nominalEndT: 0.72
  });
  addFieldingThrow(context, {
    who: relay,
    from: "second",
    to: "first",
    startT: 0.63,
    plan: relayPlan,
    actorPhase: "relay-throw",
    ballPhase: "relay-throw"
  });
  addThrowReceiver(context, {
    primary: relay,
    receiver: primary === "1B" ? "P" : "",
    to: "first",
    throwFrom: "second",
    moveStartT: 0.46,
    throwEndT: relayPlan.endT,
    phasePrefix: "relay-"
  });
  context.durationMs = Math.max(context.durationMs, spec.durationMs);
  context.suggestedResultT = 0.8;
}

function isSafeFlyBallHit(context) {
  if (!["single", "double", "triple", "error"].includes(context.outcome)) return false;
  return normalizedToken(context.event?.battedBallType).includes("fly");
}

function isSafeLineDriveHit(context) {
  if (!["single", "double", "triple", "error"].includes(context.outcome)) return false;
  return normalizedToken(context.event?.battedBallType).includes("line");
}

function buildHomeRun(context) {
  const baseDurationMs = 5600;
  context.durationMs = Math.max(baseDurationMs, Number(context.durationMs) || 0);
  context.actionTimeScale = baseDurationMs / context.durationMs;
  const actionT = (value) => roundTime(scaleActionTime(context, value));
  addPitch(context, 0, 1, false, context.actionTimeScale);
  context.tracks.batter.push(cue(actionT(0.105), actionT(0.31), {
    anim: ANIM.swing,
    at: "home",
    phase: "contact"
  }));
  context.tracks.sfx.push(cue(actionT(0.22), null, { id: "bat-crack" }));

  const wallPoint = homeRunWallPoint(context.event, context.points);
  const fielderKey = selectHomeRunFielderKey(context.points, wallPoint);
  // Keep the warning-track chase inside the authored outfielder movement zone.
  // A larger interpolation was clamped by the scene, so the timeline endpoint
  // and the position the viewer actually saw did not agree.
  context.points.wallTrack = interpolatePoint(context.points[fielderKey], wallPoint, 0.36);
  context.points.homeRunExit = extendFromPoint(context.points.home, wallPoint, 1.08);

  context.tracks.ball.push(cue(actionT(0.22), actionT(0.59), {
    path: ["home", "homeRunExit"],
    arc: 1.2,
    phase: "home-run-flight",
    clearsWall: true
  }));
  context.tracks.fielders.push(cue(actionT(0.24), actionT(0.57), {
    who: fielderKey,
    anim: ANIM.run,
    path: [fielderKey, "wallTrack"],
    phase: "warning-track"
  }));
  context.tracks.camera.push(cue(actionT(0.22), actionT(0.66), {
    follow: "ball",
    zoom: 1.12,
    ease: "easeInOut"
  }));
  context.tracks.sfx.push(cue(actionT(0.6), null, { id: "crowd-rise" }));

  addBatterAdvance(context, actionT(0.29), actionT(0.93), {
    anim: ANIM.run,
    targetBase: 4,
    phase: "home-run-trot"
  });
  addExistingRunnerAdvances(context, actionT(0.27));

  context.suggestedResultT = actionT(0.97);
}

function buildSteal(context) {
  const success = stealSucceeded(context.event);
  addPitch(context, 0, 1, true);

  // The ordering is the ruling: a successful runner must visibly beat the
  // throw, while a caught runner must arrive after the ball and completed tag.
  const timing = success
    ? { runnerStartT: 0.105, runnerEndT: 0.43, throwStartT: 0.3, throwEndT: 0.49, coverEndT: 0.47, tagEndT: 0.55 }
    : { runnerStartT: 0.12, runnerEndT: 0.53, throwStartT: 0.265, throwEndT: 0.405, coverEndT: 0.395, tagEndT: 0.48 };

  let transitions = existingRunnerTransitions(context.event, context.outcome, context.template);
  if (transitions.length === 0) {
    const runnerId = String(context.event?.runnerId ?? context.event?.runner?.id ?? "steal-runner");
    transitions = [{ id: runnerId, fromBase: 1, toBase: 2, out: !success }];
  }
  for (const transition of transitions) {
    addRunnerMovement(context, transition, timing.runnerStartT, timing.runnerEndT, true);
  }

  const targetTransition = leadRunnerTransition(transitions);
  const throwTarget = baseAnchorForIndex(targetTransition?.toBase) ?? "second";

  // A steal of home is a plate tag, not a zero-length home-to-home throw.
  if (throwTarget === "home") {
    context.tracks.catcher.push(cue(0.2, timing.tagEndT, {
      anim: ANIM.catcher,
      at: "C",
      phase: success ? "late-tag-home" : "tag-home"
    }));
    context.durationMs = 3400;
    context.suggestedResultT = 0.59;
    return;
  }

  context.tracks.catcher.push(cue(0.2, success ? 0.36 : 0.325, {
    anim: ANIM.throw,
    at: "C",
    toward: throwTarget,
    phase: "steal-throw"
  }));
  context.tracks.ball.push(cue(timing.throwStartT, timing.throwEndT, {
    path: ["home", throwTarget],
    arc: 0.1,
    phase: "steal-throw"
  }));

  const receiver = selectThrowReceiver(context.points, "C", throwTarget);
  context.tracks.fielders.push(cue(0.23, timing.coverEndT, {
    who: receiver,
    anim: ANIM.run,
    path: [receiver, throwTarget],
    phase: "cover-steal"
  }));
  context.tracks.fielders.push(cue(timing.coverEndT, timing.tagEndT, {
    who: receiver,
    anim: ANIM.catch,
    at: throwTarget,
    toward: "home",
    phase: success ? "late-tag" : "tag"
  }));

  context.durationMs = 3400;
  context.suggestedResultT = 0.59;
}

function addPitch(context, startT, pitchNumber, caught, timeScale = 1) {
  const scale = Math.max(0.1, Number(timeScale) || 1);
  const releaseT = startT + 0.065 * scale;
  const plateT = startT + 0.2 * scale;
  context.tracks.pitcher.push(cue(startT, startT + 0.16 * scale, {
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
    context.tracks.catcher.push(cue(plateT - 0.02 * scale, plateT + 0.055 * scale, {
      anim: ANIM.catcher,
      at: "C",
      pitchNumber,
      phase: "receive"
    }));
  }
}

function resolveFieldingThrowPlan(context, { who, from, to, startT, nominalEndT }) {
  const durationMs = Math.max(1, Number(context.durationMs) || 1);
  const armScore = throwerArmScore(context.event, who);
  const armT = Math.max(0, Math.min(1, (armScore - THROW_ARM_MIN) / (THROW_ARM_MAX - THROW_ARM_MIN)));
  const distance = pointDistance(context.points[from], context.points[to]);
  const pixelsPerSecond = 900 + armT * 700;
  const flightMs = Math.max(170, Math.min(620, distance / pixelsPerSecond * 1000));
  const gatherMs = 190 - armT * 40;
  const earliestReleaseT = startT + gatherMs / durationMs;
  const movement = throwTargetMovement(context, to);
  let endT = Math.max(earliestReleaseT + flightMs / durationMs, Number(nominalEndT) || 0);
  let ordering = "neutral";
  if (movement?.out) {
    endT = Math.min(endT, movement.endT - THROW_OUT_LEAD_T);
    ordering = "out-first";
  } else if (movement) {
    endT = Math.max(endT, movement.endT + THROW_SAFE_LEAD_T);
    ordering = "runner-safe-first";
  }
  endT = roundTime(Math.min(THROW_ARRIVAL_LATEST_T, endT));
  let releaseT = Math.max(earliestReleaseT, endT - flightMs / durationMs);
  releaseT = roundTime(Math.min(releaseT, endT - Math.min(0.035, Math.max(0.018, (endT - startT) * 0.42))));
  const arc = roundTime(0.055 - armT * 0.04);
  return {
    armScore,
    throwClass: armScore >= 150 ? "strong" : armScore <= 75 ? "weak" : "average",
    pixelsPerSecond: Math.round(pixelsPerSecond),
    arc,
    releaseT,
    endT,
    flightMs: Math.round((endT - releaseT) * durationMs),
    ordering,
    runnerArrivalT: movement?.endT ?? null
  };
}

function addFieldingThrow(context, {
  who,
  from,
  to,
  startT,
  plan,
  actorPhase = "throw",
  ballPhase = "fielding-throw"
}) {
  const releaseT = plan.releaseT;
  context.tracks.fielders.push(cue(startT, releaseT + scaleActionTime(context, 0.025), {
    who,
    anim: ANIM.throw,
    at: from,
    toward: to,
    armScore: plan.armScore,
    throwClass: plan.throwClass,
    phase: actorPhase
  }));
  context.tracks.ball.push(cue(releaseT, plan.endT, {
    path: [from, to],
    arc: plan.arc,
    armScore: plan.armScore,
    throwClass: plan.throwClass,
    pixelsPerSecond: plan.pixelsPerSecond,
    flightMs: plan.flightMs,
    ordering: plan.ordering,
    runnerArrivalT: plan.runnerArrivalT,
    phase: ballPhase
  }));
}

function throwerArmScore(event, who) {
  const key = normalizeFielderKey(who);
  const activeKey = normalizeFielderKey(event?.fieldingPosition ?? event?.defenderPosition);
  const profile = key === "P"
    ? event?.pitcherProfile
    : key === activeKey && event?.defenderProfile
      ? event.defenderProfile
      : event?.defenseProfilesByPosition?.[key];
  let score = Number(profile?.arm);
  if (Number.isFinite(score) && score > 0 && score <= 20) score *= 10;
  if (!Number.isFinite(score) || score <= 0) score = Number(profile?.fielding ?? profile?.ovr ?? 100);
  return Math.max(THROW_ARM_MIN, Math.min(THROW_ARM_MAX, Math.round(Number(score) || 100)));
}

function throwTargetMovement(context, target) {
  const phases = new Set(["batter-run", "runner-advance", "slide", "tag-play"]);
  const grouped = new Map();
  for (const cueEntry of [...context.tracks.batter, ...context.tracks.runners]) {
    if (!phases.has(String(cueEntry.phase ?? ""))) continue;
    const cueTarget = cueEntry.at ?? cueEntry.toBase ?? cueEntry.path?.at(-1);
    if (cueTarget !== target) continue;
    const who = String(cueEntry.who ?? cueEntry.runnerId ?? "runner");
    const current = grouped.get(who) ?? { out: false, endT: 0 };
    current.out ||= Boolean(cueEntry.out);
    current.endT = Math.max(current.endT, Number(cueEntry.endT ?? cueEntry.t ?? 0));
    grouped.set(who, current);
  }
  const movements = [...grouped.values()];
  return movements.find((entry) => entry.out)
    ?? movements.sort((a, b) => b.endT - a.endT)[0]
    ?? null;
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
    fieldEndT,
    throwTarget
  });
  if (!receiver) return null;
  return addThrowReceiver(context, {
    primary,
    receiver,
    to: throwTarget,
    throwFrom: landing,
    moveStartT: Math.max(
      scaleActionTime(context, 0.235),
      Math.min(scaleActionTime(context, 0.31), landingT - scaleActionTime(context, 0.1))
    ),
    throwEndT
  });
}

function addDefensiveSupport(context, {
  primary,
  receiver,
  landing,
  landingT,
  fieldEndT,
  throwTarget = null
}) {
  const target = context.points[landing];
  if (!target) return;
  const assignments = defensiveSupportAssignments(context, {
    primary,
    receiver,
    landing,
    throwTarget
  });
  const baseStartT = scaleActionTime(context, 0.245);
  const baseEndT = Math.min(
    fieldEndT + scaleActionTime(context, 0.015),
    landingT + scaleActionTime(context, 0.055)
  );
  for (const [index, assignment] of assignments.entries()) {
    const { key, role, targetKey } = assignment;
    if (!context.points[key] || !context.points[targetKey]) continue;
    const pointName = defensiveSupportPointName(key, role);
    context.points[pointName] = defensiveSupportDestination(context.points, assignment);
    if (pointDistance(context.points[key], context.points[pointName]) < MIN_SUPPORT_ROUTE_PX) continue;

    const roleDelay = role === "relay" ? 0 : role === "base-cover" ? 0.016 : 0.032;
    const roleArrival = role === "relay" ? -0.018 : role === "base-cover" ? -0.004 : 0.012;
    const moveStartT = roundTime(baseStartT + scaleActionTime(context, roleDelay + index * 0.006));
    const moveEndT = roundTime(Math.min(
      0.97,
      Math.max(
        moveStartT + scaleActionTime(context, 0.08),
        baseEndT + scaleActionTime(context, roleArrival + index * 0.004)
      )
    ));
    context.tracks.fielders.push(cue(moveStartT, moveEndT, {
      who: key,
      anim: ANIM.run,
      path: [key, pointName],
      arrivesAt: pointName,
      toward: assignment.toward ?? landing,
      phase: `support-${role}`,
      assignment: role,
      supportTarget: targetKey
    }));
  }
}

function defensiveSupportAssignments(context, { primary, receiver, landing, throwTarget }) {
  const assignments = [];
  const occupied = new Set([primary, receiver].filter(Boolean));
  if (context.template === "doublePlay" && primary === "1B") occupied.add("P");
  const supportLimit = receiver ? 2 : 3;
  const add = (key, role, targetKey, amount, toward = landing) => {
    if (!key || occupied.has(key) || !context.points[key] || !context.points[targetKey]) return;
    occupied.add(key);
    assignments.push({ key, role, targetKey, amount, toward });
  };

  const type = normalizedToken(context.event?.battedBallType);
  const bunt = type.includes("bunt") || context.outcome === "sacrificeBunt";
  const outfieldPrimary = OUTFIELDERS.includes(primary);
  const runnerOnFirst = Boolean(
    context.event?.basesBefore?.[0]
    || context.event?.baseRunnerIdsBefore?.[0]
  );

  if (bunt) {
    if (primary === "C") {
      add("P", "backup", landing, 0.16);
    } else {
      // Once another infielder owns the bunt, the catcher protects the plate
      // instead of charging far enough upfield to be clamped by the scene.
      add("C", "backup", "home", 0.5, landing);
    }
    if (runnerOnFirst) {
      add(selectMiddleCoverFielder(primary, receiver), "base-cover", "second", 0.72, landing);
    }
    add(selectBaseBackupFielder(context.points, "first", primary, receiver, occupied, landing), "backup", "first", 0.18, landing);
  } else if (outfieldPrimary) {
    const adjacentOutfielder = selectOutfieldBackupFielder(context.points, primary, context.points[landing]);
    const cutoff = selectCutoffFielder(context.points, primary, receiver, context.points[landing]);
    if (throwTarget) {
      if (throwTarget === "second") {
        add(selectMiddleCoverFielder(primary, receiver), "base-cover", "second", 0.66, landing);
      } else {
        add(cutoff, "relay", landing, 0.28, throwTarget);
      }
      add(selectBaseBackupFielder(context.points, throwTarget, primary, receiver, occupied, landing), "backup", throwTarget, 0.18, landing);
      add(adjacentOutfielder, "backup", landing, 0.18);
    } else {
      add(adjacentOutfielder, "backup", landing, 0.2);
      add(cutoff, "relay", landing, 0.24);
      if (context.template !== "outfieldOut") add("1B", "base-cover", "first", 0.72, landing);
    }
  } else if (throwTarget) {
    const backupTarget = context.template === "doublePlay" ? "first" : throwTarget;
    add(selectBaseBackupFielder(context.points, backupTarget, primary, receiver, occupied, landing), "backup", backupTarget, 0.18, landing);
    if (runnerOnFirst && throwTarget === "first") {
      add(selectMiddleCoverFielder(primary, receiver), "base-cover", "second", 0.72, landing);
    } else {
      add(selectInfieldBackupOutfielder(primary), "backup", landing, 0.12);
    }
  } else {
    add(selectInfieldBackupOutfielder(primary), "backup", landing, 0.12);
    add(selectMiddleCoverFielder(primary, receiver), "relay", landing, 0.16);
  }

  return assignments.slice(0, supportLimit);
}

function selectOutfieldBackupFielder(points, primary, landing) {
  const candidates = primary === "LF"
    ? ["CF", "RF"]
    : primary === "RF"
      ? ["CF", "LF"]
      : Number(landing?.x ?? points.second?.x ?? 0) < Number(points.second?.x ?? 0)
        ? ["LF", "RF"]
        : ["RF", "LF"];
  return candidates.find((key) => points[key]) ?? "";
}

function selectCutoffFielder(points, primary, receiver, landing) {
  const secondX = Number(points.second?.x ?? 0);
  const leftSide = primary === "LF" || Number(landing?.x ?? secondX) < secondX;
  const candidates = leftSide ? ["SS", "2B"] : ["2B", "SS"];
  return candidates.find((key) => key !== primary && key !== receiver && points[key]) ?? "";
}

function selectMiddleCoverFielder(primary, receiver) {
  return ["2B", "SS"].find((key) => key !== primary && key !== receiver) ?? "";
}

function selectBaseBackupFielder(points, target, primary, receiver, occupied = new Set(), toward = "") {
  const candidates = {
    first: ["P", "2B", "RF"],
    second: ["SS", "2B", "CF"],
    third: ["P", "SS", "LF"],
    home: ["P", "1B", "3B"]
  }[target] ?? ["P", "CF"];
  return candidates
    .filter((key) => key !== primary && key !== receiver && !occupied.has(key) && points[key])
    .map((key, order) => {
      const destination = baseBackupDestination(points, key, target, toward);
      return {
        key,
        order,
        targetDistance: pointDistance(destination, points[target]),
        routeDistance: pointDistance(destination, points[key])
      };
    })
    .filter(({ targetDistance, routeDistance }) => (
      targetDistance <= BASE_BACKUP_MAX_DISTANCE_PX
      && routeDistance >= MIN_SUPPORT_ROUTE_PX
    ))
    .sort((a, b) => a.targetDistance - b.targetDistance || a.order - b.order)[0]?.key ?? "";
}

function selectInfieldBackupOutfielder(primary) {
  if (["3B", "SS"].includes(primary)) return "LF";
  if (["1B", "2B"].includes(primary)) return "RF";
  return "CF";
}

function addThrowReceiver(context, {
  primary,
  receiver = "",
  to,
  throwFrom = "",
  moveStartT,
  throwEndT,
  phasePrefix = ""
}) {
  const selected = receiver || selectThrowReceiver(context.points, primary, to);
  if (!selected || !context.points[selected] || !context.points[to]) return null;
  const from = selected;
  // A force at first must read as the covering fielder planting a foot on the
  // bag, not as a runner who is still drifting toward it while the ball lands.
  // Give first-base coverage a visible set interval before the catch motion;
  // heldTimelineCue keeps the completed run exactly on the target meanwhile.
  const firstBaseForce = to === "first";
  const arrivalLeadT = scaleActionTime(context, firstBaseForce ? 0.12 : 0.05);
  const catchLeadT = scaleActionTime(context, firstBaseForce ? 0.055 : 0.05);
  const arrivalT = roundTime(Math.max(moveStartT + scaleActionTime(context, 0.08), throwEndT - arrivalLeadT));
  const receiveT = roundTime(Math.max(arrivalT, throwEndT - catchLeadT));
  context.tracks.fielders.push(cue(moveStartT, arrivalT, {
    who: selected,
    anim: ANIM.run,
    path: [from, to],
    arrivesAt: to,
    phase: `${phasePrefix}cover-${to}`,
    assignment: "receiver"
  }));
  context.tracks.fielders.push(cue(receiveT, Math.min(0.99, throwEndT + scaleActionTime(context, 0.04)), {
    who: selected,
    anim: ANIM.catch,
    at: to,
    toward: throwFrom || undefined,
    phase: `${phasePrefix}receive-${to}`,
    assignment: "receiver"
  }));
  return { receiver: selected, arrivalT };
}

function defensiveSupportPointName(key, role) {
  const suffix = String(role).replace(/[^A-Za-z0-9]/g, "");
  return `defenseSupport${String(key).replace(/[^A-Za-z0-9]/g, "")}${suffix}`;
}

function defensiveSupportDestination(points, assignment) {
  const { key, role, targetKey, amount, toward } = assignment;
  if (role === "backup" && BASE_SUPPORT_TARGETS.has(targetKey)) {
    return baseBackupDestination(points, key, targetKey, toward);
  }

  const start = points[key];
  const target = points[targetKey];
  const distance = pointDistance(start, target);
  const purposefulAmount = ["backup", "relay"].includes(role) && distance > 0
    ? Math.max(Number(amount) || 0, Math.min(1, MIN_PURPOSEFUL_SUPPORT_ROUTE_PX / distance))
    : amount;
  return clampDefensiveSupportPoint(
    start,
    interpolatePoint(start, target, purposefulAmount),
    key
  );
}

function baseBackupDestination(points, key, targetKey, towardKey) {
  const start = points[key];
  const target = points[targetKey];
  const incoming = points[towardKey] ?? start;
  if (!start || !target) return start ?? target;

  const deltaX = Number(target.x) - Number(incoming?.x ?? start.x);
  const deltaY = Number(target.y) - Number(incoming?.y ?? start.y);
  const length = Math.hypot(deltaX, deltaY) || 1;
  const desired = {
    ...target,
    x: roundCoordinate(Number(target.x) + deltaX / length * BASE_BACKUP_OFFSET_PX),
    y: roundCoordinate(Number(target.y) + deltaY / length * BASE_BACKUP_OFFSET_PX)
  };
  return clampDefensiveSupportPoint(start, desired, key);
}

function clampDefensiveSupportPoint(anchor, point, key) {
  const zone = DEFENDER_SUPPORT_MOVE_ZONES[key] ?? { x: 54, yTop: 42, yBottom: 44 };
  return {
    ...point,
    x: roundCoordinate(Math.max(Number(anchor.x) - zone.x, Math.min(Number(anchor.x) + zone.x, Number(point.x)))),
    y: roundCoordinate(Math.max(Number(anchor.y) - zone.yTop, Math.min(Number(anchor.y) + zone.yBottom, Number(point.y)))),
    scale: roundCoordinate(Number(point.scale ?? anchor.scale ?? 1))
  };
}

function addBatterAdvance(context, startT, endT, options) {
  const targetBase = Number(options.targetBase ?? 1);
  if (targetBase <= 0) return;
  const path = basePath(0, targetBase);
  const durationMs = Math.max(1, Number(context.durationMs) || 1);
  const paced = options.paceByDistance === true;
  const resolvedEndT = paced
    ? startT + (targetBase * BATTER_RUN_MS_PER_BASE + (options.slide ? BATTER_SLIDE_MS : 0)) / durationMs
    : endT;
  const slideDuration = options.slide
    ? paced
      ? BATTER_SLIDE_MS / durationMs
      : Math.min(0.075, (resolvedEndT - startT) * 0.18)
    : 0;
  const runEndT = resolvedEndT - slideDuration;
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
    context.tracks.batter.push(cue(runEndT, resolvedEndT, {
      who: "batter",
      anim: ANIM.slide,
      at: path[path.length - 1],
      out: Boolean(options.out),
      phase: "slide"
    }));
  }
}

function addExistingRunnerAdvances(context, startT) {
  const transitions = existingRunnerTransitions(context.event, context.outcome, context.template);
  const durationMs = Math.max(1, Number(context.durationMs) || 1);
  for (const transition of transitions) {
    const distance = Math.max(1, transitionDistance(transition));
    const slide = distance >= 2 || transition.out;
    const slideDuration = slide ? RUNNER_SLIDE_MS / durationMs : 0;
    const endT = startT + (distance * RUNNER_RUN_MS_PER_BASE + (slide ? RUNNER_SLIDE_MS : 0)) / durationMs;
    addRunnerMovement(context, transition, startT, endT, slide, slideDuration);
  }
}

function scaleActionTime(context, value) {
  const scale = Math.max(0.1, Number(context?.actionTimeScale ?? 1));
  return Number(value) * scale;
}

function addRunnerMovement(context, transition, startT, endT, slide, authoredSlideDuration = null) {
  const path = basePath(transition.fromBase, transition.toBase);
  if (path.length < 2) return;
  const slideDuration = slide
    ? Number.isFinite(Number(authoredSlideDuration))
      ? Math.max(0, Number(authoredSlideDuration))
      : Math.min(0.065, (endT - startT) * 0.18)
    : 0;
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
        toBase = Math.min(4, runner.base + 1);
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
        toBase = Math.min(4, runner.base + 1);
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

function selectHomeRunFielderKey(points, wallPoint) {
  return [...OUTFIELDERS]
    .filter((key) => points[key])
    .sort((a, b) => pointDistance(points[a], wallPoint) - pointDistance(points[b], wallPoint))[0]
    ?? firstAvailableAnchor(points, OUTFIELDERS);
}

function selectThrowReceiver(points, primary, target) {
  const candidates = {
    first: ["1B", "P", "2B"],
    second: primary === "LF" ? ["SS", "2B", "CF"] : ["2B", "SS", "CF"],
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
  const type = normalizedToken(event?.battedBallType);
  const bunt = type.includes("bunt") || normalizedToken(event?.outcome) === "sacrificebunt";
  const ground = type.includes("ground");
  const line = type.includes("line");
  const fly = type.includes("fly");
  const outfield = OUTFIELDERS.includes(fielderKey);
  const towardHome = bunt
    ? (fielderKey === "C" ? 0.56 : 0.22)
    : ground ? (outfield ? 0.2 : 0.22) : line ? 0.13 : 0.08;
  const landing = interpolatePoint(fielder, points.home, towardHome);
  if (!fly) return landing;

  // Never place every fly directly on the defender's starting sprite. A
  // deterministic lateral read makes the chase/catch legible while remaining
  // inside every authored defender movement zone.
  const direction = deterministicUnit(event) < 0 ? -1 : 1;
  const lateral = outfield ? 30 : 8;
  return {
    ...landing,
    x: roundCoordinate(landing.x + direction * lateral),
    y: roundCoordinate(landing.y + (outfield ? 6 : -3))
  };
}

function caughtBallGlovePoint(event, landing) {
  const type = normalizedToken(event?.battedBallType);
  const fly = type.includes("fly");
  return {
    ...landing,
    // Generated and atlas catch poses both present the glove above and just to
    // the right of the player's foot anchor. Line drives are caught nearer the
    // chest; fly balls finish at the raised glove.
    x: roundCoordinate(Number(landing?.x ?? 0) + (fly ? 13 : 10)),
    y: roundCoordinate(Number(landing?.y ?? 0) - (fly ? 38 : 26))
  };
}

function safeFlyMissPoint(event, points, fielderKey, landing) {
  const outfield = OUTFIELDERS.includes(fielderKey);
  const direction = deterministicUnit(event) < 0 ? -1 : 1;
  return {
    ...landing,
    x: roundCoordinate(landing.x + direction * (outfield ? 25 : 7)),
    y: roundCoordinate(landing.y - (outfield ? 10 : 4))
  };
}

function safeFlyPickupPoint(points, fielderKey, landing) {
  const outfield = OUTFIELDERS.includes(fielderKey);
  return interpolatePoint(landing, points.home, outfield ? 0.018 : 0.008);
}

function safeBallFieldingStyle(context, fielderKey, landing, trajectory) {
  const start = context.points[fielderKey];
  const routeDistance = pointDistance(start, landing);
  const outcomePressure = {
    double: 10,
    triple: 18,
    error: 7
  }[context.outcome] ?? 0;
  // Distance and extra-base pressure carry most of the decision. The stable
  // event seed only breaks up otherwise identical balls, so replaying an event
  // always produces the same read rather than random dives.
  const seededPressure = (deterministicUnit(context.event) + 1) * 6;
  const challenge = routeDistance + outcomePressure + seededPressure;
  const diveThreshold = trajectory === "fly" ? 58 : 61;
  return challenge >= diveThreshold ? "dive" : trajectory === "fly" ? "run-through" : "short-hop";
}

function outfieldFieldingDelayMs(event, fielderKey, template) {
  if (!OUTFIELDERS.includes(fielderKey) || ["infieldOut", "doublePlay"].includes(template)) return 0;
  const type = normalizedToken(event?.battedBallType);
  if (template === "outfieldOut" && type.includes("ground")) return 0;
  if (type.includes("ground")) return OUTFIELD_FIELDING_DELAY_MS.ground;
  if (type.includes("line")) return OUTFIELD_FIELDING_DELAY_MS.line;
  if (type.includes("fly")) return OUTFIELD_FIELDING_DELAY_MS.fly;
  return OUTFIELD_FIELDING_DELAY_MS.default;
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
  if (type.includes("bunt") || normalizedToken(event?.outcome) === "sacrificebunt") return 0.015;
  if (type.includes("ground")) return 0.04;
  if (type.includes("line")) return 0.35;
  return 0.78;
}

function isBuntPlay(context) {
  return context?.outcome === "sacrificeBunt"
    || normalizedToken(context?.event?.battedBallType).includes("bunt");
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
  if (isValidDoublePlayEvent(event)) return "doublePlay";
  return isOutfieldBall(event) ? "outfieldOut" : "infieldOut";
}

function isValidDoublePlayEvent(event) {
  if (event?.doublePlay !== true) return false;
  if (!normalizedToken(event?.battedBallType).includes("ground")) return false;
  const outsBefore = Number(event?.outsBefore);
  const outsAfter = Number(event?.outsAfter);
  if (!Number.isFinite(outsBefore) || !Number.isFinite(outsAfter) || outsAfter - outsBefore < 2) return false;
  return baseOccupants(event, "Before").some((runner) => runner.base === 1);
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
  const resultT = roundTime(Math.min(0.99, Math.max(
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
