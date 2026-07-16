// 게임캐스트 QA 랩: 온보딩/프리시즌을 건너뛰고 정규시즌 경기 관전을 즉시 연다.
// 사용: gamecast-lab.html 접속. 쿼리 옵션 —
//   ?engine=canvas|phaser|v2  렌더러 강제 (기본 v2)
//   ?debug=anchors           v2 앵커 오버레이 표시
//   ?days=N                개막 후 N일 추가 진행 (기본 3)
//   ?fullscreen=0          큰 화면 자동 열기 끄기
//   ?team=lg|doosan|...    구단 선택 (기본 lg)
//   ?step=1                타석 확인 모드로 시작
//   ?speed=0.5|1|1.5|2|4   시작 배속 선택
//   ?holds=0               자동 홀드 끄기
import { createInitialState } from "./data.js";
import { simulateDay, resolveMailDecision } from "./engine.js?v=gamecast-short-result-roll-20260716-r26";
import { mountApp } from "./ui.js?v=gamecast-short-result-roll-20260716-r26";

const params = new URLSearchParams(window.location.search);
const state = createInitialState();

state.selectedTeamId = params.get("team") || state.selectedTeamId;
state.manager = { name: "랩 테스터", age: 45, style: "balanced" };
state.ui.screen = "game";
if (params.get("engine")) state.ui.gamecastEngine = params.get("engine");
state.ui.gamecastFps = params.get("fps") === "1";
state.ui.gamecastStepMode = params.get("step") === "1";
if (params.get("holds") === "0") state.ui.gamecastHolds = false;
if (params.get("speed")) state.ui.gamecastPlaybackRate = Number(params.get("speed"));

function clearOpenMail() {
  for (let guard = 0; guard < 6; guard += 1) {
    if (state.pendingMailDecision?.status !== "open") break;
    resolveMailDecision(state);
  }
}

for (let guard = 0; guard < 60 && state.phase === "preseason"; guard += 1) {
  simulateDay(state);
  clearOpenMail();
}

const extraDays = Math.max(0, Number(params.get("days") ?? 3));
for (let i = 0; i < extraDays && state.phase === "regular"; i += 1) {
  simulateDay(state);
  clearOpenMail();
}
clearOpenMail();

window.__labState = state;
mountApp(document.getElementById("app"), state);

const clickWhenReady = (selector, timeoutMs = 6000) => new Promise((resolve) => {
  const startedAt = performance.now();
  const attempt = () => {
    const target = document.querySelector(selector);
    if (target && !target.disabled) {
      target.click();
      resolve(true);
      return;
    }
    if (performance.now() - startedAt > timeoutMs) {
      resolve(false);
      return;
    }
    requestAnimationFrame(attempt);
  };
  attempt();
});

(async () => {
  const watched = await clickWhenReady("[data-action='watch-next-game']");
  if (!watched) {
    console.warn("[gamecast-lab] 경기 시작 버튼을 찾지 못했습니다. phase:", state.phase);
    return;
  }
  if (params.get("fullscreen") === "0") {
    await clickWhenReady("[data-action='close-gamecast-broadcast']", 8000);
  } else {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await clickWhenReady("[data-action='open-gamecast-broadcast']", 8000);
  }
  const speed = Number(params.get("speed"));
  if ([0.5, 1, 1.5, 2, 4].includes(speed)) {
    await clickWhenReady(`[data-gamecast-speed='${speed}']`, 3000);
  }
  console.info("[gamecast-lab] ready", { date: state.currentDate, phase: state.phase, engine: state.ui.gamecastEngine });
})();
