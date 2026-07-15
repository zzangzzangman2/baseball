import {
  GAMECAST2_DESIGN_H,
  GAMECAST2_DESIGN_W,
  getGamecast2UrlOptions,
  normalizeGamecast2Anchors,
  selectGamecast2Field
} from "./assets.js";

const DEFENSE_ANCHORS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const OUTFIELD_ANCHORS = new Set(["LF", "CF", "RF"]);
const FIELD_EDGE_PADDING = 8;
const DEFENDER_MOVE_ZONES = {
  P: { x: 10, yTop: 6, yBottom: 10 },
  C: { x: 14, yTop: 10, yBottom: 8 },
  "1B": { x: 54, yTop: 42, yBottom: 44 },
  "2B": { x: 58, yTop: 46, yBottom: 44 },
  "3B": { x: 54, yTop: 42, yBottom: 44 },
  SS: { x: 58, yTop: 46, yBottom: 44 },
  LF: { x: 96, yTop: 58, yBottom: 64 },
  CF: { x: 116, yTop: 62, yBottom: 68 },
  RF: { x: 96, yTop: 58, yBottom: 64 }
};
const PLAYER_TEXTURE_KEYS = {
  defense: {
    idle: "gamecast2-player-defense-idle",
    ready: "gamecast2-player-defense-ready",
    run1: "gamecast2-player-defense-run1",
    run2: "gamecast2-player-defense-run2",
    catch: "gamecast2-player-defense-catch",
    throw: "gamecast2-player-defense-throw"
  },
  pitcher: {
    idle: "gamecast2-player-pitcher-idle",
    windup: "gamecast2-player-pitcher-windup",
    release: "gamecast2-player-pitcher-release"
  },
  catcher: {
    idle: "gamecast2-player-catcher-idle",
    catch: "gamecast2-player-catcher-catch"
  },
  batter: {
    stance: "gamecast2-player-batter-stance",
    load: "gamecast2-player-batter-load",
    swing: "gamecast2-player-batter-swing",
    follow: "gamecast2-player-batter-follow",
    run1: "gamecast2-player-batter-run1",
    run2: "gamecast2-player-batter-run2"
  },
  ball: "gamecast2-ball"
};

export function canUseGamecast2() {
  return typeof window !== "undefined" && Boolean(window.Phaser?.Game);
}

export function mountGamecast2(options) {
  if (!canUseGamecast2() || !options?.canvas || !options?.screen) return null;

  const Phaser = window.Phaser;
  const urlOptions = getGamecast2UrlOptions();
  const field = selectGamecast2Field(options.fieldProfile, options.fieldId || urlOptions.fieldId);
  const runtime = {
    ...options,
    Phaser,
    field,
    debugAnchors: Boolean(options.debugAnchors ?? urlOptions.debugAnchors),
    width: GAMECAST2_DESIGN_W,
    height: GAMECAST2_DESIGN_H,
    elapsedMs: Math.max(0, Number(options.elapsedMs ?? 0)),
    playbackRate: Number(options.playbackRate ?? 1),
    done: false,
    paused: false,
    currentFrame: null,
    scene: null,
    game: null,
    resizeObserver: null,
    anchors: null,
    metrics: null
  };

  runtime.metrics = calculateMetrics(runtime);
  applyCanvasContract(runtime);

  const sceneConfig = {
    preload() {
      this.load.image(field.id, field.imageUrl);
      this.load.json(`${field.id}-anchors`, field.anchorsUrl);
    },
    create() {
      createScene(this, runtime);
      renderRuntimeFrame(runtime, runtime.prefersReducedMotion);
      if (runtime.prefersReducedMotion || !runtime.sequence?.events?.length) {
        finishRuntime(runtime);
      }
    },
    update(_time, delta) {
      updateRuntime(runtime, delta);
    }
  };

  runtime.game = new Phaser.Game({
    type: Phaser.CANVAS,
    canvas: runtime.canvas,
    width: runtime.metrics.bufferW,
    height: runtime.metrics.bufferH,
    backgroundColor: "#07120f",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    banner: false,
    parent: runtime.stage ?? runtime.screen,
    scale: { mode: Phaser.Scale.NONE },
    fps: { target: 60 },
    scene: sceneConfig
  });
  adoptPhaserCanvas(runtime);

  runtime.resizeObserver = typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(() => resizeRuntime(runtime))
    : null;
  runtime.resizeObserver?.observe(runtime.screen);
  window.requestAnimationFrame?.(() => resizeRuntime(runtime));

  return {
    setSpeed(speed) {
      runtime.playbackRate = Number(speed) || 1;
      if (!runtime.done && runtime.paused === false) startRuntimeLoop(runtime);
    },
    seek(elapsedMs) {
      runtime.elapsedMs = Math.max(0, Math.min(getRuntimeTotalMs(runtime), Number(elapsedMs) || 0));
      renderRuntimeFrame(runtime, false);
    },
    finish() {
      finishRuntime(runtime);
    },
    pause() {
      runtime.paused = true;
      stopRuntimeLoop(runtime);
      const frame = runtime.currentFrame ?? runtime.makeFrame?.(runtime.elapsedMs, false);
      if (frame) {
        runtime.currentFrame = frame;
        runtime.onFrame?.({ ...frame, paused: true });
      }
    },
    resume() {
      if (runtime.done) return;
      runtime.paused = false;
      startRuntimeLoop(runtime);
    },
    resize() {
      resizeRuntime(runtime);
    },
    cleanup() {
      runtime.resizeObserver?.disconnect();
      runtime.resizeObserver = null;
      try {
        runtime.game?.destroy(true);
      } catch (_error) {
        // Phaser teardown can race with DOM removal in modal close.
      }
      runtime.game = null;
      runtime.scene = null;
      runtime.screen.removeAttribute("data-gamecast2-field");
      runtime.screen.removeAttribute("data-gamecast2-anchor-count");
      runtime.screen.removeAttribute("data-gamecast2-debug-anchors");
      runtime.screen.removeAttribute("data-gamecast2-defender-count");
      runtime.screen.removeAttribute("data-gamecast2-player-count");
      runtime.screen.removeAttribute("data-gamecast2-moving-defense-count");
      runtime.screen.removeAttribute("data-gamecast2-ball-visible");
      delete runtime.screen.__gamecast2Anchors;
      delete runtime.screen.__gamecast2Players;
      delete runtime.screen.__gamecast2Frame;
    }
  };
}

function calculateMetrics(runtime) {
  const rect = runtime.screen.getBoundingClientRect?.() ?? { width: runtime.width };
  const style = typeof getComputedStyle === "function" ? getComputedStyle(runtime.screen) : null;
  const horizontalInset = style
    ? Number.parseFloat(style.paddingLeft || "0")
      + Number.parseFloat(style.paddingRight || "0")
      + Number.parseFloat(style.borderLeftWidth || "0")
      + Number.parseFloat(style.borderRightWidth || "0")
    : 0;
  const verticalInset = style
    ? Number.parseFloat(style.paddingTop || "0")
      + Number.parseFloat(style.paddingBottom || "0")
      + Number.parseFloat(style.borderTopWidth || "0")
      + Number.parseFloat(style.borderBottomWidth || "0")
    : 0;
  const availableW = Math.max(1, Math.floor((rect.width || runtime.width) - horizontalInset));
  const availableH = Math.max(1, Math.floor((rect.height || runtime.height) - verticalInset));
  const cssScale = Math.max(0.35, Math.min(availableW / runtime.width, availableH / runtime.height));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = Math.round(runtime.width * cssScale);
  const cssH = Math.round(runtime.height * cssScale);
  const bufferW = Math.round(cssW * dpr);
  const bufferH = Math.round(cssH * dpr);
  return {
    cssScale,
    dpr,
    cssW,
    cssH,
    bufferW,
    bufferH,
    drawScaleX: bufferW / runtime.width,
    drawScaleY: bufferH / runtime.height
  };
}

