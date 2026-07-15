const PHASER_DESIGN_W = 400;
const PHASER_DESIGN_H = 360;
const PLAYER_FALLBACK_ATLAS_SIZE = 128;
const PLAYER_ATLAS_RENDER_SCALE = 0.5;
const PLAYER_MIN_RENDER_SCALE = 0.48;
const PLAYER_MAX_RENDER_SCALE = 0.7;
const spriteFrameRange = (prefix, count) => Array.from({ length: count }, (_, index) => `${prefix}_${String(index).padStart(2, "0")}`);
const PLAYER_ATLAS_FRAMES = {
  stance: [0, 0],
  load: [1, 0],
  stride: [2, 0],
  swing1: [3, 0],
  contact: [4, 0],
  swing2: [5, 0],
  follow1: [6, 0],
  follow2: [7, 0],
  pitch_set: [0, 1],
  pitch_kick: [1, 1],
  pitch_stride: [2, 1],
  pitch_cock: [3, 1],
  pitch_release: [4, 1],
  pitch_follow1: [5, 1],
  pitch_follow2: [6, 1],
  idle: [7, 1],
  run1: [0, 2],
  run2: [1, 2],
  run3: [2, 2],
  run4: [3, 2],
  walk1: [4, 2],
  walk2: [5, 2],
  throw_plant: [6, 2],
  throw_release: [7, 2],
  throw_follow: [0, 3],
  field: [1, 3],
  catch_track: [2, 3],
  catch_reach: [3, 3],
  catch_squeeze: [4, 3],
  dive_launch: [5, 3],
  dive_slide: [6, 3],
  dive_getup: [7, 3],
  slide_in: [0, 4],
  slide_hold: [1, 4],
  catcher_frame: [2, 4],
  catcher_block: [3, 4],
  miss: [4, 4],
  take: [5, 4],
  lookUp: [6, 4],
  reserved_a: [7, 4],
  stance_open: [0, 5],
  load_open: [1, 5],
  stance_crouch: [2, 5],
  load_crouch: [3, 5],
  pitch_alt_set: [4, 5],
  pitch_alt_release: [5, 5],
  reserved_b: [6, 5],
  reserved_c: [7, 5],
  swing: [4, 0],
  follow: [6, 0],
  windup: [0, 1],
  pitch: [4, 1],
  catch: [4, 3],
  dive: [6, 3],
  slide: [1, 4],
  catcher: [2, 4],
  walk: [4, 2],
  run: [0, 2],
  coach: [7, 1],
  umpire: [7, 1]
};
const PLAYER_V3_ANIMATIONS = {
  swing: { frames: spriteFrameRange("swing", 24), durations: [30, 30, 28, 28, 24, 22, 20, 18, 18, 18, 20, 22, 30, 34, 28, 26, 28, 30, 32, 34, 38, 42, 46, 54] },
  pitch: { frames: spriteFrameRange("pitch", 24), durations: [36, 34, 32, 30, 30, 28, 26, 24, 22, 20, 18, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 50] },
  run: { frames: spriteFrameRange("run", 8), durations: [55, 55, 55, 55, 55, 55, 55, 55] },
  walk: { frames: spriteFrameRange("walk", 6), durations: [95, 95, 95, 95, 95, 95] },
  throw: { frames: spriteFrameRange("throw", 12), durations: [42, 38, 34, 30, 24, 20, 20, 24, 28, 32, 38, 44] },
  catch: { frames: spriteFrameRange("catch", 10), durations: [48, 42, 36, 28, 28, 34, 42, 48, 56, 64] },
  dive: { frames: spriteFrameRange("dive", 10), durations: [42, 38, 34, 32, 34, 42, 52, 62, 72, 82] },
  slide: { frames: spriteFrameRange("slide", 8), durations: [42, 36, 32, 34, 44, 58, 72, 86] },
  catcher: { frames: spriteFrameRange("catcher", 8), durations: [64, 54, 44, 38, 42, 52, 62, 72] }
};
const PLAYER_V2_ANIMATIONS = {
  swing: { frames: ["stance", "load", "stride", "swing1", "contact", "swing2", "follow1", "follow2"], durations: [90, 70, 70, 45, 90, 45, 70, 100] },
  pitch: { frames: ["pitch_set", "pitch_kick", "pitch_stride", "pitch_cock", "pitch_release", "pitch_follow1", "pitch_follow2"], durations: [100, 90, 70, 60, 45, 70, 100] },
  run: { frames: ["run1", "run2", "run3", "run4"], durations: [70, 70, 70, 70] },
  walk: { frames: ["walk1", "walk2"], durations: [120, 120] },
  throw: { frames: ["throw_plant", "throw_release", "throw_follow"], durations: [80, 50, 90] },
  catch: { frames: ["catch_track", "catch_reach", "catch_squeeze"], durations: [90, 60, 100] },
  dive: { frames: ["dive_launch", "dive_slide", "dive_getup"], durations: [70, 90, 120] },
  slide: { frames: ["slide_in", "slide_hold"], durations: [80, 140] },
  catcher: { frames: ["catcher_frame", "catcher_block"], durations: [120, 120] }
};
const PLAYER_LEGACY_ANIMATIONS = {
  swing: { frames: ["stance", "swing", "follow"], durations: [120, 90, 140] },
  pitch: { frames: ["windup", "pitch"], durations: [140, 120] },
  run: { frames: ["run1", "run2"], durations: [90, 90] },
  walk: { frames: ["walk1", "walk2"], durations: [140, 140] },
  throw: { frames: ["field", "pitch"], durations: [100, 90] },
  catch: { frames: ["field", "catch"], durations: [120, 140] },
  dive: { frames: ["field", "dive"], durations: [120, 160] },
  slide: { frames: ["run1", "slide"], durations: [90, 160] },
  catcher: { frames: ["catcher"], durations: [160] }
};
const SPRITE_ASSET_ROOT = "./assets/gamecast";
export const GAMECAST_SPRITE_ASSET_REVISION = "20260715-force-clarity-5";
export const GAMECAST_THROW_BALL_SIZE = 1.25;
export const GAMECAST_BALL_MIN_RENDER_SCALE = 1.2;

export function gamecastSpriteAssetUrl(url) {
  const qaToken = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("qa") ?? ""
    : "";
  const revision = [GAMECAST_SPRITE_ASSET_REVISION, qaToken].filter(Boolean).join("-");
  return `${url}?v=${encodeURIComponent(revision)}`;
}

export function canUseGamecastPhaser() {
  return typeof window !== "undefined" && Boolean(window.Phaser?.Game);
}

export function mountGamecastPhaser(options) {
  if (!canUseGamecastPhaser() || !options?.canvas || !options?.screen) return null;

  const Phaser = window.Phaser;
  const runtime = {
    ...options,
    Phaser,
    width: Number(options.width ?? PHASER_DESIGN_W),
    height: Number(options.height ?? PHASER_DESIGN_H),
    elapsedMs: Math.max(0, Number(options.elapsedMs ?? 0)),
    playbackRate: Number(options.playbackRate ?? 1),
    done: false,
    paused: false,
    currentFrame: null,
    impactEventId: "",
    scene: null,
    game: null,
    resizeObserver: null,
    metrics: null,
    fieldHoldCanvas: null,
    fieldHoldCacheKey: ""
  };

  runtime.metrics = calculatePhaserMetrics(runtime);
  applyCanvasContract(runtime);

  const sceneConfig = {
    preload() {
      preloadGamecastAssets(this);
    },
    create() {
      createGamecastScene(this, runtime);
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
    backgroundColor: "#0d1a14",
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
  if (typeof window !== "undefined") {
    window.requestAnimationFrame?.(() => resizeRuntime(runtime));
    window.setTimeout?.(() => resizeRuntime(runtime), 80);
  }

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
        paintStaticHoldFrame(runtime, frame);
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
        // Phaser can throw during teardown if the canvas was already detached.
      }
      runtime.game = null;
      runtime.scene = null;
    }
  };
}

function preloadGamecastAssets(scene) {
  scene.load.atlas(
    "gamecast-player-home",
    gamecastSpriteAssetUrl(`${SPRITE_ASSET_ROOT}/player-home.png`),
    gamecastSpriteAssetUrl(`${SPRITE_ASSET_ROOT}/player-home.json`)
  );
  scene.load.atlas(
    "gamecast-player-away",
    gamecastSpriteAssetUrl(`${SPRITE_ASSET_ROOT}/player-away.png`),
    gamecastSpriteAssetUrl(`${SPRITE_ASSET_ROOT}/player-away.json`)
  );
  scene.load.atlas(
    "gamecast-props",
    gamecastSpriteAssetUrl(`${SPRITE_ASSET_ROOT}/props.png`),
    gamecastSpriteAssetUrl(`${SPRITE_ASSET_ROOT}/props.json`)
  );
}

