// 게임캐스트 QA 캡처: 헤드리스 크롬으로 랩을 열고 주요 순간을 PNG로 저장
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

// 사용: node tools/capture_gamecast_shots.mjs [출력폴더] [랩URL]
// 정적 서버가 떠 있어야 한다 (python -m http.server 5177)
const OUT = process.argv[2] ?? "reports/gamecast-shots";
const BASE = process.argv[3] ?? "http://127.0.0.1:5177/gamecast-lab.html";
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
const shot = async (name) => {
  const res = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(OUT, name), Buffer.from(res.result.data, "base64"));
  console.log("saved", name);
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

const go = async (url, waitMs) => { await send("Page.navigate", { url }); await sleep(waitMs); };

await go(BASE, 5000);
await evalJs("(() => { const c=[...document.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1; })()");
await shot("01-early.png");
await sleep(2600); await shot("02-pa-mid.png");
await sleep(2600); await shot("03-pa-next.png");
await evalJs("(() => { const b=[...document.querySelectorAll('[data-gamecast-speed]')].find(b=>b.dataset.gamecastSpeed==='4'); b && b.click(); return 1; })()");
await sleep(14000);
await evalJs("(() => { const c=[...document.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1; })()");
await shot("04-x4-mid.png");
await evalJs("(() => { const b=[...document.querySelectorAll('[data-gamecast-skip]')].find(Boolean); b && b.click(); return 1; })()");
await sleep(1800); await shot("05-end.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await go(BASE + "?m=1", 5000);
await evalJs("(() => { const c=[...document.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1; })()");
await shot("06-mobile.png");

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await go(BASE + "?team=kiwoom&k=1", 5000);
await evalJs("(() => { const c=[...document.querySelectorAll('canvas')].find(c=>c.getBoundingClientRect().width>0); c && c.scrollIntoView({block:'center'}); return 1; })()");
await shot("07-kiwoom-dome.png");

ws.close();
proc.kill();
console.log("done");
