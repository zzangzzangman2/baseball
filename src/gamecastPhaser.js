const PHASER_DESIGN_W = 400;
const PHASER_DESIGN_H = 360;
const PLAYER_ATLAS_SIZE = 48;
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
    metrics: null
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
  scene.load.atlas("gamecast-player-home", `${SPRITE_ASSET_ROOT}/player-home.png`, `${SPRITE_ASSET_ROOT}/player-home.json`);
  scene.load.atlas("gamecast-player-away", `${SPRITE_ASSET_ROOT}/player-away.png`, `${SPRITE_ASSET_ROOT}/player-away.json`);
  scene.load.atlas("gamecast-props", `${SPRITE_ASSET_ROOT}/props.png`, `${SPRITE_ASSET_ROOT}/props.json`);
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
  const cssScale = available >= runtime.width
    ? Math.max(1, Math.floor(available / runtime.width))
    : Math.max(0.5, available / runtime.width);
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
  drawStaticDefense(scene, player, runtime, frame, useSprites);
  for (const defender of frame.defenseSprites ?? []) drawGamecastPlayer(scene, player, runtime, defender, "defender", useSprites);
  for (const runner of frame.runners ?? []) drawRunnerEffects(fx, runtime, runner, palette);
  for (const runner of frame.runners ?? []) drawGamecastPlayer(scene, player, runtime, runner, "runner", useSprites);
  if (frame.batter) drawGamecastPlayer(scene, player, runtime, frame.batter, "batter", useSprites);
  drawUmpire(scene, player, runtime, frame, useSprites);
  drawThrowLines(ball, runtime, frame);
  drawBallTrail(ball, runtime, frame);
  if (frame.ballShadow) drawBallShadow(ball, runtime, frame.ballShadow);
  if (frame.ball) drawGamecastBall(scene, ball, runtime, frame.ball, frame.ballColor ?? palette.base);
  if (frame.contactBurst) drawContactBurst(fx, runtime, frame.contactBurst, frame);

  const flashAlpha = frame.flash ? 0.2 : frame.scoreFlash ? 0.08 : 0;
  scene.flashRect.setAlpha(flashAlpha);
  endGamecastPoolFrame(scene);
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
  drawFieldCanvas(ctx, runtime.palette, runtime.width, runtime.height, runtime.fieldProfile);
  drawHoldBaseRunners(ctx, runtime, frame);
  ctx.restore();
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
  ctx.fillStyle = "#34303d";
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < sy(43); y += Math.max(2, sy(3))) {
    ctx.fillStyle = y % Math.max(4, sy(8)) === 0 ? "#4a4654" : palette.standD;
    ctx.fillRect(0, y, width, Math.max(1, sy(1)));
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
          const ring = Math.floor((ly - wallY + Math.abs(lx - 60) * 0.16) / 8);
          const stripe = profile.mow === "checker"
            ? Math.floor(lx / 7) + Math.floor(ly / 6)
            : profile.mow === "stripes"
              ? Math.floor((lx + ly * 0.25) / 7)
              : Math.floor(Math.hypot(lx - 60, ly - 101) / 8);
          ctx.fillStyle = (ring + stripe) % 2 ? palette.grassLo : palette.grassHi;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  drawCanvasCrowd(ctx, palette, sx, sy, width, height, profile, scale);
  drawCanvasStadiumTrim(ctx, palette, sx, sy, width, scale, profile);

  fillCircleCanvas(ctx, sx(60), sy(79), sx(26), palette.grassLo);
  fillCircleCanvas(ctx, sx(60), sy(79), sx(22), palette.grassHi);
  fillDiamond(ctx, palette.dirtM, [
    [sx(60), sy(55)],
    [sx(88), sy(77)],
    [sx(60), sy(100)],
    [sx(32), sy(77)]
  ]);
  fillDiamond(ctx, palette.grassHi, [
    [sx(60), sy(68)],
    [sx(76), sy(80)],
    [sx(60), sy(93)],
    [sx(44), sy(80)]
  ]);
  drawLineCanvas(ctx, sx(60), sy(96), sx(16), sy(42), palette.chalkSh, scale);
  drawLineCanvas(ctx, sx(60), sy(96), sx(104), sy(42), palette.chalkSh, scale);
  drawLineCanvas(ctx, sx(60), sy(96), sx(33), sy(76), palette.chalkSh, 1);
  drawLineCanvas(ctx, sx(60), sy(96), sx(87), sy(76), palette.chalkSh, 1);

  for (const [x, y] of [[60, 96], [86, 76], [60, 56], [34, 76]]) {
    ctx.fillStyle = palette.outline;
    ctx.fillRect(sx(x) - 2, sy(y) - 1, 5, 3);
    ctx.fillStyle = palette.base;
    ctx.fillRect(sx(x) - 1, sy(y), 3, 2);
  }
  ctx.fillStyle = palette.dirtL;
  ctx.fillRect(sx(55), sy(73), sx(10), sy(5));
  ctx.fillStyle = palette.outline;
  ctx.fillRect(sx(58), sy(75), sx(4), sy(2));
  ctx.fillStyle = palette.chalkSh;
  ctx.fillRect(sx(50), sy(91), sx(5), scale);
  ctx.fillRect(sx(66), sy(91), sx(5), scale);
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
  const startY = sy(3);
  const endY = sy(42);
  const stepX = Math.max(scale * (dense > 0.82 ? 4 : dense > 0.52 ? 5 : 7), sx(dense > 0.82 ? 3 : dense > 0.52 ? 4 : 6));
  const stepY = Math.max(scale * (dense > 0.82 ? 5 : 6), sy(dense > 0.82 ? 4 : 5));
  for (let y = startY; y < endY; y += stepY) {
    const row = Math.floor((y - startY) / Math.max(1, stepY));
    for (let x = sx(2) + (row % 2 ? Math.floor(stepX / 2) : 0); x < width - sx(3); x += stepX) {
      const lx = (x / width) * 120;
      const ly = (y / height) * 108;
      if (ly >= phaserOutfieldWallY(profile, lx) - 1) continue;
      if (((row * 19 + x) % 100) > dense * 100) continue;
      if ((row * 17 + x) % 41 === 0) {
        ctx.fillStyle = palette.outline;
        ctx.fillRect(x - scale, y + scale, scale * 7, scale * 4);
        ctx.fillStyle = palette.base;
        ctx.fillRect(x, y + scale * 2, scale * 5, scale);
        ctx.fillStyle = shirts[(row + x) % shirts.length];
        ctx.fillRect(x + scale, y + scale, scale * 3, scale);
        continue;
      }
      ctx.fillStyle = palette.crowdHair;
      ctx.fillRect(x, y, scale * 4, scale);
      ctx.fillStyle = palette.crowdSkin;
      ctx.fillRect(x + scale, y + scale, scale * 2, scale * 2);
      ctx.fillStyle = palette.outline;
      ctx.fillRect(x + scale, y + scale * 2, scale, scale);
      ctx.fillRect(x + scale * 2, y + scale * 2, scale, scale);
      ctx.fillStyle = shirts[(row + x) % shirts.length];
      ctx.fillRect(x, y + scale * 3, scale * 4, scale * 2);
      ctx.fillStyle = row % 3 === 0 ? palette.sparkL : palette.stand;
      ctx.fillRect(x, y + scale * 5, scale * 4, scale);
    }
  }
}