function applyCanvasContract(runtime) {
  const { canvas, stage, metrics, width, height } = runtime;
  canvas.classList.add("gamecast-pixel-canvas");
  canvas.dataset.gamecastCanvas = "";
  canvas.dataset.pixelW = String(width);
  canvas.dataset.pixelH = String(height);
  canvas.width = metrics.bufferW;
  canvas.height = metrics.bufferH;
  canvas.style.width = `${metrics.cssW}px`;
  canvas.style.height = `${metrics.cssH}px`;
  canvas.style.imageRendering = "pixelated";
  if (stage) {
    stage.style.width = `${metrics.cssW}px`;
    stage.style.height = `${metrics.cssH}px`;
  }
}

function adoptPhaserCanvas(runtime) {
  const activeCanvas = runtime.game?.canvas;
  if (!activeCanvas || activeCanvas === runtime.canvas) return;
  runtime.canvas.removeAttribute("data-gamecast-canvas");
  runtime.canvas.classList.remove("gamecast-pixel-canvas");
  runtime.canvas.style.display = "none";
  if (runtime.stage && activeCanvas.parentElement !== runtime.stage) {
    runtime.stage.insertBefore(activeCanvas, runtime.stage.firstChild);
  }
  runtime.canvas = activeCanvas;
  applyCanvasContract(runtime);
}

function createScene(scene, runtime) {
  runtime.scene = scene;
  scene.cameras.main.roundPixels = true;
  scene.fieldLayer = scene.add.container(0, 0).setDepth(0);
  scene.playerObjects = [];
  scene.playerActors = [];
  scene.playerMap = new Map();
  scene.ballSprite = null;
  scene.ballTrail = null;
  scene.abilityGraphics = scene.add.graphics().setDepth(500);
  scene.anchorGraphics = scene.add.graphics().setDepth(30000);
  scene.anchorLabels = [];

  const rawAnchors = scene.cache.json.get(`${runtime.field.id}-anchors`);
  runtime.anchors = normalizeGamecast2Anchors(rawAnchors);
  rebuildField(scene, runtime);
}

function rebuildField(scene, runtime) {
  scene.fieldLayer.removeAll(true);
  clearStaticPlayers(scene);
  const field = scene.add.image(0, 0, runtime.field.id)
    .setOrigin(0)
    .setScale(runtime.metrics.drawScaleX, runtime.metrics.drawScaleY);
  scene.fieldLayer.add(field);
  rebuildStaticPlayers(scene, runtime);
  drawAnchorOverlay(scene, runtime);
  exposeSceneDebug(runtime);
}

function clearStaticPlayers(scene) {
  for (const object of scene.playerObjects ?? []) object.destroy();
  scene.ballSprite?.destroy();
  scene.ballTrail?.destroy();
  scene.abilityGraphics?.clear();
  scene.playerObjects = [];
  scene.playerActors = [];
  scene.playerMap = new Map();
  scene.ballSprite = null;
  scene.ballTrail = null;
}

function rebuildStaticPlayers(scene, runtime) {
  const anchors = runtime.anchors?.anchors ?? {};
  ensurePlayerTextures(scene, runtime);
  for (const key of DEFENSE_ANCHORS) {
    const anchor = anchors[key];
    if (!anchor) continue;
    const role = key === "P" ? "pitcher" : key === "C" ? "catcher" : "defense";
    addStaticActor(scene, runtime, {
      key,
      fieldingKey: key,
      role,
      texture: textureForRole(role, "idle"),
      design: anchor,
      isDefender: true
    });
  }

  const batter = derivePlateActor(anchors, "batter");
  if (batter) {
    addStaticActor(scene, runtime, {
      key: "batter",
      role: "batter",
      texture: textureForRole("batter", "stance"),
      design: batter
    });
  }

  scene.ballTrail = scene.add.graphics().setDepth(24000);
  scene.ballSprite = scene.add.image(0, 0, PLAYER_TEXTURE_KEYS.ball)
    .setOrigin(0.5)
    .setVisible(false)
    .setDepth(25000);

  sortStaticPlayers(scene);
  updateGamecast2Playback(runtime, runtime.currentFrame);
}

function addStaticActor(scene, runtime, actor) {
  const sx = runtime.metrics.drawScaleX;
  const sy = runtime.metrics.drawScaleY;
  const scale = Math.max(0.5, Number(actor.design?.scale ?? 1));
  const renderScale = Math.min(sx, sy) * scale;
  const sprite = scene.add.image(actor.design.x * sx, actor.design.y * sy, actor.texture)
    .setOrigin(0.5, 0.94)
    .setScale(renderScale)
    .setDepth(Math.round(actor.design.y * 10));
  sprite.setDataEnabled?.();
  sprite.setData?.("gamecast2Role", actor.role);
  sprite.setData?.("gamecast2Key", actor.key);
  sprite.__gamecast2Actor = {
    key: actor.key,
    fieldingKey: actor.fieldingKey ?? "",
    role: actor.role,
    isDefender: Boolean(actor.isDefender),
    isOutfielder: OUTFIELD_ANCHORS.has(actor.fieldingKey),
    designX: actor.design.x,
    designY: actor.design.y,
    anchorScale: scale,
    baseX: actor.design.x * sx,
    baseY: actor.design.y * sy,
    baseScale: renderScale,
    phase: actorPhase(actor.key)
  };
  scene.playerObjects.push(sprite);
  scene.playerActors.push(sprite.__gamecast2Actor);
  scene.playerMap.set(actor.key, sprite);
  return sprite;
}

function sortStaticPlayers(scene) {
  scene.playerObjects.sort((a, b) => {
    const ay = Number(a.__gamecast2Actor?.designY ?? 0);
    const by = Number(b.__gamecast2Actor?.designY ?? 0);
    return ay - by;
  });
  scene.playerObjects.forEach((sprite, index) => sprite.setDepth(Math.round((sprite.__gamecast2Actor?.designY ?? 0) * 10) + index));
}

function updateGamecast2Playback(runtime, frame = null) {
  updateStaticPlayerIdle(runtime, frame);
  updateBallFlight(runtime, frame);
  exposeMotionDebug(runtime, frame);
}

function updateStaticPlayerIdle(runtime, frame = null) {
  const scene = runtime.scene;
  if (!scene?.playerObjects?.length) {
    scene?.abilityGraphics?.clear();
    return;
  }
  const elapsed = Number(runtime.elapsedMs ?? 0);
  const pixel = Math.max(1, Math.round(runtime.metrics.drawScaleY));
  const play = buildVisualPlay(runtime, frame);
  for (const sprite of scene.playerObjects) {
    const actor = sprite.__gamecast2Actor;
    if (!actor) continue;
    const state = play.actors.get(actor.key) ?? {};
    const idleT = elapsed / 430 + actor.phase;
    const bob = actor.role === "catcher" ? 0 : Math.sin(idleT) * pixel * 0.55 * actor.anchorScale;
    const pose = state.pose ?? defaultPoseForActor(actor);
    const rawPosition = state.position ?? { x: actor.designX, y: actor.designY };
    const position = clampActorDesignPosition(actor, rawPosition, runtime);
    const renderX = position.x * runtime.metrics.drawScaleX;
    const renderY = position.y * runtime.metrics.drawScaleY;
    const designScale = Math.max(0.5, Number(position.scale ?? actor.anchorScale));
    const renderScale = Math.min(runtime.metrics.drawScaleX, runtime.metrics.drawScaleY) * designScale;
    const lean = Number(state.angle ?? (actor.role === "batter" ? Math.sin(idleT * 0.58) * 1.5 : 0));
    sprite.setTexture(textureForRole(actor.role, pose));
    sprite.setPosition(renderX, renderY + (state.position ? 0 : bob));
    sprite.setScale(renderScale * (1 + Math.sin(idleT * 0.5) * 0.012), renderScale);
    sprite.setAngle(lean);
    sprite.setDepth(Math.round(position.y * 10) + (actor.key === "batter" ? 8 : 0));
    actor.currentDesignX = position.x;
    actor.currentDesignY = position.y;
    actor.currentDesignScale = designScale;
    actor.currentRenderScale = renderScale;
  }
  updateAbilityPlates(runtime, frame, play);
}

