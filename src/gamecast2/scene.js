import {
  GAMECAST2_DESIGN_H,
  GAMECAST2_DESIGN_W,
  getGamecast2UrlOptions,
  normalizeGamecast2Anchors,
  selectGamecast2Field
} from "./assets.js";

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
      delete runtime.screen.__gamecast2Anchors;
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
  scene.anchorGraphics = scene.add.graphics().setDepth(20);
  scene.anchorLabels = [];

  const rawAnchors = scene.cache.json.get(`${runtime.field.id}-anchors`);
  runtime.anchors = normalizeGamecast2Anchors(rawAnchors);
  exposeAnchorDebug(runtime);
  rebuildField(scene, runtime);
}

function rebuildField(scene, runtime) {
  scene.fieldLayer.removeAll(true);
  const field = scene.add.image(0, 0, runtime.field.id)
    .setOrigin(0)
    .setScale(runtime.metrics.drawScaleX, runtime.metrics.drawScaleY);
  scene.fieldLayer.add(field);
  drawAnchorOverlay(scene, runtime);
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
    }).setDepth(22);
    scene.anchorLabels.push(label);
  }
}

function exposeAnchorDebug(runtime) {
  runtime.screen.dataset.gamecast2Field = runtime.field.id;
  runtime.screen.dataset.gamecast2AnchorCount = String(Object.keys(runtime.anchors?.anchors ?? {}).length);
  runtime.screen.dataset.gamecast2DebugAnchors = runtime.debugAnchors ? "1" : "0";
  runtime.screen.__gamecast2Anchors = runtime.anchors;
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
