import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "browser-qa.md");
const PACKAGE_PATH = path.join(ROOT_DIR, "package.json");
const ELECTRON_MAIN_PATH = path.join(ROOT_DIR, "electron-main.cjs");
const INDEX_PATH = path.join(ROOT_DIR, "index.html");

const EXPECTED_TEAM_NAMES = [
  "LG 트윈스",
  "두산 베어스",
  "KIA 타이거즈",
  "삼성 라이온즈",
  "롯데 자이언츠",
  "한화 이글스",
  "SSG 랜더스",
  "KT 위즈",
  "NC 다이노스",
  "키움 히어로즈"
];

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
  { label: "mobile", width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
];
const GAMECAST_REPLAY_WAIT_MS = 8600;

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
  [".ico", "image/x-icon"]
]);

const results = [];
const warnings = [];
const browserErrors = [];
const consoleEvents = [];

let server;
let browserProcess;
let browserProfileDir;
let appUrl;
let cdp;
let browserName = "";

class VerificationError extends Error {
  constructor(message, location) {
    super(message);
    this.name = "VerificationError";
    this.location = location;
  }
}

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(webSocketUrl);
  }

  connect() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("CDP WebSocket 연결 시간이 초과되었습니다."));
      }, 10000);

      this.socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      this.socket.addEventListener("error", (event) => {
        clearTimeout(timeout);
        reject(event.error ?? new Error("CDP WebSocket 연결 오류"));
      }, { once: true });

      this.socket.addEventListener("message", (event) => {
        this.handleMessage(event.data);
      });
    });
  }

  handleMessage(rawMessage) {
    const message = JSON.parse(rawMessage);
    if (message.id) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ""}`));
      } else {
        pending.resolve(message.result ?? {});
      }
      return;
    }

    const listeners = this.listeners.get(message.method);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(message.params ?? {});
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? new Set();
    listeners.add(listener);
    this.listeners.set(method, listeners);
  }

  once(method) {
    return new Promise((resolve) => {
      const listener = (params) => {
        this.off(method, listener);
        resolve(params);
      };
      this.on(method, listener);
    });
  }

  off(method, listener) {
    const listeners = this.listeners.get(method);
    if (!listeners) return;
    listeners.delete(listener);
  }

  close() {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("CDP WebSocket이 닫혔습니다."));
    }
    this.pending.clear();
    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }
  }
}

async function main() {
  try {
    await runCheck("정적 로컬 서버 시작", startStaticServer);
    await runCheck("Chromium 브라우저 연결", launchBrowser);
    await runCheck("Electron 패키징 구성", checkPackagingConfig);
    await runCheck("선수 총원 기준", checkPlayerTotal);

    for (const viewport of VIEWPORTS) {
      await runCheck(`${viewport.label} 렌더링`, () => checkViewport(viewport));
    }

    await runCheck("게임캐스트 랩", checkGamecastLab);
    await runCheck("브라우저 콘솔 에러", checkBrowserConsoleErrors);
  } finally {
    await cleanup();
  }

  const report = buildReport();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf8");
  console.log(report);

  if (results.some((result) => result.status === "FAIL")) {
    process.exitCode = 1;
  }
}

async function runCheck(name, checker) {
  try {
    const detail = await checker();
    results.push({ name, status: "PASS", detail: detail || "정상", location: "" });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      detail: error?.message ?? String(error),
      location: error?.location ?? guessLocation(name)
    });
  }
}

async function startStaticServer() {
  server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const filePath = path.resolve(ROOT_DIR, decodedPath.replace(/^[/\\]+/, ""));

    if (!isInsideRoot(filePath)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const contentType = MIME_TYPES.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream";
      response.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-store"
      });
      response.end(body);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  appUrl = `http://127.0.0.1:${address.port}/index.html`;
  return appUrl;
}

async function launchBrowser() {
  if (typeof WebSocket !== "function") {
    throw new VerificationError(
      "현재 Node 런타임에 WebSocket이 없어 CDP 브라우저 검증을 실행할 수 없습니다. Node 22 이상에서 실행하세요.",
      "tools/verify_browser.mjs"
    );
  }

  const executable = findBrowserExecutable();
  browserName = path.basename(executable);
  browserProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), "kbo-gm-browser-qa-"));

  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-extensions",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "about:blank"
  ];

  browserProcess = spawn(executable, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  const stderrLines = [];
  browserProcess.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    stderrLines.push(text.trim());
  });

  const devtools = await waitForDevToolsEndpoint(browserProfileDir, browserProcess, stderrLines);
  const target = await openCdpTarget(devtools.port, "about:blank");
  cdp = new CdpClient(target.webSocketDebuggerUrl);
  await cdp.connect();
  attachBrowserEventCollectors(cdp);

  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Network.enable");

  return `${browserName} CDP 연결 완료`;
}

function checkPackagingConfig() {
  assertFileExists(PACKAGE_PATH, "package.json");
  assertFileExists(ELECTRON_MAIN_PATH, "electron-main.cjs");
  assertFileExists(INDEX_PATH, "index.html");

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf8"));
  const buildFiles = pkg.build?.files ?? [];
  const missingBuildEntries = ["index.html", "src/**/*", "assets/**/*", "electron-main.cjs"].filter(
    (entry) => !buildFiles.includes(entry)
  );

  assert(pkg.main === "electron-main.cjs", "package.json main이 electron-main.cjs가 아닙니다.", "package.json");
  assert(pkg.scripts?.package, "package.json에 package 스크립트가 없습니다.", "package.json");
  assert(pkg.build?.appId, "electron-builder appId가 없습니다.", "package.json");
  assert(missingBuildEntries.length === 0, `electron-builder files 누락: ${missingBuildEntries.join(", ")}`, "package.json");

  const electronMain = fs.readFileSync(ELECTRON_MAIN_PATH, "utf8");
  assert(
    electronMain.includes("APP_ENTRY_URL") && electronMain.includes("/index.html") && electronMain.includes("loadURL(APP_ENTRY_URL)"),
    "Electron entry URL이 index.html을 가리키지 않습니다.",
    "electron-main.cjs"
  );
  assert(electronMain.includes("nodeIntegration: false"), "Electron nodeIntegration 비활성화 설정을 찾지 못했습니다.", "electron-main.cjs");

  if (!fs.existsSync(path.join(ROOT_DIR, "node_modules", "electron"))) {
    warnings.push("node_modules/electron이 아직 없습니다. 실제 EXE 빌드 전 `npm install`이 필요합니다.");
  }

  return `main=${pkg.main}, product=${pkg.build?.productName ?? pkg.name}`;
}

async function checkPlayerTotal() {
  const dataModule = await import(pathToFileURL(path.join(ROOT_DIR, "src", "data.js")).href);
  const state = dataModule.createInitialState();
  const totalPlayers = state.teams.flatMap((team) => team.roster ?? []).length;

  assert(totalPlayers >= 500, `선수 총원이 ${totalPlayers}명입니다. 최소 500명 이상이어야 합니다.`, "src/data.js");

  if (totalPlayers < 965) {
    warnings.push(`선수 총원은 ${totalPlayers}명입니다. 현재 정책은 검증된 등록/퓨처스 중심 500명대 로스터입니다.`);
  }

  return `총 ${totalPlayers}명`;
}