function updateAbilityPlates(runtime, frame = null, play = null) {
  const scene = runtime.scene;
  const graphics = scene?.abilityGraphics;
  if (!graphics) return;
  graphics.clear();
  const event = frame?.event;
  const minScale = Math.min(runtime.metrics.drawScaleX, runtime.metrics.drawScaleY);
  const ratingTokens = [];
  for (const sprite of scene.playerObjects ?? []) {
    const actor = sprite.__gamecast2Actor;
    const ability = gamecast2AbilityForActor(event, actor);
    if (!actor || !ability?.grade || !ability?.color || !sprite.visible) {
      continue;
    }
    const activeFieldingKey = String(event?.fieldingPosition ?? event?.defenderPosition ?? play?.fielderKey ?? "").toUpperCase();
    const active = actor.key === "batter"
      || actor.fieldingKey === "P"
      || actor.fieldingKey === activeFieldingKey;
    const designScale = Math.max(0.5, Number(actor.currentDesignScale ?? actor.anchorScale ?? 1));
    const width = Math.max(14, Math.round((active ? 20 : 17) * minScale * designScale));
    const height = Math.max(6, Math.round((active ? 8 : 7) * minScale * Math.max(0.82, designScale)));
    const left = Math.round(sprite.x - width / 2);
    const top = Math.round(sprite.y - height * 0.58);
    const color = hexToColor(ability.color, "#64748b");
    graphics.fillStyle(0x061018, active ? 0.92 : 0.78);
    graphics.fillRoundedRect(left - 2, top - 2, width + 4, height + 4, Math.max(2, Math.round(height / 2)));
    graphics.fillStyle(color, active ? 0.96 : 0.72);
    graphics.fillRoundedRect(left, top, width, height, Math.max(2, Math.round(height / 2)));
    graphics.fillStyle(0x102737, 0.96);
    graphics.fillRoundedRect(left + 2, top + 2, Math.max(2, width - 4), Math.max(2, height - 4), Math.max(1, Math.round((height - 4) / 2)));
    drawGamecast2GradeGlyph(graphics, String(ability.grade).slice(0, 1), left + width - 5, top + 1, color);
    actor.abilityGrade = String(ability.grade);
    actor.abilityColor = String(ability.color);
    actor.abilityScore = Number(ability.score ?? 0);
    actor.playerId = String(ability.playerId ?? "");
    actor.abilityActive = active;
    ratingTokens.push({
      role: String(actor.fieldingKey || actor.role || actor.key),
      playerId: actor.playerId,
      ovr: actor.abilityScore,
      tier: actor.abilityGrade,
      color: actor.abilityColor,
      x: Number(actor.currentDesignX ?? actor.designX),
      y: Number(actor.currentDesignY ?? actor.designY),
      width: width / Math.max(0.01, runtime.metrics.drawScaleX),
      height: height / Math.max(0.01, runtime.metrics.drawScaleY),
      active
    });
  }
  runtime.gamecast2RatingTokens = ratingTokens;
  runtime.screen.dataset.gamecastAbilityUnderlays = String(ratingTokens.length);
}

function drawGamecast2GradeGlyph(graphics, grade, x, y, color) {
  const pattern = {
    S: ["111", "100", "111", "001", "111"],
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["111", "100", "100", "100", "111"],
    D: ["110", "101", "101", "101", "110"]
  }[grade];
  if (!pattern) return;
  graphics.fillStyle(color, 1);
  for (let row = 0; row < pattern.length; row += 1) {
    for (let column = 0; column < pattern[row].length; column += 1) {
      if (pattern[row][column] === "1") graphics.fillRect(x + column, y + row, 1, 1);
    }
  }
}

function gamecast2AbilityForActor(event, actor) {
  if (!event || !actor) return null;
  if (actor.key === "batter") return event.hitterAbility ?? null;
  const key = String(actor.fieldingKey || actor.key || "").toUpperCase();
  if (key === "P") return event.pitcherAbility ?? event.defenseAbilityByPosition?.P ?? null;
  const activeKey = String(event.fieldingPosition ?? event.defenderPosition ?? "").toUpperCase();
  if (key && key === activeKey && event.defenderAbility) return event.defenderAbility;
  return event.defenseAbilityByPosition?.[key] ?? null;
}

function defaultPoseForActor(actor) {
  if (actor.role === "batter") return "stance";
  if (actor.role === "catcher") return "idle";
  if (actor.role === "pitcher") return "idle";
  return "idle";
}

