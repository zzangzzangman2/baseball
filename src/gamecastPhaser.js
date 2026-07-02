const PHASER_DESIGN_W = 320;
const PHASER_DESIGN_H = 288;
const PLAYER_ATLAS_SIZE = 48;
const PLAYER_ATLAS_FRAMES = {
  stance: [0, 0],
  swing: [1, 0],
  follow: [2, 0],
  miss: [3, 0],
  take: [4, 0],
  idle: [0, 1],
  run1: [1, 1],
  run2: [2, 1],
  walk1: [3, 1],
  slide: [4, 1],
  windup: [0, 2],
  pitch: [1, 2],
  field: [0, 3],
  catch: [1, 3],
  dive: [2, 3],
  catcher: [3, 3],
  lookUp: [4, 3],
  load: [0, 0],
  walk: [3, 1],
  run: [1, 1],
  coach: [0, 1],
  umpire: [0, 1]
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
    elapsedMs: 0,
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
        runtime.onFrame?.({ ...frame, done: true });
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
  const available = Math.max(runtime.width, Math.floor((rect.width || runtime.width) - horizontalInset));
  const cssScale = Math.max(1, Math.floor(available / runtime.width));
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
  scene.ballGraphics = scene.add.graphics().setDepth(30);
  scene.ballSpriteLayer = scene.add.container(0, 0).setDepth(32);
  scene.fxGraphics = scene.add.graphics().setDepth(40);
  scene.gamecastTeamTextureCache = new Map();
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
  drawFieldCanvas(ctx, runtime.palette, runtime.width, runtime.height);
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
  const finalFrame = frame ?? renderRuntimeFrame(runtime, true);
  runtime.onDone?.(finalFrame);
  stopRuntimeLoop(runtime);
  paintStaticHoldFrame(runtime, finalFrame);
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
  const ball = scene.ballGraphics;
  const fx = scene.fxGraphics;
  const useSprites = hasPlayerSprites(scene);
  player.clear();
  ball.clear();
  fx.clear();
  scene.spriteLayer?.removeAll(true);
  scene.ballSpriteLayer?.removeAll(true);

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
}