async function checkViewport(viewport) {
  assert(cdp, "브라우저 CDP 연결이 없습니다.", "tools/verify_browser.mjs");

  browserErrors.length = 0;
  consoleEvents.length = 0;

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile
  });

  const loadEvent = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${appUrl}?qa=${viewport.label}-${Date.now()}` });
  await loadEvent;
  await waitForStartScreen();
  await evaluateInBrowser(`document.querySelector("[data-action='start-new']")?.click(); true`);
  await waitForTeamSelect();
  await evaluateInBrowser(`document.querySelector("[data-action='choose-start-team'][data-team-id='kia']")?.click(); true`);
  await waitForManagerSetup();
  await evaluateInBrowser(`
    (() => {
      const form = document.querySelector("[data-manager-form]");
      if (!form) return false;
      form.querySelector("[name='managerName']").value = "검증감독";
      form.querySelector("[name='managerAge']").value = "38";
      form.querySelector("[name='managerStyle']").value = "balanced";
      form.requestSubmit();
      return true;
    })()
  `);
  await waitForAppointment();
  await evaluateInBrowser(`document.querySelector("[data-appointment-form]")?.requestSubmit(); true`);
  await waitForRenderedApp();
  await installGamecastRafProbe();
  const headerProbe = await evaluateInBrowser(`
    (() => {
      const bodyText = document.body.innerText;
      return {
        hasMainNewsInbox: Boolean(document.querySelector("[data-main-news-inbox]")),
        hasTodayDesk: Boolean(document.querySelector("[data-today-desk]")),
        hasMailboxGrid: Boolean(document.querySelector(".mailbox-grid")),
        mailFilterCount: document.querySelectorAll("[data-action='mail-filter']").length,
        hasUnreadDot: Boolean(document.querySelector(".unread-dot")),
        hasTopbarLogo: Boolean(document.querySelector(".topbar .topbar-logo-plate img")),
        hasDuplicateHero: Boolean(document.querySelector(".hero-card")),
        hasPreseasonDesk: Boolean(document.querySelector("[data-preseason-desk]")),
        hasAssistantBrief: Boolean(document.querySelector("[data-news-type='assistant']")),
        hasMediaBrief: Boolean(document.querySelector("[data-news-type='media']")),
        hasSpotv: bodyText.includes("SPOTV"),
        hasAppointmentNews: bodyText.includes("취임식") && bodyText.includes("받은편지함")
      };
    })()
  `);
  assert(headerProbe.hasTopbarLogo && !headerProbe.hasDuplicateHero, "상단 로고 이동 또는 중복 구단 히어로 제거가 확인되지 않았습니다.", "src/ui.js");
  assert(
    headerProbe.hasMainNewsInbox &&
      headerProbe.hasTodayDesk &&
      headerProbe.hasMailboxGrid &&
      headerProbe.mailFilterCount >= 5 &&
      headerProbe.hasUnreadDot &&
      headerProbe.hasPreseasonDesk &&
      headerProbe.hasAssistantBrief &&
      headerProbe.hasMediaBrief &&
      headerProbe.hasSpotv &&
      headerProbe.hasAppointmentNews,
    "오늘의 데스크/받은편지함/취임식/비서/언론 피드가 확인되지 않았습니다.",
    "src/ui.js"
  );
  const nextGameProbe = await evaluateInBrowser(`
    (() => {
      const panel = document.querySelector(".next-game-panel");
      return {
        hasPanel: Boolean(panel),
        isPreseasonCamp: Boolean(panel?.classList.contains("is-preseason-camp")),
        hasCampDay: Boolean(panel?.querySelector("[data-action='next-day']")),
        hasCampWeek: Boolean(panel?.querySelector("[data-action='week']")),
        hasEnabledWatch: Boolean(panel?.querySelector("[data-action='watch-next-game']:not(:disabled)")),
        hasEnabledQuick: Boolean(panel?.querySelector("[data-action='simulate-next-game']:not(:disabled)")),
        text: panel?.textContent?.trim() ?? ""
      };
    })()
  `);
  assert(
    nextGameProbe.hasPanel &&
      nextGameProbe.isPreseasonCamp &&
      nextGameProbe.hasCampDay &&
      nextGameProbe.hasCampWeek &&
      !nextGameProbe.hasEnabledWatch &&
      !nextGameProbe.hasEnabledQuick &&
      nextGameProbe.text.includes("프리시즌 캠프") &&
      nextGameProbe.text.includes("개막 전 경기 없음"),
    `프리시즌 캠프 패널이 개막 전 경기 버튼을 막지 못했습니다: ${JSON.stringify(nextGameProbe)}`,
    "src/ui.js"
  );
  await switchDashboardTab("lineup");
  const lineupProbe = await evaluateInBrowser(`
    (() => {
      const manager = document.querySelector("[data-lineup-manager]");
      const form = document.querySelector("[data-lineup-form]");
      const before = [...document.querySelectorAll("[data-lineup-slot]")].map((select) => select.value);
      const reversed = before.slice(0, 9).reverse();
      [...document.querySelectorAll("[data-lineup-slot]")].forEach((select, index) => {
        select.value = reversed[index] ?? select.value;
      });
      form?.requestSubmit();
      const afterManager = document.querySelector("[data-lineup-manager]");
      const afterText = afterManager?.textContent ?? "";
      const after = [...document.querySelectorAll("[data-lineup-slot]")].map((select) => select.value);
      return {
        hasManager: Boolean(manager),
        hasForm: Boolean(form),
        slotCount: before.length,
        uniqueCount: new Set(before).size,
        hasSave: Boolean(document.querySelector("[data-lineup-form] button[type='submit']")),
        hasAuto: Boolean(document.querySelector("[data-action='auto-lineup']")),
        hasBalance: afterText.includes("AVG OVR") && afterText.includes("컨디션 리스크"),
        savedManual: afterText.includes("수동 저장"),
        orderPersisted: after.slice(0, 9).join("|") === reversed.join("|")
      };
    })()
  `);
  assert(
    lineupProbe.hasManager &&
      lineupProbe.hasForm &&
      lineupProbe.slotCount === 9 &&
      lineupProbe.uniqueCount === 9 &&
      lineupProbe.hasSave &&
      lineupProbe.hasAuto &&
      lineupProbe.hasBalance &&
      lineupProbe.savedManual &&
      lineupProbe.orderPersisted,
    `라인업 보드 저장 검증 실패: ${JSON.stringify(lineupProbe)}`,
    "src/ui.js"
  );
  await switchDashboardTab("players");
  const playerDetailProbe = await evaluateInBrowser(`
    (() => {
      const row = [...document.querySelectorAll("[data-action='open-player-detail']")]
        .find((node) => (node.dataset.playerId || "").trim().length > 0);
      row?.click();
      const panel = document.querySelector("[data-player-detail]");
      const panelText = panel?.textContent ?? "";
      const attributeNodes = [...(panel?.querySelectorAll(".player-attribute") ?? [])];
      return {
        clickableRows: document.querySelectorAll("[data-action='open-player-detail'][data-player-id]").length,
        hasPanel: Boolean(panel),
        hasIdentity: Boolean(panel?.querySelector(".player-detail-identity h2")),
        hasLogo: Boolean(panel?.querySelector(".player-avatar-logo")),
        hasRatings: panelText.includes("OVR") && panelText.includes("POT"),
        hasAttributeHeader: panelText.includes("능력치") && panelText.includes("높음 빨강"),
        hasStats: panelText.includes("2026 시즌 기록") && Boolean(panel?.querySelector(".player-stat-grid strong")),
        attributeCount: attributeNodes.length,
        coloredAttributeCount: attributeNodes.filter((node) =>
          ["is-elite", "is-strong", "is-average", "is-weak", "is-poor"].some((className) => node.classList.contains(className))
        ).length
      };
    })()
  `);
  assert(playerDetailProbe.clickableRows > 0, "클릭 가능한 선수 행을 찾지 못했습니다.", "src/ui.js");
  assert(
    playerDetailProbe.hasPanel &&
      playerDetailProbe.hasIdentity &&
      playerDetailProbe.hasLogo &&
      playerDetailProbe.hasRatings &&
      playerDetailProbe.hasAttributeHeader &&
      playerDetailProbe.hasStats &&
      playerDetailProbe.attributeCount >= 12 &&
      playerDetailProbe.coloredAttributeCount >= 12,
    `FM식 선수 상세 패널 검증 실패: ${JSON.stringify(playerDetailProbe)}`,
    "src/ui.js"
  );
  await switchDashboardTab("clubhouse");
  const preseasonProbe = await evaluateInBrowser(`
    (async () => {
      const before = document.body.innerText;
      document.querySelector("[data-action='next-day']")?.click();
      await new Promise((resolve) => setTimeout(resolve, 850));
      const after = document.body.innerText;
      const newsTypes = [...document.querySelectorAll("[data-news-type]")].map((node) => node.dataset.newsType);
      return {
        hadPreseason: before.includes("프리시즌"),
        dateAdvanced: after.includes("2026-03-02"),
        gamesStillZero: after.includes("0 / 720경기"),
        boxscores: document.querySelectorAll(".boxscore-mini").length,
        hasSimulationPanel: Boolean(document.querySelector("[data-simulation-progress].is-complete")),
        hasAssistantMail: newsTypes.includes("assistant") || after.includes("개인비서"),
        hasMediaMail: newsTypes.includes("media") || after.includes("SPOTV") || after.includes("뉴스룸"),
        hasKboStyleMail: newsTypes.some((type) => ["kbo-official", "front-office", "compliance", "ops", "community", "futures", "development"].includes(type)) || after.includes("한국야구위원회") || after.includes("운영팀")
      };
    })()
  `);
  assert(preseasonProbe.hadPreseason && preseasonProbe.dateAdvanced && preseasonProbe.gamesStillZero && preseasonProbe.boxscores === 0, "프리시즌 하루 진행이 경기 없이 날짜만 넘기지 않았습니다.", "src/ui.js");
  assert(preseasonProbe.hasSimulationPanel, "날짜 진행 계산 패널이 완료 상태로 렌더링되지 않았습니다.", "src/ui.js");
  assert(preseasonProbe.hasAssistantMail && preseasonProbe.hasMediaMail && preseasonProbe.hasKboStyleMail, "프리시즌 하루 진행 후 비서/언론/KBO식 메일이 쌓이지 않았습니다.", "src/ui.js");
  const weeklyProbe = await evaluateInBrowser(`
    (async () => {
      document.querySelector("[data-action='week']")?.click();
      await new Promise((resolve) => setTimeout(resolve, 850));
      const after = document.body.innerText;
      return {
        hasWeekButton: Boolean(document.querySelector("[data-action='week']")),
        dateAdvanced: after.includes("2026-03-09"),
        gamesStillZero: after.includes("0 / 720경기"),
        boxscores: document.querySelectorAll(".boxscore-mini").length
      };
    })()
  `);
  assert(weeklyProbe.hasWeekButton && weeklyProbe.dateAdvanced && weeklyProbe.gamesStillZero && weeklyProbe.boxscores === 0, "빠른 주간 진행이 프리시즌에서 7일만 안전하게 넘기지 못했습니다.", "src/ui.js");
  await evaluateInBrowser(`
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < 20; i += 1) {
        for (let guard = 0; guard < 4; guard += 1) {
          const decision = document.querySelector("[data-pending-mail-decision] [data-action='resolve-mail-decision']");
          if (!decision) break;
          decision.click();
        }
        document.querySelector("[data-action='next-day']")?.click();
        await wait(760);
      }
      return true;
    })()
  `);
  const regularTopbarProbe = await evaluateInBrowser(`
    (() => {
      const row = document.querySelector(".topbar .quick-action-row");
      const text = row?.textContent ?? "";
      return {
        hasRow: Boolean(row),
        hasGameStart: text.includes("경기 시작"),
        hasSkip: text.includes("스킵"),
        topWatchAction: Boolean(row?.querySelector("[data-action='watch-next-game']")),
        topSkipAction: Boolean(row?.querySelector("[data-action='simulate-next-game']")),
        hasPlainNextDay: text.includes("다음 날")
      };
    })()
  `);
  assert(
    regularTopbarProbe.hasRow &&
      regularTopbarProbe.hasGameStart &&
      regularTopbarProbe.hasSkip &&
      regularTopbarProbe.topWatchAction &&
      regularTopbarProbe.topSkipAction &&
      !regularTopbarProbe.hasPlainNextDay,
    `정규시즌 상단 액션이 경기 시작/스킵으로 전환되지 않았습니다: ${JSON.stringify(regularTopbarProbe)}`,
    "src/ui.js"
  );
  await evaluateInBrowser(`
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let guard = 0; guard < 4; guard += 1) {
        const decision = document.querySelector("[data-pending-mail-decision] [data-action='resolve-mail-decision']");
        if (!decision) break;
        decision.click();
        await wait(80);
      }
      document.querySelector(".topbar [data-action='simulate-next-game']")?.click();
      await wait(180);
      return true;
    })()
  `);
  await switchDashboardTab("standings");
  await waitForBoxScore();
  await switchDashboardTab("market");
  await waitForFreeAgencyPanel();
  await switchDashboardTab("standings");
  await evaluateInBrowser(`document.querySelector("#gamecast")?.scrollIntoView({ block: "center", inline: "nearest" }); true`);
  await waitForGamecastPlayerLabel();
  const liveProbe = await evaluateInBrowser(`
    (() => {
      const score = [...document.querySelectorAll(".gamecast-scoreline strong")].map((node) => node.textContent.trim()).join("-");
      const playerLabel = document.querySelector("[data-gamecast-player-label]");
      return {
        liveCount: document.querySelectorAll(".gamecast-feed li.is-live").length,
        feedCount: document.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]").length,
        nowText: document.querySelector(".gamecast-now")?.textContent?.trim() ?? "",
        playerLabelText: playerLabel?.textContent?.trim() ?? "",
        playerLabelVisible: Boolean(playerLabel?.classList.contains("is-visible")),
        score
      };
    })()
  `);
  await delay(GAMECAST_REPLAY_WAIT_MS);
  const playbackProbe = await evaluateInBrowser(`
    (() => {
      const scoreline = [...document.querySelectorAll(".gamecast-scoreline strong")].map((node) => node.textContent.trim());
      const firstGame = document.querySelector(".game-card");
      const gameScore = [...(firstGame?.querySelectorAll(".game-team strong") ?? [])].map((node) => node.textContent.trim());
      return {
        liveCount: document.querySelectorAll(".gamecast-feed li.is-live").length,
        rafActive: window.__gamecastRafProbe?.activeCount ?? -1,
        rafRequested: window.__gamecastRafProbe?.requested ?? 0,
        nowText: document.querySelector(".gamecast-now")?.textContent?.trim() ?? "",
        scoreMatchesGameCard: scoreline.length === 2 && gameScore.length === 2 && scoreline[0] === gameScore[0] && scoreline[1] === gameScore[1],
        scoreline: scoreline.join("-"),
        gameScore: gameScore.join("-")
      };
    })()
  `);

  const tabCoverage = await collectTabbedCoverage();
  await switchDashboardTab("standings");
  const baseResult = await evaluateInBrowser(`
    (() => {
      const expectedTeamNames = ${JSON.stringify(EXPECTED_TEAM_NAMES)};
      const bodyText = document.body.innerText || "";
      const hasSeasonFastButton = Boolean(document.querySelector("[data-action='season']"));
      const hasWeekFastButton = Boolean(document.querySelector("[data-action='week']"));
      const hasAutoOffseasonAction = Boolean(document.querySelector("[data-action='auto-offseason']"));
      const hasNextSeasonAction = Boolean(document.querySelector("[data-action='next-season']"));
      const schedulePanel = document.querySelector("#schedule.schedule-calendar-panel");
      const schedulePanelText = schedulePanel?.textContent ?? "";
      const optionNames = [...document.querySelectorAll("[data-action='select-team'] option")]
        .map((option) => option.textContent.trim())
        .filter(Boolean);
      const standingNames = [...document.querySelectorAll(".standings-table .team-cell strong")]
        .map((node) => node.textContent.trim())
        .filter(Boolean);
      const logoImages = [...document.querySelectorAll("img.team-logo")].map((img) => ({
        alt: img.alt,
        src: img.currentSrc || img.src,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        visible: img.getBoundingClientRect().bottom >= 0 && img.getBoundingClientRect().top <= window.innerHeight
      }));
      const loadedLogoAlts = logoImages
        .filter((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)
        .map((img) => img.alt);
      const logoAlts = logoImages.map((img) => img.alt);
      const statsPanel = document.querySelector("#stats.stats-panel");
      const statsPanelText = statsPanel?.textContent ?? "";
      const contractsPanel = document.querySelector("#contracts.contract-panel");
      const contractsPanelText = contractsPanel?.textContent ?? "";
      const postseasonPanel = document.querySelector("#postseason.postseason-panel");
      const postseasonPanelText = postseasonPanel?.textContent ?? "";
      const draftPanel = document.querySelector("#draft.draft-panel");
      const draftPanelText = draftPanel?.textContent ?? "";
      const secondaryDraftPanel = document.querySelector("#secondary-draft.secondary-draft-panel");
      const secondaryDraftPanelText = secondaryDraftPanel?.textContent ?? "";
      const tradeLedgerPanel = document.querySelector("#trade-ledger.trade-ledger-panel");
      const tradeLedgerPanelText = tradeLedgerPanel?.textContent ?? "";
      const freeAgencyPanel = document.querySelector("#free-agency.free-agency-panel");
      const freeAgencyPanelText = freeAgencyPanel?.textContent ?? "";
      const nextGamePanel = document.querySelector(".next-game-panel");
      const nextGamePanelText = nextGamePanel?.textContent ?? "";
      const hasPitchingSnapshot = bodyText.includes("선발 로테이션") && bodyText.includes("불펜 역할");
      const gamecastPanel = document.querySelector("#gamecast.gamecast-panel");
      const gamecastPanelText = gamecastPanel?.textContent ?? "";
      const gamecastScreen = document.querySelector("[data-gamecast-screen]");
      const gamecastCanvas = document.querySelector("[data-gamecast-canvas].gamecast-pixel-canvas");
      const gamecastCanvasRect = gamecastCanvas?.getBoundingClientRect();
      const gamecastCanvasStyle = gamecastCanvas ? getComputedStyle(gamecastCanvas) : null;
      const gamecastCanvasPixels = gamecastCanvas ? (() => {
        const ctx = gamecastCanvas.getContext("2d");
        const image = ctx?.getImageData(0, 0, gamecastCanvas.width, gamecastCanvas.height);
        if (!image) return { unique: 0, alpha: 0 };
        const colors = new Set();
        let alpha = 0;
        for (let i = 0; i < image.data.length; i += 4 * Math.max(1, Math.floor(image.data.length / 1200))) {
          const a = image.data[i + 3];
          if (a > 0) alpha += 1;
          colors.add(image.data[i] + "," + image.data[i + 1] + "," + image.data[i + 2] + "," + a);
        }
        return { unique: colors.size, alpha };
      })() : { unique: 0, alpha: 0 };
      const boxscoreCount = document.querySelectorAll(".boxscore-mini").length;
      const scoringMomentCount = document.querySelectorAll(".scoring-moments span").length;
      const clipSelectors = [
        ".button",
        ".pill",
        ".player-list strong",
        ".player-list small",
        ".proposal-card p",
        ".trade-command-actions small",
        ".trade-asset-pill",
        ".fa-card p",
        ".fa-card small",
        ".foreign-card p",
        ".foreign-card small",
        ".gamecast-feed span",
        ".gamecast-feed small",
        ".gamecast-now strong",
        ".gamecast-now small",
        ".assistant-brief-card p",
        ".media-brief-card p",
        ".news-inbox-head p",
        ".inbox-assistant-card h3",
        ".inbox-assistant-card p",
        ".news-inbox-item span",
        ".news-inbox-item strong",
        ".news-inbox-item small",
        ".news-inbox-feature h3",
        ".news-inbox-feature p",
        ".decision-mail-copy p",
        ".decision-choice strong",
        ".decision-choice small",
        ".appointment-ceremony-banner strong",
        ".appointment-ceremony-banner p",
        ".schedule-month-chip",
        ".schedule-day strong",
        ".schedule-day small",
        ".schedule-result",
        ".lineup-section-head small",
        ".lineup-slot label span",
        ".lineup-slot-meta strong",
        ".lineup-slot-meta small",
        ".lineup-balance-card strong",
        ".lineup-balance-card small",
        ".lineup-risk-card small",
        ".lineup-actions small",
        ".player-detail-identity p",
        ".player-detail-facts dd",
        ".player-detail-card-head small",
        ".player-attribute span",
        ".player-attribute strong",
        ".player-stat-grid strong",
        ".news-item p",
        ".fa-offer-item small",
        ".market-ledger-item small",
        ".market-asset-pill",
        ".free-agency-summary span",
        ".draft-summary span",
        ".secondary-draft-summary span",
        ".eligibility-chip-row span"
      ];
      const clippingIssues = [];
      for (const selector of clipSelectors) {
        for (const node of document.querySelectorAll(selector)) {
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          const style = getComputedStyle(node);
          const clipsY = ["hidden", "clip"].includes(style.overflowY) || ["hidden", "clip"].includes(style.overflow);
          const clipsX = ["hidden", "clip"].includes(style.overflowX) || ["hidden", "clip"].includes(style.overflow);
          if ((clipsY && node.scrollHeight > node.clientHeight + 1) || (clipsX && node.scrollWidth > node.clientWidth + 1)) {
            clippingIssues.push({
              selector,
              text: (node.textContent || "").trim().slice(0, 80),
              scrollWidth: node.scrollWidth,
              clientWidth: node.clientWidth,
              scrollHeight: node.scrollHeight,
              clientHeight: node.clientHeight
            });
          }
        }
      }
      const visibleBrokenLogos = logoImages
        .filter((img) => img.visible && (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0))
        .map((img) => img.alt);
      const missingNames = expectedTeamNames.filter((name) =>
        !bodyText.includes(name) && !optionNames.includes(name) && !standingNames.includes(name)
      );
      const missingStandingNames = expectedTeamNames.filter((name) => !standingNames.includes(name));
      const missingLogos = [];
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientWidth = doc.clientWidth;
      const bodyClientWidth = body.clientWidth;
      const overflowPx = scrollWidth - clientWidth;
      return {
        title: document.title,
        optionNames,
        standingNames,
        logoCount: logoImages.length,
        loadedLogoCount: loadedLogoAlts.length,
        missingNames,
        missingStandingNames,
        missingLogos,
        visibleBrokenLogos,
        hasStatsPanel: Boolean(statsPanel),
        hasBatterStats: statsPanelText.includes("타자 TOP"),
        hasPitcherStats: statsPanelText.includes("투수 TOP"),
        hasContractsPanel: Boolean(contractsPanel),
        hasContractSummary: contractsPanelText.includes("연봉/FA") && contractsPanelText.includes("추정"),
        hasPostseasonPanel: Boolean(postseasonPanel),
        hasPostseasonBracket: postseasonPanelText.includes("와일드카드") && postseasonPanelText.includes("한국시리즈"),
        postseasonSeriesCards: document.querySelectorAll("#postseason .series-card").length,
        hasAwardGrid: Boolean(document.querySelector("#postseason .award-grid")),
        hasPostseasonAction: Boolean(document.querySelector("[data-action='postseason']")),
        hasDraftPanel: Boolean(draftPanel),
        hasDraftBoard: draftPanelText.includes("드래프트 보드"),
        draftCards: document.querySelectorAll("#draft .draft-card").length,
        hasDraftAction: Boolean(document.querySelector("[data-action='draft']")),
        hasSecondaryDraftPanel: Boolean(secondaryDraftPanel),
        hasSecondaryDraftBoard: secondaryDraftPanelText.includes("2차 드래프트") && secondaryDraftPanelText.includes("35인"),
        secondaryProtectionCards: document.querySelectorAll("#secondary-draft .protection-card").length,
        hasSecondaryDraftAction: Boolean(document.querySelector("[data-action='secondary-draft']")),
        hasTradeCommitAction: Boolean(document.querySelector("[data-action='commit-trade']")),
        hasTradeLedgerPanel: Boolean(tradeLedgerPanel),
        hasTradeLedgerTitle: tradeLedgerPanelText.includes("트레이드 원장"),
        hasTradeCommandCard: Boolean(document.querySelector(".trade-command-card")),
        hasTradeSupplementalAsset: bodyText.includes("현금") || bodyText.includes("지명권") || bodyText.includes("조건부") || bodyText.includes("후일결정선수"),
        hasFreeAgencyAction: Boolean(document.querySelector("[data-action='free-agency']")),
        hasSignFaAction: Boolean(document.querySelector("[data-action='sign-fa']")),
        hasSignForeignAction: Boolean(document.querySelector("[data-action='sign-foreign']")),
        hasFreeAgencyPanel: Boolean(freeAgencyPanel),
        hasFreeAgencyBoard: freeAgencyPanelText.includes("FA/외국인 시장") && freeAgencyPanelText.includes("FGN-"),
        faCards: document.querySelectorAll("#free-agency .fa-card").length,
        foreignCards: document.querySelectorAll("#free-agency .foreign-card").length,
        marketLedgerItems: document.querySelectorAll("#free-agency .market-ledger-item").length,
        hasMarketLedger: freeAgencyPanelText.includes("시장 장부"),
        hasNextGamePanel: Boolean(nextGamePanel),
        hasWatchNextAction: Boolean(document.querySelector("[data-action='watch-next-game']")),
        hasSimNextAction: Boolean(document.querySelector("[data-action='simulate-next-game']")),
        hasNextGameChoiceText: nextGamePanelText.includes("경기 시작") && nextGamePanelText.includes("스킵"),
        hasSchedulePanel: Boolean(schedulePanel),
        hasScheduleTitle: schedulePanelText.includes("월 일정"),
        hasScheduleControls: Boolean(document.querySelector("[data-action='calendar-prev']")) && Boolean(document.querySelector("[data-action='calendar-next']")),
        scheduleCells: document.querySelectorAll("#schedule [data-schedule-cell]").length,
        scheduleGameCells: document.querySelectorAll("#schedule .schedule-day.is-scheduled, #schedule .schedule-day.is-played").length,
        scheduleLogoCount: document.querySelectorAll("#schedule img.schedule-logo").length,
        hasDailyReport: bodyText.includes("전력분석") && bodyText.includes("퓨처스"),
        hasSeasonFastButton,
        hasWeekFastButton,
        hasAutoOffseasonAction,
        hasNextSeasonAction,
        hasGamecastPanel: Boolean(gamecastPanel),
        hasGamecastScreen: Boolean(gamecastScreen),
        hasGamecastCanvas: Boolean(gamecastCanvas),
        gamecastCanvasWidth: gamecastCanvas?.width ?? 0,
        gamecastCanvasHeight: gamecastCanvas?.height ?? 0,
        gamecastCanvasCssWidth: gamecastCanvasRect?.width ?? 0,
        gamecastCanvasCssHeight: gamecastCanvasRect?.height ?? 0,
        gamecastCanvasPixelW: Number(gamecastCanvas?.dataset.pixelW ?? 0),
        gamecastCanvasPixelH: Number(gamecastCanvas?.dataset.pixelH ?? 0),
        gamecastCanvasImageRendering: gamecastCanvasStyle?.imageRendering ?? "",
        gamecastCanvasPixelUnique: gamecastCanvasPixels.unique,
        gamecastCanvasAlphaSamples: gamecastCanvasPixels.alpha,
        hasGamecastFeed: document.querySelectorAll(".gamecast-feed li").length > 0,
        hasGamecastScore: (gamecastPanelText.includes("빠른 도트 중계") || gamecastPanelText.includes("경기 보기 도트 중계")) && (gamecastPanelText.includes("PA") || gamecastPanelText.includes("LIVE")),
        hasPreseasonFlow: bodyText.includes("정규시즌") && bodyText.includes("5 / 720경기"),
        clippingIssues,
        hasPitchingSnapshot,
        boxscoreCount,
        scoringMomentCount,
        scrollWidth,
        clientWidth,
        bodyClientWidth,
        overflowPx,
        appTextLength: bodyText.length
      };
    })()
  `);
  const result = { ...baseResult, ...tabCoverage };

  assert(result.title === "KBO GM Manager", `문서 title이 예상과 다릅니다: ${result.title}`, "index.html");
  assert(result.appTextLength > 100, "앱 본문 렌더링 텍스트가 너무 적습니다.", "src/ui.js");
  assert(result.missingNames.length === 0, `화면에서 팀명 누락: ${result.missingNames.join(", ")}`, "src/ui.js");
  assert(
    result.missingStandingNames.length === 0,
    `순위표에서 팀명 누락: ${result.missingStandingNames.join(", ")}`,
    "src/ui.js"
  );
  assert(result.missingLogos.length === 0, `로드된 로고 누락: ${result.missingLogos.join(", ")}`, "src/ui.js");
  assert(result.visibleBrokenLogos.length === 0, `현재 화면의 로고 로드 실패: ${result.visibleBrokenLogos.join(", ")}`, "src/ui.js");
  assert(result.hasContractsPanel && result.hasContractSummary, "계약/FA 패널을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasPostseasonAction, "가을야구 진행 버튼을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasPostseasonPanel && result.hasPostseasonBracket, "포스트시즌 브래킷 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.postseasonSeriesCards === 4, `포스트시즌 시리즈 카드 ${result.postseasonSeriesCards}/4`, "src/ui.js");
  assert(result.hasAwardGrid, "시상식 award-grid UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.hasDraftAction, "드래프트 진행 버튼을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasDraftPanel && result.hasDraftBoard, "드래프트 보드 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.draftCards >= 8, `드래프트 후보 카드 ${result.draftCards}/8`, "src/ui.js");
  assert(result.hasSecondaryDraftAction, "2차 드래프트 진행 버튼을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasSecondaryDraftPanel && result.hasSecondaryDraftBoard, "2차 드래프트 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.secondaryProtectionCards >= 8, `2차 드래프트 보호/비보호 카드 ${result.secondaryProtectionCards}/8`, "src/ui.js");
  assert(result.hasTradeCommitAction, "트레이드 실행 버튼을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasTradeCommandCard, "트레이드 command 카드를 찾지 못했습니다.", "src/ui.js");
  assert(result.hasTradeLedgerPanel && result.hasTradeLedgerTitle, "트레이드 원장 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.hasTradeSupplementalAsset, "트레이드 보조 자산 표시를 찾지 못했습니다.", "src/ui.js");
  assert(!result.hasSeasonFastButton && result.hasWeekFastButton, "전체 시즌 버튼은 없어야 하고 빠른 주간 버튼은 있어야 합니다.", "src/ui.js");
  assert(result.hasNextGamePanel && result.hasWatchNextAction && result.hasSimNextAction && result.hasNextGameChoiceText, "다음 경기 시작/스킵 선택 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.hasSchedulePanel && result.hasScheduleTitle && result.hasScheduleControls, "월간 일정 캘린더 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.scheduleCells >= 28 && result.scheduleGameCells > 0 && result.scheduleLogoCount > 0, `월간 일정 셀/경기/로고가 부족합니다: cells=${result.scheduleCells}, games=${result.scheduleGameCells}, logos=${result.scheduleLogoCount}`, "src/ui.js");
  assert(result.hasAutoOffseasonAction && result.hasNextSeasonAction, "자동 스토브/다음 시즌 버튼을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasGamecastPanel && result.hasGamecastScreen && result.hasGamecastCanvas && result.hasGamecastFeed && result.hasGamecastScore, "빠른 도트 게임캐스트 UI를 찾지 못했습니다.", "src/ui.js");
  assert(liveProbe.feedCount > 0 && liveProbe.liveCount <= 1, `게임캐스트 live 행 수가 비정상입니다: ${liveProbe.liveCount}/${liveProbe.feedCount}`, "src/ui.js");
  assert(liveProbe.playerLabelVisible && liveProbe.playerLabelText.length > 0, "도트 선수 머리 위 이름표를 찾지 못했습니다.", "src/ui.js");
  assert(playbackProbe.liveCount === 0, `게임캐스트 재생 종료 후 is-live가 남았습니다: ${playbackProbe.liveCount}`, "src/ui.js");
  assert(playbackProbe.rafRequested > 0 && playbackProbe.rafActive === 0, `게임캐스트 rAF 정지 실패: active=${playbackProbe.rafActive}, requested=${playbackProbe.rafRequested}`, "src/ui.js");
  assert(playbackProbe.scoreMatchesGameCard, `게임캐스트 최종 점수 불일치: gamecast=${playbackProbe.scoreline}, card=${playbackProbe.gameScore}`, "src/ui.js");
  assert(liveProbe.feedCount <= 1 || liveProbe.nowText !== playbackProbe.nowText || liveProbe.score !== playbackProbe.scoreline, "게임캐스트 재생 중 현재 타석/스코어 동기화 변화가 감지되지 않았습니다.", "src/ui.js");
  assert(result.hasDailyReport, "정규시즌 진행 후 전력분석/퓨처스 일일 보고가 확인되지 않았습니다.", "src/engine.js");
  assert(result.gamecastCanvasPixelW >= 120 && result.gamecastCanvasPixelH >= 108, `게임캐스트 내부 해상도가 너무 작습니다: ${result.gamecastCanvasPixelW}x${result.gamecastCanvasPixelH}`, "src/ui.js");
  const gamecastScaleX = result.gamecastCanvasCssWidth / Math.max(1, result.gamecastCanvasPixelW);
  const gamecastScaleY = result.gamecastCanvasCssHeight / Math.max(1, result.gamecastCanvasPixelH);
  assert(Math.abs(gamecastScaleX - gamecastScaleY) < 0.02, `게임캐스트 표시 비율이 내부 해상도와 다릅니다: ${result.gamecastCanvasCssWidth}x${result.gamecastCanvasCssHeight}, base ${result.gamecastCanvasPixelW}x${result.gamecastCanvasPixelH}`, "src/styles.css");
  assert(viewport.width < result.gamecastCanvasPixelW || result.gamecastCanvasCssWidth >= result.gamecastCanvasPixelW, `데스크톱 게임캐스트 표시 크기가 내부 해상도보다 작습니다: ${result.gamecastCanvasCssWidth}x${result.gamecastCanvasCssHeight}, base ${result.gamecastCanvasPixelW}x${result.gamecastCanvasPixelH}`, "src/styles.css");
  assert(result.gamecastCanvasWidth >= result.gamecastCanvasCssWidth && result.gamecastCanvasHeight >= result.gamecastCanvasCssHeight, `픽셀 캔버스 버퍼가 CSS 표시 크기보다 작습니다: buffer ${result.gamecastCanvasWidth}x${result.gamecastCanvasHeight}, css ${result.gamecastCanvasCssWidth}x${result.gamecastCanvasCssHeight}`, "src/ui.js");
  assert(/pixelated|crisp-edges/i.test(result.gamecastCanvasImageRendering), `픽셀 캔버스 image-rendering=${result.gamecastCanvasImageRendering}`, "src/styles.css");
  assert(result.gamecastCanvasPixelUnique >= 6 && result.gamecastCanvasAlphaSamples > 0, `픽셀 캔버스가 비었거나 팔레트가 너무 단조롭습니다: unique=${result.gamecastCanvasPixelUnique}, alpha=${result.gamecastCanvasAlphaSamples}`, "src/ui.js");
  assert(result.hasPreseasonFlow, "프리시즌에서 하루씩 개막 경기까지 이어지는 흐름을 확인하지 못했습니다.", "src/ui.js");
  assert(result.hasFreeAgencyAction && result.hasSignFaAction && result.hasSignForeignAction, "FA/외국인 시장 버튼을 찾지 못했습니다.", "src/ui.js");
  assert(result.hasFreeAgencyPanel && result.hasFreeAgencyBoard, "FA/외국인 시장 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.faCards >= 6, `FA 카드 ${result.faCards}/6`, "src/ui.js");
  assert(result.foreignCards >= 6, `외국인 카드 ${result.foreignCards}/6`, "src/ui.js");
  assert(result.hasMarketLedger, "시장 장부 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.clippingIssues.length === 0, `텍스트 클리핑 ${result.clippingIssues.length}건: ${result.clippingIssues.slice(0, 5).map((item) => item.selector + "=" + item.text).join(" / ")}`, "src/styles.css");
  assert(result.hasPitchingSnapshot, "선발 로테이션/불펜 역할 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.hasStatsPanel, "기록실 패널 #stats를 찾지 못했습니다.", "src/ui.js");
  assert(result.hasBatterStats && result.hasPitcherStats, "기록실의 타자/투수 섹션을 찾지 못했습니다.", "src/ui.js");
  assert(result.boxscoreCount > 0, "최근 경기 박스스코어 UI를 찾지 못했습니다.", "src/ui.js");
  assert(result.overflowPx <= 1, `수평 overflow ${result.overflowPx}px (scroll=${result.scrollWidth}, client=${result.clientWidth})`, "src/styles.css");

  return [
    `${viewport.width}x${viewport.height}`,
    `팀명 ${result.standingNames.length}/10`,
    `로고 ${result.loadedLogoCount}/${result.logoCount}`,
    "계약패널 OK",
    "가을야구 OK",
    "드래프트 OK",
    "2차드래프트 OK",
    "트레이드실행 OK",
    "FA시장 OK",
    "자동스토브 OK",
    "다음시즌 OK",
    "다음경기선택 OK",
    "라인업보드 OK",
    "선수상세 OK",
    "프리시즌 OK",
    "빠른주간 OK",
    "도트중계 OK",
    "선수이름표 OK",
    `클리핑 ${result.clippingIssues.length}`,
    "투수운용 OK",
    "기록실 OK",
    `박스스코어 ${result.boxscoreCount}`,
    `body/client ${result.bodyClientWidth}/${result.clientWidth}`,
    `overflow ${result.overflowPx}px`
  ].join(", ");
}

async function checkGamecastLab() {
  assert(cdp, "브라우저 CDP 연결이 없습니다.", "tools/verify_browser.mjs");
  const labUrl = appUrl.replace(/index\.html(?:.*)?$/, "gamecast-lab.html");

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  let loadEvent = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${labUrl}?engine=phaser&team=lg&days=3&fps=1&holds=0&qa=lab-desktop-${Date.now()}` });
  await loadEvent;
  await waitForGamecastLabModal();
  await delay(300);

  const desktopProbe = await evaluateInBrowser(`
    (() => {
      const modal = document.querySelector("[data-gamecast-modal]");
      const screen = modal?.querySelector("[data-gamecast-screen]");
      const canvas = modal?.querySelector("[data-gamecast-canvas].gamecast-pixel-canvas");
      const rect = canvas?.getBoundingClientRect();
      const totalEvents = window.__labState?.lastGames?.[0]?.plateAppearanceEvents?.length ?? 0;
      const feedCount = modal?.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]")?.length ?? 0;
      return {
        modalOpen: Boolean(modal),
        screenCount: document.querySelectorAll("[data-gamecast-screen]").length,
        activeCanvasCount: document.querySelectorAll("[data-gamecast-canvas].gamecast-pixel-canvas").length,
        cssWidth: rect?.width ?? 0,
        cssHeight: rect?.height ?? 0,
        totalEvents,
        feedCount,
        feedText: modal?.querySelector(".gamecast-feed")?.textContent?.trim() ?? "",
        activeSpeed: modal?.querySelector("[data-gamecast-speed].is-active")?.dataset?.gamecastSpeed ?? "",
        speedButtons: [...(modal?.querySelectorAll("[data-gamecast-speed]") ?? [])].map((button) => button.dataset.gamecastSpeed),
        pauseText: modal?.querySelector("[data-gamecast-pause]")?.textContent?.trim() ?? "",
        stepText: modal?.querySelector("[data-gamecast-step]")?.textContent?.trim() ?? "",
        fpsText: modal?.querySelector("[data-gamecast-fps]")?.textContent?.trim() ?? "",
        soundText: modal?.querySelector("[data-gamecast-sound]")?.textContent?.trim() ?? ""
      };
    })()
  `);

  assert(desktopProbe.modalOpen, "게임캐스트 랩 모달이 열리지 않았습니다.", "gamecast-lab.html");
  assert(desktopProbe.screenCount === 1, `랩 중계 스크린이 ${desktopProbe.screenCount}개입니다.`, "src/ui.js");
  assert(desktopProbe.activeCanvasCount === 1, `랩 활성 캔버스가 ${desktopProbe.activeCanvasCount}개입니다.`, "src/ui.js");
  assert(desktopProbe.cssWidth >= 800 && desktopProbe.cssHeight >= 720, `큰 화면 캔버스가 작습니다: ${desktopProbe.cssWidth}x${desktopProbe.cssHeight}`, "src/styles.css");
  assert(desktopProbe.totalEvents > 20, `랩 PA 이벤트가 부족합니다: ${desktopProbe.totalEvents}`, "src/gamecastLab.js");
  assert(desktopProbe.feedCount >= 0 && desktopProbe.feedCount < desktopProbe.totalEvents, `랩 시작 피드가 전체 경기를 스포일러합니다: feed=${desktopProbe.feedCount}, total=${desktopProbe.totalEvents}`, "src/ui.js");
  assert(desktopProbe.activeSpeed === "1", `랩 초기 배속이 x1이 아닙니다: x${desktopProbe.activeSpeed}`, "src/ui.js");
  assert(desktopProbe.speedButtons.join(",") === "0.5,1,1.5,2,4", `배속 버튼 구성이 다릅니다: ${desktopProbe.speedButtons.join(",")}`, "src/ui.js");
  assert(desktopProbe.pauseText.includes("정지"), `일시정지 버튼을 찾지 못했습니다: ${desktopProbe.pauseText}`, "src/ui.js");
  assert(desktopProbe.stepText.includes("타석"), `타석 확인 버튼을 찾지 못했습니다: ${desktopProbe.stepText}`, "src/ui.js");
  assert(/FPS\s+\d+/i.test(desktopProbe.fpsText), `FPS 오버레이가 갱신되지 않았습니다: ${desktopProbe.fpsText}`, "src/ui.js");
  assert(/켜짐|꺼짐/.test(desktopProbe.soundText), `게임캐스트 소리 토글을 찾지 못했습니다: ${desktopProbe.soundText}`, "src/ui.js");

  const defenseProbe = await evaluateInBrowser(`
    (() => {
      const screen = document.querySelector("[data-gamecast-modal] [data-gamecast-screen]");
      const frame = screen?.__gamecastDebugFrame ?? null;
      const defenders = [
        ...((frame?.staticDefense ?? []).map((sprite) => ({ source: "static", ...sprite }))),
        ...((frame?.defenseSprites ?? []).map((sprite) => ({ source: "dynamic", ...sprite })))
      ].filter((sprite) => sprite?.fieldingKey || sprite?.key);
      const counts = new Map();
      const coordsByKey = new Map();
      const pointByKey = new Map();
      for (const sprite of defenders) {
        const key = String(sprite.fieldingKey ?? sprite.key ?? "");
        if (!key) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
        const pos = sprite.position ?? {};
        coordsByKey.set(key, \`\${Math.round(Number(pos.x ?? 0))},\${Math.round(Number(pos.y ?? 0))}\`);
        pointByKey.set(key, {
          x: Math.round(Number(pos.x ?? 0)),
          y: Math.round(Number(pos.y ?? 0))
        });
      }
      const keys = [...coordsByKey.keys()].sort();
      const required = ["1B", "2B", "3B", "C", "CF", "LF", "P", "RF", "SS"];
      return {
        keys,
        missing: required.filter((key) => !coordsByKey.has(key)),
        duplicateKeys: [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key),
        uniqueCoordCount: new Set(coordsByKey.values()).size,
        coords: Object.fromEntries(pointByKey),
        rawCount: defenders.length
      };
    })()
  `);
  assert(defenseProbe.missing.length === 0, `수비 포지션이 빠졌습니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");
  assert(defenseProbe.duplicateKeys.length === 0, `수비 포지션 중복이 있습니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");
  assert(defenseProbe.uniqueCoordCount >= 9, `수비 좌표가 중복됩니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");
  assert(defenseProbe.coords?.P?.y < defenseProbe.coords?.["1B"]?.y && defenseProbe.coords?.P?.y < defenseProbe.coords?.["3B"]?.y, `마운드가 내야 코너보다 앞에 서지 않습니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");
  assert(defenseProbe.coords?.C?.y > defenseProbe.coords?.P?.y && defenseProbe.coords?.C?.y > defenseProbe.coords?.["1B"]?.y, `포수가 홈 뒤에 읽히지 않습니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");
  assert(defenseProbe.coords?.CF?.y < defenseProbe.coords?.LF?.y && defenseProbe.coords?.CF?.y < defenseProbe.coords?.RF?.y, `외야 삼각 배치가 어색합니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");
  assert(defenseProbe.coords?.SS?.y < defenseProbe.coords?.["3B"]?.y && defenseProbe.coords?.["2B"]?.y < defenseProbe.coords?.["1B"]?.y, `내야 깊이 배치가 어색합니다: ${JSON.stringify(defenseProbe)}`, "src/ui.js");

  const playFeelSamples = [];
  for (let index = 0; index < 60; index += 1) {
    playFeelSamples.push(await evaluateInBrowser(`
      (() => {
        const screen = document.querySelector("[data-gamecast-modal] [data-gamecast-screen]");
        const canvas = document.querySelector("[data-gamecast-modal] [data-gamecast-canvas].gamecast-pixel-canvas");
        const frame = screen?.__gamecastDebugFrame ?? null;
        const defenders = [
          ...((frame?.staticDefense ?? []).map((sprite) => ({ source: "static", ...sprite }))),
          ...((frame?.defenseSprites ?? []).map((sprite) => ({ source: "dynamic", ...sprite })))
        ];
        const pitcherVisible = defenders.some((sprite) => String(sprite.fieldingKey ?? sprite.key ?? "") === "P");
        let pitchPathWhitePixels = 0;
        if (canvas && frame?.ball?.kind === "pitch") {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          const image = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          if (image?.data) {
            const sx = canvas.width / 400;
            const sy = canvas.height / 360;
            const from = { x: Math.round(200 * sx), y: Math.round(240 * sy) };
            const to = { x: Math.round(207 * sx), y: Math.round(300 * sy) };
            for (let step = 0; step <= 18; step += 1) {
              const t = step / 18;
              const cx = Math.round(from.x + (to.x - from.x) * t);
              const cy = Math.round(from.y + (to.y - from.y) * t);
              for (let y = cy - 7; y <= cy + 7; y += 1) {
                for (let x = cx - 7; x <= cx + 7; x += 1) {
                  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
                  const offset = (y * canvas.width + x) * 4;
                  const r = image.data[offset];
                  const g = image.data[offset + 1];
                  const b = image.data[offset + 2];
                  const a = image.data[offset + 3];
                  if (a > 120 && r > 245 && g > 245 && b > 232) pitchPathWhitePixels += 1;
                }
              }
            }
          }
        }
        const burst = document.querySelector("[data-gamecast-modal] [data-gamecast-action-burst]");
        return {
          outcome: frame?.event?.outcome ?? "",
          progress: Number(frame?.progress ?? 0),
          resultRevealed: Boolean(frame?.resultRevealed),
          pitcherVisible,
          homeRunBadDefense: frame?.event?.outcome === "homeRun" && (frame?.defenseSprites ?? []).some((sprite) => ["catch", "dive", "throw", "lookUp"].includes(String(sprite.pose ?? ""))),
          ballVisible: Boolean(frame?.ball),
          ballKind: frame?.ball?.kind ?? "",
          pitchPathWhitePixels,
          movingDefense: (frame?.defenseSprites ?? []).some((sprite) => String(sprite.fieldingKey ?? "") !== "P"),
          runnerCount: frame?.runners?.length ?? 0,
          burstVisible: Boolean(burst?.classList.contains("is-visible"))
        };
      })()
    `));
    const enough =
      playFeelSamples.length >= 20 &&
      playFeelSamples.some((sample) => sample.ballKind === "batted") &&
      playFeelSamples.some((sample) => sample.movingDefense || sample.runnerCount > 0) &&
      playFeelSamples.filter((sample) => sample.ballVisible).length >= 3;
    if (enough) break;
    await delay(260);
  }
  const playFeelProbe = {
    pitcherFrames: playFeelSamples.filter((sample) => sample.pitcherVisible).length,
    ballFrames: playFeelSamples.filter((sample) => sample.ballVisible).length,
    pitchPixelFrames: playFeelSamples.filter((sample) => sample.pitchPathWhitePixels > 0).length,
    battedBallFrames: playFeelSamples.filter((sample) => sample.ballKind === "batted").length,
    movingDefenseFrames: playFeelSamples.filter((sample) => sample.movingDefense).length,
    homeRunBadDefenseFrames: playFeelSamples.filter((sample) => sample.homeRunBadDefense).length,
    runnerFrames: playFeelSamples.filter((sample) => sample.runnerCount > 0).length,
    burstBeforeRevealFrames: playFeelSamples.filter((sample) => sample.burstVisible && !sample.resultRevealed).length
  };
  assert(playFeelProbe.pitcherFrames >= 2, `버스트 샘플에서 투수가 충분히 보이지 않습니다: ${JSON.stringify(playFeelProbe)}`, "src/ui.js");
  assert(playFeelProbe.ballFrames >= 3 && playFeelProbe.pitchPixelFrames >= 1, `버스트 샘플에서 공/투구 픽셀이 부족합니다: ${JSON.stringify(playFeelProbe)}`, "src/ui.js");
  assert(playFeelProbe.battedBallFrames >= 1, `버스트 샘플에서 타구 비행이 잡히지 않습니다: ${JSON.stringify(playFeelProbe)}`, "src/ui.js");
  assert(playFeelProbe.movingDefenseFrames >= 1 || playFeelProbe.runnerFrames >= 1, `버스트 샘플에서 수비/주자 움직임이 없습니다: ${JSON.stringify(playFeelProbe)}`, "src/ui.js");
  assert(playFeelProbe.homeRunBadDefenseFrames === 0, `홈런인데 외야수가 잡는 포즈를 취합니다: ${JSON.stringify(playFeelProbe)}`, "src/ui.js");
  assert(playFeelProbe.burstBeforeRevealFrames === 0, `결과 배지가 연기 전에 표시됩니다: ${JSON.stringify(playFeelProbe)}`, "src/ui.js");

  const viewportSweep = [];
  for (const width of [800, 920, 1100]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await delay(450);
    viewportSweep.push(await evaluateInBrowser(`
      (() => {
        const screen = document.querySelector("[data-gamecast-modal] [data-gamecast-screen]");
        const canvas = document.querySelector("[data-gamecast-modal] [data-gamecast-canvas].gamecast-pixel-canvas");
        const screenRect = screen?.getBoundingClientRect();
        const canvasRect = canvas?.getBoundingClientRect();
        const doc = document.documentElement;
        const body = document.body;
        return {
          width: window.innerWidth,
          screenWidth: Math.round(screenRect?.width ?? 0),
          screenHeight: Math.round(screenRect?.height ?? 0),
          canvasWidth: Math.round(canvasRect?.width ?? 0),
          canvasHeight: Math.round(canvasRect?.height ?? 0),
          canvasBottomGap: Math.round((screenRect?.bottom ?? 0) - (canvasRect?.bottom ?? 0)),
          canvasTopGap: Math.round((canvasRect?.top ?? 0) - (screenRect?.top ?? 0)),
          overflowPx: Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth
        };
      })()
    `));
  }
  for (const probe of viewportSweep) {
    assert(probe.canvasWidth > 0 && probe.canvasHeight > 0, `중간 뷰포트 캔버스가 없습니다: ${JSON.stringify(probe)}`, "src/styles.css");
    assert(probe.canvasHeight >= probe.screenHeight * 0.84, `중간 뷰포트에서 캔버스 하단 공백이 큽니다: ${JSON.stringify(probe)}`, "src/styles.css");
    assert(probe.canvasTopGap >= -2 && probe.canvasBottomGap >= -2 && probe.canvasBottomGap <= 42, `중간 뷰포트에서 캔버스가 잘리거나 뜹니다: ${JSON.stringify(probe)}`, "src/styles.css");
    assert(probe.overflowPx <= 1, `중간 뷰포트 수평 overflow ${probe.overflowPx}px: ${JSON.stringify(probe)}`, "src/styles.css");
  }
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await delay(300);

  await evaluateInBrowser(`document.querySelector("[data-gamecast-modal] [data-gamecast-pause]")?.click(); true`);
  await delay(1200);
  const pauseProbe = await evaluateInBrowser(`
    (() => ({
      feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
      overlayVisible: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay].is-visible")),
      pauseText: document.querySelector("[data-gamecast-modal] [data-gamecast-pause]")?.textContent?.trim() ?? ""
    }))()
  `);
  await delay(900);
  const pauseStillProbe = await evaluateInBrowser(`
    (() => ({
      feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
      overlayVisible: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay].is-visible"))
    }))()
  `);
  assert(pauseProbe.overlayVisible, `일시정지 오버레이가 보이지 않습니다: ${JSON.stringify(pauseProbe)}`, "src/ui.js");
  assert(pauseProbe.pauseText.includes("계속"), `일시정지 버튼 라벨이 갱신되지 않았습니다: ${pauseProbe.pauseText}`, "src/ui.js");
  assert(pauseStillProbe.feedCount === pauseProbe.feedCount, `일시정지 중 피드가 진행됐습니다: ${pauseProbe.feedCount}->${pauseStillProbe.feedCount}`, "src/ui.js");
  await evaluateInBrowser(`document.activeElement?.blur?.(); true`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await delay(700);
  const resumedProbe = await evaluateInBrowser(`
    (() => ({
      overlayVisible: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay].is-visible")),
      pauseText: document.querySelector("[data-gamecast-modal] [data-gamecast-pause]")?.textContent?.trim() ?? ""
    }))()
  `);
  assert(!resumedProbe.overlayVisible, `Space 재개 후 오버레이가 남아 있습니다: ${JSON.stringify(resumedProbe)}`, "src/ui.js");
  assert(resumedProbe.pauseText.includes("정지"), `Space 재개 후 버튼 라벨이 돌아오지 않았습니다: ${resumedProbe.pauseText}`, "src/ui.js");

  await evaluateInBrowser(`document.querySelector("[data-gamecast-modal] [data-gamecast-speed='2']")?.click(); true`);
  await delay(1900);
  const beforeToggle = await evaluateInBrowser(`
    (() => ({
      feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
      activeSpeed: document.querySelector("[data-gamecast-modal] [data-gamecast-speed].is-active")?.dataset?.gamecastSpeed ?? ""
    }))()
  `);
  await evaluateInBrowser(`document.querySelector("[data-gamecast-engine='canvas']")?.click(); true`);
  await delay(700);
  const afterToggle = await evaluateInBrowser(`
    (() => ({
      feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
      screenCount: document.querySelectorAll("[data-gamecast-screen]").length,
      activeSpeed: document.querySelector("[data-gamecast-modal] [data-gamecast-speed].is-active")?.dataset?.gamecastSpeed ?? "",
      engine: document.querySelector("[data-gamecast-modal] [data-gamecast-screen]")?.dataset?.gamecastEngineCurrent ?? ""
    }))()
  `);
  assert(beforeToggle.activeSpeed === "2", `x2 배속 전환이 반영되지 않았습니다: ${JSON.stringify(beforeToggle)}`, "src/ui.js");
  assert(afterToggle.activeSpeed === "2", `엔진 토글 후 배속이 보존되지 않았습니다: ${JSON.stringify(afterToggle)}`, "src/ui.js");
  assert(afterToggle.feedCount >= beforeToggle.feedCount, `엔진 토글 후 피드가 되감겼습니다: before=${beforeToggle.feedCount}, after=${afterToggle.feedCount}`, "src/ui.js");
  assert(afterToggle.screenCount === 1, `엔진 토글 후 스크린이 ${afterToggle.screenCount}개입니다.`, "src/ui.js");
  assert(afterToggle.engine === "canvas", `엔진 토글 후 Canvas가 아닙니다: ${afterToggle.engine}`, "src/ui.js");

  loadEvent = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${labUrl}?engine=phaser&team=lg&days=3&fullscreen=1&speed=4&qa=lab-fast-${Date.now()}` });
  await loadEvent;
  await waitForGamecastLabModal();
  await delay(9000);
  const fastProbe = await evaluateInBrowser(`
    (() => {
      const modal = document.querySelector("[data-gamecast-modal]");
      const overlay = modal?.querySelector("[data-gamecast-pause-overlay]");
      return {
        feedCount: modal?.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]")?.length ?? 0,
        overlayVisible: Boolean(overlay?.classList.contains("is-visible")),
        holdType: overlay?.dataset?.holdType ?? "",
        activeSpeed: modal?.querySelector("[data-gamecast-speed].is-active")?.dataset?.gamecastSpeed ?? "",
        totalEvents: window.__labState?.lastGames?.[0]?.plateAppearanceEvents?.length ?? 0
      };
    })()
  `);
  assert(fastProbe.activeSpeed === "4", `x4 배속이 반영되지 않았습니다: ${JSON.stringify(fastProbe)}`, "src/gamecastLab.js");
  assert(!(fastProbe.overlayVisible && ["inning", "leverage"].includes(fastProbe.holdType)), `x4에서 자동 홀드가 멈췄습니다: ${JSON.stringify(fastProbe)}`, "src/ui.js");
  assert(fastProbe.feedCount > 3, `x4 진행 중 피드가 충분히 진행되지 않았습니다: ${JSON.stringify(fastProbe)}`, "src/ui.js");

  await evaluateInBrowser(`document.querySelector("[data-gamecast-modal] [data-gamecast-skip]")?.click(); true`);
  await delay(900);
  const skipProbe = await evaluateInBrowser(`
    (() => {
      const modal = document.querySelector("[data-gamecast-modal]");
      const overlay = modal?.querySelector("[data-gamecast-pause-overlay]");
      const totalEvents = window.__labState?.lastGames?.[0]?.plateAppearanceEvents?.length ?? 0;
      return {
        nowText: modal?.querySelector(".gamecast-now")?.textContent?.trim() ?? "",
        feedCount: modal?.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]")?.length ?? 0,
        totalEvents,
        skipDisabled: Boolean(modal?.querySelector("[data-gamecast-skip]")?.disabled),
        overlayVisible: Boolean(overlay?.classList.contains("is-visible"))
      };
    })()
  `);
  assert(skipProbe.skipDisabled || skipProbe.feedCount >= skipProbe.totalEvents || skipProbe.nowText.includes("경기 종료"), `스킵 후 종료 상태가 아닙니다: ${JSON.stringify(skipProbe)}`, "src/ui.js");
  assert(!skipProbe.overlayVisible, `스킵 후 홀드 오버레이가 남았습니다: ${JSON.stringify(skipProbe)}`, "src/ui.js");

  loadEvent = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${labUrl}?engine=phaser&team=lg&days=3&fullscreen=1&step=1&speed=4&holds=0&qa=lab-step-${Date.now()}` });
  await loadEvent;
  await waitForGamecastLabModal();
  await delay(2600);
  const stepHoldProbe = await evaluateInBrowser(`
    (() => ({
      feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
      overlayVisible: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay].is-visible")),
      holdType: document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay]")?.dataset?.holdType ?? "",
      activeSpeed: document.querySelector("[data-gamecast-modal] [data-gamecast-speed].is-active")?.dataset?.gamecastSpeed ?? "",
      stepActive: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-step].is-active"))
    }))()
  `);
  await delay(1500);
  const stepStillProbe = await evaluateInBrowser(`
    (() => ({
      feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
      overlayVisible: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay].is-visible"))
    }))()
  `);
  assert(stepHoldProbe.activeSpeed === "4", `랩 ?speed=4가 반영되지 않았습니다: ${JSON.stringify(stepHoldProbe)}`, "src/gamecastLab.js");
  assert(stepHoldProbe.stepActive, `랩 ?step=1이 반영되지 않았습니다: ${JSON.stringify(stepHoldProbe)}`, "src/gamecastLab.js");
  assert(stepHoldProbe.overlayVisible && stepHoldProbe.holdType === "step", `스텝 홀드가 걸리지 않았습니다: ${JSON.stringify(stepHoldProbe)}`, "src/ui.js");
  assert(stepStillProbe.feedCount === stepHoldProbe.feedCount, `스텝 홀드 중 피드가 진행됐습니다: ${stepHoldProbe.feedCount}->${stepStillProbe.feedCount}`, "src/ui.js");
  await evaluateInBrowser(`document.activeElement?.blur?.(); true`);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  let stepAdvancedProbe = null;
  const stepAdvanceDeadline = Date.now() + 9000;
  while (Date.now() < stepAdvanceDeadline) {
    await delay(260);
    stepAdvancedProbe = await evaluateInBrowser(`
      (() => ({
        feedCount: document.querySelectorAll("[data-gamecast-modal] .gamecast-feed li[data-gamecast-event-id]").length,
        overlayVisible: Boolean(document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay].is-visible")),
        holdType: document.querySelector("[data-gamecast-modal] [data-gamecast-pause-overlay]")?.dataset?.holdType ?? ""
      }))()
    `);
    if (stepAdvancedProbe.feedCount > stepHoldProbe.feedCount && stepAdvancedProbe.overlayVisible && stepAdvancedProbe.holdType === "step") break;
  }
  assert(stepAdvancedProbe.feedCount > stepHoldProbe.feedCount, `Space 후 다음 타석으로 진행되지 않았습니다: ${JSON.stringify({ stepHoldProbe, stepAdvancedProbe })}`, "src/ui.js");
  assert(stepAdvancedProbe.overlayVisible && stepAdvancedProbe.holdType === "step", `다음 타석 종료 후 다시 스텝 홀드가 걸리지 않았습니다: ${JSON.stringify(stepAdvancedProbe)}`, "src/ui.js");

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    mobile: true
  });
  loadEvent = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${labUrl}?engine=phaser&team=lotte&days=3&speed=0.5&holds=0&qa=lab-mobile-${Date.now()}` });
  await loadEvent;
  await waitForGamecastLabModal();
  await delay(300);
  const mobileProbe = await evaluateInBrowser(`
    (() => {
      const modal = document.querySelector("[data-gamecast-modal]");
      const screen = modal?.querySelector("[data-gamecast-screen]");
      const canvas = modal?.querySelector("[data-gamecast-canvas].gamecast-pixel-canvas");
      const screenRect = screen?.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect();
      const doc = document.documentElement;
      const body = document.body;
      return {
        screenWidth: screenRect?.width ?? 0,
        canvasWidth: canvasRect?.width ?? 0,
        canvasLeft: canvasRect?.left ?? 0,
        canvasRight: canvasRect?.right ?? 0,
        innerWidth: window.innerWidth,
        overflowPx: Math.max(doc.scrollWidth, body.scrollWidth) - doc.clientWidth,
        activeSpeed: modal?.querySelector("[data-gamecast-speed].is-active")?.dataset?.gamecastSpeed ?? ""
      };
    })()
  `);
  assert(mobileProbe.canvasWidth > 0 && mobileProbe.canvasWidth <= mobileProbe.innerWidth, `모바일 캔버스가 뷰포트를 넘습니다: ${JSON.stringify(mobileProbe)}`, "src/styles.css");
  assert(mobileProbe.canvasLeft >= -1 && mobileProbe.canvasRight <= mobileProbe.innerWidth + 1, `모바일 캔버스 좌우가 잘립니다: ${JSON.stringify(mobileProbe)}`, "src/styles.css");
  assert(mobileProbe.overflowPx <= 1, `랩 모바일 수평 overflow ${mobileProbe.overflowPx}px`, "src/styles.css");
  assert(mobileProbe.activeSpeed === "0.5", `랩 ?speed=0.5가 반영되지 않았습니다: ${JSON.stringify(mobileProbe)}`, "src/gamecastLab.js");

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  loadEvent = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${labUrl}?engine=v2&debug=anchors&field=field-gocheok-dome&team=kiwoom&days=3&fullscreen=1&holds=0&qa=lab-v2-anchors-${Date.now()}` });
  await loadEvent;
  await waitForGamecastLabModal();
  await delay(900);
  const anchorProbe = await evaluateInBrowser(`
    (() => {
      const screen = document.querySelector("[data-gamecast-modal] [data-gamecast-screen]");
      const canvas = document.querySelector("[data-gamecast-modal] [data-gamecast-canvas].gamecast-pixel-canvas");
      const anchors = screen?.__gamecast2Anchors?.anchors ?? {};
      const players = screen?.__gamecast2Players ?? { defenders: [], actors: [] };
      const rect = canvas?.getBoundingClientRect();
      const keys = Object.keys(anchors).sort();
      const required = ["home", "first", "second", "third", "mound", "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "leftPole", "rightPole", "scoreboardTl"];
      const defenseRequired = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
      const defenderKeys = (players.defenders ?? []).map((actor) => actor.fieldingKey || actor.key).sort();
      const outfieldScales = (players.defenders ?? []).filter((actor) => actor.isOutfielder).map((actor) => Number(actor.scale ?? 0));
      const infieldScales = (players.defenders ?? []).filter((actor) => !actor.isOutfielder && actor.fieldingKey !== "P" && actor.fieldingKey !== "C").map((actor) => Number(actor.scale ?? 0));
      return {
        engine: screen?.dataset?.gamecastEngineCurrent ?? "",
        field: screen?.dataset?.gamecast2Field ?? "",
        anchorCount: Number(screen?.dataset?.gamecast2AnchorCount ?? 0),
        defenderCount: Number(screen?.dataset?.gamecast2DefenderCount ?? 0),
        playerCount: Number(screen?.dataset?.gamecast2PlayerCount ?? 0),
        keys,
        missing: required.filter((key) => !keys.includes(key)),
        missingDefenders: defenseRequired.filter((key) => !defenderKeys.includes(key)),
        hasBatter: (players.actors ?? []).some((actor) => actor.role === "batter"),
        canvasPixelW: Number(canvas?.dataset?.pixelW ?? 0),
        canvasPixelH: Number(canvas?.dataset?.pixelH ?? 0),
        canvasWidth: Math.round(rect?.width ?? 0),
        canvasHeight: Math.round(rect?.height ?? 0),
        baseDirectionOk: Number(anchors.first?.x ?? 0) > Number(anchors.home?.x ?? 0) && Number(anchors.third?.x ?? 0) < Number(anchors.home?.x ?? 0),
        baseBagOk: Math.abs(Number(anchors.first?.y ?? 0) - Number(anchors.third?.y ?? 999)) <= 4 && Number(anchors.first?.y ?? 999) < Number(anchors.C?.y ?? 0),
        depthOk: Number(anchors.CF?.y ?? 999) < Number(anchors.LF?.y ?? 0) && Number(anchors.LF?.y ?? 999) < Number(anchors.third?.y ?? 0),
        pitcherOk: Number(anchors.P?.y ?? 999) > Number(anchors.mound?.y ?? 0),
        outfieldScaleOk: outfieldScales.length === 3 && infieldScales.length >= 4 && Math.max(...outfieldScales) < Math.min(...infieldScales)
      };
    })()
  `);
  assert(anchorProbe.engine === "v2", `v2 엔진이 활성화되지 않았습니다: ${JSON.stringify(anchorProbe)}`, "src/ui.js");
  assert(anchorProbe.field === "field-gocheok-dome", `v2 필드 선택이 다릅니다: ${JSON.stringify(anchorProbe)}`, "src/gamecast2/assets.js");
  assert(anchorProbe.anchorCount >= 15 && anchorProbe.missing.length === 0, `v2 앵커가 부족합니다: ${JSON.stringify(anchorProbe)}`, "assets/gamecast2");
  assert(anchorProbe.canvasPixelW === 960 && anchorProbe.canvasPixelH === 720, `v2 필드 해상도 계약이 다릅니다: ${JSON.stringify(anchorProbe)}`, "src/gamecast2/scene.js");
  assert(anchorProbe.canvasWidth > 0 && anchorProbe.canvasHeight > 0, `v2 캔버스가 보이지 않습니다: ${JSON.stringify(anchorProbe)}`, "src/gamecast2/scene.js");
  assert(anchorProbe.baseDirectionOk && anchorProbe.baseBagOk && anchorProbe.depthOk && anchorProbe.pitcherOk, `v2 앵커 배치가 어긋났습니다: ${JSON.stringify(anchorProbe)}`, "assets/gamecast2");
  assert(
      anchorProbe.defenderCount === 9 &&
      anchorProbe.playerCount >= 10 &&
      anchorProbe.missingDefenders.length === 0 &&
      anchorProbe.hasBatter &&
      anchorProbe.outfieldScaleOk,
    `v2 R2 선수 배치가 부족합니다: ${JSON.stringify(anchorProbe)}`,
    "src/gamecast2/scene.js"
  );

  return [
    `desktop ${Math.round(desktopProbe.cssWidth)}x${Math.round(desktopProbe.cssHeight)}`,
    `feed ${desktopProbe.feedCount}/${desktopProbe.totalEvents}`,
    "single-instance OK",
    "speed-persist OK",
    "defense/skip/x4 OK",
    "pause/step OK",
    `playfeel ball ${playFeelProbe.ballFrames}/${playFeelSamples.length}`,
    `midview ${viewportSweep.map((probe) => probe.width).join("/")}`,
    `mobile canvas ${Math.round(mobileProbe.canvasWidth)}px`,
    `v2 anchors ${anchorProbe.anchorCount}, players ${anchorProbe.playerCount}`
  ].join(", ");
}