function buildVisualPlay(runtime, frame = null) {
  const actors = new Map();
  const event = frame?.event;
  const progress = clamp01(Number(frame?.progress ?? 0));
  const anchors = runtime.anchors?.anchors ?? {};
  if (!event || frame?.done) return { actors, movingDefenseCount: 0 };

  const pitchEnd = pitchEndForEvent(event);
  const batted = isBattedBallOutcome(event.outcome);
  const runnerStart = runnerStartForEvent(event);
  const catchTime = fieldingCatchTime(event);
  const throwStart = throwStartTime(event);
  const throwEnd = throwEndTime(event);
  const battedTarget = batted ? battedBallTargetForEvent(event, anchors) : null;
  const fielderKey = batted ? fieldingKeyForEvent(event, anchors, battedTarget) : "";
  const fieldSpot = fielderKey ? fieldingSpotForEvent(event, anchors, fielderKey) : null;

  actors.set("P", {
    pose: progress < pitchEnd - 0.13 ? "windup" : progress < pitchEnd + 0.04 ? "release" : "idle",
    angle: progress < pitchEnd ? -3 : 0
  });

  if (batted) {
    if (progress < pitchEnd - 0.08) actors.set("batter", { pose: "load", angle: -3 });
    else if (progress < pitchEnd + 0.12) actors.set("batter", { pose: "swing", angle: 4 });
    else if (progress < runnerStart) actors.set("batter", { pose: "follow", angle: 2 });
    else {
      actors.set("batter", {
        pose: Math.floor(progress * 18) % 2 ? "run1" : "run2",
        position: batterRunPosition(anchors, event, progress, runnerStart),
        angle: 0
      });
    }
  } else if (event.outcome === "walk") {
    actors.set("batter", progress < pitchEnd ? { pose: "stance" } : {
      pose: Math.floor(progress * 16) % 2 ? "run1" : "run2",
      position: batterRunPosition(anchors, event, progress, runnerStart)
    });
  } else if (event.outcome === "strikeout") {
    actors.set("batter", progress < pitchEnd ? { pose: "load" } : { pose: "follow", angle: -8 });
  } else {
    actors.set("batter", { pose: progress < pitchEnd ? "load" : "stance" });
  }

  actors.set("C", {
    pose: !batted && progress >= pitchEnd - 0.02 && progress < Math.min(0.85, pitchEnd + 0.28) ? "catch" : "idle"
  });

  for (const key of DEFENSE_ANCHORS) {
    if (key === "P" || key === "C") continue;
    if (batted && progress >= pitchEnd - 0.02) actors.set(key, { pose: "ready" });
  }

  let movingDefenseCount = 0;
  if (fielderKey && fieldSpot) {
    const homeRun = event.outcome === "homeRun";
    const routeStart = pitchEnd + 0.06;
    const routeEnd = homeRun ? Math.min(0.8, ballFlightEndTime(event) - 0.04) : catchTime;
    const routeT = clamp01((progress - routeStart) / Math.max(0.01, routeEnd - routeStart));
    const actor = anchors[fielderKey];
    const position = actor && progress >= routeStart
      ? clampDefenderDesignPoint(
          curvedRoute(actor, fieldSpot, easeInOutCubic(routeT), eventNoise(event, 71) * 18),
          anchors,
          fielderKey
        )
      : null;
    if (position && progress < (homeRun ? 0.96 : throwEnd)) movingDefenseCount = 1;
    const pose = homeRun
      ? progress < routeStart
        ? "ready"
        : progress < routeEnd
          ? (Math.floor(progress * 18) % 2 ? "run1" : "run2")
          : "ready"
      : progress < routeStart
        ? "ready"
        : progress < catchTime
          ? (Math.floor(progress * 18) % 2 ? "run1" : "run2")
          : progress < throwStart
            ? "catch"
            : progress < throwEnd
              ? "throw"
              : "ready";
    actors.set(fielderKey, {
      pose,
      position: progress >= routeStart && progress < (homeRun ? 0.96 : throwEnd) ? position : null,
      angle: !homeRun && pose === "throw" ? (fieldSpot.x < Number(anchors.home?.x ?? 480) ? -7 : 7) : 0
    });
  }

  return { actors, fielderKey, fieldSpot, movingDefenseCount };
}

function updateBallFlight(runtime, frame = null) {
  const scene = runtime.scene;
  if (!scene?.ballSprite || !scene.ballTrail) return;
  const ball = buildBallState(runtime, frame);
  scene.ballTrail.clear();
  if (!ball) {
    scene.ballSprite.setVisible(false);
    return;
  }
  const sx = runtime.metrics.drawScaleX;
  const sy = runtime.metrics.drawScaleY;
  const scale = Math.max(0.7, Math.min(sx, sy) * Number(ball.scale ?? 1));
  scene.ballSprite
    .setVisible(true)
    .setPosition(ball.x * sx, ball.y * sy)
    .setScale(scale)
    .setDepth(Math.round(ball.y * 10) + 12000);
  if (ball.trail?.length > 1) {
    scene.ballTrail.lineStyle(Math.max(1, Math.round(2 * Math.min(sx, sy))), 0xfff6c7, 0.72);
    scene.ballTrail.beginPath();
    scene.ballTrail.moveTo(ball.trail[0].x * sx, ball.trail[0].y * sy);
    for (const point of ball.trail.slice(1)) scene.ballTrail.lineTo(point.x * sx, point.y * sy);
    scene.ballTrail.strokePath();
  }
}

function buildBallState(runtime, frame = null) {
  const event = frame?.event;
  if (!event || frame?.done) return null;
  const anchors = runtime.anchors?.anchors ?? {};
  const progress = clamp01(Number(frame?.progress ?? 0));
  const pitchEnd = pitchEndForEvent(event);
  const mound = anchors.P ?? anchors.mound;
  const home = anchors.home;
  const catcher = anchors.C ?? home;
  if (!mound || !home) return null;
  const pitchStart = 0.04;
  if (progress < pitchStart) return null;
  if (progress <= pitchEnd) {
    const t = easeInCubic(clamp01((progress - pitchStart) / Math.max(0.01, pitchEnd - pitchStart)));
    return {
      ...lerpPoint(mound, home, t),
      scale: 1.05,
      trail: sampleLine(mound, home, t, 5)
    };
  }

  if (!isBattedBallOutcome(event.outcome)) {
    const t = clamp01((progress - pitchEnd) / 0.16);
    if (progress > Math.min(0.92, pitchEnd + 0.32)) return null;
    return {
      ...lerpPoint(home, catcher, easeOutCubic(t)),
      scale: 0.95,
      trail: sampleLine(home, catcher, t, 3)
    };
  }

  const target = battedBallTargetForEvent(event, anchors);
  const flightEnd = ballFlightEndTime(event);
  if (progress <= flightEnd) {
    const t = easeOutCubic(clamp01((progress - pitchEnd) / Math.max(0.01, flightEnd - pitchEnd)));
    const point = arcPoint(home, target, t, battedBallArc(event));
    return {
      ...point,
      scale: event.outcome === "homeRun" ? 0.92 : 1,
      trail: sampleArc(home, target, t, battedBallArc(event), 6)
    };
  }

  if (event.outcome === "homeRun") return null;
  const play = buildVisualPlay(runtime, frame);
  const throwStart = throwStartTime(event);
  const throwEnd = throwEndTime(event);
  if (!play.fieldSpot || progress > throwEnd) return null;
  if (progress < throwStart) {
    return {
      ...play.fieldSpot,
      scale: 0.74,
      trail: []
    };
  }
  const throwTarget = throwTargetForEvent(event, anchors);
  const t = easeInOutCubic(clamp01((progress - throwStart) / Math.max(0.01, throwEnd - throwStart)));
  return {
    ...lerpPoint(play.fieldSpot, throwTarget, t),
    scale: 0.9,
    trail: sampleLine(play.fieldSpot, throwTarget, t, 5)
  };
}

function exposeMotionDebug(runtime, frame = null) {
  const play = buildVisualPlay(runtime, frame);
  const ballVisible = Boolean(runtime.scene?.ballSprite?.visible);
  const positionGuard = collectGamecast2PositionGuard(runtime);
  runtime.screen.dataset.gamecast2MovingDefenseCount = String(play.movingDefenseCount ?? 0);
  runtime.screen.dataset.gamecast2BallVisible = ballVisible ? "1" : "0";
  runtime.screen.dataset.gamecast2PositionViolations = String(positionGuard.violations.length);
  runtime.screen.dataset.gamecastAbilityUnderlays = String(runtime.gamecast2RatingTokens?.length ?? 0);
  runtime.screen.__gamecast2Frame = {
    eventId: String(frame?.event?.id ?? ""),
    outcome: String(frame?.event?.outcome ?? ""),
    progress: Number(frame?.progress ?? 0),
    movingDefenseCount: play.movingDefenseCount ?? 0,
    ballVisible,
    positionGuard,
    ratingTokens: runtime.gamecast2RatingTokens ?? []
  };
}

function pitchEndForEvent(_event) {
  return 0.3;
}

function runnerStartForEvent(event) {
  if (event?.outcome === "walk") return 0.46;
  if (event?.outcome === "homeRun") return 0.5;
  return 0.42;
}

function ballFlightEndTime(event) {
  if (event?.outcome === "homeRun") return 0.82;
  if (event?.outcome === "triple") return 0.74;
  if (event?.outcome === "double") return 0.68;
  return 0.62;
}

function fieldingCatchTime(event) {
  if (event?.outcome === "triple") return 0.75;
  if (event?.outcome === "double") return 0.7;
  return 0.64;
}