function calculatePhaserMetrics(runtime) {
  const rect = runtime.screen.getBoundingClientRect?.() ?? { width: runtime.width };
  const style = typeof getComputedStyle === "function" ? getComputedStyle(runtime.screen) : null;
  const horizontalInset = style
    ? Number.parseFloat(style.paddingLeft || "0")
      + Number.parseFloat(style.paddingRight || "0")
      + Number.parseFloat(style.borderLeftWidth || "0")
      + Number.parseFloat(style.borderRightWidth || "0")
    : 0;
  const available = Math.max(1, Math.floor((rect.width || runtime.width) - horizontalInset));
  const cssScale = Math.max(0.5, available / runtime.width);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = runtime.width * cssScale;
  const cssH = runtime.height * cssScale;
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

function resizeRuntime(runtime) {
  if (!runtime.game) return;
  runtime.metrics = calculatePhaserMetrics(runtime);
  applyCanvasContract(runtime);
  runtime.game.scale?.resize?.(runtime.metrics.bufferW, runtime.metrics.bufferH);
  if (runtime.scene) {
    rebuildField(runtime.scene, runtime);
    renderScene(runtime.scene, runtime, runtime.currentFrame);
  }
}

function startRuntimeLoop(runtime) {
  const loop = runtime.game?.loop;
  if (!loop || loop.running) return;
  try {
    loop.start(runtime.game.step.bind(runtime.game));
  } catch (_error) {
    // If Phaser refuses to restart, the next user render will recreate the instance.
  }
}

function stopRuntimeLoop(runtime) {
  const loop = runtime.game?.loop;
  if (!loop?.stop) return;
  try {
    loop.stop();
  } catch (_error) {
    // Stopping is best-effort; cleanup will destroy the loop if needed.
  }
}

function createGamecastScene(scene, runtime) {
  runtime.scene = scene;
  scene.cameras.main.roundPixels = true;
  scene.fieldLayer = scene.add.container(0, 0).setDepth(0);
  scene.playerGraphics = scene.add.graphics().setDepth(10);
  scene.spriteLayer = scene.add.container(0, 0).setDepth(12);
  scene.skinHighlightGraphics = scene.add.graphics().setDepth(16);
  scene.ballGraphics = scene.add.graphics().setDepth(30);
  scene.ballSpriteLayer = scene.add.container(0, 0).setDepth(32);
  scene.fxGraphics = scene.add.graphics().setDepth(40);
  scene.gamecastTeamTextureCache = new Map();
  scene.gamecastImagePools = {
    players: [],
    balls: []
  };
  scene.gamecastPoolCursor = {
    players: 0,
    balls: 0
  };
  scene.flashRect = scene.add.rectangle(0, 0, runtime.metrics.bufferW, runtime.metrics.bufferH, 0xfffefb, 0)
    .setOrigin(0)
    .setDepth(45);
  rebuildField(scene, runtime);
}

function rebuildField(scene, runtime) {
  const key = "gamecast-phaser-field";
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, runtime.width, runtime.height);
  const canvas = texture.getSourceImage();
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  drawFieldCanvas(ctx, runtime.palette, runtime.width, runtime.height, runtime.fieldProfile);
  texture.refresh();

  scene.fieldLayer.removeAll(true);
  const field = scene.add.image(0, 0, key)
    .setOrigin(0)
    .setScale(runtime.metrics.drawScaleX, runtime.metrics.drawScaleY);
  scene.fieldLayer.add(field);
  scene.flashRect?.setSize(runtime.metrics.bufferW, runtime.metrics.bufferH);
}

function updateRuntime(runtime, delta) {
  if (!runtime.scene || runtime.done || runtime.paused || runtime.prefersReducedMotion) return;
  const safeDelta = Math.min(80, Math.max(0, Number(delta) || 0));
  runtime.elapsedMs += safeDelta * runtime.playbackRate;
  const frame = renderRuntimeFrame(runtime, false);
  if (shouldShake(frame) && runtime.impactEventId !== frame.event?.id) {
    runtime.impactEventId = frame.event?.id ?? "";
    runtime.scene.cameras.main.shake(180, frame.event?.outcome === "homeRun" ? 0.008 : 0.004);
    runtime.onImpact?.(frame);
  }
  if (frame.done) finishRuntime(runtime, frame);
}

function finishRuntime(runtime, frame = null) {
  if (!runtime.scene || runtime.done) return;
  runtime.done = true;
  runtime.elapsedMs = Math.max(runtime.elapsedMs, getRuntimeTotalMs(runtime));
  const finalFrame = frame ?? renderRuntimeFrame(runtime, true);
  runtime.onDone?.(finalFrame);
  stopRuntimeLoop(runtime);
  paintStaticHoldFrame(runtime, finalFrame);
}

function getRuntimeTotalMs(runtime) {
  const authoredTotal = Number(runtime.sequence?.totalMs);
  if (Number.isFinite(authoredTotal) && authoredTotal >= 0) return authoredTotal;
  const events = runtime.sequence?.events?.length ?? 0;
  const paMs = Math.max(80, Number(runtime.sequence?.paMs ?? 850));
  const gapMs = Math.max(0, Number(runtime.sequence?.gapMs ?? 120));
  return events * (paMs + gapMs);
}

function renderRuntimeFrame(runtime, forceFinal = false) {
  const frame = runtime.makeFrame?.(runtime.elapsedMs, forceFinal) ?? { done: true, event: null };
  runtime.currentFrame = frame;
  renderScene(runtime.scene, runtime, frame);
  runtime.onFrame?.(frame);
  return frame;
}

function renderScene(scene, runtime, frame) {
  if (!scene || !frame) return;
  applyGamecastCamera(scene, runtime, frame);
  const palette = runtime.palette;
  const player = scene.playerGraphics;
  const skin = scene.skinHighlightGraphics;
  const ball = scene.ballGraphics;
  const fx = scene.fxGraphics;
  const useSprites = hasPlayerSprites(scene);
  player.clear();
  skin?.clear();
  ball.clear();
  fx.clear();
  beginGamecastPoolFrame(scene);

  drawPhaserAtmosphere(fx, runtime, frame);
  const actors = [
    ...buildStaticDefenseSprites(runtime, frame).map((sprite) => ({ sprite, role: "defenderStatic" })),
    ...(frame.defenseSprites ?? []).map((sprite) => ({ sprite, role: "defender" })),
    ...(frame.runners ?? []).map((sprite) => ({ sprite, role: "runner" })),
    ...(frame.batter ? [{ sprite: frame.batter, role: "batter" }] : []),
    ...(() => {
      const umpire = buildUmpireSprite(runtime, frame);
      return umpire ? [{ sprite: umpire, role: "umpire" }] : [];
    })()
  ].sort(compareGamecastActorDepth);

  runtime.screen.dataset.gamecastAbilityUnderlays = String(
    actors.filter(({ sprite }) => sprite?.abilityGrade && sprite?.abilityColor).length
  );

  for (const runner of frame.runners ?? []) drawRunnerEffects(fx, runtime, runner, palette);
  for (const actor of actors) drawGamecastPlayer(scene, player, runtime, actor.sprite, actor.role, useSprites);
  drawThrowLines(scene, ball, runtime, frame);
  drawBallTrail(ball, runtime, frame);
  if (frame.ballShadow) drawBallShadow(ball, runtime, frame.ballShadow);
  if (frame.ball) drawGamecastBall(scene, ball, runtime, frame.ball, frame.ballColor ?? palette.base);
  if (frame.contactBurst) drawContactBurst(fx, runtime, frame.contactBurst, frame);

  const flashAlpha = frame.flash ? 0.2 : frame.scoreFlash ? 0.08 : 0;
  scene.flashRect.setAlpha(flashAlpha);
  endGamecastPoolFrame(scene);
}

function applyGamecastCamera(scene, runtime, frame) {
  const camera = scene?.cameras?.main;
  if (!camera || !runtime?.metrics) return;
  const spec = frame?.camera;
  const zoom = spec ? Math.max(1, Math.min(1.12, Number(spec.zoom ?? 1))) : 1;
  camera.setZoom(zoom);
  if (!spec) {
    camera.setScroll(0, 0);
    return;
  }
  const metrics = runtime.metrics;
  const focusX = Math.max(0, Math.min(runtime.width, Number(spec.x ?? runtime.width / 2))) * metrics.drawScaleX;
  const focusY = Math.max(0, Math.min(runtime.height, Number(spec.y ?? runtime.height / 2))) * metrics.drawScaleY;
  const viewW = metrics.bufferW / zoom;
  const viewH = metrics.bufferH / zoom;
  const maxScrollX = Math.max(0, metrics.bufferW - viewW);
  const maxScrollY = Math.max(0, metrics.bufferH - viewH);
  camera.setScroll(
    Math.max(0, Math.min(maxScrollX, focusX - viewW / 2)),
    Math.max(0, Math.min(maxScrollY, focusY - viewH / 2))
  );
}

function beginGamecastPoolFrame(scene) {
  if (!scene?.gamecastPoolCursor) return;
  scene.gamecastPoolCursor.players = 0;
  scene.gamecastPoolCursor.balls = 0;
}

function endGamecastPoolFrame(scene) {
  const pools = scene?.gamecastImagePools;
  const cursor = scene?.gamecastPoolCursor;
  if (!pools || !cursor) return;
  hideUnusedPoolItems(pools.players, cursor.players);
  hideUnusedPoolItems(pools.balls, cursor.balls);
}

function hideUnusedPoolItems(pool, usedCount) {
  for (let index = usedCount; index < pool.length; index += 1) {
    pool[index]?.setVisible?.(false);
  }
}

function acquirePooledImage(scene, poolName, layer, textureKey, frame) {
  if (!scene?.gamecastImagePools || !scene?.gamecastPoolCursor || !layer) return null;
  const pool = scene.gamecastImagePools[poolName];
  if (!pool) return null;
  const index = scene.gamecastPoolCursor[poolName] ?? 0;
  scene.gamecastPoolCursor[poolName] = index + 1;
  let image = pool[index];
  if (!image) {
    image = scene.add.image(0, 0, textureKey, frame);
    image.setVisible(false);
    pool[index] = image;
    layer.add(image);
  }
  if (image.texture?.key !== textureKey || image.frame?.name !== frame) {
    image.setTexture(textureKey, frame);
  }
  image.setVisible(true).setAlpha(1);
  return image;
}