async function waitForGamecastLabModal() {
  const deadline = Date.now() + 12000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const ready = await evaluateInBrowser(`
        Boolean(
          window.__labState?.lastGames?.[0]?.plateAppearanceEvents?.length &&
          document.querySelector("[data-gamecast-modal] [data-gamecast-screen]") &&
          document.querySelector("[data-gamecast-modal] [data-gamecast-canvas]")
        )
      `);
      if (ready) {
        await delay(120);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`게임캐스트 랩 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "gamecast-lab.html");
}

function checkBrowserConsoleErrors() {
  const uniqueErrors = uniqueStrings(browserErrors);
  assert(uniqueErrors.length === 0, `브라우저 콘솔/런타임 에러 ${uniqueErrors.length}건: ${uniqueErrors.slice(0, 5).join(" / ")}`, "index.html");

  const consoleSummary = consoleEvents.length ? `${consoleEvents.length}개 콘솔 이벤트 수집` : "콘솔 이벤트 없음";
  return `${consoleSummary}, error 0건`;
}

function attachBrowserEventCollectors(client) {
  client.on("Runtime.consoleAPICalled", (params) => {
    const text = (params.args ?? []).map(formatRemoteObject).join(" ");
    const eventText = `${params.type}: ${text}`.trim();
    consoleEvents.push(eventText);
    if (params.type === "error") {
      browserErrors.push(eventText);
    }
  });

  client.on("Runtime.exceptionThrown", (params) => {
    const detail = params.exceptionDetails;
    browserErrors.push(`exception: ${detail?.text ?? "Runtime exception"} ${detail?.exception?.description ?? ""}`.trim());
  });

  client.on("Log.entryAdded", (params) => {
    const entry = params.entry ?? {};
    if (entry.level === "error") {
      browserErrors.push(`log: ${entry.text ?? "Unknown browser log error"}`);
    }
  });
}

async function waitForRenderedApp() {
  const deadline = Date.now() + 10000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector(".app-shell") &&
          document.querySelector(".topbar .topbar-logo-plate img") &&
          document.querySelector("[data-action='switch-tab']") &&
          document.querySelectorAll("[data-action='switch-tab']").length >= 10
        )
      `);
      if (rendered) {
        await delay(300);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(100);
  }

  throw new VerificationError(`앱 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function switchDashboardTab(tabId) {
  const switched = await evaluateInBrowser(`
    (() => {
      const button = document.querySelector("[data-action='switch-tab'][data-tab-id='${escapeJsString(tabId)}']");
      button?.click();
      return Boolean(button && document.querySelector("[data-active-tab='${escapeJsString(tabId)}']"));
    })()
  `);
  if (!switched) {
    throw new VerificationError(`대시보드 탭 전환 실패: ${tabId}`, "src/ui.js");
  }
  await delay(140);
}

async function collectTabbedCoverage() {
  const coverage = {};

  await switchDashboardTab("news");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => {
      const bodyText = document.body.innerText || "";
      return {
        hasDailyReport: bodyText.includes("전력분석") && bodyText.includes("퓨처스")
      };
    })()
  `));

  await switchDashboardTab("players");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => {
      const statsPanel = document.querySelector("#stats.stats-panel");
      const statsPanelText = statsPanel?.textContent ?? "";
      const contractsPanel = document.querySelector("#contracts.contract-panel");
      const contractsPanelText = contractsPanel?.textContent ?? "";
      return {
        hasStatsPanel: Boolean(statsPanel),
        hasBatterStats: statsPanelText.includes("타자 TOP"),
        hasPitcherStats: statsPanelText.includes("투수 TOP"),
        hasContractsPanel: Boolean(contractsPanel),
        hasContractSummary: contractsPanelText.includes("연봉/FA") && contractsPanelText.includes("추정")
      };
    })()
  `));

  await switchDashboardTab("postseason");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => {
      const postseasonPanel = document.querySelector("#postseason.postseason-panel");
      const postseasonPanelText = postseasonPanel?.textContent ?? "";
      return {
        hasPostseasonPanel: Boolean(postseasonPanel),
        hasPostseasonBracket: postseasonPanelText.includes("와일드카드") && postseasonPanelText.includes("한국시리즈"),
        postseasonSeriesCards: document.querySelectorAll("#postseason .series-card").length,
        hasAwardGrid: Boolean(document.querySelector("#postseason .award-grid"))
      };
    })()
  `));

  await switchDashboardTab("drafts");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => {
      const draftPanel = document.querySelector("#draft.draft-panel");
      const draftPanelText = draftPanel?.textContent ?? "";
      const secondaryDraftPanel = document.querySelector("#secondary-draft.secondary-draft-panel");
      const secondaryDraftPanelText = secondaryDraftPanel?.textContent ?? "";
      return {
        hasDraftPanel: Boolean(draftPanel),
        hasDraftBoard: draftPanelText.includes("드래프트 보드"),
        draftCards: document.querySelectorAll("#draft .draft-card").length,
        hasSecondaryDraftPanel: Boolean(secondaryDraftPanel),
        hasSecondaryDraftBoard: secondaryDraftPanelText.includes("2차 드래프트") && secondaryDraftPanelText.includes("35인"),
        secondaryProtectionCards: document.querySelectorAll("#secondary-draft .protection-card").length
      };
    })()
  `));

  await switchDashboardTab("market");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => {
      const tradeLedgerPanel = document.querySelector("#trade-ledger.trade-ledger-panel");
      const tradeLedgerPanelText = tradeLedgerPanel?.textContent ?? "";
      const freeAgencyPanel = document.querySelector("#free-agency.free-agency-panel");
      const freeAgencyPanelText = freeAgencyPanel?.textContent ?? "";
      const bodyText = document.body.innerText || "";
      return {
        hasTradeCommitAction: Boolean(document.querySelector("[data-action='commit-trade']")),
        hasTradeLedgerPanel: Boolean(tradeLedgerPanel),
        hasTradeLedgerTitle: tradeLedgerPanelText.includes("트레이드 원장"),
        hasTradeCommandCard: Boolean(document.querySelector(".trade-command-card")),
        hasTradeSupplementalAsset: bodyText.includes("현금") || bodyText.includes("지명권") || bodyText.includes("조건부") || bodyText.includes("후일결정선수"),
        hasFreeAgencyAction: Boolean(document.querySelector("[data-action='free-agency']")),
        hasSignFaAction: Boolean(document.querySelector("[data-action='sign-fa']")),
        hasSignForeignAction: Boolean(document.querySelector("[data-action='sign-foreign']")),
        hasFreeAgencyPanel: Boolean(freeAgencyPanel),
        hasFreeAgencyBoard: freeAgencyPanelText.includes("FA/외국인 시장") && freeAgencyPanelText.includes("FGN-"),
        faCards: document.querySelectorAll("#free-agency .fa-card").length,
        foreignCards: document.querySelectorAll("#free-agency .foreign-card").length,
        marketLedgerItems: document.querySelectorAll("#free-agency .market-ledger-item").length,
        hasMarketLedger: freeAgencyPanelText.includes("시장 장부")
      };
    })()
  `));

  await switchDashboardTab("schedule");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => {
      const schedulePanel = document.querySelector("#schedule.schedule-calendar-panel");
      const schedulePanelText = schedulePanel?.textContent ?? "";
      const nextGamePanel = document.querySelector(".next-game-panel");
      const nextGamePanelText = nextGamePanel?.textContent ?? "";
      return {
        hasNextGamePanel: Boolean(nextGamePanel),
        hasWatchNextAction: Boolean(document.querySelector("[data-action='watch-next-game']")),
        hasSimNextAction: Boolean(document.querySelector("[data-action='simulate-next-game']")),
        hasNextGameChoiceText: nextGamePanelText.includes("경기 시작") && nextGamePanelText.includes("스킵"),
        hasSchedulePanel: Boolean(schedulePanel),
        hasScheduleTitle: schedulePanelText.includes("월 일정"),
        hasScheduleControls: Boolean(document.querySelector("[data-action='calendar-prev']")) && Boolean(document.querySelector("[data-action='calendar-next']")),
        scheduleCells: document.querySelectorAll("#schedule [data-schedule-cell]").length,
        scheduleGameCells: document.querySelectorAll("#schedule .schedule-day.is-scheduled, #schedule .schedule-day.is-played").length,
        scheduleLogoCount: document.querySelectorAll("#schedule img.schedule-logo").length
      };
    })()
  `));

  await switchDashboardTab("lineup");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => ({
      hasPitchingSnapshot: document.body.innerText.includes("선발 로테이션") && document.body.innerText.includes("불펜 역할")
    }))()
  `));

  await switchDashboardTab("operations");
  Object.assign(coverage, await evaluateInBrowser(`
    (() => ({
      hasSeasonFastButton: Boolean(document.querySelector("[data-action='season']")),
      hasWeekFastButton: Boolean(document.querySelector("[data-action='week']")),
      hasAutoOffseasonAction: Boolean(document.querySelector("[data-action='auto-offseason']")),
      hasNextSeasonAction: Boolean(document.querySelector("[data-action='next-season']")),
      hasPostseasonAction: Boolean(document.querySelector("[data-action='postseason']")),
      hasDraftAction: Boolean(document.querySelector("[data-action='draft']")),
      hasSecondaryDraftAction: Boolean(document.querySelector("[data-action='secondary-draft']"))
    }))()
  `));

  return coverage;
}