function paintStaticHoldFrame(runtime, frame) {
  const ctx = runtime.canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(runtime.metrics.drawScaleX, 0, 0, runtime.metrics.drawScaleY, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawFieldCanvas(ctx, runtime.palette, runtime.width, runtime.height);
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

function drawFieldCanvas(ctx, palette, width, height) {
  const sx = (value) => Math.round((Number(value) / 120) * width);
  const sy = (value) => Math.round((Number(value) / 108) * height);
  ctx.fillStyle = palette.standD;
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < height; y += 2) {
    for (let x = (y % 4 === 0 ? 0 : 2); x < width; x += 4) {
      ctx.fillStyle = ((x + y) % 12 === 0) ? palette.crowdC : ((x + y) % 8 === 0 ? palette.crowdA : palette.stand);
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const fx = sx(60);
  const fy = sy(104);
  const wallRadius = sx(90);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x - fx, y - fy);
      if (distance <= wallRadius) {
        if (distance > wallRadius - sx(2)) ctx.fillStyle = y < sy(30) ? palette.wallCap : palette.wall;
        else if (distance > wallRadius - sx(5)) ctx.fillStyle = palette.track;
        else ctx.fillStyle = Math.floor(distance / Math.max(1, sx(9))) % 2 ? palette.grassLo : palette.grassHi;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  ctx.fillStyle = palette.wallCap;
  ctx.fillRect(sx(46), sy(5), sx(28), sy(7));
  ctx.fillStyle = "#101d19";
  ctx.fillRect(sx(48), sy(6), sx(24), sy(5));
  ctx.fillStyle = palette.sparkL;
  for (let x = sx(52); x < sx(68); x += Math.max(1, sx(4))) ctx.fillRect(x, sy(9), Math.max(1, sx(1)), 1);

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
  drawLineCanvas(ctx, sx(60), sy(96), sx(20), sy(36), palette.chalkSh, 1);
  drawLineCanvas(ctx, sx(60), sy(96), sx(100), sy(36), palette.chalkSh, 1);

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
  const bases = runtime.basePositions;
  const color = frame.defenseColor ?? runtime.palette.defender;
  const jerseyColor = frame.defenseJerseyColor ?? runtime.palette.defenderL;
  const jerseyShadow = frame.defenseJerseyShadow ?? runtime.palette.uniformSh;
  const accentColor = frame.defenseAccentColor ?? color;
  const positions = [
    { key: "C", x: bases.home.x - 6, y: bases.home.y - 1 },
    { key: "1B", x: bases.first.x + 7, y: bases.first.y + 3 },
    { key: "2B", x: bases.second.x + 13, y: bases.second.y + 8 },
    { key: "3B", x: bases.third.x - 8, y: bases.third.y + 3 },
    { key: "SS", x: bases.second.x - 16, y: bases.second.y + 11 },
    { key: "LF", x: bases.third.x - 14, y: bases.third.y - 30 },
    { key: "CF", x: bases.second.x, y: bases.second.y - 33 },
    { key: "RF", x: bases.first.x + 16, y: bases.first.y - 30 }
  ];
  for (const item of positions) {
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
    for (const y of [18, 24]) {
      for (let x = 14; x < 146; x += 9) {
        if ((x + Math.floor(progress * 30)) % 3 === 0) rect(graphics, runtime, x, y, 4, 1, color, 0.85);
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
  const frame = spriteFrameForPose(sprite, role);
  if (!scene.textures.exists(textureKey) || !scene.textures.getFrame(textureKey, frame)) return false;

  rect(graphics, runtime, x - 13, y + 1, 26, 5, palette.shadow, 0.28);

  const metrics = runtime.metrics;
  const facing = Number(sprite.facing ?? (role === "batter" ? -1 : 1));
  const squashX = sprite.squash ? 1.06 : 1;
  const squashY = sprite.squash ? 0.94 : 1;
  const image = scene.add.image(
    Math.round(x * metrics.drawScaleX),
    Math.round(y * metrics.drawScaleY),
    textureKey,
    frame
  )
    .setOrigin(CENTER_ORIGIN_X, BASELINE_ORIGIN_Y)
    .setScale(metrics.drawScaleX * (facing < 0 ? -squashX : squashX), metrics.drawScaleY * squashY);
  scene.spriteLayer.add(image);
  return true;
}

const CENTER_ORIGIN_X = 24 / PLAYER_ATLAS_SIZE;
const BASELINE_ORIGIN_Y = 45 / PLAYER_ATLAS_SIZE;

function spriteFrameForPose(sprite, role) {
  if (role === "umpire") return "umpire";
  if (role?.startsWith("defender") && sprite?.fieldingKey === "C") return "catcher";
  const pose = String(sprite?.pose ?? "idle");
  if (pose === "run") return Number(sprite?.runFrame ?? 0) % 2 ? "run2" : "run1";
  if (pose === "walk") return Number(sprite?.runFrame ?? 0) % 2 ? "walk1" : "idle";
  if (pose === "load") return "stance";
  return PLAYER_ATLAS_FRAMES[pose] ? pose : "idle";
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
    for (const [name, [col, row]] of Object.entries(PLAYER_ATLAS_FRAMES)) {
      texture.add(name, 0, col * PLAYER_ATLAS_SIZE, row * PLAYER_ATLAS_SIZE, PLAYER_ATLAS_SIZE, PLAYER_ATLAS_SIZE);
    }
    texture.refresh?.();
    scene.gamecastTeamTextureCache?.set(cacheKey, cacheKey);
    return cacheKey;
  } catch (_error) {
    return baseKey;
  }
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
  rect(graphics, runtime, x - 3, y - 15, 6, 5, skin);
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
    position: { x: bases.home.x - 10, y: bases.home.y + 2 },
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
  const image = scene.add.image(
    Math.round(ball.x * metrics.drawScaleX),
    Math.round(ball.y * metrics.drawScaleY),
    "gamecast-props",
    frame
  )
    .setOrigin(0.5)
    .setScale(metrics.drawScaleX * size, metrics.drawScaleY * size)
    .setAlpha(Math.max(0, Math.min(1, Number(ball.opacity ?? 1))));
  scene.ballSpriteLayer.add(image);
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
