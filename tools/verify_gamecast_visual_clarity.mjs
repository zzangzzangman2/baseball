import fs from "node:fs";
import {
  GAMECAST_WATCH_GAP_MS,
  battedBallPoint,
  buildGamecastActionBurst,
  gamecastBallDisplaySize,
  gamecastEffectivePlaybackRate,
  gamecastMovementSettleProgress,
  gamecastPitchCount,
  gamecastResultRevealProgress,
  gamecastResultDisplayText,
  gamecastSideInfoSummary,
  gamecastStepHoldProgress,
  gamecastWalkPitchState
} from "../src/ui.js";
import {
  GAMECAST2_BALL_MIN_RENDER_SCALE,
  GAMECAST2_BALL_TEXTURE_SIZE,
  prepareGamecast2LoadingSurface
} from "../src/gamecast2/scene.js";
import {
  GAMECAST_BALL_MIN_RENDER_SCALE,
  GAMECAST_THROW_BALL_SIZE
} from "../src/gamecastPhaser.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const resultCases = [
  [{ outcome: "single" }, "안타"],
  [{ outcome: "double" }, "2루타"],
  [{ outcome: "triple" }, "3루타"],
  [{ outcome: "homeRun" }, "홈런"],
  [{ outcome: "strikeout" }, "삼진"],
  [{ outcome: "walk" }, "볼넷"],
  [{ outcome: "out" }, "아웃"],
  [{ outcome: "out", doublePlay: true }, "병살"],
  [{ outcome: "error" }, "실책"],
  [{ outcome: "sacrificeBunt" }, "희생번트"]
];

for (const [event, expected] of resultCases) {
  assert(
    gamecastResultDisplayText(event) === expected,
    `${event.outcome}${event.doublePlay ? "/DP" : ""} 결과 문구가 ${expected}가 아닙니다.`
  );
}

const heldHitBanner = buildGamecastActionBurst({ outcome: "single" }, 1);
assert(heldHitBanner?.text === "안타!" && heldHitBanner.opacity === 1, "결과 배너가 다음 타석 직전까지 유지되지 않습니다.");
assert(GAMECAST_WATCH_GAP_MS >= 1400, "타석 결과 확인 시간이 1.4초보다 짧습니다.");
assert(
  gamecastEffectivePlaybackRate(
    { playbackRate: 4, sequence: { mode: "watch" } },
    { bridge: true }
  ) === 1,
  "고배속에서 결과 확인 구간이 1배속으로 제한되지 않습니다."
);

assert(gamecastWalkPitchState(0.1)?.pitchNumber === 4, "The decisive fourth ball is not visible.");
assert(gamecastWalkPitchState(0.25) === null, "A walk incorrectly repeats more than one pitch.");
assert(gamecastResultRevealProgress({ outcome: "walk" }) === 0.2, "Ball four is not called as soon as the decisive pitch reaches the catcher.");
assert(buildGamecastActionBurst({ outcome: "walk" }, 0.199) === null, "The walk result appears before ball four reaches the catcher.");
const walkCallBurst = buildGamecastActionBurst({ outcome: "walk" }, 0.2);
assert(walkCallBurst?.opacity === 1, "The walk result is not fully visible on the ball-four arrival frame.");
const walkMovementEvent = {
  outcome: "walk",
  hitterId: "walk-batter",
  basesBefore: [false, false, false],
  basesAfter: [true, false, false],
  baseRunnerIdsBefore: ["", "", ""],
  baseRunnerIdsAfter: ["walk-batter", "", ""],
  scoredRunners: [],
  gamecastDurationMs: 4800
};
assert(
  gamecastMovementSettleProgress(walkMovementEvent) > gamecastResultRevealProgress(walkMovementEvent) + 0.25,
  "The walk call is still coupled to the batter's arrival at first."
);
assert(
  gamecastStepHoldProgress(walkMovementEvent) === gamecastMovementSettleProgress(walkMovementEvent),
  "Step mode freezes at ball four and skips the batter's walk to first."
);
assert(
  buildGamecastActionBurst(walkMovementEvent, gamecastStepHoldProgress(walkMovementEvent))?.text,
  "The walk result is no longer visible when step mode pauses after runner movement."
);
assert(gamecastPitchCount({ progress: 0, event: { outcome: "walk" } }).balls === 3, "The walk does not start from a three-ball count.");
assert(gamecastPitchCount({ progress: 0.9, event: { outcome: "walk" } }).balls === 3, "The fourth ball incorrectly creates a fourth B lamp.");
assert(gamecastPitchCount({ progress: 0, event: { outcome: "strikeout" } }).strikes === 2, "The strikeout does not start from a two-strike count.");
assert(gamecastResultDisplayText({ outcome: "single", battedBallType: "flyBall" }) === "뜬공 안타", "A fly-ball hit is not labeled explicitly.");
assert(gamecastResultDisplayText({ outcome: "out", battedBallType: "flyBall" }) === "뜬공 아웃", "A caught fly out is not labeled explicitly.");

const groundOutSideInfo = gamecastSideInfoSummary({
  outcome: "out",
  battedBallType: "groundBall",
  defenderName: "유격수",
  fieldingPosition: "SS",
  defensiveThrowTarget: "first",
  basesBefore: [true, false, false],
  outsBefore: 1
});
assert(groundOutSideInfo.result === "땅볼 아웃", "옆 정보 패널이 땅볼 아웃 결과를 구분하지 못합니다.");
assert(groundOutSideInfo.ball === "땅볼", "옆 정보 패널에 타구 종류가 없습니다.");
assert(groundOutSideInfo.fielder === "유격수 (SS)", "옆 정보 패널에 처리 수비수가 없습니다.");
assert(groundOutSideInfo.throwTarget === "1루", "옆 정보 패널에 송구 목적지가 없습니다.");
assert(groundOutSideInfo.bases === "1루" && groundOutSideInfo.outs === "1아웃", "옆 정보 패널의 주자/아웃 상황이 틀립니다.");
const walkSideInfo = gamecastSideInfoSummary({ outcome: "walk", basesBefore: [false, false, false], outsBefore: 0 });
assert(walkSideInfo.ball === "볼넷" && !walkSideInfo.showFielder && !walkSideInfo.showThrow, "볼넷 옆 정보가 불필요한 수비/송구 칸을 노출합니다.");