async function installGamecastRafProbe() {
  await evaluateInBrowser(`
    (() => {
      if (window.__gamecastRafProbeInstalled) return true;
      const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
      const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
      const active = new Set();
      const stats = { requested: 0, fired: 0, canceled: 0 };
      window.__gamecastRafProbeInstalled = true;
      window.__gamecastRafProbe = {
        get activeCount() { return active.size; },
        get requested() { return stats.requested; },
        get fired() { return stats.fired; },
        get canceled() { return stats.canceled; }
      };
      window.requestAnimationFrame = (callback) => {
        const id = nativeRequestAnimationFrame((timestamp) => {
          active.delete(id);
          stats.fired += 1;
          callback(timestamp);
        });
        active.add(id);
        stats.requested += 1;
        return id;
      };
      window.cancelAnimationFrame = (id) => {
        if (active.delete(id)) stats.canceled += 1;
        return nativeCancelAnimationFrame(id);
      };
      return true;
    })()
  `);
}

async function waitForStartScreen() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector(".start-shell") &&
          document.querySelector("[data-action='start-new']") &&
          document.querySelector("[data-action='load-save-start']")
        )
      `);
      if (rendered) {
        await delay(100);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`시작 화면 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function waitForTeamSelect() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector(".team-select-stage") &&
          document.querySelectorAll("[data-action='choose-start-team']").length === 10
        )
      `);
      if (rendered) {
        await delay(100);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`팀 선택 화면 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function waitForManagerSetup() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector(".manager-setup-stage") &&
          document.querySelector("[data-manager-form]") &&
          document.querySelector("input[name='managerName']")
        )
      `);
      if (rendered) {
        await delay(100);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`감독 등록 화면 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function waitForAppointment() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector(".appointment-stage") &&
          document.querySelector("[data-appointment-form]") &&
          document.querySelector(".appointment-ceremony-banner") &&
          document.body.innerText.includes("취임식") &&
          document.querySelectorAll(".interview-question").length > 0
        )
      `);
      if (rendered) {
        await delay(100);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`취임 기자회견 화면 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function waitForBoxScore() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector(".boxscore-mini") &&
          document.querySelectorAll(".game-card").length >= 5
        )
      `);
      if (rendered) {
        await delay(100);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`박스스코어 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function waitForFreeAgencyPanel() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        Boolean(
          document.querySelector("#free-agency.free-agency-panel") &&
          document.querySelectorAll("#free-agency .fa-card").length >= 6 &&
          document.querySelectorAll("#free-agency .foreign-card").length >= 6
        )
      `);
      if (rendered) {
        await delay(100);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(80);
  }

  throw new VerificationError(`FA/외국인 시장 렌더링 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function waitForGamecastPlayerLabel() {
  const deadline = Date.now() + 5000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const rendered = await evaluateInBrowser(`
        (() => {
          const label = document.querySelector("[data-gamecast-player-label]");
          return Boolean(label?.classList.contains("is-visible") && label.textContent.trim().length > 0);
        })()
      `);
      if (rendered) {
        await delay(80);
        return;
      }
    } catch (error) {
      lastError = error?.message ?? String(error);
    }
    await delay(50);
  }

  throw new VerificationError(`게임캐스트 선수 이름표 대기 시간이 초과되었습니다.${lastError ? ` 마지막 오류: ${lastError}` : ""}`, "src/ui.js");
}