function drawCanvasStadiumTrim(ctx, palette, sx, sy, width, scale, profile) {
  if (profile.roofed) {
    ctx.fillStyle = "#263343";
    for (let y = sy(1); y < sy(18); y += Math.max(scale, sy(4))) {
      ctx.fillRect(sx(5), y, sx(110), scale);
    }
    ctx.fillStyle = "rgba(221, 236, 255, 0.28)";
    ctx.fillRect(sx(12), sy(19), sx(96), scale);
  }
  ctx.fillStyle = palette.outline;
  ctx.fillRect(sx(40), sy(3), sx(40), sy(13));
  ctx.fillStyle = "#0d1915";
  ctx.fillRect(sx(42), sy(5), sx(36), sy(9));
  ctx.fillStyle = palette.wallCap;
  ctx.fillRect(sx(42), sy(5), sx(36), scale);
  drawTinyCanvasText(ctx, String(profile.label ?? "KBO").slice(0, 4), sx(46), sy(8), palette.base, scale);
  drawTinyCanvasText(ctx, profile.roofed ? "DOME" : "LIVE", sx(62), sy(8), palette.sparkL, scale);
  ctx.fillStyle = palette.sparkL;
  for (let x = sx(46); x < sx(74); x += Math.max(2, sx(4))) ctx.fillRect(x, sy(9), scale, scale);
  ctx.fillStyle = palette.base;
  ctx.fillRect(sx(49), sy(11), sx(8), scale);
  ctx.fillRect(sx(63), sy(11), sx(8), scale);

  const adColors = [palette.ribbon, palette.defender, palette.spark, palette.runner, palette.wallCap];
  for (let index = 0; index < 10; index += 1) {
    const x = sx(7 + index * 11);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(x, sy(18), sx(8), sy(3));
    ctx.fillStyle = adColors[index % adColors.length];
    ctx.fillRect(x + scale, sy(19), Math.max(scale, sx(6)), scale);
  }

  ctx.fillStyle = palette.pole;
  ctx.fillRect(sx(15), sy(30), scale, sy(25));
  ctx.fillRect(sx(105), sy(30), scale, sy(25));
  ctx.fillStyle = "rgba(255, 246, 199, 0.45)";
  ctx.fillRect(0, sy(26), width, scale);
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

function drawStaticDefense(scene, graphics, runtime, frame, useSprites) {
  if (!frame.event) return;
  const movingFielders = new Set(frame.activeFielders ?? []);
  const color = frame.defenseColor ?? runtime.palette.defender;
  const jerseyColor = frame.defenseJerseyColor ?? runtime.palette.defenderL;
  const jerseyShadow = frame.defenseJerseyShadow ?? runtime.palette.uniformSh;
  const accentColor = frame.defenseAccentColor ?? color;
  const positions = [
    { key: "C", x: fieldX(runtime, 52), y: fieldY(runtime, 100) },
    { key: "1B", x: fieldX(runtime, 94), y: fieldY(runtime, 77) },
    { key: "2B", x: fieldX(runtime, 78), y: fieldY(runtime, 65) },
    { key: "3B", x: fieldX(runtime, 26), y: fieldY(runtime, 77) },
    { key: "SS", x: fieldX(runtime, 42), y: fieldY(runtime, 66) },
    { key: "LF", x: fieldX(runtime, 22), y: fieldY(runtime, 43) },
    { key: "CF", x: fieldX(runtime, 60), y: fieldY(runtime, 31) },
    { key: "RF", x: fieldX(runtime, 98), y: fieldY(runtime, 43) }
  ];
  for (const item of positions) {
    if (movingFielders.has(item.key)) continue;
    drawGamecastPlayer(scene, graphics, runtime, {
      position: { x: item.x, y: item.y },
      color,
      jerseyColor,
      jerseyShadow,
      accentColor,
      pose: "field",
      runFrame: 0,
      fieldingKey: item.key
    }, "defenderStatic", useSprites);
  }
}

function drawPhaserAtmosphere(graphics, runtime, frame) {
  const palette = runtime.palette;
  const progress = Number(frame.progress ?? 0);
  if (frame.scoreFlash || frame.event?.outcome === "homeRun") {
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
  if (useSprites && drawSpritePlayer(scene, graphics, runtime, sprite, role)) return;
  drawPlayer(graphics, runtime, sprite, role);
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

  rect(graphics, runtime, x - 13, y + 1, 26, 5, palette.shadow, 0.28);

  const metrics = runtime.metrics;
  const facing = Number(sprite.facing ?? (role === "batter" ? -1 : 1));
  const squashX = sprite.squash ? 1.06 : 1;
  const squashY = sprite.squash ? 0.94 : 1;
  const image = acquirePooledImage(scene, "players", scene.spriteLayer, textureKey, frame);
  if (!image) return false;
  image
    .setPosition(Math.round(x * metrics.drawScaleX), Math.round(y * metrics.drawScaleY))
    .setOrigin(CENTER_ORIGIN_X, BASELINE_ORIGIN_Y)
    .setScale(metrics.drawScaleX * (facing < 0 ? -squashX : squashX), metrics.drawScaleY * squashY)
    .setRotation(0);
  drawSpriteSkinOverlay(scene, runtime, sprite, role);
  return true;
}

function drawSpriteSkinOverlay(scene, runtime, sprite, role) {
  const graphics = scene?.skinHighlightGraphics;
  if (!graphics || role === "umpire" || sprite?.fieldingKey === "C") return;
  const palette = runtime.palette;
  const x = Number(sprite.position?.x ?? 0);
  const y = Number(sprite.position?.y ?? 0);
  const pose = String(sprite.pose ?? "");
  if (pose === "slide") {
    rect(graphics, runtime, x + 2, y - 12, 8, 5, palette.skin, 0.96);
    rect(graphics, runtime, x + 5, y - 10, 1, 1, palette.outline, 0.9);
    return;
  }
  const faceY = pose === "catch" || pose === "dive" ? y - 29 : y - 30;
  rect(graphics, runtime, x - 8, faceY, 16, 11, palette.skin, 0.98);
  rect(graphics, runtime, x - 6, faceY + 9, 12, 2, palette.skin, 0.88);
  rect(graphics, runtime, x - 4, faceY + 4, 1, 2, palette.outline, 0.88);
  rect(graphics, runtime, x + 3, faceY + 4, 1, 2, palette.outline, 0.88);
  rect(graphics, runtime, x - 8, y - 20, 3, 4, palette.skin, 0.9);
  rect(graphics, runtime, x + 5, y - 20, 3, 4, palette.skin, 0.9);
}

const CENTER_ORIGIN_X = 24 / PLAYER_ATLAS_SIZE;
const BASELINE_ORIGIN_Y = 45 / PLAYER_ATLAS_SIZE;

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

function ensureTeamSpriteAtlas(scene, baseKey, accentColor) {
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
    const originalData = new Uint8ClampedArray(imageData.data);
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
    liftSpriteSkinPixels(imageData, originalData, canvas.width, canvas.height);
    ctx.putImageData(imageData, 0, 0);

    const texture = scene.textures.addCanvas(cacheKey, canvas);
    for (const [name, [col, row]] of Object.entries(PLAYER_ATLAS_FRAMES)) {
      const x = col * PLAYER_ATLAS_SIZE;
      const y = row * PLAYER_ATLAS_SIZE;
      if (x + PLAYER_ATLAS_SIZE > canvas.width || y + PLAYER_ATLAS_SIZE > canvas.height) continue;
      texture.add(name, 0, x, y, PLAYER_ATLAS_SIZE, PLAYER_ATLAS_SIZE);
    }
    texture.refresh?.();
    scene.gamecastTeamTextureCache?.set(cacheKey, cacheKey);
    return cacheKey;
  } catch (_error) {
    return baseKey;
  }
}

function liftSpriteSkinPixels(imageData, originalData, width, height) {
  const skin = [242, 199, 154];
  const skinShadow = [207, 154, 106];
  const writes = [];
  const isSkinPixel = (pixel) => isNearRgb(pixel, skin, 30) || isNearRgb(pixel, skinShadow, 28);
  const canLift = (pixel) => (
    isNearRgb(pixel, [178, 58, 72], 34)
    || isNearRgb(pixel, [210, 59, 59], 34)
    || isNearRgb(pixel, [65, 61, 72], 18)
  );

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (originalData[offset + 3] < 8) continue;
      const sourcePixel = [originalData[offset], originalData[offset + 1], originalData[offset + 2]];
      if (!isSkinPixel(sourcePixel)) continue;
      const baseColor = isNearRgb(sourcePixel, skinShadow, 28) ? skinShadow : skin;
      writes.push([offset, baseColor]);

      const localX = x % PLAYER_ATLAS_SIZE;
      const localY = y % PLAYER_ATLAS_SIZE;
      const headArea = localX >= 8 && localX <= 38 && localY >= 9 && localY <= 25;
      const neighbors = headArea
        ? buildSpriteSkinLiftOffsets()
        : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]];

      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const targetOffset = (ny * width + nx) * 4;
        if (originalData[targetOffset + 3] < 8) continue;
        const targetPixel = [originalData[targetOffset], originalData[targetOffset + 1], originalData[targetOffset + 2]];
        if (canLift(targetPixel)) writes.push([targetOffset, dy < 0 ? skinShadow : skin]);
      }
    }
  }

  for (const [offset, color] of writes) {
    imageData.data[offset] = color[0];
    imageData.data[offset + 1] = color[1];
    imageData.data[offset + 2] = color[2];
  }
}

