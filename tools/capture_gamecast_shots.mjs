// 게임캐스트 QA 캡처: 헤드리스 크롬으로 랩을 열고 주요 순간을 PNG로 저장
import { spawn } from "node:child_process";
import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

// 사용:
//   node tools/capture_gamecast_shots.mjs [출력폴더] [랩URL]
//   node tools/capture_gamecast_shots.mjs burst [출력폴더] [랩URL]
//   node tools/capture_gamecast_shots.mjs anchors [출력폴더] [랩URL]
// 정적 서버가 떠 있어야 한다 (python -m http.server 5177)
const REQUESTED_MODE = ["burst", "anchors"].includes(process.argv[2]) ? process.argv[2] : "shots";
const MODE = REQUESTED_MODE;
const OUT = MODE === "burst"
  ? (process.argv[3] ?? "reports/gamecast-burst")
  : MODE === "anchors"
    ? (process.argv[3] ?? "reports/gamecast-anchors")
    : (process.argv[2] ?? "reports/gamecast-shots");
const BASE = MODE === "burst"
  ? (process.argv[4] ?? "http://127.0.0.1:5177/gamecast-lab.html?engine=v2&field=field-jamsil-day&team=lg&days=3&fullscreen=1&holds=0&speed=1&fps=1")
  : MODE === "anchors"
    ? (process.argv[4] ?? "http://127.0.0.1:5177/gamecast-lab.html?engine=v2&debug=anchors&field=field-jamsil-day&team=lg&days=3&fullscreen=1&holds=0&speed=1")
    : (process.argv[3] ?? "http://127.0.0.1:5177/gamecast-lab.html");
const PORT = 9223;
mkdirSync(OUT, { recursive: true });

const chromePaths = [
  path.join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe")
];
const { existsSync } = await import("node:fs");
const chrome = chromePaths.find((p) => existsSync(p));
if (!chrome) throw new Error("chrome.exe not found");

const proc = spawn(chrome, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--window-size=1280,900",
  "--no-first-run",
  "--no-default-browser-check",
  "--user-data-dir=" + path.resolve(OUT, "chrome-profile"),
  "about:blank"
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"]
]);

async function urlReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startStaticServerIfNeeded(baseUrl) {
  const url = new URL(baseUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) return null;
  if (await urlReachable(baseUrl)) return null;
  const rootDir = process.cwd();
  const server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "127.0.0.1"));
      const pathname = decodeURIComponent(requestUrl.pathname);
      const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
      let resolved = path.resolve(rootDir, relative);
      if (!resolved.startsWith(rootDir + path.sep) && resolved !== rootDir) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      let info = await stat(resolved).catch(() => null);
      if (info?.isDirectory()) {
        resolved = path.join(resolved, "index.html");
        info = await stat(resolved).catch(() => null);
      }
      if (!info?.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME_TYPES.get(path.extname(resolved).toLowerCase()) ?? "application/octet-stream" });
      createReadStream(resolved).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error?.message ?? error));
    }
  });
  const port = Number(url.port || 80);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, url.hostname, resolve);
  });
  return server;
}