function throwStartTime(event) {
  return Math.min(0.82, fieldingCatchTime(event) + 0.08);
}

function throwEndTime(event) {
  return Math.min(0.92, throwStartTime(event) + 0.16);
}

function isBattedBallOutcome(outcome) {
  return ["single", "double", "triple", "homeRun", "out", "error"].includes(String(outcome ?? ""));
}

function fieldingKeyForEvent(event, anchors, target = null) {
  const explicit = String(event?.fieldingPosition ?? event?.defenderPosition ?? "").toUpperCase();
  if (DEFENSE_ANCHORS.includes(explicit)) return explicit;
  if (event?.outcome === "homeRun" && target) {
    return ["LF", "CF", "RF"]
      .filter((key) => anchors[key])
      .sort((a, b) => Math.abs(Number(anchors[a].x) - Number(target.x)) - Math.abs(Number(anchors[b].x) - Number(target.x)))[0] ?? "CF";
  }
  const type = String(event?.battedBallType ?? "").toLowerCase();
  const lane = eventNoise(event, 4);
  if (type.includes("ground") || (event?.outcome === "out" && lane > -0.35 && lane < 0.35)) {
    if (lane < -0.45) return anchors["3B"] ? "3B" : "SS";
    if (lane < 0.05) return anchors.SS ? "SS" : "2B";
    if (lane < 0.45) return anchors["2B"] ? "2B" : "SS";
    return anchors["1B"] ? "1B" : "2B";
  }
  if (lane < -0.32) return "LF";
  if (lane > 0.32) return "RF";
  return "CF";
}

function fieldingSpotForEvent(event, anchors, key) {
  const anchor = anchors[key];
  const home = anchors.home;
  if (!anchor || !home) return anchor ?? home ?? { x: 480, y: 420 };
  if (event?.outcome === "homeRun" && OUTFIELD_ANCHORS.has(key)) {
    const wallTarget = battedBallTargetForEvent(event, anchors);
    const x = lerp(anchor.x, wallTarget.x, 0.62);
    return clampDefenderDesignPoint({
      x,
      y: outfieldPlayableMinY(anchors, x) + 6,
      scale: lerp(Number(anchor.scale ?? 1), Number(wallTarget.scale ?? anchor.scale ?? 1), 0.45)
    }, anchors, key);
  }
  const towardHome = normalizeVector(home.x - anchor.x, home.y - anchor.y);
  const lateral = eventNoise(event, 8) * (OUTFIELD_ANCHORS.has(key) ? 34 : 16);
  const depth = OUTFIELD_ANCHORS.has(key) ? 18 + Math.abs(eventNoise(event, 9)) * 22 : 10;
  return clampDefenderDesignPoint({
    x: anchor.x + lateral + towardHome.x * depth,
    y: anchor.y + towardHome.y * depth,
    scale: anchor.scale
  }, anchors, key);
}

function battedBallTargetForEvent(event, anchors) {
  if (event?.outcome === "homeRun") {
    const lane = eventNoise(event, 12);
    const left = anchors.leftPole ?? { x: 40, y: 250 };
    const right = anchors.rightPole ?? { x: 920, y: 250 };
    const center = anchors.CF ?? { x: 480, y: 260 };
    const x = lane < -0.35 ? lerp(left.x, center.x, 0.35) : lane > 0.35 ? lerp(center.x, right.x, 0.65) : center.x + lane * 90;
    const y = Math.min(left.y, right.y, center.y) - 34 - Math.abs(eventNoise(event, 13)) * 18;
    return { x, y, scale: 0.72 };
  }
  const key = fieldingKeyForEvent(event, anchors);
  return fieldingSpotForEvent(event, anchors, key);
}

function throwTargetForEvent(event, anchors) {
  if (event?.outcome === "triple") return anchors.third ?? anchors.second ?? anchors.first ?? anchors.home;
  if (event?.outcome === "double") return anchors.second ?? anchors.first ?? anchors.home;
  return anchors.first ?? anchors.home ?? { x: 720, y: 420 };
}

function batterRunPosition(anchors, event, progress, start) {
  const home = derivePlateActor(anchors, "batter") ?? anchors.home;
  const plate = anchors.home ?? home;
  const first = anchors.first ?? plate;
  const second = anchors.second ?? first;
  const third = anchors.third ?? second;
  const advance = gamecast2AdvanceCount(event?.outcome);
  const route = [home, first, second, third, plate];
  const duration = Math.max(0.12, Math.min(0.94 - start, 0.32 + Math.max(0, advance - 1) * 0.1));
  const routeT = easeInOutCubic(clamp01((progress - start) / duration));
  const traveled = routeT * advance;
  const segment = Math.min(Math.max(0, advance - 1), Math.floor(traveled));
  const localT = clamp01(traveled - segment);
  return arcPoint(route[segment], route[segment + 1], localT, 18);
}

function gamecast2AdvanceCount(outcome) {
  if (outcome === "homeRun") return 4;
  if (outcome === "triple") return 3;
  if (outcome === "double") return 2;
  if (["single", "walk", "error", "out"].includes(String(outcome ?? ""))) return 1;
  return 1;
}

function battedBallArc(event) {
  if (event?.outcome === "homeRun") return 120;
  if (event?.outcome === "triple") return 78;
  if (event?.outcome === "double") return 64;
  if (String(event?.battedBallType ?? "").toLowerCase().includes("ground")) return 8;
  return 42;
}

function clampActorDesignPosition(actor, position, runtime) {
  const point = position ?? { x: actor?.designX ?? GAMECAST2_DESIGN_W / 2, y: actor?.designY ?? GAMECAST2_DESIGN_H / 2 };
  if (actor?.isDefender) {
    return clampDefenderDesignPoint(point, runtime?.anchors?.anchors ?? {}, actor.fieldingKey || actor.key);
  }
  return clampDesignPointToCanvas(point);
}

function clampDefenderDesignPoint(point, anchors, key) {
  const raw = point ?? {};
  const anchor = anchors?.[key];
  let x = Number(raw.x ?? anchor?.x ?? GAMECAST2_DESIGN_W / 2);
  let y = Number(raw.y ?? anchor?.y ?? GAMECAST2_DESIGN_H / 2);
  x = clampNumber(x, FIELD_EDGE_PADDING, GAMECAST2_DESIGN_W - FIELD_EDGE_PADDING);
  y = clampNumber(y, FIELD_EDGE_PADDING, GAMECAST2_DESIGN_H - FIELD_EDGE_PADDING);
  if (anchor) {
    const zone = DEFENDER_MOVE_ZONES[key] ?? { x: 54, yTop: 42, yBottom: 44 };
    x = clampNumber(x, anchor.x - zone.x, anchor.x + zone.x);
    y = clampNumber(y, anchor.y - zone.yTop, anchor.y + zone.yBottom);
    if (OUTFIELD_ANCHORS.has(key)) {
      y = Math.max(y, outfieldPlayableMinY(anchors, x));
    }
  }
  return {
    ...raw,
    x,
    y,
    scale: Number(raw.scale ?? anchor?.scale ?? 1)
  };
}

function clampDesignPointToCanvas(point) {
  return {
    ...point,
    x: clampNumber(Number(point?.x ?? GAMECAST2_DESIGN_W / 2), FIELD_EDGE_PADDING, GAMECAST2_DESIGN_W - FIELD_EDGE_PADDING),
    y: clampNumber(Number(point?.y ?? GAMECAST2_DESIGN_H / 2), FIELD_EDGE_PADDING, GAMECAST2_DESIGN_H - FIELD_EDGE_PADDING)
  };
}