function paintStaticHoldFrame(runtime, frame) {
  const ctx = runtime.canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(runtime.metrics.drawScaleX, 0, 0, runtime.metrics.drawScaleY, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const fieldCanvas = getStaticFieldHoldCanvas(runtime);
  if (fieldCanvas) ctx.drawImage(fieldCanvas, 0, 0);
  else drawFieldCanvas(ctx, runtime.palette, runtime.width, runtime.height, runtime.fieldProfile);
  drawHoldBaseRunners(ctx, runtime, frame);
  ctx.restore();
}

function getStaticFieldHoldCanvas(runtime) {
  const key = `${runtime.width}x${runtime.height}:${JSON.stringify(runtime.fieldProfile ?? {})}:${JSON.stringify(runtime.palette ?? {})}`;
  if (runtime.fieldHoldCanvas && runtime.fieldHoldCacheKey === key) return runtime.fieldHoldCanvas;
  const canvas = createRuntimeCanvas(runtime.width, runtime.height);
  const ctx = canvas?.getContext?.("2d");
  if (!canvas || !ctx) return null;
  ctx.imageSmoothingEnabled = false;
  drawFieldCanvas(ctx, runtime.palette, runtime.width, runtime.height, runtime.fieldProfile);
  runtime.fieldHoldCanvas = canvas;
  runtime.fieldHoldCacheKey = key;
  return canvas;
}

function createRuntimeCanvas(width, height) {
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  return null;
}

function drawHoldBaseRunners(ctx, runtime, frame) {
  const bases = runtime.basePositions;
  const palette = runtime.palette;
  const occupied = frame?.bases ?? [false, false, false];
  const targets = [bases.first, bases.second, bases.third];
  for (const [index, isOn] of occupied.entries()) {
    if (!isOn) continue;
    const base = targets[index];
    ctx.fillStyle = palette.outline;
    ctx.fillRect(Math.round(base.x - 3), Math.round(base.y - 12), 7, 11);
    ctx.fillStyle = frame.offenseColor ?? palette.runner;
    ctx.fillRect(Math.round(base.x - 2), Math.round(base.y - 10), 5, 6);
    ctx.fillStyle = frame.offenseJerseyColor ?? palette.uniform;
    ctx.fillRect(Math.round(base.x - 2), Math.round(base.y - 7), 5, 4);
    ctx.fillStyle = palette.skin;
    ctx.fillRect(Math.round(base.x - 2), Math.round(base.y - 13), 5, 3);
  }
}

function drawFieldCanvas(ctx, palette, width, height, fieldProfile = null) {
  const profile = normalizePhaserFieldProfile(fieldProfile);
  const sx = (value) => Math.round((Number(value) / 120) * width);
  const sy = (value) => Math.round((Number(value) / 108) * height);
  const scale = Math.max(1, sx(1));
  const roofed = Boolean(profile.roofed);
  ctx.fillStyle = roofed ? "#202b3a" : "#34303d";
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < sy(roofed ? 18 : 22); y += Math.max(2, sy(3))) {
    const bgSegments = roofed
      ? [[sx(3), sx(35)], [sx(42), sx(78)], [sx(85), sx(117)]]
      : [[sx(3), sx(40)], [sx(80), sx(117)]];
    ctx.fillStyle = y % Math.max(4, sy(8)) === 0 ? (roofed ? "#2b3b4d" : "#4a4654") : palette.standD;
    for (const [x1, x2] of bgSegments) ctx.fillRect(x1, y, Math.max(1, x2 - x1), Math.max(1, sy(1)));
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const lx = (x / width) * 120;
      const ly = (y / height) * 108;
      const wallY = phaserOutfieldWallY(profile, lx);
      const distanceToWall = ly - wallY;
      if (distanceToWall >= 0) {
        if (distanceToWall < 2.2 + Math.min(3.2, Number(profile.wallHeight ?? 3) * 0.28)) {
          ctx.fillStyle = profile.monsterSide === "right" && lx > 92 ? "#38252d" : (y < sy(30) ? palette.wallCap : palette.wall);
        } else if (distanceToWall < 5.8) {
          ctx.fillStyle = Math.floor((x + y) / Math.max(1, sx(5))) % 2 ? "#d1ad68" : palette.track;
        } else {
          const radial = Math.hypot((lx - 60) * 0.92, (ly - 101) * 0.72);
          const ring = profile.mow === "rings"
            ? Math.floor((radial + Math.max(0, ly - wallY) * 0.18) / 13)
            : 0;
          const stripe = profile.mow === "checker"
            ? Math.floor(lx / 7) + Math.floor(ly / 6)
            : profile.mow === "dome"
              ? 0
              : profile.mow === "stripes"
                ? Math.floor((lx + ly * 0.25) / 9)
                : Math.floor(radial / 13);
          const mowStripe = (ring + stripe) % 2 === 1;
          ctx.fillStyle = mowStripe ? palette.grassLo : palette.grassHi;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  drawCanvasWallDetails(ctx, palette, sx, sy, profile, scale);
  drawCanvasStadiumTrim(ctx, palette, sx, sy, width, scale, profile);
  drawCanvasInfieldCut(ctx, palette, sx, sy, scale);
}

function drawCanvasInfieldCut(ctx, palette, sx, sy, scale) {
  fillCircleCanvas(ctx, sx(60), sy(78), sx(18), palette.grassLo);
  fillCircleCanvas(ctx, sx(60), sy(78), sx(12), palette.grassHi);
  fillDiamond(ctx, palette.dirtM, [
    [sx(60), sy(58)],
    [sx(91), sy(76)],
    [sx(60), sy(101)],
    [sx(29), sy(76)]
  ]);
  fillDiamond(ctx, palette.grassHi, [
    [sx(60), sy(66)],
    [sx(76), sy(80)],
    [sx(60), sy(92)],
    [sx(44), sy(80)]
  ]);

  const bases = {
    home: { x: 60, y: 96 },
    first: { x: 87, y: 75 },
    second: { x: 60, y: 53 },
    third: { x: 33, y: 75 },
    mound: { x: 60, y: 72 }
  };
  const pathWidth = Math.max(2, Math.round(scale * 0.7));
  const baseDirt = palette.dirtD ?? palette.dirtM;
  drawLineCanvas(ctx, sx(bases.home.x), sy(bases.home.y), sx(bases.first.x), sy(bases.first.y), baseDirt, pathWidth);
  drawLineCanvas(ctx, sx(bases.first.x), sy(bases.first.y), sx(bases.second.x), sy(bases.second.y), baseDirt, pathWidth);
  drawLineCanvas(ctx, sx(bases.second.x), sy(bases.second.y), sx(bases.third.x), sy(bases.third.y), baseDirt, pathWidth);
  drawLineCanvas(ctx, sx(bases.third.x), sy(bases.third.y), sx(bases.home.x), sy(bases.home.y), baseDirt, pathWidth);
  for (const base of [bases.first, bases.second, bases.third]) {
    fillCircleCanvas(ctx, sx(base.x), sy(base.y), Math.max(3, sx(4.4)), palette.dirtM);
    fillCircleCanvas(ctx, sx(base.x), sy(base.y), Math.max(2, sx(2.7)), palette.dirtL);
    drawCanvasBaseAnchor(ctx, palette, sx, sy, base.x, base.y);
  }
  fillCircleCanvas(ctx, sx(bases.home.x), sy(bases.home.y), Math.max(4, sx(6)), palette.dirtM);
  fillCircleCanvas(ctx, sx(bases.mound.x), sy(bases.mound.y), Math.max(4, sx(6.4)), palette.dirtL);
  fillCircleCanvas(ctx, sx(bases.mound.x), sy(bases.mound.y), Math.max(3, sx(4.2)), palette.dirtM);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(sx(57.7), sy(71.2), Math.max(3, sx(4.6)), Math.max(1, Math.round(scale * 0.45)));
  ctx.fillStyle = palette.base;
  ctx.fillRect(sx(58.4), sy(71.4), Math.max(2, sx(3.2)), Math.max(1, Math.round(scale * 0.24)));

  const foul = gamecastFoulLineGeometry();
  const foulLine = "rgba(255, 254, 251, 0.76)";
  const foulWidth = Math.max(1, Math.round(scale * 0.24));
  drawLineCanvas(ctx, sx(foul.home.x), sy(foul.home.y), sx(foul.left.x), sy(foul.left.y), foulLine, foulWidth);
  drawLineCanvas(ctx, sx(foul.home.x), sy(foul.home.y), sx(foul.right.x), sy(foul.right.y), foulLine, foulWidth);
  drawCanvasHomePlateDetails(ctx, palette, sx, sy, scale);
}

function drawCanvasBaseAnchor(ctx, palette, sx, sy, x, y) {
  const u = Math.max(1, sx(0.55));
  ctx.fillStyle = palette.outline;
  ctx.fillRect(sx(x) - u, sy(y) - u, u * 2 + 1, u * 2 + 1);
  ctx.fillStyle = palette.base;
  ctx.fillRect(sx(x) - Math.max(1, u - 1), sy(y) - Math.max(1, u - 1), Math.max(2, u * 2 - 1), Math.max(2, u * 2 - 1));
}

function drawCanvasWallDetails(ctx, palette, sx, sy, profile, scale) {
  const seamColor = "rgba(255, 254, 251, 0.16)";
  const capColor = "rgba(255, 254, 251, 0.24)";
  for (let logicalX = 8; logicalX <= 112; logicalX += 4) {
    const wallY = phaserOutfieldWallY(profile, logicalX);
    const x = sx(logicalX);
    const top = sy(wallY + 0.8);
    const bottom = sy(wallY + 4.2);
    ctx.fillStyle = logicalX % 12 === 0 ? capColor : seamColor;
    ctx.fillRect(x, top, Math.max(1, Math.round(scale * 0.24)), Math.max(1, bottom - top));
  }
  ctx.fillStyle = "rgba(18, 23, 33, 0.24)";
  for (let logicalX = 12; logicalX <= 108; logicalX += 12) {
    const wallY = phaserOutfieldWallY(profile, logicalX);
    ctx.fillRect(sx(logicalX - 3), sy(wallY + 5.6), Math.max(1, sx(5.4)), Math.max(1, Math.round(scale * 0.32)));
  }
}

function drawCanvasHomePlateDetails(ctx, palette, sx, sy, scale) {
  const stroke = Math.max(1, scale);
  const boxTop = sy(90);
  const boxH = sy(10);
  const boxW = sx(4);
  const leftX = sx(48);
  const rightX = sx(68);
  ctx.fillStyle = "rgba(255, 254, 251, 0.68)";
  strokeRectCanvas(ctx, leftX, boxTop, boxW, boxH, stroke);
  strokeRectCanvas(ctx, rightX, boxTop, boxW, boxH, stroke);
  strokeRectCanvas(ctx, sx(55), sy(97), sx(10), sy(5), stroke);
  ctx.fillStyle = palette.base;
  ctx.fillRect(sx(58), sy(95), sx(4), stroke);
  ctx.fillRect(sx(59), sy(96), sx(2), stroke);
}

function gamecastFoulLineGeometry() {
  const home = { x: 60, y: 96 };
  const first = { x: 87, y: 75 };
  const third = { x: 33, y: 75 };
  const endY = 55;
  const t = (endY - home.y) / (third.y - home.y);
  return {
    home,
    left: { x: home.x + (third.x - home.x) * t, y: endY },
    right: { x: home.x + (first.x - home.x) * t, y: endY }
  };
}

function strokeRectCanvas(ctx, x, y, width, height, stroke) {
  ctx.fillRect(x, y, width, stroke);
  ctx.fillRect(x, y + height - stroke, width, stroke);
  ctx.fillRect(x, y, stroke, height);
  ctx.fillRect(x + width - stroke, y, stroke, height);
}

function normalizePhaserFieldProfile(profile) {
  const safe = profile && typeof profile === "object" ? profile : {};
  return {
    id: String(safe.id ?? "neutral"),
    label: String(safe.label ?? "KBO"),
    lf: Number(safe.lf ?? 99),
    lcf: Number(safe.lcf ?? 116),
    cf: Number(safe.cf ?? 121),
    rcf: Number(safe.rcf ?? 116),
    rf: Number(safe.rf ?? 99),
    wallHeight: Number(safe.wallHeight ?? 3),
    roofed: Boolean(safe.roofed),
    mow: String(safe.mow ?? "rings"),
    monsterSide: String(safe.monsterSide ?? ""),
    attendanceRatio: Math.max(0.16, Math.min(1, Number(safe.attendanceRatio ?? 0.62) || 0.62)),
    homeColor: paletteSafeColor(safe.homeColor, "#315288")
  };
}

function paletteSafeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? String(value) : fallback;
}

function phaserOutfieldWallY(profile, logicalX) {
  const x = Math.max(4, Math.min(116, Number(logicalX) || 60));
  const left = x < 60;
  const edgeT = Math.min(1, Math.abs(x - 60) / 48);
  const midT = Math.min(1, Math.abs(x - 60) / 28);
  const center = Number(profile?.cf ?? 121);
  const mid = left ? Number(profile?.lcf ?? 116) : Number(profile?.rcf ?? 116);
  const corner = left ? Number(profile?.lf ?? 99) : Number(profile?.rf ?? 99);
  const depth = edgeT < 0.58
    ? lerp(center, mid, midT)
    : lerp(mid, corner, Math.max(0, (edgeT - 0.58) / 0.42));
  const radius = 84 + (depth - 115) * 0.72;
  const dx = x - 60;
  const y = 104 - Math.sqrt(Math.max(0, radius * radius - dx * dx));
  return Math.max(5, Math.min(51, y));
}

function lerp(from, to, amount) {
  return Number(from) + (Number(to) - Number(from)) * Number(amount);
}

function drawCanvasCrowd(ctx, palette, sx, sy, width, height, profile, scale) {
  const shirts = [palette.crowdA, palette.crowdB, palette.crowdC, palette.defenderL, palette.runnerL, palette.base, palette.spark, "#ff8f83", profile.homeColor];
  const dense = Math.max(0.16, Math.min(1, Number(profile.attendanceRatio ?? 0.62)));
  const unit = Math.max(1, Math.round(scale * 0.42));
  const startY = sy(3);
  const endY = sy(42);
  const stepX = Math.max(scale * (dense > 0.82 ? 6 : dense > 0.52 ? 7 : 9), sx(dense > 0.82 ? 5 : dense > 0.52 ? 6 : 8));
  const stepY = Math.max(scale * (dense > 0.82 ? 6 : 7), sy(dense > 0.82 ? 5 : 6));
  const seatBack = Math.max(2, Math.floor(stepY * 0.45));
  const rail = Math.max(1, Math.floor(scale * 0.35));
  for (let y = startY; y < endY; y += stepY) {
    const row = Math.floor((y - startY) / Math.max(1, stepY));
    if (y < sy(profile.roofed ? 20 : 24)) {
      const rowSegments = profile.roofed
        ? [[sx(3), sx(35)], [sx(42), sx(78)], [sx(85), sx(117)]]
        : [[sx(3), sx(40)], [sx(80), sx(117)]];
      ctx.fillStyle = row % 2 ? "rgba(18, 23, 33, 0.58)" : "rgba(39, 45, 58, 0.58)";
      for (const [x1, x2] of rowSegments) ctx.fillRect(x1, y + Math.floor(stepY * 0.28), Math.max(1, x2 - x1), seatBack);
      ctx.fillStyle = row % 2 ? "rgba(255, 254, 251, 0.08)" : "rgba(0, 0, 0, 0.12)";
      for (const [x1, x2] of rowSegments) ctx.fillRect(x1, y + stepY - rail, Math.max(1, x2 - x1), rail);
    }
    for (let x = sx(2) + (row % 2 ? Math.floor(stepX / 2) : 0); x < width - sx(3); x += stepX) {
      const lx = (x / width) * 120;
      const ly = (y / height) * 108;
      if (ly >= phaserOutfieldWallY(profile, lx) - 1) continue;
      const col = Math.floor(x / Math.max(1, stepX));
      const hash = Math.abs((row * 73856093) ^ (col * 19349663) ^ 0x9e3779b9);
      if ((hash % 100) > 42 + dense * 44) continue;
      if (hash % 97 === 0) {
        ctx.fillStyle = palette.outline;
        ctx.fillRect(x - unit, y + unit * 2, unit * 7, unit * 4);
        ctx.fillStyle = palette.base;
        ctx.fillRect(x, y + unit * 3, unit * 5, unit);
        ctx.fillStyle = shirts[hash % shirts.length];
        ctx.fillRect(x + unit, y + unit * 2, unit * 3, unit);
        continue;
      }
      ctx.fillStyle = palette.crowdHair;
      ctx.fillRect(x, y, unit * 4, unit);
      ctx.fillStyle = palette.crowdSkin;
      ctx.fillRect(x + unit, y + unit, unit * 2, unit * 2);
      ctx.fillStyle = palette.outline;
      ctx.fillRect(x + unit, y + unit * 2, unit, unit);
      ctx.fillRect(x + unit * 2, y + unit * 2, unit, unit);
      ctx.fillStyle = shirts[hash % shirts.length];
      ctx.fillRect(x, y + unit * 3, unit * 4, unit * 2);
      ctx.fillStyle = hash % 3 === 0 ? palette.sparkL : palette.stand;
      ctx.fillRect(x, y + unit * 5, unit * 4, unit);
    }
  }
  ctx.fillStyle = "rgba(255, 254, 251, 0.08)";
  for (let x = sx(18); x < sx(108); x += sx(24)) {
    ctx.fillRect(x, startY, Math.max(1, Math.floor(scale * 0.5)), Math.max(1, endY - startY));
  }
}

function drawCanvasStadiumTrim(ctx, palette, sx, sy, width, scale, profile) {
  if (profile.roofed) {
    ctx.fillStyle = "rgba(24, 36, 52, 0.72)";
    ctx.fillRect(0, 0, width, sy(8));
    ctx.fillStyle = "#314456";
    for (let y = sy(2); y < sy(12); y += Math.max(scale, sy(5))) {
      ctx.fillRect(sx(8), y, sx(18), scale);
      ctx.fillRect(sx(47), y, sx(26), scale);
      ctx.fillRect(sx(94), y, sx(18), scale);
    }
    ctx.fillStyle = "#33475a";
    for (let x = sx(10); x < sx(112); x += sx(18)) {
      ctx.fillRect(x, sy(1), scale, sy(13));
    }
    ctx.fillStyle = "rgba(221, 236, 255, 0.28)";
    ctx.fillRect(sx(18), sy(13), sx(10), scale);
    ctx.fillRect(sx(46), sy(13), sx(28), scale);
    ctx.fillRect(sx(92), sy(13), sx(10), scale);
    ctx.fillStyle = "rgba(255, 246, 199, 0.34)";
    ctx.fillRect(sx(28), sy(8), sx(12), scale);
    ctx.fillRect(sx(80), sy(8), sx(12), scale);
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = sy(23); y <= sy(39); y += Math.max(1, sy(5))) {
    ctx.fillRect(sx(4), y, sx(20), Math.max(1, Math.round(scale * 0.3)));
    ctx.fillRect(sx(96), y, sx(20), Math.max(1, Math.round(scale * 0.3)));
  }
  ctx.fillStyle = "rgba(255, 254, 251, 0.08)";
  ctx.fillRect(sx(0), sy(25), width, Math.max(1, Math.round(scale * 0.24)));
  ctx.fillRect(sx(0), sy(35), width, Math.max(1, Math.round(scale * 0.2)));
  const adColors = [palette.ribbon, palette.defender, palette.spark, palette.runner, palette.wallCap];
  for (let index = 0; index < 10; index += 1) {
    const x = sx(7 + index * 11);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(x, sy(18), sx(8), sy(3));
    ctx.fillStyle = adColors[index % adColors.length];
    ctx.fillRect(x + scale, sy(19), Math.max(scale, sx(6)), scale);
  }

  ctx.fillStyle = palette.outline;
  const boardX = profile.roofed ? sx(42) : sx(profile.monsterSide === "right" ? 50 : 47);
  const boardY = profile.roofed ? sy(8) : sy(11);
  const boardW = profile.roofed ? sx(36) : sx(26);
  ctx.fillRect(boardX, boardY, boardW, sy(7));
  ctx.fillStyle = profile.roofed ? "#0a1119" : "#12211b";
  ctx.fillRect(boardX + scale, boardY + scale, boardW - scale * 2, sy(7) - scale * 2);
  ctx.fillStyle = palette.sparkL;
  ctx.fillRect(boardX + scale * 2, boardY + scale * 2, Math.max(scale, boardW - scale * 4), scale);
  drawTinyCanvasText(ctx, profile.label || "KBO", boardX + scale * 2, boardY + scale * 4, profile.roofed ? "#ddecff" : palette.sparkL, Math.max(1, Math.round(scale * 0.55)));

  for (const [x, y, dir] of [[14, 39, 1], [91, 39, -1]]) {
    ctx.fillStyle = palette.outline;
    ctx.fillRect(sx(x), sy(y), sx(15), sy(4));
    ctx.fillStyle = "rgba(18, 23, 33, 0.72)";
    ctx.fillRect(sx(x) + scale, sy(y) + scale, Math.max(scale, sx(15) - scale * 2), Math.max(scale, sy(4) - scale * 2));
    ctx.fillStyle = dir > 0 ? palette.runnerL : palette.defenderL;
    for (let slot = 0; slot < 3; slot += 1) {
      ctx.fillRect(sx(x + 2 + slot * 4), sy(y + 2), Math.max(1, sx(1.2)), Math.max(1, sy(1.2)));
    }
  }

  ctx.fillStyle = palette.pole;
  const foul = gamecastFoulLineGeometry();
  ctx.fillRect(sx(foul.left.x), sy(30), scale, Math.max(scale, sy(foul.left.y - 30)));
  ctx.fillRect(sx(foul.right.x), sy(30), scale, Math.max(scale, sy(foul.right.y - 30)));
}

function drawTinyCanvasText(ctx, text, x, y, color, scale) {
  const glyphs = {
    A: ["111", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    D: ["110", "101", "101", "101", "110"],
    E: ["111", "100", "110", "100", "111"],
    G: ["111", "100", "101", "101", "111"],
    I: ["111", "010", "010", "010", "111"],
    K: ["101", "101", "110", "101", "101"],
    L: ["100", "100", "100", "100", "111"],
    M: ["101", "111", "111", "101", "101"],
    O: ["111", "101", "101", "101", "111"],
    V: ["101", "101", "101", "101", "010"],
    잠: ["111", "101", "111", "010", "111"],
    실: ["111", "001", "111", "100", "111"],
    사: ["101", "101", "111", "001", "001"],
    직: ["111", "101", "111", "100", "111"],
    고: ["111", "001", "001", "001", "111"],
    척: ["111", "101", "111", "010", "111"],
    돔: ["111", "101", "111", "101", "111"],
    광: ["111", "101", "111", "111", "101"],
    주: ["101", "101", "111", "010", "010"],
    대: ["101", "111", "101", "111", "101"],
    구: ["111", "001", "001", "001", "111"],
    문: ["111", "101", "111", "101", "101"],
    학: ["111", "101", "111", "010", "111"],
    수: ["101", "101", "111", "010", "010"],
    원: ["111", "101", "101", "111", "001"],
    창: ["111", "101", "111", "010", "111"],
    전: ["111", "010", "111", "010", "111"],
    중: ["111", "101", "111", "101", "111"],
    립: ["111", "100", "111", "101", "111"]
  };
  let cursor = x;
  ctx.fillStyle = color;
  for (const ch of String(text ?? "").toUpperCase()) {
    const rows = glyphs[ch];
    if (!rows) {
      cursor += scale * 2;
      continue;
    }
    rows.forEach((row, rowIndex) => {
      [...row].forEach((dot, colIndex) => {
        if (dot === "1") ctx.fillRect(cursor + colIndex * scale, y + rowIndex * scale, scale, scale);
      });
    });
    cursor += scale * 4;
  }
}

function fillCircleCanvas(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  for (let y = -radius; y <= radius; y += 1) {
    const span = Math.floor(Math.sqrt(Math.max(0, radius * radius - y * y)));
    ctx.fillRect(cx - span, cy + y, span * 2 + 1, 1);
  }
}

function fieldX(runtime, value) {
  return Math.round((Number(value) / 120) * runtime.width);
}

function fieldY(runtime, value) {
  return Math.round((Number(value) / 108) * runtime.height);
}

function fieldSize(runtime, value) {
  return Math.max(1, Math.round((Number(value) / 120) * runtime.width));
}

function phaserHomePlateCluster(runtime) {
  const home = runtime.basePositions?.home ?? { x: fieldX(runtime, 60), y: fieldY(runtime, 96) };
  return {
    catcher: { x: home.x - fieldSize(runtime, 1), y: home.y + fieldSize(runtime, 4) },
    umpire: { x: home.x - fieldSize(runtime, 6), y: home.y + fieldSize(runtime, 8) }
  };
}

function fillDiamond(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
  ctx.closePath();
  ctx.fill();
}

function drawLineCanvas(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function buildStaticDefenseSprites(runtime, frame) {
  if (!frame.event) return [];
  const movingFielders = new Set(frame.activeFielders ?? []);
  const plate = phaserHomePlateCluster(runtime);
  const color = frame.defenseColor ?? runtime.palette.defender;
  const jerseyColor = frame.defenseJerseyColor ?? runtime.palette.defenderL;
  const jerseyShadow = frame.defenseJerseyShadow ?? runtime.palette.uniformSh;
  const accentColor = frame.defenseAccentColor ?? color;
  const positions = [
    { key: "C", x: plate.catcher.x, y: plate.catcher.y },
    { key: "1B", x: fieldX(runtime, 83), y: fieldY(runtime, 70) },
    { key: "2B", x: fieldX(runtime, 73), y: fieldY(runtime, 62) },
    { key: "3B", x: fieldX(runtime, 37), y: fieldY(runtime, 70) },
    { key: "SS", x: fieldX(runtime, 46), y: fieldY(runtime, 63) },
    { key: "P", x: fieldX(runtime, 60), y: fieldY(runtime, 72.8) },
    { key: "LF", x: fieldX(runtime, 31), y: fieldY(runtime, 47) },
    { key: "CF", x: fieldX(runtime, 60), y: fieldY(runtime, 34) },
    { key: "RF", x: fieldX(runtime, 89), y: fieldY(runtime, 47) }
  ];
  const sprites = [];
  for (const item of positions) {
    if (movingFielders.has(item.key)) continue;
    const transition = staticFielderTransition(runtime, item, frame);
    const position = transition?.position ?? { x: item.x, y: item.y };
    const profile = item.key === "P"
      ? frame.event?.pitcherProfile ?? null
      : frame.event?.defenseProfilesByPosition?.[item.key] ?? null;
    const uniformRaw = String(profile?.uniformNumber ?? "").trim();
    const uniformValue = Number(uniformRaw);
    const ability = phaserFieldingAbility(frame.event, item.key);
    const active = item.key === "P"
      || item.key === String(frame.event?.fieldingPosition ?? frame.event?.defenderPosition ?? "").toUpperCase();
    sprites.push({
      position,
      color,
      jerseyColor,
      jerseyShadow,
      accentColor,
      pose: transition ? "run" : item.key === "C" ? "catcher" : "field",
      animationKey: transition ? "run" : item.key === "C" ? "catcher" : null,
      animationT: transition ? transition.t * 2 : 0,
      animationLoop: Boolean(transition),
      runFrame: transition ? Math.floor(transition.t * 8) % 4 : 0,
      fieldingKey: item.key,
      facing: transition ? transition.facing : item.key === "C" ? 1 : undefined,
      uniformNumber: uniformRaw && Number.isFinite(uniformValue) ? Math.abs(Math.floor(uniformValue)) % 10 : undefined,
      ...phaserAbilitySpriteFields(ability, active)
    });
  }
  return sprites;
}

function phaserFieldingAbility(event, key) {
  const fieldingKey = String(key ?? "").toUpperCase();
  if (fieldingKey === "P") return event?.pitcherAbility ?? event?.defenseAbilityByPosition?.P ?? null;
  const activeKey = String(event?.fieldingPosition ?? event?.defenderPosition ?? "").toUpperCase();
  if (fieldingKey && fieldingKey === activeKey && event?.defenderAbility) return event.defenderAbility;
  return event?.defenseAbilityByPosition?.[fieldingKey] ?? null;
}

function phaserAbilitySpriteFields(ability, active = false) {
  if (!ability?.grade || !ability?.color) return {};
  return {
    abilityGrade: String(ability.grade),
    abilityColor: String(ability.color),
    abilityScore: Number(ability.score ?? 0),
    abilityActive: Boolean(active),
    playerId: String(ability.playerId ?? ""),
    playerName: String(ability.playerName ?? "")
  };
}

function staticFielderTransition(runtime, item, frame) {
  if (!frame?.bridge || frame?.inningSlate?.text !== "CHANGE") return null;
  const t = Math.max(0, Math.min(1, Number(frame.gapProgress ?? 0)));
  if (t <= 0.04) return null;
  const eased = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  const homeSide = item.x >= fieldX(runtime, 60);
  const target = {
    x: fieldX(runtime, homeSide ? 112 : 8),
    y: fieldY(runtime, item.key === "C" || item.key === "P" ? 94 : 88)
  };
  return {
    t,
    facing: target.x >= item.x ? 1 : -1,
    position: {
      x: Math.round(item.x + (target.x - item.x) * eased),
      y: Math.round(item.y + (target.y - item.y) * eased)
    }
  };
}

function compareGamecastActorDepth(a, b) {
  const ay = gamecastActorDepthY(a);
  const by = gamecastActorDepthY(b);
  if (ay !== by) return ay - by;
  const homeCluster = gamecastHomeClusterOrder(a) - gamecastHomeClusterOrder(b);
  if (homeCluster !== 0) return homeCluster;
  return gamecastActorRoleOrder(a) - gamecastActorRoleOrder(b);
}

function gamecastActorDepthY(actor) {
  const y = Number(actor?.sprite?.position?.y ?? 0);
  if (String(actor?.sprite?.fieldingKey ?? "") === "C") return y + 1;
  if (actor?.role === "batter") return y + 3;
  if (actor?.role === "umpire") return y + 5;
  return y;
}

function gamecastHomeClusterOrder(actor) {
  if (String(actor?.sprite?.fieldingKey ?? "") === "C") return 1;
  if (actor?.role === "batter") return 2;
  if (actor?.role === "umpire") return 3;
  return 0;
}

function gamecastActorRoleOrder(actor) {
  if (actor?.role === "defenderStatic") return 1;
  if (actor?.role === "defender") return 2;
  if (actor?.role === "runner") return 3;
  if (actor?.role === "batter") return 4;
  if (actor?.role === "umpire") return 5;
  return 0;
}

function drawPhaserAtmosphere(graphics, runtime, frame) {
  const palette = runtime.palette;
  const progress = Number(frame.progress ?? 0);
  if (frame.scoreFlash || (frame.event?.outcome === "homeRun" && frame.resultRevealed)) {
    const color = frame.event?.outcome === "homeRun" ? palette.homerL : palette.spark;
    for (const y of [fieldY(runtime, 18), fieldY(runtime, 24)]) {
      for (let x = fieldX(runtime, 14); x < fieldX(runtime, 106); x += fieldSize(runtime, 9)) {
        if ((x + Math.floor(progress * 30)) % 3 === 0) rect(graphics, runtime, x, y, fieldSize(runtime, 4), 1, color, 0.85);
      }
    }
  }
}

function drawRunnerEffects(graphics, runtime, runner, palette) {
  for (const point of runner.dust ?? []) {
    rect(graphics, runtime, point.x - 1, point.y + 1, 2, 1, palette.dirtL, 0.5);
  }
  for (const point of runner.trail ?? []) {
    rect(graphics, runtime, point.x - 1, point.y - 6, 2, 2, runner.trailColor ?? palette.runnerL, 0.35);
  }
}

function drawGamecastPlayer(scene, graphics, runtime, sprite, role, useSprites) {
  drawPlayerAbilityPlate(graphics, runtime, sprite, role);
  if (useSprites && drawSpritePlayer(scene, graphics, runtime, sprite, role)) return;
  drawPlayer(graphics, runtime, sprite, role);
}

function drawPlayerAbilityPlate(graphics, runtime, sprite, role) {
  if (!sprite?.position || !sprite.abilityGrade || !sprite.abilityColor) return;
  const x = Number(sprite.position.x ?? 0);
  const y = Number(sprite.position.y ?? 0);
  const renderScale = gamecastPlayerRenderScale(runtime, sprite, role);
  const active = Boolean(sprite.abilityActive);
  const width = Math.max(16, Math.round(24 * renderScale) + (active ? 4 : 0));
  const height = active ? 8 : 7;
  const left = x - width / 2;
  const top = y - height / 2 + 1;
  rect(graphics, runtime, left - 2, top - 2, width + 4, height + 4, runtime.palette.outline, active ? 0.92 : 0.76);
  rect(graphics, runtime, left, top, width, height, sprite.abilityColor, active ? 0.96 : 0.72);
  rect(graphics, runtime, left + 2, top + 2, width - 4, Math.max(2, height - 4), runtime.palette.uniformSh, 0.96);
  drawAbilityGradeGlyph(graphics, runtime, String(sprite.abilityGrade).slice(0, 1), left + width - 5, top + 1, sprite.abilityColor);
}

function drawAbilityGradeGlyph(graphics, runtime, grade, x, y, color) {
  const patterns = {
    S: ["111", "100", "111", "001", "111"],
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["111", "100", "100", "100", "111"],
    D: ["110", "101", "101", "101", "110"]
  };
  const pattern = patterns[grade] ?? patterns.D;
  for (let row = 0; row < pattern.length; row += 1) {
    for (let column = 0; column < pattern[row].length; column += 1) {
      if (pattern[row][column] === "1") rect(graphics, runtime, x + column, y + row, 1, 1, color, 1);
    }
  }
}

function hasPlayerSprites(scene) {
  return Boolean(scene?.textures?.exists?.("gamecast-player-home") && scene?.textures?.exists?.("gamecast-player-away"));
}

function drawSpritePlayer(scene, graphics, runtime, sprite, role) {
  if (!sprite?.position || !scene?.spriteLayer) return false;
  const palette = runtime.palette;
  const x = Number(sprite.position.x ?? 0);
  const y = Number(sprite.position.y ?? 0);
  const baseKey = isAwayUniform(sprite.jerseyColor) ? "gamecast-player-away" : "gamecast-player-home";
  const accent = sprite.accentColor ?? sprite.color ?? palette.runner;
  const textureKey = ensureTeamSpriteAtlas(scene, baseKey, accent);
  const frame = spriteFrameForPose(scene, textureKey, sprite, role);
  if (!scene.textures.exists(textureKey) || !scene.textures.getFrame(textureKey, frame)) return false;

  const renderScale = gamecastPlayerRenderScale(runtime, sprite, role);
  rect(graphics, runtime, x - 13 * renderScale, y + 1, 26 * renderScale, Math.max(2, 5 * renderScale), palette.shadow, 0.26);

  const metrics = runtime.metrics;
  const facing = Number(sprite.facing ?? (role === "batter" ? -1 : 1));
  const squashX = sprite.squash ? 1.06 : 1;
  const squashY = sprite.squash ? 0.94 : 1;
  const image = acquirePooledImage(scene, "players", scene.spriteLayer, textureKey, frame);
  if (!image) return false;
  image
    .setPosition(Math.round(x * metrics.drawScaleX), Math.round(y * metrics.drawScaleY))
    .setOrigin(CENTER_ORIGIN_X, BASELINE_ORIGIN_Y)
    .setScale(
      metrics.drawScaleX * renderScale * PLAYER_ATLAS_RENDER_SCALE * (facing < 0 ? -squashX : squashX),
      metrics.drawScaleY * renderScale * PLAYER_ATLAS_RENDER_SCALE * squashY
    )
    .setRotation(0);
  return true;
}

function gamecastPlayerRenderScale(runtime, sprite, role) {
  if (Number.isFinite(Number(sprite?.renderScale))) {
    return Math.max(PLAYER_MIN_RENDER_SCALE, Math.min(PLAYER_MAX_RENDER_SCALE, Number(sprite.renderScale)));
  }
  const y = Math.max(0, Math.min(runtime.height, Number(sprite?.position?.y ?? runtime.height * 0.7)));
  const depth = y / Math.max(1, runtime.height);
  const base = PLAYER_MIN_RENDER_SCALE + depth * (PLAYER_MAX_RENDER_SCALE - PLAYER_MIN_RENDER_SCALE);
  if (role === "batter") return Math.min(PLAYER_MAX_RENDER_SCALE, base + 0.025);
  if (role === "umpire") return Math.min(PLAYER_MAX_RENDER_SCALE, base - 0.015);
  if (String(sprite?.fieldingKey ?? "") === "C") return Math.min(PLAYER_MAX_RENDER_SCALE, base - 0.035);
  if (["LF", "CF", "RF"].includes(String(sprite?.fieldingKey ?? ""))) return Math.max(0.43, base - 0.035);
  return base;
}

const CENTER_ORIGIN_X = 0.5;
const BASELINE_ORIGIN_Y = 120 / PLAYER_FALLBACK_ATLAS_SIZE;

function spriteFrameForPose(scene, textureKey, sprite, role) {
  if (role === "umpire") return "umpire";
  if (role?.startsWith("defender") && sprite?.fieldingKey === "C") return "catcher";
  const pose = String(sprite?.pose ?? "idle");
  const animatedFrame = spriteTimelineFrame(scene, textureKey, sprite, role);
  if (animatedFrame) return animatedFrame;
  if (pose === "run") return Number(sprite?.runFrame ?? 0) % 2 ? "run2" : "run1";
  if (pose === "walk") return Number(sprite?.runFrame ?? 0) % 2 ? "walk2" : "walk1";
  if (pose === "load") return "stance";
  if (pose === "throw") return "pitch";
  return PLAYER_ATLAS_FRAMES[pose] ? pose : "idle";
}

function spriteTimelineFrame(scene, textureKey, sprite, role) {
  const key = spriteAnimationKey(sprite, role);
  if (!key) return null;
  const spec = selectSpriteAnimationSpec(scene, textureKey, key);
  if (!spec?.frames?.length) return null;
  const t = normalizeAnimationTime(sprite?.animationT ?? sprite?.animationProgress ?? sprite?.runFrame ?? 0, Boolean(sprite?.animationLoop));
  const total = spec.durations.reduce((sum, value) => sum + Math.max(1, Number(value) || 1), 0);
  let cursor = t * Math.max(1, total);
  for (let index = 0; index < spec.frames.length; index += 1) {
    cursor -= Math.max(1, Number(spec.durations[index]) || 1);
    if (cursor <= 0 || index === spec.frames.length - 1) return spec.frames[index];
  }
  return spec.frames[spec.frames.length - 1] ?? null;
}

function spriteAnimationKey(sprite, role) {
  if (sprite?.animationKey) return String(sprite.animationKey);
  const pose = String(sprite?.pose ?? "");
  if (role === "batter" && ["stance", "load", "swing", "follow", "miss"].includes(pose)) return "swing";
  if (pose === "windup" || pose === "pitch") return "pitch";
  if (pose === "run" || pose === "walk" || pose === "slide" || pose === "catch" || pose === "dive" || pose === "throw") return pose;
  if (role?.startsWith("defender") && sprite?.fieldingKey === "C") return "catcher";
  return null;
}

function normalizeAnimationTime(value, loop = false) {
  const raw = Number(value) || 0;
  if (loop) return ((raw % 1) + 1) % 1;
  return Math.max(0, Math.min(0.999, raw));
}

function selectSpriteAnimationSpec(scene, textureKey, key) {
  const v3 = PLAYER_V3_ANIMATIONS[key];
  if (v3 && v3.frames.every((frame) => textureHasFrame(scene, textureKey, frame))) return v3;
  const v2 = PLAYER_V2_ANIMATIONS[key];
  if (v2 && v2.frames.every((frame) => textureHasFrame(scene, textureKey, frame))) return v2;
  const legacy = PLAYER_LEGACY_ANIMATIONS[key];
  if (legacy) {
    const frames = [];
    const durations = [];
    for (let index = 0; index < legacy.frames.length; index += 1) {
      if (!textureHasFrame(scene, textureKey, legacy.frames[index])) continue;
      frames.push(legacy.frames[index]);
      durations.push(legacy.durations[index] ?? 100);
    }
    if (frames.length) return { frames, durations };
  }
  return null;
}

function textureHasFrame(scene, textureKey, frame) {
  return Boolean(scene?.textures?.exists?.(textureKey) && scene.textures.getFrame(textureKey, frame));
}

export function ensureTeamSpriteAtlas(scene, baseKey, accentColor) {
  const normalized = normalizeSpriteHex(accentColor, "#d23b3b");
  const cacheKey = `${baseKey}-${normalized.slice(1).toLowerCase()}`;
  if (scene.textures.exists(cacheKey)) return cacheKey;
  if (scene.gamecastTeamTextureCache?.has(cacheKey)) return scene.gamecastTeamTextureCache.get(cacheKey);

  try {
    const baseTexture = scene.textures.get(baseKey);
    const source = baseTexture?.getSourceImage?.();
    if (!source?.width || !source?.height) return baseKey;

    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return baseKey;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const primary = hexToRgb(normalized, [210, 59, 59]);
    const secondary = mixRgb(primary, [35, 32, 42], 0.28);
    for (let offset = 0; offset < imageData.data.length; offset += 4) {
      const alpha = imageData.data[offset + 3];
      if (alpha < 8) continue;
      const pixel = [imageData.data[offset], imageData.data[offset + 1], imageData.data[offset + 2]];
      if (isNearRgb(pixel, [210, 59, 59], 18)) {
        imageData.data[offset] = primary[0];
        imageData.data[offset + 1] = primary[1];
        imageData.data[offset + 2] = primary[2];
      } else if (isNearRgb(pixel, [178, 58, 72], 18)) {
        imageData.data[offset] = secondary[0];
        imageData.data[offset + 1] = secondary[1];
        imageData.data[offset + 2] = secondary[2];
      }
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = scene.textures.addCanvas(cacheKey, canvas);
    for (const name of playerTextureFrameNames(scene, baseKey)) {
      const rect = playerTextureFrameRect(scene, baseKey, name);
      if (!rect || rect.x + rect.width > canvas.width || rect.y + rect.height > canvas.height) continue;
      texture.add(name, rect.sourceIndex, rect.x, rect.y, rect.width, rect.height);
    }
    texture.refresh?.();
    scene.gamecastTeamTextureCache?.set(cacheKey, cacheKey);
    return cacheKey;
  } catch (_error) {
    return baseKey;
  }
}

function playerTextureFrameNames(scene, textureKey) {
  const texture = scene?.textures?.get?.(textureKey);
  const names = typeof texture?.getFrameNames === "function"
    ? texture.getFrameNames().filter((name) => name && name !== "__BASE")
    : [];
  return names.length ? names : Object.keys(PLAYER_ATLAS_FRAMES);
}

function playerTextureFrameRect(scene, textureKey, name) {
  const frame = scene?.textures?.getFrame?.(textureKey, name);
  if (frame) {
    const x = Number(frame.cutX ?? frame.x ?? 0);
    const y = Number(frame.cutY ?? frame.y ?? 0);
    const width = Number(frame.cutWidth ?? frame.width ?? PLAYER_FALLBACK_ATLAS_SIZE);
    const height = Number(frame.cutHeight ?? frame.height ?? PLAYER_FALLBACK_ATLAS_SIZE);
    return {
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
      sourceIndex: Number(frame.sourceIndex ?? 0)
    };
  }

  const fallback = PLAYER_ATLAS_FRAMES[name];
  if (!fallback) return null;
  return {
    x: fallback[0] * PLAYER_FALLBACK_ATLAS_SIZE,
    y: fallback[1] * PLAYER_FALLBACK_ATLAS_SIZE,
    width: PLAYER_FALLBACK_ATLAS_SIZE,
    height: PLAYER_FALLBACK_ATLAS_SIZE,
    sourceIndex: 0
  };
}

function isAwayUniform(color) {
  const rgb = hexToRgb(color, [247, 247, 242]);
  const lightness = (Math.max(...rgb) + Math.min(...rgb)) / 2;
  return lightness < 210;
}

function drawPlayer(graphics, runtime, sprite, role) {
  if (!sprite?.position) return;
  const palette = runtime.palette;
  const x = Number(sprite.position.x ?? 0);
  const y = Number(sprite.position.y ?? 0);
  const jersey = sprite.jerseyColor ?? (role?.startsWith("defender") ? palette.defenderL : palette.uniform);
  const jerseyShadow = sprite.jerseyShadow ?? palette.uniformSh;
  const accent = sprite.accentColor ?? sprite.color ?? palette.runner;
  const skin = palette.skin;
  const legs = palette.legs;
  const pose = sprite.pose ?? "idle";
  const frame = Number(sprite.runFrame ?? 0);
  const facing = Number(sprite.facing ?? (role === "batter" ? -1 : 1));
  const stride = frame % 2 === 0 ? 1 : -1;

  rect(graphics, runtime, x - 5, y + 1, 10, 2, palette.shadow, 0.38);
  if (pose === "slide") {
    rect(graphics, runtime, x - 7, y - 4, 12, 3, palette.outline);
    rect(graphics, runtime, x - 6, y - 5, 9, 3, jersey);
    rect(graphics, runtime, x + 3, y - 7, 3, 3, skin);
    rect(graphics, runtime, x - 8, y - 3, 5, 2, legs);
    return;
  }

  rect(graphics, runtime, x - 4, y - 18, 8, 3, palette.outline);
  rect(graphics, runtime, x - 3, y - 19, 6, 3, accent);
  rect(graphics, runtime, x + facing * 2, y - 17, 4 * facing, 1, accent);
  rect(graphics, runtime, x - 4, y - 16, 8, 7, skin);
  rect(graphics, runtime, x - 2, y - 13, 1, 1, palette.outline, 0.85);
  rect(graphics, runtime, x + 2, y - 13, 1, 1, palette.outline, 0.85);
  rect(graphics, runtime, x - 4, y - 10, 8, 8, palette.outline);
  rect(graphics, runtime, x - 3, y - 10, 6, 6, jersey);
  rect(graphics, runtime, x - 3, y - 4, 6, 2, jerseyShadow);
  rect(graphics, runtime, x - 5, y - 8, 2, 5, jerseyShadow);
  rect(graphics, runtime, x + 3, y - 8, 2, 5, jerseyShadow);
  rect(graphics, runtime, x - 4, y - 1, 3, 5 + stride, legs);
  rect(graphics, runtime, x + 1, y - 1, 3, 5 - stride, legs);

  if (pose === "windup" || pose === "pitch") {
    rect(graphics, runtime, x - 7, y - 12, 3, 2, accent);
    rect(graphics, runtime, x + 4, y - 11, 5, 2, palette.ballWake);
  } else if (pose === "stance" || pose === "load" || pose === "swing" || pose === "follow" || pose === "miss") {
    const batColor = pose === "miss" ? palette.throw : palette.bat;
    rect(graphics, runtime, x + facing * 4, y - 13, facing * 8, 2, batColor);
    if (pose === "swing" || pose === "follow") rect(graphics, runtime, x - 8, y - 14, 18, 1, palette.sparkL, 0.8);
  } else if (pose === "watch") {
    rect(graphics, runtime, x - 6, y - 8, 2, 4, skin);
    rect(graphics, runtime, x + 4, y - 8, 2, 4, skin);
  } else if (role?.startsWith("defender")) {
    rect(graphics, runtime, x + 4, y - 7, 4, 3, palette.glove);
  }
}

function buildUmpireSprite(runtime, frame) {
  if (!frame.event) return null;
  const plate = phaserHomePlateCluster(runtime);
  return {
    position: { ...plate.umpire },
    jerseyColor: "#25232c",
    jerseyShadow: "#15131a",
    accentColor: "#5f5b67",
    pose: "idle",
    renderScale: 0.6
  };
}

function drawThrowLines(scene, graphics, runtime, frame) {
  const palette = runtime.palette;
  for (const line of frame.throwLines ?? []) {
    const t = Math.max(0, Math.min(1, Number(line.t ?? 0)));
    const current = {
      x: lerp(line.from?.x, line.to?.x, t),
      y: lerp(line.from?.y, line.to?.y, t)
    };
    const opacity = Number(line.opacity ?? 1);
    drawLine(graphics, runtime, line.from, line.to, palette.throw, opacity * 0.22, 1);
    drawLine(graphics, runtime, line.from, current, palette.throw, opacity * 0.82, 1);
    drawGamecastBall(scene, graphics, runtime, {
      ...current,
      size: GAMECAST_THROW_BALL_SIZE,
      opacity,
      velocityX: Number(line.to?.x ?? 0) - Number(line.from?.x ?? 0),
      velocityY: Number(line.to?.y ?? 0) - Number(line.from?.y ?? 0)
    }, palette.base);
  }
}

function drawBallTrail(graphics, runtime, frame) {
  for (const point of frame.ballTrail ?? []) {
    rect(graphics, runtime, point.x - point.size / 2, point.y - point.size / 2, point.size, point.size, point.color, point.opacity);
  }
}

function drawBallShadow(graphics, runtime, shadow) {
  rect(graphics, runtime, shadow.x - shadow.width / 2, shadow.y, shadow.width, 1, runtime.palette.shadow, 0.45);
}

function drawBall(graphics, runtime, ball, color) {
  const size = Math.max(4, Number(ball.size ?? 1) * 3.4);
  const opacity = Number(ball.opacity ?? 1);
  rect(graphics, runtime, ball.x - size / 2, ball.y - size / 2 - 1, size, 1, runtime.palette.outline, opacity);
  rect(graphics, runtime, ball.x - size / 2 - 1, ball.y - size / 2, size + 2, size, runtime.palette.outline, opacity);
  rect(graphics, runtime, ball.x - size / 2, ball.y + size / 2, size, 1, runtime.palette.outline, opacity);
  rect(graphics, runtime, ball.x - size / 2, ball.y - size / 2, size, size, color, opacity);
  rect(graphics, runtime, ball.x, ball.y - 1, 1, 2, runtime.palette.ballSeam, 0.85);
}

function drawGamecastBall(scene, graphics, runtime, ball, color) {
  const speed = Math.abs(Number(ball.velocityX ?? 0)) + Math.abs(Number(ball.velocityY ?? 0));
  const frame = `ball${Math.max(1, Math.min(3, (Math.floor(speed) % 3) + 1))}`;
  if (!scene?.ballSpriteLayer || !scene.textures.exists("gamecast-props") || !scene.textures.getFrame("gamecast-props", frame)) {
    drawBall(graphics, runtime, ball, color);
    return;
  }
  const glow = Math.max(3, Number(ball.size ?? 1) * 2.2);
  rect(graphics, runtime, ball.x - glow, ball.y, glow * 2, 1, color, 0.16);
  rect(graphics, runtime, ball.x, ball.y - glow, 1, glow * 2, color, 0.16);
  const metrics = runtime.metrics;
  const size = Math.max(GAMECAST_BALL_MIN_RENDER_SCALE, Math.min(1.95, Number(ball.size ?? 1) * 0.68));
  const image = acquirePooledImage(scene, "balls", scene.ballSpriteLayer, "gamecast-props", frame);
  if (!image) {
    return;
  }
  image
    .setPosition(Math.round(ball.x * metrics.drawScaleX), Math.round(ball.y * metrics.drawScaleY))
    .setOrigin(0.5)
    .setScale(metrics.drawScaleX * size, metrics.drawScaleY * size)
    .setRotation(0)
    .setAlpha(Math.max(0, Math.min(1, Number(ball.opacity ?? 1))));
}

function drawContactBurst(graphics, runtime, burst, frame) {
  const color = frame.event?.outcome === "homeRun" ? runtime.palette.homerL : runtime.palette.sparkL;
  drawLine(graphics, runtime, { x: burst.x - burst.size, y: burst.y }, { x: burst.x + burst.size, y: burst.y }, color, 0.95, 1);
  drawLine(graphics, runtime, { x: burst.x, y: burst.y - burst.size }, { x: burst.x, y: burst.y + burst.size }, color, 0.95, 1);
}

function shouldShake(frame) {
  if (!frame?.event || frame.done) return false;
  const progress = Number(frame.progress ?? 0);
  if (frame.event.outcome === "homeRun" && frame.scoreRevealed) return true;
  if (Number(frame.event.runs ?? 0) > 0 && frame.scoreRevealed) return true;
  return ["double", "triple", "strikeout"].includes(frame.event.outcome) && progress >= 0.36;
}

function rect(graphics, runtime, x, y, width, height, color, alpha = 1) {
  const metrics = runtime.metrics;
  const rawW = Number(width);
  const rawH = Number(height);
  const startX = rawW < 0 ? Number(x) + rawW : Number(x);
  const startY = rawH < 0 ? Number(y) + rawH : Number(y);
  const px = Math.round(startX * metrics.drawScaleX);
  const py = Math.round(startY * metrics.drawScaleY);
  const pw = Math.max(1, Math.round(Math.abs(rawW) * metrics.drawScaleX));
  const ph = Math.max(1, Math.round(Math.abs(rawH) * metrics.drawScaleY));
  graphics.fillStyle(hexToInt(color), Math.max(0, Math.min(1, Number(alpha) || 0)));
  graphics.fillRect(px, py, pw, ph);
}

function drawLine(graphics, runtime, from, to, color, alpha = 1, width = 1) {
  const metrics = runtime.metrics;
  graphics.lineStyle(Math.max(1, Math.round(width * metrics.drawScaleX)), hexToInt(color), Math.max(0, Math.min(1, Number(alpha) || 0)));
  graphics.beginPath();
  graphics.moveTo(Math.round(from.x * metrics.drawScaleX), Math.round(from.y * metrics.drawScaleY));
  graphics.lineTo(Math.round(to.x * metrics.drawScaleX), Math.round(to.y * metrics.drawScaleY));
  graphics.strokePath();
}

function hexToInt(value, fallback = 0xffffff) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim().replace("#", "");
  const parsed = Number.parseInt(text.length === 3 ? text.split("").map((char) => char + char).join("") : text, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSpriteHex(value, fallback) {
  const text = String(value ?? "").trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (!match) return fallback;
  const raw = match[1].length === 3
    ? match[1].split("").map((char) => char + char).join("")
    : match[1];
  return `#${raw.toLowerCase()}`;
}

function hexToRgb(value, fallback) {
  const normalized = normalizeSpriteHex(value, null);
  if (!normalized) return fallback;
  const raw = normalized.slice(1);
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16)
  ];
}

function mixRgb(a, b, amount) {
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  return a.map((value, index) => Math.round(value * (1 - t) + b[index] * t));
}

function isNearRgb(pixel, target, tolerance) {
  return Math.abs(pixel[0] - target[0]) <= tolerance
    && Math.abs(pixel[1] - target[1]) <= tolerance
    && Math.abs(pixel[2] - target[2]) <= tolerance;
}