let target = null;
for (let i = 0; i < 40 && !target; i += 1) {
  await sleep(250);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = list.find((t) => t.type === "page");
  } catch { /* retry */ }
}
if (!target) { proc.kill(); throw new Error("CDP target not found"); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) { pending.get(data.id)(data); pending.delete(data.id); }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++msgId;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evalJs = async (expr) => {
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return res.result?.result?.value;
};
const scopedEval = (body) => `(() => { const root = document.querySelector('[data-gamecast-modal]') || document; ${body} })()`;
const shot = async (name) => {
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(OUT, name), Buffer.from(res.result.data, "base64"));
  console.log("saved", name);
};
const burstProbe = () => scopedEval(`
  const screen = root.querySelector("[data-gamecast-screen]");
  const frame = screen?.__gamecastDebugFrame ?? null;
  const defenders = [
    ...((frame?.staticDefense ?? []).map((sprite) => ({ source: "static", ...sprite }))),
    ...((frame?.defenseSprites ?? []).map((sprite) => ({ source: "dynamic", ...sprite })))
  ];
  const dynamicDefense = frame?.defenseSprites ?? [];
  const pitcherVisible = defenders.some((sprite) => String(sprite.fieldingKey ?? sprite.key ?? "") === "P");
  const homerBadDefense = frame?.event?.outcome === "homeRun" && dynamicDefense.some((sprite) => ["catch", "dive", "throw", "lookUp"].includes(String(sprite.pose ?? "")));
  const homerMovingDefense = frame?.event?.outcome === "homeRun" && dynamicDefense.some((sprite) => String(sprite.fieldingKey ?? "") !== "P");
  const defenseOutOfBounds = dynamicDefense.some((sprite) => {
    const pos = sprite.position ?? {};
    const x = Number(pos.x ?? 0);
    const y = Number(pos.y ?? 0);
    return x < 4 || x > 396 || y < 12 || y > 356;
  });
  const movingDefense = dynamicDefense.some((sprite) => String(sprite.fieldingKey ?? "") !== "P");
  const burst = root.querySelector("[data-gamecast-action-burst]");
  const burstVisible = Boolean(burst?.classList.contains("is-visible"));
  const canvas = root.querySelector("[data-gamecast-canvas]");
  const rect = canvas?.getBoundingClientRect();
  return {
    eventId: frame?.event?.id ?? "",
    outcome: frame?.event?.outcome ?? "",
    progress: Number(frame?.progress ?? 0),
    rawProgress: Number(frame?.rawProgress ?? 0),
    resultRevealed: Boolean(frame?.resultRevealed),
    scoreRevealed: Boolean(frame?.scoreRevealed),
    ballVisible: Boolean(frame?.ball),
    ballKind: frame?.ball?.kind ?? "",
    ballX: Math.round(Number(frame?.ball?.x ?? 0)),
    ballY: Math.round(Number(frame?.ball?.y ?? 0)),
    ballTrailCount: frame?.ballTrail?.length ?? 0,
    pitcherVisible,
    movingDefense,
    homerBadDefense,
    homerMovingDefense,
    defenseOutOfBounds,
    runnerCount: frame?.runners?.length ?? 0,
    burstVisible,
    burstText: burst?.textContent?.trim() ?? "",
    scoreText: [...root.querySelectorAll(".gamecast-scoreline strong")].map((node) => node.textContent.trim()).join("-"),
    jumbotron: root.querySelector("[data-gamecast-jumbo-result]")?.textContent?.trim() ?? "",
    canvasWidth: Math.round(rect?.width ?? 0),
    canvasHeight: Math.round(rect?.height ?? 0)
  };
`);

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

const go = async (url, waitMs) => { await send("Page.navigate", { url }); await sleep(waitMs); };
const managedServer = await startStaticServerIfNeeded(BASE);
const assertGamecastReady = async () => {
  const ready = await evalJs(scopedEval("return Boolean(root.querySelector('[data-gamecast-screen]') && root.querySelector('[data-gamecast-canvas]'));"));
  if (!ready) throw new Error(`Gamecast canvas not found at ${BASE}. Check that the static server loaded gamecast-lab.html.`);
};

if (MODE === "burst") {
  await go(BASE, 2600);
  await assertGamecastReady();
  await evalJs(scopedEval("const c=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1;"));
  const samples = [];
  for (let index = 0; index < 16; index += 1) {
    const name = `burst-${String(index + 1).padStart(2, "0")}.png`;
    const meta = await evalJs(burstProbe());
    samples.push({ frame: index + 1, file: name, ...meta });
    await shot(name);
    if (index < 15) await sleep(420);
  }
  const checklist = {
    pitcherFrames: samples.filter((sample) => sample.pitcherVisible).length,
    ballFrames: samples.filter((sample) => sample.ballVisible).length,
    battedBallFrames: samples.filter((sample) => sample.ballKind === "batted").length,
    movingDefenseFrames: samples.filter((sample) => sample.movingDefense).length,
    homeRunBadDefenseFrames: samples.filter((sample) => sample.homerBadDefense).length,
    homeRunMovingDefenseFrames: samples.filter((sample) => sample.homerMovingDefense).length,
    defenseOutOfBoundsFrames: samples.filter((sample) => sample.defenseOutOfBounds).length,
    runnerFrames: samples.filter((sample) => sample.runnerCount > 0).length,
    burstBeforeRevealFrames: samples.filter((sample) => sample.burstVisible && !sample.resultRevealed).length
  };
  writeFileSync(path.join(OUT, "burst-summary.json"), JSON.stringify({ checklist, samples }, null, 2));
  console.log("checklist", JSON.stringify(checklist));
  ws.close();
  proc.kill();
  managedServer?.close();
  console.log("done");
  process.exit(0);
}