function buildSpriteSkinLiftOffsets() {
  const offsets = [];
  for (let dy = -1; dy <= 2; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (Math.abs(dx) + Math.abs(dy) > 4) continue;
      offsets.push([dx, dy]);
    }
  }
  return offsets;
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
  } else if (role?.startsWith("defender")) {
    rect(graphics, runtime, x + 4, y - 7, 4, 3, palette.glove);
  }
}

function drawUmpire(scene, graphics, runtime, frame, useSprites) {
  if (!frame.event) return;
  const bases = runtime.basePositions;
  drawGamecastPlayer(scene, graphics, runtime, {
    position: { x: bases.home.x - fieldSize(runtime, 8), y: bases.home.y + fieldSize(runtime, 2) },
    jerseyColor: "#25232c",
    jerseyShadow: "#15131a",
    accentColor: "#5f5b67",
    pose: "idle"
  }, "umpire", useSprites);
}

function drawThrowLines(graphics, runtime, frame) {
  const palette = runtime.palette;
  for (const line of frame.throwLines ?? []) {
    drawLine(graphics, runtime, line.from, line.to, palette.throw, Number(line.opacity ?? 1), 1);
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
  const size = Math.max(2, Number(ball.size ?? 1) * 2.6);
  rect(graphics, runtime, ball.x - size / 2 - 1, ball.y - size / 2 - 1, size + 2, size + 2, runtime.palette.outline, Number(ball.opacity ?? 1));
  rect(graphics, runtime, ball.x - size / 2, ball.y - size / 2, size, size, color, Number(ball.opacity ?? 1));
  rect(graphics, runtime, ball.x, ball.y - 1, 1, size, runtime.palette.ballSeam, 0.85);
}

function drawGamecastBall(scene, graphics, runtime, ball, color) {
  if (!scene?.ballSpriteLayer || !scene.textures.exists("gamecast-props")) {
    drawBall(graphics, runtime, ball, color);
    return;
  }
  const speed = Math.abs(Number(ball.velocityX ?? 0)) + Math.abs(Number(ball.velocityY ?? 0));
  const frame = `ball${Math.max(1, Math.min(3, (Math.floor(speed) % 3) + 1))}`;
  if (!scene.textures.getFrame("gamecast-props", frame)) {
    drawBall(graphics, runtime, ball, color);
    return;
  }
  const metrics = runtime.metrics;
  const size = Math.max(0.7, Math.min(1.2, Number(ball.size ?? 1) * 0.52));
  const image = acquirePooledImage(scene, "balls", scene.ballSpriteLayer, "gamecast-props", frame);
  if (!image) {
    drawBall(graphics, runtime, ball, color);
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
  if (frame.event.outcome === "homeRun" && progress >= 0.68) return true;
  if (Number(frame.event.runs ?? 0) > 0 && progress >= 0.64) return true;
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