async function evaluateInBrowser(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "브라우저 평가 중 예외 발생");
  }

  return result.result?.value;
}

async function waitForDevToolsEndpoint(profileDir, childProcess, stderrLines) {
  const portFile = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 12000;

  while (Date.now() < deadline) {
    if (childProcess.exitCode !== null) {
      throw new VerificationError(
        `${browserName || "브라우저"}가 시작 직후 종료되었습니다. ${stderrLines.slice(-3).join(" ")}`,
        "tools/verify_browser.mjs"
      );
    }

    if (fs.existsSync(portFile)) {
      const [portLine, webSocketPath] = fs.readFileSync(portFile, "utf8").trim().split(/\r?\n/);
      return { port: Number(portLine), webSocketPath };
    }
    await delay(100);
  }

  throw new VerificationError("DevToolsActivePort 파일을 찾지 못했습니다.", "tools/verify_browser.mjs");
}

async function openCdpTarget(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT"
  });

  if (!response.ok) {
    throw new VerificationError(`CDP target 생성 실패: HTTP ${response.status}`, "tools/verify_browser.mjs");
  }

  const target = await response.json();
  assert(target.webSocketDebuggerUrl, "CDP target WebSocket URL이 없습니다.", "tools/verify_browser.mjs");
  return target;
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.BROWSER_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    path.join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.PROGRAMFILES ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
    which("chrome"),
    which("chrome.exe"),
    which("msedge"),
    which("msedge.exe"),
    which("chromium"),
    which("chromium-browser")
  ].filter(Boolean);

  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new VerificationError(
      "Chrome 또는 Edge 실행 파일을 찾지 못했습니다. CHROME_PATH 환경변수로 브라우저 경로를 지정하세요.",
      "tools/verify_browser.mjs"
    );
  }

  return executable;
}