function collectGamecast2PositionGuard(runtime) {
  const scene = runtime?.scene;
  const sx = Number(runtime?.metrics?.drawScaleX ?? 1) || 1;
  const sy = Number(runtime?.metrics?.drawScaleY ?? 1) || 1;
  const anchors = runtime?.anchors?.anchors ?? {};
  const actors = (scene?.playerObjects ?? []).map((sprite) => {
    const actor = sprite.__gamecast2Actor ?? {};
    const point = {
      x: Number(sprite.x ?? 0) / sx,
      y: Number(sprite.y ?? 0) / sy
    };
    const violation = actor.isDefender ? defenderPositionViolation(point, anchors, actor.fieldingKey || actor.key) : "";
    return {
      key: actor.key ?? "",
      fieldingKey: actor.fieldingKey ?? "",
      role: actor.role ?? "",
      x: Math.round(point.x * 100) / 100,
      y: Math.round(point.y * 100) / 100,
      violation
    };
  });
  return {
    violations: actors.filter((actor) => actor.violation),
    actors
  };
}

function defenderPositionViolation(point, anchors, key) {
  const anchor = anchors?.[key];
  if (!anchor) return "";
  const zone = DEFENDER_MOVE_ZONES[key] ?? { x: 54, yTop: 42, yBottom: 44 };
  const x = Number(point?.x ?? 0);
  const y = Number(point?.y ?? 0);
  const tolerance = 1.25;
  if (x < FIELD_EDGE_PADDING - tolerance || x > GAMECAST2_DESIGN_W - FIELD_EDGE_PADDING + tolerance) return "canvas-x";
  if (y < FIELD_EDGE_PADDING - tolerance || y > GAMECAST2_DESIGN_H - FIELD_EDGE_PADDING + tolerance) return "canvas-y";
  if (x < anchor.x - zone.x - tolerance || x > anchor.x + zone.x + tolerance) return "zone-x";
  if (y < anchor.y - zone.yTop - tolerance || y > anchor.y + zone.yBottom + tolerance) return "zone-y";
  if (OUTFIELD_ANCHORS.has(key) && y < outfieldPlayableMinY(anchors, x) - tolerance) return "outfield-wall";
  return "";
}

function outfieldPlayableMinY(anchors, x) {
  return outfieldWallYForDesignX(anchors, x) + 10;
}