const caughtFlyEvent = { id: "direct-catch", sequence: 77, outcome: "out", battedBallType: "flyBall", fieldingPosition: "CF" };
const safeFlyEvent = { ...caughtFlyEvent, outcome: "single" };
const caughtFlyEnd = battedBallPoint(caughtFlyEvent, 1);
const safeFlyEnd = battedBallPoint(safeFlyEvent, 1);
assert(
  caughtFlyEnd.y <= safeFlyEnd.y - 8,
  "Legacy caught fly still finishes at the ground/bounce point instead of the raised glove."
);

for (const phase of ["pitch", "held", "throw"]) {
  assert(gamecastBallDisplaySize(phase) >= 2.1, `${phase} 공 최소 크기가 너무 작습니다.`);
}
assert(gamecastBallDisplaySize("batted", { outcome: "single", battedBallType: "groundBall" }) >= 2.4, "땅볼 타구 공 크기가 너무 작습니다.");
assert(gamecastBallDisplaySize("batted", { outcome: "single", battedBallType: "lineDrive" }) >= 2.7, "라이너 타구 공 크기가 너무 작습니다.");
assert(gamecastBallDisplaySize("batted", { outcome: "homeRun", battedBallType: "flyBall" }) >= 3.2, "홈런 타구 공 크기가 너무 작습니다.");
assert(GAMECAST2_BALL_TEXTURE_SIZE >= 20, "v2 공 텍스처가 20px보다 작습니다.");
assert(GAMECAST2_BALL_MIN_RENDER_SCALE >= 0.95, "v2 공 최소 렌더 스케일이 너무 작습니다.");
assert(GAMECAST_THROW_BALL_SIZE >= 1.25, "Phaser 송구 공이 너무 작습니다.");
assert(GAMECAST_BALL_MIN_RENDER_SCALE >= 1.2, "Phaser 공 최소 렌더 스케일이 너무 작습니다.");

const fakeRuntime = {
  field: { imageUrl: "./assets/gamecast2/field-jamsil-day.png?v=visual-test" },
  stage: { style: {} },
  canvas: { style: {} },
  screen: { dataset: {} }
};
prepareGamecast2LoadingSurface(fakeRuntime);
assert(fakeRuntime.stage.style.backgroundImage.includes("field-jamsil-day.png"), "v2 로딩 포스터가 선택 구장 이미지를 쓰지 않습니다.");
assert(fakeRuntime.stage.style.backgroundSize === "100% 100%", "v2 로딩 포스터가 필드 크기를 채우지 않습니다.");
assert(fakeRuntime.canvas.style.background === "transparent", "v2 로딩 중 캔버스가 포스터를 가립니다.");
assert(fakeRuntime.screen.dataset.gamecast2LoadingSurface === "field-poster", "v2 로딩 표면 상태가 field-poster가 아닙니다.");
assert(fakeRuntime.screen.dataset.gamecast2PaintReady === "0", "v2 첫 페인트 전 상태가 노출되지 않습니다.");

const uiSource = fs.readFileSync(new URL("../src/ui.js", import.meta.url), "utf8");
const sceneSource = fs.readFileSync(new URL("../src/gamecast2/scene.js", import.meta.url), "utf8");
const stylesSource = fs.readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

assert(uiSource.includes("data-gamecast-result-banner"), "경기 화면 결과 배너 마커가 없습니다.");
assert(uiSource.includes('class="gamecast-broadcast-rail"'), "큰 화면 오른쪽 경기 정보 레일이 없습니다.");
assert(uiSource.includes("data-gamecast-side-info"), "현재 플레이 구조화 정보 카드가 없습니다.");
assert(stylesSource.includes('grid-template-areas: "stage rail"'), "데스크톱 중계 화면과 오른쪽 정보 레일이 분리되지 않았습니다.");
assert(stylesSource.includes("scrollbar-gutter: stable"), "플레이 기록 스크롤 시 정보 레일 폭이 흔들릴 수 있습니다.");
assert(sceneSource.includes("transparent: true"), "v2 Phaser 캔버스가 투명 로딩 표면을 사용하지 않습니다.");
assert(!sceneSource.includes('backgroundColor: "#07120f"'), "v2 첫 로딩 검은 배경이 다시 들어왔습니다.");
assert(sceneSource.includes("camera.setScroll?.(0, 0)"), "v2 타구 추적 카메라가 필드 바깥 검은 영역을 노출할 수 있습니다.");
assert(!sceneSource.includes("camera.centerOn?.("), "v2 타구 추적 카메라의 검은 필드 바깥 노출 경로가 남아 있습니다.");
assert(stylesSource.includes("background: #4f8a73;"), "필드 이미지 실패 시 녹색 로딩 표면이 없습니다.");
assert(
  !/\.gamecast-screen\.is-v2\s+\.gamecast-action-burst\s*\{[^}]*display:\s*none/s.test(stylesSource),
  "v2에서 결과 배너가 숨겨져 있습니다."
);

console.log(`Gamecast visual clarity verification passed: ${resultCases.length} results, ball visibility, no-black loading surface`);