function which(command) {
  const executable = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(executable, [command], { encoding: "utf8", shell: false });
  if (result.status !== 0) return "";
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

async function cleanup() {
  if (cdp) {
    cdp.close();
    cdp = null;
  }

  if (browserProcess && browserProcess.exitCode === null) {
    browserProcess.kill();
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 2000);
      browserProcess.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }

  if (browserProfileDir) {
    fs.rmSync(browserProfileDir, { recursive: true, force: true });
    browserProfileDir = "";
  }
}

function assert(condition, message, location) {
  if (!condition) {
    throw new VerificationError(message, location);
  }
}

function assertFileExists(filePath, label) {
  assert(fs.existsSync(filePath), `${label} 파일이 없습니다.`, relativePath(filePath));
}

function isInsideRoot(filePath) {
  const relative = path.relative(ROOT_DIR, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function formatRemoteObject(remoteObject) {
  if (remoteObject.value !== undefined) return String(remoteObject.value);
  if (remoteObject.description) return remoteObject.description;
  return remoteObject.type ?? "";
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildReport() {
  const passed = results.filter((result) => result.status === "PASS").length;
  const failed = results.length - passed;
  const generatedAt = new Date().toISOString();

  const lines = [
    "# 브라우저/패키징 QA 보고서",
    "",
    `- 실행 시각: ${generatedAt}`,
    `- 작업 폴더: ${ROOT_DIR}`,
    `- 실행 Node: ${process.execPath} (${process.version})`,
    `- 대상 URL: ${appUrl ?? "-"}`,
    `- 브라우저: ${browserName || "-"}`,
    `- 종합 결과: ${failed === 0 ? "통과" : "실패"} (${passed}/${results.length} 통과, 경고 ${warnings.length}건)`,
    "",
    "## 체크 결과",
    "",
    "| 항목 | 결과 | 상세 | 위치 |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| ${escapeMarkdown(result.name)} | ${result.status} | ${escapeMarkdown(result.detail)} | ${escapeMarkdown(
          result.location || "-"
        )} |`
    )
  ];

  if (warnings.length > 0) {
    lines.push("", "## 경고", "", ...uniqueStrings(warnings).map((warning) => `- ${escapeMarkdown(warning)}`));
  }

  if (browserErrors.length > 0) {
    lines.push("", "## 브라우저 에러", "", ...uniqueStrings(browserErrors).map((error) => `- ${escapeMarkdown(error)}`));
  }

  const failures = results.filter((result) => result.status === "FAIL");
  if (failures.length > 0) {
    lines.push("", "## 실패 원인", "", ...failures.map((result) => `- ${result.name}: ${result.detail} (${result.location || "위치 미상"})`));
  }

  lines.push(
    "",
    "## 실행 명령",
    "",
    "```powershell",
    "npm run verify:browser",
    "```",
    ""
  );

  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function guessLocation(name) {
  if (name.includes("Electron")) return "package.json";
  if (name.includes("선수")) return "src/data.js";
  if (name.includes("렌더링")) return "src/ui.js";
  if (name.includes("콘솔")) return "index.html";
  return "tools/verify_browser.mjs";
}

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll(path.sep, "/");
}

function escapeJsString(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(async (error) => {
  results.push({
    name: "브라우저 QA 스크립트",
    status: "FAIL",
    detail: error?.stack ?? error?.message ?? String(error),
    location: "tools/verify_browser.mjs"
  });

  try {
    await cleanup();
  } finally {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, buildReport(), "utf8");
    console.error(error);
    process.exitCode = 1;
  }
});