function outfieldWallYForDesignX(anchors, x) {
  const left = anchors?.leftPole ?? { x: 38, y: 252 };
  const right = anchors?.rightPole ?? { x: 922, y: 252 };
  const centerAnchor = anchors?.CF ?? { x: GAMECAST2_DESIGN_W / 2, y: 270 };
  const center = {
    x: Number(centerAnchor.x ?? GAMECAST2_DESIGN_W / 2),
    y: Math.min((Number(left.y ?? 252) + Number(right.y ?? 252)) / 2, Number(centerAnchor.y ?? 270) - 16)
  };
  const px = Number(x ?? center.x);
  const from = px < center.x ? left : center;
  const to = px < center.x ? center : right;
  const local = (px - Number(from.x ?? 0)) / Math.max(1, Number(to.x ?? 1) - Number(from.x ?? 0));
  return lerp(Number(from.y ?? center.y), Number(to.y ?? center.y), local);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function curvedRoute(from, to, t, bend = 0) {
  const mid = {
    x: (from.x + to.x) / 2 + bend,
    y: Math.min(from.y, to.y) - Math.abs(bend) * 0.18
  };
  return quadraticPoint(from, mid, to, t);
}

function sampleLine(from, to, t, count) {
  const points = [];
  const safeT = clamp01(t);
  for (let i = 0; i < count; i += 1) {
    const local = clamp01(safeT - (count - i - 1) * 0.06);
    points.push(lerpPoint(from, to, local));
  }
  return points;
}

function sampleArc(from, to, t, lift, count) {
  const points = [];
  const safeT = clamp01(t);
  for (let i = 0; i < count; i += 1) {
    const local = clamp01(safeT - (count - i - 1) * 0.055);
    points.push(arcPoint(from, to, local, lift));
  }
  return points;
}

function arcPoint(from, to, t, lift) {
  const base = lerpPoint(from, to, t);
  return {
    x: base.x,
    y: base.y - Math.sin(clamp01(t) * Math.PI) * lift,
    scale: lerp(Number(from?.scale ?? 1), Number(to?.scale ?? 1), t)
  };
}

function quadraticPoint(a, b, c, t) {
  const ab = lerpPoint(a, b, t);
  const bc = lerpPoint(b, c, t);
  return lerpPoint(ab, bc, t);
}

function lerpPoint(from, to, t) {
  return {
    x: lerp(Number(from?.x ?? 0), Number(to?.x ?? 0), t),
    y: lerp(Number(from?.y ?? 0), Number(to?.y ?? 0), t),
    scale: lerp(Number(from?.scale ?? 1), Number(to?.scale ?? 1), t)
  };
}

function lerp(a, b, t) {
  return a + (b - a) * clamp01(t);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function easeInCubic(t) {
  const v = clamp01(t);
  return v * v * v;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

function easeInOutCubic(t) {
  const v = clamp01(t);
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
}

function eventNoise(event, salt = 0) {
  const seed = `${event?.id ?? ""}|${event?.hitterName ?? ""}|${event?.inning ?? ""}|${event?.sequence ?? ""}|${salt}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * 2 - 1;
}

function derivePlateActor(anchors, role) {
  const home = anchors.home;
  const first = anchors.first;
  const mound = anchors.mound;
  if (!home || !first || !mound) return null;

  const toFirst = normalizeVector(first.x - home.x, first.y - home.y);
  const toMound = normalizeVector(mound.x - home.x, mound.y - home.y);
  const plateStride = Math.max(20, Math.min(32, distance(home, first) * 0.07));
  const forward = Math.max(6, Math.min(12, distance(home, mound) * 0.05));
  if (role === "batter") {
    return {
      x: home.x + toFirst.x * plateStride + toMound.x * forward,
      y: home.y + toFirst.y * plateStride + toMound.y * forward,
      scale: Math.max(0.94, Number(home.scale ?? 1) * 0.98)
    };
  }
  return null;
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function distance(a, b) {
  return Math.hypot(Number(a?.x ?? 0) - Number(b?.x ?? 0), Number(a?.y ?? 0) - Number(b?.y ?? 0));
}

function actorPhase(key) {
  let hash = 0;
  for (const char of String(key)) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash / 997 * Math.PI * 2;
}

function textureForRole(role, pose = "idle") {
  const textures = PLAYER_TEXTURE_KEYS[role] ?? PLAYER_TEXTURE_KEYS.defense;
  if (typeof textures === "string") return textures;
  return textures[pose] ?? textures.idle ?? textures.stance ?? Object.values(textures)[0];
}

function ensurePlayerTextures(scene, runtime) {
  if (scene.textures.exists(PLAYER_TEXTURE_KEYS.defense.idle)) return;
  const palette = runtime.palette ?? {};
  const defense = {
    cap: palette.defenseAccentColor ?? palette.defender ?? "#315288",
    jersey: palette.defenseJerseyColor ?? palette.defenderL ?? "#b9d9f7",
    jerseyShadow: palette.defenseJerseyShadow ?? palette.uniformSh ?? "#d8d0c5",
    pants: palette.uniformAway ?? "#d9d3ca",
    trim: palette.defenseColor ?? palette.defenderSh ?? "#223f68",
    skin: palette.skin ?? "#f2c79a",
    shoes: palette.legs ?? "#2f3040",
    glove: palette.glove ?? "#7a4c2a",
    shadow: palette.shadow ?? "#223f34"
  };
  const catcher = {
    cap: palette.defenseColor ?? palette.defenderSh ?? "#223f68",
    jersey: palette.defenseJerseyColor ?? palette.defenderL ?? "#b9d9f7",
    jerseyShadow: palette.defenseColor ?? palette.defenderSh ?? "#223f68",
    pants: palette.uniformAway ?? "#d9d3ca",
    trim: palette.defenseAccentColor ?? palette.defender ?? "#315288",
    skin: palette.skin ?? "#f2c79a",
    shoes: palette.legs ?? "#2f3040",
    glove: palette.glove ?? "#7a4c2a",
    shadow: palette.shadow ?? "#223f34"
  };
  const batter = {
    cap: palette.offenseAccentColor ?? palette.runner ?? "#c64b74",
    jersey: palette.offenseJerseyColor ?? palette.uniform ?? "#fffefb",
    jerseyShadow: palette.offenseJerseyShadow ?? palette.uniformSh ?? "#e8ded0",
    pants: palette.uniform ?? "#fffefb",
    trim: palette.offenseColor ?? palette.runner ?? "#c64b74",
    skin: palette.skin ?? "#f2c79a",
    shoes: palette.legs ?? "#2f3040",
    glove: palette.bat ?? "#8a5f39",
    shadow: palette.shadow ?? "#223f34"
  };

  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.defense.idle, defense, "fielder-idle");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.defense.ready, defense, "fielder-ready");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.defense.run1, defense, "fielder-run1");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.defense.run2, defense, "fielder-run2");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.defense.catch, defense, "fielder-catch");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.defense.throw, defense, "fielder-throw");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.pitcher.idle, defense, "pitcher-idle");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.pitcher.windup, defense, "pitcher-windup");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.pitcher.release, defense, "pitcher-release");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.catcher.idle, catcher, "catcher-idle");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.catcher.catch, catcher, "catcher-catch");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.batter.stance, batter, "batter-stance");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.batter.load, batter, "batter-load");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.batter.swing, batter, "batter-swing");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.batter.follow, batter, "batter-follow");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.batter.run1, batter, "runner-run1");
  makePlayerTexture(scene, PLAYER_TEXTURE_KEYS.batter.run2, batter, "runner-run2");
  makeBallTexture(scene, PLAYER_TEXTURE_KEYS.ball, palette);
}

function makePlayerTexture(scene, key, colors, pose) {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  const fill = (name, alpha = 1) => graphics.fillStyle(hexToColor(colors[name], "#ffffff"), alpha);
  const rect = (name, x, y, w, h, alpha = 1) => {
    fill(name, alpha);
    graphics.fillRect(x, y, w, h);
  };
  const ellipse = (name, x, y, w, h, alpha = 1) => {
    fill(name, alpha);
    graphics.fillEllipse(x, y, w, h);
  };
  const drawHead = (x = 32, y = 17, brim = 1) => {
    rect("skin", x - 7, y, 14, 11);
    rect("cap", x - 10, y - 6, 20, 7);
    rect("cap", x - 6, y - 9, 14, 5);
    rect("cap", x + (brim > 0 ? 6 : -14), y - 3, 8, 3);
  };
  const drawTorso = (x = 32, y = 30, w = 22, h = 20) => {
    rect("jerseyShadow", x - Math.round(w / 2) - 2, y + 2, w + 4, h);
    rect("jersey", x - Math.round(w / 2), y, w, h);
    rect("trim", x - Math.round(w / 2), y, w, 4);
    rect("trim", x - 2, y, 4, h);
  };
  const drawLegs = (left = [23, 43, 8, 15], right = [35, 43, 8, 15]) => {
    rect("pants", ...left);
    rect("pants", ...right);
    rect("shoes", left[0] - 3, left[1] + left[3] - 1, 14, 4);
    rect("shoes", right[0] - 1, right[1] + right[3] - 1, 14, 4);
  };

  const isRun1 = pose.endsWith("run1");
  const isRun2 = pose.endsWith("run2");
  const isReady = pose.endsWith("ready");
  const isCatch = pose.endsWith("catch");
  const isThrow = pose.endsWith("throw") || pose.endsWith("release");
  const isWindup = pose.endsWith("windup");
  const isBatter = pose.startsWith("batter") || pose.startsWith("runner");
  const isCatcher = pose.startsWith("catcher");
  const isSwing = pose.endsWith("swing");
  const isLoad = pose.endsWith("load");
  const isFollow = pose.endsWith("follow");

  ellipse("shadow", 32, 60, isCatcher ? 34 : isRun1 || isRun2 ? 32 : 28, isCatcher ? 8 : 6, 0.45);

  if (isCatcher) {
    drawLegs([20, 45, 10, 10], [34, 45, 10, 10]);
    drawTorso(32, 28, 26, 18);
    drawHead(32, 18, 1);
    rect("trim", 20, 31, 24, 5, 0.85);
    rect("glove", isCatch ? 42 : 40, isCatch ? 27 : 36, 10, 10);
    rect("skin", 17, 37, 5, 5);
  } else if (isBatter) {
    const running = pose.startsWith("runner");
    if (running) {
      drawLegs(isRun1 ? [19, 43, 8, 16] : [25, 43, 8, 16], isRun1 ? [37, 42, 8, 16] : [34, 42, 8, 16]);
    } else {
      drawLegs([24, 43, 7, 15], [36, 43, 7, 15]);
    }
    drawTorso(32, running ? 28 : 27, 21, 21);
    drawHead(32, 16, -1);
    if (isLoad) {
      rect("glove", 13, 13, 4, 34);
      rect("glove", 10, 9, 7, 7);
      rect("skin", 18, 31, 5, 5);
    } else if (isSwing) {
      rect("glove", 18, 30, 35, 4);
      rect("glove", 49, 27, 8, 5);
      rect("skin", 18, 33, 5, 5);
      rect("skin", 42, 31, 5, 5);
    } else if (isFollow) {
      rect("glove", 35, 18, 25, 4);
      rect("glove", 54, 14, 5, 8);
      rect("skin", 41, 24, 6, 5);
    } else if (running) {
      rect("skin", isRun1 ? 18 : 43, 32, 6, 5);
      rect("skin", isRun1 ? 43 : 18, 36, 6, 5);
    } else {
      rect("glove", 12, 18, 4, 31);
      rect("glove", 10, 14, 6, 7);
      rect("skin", 17, 33, 6, 5);
      rect("skin", 44, 33, 5, 5);
    }
  } else {
    if (isRun1) drawLegs([18, 43, 8, 16], [37, 42, 8, 16]);
    else if (isRun2) drawLegs([25, 42, 8, 16], [34, 43, 8, 16]);
    else if (isReady) drawLegs([20, 42, 9, 15], [36, 42, 9, 15]);
    else if (isWindup) drawLegs([23, 43, 8, 15], [37, 31, 8, 21]);
    else if (isThrow) drawLegs([20, 43, 9, 15], [38, 43, 8, 15]);
    else drawLegs([24, 42, 8, 16], [36, 42, 8, 16]);
    drawTorso(32, isReady ? 28 : 26, 23, 21);
    drawHead(32, 16, 1);
    if (isCatch) {
      rect("glove", 43, 19, 11, 11);
      rect("skin", 17, 34, 6, 5);
    } else if (isThrow) {
      rect("skin", 45, 17, 6, 5);
      rect("skin", 16, 35, 6, 5);
      rect("glove", 15, 31, 9, 9);
    } else if (isWindup) {
      rect("skin", 18, 22, 6, 5);
      rect("glove", 43, 28, 10, 10);
    } else if (isRun1 || isRun2) {
      rect("skin", isRun1 ? 17 : 43, 32, 6, 5);
      rect("glove", isRun1 ? 44 : 15, 34, 9, 9);
    } else {
      rect("skin", 16, 36, 6, 5);
      rect("glove", 45, isReady ? 35 : 34, 9, 9);
    }
  }

  graphics.generateTexture(key, 64, 64);
  graphics.destroy();
}

function makeBallTexture(scene, key, palette = {}) {
  if (scene.textures.exists(key)) return;
  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(hexToColor(palette.ballGlow ?? "#fff8d7", "#fff8d7"), 0.42);
  graphics.fillCircle(8, 8, 6);
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(8, 8, 3);
  graphics.fillStyle(hexToColor(palette.ballSeam ?? "#d92f42", "#d92f42"), 1);
  graphics.fillRect(6, 7, 1, 3);
  graphics.fillRect(10, 7, 1, 3);
  graphics.generateTexture(key, 16, 16);
  graphics.destroy();
}

function hexToColor(value, fallback) {
  const raw = String(value || fallback || "#ffffff").trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  const normalized = hex.length === 3
    ? hex.split("").map((part) => part + part).join("")
    : hex.padStart(6, "0").slice(0, 6);
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : Number.parseInt(String(fallback || "#ffffff").replace("#", ""), 16);
}

function drawAnchorOverlay(scene, runtime) {
  scene.anchorGraphics.clear();
  for (const label of scene.anchorLabels ?? []) label.destroy();
  scene.anchorLabels = [];
  if (!runtime.debugAnchors || !runtime.anchors?.anchors) return;

  const anchors = runtime.anchors.anchors;
  const sx = runtime.metrics.drawScaleX;
  const sy = runtime.metrics.drawScaleY;
  const point = (key) => anchors[key] ? { x: anchors[key].x * sx, y: anchors[key].y * sy } : null;
  const drawPath = (keys, color, alpha = 0.85) => {
    const points = keys.map(point).filter(Boolean);
    if (points.length < 2) return;
    scene.anchorGraphics.lineStyle(Math.max(1, Math.round(2 * sx)), color, alpha);
    scene.anchorGraphics.beginPath();
    scene.anchorGraphics.moveTo(points[0].x, points[0].y);
    for (const pos of points.slice(1)) scene.anchorGraphics.lineTo(pos.x, pos.y);
    scene.anchorGraphics.strokePath();
  };

  drawPath(["home", "first", "second", "third", "home"], 0xfff6c7, 0.9);
  drawPath(["leftPole", "home", "rightPole"], 0xddecff, 0.55);
  drawPath(["LF", "CF", "RF"], 0xff8f83, 0.7);

  for (const [key, anchor] of Object.entries(anchors)) {
    const x = anchor.x * sx;
    const y = anchor.y * sy;
    const radius = Math.max(3, Math.round(4 * sx));
    scene.anchorGraphics.fillStyle(0xff00ff, 1);
    scene.anchorGraphics.fillCircle(x, y, radius);
    scene.anchorGraphics.lineStyle(Math.max(1, Math.round(1 * sx)), 0x101820, 1);
    scene.anchorGraphics.strokeCircle(x, y, radius + 1);
    const labelX = x > runtime.metrics.bufferW - Math.max(70, 80 * sx)
      ? x - radius - Math.max(34, key.length * 7 * sx)
      : x + radius + 3;
    const label = scene.add.text(labelX, y - radius - 2, key, {
      fontFamily: "Consolas, monospace",
      fontSize: `${Math.max(9, Math.round(11 * sx))}px`,
      color: "#fffefb",
      backgroundColor: "rgba(16, 24, 32, 0.82)",
      padding: { left: 3, right: 3, top: 1, bottom: 1 }
    }).setDepth(30001);
    scene.anchorLabels.push(label);
  }
}

function exposeSceneDebug(runtime) {
  const actors = runtime.scene?.playerActors ?? [];
  const defenders = actors.filter((actor) => actor.isDefender);
  runtime.screen.dataset.gamecast2Field = runtime.field.id;
  runtime.screen.dataset.gamecast2AnchorCount = String(Object.keys(runtime.anchors?.anchors ?? {}).length);
  runtime.screen.dataset.gamecast2DebugAnchors = runtime.debugAnchors ? "1" : "0";
  runtime.screen.dataset.gamecast2DefenderCount = String(defenders.length);
  runtime.screen.dataset.gamecast2PlayerCount = String(actors.length);
  runtime.screen.__gamecast2Anchors = runtime.anchors;
  runtime.screen.__gamecast2Players = {
    defenders: defenders.map(publicActorSnapshot),
    actors: actors.map(publicActorSnapshot)
  };
}

function publicActorSnapshot(actor) {
  return {
    key: actor.key,
    fieldingKey: actor.fieldingKey,
    role: actor.role,
    isDefender: actor.isDefender,
    isOutfielder: actor.isOutfielder,
    x: Math.round(actor.designX * 100) / 100,
    y: Math.round(actor.designY * 100) / 100,
    scale: Math.round(actor.anchorScale * 100) / 100
  };
}

function resizeRuntime(runtime) {
  if (!runtime.game) return;
  runtime.metrics = calculateMetrics(runtime);
  applyCanvasContract(runtime);
  runtime.game.scale?.resize?.(runtime.metrics.bufferW, runtime.metrics.bufferH);
  if (runtime.scene) rebuildField(runtime.scene, runtime);
}

function updateRuntime(runtime, delta) {
  if (!runtime.scene || runtime.done || runtime.paused || runtime.prefersReducedMotion) return;
  const safeDelta = Math.min(80, Math.max(0, Number(delta) || 0));
  runtime.elapsedMs += safeDelta * runtime.playbackRate;
  const frame = renderRuntimeFrame(runtime, false);
  if (frame.done) finishRuntime(runtime, frame);
}

function renderRuntimeFrame(runtime, forceFinal = false) {
  const frame = runtime.makeFrame?.(runtime.elapsedMs, forceFinal) ?? { done: true };
  runtime.currentFrame = frame;
  updateGamecast2Playback(runtime, frame);
  runtime.onFrame?.(frame);
  return frame;
}

function finishRuntime(runtime, frame = null) {
  if (!runtime.scene || runtime.done) return;
  runtime.done = true;
  runtime.elapsedMs = getRuntimeTotalMs(runtime);
  const finalFrame = frame ?? renderRuntimeFrame(runtime, true);
  runtime.currentFrame = finalFrame;
  runtime.onDone?.(finalFrame);
}

function getRuntimeTotalMs(runtime) {
  const events = runtime.sequence?.events ?? [];
  const paMs = Math.max(80, Number(runtime.sequence?.paMs ?? 0));
  const gapMs = Math.max(0, Number(runtime.sequence?.gapMs ?? 0));
  return events.length * (paMs + gapMs);
}

function startRuntimeLoop(runtime) {
  const loop = runtime.game?.loop;
  if (!loop || loop.running) return;
  try {
    loop.start(runtime.game.step.bind(runtime.game));
  } catch (_error) {
    // Best effort; a later remount recreates the loop if needed.
  }
}

function stopRuntimeLoop(runtime) {
  const loop = runtime.game?.loop;
  if (!loop?.stop) return;
  try {
    loop.stop();
  } catch (_error) {
    // Best effort during modal close and pause transitions.
  }
}