if (MODE === "anchors") {
  await go(BASE, 1200);
  await assertGamecastReady();
  await evalJs(scopedEval("const c=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1;"));
  const motionSamples = [];
  for (let index = 0; index < 12; index += 1) {
    motionSamples.push(await evalJs(scopedEval(`
      const screen = root.querySelector("[data-gamecast-screen]");
      const frame = screen?.__gamecast2Frame ?? {};
      return {
        frame: ${index + 1},
        eventId: frame.eventId ?? "",
        outcome: frame.outcome ?? "",
        progress: Number(frame.progress ?? 0),
        movingDefenseCount: Number(frame.movingDefenseCount ?? screen?.dataset?.gamecast2MovingDefenseCount ?? 0),
        ballVisible: Boolean(frame.ballVisible ?? screen?.dataset?.gamecast2BallVisible === "1"),
        positionViolations: Number(frame.positionGuard?.violations?.length ?? screen?.dataset?.gamecast2PositionViolations ?? 0)
      };
    `)));
    if (index < 11) await sleep(300);
  }
  const meta = await evalJs(scopedEval(`
    const screen = root.querySelector("[data-gamecast-screen]");
    const canvas = root.querySelector("[data-gamecast-canvas]");
    const anchors = screen?.__gamecast2Anchors?.anchors ?? {};
    const players = screen?.__gamecast2Players ?? { defenders: [], actors: [] };
    const keys = Object.keys(anchors).sort();
    return {
      engine: screen?.dataset?.gamecastEngineCurrent ?? "",
      field: screen?.dataset?.gamecast2Field ?? "",
      fieldLocked: screen?.dataset?.gamecast2FieldLocked === "1",
      anchorCount: Number(screen?.dataset?.gamecast2AnchorCount ?? 0),
      defenderCount: Number(screen?.dataset?.gamecast2DefenderCount ?? 0),
      playerCount: Number(screen?.dataset?.gamecast2PlayerCount ?? 0),
      keys,
      defenders: players.defenders ?? [],
      actors: players.actors ?? [],
      motion: {
        ballFrames: ${JSON.stringify(motionSamples)}.filter((sample) => sample.ballVisible).length,
        movingDefenseFrames: ${JSON.stringify(motionSamples)}.filter((sample) => sample.movingDefenseCount > 0).length,
        homeRunBadDefenseFrames: ${JSON.stringify(motionSamples)}.filter((sample) => sample.outcome === "homeRun" && sample.movingDefenseCount > 0).length,
        positionViolationFrames: ${JSON.stringify(motionSamples)}.filter((sample) => sample.positionViolations > 0).length,
        samples: ${JSON.stringify(motionSamples)}
      },
      canvasPixelW: Number(canvas?.dataset?.pixelW ?? 0),
      canvasPixelH: Number(canvas?.dataset?.pixelH ?? 0)
    };
  `));
  if (meta.engine !== "v2" || meta.field !== "field-jamsil-day" || !meta.fieldLocked || meta.anchorCount < 15 || meta.defenderCount !== 9 || meta.playerCount < 10 || meta.canvasPixelW !== 960 || meta.canvasPixelH !== 720 || meta.motion.positionViolationFrames > 0) {
    throw new Error(`Gamecast v2 anchors failed: ${JSON.stringify(meta)}`);
  }
  writeFileSync(path.join(OUT, "anchors-summary.json"), JSON.stringify(meta, null, 2));
  await shot("anchors.png");
  console.log("anchors", JSON.stringify(meta));
  ws.close();
  proc.kill();
  managedServer?.close();
  console.log("done");
  process.exit(0);
}

await go(BASE, 5000);
await assertGamecastReady();
await evalJs(scopedEval("const c=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1;"));
await shot("01-early.png");
await sleep(2600); await shot("02-pa-mid.png");
await sleep(2600); await shot("03-pa-next.png");
await evalJs(scopedEval("const b=[...root.querySelectorAll('[data-gamecast-speed]')].find(b=>b.dataset.gamecastSpeed==='4'); b && b.click(); return 1;"));
await sleep(14000);
await evalJs(scopedEval("const c=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1;"));
await shot("04-x4-mid.png");
await evalJs(scopedEval("const b=[...root.querySelectorAll('[data-gamecast-skip]')].find(Boolean); b && b.click(); return 1;"));
await sleep(1800); await shot("05-end.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go(BASE + "?m=1", 5000);
await evalJs(scopedEval("const c=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1;"));
await shot("06-mobile.png");

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await go(BASE + "?team=kiwoom&k=1", 5000);
await evalJs(scopedEval("const c=[...root.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1;"));
await shot("07-kiwoom-dome.png");

ws.close();
proc.kill();
managedServer?.close();
console.log("done");
