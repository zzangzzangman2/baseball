import {
  advanceSeason,
  advanceDraftToUserPick,
  advanceSecondaryDraftToUserPick,
  buildLineup,
  buildPitchingSnapshot,
  commitClubPhilosophy,
  commitGameInterventionPlan,
  commitPitchingPlan,
  commitScoutAssignment,
  commitUserDraftPick,
  commitUserSecondaryDraftPick,
  commitForeignPlayerSigning,
  commitFreeAgentSigning,
  commitTradeProposal,
  advanceUntilStop,
  deliverMail,
  getClubhouseDynamics,
  getMailboxItems,
  getMailboxSummary,
  getManagerJobStatus,
  getOpenMailDecisions,
  getRecordBook,
  getSelectedTeam,
  getNextGamePreview,
  getTeamMonthlySchedule,
  getStandings,
  initializeDraft,
  initializeFreeAgency,
  initializePostseason,
  initializeSecondaryDraft,
  markMailRead,
  rememberManagerAction,
  resolveDefensiveThrowTarget,
  resolveMailDecision,
  simulateDay,
  simulateDays,
  simulateNextUserGame,
  simulateDraft,
  simulatePostseason,
  simulateSecondaryDraft,
  setSecondaryDraftProtection,
  runAutonomousOffseason
} from "./engine.js?v=gamecast-wall-impact-20260716-r24";

import {
  getContractSummary,
  getDepthNeeds,
  getPayrollPressure,
  getProspectWatch,
  getRosterSummary,
  getScoutBoard,
  getTradeBlock
} from "./systems.js";

import {
  exportGameState,
  importGameState,
  makeSaveFileName
} from "./save.js";

import {
  buildFrontOfficeInbox,
  buildScoutAssignments,
  buildTradeMarket
} from "./frontOffice.js";

import {
  canUseGamecastPhaser,
  mountGamecastPhaser
} from "./gamecastPhaser.js?v=gamecast-wall-impact-20260716-r24";

import {
  canUseGamecast2,
  getGamecast2PlayDurationMs,
  getGamecast2RunnerStartMs,
  mountGamecast2
} from "./gamecast2/index.js?v=gamecast-wall-impact-20260716-r24";

const TEAM_META = {
  lg: { shortName: "LG", city: "서울", color: "#c30452" },
  kt: { shortName: "KT", city: "수원", color: "#231f20" },
  ssg: { shortName: "SSG", city: "인천", color: "#ce0e2d" },
  nc: { shortName: "NC", city: "창원", color: "#315288" },
  doosan: { shortName: "두산", city: "서울", color: "#131230" },
  kia: { shortName: "KIA", city: "광주", color: "#ea0029" },
  lotte: { shortName: "롯데", city: "부산", color: "#041e42" },
  samsung: { shortName: "삼성", city: "대구", color: "#074ca1" },
  hanwha: { shortName: "한화", city: "대전", color: "#f37321" },
  kiwoom: { shortName: "키움", city: "서울", color: "#570514" }
};

const MANAGER_STYLES = [
  { value: "balanced", label: "균형 운영", description: "라인업과 육성을 함께 본다" },
  { value: "analytics", label: "데이터 중시", description: "수치와 매치업을 우선한다" },
  { value: "player", label: "선수단 신뢰", description: "컨디션과 분위기를 살핀다" },
  { value: "win-now", label: "승부수", description: "즉시 전력과 과감한 결정을 선호한다" }
];
const DEFAULT_MANAGER_NAME = "박민준";

const INAUGURAL_QUESTIONS = [
  {
    id: "goal",
    question: "첫 시즌 목표",
    options: [
      { value: "contend", label: "가을야구 경쟁", note: "성적 압박을 받아들인다" },
      { value: "build", label: "지속 가능한 팀", note: "육성과 뎁스 정리를 우선한다" },
      { value: "balanced", label: "매일 이기는 습관", note: "장기와 단기를 함께 본다" }
    ]
  },
  {
    id: "message",
    question: "선수단에 전할 말",
    options: [
      { value: "trust", label: "신뢰를 주겠다", note: "베테랑과 핵심 선수의 안정감" },
      { value: "compete", label: "경쟁을 열겠다", note: "퓨처스와 백업에게 기회" },
      { value: "detail", label: "디테일을 잡겠다", note: "수비, 주루, 컨디션 관리" }
    ]
  },
  {
    id: "front",
    question: "프런트 운영 원칙",
    options: [
      { value: "patient", label: "무리한 거래는 없다", note: "자산 보존과 예산 관리" },
      { value: "aggressive", label: "필요하면 움직인다", note: "트레이드와 FA 시장 적극 검토" },
      { value: "scouting", label: "스카우트부터 넓힌다", note: "불확실성을 줄이는 운영" }
    ]
  }
];

const DASHBOARD_TABS = [
  { id: "clubhouse", label: "클럽하우스", detail: "오늘의 브리핑" },
  { id: "news", label: "포털", detail: "메시지·뉴스·로그" },
  { id: "schedule", label: "일정", detail: "캘린더와 다음 경기" },
  { id: "lineup", label: "라인업", detail: "타순·투수 운용" },
  { id: "players", label: "선수단", detail: "상세·기록·계약" },
  { id: "standings", label: "순위", detail: "리그와 스코어" },
  { id: "records", label: "기록실", detail: "리더·역대 시즌" },
  { id: "front-office", label: "프런트", detail: "업무·스카우트" },
  { id: "market", label: "시장", detail: "트레이드·FA" },
  { id: "drafts", label: "드래프트", detail: "신인·2차" },
  { id: "postseason", label: "가을야구", detail: "PS·시상식" },
  { id: "operations", label: "시스템", detail: "저장·시즌 진행" }
];

const POSITION_GROUP_LABELS = {
  pitcher: "투수",
  catcher: "포수",
  infield: "내야",
  outfield: "외야",
  utility: "지명",
  other: "기타"
};
const KBO_CALENDAR_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const KOREAN_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const UI_OPENING_DAY_MONTH_DAY = "03-28";
const UI_MS_PER_DAY = 24 * 60 * 60 * 1000;

const GAMECAST_PIXEL_W = 400;
const GAMECAST_PIXEL_H = 360;
const GAMECAST_FIELDER_MOVE_ZONES = {
  P: { x: 3, yTop: 2, yBottom: 3 },
  C: { x: 4, yTop: 3, yBottom: 2 },
  "1B": { x: 16, yTop: 13, yBottom: 14 },
  "2B": { x: 17, yTop: 14, yBottom: 13 },
  "3B": { x: 16, yTop: 13, yBottom: 14 },
  SS: { x: 17, yTop: 14, yBottom: 13 },
  LF: { x: 26, yTop: 18, yBottom: 20 },
  CF: { x: 31, yTop: 20, yBottom: 21 },
  RF: { x: 26, yTop: 18, yBottom: 20 }
};
const GAMECAST_ABILITY_TIERS = [
  { key: "S", min: 140, color: "#ffd166" },
  { key: "A", min: 132, color: "#c084fc" },
  { key: "B", min: 125, color: "#38bdf8" },
  { key: "C", min: 118, color: "#e2e8f0" },
  { key: "D", min: 0, color: "#64748b" }
];
const GAMECAST_CANVAS_ID = "gamecast-pixel-canvas";
const GAMECAST_PLAYBACK_COUNT = 8;
const GAMECAST_WATCH_PA_MS = 2600;
export const GAMECAST_WATCH_GAP_MS = 1400;
const GAMECAST_PA_MS = 850;
const GAMECAST_PA_GAP_MS = 120;
const GAMECAST_SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4];
const GAMECAST_RESUME_COUNTDOWN_MS = 400;
const GAMECAST_HOLD_LEVERAGE_THRESHOLD = 0.55;
const GAMECAST_SCORE_SLOW_RATE = 0.35;
const GAMECAST_FAST_BALL_RATE = 1.5;
const GAMECAST_RUN_MS_PER_BASE = 1400;
const GAMECAST_SLIDE_MS = 270;
const GAMECAST_WALK_PITCH_STARTS = Object.freeze([0]);
const GAMECAST_WALK_PITCH_RELEASE_OFFSET = 0.065;
const GAMECAST_WALK_PITCH_SPAN = 0.2;
const GAMECAST_DEFAULT_ENGINE = "v2";
// Ballpark dimensions are visual rendering data only. Sources:
// Jamsil: venue listings commonly publish LF/RF 100m, CF 125m.
// Sajik: Korean venue records publish LF/RF 95.8m, L/R-center 113m, CF 121m.
// Gocheok: Kiwoom Heroes stadium guide publishes LF/RF 99m, CF 122m, fence 4m.
// Daejeon Hanwha Life Ballpark: 2025 press coverage published LF 99, LCF 115, CF 122, RCF 112, RF 95, RF wall 8m.
const KBO_GAMECAST_BALLPARKS = {
  jamsil: { id: "jamsil", label: "잠실", lf: 100, lcf: 120, cf: 125, rcf: 120, rf: 100, wallHeight: 2.6, roofed: false, wallColor: "#1f5b42", wallCap: "#183a2e", seatColors: ["#5e6572", "#394250", "#7a737b"], grass: ["#4f8a73", "#8fd0b4"], mow: "rings", lightTone: "open" },
  sajik: { id: "sajik", label: "사직", lf: 95.8, lcf: 113, cf: 121, rcf: 113, rf: 95.8, wallHeight: 6, roofed: false, wallColor: "#245a48", wallCap: "#173629", seatColors: ["#41566f", "#d45b62", "#6c7785"], grass: ["#4a836d", "#92cfb1"], mow: "checker", lightTone: "coastal" },
  gocheok: { id: "gocheok", label: "고척돔", lf: 99, lcf: 116, cf: 122, rcf: 116, rf: 99, wallHeight: 4, roofed: true, wallColor: "#28384c", wallCap: "#202836", seatColors: ["#2f4057", "#6a7384", "#1f2938"], grass: ["#4d9279", "#85cdb0"], mow: "dome", lightTone: "dome" },
  gwangju: { id: "gwangju", label: "광주", lf: 99, lcf: 116, cf: 121, rcf: 116, rf: 99, wallHeight: 2.6, roofed: false, wallColor: "#315a3f", wallCap: "#203829", seatColors: ["#c73a43", "#4c4d59", "#f2d37a"], grass: ["#53916f", "#91d1ad"], mow: "checker", lightTone: "open" },
  daegu: { id: "daegu", label: "대구", lf: 99.5, lcf: 123.5, cf: 122.5, rcf: 123.5, rf: 99.5, wallHeight: 3.2, roofed: false, wallColor: "#244b7e", wallCap: "#1b3359", seatColors: ["#315288", "#66758f", "#d9d3ca"], grass: ["#4a8a72", "#90cfb0"], mow: "stripes", lightTone: "open" },
  incheon: { id: "incheon", label: "문학", lf: 95, lcf: 115, cf: 120, rcf: 115, rf: 95, wallHeight: 2.8, roofed: false, wallColor: "#7d2f3c", wallCap: "#512532", seatColors: ["#c13b48", "#252c36", "#f3c6ce"], grass: ["#4d8974", "#8ed0b6"], mow: "checker", lightTone: "open" },
  suwon: { id: "suwon", label: "수원", lf: 98, lcf: 115, cf: 120, rcf: 115, rf: 98, wallHeight: 4, roofed: false, wallColor: "#283c60", wallCap: "#1c2a44", seatColors: ["#202b43", "#d9d3ca", "#b82c44"], grass: ["#4f8c72", "#8bcaaa"], mow: "stripes", lightTone: "open" },
  changwon: { id: "changwon", label: "창원", lf: 101, lcf: 116, cf: 122, rcf: 116, rf: 101, wallHeight: 3.3, roofed: false, wallColor: "#244c43", wallCap: "#193832", seatColors: ["#315288", "#b9d9f7", "#4b5d71"], grass: ["#528f72", "#93d3b3"], mow: "rings", lightTone: "open" },
  "daejeon-hanwha-life": { id: "daejeon-hanwha-life", label: "대전", lf: 99, lcf: 115, cf: 122, rcf: 112, rf: 95, wallHeight: 8, roofed: false, wallColor: "#5e2d35", wallCap: "#321c22", seatColors: ["#f37321", "#24222b", "#ffe39a"], grass: ["#4c886c", "#8dd0ad"], mow: "asymmetric", lightTone: "open", monsterSide: "right" },
  neutral: { id: "neutral", label: "중립", lf: 99, lcf: 116, cf: 121, rcf: 116, rf: 99, wallHeight: 3, roofed: false, wallColor: "#24483a", wallCap: "#1b3a2e", seatColors: ["#6f6874", "#575160", "#b9d9f7"], grass: ["#4f8a73", "#8fd0b4"], mow: "rings", lightTone: "open" }
};
const SIMULATION_STEP_DELAY_MS = 95;
const SIMULATION_STEPS = [
  "날씨·구장 변수 계산",
  "선수단 컨디션·부상 점검",
  "라인업·투수 운용 반영",
  "경기·캠프 이벤트 생성",
  "뉴스함·공문 갱신"
];
let cleanupGamecastPixelScreen = null;
let latestGamecastSequence = null;
let latestGamecastEngine = GAMECAST_DEFAULT_ENGINE;
let gamecastPlaybackStore = {
  sequenceId: "",
  elapsedMs: 0,
  playbackRate: 1,
  done: false,
  paused: false,
  stepMode: false,
  hold: null,
  lastHoldKey: ""
};
let gamecastSoundEnabled = true;
let gamecastAudioUnlocked = false;
let gamecastAudioRuntime = null;

export function mountApp(root, state) {
  render(root, state);
}

function render(root, state) {
  cleanupActiveGamecastPixelScreen();
  const screen = state?.ui?.screen ?? "game";
  if (screen !== "game") {
    renderOnboarding(root, state, screen);
    return;
  }

  const standings = getStandings(state);
  const selectedTeam = getSelectedTeam(state);
  const nextGame = getNextGamePreview(state, selectedTeam?.id ?? state.selectedTeamId);
  const calendarMonthOffset = normalizeCalendarMonthOffset(state?.ui?.calendarMonthOffset);
  const monthlySchedule = getTeamMonthlySchedule(state, selectedTeam?.id ?? state.selectedTeamId, calendarMonthOffset);
  const selectedRank = getTeamRank(standings, selectedTeam);
  const manager = getManagerProfile(state);
  const lineup = buildLineup(selectedTeam);
  const roster = getRoster(selectedTeam);
  const seasonLeaders = buildSeasonLeaders(selectedTeam);
  const recordBook = getRecordBook(state, {
    includeUnqualified: Boolean(state?.ui?.recordBookIncludeUnqualified),
    limit: 10
  });
  const pitchingSnapshot = buildPitchingSnapshot(selectedTeam);
  const injuries = roster.filter((player) => Number(player.injuredDays) > 0);
  const managerJob = getManagerJobStatus(state, selectedTeam?.id ?? state.selectedTeamId);
  const clubhouseDynamics = getClubhouseDynamics(state, selectedTeam?.id ?? state.selectedTeamId);
  const teamColor = getTeamColor(selectedTeam);
  const activeTab = normalizeActiveTab(state?.ui?.activeTab);
  const selectedPlayerEntry = getSelectedPlayerEntry(state, selectedTeam) ?? (activeTab === "players" ? getDefaultPlayerEntry(selectedTeam) : null);
  const activeTabMeta = DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0];
  const isAdvancing = Boolean(state?.ui?.isAdvancing);
  const frontOffice = {
    rosterSummary: getRosterSummary(selectedTeam),
    contractSummary: getContractSummary(selectedTeam),
    depthNeeds: getDepthNeeds(selectedTeam),
    prospectWatch: getProspectWatch(selectedTeam),
    payrollPressure: getPayrollPressure(selectedTeam),
    scoutBoard: getScoutBoard(state, selectedTeam?.id ?? state.selectedTeamId),
    tradeBlock: getTradeBlock(state, selectedTeam?.id ?? state.selectedTeamId)
  };
  const gmDesk = {
    tradeMarket: buildTradeMarket(state, selectedTeam?.id ?? state.selectedTeamId),
    scoutAssignments: buildScoutAssignments(state, selectedTeam?.id ?? state.selectedTeamId),
    inbox: buildFrontOfficeInbox(state, selectedTeam?.id ?? state.selectedTeamId)
  };
  gmDesk.tradeMarket.pendingApprovalId = state.pendingTradeApproval?.proposalId ?? "";

  root.innerHTML = `
    <main class="app-shell" style="--team-color: ${escapeAttribute(teamColor)}">
      <aside class="sidebar">
        <a class="brand" href="#" aria-label="KBO GM Manager dashboard">
          <span class="brand-mark" aria-hidden="true"></span>
          <span>
            <strong>KBO GM</strong>
            <small>매니저</small>
          </span>
        </a>
        ${renderSidebarNav(activeTab, state)}
        <section class="sidebar-card">
          <span class="mini-label">오늘</span>
          <strong>${escapeHtml(state.currentDate ?? "2026 Season")}</strong>
          <span>${escapeHtml(state.weather?.label ?? "야구하기 좋은 날")} · ${formatTemperature(state.weather?.temperature)}</span>
        </section>
      </aside>

      <section class="dashboard">
        <header class="topbar" id="clubhouse">
          <div class="topbar-team">
            <div class="team-logo-plate topbar-logo-plate" aria-hidden="true">
              ${renderTeamLogo(selectedTeam, "team-logo topbar-logo")}
            </div>
            <div class="headline">
              <span class="eyebrow">${escapeHtml(activeTabMeta.detail)}</span>
              <h1>${escapeHtml(getTeamName(selectedTeam) ?? "KBO GM Manager")}</h1>
              <p>${formatNumber(state.day)}일차 · ${formatNumber(state.gamesPlayed)} / 720경기 · ${escapeHtml(renderPhase(state.phase))}</p>
            </div>
          </div>
          <div class="topbar-controls topbar-identity">
            <label class="team-picker">
              <span>구단 고정</span>
              <select data-action="select-team" disabled aria-disabled="true">
                ${renderTeamOptions(state)}
              </select>
            </label>
            <div class="manager-chip">
              <span>감독</span>
              <strong>${escapeHtml(manager.name)}</strong>
              <small>${formatNumber(manager.age)}세 · ${escapeHtml(managerStyleLabel(manager.style))}</small>
            </div>
            <div class="quick-action-row">
              ${renderTopbarQuickActions(state, nextGame, isAdvancing)}
            </div>
            <p class="status-message" data-save-status aria-live="polite"></p>
          </div>
        </header>

        ${renderSimulationProgressPanel(state)}

        ${renderActiveTabContent(activeTab, {
          state,
          selectedTeam,
          selectedRank,
          standings,
          manager,
          nextGame,
          monthlySchedule,
          selectedPlayerEntry,
          seasonLeaders,
          recordBook,
          roster,
          lineup,
          pitchingSnapshot,
          injuries,
          managerJob,
          clubhouseDynamics,
          frontOffice,
          gmDesk
        })}
      </section>
      ${renderBlockingDecisionOverlay(state)}
    </main>
  `;

  if (!isAdvancing) initGamecastPixelScreen(root, state);
  bindActions(root, state);
  bindGlobalShortcuts(root, state);
  syncMailboxUnreadStart(root, state);
}

function cleanupActiveGamecastPixelScreen() {
  if (typeof cleanupGamecastPixelScreen !== "function") return;
  cleanupGamecastPixelScreen();
  cleanupGamecastPixelScreen = null;
}

function bindGlobalShortcuts(root, state) {
  root.__kboShortcutState = state;
  if (root.__kboShortcutBound) return;
  const onKeyDown = (event) => {
    const activeState = root.__kboShortcutState;
    if (!shouldHandleGlobalSpace(event, root, activeState)) return;
    const unreadMailButton = getNextUnreadMailButton(root, activeState);
    if (unreadMailButton) {
      event.preventDefault();
      unreadMailButton.dataset.autoReadFromSpace = "true";
      unreadMailButton.click();
      return;
    }
    const continueButton = root.querySelector("[data-action='continue']:not(:disabled)");
    if (!continueButton) return;
    event.preventDefault();
    continueButton.click();
  };
  document.addEventListener("keydown", onKeyDown);
  root.__kboShortcutBound = true;
  root.__kboShortcutCleanup = () => document.removeEventListener("keydown", onKeyDown);
}

function shouldHandleGlobalSpace(event, root, state) {
  if (event.code !== "Space" || event.repeat) return false;
  if ((state?.ui?.screen ?? "game") !== "game") return false;
  if (state?.ui?.isAdvancing) return false;
  const target = event.target;
  if (target?.closest?.("input, select, textarea, [contenteditable='true'], [role='dialog'], [data-gamecast-modal]")) {
    return false;
  }
  if (target?.closest?.("button, a") && !target.closest("[data-main-news-inbox]")) return false;
  if (root.querySelector("[data-gamecast-modal]") || root.querySelector("[data-gamecast-screen]")) return false;
  return Boolean(root.querySelector("[data-action='continue']:not(:disabled)"));
}

function getNextUnreadMailButton(root, state) {
  const activeTab = normalizeActiveTab(state?.ui?.activeTab);
  if (activeTab !== "clubhouse" && activeTab !== "news") return null;
  const unreadButtons = [...root.querySelectorAll("[data-main-news-inbox] [data-action='open-mail'].is-unread")];
  return unreadButtons.at(-1) ?? null;
}

function syncMailboxUnreadStart(root, state) {
  const activeTab = normalizeActiveTab(state?.ui?.activeTab);
  if (activeTab !== "clubhouse" && activeTab !== "news") return;
  const list = root.querySelector("[data-main-news-inbox] .mailbox-list");
  if (!list) return;
  const unreadButtons = [...list.querySelectorAll("[data-action='open-mail'].is-unread")];
  const selectedTarget = list.querySelector("[data-action='open-mail'].is-selected");
  const target = state?.ui?.selectedMailManual && selectedTarget
    ? selectedTarget
    : unreadButtons.at(-1) ?? selectedTarget;
  if (!target) return;
  requestAnimationFrame(() => {
    const listRect = list.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    list.scrollTop = Math.max(0, list.scrollTop + targetRect.bottom - listRect.bottom + 10);
  });
}

function renderSidebarNav(activeTab, state) {
  const mailbox = getMailboxSummary(state);
  return `
    <nav class="nav-list" aria-label="Dashboard sections">
      ${DASHBOARD_TABS.map((tab) => `
        <button class="nav-item ${tab.id === activeTab ? "is-active" : ""}" data-action="switch-tab" data-tab-id="${escapeAttribute(tab.id)}" type="button">
          <span>${escapeHtml(tab.label)}${tab.id === "news" && mailbox.unread > 0 ? ` <b class="nav-badge">${mailbox.unread > 99 ? "99+" : formatNumber(mailbox.unread)}</b>` : ""}</span>
          <small>${escapeHtml(tab.detail)}</small>
        </button>
      `).join("")}
    </nav>
  `;
}

function renderActiveTabContent(activeTab, context) {
  const {
    state,
    selectedTeam,
    selectedRank,
    standings,
    manager,
    nextGame,
    monthlySchedule,
    selectedPlayerEntry,
    seasonLeaders,
    recordBook,
    roster,
    lineup,
    pitchingSnapshot,
    injuries,
    managerJob,
    clubhouseDynamics,
    frontOffice,
    gmDesk
  } = context;

  if (activeTab === "news") {
    return renderTabSurface("news", "포털", `
      ${renderNewsInboxPanel(state, selectedTeam, manager)}
    `);
  }

  if (activeTab === "schedule") {
    return renderTabSurface("schedule", "일정", `
      ${renderNextGamePanel(state, selectedTeam, nextGame)}
      ${renderScheduleCalendarPanel(state, selectedTeam, monthlySchedule)}
    `);
  }

  if (activeTab === "lineup") {
    return renderTabSurface("lineup", "라인업", `
      ${renderLineupManagerPanel(state, selectedTeam, roster, lineup, pitchingSnapshot)}
    `);
  }

  if (activeTab === "players") {
    return renderTabSurface("players", "선수단", `
      ${renderPlayerDetailPanel(state, selectedPlayerEntry)}
      <section class="content-grid">
        ${renderSeasonStatsPanel(selectedTeam, seasonLeaders)}
        ${renderFrontOfficeRosterPanels(frontOffice)}
      </section>
    `);
  }

  if (activeTab === "standings") {
    return renderTabSurface("standings", "순위", `
      <section class="content-grid">
        ${renderStandingsPanel(standings, selectedTeam)}
        ${renderGamesPanel(state)}
        ${renderGamecastPanel(state)}
      </section>
    `);
  }

  if (activeTab === "records") {
    return renderTabSurface("records", "기록실", `
      ${renderRecordBookPanel(state, recordBook)}
    `);
  }

  if (activeTab === "front-office") {
    return renderTabSurface("front-office", "프런트", `
      ${renderCommandCenterPanels(gmDesk, state)}
      ${renderFrontOfficePanels(frontOffice)}
    `);
  }

  if (activeTab === "market") {
    return renderTabSurface("market", "시장", `
      ${renderCommandCenterPanels(gmDesk, state)}
      ${renderTradeLedgerPanel(state)}
      ${renderFreeAgencyPanel(state, selectedTeam)}
    `);
  }

  if (activeTab === "drafts") {
    return renderTabSurface("drafts", "드래프트", `
      ${renderDraftPanel(state)}
      ${renderSecondaryDraftPanel(state)}
    `);
  }

  if (activeTab === "postseason") {
    return renderTabSurface("postseason", "가을야구", `
      ${renderPostseasonPanel(state, standings)}
    `);
  }

  if (activeTab === "operations") {
    return renderTabSurface("operations", "시스템", `
      ${renderOperationsBar(state)}
      ${renderContinueSettingsPanel(state)}
      ${renderStateFoundationPanel(state)}
    `);
  }

  return renderTabSurface("clubhouse", "클럽하우스", `
    <section class="clubhouse-dashboard is-mail-first is-mail-only" aria-label="클럽하우스 메인 브리핑">
      <aside class="clubhouse-side-rail" aria-label="받은편지함">
        ${renderNewsInboxPanel(state, selectedTeam, manager)}
      </aside>
    </section>
  `);
}

function renderTabSurface(tabId, title, body) {
  return `
    <section class="tab-surface" data-active-tab="${escapeAttribute(tabId)}" aria-label="${escapeAttribute(title)}">
      ${body}
    </section>
  `;
}

function renderTopbarQuickActions(state, nextGame, isAdvancing) {
  const mailbox = getMailboxSummary(state);
  const decisionBadge = mailbox.openDecisions > 0 ? `<span class="action-badge">${formatNumber(mailbox.openDecisions)} 결재</span>` : "";
  const continueButton = `<button class="button button-primary" data-action="continue" type="button" ${isAdvancing ? "disabled" : ""}>${isAdvancing ? "계산 중" : "계속 ▶"}${decisionBadge}</button>`;
  if (state?.phase === "regular" && nextGame?.ok) {
    const matchup = `${nextGame.awayShortName ?? "AWAY"} @ ${nextGame.homeShortName ?? "HOME"}`;
    return `
      ${continueButton}
      <button class="button button-primary" data-action="watch-next-game" type="button" ${isAdvancing ? "disabled" : ""}>경기 시작</button>
      <button class="button button-soft" data-action="simulate-next-game" type="button" ${isAdvancing ? "disabled" : ""}>스킵</button>
      <button class="button button-soft" data-action="export-save" type="button">저장</button>
      <small class="topbar-action-context">${escapeHtml(nextGame.date)} · ${escapeHtml(matchup)} · 새 편지 ${formatNumber(mailbox.unread)}</small>
    `;
  }

  if (state?.phase === "regular") {
    return `
      ${continueButton}
      <button class="button button-soft" data-action="next-day" type="button" ${isAdvancing ? "disabled" : ""}>오늘 하루만</button>
      <button class="button button-soft" data-action="export-save" type="button">저장</button>
      <small class="topbar-action-context">${escapeHtml(nextGame?.message ?? "다음 경기 일정 계산 대기")} · 새 편지 ${formatNumber(mailbox.unread)}</small>
    `;
  }

  return `
    ${continueButton}
    <button class="button button-soft" data-action="next-day" type="button" ${isAdvancing ? "disabled" : ""}>오늘 하루만</button>
    <button class="button button-soft" data-action="export-save" type="button">저장</button>
  `;
}

function renderSimulationProgressPanel(state) {
  const progress = state?.ui?.simulationProgress;
  if (!progress) return "";

  const stepIndex = Number(progress.stepIndex ?? -1);
  const steps = Array.isArray(progress.steps) && progress.steps.length ? progress.steps : SIMULATION_STEPS;
  const percent = Math.max(0, Math.min(100, Number(progress.percent ?? 0)));
  const changes = Array.isArray(progress.changes) ? progress.changes : [];

  return `
    <section class="simulation-progress-panel is-${escapeAttribute(progress.status ?? "running")}" data-simulation-progress aria-live="polite">
      <div class="simulation-progress-head">
        <div>
          <span class="mini-label">${escapeHtml(progress.kicker ?? "시뮬레이션")}</span>
          <h2>${escapeHtml(progress.title ?? "날짜 계산 중")}</h2>
        </div>
        <strong>${formatNumber(Math.round(percent))}%</strong>
      </div>
      <div class="simulation-progress-track" style="--progress: ${percent}%"><i></i></div>
      <ol class="simulation-progress-steps">
        ${steps.map((label, index) => `
          <li class="${index < stepIndex || progress.status === "complete" ? "is-done" : index === stepIndex ? "is-active" : ""}">
            <span>${formatNumber(index + 1)}</span>
            <b>${escapeHtml(label)}</b>
          </li>
        `).join("")}
      </ol>
      ${changes.length ? `
        <ul class="simulation-change-list">
          ${changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}
        </ul>
      ` : `
        <p class="simulation-progress-note">${escapeHtml(progress.note ?? "엔진이 오늘의 컨디션, 일정, 뉴스함을 순서대로 계산하고 있습니다.")}</p>
      `}
    </section>
  `;
}

function renderMetricGrid(state, selectedTeam, selectedRank, injuries) {
  return `
    <section class="metric-grid" aria-label="Selected team metrics">
      ${renderMetricCard("성적", renderRecord(selectedTeam), `승률 ${formatPct(winningPct(selectedTeam))}`)}
      ${renderMetricCard("순위", selectedRank ? `${selectedRank}위` : "-", `${formatNumber(state.teams.length)}개 구단`)}
      ${renderMetricCard("예산", `${formatMoney(selectedTeam?.payroll)} / ${formatMoney(selectedTeam?.budget)}`, "연봉 / 운영 여력")}
      ${renderMetricCard("관중", formatAttendance(selectedTeam), "홈 평균 관중")}
      ${renderMetricCard("부상", `${injuries.length}명`, injuries[0] ? `${escapeHtml(injuries[0].name)} 관리 필요` : "건강한 클럽하우스")}
    </section>
  `;
}

function renderTodayDeskPanel(state, selectedTeam, selectedRank) {
  const weatherLabel = state.weather?.label ?? "날씨 확인 중";
  const temperature = formatTemperature(state.weather?.temperature);
  const rankLabel = selectedRank ? `${formatNumber(selectedRank)}위` : "순위 집계 전";
  const recordLabel = renderRecord(selectedTeam);

  return `
    <section class="today-desk-panel is-compact" data-today-desk aria-label="오늘의 데스크">
      <div class="today-desk-main">
        <span class="mini-label">오늘의 데스크</span>
        <h2>${escapeHtml(formatDeskDate(state.currentDate))}</h2>
        <p>${escapeHtml(weatherLabel)} · ${temperature} · ${escapeHtml(rankLabel)} · ${escapeHtml(recordLabel)}</p>
      </div>
      <div class="today-desk-cards">
        <article>
          <span>날씨</span>
          <strong>${escapeHtml(weatherLabel)}</strong>
          <small>${temperature}</small>
        </article>
        <article>
          <span>성적</span>
          <strong>${escapeHtml(recordLabel)}</strong>
          <small>승률 ${formatPct(winningPct(selectedTeam))}</small>
        </article>
        <article>
          <span>순위</span>
          <strong>${escapeHtml(rankLabel)}</strong>
          <small>${formatNumber(state.teams.length)}개 구단</small>
        </article>
      </div>
    </section>
  `;
}

function formatDeskDate(dateKey) {
  const date = parseUiDate(dateKey);
  return `${String(dateKey ?? "").replaceAll("-", ".")} ${KOREAN_WEEKDAYS[date.getUTCDay()] ?? ""}`;
}

function renderDeskResult(game, selectedTeam) {
  if (!game || !selectedTeam) return "최근 경기 없음";
  const home = String(game.homeTeamId) === String(selectedTeam.id);
  const teamScore = home ? game.homeScore : game.awayScore;
  const opponentScore = home ? game.awayScore : game.homeScore;
  const opponent = home ? game.away : game.home;
  const result = safeUiNumber(teamScore) > safeUiNumber(opponentScore) ? "승" : safeUiNumber(teamScore) < safeUiNumber(opponentScore) ? "패" : "무";
  return `${opponent}전 ${teamScore}-${opponentScore} ${result}`;
}

function safeUiNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function renderStandingsPanel(standings, selectedTeam) {
  return `
    <article class="panel standings-panel" id="standings">
      <div class="panel-head">
        <div>
          <span class="mini-label">KBO 리그</span>
          <h2>순위표</h2>
        </div>
        <span class="pill">${formatNumber(standings.length)}팀</span>
      </div>
      <div class="table-wrap">
        <table class="standings-table">
          <thead>
            <tr>
              <th>Rk</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
              <th>Pct</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            ${standings.length ? standings.map((team, index) => renderStandingRow(team, index, selectedTeam)).join("") : renderEmptyTableRow("아직 등록된 구단이 없습니다.", 7)}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderGamesPanel(state) {
  return `
    <article class="panel games-panel">
      <div class="panel-head">
        <div>
          <span class="mini-label">스코어보드</span>
          <h2>오늘 / 최근 경기</h2>
        </div>
        <span class="pill">${formatNumber(state.lastGames?.length ?? 0)}경기</span>
      </div>
      <div class="game-list">
        ${renderGames(state)}
      </div>
    </article>
  `;
}

function renderRecordBookPanel(state, recordBook) {
  const includeUnqualified = Boolean(state?.ui?.recordBookIncludeUnqualified);
  return `
    <section class="content-grid record-book-grid" aria-label="기록실">
      <article class="panel record-leaders-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">${formatNumber(recordBook?.season)} 시즌</span>
            <h2>리그 리더보드</h2>
          </div>
          <button class="button ${includeUnqualified ? "button-primary" : "button-soft"}" data-action="toggle-record-book-qualification" type="button">
            ${includeUnqualified ? "전체 기록" : "규정 기록"}
          </button>
        </div>
        <div class="record-board-grid">
          ${renderRecordBoardGroup("타자", recordBook?.leaders?.batting, ["avg", "homeRuns", "rbi", "stolenBases", "ops"])}
          ${renderRecordBoardGroup("투수", recordBook?.leaders?.pitching, ["era", "wins", "saves", "holds", "strikeouts"])}
        </div>
      </article>
      ${renderTeamRecordPanel(recordBook?.teamRecords ?? [])}
      ${renderLeagueHistoryPanel(recordBook?.leagueHistory ?? [])}
    </section>
  `;
}

function renderRecordBoardGroup(title, boards = {}, keys = []) {
  return `
    <section class="record-board-group">
      <h3>${escapeHtml(title)}</h3>
      <div class="record-board-list">
        ${keys.map((key) => renderRecordBoard(recordBoardLabel(key), boards?.[key] ?? [])).join("")}
      </div>
    </section>
  `;
}

function renderRecordBoard(label, entries) {
  return `
    <article class="record-board">
      <div class="record-board-head">
        <strong>${escapeHtml(label)}</strong>
        <span>${formatNumber(entries.length)}명</span>
      </div>
      <ol class="player-list compact stat-list">
        ${entries.length ? entries.map(renderRecordLeader).join("") : renderEmptyListItem("기록 대기 중")}
      </ol>
    </article>
  `;
}

function renderRecordLeader(entry, index) {
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(entry.playerId ?? "")}" data-team-id="${escapeAttribute(entry.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${index + 1}</span>
      <span>
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(entry.teamShortName ?? entry.teamName ?? "")} · ${escapeHtml(entry.position ?? "")} · ${escapeHtml(recordQualificationText(entry))}</small>
      </span>
      <b>${escapeHtml(formatRecordLeaderValue(entry))}</b>
    </li>
  `;
}

function renderTeamRecordPanel(records) {
  return `
    <article class="panel team-record-panel">
      <div class="panel-head">
        <div>
          <span class="mini-label">팀 기록</span>
          <h2>타율 / ERA / 득실</h2>
        </div>
        <span class="pill">${formatNumber(records.length)}팀</span>
      </div>
      <div class="table-wrap">
        <table class="standings-table record-table">
          <thead>
            <tr>
              <th>Rk</th>
              <th>Team</th>
              <th>AVG</th>
              <th>OPS</th>
              <th>HR</th>
              <th>ERA</th>
              <th>RF</th>
              <th>RA</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            ${records.length ? records.map(renderTeamRecordRow).join("") : renderEmptyTableRow("팀 기록 대기 중", 9)}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderTeamRecordRow(record) {
  return `
    <tr>
      <td>${formatNumber(record.rank)}</td>
      <td>
        <span class="team-cell">
          ${renderTeamLogo(record, "team-logo table-logo")}
          <span>
            <strong>${escapeHtml(record.shortName ?? record.name)}</strong>
            <small>${formatNumber(record.wins)}승 ${formatNumber(record.losses)}패 ${formatNumber(record.ties)}무</small>
          </span>
        </span>
      </td>
      <td>${formatRateStat(record.battingAverage)}</td>
      <td>${formatRateStat(record.ops)}</td>
      <td>${formatNumber(record.homeRuns)}</td>
      <td>${formatEraValue(record.era)}</td>
      <td>${formatNumber(record.runsFor)}</td>
      <td>${formatNumber(record.runsAgainst)}</td>
      <td>${record.runDiff > 0 ? "+" : ""}${formatNumber(record.runDiff)}</td>
    </tr>
  `;
}

function renderLeagueHistoryPanel(history) {
  return `
    <article class="panel league-history-panel">
      <div class="panel-head">
        <div>
          <span class="mini-label">역대 시즌</span>
          <h2>우승 / 시상 / 리더</h2>
        </div>
        <span class="pill">${formatNumber(history.length)}년</span>
      </div>
      <div class="table-wrap">
        <table class="standings-table record-table history-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Champion</th>
              <th>MVP</th>
              <th>ROY</th>
              <th>HR</th>
              <th>ERA</th>
            </tr>
          </thead>
          <tbody>
            ${history.length ? history.map(renderLeagueHistoryRow).join("") : renderEmptyTableRow("완료된 시즌이 아직 없습니다.", 6)}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderLeagueHistoryRow(entry) {
  const mvp = entry.awards?.regularSeason?.mvp;
  const rookie = entry.awards?.regularSeason?.rookieOfYear;
  const homer = entry.leadersIncludingUnqualified?.batting?.homeRuns?.[0] ?? entry.leaders?.batting?.homeRuns?.[0];
  const eraLeader = entry.leaders?.pitching?.era?.[0] ?? entry.leadersIncludingUnqualified?.pitching?.era?.[0];
  return `
    <tr>
      <td>${formatNumber(entry.season ?? entry.year)}</td>
      <td>${escapeHtml(entry.championName || "-")}</td>
      <td>${escapeHtml(mvp?.name ?? "-")}</td>
      <td>${escapeHtml(rookie?.name ?? "-")}</td>
      <td>${homer ? `${escapeHtml(homer.name)} ${formatNumber(homer.value)}` : "-"}</td>
      <td>${eraLeader ? `${escapeHtml(eraLeader.name)} ${formatEraValue(eraLeader.value)}` : "-"}</td>
    </tr>
  `;
}

function renderNewsLogPanel(state) {
  return `
    <article class="panel news-panel" id="news">
      <div class="panel-head">
        <div>
          <span class="mini-label">프런트 소식</span>
          <h2>최근 로그 / 뉴스</h2>
        </div>
        <span class="pill">${formatNumber(state.logs?.length ?? 0)}개</span>
      </div>
      <div class="news-list">
        ${renderLogs(state)}
      </div>
    </article>
  `;
}

function renderFrontOfficeRosterPanels(frontOffice) {
  const { rosterSummary, contractSummary, depthNeeds, prospectWatch } = frontOffice;
  return `
    <section class="front-office-grid roster-tab-grid">
      <article class="panel front-office-panel roster-summary-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">프런트</span>
            <h2>요약</h2>
          </div>
          <span class="pill">${formatNumber(rosterSummary.totalPlayers)}명</span>
        </div>
        <ol class="front-office-list player-list compact">
          ${renderSummaryTopPlayer(rosterSummary.topPlayers[0])}
          ${renderSummaryTopPlayer(rosterSummary.topPlayers[1])}
          ${renderSummaryTopPlayer(rosterSummary.topPlayers[2])}
        </ol>
      </article>
      <article class="panel front-office-panel contract-panel" id="contracts">
        <div class="panel-head">
          <div>
            <span class="mini-label">계약</span>
            <h2>연봉/FA</h2>
          </div>
          <span class="pill">${formatKRWShort(contractSummary.totalPayrollKRW)}</span>
        </div>
        ${renderContractSnapshot(contractSummary)}
      </article>
      <article class="panel front-office-panel depth-needs-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">뎁스</span>
            <h2>포지션 필요</h2>
          </div>
          <span class="pill">${formatNumber(depthNeeds.needs.length)}건</span>
        </div>
        <ol class="front-office-list">
          ${renderDepthNeedList(depthNeeds.needs.length ? depthNeeds.needs : depthNeeds.groups.slice(0, 4))}
        </ol>
      </article>
      <article class="panel front-office-panel prospect-watch-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">육성</span>
            <h2>콜업 후보</h2>
          </div>
          <span class="pill">${formatNumber(prospectWatch.candidateCount)}명</span>
        </div>
        ${renderOfficePlayerList(prospectWatch.players, "관찰할 유망주가 없습니다.")}
      </article>
    </section>
  `;
}

function renderStateFoundationPanel(state) {
  const indexSummary = state?.stateIndexSummary ?? {};
  const staffCount = Array.isArray(state?.staff) ? state.staff.length : 0;
  const ledgerCount = Array.isArray(state?.financeLedger) ? state.financeLedger.length : 0;
  const policyCount = Array.isArray(state?.leaguePoliciesByDate) ? state.leaguePoliciesByDate.length : 0;
  const attributeCount = Array.isArray(state?.attributeDefinitions) ? state.attributeDefinitions.length : 0;

  return `
    <article class="panel foundation-panel">
      <div class="panel-head">
        <div>
          <span class="mini-label">시스템 원장</span>
          <h2>장기 운영 기반</h2>
        </div>
        <span class="pill">schema ${formatNumber(state?.schemaVersion ?? 1)}</span>
      </div>
      <ol class="player-list compact front-office-list foundation-grid">
        ${renderOfficeFact("선수 인덱스", `${formatNumber(indexSummary.players ?? 0)}명`, "playersById / rosterAssignments", "원장")}
        ${renderOfficeFact("계약 원장", `${formatNumber(indexSummary.contracts ?? 0)}건`, "contractsByPlayerId", "계약")}
        ${renderOfficeFact("재정 장부", `${formatNumber(ledgerCount)}건`, "payroll, cash, market event", "원화")}
        ${renderOfficeFact("능력치 registry", `${formatNumber(attributeCount)}개`, "47개 활성 + 확장 슬롯", "60")}
        ${renderOfficeFact("스태프", `${formatNumber(staffCount)}명`, "감독·수석·타격·투수·스카우트", "v1")}
        ${renderOfficeFact("KBO 정책", `${formatNumber(policyCount)}건`, "회의록/규정 효력일", "공문")}
      </ol>
    </article>
  `;
}

function normalizeActiveTab(value) {
  const id = String(value ?? "clubhouse");
  return DASHBOARD_TABS.some((tab) => tab.id === id) ? id : "clubhouse";
}

function renderOperationsBar(state) {
  const isAdvancing = Boolean(state?.ui?.isAdvancing);
  return `
    <section class="operations-bar" aria-label="운영 메뉴">
      <div class="operation-group">
        <span>진행</span>
        <button class="button button-primary" data-action="continue" ${isAdvancing ? "disabled" : ""}>${isAdvancing ? "계산 중" : "계속 ▶"}</button>
        <button class="button button-primary" data-action="next-day" ${isAdvancing ? "disabled" : ""}>${isAdvancing ? "계산 중" : "다음 날"}</button>
        <button class="button button-soft" data-action="week" ${isAdvancing ? "disabled" : ""}>빠른 주간</button>
      </div>
      <div class="operation-group">
        <span>시즌 업무</span>
        <button class="button button-soft" data-action="postseason">가을야구</button>
        <button class="button button-soft" data-action="draft">드래프트</button>
        <button class="button button-soft" data-action="secondary-draft">2차 드래프트</button>
        <button class="button button-soft" data-action="free-agency">FA시장</button>
      </div>
      <div class="operation-group">
        <span>관리</span>
        <button class="button button-soft" data-action="auto-offseason">자동 스토브</button>
        <button class="button button-soft" data-action="next-season">다음 시즌</button>
        <button class="button button-soft" data-action="export-save">저장</button>
        <button class="button button-soft" data-action="import-save">불러오기</button>
      </div>
    </section>
  `;
}

function renderContinueSettingsPanel(state) {
  const stops = state?.settings?.continueStops ?? {};
  const options = [
    ["myGameDay", "내 경기일"],
    ["openDecision", "미처리 결재"],
    ["importantMail", "중요 메일"]
  ];
  return `
    <article class="panel continue-settings-panel">
      <div class="panel-head">
        <div>
          <span class="mini-label">Continue</span>
          <h2>멈춤 규칙</h2>
        </div>
        <span class="pill">FM loop</span>
      </div>
      <div class="toggle-row">
        ${options.map(([key, label]) => `
          <label class="toggle-pill">
            <input type="checkbox" data-action="toggle-continue-stop" data-stop-key="${escapeAttribute(key)}" ${stops[key] !== false ? "checked" : ""}>
            <span>${escapeHtml(label)}</span>
          </label>
        `).join("")}
      </div>
    </article>
  `;
}

function renderLineupManagerPanel(state, selectedTeam, roster, lineup, pitchingSnapshot) {
  const eligibleHitters = getLineupEligibleHitters(roster);
  const pitcherOptions = getPitchingEligiblePitchers(roster);
  const selectedIds = buildLineupSelectionIds(selectedTeam, lineup, eligibleHitters);
  const pitchingSelection = buildPitchingPlanSelection(selectedTeam, pitchingSnapshot, pitcherOptions);
  const selectedLineup = selectedIds
    .map((id) => eligibleHitters.find((player) => String(player.id) === String(id)))
    .filter(Boolean);
  const bench = eligibleHitters.filter((player) => !selectedIds.includes(String(player.id))).slice(0, 6);
  const summary = summarizeLineup(selectedLineup);
  const manual = isManualLineupActive(selectedTeam, lineup);
  const pitchingManual = selectedTeam?.pitchingPlan?.mode === "manual";
  const teamName = getTeamShortName(selectedTeam) ?? "Team";

  return `
    <article class="panel lineup-manager-panel" id="lineup" data-lineup-manager>
      <div class="panel-head lineup-manager-head">
        <div>
          <span class="mini-label">더그아웃 노트</span>
          <h2>${escapeHtml(teamName)} 매치데이 라인업 보드</h2>
        </div>
        <span class="pill">${manual ? "수동 저장" : "자동 추천"}</span>
      </div>
      <form class="lineup-form" data-lineup-form>
        <div class="lineup-control-grid">
          <section class="lineup-order-board" aria-label="타순 편성">
            <div class="lineup-section-head">
              <h3>타순 카드</h3>
              <small>${escapeHtml(selectedTeam?.lineupCard?.updatedAt ? `${selectedTeam.lineupCard.updatedAt} 저장` : "자동 추천 기준")}</small>
            </div>
            <ol class="lineup-slot-list">
              ${Array.from({ length: 9 }, (_, index) => renderLineupSlot(index, selectedIds[index], eligibleHitters)).join("")}
            </ol>
          </section>

          <aside class="lineup-side-stack" aria-label="라인업 운영 리포트">
            <section class="lineup-command-board" aria-label="라인업 밸런스">
              <div class="lineup-balance-grid">
                ${renderLineupBalanceMetric("AVG OVR", formatNumber(summary.avgOvr), "타선 평균")}
                ${renderLineupBalanceMetric("좌/스위치", `${formatNumber(summary.leftBats)}명`, "상대 우완 대응")}
                ${renderLineupBalanceMetric("스피드", formatNumber(summary.speed), "주루 압박")}
                ${renderLineupBalanceMetric("수비", formatNumber(summary.defense), "센터라인 포함")}
              </div>
              <div class="lineup-risk-card ${summary.fatigueRisk > 0 ? "is-warning" : ""}">
                <span>컨디션 리스크</span>
                <strong>${summary.fatigueRisk > 0 ? `${formatNumber(summary.fatigueRisk)}명 관리` : "정상"}</strong>
                <small>${escapeHtml(summary.fatigueRisk > 0 ? "피로/부상 선수를 타순에서 확인하세요." : "선발 출전 체력 기준 양호")}</small>
              </div>
            </section>

            <section class="lineup-bench-board" aria-label="벤치 후보">
              <div class="lineup-section-head">
                <h3>벤치 후보</h3>
                <small>${formatNumber(bench.length)}명</small>
              </div>
              <ol class="player-list compact">
                ${bench.length ? bench.map(renderBenchCandidate).join("") : renderEmptyListItem("가용 벤치가 부족합니다.")}
              </ol>
            </section>

            <section class="lineup-pitching-board" aria-label="투수 운용">
              <div class="lineup-section-head">
                <h3>투수 운용</h3>
                <small>${escapeHtml(pitchingManual ? `${selectedTeam?.pitchingPlan?.updatedAt ?? state.currentDate} 저장` : "자동 추천 기준")}</small>
              </div>
              <div class="pitching-plan-form">
                <div>
                  <h4>선발 로테이션</h4>
                  <ol class="pitching-slot-list">
                    ${Array.from({ length: 5 }, (_, index) => renderPitchingRotationSlot(index, pitchingSelection.rotationIds[index], pitcherOptions)).join("")}
                  </ol>
                </div>
                <div>
                  <h4>불펜 역할</h4>
                  <div class="pitching-role-grid">
                    ${renderPitchingRolePicker("closer", "마무리", pitchingSelection.closerId, pitcherOptions)}
                    ${renderPitchingRolePicker("setup", "셋업 1", pitchingSelection.setupIds[0], pitcherOptions)}
                    ${renderPitchingRolePicker("setup", "셋업 2", pitchingSelection.setupIds[1], pitcherOptions)}
                    ${renderPitchingRolePicker("longRelief", "롱릴리프", pitchingSelection.longReliefIds[0], pitcherOptions)}
                  </div>
                </div>
              </div>
              <div class="lineup-pitching-actions">
                <button class="button button-primary" data-action="save-pitching-plan" type="button">투수 운용 저장</button>
                <button class="button button-soft" data-action="auto-pitching-plan" type="button">투수 자동 추천</button>
              </div>
            </section>
          </aside>
        </div>
        <div class="lineup-actions">
          <button class="button button-primary" type="submit">라인업 저장</button>
          <button class="button button-soft" data-action="auto-lineup" type="button">자동 추천</button>
          <small>다음 경기 적용 대기</small>
        </div>
      </form>
    </article>
  `;
}

function renderLineupSlot(index, selectedId, eligibleHitters) {
  const player = eligibleHitters.find((entry) => String(entry.id) === String(selectedId));
  const order = index + 1;
  const group = lineupOrderGroup(order);
  return `
      <li class="lineup-slot is-${escapeAttribute(group.key)}">
      <span class="lineup-order">${formatNumber(order)}</span>
      <label class="lineup-player-picker">
        <span>${escapeHtml(group.label)}</span>
        <select data-lineup-slot name="lineup-${order}" aria-label="${formatNumber(order)}번 타자">
          ${eligibleHitters.map((candidate) => `
            <option value="${escapeAttribute(candidate.id)}" ${String(candidate.id) === String(selectedId) ? "selected" : ""}>
              ${escapeHtml(candidate.name)} · ${escapeHtml(candidate.position ?? "-")} · OVR ${formatNumber(candidate.ovr)}
            </option>
          `).join("")}
        </select>
      </label>
      <div class="lineup-slot-meta">
        <strong>${escapeHtml(player?.name ?? "선수 선택")}</strong>
        <small>${escapeHtml(player ? `${player.position ?? "-"} · ${formatBatsThrows(player)} · CON ${formatNumber(player.contact ?? player.contactR)} · POW ${formatNumber(player.power ?? player.powerR)}` : "가용 타자를 선택하세요.")}</small>
      </div>
      <div class="lineup-bars" aria-hidden="true">
        ${renderMiniLineupBar("타격", lineupBatValue(player))}
        ${renderMiniLineupBar("주루", player?.speed)}
        ${renderMiniLineupBar("수비", player?.defense)}
      </div>
    </li>
  `;
}

function renderPitchingRotationSlot(index, selectedId, pitcherOptions) {
  const player = pitcherOptions.find((entry) => String(entry.id) === String(selectedId));
  const order = index + 1;
  const label = order === 1 ? "1선발" : `${formatNumber(order)}선발`;
  return `
    <li class="pitching-slot">
      <span class="lineup-order">${formatNumber(order)}</span>
      <label class="pitching-player-picker">
        <span>${escapeHtml(label)}</span>
        <select data-pitching-rotation-slot name="pitching-rotation-${order}" aria-label="${escapeAttribute(label)}">
          ${pitcherOptions.map((candidate) => renderPitchingOption(candidate, selectedId)).join("")}
        </select>
      </label>
      <small>${escapeHtml(player ? `STA ${formatNumber(player.stamina)} · ARM ${formatNumber(player.armFreshness)} · 피로 ${formatNumber(player.fatigue)}` : "가용 투수를 선택하세요.")}</small>
    </li>
  `;
}

function renderPitchingRolePicker(role, label, selectedId, pitcherOptions) {
  const player = pitcherOptions.find((entry) => String(entry.id) === String(selectedId));
  return `
    <label class="pitching-role-picker">
      <span>${escapeHtml(label)}</span>
      <select data-pitching-role="${escapeAttribute(role)}" name="pitching-${escapeAttribute(role)}-${escapeAttribute(label)}" aria-label="${escapeAttribute(label)}">
        ${pitcherOptions.map((candidate) => renderPitchingOption(candidate, selectedId)).join("")}
      </select>
      <small>${escapeHtml(player ? `${player.name} · OVR ${formatNumber(player.ovr)} · 피로 ${formatNumber(player.fatigue)}` : "선택 대기")}</small>
    </label>
  `;
}

function renderPitchingOption(candidate, selectedId) {
  return `
    <option value="${escapeAttribute(candidate.id)}" ${String(candidate.id) === String(selectedId) ? "selected" : ""}>
      ${escapeHtml(candidate.name)} · OVR ${formatNumber(candidate.ovr)} · STA ${formatNumber(candidate.stamina)}
    </option>
  `;
}

function renderMiniLineupBar(label, value) {
  const score = Math.max(0, Math.min(20, Number(value ?? 0)));
  const percent = Math.max(4, Math.round(score / 20 * 100));
  return `
    <span class="lineup-mini-bar">
      <b>${escapeHtml(label)}</b>
      <i style="--meter: ${percent}%"></i>
    </span>
  `;
}

function renderLineupBalanceMetric(label, value, detail) {
  return `
    <div class="lineup-balance-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function renderBenchCandidate(player) {
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(player.id ?? "")}" data-team-id="${escapeAttribute(player.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${escapeHtml(player.position ?? "-")}</span>
      <span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${formatBatsThrows(player)} · OVR ${formatNumber(player.ovr)} · 피로 ${formatNumber(player.fatigue)}</small>
      </span>
      <b>${formatNumber(lineupUiScore(player))}</b>
    </li>
  `;
}

function getLineupEligibleHitters(roster) {
  const hitters = (roster ?? []).filter((player) => player.role === "hitter");
  const active = hitters.filter((player) =>
    (player.status === "active" || player.status === "registered") &&
    Number(player.injuredDays ?? 0) <= 0 &&
    player.militaryStatus?.availability !== "unavailable"
  );
  const pool = active.length >= 9 ? active : hitters;
  return [...pool].sort((a, b) => lineupUiScore(b) - lineupUiScore(a) || sortByOvr(a, b));
}

function getPitchingEligiblePitchers(roster) {
  const pitchers = (roster ?? []).filter((player) =>
    isPitcher(player) &&
    Number(player.injuredDays ?? 0) <= 0 &&
    player.militaryStatus?.availability !== "unavailable"
  );
  const active = pitchers.filter((player) => player.status === "active");
  const pool = active.length >= 12 ? active : pitchers;
  return [...pool].sort((a, b) => pitchingUiScore(b) - pitchingUiScore(a) || sortByOvr(a, b));
}

function buildLineupSelectionIds(team, lineup, eligibleHitters) {
  const eligibleIds = new Set(eligibleHitters.map((player) => String(player.id)));
  const manualIds = Array.isArray(team?.lineupCard?.playerIds) ? team.lineupCard.playerIds.map(String) : [];
  const manualValid = manualIds.length >= 9 && manualIds.slice(0, 9).every((id, index, ids) => eligibleIds.has(id) && ids.indexOf(id) === index);
  const source = manualValid ? manualIds : lineup.map((player) => String(player.id));
  const result = [];
  for (const id of source) {
    if (eligibleIds.has(String(id)) && !result.includes(String(id))) result.push(String(id));
    if (result.length === 9) break;
  }
  for (const player of eligibleHitters) {
    if (!result.includes(String(player.id))) result.push(String(player.id));
    if (result.length === 9) break;
  }
  return result.slice(0, 9);
}

function buildPitchingPlanSelection(team, pitchingSnapshot, pitcherOptions) {
  const eligibleIds = new Set((pitcherOptions ?? []).map((player) => String(player.id)));
  const manualPlan = team?.pitchingPlan?.mode === "manual" ? team.pitchingPlan : null;
  const rotationIds = [];
  const addRotationId = (id) => {
    const value = String(id ?? "");
    if (!value || !eligibleIds.has(value) || rotationIds.includes(value)) return;
    rotationIds.push(value);
  };

  for (const id of uniqueSelectionIds(manualPlan?.rotationOrder ?? manualPlan?.rotationIds ?? [])) addRotationId(id);
  for (const entry of pitchingSnapshot?.rotation ?? []) addRotationId(entry.id);
  for (const player of pitcherOptions ?? []) addRotationId(player.id);

  const assigned = new Set(rotationIds.slice(0, 5));
  const addRoleId = (target, id, limit) => {
    const value = String(id ?? "");
    if (!value || !eligibleIds.has(value) || assigned.has(value) || target.includes(value)) return;
    target.push(value);
    assigned.add(value);
    return target.length >= limit;
  };
  const fallbackIds = (pitcherOptions ?? []).map((player) => String(player.id));
  let closerId = "";
  const closerSources = [
    manualPlan?.closerId,
    (pitchingSnapshot?.bullpen ?? []).find((entry) => entry.role === "CL")?.id,
    ...fallbackIds
  ];

  for (const id of closerSources) {
    const value = String(id ?? "");
    if (!value || !eligibleIds.has(value) || assigned.has(value)) continue;
    closerId = value;
    assigned.add(value);
    break;
  }

  const setupIds = [];
  for (const id of [
    ...uniqueSelectionIds(manualPlan?.setupIds ?? []),
    ...(pitchingSnapshot?.bullpen ?? []).filter((entry) => entry.role === "SU").map((entry) => entry.id),
    ...fallbackIds
  ]) {
    if (addRoleId(setupIds, id, 2)) break;
  }

  const longReliefIds = [];
  for (const id of [
    ...uniqueSelectionIds(manualPlan?.longReliefIds ?? manualPlan?.longReliefId ?? []),
    ...(pitchingSnapshot?.bullpen ?? []).filter((entry) => entry.role === "LR").map((entry) => entry.id),
    ...fallbackIds
  ]) {
    if (addRoleId(longReliefIds, id, 1)) break;
  }

  return {
    rotationIds: rotationIds.slice(0, 5),
    closerId,
    setupIds,
    longReliefIds
  };
}

function uniqueSelectionIds(values) {
  const source = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const ids = [];
  for (const value of source) {
    const id = String(value ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function summarizeLineup(players) {
  const count = Math.max(1, players.length);
  const avg = (selector) => Math.round(players.reduce((total, player) => total + Number(selector(player) ?? 0), 0) / count);
  return {
    avgOvr: avg((player) => player.ovr),
    leftBats: players.filter((player) => ["L", "S"].includes(String(player.bats ?? "").toUpperCase())).length,
    speed: avg((player) => player.speed),
    defense: avg((player) => player.defense),
    fatigueRisk: players.filter((player) => Number(player.fatigue ?? 0) >= 42 || Number(player.injuredDays ?? 0) > 0).length
  };
}

function lineupOrderGroup(order) {
  if (order <= 2) return { key: "table", label: "테이블세터" };
  if (order <= 5) return { key: "core", label: "클린업" };
  if (order <= 7) return { key: "bridge", label: "연결" };
  return { key: "bottom", label: "하위" };
}

function lineupBatValue(player) {
  if (!player) return 0;
  return Math.round((Number(player.contact ?? player.contactR ?? 0) * 0.45) + (Number(player.power ?? player.powerR ?? 0) * 0.35) + (Number(player.eye ?? 0) * 0.2));
}

function lineupUiScore(player) {
  return Math.round(
    Number(player.ovr ?? 0) * 0.66 +
    lineupBatValue(player) * 2.1 +
    Number(player.speed ?? 0) * 0.7 +
    Number(player.defense ?? 0) * 0.36 -
    Number(player.fatigue ?? 0) * 0.12
  );
}

function pitchingUiScore(player) {
  return Math.round(
    Number(player.ovr ?? 0) * 1.05 +
    Number(player.stuff ?? 0) * 0.55 +
    Number(player.control ?? 0) * 0.48 +
    Number(player.stamina ?? 0) * 0.38 +
    Number(player.armFreshness ?? 80) * 0.16 -
    Number(player.fatigue ?? 0) * 0.14
  );
}

function isManualLineupActive(team, lineup) {
  const ids = Array.isArray(team?.lineupCard?.playerIds) ? team.lineupCard.playerIds.map(String) : [];
  if (ids.length < 9 || lineup.length < 9) return false;
  return ids.slice(0, 9).every((id, index) => String(lineup[index]?.id ?? "") === id);
}

function renderManagerBriefingPanel(state, selectedTeam, manager, managerJob = null) {
  const answers = Array.isArray(manager.interviewAnswers) ? manager.interviewAnswers : [];
  const goal = managerJob?.goalLabel ?? answers.find((answer) => answer.id === "goal")?.label ?? "매 경기 준비";
  const front = answers.find((answer) => answer.id === "front")?.label ?? "균형 있는 운영";
  const message = answers.find((answer) => answer.id === "message")?.label ?? "선수단 신뢰";
  const trust = managerJob ? `신뢰도 ${formatNumber(managerJob.trust)} · ${managerJob.trustLabel}` : `${formatNumber(manager.age)}세 · ${managerStyleLabel(manager.style)}`;

  return `
    <section class="manager-briefing-panel" aria-label="감독 브리핑">
      <div class="manager-briefing-main">
        <span class="mini-label">감독실</span>
        <h2>${escapeHtml(manager.name)} 감독 취임 브리핑</h2>
        <p>${escapeHtml(getTeamShortName(selectedTeam) ?? "우리 팀")} · ${escapeHtml(trust)}</p>
      </div>
      <div class="manager-briefing-quotes">
        <span>${escapeHtml(goal)}</span>
        <span>${escapeHtml(message)}</span>
        <span>${escapeHtml(managerJob?.philosophyLabel ?? front)}</span>
      </div>
      <small>${escapeHtml(manager.appointedAt ?? state.currentDate ?? "")} 취임</small>
    </section>
  `;
}

function renderClubPressurePanel(managerJob, dynamics) {
  if (!managerJob) return "";
  const promises = dynamics?.promises ?? [];
  const issues = dynamics?.issues ?? [];
  const activePromise = promises.find((promise) => promise.status === "active");
  const openIssue = issues.find((issue) => ["open", "meeting-requested", "promise-made"].includes(issue.status));
  const trust = Math.max(0, Math.min(100, Number(managerJob.trust ?? 0)));
  return `
    <section class="panel club-pressure-panel is-${escapeAttribute(managerJob.trustBand ?? "stable")}" aria-label="구단주 압박과 약속">
      <div class="panel-head">
        <div>
          <span class="mini-label">구단주/클럽하우스</span>
          <h2>감독 압박</h2>
        </div>
        <span class="pill">${escapeHtml(managerJob.trustLabel ?? "보통")}</span>
      </div>
      <div class="pressure-meter" style="--trust:${trust}%">
        <span></span>
      </div>
      <div class="pressure-summary">
        <strong>${escapeHtml(managerJob.goalLabel ?? "시즌 목표")}</strong>
        <small>${escapeHtml(managerJob.record ?? "-")} · 현재 ${formatNumber(managerJob.rank)}위 · 신뢰도 ${formatNumber(managerJob.trust)}</small>
      </div>
      <div class="philosophy-switch" role="group" aria-label="운영 철학">
        ${["balanced", "winNow", "rebuild"].map((id) => `
          <button class="mini-action ${managerJob.philosophy === id ? "is-active" : ""}" data-action="commit-club-philosophy" data-philosophy="${escapeAttribute(id)}" type="button">
            ${escapeHtml(clubPhilosophyLabel(id))}
          </button>
        `).join("")}
      </div>
      <ol class="player-list compact front-office-list pressure-list">
        <li>
          <span class="order">${formatNumber(dynamics?.summary?.openIssues ?? 0)}</span>
          <span>
            <strong>${escapeHtml(openIssue?.playerName ?? "선수 불만 없음")}</strong>
            <small>${escapeHtml(openIssue ? `${clubIssueLabel(openIssue.type)} · ${openIssue.reason}` : "면담 요청이 생기면 여기에 고정됩니다.")}</small>
          </span>
        </li>
        <li>
          <span class="order">${formatNumber(dynamics?.summary?.activePromises ?? 0)}</span>
          <span>
            <strong>${escapeHtml(activePromise?.playerName ?? "활성 약속 없음")}</strong>
            <small>${escapeHtml(activePromise ? `${activePromise.label} · 기한 ${activePromise.dueDate}` : "약속을 하면 이행 여부를 매일 추적합니다.")}</small>
          </span>
        </li>
      </ol>
    </section>
  `;
}

function clubPhilosophyLabel(id) {
  const labels = {
    balanced: "균형",
    winNow: "즉시성적",
    rebuild: "리빌딩"
  };
  return labels[id] ?? "균형";
}

function clubIssueLabel(type) {
  const labels = {
    "playing-time": "출전 불만",
    demotion: "2군행 불만"
  };
  return labels[type] ?? "면담 요청";
}

function renderNarrativeMemoryPanel(state, selectedTeam) {
  const arcs = buildNarrativeMemoryItems(state, selectedTeam);
  const teamName = getTeamShortName(selectedTeam) ?? "우리 팀";
  const leadHeat = arcs[0]?.heat ?? 0;
  return `
    <section class="narrative-memory-panel" data-narrative-memory aria-label="장기 서사 메모리">
      <div class="narrative-memory-head">
        <div>
          <span class="mini-label">장기 서사</span>
          <h2>${escapeHtml(teamName)} 메모리</h2>
          <p>감독 결정, 경기 결과, 부상, 언론 프레임을 이어서 기억합니다.</p>
        </div>
        <span class="pill">열기 ${formatNumber(Math.round(Number(leadHeat ?? 0)))}</span>
      </div>
      <div class="narrative-arc-list">
        ${arcs.length ? arcs.map(renderNarrativeArcCard).join("") : renderEmptyNarrativeMemory(teamName)}
      </div>
    </section>
  `;
}

function buildNarrativeMemoryItems(state, selectedTeam) {
  const teamId = String(selectedTeam?.id ?? state?.selectedTeamId ?? "");
  return [...(state?.narratives?.arcs ?? [])]
    .filter((arc) => !arc.teamId || arc.teamId === "league" || String(arc.teamId) === teamId)
    .sort((a, b) => Number(b.heat ?? 0) - Number(a.heat ?? 0) || String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
    .slice(0, 4);
}

function renderNarrativeArcCard(arc) {
  const heat = Math.max(0, Math.min(100, Math.round(Number(arc.heat ?? 0))));
  const evidence = arc.evidence?.[0]?.text ?? "";
  return `
    <article class="narrative-arc-card is-${escapeAttribute(logTypeClass(arc.type))}">
      <div class="narrative-arc-top">
        <span>${escapeHtml(narrativeTypeLabel(arc.type))}</span>
        <b>${formatNumber(heat)}</b>
      </div>
      <h3>${escapeHtml(arc.headline ?? arc.subject ?? "장기 이슈")}</h3>
      <p>${escapeHtml(arc.summary ?? "")}</p>
      ${evidence ? `<small>${escapeHtml(evidence)}</small>` : ""}
      <div class="narrative-heat-track" style="--heat:${heat}%"><i></i></div>
    </article>
  `;
}

function renderEmptyNarrativeMemory(teamName) {
  return `
    <article class="narrative-arc-card is-empty">
      <div class="narrative-arc-top">
        <span>개인비서</span>
        <b>0</b>
      </div>
      <h3>${escapeHtml(teamName)} 첫 서사 기록 대기</h3>
      <p>취임 인터뷰, 라인업 저장, 경기 결과가 쌓이면 반복되는 이야기와 언론 프레임이 표시됩니다.</p>
      <div class="narrative-heat-track" style="--heat:0%"><i></i></div>
    </article>
  `;
}

function narrativeTypeLabel(type) {
  const labels = {
    performance: "경기 흐름",
    pressure: "압박",
    trust: "신뢰",
    momentum: "상승세",
    medical: "메디컬",
    development: "육성",
    preseason: "캠프",
    "front-office": "프런트",
    "league-environment": "리그 환경",
    "fa-signing": "FA",
    "foreign-signing": "외국인",
    "trade-complete": "트레이드"
  };
  return labels[type] ?? "서사";
}

function renderNewsInboxPanel(state, selectedTeam, manager) {
  const filter = normalizeMailFilter(state?.ui?.mailFilter);
  const mailbox = getMailboxSummary(state);
  const allItems = buildNewsInboxItems(state, selectedTeam, manager);
  const fallbackItems = filterNewsInboxItems(allItems, filter);
  const selectedId = state?.ui?.selectedMailId;
  const selectedManually = state?.ui?.selectedMailManual === true;
  const unreadItems = fallbackItems.filter((item) => !item.read);
  const selectedById = fallbackItems.find((item) => String(item.id) === String(selectedId));
  const selected = (unreadItems.length > 0 && selectedById?.read && !selectedManually ? null : selectedById) ??
    unreadItems.at(-1) ??
    fallbackItems.find((item) => item.decision?.status === "open") ??
    fallbackItems[0] ??
    buildFallbackAssistantBriefing(state, selectedTeam, manager);
  const counts = buildNewsInboxCounts(allItems);
  const phaseLabel = state.phase === "preseason" ? "프리시즌 포털" : "구단 포털";

  return `
    <section class="news-inbox-panel mailbox-panel" id="news-inbox" data-main-news-inbox data-preseason-desk aria-label="통합 받은편지함">
      <div class="news-inbox-head mailbox-portal-head">
        <div>
          <span class="mini-label">${escapeHtml(phaseLabel)}</span>
          <h2>받은편지함</h2>
          <p>${escapeHtml(state.currentDate ?? "")} · 새 편지 ${formatNumber(mailbox.unread)}통 · 결재 ${formatNumber(mailbox.openDecisions)}건 · 통합 항목 ${formatNumber(allItems.length)}개</p>
        </div>
        <div class="mailbox-summary-strip" aria-label="받은편지함 요약">
          <span><b>${formatNumber(mailbox.unread)}</b> 읽지 않음</span>
          <span><b>${formatNumber(counts.log + counts.event)}</b> 로그</span>
          <span><b>${formatNumber(counts.media + counts.league)}</b> 뉴스</span>
        </div>
      </div>
      <div class="mailbox-filter-row" role="tablist" aria-label="메일 필터">
        ${["all", "decision", "club", "league", "media", "log"].map((id) => `
          <button class="mail-filter ${filter === id ? "is-active" : ""}" data-action="mail-filter" data-mail-filter="${escapeAttribute(id)}" type="button">
            ${escapeHtml(mailFilterLabel(id))}
            <small>${formatNumber(counts[id] ?? allItems.length)}</small>
          </button>
        `).join("")}
      </div>
      <div class="mailbox-grid">
        <div class="mailbox-list" aria-label="통합 소식 목록">
          ${fallbackItems.map((item) => renderMailListItem(item, selected)).join("")}
        </div>
        ${renderMailBody(selected)}
      </div>
    </section>
  `;
}

function buildNewsInboxItems(state, selectedTeam, manager) {
  const mailboxItems = getMailboxItems(state).map((mail) => normalizeInboxFeedItem({
    ...mail,
    feedSource: "mail",
    category: normalizeInboxCategory(mail)
  }, state, "mail"));
  const logItems = (state.logs ?? []).map((log, index) => normalizeInboxFeedItem(normalizeLogItem(log, state), state, "log", index));
  const newsItems = (state.newsLog ?? []).map((log, index) => normalizeInboxFeedItem(normalizeLogItem(log, state), state, "news", index));
  const eventItems = (state.eventLog ?? []).slice(0, 50).map((event, index) => normalizeEventLogInboxItem(event, state, index));
  const fallbacks = [
    buildFallbackAssistantBriefing(state, selectedTeam, manager),
    buildFallbackMediaBriefing(state, selectedTeam)
  ].map((item, index) => normalizeInboxFeedItem(item, state, "briefing", index));
  const merged = [...mailboxItems, ...logItems, ...newsItems, ...eventItems, ...fallbacks];
  const seen = new Set();
  const uniqueItems = merged
    .filter((item) => {
      const key = inboxContentDedupeKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(compareInboxFeedItems);
  return limitNewsInboxItems(uniqueItems);
}

function limitNewsInboxItems(items) {
  const limit = 80;
  if (items.length <= limit) return items;
  const unreadMail = items.filter((item) => item.feedSource === "mail" && !item.read);
  if (unreadMail.length >= limit) return unreadMail.slice(-limit);
  const otherItems = items.filter((item) => !(item.feedSource === "mail" && !item.read));
  return [...otherItems.slice(0, limit - unreadMail.length), ...unreadMail];
}

function inboxContentDedupeKey(item) {
  const source = normalizeInboxDedupeText(item.from?.role ?? item.source ?? item.feedSource ?? "");
  const headline = normalizeInboxDedupeText(item.headline ?? item.title ?? item.text ?? "");
  const decision = normalizeInboxDedupeText(item.decision?.id ?? "");
  if (decision) return `decision|${decision}`;
  return `${source}|${headline}`;
}

function normalizeInboxDedupeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeInboxFeedItem(item, state, feedSource, index = 0) {
  const source = item.from?.role ?? item.source ?? item.tag ?? feedSourceLabel(feedSource);
  const category = normalizeInboxCategory(item, feedSource);
  const headline = item.headline ?? item.title ?? item.text ?? item.message ?? "새 소식";
  const body = item.body ?? item.text ?? item.message ?? headline;
  return {
    ...item,
    id: item.id ?? `${feedSource}-${state.currentDate ?? "date"}-${index}`,
    feedSource,
    category,
    from: item.from ?? { role: source, icon: item.type ?? feedSource },
    source,
    headline,
    body,
    text: item.text ?? body,
    type: item.type ?? feedSource,
    read: feedSource === "mail" ? Boolean(item.read) : true,
    date: item.date ?? state.currentDate ?? ""
  };
}

function normalizeEventLogInboxItem(event, state, index) {
  const type = event?.type ?? "event";
  const gameLine = event?.type === "game.final"
    ? `${event.away ?? event.awayTeamId ?? "원정"} ${formatNumber(event.awayScore)} - ${formatNumber(event.homeScore)} ${event.home ?? event.homeTeamId ?? "홈"}`
    : "";
  const headline = event?.headline ?? event?.summary ?? (gameLine ? `경기 종료: ${gameLine}` : eventTypeLabel(type));
  const body = event?.body ?? event?.text ?? event?.message ?? [
    gameLine,
    event?.winnerTeamId ? `승리 팀: ${event.winnerTeamId}` : "",
    event?.gameId ? `경기 ID: ${event.gameId}` : "",
    type ? `분류: ${type}` : ""
  ].filter(Boolean).join("\n");
  return normalizeInboxFeedItem({
    id: event?.id ?? `event-${event?.gameId ?? index}`,
    date: event?.date ?? state.currentDate ?? "",
    type: `event-${type}`,
    category: "log",
    source: event?.source ?? "최근 이벤트",
    headline,
    body,
    read: true,
    eventId: event?.id ?? event?.gameId ?? ""
  }, state, "event", index);
}

function normalizeInboxCategory(item, feedSource = item?.feedSource) {
  if (item?.decision?.status === "open") return "decision";
  const category = String(item?.category ?? "");
  if (["decision", "club", "league", "media", "log"].includes(category)) return category;
  const type = String(item?.type ?? "");
  if (["media", "press", "community"].some((key) => type.includes(key))) return "media";
  if (["league", "kbo", "waiver", "trade-completed", "draft"].some((key) => type.includes(key))) return "league";
  if (["log", "event", "news"].includes(feedSource)) return "log";
  return "club";
}

function filterNewsInboxItems(items, filter) {
  if (filter === "all") return items;
  if (filter === "decision") return items.filter((item) => item.decision?.status === "open");
  if (filter === "log") return items.filter((item) => item.category === "log" || ["log", "event", "news"].includes(item.feedSource));
  return items.filter((item) => item.category === filter);
}

function buildNewsInboxCounts(items) {
  const counts = { all: items.length, decision: 0, club: 0, league: 0, media: 0, log: 0, event: 0 };
  for (const item of items) {
    if (item.decision?.status === "open") counts.decision += 1;
    if (item.feedSource === "event") counts.event += 1;
    if (item.category === "log" || ["log", "event", "news"].includes(item.feedSource)) counts.log += 1;
    else if (Object.hasOwn(counts, item.category)) counts[item.category] += 1;
  }
  return counts;
}

function compareInboxFeedItems(a, b) {
  const priority = (item) => {
    if (item.decision?.status === "open") return 0;
    if (item.feedSource === "mail" && item.read) return 1;
    if (item.feedSource === "log") return 2;
    if (item.feedSource === "news" || item.feedSource === "event" || item.feedSource === "briefing") return 3;
    if (item.feedSource === "mail" && !item.read) return 4;
    return 3;
  };
  const priorityDiff = priority(a) - priority(b);
  if (priorityDiff !== 0) return priorityDiff;
  const aUnread = a.feedSource === "mail" && !a.read;
  const bUnread = b.feedSource === "mail" && !b.read;
  const dateDiff = aUnread && bUnread
    ? String(a.date ?? "").localeCompare(String(b.date ?? ""))
    : String(b.date ?? "").localeCompare(String(a.date ?? ""));
  if (dateDiff !== 0) return dateDiff;
  return String(a.headline ?? "").localeCompare(String(b.headline ?? ""));
}

function feedSourceLabel(feedSource) {
  const labels = {
    mail: "받은편지",
    log: "최근 로그",
    news: "뉴스",
    event: "이벤트",
    briefing: "브리핑"
  };
  return labels[feedSource] ?? "소식";
}

function eventTypeLabel(type) {
  const labels = {
    "game.final": "경기 종료",
    "trade.completed": "트레이드 완료",
    "fa.signed": "FA 계약",
    "foreign.signed": "외국인 권리 계약",
    "season.rollover": "시즌 전환"
  };
  return labels[type] ?? "최근 이벤트";
}

function renderMailListItem(item, selected) {
  const type = logTypeClass(item.type);
  const isSelected = String(item.id) === String(selected?.id);
  const decision = item.decision?.status === "open";
  const blocking = Boolean(item.decision?.blocking);
  const feedLabel = feedSourceLabel(item.feedSource);
  return `
    <button class="news-inbox-item mail-list-item ${type ? `is-${escapeAttribute(type)}` : ""} is-feed-${escapeAttribute(item.feedSource ?? "mail")} ${isSelected ? "is-selected" : ""} ${!item.read ? "is-unread" : ""}" data-action="open-mail" data-mail-id="${escapeAttribute(item.id)}" data-news-type="${escapeAttribute(item.type)}" type="button">
      <span class="mail-list-meta">
        <i class="mail-read-marker ${!item.read ? "is-unread" : "is-read"}" aria-hidden="true"></i>
        <em>${escapeHtml(item.from?.role ?? item.source ?? item.tag ?? feedLabel)}</em>
        <time>${escapeHtml(item.date ?? "")}</time>
      </span>
      <strong>${escapeHtml(item.headline ?? item.text ?? "새 소식")}</strong>
      <small>${escapeHtml(mailCategoryLabel(item.category))}${decision ? ` · ${blocking ? "진행 전 처리" : "결재"}` : ""}</small>
    </button>
  `;
}

function renderMailBody(item) {
  if (!item) {
    return `<article class="mailbox-body empty-card">받은 편지가 없습니다.</article>`;
  }
  const decision = item.decision?.status === "open" ? item.decision : null;
  return `
    <article class="mailbox-body is-${escapeAttribute(logTypeClass(item.type))}" data-mail-body data-mail-id="${escapeAttribute(item.id)}">
      <div class="mailbox-body-head">
        <span class="mini-label">${escapeHtml(item.from?.role ?? item.source ?? feedSourceLabel(item.feedSource))}</span>
        <h3>${escapeHtml(item.headline ?? "새 소식")}</h3>
        <div class="mail-detail-meta">
          <span>${escapeHtml(item.date ?? "")}</span>
          <span>${escapeHtml(mailCategoryLabel(item.category))}</span>
          <span>${escapeHtml(feedSourceLabel(item.feedSource))}</span>
        </div>
      </div>
      <div class="mailbox-body-content">
        ${renderMailBodyText(item.body ?? item.text ?? "")}
      </div>
      ${Array.isArray(item.links) && item.links.length ? `
        <div class="mail-link-row">
          ${item.links.map((link) => `<button class="button button-soft" data-action="mail-link" data-mail-target="${escapeAttribute(link.target)}" type="button">${escapeHtml(link.label)}</button>`).join("")}
        </div>
      ` : ""}
      ${decision ? renderMailDecisionActions(item, decision) : ""}
    </article>
  `;
}

function renderMailBodyText(text) {
  const lines = String(text ?? "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const paragraphs = lines.length ? lines : ["내용을 불러오는 중입니다."];
  return paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function renderMailDecisionActions(item, decision) {
  const options = (Array.isArray(decision.options) && decision.options.length)
    ? decision.options
    : fallbackDecisionOptions(decision.type);
  return `
    <div class="mail-decision-box ${decision.blocking ? "is-blocking" : ""}">
      <span>${decision.blocking ? "진행 전 처리 필요" : `기한 ${escapeHtml(decision.expiresOn ?? "")}`}</span>
      <div class="decision-mail-actions">
        ${options.map((option) => `
          <button class="decision-choice" data-action="resolve-mail-decision" data-mail-id="${escapeAttribute(item.id)}" data-decision-action="${escapeAttribute(option.action ?? "acknowledge")}">
            <strong>${escapeHtml(option.label ?? "확인")}</strong>
            <small>${escapeHtml(option.note ?? "")}</small>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function normalizeMailFilter(value) {
  const id = String(value ?? "all");
  return ["all", "decision", "club", "league", "media", "log"].includes(id) ? id : "all";
}

function mailFilterLabel(id) {
  const labels = {
    all: "전체",
    decision: "결재함",
    club: "구단",
    league: "리그",
    media: "미디어",
    log: "로그"
  };
  return labels[id] ?? "전체";
}

function mailCategoryLabel(category) {
  const labels = {
    decision: "결재",
    club: "구단",
    league: "리그",
    media: "미디어",
    log: "로그"
  };
  return labels[category] ?? "소식";
}

function renderPreseasonMediaCard(item) {
  return `
    <article class="media-brief-card" data-news-type="media">
      <span>${escapeHtml(item.source ?? item.tag ?? "KBO 뉴스")}</span>
      <strong>${escapeHtml(item.headline)}</strong>
      <p>${escapeHtml(item.body || item.text)}</p>
      <small>${escapeHtml(item.date ?? "")}</small>
    </article>
  `;
}

function renderBlockingDecisionOverlay(state) {
  const decision = state?.pendingMailDecision;
  if (!decision || decision.status !== "open" || !decision.blocking) return "";
  return `
    <div class="decision-overlay-backdrop" data-blocking-decision-overlay role="dialog" aria-modal="true" aria-label="진행 전 결재">
      <div class="decision-overlay-shell">
        ${renderPendingMailDecisionPanel(state)}
      </div>
    </div>
  `;
}

function renderPendingMailDecisionPanel(state) {
  const decision = state?.pendingMailDecision;
  if (!decision || decision.status !== "open") return "";
  const options = (Array.isArray(decision.options) && decision.options.length)
    ? decision.options
    : fallbackDecisionOptions(decision.type);
  const severity = decision.severity ? `is-${logTypeClass(decision.severity)}` : "";
  const blocking = decision.blocking ? "진행 전 처리 필요" : "보고 확인 필요";
  return `
    <section class="decision-mail-panel ${severity}" data-pending-mail-decision aria-label="긴급 보고 결정">
      <div class="decision-mail-copy">
        <span>${escapeHtml(blocking)}</span>
        <h2>${escapeHtml(decision.headline ?? "긴급 보고")}</h2>
        <p>${escapeHtml(decision.body ?? decision.text ?? "보고 내용을 확인하고 조치하십시오.")}</p>
        <small>${escapeHtml(decision.source ?? decision.teamName ?? "개인비서")} · ${escapeHtml(decision.date ?? state.currentDate ?? "")}</small>
      </div>
      <div class="decision-mail-actions">
        ${options.map((option) => `
          <button class="decision-choice" data-action="resolve-mail-decision" data-mail-id="${escapeAttribute(decision.mailId ?? decision.id ?? "")}" data-decision-action="${escapeAttribute(option.action ?? "acknowledge")}">
            <strong>${escapeHtml(option.label ?? "확인")}</strong>
            <small>${escapeHtml(option.note ?? "")}</small>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function fallbackDecisionOptions(type) {
  if (type === "medical-roster") {
    return [
      { action: "callup", label: "말소+콜업", note: "10일 재등록 제한" },
      { action: "monitor", label: "하루 관찰", note: "의무 파트 관리" },
      { action: "rush", label: "강행", note: "재부상 위험" }
    ];
  }
  if (type === "foreign-lineup") {
    return [
      { action: "bench-hitter", label: "타자 제외", note: "2명 출전 제한" },
      { action: "rotate-pitcher", label: "선발 조정", note: "로테이션 변경" },
      { action: "acknowledge", label: "확인", note: "회의 안건" }
    ];
  }
  if (type === "foreign-adaptation") {
    return [
      { action: "extra-support", label: "가족 초청", note: "5,000만 원" },
      { action: "acknowledge", label: "면담 관리", note: "모니터링" },
      { action: "demote", label: "2군 조정", note: "멘탈 하락" }
    ];
  }
  if (type === "trade-offer") {
    return [
      { action: "accept", label: "제안 수락", note: "즉시 처리" },
      { action: "counter", label: "현금 깎기", note: "역제안" },
      { action: "reject", label: "거절", note: "자산 유지" }
    ];
  }
  if (type === "waiver-claim") {
    return [
      { action: "claim", label: "클레임", note: "연봉 승계" },
      { action: "pass", label: "패스", note: "현 roster 유지" }
    ];
  }
  if (type === "bullpen-rest") {
    return [
      { action: "rest", label: "오늘 휴식", note: "등판 제외" },
      { action: "manager-discretion", label: "감독 재량", note: "경기 흐름에 맡김" }
    ];
  }
  if (type === "futures-callup") {
    return [
      { action: "callup", label: "콜업", note: "1군 등록" },
      { action: "hold", label: "보류", note: "추가 관찰" }
    ];
  }
  if (type === "player-meeting") {
    return [
      { action: "encourage", label: "격려", note: "사기 회복" },
      { action: "challenge", label: "경쟁 요구", note: "약속 없음" },
      { action: "promise-playing-time", label: "출전 약속", note: "21일 내 5경기" }
    ];
  }
  if (type === "owner-warning") {
    return [
      { action: "rebuild-briefing", label: "리빌딩 설명", note: "장기 플랜" },
      { action: "accept-pressure", label: "책임 인정", note: "반등 약속" },
      { action: "lineup-shake", label: "쇄신안", note: "기용 변화" }
    ];
  }
  if (type === "owner-dismissal") {
    return [
      { action: "end-career", label: "커리어 종료", note: "완료 상태" }
    ];
  }
  if (type === "opening-rotation") {
    return [
      { action: "confirm", label: "그대로 확정", note: "현재 운용 유지" },
      { action: "review-lineup", label: "라인업에서 조정", note: "투수 운용 확인" }
    ];
  }
  return [{ action: "acknowledge", label: "확인", note: "보고 처리" }];
}

function buildFallbackAssistantBriefing(state, selectedTeam, manager) {
  const teamName = getTeamShortName(selectedTeam) ?? "우리 팀";
  return {
    id: `fallback-assistant-${state.currentDate ?? "today"}`,
    type: "assistant",
    tag: "개인비서",
    headline: "프리시즌 첫 보고",
    body: `${manager.name} 감독님, ${teamName} 캠프 첫날입니다. 로스터 컨디션, 언론 반응, 개막 엔트리 이슈를 매일 정리해 올리겠습니다.`,
    date: state.currentDate ?? ""
  };
}

function buildFallbackMediaBriefing(state, selectedTeam) {
  const teamName = getTeamShortName(selectedTeam) ?? "KBO 구단";
  return {
    id: `fallback-media-${state.currentDate ?? "today"}`,
    type: "media",
    tag: "뉴스룸",
    source: "SBS · KBS · MBC · JTBC · MBN · SPOTV",
    headline: `${teamName} 프리시즌 캠프 주목`,
    body: "취임 첫날 분위기와 개막 전력 구상이 주요 방송사 스포츠 뉴스의 관심사로 떠올랐습니다.",
    date: state.currentDate ?? ""
  };
}

function renderOnboarding(root, state, screen) {
  const teams = state.teams ?? [];
  const selectedTeam = getSelectedTeam(state);
  const logoStrip = renderStartLogoStrip(teams);
  const screenClass = [
    screen === "team-select" ? "is-team-select" : "",
    screen === "manager-setup" ? "is-manager-step" : "",
    screen === "appointment" ? "is-appointment-step" : ""
  ].filter(Boolean).join(" ");
  root.innerHTML = `
    <main class="start-shell">
      <section class="start-hero ${screenClass}" style="--team-color: ${escapeAttribute(getTeamColor(selectedTeam))}">
        <div class="start-copy">
          <div class="start-kicker">
            <span class="mini-label">KBO GM Manager</span>
            <span class="start-date">2026.03.01</span>
          </div>
          <h1>${escapeHtml(onboardingTitle(screen))}</h1>
          <p>${escapeHtml(onboardingLead(screen, selectedTeam))}</p>
          ${screen === "welcome" || screen === "team-select" ? logoStrip : renderOnboardingTeamPlate(selectedTeam)}
          ${screen === "welcome" ? `
            <div class="start-actions">
              <button class="button button-primary" data-action="start-new" type="button">시작하기</button>
              <button class="button button-soft" data-action="load-save-start" type="button">불러오기</button>
            </div>
          ` : ""}
        </div>
        ${screen === "team-select" ? `
          <div class="team-select-stage">
            <div class="panel-head">
              <div>
                <span class="mini-label">구단 선택</span>
                <h2>어느 프런트로 시작할까요?</h2>
              </div>
              <div class="start-head-actions">
                <span class="pill">10개 구단</span>
                <button class="button button-soft" data-action="back-to-start" type="button">뒤로</button>
              </div>
            </div>
            <div class="start-team-grid">
              ${teams.map((team) => `
                <button class="start-team-card" style="--team-color: ${escapeAttribute(getTeamColor(team))}" data-action="choose-start-team" data-team-id="${escapeAttribute(team.id)}" type="button">
                  ${renderTeamLogo(team, "team-logo")}
                  <span>
                    <strong>${escapeHtml(getTeamName(team))}</strong>
                    <small>${escapeHtml(team.home ?? getTeamLocation(team))}</small>
                  </span>
                </button>
              `).join("")}
            </div>
          </div>
        ` : screen === "manager-setup" ? `
          ${renderManagerSetupStage(state, selectedTeam)}
        ` : screen === "appointment" ? `
          ${renderAppointmentStage(state, selectedTeam)}
        ` : `
          ${renderStartPreview()}
        `}
      </section>
    </main>
  `;
  bindOnboardingActions(root, state);
}

function onboardingTitle(screen) {
  if (screen === "team-select") return "클럽을 선택하세요";
  if (screen === "manager-setup") return "감독 등록";
  if (screen === "appointment") return "취임 기자회견";
  return "KBO 2026";
}

function onboardingLead(screen, selectedTeam) {
  if (screen === "team-select") return "프런트 룸에 입장할 구단을 정하세요.";
  if (screen === "manager-setup") return `${getTeamName(selectedTeam) ?? "선택한 구단"} 감독실 프로필을 완성하세요.`;
  if (screen === "appointment") return "첫 메시지는 시즌 내내 클럽하우스와 뉴스룸에 남습니다.";
  return "프리시즌 캠프, 로스터, 시장, 경기 운영이 오늘부터 움직입니다.";
}

function renderOnboardingTeamPlate(team) {
  return `
    <div class="start-club-plate" style="--team-color: ${escapeAttribute(getTeamColor(team))}">
      ${renderTeamLogo(team, "team-logo start-club-logo")}
      <span>
        <strong>${escapeHtml(getTeamName(team) ?? "구단 선택 전")}</strong>
        <small>${escapeHtml(team?.home ?? getTeamLocation(team) ?? "프리시즌 캠프")}</small>
      </span>
    </div>
  `;
}

function renderManagerSetupStage(state, selectedTeam) {
  const manager = getManagerProfile(state);
  const selectedStyle = manager.style ?? "balanced";

  return `
    <div class="manager-setup-stage">
      <div class="panel-head">
        <div>
          <span class="mini-label">감독 등록</span>
          <h2>${escapeHtml(getTeamShortName(selectedTeam) ?? "KBO")} 감독실</h2>
        </div>
        <button class="button button-soft" data-action="back-to-team-select" type="button">구단 다시 선택</button>
      </div>
      <form class="manager-form" data-manager-form>
        <label>
          <span>감독 이름</span>
          <input name="managerName" type="text" maxlength="12" autocomplete="name" value="${escapeAttribute(manager.name === "임시 감독" ? "" : manager.name)}" placeholder="예: ${escapeAttribute(DEFAULT_MANAGER_NAME)}">
        </label>
        <label>
          <span>나이</span>
          <input name="managerAge" type="number" min="25" max="75" step="1" value="${escapeAttribute(manager.age)}" required>
        </label>
        <label>
          <span>운영 성향</span>
          <select name="managerStyle">
            ${MANAGER_STYLES.map((style) => `
              <option value="${escapeAttribute(style.value)}" ${style.value === selectedStyle ? "selected" : ""}>${escapeHtml(style.label)}</option>
            `).join("")}
          </select>
        </label>
        <div class="manager-style-list">
          ${MANAGER_STYLES.map((style) => `
            <span class="${style.value === selectedStyle ? "is-selected" : ""}">
              <strong>${escapeHtml(style.label)}</strong>
              <small>${escapeHtml(style.description)}</small>
            </span>
          `).join("")}
        </div>
        <p class="onboarding-status" data-onboarding-status aria-live="polite"></p>
        <div class="start-actions">
          <button class="button button-primary" type="submit">취임 기자회견으로</button>
        </div>
      </form>
    </div>
  `;
}

function renderAppointmentStage(state, selectedTeam) {
  const manager = getManagerProfile(state);
  const teamShortName = getTeamShortName(selectedTeam) ?? "KBO";
  const teamName = getTeamName(selectedTeam) ?? "선택 구단";
  const ballpark = selectedTeam?.home ?? getTeamLocation(selectedTeam) ?? "프리시즌 캠프";

  return `
    <div class="appointment-stage">
      <div class="appointment-card">
        <div class="appointment-card-backdrop" aria-hidden="true"></div>
        <div class="appointment-card-head">
          <div class="appointment-club-lockup">
            ${renderTeamLogo(selectedTeam, "team-logo appointment-logo")}
            <span>
              <small>${escapeHtml(teamShortName)} Front Office</small>
              <strong>${escapeHtml(teamName)}</strong>
            </span>
          </div>
          <div class="appointment-press-badge">
            <span>LIVE</span>
            <b>취임 기자회견</b>
          </div>
        </div>
        <div class="appointment-title-block">
          <span class="mini-label">Manager Appointment</span>
          <h2>${escapeHtml(manager.name)} 감독 첫 인터뷰</h2>
          <p>${escapeHtml(ballpark)} · ${formatNumber(manager.age)}세 · ${escapeHtml(managerStyleLabel(manager.style))}</p>
        </div>
        <div class="appointment-broadcast-frame" aria-label="취임 기자회견 방송 화면">
          <div class="appointment-camera-deck" aria-hidden="true">
            <i></i><i></i><i></i>
          </div>
          <div class="appointment-sponsor-wall" aria-hidden="true">
            ${Array.from({ length: 4 }, (_, index) => `
              <span>${escapeHtml(index % 3 === 0 ? teamShortName : index % 3 === 1 ? "KBO" : "LIVE")}</span>
            `).join("")}
          </div>
          <div class="appointment-lower-third">
            <span>ON AIR</span>
            <strong>${escapeHtml(teamName)} ${escapeHtml(manager.name)} 감독</strong>
            <small>${escapeHtml(ballpark)} 공동취재</small>
          </div>
        </div>
        <div class="appointment-ceremony-banner">
          <span>취임식</span>
          <strong>${escapeHtml(teamName)} ${escapeHtml(manager.name)} 감독 선임</strong>
          <p>구단기 전달, 포토 세션, 방송사 공동 취재 뒤 첫 질의응답을 진행합니다.</p>
        </div>
        <div class="appointment-media-strip" aria-label="기자회견 정보">
          <span><b>01</b><small>시즌 목표</small></span>
          <span><b>02</b><small>선수단 메시지</small></span>
          <span><b>03</b><small>프런트 원칙</small></span>
        </div>
        <form class="interview-form" data-appointment-form>
          ${INAUGURAL_QUESTIONS.map((question) => renderInterviewQuestion(question, manager)).join("")}
          <p class="onboarding-status" data-onboarding-status aria-live="polite"></p>
          <div class="start-actions appointment-actions">
            <button class="button button-soft" data-action="back-to-manager-setup" type="button">프로필 수정</button>
            <button class="button button-primary" type="submit">클럽하우스로 입장</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderInterviewQuestion(question, manager) {
  const savedAnswer = (manager.interviewAnswers ?? []).find((answer) => answer.id === question.id)?.value;
  return `
    <fieldset class="interview-question">
      <legend>
        <span>${escapeHtml(question.question)}</span>
      </legend>
      <div class="interview-options">
        ${question.options.map((option, index) => `
          <label>
            <input type="radio" name="${escapeAttribute(question.id)}" value="${escapeAttribute(option.value)}" ${savedAnswer === option.value || (!savedAnswer && index === 0) ? "checked" : ""}>
            <span>
              <strong>${escapeHtml(option.label)}</strong>
              <small>${escapeHtml(option.note)}</small>
            </span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

function renderStartLogoStrip(teams) {
  return `
    <div class="start-logo-strip" aria-label="KBO 10개 구단">
      ${teams.map((team) => `
        <span class="start-logo-chip" style="--team-color: ${escapeAttribute(getTeamColor(team))}">
          ${renderTeamLogo(team, "team-logo start-chip-logo")}
          <small>${escapeHtml(team.shortName ?? team.name ?? "")}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function renderStartPreview() {
  return `
    <aside class="start-preview" aria-label="프리시즌 보드">
      <div class="start-ticket skin-ticket">
        <span>SEASON HUB</span>
        <strong>Opening Room</strong>
        <small>2026 KBO Front Office</small>
      </div>
      <div class="start-preview-grid">
        <span><strong>10</strong><small>Clubs</small></span>
        <span><strong>720</strong><small>Games</small></span>
        <span><strong>531</strong><small>Players</small></span>
      </div>
      <div class="skin-match-panel">
        <span>LIVE DESK</span>
        <strong>캠프 첫날 브리핑</strong>
        <small>스프링캠프 1일차 · 프런트 회의 시작</small>
      </div>
      <div class="start-diamond" aria-hidden="true">
        <i></i><i></i><i></i><i></i>
      </div>
    </aside>
  `;
}

function bindOnboardingActions(root, state) {
  root.querySelector("[data-action='start-new']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "team-select" };
    render(root, state);
    resetViewportToTop();
  });

  root.querySelector("[data-action='back-to-start']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "welcome" };
    render(root, state);
    resetViewportToTop();
  });

  (root.querySelectorAll?.("[data-action='choose-start-team']") ?? []).forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTeamId = button.dataset.teamId;
      state.ui = { ...(state.ui ?? {}), screen: "manager-setup" };
      render(root, state);
      resetViewportToTop();
    });
  });

  root.querySelector("[data-action='back-to-team-select']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "team-select" };
    render(root, state);
    resetViewportToTop();
  });

  root.querySelector("[data-action='back-to-manager-setup']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "manager-setup" };
    render(root, state);
    resetViewportToTop();
  });

  root.querySelector("[data-manager-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(form.elements.managerName?.value ?? "").trim() || DEFAULT_MANAGER_NAME;
    const age = Number(form.elements.managerAge?.value ?? 0);
    const style = String(form.elements.managerStyle?.value ?? "balanced");

    if (name.length < 2) {
      setOnboardingStatus(root, "감독 이름은 두 글자 이상 입력하세요.");
      return;
    }
    if (!Number.isFinite(age) || age < 25 || age > 75) {
      setOnboardingStatus(root, "나이는 25세부터 75세 사이로 입력하세요.");
      return;
    }

    state.manager = {
      ...(state.manager ?? {}),
      name,
      age: Math.round(age),
      style,
      teamId: state.selectedTeamId,
      appointedAt: state.currentDate,
      interviewAnswers: state.manager?.interviewAnswers ?? []
    };
    state.ui = { ...(state.ui ?? {}), screen: "appointment" };
    render(root, state);
    resetViewportToTop();
  });

  root.querySelector("[data-appointment-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const answers = INAUGURAL_QUESTIONS.map((question) => {
      const value = String(form.elements[question.id]?.value ?? question.options[0]?.value ?? "");
      const selected = question.options.find((option) => option.value === value) ?? question.options[0];
      return {
        id: question.id,
        question: question.question,
        value: selected?.value ?? "",
        label: selected?.label ?? "",
        note: selected?.note ?? ""
      };
    });
    const manager = getManagerProfile(state);
    const selectedTeam = getSelectedTeam(state);
    state.manager = {
      ...manager,
      teamId: state.selectedTeamId,
      appointedAt: manager.appointedAt ?? state.currentDate,
      interviewAnswers: answers,
      inaugurationComplete: true
    };
    const appointmentLogs = buildAppointmentNewsLogs(state, selectedTeam, manager, answers);
    state.logs = [
      ...appointmentLogs,
      ...((state.logs ?? []))
    ].slice(0, 60);
    for (const [index, log] of appointmentLogs.entries()) {
      deliverMail(state, {
        id: `appointment-${state.currentDate}-${index}-${log.type}`,
        date: log.date,
        from: { role: log.source ?? log.tag ?? "프런트", icon: log.type },
        category: log.type === "media" ? "media" : "club",
        type: log.type,
        headline: log.headline,
        body: log.text,
        read: false
      });
    }
    rememberManagerAction(state, {
      type: "appointment",
      teamId: state.selectedTeamId,
      subject: `${manager.name} 감독 취임`,
      headline: `${manager.name} 감독 첫 메시지`,
      summary: answers.map((answer) => `${answer.question}: ${answer.label}`).join(" / "),
      heat: 14,
      confidence: 72,
      tags: ["appointment", "interview", "manager"]
    });
    state.ui = { ...(state.ui ?? {}), screen: "game" };
    render(root, state);
    resetViewportToTop();
    setStatus(root, `${manager.name} 감독 취임 완료. 프리시즌 캠프에 합류했습니다.`);
  });

  root.querySelector("[data-action='load-save-start']")?.addEventListener("click", () => {
    openSaveFile()
      .then((text) => {
        const loadedState = importGameState(text);
        loadedState.ui = { ...(loadedState.ui ?? {}), screen: "game" };
        replaceState(state, loadedState);
        render(root, state);
        resetViewportToTop();
        setStatus(root, "저장 파일을 불러왔어요.");
      })
      .catch(() => {});
  });
}

function renderCommandCenterPanels(gmDesk, state) {
  const { tradeMarket, scoutAssignments, inbox } = gmDesk;
  const executableProposal = findExecutableTradeProposal(tradeMarket.proposals);
  const topProposal = executableProposal ?? tradeMarket.proposals?.[0];
  const recentReports = getRecentScoutingReports(state, tradeMarket.team?.id ?? state?.selectedTeamId);

  return `
    <section class="content-grid command-center-grid" id="gm-desk" aria-label="GM 데스크">
      <article class="panel command-panel inbox-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">GM 데스크</span>
            <h2>알림함</h2>
          </div>
          <span class="pill">${formatNumber(inbox.summary?.totalItems)}건</span>
        </div>
        <ol class="player-list compact front-office-list command-list">
          ${renderInboxItems(inbox.items)}
        </ol>
      </article>

      <article class="panel command-panel scout-assignment-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">분석팀</span>
            <h2>스카우트 업무</h2>
          </div>
          <span class="pill">${formatNumber(scoutAssignments.coverage?.assignments)}개</span>
        </div>
        <ol class="player-list compact front-office-list command-list">
          ${renderScoutAssignments(scoutAssignments.assignments)}
        </ol>
        ${renderRecentScoutingReports(recentReports)}
      </article>

      <article class="panel command-panel trade-proposal-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">시장</span>
            <h2>트레이드 제안</h2>
          </div>
          <span class="pill">${formatNumber(tradeMarket.proposals?.length)}건</span>
        </div>
        ${topProposal ? renderTradeProposalSpotlight(topProposal, tradeMarket) : renderEmptyTradeProposal(tradeMarket)}
      </article>
    </section>
  `;
}

function renderInboxItems(items = []) {
  if (!items.length) {
    return renderEmptyListItem("검토할 알림 없음");
  }

  return items.slice(0, 4).map((item) => `
    <li>
      <span class="order severity-${escapeAttribute(item.severity)}">${escapeHtml(severityLabel(item.severity))}</span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.body)}</small>
      </span>
      <b>${formatNumber(item.queueRank)}</b>
    </li>
  `).join("");
}

function renderScoutAssignments(assignments = []) {
  if (!assignments.length) {
    return renderEmptyListItem("배정된 업무 없음");
  }

  return assignments.slice(0, 4).map((assignment) => `
    <li>
      <span class="order severity-${escapeAttribute(assignment.priority)}">${escapeHtml(severityLabel(assignment.priority))}</span>
      <span>
        <strong>${escapeHtml(assignment.title)}</strong>
        <small>${escapeHtml(assignment.dueDate)} · ${formatNumber(assignment.workloadHours)}시간 · ${escapeHtml(assignment.focus)}</small>
      </span>
      <button class="mini-action" data-action="commit-scout-assignment" data-scout-assignment-id="${escapeAttribute(assignment.id)}" type="button">지시</button>
    </li>
  `).join("");
}

function getRecentScoutingReports(state, teamId) {
  const key = String(teamId ?? "");
  return Object.values(state?.scoutingReportsById ?? {})
    .filter((report) => !key || String(report.orderedByTeamId ?? report.teamId ?? "") === key)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || Number(b.confidence ?? 0) - Number(a.confidence ?? 0))
    .slice(0, 3);
}

function renderRecentScoutingReports(reports) {
  if (!reports.length) return "";
  return `
    <div class="scout-report-strip">
      ${reports.map((report) => `
        <article>
          <span>${escapeHtml(report.leverageLabel ?? "관찰")}</span>
          <strong>${escapeHtml(report.playerName ?? "후보")}</strong>
          <small>OVR ${formatNumber(report.currentGrade)} · POT ${formatNumber(report.futureGrade)} · 신뢰 ${formatNumber(report.confidence)}%</small>
        </article>
      `).join("")}
    </div>
  `;
}

function renderTradeProposalSpotlight(proposal, tradeMarket) {
  const target = proposal.target?.player;
  const outgoing = proposal.outgoing?.map(formatTradeProposalAssetLabel).filter(Boolean).join(", ") || "추가 자산 필요";
  const executable = isExecutableTradeProposal(proposal);
  const isPendingApproval = tradeMarket.pendingApprovalId === proposal.id;
  const gateBlockers = proposal.executionGate?.blockers ?? [];
  const gateText = executable
    ? isPendingApproval
      ? "검토 잠금 완료 · 한 번 더 누르면 확정"
      : "엄격 게이트 통과 · 검토 잠금 필요"
    : gateBlockers[0] ?? "스카우트/자산 재검토 필요";

  return `
    <div class="proposal-card trade-command-card ${isPendingApproval ? "is-armed" : ""}">
      <div>
        <span class="mini-label">${escapeHtml(tradeMarket.strategy?.label ?? "균형")} 전략</span>
        <h3>${escapeHtml(target?.name ?? "후보 없음")}</h3>
        <p>${escapeHtml(proposal.target?.teamName ?? "")} · ${escapeHtml(target?.position ?? "-")} · 수락 가능성 ${formatNumber(proposal.acceptanceScore)}%</p>
      </div>
      <dl class="proposal-meta">
        <div>
          <dt>보내는 자산</dt>
          <dd>${escapeHtml(outgoing)}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>${escapeHtml(proposalStatusLabel(proposal.status, proposal.executionGate))}</dd>
        </div>
        <div>
          <dt>가치 균형</dt>
          <dd>${formatSignedNumber(proposal.valueBalance)}</dd>
        </div>
      </dl>
      <div class="trade-command-actions">
        <button class="button ${executable && isPendingApproval ? "button-primary" : "button-soft"}" data-action="commit-trade" ${executable ? "" : "disabled"}>
          ${escapeHtml(executable ? isPendingApproval ? "확정 실행" : "검토 잠금" : "실행 불가")}
        </button>
        <small>${escapeHtml(gateText)}</small>
      </div>
    </div>
  `;
}

function renderEmptyTradeProposal(tradeMarket) {
  const note = tradeMarket.marketNotes?.[0]?.text ?? "검토 가능한 제안이 아직 없습니다.";
  return `<div class="empty-card">${escapeHtml(note)}</div>`;
}

function renderTradeLedgerPanel(state) {
  const trades = state.trades?.completed ?? [];
  return `
    <section class="trade-ledger-panel" id="trade-ledger" aria-label="트레이드 실행 원장">
      <div class="panel-head">
        <div>
          <span class="mini-label">Transaction</span>
          <h2>트레이드 원장</h2>
        </div>
        <span class="pill">${formatNumber(trades.length)}건 완료</span>
      </div>
      <ol class="trade-ledger-list">
        ${trades.length ? trades.slice(0, 6).map(renderTradeLedgerItem).join("") : renderEmptyListItem("실행된 트레이드가 아직 없습니다.")}
      </ol>
    </section>
  `;
}

function renderTradeLedgerItem(trade) {
  const additionalAssets = trade.additionalAssets ?? [];
  return `
    <li class="trade-ledger-item">
      <span class="trade-ledger-badge">${escapeHtml(trade.status === "complete" ? "완료" : "대기")}</span>
      <div>
        <strong>${escapeHtml(trade.incoming?.name ?? "")} ↔ ${escapeHtml(trade.outgoing?.name ?? "")}</strong>
        <small class="trade-route">${escapeHtml(trade.incoming?.fromTeamName ?? "")} → ${escapeHtml(trade.incoming?.toTeamName ?? "")} · ${escapeHtml(trade.outgoing?.fromTeamName ?? "")} → ${escapeHtml(trade.outgoing?.toTeamName ?? "")}</small>
        <div class="trade-result-note">
          <span class="trade-asset-pill">수락 ${formatNumber(trade.acceptanceScore)}%</span>
          <span class="trade-asset-pill">균형 ${formatSignedNumber(trade.valueBalance)}</span>
          ${additionalAssets.map((asset) => `<span class="trade-asset-pill">${escapeHtml(formatTradeLedgerAssetLabel(asset))}</span>`).join("")}
          <span class="trade-asset-pill">${escapeHtml(trade.date ?? "")}</span>
        </div>
      </div>
    </li>
  `;
}

function renderFreeAgencyPanel(state, selectedTeam) {
  const market = state.freeAgency;
  const year = market?.year ?? nextSeasonYear(state);
  const faCandidates = market?.faCandidates?.length ? market.faCandidates : buildFreeAgencyPreviewCandidates(state);
  const foreignCandidates = market?.foreignMarket?.candidates?.length ? market.foreignMarket.candidates : buildForeignPreviewCandidates(year);
  const selectedOffers = (market?.offers ?? []).filter((offer) => String(offer.signingTeamId) === String(state.selectedTeamId));
  const selectedForeignOffers = (market?.foreignOffers ?? []).filter((offer) => String(offer.teamId) === String(state.selectedTeamId));
  const topOffer = selectedOffers.find((offer) => offer.status === "open") ?? selectedOffers[0] ?? null;
  const topForeignOffer = selectedForeignOffers.find((offer) => offer.status === "open") ?? selectedForeignOffers[0] ?? null;
  const statusText = market
    ? `${formatNumber(market.signings?.length ?? 0)}건 계약 · 외국인 ${formatNumber(market.foreignSignings?.length ?? 0)}건`
    : "시장 오픈 전";

  return `
    <section class="free-agency-panel" id="free-agency" aria-label="FA와 외국인 시장">
      <div class="panel-head">
        <div>
          <span class="mini-label">스토브리그</span>
          <h2>FA/외국인 시장</h2>
        </div>
        <span class="pill">${escapeHtml(statusText)}</span>
      </div>
      <div class="free-agency-summary">
        <span>FA 후보 ${formatNumber(faCandidates.length)}명</span>
        <span>오퍼 ${formatNumber(market?.offers?.length ?? 0)}건</span>
        <span>외국인 코드풀 ${formatNumber(foreignCandidates.length)}명</span>
        <span>${escapeHtml(getTeamShortName(selectedTeam) ?? "우리 팀")} 오퍼 ${formatNumber(selectedOffers.length + selectedForeignOffers.length)}건</span>
      </div>
      <div class="market-command-actions">
        <button class="button button-soft" data-action="free-agency">${market ? "시장 새로 보기" : "시장 열기"}</button>
        <button class="button button-primary" data-action="sign-fa" ${topOffer ? "" : "disabled"}>FA 계약</button>
        <button class="button button-soft" data-action="sign-foreign" ${topForeignOffer ? "" : "disabled"}>외국인 권리 계약</button>
        <small class="market-result-note">${escapeHtml(market ? "실제 로스터 FA만 이동, 외국인 후보는 코드형 권리만 확보합니다." : "시장 열기 전에는 현재 로스터 기반 미리보기입니다.")}</small>
      </div>
      <div class="fa-market-grid">
        ${faCandidates.slice(0, 6).map((candidate) => renderFaCard(candidate, selectedOffers)).join("")}
      </div>
      <div class="fa-offer-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">우리 오퍼</span>
            <h2>${escapeHtml(getTeamShortName(selectedTeam) ?? "선택팀")} FA 제안</h2>
          </div>
          <span class="pill">${topOffer ? formatKRWShort(topOffer.totalGuaranteeKRW) : "대기"}</span>
        </div>
        <ol class="fa-offer-list">
          ${selectedOffers.length ? selectedOffers.slice(0, 5).map(renderFaOfferItem).join("") : renderEmptyListItem("FA시장 버튼을 누르면 우리 팀 제안이 생성됩니다.")}
        </ol>
      </div>
      <div class="foreign-market-grid">
        ${foreignCandidates.slice(0, 6).map((candidate) => renderForeignCard(candidate, topForeignOffer)).join("")}
      </div>
      <div class="market-ledger-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">원장</span>
            <h2>시장 장부</h2>
          </div>
          <span class="pill">${formatNumber((market?.signings?.length ?? 0) + (market?.foreignSignings?.length ?? 0))}건</span>
        </div>
        <ol class="market-ledger-list">
          ${renderMarketLedgerItems(market)}
        </ol>
      </div>
    </section>
  `;
}

function renderFaCard(candidate, selectedOffers) {
  const offer = selectedOffers.find((entry) => String(entry.playerId) === String(candidate.playerId));
  const classes = ["fa-card", offer ? "is-target" : "", candidate.status === "signed" ? "is-signed" : ""].filter(Boolean).join(" ");
  return `
    <article class="${classes}">
      <div>
        <span class="mini-label">${escapeHtml(candidate.fromTeamShortName ?? candidate.fromTeamName)} · ${escapeHtml(faGradeLabel(candidate.compensationGrade))}</span>
        <h3>${escapeHtml(candidate.name)}</h3>
      </div>
      <p>${escapeHtml(roleLabel(candidate.role))} · ${escapeHtml(candidate.position)} · ${formatNumber(candidate.age)}세 · OVR ${formatNumber(candidate.ovr)} / POT ${formatNumber(candidate.pot)}</p>
      <div class="eligibility-chip-row">
        <span>전연봉 ${formatKRWShort(candidate.previousSalaryKRW)}</span>
        <span>보상 ${formatKRWShort(candidate.compensation?.cashOnlyKRW)}</span>
        <span>${escapeHtml(marketCandidateStatus(candidate.status))}</span>
      </div>
      <small>${offer ? `${escapeHtml(offer.signingTeamName)} ${formatNumber(offer.years)}년 ${formatKRWShort(offer.totalGuaranteeKRW)}` : "시장 후보"}</small>
    </article>
  `;
}

function renderFaOfferItem(offer) {
  return `
    <li class="fa-offer-item">
      <span class="market-asset-pill">${escapeHtml(faGradeLabel(offer.compensation?.grade))}</span>
      <span>
        <strong>${escapeHtml(offer.playerName)} · ${formatNumber(offer.years)}년 ${formatKRWShort(offer.totalGuaranteeKRW)}</strong>
        <small>${escapeHtml(offer.fromTeamName)} → ${escapeHtml(offer.signingTeamName)} · 연 ${formatKRWShort(offer.annualSalaryKRW)} · 보상 ${formatCompensationText(offer.compensation)}</small>
      </span>
    </li>
  `;
}

function renderForeignCard(candidate, topOffer) {
  const isTarget = topOffer && String(topOffer.candidateId) === String(candidate.id);
  return `
    <article class="foreign-card ${isTarget ? "is-target" : ""}">
      <div>
        <span class="mini-label">Tier ${formatNumber(candidate.tier)} · ${escapeHtml(candidate.slotType ?? "")}</span>
        <h3>${escapeHtml(candidate.displayCode)}</h3>
      </div>
      <p>${escapeHtml(roleLabel(candidate.role))} · ${escapeHtml(candidate.position)} · ${formatNumber(candidate.age)}세 · ${escapeHtml(candidate.profile)}</p>
      <div class="eligibility-chip-row">
        <span>Grade ${formatNumber(candidate.scoutingGrade)}</span>
        <span>적응 ${escapeHtml(riskLabel(candidate.adaptationRisk))}</span>
        <span>${formatKRWShort(candidate.askingSalaryKRW)}</span>
      </div>
      <small>${escapeHtml(candidate.sourceKind ?? "anonymous-foreign-market-v1")}</small>
    </article>
  `;
}

function renderMarketLedgerItems(market) {
  const items = [
    ...(market?.signings ?? []).map((entry) => ({ type: "FA", title: `${entry.signingTeamName} · ${entry.name}`, detail: `${entry.fromTeamName}에서 계약 · ${formatNumber(entry.years)}년 ${formatKRWShort(entry.totalGuaranteeKRW)}`, badge: faGradeLabel(entry.compensationGrade) })),
    ...(market?.compensationLedger ?? []).map((entry) => ({ type: "보상", title: `${entry.originalTeamName} 권리`, detail: `${entry.signingTeamName} 지급 예정 · ${formatCompensationText(entry)}`, badge: entry.decision === "cash-only" ? "현금" : "보상대기" })),
    ...(market?.foreignSignings ?? []).map((entry) => ({ type: "외인", title: `${entry.teamName} · ${entry.displayCode}`, detail: `${entry.slotType} · ${formatKRWShort(entry.contractKRW)} · ${entry.rosterActivation}`, badge: `T${entry.tier}` }))
  ];
  if (!items.length) return renderEmptyListItem("시장 계약이 아직 없습니다.");
  return items.slice(0, 8).map((item) => `
    <li class="market-ledger-item">
      <span class="market-asset-pill">${escapeHtml(item.badge)}</span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.type)} · ${escapeHtml(item.detail)}</small>
      </span>
    </li>
  `).join("");
}

function buildFreeAgencyPreviewCandidates(state) {
  return [...(state.teams ?? []).flatMap((team) => (team.roster ?? []).map((player) => ({ team, player })))]
    .filter(({ player }) => !player.foreignPlayer?.isForeign)
    .filter(({ player }) => ["eligibleAfterSeason", "filed", "market"].includes(player.faStatus?.status) || Number(player.faStatus?.yearsUntilEligibility ?? 9) <= 0)
    .sort((a, b) => Number(b.player.ovr ?? 0) - Number(a.player.ovr ?? 0) || String(a.player.name).localeCompare(String(b.player.name)))
    .slice(0, 12)
    .map(({ team, player }, index) => {
      const grade = player.compensationGrade?.grade ?? player.faStatus?.compensationGrade ?? "none";
      const salaryKRW = Number(player.contract?.salary?.payrollAmountKRW ?? 0);
      return {
        id: `preview-fa-${player.id}`,
        rank: index + 1,
        playerId: player.id,
        name: player.name,
        fromTeamId: team.id,
        fromTeamName: team.name,
        fromTeamShortName: team.shortName ?? team.name,
        role: player.role,
        position: player.position,
        age: Number(player.age ?? 0),
        ovr: Number(player.ovr ?? 0),
        pot: Number(player.pot ?? 0),
        previousSalaryKRW: salaryKRW,
        compensationGrade: grade,
        compensation: {
          grade,
          cashOnlyKRW: salaryKRW * (grade === "A" ? 3 : grade === "B" ? 2 : grade === "C" ? 1.5 : 0)
        },
        status: "preview"
      };
    });
}

function buildForeignPreviewCandidates(year) {
  return Array.from({ length: 6 }, (_, index) => ({
    id: `preview-foreign-${index + 1}`,
    displayCode: `FGN-${year}-${String(index + 1).padStart(3, "0")}`,
    tier: Math.floor(index / 2) + 1,
    role: index % 2 === 0 ? "pitcher" : "hitter",
    position: index % 2 === 0 ? "SP" : ["1B", "CF", "RF"][index % 3],
    slotType: index % 2 === 0 ? "foreignPitcher" : "foreignHitter",
    profile: index % 2 === 0 ? "선발 후보 코드" : "타선 보강 코드",
    age: 26 + index,
    scoutingGrade: 70 - index * 3,
    adaptationRisk: index % 3 === 0 ? "medium" : "low",
    medicalRisk: "low",
    askingSalaryKRW: 1_600_000_000 - index * 90_000_000,
    sourceKind: "preview-code-only"
  }));
}

function findExecutableTradeProposal(proposals = []) {
  return (proposals ?? []).find((proposal) => isExecutableTradeProposal(proposal) && (proposal.supplementalAssets ?? []).length > 0) ??
    (proposals ?? []).find(isExecutableTradeProposal) ??
    null;
}

function isExecutableTradeProposal(proposal) {
  const playerAssets = (proposal?.outgoing ?? []).filter((asset) => asset.assetType === "player");
  return Boolean(proposal && proposal.status === "viable" && proposal.executionGate?.commandReady === true && playerAssets.length === 1);
}

function formatTradeProposalAssetLabel(asset) {
  if (asset.assetType === "player") return asset.player?.name ?? "선수";
  if (asset.assetType === "cash") return `현금 ${formatKRWShort(asset.amountKRW)}`;
  if (asset.assetType === "draftPick") return asset.pickLabel ?? `${formatNumber(asset.round)}R 지명권`;
  if (asset.assetType === "conditional") return "조건부 자산";
  if (asset.assetType === "ptbnl") return "후일결정선수";
  return asset.assetType ?? "자산";
}

function formatTradeLedgerAssetLabel(asset) {
  if (asset.assetType === "cash") return `현금 ${formatKRWShort(asset.amountKRW)}`;
  if (asset.assetType === "draftPick") return `${formatNumber(asset.year)} ${formatNumber(asset.round)}R`;
  if (asset.assetType === "conditional") return "조건부";
  if (asset.assetType === "ptbnl") return "PTBNL";
  return asset.assetType ?? "자산";
}

function renderContractSnapshot(summary) {
  const source = summary.sourceCounts?.[0];
  const sourceText = source ? `${sourceKindLabel(source.kind)} ${formatNumber(source.count)}명` : "출처 대기";
  const topContracts = summary.topContracts?.slice(0, 3) ?? [];
  const faWatch = summary.faWatch?.[0];

  return `
    <ol class="player-list compact front-office-list contract-list">
      ${renderOfficeFact("총액", formatKRWShort(summary.totalPayrollKRW), `팀 기준 ${formatKRWShort(summary.payrollHintKRW)} · ${sourceText}`, formatRatioPct(summary.payrollCoverageRatio))}
      ${renderOfficeFact("FA", `${formatNumber(summary.faSoonCount)}명`, faWatch ? `${faWatch.name} · ${faLabel(faWatch)}` : "대상 없음", "권리")}
      ${renderOfficeFact("외인", `${formatNumber(summary.foreignCount)}명`, summary.foreignPlayers?.[0] ? `${summary.foreignPlayers[0].name} · ${foreignSlotLabel(summary.foreignPlayers[0].foreignSlotType)}` : "등록 없음", "슬롯")}
      ${renderOfficeFact("병역", `${formatNumber(summary.militaryUnknownCount)}명`, "공식 병역 데이터 입력 전", "확인")}
      ${topContracts.map(renderContractPlayer).join("")}
    </ol>
  `;
}

function renderContractPlayer(player) {
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(player.id ?? player.playerId ?? "")}" data-team-id="${escapeAttribute(player.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${escapeHtml(player.position || "-")}</span>
      <span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${escapeHtml(contractTypeLabel(player.contractType))} · ${escapeHtml(faLabel(player))} · ${escapeHtml(sourceKindLabel(player.sourceKind))}</small>
      </span>
      <b>${formatKRWShort(player.payrollAmountKRW)}</b>
    </li>
  `;
}

function bindActions(root, state) {
  root.querySelectorAll("[data-action='switch-tab']").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui = {
        ...(state.ui ?? {}),
        activeTab: normalizeActiveTab(button.dataset.tabId)
      };
      render(root, state);
      resetViewportToTop();
    });
  });

  const picker = root.querySelector("[data-action='select-team']");
  picker?.addEventListener("change", (event) => {
    state.selectedTeamId = event.target.value;
    state.ui = {
      ...(state.ui ?? {}),
      selectedPlayerId: "",
      selectedPlayerTeamId: ""
    };
    render(root, state);
    resetViewportToTop();
  });

  root.querySelectorAll("[data-action='open-player-detail']").forEach((row) => {
    const open = () => {
      state.ui = {
        ...(state.ui ?? {}),
        selectedPlayerId: row.dataset.playerId || "",
        selectedPlayerTeamId: row.dataset.teamId || state.selectedTeamId || "",
        activeTab: "players"
      };
      render(root, state);
      scrollToPlayerDetail();
    };
    row.addEventListener("click", open);
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      open();
    });
  });

  root.querySelector("[data-action='close-player-detail']")?.addEventListener("click", () => {
    state.ui = {
      ...(state.ui ?? {}),
      selectedPlayerId: "",
      selectedPlayerTeamId: ""
    };
    render(root, state);
  });

  root.querySelector("[data-action='calendar-prev']")?.addEventListener("click", () => {
    state.ui = {
      ...(state.ui ?? {}),
      calendarMonthOffset: normalizeCalendarMonthOffset((state.ui?.calendarMonthOffset ?? 0) - 1)
    };
    render(root, state);
  });

  root.querySelector("[data-action='calendar-next']")?.addEventListener("click", () => {
    state.ui = {
      ...(state.ui ?? {}),
      calendarMonthOffset: normalizeCalendarMonthOffset((state.ui?.calendarMonthOffset ?? 0) + 1)
    };
    render(root, state);
  });

  root.querySelector("[data-action='calendar-today']")?.addEventListener("click", () => {
    state.ui = {
      ...(state.ui ?? {}),
      calendarMonthOffset: 0
    };
    render(root, state);
  });

  root.querySelectorAll("[data-action='calendar-month']").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui = {
        ...(state.ui ?? {}),
        calendarMonthOffset: normalizeCalendarMonthOffset(button.dataset.calendarOffset),
        activeTab: "schedule"
      };
      render(root, state);
    });
  });

  root.querySelectorAll("[data-action='commit-club-philosophy']").forEach((button) => {
    button.addEventListener("click", () => {
      const result = commitClubPhilosophy(state, {
        teamId: state.selectedTeamId,
        philosophy: button.dataset.philosophy
      });
      render(root, state);
      setStatus(root, result.message || "운영 철학을 저장했습니다.");
    });
  });

  root.querySelectorAll("[data-action='resolve-mail-decision']").forEach((button) => {
    button.addEventListener("click", () => {
      const mailId = button.dataset.mailId || "";
      const action = button.dataset.decisionAction || "acknowledge";
      const result = mailId ? resolveMailDecision(state, mailId, action) : resolveMailDecision(state, action);
      state.ui = {
        ...(state.ui ?? {}),
        selectedMailId: mailId || state.ui?.selectedMailId,
        mailFilter: "decision"
      };
      render(root, state);
      setStatus(root, result.message || "긴급 보고를 처리했습니다.");
    });
  });

  root.querySelectorAll("[data-action='open-mail']").forEach((button) => {
    button.addEventListener("click", () => {
      const mailId = button.dataset.mailId || "";
      const autoReadFromSpace = button.dataset.autoReadFromSpace === "true";
      delete button.dataset.autoReadFromSpace;
      if (mailId) markMailRead(state, mailId);
      const hasUnreadAfter = getMailboxSummary(state).unread > 0;
      const activeTab = normalizeActiveTab(state.ui?.activeTab);
      state.ui = {
        ...(state.ui ?? {}),
        selectedMailId: autoReadFromSpace && hasUnreadAfter ? "" : mailId,
        selectedMailManual: !(autoReadFromSpace && hasUnreadAfter),
        activeTab: activeTab === "clubhouse" || activeTab === "news" ? activeTab : "news"
      };
      render(root, state);
      setStatus(root, "항목을 열었습니다.");
    });
  });

  root.querySelectorAll("[data-action='mail-filter']").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui = {
        ...(state.ui ?? {}),
        mailFilter: normalizeMailFilter(button.dataset.mailFilter),
        selectedMailId: "",
        selectedMailManual: false,
        activeTab: "news"
      };
      render(root, state);
    });
  });

  root.querySelector("[data-action='toggle-record-book-qualification']")?.addEventListener("click", () => {
    state.ui = {
      ...(state.ui ?? {}),
      recordBookIncludeUnqualified: !Boolean(state.ui?.recordBookIncludeUnqualified),
      activeTab: "records"
    };
    render(root, state);
  });

  root.querySelectorAll("[data-action='mail-link']").forEach((button) => {
    button.addEventListener("click", () => {
      openMailTarget(root, state, button.dataset.mailTarget || "");
    });
  });

  root.querySelectorAll("[data-action='toggle-continue-stop']").forEach((input) => {
    input.addEventListener("change", () => {
      state.settings = {
        ...(state.settings ?? {}),
        continueStops: {
          myGameDay: state.settings?.continueStops?.myGameDay !== false,
          openDecision: state.settings?.continueStops?.openDecision !== false,
          importantMail: state.settings?.continueStops?.importantMail !== false,
          [input.dataset.stopKey || ""]: Boolean(input.checked)
        }
      };
      render(root, state);
      setStatus(root, "멈춤 규칙을 저장했습니다.");
    });
  });

  root.querySelector("[data-lineup-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const selectedTeam = getSelectedTeam(state);
    if (!selectedTeam) return;
    const playerIds = [...event.currentTarget.querySelectorAll("[data-lineup-slot]")]
      .map((select) => String(select.value ?? ""))
      .filter(Boolean);
    const uniqueIds = new Set(playerIds);
    const eligibleIds = new Set(getLineupEligibleHitters(selectedTeam.roster ?? []).map((player) => String(player.id)));

    if (playerIds.length !== 9 || uniqueIds.size !== 9 || playerIds.some((id) => !eligibleIds.has(id))) {
      setStatus(root, "라인업 저장 실패: 1~9번 타자는 중복 없이 가용 타자 9명으로 채워야 합니다.");
      return;
    }

    selectedTeam.lineupCard = {
      mode: "manual",
      playerIds,
      updatedAt: state.currentDate,
      source: "manager-lineup-board-v1"
    };
    state.logs = [
      {
        date: state.currentDate,
        type: "front-office",
        tag: "라인업",
        source: "감독실",
        headline: `${getTeamShortName(selectedTeam) ?? selectedTeam.name} 선발 타순 저장`,
        text: `감독실이 ${playerIds.length}명 선발 오더를 확정했습니다. 다음 경기부터 수동 타순이 우선 적용됩니다.`
      },
      ...((state.logs ?? []))
    ].slice(0, 80);
    rememberManagerAction(state, {
      type: "lineup-manual",
      teamId: selectedTeam.id,
      subject: "수동 선발 타순",
      headline: `${getTeamShortName(selectedTeam) ?? selectedTeam.name} 수동 타순 고정`,
      summary: `감독실이 1~9번 선발 오더를 직접 확정했습니다. 다음 경기 결과에 따라 타순 고정 프레임이 이어집니다.`,
      heat: 11,
      confidence: 64,
      tags: ["lineup", "manager", "game-plan"]
    });
    render(root, state);
    setStatus(root, "라인업을 저장했습니다. 다음 경기 시뮬레이션에 이 타순이 적용됩니다.");
  });

  root.querySelector("[data-action='auto-lineup']")?.addEventListener("click", () => {
    const selectedTeam = getSelectedTeam(state);
    if (!selectedTeam) return;
    selectedTeam.lineupCard = null;
    rememberManagerAction(state, {
      type: "lineup-auto",
      teamId: selectedTeam.id,
      subject: "자동 추천 라인업",
      headline: `${getTeamShortName(selectedTeam) ?? selectedTeam.name} 자동 추천 복귀`,
      summary: "감독실이 수동 오더를 해제하고 컨디션/능력치 기반 자동 추천 라인업으로 돌아갔습니다.",
      heat: 7,
      confidence: 56,
      tags: ["lineup", "manager", "automation"]
    });
    render(root, state);
    setStatus(root, "자동 추천 라인업으로 되돌렸습니다.");
  });

  root.querySelector("[data-action='save-pitching-plan']")?.addEventListener("click", (event) => {
    const selectedTeam = getSelectedTeam(state);
    if (!selectedTeam) return;
    const form = event.currentTarget.closest("[data-lineup-form]") ?? root.querySelector("[data-lineup-form]");
    const rotationOrder = [...(form?.querySelectorAll("[data-pitching-rotation-slot]") ?? [])]
      .map((select) => String(select.value ?? ""))
      .filter(Boolean);
    const closerId = String(form?.querySelector("[data-pitching-role='closer']")?.value ?? "");
    const setupIds = [...(form?.querySelectorAll("[data-pitching-role='setup']") ?? [])]
      .map((select) => String(select.value ?? ""))
      .filter(Boolean);
    const longReliefIds = [...(form?.querySelectorAll("[data-pitching-role='longRelief']") ?? [])]
      .map((select) => String(select.value ?? ""))
      .filter(Boolean);
    const result = commitPitchingPlan(state, {
      teamId: selectedTeam.id,
      rotationOrder,
      closerId,
      setupIds,
      longReliefIds
    });

    if (!result.ok) {
      setStatus(root, result.message ?? "투수 운용 저장에 실패했습니다.");
      return;
    }

    render(root, state);
    setStatus(root, result.message ?? "투수 운용을 저장했습니다.");
  });

  root.querySelector("[data-action='auto-pitching-plan']")?.addEventListener("click", () => {
    const selectedTeam = getSelectedTeam(state);
    if (!selectedTeam) return;
    const result = commitPitchingPlan(state, { teamId: selectedTeam.id, mode: "auto" });
    render(root, state);
    setStatus(root, result.message ?? "자동 추천 투수 운용으로 되돌렸습니다.");
  });

  root.querySelectorAll("[data-action='set-game-plan']").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedTeam = getSelectedTeam(state);
      if (!selectedTeam) return;
      const result = commitGameInterventionPlan(state, {
        teamId: selectedTeam.id,
        preset: button.dataset.gamePlanPreset || "balanced"
      });
      render(root, state);
      setStatus(root, result.message ?? "다음 경기 전략을 저장했습니다.");
    });
  });

  root.querySelectorAll("[data-action='commit-scout-assignment']").forEach((button) => {
    button.addEventListener("click", () => {
      const selectedTeam = getSelectedTeam(state);
      if (!selectedTeam) return;
      const result = commitScoutAssignment(state, {
        teamId: selectedTeam.id,
        assignmentId: button.dataset.scoutAssignmentId || ""
      });
      render(root, state);
      setStatus(root, result.message ?? "스카우트 리포트를 생성했습니다.");
    });
  });

  root.querySelectorAll("[data-action='next-day']").forEach((button) => {
    button.addEventListener("click", () => {
      void runCalendarAdvance(root, state, 1);
    });
  });

  root.querySelectorAll("[data-action='continue']").forEach((button) => {
    button.addEventListener("click", () => {
      void runContinueAdvance(root, state);
    });
  });

  root.querySelectorAll("[data-action='week']").forEach((button) => {
    button.addEventListener("click", () => {
      void runCalendarAdvance(root, state, 7);
    });
  });

  root.querySelectorAll("[data-action='watch-next-game']").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (stopForBlockingMail(root, state)) return;
      if (state.phase !== "regular") {
        setStatus(root, "프리시즌에는 경기 시작으로 개막전까지 건너뛰지 않습니다. 캠프 하루 진행으로 뉴스함을 확인하세요.");
        return;
      }
      if (state.ui?.gamecastSound !== false) resumeGamecastAudio(Boolean(event.isTrusted));
      const result = simulateNextUserGame(state, { teamId: state.selectedTeamId, mode: "watch" });
      state.ui = {
        ...(state.ui ?? {}),
        screen: "game",
        activeTab: "standings",
        focusGameId: result.game?.id ?? "",
        gamecastMode: "watch",
        gamecastExpanded: Boolean(result.ok)
      };
      render(root, state);
      setStatus(root, result.ok ? `경기 시작: ${result.message}` : result.message);
    });
  });

  root.querySelectorAll("[data-action='simulate-next-game']").forEach((button) => {
    button.addEventListener("click", () => {
      if (stopForBlockingMail(root, state)) return;
      if (state.phase !== "regular") {
        setStatus(root, "프리시즌에는 경기 스킵을 열지 않습니다. 개막 후 다음 경기 패널이 활성화됩니다.");
        return;
      }
      const result = simulateNextUserGame(state, { teamId: state.selectedTeamId, mode: "quick" });
      state.ui = {
        ...(state.ui ?? {}),
        screen: "game",
        activeTab: "standings",
        focusGameId: result.game?.id ?? "",
        gamecastMode: "summary",
        gamecastExpanded: false
      };
      render(root, state);
      setStatus(root, result.ok ? `경기 스킵 완료: ${result.message}` : result.message);
    });
  });

  root.querySelector("[data-action='postseason']")?.addEventListener("click", () => {
    let message = "";
    if (!["complete", "postseason", "offseason"].includes(state.phase)) {
      setStatus(root, "정규시즌을 하루씩 마친 뒤 가을야구를 진행할 수 있어요.");
      return;
    }
    if (state.postseason?.status === "active") {
      simulatePostseason(state);
      message = "포스트시즌을 끝까지 진행했어요.";
    } else if (state.postseason?.status === "complete") {
      message = "한국시리즈와 시상식까지 완료되어 있어요.";
    } else {
      initializePostseason(state);
      message = "가을야구 대진과 정규시즌 시상식을 만들었어요.";
    }
    state.ui = { ...(state.ui ?? {}), activeTab: "postseason" };
    render(root, state);
    setStatus(root, message);
  });

  root.querySelector("[data-action='draft']")?.addEventListener("click", () => {
    let message = "";
    if (state.postseason?.status !== "complete") {
      setStatus(root, "드래프트는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    if (state.draft?.status === "complete") {
      message = "드래프트 결과가 이미 확정되어 있어요.";
    } else if (state.draft?.status === "ready") {
      message = "드래프트 보드가 준비되어 있어요. 내 차례까지 진행하거나 전체 자동을 선택하세요.";
    } else {
      initializeDraft(state);
      message = "드래프트 보드 150명을 만들었어요.";
    }
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, message);
  });

  root.querySelector("[data-action='draft-to-user-pick']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete") {
      setStatus(root, "드래프트는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    const result = advanceDraftToUserPick(state, { teamId: state.selectedTeamId });
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, result.message ?? "내 지명 차례까지 진행했습니다.");
  });

  root.querySelector("[data-action='draft-auto-complete']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete") {
      setStatus(root, "드래프트는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    simulateDraft(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, "신인 드래프트 11라운드를 전체 자동으로 완료했어요.");
  });

  root.querySelectorAll("[data-action='draft-role-filter']").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui = {
        ...(state.ui ?? {}),
        activeTab: "drafts",
        draftRoleFilter: normalizeDraftRoleFilter(button.dataset.draftRole)
      };
      render(root, state);
    });
  });

  root.querySelectorAll("[data-action='commit-draft-pick']").forEach((button) => {
    button.addEventListener("click", () => {
      const result = commitUserDraftPick(state, {
        teamId: state.selectedTeamId,
        prospectId: button.dataset.prospectId || ""
      });
      state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
      render(root, state);
      setStatus(root, result.message ?? "지명 결과를 확인할 수 없습니다.");
    });
  });

  root.querySelector("[data-action='commit-trade']")?.addEventListener("click", () => {
    const market = buildTradeMarket(state, state.selectedTeamId);
    const proposal = findExecutableTradeProposal(market.proposals);
    if (!proposal) {
      const topProposal = market.proposals?.[0];
      const blockers = topProposal?.executionGate?.blockers ?? topProposal?.needsFollowUp ?? [];
      setStatus(root, blockers[0] ? `트레이드 보류: ${blockers[0]}` : "확정 가능한 트레이드가 아직 없습니다.");
      return;
    }
    if (state.pendingTradeApproval?.proposalId !== proposal.id) {
      state.pendingTradeApproval = {
        proposalId: proposal.id,
        targetPlayerId: proposal.target?.player?.id ?? "",
        outgoingPlayerId: proposal.outgoingPlayers?.[0]?.player?.id ?? "",
        armedAt: state.currentDate
      };
      state.ui = { ...(state.ui ?? {}), activeTab: "market" };
      render(root, state);
      setStatus(root, "트레이드 검토 잠금 완료. 같은 버튼을 한 번 더 누르면 엔진 게이트를 통과한 뒤 확정됩니다.");
      return;
    }
    const result = commitTradeProposal(state, {
      ...proposal,
      commandApproval: {
        confirmed: true,
        proposalId: proposal.id,
        targetPlayerId: proposal.target?.player?.id ?? "",
        outgoingPlayerId: proposal.outgoingPlayers?.[0]?.player?.id ?? ""
      }
    });
    state.pendingTradeApproval = null;
    state.ui = { ...(state.ui ?? {}), activeTab: "market" };
    render(root, state);
    setStatus(root, result.message || "트레이드 실행 결과를 확인할 수 없습니다.");
  });

  root.querySelector("[data-action='secondary-draft']")?.addEventListener("click", () => {
    let message = "";
    if (state.postseason?.status !== "complete") {
      setStatus(root, "2차 드래프트는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    if (state.secondaryDraft?.status === "complete") {
      message = "2차 드래프트 결과가 이미 확정되어 있어요.";
    } else if (state.secondaryDraft?.status === "ready") {
      message = "2차 드래프트 보호명단이 준비되어 있어요. 보호명단을 조정하거나 내 차례까지 진행하세요.";
    } else {
      initializeSecondaryDraft(state);
      message = "2차 드래프트 보호명단과 비보호 풀을 만들었어요.";
    }
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, message);
  });

  root.querySelector("[data-action='secondary-to-user-pick']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete") {
      setStatus(root, "2차 드래프트는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    const result = advanceSecondaryDraftToUserPick(state, { teamId: state.selectedTeamId });
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, result.message ?? "내 2차 드래프트 지명 차례까지 진행했습니다.");
  });

  root.querySelector("[data-action='secondary-auto-complete']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete") {
      setStatus(root, "2차 드래프트는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    simulateSecondaryDraft(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, "2차 드래프트 지명 결과를 전체 자동으로 확정했어요.");
  });

  root.querySelectorAll("[data-action='commit-secondary-pick']").forEach((button) => {
    button.addEventListener("click", () => {
      const result = commitUserSecondaryDraftPick(state, {
        teamId: state.selectedTeamId,
        playerId: button.dataset.playerId || ""
      });
      state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
      render(root, state);
      setStatus(root, result.message ?? "2차 드래프트 지명 결과를 확인할 수 없습니다.");
    });
  });

  root.querySelectorAll("[data-action='toggle-secondary-protection']").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = state.secondaryDraft;
      const protection = draft?.protections?.[state.selectedTeamId];
      if (!protection) {
        setStatus(root, "보호명단을 먼저 생성하세요.");
        return;
      }
      const playerId = String(button.dataset.playerId || "");
      const status = String(button.dataset.protectionStatus || "");
      const protectedIds = (protection.protected ?? []).map((player) => String(player.playerId));
      const exposedIds = (protection.exposed ?? []).map((player) => String(player.playerId));
      let nextIds = protectedIds;
      if (status === "exposed") {
        const dropId = protectedIds.at(-1);
        nextIds = protectedIds.filter((id) => id !== dropId).concat(playerId);
      } else if (status === "protected") {
        const addId = exposedIds[0];
        nextIds = protectedIds.filter((id) => id !== playerId);
        if (addId) nextIds.push(addId);
      }
      const result = setSecondaryDraftProtection(state, {
        teamId: state.selectedTeamId,
        playerIds: nextIds
      });
      state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
      render(root, state);
      setStatus(root, result.message ?? "보호명단 조정 결과를 확인할 수 없습니다.");
    });
  });

  root.querySelector("[data-action='free-agency']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete" && state.phase !== "offseason") {
      setStatus(root, "FA/외국인 시장은 시즌과 한국시리즈가 끝난 뒤 열 수 있어요.");
      return;
    }
    initializeFreeAgency(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "market" };
    render(root, state);
    setStatus(root, "FA/외국인 시장을 열었어요. 실명 FA는 로스터에서, 외국인 후보는 코드형으로 관리합니다.");
  });

  root.querySelector("[data-action='auto-offseason']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete") {
      setStatus(root, "자동 스토브리그는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    const result = runAutonomousOffseason(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "operations" };
    render(root, state);
    const summary = result.summary;
    setStatus(
      root,
      summary
        ? `자동 스토브 완료: 신인 ${formatNumber(summary.draftSignings)}명, 2차 이동 ${formatNumber(summary.secondaryTransfers)}명, FA ${formatNumber(summary.faSignings)}건, CPU 트레이드 ${formatNumber(summary.aiTrades)}건.`
        : result.message || "자동 스토브리그 결과를 확인할 수 없습니다."
    );
  });

  root.querySelector("[data-action='next-season']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete" && state.phase !== "offseason") {
      setStatus(root, "다음 시즌은 한국시리즈와 스토브리그가 끝난 뒤 넘어갈 수 있어요.");
      return;
    }
    const result = advanceSeason(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "operations" };
    render(root, state);
    setStatus(root, result.message || "다음 시즌 전환 결과를 확인할 수 없습니다.");
  });

  root.querySelector("[data-action='sign-fa']")?.addEventListener("click", () => {
    const result = commitFreeAgentSigning(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "market" };
    render(root, state);
    setStatus(root, result.message || "FA 계약 결과를 확인할 수 없습니다.");
  });

  root.querySelector("[data-action='sign-foreign']")?.addEventListener("click", () => {
    const result = commitForeignPlayerSigning(state);
    state.ui = { ...(state.ui ?? {}), activeTab: "market" };
    render(root, state);
    setStatus(root, result.message || "외국인 권리 계약 결과를 확인할 수 없습니다.");
  });

  root.querySelectorAll("[data-action='open-gamecast-broadcast']").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui = {
        ...(state.ui ?? {}),
        gamecastExpanded: true
      };
      render(root, state);
    });
  });

  root.querySelectorAll("[data-action='close-gamecast-broadcast']").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui = {
        ...(state.ui ?? {}),
        gamecastExpanded: false
      };
      render(root, state);
    });
  });

  root.querySelectorAll("[data-gamecast-engine]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextEngine = normalizeGamecastEngine(button.dataset?.gamecastEngine);
      state.ui = {
        ...(state.ui ?? {}),
        gamecastEngine: nextEngine
      };
      render(root, state);
      const engineLabel = nextEngine === "v2" ? "게임캐스트 v2" : nextEngine === "phaser" ? "Phaser" : "Canvas";
      setStatus(root, `${engineLabel} 중계 엔진으로 전환했습니다.`);
    });
  });

  root.querySelector("[data-gamecast-modal]")?.addEventListener("click", (event) => {
    if (event.target !== event.currentTarget) return;
    state.ui = {
      ...(state.ui ?? {}),
      gamecastExpanded: false
    };
    render(root, state);
  });

  root.querySelectorAll("[data-action='export-save']").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        downloadSaveFile(state);
        setStatus(root, "저장 파일을 만들었어요.");
      } catch (error) {
        setStatus(root, error.message || "저장 파일을 만들 수 없습니다.");
      }
    });
  });

  root.querySelectorAll("[data-action='import-save']").forEach((button) => {
    button.addEventListener("click", () => {
      openSaveFile()
        .then((text) => {
          const loadedState = importGameState(text);
          replaceState(state, loadedState);
          render(root, state);
          setStatus(root, "저장 파일을 불러왔어요.");
        })
        .catch((error) => {
          if (error?.name !== "AbortError") {
            setStatus(root, error.message || "저장 파일을 불러올 수 없습니다.");
          }
        });
    });
  });
}

function buildAppointmentNewsLogs(state, selectedTeam, manager, answers) {
  const teamName = getTeamName(selectedTeam) ?? "구단";
  const shortName = getTeamShortName(selectedTeam) ?? teamName;
  const date = state.currentDate ?? "";
  const goal = answers[0]?.label ?? "시즌 준비";
  const message = answers[1]?.label ?? "선수단 신뢰";
  const front = answers[2]?.label ?? "균형 운영";

  return [
    {
      date,
      type: "assistant",
      tag: "개인비서",
      source: "개인비서",
      headline: `${manager.name} 감독님, 취임식 후 첫 보고입니다`,
      text: `${shortName} 프리시즌 캠프가 시작됐습니다. 오늘 뉴스함에는 취임식 반응, 선수단 메시지, 개막 엔트리 체크리스트를 우선 정리했습니다.`
    },
    {
      date,
      type: "media",
      tag: "SPOTV",
      source: "SPOTV",
      headline: `${shortName} ${manager.name} 감독 취임식, "${goal}" 선언`,
      text: `SPOTV는 ${teamName} 새 감독 취임식에서 "${message}" 메시지가 선수단 분위기의 첫 기준점이 됐다고 전했습니다. SBS, KBS, MBC, JTBC, MBN도 프리시즌 첫 행보를 주요 기사로 다뤘습니다.`
    },
    {
      date,
      type: "front-office",
      tag: "단장실",
      source: "단장실",
      headline: "첫 시즌 운영 원칙 접수",
      text: `프런트는 "${front}" 방향에 맞춰 캠프 보고, 스카우트 자료, FA/외국인 시장 체크리스트를 매일 뉴스함으로 올리겠습니다.`
    },
    {
      date,
      type: "community",
      tag: "홍보팀",
      source: "홍보팀",
      headline: "취임식 여론 모니터링",
      text: `야구 커뮤니티에서는 ${manager.name} 감독의 첫 인터뷰 톤과 개막 엔트리 구상에 관심이 모이고 있습니다.`
    }
  ];
}

function downloadSaveFile(state) {
  const blob = new Blob([exportGameState(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = makeSaveFileName(state);
  link.click();
  URL.revokeObjectURL(url);
}

function openSaveFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new DOMException("파일 선택이 취소되었습니다.", "AbortError"));
        return;
      }

      file.text().then(resolve, reject);
    });

    input.click();
  });
}

function replaceState(target, source) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, source);
}

function normalizeCalendarMonthOffset(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(12, Math.max(-12, Math.trunc(numeric)));
}

function parseUiDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date("2026-03-01T00:00:00.000Z") : parsed;
}

function openingDayForUiDate(value) {
  const date = parseUiDate(value);
  const year = Number.isFinite(date.getUTCFullYear()) ? date.getUTCFullYear() : 2026;
  return `${year}-${UI_OPENING_DAY_MONTH_DAY}`;
}

function daysUntilUiOpening(value) {
  const current = parseUiDate(value);
  const opening = parseUiDate(openingDayForUiDate(value));
  return Math.max(0, Math.round((opening.getTime() - current.getTime()) / UI_MS_PER_DAY));
}

function stopForBlockingMail(root, state) {
  const decision = state?.pendingMailDecision;
  if (!decision || decision.status !== "open" || !decision.blocking) return false;
  setStatus(root, `${decision.headline ?? "긴급 보고"}를 먼저 처리해야 날짜를 넘길 수 있습니다.`);
  return true;
}

async function runContinueAdvance(root, state) {
  if (state?.ui?.isAdvancing) {
    setStatus(root, "이미 날짜 계산이 진행 중입니다.");
    return;
  }

  const before = captureSimulationSnapshot(state);
  const progressId = `continue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modeLabel = "계속";

  for (let index = 0; index < SIMULATION_STEPS.length; index += 1) {
    state.ui = {
      ...(state.ui ?? {}),
      isAdvancing: true,
      simulationProgress: {
        id: progressId,
        status: "running",
        kicker: modeLabel,
        title: "중요 일정까지 진행 중",
        stepIndex: index,
        percent: Math.round((index / SIMULATION_STEPS.length) * 86),
        steps: SIMULATION_STEPS,
        note: `${SIMULATION_STEPS[index]} 단계입니다.`
      }
    };
    render(root, state);
    await waitForUi(SIMULATION_STEP_DELAY_MS);
  }

  const result = advanceUntilStop(state, { maxDays: 14 });
  const after = captureSimulationSnapshot(state);
  const changes = buildSimulationChangeNotes(before, after, state, result.days || 0);
  state.ui = {
      ...(state.ui ?? {}),
      isAdvancing: false,
      activeTab: "clubhouse",
      selectedMailId: "",
      simulationProgress: {
      id: progressId,
      status: "complete",
      kicker: modeLabel,
      title: result.stopped ? "멈춤 지점 도착" : "계속 진행 완료",
      stepIndex: SIMULATION_STEPS.length,
      percent: 100,
      steps: SIMULATION_STEPS,
      changes: [result.message ?? "진행을 완료했습니다.", ...changes].slice(0, 7)
    }
  };
  render(root, state);
  setStatus(root, result.message ?? buildSimulationStatusMessage(before, after, result.days || 0));
}

async function runCalendarAdvance(root, state, days = 1) {
  if (state?.ui?.isAdvancing) {
    setStatus(root, "이미 날짜 계산이 진행 중입니다.");
    return;
  }
  if (stopForBlockingMail(root, state)) return;

  const before = captureSimulationSnapshot(state);
  const modeLabel = days > 1 ? "빠른 주간" : "다음 날";
  const progressId = `advance-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  for (let index = 0; index < SIMULATION_STEPS.length; index += 1) {
    state.ui = {
      ...(state.ui ?? {}),
      isAdvancing: true,
      simulationProgress: {
        id: progressId,
        status: "running",
        kicker: modeLabel,
        title: `${modeLabel} 계산 중`,
        stepIndex: index,
        percent: Math.round((index / SIMULATION_STEPS.length) * 86),
        steps: SIMULATION_STEPS,
        note: `${SIMULATION_STEPS[index]} 단계입니다.`
      }
    };
    render(root, state);
    await waitForUi(SIMULATION_STEP_DELAY_MS);
  }

  if (days > 1) simulateDays(state, days);
  else simulateDay(state);

  const after = captureSimulationSnapshot(state);
  const changes = buildSimulationChangeNotes(before, after, state, days);
  state.ui = {
      ...(state.ui ?? {}),
      isAdvancing: false,
      activeTab: "clubhouse",
      selectedMailId: "",
      simulationProgress: {
      id: progressId,
      status: "complete",
      kicker: modeLabel,
      title: `${modeLabel} 계산 완료`,
      stepIndex: SIMULATION_STEPS.length,
      percent: 100,
      steps: SIMULATION_STEPS,
      changes
    }
  };
  render(root, state);
  setStatus(root, buildSimulationStatusMessage(before, after, days));
}

function captureSimulationSnapshot(state) {
  const selectedTeam = getSelectedTeam(state);
  const mailbox = getMailboxSummary(state);
  return {
    date: state?.currentDate ?? "",
    day: Number(state?.day ?? 0),
    phase: state?.phase ?? "",
    gamesPlayed: Number(state?.gamesPlayed ?? 0),
    logs: Number(state?.logs?.length ?? 0),
    mailboxTotal: mailbox.total,
    mailboxUnread: mailbox.unread,
    openDecisions: mailbox.openDecisions,
    eventLog: Number(state?.eventLog?.length ?? 0),
    mailDecisions: Number(state?.mailDecisions?.length ?? 0),
    pendingMailId: state?.pendingMailDecision?.status === "open" ? String(state.pendingMailDecision.id ?? "") : "",
    pendingMailHeadline: state?.pendingMailDecision?.status === "open" ? String(state.pendingMailDecision.headline ?? "긴급 보고") : "",
    weather: formatWeatherSnapshot(state?.weather),
    selectedTeamName: getTeamShortName(selectedTeam) ?? "선택 구단",
    selectedRecord: renderRecord(selectedTeam),
    selectedFatigue: averageTeamFatigue(selectedTeam),
    activeInjuries: countActiveInjuries(state)
  };
}

function buildSimulationChangeNotes(before, after, state, days) {
  const notes = [`${before.date || "-"} → ${after.date || "-"} 일정 반영`];
  const gameDelta = Number(after.gamesPlayed) - Number(before.gamesPlayed);
  const mailDelta = Math.max(0, Number(after.mailboxTotal) - Number(before.mailboxTotal));
  const unreadDelta = Math.max(0, Number(after.mailboxUnread) - Number(before.mailboxUnread));
  const decisionDelta = Math.max(0, Number(after.openDecisions) - Number(before.openDecisions));
  const newsDelta = Math.max(0, mailDelta + (Number(after.eventLog) - Number(before.eventLog)) + (Number(after.mailDecisions) - Number(before.mailDecisions)));
  const injuryDelta = Number(after.activeInjuries) - Number(before.activeInjuries);
  const fatigueDelta = Number(after.selectedFatigue) - Number(before.selectedFatigue);

  if (gameDelta > 0) {
    notes.push(`KBO ${formatNumber(gameDelta)}경기 새로 계산`);
  } else if (before.phase === "preseason" || after.phase === "preseason") {
    notes.push("프리시즌 캠프·프런트 루틴 갱신");
  } else {
    notes.push("경기 없는 일정, 회복·이동 루틴 반영");
  }

  if (before.phase !== after.phase) {
    notes.push(`${renderPhase(before.phase)} → ${renderPhase(after.phase)} 전환`);
  }

  if (before.selectedRecord !== after.selectedRecord) {
    notes.push(`${after.selectedTeamName} 성적 ${before.selectedRecord} → ${after.selectedRecord}`);
  }

  if (before.weather !== after.weather) {
    notes.push(`날씨 ${after.weather}`);
  }

  if (mailDelta > 0 || unreadDelta > 0) {
    notes.push(`새 편지 ${formatNumber(Math.max(mailDelta, unreadDelta))}통 도착`);
  } else if (days > 1) {
    notes.push("주간 진행 중 기존 메일함 유지");
  }

  if (decisionDelta > 0) {
    notes.push(`결재 안건 ${formatNumber(decisionDelta)}건 추가`);
  }

  if (injuryDelta > 0) {
    notes.push(`부상자 ${formatNumber(injuryDelta)}명 증가`);
  } else if (injuryDelta < 0) {
    notes.push(`부상자 ${formatNumber(Math.abs(injuryDelta))}명 복귀`);
  }

  if (Math.abs(fatigueDelta) >= 2) {
    notes.push(`${after.selectedTeamName} 평균 피로 ${formatNumber(before.selectedFatigue)} → ${formatNumber(after.selectedFatigue)}`);
  }

  if (after.pendingMailId && after.pendingMailId !== before.pendingMailId) {
    notes.push(`긴급 결재 대기: ${after.pendingMailHeadline}`);
  }

  return notes.slice(0, 7);
}

function buildSimulationStatusMessage(before, after, days) {
  const gameDelta = Number(after.gamesPlayed) - Number(before.gamesPlayed);
  const modeLabel = days > 1 ? "빠른 주간" : "하루";
  return `${modeLabel} 계산 완료: ${before.date} → ${after.date}, ${formatNumber(gameDelta)}경기 반영.`;
}

function formatWeatherSnapshot(weather) {
  if (!weather) return "-";
  return `${weather.label ?? "날씨"} · ${formatTemperature(weather.temperature)}`;
}

function countActiveInjuries(state) {
  return (state?.teams ?? []).reduce((total, team) =>
    total + (team.roster ?? []).filter((player) => Number(player.injuredDays ?? 0) > 0).length,
  0);
}

function averageTeamFatigue(team) {
  const roster = team?.roster ?? [];
  if (!roster.length) return 0;
  const total = roster.reduce((sumValue, player) => sumValue + Number(player.fatigue ?? 0), 0);
  return Math.round(total / roster.length);
}

function waitForUi(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openMailTarget(root, state, target) {
  const value = String(target ?? "");
  if (value.startsWith("player:")) {
    state.ui = {
      ...(state.ui ?? {}),
      selectedPlayerId: value.slice("player:".length),
      selectedPlayerTeamId: state.selectedTeamId || "",
      activeTab: "players"
    };
    render(root, state);
    scrollToPlayerDetail();
    return;
  }
  if (value.startsWith("tab:")) {
    state.ui = {
      ...(state.ui ?? {}),
      activeTab: normalizeActiveTab(value.slice("tab:".length))
    };
    render(root, state);
    resetViewportToTop();
    return;
  }
  if (value.startsWith("mail:")) {
    const mailId = value.slice("mail:".length);
    markMailRead(state, mailId);
    state.ui = {
      ...(state.ui ?? {}),
      selectedMailId: mailId,
      activeTab: "news"
    };
    render(root, state);
  }
}

function setStatus(root, message) {
  const status = root.querySelector("[data-save-status]");
  if (status) {
    status.textContent = message;
  }
}

function setOnboardingStatus(root, message) {
  const status = root.querySelector("[data-onboarding-status]");
  if (status) {
    status.textContent = message;
  }
}

function scrollToGamecast() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    document.getElementById("gamecast")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function scrollToPlayerDetail() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    document.getElementById("player-detail")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function resetViewportToTop() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.scrollTo(0, 0);
  });
}

function renderTeamOptions(state) {
  if (!state.teams.length) {
    return `<option>구단 데이터 준비 중</option>`;
  }

  return state.teams
    .map((team) => {
      const selected = String(team.id) === String(state.selectedTeamId) ? "selected" : "";
      return `<option value="${escapeAttribute(team.id)}" ${selected}>${escapeHtml(getTeamName(team))}</option>`;
    })
    .join("");
}

function renderMetricCard(label, value, detail) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </article>
  `;
}

function renderNextGamePanel(state, selectedTeam, nextGame) {
  if (state.phase === "preseason") {
    const openingDay = openingDayForUiDate(state.currentDate);
    const daysToOpening = daysUntilUiOpening(state.currentDate);
    return `
      <section class="next-game-panel is-preseason-camp" aria-label="프리시즌 캠프 진행">
        <div class="next-game-copy">
          <span class="mini-label">프리시즌 캠프</span>
          <h2>개막 전 경기 없음</h2>
          <p>${escapeHtml(state.currentDate ?? "")} · 개막 ${escapeHtml(openingDay)}까지 ${formatNumber(daysToOpening)}일 · 뉴스함과 보고서를 확인하며 진행</p>
        </div>
        <div class="next-game-matchup">
          <div class="next-game-team is-user is-camp">
            ${renderTeamLogo(selectedTeam, "team-logo mini-logo")}
            <span>${escapeHtml(getTeamShortName(selectedTeam) ?? "KBO")}</span>
          </div>
          <b>캠프</b>
          <div class="next-game-team is-camp">
            <span>NEWS</span>
          </div>
        </div>
        <div class="next-game-actions">
          <button class="button button-primary" data-action="next-day" type="button">캠프 하루 진행</button>
          <button class="button button-soft" data-action="week" type="button">캠프 주간 진행</button>
          <small>경기 시작/스킵은 정규시즌 개막 후 활성화됩니다.</small>
        </div>
      </section>
    `;
  }

  const away = nextGame?.ok ? normalizeGameTeam(nextGame.awayTeamId, state) : null;
  const home = nextGame?.ok ? normalizeGameTeam(nextGame.homeTeamId, state) : null;
  const userIsAway = String(nextGame?.awayTeamId ?? "") === String(selectedTeam?.id ?? state.selectedTeamId);
  const opponent = nextGame?.ok ? (userIsAway ? home : away) : null;
  const disabled = nextGame?.ok ? "" : "disabled";
  const dateText = nextGame?.ok ? nextGame.date : state.currentDate;
  const venueText = nextGame?.ok
    ? `${nextGame.ballpark || getTeamLocation(home)} · ${userIsAway ? "원정" : "홈"}`
    : nextGame?.message ?? "다음 경기를 기다리는 중";
  const currentPlan = getCurrentGameInterventionPlan(state, selectedTeam);

  return `
    <section class="next-game-panel" aria-label="다음 경기 진행">
      <div class="next-game-copy">
        <span class="mini-label">다음 경기</span>
        <h2>${nextGame?.ok ? `${escapeHtml(nextGame.awayShortName)} @ ${escapeHtml(nextGame.homeShortName)}` : "경기 일정 대기"}</h2>
        <p>${escapeHtml(dateText)} · ${escapeHtml(venueText)}</p>
      </div>
      <div class="next-game-matchup">
        ${nextGame?.ok ? `
          <div class="next-game-team ${userIsAway ? "is-user" : ""}">
            ${renderTeamLogo(away, "team-logo mini-logo")}
            <span>${escapeHtml(getTeamShortName(away) ?? "Away")}</span>
          </div>
          <b>VS</b>
          <div class="next-game-team ${!userIsAway ? "is-user" : ""}">
            ${renderTeamLogo(home, "team-logo mini-logo")}
            <span>${escapeHtml(getTeamShortName(home) ?? "Home")}</span>
          </div>
        ` : `
          <div class="next-game-team is-user">
            ${renderTeamLogo(selectedTeam, "team-logo mini-logo")}
            <span>${escapeHtml(getTeamShortName(selectedTeam) ?? "KBO")}</span>
          </div>
        `}
      </div>
      <div class="next-game-actions">
        <button class="button button-primary" data-action="watch-next-game" ${disabled}>경기 시작</button>
        <button class="button button-soft" data-action="simulate-next-game" ${disabled}>스킵</button>
        <small>${nextGame?.ok ? `${escapeHtml(getTeamShortName(opponent) ?? "상대")}전 · 도트 중계로 보거나 결과만 스킵` : "정규시즌 가능 상태에서 진행됩니다."}</small>
      </div>
      <div class="game-plan-strip" aria-label="다음 경기 감독 전략">
        <span>${escapeHtml(currentPlan?.label ?? "균형 운영")}</span>
        ${renderGamePlanButton("balanced", "균형", currentPlan)}
        ${renderGamePlanButton("smallBall", "스몰볼", currentPlan)}
        ${renderGamePlanButton("aggressive", "강공", currentPlan)}
        ${renderGamePlanButton("patient", "출루", currentPlan)}
        ${renderGamePlanButton("bullpenEarly", "불펜", currentPlan)}
      </div>
    </section>
  `;
}

function getCurrentGameInterventionPlan(state, selectedTeam) {
  const teamId = String(selectedTeam?.id ?? state?.selectedTeamId ?? "");
  return teamId ? state?.gameInterventions?.[teamId] ?? null : null;
}

function renderGamePlanButton(preset, label, currentPlan) {
  const active = String(currentPlan?.preset ?? "balanced") === preset ? "is-active" : "";
  return `<button class="game-plan-chip ${active}" data-action="set-game-plan" data-game-plan-preset="${escapeAttribute(preset)}" type="button">${escapeHtml(label)}</button>`;
}

function renderScheduleCalendarPanel(state, selectedTeam, schedule) {
  const leadingBlanks = Array.from({ length: schedule?.firstWeekday ?? 0 }, (_, index) => ({ blank: true, key: `blank-start-${index}` }));
  const dayCells = (schedule?.days ?? []).map((day) => ({ ...day, key: day.date }));
  const trailingCount = Math.max(0, Math.ceil((leadingBlanks.length + dayCells.length) / 7) * 7 - leadingBlanks.length - dayCells.length);
  const trailingBlanks = Array.from({ length: trailingCount }, (_, index) => ({ blank: true, key: `blank-end-${index}` }));
  const cells = [...leadingBlanks, ...dayCells, ...trailingBlanks];
  const gameCount = (schedule?.days ?? []).filter((day) => ["scheduled", "played"].includes(day.status)).length;

  return `
    <section class="schedule-calendar-panel" id="schedule" aria-label="월간 경기 일정">
      <div class="schedule-calendar-head">
        <div>
          <span class="mini-label">시즌 일정</span>
          <h2>${formatNumber(schedule?.month)}월 일정</h2>
          <p>${escapeHtml(getTeamShortName(selectedTeam) ?? "우리 팀")} · ${formatNumber(gameCount)}경기 · ${escapeHtml(schedule?.firstDate ?? "")} ~ ${escapeHtml(schedule?.lastDate ?? "")}</p>
        </div>
        <div class="schedule-calendar-tools" aria-label="일정 월 이동">
          <button class="button button-soft" data-action="calendar-prev" type="button">이전 달</button>
          <button class="button button-soft" data-action="calendar-today" type="button">이번 달</button>
          <button class="button button-soft" data-action="calendar-next" type="button">다음 달</button>
        </div>
      </div>
      <div class="schedule-month-strip" aria-label="월 선택">
        ${renderScheduleMonthStrip(state, schedule)}
      </div>
      <div class="schedule-calendar-scroll">
        <div class="schedule-calendar-grid" data-schedule-calendar>
          ${KOREAN_WEEKDAYS.map((weekday) => `<span class="schedule-weekday">${weekday}요일</span>`).join("")}
          ${cells.map((cell) => cell.blank ? `<div class="schedule-day is-empty" aria-hidden="true"></div>` : renderScheduleDayCell(cell, state, selectedTeam)).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderScheduleMonthStrip(state, schedule) {
  const baseDate = parseUiDate(state?.currentDate ?? schedule?.firstDate ?? "2026-03-01");
  return KBO_CALENDAR_MONTHS.map((month) => {
    const offset = ((schedule?.year ?? baseDate.getUTCFullYear()) - baseDate.getUTCFullYear()) * 12 + (month - 1 - baseDate.getUTCMonth());
    const active = month === schedule?.month ? "is-active" : "";
    return `<button class="schedule-month-chip ${active}" data-action="calendar-month" data-calendar-offset="${escapeAttribute(offset)}" type="button">${formatNumber(month)}월</button>`;
  }).join("");
}

function renderScheduleDayCell(day, state, selectedTeam) {
  const game = day.game ?? null;
  const opponent = game ? normalizeGameTeam(game.opponentTeamId, state) : null;
  const classes = [
    "schedule-day",
    day.isToday ? "is-today" : "",
    day.isPast ? "is-past" : "",
    day.status ? `is-${logTypeClass(day.status)}` : "",
    game?.isHome ? "is-home" : "",
    game && !game.isHome ? "is-away" : ""
  ].filter(Boolean).join(" ");
  const dayLabel = `${formatNumber(day.day)}일`;
  const opponentLabel = getTeamShortName(opponent) ?? game?.opponentShortName ?? "상대";

  if (day.status === "scheduled" || day.status === "played") {
    return `
      <article class="${classes}" data-schedule-cell="${escapeAttribute(day.date)}">
        <span class="schedule-day-number">${formatNumber(day.day)}</span>
        <div class="schedule-game-logo">
          ${renderTeamLogo(opponent, "team-logo schedule-logo")}
        </div>
        <strong>${escapeHtml(game.isHome ? `vs ${opponentLabel}` : `@ ${opponentLabel}`)}</strong>
        <small>${escapeHtml(game.startTime ?? "")}</small>
        ${renderScheduleResult(day)}
      </article>
    `;
  }

  return `
    <article class="${classes}" data-schedule-cell="${escapeAttribute(day.date)}">
      <span class="schedule-day-number">${formatNumber(day.day)}</span>
      <div class="schedule-off-copy">
        <strong>${escapeHtml(scheduleStatusTitle(day.status))}</strong>
        <small>${escapeHtml(scheduleStatusDetail(day.status, dayLabel))}</small>
      </div>
    </article>
  `;
}

function renderScheduleResult(day) {
  if (!day.result) return "";
  const resultClass = logTypeClass(day.result.code);
  return `
    <span class="schedule-result is-${escapeAttribute(resultClass)}">
      ${escapeHtml(day.result.code)} ${formatNumber(day.result.teamScore)}-${formatNumber(day.result.opponentScore)}
    </span>
  `;
}

function scheduleStatusTitle(status) {
  if (status === "rest") return "휴식";
  if (status === "preseason") return "캠프";
  if (status === "season-complete") return "종료";
  if (status === "past") return "지난 일정";
  return "";
}

function scheduleStatusDetail(status, dayLabel) {
  if (status === "rest") return "이동/회복일";
  if (status === "preseason") return "프리시즌";
  if (status === "season-complete") return "정규시즌 완료";
  if (status === "past") return "최근 기록 없음";
  return dayLabel;
}

function renderPlayerDetailPanel(state, entry) {
  if (!entry?.player) return "";
  const { player, team } = entry;
  const pitcher = isPitcher(player);
  const stats = pitcher ? getPitchingStats(player) : getBattingStats(player);
  const groups = buildPlayerAttributeGroups(player);
  const isDefault = Boolean(entry.isDefault);

  return `
    <section class="player-detail-panel" id="player-detail" data-player-detail aria-label="선수 상세 정보">
      <div class="player-detail-hero">
        <div class="player-detail-identity">
          <div class="player-avatar" aria-hidden="true">
            ${renderTeamLogo(team, "team-logo player-avatar-logo")}
            <span>${escapeHtml(player.position ?? (pitcher ? "P" : "B"))}</span>
          </div>
          <div>
            <span class="mini-label">${escapeHtml(team?.name ?? "KBO")} · ${escapeHtml(roleLabel(player.role))}</span>
            <h2>${escapeHtml(player.name)} <small>${escapeHtml(player.uniformNumber ? `#${player.uniformNumber}` : player.position ?? "")}</small></h2>
            <p>${escapeHtml(player.position ?? "-")} · ${formatNumber(player.age)}세 · ${formatBatsThrows(player)} · ${escapeHtml(player.body || player.school || "프로필 정보 확인 중")}</p>
          </div>
        </div>
        <div class="player-detail-actions">
          <span class="player-rating-badge ${attributeLevelClass(player.ovr, 200)}">OVR ${formatNumber(player.ovr)}</span>
          <span class="player-rating-badge ${attributeLevelClass(player.pot, 200)}">POT ${formatNumber(player.pot)}</span>
          ${isDefault ? `<span class="player-detail-hint">대표 선수</span>` : `<button class="button button-soft" data-action="close-player-detail" type="button">닫기</button>`}
        </div>
      </div>

      <div class="player-detail-grid">
        <article class="player-detail-card player-bio-card">
          <span class="mini-label">프로필</span>
          <dl class="player-detail-facts">
            ${renderPlayerFact("상태", playerStatusLabel(player))}
            ${renderPlayerFact("계약", renderPlayerContractLine(player))}
            ${renderPlayerFact("FA", faLabel(player))}
            ${renderPlayerFact("외국인", foreignSlotLabel(player.foreignPlayer?.slotType))}
            ${renderPlayerFact("컨디션", `${formatNumber(player.dailyCondition ?? player.form)} / 피로 ${formatNumber(player.fatigue)}`)}
            ${renderPlayerFact("부상", Number(player.injuredDays ?? 0) > 0 ? `${formatNumber(player.injuredDays)}일` : "없음")}
          </dl>
        </article>

        <article class="player-detail-card player-overview-card">
          <span class="mini-label">요약</span>
          <div class="player-star-line" aria-label="선수 등급">
            ${renderRatingStars(player.ovr, 200)}
          </div>
          ${renderDetailMeter("현재 능력", player.ovr, 200)}
          ${renderDetailMeter("잠재 능력", player.pot, 200)}
          ${renderDetailMeter("경기 감각", player.sharpness ?? player.form, 100)}
          ${renderDetailMeter("체력 여유", 100 - Number(player.fatigue ?? 0), 100)}
        </article>

        <article class="player-detail-card player-personality-card">
          <span class="mini-label">개인성</span>
          ${renderPlayerPersonality(player)}
        </article>

        <article class="player-detail-card player-attribute-card">
          <div class="player-detail-card-head">
            <span class="mini-label">능력치</span>
            <small>높음 빨강 · 강점 파랑 · 보통 초록 · 약점 노랑</small>
          </div>
          <div class="player-attribute-groups">
            ${groups.map(renderPlayerAttributeGroup).join("")}
          </div>
        </article>

        <article class="player-detail-card player-stat-card">
          <span class="mini-label">${escapeHtml(currentSeasonLabel(state))} 시즌 기록</span>
          <div class="player-stat-grid">
            ${pitcher ? renderPitcherDetailStats(stats) : renderBatterDetailStats(stats)}
          </div>
        </article>

        ${renderPlayerCareerCard(state, player, pitcher)}
      </div>
    </section>
  `;
}

function renderPlayerPersonality(player) {
  const personality = player?.personality ?? {};
  const traits = personality.traits ?? {};
  const rows = [
    ["야망", traits.ambition],
    ["충성", traits.loyalty],
    ["압박감", traits.pressure],
    ["프로의식", traits.professionalism],
    ["적응", traits.adaptability],
    ["미디어", traits.mediaTemper]
  ];

  return `
    <div class="player-personality-summary">
      <strong>${escapeHtml(personality.archetype ?? "균형형")}</strong>
      <small>${escapeHtml(personality.roleExpectation ?? "역할 확인 중")} · 클럽하우스 ${formatNumber(personality.clubhouseImpact)}</small>
    </div>
    <div class="personality-trait-grid">
      ${rows.map(([label, value]) => `
        <span>
          <b>${escapeHtml(label)}</b>
          <i class="${attributeLevelClass(value, 20)}" style="--meter:${attributePercent(value, 20)}%"></i>
          <em>${formatNumber(value)}</em>
        </span>
      `).join("")}
    </div>
  `;
}

function renderPlayerFact(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderPlayerContractLine(player) {
  const contract = player?.contract ?? {};
  const salary = contract.salary?.payrollAmountKRW ?? contract.salary?.amountKRW;
  const endSeason = contract.endSeason ? `${formatNumber(contract.endSeason)}년` : "기간 미확인";
  return `${contractTypeLabel(contract.type)} · ${salary ? formatKRWShort(salary) : "금액 미확인"} · ${endSeason}`;
}

function playerStatusLabel(player) {
  if (Number(player?.injuredDays ?? 0) > 0) return `부상 ${formatNumber(player.injuredDays)}일`;
  if (player?.status === "active") return "1군 등록";
  if (player?.status === "futures") return "퓨처스";
  if (player?.status === "registered") return "등록";
  if (player?.status === "released") return "방출";
  if (player?.status === "retired") return "은퇴";
  return player?.status ? String(player.status) : "확인 필요";
}

function renderRatingStars(value, max = 200) {
  const rating = Math.max(0, Math.min(5, Math.round((Number(value ?? 0) / max) * 5)));
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < rating ? "is-filled" : ""}">★</span>`).join("");
}

function renderDetailMeter(label, value, max = 100) {
  const percent = attributePercent(value, max);
  return `
    <div class="player-detail-meter">
      <span>${escapeHtml(label)}</span>
      <b>${formatNumber(value)}</b>
      <i class="${attributeLevelClass(value, max)}" style="--meter: ${percent}%"></i>
    </div>
  `;
}

function buildPlayerAttributeGroups(player) {
  if (isPitcher(player)) {
    return [
      {
        title: "투구",
        attributes: [
          ["구위", player.stuff],
          ["구속", player.velocity],
          ["무브먼트", player.movement],
          ["제구", player.control],
          ["피홈런 억제", player.hrSuppression],
          ["투구 IQ", player.pitchingIQ],
          ["스태미나", player.stamina],
          ["주자 견제", player.holdRunner]
        ]
      },
      {
        title: "수비/운동",
        attributes: [
          ["수비", player.defense],
          ["범위", player.range],
          ["송구", player.arm],
          ["스피드", player.speed],
          ["체력", player.armFreshness, 100],
          ["컨디션", player.dailyCondition ?? player.form, 100]
        ]
      }
    ];
  }

  return [
    {
      title: "타격",
      attributes: [
        ["컨택 vL", player.contactL ?? player.contact],
        ["컨택 vR", player.contactR ?? player.contact],
        ["파워 vL", player.powerL ?? player.power],
        ["파워 vR", player.powerR ?? player.power],
        ["선구안", player.eye],
        ["참을성", player.patience],
        ["타구질", player.battedBall],
        ["작전 수행", player.situational]
      ]
    },
    {
      title: "주루/수비",
      attributes: [
        ["스피드", player.speed],
        ["도루", player.stealing],
        ["주루", player.baserunning],
        ["수비", player.defense],
        ["범위", player.range],
        ["송구", player.arm],
        ["포구", player.catching],
        ["번트", player.bunting]
      ]
    }
  ];
}

function renderPlayerAttributeGroup(group) {
  return `
    <section class="player-attribute-group">
      <h3>${escapeHtml(group.title)}</h3>
      <div class="player-attribute-list">
        ${group.attributes.map(([label, value, max]) => renderPlayerAttribute(label, value, max ?? 20)).join("")}
      </div>
    </section>
  `;
}

function renderPlayerAttribute(label, value, max = 20) {
  const number = Number(value ?? 0);
  const safeValue = Number.isFinite(number) ? number : 0;
  const levelClass = attributeLevelClass(safeValue, max);
  return `
    <div class="player-attribute ${levelClass}">
      <span>${escapeHtml(label)}</span>
      <strong>${formatNumber(safeValue)}</strong>
      <i style="--meter: ${attributePercent(safeValue, max)}%"></i>
    </div>
  `;
}

function renderBatterDetailStats(stats) {
  return [
    ["AVG", formatRateStat(battingAverage(stats))],
    ["OBP", formatRateStat(onBasePercentage(stats))],
    ["SLG", formatRateStat(sluggingPercentage(stats))],
    ["OPS", formatRateStat(ops(stats))],
    ["G", formatNumber(stats.games)],
    ["H", formatNumber(stats.hits)],
    ["HR", formatNumber(stats.homeRuns)],
    ["RBI", formatNumber(stats.rbi)],
    ["BB", formatNumber(stats.walks)],
    ["SO", formatNumber(stats.strikeouts)],
    ["SB", formatNumber(stats.stolenBases)],
    ["CS", formatNumber(stats.caughtStealing)]
  ].map(renderPlayerStat).join("");
}

function renderPitcherDetailStats(stats) {
  return [
    ["ERA", formatEra(stats)],
    ["IP", formatInnings(stats.inningsOuts)],
    ["W-L", `${formatNumber(stats.wins)}-${formatNumber(stats.losses)}`],
    ["SV", formatNumber(stats.saves)],
    ["HLD", formatNumber(stats.holds)],
    ["K", formatNumber(stats.strikeouts)],
    ["BB", formatNumber(stats.walksAllowed)],
    ["HR", formatNumber(stats.homeRunsAllowed)],
    ["P", formatNumber(stats.pitches)],
    ["BF", formatNumber(stats.battersFaced)]
  ].map(renderPlayerStat).join("");
}

function renderPlayerCareerCard(state, player, pitcher) {
  const rows = buildPlayerCareerRows(state, player);
  return `
    <article class="player-detail-card player-career-card">
      <div class="player-detail-card-head">
        <span class="mini-label">커리어</span>
        <small>${formatNumber(rows.length)}시즌</small>
      </div>
      <div class="table-wrap">
        <table class="standings-table record-table career-table">
          <thead>
            ${pitcher
              ? `<tr><th>Year</th><th>Team</th><th>ERA</th><th>IP</th><th>W</th><th>SV</th><th>HLD</th><th>K</th><th>Awards</th></tr>`
              : `<tr><th>Year</th><th>Team</th><th>AVG</th><th>OPS</th><th>HR</th><th>RBI</th><th>SB</th><th>H</th><th>Awards</th></tr>`}
          </thead>
          <tbody>
            ${rows.length ? rows.map((row) => pitcher ? renderPitcherCareerRow(row) : renderBatterCareerRow(row)).join("") : renderEmptyTableRow("저장된 시즌 기록이 아직 없습니다.", 9)}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function buildPlayerCareerRows(state, player) {
  const currentSeason = Number(String(state?.currentDate ?? "").slice(0, 4)) || 2026;
  const current = {
    season: currentSeason,
    year: currentSeason,
    teamId: player?.teamId ?? "",
    teamShortName: currentSeasonLabel(state),
    batting: player?.seasonStats?.batting ?? {},
    pitching: player?.seasonStats?.pitching ?? {},
    fielding: player?.seasonStats?.fielding ?? {},
    awards: [],
    current: true
  };
  const history = Array.isArray(player?.history) ? player.history : [];
  return [current, ...history]
    .filter((row, index, rows) => rows.findIndex((candidate) => safeSeason(candidate) === safeSeason(row)) === index)
    .sort((a, b) => safeSeason(b) - safeSeason(a));
}

function renderBatterCareerRow(row) {
  const batting = row.batting ?? {};
  return `
    <tr>
      <td>${formatNumber(row.season ?? row.year)}</td>
      <td>${escapeHtml(row.current ? "현재" : row.teamShortName ?? row.teamName ?? row.teamId ?? "")}</td>
      <td>${formatRateStat(battingAverage(batting))}</td>
      <td>${formatRateStat(ops(batting))}</td>
      <td>${formatNumber(batting.homeRuns)}</td>
      <td>${formatNumber(batting.rbi)}</td>
      <td>${formatNumber(batting.stolenBases)}</td>
      <td>${formatNumber(batting.hits)}</td>
      <td>${escapeHtml(formatCareerAwards(row.awards))}</td>
    </tr>
  `;
}

function renderPitcherCareerRow(row) {
  const pitching = row.pitching ?? {};
  return `
    <tr>
      <td>${formatNumber(row.season ?? row.year)}</td>
      <td>${escapeHtml(row.current ? "현재" : row.teamShortName ?? row.teamName ?? row.teamId ?? "")}</td>
      <td>${formatEra(pitching)}</td>
      <td>${formatInnings(pitching.inningsOuts)}</td>
      <td>${formatNumber(pitching.wins)}</td>
      <td>${formatNumber(pitching.saves)}</td>
      <td>${formatNumber(pitching.holds)}</td>
      <td>${formatNumber(pitching.strikeouts)}</td>
      <td>${escapeHtml(formatCareerAwards(row.awards))}</td>
    </tr>
  `;
}

function formatCareerAwards(awards = []) {
  const labels = (Array.isArray(awards) ? awards : [])
    .map((award) => award.slotLabel ?? award.label ?? "")
    .filter(Boolean);
  return labels.length ? labels.join(", ") : "-";
}

function safeSeason(row) {
  const season = Number(row?.season ?? row?.year ?? 0);
  return Number.isFinite(season) ? season : 0;
}

function renderPlayerStat([label, value]) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function attributeLevelClass(value, max = 20) {
  const ratio = Number(value ?? 0) / Math.max(1, Number(max || 1));
  if (ratio >= 0.82) return "is-elite";
  if (ratio >= 0.68) return "is-strong";
  if (ratio >= 0.5) return "is-average";
  if (ratio >= 0.32) return "is-weak";
  return "is-poor";
}

function attributePercent(value, max = 20) {
  const number = Number(value ?? 0);
  const denominator = Math.max(1, Number(max || 1));
  if (!Number.isFinite(number)) return 0;
  return Math.max(3, Math.min(100, Math.round(number / denominator * 100)));
}

function renderFrontOfficePanels(frontOffice) {
  const { rosterSummary, contractSummary, depthNeeds, prospectWatch, payrollPressure, scoutBoard, tradeBlock } = frontOffice;

  return `
    <section class="content-grid front-office-grid" id="front-office" aria-label="프런트오피스">
      <article class="panel front-office-panel roster-summary-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">프런트</span>
            <h2>요약</h2>
          </div>
          <span class="pill">${formatNumber(rosterSummary.totalPlayers)}명</span>
        </div>
        <ol class="player-list compact front-office-list">
          ${renderOfficeFact("인원", `${formatNumber(rosterSummary.totalPlayers)}명`, `투수 ${formatNumber(rosterSummary.pitchers)} · 야수 ${formatNumber(rosterSummary.hitters)}`, formatNumber(rosterSummary.totalPlayers))}
          ${renderOfficeFact("평균", `나이 ${formatAverage(rosterSummary.averageAge)}세`, `OVR ${formatAverage(rosterSummary.averageOvr)} · POT ${formatAverage(rosterSummary.averagePot)}`, renderOvrPot(rosterSummary))}
          ${renderOfficeFact("연봉", formatMoney(payrollPressure.payroll), `여유 ${formatMoneyRoom(payrollPressure.room)}`, formatPressureLevel(payrollPressure.level))}
          ${renderSummaryTopPlayer(rosterSummary.topPlayers?.[0])}
        </ol>
      </article>

      <article class="panel front-office-panel contract-panel" id="contracts">
        <div class="panel-head">
          <div>
            <span class="mini-label">계약</span>
            <h2>연봉/FA</h2>
          </div>
          <span class="pill">${formatKRWShort(contractSummary.totalPayrollKRW)}</span>
        </div>
        ${renderContractSnapshot(contractSummary)}
      </article>

      <article class="panel front-office-panel depth-needs-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">로스터</span>
            <h2>뎁스</h2>
          </div>
          <span class="pill">${formatNumber(depthNeeds.needs.length)}곳</span>
        </div>
        <ol class="player-list compact front-office-list">
          ${renderDepthNeedList(depthNeeds.needs)}
        </ol>
      </article>

      <article class="panel front-office-panel prospect-watch-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">팜</span>
            <h2>유망주</h2>
          </div>
          <span class="pill">${formatNumber(prospectWatch.candidateCount)}명</span>
        </div>
        <ol class="player-list compact front-office-list">
          ${renderOfficePlayerList(prospectWatch.players, "유망주 없음")}
        </ol>
      </article>

      <article class="panel front-office-panel scout-board-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">스카우트</span>
            <h2>보드</h2>
          </div>
          <span class="pill">${formatNumber(scoutBoard.targets.length)}명</span>
        </div>
        <ol class="player-list compact front-office-list">
          ${renderOfficePlayerList(scoutBoard.targets, "후보 없음", { showTeam: true })}
        </ol>
      </article>

      <article class="panel front-office-panel trade-block-panel">
        <div class="panel-head">
          <div>
            <span class="mini-label">시장</span>
            <h2>트레이드 블록</h2>
          </div>
          <span class="pill">${formatNumber(tradeBlock.players.length)}명</span>
        </div>
        <ol class="player-list compact front-office-list">
          ${renderOfficePlayerList(tradeBlock.players, "매물 없음")}
        </ol>
      </article>
    </section>
  `;
}

function renderPostseasonPanel(state, standings) {
  const postseason = state.postseason;
  const seeds = postseason?.seeds?.length ? postseason.seeds : standings.slice(0, 5).map((team, index) => ({
    seed: index + 1,
    teamId: team.id,
    name: getTeamName(team),
    shortName: getTeamShortName(team),
    wins: Number(team.wins ?? 0),
    losses: Number(team.losses ?? 0),
    ties: Number(team.ties ?? 0)
  }));
  const series = postseason?.series ?? buildPostseasonPreviewSeries(seeds);
  const awards = state.awards;
  const championText = postseason?.championName
    ? `${postseason.championSeed}위 ${postseason.championName} 우승`
    : postseason?.status === "active"
      ? "진행 중"
      : "대진 대기";

  return `
    <section class="postseason-panel" id="postseason" aria-label="포스트시즌과 시상식">
      <div class="panel-head">
        <div>
          <span class="mini-label">가을야구</span>
          <h2>포스트시즌 / 시상식</h2>
        </div>
        <span class="pill">${escapeHtml(championText)}</span>
      </div>
      <div class="postseason-summary">
        <span>TOP5 ${seeds.map((seed) => `${seed.seed}.${seed.shortName ?? seed.name}`).join(" · ") || "대기"}</span>
        <span>WC 4위 1승 어드밴티지</span>
        <span>준PO/PO 5전3선승 · KS 7전4선승</span>
      </div>
      <div class="postseason-bracket">
        ${series.map(renderSeriesCard).join("")}
      </div>
      ${renderAwardsPanel(awards)}
    </section>
  `;
}

function buildPostseasonPreviewSeries(seeds) {
  const bySeed = new Map(seeds.map((seed) => [seed.seed, seed]));
  return [
    { id: "wild-card", label: "와일드카드", shortLabel: "WC", status: "preview", winsNeeded: 2, higherSeedStartingWins: 1, participants: [bySeed.get(4), bySeed.get(5)], wins: { [bySeed.get(4)?.teamId]: 1 }, games: [] },
    { id: "semi-playoff", label: "준플레이오프", shortLabel: "준PO", status: "waiting", winsNeeded: 3, participants: [bySeed.get(3), null], wins: {}, games: [] },
    { id: "playoff", label: "플레이오프", shortLabel: "PO", status: "waiting", winsNeeded: 3, participants: [bySeed.get(2), null], wins: {}, games: [] },
    { id: "korean-series", label: "한국시리즈", shortLabel: "KS", status: "waiting", winsNeeded: 4, participants: [bySeed.get(1), null], wins: {}, games: [] }
  ];
}

function renderSeriesCard(series) {
  const classes = [
    "series-card",
    series.status === "active" ? "is-active" : "",
    series.status === "complete" ? "is-complete" : ""
  ].filter(Boolean).join(" ");
  const games = series.games ?? [];
  return `
    <article class="${classes}">
      <div>
        <span class="mini-label">${escapeHtml(series.shortLabel ?? series.label)}</span>
        <h3>${escapeHtml(series.label)}</h3>
      </div>
      <div class="series-teams">
        ${(series.participants ?? []).map((participant) => renderSeriesTeam(participant, series)).join("")}
      </div>
      <div class="series-games">
        ${games.length ? games.map((game) => renderSeriesGamePill(game, series)).join("") : `<span class="series-game-pill">${escapeHtml(seriesStatusLabel(series.status))}</span>`}
      </div>
    </article>
  `;
}

function renderSeriesTeam(participant, series) {
  if (!participant) {
    return `
      <div class="series-team">
        <span>다음 라운드 승자</span>
        <b>-</b>
      </div>
    `;
  }
  const isWinner = String(series.winnerTeamId ?? "") === String(participant.teamId);
  const wins = Number(series.wins?.[participant.teamId] ?? 0);
  return `
    <div class="series-team ${isWinner ? "is-winner" : ""}">
      <span>${formatNumber(participant.seed)}위 ${escapeHtml(participant.shortName ?? participant.name)}</span>
      <b>${formatNumber(wins)}</b>
    </div>
  `;
}

function renderSeriesGamePill(game, series) {
  const winner = (series.participants ?? []).find((participant) => String(participant?.teamId) === String(game.winnerTeamId));
  return `
    <span class="series-game-pill is-winner">
      G${formatNumber(game.gameNumber)} ${escapeHtml(winner?.shortName ?? winner?.name ?? "승")} ${formatNumber(game.awayScore)}-${formatNumber(game.homeScore)}
    </span>
  `;
}

function renderAwardsPanel(awards) {
  const regular = awards?.regularSeason;
  const cards = [
    regular?.mvp ? renderAwardCard(regular.mvp, { featured: true, mark: "M" }) : "",
    regular?.rookieOfYear ? renderAwardCard(regular.rookieOfYear, { mark: "R" }) : "",
    awards?.postseason?.koreanSeriesMvp ? renderAwardCard(awards.postseason.koreanSeriesMvp, { mark: "K" }) : "",
    ...(regular?.goldenGloves ?? []).slice(0, 10).map((winner) => renderAwardCard(winner, { mark: "G" }))
  ].filter(Boolean);

  return `
    <div class="award-grid">
      ${cards.length ? cards.join("") : `<div class="empty-card">정규시즌이 끝나면 MVP, 신인왕, 골든글러브가 발표됩니다.</div>`}
    </div>
  `;
}

function renderDraftPanel(state) {
  const draft = state.draft;
  const board = draft?.prospects ?? buildDraftPreviewProspects();
  const selectedTeamId = state.selectedTeamId;
  const roleFilter = normalizeDraftRoleFilter(state.ui?.draftRoleFilter);
  const pendingPick = draft?.pendingUserPick?.status === "open" && String(draft.pendingUserPick.teamId) === String(selectedTeamId)
    ? draft.pendingUserPick
    : null;
  const filteredBoard = board
    .filter((prospect) => roleFilter === "all" || String(prospect.role) === roleFilter)
    .filter((prospect) => !prospect.picked || String(prospect.selectedByTeamId ?? "") === String(selectedTeamId));
  const userPicks = (draft?.picks ?? []).filter((pick) => String(pick.teamId) === String(selectedTeamId));
  const orderText = draft?.order?.length
    ? draft.order.map((team) => team.shortName ?? team.name).join(" > ")
    : "정규시즌 종료 후 확정";
  const statusText = draft?.status === "complete"
    ? `${formatNumber(draft.picks.length)}명 지명 완료`
    : draft?.status === "ready"
      ? `${formatNumber(draft.prospects.length)}명 보드 준비`
      : "보드 대기";

  return `
    <section class="draft-panel" id="draft" aria-label="신인 드래프트">
      <div class="panel-head">
        <div>
          <span class="mini-label">신인 시장</span>
          <h2>드래프트 보드</h2>
        </div>
        <span class="pill">${escapeHtml(statusText)}</span>
      </div>
      <div class="draft-summary">
        <span>11라운드 · 최대 110명 지명</span>
        <span>후보 풀 ${formatNumber(draft?.poolSize ?? 150)}명</span>
        <span>실명 검증 전 후보 코드만 사용</span>
      </div>
      <div class="draft-command-row">
        <button class="button button-soft" data-action="draft" type="button">${draft ? "보드 새로 보기" : "보드 생성"}</button>
        <button class="button button-primary" data-action="draft-to-user-pick" type="button" ${draft?.status === "ready" ? "" : "disabled"}>내 차례까지 진행</button>
        <button class="button button-soft" data-action="draft-auto-complete" type="button" ${draft?.status === "ready" ? "" : "disabled"}>전체 자동</button>
        <div class="draft-filter-row" role="tablist" aria-label="드래프트 후보 필터">
          ${["all", "pitcher", "hitter"].map((filter) => `
            <button class="draft-filter ${roleFilter === filter ? "is-active" : ""}" data-action="draft-role-filter" data-draft-role="${escapeAttribute(filter)}" type="button">
              ${escapeHtml(draftRoleFilterLabel(filter))}
            </button>
          `).join("")}
        </div>
      </div>
      ${pendingPick ? renderDraftPendingPick(pendingPick) : ""}
      <div class="draft-strategy-grid">
        <article>
          <span class="mini-label">지명 순서</span>
          <strong>${escapeHtml(orderText)}</strong>
          <small>전면 드래프트 v1 · 전년도 성적 역순 기반</small>
        </article>
        <article>
          <span class="mini-label">우리 전략</span>
          ${renderDraftStrategy(state, draft)}
        </article>
        <article>
          <span class="mini-label">우리 지명</span>
          <strong>${formatNumber(userPicks.length)}명</strong>
          <small>${userPicks[0] ? `${escapeHtml(userPicks[0].displayCode)} · ${escapeHtml(userPicks[0].profile)}` : "드래프트 진행 전"}</small>
        </article>
      </div>
      <div class="draft-board-grid">
        ${filteredBoard.slice(0, 20).map((prospect) => renderDraftCard(prospect, selectedTeamId, Boolean(pendingPick))).join("")}
      </div>
      <ol class="draft-pick-list">
        ${draft?.picks?.length ? draft.picks.slice(0, 14).map(renderDraftPick).join("") : renderEmptyListItem("드래프트 버튼을 누르면 1라운드부터 결과가 쌓입니다.")}
      </ol>
    </section>
  `;
}

function renderDraftPendingPick(pendingPick) {
  return `
    <div class="draft-pending-banner">
      <strong>${escapeHtml(pendingPick.teamName)} ${formatNumber(pendingPick.round)}R ${formatNumber(pendingPick.pickInRound)}번</strong>
      <small>후보 카드의 지명 버튼으로 직접 선택하세요.</small>
    </div>
  `;
}

function buildDraftPreviewProspects() {
  return Array.from({ length: 8 }, (_, index) => ({
    displayCode: `DRF-2027-${String(index + 1).padStart(3, "0")}`,
    role: index % 2 === 0 ? "pitcher" : "hitter",
    position: index % 2 === 0 ? "P" : index % 3 === 0 ? "IF" : "OF",
    classType: index % 3 === 0 ? "대학" : "고교",
    profile: index % 2 === 0 ? "RHP 선발형" : "OF 밸런스형",
    presentGrade: 40 + index,
    futureGrade: 60 + Math.max(0, 4 - index) * 5,
    certainty: 50 + index * 3,
    risk: 42 - index,
    picked: false,
    selectedByTeamId: null
  }));
}

function renderDraftStrategy(state, draft) {
  const selectedTeam = getSelectedTeam(state);
  const strategy = draft?.strategies?.[selectedTeam?.id];
  if (!strategy) {
    return `
      <strong>시즌 종료 후 확정</strong>
      <small>현재 로스터 needs를 기준으로 자동 생성됩니다.</small>
    `;
  }

  return `
    <strong>${escapeHtml(strategy.focus)}</strong>
    <small>${escapeHtml(strategy.preferredPositions.join(" / "))} · 리스크 허용 ${formatNumber(strategy.riskTolerance)}</small>
  `;
}

function renderDraftCard(prospect, selectedTeamId, canPick = false) {
  const classes = [
    "draft-card",
    prospect.picked ? "is-picked" : "",
    String(prospect.selectedByTeamId ?? "") === String(selectedTeamId) ? "is-user-fit" : ""
  ].filter(Boolean).join(" ");
  return `
    <article class="${classes}">
      <div>
        <span class="mini-label">${escapeHtml(prospect.classType)} · ${escapeHtml(prospect.position)} · ${formatNumber(prospect.age)}세</span>
        <h3>${escapeHtml(prospect.displayCode)}</h3>
      </div>
      <p>${escapeHtml(prospect.profile)} · ${escapeHtml(roleLabel(prospect.role))}</p>
      <div class="draft-chip-row">
        <span class="scout-grade">현재 ${formatNumber(prospect.presentGrade)}</span>
        <span class="scout-grade">미래 ${formatNumber(prospect.futureGrade)}</span>
        <span class="scout-grade">확실 ${formatNumber(prospect.certainty)}</span>
      </div>
      <div class="draft-meter" aria-label="잠재력">
        <span class="draft-meter-fill" style="--draft-meter: ${clampPercent(prospect.futureGrade)}%"></span>
      </div>
      <div class="draft-card-actions">
        <small>${prospect.picked ? `${formatNumber(prospect.pickNumber)}픽 · ${escapeHtml(prospect.selectedByTeamName)}` : "스카우트 코드 후보"}</small>
        ${canPick && !prospect.picked ? `<button class="button button-primary" data-action="commit-draft-pick" data-prospect-id="${escapeAttribute(prospect.id)}" type="button">지명</button>` : ""}
      </div>
    </article>
  `;
}

function renderDraftPick(pick) {
  return `
    <li class="draft-pick">
      <span class="order">${formatNumber(pick.pickNumber)}</span>
      <span>
        <strong>${escapeHtml(pick.teamName)} · ${escapeHtml(pick.displayCode)}</strong>
        <small>${formatNumber(pick.round)}R ${formatNumber(pick.pickInRound)}번 · ${escapeHtml(pick.position)} · ${escapeHtml(pick.profile)}</small>
      </span>
      <b>${formatNumber(pick.futureGrade)}</b>
    </li>
  `;
}

function renderSecondaryDraftPanel(state) {
  const draft = state.secondaryDraft;
  const selectedTeam = getSelectedTeam(state);
  const selectedTeamId = selectedTeam?.id ?? state.selectedTeamId;
  const protection = draft?.protections?.[selectedTeamId] ?? buildSecondaryDraftPreview(selectedTeam);
  const pendingPick = draft?.pendingUserPick?.status === "open" && String(draft.pendingUserPick.teamId) === String(selectedTeamId)
    ? draft.pendingUserPick
    : null;
  const selectedPicks = (draft?.picks ?? []).filter((pick) => String(pick.teamId) === String(selectedTeamId));
  const lostPlayers = (draft?.picks ?? []).filter((pick) => String(pick.fromTeamId) === String(selectedTeamId));
  const cards = [
    ...(protection.protected ?? []).slice(0, 4),
    ...(protection.exposed ?? []).slice(0, 8)
  ];
  const originPickCounts = buildSecondaryOriginPickCounts(draft);
  const candidatePool = (draft?.exposurePool ?? [])
    .filter((player) => !player.picked && String(player.teamId) !== String(selectedTeamId))
    .filter((player) => (originPickCounts.get(String(player.teamId)) ?? 0) < 4)
    .slice(0, 20);
  const orderText = draft?.order?.length
    ? draft.order.map((team) => team.shortName ?? team.name).join(" > ")
    : "시즌 종료 후 확정";
  const statusText = draft?.status === "complete"
    ? `${formatNumber(draft.picks.length)}명 지명`
    : draft?.status === "ready"
      ? `비보호 ${formatNumber(draft.exposurePool.length)}명`
      : "보호명단 대기";

  return `
    <section class="secondary-draft-panel" id="secondary-draft" aria-label="2차 드래프트">
      <div class="panel-head">
        <div>
          <span class="mini-label">스토브리그</span>
          <h2>2차 드래프트</h2>
        </div>
        <span class="pill">${escapeHtml(statusText)}</span>
      </div>
      <div class="secondary-draft-summary">
        <span>35인 보호명단</span>
        <span>기본 3라운드 · 하위 3팀 추가</span>
        <span>원소속팀 피지명 최대 4명</span>
      </div>
      <div class="draft-command-row">
        <button class="button button-soft" data-action="secondary-draft" type="button">${draft ? "보호명단 보기" : "보호명단 생성"}</button>
        <button class="button button-primary" data-action="secondary-to-user-pick" type="button" ${draft?.status === "ready" ? "" : "disabled"}>내 차례까지 진행</button>
        <button class="button button-soft" data-action="secondary-auto-complete" type="button" ${draft?.status === "ready" ? "" : "disabled"}>전체 자동</button>
      </div>
      ${pendingPick ? renderSecondaryPendingPick(pendingPick) : ""}
      <div class="secondary-strategy-grid">
        <article>
          <span class="mini-label">지명 순서</span>
          <strong>${escapeHtml(orderText)}</strong>
          <small>정규시즌 역순 · 하위 3팀 추가 라운드</small>
        </article>
        <article>
          <span class="mini-label">우리 보호</span>
          <strong>${formatNumber(protection.protectedCount ?? protection.protected?.length ?? 0)}명 보호 · ${formatNumber(protection.exposedCount ?? protection.exposed?.length ?? 0)}명 노출</strong>
          <small>제외 ${formatNumber(protection.hardExcludedCount ?? protection.hardExcluded?.length ?? 0)}명 · 보호선수 35명 기준</small>
        </article>
        <article>
          <span class="mini-label">우리 결과</span>
          <strong>획득 ${formatNumber(selectedPicks.length)}명 · 유출 ${formatNumber(lostPlayers.length)}명</strong>
          <small>${selectedPicks[0] ? `${escapeHtml(selectedPicks[0].name)} from ${escapeHtml(selectedPicks[0].fromTeamName)}` : "진행 전"}</small>
        </article>
      </div>
      <div class="secondary-draft-note">
        현재 MVP 로스터 531명 기준 v1입니다. 외국인/FA 시장 선수는 제외하고, 입단연차 자동 제외는 공식 원장 확장 후 엄격 적용합니다.
      </div>
      <div class="protection-grid">
        ${cards.length ? cards.map((player) => renderProtectionCard(player, draft?.status === "ready" && !(draft.picks?.length))).join("") : `<div class="empty-card">보호명단을 기다리고 있어요.</div>`}
      </div>
      ${pendingPick ? `
        <div class="protection-grid secondary-candidate-grid">
          ${candidatePool.length ? candidatePool.map(renderSecondaryCandidateCard).join("") : `<div class="empty-card">지명 가능한 비보호 선수가 없습니다.</div>`}
        </div>
      ` : ""}
      <ol class="secondary-pick-list">
        ${draft?.picks?.length ? draft.picks.slice(0, 14).map(renderSecondaryPick).join("") : renderEmptyListItem("2차 드래프트 버튼을 누르면 지명 결과가 쌓입니다.")}
      </ol>
    </section>
  `;
}

function renderSecondaryPendingPick(pendingPick) {
  return `
    <div class="draft-pending-banner">
      <strong>${escapeHtml(pendingPick.teamName)} 2차 ${formatNumber(pendingPick.round)}R ${formatNumber(pendingPick.pickInRound)}번</strong>
      <small>비보호 후보 카드의 지명 버튼으로 직접 선택하세요.</small>
    </div>
  `;
}

function buildSecondaryOriginPickCounts(draft) {
  const counts = new Map();
  for (const pick of draft?.picks ?? []) {
    const key = String(pick.fromTeamId ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildSecondaryDraftPreview(team) {
  const ranked = [...(team?.roster ?? [])]
    .map((player) => ({
      playerId: player.id,
      name: player.name,
      teamId: team?.id ?? "",
      teamName: team?.name ?? "",
      teamShortName: team?.shortName ?? team?.name ?? "",
      role: player.role,
      position: player.position,
      age: Number(player.age ?? 0),
      ovr: Number(player.ovr ?? 0),
      pot: Number(player.pot ?? 0),
      salaryKRW: Number(player.contract?.salary?.payrollAmountKRW ?? 0),
      serviceSeasons: Number(player.serviceTime?.seasonsAccrued ?? 0),
      protectionScore: Number(player.ovr ?? 0) + Number(player.pot ?? 0) * 0.5,
      status: "eligible"
    }))
    .sort((a, b) => b.protectionScore - a.protectionScore || b.ovr - a.ovr || a.name.localeCompare(b.name));
  return {
    protected: ranked.slice(0, 35).map((player) => ({ ...player, status: "protected", reason: "club-protected-35" })),
    exposed: ranked.slice(35).map((player) => ({ ...player, status: "exposed", reason: "outside-protected-35" })),
    hardExcluded: [],
    protectedCount: Math.min(35, ranked.length),
    exposedCount: Math.max(0, ranked.length - 35),
    hardExcludedCount: 0
  };
}

function renderProtectionCard(player, editable = false) {
  const classes = [
    "protection-card",
    player.status === "protected" ? "is-protected" : "",
    player.status === "exposed" ? "is-exposed" : ""
  ].filter(Boolean).join(" ");
  const scorePercent = clampPercent(Math.round(Number(player.protectionScore ?? 0) / 2.6));
  return `
    <article class="${classes}">
      <div>
        <span class="mini-label">${escapeHtml(secondaryStatusLabel(player.status))} · ${escapeHtml(player.position)}</span>
        <h3>${escapeHtml(player.name)}</h3>
      </div>
      <p>${escapeHtml(roleLabel(player.role))} · ${formatNumber(player.age)}세 · ${escapeHtml(player.teamShortName ?? player.teamName)}</p>
      <div class="eligibility-chip-row">
        <span>OVR ${formatNumber(player.ovr)}</span>
        <span>POT ${formatNumber(player.pot)}</span>
        <span>${formatKRWShort(player.salaryKRW)}</span>
      </div>
      <div class="protection-meter" aria-label="보호 점수">
        <span class="protection-meter-fill" style="--protection-meter: ${scorePercent}%"></span>
      </div>
      <small>${escapeHtml(secondaryReasonLabel(player.reason))}</small>
      ${editable && ["protected", "exposed"].includes(player.status)
        ? `<button class="button button-soft" data-action="toggle-secondary-protection" data-player-id="${escapeAttribute(player.playerId)}" data-protection-status="${escapeAttribute(player.status)}" type="button">${player.status === "protected" ? "노출" : "보호"}</button>`
        : ""}
    </article>
  `;
}

function renderSecondaryCandidateCard(player) {
  return `
    <article class="protection-card is-exposed">
      <div>
        <span class="mini-label">${escapeHtml(player.teamShortName ?? player.teamName)} · ${escapeHtml(player.position)}</span>
        <h3>${escapeHtml(player.name)}</h3>
      </div>
      <p>${escapeHtml(roleLabel(player.role))} · ${formatNumber(player.age)}세 · OVR ${formatNumber(player.ovr)} / POT ${formatNumber(player.pot)}</p>
      <div class="eligibility-chip-row">
        <span>보호점 ${formatNumber(player.protectionScore)}</span>
        <span>획득점 ${formatNumber(player.acquisitionScore)}</span>
      </div>
      <button class="button button-primary" data-action="commit-secondary-pick" data-player-id="${escapeAttribute(player.playerId)}" type="button">지명</button>
    </article>
  `;
}

function renderSecondaryPick(pick) {
  return `
    <li class="secondary-pick">
      <span class="order">${formatNumber(pick.pickNumber)}</span>
      <span>
        <strong>${escapeHtml(pick.teamName)} · ${escapeHtml(pick.name)}</strong>
        <small>${formatNumber(pick.round)}R ${formatNumber(pick.pickInRound)}번 · ${escapeHtml(pick.fromTeamName)} · ${escapeHtml(pick.position)} · ${formatKRWShort(pick.compensationKRW)}</small>
      </span>
      <b>${formatNumber(pick.ovr)}</b>
    </li>
  `;
}

function secondaryStatusLabel(status) {
  if (status === "protected") return "보호";
  if (status === "exposed") return "비보호";
  if (status === "hardExcluded") return "제외";
  return "대상";
}

function secondaryReasonLabel(reason) {
  if (reason === "club-protected-35") return "구단 보호명단";
  if (reason === "outside-protected-35") return "지명 가능";
  if (reason === "foreign-player") return "외국인 제외";
  if (reason === "fa-market-player") return "FA 시장 제외";
  return "2차 드래프트 대상";
}

function renderAwardCard(winner, options = {}) {
  return `
    <article class="award-card ${options.featured ? "featured" : ""}">
      <span class="trophy-mark">${escapeHtml(options.mark ?? awardInitial(winner.slotLabel))}</span>
      <div>
        <span class="mini-label">${escapeHtml(winner.slotLabel)}</span>
        <h3>${escapeHtml(winner.name)}</h3>
      </div>
      <p class="award-meta">${escapeHtml(winner.teamShortName ?? winner.teamName)} · ${escapeHtml(winner.position || "-")} · OVR ${formatNumber(winner.ovr)} · POT ${formatNumber(winner.pot)}</p>
      <small>${escapeHtml(winner.line ?? "")}</small>
    </article>
  `;
}

function renderOfficeFact(label, title, detail, badge) {
  return `
    <li>
      <span class="order">${escapeHtml(label)}</span>
      <span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>
      <b>${escapeHtml(badge)}</b>
    </li>
  `;
}

function renderSummaryTopPlayer(player) {
  if (!player) {
    return renderEmptyListItem("핵심 선수 없음");
  }

  return renderOfficePlayer({ player }, { label: "핵심" });
}

function renderDepthNeedList(needs) {
  if (!needs.length) {
    return renderEmptyListItem("뎁스 안정");
  }

  return needs.slice(0, 5).map(renderDepthNeed).join("");
}

function renderDepthNeed(need) {
  const label = getPositionGroupLabel(need.key, need.label);
  const topPlayer = need.topPlayer;
  const detail = topPlayer
    ? `${topPlayer.name} · ${renderPlayerMeta(topPlayer)}`
    : `${formatNumber(need.count)} / ${formatNumber(need.target)}명`;

  return renderOfficeFact(label, "보강 체크", detail, `${formatNumber(need.count)}/${formatNumber(need.target)}`);
}

function renderOfficePlayerList(entries, emptyMessage, options = {}) {
  if (!entries.length) {
    return renderEmptyListItem(emptyMessage);
  }

  return entries.slice(0, 5).map((entry) => renderOfficePlayer(entry, options)).join("");
}

function renderOfficePlayer(entry, options) {
  const player = entry.player ?? entry;
  const detail = [options.showTeam ? entry.teamName : "", renderPlayerMeta(player)]
    .filter(Boolean)
    .join(" · ");
  const label = options.label ?? player.position ?? "-";

  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(player.id ?? "")}" data-team-id="${escapeAttribute(player.teamId ?? entry.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${escapeHtml(label)}</span>
      <span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${escapeHtml(detail)}</small>
      </span>
      <b>${escapeHtml(renderPlayerScore(player))}</b>
    </li>
  `;
}

function renderStandingRow(team, index, selectedTeam) {
  const isSelected = selectedTeam && String(team.id) === String(selectedTeam.id);
  const diff = Number(team.runsFor ?? 0) - Number(team.runsAgainst ?? 0);
  return `
    <tr class="${isSelected ? "is-selected" : ""}">
      <td>${index + 1}</td>
      <td>
        <span class="team-cell">
          ${renderTeamLogo(team, "team-logo table-logo")}
          <span>
            <strong>${escapeHtml(getTeamName(team))}</strong>
            <small>${escapeHtml(getTeamLocation(team))}</small>
          </span>
        </span>
      </td>
      <td>${formatNumber(team.wins)}</td>
      <td>${formatNumber(team.losses)}</td>
      <td>${formatNumber(team.ties)}</td>
      <td>${formatPct(winningPct(team))}</td>
      <td>${diff > 0 ? "+" : ""}${formatNumber(diff)}</td>
    </tr>
  `;
}

function renderGames(state) {
  const games = state.lastGames ?? [];
  if (!games.length) {
    return `<div class="empty-card">경기 결과가 아직 없어요. 다음 날을 진행하면 스코어보드가 채워집니다.</div>`;
  }

  return games.slice(0, 6).map((game) => {
    const away = normalizeGameTeam(game.away ?? game.awayTeamId, state);
    const home = normalizeGameTeam(game.home ?? game.homeTeamId, state);
    const awayRuns = game.awayRuns ?? game.awayScore;
    const homeRuns = game.homeRuns ?? game.homeScore;
    const hasScore = Number.isFinite(Number(awayRuns)) && Number.isFinite(Number(homeRuns));

    return `
      <div class="game-card">
        <div class="game-team">
          ${renderTeamLogo(away, "team-logo mini-logo")}
          <span>${escapeHtml(getTeamShortName(away) ?? "Away")}</span>
          <strong>${hasScore ? formatNumber(awayRuns) : "-"}</strong>
        </div>
        <div class="game-team">
          ${renderTeamLogo(home, "team-logo mini-logo")}
          <span>${escapeHtml(getTeamShortName(home) ?? "Home")}</span>
          <strong>${hasScore ? formatNumber(homeRuns) : "-"}</strong>
        </div>
        ${renderCompactBoxScore(game, away, home)}
        ${renderScoringMoments(game)}
        <small>${renderGameDetail(game)}</small>
      </div>
    `;
  }).join("");
}

function renderGamecastPanel(state) {
  const game = getFocusedGamecastGame(state);
  if (!game) {
    latestGamecastSequence = null;
    return `
      <article class="panel gamecast-panel" id="gamecast">
        <div class="panel-head">
          <div>
            <span class="mini-label">Gamecast</span>
            <h2>프리시즌 보드</h2>
          </div>
          <span class="pill">대기</span>
        </div>
        <div class="gamecast-empty">
          <strong>캠프 진행 중</strong>
          <small>정규시즌 개막 전에는 경기 없이 날짜와 컨디션만 진행됩니다.</small>
        </div>
      </article>
    `;
  }

  const away = normalizeGameTeam(game.away ?? game.awayTeamId, state);
  const home = normalizeGameTeam(game.home ?? game.homeTeamId, state);
  const events = Array.isArray(game.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
  const plateAppearanceCount = events.filter((event) => event?.type !== "stolenBase").length;
  const sequence = hydrateGamecastSequence(buildGamecastSequence(game, state));
  latestGamecastSequence = sequence;
  const gamecastEngine = normalizeGamecastEngine(state.ui?.gamecastEngine);
  latestGamecastEngine = gamecastEngine;
  const playbackView = getGamecastPlaybackView(sequence, events, state);
  const feedEvents = playbackView.feedEvents;
  const featured = playbackView.featured;
  const broadcastOpen = sequence.mode === "watch" && state.ui?.gamecastExpanded === true;
  const showFps = Boolean(state.ui?.gamecastFps);
  const broadcastModal = renderGamecastBroadcastModal(state, sequence, away, home, feedEvents, featured, gamecastEngine);

  return `
    <article class="panel gamecast-panel" id="gamecast" data-gamecast-instance-root>
      <div class="panel-head">
        <div>
          <span class="mini-label">Gamecast</span>
          <h2>${sequence.mode === "watch" ? "경기 보기 도트 중계" : "빠른 도트 중계"}</h2>
        </div>
        <div class="gamecast-head-actions">
          ${renderGamecastEngineToggle(gamecastEngine)}
          ${game ? `<button class="button button-soft gamecast-expand-button" data-action="open-gamecast-broadcast" type="button">큰 화면</button>` : ""}
          <span class="pill">${sequence.mode === "watch" ? "LIVE" : `${formatNumber(plateAppearanceCount)} PA`}</span>
        </div>
      </div>
      <div class="gamecast-layout">
        <div class="gamecast-board" data-gamecast-board>
          <div class="gamecast-scoreline">
            <span style="--score-team-color: ${escapeAttribute(getTeamColor(away))}">
              ${renderTeamLogo(away, "team-logo mini-logo")}
              <b>${escapeHtml(getTeamShortName(away) ?? "Away")}</b>
              <strong>${formatNumber(sequence.startAway)}</strong>
            </span>
            <span style="--score-team-color: ${escapeAttribute(getTeamColor(home))}">
              ${renderTeamLogo(home, "team-logo mini-logo")}
              <b>${escapeHtml(getTeamShortName(home) ?? "Home")}</b>
              <strong>${formatNumber(sequence.startHome)}</strong>
            </span>
          </div>
          ${renderGamecastControls(sequence)}
          ${renderGamecastMatchup(featured)}
          ${broadcastOpen
            ? renderGamecastInlinePlaceholder()
            : `<div class="gamecast-screen is-${escapeAttribute(gamecastEngine)} ${featured?.outcome === "homeRun" ? "is-homer" : ""}" data-gamecast-screen data-gamecast-engine-current="${escapeAttribute(gamecastEngine)}" aria-hidden="true">
                ${renderGamecastPixelStage("inline", gamecastEngine, showFps)}
              </div>`}
          <div class="gamecast-now">
            <strong>${featured ? escapeHtml(gamecastNowTitle(featured)) : "경기 종료"}</strong>
            <small>${featured ? escapeHtml(gamecastNowDetail(featured)) : "타석 이벤트 대기"}</small>
          </div>
        </div>
        <ol class="gamecast-feed" data-gamecast-feed>
          ${feedEvents.length ? feedEvents.map((event, index) => renderGamecastEvent(event, state, index)).join("") : renderGamecastEmptyFeedItem()}
        </ol>
      </div>
    </article>
    ${broadcastModal}
  `;
}

function renderGamecastBroadcastModal(state, sequence, away, home, feedEvents, featured, gamecastEngine) {
  if (sequence.mode !== "watch" || state.ui?.gamecastExpanded !== true) return "";
  const showFps = Boolean(state.ui?.gamecastFps);

  return `
    <div class="gamecast-broadcast-backdrop" data-gamecast-modal>
      <section class="gamecast-broadcast-shell" role="dialog" aria-modal="true" aria-labelledby="gamecast-broadcast-title" data-gamecast-instance-root>
        <header class="gamecast-broadcast-head">
          <div>
            <span class="mini-label">Live Pixel Broadcast</span>
            <h2 id="gamecast-broadcast-title">경기 보기 도트 중계</h2>
            <p>${escapeHtml(getTeamShortName(away) ?? "Away")} vs ${escapeHtml(getTeamShortName(home) ?? "Home")} · 고해상도 픽셀 뷰</p>
          </div>
          <button class="button button-soft gamecast-close-button" data-action="close-gamecast-broadcast" type="button" aria-label="중계창 닫기">닫기</button>
        </header>
        <div class="gamecast-broadcast-grid">
          <div class="gamecast-board gamecast-broadcast-board" data-gamecast-board>
            <div class="gamecast-scoreline gamecast-broadcast-scoreline">
              <span style="--score-team-color: ${escapeAttribute(getTeamColor(away))}">
                ${renderTeamLogo(away, "team-logo mini-logo")}
                <b>${escapeHtml(getTeamShortName(away) ?? "Away")}</b>
                <strong>${formatNumber(sequence.startAway)}</strong>
              </span>
              <span style="--score-team-color: ${escapeAttribute(getTeamColor(home))}">
                ${renderTeamLogo(home, "team-logo mini-logo")}
                <b>${escapeHtml(getTeamShortName(home) ?? "Home")}</b>
                <strong>${formatNumber(sequence.startHome)}</strong>
              </span>
            </div>
            ${renderGamecastControls(sequence, "broadcast")}
            ${renderGamecastMatchup(featured)}
            <div class="gamecast-screen gamecast-screen-large is-${escapeAttribute(gamecastEngine)} ${featured?.outcome === "homeRun" ? "is-homer" : ""}" data-gamecast-screen data-gamecast-engine-current="${escapeAttribute(gamecastEngine)}" aria-hidden="true">
              ${renderGamecastPixelStage("broadcast", gamecastEngine, showFps)}
            </div>
            <div class="gamecast-now gamecast-broadcast-now">
              <strong>${featured ? escapeHtml(gamecastNowTitle(featured)) : "경기 종료"}</strong>
              <small>${featured ? escapeHtml(gamecastNowDetail(featured)) : "타석 이벤트 대기"}</small>
            </div>
            <ol class="gamecast-feed gamecast-broadcast-feed" data-gamecast-feed>
              ${feedEvents.length ? feedEvents.map((event, index) => renderGamecastEvent(event, state, index)).join("") : renderGamecastEmptyFeedItem()}
            </ol>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderGamecastInlinePlaceholder() {
  return `
    <div class="gamecast-screen gamecast-screen-placeholder" aria-hidden="true">
      <div>
        <strong>큰 화면 중계 중</strong>
        <small>닫기를 누르면 이 패널에서 이어서 봅니다.</small>
      </div>
    </div>
  `;
}

function renderGamecastEngineToggle(engine) {
  const selected = normalizeGamecastEngine(engine);
  return `
    <div class="gamecast-engine-toggle" aria-label="중계 엔진">
      ${[
        { value: "phaser", label: "Phaser" },
        { value: "v2", label: "v2" },
        { value: "canvas", label: "Canvas" }
      ].map((option) => `
        <button class="gamecast-engine-button ${selected === option.value ? "is-active" : ""}" data-gamecast-engine="${option.value}" type="button" aria-pressed="${selected === option.value ? "true" : "false"}">${option.label}</button>
      `).join("")}
    </div>
  `;
}

function normalizeGamecastEngine(value) {
  if (value === "canvas" || value === "phaser" || value === "v2") return value;
  return GAMECAST_DEFAULT_ENGINE;
}

function renderGamecastMatchup(event) {
  const summary = gamecastMatchupSummary(event);
  return `
    <div class="gamecast-matchup" data-gamecast-matchup>
      <span data-gamecast-matchup-state>${escapeHtml(summary.state)}</span>
      <strong data-gamecast-matchup-hitter>${escapeHtml(summary.hitter)}</strong>
      <small data-gamecast-matchup-pitcher>${escapeHtml(summary.pitcher)}</small>
      <b class="${escapeAttribute(summary.className)}" data-gamecast-matchup-result>${escapeHtml(summary.result)}</b>
    </div>
  `;
}

function gamecastMatchupSummary(event, frame = null) {
  if (!event) {
    return {
      state: "WAIT",
      hitter: "타석 대기",
      pitcher: "투수 대기",
      result: "-",
      className: ""
    };
  }
  const revealed = frame ? gamecastFrameResultRevealed(frame) : true;
  return {
    state: `${formatGamecastInningCompact(event)} · ${formatNumber(outsInInning(event.outsBefore))}OUT`,
    hitter: event.hitterName || "타자",
    pitcher: `vs ${event.pitcherName || "투수"}`,
    result: revealed ? gamecastMatchupResult(event) : gamecastLivePhaseLabel(event, Number(frame?.progress ?? 0)),
    className: revealed ? gamecastOutcomeClass(event.outcome) : "is-ball"
  };
}

function gamecastMatchupResult(event) {
  if (!event) return "-";
  const runs = Number(event.runs ?? 0);
  if (event.doublePlay) return "병살";
  if (event.outcome === "homeRun") return runs > 1 ? `${formatNumber(runs)}점 홈런` : "홈런";
  if (["single", "double", "triple"].includes(event.outcome)) {
    return `${gamecastResultDisplayText(event)}${runs > 0 ? ` +${formatNumber(runs)}` : ""}`;
  }
  if (["walk", "strikeout", "error", "sacrificeBunt", "stolenBase", "caughtStealing"].includes(event.outcome)) {
    return gamecastResultDisplayText(event);
  }
  if (event.outcome === "out") {
    const result = gamecastResultDisplayText(event);
    return event.fieldingPosition ? `${result} · ${event.fieldingPosition}` : result;
  }
  return outcomeLabel(event.outcome) || "-";
}

export function gamecastResultDisplayText(event) {
  if (!event) return "-";
  const battedBallType = String(event.battedBallType ?? "").toLowerCase();
  const flyPrefix = battedBallType.includes("fly") ? "뜬공 " : "";
  if (event.doublePlay) return "병살";
  if (event.outcome === "single") return `${flyPrefix}안타`;
  if (event.outcome === "double") return `${flyPrefix}2루타`;
  if (event.outcome === "triple") return `${flyPrefix}3루타`;
  if (event.outcome === "homeRun") return "홈런";
  if (event.outcome === "strikeout") return "삼진";
  if (event.outcome === "walk") return "볼넷";
  if (event.outcome === "error") return "실책";
  if (event.outcome === "sacrificeBunt") return "희생번트";
  if (event.outcome === "stolenBase") return "도루 성공";
  if (event.outcome === "caughtStealing") return "도루자 아웃";
  if (event.outcome === "out") {
    if (battedBallType.includes("fly")) return "뜬공 아웃";
    if (battedBallType.includes("line")) return "직선타 아웃";
    if (battedBallType.includes("ground")) return "땅볼 아웃";
    return "아웃";
  }
  return outcomeLabel(event.outcome) || "-";
}

function gamecastLivePhaseLabel(event, progress) {
  if (!event) return "대기";
  if (event.outcome === "stolenBase") return progress < 0.68 ? "도루 시도" : "세이프";
  if (event.outcome === "caughtStealing") return progress < 0.68 ? "도루 시도" : "태그 아웃";
  const pitchEnd = gamecastPitchEnd(event);
  if (progress < pitchEnd - 0.04) return "투구";
  if (progress < pitchEnd + 0.08) return "컨택";
  if (event.outcome === "walk") return "볼넷?";
  if (event.outcome === "strikeout") return "승부구";
  if (event.outcome === "homeRun") return "큰 타구";
  if (event.outcome === "out" || event.doublePlay) return "수비";
  if (["single", "double", "triple", "error"].includes(event.outcome)) return "주루";
  return "진행";
}

function renderGamecastPixelStage(instanceId, engine = GAMECAST_DEFAULT_ENGINE, showFps = false) {
  const safeInstanceId = escapeAttribute(instanceId);
  const safeEngine = escapeAttribute(normalizeGamecastEngine(engine));
  return `
    <div class="gamecast-pixel-stage" data-gamecast-stage data-gamecast-stage-engine="${safeEngine}">
      <canvas id="${GAMECAST_CANVAS_ID}-${safeInstanceId}" class="gamecast-pixel-canvas" width="${GAMECAST_PIXEL_W}" height="${GAMECAST_PIXEL_H}" data-gamecast-canvas data-pixel-w="${GAMECAST_PIXEL_W}" data-pixel-h="${GAMECAST_PIXEL_H}" aria-hidden="true"></canvas>
      <div class="gamecast-dom-overlay" data-gamecast-hud>
        <div class="gamecast-dom-jumbotron" data-gamecast-jumbotron>
          <span data-gamecast-jumbo-inning>LIVE</span>
          <strong data-gamecast-jumbo-result>대기</strong>
          <small><b data-gamecast-jumbo-away>0</b> - <b data-gamecast-jumbo-home>0</b></small>
        </div>
        <div class="gamecast-dom-bug" data-gamecast-bug>
          <span class="gamecast-dom-network">KBO LIVE</span>
          <div class="gamecast-dom-count" aria-label="B S O">
            <span>B</span><i data-gamecast-ball-pip></i><i data-gamecast-ball-pip></i><i data-gamecast-ball-pip></i>
            <span>S</span><i data-gamecast-strike-pip></i><i data-gamecast-strike-pip></i>
            <span>O</span><i data-gamecast-out-pip></i><i data-gamecast-out-pip></i>
          </div>
          <div class="gamecast-dom-bases" aria-label="누상">
            <i data-gamecast-base-pip="2"></i>
            <i data-gamecast-base-pip="3"></i>
            <i data-gamecast-base-pip="1"></i>
          </div>
        </div>
      </div>
      <span class="gamecast-player-label" data-gamecast-player-label></span>
      <span class="gamecast-action-burst" data-gamecast-action-burst data-gamecast-result-banner role="status" aria-live="polite"></span>
      <div class="gamecast-pause-overlay" data-gamecast-pause-overlay hidden>
        <span data-gamecast-pause-kicker>HOLD</span>
        <strong data-gamecast-pause-title>일시정지</strong>
        <small data-gamecast-pause-detail>Space 또는 화면 클릭으로 이어갑니다.</small>
        <button class="gamecast-pause-next" data-gamecast-pause-action type="button">계속 ▶</button>
      </div>
      ${showFps ? `<div class="gamecast-fps-overlay" data-gamecast-fps>FPS --<small>1% --ms</small></div>` : ""}
    </div>
  `;
}

function renderGamecastControls(sequence, variant = "inline") {
  if (sequence.mode !== "watch") return "";
  const activeSpeed = sanitizeGamecastSpeed(sequence.playbackRate);
  const soundOn = sequence.soundEnabled !== false;
  const paused = Boolean(sequence.paused || sequence.hold);
  const stepMode = Boolean(sequence.stepMode);
  return `
    <div class="gamecast-controls ${variant === "broadcast" ? "is-broadcast" : ""}" aria-label="중계 재생 속도">
      <button class="gamecast-speed-button gamecast-pause-button ${paused ? "is-active" : ""}" data-gamecast-pause type="button" aria-pressed="${paused ? "true" : "false"}">${paused ? "▶ 계속" : "⏸ 정지"}</button>
      ${GAMECAST_SPEED_OPTIONS.map((speed) => `
        <button class="gamecast-speed-button ${speed === activeSpeed ? "is-active" : ""}" data-gamecast-speed="${speed}" type="button" aria-pressed="${speed === activeSpeed ? "true" : "false"}">x${formatNumber(speed)}</button>
      `).join("")}
      <button class="gamecast-speed-button gamecast-step-button ${stepMode ? "is-active" : ""}" data-gamecast-step type="button" aria-pressed="${stepMode ? "true" : "false"}">타석 확인</button>
      <button class="gamecast-speed-button gamecast-sound-button ${soundOn ? "is-active" : ""}" data-gamecast-sound type="button" aria-pressed="${soundOn ? "true" : "false"}">${soundOn ? "🔊 켜짐" : "🔇 꺼짐"}</button>
      <button class="gamecast-speed-button is-skip" data-gamecast-skip type="button">스킵</button>
    </div>
  `;
}

function getFocusedGamecastGame(state) {
  const games = state.lastGames ?? [];
  const focusId = String(state.ui?.focusGameId ?? "");
  return (focusId ? games.find((game) => String(game?.id ?? "") === focusId) : null) ?? games[0] ?? null;
}

function renderGamecastEvent(event, state, index = 0) {
  const normalized = event?.id ? event : normalizeGamecastEvent(event, state);
  return `
    <li class="${normalized.runs > 0 ? "is-scoring" : ""}" data-gamecast-event-id="${escapeAttribute(normalized.id)}" data-gamecast-event-index="${formatNumber(index)}">
      <span>
        <b>${formatNumber(normalized.inning)}회 ${normalized.side === "home" ? "말" : "초"}</b>
        ${escapeHtml(gamecastFeedHeadline(normalized))}
      </span>
      <small>${escapeHtml(gamecastNowDetail(normalized))}</small>
    </li>
  `;
}

function renderGamecastEmptyFeedItem() {
  return `<li data-gamecast-empty><span>경기 이벤트 대기</span><small>PA 기록 없음</small></li>`;
}

function createGamecastEmptyFeedItem() {
  const item = document.createElement("li");
  item.dataset.gamecastEmpty = "";
  const label = document.createElement("span");
  label.textContent = "경기 이벤트 대기";
  const detail = document.createElement("small");
  detail.textContent = "PA 기록 없음";
  item.append(label, detail);
  return item;
}

function createGamecastFeedItem(event, index = 0) {
  const item = document.createElement("li");
  item.dataset.gamecastEventId = String(event?.id ?? "");
  item.dataset.gamecastEventIndex = String(index);
  if (Number(event?.runs ?? 0) > 0) item.classList.add("is-scoring");

  const label = document.createElement("span");
  const inning = document.createElement("b");
  inning.textContent = `${formatNumber(event?.inning ?? 1)}회 ${event?.side === "home" ? "말" : "초"}`;
  label.append(inning, ` ${gamecastFeedHeadline(event)}`);

  const detail = document.createElement("small");
  detail.textContent = gamecastNowDetail(event);
  item.append(label, detail);
  return item;
}

function gamecastFeedHeadline(event) {
  if (!event) return "결과 대기";
  const team = String(event.offenseLabel ?? "").trim();
  const hitter = String(event.hitterName ?? "타자").trim();
  const result = gamecastMatchupResult(event);
  const runs = Number(event.runs ?? 0);
  const runText = runs > 0 && !String(result).includes("+") ? ` +${formatNumber(runs)}` : "";
  return [team, `${hitter} ${result}${runText}`].filter(Boolean).join(" · ");
}

function isGamecastFeedEvent(event) {
  return ["single", "double", "triple", "homeRun", "walk", "strikeout", "error"].includes(event?.outcome);
}

function eventTeamLabel(event, state) {
  return getTeamShortName(normalizeGameTeam(event?.offenseTeamId, state)) ?? (event?.side === "home" ? "홈" : "원정");
}

function buildGamecastSequence(game, state) {
  const all = Array.isArray(game?.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
  const chrono = sortGamecastEvents(all);
  const mode = String(state.ui?.focusGameId ?? "") === String(game?.id ?? "") && state.ui?.gamecastMode === "watch"
    ? "watch"
    : "summary";
  const tail = mode === "watch" ? chrono : chrono.slice(-GAMECAST_PLAYBACK_COUNT);
  const tailSet = new Set(tail);
  const homeTeam = normalizeGameTeam(game?.homeTeamId, state);
  const gamecastContext = normalizeGamecastContext(game, state);
  let startAway = 0;
  let startHome = 0;

  for (const event of chrono) {
    if (tailSet.has(event)) continue;
    if (event.side === "home") startHome += Number(event.runs || 0);
    else startAway += Number(event.runs || 0);
  }

  return {
    id: game?.id ?? `${game?.awayTeamId ?? "away"}-${game?.homeTeamId ?? "home"}`,
    awayId: game?.awayTeamId ?? "",
    homeId: game?.homeTeamId ?? "",
    finalAway: Number(game?.awayRuns ?? game?.awayScore ?? 0),
    finalHome: Number(game?.homeRuns ?? game?.homeScore ?? 0),
    startAway,
    startHome,
    mode,
    ballparkProfile: normalizeGamecastBallparkProfile(game, homeTeam),
    attendance: Number(game?.attendance ?? 0),
    weatherLabel: String(game?.weather ?? state.weather?.label ?? ""),
    paMs: mode === "watch" ? GAMECAST_WATCH_PA_MS : GAMECAST_PA_MS,
    gapMs: mode === "watch" ? GAMECAST_WATCH_GAP_MS : GAMECAST_PA_GAP_MS,
    defaultPlaybackRate: sanitizeGamecastSpeed(state.ui?.gamecastPlaybackRate ?? gamecastPlaybackStore.playbackRate),
    stepMode: Boolean(state.ui?.gamecastStepMode),
    holdsEnabled: state.settings?.gamecastHolds !== false && state.ui?.gamecastHolds !== false,
    soundEnabled: state.ui?.gamecastSound !== false && gamecastSoundEnabled,
    events: tail.map((event) => {
      const normalized = normalizeGamecastEvent(event, state, gamecastContext);
      return {
        ...normalized,
        gamecastDurationMs: getGamecast2PlayDurationMs(normalized)
      };
    })
  };
}

function hydrateGamecastSequence(sequence) {
  const store = ensureGamecastPlaybackStore(sequence);
  const totalMs = gamecastTotalDuration(sequence);
  const elapsedMs = Math.max(0, Math.min(totalMs, Number(store.elapsedMs ?? 0)));
  return {
    ...sequence,
    playbackRate: sanitizeGamecastSpeed(store.playbackRate),
    initialElapsedMs: elapsedMs,
    done: Boolean(store.done) || (totalMs > 0 && elapsedMs >= totalMs),
    paused: Boolean(store.paused) && !store.done,
    stepMode: Boolean(store.stepMode),
    hold: store.done ? null : normalizeGamecastHold(store.hold),
    lastHoldKey: String(store.lastHoldKey ?? "")
  };
}

function ensureGamecastPlaybackStore(sequence) {
  const sequenceId = gamecastPlaybackSequenceId(sequence);
  if (gamecastPlaybackStore.sequenceId !== sequenceId) {
    gamecastPlaybackStore = {
      sequenceId,
      elapsedMs: 0,
      playbackRate: sanitizeGamecastSpeed(sequence?.defaultPlaybackRate ?? gamecastPlaybackStore.playbackRate ?? 1),
      done: false,
      paused: false,
      stepMode: Boolean(sequence?.stepMode),
      hold: null,
      lastHoldKey: ""
    };
  }
  return gamecastPlaybackStore;
}

function persistGamecastPlayback(playbackState, patch = {}) {
  const sequence = playbackState?.sequence;
  if (!sequence) return;
  const store = ensureGamecastPlaybackStore(sequence);
  const totalMs = gamecastTotalDuration(sequence);
  const elapsedMs = Math.max(0, Math.min(totalMs, Number(patch.elapsedMs ?? playbackState.elapsedMs ?? store.elapsedMs ?? 0)));
  store.elapsedMs = elapsedMs;
  store.playbackRate = sanitizeGamecastSpeed(patch.playbackRate ?? playbackState.playbackRate ?? store.playbackRate);
  store.done = Boolean(patch.done ?? playbackState.done ?? (totalMs > 0 && elapsedMs >= totalMs));
  store.paused = Boolean(patch.paused ?? playbackState.paused ?? store.paused) && !store.done;
  store.stepMode = Boolean(patch.stepMode ?? playbackState.stepMode ?? store.stepMode);
  if (Object.prototype.hasOwnProperty.call(patch, "hold")) {
    store.hold = normalizeGamecastHold(patch.hold);
  } else if (Object.prototype.hasOwnProperty.call(playbackState, "hold")) {
    store.hold = normalizeGamecastHold(playbackState.hold);
  }
  store.lastHoldKey = String(patch.lastHoldKey ?? playbackState.lastHoldKey ?? store.lastHoldKey ?? "");
  if (store.done && totalMs > 0) {
    store.elapsedMs = totalMs;
    store.paused = false;
    store.hold = null;
  }
}

function normalizeGamecastHold(hold) {
  if (!hold || typeof hold !== "object") return null;
  const type = ["manual", "step", "inning", "leverage", "resume"].includes(hold.type) ? hold.type : "manual";
  const eventIndex = Number.isFinite(Number(hold.eventIndex)) ? Math.max(0, Math.floor(Number(hold.eventIndex))) : -1;
  const resumeElapsedMs = Number.isFinite(Number(hold.resumeElapsedMs)) ? Math.max(0, Number(hold.resumeElapsedMs)) : null;
  return {
    type,
    key: String(hold.key ?? ""),
    eventIndex,
    resumeElapsedMs,
    title: String(hold.title ?? ""),
    detail: String(hold.detail ?? ""),
    action: String(hold.action ?? "")
  };
}

function gamecastPlaybackSequenceId(sequence) {
  return [
    sequence?.mode ?? "summary",
    sequence?.id ?? "gamecast-idle",
    sequence?.awayId ?? "",
    sequence?.homeId ?? "",
    sequence?.events?.length ?? 0,
    sequence?.startAway ?? 0,
    sequence?.startHome ?? 0,
    sequence?.finalAway ?? 0,
    sequence?.finalHome ?? 0
  ].join("|");
}

export function gamecastTotalDuration(sequence) {
  return (sequence?.events ?? []).reduce(
    (total, event) => total + gamecastEventDuration(sequence, event),
    0
  );
}

function getGamecastPlaybackView(sequence, fallbackEvents, state) {
  if (!sequence.events.length) {
    const fallback = sortGamecastEvents(fallbackEvents).slice(-GAMECAST_PLAYBACK_COUNT).map((event) => normalizeGamecastEvent(event, state));
    return {
      feedEvents: sequence.mode === "watch" ? [] : fallback,
      featured: sequence.mode === "watch" ? null : fallback[0] ?? null
    };
  }

  if (sequence.mode !== "watch") {
    return {
      feedEvents: sequence.events,
      featured: sequence.events[0] ?? null
    };
  }

  const totalMs = gamecastTotalDuration(sequence);
  const elapsedMs = Math.max(0, Math.min(totalMs, Number(sequence.initialElapsedMs ?? 0)));
  const done = Boolean(sequence.done) || elapsedMs >= totalMs;
  const timing = gamecastPlaybackPosition(sequence, elapsedMs);
  const currentIndex = done ? sequence.events.length - 1 : timing.index;
  const currentTiming = done ? gamecastEventTiming(sequence, currentIndex) : timing;
  const localMs = done ? currentTiming.slotMs : currentTiming.localMs;
  const currentEvent = sequence.events[currentIndex] ?? null;
  const revealCurrent = done || localMs > currentTiming.playMs * gamecastResultRevealProgress(currentEvent);
  const feedEndIndex = revealCurrent ? currentIndex : currentIndex - 1;
  return {
    feedEvents: feedEndIndex >= 0 ? sequence.events.slice(0, feedEndIndex + 1) : [],
    featured: sequence.events[currentIndex] ?? sequence.events[0] ?? null
  };
}

export function sortGamecastEvents(events) {
  return [...(events ?? [])].sort((a, b) =>
    (Number(a?.inning ?? 0) - Number(b?.inning ?? 0)) ||
    ((a?.side === "home" ? 1 : 0) - (b?.side === "home" ? 1 : 0)) ||
    (Number(a?.sequence ?? 0) - Number(b?.sequence ?? 0)) ||
    (Number(a?.eventOrder ?? 0) - Number(b?.eventOrder ?? 0))
  );
}

export function normalizeGamecastEvent(event, state, gamecastContext = null) {
  const side = event?.side === "home" ? "home" : "away";
  const runs = Number(event?.runs ?? 0);
  const outsBefore = Number(event?.outsBefore ?? 0);
  const outsAfter = Number(event?.outsAfter ?? 0);
  const scoredRunners = normalizeScoredRunners(event?.scoredRunners, runs);
  const inningEnded = Boolean(event?.inningEnded) || (outsAfter % 3 === 0 && outsAfter !== outsBefore);
  const sequence = Number(event?.sequence ?? 0);
  const inning = Number(event?.inning ?? 1);
  const offenseTeam = normalizeGameTeam(event?.offenseTeamId, state);
  const defenseTeam = normalizeGameTeam(event?.defenseTeamId, state);
  const hitterId = String(event?.hitterId ?? event?.batterId ?? "");
  const pitcherId = String(event?.pitcherId ?? "");
  const defenderId = String(event?.defenderId ?? "");
  const hitterProfile = resolveGamecastPlayerProfile(gamecastContext, hitterId, event?.hitterName, state, offenseTeam);
  const pitcherProfile = resolveGamecastPlayerProfile(gamecastContext, pitcherId, event?.pitcherName, state, defenseTeam);
  const defenderProfile = resolveGamecastPlayerProfile(gamecastContext, defenderId, event?.defenderName, state, defenseTeam);
  const defenseProfilesByPosition = resolveGamecastDefenseProfiles(gamecastContext, defenseTeam, state);
  const fieldingPosition = resolveGamecastDefenderFieldingKey(defenderId, defenseProfilesByPosition, event?.fieldingPosition);
  const defensiveThrowTarget = Object.prototype.hasOwnProperty.call(event ?? {}, "defensiveThrowTarget")
    ? event?.defensiveThrowTarget ?? null
    : resolveDefensiveThrowTarget({
        ...event,
        outcome: String(event?.outcome ?? "out"),
        battedBallType: String(event?.battedBallType ?? ""),
        fieldingPosition,
        scoredRunners
      });
  const baseRunnerProfilesBefore = resolveGamecastBaseRunnerProfiles(event?.baseRunnerIdsBefore, gamecastContext, state, offenseTeam);
  const baseRunnerProfilesAfter = resolveGamecastBaseRunnerProfiles(event?.baseRunnerIdsAfter, gamecastContext, state, offenseTeam);
  const teamColor = normalizeHexColor(getTeamColor(offenseTeam), side === "home" ? "#c64b74" : "#315288");
  const defenseColor = normalizeHexColor(getTeamColor(defenseTeam), side === "home" ? "#315288" : "#c64b74");
  const teamJerseyColor = side === "home" ? "#f2f6f9" : "#5b6d84";
  const teamJerseyShadow = side === "home" ? "#cad5e1" : "#364154";
  const defenseJerseyColor = side === "home" ? "#5b6d84" : "#f2f6f9";
  const defenseJerseyShadow = side === "home" ? "#364154" : "#cad5e1";

  return {
    id: String(event?.id ?? `${event?.gameId ?? "game"}-${side}-${inning}-${sequence}-${event?.outcome ?? "idle"}`),
    type: String(event?.type ?? "plateAppearance"),
    outcome: String(event?.outcome ?? "out"),
    inning,
    side,
    sequence,
    eventOrder: Number(event?.eventOrder ?? 0),
    offenseTeamId: event?.offenseTeamId ?? "",
    defenseTeamId: event?.defenseTeamId ?? "",
    offenseLabel: eventTeamLabel(event, state),
    hitterId,
    hitterName: String(event?.hitterName ?? "타자"),
    runnerId: String(event?.runnerId ?? ""),
    runnerName: String(event?.runnerName ?? ""),
    success: event?.success === true,
    caught: event?.caught === true,
    out: event?.out === true,
    pitcherId,
    pitcherName: String(event?.pitcherName ?? "투수"),
    defenderId,
    defenderName: String(event?.defenderName ?? ""),
    hitterProfile,
    pitcherProfile,
    defenderProfile,
    baseRunnerProfilesBefore,
    baseRunnerProfilesAfter,
    defenseProfilesByPosition,
    hitterAbility: gamecastAbilityVisual(hitterProfile),
    pitcherAbility: gamecastAbilityVisual(pitcherProfile),
    defenderAbility: gamecastAbilityVisual(defenderProfile),
    defenseAbilityByPosition: Object.fromEntries(
      Object.entries(defenseProfilesByPosition).map(([key, profile]) => [key, gamecastAbilityVisual(profile)])
    ),
    battedBallType: String(event?.battedBallType ?? ""),
    fieldingPosition,
    recordedFieldingPosition: String(event?.fieldingPosition ?? ""),
    attemptedFieldingPosition: String(event?.attemptedFieldingPosition ?? ""),
    attemptedDefenderId: String(event?.attemptedDefenderId ?? ""),
    attemptedDefenderName: String(event?.attemptedDefenderName ?? ""),
    fieldingZone: String(event?.fieldingZone ?? ""),
    fieldingLane: event?.fieldingLane === null || event?.fieldingLane === ""
      ? null
      : Number.isFinite(Number(event?.fieldingLane)) ? Number(event.fieldingLane) : null,
    sprayLane: event?.sprayLane === null || event?.sprayLane === ""
      ? null
      : Number.isFinite(Number(event?.sprayLane)) ? Number(event.sprayLane) : null,
    hitTrajectory: String(event?.hitTrajectory ?? ""),
    defensiveThrowTarget,
    doublePlay: Boolean(event?.doublePlay),
    reachedOnError: Boolean(event?.reachedOnError),
    ballparkName: String(event?.ballparkName ?? ""),
    ballparkId: String(event?.ballparkId ?? ""),
    runs,
    rbi: Number(event?.rbi ?? 0),
    outsBefore,
    outsAfter,
    basesBefore: toBaseTriple(event?.basesBefore),
    basesAfter: toBaseTriple(event?.basesAfter),
    baseRunnerIdsBefore: Array.from({ length: 3 }, (_, index) => String(event?.baseRunnerIdsBefore?.[index] ?? "")),
    baseRunnerIdsAfter: Array.from({ length: 3 }, (_, index) => String(event?.baseRunnerIdsAfter?.[index] ?? "")),
    scoredRunners,
    scoredRunnerCount: scoredRunners.length,
    inningEnded,
    teamColor,
    teamJerseyColor,
    teamJerseyShadow,
    teamAccentColor: mixHexColors(teamColor, "#23202a", 0.08),
    hitterUniformNumber: gamecastProfileUniformNumber(hitterProfile, event?.hitterName, hitterId),
    defenseColor,
    defenseJerseyColor,
    defenseJerseyShadow,
    defenseAccentColor: mixHexColors(defenseColor, "#23202a", 0.08),
    teamTrailColor: mixHexColors(teamColor, "#fffefb", 0.42)
  };
}

function normalizeGamecastContext(game, state) {
  const raw = game?.gamecast && typeof game.gamecast === "object" ? game.gamecast : {};
  const playersById = raw.playersById && typeof raw.playersById === "object" ? { ...raw.playersById } : {};
  const defenseByTeamId = raw.defenseByTeamId && typeof raw.defenseByTeamId === "object" ? { ...raw.defenseByTeamId } : {};
  for (const teamId of [game?.awayTeamId, game?.homeTeamId]) {
    const key = String(teamId ?? "");
    if (!key || defenseByTeamId[key]) continue;
    const team = normalizeGameTeam(key, state);
    defenseByTeamId[key] = buildFallbackGamecastDefenseMap(team);
  }
  return { playersById, defenseByTeamId };
}

function resolveGamecastPlayerProfile(context, playerId, playerName, state, preferredTeam = null) {
  const id = String(playerId ?? "");
  const name = String(playerName ?? "").trim();
  const registry = context?.playersById ?? {};
  if (id && registry[id]) return registry[id];
  if (name) {
    const registered = Object.values(registry).find((profile) => String(profile?.name ?? "") === name);
    if (registered) return registered;
  }
  const teams = [
    ...(preferredTeam?.roster ? [preferredTeam] : []),
    ...(state?.teams ?? []).filter((team) => String(team.id) !== String(preferredTeam?.id ?? ""))
  ];
  for (const team of teams) {
    const player = (team?.roster ?? []).find((entry) =>
      (id && (String(entry?.id ?? "") === id || String(entry?.playerId ?? "") === id)) ||
      (name && String(entry?.name ?? "") === name)
    );
    if (player) return gamecastProfileFromPlayer(player);
  }
  return null;
}

function resolveGamecastDefenseProfiles(context, team, state) {
  const ids = context?.defenseByTeamId?.[String(team?.id ?? "")] ?? {};
  const result = {};
  for (const [key, playerId] of Object.entries(ids)) {
    const profile = resolveGamecastPlayerProfile(context, playerId, "", state, team);
    if (profile) result[key] = profile;
  }
  return result;
}

export function resolveGamecastDefenderFieldingKey(defenderId, profilesByPosition, recordedPosition) {
  const rawRecorded = String(recordedPosition ?? "").trim().toUpperCase();
  const recorded = normalizeFieldingPosition(recordedPosition);
  const genericRecorded = ["IF", "OF", "내야수", "외야수"].includes(rawRecorded);
  const specificRecorded = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"].includes(recorded);

  // A play-by-play position describes the lane that was actually fielded.
  // The defense snapshot is only a fallback for old/generic events: a player
  // may appear under a different slot after substitutions or roster fallback
  // construction, and allowing that snapshot to win moves the wrong fielder.
  if (specificRecorded && !genericRecorded) return recorded;

  const id = String(defenderId ?? "");
  if (id) {
    const assigned = Object.entries(profilesByPosition ?? {}).find(([, profile]) => String(profile?.id ?? "") === id);
    if (assigned?.[0]) return normalizeFieldingPosition(assigned[0]);
  }
  return recorded;
}

function resolveGamecastBaseRunnerProfiles(ids, context, state, offenseTeam) {
  return Array.from({ length: 3 }, (_, index) => {
    const id = Array.isArray(ids) ? String(ids[index] ?? "") : "";
    return id ? resolveGamecastPlayerProfile(context, id, "", state, offenseTeam) : null;
  });
}

function gamecastProfileFromPlayer(player) {
  const position = String(player?.position ?? "").toUpperCase();
  return {
    id: String(player?.id ?? player?.playerId ?? ""),
    name: String(player?.name ?? ""),
    role: String(player?.role ?? ""),
    position,
    uniformNumber: String(player?.uniformNumber ?? player?.jerseyNumber ?? player?.number ?? ""),
    ovr: Math.max(0, Math.min(200, Math.round(Number(player?.ovr ?? player?.currentAbility ?? 0) || 0))),
    batting: gamecastCompositeProfileAbility(player, ["contactL", "contactR", "powerL", "powerR", "eye", "situational"]),
    pitching: gamecastCompositeProfileAbility(player, ["stuff", "control", "movement", "stamina", "pitchingIQ"]),
    fielding: gamecastCompositeProfileAbility(
      player,
      position === "C" ? ["defense", "range", "arm", "catching", "catching"] : ["defense", "range", "arm"]
    ),
    arm: Math.max(20, Math.min(200, Math.round((Number(player?.arm ?? player?.defense ?? 10) || 10) * 10))),
    running: gamecastCompositeProfileAbility(player, ["speed", "baserunning", "stealing"])
  };
}

function gamecastCompositeProfileAbility(player, keys) {
  const values = keys
    .map((key) => Number(player?.[key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return Math.max(0, Math.min(200, Math.round(Number(player?.ovr ?? 0) || 0)));
  return Math.max(0, Math.min(200, Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10)));
}

function buildFallbackGamecastDefenseMap(team) {
  const lineup = team?.roster ? buildLineup(team) : [];
  const used = new Set();
  const result = {};
  const positionOf = (player) => String(player?.position ?? "").toUpperCase();
  const score = (player) => gamecastCompositeProfileAbility(player, ["defense", "range", "arm", "catching"]);
  const assign = (key, candidates) => {
    const player = [...candidates]
      .sort((a, b) => score(b) - score(a) || Number(b?.ovr ?? 0) - Number(a?.ovr ?? 0))
      .find((entry) => {
        const id = String(entry?.id ?? entry?.playerId ?? "");
        return id && !used.has(id);
      });
    if (!player) return;
    const id = String(player.id ?? player.playerId);
    result[key] = id;
    used.add(id);
  };
  const exact = (key) => lineup.filter((player) => positionOf(player) === key);
  assign("C", [...exact("C"), ...lineup.filter((player) => positionOf(player).includes("C"))]);
  for (const key of ["SS", "2B", "3B", "1B"]) assign(key, exact(key));
  for (const key of ["CF", "LF", "RF"]) assign(key, exact(key));
  const infield = lineup.filter((player) => ["IF", "1B", "2B", "3B", "SS"].includes(positionOf(player)));
  const outfield = lineup.filter((player) => ["OF", "LF", "CF", "RF"].includes(positionOf(player)));
  for (const key of ["SS", "2B", "3B", "1B"]) if (!result[key]) assign(key, infield);
  for (const key of ["CF", "LF", "RF"]) if (!result[key]) assign(key, outfield);
  for (const key of ["C", "SS", "2B", "3B", "1B", "CF", "LF", "RF"]) {
    if (!result[key]) assign(key, lineup);
  }
  return result;
}

function gamecastAbilityVisual(profile) {
  if (!profile || !Number.isFinite(Number(profile.ovr))) return null;
  const score = Math.max(0, Math.min(200, Math.round(Number(profile.ovr))));
  const tier = GAMECAST_ABILITY_TIERS.find((entry) => score >= entry.min) ?? GAMECAST_ABILITY_TIERS.at(-1);
  return {
    grade: tier.key,
    color: tier.color,
    score,
    playerId: String(profile.id ?? ""),
    playerName: String(profile.name ?? "")
  };
}

function gamecastProfileUniformNumber(profile, fallbackName, fallbackId = "") {
  const raw = String(profile?.uniformNumber ?? "").trim();
  const value = Number(raw);
  return raw && Number.isFinite(value) ? Math.abs(Math.floor(value)) % 10 : gamecastUniformNumber(fallbackName, fallbackId);
}

function gamecastUniformNumber(name, id = "") {
  const text = `${name ?? ""}|${id ?? ""}`;
  let hash = 17;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
  }
  return hash % 10;
}

function normalizeScoredRunners(value, runs) {
  if (Array.isArray(value)) {
    return value.map((runner, index) => ({
      id: String(runner?.id ?? `run-${index + 1}`),
      name: String(runner?.name ?? "")
    }));
  }
  return Array.from({ length: Math.max(0, Number(runs) || 0) }, (_, index) => ({
    id: `run-${index + 1}`,
    name: ""
  }));
}

function toBaseTriple(value) {
  return Array.isArray(value)
    ? [Boolean(value[0]), Boolean(value[1]), Boolean(value[2])]
    : [false, false, false];
}

function normalizeGamecastBallparkProfile(game, homeTeam) {
  const rawPark = game?.ballpark && typeof game.ballpark === "object" ? game.ballpark : {};
  const rawId = String(rawPark.parkId ?? game?.ballparkId ?? "").trim();
  const rawName = String(rawPark.name ?? game?.ballparkName ?? game?.ballpark ?? homeTeam?.home ?? "").trim();
  const byId = rawId ? KBO_GAMECAST_BALLPARKS[rawId] : null;
  const byName = byId ?? gamecastBallparkByName(rawName);
  const profile = byName ?? KBO_GAMECAST_BALLPARKS.neutral;
  const attendance = Number(game?.attendance ?? 0);
  const capacity = gamecastBallparkCapacity(profile.id);
  const ratio = capacity > 0 ? Math.max(0.16, Math.min(1, attendance / capacity)) : 0.62;
  const homeColor = normalizeHexColor(getTeamColor(homeTeam), "#315288");
  return {
    ...profile,
    name: rawName || profile.label,
    teamId: homeTeam?.id ?? "",
    homeColor,
    attendance,
    capacity,
    attendanceRatio: ratio,
    weatherLabel: String(game?.weather ?? "")
  };
}

function gamecastBallparkByName(name) {
  const text = String(name ?? "").toLowerCase();
  if (!text) return null;
  if (text.includes("잠실")) return KBO_GAMECAST_BALLPARKS.jamsil;
  if (text.includes("사직")) return KBO_GAMECAST_BALLPARKS.sajik;
  if (text.includes("고척")) return KBO_GAMECAST_BALLPARKS.gocheok;
  if (text.includes("광주")) return KBO_GAMECAST_BALLPARKS.gwangju;
  if (text.includes("대구")) return KBO_GAMECAST_BALLPARKS.daegu;
  if (text.includes("인천") || text.includes("문학")) return KBO_GAMECAST_BALLPARKS.incheon;
  if (text.includes("수원")) return KBO_GAMECAST_BALLPARKS.suwon;
  if (text.includes("창원") || text.includes("마산")) return KBO_GAMECAST_BALLPARKS.changwon;
  if (text.includes("대전") || text.includes("한화")) return KBO_GAMECAST_BALLPARKS["daejeon-hanwha-life"];
  return null;
}

function gamecastBallparkCapacity(id) {
  return {
    jamsil: 23750,
    sajik: 22990,
    gocheok: 16744,
    gwangju: 20500,
    daegu: 24000,
    incheon: 23000,
    suwon: 18700,
    changwon: 22011,
    "daejeon-hanwha-life": 20007
  }[id] ?? 22000;
}

function gamecastNowTitle(event) {
  return `${formatNumber(event?.inning ?? 1)}회 ${event?.side === "home" ? "말" : "초"} · ${event?.offenseLabel ?? ""}`;
}

function formatGamecastInningCompact(event) {
  if (!event) return "LIVE";
  return `${formatNumber(event.inning)}회${event.side === "home" ? "말" : "초"}`;
}

function gamecastNowDetail(event) {
  return gamecastBroadcastSentence(event);
}

function gamecastFrameNowDetail(frame) {
  const event = frame?.event;
  if (!event) return "타석 이벤트 대기";
  if (gamecastFrameResultRevealed(frame)) return gamecastBroadcastSentence(event);
  const progress = Number(frame.progress ?? 0);
  if (event.outcome === "stolenBase" || event.outcome === "caughtStealing") {
    const runner = event.runnerName || event.hitterName || "주자";
    if (progress < 0.68) return `${runner} 주자가 다음 베이스로 스타트를 끊었습니다.`;
    return event.outcome === "stolenBase"
      ? `${runner} 주자가 송구보다 먼저 베이스에 들어갑니다.`
      : `${runner} 주자에게 태그가 먼저 들어갑니다.`;
  }
  const pitchEnd = gamecastPitchEnd(event);
  if (progress < pitchEnd - 0.04) {
    return `${event.pitcherName || "투수"} 와인드업, ${event.hitterName || "타자"}가 타이밍을 잡습니다.`;
  }
  if (progress < pitchEnd + 0.08) {
    return "공이 홈플레이트로 들어옵니다.";
  }
  if (isBattedBallOutcome(event.outcome)) {
    const defender = event.defenderName
      ? `${event.defenderName}${event.fieldingPosition ? `(${event.fieldingPosition})` : ""}`
      : "수비수";
    if (event.outcome === "homeRun") return "큰 타구가 외야 담장 쪽으로 뻗습니다.";
    if (event.outcome === "out" || event.doublePlay) return `${defender}가 타구를 따라 움직입니다.`;
    return "타구가 그라운드에 떨어지고 주자가 움직입니다.";
  }
  if (event.outcome === "walk") return "볼 카운트가 쌓이며 타자가 1루를 바라봅니다.";
  if (event.outcome === "strikeout") return "결정구가 포수 미트로 들어갑니다.";
  return "플레이가 진행 중입니다.";
}

function gamecastBroadcastSentence(event) {
  if (!event) return "타석 이벤트 대기";
  const hitter = event.hitterName || "타자";
  const defender = event.defenderName
    ? `${event.defenderName}${event.fieldingPosition ? `(${event.fieldingPosition})` : ""}`
    : event.fieldingPosition || "야수";
  const runs = Number(event.runs ?? 0);
  const scoring = runs > 0 ? ` ${formatNumber(runs)}득점이 들어옵니다.` : "";
  const lane = gamecastHitLane(event);
  const pick = (items) => items[gamecastEventNoise(event, 11) % items.length];

  if (event.outcome === "stolenBase") {
    return `${event.runnerName || hitter} 주자가 송구보다 먼저 베이스에 도착해 도루에 성공합니다.`;
  }
  if (event.outcome === "caughtStealing") {
    return `${event.runnerName || hitter} 주자가 포수 송구에 걸려 태그 아웃됩니다.`;
  }

  if (event.doublePlay) {
    return pick([
      `${hitter}의 타구, ${defender}가 시작한 병살 처리입니다.`,
      `${hitter} 땅볼, 수비가 침착하게 두 개의 아웃을 잡습니다.`
    ]);
  }
  if (event.outcome === "homeRun") {
    const homerType = runs >= 4 ? "만루 홈런" : runs === 3 ? "스리런" : runs === 2 ? "투런포" : "솔로포";
    return pick([
      `${hitter}, ${lane} 담장을 넘기는 ${homerType}!${scoring}`,
      `${hitter} 크게 받아쳤습니다. ${homerType}로 경기장이 들썩입니다!${scoring}`
    ]);
  }
  if (event.outcome === "single") {
    return pick([
      `${hitter}, ${lane} 깨끗한 안타입니다.${scoring}`,
      `${hitter}가 빈 곳을 정확히 갈라 1루에 안착합니다.${scoring}`
    ]);
  }
  if (event.outcome === "double") {
    return pick([
      `${hitter}, ${lane} 깊숙한 타구로 2루까지 갑니다.${scoring}`,
      `${hitter} 장타 코스를 만들며 스탠딩 더블입니다.${scoring}`
    ]);
  }
  if (event.outcome === "triple") {
    return pick([
      `${hitter}, 외야 사이를 완전히 가르며 3루까지 내달립니다.${scoring}`,
      `${hitter} 빠른 발로 3루에 헤드퍼스트, 3루타입니다.${scoring}`
    ]);
  }
  if (event.outcome === "walk") {
    return pick([
      `${hitter}, 공을 끝까지 골라내며 볼넷으로 출루합니다.`,
      `${hitter} 침착하게 볼넷을 얻어 공격을 이어갑니다.`
    ]);
  }
  if (event.outcome === "strikeout") {
    return pick([
      `${hitter} 헛스윙 삼진, 투수가 한숨 돌립니다.`,
      `${hitter} 루킹 삼진. 배터리의 선택이 통했습니다.`
    ]);
  }
  if (event.outcome === "error") {
    return `${hitter}의 타구, ${defender} 처리 중 실책입니다.${scoring}`;
  }
  if (event.outcome === "out") {
    const batted = battedBallTypeLabel(event.battedBallType);
    return pick([
      `${hitter} ${batted ? `${batted} ` : ""}타구, ${defender}가 처리합니다.`,
      `${hitter}의 타구가 수비 정면으로 향하며 아웃입니다.`
    ]);
  }
  return `${hitter} 타석 결과가 기록됩니다.${scoring}`;
}

function gamecastHitLane(event) {
  const noise = gamecastEventNoise(event, 5) % 5;
  if (event?.fieldingPosition?.includes("LF") || noise === 0) return "좌측";
  if (event?.fieldingPosition?.includes("RF") || noise === 1) return "우측";
  if (noise === 2) return "좌중간";
  if (noise === 3) return "우중간";
  return "중앙";
}

function battedBallTypeLabel(type) {
  if (type === "groundBall") return "땅볼";
  if (type === "lineDrive") return "라이너";
  if (type === "flyBall") return "뜬공";
  if (type === "popUp") return "팝플라이";
  return "";
}

export function gamecastOutcomeClass(outcome) {
  if (outcome === "homeRun") return "is-homer";
  if (["single", "double", "triple"].includes(outcome)) return "is-hit";
  if (outcome === "walk") return "is-walk";
  if (outcome === "error") return "is-error";
  if (outcome === "stolenBase") return "is-hit";
  if (outcome === "caughtStealing") return "is-out";
  if (outcome === "strikeout" || outcome === "out" || outcome === "sacrificeBunt") return "is-out";
  return "is-ball";
}

function initGamecastPixelScreen(root, appState = null) {
  cleanupActiveGamecastPixelScreen();

  const modalScreen = root?.querySelector?.("[data-gamecast-modal] [data-gamecast-screen]");
  const screens = modalScreen ? [modalScreen] : [...(root?.querySelectorAll?.("[data-gamecast-screen]") ?? [])];
  const controllers = [];

  for (const screen of screens) {
    const board = screen.closest("[data-gamecast-board]");
    const instanceRoot = screen.closest("[data-gamecast-instance-root]") ?? root;
    const canvas = screen.querySelector("[data-gamecast-canvas]");
    const stage = screen.querySelector("[data-gamecast-stage]");
    const playerLabel = screen.querySelector("[data-gamecast-player-label]");
    const actionBurst = screen.querySelector("[data-gamecast-action-burst]");
    const engine = normalizeGamecastEngine(screen.dataset?.gamecastEngineCurrent ?? latestGamecastEngine);
    if (!board || !canvas) continue;

    const controllerOptions = {
      screen,
      stage,
      canvas,
      appState,
      sequence: latestGamecastSequence,
      scoreNodes: [...board.querySelectorAll(".gamecast-scoreline strong")],
      nowTitle: board.querySelector(".gamecast-now strong"),
      nowDetail: board.querySelector(".gamecast-now small"),
      matchup: board.querySelector("[data-gamecast-matchup]"),
      playerLabel,
      actionBurst,
      pauseOverlay: collectGamecastPauseOverlay(screen),
      fpsNode: screen.querySelector("[data-gamecast-fps]"),
      hud: collectGamecastHud(screen),
      feedList: instanceRoot.querySelector("[data-gamecast-feed]"),
      feedItems: [...instanceRoot.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]")],
      speedControls: [...board.querySelectorAll("[data-gamecast-speed]")],
      pauseControls: [...board.querySelectorAll("[data-gamecast-pause]")],
      pauseActionControls: [...screen.querySelectorAll("[data-gamecast-pause-action]")],
      stepControls: [...board.querySelectorAll("[data-gamecast-step]")],
      soundControls: [...board.querySelectorAll("[data-gamecast-sound]")],
      skipControls: [...board.querySelectorAll("[data-gamecast-skip]")]
    };

    const phaserScreen = screen.classList.contains("gamecast-screen-large");
    if (engine === "v2" && canUseGamecast2()) {
      const controller = createGamecastPhaserController({ ...controllerOptions, renderer: "v2" });
      if (controller) {
        controllers.push(controller);
        continue;
      }
    }
    if (engine === "phaser" && phaserScreen && canUseGamecastPhaser()) {
      const controller = createGamecastPhaserController({ ...controllerOptions, renderer: "phaser" });
      if (controller) {
        controllers.push(controller);
        continue;
      }
    }

    if (typeof canvas.getContext !== "function") continue;
    screen.classList.remove("is-phaser", "is-phaser-active", "is-v2", "is-v2-active");
    screen.classList.add("is-canvas");
    screen.dataset.gamecastEngineCurrent = "canvas";

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    controllers.push(createGamecastPixelController({
      ...controllerOptions,
      ctx,
    }));
  }

  cleanupGamecastPixelScreen = () => {
    for (const controller of controllers) controller.cleanup();
  };
}

function collectGamecastPauseOverlay(screen) {
  const root = screen?.querySelector?.("[data-gamecast-pause-overlay]");
  if (!root) return null;
  return {
    root,
    kicker: root.querySelector("[data-gamecast-pause-kicker]"),
    title: root.querySelector("[data-gamecast-pause-title]"),
    detail: root.querySelector("[data-gamecast-pause-detail]"),
    action: root.querySelector("[data-gamecast-pause-action]")
  };
}

function collectGamecastHud(screen) {
  const root = screen?.querySelector?.("[data-gamecast-hud]");
  if (!root) return null;
  return {
    root,
    inning: root.querySelector("[data-gamecast-jumbo-inning]"),
    result: root.querySelector("[data-gamecast-jumbo-result]"),
    away: root.querySelector("[data-gamecast-jumbo-away]"),
    home: root.querySelector("[data-gamecast-jumbo-home]"),
    balls: [...root.querySelectorAll("[data-gamecast-ball-pip]")],
    strikes: [...root.querySelectorAll("[data-gamecast-strike-pip]")],
    outs: [...root.querySelectorAll("[data-gamecast-out-pip]")],
    bases: [...root.querySelectorAll("[data-gamecast-base-pip]")]
  };
}

function createGamecastPalette(ballparkProfile = null) {
  const park = normalizeGamecastSequenceBallpark(ballparkProfile);
  const grass = park.grass ?? ["#4f8a73", "#8fd0b4"];
  const seats = park.seatColors ?? ["#6f6874", "#575160", "#b9d9f7"];
  const homeColor = normalizeHexColor(park.homeColor, "#315288");
  const grassLow = normalizeHexColor(grass[0], "#4f8a73");
  const grassHighRaw = normalizeHexColor(grass[1], "#8fd0b4");
  const grassHi = mixHexColors(grassHighRaw, grassLow, 0.36);
  const grassLo = mixHexColors(grassLow, grassHighRaw, 0.16);
  return {
    outline: "#1c2336",
    grassLo,
    grassHi,
    grassEdge: mixHexColors(grassLo, "#23202a", 0.2),
    grassD: grassLow,
    grassM: grassHi,
    grassL: mixHexColors(grassHi, "#fffefb", 0.06),
    dirtD: "#c78a3e",
    dirtM: "#e8b866",
    dirtL: "#ffe39a",
    base: "#fffefb",
    baseSh: "#c9bcab",
    uniform: "#f2f6f9",
    uniformSh: "#cad5e1",
    uniformAway: "#5b6d84",
    uniformInk: "#575160",
    uniformHi: "#ffffff",
    runner: "#c64b74",
    runnerL: "#e57a9b",
    defender: "#315288",
    defenderL: "#b9d9f7",
    defenderSh: "#223f68",
    bat: "#67274b",
    glove: "#4f2041",
    ballSeam: "#d92f42",
    ballGlow: "#fff3bf",
    ballWake: "#fff8d7",
    hit: "#8fd0b4",
    homer: "#ff8f83",
    homerL: "#ffb3a6",
    spark: "#ffd23f",
    sparkL: "#fff0a8",
    throw: "#ddecff",
    shadow: "#2f4f45",
    chalkSh: "#dfeee6",
    ribbon: "#d94f75",
    light: "#fff6c7",
    walk: "#b9d9f7",
    legs: "#3a3550",
    skin: "#f8a683",
    wall: normalizeHexColor(park.wallColor, "#24483a"),
    wallCap: normalizeHexColor(park.wallCap, "#1b3a2e"),
    track: "#caa25f",
    stand: normalizeHexColor(seats[0], "#6f6874"),
    standD: normalizeHexColor(seats[1], "#575160"),
    crowdA: homeColor,
    crowdB: normalizeHexColor(seats[2], "#b9d9f7"),
    crowdC: "#ffe39a",
    crowdSkin: "#f2c79a",
    crowdHair: "#2d2630",
    pole: "#ffd23f",
    out: "#77717a"
  };
}

function createGamecastPhaserController({ screen, stage, canvas, appState, sequence, scoreNodes, nowTitle, nowDetail, matchup, playerLabel, actionBurst, pauseOverlay, fpsNode, hud, feedList, feedItems, speedControls = [], pauseControls = [], pauseActionControls = [], stepControls = [], soundControls = [], skipControls = [], renderer = "phaser" }) {
  const normalizedSequence = normalizeGamecastSequenceForPlayback(sequence);
  const palette = createGamecastPalette(normalizedSequence.ballparkProfile);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const state = {
    playbackRate: sanitizeGamecastSpeed(normalizedSequence.playbackRate),
    paused: Boolean(normalizedSequence.paused || normalizedSequence.hold),
    stepMode: Boolean(normalizedSequence.stepMode),
    holdsEnabled: normalizedSequence.holdsEnabled !== false,
    hold: normalizeGamecastHold(normalizedSequence.hold) ?? (normalizedSequence.paused ? { type: "manual", key: "manual" } : null),
    lastHoldKey: String(normalizedSequence.lastHoldKey ?? ""),
    soundEnabled: normalizedSequence.soundEnabled !== false && gamecastSoundEnabled,
    soundMarks: new Set(),
    elapsedMs: Number(normalizedSequence.initialElapsedMs ?? 0),
    done: Boolean(normalizedSequence.done),
    hidden: typeof document !== "undefined" ? document.hidden : false,
    visible: true,
    screen,
    sequence: normalizedSequence,
    appState,
    scoreNodes,
    nowTitle,
    nowDetail,
    matchup,
    playerLabel,
    actionBurst,
    pauseOverlay,
    fpsNode,
    fpsStats: createGamecastFpsStats(),
    hud,
    feedList,
    feedItems,
    palette,
    prefersReducedMotion,
    shakeTimer: 0,
    resumeTimer: 0,
    shakenEventId: ""
  };
  if (state.done) state.elapsedMs = gamecastTotalDuration(state.sequence);

  const rendererEngine = renderer === "v2" ? "v2" : "phaser";
  const mountRenderer = rendererEngine === "v2" ? mountGamecast2 : mountGamecastPhaser;
  const rendererHandle = mountRenderer({
    screen,
    stage,
    canvas,
    sequence: state.sequence,
    fieldProfile: state.sequence.ballparkProfile,
    width: GAMECAST_PIXEL_W,
    height: GAMECAST_PIXEL_H,
    palette,
    basePositions: gamecastBasePositions(),
    playbackRate: state.playbackRate,
    elapsedMs: state.elapsedMs,
    prefersReducedMotion,
    makeFrame(elapsedMs, forceFinal = false) {
      state.elapsedMs = Number(elapsedMs ?? 0);
      persistGamecastPlayback(state);
      return buildGamecastFrameState(state, forceFinal);
    },
    onFrame(frame) {
      state.currentFrame = frame;
      syncGamecastDom(state, frame);
      rendererHandle.setSpeed(gamecastEffectivePlaybackRate(state, frame));
      maybeHoldGamecastPlayback(state, frame, applyHold);
    },
    onImpact(frame) {
      if (!frame?.event || state.shakenEventId === frame.event.id || state.prefersReducedMotion) return;
      triggerGamecastShake(screen, state);
      state.shakenEventId = frame.event.id;
    },
    onDone() {
      state.done = true;
      state.elapsedMs = gamecastTotalDuration(state.sequence);
      persistGamecastPlayback(state, { done: true, elapsedMs: state.elapsedMs });
      syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
    }
  });

  if (!rendererHandle) return null;

  const renderHoldFrame = () => {
    const frame = buildGamecastFrameState(state, false);
    syncGamecastDom(state, { ...frame, paused: true, hold: state.hold });
    return frame;
  };
  const clearResumeTimer = () => {
    if (!state.resumeTimer) return;
    window.clearTimeout(state.resumeTimer);
    state.resumeTimer = 0;
  };
  const setPaused = (paused, hold = null) => {
    if (state.done) return;
    clearResumeTimer();
    state.paused = Boolean(paused);
    state.hold = state.paused ? normalizeGamecastHold(hold) ?? { type: "manual", key: "manual" } : null;
    persistGamecastPlayback(state, {
      paused: state.paused,
      hold: state.hold,
      lastHoldKey: state.lastHoldKey
    });
    if (state.paused) {
      rendererHandle.pause();
      renderHoldFrame();
    } else if (shouldRunGamecastPlayback(state)) {
      rendererHandle.setSpeed(gamecastEffectivePlaybackRate(state));
      rendererHandle.resume();
    }
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const requestResume = () => {
    if (!state.paused || state.done) return;
    const hold = normalizeGamecastHold(state.hold);
    if (hold?.resumeElapsedMs !== null && hold?.resumeElapsedMs !== undefined) {
      state.elapsedMs = Math.min(gamecastTotalDuration(state.sequence), hold.resumeElapsedMs);
      rendererHandle.seek?.(state.elapsedMs);
    }
    state.hold = {
      type: "resume",
      key: hold?.key ?? "resume",
      eventIndex: hold?.eventIndex ?? -1,
      resumeElapsedMs: null,
      title: "재개",
      detail: "잠시 후 이어집니다.",
      action: ""
    };
    persistGamecastPlayback(state, { paused: true, hold: state.hold, elapsedMs: state.elapsedMs });
    renderHoldFrame();
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
    clearResumeTimer();
    state.resumeTimer = window.setTimeout(() => {
      state.resumeTimer = 0;
      state.paused = false;
      state.hold = null;
      persistGamecastPlayback(state, { paused: false, hold: null, elapsedMs: state.elapsedMs });
      syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
      if (shouldRunGamecastPlayback(state)) {
        rendererHandle.setSpeed(gamecastEffectivePlaybackRate(state));
        rendererHandle.resume();
      }
    }, GAMECAST_RESUME_COUNTDOWN_MS);
  };
  const resumeImmediatelyFromHold = () => {
    if (!state.paused || state.done) return false;
    const hold = normalizeGamecastHold(state.hold);
    if (!isAutomaticGamecastHold(hold)) return false;
    clearResumeTimer();
    if (hold?.resumeElapsedMs !== null && hold?.resumeElapsedMs !== undefined) {
      state.elapsedMs = Math.min(gamecastTotalDuration(state.sequence), hold.resumeElapsedMs);
      rendererHandle.seek?.(state.elapsedMs);
    }
    state.paused = false;
    state.hold = null;
    persistGamecastPlayback(state, { paused: false, hold: null, elapsedMs: state.elapsedMs });
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
    if (shouldRunGamecastPlayback(state)) {
      rendererHandle.setSpeed(gamecastEffectivePlaybackRate(state));
      rendererHandle.resume();
    }
    return true;
  };
  const applyHold = (hold) => {
    const normalizedHold = normalizeGamecastHold(hold);
    if (!normalizedHold || state.done) return false;
    state.lastHoldKey = normalizedHold.key || state.lastHoldKey;
    rendererHandle.seek?.(state.elapsedMs);
    setPaused(true, normalizedHold);
    return true;
  };
  const togglePause = (allowUnlock = false) => {
    if (state.done) return;
    if (allowUnlock && state.soundEnabled) resumeGamecastAudio(true);
    if (state.paused) requestResume();
    else setPaused(true, { type: "manual", key: "manual", eventIndex: -1, title: "일시정지" });
  };
  const setStepMode = (enabled) => {
    state.stepMode = Boolean(enabled);
    if (state.appState) {
      state.appState.ui = {
        ...(state.appState.ui ?? {}),
        gamecastStepMode: state.stepMode
      };
    }
    persistGamecastPlayback(state, { stepMode: state.stepMode });
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const setSpeed = (speed) => {
    if (state.done) return;
    state.playbackRate = sanitizeGamecastSpeed(speed);
    if (state.appState) {
      state.appState.ui = {
        ...(state.appState.ui ?? {}),
        gamecastPlaybackRate: state.playbackRate
      };
    }
    persistGamecastPlayback(state, { playbackRate: state.playbackRate });
    rendererHandle.setSpeed(gamecastEffectivePlaybackRate(state));
    if (isFastGamecastPlayback(state)) resumeImmediatelyFromHold();
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const setSound = (enabled, allowUnlock = false) => {
    state.soundEnabled = Boolean(enabled);
    gamecastSoundEnabled = state.soundEnabled;
    if (state.appState) {
      state.appState.ui = {
        ...(state.appState.ui ?? {}),
        gamecastSound: state.soundEnabled
      };
    }
    if (state.soundEnabled) resumeGamecastAudio(allowUnlock);
    syncGamecastSoundControls(state, soundControls);
  };
  const finish = () => {
    clearResumeTimer();
    state.done = true;
    state.paused = false;
    state.hold = null;
    state.elapsedMs = gamecastTotalDuration(state.sequence);
    persistGamecastPlayback(state, { done: true, paused: false, hold: null, elapsedMs: state.elapsedMs });
    rendererHandle.seek?.(state.elapsedMs);
    rendererHandle.finish();
    const finalFrame = buildGamecastFrameState(state, true);
    state.currentFrame = finalFrame;
    syncGamecastDom(state, finalFrame);
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const onPauseClick = (event) => {
    event.preventDefault();
    togglePause(Boolean(event.isTrusted));
  };
  const onStepClick = (event) => {
    event.preventDefault();
    setStepMode(!state.stepMode);
  };
  const onSpeedClick = (event) => {
    event.preventDefault();
    setSpeed(event.currentTarget?.dataset?.gamecastSpeed);
  };
  const onSkipClick = (event) => {
    event.preventDefault();
    finish();
  };
  const onSoundClick = (event) => {
    event.preventDefault();
    setSound(!state.soundEnabled, Boolean(event.isTrusted));
  };
  const onScreenClick = (event) => {
    if (event.target?.closest?.("button, a, input, select, textarea")) return;
    togglePause(Boolean(event.isTrusted));
  };
  const onKeyDown = (event) => {
    if (event.code !== "Space" || event.repeat) return;
    if (!screen.isConnected) return;
    if (event.target?.closest?.("button, input, select, textarea, [contenteditable='true']")) return;
    event.preventDefault();
    togglePause(Boolean(event.isTrusted));
  };
  const onVisibilityChange = () => {
    state.hidden = Boolean(document.hidden);
    if (state.hidden) rendererHandle.pause();
    else if (shouldRunGamecastPlayback(state)) rendererHandle.resume();
  };

  syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  syncGamecastSoundControls(state, soundControls);
  for (const button of speedControls) button.addEventListener("click", onSpeedClick);
  for (const button of pauseControls) button.addEventListener("click", onPauseClick);
  for (const button of pauseActionControls) button.addEventListener("click", onPauseClick);
  for (const button of stepControls) button.addEventListener("click", onStepClick);
  for (const button of soundControls) button.addEventListener("click", onSoundClick);
  for (const button of skipControls) button.addEventListener("click", onSkipClick);
  screen.addEventListener("click", onScreenClick);

  const intersectionObserver = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
    state.visible = entries.some((entry) => entry.isIntersecting);
    // A completed replay can be remounted after a dashboard tab switch. Let
    // Phaser present that final frame once before its runtime schedules the
    // loop shutdown; pausing here can otherwise stop the loader/renderer on a
    // freshly created, still-blank canvas.
    if (state.done) return;
    if (shouldRunGamecastPlayback(state)) rendererHandle.resume();
    else rendererHandle.pause();
  }, { threshold: 0.05 }) : null;
  intersectionObserver?.observe(screen);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("keydown", onKeyDown);
  }

  screen.classList.add(rendererEngine === "v2" ? "is-v2-active" : "is-phaser-active");
  if (state.paused) {
    rendererHandle.pause();
    renderHoldFrame();
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  }

  return {
    cleanup() {
      persistGamecastPlayback(state);
      clearResumeTimer();
      rendererHandle.cleanup();
      intersectionObserver?.disconnect();
      for (const button of speedControls) button.removeEventListener("click", onSpeedClick);
      for (const button of pauseControls) button.removeEventListener("click", onPauseClick);
      for (const button of pauseActionControls) button.removeEventListener("click", onPauseClick);
      for (const button of stepControls) button.removeEventListener("click", onStepClick);
      for (const button of soundControls) button.removeEventListener("click", onSoundClick);
      for (const button of skipControls) button.removeEventListener("click", onSkipClick);
      screen.removeEventListener("click", onScreenClick);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        document.removeEventListener("keydown", onKeyDown);
      }
      if (state.shakeTimer) window.clearTimeout(state.shakeTimer);
      screen.classList.remove("is-shaking", "is-phaser-active", "is-v2-active");
      if (state.playerLabel) state.playerLabel.classList.remove("is-visible", "is-scoring");
      syncGamecastActionBurst(state.actionBurst, null);
      for (const item of state.feedItems ?? []) item.classList.remove("is-live");
    }
  };
}

function createGamecastPixelController({ screen, stage, canvas, ctx, appState, sequence, scoreNodes, nowTitle, nowDetail, matchup, playerLabel, actionBurst, pauseOverlay, fpsNode, hud, feedList, feedItems, speedControls = [], pauseControls = [], pauseActionControls = [], stepControls = [], soundControls = [], skipControls = [] }) {
  const normalizedSequence = normalizeGamecastSequenceForPlayback(sequence);
  const palette = createGamecastPalette(normalizedSequence.ballparkProfile);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const state = {
    animationFrame: 0,
    visible: true,
    screen,
    hidden: typeof document !== "undefined" ? document.hidden : false,
    scale: 1,
    dpr: 1,
    playbackRate: sanitizeGamecastSpeed(normalizedSequence.playbackRate),
    paused: Boolean(normalizedSequence.paused || normalizedSequence.hold),
    stepMode: Boolean(normalizedSequence.stepMode),
    holdsEnabled: normalizedSequence.holdsEnabled !== false,
    hold: normalizeGamecastHold(normalizedSequence.hold) ?? (normalizedSequence.paused ? { type: "manual", key: "manual" } : null),
    lastHoldKey: String(normalizedSequence.lastHoldKey ?? ""),
    soundEnabled: normalizedSequence.soundEnabled !== false && gamecastSoundEnabled,
    soundMarks: new Set(),
    elapsedMs: Number(normalizedSequence.initialElapsedMs ?? 0),
    lastTimestamp: 0,
    done: Boolean(normalizedSequence.done),
    shakeTimer: 0,
    offscreenTimer: 0,
    resumeTimer: 0,
    sequence: normalizedSequence,
    appState,
    scoreNodes,
    nowTitle,
    nowDetail,
    matchup,
    playerLabel,
    actionBurst,
    pauseOverlay,
    fpsNode,
    fpsStats: createGamecastFpsStats(),
    hud,
    feedList,
    feedItems,
    palette,
    fieldCache: buildGamecastFieldCache(palette, normalizedSequence.ballparkProfile),
    prefersReducedMotion,
    shakenEventId: ""
  };
  if (state.done) state.elapsedMs = gamecastTotalDuration(state.sequence);

  const resize = () => resizeGamecastCanvas(screen, stage, canvas, ctx, state);
  const stop = () => {
    if (state.animationFrame) {
      window.cancelAnimationFrame(state.animationFrame);
      state.animationFrame = 0;
    }
    state.lastTimestamp = 0;
  };
  const renderCurrentFrame = (forceFinal = false) => {
    const frame = buildGamecastFrameState(state, forceFinal);
    state.currentFrame = frame;
    drawGamecastFrame(ctx, state, frame);
    syncGamecastDom(state, state.paused ? { ...frame, paused: true, hold: state.hold } : frame);
    persistGamecastPlayback(state);
    return frame;
  };
  const clearResumeTimer = () => {
    if (!state.resumeTimer) return;
    window.clearTimeout(state.resumeTimer);
    state.resumeTimer = 0;
  };
  const setPaused = (paused, hold = null) => {
    if (state.done) return;
    clearResumeTimer();
    state.paused = Boolean(paused);
    state.hold = state.paused ? normalizeGamecastHold(hold) ?? { type: "manual", key: "manual" } : null;
    persistGamecastPlayback(state, {
      paused: state.paused,
      hold: state.hold,
      lastHoldKey: state.lastHoldKey
    });
    if (state.paused) {
      stop();
      renderCurrentFrame(false);
    } else {
      start();
    }
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const requestResume = () => {
    if (!state.paused || state.done) return;
    const hold = normalizeGamecastHold(state.hold);
    if (hold?.resumeElapsedMs !== null && hold?.resumeElapsedMs !== undefined) {
      state.elapsedMs = Math.min(gamecastTotalDuration(state.sequence), hold.resumeElapsedMs);
    }
    state.hold = {
      type: "resume",
      key: hold?.key ?? "resume",
      eventIndex: hold?.eventIndex ?? -1,
      resumeElapsedMs: null,
      title: "재개",
      detail: "잠시 후 이어집니다.",
      action: ""
    };
    persistGamecastPlayback(state, { paused: true, hold: state.hold, elapsedMs: state.elapsedMs });
    renderCurrentFrame(false);
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
    clearResumeTimer();
    state.resumeTimer = window.setTimeout(() => {
      state.resumeTimer = 0;
      state.paused = false;
      state.hold = null;
      state.lastTimestamp = 0;
      persistGamecastPlayback(state, { paused: false, hold: null, elapsedMs: state.elapsedMs });
      syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
      start();
    }, GAMECAST_RESUME_COUNTDOWN_MS);
  };
  const resumeImmediatelyFromHold = () => {
    if (!state.paused || state.done) return false;
    const hold = normalizeGamecastHold(state.hold);
    if (!isAutomaticGamecastHold(hold)) return false;
    clearResumeTimer();
    if (hold?.resumeElapsedMs !== null && hold?.resumeElapsedMs !== undefined) {
      state.elapsedMs = Math.min(gamecastTotalDuration(state.sequence), hold.resumeElapsedMs);
    }
    state.paused = false;
    state.hold = null;
    state.lastTimestamp = 0;
    persistGamecastPlayback(state, { paused: false, hold: null, elapsedMs: state.elapsedMs });
    renderCurrentFrame(false);
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
    start();
    return true;
  };
  const applyHold = (hold) => {
    const normalizedHold = normalizeGamecastHold(hold);
    if (!normalizedHold || state.done) return false;
    state.lastHoldKey = normalizedHold.key || state.lastHoldKey;
    setPaused(true, normalizedHold);
    return true;
  };
  const togglePause = (allowUnlock = false) => {
    if (state.done) return;
    if (allowUnlock && state.soundEnabled) resumeGamecastAudio(true);
    if (state.paused) requestResume();
    else setPaused(true, { type: "manual", key: "manual", eventIndex: -1, title: "일시정지" });
  };
  const setStepMode = (enabled) => {
    state.stepMode = Boolean(enabled);
    if (state.appState) {
      state.appState.ui = {
        ...(state.appState.ui ?? {}),
        gamecastStepMode: state.stepMode
      };
    }
    persistGamecastPlayback(state, { stepMode: state.stepMode });
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const finish = () => {
    clearResumeTimer();
    state.done = true;
    state.paused = false;
    state.hold = null;
    state.elapsedMs = gamecastTotalDuration(state.sequence);
    persistGamecastPlayback(state, { done: true, paused: false, hold: null, elapsedMs: state.elapsedMs });
    stop();
    renderCurrentFrame(true);
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  };
  const pauseOffscreen = () => {
    stop();
    const frame = buildGamecastFrameState(state, false);
    drawGamecastFrame(ctx, state, frame);
    syncGamecastDom(state, { ...frame, paused: true });
  };
  const clearOffscreenPause = () => {
    if (state.offscreenTimer) {
      window.clearTimeout(state.offscreenTimer);
      state.offscreenTimer = 0;
    }
  };
  const scheduleOffscreenPause = () => {
    clearOffscreenPause();
    state.offscreenTimer = window.setTimeout(() => {
      state.offscreenTimer = 0;
      if (!state.visible && !state.hidden && !state.done) {
        pauseOffscreen();
      }
    }, 900);
  };
  const loop = (timestamp) => {
    if (state.hidden) {
      stop();
      return;
    }
    if (state.paused) {
      stop();
      renderCurrentFrame(false);
      return;
    }
    if (!state.visible) {
      pauseOffscreen();
      return;
    }
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = Math.min(80, Math.max(0, timestamp - state.lastTimestamp));
    state.lastTimestamp = timestamp;
    state.elapsedMs += delta * gamecastEffectivePlaybackRate(state, state.currentFrame);
    const frame = renderCurrentFrame(false);
    if (maybeHoldGamecastPlayback(state, frame, applyHold)) return;
    if (shouldTriggerGamecastImpactShake(frame) && !state.prefersReducedMotion && state.shakenEventId !== frame.event.id) {
      triggerGamecastShake(screen, state);
      state.shakenEventId = frame.event.id;
    }
    if (frame.done) {
      state.done = true;
      state.elapsedMs = gamecastTotalDuration(state.sequence);
      persistGamecastPlayback(state, { done: true, elapsedMs: state.elapsedMs });
      stop();
      syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
      return;
    }
    state.animationFrame = window.requestAnimationFrame(loop);
  };
  const start = () => {
    if (state.prefersReducedMotion || !state.sequence.events.length || state.done) {
      stop();
      if (state.prefersReducedMotion || !state.sequence.events.length) {
        state.done = true;
        state.elapsedMs = gamecastTotalDuration(state.sequence);
      }
      renderCurrentFrame(state.done || state.prefersReducedMotion || !state.sequence.events.length);
      return;
    }
    if (!state.animationFrame && shouldRunGamecastPlayback(state)) {
      state.animationFrame = window.requestAnimationFrame(loop);
    }
  };
  const onVisibilityChange = () => {
    state.hidden = Boolean(document.hidden);
    if (state.hidden) stop();
    else if (shouldRunGamecastPlayback(state)) start();
  };
  const setSpeed = (speed) => {
    if (state.done) return;
    state.playbackRate = sanitizeGamecastSpeed(speed);
    if (state.appState) {
      state.appState.ui = {
        ...(state.appState.ui ?? {}),
        gamecastPlaybackRate: state.playbackRate
      };
    }
    state.done = false;
    state.lastTimestamp = 0;
    persistGamecastPlayback(state, { playbackRate: state.playbackRate, done: false });
    if (isFastGamecastPlayback(state)) resumeImmediatelyFromHold();
    syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
    start();
  };
  const setSound = (enabled, allowUnlock = false) => {
    state.soundEnabled = Boolean(enabled);
    gamecastSoundEnabled = state.soundEnabled;
    if (state.appState) {
      state.appState.ui = {
        ...(state.appState.ui ?? {}),
        gamecastSound: state.soundEnabled
      };
    }
    if (state.soundEnabled) resumeGamecastAudio(allowUnlock);
    syncGamecastSoundControls(state, soundControls);
  };
  const onSpeedClick = (event) => {
    event.preventDefault();
    setSpeed(event.currentTarget?.dataset?.gamecastSpeed);
  };
  const onPauseClick = (event) => {
    event.preventDefault();
    togglePause(Boolean(event.isTrusted));
  };
  const onStepClick = (event) => {
    event.preventDefault();
    setStepMode(!state.stepMode);
  };
  const onSoundClick = (event) => {
    event.preventDefault();
    setSound(!state.soundEnabled, Boolean(event.isTrusted));
  };
  const onSkipClick = (event) => {
    event.preventDefault();
    finish();
  };
  const onScreenClick = (event) => {
    if (event.target?.closest?.("button, a, input, select, textarea")) return;
    togglePause(Boolean(event.isTrusted));
  };
  const onKeyDown = (event) => {
    if (event.code !== "Space" || event.repeat) return;
    if (!screen.isConnected) return;
    if (event.target?.closest?.("button, input, select, textarea, [contenteditable='true']")) return;
    event.preventDefault();
    togglePause(Boolean(event.isTrusted));
  };

  resize();
  renderCurrentFrame(state.done || state.prefersReducedMotion || !state.sequence.events.length);
  syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls);
  syncGamecastSoundControls(state, soundControls);
  for (const button of speedControls) button.addEventListener("click", onSpeedClick);
  for (const button of pauseControls) button.addEventListener("click", onPauseClick);
  for (const button of pauseActionControls) button.addEventListener("click", onPauseClick);
  for (const button of stepControls) button.addEventListener("click", onStepClick);
  for (const button of soundControls) button.addEventListener("click", onSoundClick);
  for (const button of skipControls) button.addEventListener("click", onSkipClick);
  screen.addEventListener("click", onScreenClick);

  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
    resize();
    renderCurrentFrame(state.done || state.prefersReducedMotion);
  }) : null;
  resizeObserver?.observe(screen);

  const intersectionObserver = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
    state.visible = entries.some((entry) => entry.isIntersecting);
    if (state.visible) {
      clearOffscreenPause();
      if (shouldRunGamecastPlayback(state)) start();
    } else {
      scheduleOffscreenPause();
    }
  }, { threshold: 0.05 }) : null;
  intersectionObserver?.observe(screen);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("keydown", onKeyDown);
  }
  start();

  return {
    cleanup() {
      persistGamecastPlayback(state);
      clearResumeTimer();
      stop();
      if (state.shakeTimer) window.clearTimeout(state.shakeTimer);
      clearOffscreenPause();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      for (const button of speedControls) button.removeEventListener("click", onSpeedClick);
      for (const button of pauseControls) button.removeEventListener("click", onPauseClick);
      for (const button of pauseActionControls) button.removeEventListener("click", onPauseClick);
      for (const button of stepControls) button.removeEventListener("click", onStepClick);
      for (const button of soundControls) button.removeEventListener("click", onSoundClick);
      for (const button of skipControls) button.removeEventListener("click", onSkipClick);
      screen.removeEventListener("click", onScreenClick);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        document.removeEventListener("keydown", onKeyDown);
      }
      screen.classList.remove("is-shaking");
      if (state.playerLabel) state.playerLabel.classList.remove("is-visible", "is-scoring");
      syncGamecastActionBurst(state.actionBurst, null);
      for (const item of state.feedItems ?? []) item.classList.remove("is-live");
    }
  };
}

function normalizeGamecastSequenceForPlayback(sequence) {
  const normalized = {
    id: String(sequence?.id ?? "gamecast-idle"),
    awayId: String(sequence?.awayId ?? ""),
    homeId: String(sequence?.homeId ?? ""),
    startAway: Number(sequence?.startAway ?? sequence?.finalAway ?? 0),
    startHome: Number(sequence?.startHome ?? sequence?.finalHome ?? 0),
    finalAway: Number(sequence?.finalAway ?? sequence?.startAway ?? 0),
    finalHome: Number(sequence?.finalHome ?? sequence?.startHome ?? 0),
    ballparkProfile: normalizeGamecastSequenceBallpark(sequence?.ballparkProfile),
    attendance: Number(sequence?.attendance ?? sequence?.ballparkProfile?.attendance ?? 0),
    weatherLabel: String(sequence?.weatherLabel ?? sequence?.ballparkProfile?.weatherLabel ?? ""),
    mode: String(sequence?.mode ?? "summary"),
    paMs: Math.max(80, Number(sequence?.paMs ?? GAMECAST_PA_MS)),
    gapMs: Math.max(0, Number(sequence?.gapMs ?? GAMECAST_PA_GAP_MS)),
    playbackRate: sanitizeGamecastSpeed(sequence?.playbackRate),
    initialElapsedMs: Math.max(0, Number(sequence?.initialElapsedMs ?? 0)),
    done: Boolean(sequence?.done),
    paused: Boolean(sequence?.paused),
    stepMode: Boolean(sequence?.stepMode),
    holdsEnabled: sequence?.holdsEnabled !== false,
    hold: normalizeGamecastHold(sequence?.hold),
    lastHoldKey: String(sequence?.lastHoldKey ?? ""),
    soundEnabled: sequence?.soundEnabled !== false,
    events: Array.isArray(sequence?.events) ? sequence.events : []
  };
  normalized.totalMs = gamecastTotalDuration(normalized);
  normalized.initialElapsedMs = Math.min(normalized.totalMs, normalized.initialElapsedMs);
  if (normalized.done) {
    normalized.initialElapsedMs = normalized.totalMs;
    normalized.paused = false;
    normalized.hold = null;
  }
  return {
    ...normalized
  };
}

function normalizeGamecastSequenceBallpark(profile) {
  if (!profile || typeof profile !== "object") return KBO_GAMECAST_BALLPARKS.neutral;
  const base = KBO_GAMECAST_BALLPARKS[String(profile.id ?? "")] ?? KBO_GAMECAST_BALLPARKS.neutral;
  const attendance = Number(profile.attendance ?? 0);
  const capacity = Number(profile.capacity ?? gamecastBallparkCapacity(base.id));
  return {
    ...base,
    ...profile,
    id: String(profile.id ?? base.id),
    attendance,
    capacity,
    attendanceRatio: Math.max(0.16, Math.min(1, Number(profile.attendanceRatio ?? (capacity ? attendance / capacity : 0.62)) || 0.62)),
    homeColor: normalizeHexColor(profile.homeColor, "#315288"),
    grass: Array.isArray(profile.grass) ? profile.grass : base.grass,
    seatColors: Array.isArray(profile.seatColors) ? profile.seatColors : base.seatColors
  };
}

export function gamecastEventPlayDuration(sequence, event = null) {
  const fallback = Math.max(80, Number(sequence?.paMs ?? GAMECAST_PA_MS));
  const authored = Number(event?.gamecastDurationMs);
  if (String(sequence?.mode ?? "") === "watch" && Number.isFinite(authored) && authored >= 80) {
    return authored;
  }
  return fallback;
}

function gamecastEventDuration(sequence, event = null) {
  return gamecastEventPlayDuration(sequence, event)
    + Math.max(0, Number(sequence?.gapMs ?? GAMECAST_PA_GAP_MS));
}

function gamecastEventTiming(sequence, index) {
  const events = sequence?.events ?? [];
  const safeIndex = Math.max(0, Math.min(events.length - 1, Math.floor(Number(index) || 0)));
  let startMs = 0;
  for (let cursor = 0; cursor < safeIndex; cursor += 1) {
    startMs += gamecastEventDuration(sequence, events[cursor]);
  }
  const event = events[safeIndex] ?? null;
  const playMs = gamecastEventPlayDuration(sequence, event);
  const gapMs = Math.max(0, Number(sequence?.gapMs ?? GAMECAST_PA_GAP_MS));
  const slotMs = playMs + gapMs;
  return { index: safeIndex, event, startMs, playMs, gapMs, slotMs, endMs: startMs + slotMs };
}

export function gamecastPlaybackPosition(sequence, elapsedMs) {
  const events = sequence?.events ?? [];
  if (!events.length) {
    return { index: -1, event: null, startMs: 0, playMs: 0, gapMs: 0, slotMs: 0, endMs: 0, localMs: 0 };
  }
  const totalMs = gamecastTotalDuration(sequence);
  const elapsed = Math.max(0, Math.min(totalMs, Number(elapsedMs) || 0));
  let startMs = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const playMs = gamecastEventPlayDuration(sequence, event);
    const gapMs = Math.max(0, Number(sequence?.gapMs ?? GAMECAST_PA_GAP_MS));
    const slotMs = playMs + gapMs;
    const endMs = startMs + slotMs;
    if (elapsed < endMs || index === events.length - 1) {
      return { index, event, startMs, playMs, gapMs, slotMs, endMs, localMs: elapsed - startMs };
    }
    startMs = endMs;
  }
  return gamecastEventTiming(sequence, events.length - 1);
}

function sanitizeGamecastSpeed(value) {
  const speed = Number(value);
  return GAMECAST_SPEED_OPTIONS.includes(speed) ? speed : 1;
}

function isFastGamecastPlayback(state) {
  return sanitizeGamecastSpeed(state?.playbackRate) >= 2;
}

function isAutomaticGamecastHold(hold) {
  const type = String(hold?.type ?? "");
  return type === "inning" || type === "leverage";
}

function shouldRunGamecastPlayback(state) {
  return Boolean(state && !state.done && !state.paused && !state.hold && state.visible !== false && !state.hidden);
}

function shouldTriggerGamecastImpactShake(frame) {
  const event = frame.event;
  if (!event || frame.done) return false;
  const progress = Number(frame.progress ?? 0);
  if (event.outcome === "homeRun" && progress >= gamecastScoreRevealProgress(event)) return true;
  if (Number(event.runs ?? 0) > 0 && progress >= gamecastScoreRevealProgress(event)) return true;
  if (["double", "triple", "strikeout"].includes(event.outcome) && progress >= 0.36) return true;
  return false;
}

function syncGamecastPlaybackControls(state, speedControls, pauseControls, stepControls, skipControls) {
  syncGamecastSpeedControls(state, speedControls, skipControls);
  syncGamecastPauseControls(state, pauseControls);
  syncGamecastStepControls(state, stepControls);
}

function syncGamecastSpeedControls(state, speedControls, skipControls) {
  for (const button of speedControls ?? []) {
    const speed = sanitizeGamecastSpeed(button.dataset?.gamecastSpeed);
    const active = speed === state.playbackRate && !state.done;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
  for (const button of skipControls ?? []) {
    button.classList.toggle("is-active", Boolean(state.done));
    button.disabled = Boolean(state.done);
  }
}

function syncGamecastPauseControls(state, pauseControls) {
  for (const button of pauseControls ?? []) {
    const active = Boolean(state.paused || state.hold) && !state.done;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.textContent = active ? "▶ 계속" : "⏸ 정지";
  }
}

function syncGamecastStepControls(state, stepControls) {
  for (const button of stepControls ?? []) {
    const active = Boolean(state.stepMode) && !state.done;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function syncGamecastSoundControls(state, soundControls) {
  for (const button of soundControls ?? []) {
    const enabled = state.soundEnabled !== false;
    button.classList.toggle("is-active", enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    button.textContent = enabled ? "🔊 켜짐" : "🔇 꺼짐";
  }
}

function triggerGamecastShake(screen, state) {
  screen.classList.add("is-shaking");
  if (state.shakeTimer) window.clearTimeout(state.shakeTimer);
  state.shakeTimer = window.setTimeout(() => screen.classList.remove("is-shaking"), 190);
}

function resizeGamecastCanvas(screen, stage, canvas, ctx, state) {
  const rect = screen.getBoundingClientRect();
  const style = getComputedStyle(screen);
  const horizontalInset =
    Number.parseFloat(style.paddingLeft || "0") +
    Number.parseFloat(style.paddingRight || "0") +
    Number.parseFloat(style.borderLeftWidth || "0") +
    Number.parseFloat(style.borderRightWidth || "0");
  const available = Math.max(1, Math.floor((rect.width || GAMECAST_PIXEL_W) - horizontalInset));
  const scale = Math.max(0.5, available / GAMECAST_PIXEL_W);
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssW = Math.max(1, GAMECAST_PIXEL_W * scale);
  const cssH = Math.max(1, GAMECAST_PIXEL_H * scale);
  state.scale = scale;
  state.dpr = dpr;
  if (stage) {
    stage.style.width = `${cssW}px`;
    stage.style.height = `${cssH}px`;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(canvas.width / GAMECAST_PIXEL_W, 0, 0, canvas.height / GAMECAST_PIXEL_H, 0, 0);
}

function drawGamecastFrame(ctx, state, frame) {
  const palette = state.palette;
  if (state.fieldCache) ctx.drawImage(state.fieldCache, 0, 0);
  else drawGamecastFieldTo(ctx, palette, state.sequence?.ballparkProfile);
  drawPixelCenterScoreboard(ctx, palette, frame);
  drawPixelAtmosphere(ctx, palette, frame);
  drawPixelUmpire(ctx, palette, frame);
  drawPixelFielders(ctx, palette, frame);
  drawGamecastBaseRunners(ctx, palette, frame.bases, frame);
  drawPixelOutPips(ctx, palette, frame);
  drawPixelSideIcon(ctx, palette, frame);
  drawPixelAction(ctx, palette, frame);
  if (frame.scoreFlash) drawPixelScoreBurst(ctx, palette, frame);
  drawPixelCameraFx(ctx, palette, frame);
  drawPixelBaseCallout(ctx, palette, frame.baseCallout);
  drawPixelInningSlate(ctx, palette, frame.inningSlate);
  drawPixelBroadcastBug(ctx, palette, frame);
}

function buildGamecastFieldCache(palette, ballparkProfile = null) {
  if (typeof document === "undefined") return null;
  const field = document.createElement("canvas");
  field.width = GAMECAST_PIXEL_W;
  field.height = GAMECAST_PIXEL_H;
  const fieldCtx = field.getContext("2d");
  if (!fieldCtx) return null;
  fieldCtx.imageSmoothingEnabled = false;
  drawGamecastFieldTo(fieldCtx, palette, ballparkProfile);
  return field;
}

function drawGamecastFieldTo(ctx, palette, ballparkProfile = null) {
  drawBallparkOutfield(ctx, palette, normalizeGamecastSequenceBallpark(ballparkProfile));
  drawBallparkInfield(ctx, palette);
  drawBallparkFoulLines(ctx);
  drawBallparkBases(ctx, palette);
  drawBallparkDugouts(ctx, palette);
}

function gamecastX(value) {
  return Math.round((Number(value) / 120) * GAMECAST_PIXEL_W);
}

function gamecastY(value) {
  return Math.round((Number(value) / 108) * GAMECAST_PIXEL_H);
}

function gamecastSize(value) {
  return Math.max(1, Math.round((Number(value) / 120) * GAMECAST_PIXEL_W));
}

function gamecastOutfieldWallY(profile, logicalX) {
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

function drawBallparkOutfield(ctx, palette, profile = KBO_GAMECAST_BALLPARKS.neutral) {
  for (let y = 0; y < GAMECAST_PIXEL_H; y += 1) {
    for (let x = 0; x < GAMECAST_PIXEL_W; x += 1) {
      const lx = (x / GAMECAST_PIXEL_W) * 120;
      const ly = (y / GAMECAST_PIXEL_H) * 108;
      const wallY = gamecastOutfieldWallY(profile, lx);
      const inside = ly >= wallY;
      const distanceToWall = ly - wallY;
      if (!inside) {
        const showSeatRows = ly < (profile.roofed ? 18 : 22);
        const sideStand = lx < 18 || lx > 102 || (profile.roofed && lx > 42 && lx < 78);
        const aisle = showSeatRows && sideStand && y % gamecastSize(profile.roofed ? 5 : 7) === 0;
        const seatBand = showSeatRows ? Math.floor((y + x * 0.08) / gamecastSize(profile.roofed ? 5 : 4)) % 2 : 0;
        const color = profile.roofed
          ? showSeatRows
            ? (aisle ? "#172536" : (seatBand ? "#26384d" : "#202b3a"))
            : "#202b3a"
          : showSeatRows
            ? (aisle ? "#3a3444" : (seatBand ? palette.stand : palette.standD))
            : palette.standD;
        drawPixel(ctx, x, y, color);
      } else if (distanceToWall < 2.2 + Math.min(3.2, Number(profile.wallHeight ?? 3) * 0.28)) {
        const monster = profile.monsterSide === "right" && lx > 92;
        drawPixel(ctx, x, y, monster ? "#38252d" : (y < gamecastY(30) ? palette.wallCap : palette.wall));
      } else if (distanceToWall < 5.8) {
        drawPixel(ctx, x, y, Math.floor((x + y) / gamecastSize(5)) % 2 ? "#d1ad68" : palette.track);
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
        drawPixel(ctx, x, y, mowStripe ? palette.grassLo : palette.grassHi);
      }
    }
  }

  drawBallparkWallDetails(ctx, palette, profile);
  drawBallparkArchitecture(ctx, palette, profile);

  drawPixelStadiumScoreboard(ctx, palette, profile);

  const foul = gamecastFoulLinePositions();
  for (let y = gamecastY(30); y < foul.left.y; y += 1) {
    drawPixel(ctx, foul.left.x, y, profile.monsterSide === "right" ? palette.spark : palette.pole);
    drawPixel(ctx, foul.right.x, y, palette.pole);
  }
}

function drawBallparkWallDetails(ctx, palette, profile = KBO_GAMECAST_BALLPARKS.neutral) {
  const seamColor = "rgba(255, 254, 251, 0.16)";
  const ledgeColor = "rgba(255, 254, 251, 0.22)";
  for (let logicalX = 8; logicalX <= 112; logicalX += 4) {
    const wallY = gamecastOutfieldWallY(profile, logicalX);
    const x = gamecastX(logicalX);
    const top = gamecastY(wallY + 0.8);
    const bottom = gamecastY(wallY + 4.2);
    ctx.fillStyle = logicalX % 12 === 0 ? ledgeColor : seamColor;
    ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
  ctx.fillStyle = "rgba(18, 23, 33, 0.24)";
  for (let logicalX = 12; logicalX <= 108; logicalX += 12) {
    const wallY = gamecastOutfieldWallY(profile, logicalX);
    ctx.fillRect(gamecastX(logicalX - 3), gamecastY(wallY + 5.6), gamecastSize(5), 1);
  }
}

function drawBallparkFoulLines(ctx) {
  const bases = gamecastBasePositions();
  const foul = gamecastFoulLinePositions();
  const color = "rgba(255, 254, 251, 0.72)";
  drawPixelLine(ctx, bases.home.x, bases.home.y, foul.left.x, foul.left.y, color, 1);
  drawPixelLine(ctx, bases.home.x, bases.home.y, foul.right.x, foul.right.y, color, 1);
}

function drawPixelStadiumScoreboard(ctx, palette, profile = KBO_GAMECAST_BALLPARKS.neutral) {
  const x = gamecastX(profile.roofed ? 41 : profile.monsterSide === "right" ? 49 : 47);
  const y = gamecastY(profile.roofed ? 7 : 10);
  const w = gamecastSize(profile.roofed ? 38 : 26);
  const h = gamecastSize(profile.roofed ? 9 : 7);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = profile.roofed ? "#071019" : "#101d18";
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), w - gamecastSize(2), h - gamecastSize(2));
  ctx.fillStyle = profile.roofed ? "#ddecff" : palette.sparkL;
  ctx.fillRect(x + gamecastSize(2), y + gamecastSize(2), Math.max(gamecastSize(4), w - gamecastSize(4)), gamecastSize(1));
  ctx.fillStyle = profile.roofed ? "rgba(221, 236, 255, 0.5)" : "rgba(255, 246, 199, 0.42)";
  for (let px = x + gamecastSize(3); px < x + w - gamecastSize(3); px += gamecastSize(6)) {
    ctx.fillRect(px, y + gamecastSize(5), gamecastSize(2), gamecastSize(1));
  }
  drawMiniPixelText(ctx, palette, "KBO", x + gamecastSize(3), y + gamecastSize(4), profile.roofed ? "#ddecff" : palette.sparkL, 3);
}

function drawBallparkArchitecture(ctx, palette, profile = KBO_GAMECAST_BALLPARKS.neutral) {
  if (profile.roofed) {
    ctx.fillStyle = "rgba(21, 35, 52, 0.72)";
    ctx.fillRect(0, 0, GAMECAST_PIXEL_W, gamecastY(8));
    ctx.fillStyle = "#314456";
    for (let y = gamecastY(2); y < gamecastY(12); y += gamecastSize(5)) {
      ctx.fillRect(gamecastX(8), y, gamecastX(18), gamecastSize(1));
      ctx.fillRect(gamecastX(47), y, gamecastX(26), gamecastSize(1));
      ctx.fillRect(gamecastX(94), y, gamecastX(18), gamecastSize(1));
    }
    ctx.fillStyle = "#354a5f";
    for (let x = gamecastX(10); x < gamecastX(112); x += gamecastX(18)) {
      ctx.fillRect(x, gamecastY(1), gamecastSize(1), gamecastY(13));
    }
    ctx.fillStyle = "rgba(221, 236, 255, 0.28)";
    ctx.fillRect(gamecastX(18), gamecastY(13), gamecastX(10), gamecastSize(1));
    ctx.fillRect(gamecastX(46), gamecastY(13), gamecastX(28), gamecastSize(1));
    ctx.fillRect(gamecastX(92), gamecastY(13), gamecastX(10), gamecastSize(1));
    ctx.fillStyle = "rgba(255, 246, 199, 0.34)";
    ctx.fillRect(gamecastX(28), gamecastY(8), gamecastX(12), gamecastSize(1));
    ctx.fillRect(gamecastX(80), gamecastY(8), gamecastX(12), gamecastSize(1));
  } else {
    drawPixelLightTower(ctx, palette, gamecastX(9), gamecastY(4), -1);
    drawPixelLightTower(ctx, palette, gamecastX(111), gamecastY(4), 1);
  }

  drawPixelSeatingTiers(ctx, palette, profile);

  ctx.fillStyle = palette.outline;
  ctx.fillRect(gamecastX(17), gamecastY(17), gamecastSize(24), gamecastSize(4));
  ctx.fillRect(gamecastX(79), gamecastY(17), gamecastSize(24), gamecastSize(4));
  ctx.fillStyle = palette.ribbon;
  ctx.fillRect(gamecastX(18), gamecastY(18), gamecastSize(22), gamecastSize(2));
  ctx.fillRect(gamecastX(80), gamecastY(18), gamecastSize(22), gamecastSize(2));
  ctx.fillStyle = palette.light;
  for (const x of [22, 31, 84, 93]) {
    ctx.fillRect(gamecastX(x), gamecastY(18), gamecastSize(2), gamecastSize(1));
  }

  ctx.fillStyle = palette.standD;
  for (let y = gamecastY(24); y < gamecastY(42); y += gamecastSize(5)) {
    ctx.fillRect(gamecastX(5), y, gamecastSize(11), gamecastSize(1));
    ctx.fillRect(gamecastX(104), y, gamecastSize(11), gamecastSize(1));
  }

  const adColors = [palette.ribbon, palette.defender, palette.spark, palette.runner, palette.wallCap];
  for (let index = 0; index < 10; index += 1) {
    const x = gamecastX(7 + index * 11);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(x, gamecastY(22), gamecastSize(8), gamecastSize(3));
    ctx.fillStyle = adColors[index % adColors.length];
    ctx.fillRect(x + gamecastSize(1), gamecastY(23), gamecastSize(6), gamecastSize(1));
  }
  drawPixelBullpen(ctx, palette, gamecastX(14), gamecastY(39), 1);
  drawPixelBullpen(ctx, palette, gamecastX(91), gamecastY(39), -1);
}

function drawPixelSeatingTiers(ctx, palette, profile = KBO_GAMECAST_BALLPARKS.neutral) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = gamecastY(23); y <= gamecastY(39); y += gamecastSize(5)) {
    ctx.fillRect(gamecastX(4), y, gamecastSize(20), 1);
    ctx.fillRect(gamecastX(96), y, gamecastSize(20), 1);
    if (profile.roofed) ctx.fillRect(gamecastX(43), y - gamecastSize(1), gamecastSize(34), 1);
  }
  ctx.fillStyle = "rgba(255, 254, 251, 0.08)";
  ctx.fillRect(0, gamecastY(25), GAMECAST_PIXEL_W, 1);
  ctx.fillRect(0, gamecastY(35), GAMECAST_PIXEL_W, 1);
}

function drawPixelBullpen(ctx, palette, x, y, direction) {
  const w = gamecastSize(15);
  const h = gamecastSize(4);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(18, 23, 33, 0.72)";
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), w - gamecastSize(2), h - gamecastSize(2));
  ctx.fillStyle = direction > 0 ? palette.runnerL : palette.defenderL;
  for (let slot = 0; slot < 3; slot += 1) {
    ctx.fillRect(x + gamecastSize(2 + slot * 4), y + gamecastSize(2), gamecastSize(1), gamecastSize(1));
  }
}

function drawPixelLightTower(ctx, palette, x, y, direction) {
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y + gamecastSize(6), gamecastSize(1), gamecastSize(23));
  ctx.fillRect(x + direction * gamecastSize(1), y + gamecastSize(8), gamecastSize(1), gamecastSize(21));
  ctx.fillRect(x - gamecastSize(4), y + gamecastSize(2), gamecastSize(9), gamecastSize(4));
  ctx.fillStyle = palette.light;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.fillRect(x - gamecastSize(3) + gamecastSize(col * 3), y + gamecastSize(3 + row), gamecastSize(1), gamecastSize(1));
    }
  }
}

function drawPixelCrowd(ctx, palette, profile = KBO_GAMECAST_BALLPARKS.neutral) {
  const dense = Math.max(0.16, Math.min(1, Number(profile.attendanceRatio ?? 0.62)));
  const stepX = gamecastSize(dense > 0.82 ? 4 : dense > 0.52 ? 5 : 7);
  const stepY = gamecastSize(dense > 0.82 ? 5 : 6);
  const startY = gamecastY(2);
  const endY = gamecastY(43);
  const shirts = [palette.crowdA, palette.crowdB, palette.crowdC, "#8fd0b4", "#ffd23f", "#f2b6c6", "#fbfbf7", profile.homeColor ?? "#f37321", palette.standD];

  for (let y = startY; y < endY; y += stepY) {
    const row = Math.floor((y - startY) / stepY);
    for (let x = gamecastX(2) + (row % 2 ? gamecastSize(2) : 0); x < GAMECAST_PIXEL_W - gamecastX(3); x += stepX) {
      const lx = (x / GAMECAST_PIXEL_W) * 120;
      const ly = (y / GAMECAST_PIXEL_H) * 108;
      if (ly >= gamecastOutfieldWallY(profile, lx) - 1) continue;
      if (((row * 19 + x) % 100) > dense * 100) continue;
      if ((row * 11 + x) % 37 === 0) {
        drawPixelFanSign(ctx, palette, x - 1, y + 1, shirts[(row + x + 1) % shirts.length]);
        continue;
      }
      drawPixelFan(ctx, palette, x, y, shirts[(row + x) % shirts.length]);
    }
  }
}

function drawPixelFan(ctx, palette, x, y, shirt) {
  const u = 1;
  ctx.fillStyle = palette.crowdHair;
  ctx.fillRect(x, y, u * 4, u);
  ctx.fillStyle = palette.crowdSkin;
  ctx.fillRect(x + u, y + u, u * 2, u * 2);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x + u, y + u * 2, u, u);
  ctx.fillRect(x + u * 2, y + u * 2, u, u);
  ctx.fillStyle = shirt;
  ctx.fillRect(x, y + u * 3, u * 4, u * 2);
  ctx.fillStyle = palette.crowdSkin;
  ctx.fillRect(x - u, y + u * 3, u, u);
  ctx.fillRect(x + u * 4, y + u * 3, u, u);
  ctx.fillStyle = palette.stand;
  ctx.fillRect(x, y + u * 5, u * 4, u);
}

function drawPixelFanSign(ctx, palette, x, y, color) {
  const u = 1;
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, u * 7, u * 4);
  ctx.fillStyle = palette.base;
  ctx.fillRect(x + u, y + u, u * 5, u * 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + u * 2, y + u, u * 3, u);
  ctx.fillRect(x + u, y + u * 2, u, u);
  ctx.fillRect(x + u * 5, y + u * 2, u, u);
  ctx.fillStyle = palette.crowdSkin;
  ctx.fillRect(x, y + u * 4, u, u);
  ctx.fillRect(x + u * 6, y + u * 4, u, u);
}

function drawBallparkInfield(ctx, palette) {
  const bases = gamecastBasePositions();
  fillPixelCircle(ctx, gamecastX(60), gamecastY(78), gamecastSize(18), palette.grassLo);
  fillPixelCircle(ctx, gamecastX(60), gamecastY(78), gamecastSize(12), palette.grassHi);
  fillPixelDiamond(ctx, gamecastX(60), gamecastY(78), gamecastSize(31), gamecastSize(25), palette.dirtM);
  fillPixelDiamond(ctx, gamecastX(60), gamecastY(80), gamecastSize(16), gamecastSize(12), palette.grassHi);

  drawPixelLine(ctx, bases.home.x, bases.home.y, bases.first.x, bases.first.y, palette.dirtD, gamecastSize(2));
  drawPixelLine(ctx, bases.first.x, bases.first.y, bases.second.x, bases.second.y, palette.dirtD, gamecastSize(2));
  drawPixelLine(ctx, bases.second.x, bases.second.y, bases.third.x, bases.third.y, palette.dirtD, gamecastSize(2));
  drawPixelLine(ctx, bases.third.x, bases.third.y, bases.home.x, bases.home.y, palette.dirtD, gamecastSize(2));

  for (const base of [bases.first, bases.second, bases.third]) {
    fillPixelCircle(ctx, base.x, base.y, gamecastSize(5), palette.dirtM);
    fillPixelCircle(ctx, base.x, base.y, gamecastSize(3), palette.dirtL);
  }
  fillPixelCircle(ctx, bases.home.x, bases.home.y, gamecastSize(6), palette.dirtM);
  fillPixelCircle(ctx, bases.mound.x, bases.mound.y, gamecastSize(6), palette.dirtL);
  fillPixelCircle(ctx, bases.mound.x, bases.mound.y, gamecastSize(4), palette.dirtM);

  ctx.fillStyle = palette.base;
  ctx.fillRect(bases.mound.x - gamecastSize(2), bases.mound.y - gamecastSize(1), gamecastSize(4), gamecastSize(1));
  drawPixelHomePlateDetail(ctx, palette, bases.home);

  drawPixelBaseCoach(ctx, palette, { x: bases.first.x + gamecastSize(13), y: bases.first.y + gamecastSize(7) });
  drawPixelBaseCoach(ctx, palette, { x: bases.third.x - gamecastSize(13), y: bases.third.y + gamecastSize(7) });
}

function drawPixelHomePlateDetail(ctx, palette, home) {
  const boxW = gamecastSize(4);
  const boxH = gamecastSize(10);
  const boxTop = home.y - gamecastSize(6);
  const leftX = home.x - gamecastSize(12);
  const rightX = home.x + gamecastSize(8);
  ctx.fillStyle = "rgba(255, 254, 251, 0.68)";
  drawPixelBox(ctx, leftX, boxTop, boxW, boxH, gamecastSize(1));
  drawPixelBox(ctx, rightX, boxTop, boxW, boxH, gamecastSize(1));
  drawPixelBox(ctx, home.x - gamecastSize(5), home.y + gamecastSize(1), gamecastSize(10), gamecastSize(5), gamecastSize(1));
  drawPixelSprite(ctx, palette, home.x - gamecastSize(2), home.y - gamecastSize(2), [
    [0, 0, palette.base],
    [1, 0, palette.base],
    [2, 0, palette.base],
    [1, 1, palette.base],
    [1, 2, palette.base]
  ]);
}

function drawPixelBox(ctx, x, y, width, height, stroke) {
  ctx.fillRect(x, y, width, stroke);
  ctx.fillRect(x, y + height - stroke, width, stroke);
  ctx.fillRect(x, y, stroke, height);
  ctx.fillRect(x + width - stroke, y, stroke, height);
}

function drawPixelBaseCoach(ctx, palette, position) {
  drawPixelRunner(ctx, palette, position, false, palette.runner, 2, {
    jerseyColor: palette.uniformSh,
    pose: "coach",
    scaleShadow: false
  });
}

function drawBallparkBases(ctx, palette) {
  const bases = gamecastBasePositions();
  drawBallparkBase(ctx, palette, bases.first);
  drawBallparkBase(ctx, palette, bases.second);
  drawBallparkBase(ctx, palette, bases.third);
}

function drawBallparkDugouts(ctx, palette) {
  drawPixelDugout(ctx, palette, gamecastX(11), gamecastY(87), 1);
  drawPixelDugout(ctx, palette, gamecastX(91), gamecastY(87), -1);
}

function drawPixelDugout(ctx, palette, x, y, direction) {
  const width = gamecastSize(19);
  const height = gamecastSize(9);
  const roof = gamecastSize(3);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = palette.wallCap;
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), width - gamecastSize(2), roof);
  ctx.fillStyle = palette.standD;
  ctx.fillRect(x + gamecastSize(1), y + roof + gamecastSize(1), width - gamecastSize(2), height - roof - gamecastSize(2));
  ctx.fillStyle = palette.base;
  for (let index = 0; index < 4; index += 1) {
    const px = x + gamecastSize(3 + index * 4);
    ctx.fillRect(px, y + gamecastSize(5), gamecastSize(2), gamecastSize(1));
    ctx.fillStyle = index % 2 ? palette.runnerL : palette.defenderL;
    ctx.fillRect(px, y + gamecastSize(6), gamecastSize(2), gamecastSize(2));
    ctx.fillStyle = palette.base;
  }
  ctx.fillStyle = direction > 0 ? palette.runner : palette.defender;
  ctx.fillRect(x + (direction > 0 ? width - gamecastSize(3) : gamecastSize(1)), y + gamecastSize(2), gamecastSize(2), gamecastSize(1));
}

function drawBallparkBase(ctx, palette, position) {
  drawPixelSprite(ctx, palette, position.x - gamecastSize(2), position.y - gamecastSize(1), [
    [0, 0, palette.base],
    [1, 0, palette.base],
    [2, 0, palette.base],
    [3, 0, palette.base],
    [0, 1, palette.base],
    [1, 1, palette.base],
    [2, 1, palette.base],
    [3, 1, palette.base]
  ]);
}

function drawGamecastBaseRunners(ctx, palette, baseState, frame = {}) {
  const bases = gamecastBasePositions();
  const color = frame.offenseColor ?? palette.runner;
  const jerseyColor = frame.offenseJerseyColor ?? palette.uniform;
  const jerseyShadow = frame.offenseJerseyShadow ?? palette.uniformSh;
  const accentColor = frame.offenseAccentColor ?? color;
  const options = { jerseyColor, jerseyShadow, accentColor, pose: "idle" };
  if (baseState?.[0]) drawPixelRunner(ctx, palette, bases.first, false, color, 2, options);
  if (baseState?.[1]) drawPixelRunner(ctx, palette, bases.second, false, color, 2, options);
  if (baseState?.[2]) drawPixelRunner(ctx, palette, bases.third, false, color, 2, options);
}

function drawPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, 1, 1);
}

function drawPixelOutPips(ctx, palette, frame) {
  const outs = Math.min(3, Math.max(0, Number(frame.outs ?? 0)));
  for (let index = 0; index < 3; index += 1) {
    const x = gamecastX(96) + index * gamecastSize(7);
    const y = gamecastY(98);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(x, y, gamecastSize(6), gamecastSize(6));
    ctx.fillStyle = index < outs ? palette.out : palette.baseSh;
    ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), gamecastSize(4), gamecastSize(4));
  }
}

function drawPixelSideIcon(ctx, palette, frame) {
  const x = 8;
  const y = 8;
  ctx.fillStyle = palette.outline;
  if (frame.side === "home") {
    ctx.fillRect(x + 2, y, 3, 1);
    ctx.fillRect(x + 1, y + 1, 5, 1);
    ctx.fillRect(x, y + 2, 7, 1);
  } else {
    ctx.fillRect(x, y, 7, 1);
    ctx.fillRect(x + 1, y + 1, 5, 1);
    ctx.fillRect(x + 2, y + 2, 3, 1);
  }
  ctx.fillStyle = frame.offenseColor ?? (frame.side === "home" ? palette.runner : palette.defender);
  ctx.fillRect(x + 2, y + 4, 3, 2);
}

function drawPixelBroadcastBug(ctx, palette, frame) {
  const x = gamecastX(3);
  const y = gamecastY(3);
  const w = gamecastSize(46);
  const h = gamecastSize(22);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#111b27";
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), w - gamecastSize(2), h - gamecastSize(2));
  ctx.fillStyle = frame.offenseColor ?? palette.grassHi;
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), w - gamecastSize(2), gamecastSize(1));
  ctx.fillStyle = "#1f2d3d";
  ctx.fillRect(x + gamecastSize(2), y + gamecastSize(4), gamecastSize(18), gamecastSize(15));
  ctx.fillStyle = "#0b121b";
  ctx.fillRect(x + gamecastSize(21), y + gamecastSize(4), gamecastSize(22), gamecastSize(15));

  drawMiniPixelText(ctx, palette, "KBO", x + gamecastSize(4), y + gamecastSize(2), palette.sparkL, 3);
  drawMiniPixelText(ctx, palette, frame.side === "home" ? "BOT" : "TOP", x + gamecastSize(29), y + gamecastSize(2), palette.defenderL, 3);

  drawPixelScoreDigits(ctx, palette, x + gamecastSize(5), y + gamecastSize(6), Number(frame.score?.away ?? 0), palette.base);
  drawPixelScoreDigits(ctx, palette, x + gamecastSize(5), y + gamecastSize(13), Number(frame.score?.home ?? 0), palette.base);
  ctx.fillStyle = frame.side === "home" ? palette.homerL : palette.defenderL;
  ctx.fillRect(x + gamecastSize(3), (frame.side === "home" ? y + gamecastSize(13) : y + gamecastSize(6)), gamecastSize(1), gamecastSize(5));

  const count = gamecastPitchCount(frame);
  drawMiniPixelText(ctx, palette, "B", x + gamecastSize(23), y + gamecastSize(6), "#7fd8a8", 1);
  drawMiniPixelText(ctx, palette, "S", x + gamecastSize(23), y + gamecastSize(11), "#ffd23f", 1);
  drawMiniPixelText(ctx, palette, "O", x + gamecastSize(23), y + gamecastSize(16), "#ff8f83", 1);
  drawPixelCountRow(ctx, palette, x + gamecastSize(28), y + gamecastSize(6), count.balls, 3, "#7fd8a8");
  drawPixelCountRow(ctx, palette, x + gamecastSize(28), y + gamecastSize(11), count.strikes, 2, "#ffd23f");
  drawPixelCountRow(ctx, palette, x + gamecastSize(28), y + gamecastSize(16), Math.min(2, Number(frame.outs ?? 0)), 2, "#ff8f83");

  const bases = [frame.bases?.[0], frame.bases?.[1], frame.bases?.[2]];
  const bx = x + gamecastSize(40);
  const by = y + gamecastSize(12);
  [[gamecastSize(2), 0], [0, -gamecastSize(2)], [-gamecastSize(2), 0]].forEach(([dx, dy], index) => {
    ctx.fillStyle = palette.outline;
    ctx.fillRect(bx + dx - 1, by + dy - 1, gamecastSize(2) + 2, gamecastSize(2) + 2);
    ctx.fillStyle = bases[index] ? "#ffd23f" : "#33443c";
    ctx.fillRect(bx + dx, by + dy, gamecastSize(2), gamecastSize(2));
  });
}

// balls/strikes are a broadcast-flavor build-up (engine resolves a PA in one roll, no pitch count); outs are real
export function gamecastPitchCount(frame) {
  if (frame.event?.outcome === "walk") return { balls: 3, strikes: 0 };
  const t = Math.max(0, Math.min(1, Number(frame.progress ?? 0) / 0.68));
  const outcome = frame.event?.outcome;
  // Walks and strikeouts each show only the decisive pitch. Preload the legal
  // count so ball four / strike three reads correctly without replaying the PA.
  if (outcome === "strikeout") return { balls: 0, strikes: 2 };
  return { balls: Math.min(2, Math.floor(t * 2.4)), strikes: Math.min(2, Math.floor(t * 2.2)) };
}

export function gamecastWalkPitchState(progress) {
  const normalized = Math.max(0, Math.min(1, Number(progress) || 0));
  for (let index = GAMECAST_WALK_PITCH_STARTS.length - 1; index >= 0; index -= 1) {
    const startT = GAMECAST_WALK_PITCH_STARTS[index];
    const endT = startT + GAMECAST_WALK_PITCH_SPAN;
    if (normalized < startT || normalized > endT) continue;
    const releaseT = startT + GAMECAST_WALK_PITCH_RELEASE_OFFSET;
    return {
      pitchNumber: 4,
      startT,
      releaseT,
      endT,
      localT: (normalized - startT) / GAMECAST_WALK_PITCH_SPAN,
      released: normalized >= releaseT,
      ballT: Math.max(0, Math.min(1, (normalized - releaseT) / Math.max(0.001, endT - releaseT)))
    };
  }
  return null;
}

function drawPixelCountRow(ctx, palette, x, y, filled, total, onColor) {
  for (let index = 0; index < total; index += 1) {
    const px = x + index * gamecastSize(4);
    ctx.fillStyle = palette.outline;
    ctx.fillRect(px, y, gamecastSize(3), gamecastSize(3));
    ctx.fillStyle = index < filled ? onColor : "#2b3a33";
    ctx.fillRect(px + gamecastSize(1), y + gamecastSize(1), Math.max(1, gamecastSize(1)), Math.max(1, gamecastSize(1)));
  }
}

function drawPixelCenterScoreboard(ctx, palette, frame) {
  const x = gamecastX(48);
  const y = gamecastY(4);
  const w = gamecastSize(24);
  const h = gamecastSize(10);
  const result = gamecastJumbotronTextForFrame(frame);
  const revealed = gamecastFrameResultRevealed(frame);
  const accent = frame.event?.outcome === "homeRun"
    ? (revealed ? palette.homerL : palette.throw)
    : frame.scoreFlash
      ? palette.spark
      : frame.offenseColor ?? palette.grassHi;

  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#12211b";
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 2, y + 1, Math.max(2, w - 4), 1);

  drawPixelScoreDigits(ctx, palette, x + 3, y + 3, Number(frame.score?.away ?? 0), palette.base);
  ctx.fillStyle = palette.baseSh;
  ctx.fillRect(x + 11, y + 5, 2, 1);
  drawPixelScoreDigits(ctx, palette, x + 14, y + 3, Number(frame.score?.home ?? 0), palette.base);

  const textX = Math.max(x + 2, Math.round(x + (w - miniPixelTextWidth(result)) / 2));
  drawMiniPixelText(ctx, palette, result, textX, y + 8, result === "HR" ? palette.homerL : result === "K" || result === "OUT" ? palette.out : palette.sparkL, 6);

  if (frame.scoreFlash || (frame.event?.outcome === "homeRun" && revealed)) {
    const pulse = Math.floor(Number(frame.progress ?? 0) * 20) % 2;
    ctx.fillStyle = pulse ? palette.sparkL : palette.homerL;
    ctx.fillRect(x + w - 4, y + 3, 2, 1);
    ctx.fillRect(x + 2, y + 3, 2, 1);
  }
}

function gamecastJumbotronText(event) {
  if (!event) return "LIVE";
  if (event.doublePlay) return "DP";
  if (event.outcome === "homeRun") return "HR";
  if (event.outcome === "single") return "1B";
  if (event.outcome === "double") return "2B";
  if (event.outcome === "triple") return "3B";
  if (event.outcome === "error") return "E";
  if (event.outcome === "strikeout") return "K";
  if (event.outcome === "walk") return "BB";
  if (event.outcome === "sacrificeBunt") return "SAC";
  if (event.outcome === "out") return "OUT";
  return "LIVE";
}

function gamecastJumbotronTextForFrame(frame) {
  const event = frame?.event;
  if (!event) return "LIVE";
  if (frame?.done || gamecastFrameResultRevealed(frame)) return gamecastJumbotronText(event);
  const progress = Number(frame.progress ?? 0);
  if (progress < gamecastPitchEnd(event) - 0.04) return "PITCH";
  if (isBattedBallOutcome(event.outcome)) return "BALL";
  if (event.outcome === "walk") return "COUNT";
  if (event.outcome === "strikeout") return "PITCH";
  return "LIVE";
}

function gamecastHudTextForFrame(frame) {
  const event = frame?.event;
  if (!event) return "LIVE";
  if (frame?.done || gamecastFrameResultRevealed(frame)) return gamecastResultDisplayText(event);
  const progress = Number(frame.progress ?? 0);
  if (progress < gamecastPitchEnd(event) - 0.04) return "투구";
  if (isBattedBallOutcome(event.outcome)) return "타구 진행";
  if (event.outcome === "walk") return "볼 카운트";
  if (event.outcome === "strikeout") return "투구";
  return "판정 중";
}

function drawPixelScoreDigits(ctx, palette, x, y, value, color) {
  const text = String(Math.max(0, Math.min(99, Math.floor(Number(value) || 0)))).padStart(2, "0");
  for (let index = 0; index < text.length; index += 1) {
    drawMiniPixelDigit(ctx, palette, text[index], x + gamecastSize(index * 4), y, color);
  }
}

function drawMiniPixelDigit(ctx, palette, digit, x, y, color) {
  const map = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"]
  }[digit] ?? ["000", "000", "000", "000", "000"];
  ctx.fillStyle = color;
  map.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell === "1") ctx.fillRect(x + gamecastSize(colIndex), y + gamecastSize(rowIndex), gamecastSize(1), gamecastSize(1));
    });
  });
}

function drawMiniPixelLetters(ctx, palette, text, x, y, color) {
  drawMiniPixelText(ctx, palette, text, x, y, color, 2);
}

function drawMiniPixelText(ctx, palette, text, x, y, color, maxLetters = 6) {
  const letters = miniPixelLetterMap();
  ctx.fillStyle = color;
  let cursor = x;
  String(text ?? "").toUpperCase().slice(0, maxLetters).split("").forEach((letter) => {
    if (letter === " ") {
      cursor += gamecastSize(3);
      return;
    }
    const map = letters[letter] ?? letters.F;
    map.forEach((row, rowIndex) => {
      [...row].forEach((cell, colIndex) => {
        if (cell === "1") ctx.fillRect(cursor + gamecastSize(colIndex), y + gamecastSize(rowIndex), gamecastSize(1), gamecastSize(1));
      });
    });
    cursor += gamecastSize(4);
  });
}

function miniPixelTextWidth(text) {
  return String(text ?? "").toUpperCase().split("").reduce((width, letter) => width + gamecastSize(letter === " " ? 3 : 4), 0);
}

function miniPixelLetterMap() {
  return {
    "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "111", "100", "111"],
    "3": ["110", "001", "111", "001", "110"],
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["111", "100", "100", "100", "111"],
    D: ["110", "101", "101", "101", "110"],
    E: ["111", "100", "110", "100", "111"],
    F: ["111", "100", "110", "100", "100"],
    H: ["101", "101", "111", "101", "101"],
    I: ["111", "010", "010", "010", "111"],
    K: ["101", "101", "110", "101", "101"],
    L: ["100", "100", "100", "100", "111"],
    O: ["111", "101", "101", "101", "111"],
    P: ["110", "101", "110", "100", "100"],
    R: ["110", "101", "110", "101", "101"],
    S: ["111", "100", "111", "001", "111"],
    T: ["111", "010", "010", "010", "010"],
    U: ["101", "101", "101", "101", "111"],
    V: ["101", "101", "101", "101", "010"]
  };
}

function drawPixelAction(ctx, palette, frame) {
  if (frame.flash) {
    ctx.fillStyle = palette.base;
    for (let y = 0; y < GAMECAST_PIXEL_H; y += 4) {
      ctx.fillRect(0, y, GAMECAST_PIXEL_W, 1);
    }
  }
  if (frame.ballShadow) drawPixelBallShadow(ctx, palette, frame.ballShadow);
  if (frame.ballTrail?.length) drawTrail(ctx, frame.ballTrailColor ?? palette.homerL, frame.ballTrail);
  for (const line of frame.throwLines ?? []) drawPixelThrowLine(ctx, palette, line);
  for (const defender of frame.defenseSprites ?? []) {
    if (defender.catchBurst) drawPixelFielderBurst(ctx, palette, defender);
    drawPixelRunner(ctx, palette, defender.position, defender.squash, defender.color, defender.runFrame, {
      jerseyColor: defender.jerseyColor,
      jerseyShadow: defender.jerseyShadow,
      accentColor: defender.accentColor,
      pose: defender.pose,
      fieldingKey: defender.fieldingKey,
      uniformNumber: defender.uniformNumber,
      abilityGrade: defender.abilityGrade,
      abilityColor: defender.abilityColor,
      abilityActive: defender.abilityActive
    });
  }
  for (const runner of frame.runners ?? []) {
    drawTrail(ctx, runner.trailColor ?? palette.runnerL, runner.trail);
    drawPixelRunnerDust(ctx, palette, runner.dust);
  }
  if (frame.contactBurst) drawPixelContactBurst(ctx, palette, frame.contactBurst);
  if (frame.batter) {
    drawPixelBatterFx(ctx, palette, frame.batter);
    drawPixelRunner(ctx, palette, frame.batter.position, false, frame.batter.color, frame.batter.runFrame ?? 2, {
      pose: frame.batter.pose ?? "stance",
      jerseyColor: frame.batter.jerseyColor,
      jerseyShadow: frame.batter.jerseyShadow,
      accentColor: frame.batter.accentColor,
      uniformNumber: frame.batter.uniformNumber,
      abilityGrade: frame.batter.abilityGrade,
      abilityColor: frame.batter.abilityColor,
      abilityActive: frame.batter.abilityActive
    });
  }
  for (const runner of frame.runners ?? []) {
    drawPixelRunner(ctx, palette, runner.position, runner.squash, runner.color, runner.runFrame, {
      jerseyColor: runner.jerseyColor,
      jerseyShadow: runner.jerseyShadow,
      accentColor: runner.accentColor,
      pose: runner.pose,
      uniformNumber: runner.uniformNumber,
      facing: runner.facing,
      abilityGrade: runner.abilityGrade,
      abilityColor: runner.abilityColor,
      abilityActive: runner.abilityActive
    });
  }
  if (frame.ball) drawPixelBall(ctx, palette, frame.ball, frame.ballColor ?? palette.base);
}

function drawPixelAtmosphere(ctx, palette, frame) {
  const progress = Number(frame.progress ?? 0);
  drawPixelRibbonPulse(ctx, palette, frame, progress);
  drawPixelCrowdWave(ctx, palette, frame, progress);
  drawPixelCameraFlashes(ctx, palette, frame, progress);
  drawPixelDugoutReaction(ctx, palette, frame, progress);
  if (frame.event?.outcome === "homeRun" && progress >= gamecastScoreRevealProgress(frame.event)) {
    const t = Math.max(0, Math.min(1, (progress - gamecastScoreRevealProgress(frame.event)) / 0.08));
    drawPixelFirework(ctx, palette, gamecastX(26), gamecastY(19), t);
    drawPixelFirework(ctx, palette, gamecastX(95), gamecastY(20), Math.max(0, t - 0.18));
  }
  if (frame.scoreFlash) {
    ctx.fillStyle = palette.sparkL;
    for (let x = gamecastX(18); x < gamecastX(103); x += gamecastSize(8)) {
      ctx.fillRect(x, gamecastY(25), gamecastSize(2), gamecastSize(1));
    }
  }
}

function drawPixelRibbonPulse(ctx, palette, frame, progress) {
  const event = frame.event;
  if (!event || progress < 0.28 || progress > 0.92) return;
  const homerRevealed = event.outcome === "homeRun" && frame.resultRevealed;
  const active = homerRevealed || frame.scoreFlash || ["double", "triple", "strikeout"].includes(event.outcome);
  if (!active) return;
  const color = homerRevealed ? palette.homerL : frame.scoreFlash ? palette.spark : frame.offenseColor ?? palette.runnerL;
  const glow = event.outcome === "strikeout" ? palette.throw : palette.sparkL;
  const phase = Math.floor(progress * 24);
  for (const [start, end] of [[18, 40], [80, 102]]) {
    const y = gamecastY(18);
    for (let x = gamecastX(start); x < gamecastX(end); x += gamecastSize(4)) {
      ctx.fillStyle = ((x + phase) % gamecastSize(8)) < gamecastSize(4) ? color : glow;
      ctx.fillRect(x, y, gamecastSize(3), gamecastSize(1));
      if (frame.scoreFlash || homerRevealed) {
        ctx.fillStyle = palette.base;
        ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), gamecastSize(1), gamecastSize(1));
      }
    }
  }
}

function drawPixelCameraFlashes(ctx, palette, frame, progress) {
  const event = frame.event;
  if (!event || progress < 0.34 || progress > 0.88) return;
  const homerRevealed = event.outcome === "homeRun" && frame.resultRevealed;
  const heat = homerRevealed ? 1 : frame.scoreFlash ? 0.8 : ["double", "triple"].includes(event.outcome) ? 0.46 : event.outcome === "strikeout" ? 0.32 : 0;
  if (heat <= 0) return;
  const phase = Math.floor(progress * 28);
  const count = homerRevealed ? 14 : frame.scoreFlash ? 10 : 6;
  for (let index = 0; index < count; index += 1) {
    if ((index * 7 + phase) % 5 > Math.ceil(heat * 4)) continue;
    const nx = Math.abs(gamecastEventNoise(event, 31 + index));
    const ny = Math.abs(gamecastEventNoise(event, 61 + index));
    const x = gamecastX(8 + nx * 104);
    const y = gamecastY(5 + ny * 33);
    ctx.fillStyle = palette.base;
    ctx.fillRect(x, y, gamecastSize(2), gamecastSize(1));
    ctx.fillRect(x + gamecastSize(1), y - gamecastSize(1), gamecastSize(1), gamecastSize(3));
    ctx.fillStyle = palette.sparkL;
    ctx.fillRect(x + gamecastSize(2), y, gamecastSize(1), gamecastSize(1));
  }
}

function drawPixelDugoutReaction(ctx, palette, frame, progress) {
  const event = frame.event;
  if (!event || progress < 0.42 || progress > 0.9) return;
  const homerRevealed = event.outcome === "homeRun" && frame.resultRevealed;
  const bigPlay = homerRevealed || frame.scoreFlash || ["double", "triple"].includes(event.outcome);
  if (!bigPlay) return;
  const heat = homerRevealed ? 1 : frame.scoreFlash ? 0.76 : 0.48;
  const pulse = Math.floor(progress * 18);
  const y = gamecastY(92);
  const isHome = event.side === "home";
  const startX = isHome ? gamecastX(95) : gamecastX(15);
  const jersey = event.teamJerseyColor ?? palette.uniform;
  const accent = event.teamColor ?? palette.runner;
  for (let index = 0; index < 4; index += 1) {
    const x = startX + gamecastSize(index * 4);
    const bob = (pulse + index) % 2 ? -1 : 0;
    ctx.fillStyle = palette.outline;
    ctx.fillRect(x, y + bob, gamecastSize(2), gamecastSize(1));
    ctx.fillStyle = jersey;
    ctx.fillRect(x, y + gamecastSize(1) + bob, gamecastSize(2), gamecastSize(3));
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + gamecastSize(3) + bob, gamecastSize(2), gamecastSize(1));
    ctx.fillStyle = palette.crowdSkin;
    ctx.fillRect(x - gamecastSize(1), y + gamecastSize(1) + bob - Math.round(heat), gamecastSize(1), gamecastSize(1));
    ctx.fillRect(x + gamecastSize(2), y + gamecastSize(1) + bob - Math.round(heat), gamecastSize(1), gamecastSize(1));
  }
}

function drawPixelCrowdWave(ctx, palette, frame, progress) {
  const event = frame.event;
  if (!event || progress <= 0.18) return;
  const homerRevealed = event.outcome === "homeRun" && frame.resultRevealed;
  const heat = homerRevealed ? 1 : frame.scoreFlash ? 0.82 : ["double", "triple", "strikeout"].includes(event.outcome) ? 0.48 : 0.24;
  if (heat <= 0.25 && progress > 0.7) return;
  const phase = Math.floor(progress * 20);
  const top = gamecastY(16);
  const bottom = gamecastY(38);
  for (let y = top; y < bottom; y += gamecastSize(6)) {
    const row = Math.floor((y - top) / Math.max(1, gamecastSize(6)));
    for (let x = gamecastX(5) + (row % 2 ? gamecastSize(3) : 0); x < GAMECAST_PIXEL_W - gamecastX(5); x += gamecastSize(8)) {
      if ((x + row * 13 + phase) % 5 > Math.ceil(heat * 4)) continue;
      const bob = ((x + phase + row) % 3) - 1;
      ctx.fillStyle = (x + row) % 2 ? palette.sparkL : palette.crowdB;
      ctx.fillRect(x, y + bob, gamecastSize(3), gamecastSize(1));
      ctx.fillStyle = palette.crowdSkin;
      ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1) + bob, gamecastSize(1), gamecastSize(1));
    }
  }
}

function drawPixelFirework(ctx, palette, cx, cy, t) {
  if (t <= 0 || t >= 1) return;
  const radius = Math.max(2, Math.round(gamecastSize(10) * Math.sin(t * Math.PI)));
  const points = [
    [0, -radius], [radius, 0], [0, radius], [-radius, 0],
    [radius * 0.7, -radius * 0.7], [radius * 0.7, radius * 0.7],
    [-radius * 0.7, radius * 0.7], [-radius * 0.7, -radius * 0.7]
  ];
  points.forEach(([dx, dy], index) => {
    ctx.fillStyle = index % 2 ? palette.homerL : palette.spark;
    ctx.fillRect(Math.round(cx + dx), Math.round(cy + dy), gamecastSize(1), gamecastSize(1));
  });
}

function drawPixelBallShadow(ctx, palette, shadow) {
  const x = Math.round(shadow.x);
  const y = Math.round(shadow.y);
  const width = Math.max(2, Math.round(shadow.width ?? gamecastSize(4)));
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(x - Math.floor(width / 2), y, width, 1);
  if (width > 4) ctx.fillRect(x - Math.floor(width / 3), y + 1, Math.max(1, Math.floor(width * 0.6)), 1);
}

function drawPixelThrowLine(ctx, palette, line) {
  const flicker = Math.max(0, Math.min(1, Number(line.opacity ?? 1)));
  const color = flicker > 0.62 ? palette.throw : palette.defenderL;
  drawPixelLine(ctx, line.from.x + 1, line.from.y + 1, line.to.x + 1, line.to.y + 1, palette.outline, gamecastSize(1));
  drawPixelLine(ctx, line.from.x, line.from.y, line.to.x, line.to.y, color, gamecastSize(1));
  const t = Math.max(0, Math.min(1, Number(line.t ?? 0)));
  const ball = positionAlongPath([line.from, line.to], t);
  const previous = positionAlongPath([line.from, line.to], Math.max(0, t - 0.08));
  drawPixelBall(ctx, palette, withGamecastBallVector(ball, previous, {
    kind: "throw",
    size: gamecastBallDisplaySize("throw"),
    opacity: flicker
  }), palette.base);
}

function drawPixelContactBurst(ctx, palette, burst) {
  const x = Math.round(burst.x);
  const y = Math.round(burst.y);
  const size = Math.max(1, Math.round(burst.size ?? gamecastSize(5)));
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - size - 1, y, size * 2 + 3, 1);
  ctx.fillRect(x, y - size - 1, 1, size * 2 + 3);
  drawPixelLine(ctx, x - size - 5, y + 4, x + size + 5, y - 4, palette.outline, gamecastSize(1));
  drawPixelLine(ctx, x - size - 4, y + 3, x + size + 4, y - 3, palette.sparkL, gamecastSize(1));
  ctx.fillStyle = palette.spark;
  ctx.fillRect(x - size, y, size * 2 + 1, 1);
  ctx.fillRect(x, y - size, 1, size * 2 + 1);
  ctx.fillStyle = palette.sparkL;
  ctx.fillRect(x - size + 1, y - size + 1, 1, 1);
  ctx.fillRect(x + size - 1, y - size + 1, 1, 1);
  ctx.fillRect(x - size + 1, y + size - 1, 1, 1);
  ctx.fillRect(x + size - 1, y + size - 1, 1, 1);
  ctx.fillStyle = palette.homerL;
  ctx.fillRect(x + size + 2, y - 1, 2, 1);
  ctx.fillRect(x - size - 3, y + 1, 2, 1);
  ctx.fillStyle = palette.ballWake;
  ctx.fillRect(x + size + 4, y - 3, 2, 1);
  ctx.fillRect(x - size - 5, y + 3, 2, 1);
}

function drawPixelBatterFx(ctx, palette, batter) {
  const pose = batter?.pose;
  if (!["swing", "follow", "miss", "load"].includes(pose)) return;
  const x = Math.round(batter.position.x);
  const y = Math.round(batter.position.y);
  if (pose === "load") {
    drawPixelLine(ctx, x + gamecastSize(5), y - gamecastSize(15), x + gamecastSize(8), y - gamecastSize(19), palette.ballWake, gamecastSize(1));
    return;
  }
  const arcColor = pose === "miss" ? palette.throw : palette.sparkL;
  drawPixelLine(ctx, x - gamecastSize(8), y - gamecastSize(11), x + gamecastSize(11), y - gamecastSize(9), palette.outline, gamecastSize(1));
  drawPixelLine(ctx, x - gamecastSize(7), y - gamecastSize(12), x + gamecastSize(10), y - gamecastSize(10), arcColor, gamecastSize(1));
  if (pose !== "miss") {
    drawPixelLine(ctx, x - gamecastSize(4), y - gamecastSize(15), x + gamecastSize(12), y - gamecastSize(6), palette.homerL, gamecastSize(1));
    ctx.fillStyle = palette.ballWake;
    ctx.fillRect(x + gamecastSize(13), y - gamecastSize(7), gamecastSize(2), gamecastSize(1));
  }
}

function drawPixelFielderBurst(ctx, palette, defender) {
  const x = Math.round(defender.position.x);
  const y = Math.round(defender.position.y - gamecastSize(10));
  const color = defender.pose === "dive" ? palette.homerL : palette.throw;
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - gamecastSize(4), y, gamecastSize(9), gamecastSize(1));
  ctx.fillRect(x, y - gamecastSize(4), gamecastSize(1), gamecastSize(9));
  ctx.fillStyle = color;
  ctx.fillRect(x - gamecastSize(3), y, gamecastSize(7), gamecastSize(1));
  ctx.fillRect(x, y - gamecastSize(3), gamecastSize(1), gamecastSize(7));
  ctx.fillStyle = palette.ballWake;
  ctx.fillRect(x - gamecastSize(5), y - gamecastSize(2), gamecastSize(1), gamecastSize(1));
  ctx.fillRect(x + gamecastSize(5), y + gamecastSize(2), gamecastSize(1), gamecastSize(1));
}

function drawPixelCameraFx(ctx, palette, frame) {
  const event = frame.event;
  if (!event || frame.done) return;
  const progress = Number(frame.progress ?? 0);
  const pitchEnd = gamecastPitchEnd(event);
  if (progress < pitchEnd) drawPixelPitchTunnel(ctx, palette, event, progress, pitchEnd);

  if (isBattedBallOutcome(event.outcome) && progress >= pitchEnd + 0.06 && progress <= gamecastBallFlightEnd(event)) {
    const t = Math.max(0, Math.min(1, (progress - pitchEnd) / Math.max(0.01, gamecastBallFlightEnd(event) - pitchEnd)));
    const point = frame.ball ?? battedBallPoint(event, Math.min(1, t));
    drawPixelTrackingReticle(ctx, palette, point, progress, event);
  }

  const reveal = gamecastResultRevealProgress(event);
  if (event.outcome === "strikeout" && progress >= reveal && progress <= reveal + 0.18) {
    const fade = Math.sin(Math.max(0, Math.min(1, (progress - reveal) / 0.18)) * Math.PI);
    drawPixelBlockLetters(ctx, palette, "K", gamecastX(19), gamecastY(63), 3, palette.out, palette.base, fade);
  } else if (event.outcome === "walk" && progress >= reveal && progress <= reveal + 0.18) {
    const fade = Math.sin(Math.max(0, Math.min(1, (progress - reveal) / 0.18)) * Math.PI);
    drawPixelBlockLetters(ctx, palette, "BB", gamecastX(17), gamecastY(63), 2, palette.walk, palette.outline, fade);
  } else if (event.doublePlay && progress >= reveal && progress <= reveal + 0.18) {
    const fade = Math.sin(Math.max(0, Math.min(1, (progress - reveal) / 0.18)) * Math.PI);
    drawPixelBlockLetters(ctx, palette, "DP", gamecastX(15), gamecastY(62), 2, palette.spark, palette.outline, fade);
  }
}

function drawPixelBaseCallout(ctx, palette, callout) {
  if (!callout?.text) return;
  const previousAlpha = ctx.globalAlpha;
  const alpha = Math.max(0, Math.min(1, Number(callout.opacity ?? 1)));
  const scale = gamecastSize(callout.scale ?? 2);
  const width = blockLettersWidth(callout.text, scale);
  const height = scale * 5;
  const x = Math.round(callout.x - width / 2);
  const y = Math.round(callout.y - gamecastSize(17) - callout.pop * gamecastSize(2));
  const color = callout.type === "safe" ? palette.hit : callout.type === "change" ? palette.spark : palette.out;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - scale * 2, y - scale * 2, width + scale * 4, height + scale * 4);
  ctx.fillStyle = callout.type === "safe" ? "#e9fff4" : callout.type === "out" ? "#f2f0ec" : "#fff5c2";
  ctx.fillRect(x - scale, y - scale, width + scale * 2, height + scale * 2);
  drawPixelLine(ctx, Math.round(callout.x), y + height + scale * 3, Math.round(callout.x), Math.round(callout.y - gamecastSize(3)), palette.outline, gamecastSize(1));
  drawPixelBlockLetters(ctx, palette, callout.text, x, y, scale, color, palette.outline, 1);
  drawPixelBaseUmpire(ctx, palette, callout);
  ctx.globalAlpha = previousAlpha;
}

function drawPixelBaseUmpire(ctx, palette, callout) {
  if (!callout?.umpire) return;
  const x = Math.round(callout.x + gamecastSize(callout.x < gamecastX(60) ? -10 : 10));
  const y = Math.round(callout.y + gamecastSize(6));
  const ox = x - 3;
  const oy = y - 10;
  const cells = [
    [2, 0, "#111820"], [3, 0, "#111820"], [4, 0, "#111820"],
    [1, 1, "#111820"], [2, 1, "#111820"], [3, 1, "#111820"], [4, 1, "#111820"], [5, 1, "#111820"],
    [2, 2, palette.skin], [3, 2, palette.skin], [4, 2, palette.skin],
    [2, 3, palette.outline], [4, 3, palette.outline],
    [2, 4, "#242a2e"], [3, 4, "#242a2e"], [4, 4, "#242a2e"],
    [1, 5, "#242a2e"], [2, 5, "#242a2e"], [3, 5, palette.base], [4, 5, "#242a2e"], [5, 5, "#242a2e"],
    [2, 6, "#242a2e"], [3, 6, "#242a2e"], [4, 6, "#242a2e"],
    [2, 7, palette.legs], [4, 7, palette.legs],
    [2, 8, palette.legs], [4, 8, palette.legs],
    [1, 9, palette.legs], [5, 9, palette.legs]
  ];
  if (callout.type === "safe") {
    cells.push([0, 4, palette.skin], [6, 4, palette.skin], [-1, 4, palette.skin], [7, 4, palette.skin]);
  } else {
    cells.push([0, 2, palette.skin], [0, 1, palette.skin], [0, 0, palette.skin], [1, 4, palette.skin], [6, 5, palette.skin]);
  }
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(ox + 1, oy + 11, 7, 1);
  drawPixelSprite(ctx, palette, ox, oy, cells);
}

function drawPixelInningSlate(ctx, palette, slate) {
  if (!slate?.text) return;
  const previousAlpha = ctx.globalAlpha;
  const alpha = Math.max(0, Math.min(1, Number(slate.opacity ?? 1)));
  const scale = gamecastSize(2);
  const textWidth = blockLettersWidth(slate.text, scale);
  const x = Math.round((GAMECAST_PIXEL_W - textWidth) / 2);
  const y = gamecastY(24);
  ctx.globalAlpha = alpha * 0.92;
  ctx.fillStyle = "rgba(18, 33, 27, 0.92)";
  ctx.fillRect(gamecastX(28), y - gamecastSize(5), gamecastX(64), gamecastSize(17));
  ctx.fillStyle = palette.outline;
  ctx.fillRect(gamecastX(28), y - gamecastSize(5), gamecastX(64), gamecastSize(1));
  ctx.fillRect(gamecastX(28), y + gamecastSize(11), gamecastX(64), gamecastSize(1));
  drawPixelBlockLetters(ctx, palette, slate.text, x, y, scale, palette.sparkL, palette.outline, 1);
  ctx.globalAlpha = previousAlpha;
}

function drawPixelUmpire(ctx, palette, frame) {
  const plate = gamecastHomePlateCluster();
  const progress = Number(frame.progress ?? 0);
  const callingStrike = frame.event?.outcome === "strikeout" && progress >= 0.34 && progress <= 0.82;
  const x = plate.umpire.x;
  const y = plate.umpire.y;
  const ox = Math.round(x) - 3;
  const oy = Math.round(y) - 10;
  const shirt = "#242a2e";
  const cap = "#111820";
  const cells = [
    [2, 0, cap], [3, 0, cap], [4, 0, cap],
    [1, 1, cap], [2, 1, cap], [3, 1, cap], [4, 1, cap], [5, 1, cap],
    [2, 2, palette.skin], [3, 2, palette.skin], [4, 2, palette.skin],
    [2, 3, palette.outline], [4, 3, palette.outline],
    [2, 4, shirt], [3, 4, shirt], [4, 4, shirt],
    [1, 5, shirt], [2, 5, shirt], [3, 5, palette.base], [4, 5, shirt], [5, 5, shirt],
    [2, 6, shirt], [3, 6, shirt], [4, 6, shirt],
    [2, 7, palette.legs], [4, 7, palette.legs],
    [2, 8, palette.legs], [4, 8, palette.legs],
    [1, 9, palette.legs], [5, 9, palette.legs]
  ];
  if (callingStrike) {
    cells.push([0, 2, palette.skin], [0, 1, palette.skin], [0, 0, palette.skin], [1, 4, palette.skin], [5, 5, palette.skin], [6, 5, palette.skin]);
  } else {
    cells.push([1, 5, palette.skin], [5, 5, palette.skin], [0, 6, palette.skin], [6, 6, palette.skin]);
  }
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(ox + 1, oy + 11, 7, 1);
  drawPixelSprite(ctx, palette, ox, oy, cells);
}

function drawPixelPitchTunnel(ctx, palette, event, progress, pitchEnd) {
  const bases = gamecastBasePositions();
  const target = pitchTargetForEvent(event, bases);
  const walkPitch = event?.outcome === "walk" ? gamecastWalkPitchState(progress) : null;
  if (event?.outcome === "walk" && !walkPitch?.released) return;
  const t = walkPitch
    ? walkPitch.ballT
    : Math.max(0, Math.min(1, progress / Math.max(0.01, pitchEnd)));
  for (let index = 0; index < 7; index += 1) {
    const p = Math.max(0, t - index * 0.09);
    if (p <= 0) continue;
    const x = Math.round(lerp(bases.mound.x, target.x, easeOutCubic(p)));
    const y = Math.round(lerp(bases.mound.y, target.y, easeOutCubic(p)));
    ctx.fillStyle = index < 2 ? palette.ballGlow : (index % 2 ? palette.throw : palette.baseSh);
    ctx.fillRect(x - Math.max(0, 2 - index), y, gamecastSize(1), gamecastSize(1));
  }
}

function drawPixelTrackingReticle(ctx, palette, point, progress, event) {
  if (!point) return;
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  const pulse = Math.round(Math.sin(progress * Math.PI * 8) * 2);
  const radius = gamecastSize(event.outcome === "homeRun" ? 8 : 6) + pulse;
  const color = event.outcome === "homeRun" ? palette.homerL : event.outcome === "out" ? palette.throw : palette.spark;
  ctx.fillStyle = palette.outline;
  drawPixelReticleCorners(ctx, x, y, radius + 1, gamecastSize(4), palette.outline);
  drawPixelReticleCorners(ctx, x, y, radius, gamecastSize(4), color);
}

function drawPixelReticleCorners(ctx, x, y, radius, length, color) {
  ctx.fillStyle = color;
  const r = Math.max(3, Math.round(radius));
  const l = Math.max(2, Math.round(length));
  ctx.fillRect(x - r, y - r, l, 1);
  ctx.fillRect(x - r, y - r, 1, l);
  ctx.fillRect(x + r - l, y - r, l, 1);
  ctx.fillRect(x + r, y - r, 1, l);
  ctx.fillRect(x - r, y + r, l, 1);
  ctx.fillRect(x - r, y + r - l, 1, l);
  ctx.fillRect(x + r - l, y + r, l, 1);
  ctx.fillRect(x + r, y + r - l, 1, l);
}

function drawPixelBlockLetters(ctx, palette, text, x, y, scale, color, shadowColor, opacity = 1) {
  const alpha = Math.max(0, Math.min(1, Number(opacity ?? 1)));
  if (alpha <= 0.05) return;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * 0.86;
  drawPixelBlockLettersRaw(ctx, text, x + scale, y + scale, scale, shadowColor);
  ctx.globalAlpha = alpha;
  drawPixelBlockLettersRaw(ctx, text, x, y, scale, color);
  ctx.globalAlpha = previousAlpha;
}

function drawPixelBlockLettersRaw(ctx, text, x, y, scale, color) {
  const maps = {
    A: ["0110", "1001", "1111", "1001", "1001"],
    B: ["1110", "1001", "1110", "1001", "1110"],
    C: ["1111", "1000", "1000", "1000", "1111"],
    D: ["1110", "1001", "1001", "1001", "1110"],
    E: ["1111", "1000", "1110", "1000", "1111"],
    F: ["1111", "1000", "1110", "1000", "1000"],
    G: ["1111", "1000", "1011", "1001", "1111"],
    H: ["1001", "1001", "1111", "1001", "1001"],
    I: ["111", "010", "010", "010", "111"],
    K: ["1001", "1010", "1100", "1010", "1001"],
    N: ["1001", "1101", "1011", "1001", "1001"],
    O: ["1111", "1001", "1001", "1001", "1111"],
    P: ["1110", "1001", "1110", "1000", "1000"],
    R: ["1110", "1001", "1110", "1010", "1001"],
    S: ["1111", "1000", "1111", "0001", "1111"],
    T: ["111", "010", "010", "010", "010"],
    U: ["1001", "1001", "1001", "1001", "1111"]
  };
  ctx.fillStyle = color;
  let cursor = x;
  for (const letter of String(text ?? "").toUpperCase()) {
    const map = maps[letter];
    if (!map) {
      cursor += scale * 3;
      continue;
    }
    map.forEach((row, rowIndex) => {
      [...row].forEach((cell, colIndex) => {
        if (cell === "1") ctx.fillRect(cursor + colIndex * scale, y + rowIndex * scale, scale, scale);
      });
    });
    cursor += scale * 5;
  }
}

function blockLettersWidth(text, scale) {
  return String(text ?? "").toUpperCase().split("").reduce((width, letter) => {
    if (letter === " ") return width + scale * 3;
    return width + scale * 5;
  }, 0);
}

function drawPixelFielders(ctx, palette, frame) {
  const activePosition = normalizeFieldingPosition(frame.event?.fieldingPosition);
  const defenderColor = frame.defenseColor ?? (frame.side === "home" ? palette.defender : "#575160");
  const jerseyColor = frame.defenseJerseyColor ?? palette.defenderL;
  const activeProgress = Number(frame.progress ?? 0);
  const positions = frame.staticDefense ?? gamecastStaticDefenseSnapshot(frame);
  const activeStart = frame.event ? gamecastPitchEnd(frame.event) + 0.06 : 0.28;
  const activeEnd = frame.event ? gamecastResultRevealProgress(frame.event) : 0.82;

  for (const fielder of positions) {
    const isActive = activePosition && fielder.key === activePosition && activeProgress >= activeStart && activeProgress <= activeEnd;
    if (isActive) continue;
    const pose = fielder.transitioning ? "run" : fielder.key === "C" ? "catcher" : activePosition === fielder.key && activeProgress > activeEnd ? "catch" : "field";
    drawPixelRunner(ctx, palette, fielder.position, false, defenderColor, fielder.frame, {
      jerseyColor,
      jerseyShadow: frame.defenseJerseyShadow ?? palette.uniformSh,
      accentColor: frame.defenseAccentColor ?? defenderColor,
      pose,
      fieldingKey: fielder.key,
      uniformNumber: fielder.uniformNumber,
      abilityGrade: fielder.abilityGrade,
      abilityColor: fielder.abilityColor,
      abilityActive: fielder.abilityActive
    });
  }
}

function gamecastDefensiveAlignment() {
  const bases = gamecastBasePositions();
  const plate = gamecastHomePlateCluster();
  return [
    { key: "LF", position: { x: gamecastX(31), y: gamecastY(42) }, frame: 1 },
    { key: "CF", position: { x: gamecastX(60), y: gamecastY(29) }, frame: 2 },
    { key: "RF", position: { x: gamecastX(89), y: gamecastY(42) }, frame: 0 },
    { key: "SS", position: { x: gamecastX(46), y: gamecastY(63) }, frame: 1 },
    { key: "2B", position: { x: gamecastX(73), y: gamecastY(62) }, frame: 0 },
    { key: "3B", position: { x: gamecastX(37), y: gamecastY(70) }, frame: 2 },
    { key: "1B", position: { x: gamecastX(83), y: gamecastY(70) }, frame: 2 },
    { key: "P", position: { x: bases.mound.x, y: bases.mound.y - gamecastSize(4) }, frame: 2 },
    { key: "C", position: { ...plate.catcher }, frame: 2 }
  ];
}

function gamecastStaticDefenseSnapshot(frame) {
  const movingFielders = new Set(frame?.activeFielders ?? []);
  const activeProgress = Number(frame?.progress ?? 0);
  const pitchingNow = frame?.event
    && !isGamecastStealEvent(frame.event)
    && activeProgress <= gamecastPitchEnd(frame.event) + 0.11;
  return gamecastDefensiveAlignment()
    .filter((fielder) => !movingFielders.has(fielder.key) && !(pitchingNow && fielder.key === "P"))
    .map((fielder) => {
      const transition = gamecastStaticFielderTransition(fielder, frame);
      const profile = fielder.key === "P"
        ? frame?.event?.pitcherProfile
        : frame?.event?.defenseProfilesByPosition?.[fielder.key];
      return {
        ...fielder,
        position: transition?.position ?? { ...fielder.position },
        transitioning: Boolean(transition),
        frame: transition ? Math.floor(transition.t * 8) % 4 : fielder.frame,
        uniformNumber: gamecastProfileUniformNumber(profile, profile?.name ?? fielder.key, profile?.id ?? fielder.key),
        ...gamecastAbilitySpriteFields(gamecastFieldingAbilityForEvent(frame?.event, fielder.key), false)
      };
    });
}

function gamecastStaticFielderTransition(fielder, frame) {
  if (!frame?.bridge || frame?.inningSlate?.text !== "CHANGE") return null;
  const t = Math.max(0, Math.min(1, Number(frame.gapProgress ?? 0)));
  if (t <= 0.04) return null;
  const eased = easeInOutCubic(t);
  const toRight = fielder.position.x >= gamecastX(60);
  const target = {
    x: gamecastX(toRight ? 112 : 8),
    y: gamecastY(fielder.key === "C" || fielder.key === "P" ? 94 : 88)
  };
  return {
    t,
    position: {
      x: Math.round(lerp(fielder.position.x, target.x, eased)),
      y: Math.round(lerp(fielder.position.y, target.y, eased))
    }
  };
}

function normalizeFieldingPosition(position) {
  const raw = String(position ?? "").trim().toUpperCase();
  if (!raw) return "";
  if (["P", "투수"].includes(raw)) return "P";
  if (["C", "포수"].includes(raw)) return "C";
  if (["1B", "1루수"].includes(raw)) return "1B";
  if (["2B", "2루수"].includes(raw)) return "2B";
  if (["3B", "3루수"].includes(raw)) return "3B";
  if (["SS", "유격수"].includes(raw)) return "SS";
  if (["LF", "좌익수"].includes(raw)) return "LF";
  if (["CF", "중견수"].includes(raw)) return "CF";
  if (["RF", "우익수"].includes(raw)) return "RF";
  if (["IF", "내야수"].includes(raw)) return "SS";
  if (["OF", "외야수"].includes(raw)) return "CF";
  return raw;
}

function gamecastBasePositions() {
  return {
    home: { x: gamecastX(60), y: gamecastY(96) },
    first: { x: gamecastX(87), y: gamecastY(75) },
    second: { x: gamecastX(60), y: gamecastY(53) },
    third: { x: gamecastX(33), y: gamecastY(75) },
    mound: { x: gamecastX(60), y: gamecastY(72) }
  };
}

function gamecastFoulLinePositions() {
  const endY = 55;
  const home = { x: 60, y: 96 };
  const first = { x: 87, y: 75 };
  const third = { x: 33, y: 75 };
  const t = (endY - home.y) / (third.y - home.y);
  return {
    left: { x: gamecastX(home.x + (third.x - home.x) * t), y: gamecastY(endY) },
    right: { x: gamecastX(home.x + (first.x - home.x) * t), y: gamecastY(endY) }
  };
}

function gamecastHomePlateCluster() {
  const bases = gamecastBasePositions();
  return {
    batter: { x: bases.home.x + gamecastSize(10), y: bases.home.y - gamecastSize(3) },
    catcher: { x: bases.home.x - gamecastSize(1), y: bases.home.y + gamecastSize(4) },
    umpire: { x: bases.home.x - gamecastSize(6), y: bases.home.y + gamecastSize(8) }
  };
}

function buildGamecastFrameState(state, forceFinal = false) {
  const seq = state.sequence;
  const events = seq.events;
  if (!events.length) {
    return {
      done: true,
      event: null,
      eventIndex: -1,
      side: "away",
      bases: [false, false, false],
      outs: 0,
      score: { away: seq.finalAway, home: seq.finalHome },
      runners: [],
      offenseColor: state.palette.runner,
      offenseJerseyColor: state.palette.uniform,
      offenseJerseyShadow: state.palette.uniformSh,
      offenseAccentColor: state.palette.runner,
      defenseColor: state.palette.defender,
      defenseJerseyColor: state.palette.defenderL,
      defenseJerseyShadow: state.palette.uniformSh,
      defenseAccentColor: state.palette.defender,
      defenseSprites: [],
      throwLines: [],
      ballShadow: null,
      contactBurst: null,
      actionBurst: null,
      baseCallout: null,
      inningSlate: null,
      ballparkProfile: seq.ballparkProfile
    };
  }

  const totalMs = gamecastTotalDuration(seq);
  if (forceFinal || state.prefersReducedMotion || state.elapsedMs >= totalMs) {
    const last = events[events.length - 1];
    return {
      done: true,
      event: last,
      eventIndex: events.length - 1,
      side: last.side,
      bases: last.inningEnded ? [false, false, false] : last.basesAfter,
      outs: last.inningEnded ? 0 : outsInInning(last.outsAfter),
      score: { away: seq.finalAway, home: seq.finalHome },
      runners: [],
      offenseColor: last.teamColor ?? state.palette.runner,
      offenseJerseyColor: last.teamJerseyColor ?? state.palette.uniform,
      offenseJerseyShadow: last.teamJerseyShadow ?? state.palette.uniformSh,
      offenseAccentColor: last.teamAccentColor ?? last.teamColor ?? state.palette.runner,
      defenseColor: last.defenseColor ?? state.palette.defender,
      defenseJerseyColor: last.defenseJerseyColor ?? state.palette.defenderL,
      defenseJerseyShadow: last.defenseJerseyShadow ?? state.palette.uniformSh,
      defenseAccentColor: last.defenseAccentColor ?? last.defenseColor ?? state.palette.defender,
      defenseSprites: [],
      throwLines: [],
      ballShadow: null,
      contactBurst: null,
      actionBurst: null,
      baseCallout: null,
      inningSlate: null,
      ballparkProfile: seq.ballparkProfile,
      playbackDurationMs: gamecastEventPlayDuration(seq, last),
      progress: 1
    };
  }

  const timing = gamecastPlaybackPosition(seq, state.elapsedMs);
  const index = timing.index;
  const localMs = timing.localMs;
  const event = timing.event;
  const nextEvent = events[index + 1] ?? null;
  const paMs = timing.playMs;
  const gapMs = timing.gapMs;
  const rawProgress = Math.max(0, Math.min(1, localMs / paMs));
  const gapProgress = localMs > paMs && gapMs > 0
    ? Math.max(0, Math.min(1, (localMs - paMs) / gapMs))
    : 0;
  const leverage = gamecastLeverageScore(seq, events, index);
  const progress = gapProgress > 0 ? 1 : gamecastTempoProgress(event, rawProgress, leverage, state.stepMode, seq.mode);
  const resultRevealProgress = gamecastResultRevealProgress(event);
  const scoreRevealProgress = gamecastScoreRevealProgress(event);
  const resultRevealed = gapProgress > 0 || progress >= resultRevealProgress;
  const scoreRevealed = gapProgress > 0 || progress >= scoreRevealProgress;
  const settling = resultRevealed;
  const clearingInning = event.inningEnded && progress >= 0.92;
  const baseOccupancy = settling
    ? (clearingInning ? [false, false, false] : event.basesAfter)
    : baseOccupancyDuringMove(event, progress);
  const score = scoreForGamecastFrame(seq, events, index, scoreRevealed);
  const runners = buildRunnerSprites(event, progress, state.palette);
  const defenseSprites = buildGamecastDefenseSprites(event, progress, state.palette);
  const activeFielders = [...new Set(defenseSprites.map((sprite) => sprite.fieldingKey).filter(Boolean))];
  const inningSlate = buildGamecastBridgeSlate(event, nextEvent, gapProgress) ?? buildGamecastInningSlate(event, progress);
  const bridge = gapProgress > 0;
  const staticDefense = gamecastStaticDefenseSnapshot({ event, activeFielders, progress, gapProgress, bridge, inningSlate });

  return {
    done: false,
    event,
    eventIndex: index,
    side: event.side,
    bases: baseOccupancy,
    outs: displayOutsForEvent(event, progress),
    score,
    runners,
    batter: buildBatterSprite(event, progress, state.palette),
    ball: buildBallSprite(event, progress),
    ballTrail: buildBallTrail(event, progress),
    ballShadow: buildGamecastBallShadow(event, progress),
    defenseSprites,
    activeFielders,
    staticDefense,
    throwLines: buildGamecastThrowLines(event, progress),
    contactBurst: buildGamecastContactBurst(event, progress),
    ballTrailColor: event.outcome === "homeRun" ? state.palette.homerL : state.palette.baseSh,
    ballColor: state.palette.base,
    playerLabel: buildGamecastPlayerLabel(event, progress, runners, defenseSprites),
    actionBurst: buildGamecastActionBurst(event, progress),
    baseCallout: buildGamecastBaseCallout(event, progress),
    inningSlate,
    ballparkProfile: seq.ballparkProfile,
    resultRevealed,
    scoreRevealed,
    scoreFlash: event.runs > 0 && progress >= scoreRevealProgress && progress <= Math.min(0.99, scoreRevealProgress + 0.18),
    flash: event.outcome === "homeRun" && progress >= scoreRevealProgress && progress < Math.min(0.99, scoreRevealProgress + 0.09),
    camera: buildGamecastCamera(event, progress),
    offenseColor: event.teamColor ?? state.palette.runner,
    offenseJerseyColor: event.teamJerseyColor ?? state.palette.uniform,
    offenseJerseyShadow: event.teamJerseyShadow ?? state.palette.uniformSh,
    offenseAccentColor: event.teamAccentColor ?? event.teamColor ?? state.palette.runner,
    defenseColor: event.defenseColor ?? state.palette.defender,
    defenseJerseyColor: event.defenseJerseyColor ?? state.palette.defenderL,
    defenseJerseyShadow: event.defenseJerseyShadow ?? state.palette.uniformSh,
    defenseAccentColor: event.defenseAccentColor ?? event.defenseColor ?? state.palette.defender,
    progress,
    rawProgress,
    gapProgress,
    bridge,
    leverage,
    playbackDurationMs: paMs,
    eventStartMs: timing.startMs,
    eventEndMs: timing.endMs
  };
}

function gamecastLeverageScore(seq, events, index) {
  const event = events[index];
  if (!event) return 0;
  const beforeScore = scoreForGamecastFrame(seq, events, index, false);
  const diff = Math.abs(Number(beforeScore.away ?? 0) - Number(beforeScore.home ?? 0));
  const inning = Number(event.inning ?? 1);
  const baseCount = (event.basesBefore ?? []).filter(Boolean).length;
  let score = 0;
  if (inning >= 7) score += 0.24;
  if (inning >= 9) score += 0.16;
  if (diff <= 1) score += 0.24;
  else if (diff <= 3) score += 0.12;
  score += Math.min(0.22, baseCount * 0.075);
  if (outsInInning(event.outsBefore) >= 2) score += 0.08;
  return Math.max(0, Math.min(1, score));
}

function gamecastTempoProgress(event, rawProgress, leverage, stepMode = false, mode = "summary") {
  const raw = Math.max(0, Math.min(1, Number(rawProgress) || 0));
  if (String(mode) === "watch") return raw;
  const lev = Math.max(0, Math.min(1, Number(leverage) || 0));
  const lowLeverageOut = event?.outcome === "out" && lev < 0.25 && Number(event?.runs ?? 0) <= 0;
  if (lowLeverageOut && !stepMode) return Math.min(1, raw * 1.18);
  return raw;
}

export function gamecastEffectivePlaybackRate(state, frame = null) {
  if (state?.paused || state?.done) return 0;
  const rate = sanitizeGamecastSpeed(state?.playbackRate);
  const activeFrame = frame ?? state?.currentFrame;
  if ((activeFrame?.resultRevealed || activeFrame?.bridge) && state?.sequence?.mode === "watch") {
    return Math.min(rate, 1);
  }
  if (rate >= 4 && gamecastCriticalBallPhase(activeFrame)) {
    return Math.min(rate, GAMECAST_FAST_BALL_RATE);
  }
  if (activeFrame?.scoreFlash && state?.sequence?.mode === "watch") {
    return Math.min(rate, GAMECAST_SCORE_SLOW_RATE);
  }
  return rate;
}

function gamecastCriticalBallPhase(frame) {
  const event = frame?.event;
  if (!event || frame.done) return false;
  const progress = Number(frame.progress ?? 0);
  if (event.outcome === "walk") return Boolean(gamecastWalkPitchState(progress));
  const pitchStarts = [0];
  if (pitchStarts.some((start) => progress >= start && progress <= start + 0.22)) return true;
  return isBattedBallOutcome(event.outcome) && progress < gamecastBallFlightEnd(event);
}

function maybeHoldGamecastPlayback(state, frame, applyHold) {
  if (!state || !frame?.event || frame.done || state.done || state.paused || state.prefersReducedMotion) return false;
  if (state.sequence?.mode !== "watch") return false;
  if (typeof applyHold !== "function") return false;

  const events = state.sequence.events ?? [];
  const eventIndex = Math.max(0, Math.min(events.length - 1, Number(frame.eventIndex ?? 0)));
  const event = events[eventIndex] ?? frame.event;
  const nextEvent = events[eventIndex + 1] ?? null;
  const totalMs = gamecastTotalDuration(state.sequence);
  const timing = gamecastEventTiming(state.sequence, eventIndex);
  const holdElapsedMs = Math.max(0, Math.min(totalMs, timing.endMs - 1));
  const resumeElapsedMs = Math.max(0, Math.min(totalMs, timing.endMs + 1));
  const allowAutomaticHolds = state.holdsEnabled !== false && !isFastGamecastPlayback(state);
  const setBoundaryHoldTime = () => {
    state.elapsedMs = holdElapsedMs;
    state.done = false;
  };
  const issueHold = (hold) => {
    if (!hold?.key || state.lastHoldKey === hold.key) return false;
    setBoundaryHoldTime();
    return applyHold({
      ...hold,
      eventIndex,
      resumeElapsedMs
    });
  };

  if (allowAutomaticHolds && Number(frame.rawProgress ?? 0) <= 0.035 && Number(frame.gapProgress ?? 0) <= 0) {
    const key = `leverage:${event.id}`;
    if (state.lastHoldKey !== key && Number(frame.leverage ?? 0) >= GAMECAST_HOLD_LEVERAGE_THRESHOLD) {
      return applyHold({
        type: "leverage",
        key,
        eventIndex,
        resumeElapsedMs: Math.max(0, Math.min(totalMs, timing.startMs + 1)),
        title: "승부처",
        detail: gamecastHoldSituationDetail(event),
        action: "승부 보기 ▶"
      });
    }
  }

  if (state.stepMode && nextEvent && Number(frame.progress ?? 0) >= gamecastResultRevealProgress(event)) {
    return issueHold({
      type: "step",
      key: `step:${event.id}`,
      title: "타석 확인",
      detail: `${gamecastOutcomeShort(event)} · ${event.hitterName || "타자"}`,
      action: "다음 타석 ▶"
    });
  }

  if (!nextEvent || Number(frame.gapProgress ?? 0) < 0.68) return false;

  if (allowAutomaticHolds && (event.inningEnded || event.inning !== nextEvent.inning || event.side !== nextEvent.side)) {
    return issueHold({
      type: "inning",
      key: `inning:${event.id}`,
      title: "이닝 교대",
      detail: `${formatNumber(event.inning)}회 ${event.side === "home" ? "말" : "초"} 종료 · ${gamecastOutcomeShort(event)}`,
      action: "계속 ▶"
    });
  }

  return false;
}

function gamecastHoldSituationDetail(event) {
  if (!event) return "상황 대기";
  const score = `${formatNumber(outsInInning(event.outsBefore))}아웃 · ${gamecastBaseSummary(event.basesBefore)}`;
  return `${formatNumber(event.inning)}회 ${event.side === "home" ? "말" : "초"} · ${score} · ${event.hitterName || "타자"} vs ${event.pitcherName || "투수"}`;
}

function buildGamecastBaseCallout(event, progress) {
  if (!event) return null;
  const isSafeOutcome = ["single", "double", "triple", "walk", "error"].includes(event.outcome);
  const isOutOutcome = ["out", "sacrificeBunt"].includes(event.outcome) || event.doublePlay;
  const reveal = gamecastResultRevealProgress(event);
  const start = Math.max(0.5, reveal - 0.1);
  const end = Math.min(0.98, reveal + 0.1);
  if ((!isSafeOutcome && !isOutOutcome) || progress < start || progress > end) return null;
  const t = Math.max(0, Math.min(1, (progress - start) / Math.max(0.01, end - start)));
  const anchor = gamecastCalloutAnchor(event);
  return {
    text: isSafeOutcome ? "SAFE" : event.doublePlay ? "OUT" : "OUT",
    type: isSafeOutcome ? "safe" : "out",
    x: anchor.x,
    y: anchor.y,
    opacity: Math.max(0, Math.min(1, t < 0.16 ? t / 0.16 : (1 - t) / 0.22)),
    pop: Math.sin(Math.min(1, t * 1.15) * Math.PI),
    scale: isSafeOutcome ? 2 : 2,
    umpire: true
  };
}

function gamecastCalloutAnchor(event) {
  const bases = gamecastBasePositions();
  if (event?.doublePlay) return bases.second;
  if (["out", "sacrificeBunt"].includes(event?.outcome)) {
    const fieldingKey = normalizeFieldingPosition(event.fieldingPosition);
    const battedType = String(event.battedBallType ?? "");
    if (["LF", "CF", "RF"].includes(fieldingKey) || battedType === "flyBall" || battedType === "lineDrive") {
      return battedBallGroundPoint(event, 1);
    }
    return bases.first;
  }
  const targetBase = Math.min(4, gamecastAdvanceCount(event?.outcome));
  if (targetBase === 1) return bases.first;
  if (targetBase === 2) return bases.second;
  if (targetBase === 3) return bases.third;
  return bases.home;
}

function buildGamecastInningSlate(event, progress) {
  if (!event?.inningEnded || progress < 0.78 || progress > 0.98) return null;
  const t = Math.max(0, Math.min(1, (progress - 0.78) / 0.2));
  return {
    text: "CHANGE",
    opacity: Math.sin(t * Math.PI)
  };
}

function buildGamecastBridgeSlate(event, nextEvent, gapProgress) {
  const raw = Math.max(0, Math.min(1, Number(gapProgress) || 0));
  if (!event || !nextEvent || raw < 0.82) return null;
  const t = Math.max(0, Math.min(1, (raw - 0.82) / 0.18));
  const changingSide = event.inning !== nextEvent.inning || event.side !== nextEvent.side || event.inningEnded;
  return {
    text: changingSide ? "CHANGE" : "NEXT",
    opacity: Math.sin(t * Math.PI)
  };
}

export function buildGamecastActionBurst(event, progress) {
  if (!event) return null;
  const profile = gamecastBurstProfile(event);
  const start = Math.max(gamecastResultRevealProgress(event), gamecastPitchEnd(event) + profile.delay);
  const end = 1;
  if (progress < start || progress > end) return null;

  const t = Math.max(0, Math.min(1, (progress - start) / Math.max(0.01, end - start)));
  const popIn = easeOutBack(Math.min(1, t / 0.28));
  const motionHold = t < 0.55 ? 1 : Math.max(0, (1 - t) / 0.45);
  const bounce = Math.sin(Math.min(1, t * 1.2) * Math.PI);
  const text = gamecastBurstText(event);
  if (!text) return null;

  return {
    text,
    className: gamecastBurstClass(event),
    x: profile.x,
    y: profile.y,
    opacity: Math.max(0, Math.min(1, t < 0.1 ? t / 0.1 : 1)),
    scaleX: profile.baseScale + popIn * profile.pop + bounce * 0.1,
    scaleY: profile.baseScale + popIn * profile.pop * 0.82 - bounce * 0.08,
    shakeX: Math.round(Math.sin(t * Math.PI * profile.shakeRate) * profile.shake * motionHold),
    shakeY: Math.round(Math.cos(t * Math.PI * (profile.shakeRate - 1)) * profile.shake * 0.36 * motionHold),
    rotate: Math.sin(t * Math.PI * (profile.shakeRate - 2)) * profile.tilt * motionHold,
    impact: Math.max(0, Math.min(1, Math.sin(Math.min(1, t * 1.35) * Math.PI))) * motionHold
  };
}

function gamecastBurstProfile(event) {
  const outcome = event?.outcome;
  if (outcome === "homeRun") {
    return { delay: 0.01, end: 0.995, x: 50, y: 13, baseScale: 0.82, pop: 0.58, shake: 3, shakeRate: 10, tilt: 1.5 };
  }
  if (outcome === "strikeout") {
    return { delay: 0.03, end: 0.995, x: 50, y: 13, baseScale: 0.84, pop: 0.48, shake: 2, shakeRate: 8, tilt: 1 };
  }
  if (outcome === "walk") {
    return { delay: 0.04, end: 0.995, x: 50, y: 13, baseScale: 0.84, pop: 0.42, shake: 1, shakeRate: 7, tilt: 0.8 };
  }
  if (outcome === "out") {
    return { delay: 0.04, end: 0.995, x: 50, y: 13, baseScale: 0.84, pop: 0.44, shake: event?.doublePlay ? 3 : 1, shakeRate: 8, tilt: 1 };
  }
  return { delay: 0.02, end: 0.995, x: 50, y: 13, baseScale: 0.84, pop: 0.5, shake: 2, shakeRate: 9, tilt: 1 };
}

function gamecastBurstText(event) {
  const text = gamecastResultDisplayText(event);
  return text && text !== "-" ? `${text}!` : "";
}

function gamecastBurstClass(event) {
  const outcome = event?.outcome;
  if (outcome === "homeRun") return "is-homer";
  if (["single", "double", "triple"].includes(outcome)) return "is-hit";
  if (outcome === "error") return "is-error";
  if (outcome === "strikeout" || outcome === "out" || outcome === "sacrificeBunt") return "is-out";
  if (outcome === "walk") return "is-walk";
  return "";
}

function gamecastAbilitySpriteFields(ability, active = false) {
  if (!ability?.grade || !ability?.color) return {};
  return {
    abilityGrade: ability.grade,
    abilityColor: ability.color,
    abilityScore: Number(ability.score ?? 0),
    abilityActive: Boolean(active),
    playerId: String(ability.playerId ?? ""),
    playerName: String(ability.playerName ?? "")
  };
}

function gamecastFieldingAbilityForEvent(event, key) {
  const fieldingKey = normalizeFieldingPosition(key);
  if (fieldingKey === "P") return event?.pitcherAbility ?? null;
  if (fieldingKey && fieldingKey === normalizeFieldingPosition(event?.fieldingPosition) && event?.defenderAbility) {
    return event.defenderAbility;
  }
  return event?.defenseAbilityByPosition?.[fieldingKey] ?? null;
}

export function buildBatterSprite(event, progress, palette) {
  if (!event) return null;
  if (isGamecastStealEvent(event)) {
    if (progress >= 0.96) return null;
    return {
      position: { ...gamecastHomePlateCluster().batter },
      color: event.teamColor ?? palette.runner,
      jerseyColor: event.teamJerseyColor ?? palette.uniform,
      jerseyShadow: event.teamJerseyShadow ?? palette.uniformSh,
      accentColor: event.teamAccentColor ?? event.teamColor ?? palette.runner,
      uniformNumber: "",
      pose: "stance",
      animationKey: null,
      animationT: 0,
      runFrame: 2
    };
  }
  if (progress >= 0.72) return null;
  const advance = gamecastAdvanceCount(event.outcome);
  const pitchEnd = gamecastPitchEnd(event);
  const batted = isBattedBallOutcome(event.outcome);
  const runnerStart = gamecastRunnerMoveStart(event);
  if ((advance > 0 || event.outcome === "walk") && progress >= runnerStart) return null;
  if (["out", "sacrificeBunt"].includes(event.outcome) && progress >= runnerStart) return null;
  let pose = "stance";
  if (progress >= pitchEnd - 0.08 && progress < pitchEnd + 0.01) pose = "load";
  else if (progress >= pitchEnd + 0.01 && progress < pitchEnd + 0.16) {
    if (event.outcome === "walk") pose = "take";
    else if (event.outcome === "strikeout") pose = "miss";
    else pose = "swing";
  } else if (progress >= pitchEnd + 0.16) {
    pose = event.outcome === "strikeout" ? "miss" : "follow";
  }
  const swingStart = pitchEnd - 0.1;
  const swingEnd = pitchEnd + 0.3;
  const swingT = Math.max(0, Math.min(1, (progress - swingStart) / Math.max(0.01, swingEnd - swingStart)));

  return {
    position: { ...gamecastHomePlateCluster().batter },
    color: event.teamColor ?? palette.runner,
    jerseyColor: event.teamJerseyColor ?? palette.uniform,
    jerseyShadow: event.teamJerseyShadow ?? palette.uniformSh,
    accentColor: event.teamAccentColor ?? event.teamColor ?? palette.runner,
    uniformNumber: event.hitterUniformNumber,
    pose,
    animationKey: event.outcome === "walk" ? null : "swing",
    animationT: swingT,
    runFrame: 2,
    ...gamecastAbilitySpriteFields(event.hitterAbility, true)
  };
}

function buildGamecastPlayerLabel(event, progress, runners, defenseSprites = []) {
  if (!event || progress >= 0.96) {
    return { visible: false, text: "", x: 50, y: 50, scoring: false };
  }
  const showFielder = event.defenderName && event.outcome !== "homeRun" && isBattedBallOutcome(event.outcome) && progress >= gamecastPitchEnd(event) + 0.16 && progress < gamecastResultRevealProgress(event);
  if (showFielder) {
    const pitchEnd = gamecastPitchEnd(event);
    const runStart = Math.max(0.34, pitchEnd + 0.06);
    const catchProgress = gamecastFieldingCatchProgress(event);
    const fieldT = Math.max(0, Math.min(1, (progress - runStart) / Math.max(0.01, catchProgress - runStart)));
    const target = battedBallGroundPoint(event, 1);
    const start = gamecastDefenderStartForTarget(target, event);
    const eased = easeOutCubic(fieldT);
    const activeKey = gamecastFieldingKeyForTarget(event, target);
    const activeDefender = defenseSprites.find((sprite) => sprite?.fieldingKey === activeKey && sprite?.position);
    const position = activeDefender?.position
      ? { ...activeDefender.position }
      : {
          x: Math.round(lerp(start.x, target.x, eased)),
          y: Math.round(lerp(start.y, target.y, eased))
        };
    const revealProgress = gamecastResultRevealProgress(event);
    const fadeOut = progress > revealProgress - 0.08 ? Math.max(0, (revealProgress - progress) / 0.08) : 1;
    return {
      visible: fadeOut > 0.08,
      text: shortenGamecastPlayerName(event.defenderName),
      x: Math.max(gamecastX(10), Math.min(gamecastX(110), position.x)),
      y: Math.max(gamecastY(10), Math.min(gamecastY(96), position.y - gamecastSize(16))),
      opacity: fadeOut,
      scoring: false
    };
  }
  if (isGamecastStealEvent(event)) {
    const transition = gamecastStealTransition(event);
    const timing = gamecastRunnerTransitionTiming(event, transition);
    const movingRunner = runners.find((runner) => runner.role === "runner") ?? null;
    const bases = gamecastBasePositions();
    const from = gamecastBasePoint(transition.fromBase, bases);
    const to = gamecastBasePoint(transition.toBase, bases);
    const position = movingRunner?.position
      ?? (progress < timing.startT ? from : to);
    const fadeIn = Math.min(1, Math.max(0, progress / 0.08));
    const fadeOut = progress > 0.86 ? Math.max(0, (0.98 - progress) / 0.12) : 1;
    const opacity = Math.max(0, Math.min(1, fadeIn * fadeOut));
    return {
      visible: opacity > 0.08,
      text: shortenGamecastPlayerName(event.runnerName),
      x: Math.max(gamecastX(10), Math.min(gamecastX(110), position.x)),
      y: Math.max(gamecastY(10), Math.min(gamecastY(102), position.y - gamecastSize(12))),
      opacity,
      scoring: false
    };
  }
  const bases = gamecastBasePositions();
  const batterRunner = runners.find((runner) => runner.role === "batter") ?? null;
  const advance = gamecastAdvanceCount(event.outcome);
  const targetBase = advance > 0 ? Math.min(4, advance) : 0;
  const targetPath = targetBase > 0 ? gamecastPathBetween(0, targetBase) : [];
  const target = targetPath.length ? targetPath[targetPath.length - 1] : { x: bases.home.x + gamecastSize(7), y: bases.home.y - gamecastSize(3) };
  const position = batterRunner?.position
    ?? (progress < gamecastRunnerMoveEnd(event) ? { x: bases.home.x + gamecastSize(8), y: bases.home.y - gamecastSize(1) } : target)
    ?? { x: bases.home.x + gamecastSize(8), y: bases.home.y - gamecastSize(1) };
  const fadeIn = Math.min(1, Math.max(0, progress / 0.08));
  const fadeOut = progress > 0.86 ? Math.max(0, (0.98 - progress) / 0.12) : 1;
  const opacity = Math.max(0, Math.min(1, fadeIn * fadeOut));
  const lift = batterRunner ? gamecastSize(12) : gamecastSize(16);
  return {
    visible: opacity > 0.08,
    text: shortenGamecastPlayerName(event.hitterName),
    x: Math.max(gamecastX(10), Math.min(gamecastX(110), position.x)),
    y: Math.max(gamecastY(10), Math.min(gamecastY(102), position.y - lift)),
    opacity,
    scoring: Number(event.runs ?? 0) > 0 && progress >= 0.55
  };
}

function shortenGamecastPlayerName(name) {
  const text = String(name ?? "").trim();
  if (!text) return "타자";
  return text.length > 7 ? `${text.slice(0, 7)}...` : text;
}

function baseOccupancyDuringMove(event, progress) {
  const transitions = gamecastRunnerTransitions(event);
  if (transitions.length === 0) return progress >= gamecastResultRevealProgress(event) ? event.basesAfter : event.basesBefore;
  const occupancy = [...event.basesBefore];
  for (const transition of transitions) {
    const timing = gamecastRunnerTransitionTiming(event, transition);
    if (transition.fromBase > 0 && progress >= timing.startT) occupancy[transition.fromBase - 1] = false;
    if (!transition.out && transition.toBase > 0 && transition.toBase < 4 && progress >= timing.endT) {
      occupancy[transition.toBase - 1] = true;
    }
  }
  return occupancy;
}

function scoreForGamecastFrame(seq, events, currentIndex, includeCurrent) {
  let away = seq.startAway;
  let home = seq.startHome;
  for (let index = 0; index < events.length; index += 1) {
    if (index > currentIndex || (index === currentIndex && !includeCurrent)) break;
    if (events[index].side === "home") home += Number(events[index].runs || 0);
    else away += Number(events[index].runs || 0);
  }
  return { away, home };
}

function displayOutsForEvent(event, progress) {
  const revealProgress = gamecastResultRevealProgress(event);
  if (event.inningEnded && progress >= revealProgress && progress < 0.92) return 3;
  if (event.inningEnded && progress >= 0.92) return 0;
  return outsInInning(progress >= revealProgress ? event.outsAfter : event.outsBefore);
}

function outsInInning(value) {
  const outs = Math.max(0, Math.floor(Number(value ?? 0)));
  return outs % 3;
}

function buildRunnerSprites(event, progress, palette) {
  const transitions = gamecastRunnerTransitions(event);
  if (transitions.length === 0) return [];
  const walking = event.outcome === "walk";
  const runners = [];
  const runnerColor = event.teamColor ?? palette.runner;
  const trailColor = event.teamTrailColor ?? palette.runnerL;
  const jerseyColor = event.teamJerseyColor ?? palette.uniform;
  const jerseyShadow = event.teamJerseyShadow ?? palette.uniformSh;
  const accentColor = event.teamAccentColor ?? runnerColor;
  const uniformNumber = event.hitterUniformNumber;

  for (const transition of transitions) {
    const timing = gamecastRunnerTransitionTiming(event, transition);
    if (progress < timing.startT || progress >= timing.endT) continue;
    const moveT = Math.max(0, Math.min(1, (progress - timing.startT) / Math.max(0.01, timing.endT - timing.startT)));
    const eased = walking ? easeInOutCubic(moveT) : easeOutCubic(moveT);
    const runnerProfile = transition.role === "batter"
      ? null
      : event.baseRunnerProfilesBefore?.[transition.fromBase - 1] ?? null;
    const runnerAbility = transition.role === "batter" ? event.hitterAbility : gamecastAbilityVisual(runnerProfile);
    const path = transition.role === "batter"
      ? gamecastBatterPathTo(transition.toBase)
      : gamecastPathBetween(transition.fromBase, transition.toBase);
    runners.push(makeRunnerSprite(path, eased, runnerColor, trailColor, moveT, transition.role, {
      jerseyColor,
      jerseyShadow,
      accentColor,
      uniformNumber: transition.role === "batter"
        ? uniformNumber
        : gamecastProfileUniformNumber(runnerProfile, runnerProfile?.name ?? "", runnerProfile?.id ?? ""),
      ability: runnerAbility,
      pose: walking ? "walk" : "run",
      trail: !walking,
      allowSlide: !walking && event.outcome !== "homeRun" && (timing.slide || transition.out)
    }));
  }
  return runners;
}

function isGamecastStealEvent(event) {
  return event?.type === "stolenBase"
    || event?.outcome === "stolenBase"
    || event?.outcome === "caughtStealing";
}

function gamecastStealTransition(event) {
  const fromBase = Math.max(1, Math.min(3, Math.floor(Number(event?.fromBase) || 1)));
  const toBase = Math.max(fromBase + 1, Math.min(4, Math.floor(Number(event?.toBase) || fromBase + 1)));
  return {
    id: String(event?.runnerId ?? "steal-runner"),
    role: "runner",
    fromBase,
    toBase,
    out: event?.outcome === "caughtStealing" || event?.caught === true || event?.out === true
  };
}

function gamecastBasePoint(base, bases = gamecastBasePositions()) {
  const key = ["home", "first", "second", "third", "home"][Math.max(0, Math.min(4, Number(base) || 0))];
  return { ...(bases[key] ?? bases.home) };
}

function gamecastStealThrowTiming(event) {
  const transition = gamecastStealTransition(event);
  const runnerTiming = gamecastRunnerTransitionTiming(event, transition);
  const success = !transition.out;
  const endT = Math.max(0.46, Math.min(0.92, runnerTiming.endT + (success ? 0.03 : -0.025)));
  return {
    startT: Math.max(0.26, endT - 0.2),
    endT,
    transition,
    runnerTiming
  };
}

function gamecastStealBallPoint(from, to, t) {
  const eased = easeOutCubic(Math.max(0, Math.min(1, t)));
  return {
    x: Math.round(lerp(from.x, to.x, eased)),
    y: Math.round(lerp(from.y, to.y, eased) - Math.sin(eased * Math.PI) * gamecastSize(10))
  };
}

function gamecastStealThrowState(event, progress) {
  if (!isGamecastStealEvent(event)) return null;
  const timing = gamecastStealThrowTiming(event);
  if (progress < timing.startT || progress > timing.endT) return null;
  const bases = gamecastBasePositions();
  const from = timing.transition.toBase === 4
    ? { ...bases.mound }
    : { ...gamecastHomePlateCluster().catcher };
  const to = gamecastBasePoint(timing.transition.toBase, bases);
  const rawT = Math.max(0, Math.min(1, (progress - timing.startT) / Math.max(0.01, timing.endT - timing.startT)));
  return {
    ...timing,
    from,
    to,
    rawT,
    current: gamecastStealBallPoint(from, to, rawT),
    previous: gamecastStealBallPoint(from, to, Math.max(0, rawT - 0.08))
  };
}

export function gamecastRunnerTransitions(event) {
  if (!event) return [];
  if (isGamecastStealEvent(event)) return [gamecastStealTransition(event)];
  if (event.outcome === "strikeout") return [];
  const beforeIds = Array.from({ length: 3 }, (_, index) => String(event.baseRunnerIdsBefore?.[index] ?? ""));
  const afterIds = Array.from({ length: 3 }, (_, index) => String(event.baseRunnerIdsAfter?.[index] ?? ""));
  const afterBaseById = new Map();
  afterIds.forEach((id, index) => {
    if (id) afterBaseById.set(id, index + 1);
  });
  const scoredIds = new Set((event.scoredRunners ?? [])
    .map((runner) => String(runner?.id ?? runner?.runnerId ?? runner ?? ""))
    .filter(Boolean));
  const transitions = [];

  for (let index = 0; index < 3; index += 1) {
    const occupied = Boolean(event.basesBefore?.[index] || beforeIds[index]);
    if (!occupied) continue;
    const fromBase = index + 1;
    const id = beforeIds[index];
    let toBase = id && scoredIds.has(id) ? 4 : id ? afterBaseById.get(id) : null;
    let out = false;
    if (!toBase && event.doublePlay && fromBase === 1) {
      toBase = 2;
      out = true;
    }
    if (!toBase && !id) {
      const openAfterBase = (event.basesAfter ?? [])
        .map((value, afterIndex) => value ? afterIndex + 1 : 0)
        .find((base) => base > fromBase);
      toBase = openAfterBase || null;
    }
    if (Number.isInteger(toBase) && (toBase > fromBase || out)) {
      transitions.push({ id: id || `runner-${fromBase}`, role: "runner", fromBase, toBase, out });
    }
  }

  const hitterId = String(event.hitterId ?? "");
  const recordedBatterBase = hitterId ? afterIds.indexOf(hitterId) + 1 : 0;
  const caughtOut = gamecastCaughtBattedOut(event);
  let batterTarget = recordedBatterBase;
  let batterOut = false;
  if (!batterTarget && event.outcome === "homeRun") batterTarget = 4;
  if (!batterTarget && !caughtOut && (["out", "sacrificeBunt"].includes(event.outcome) || event.doublePlay)) {
    batterTarget = 1;
    batterOut = true;
  }
  if (!batterTarget && !caughtOut) batterTarget = gamecastAdvanceCount(event.outcome);
  if (batterTarget > 0 && !caughtOut) {
    transitions.push({ id: hitterId || "batter", role: "batter", fromBase: 0, toBase: batterTarget, out: batterOut });
  }
  return transitions;
}

export function gamecastRunnerTransitionTiming(event, transition) {
  const durationMs = Math.max(1, Number(event?.gamecastDurationMs) || getGamecast2PlayDurationMs(event));
  const distance = Math.max(1, Number(transition?.toBase ?? 0) - Number(transition?.fromBase ?? 0));
  const tagUp = transition?.role === "runner" && gamecastCaughtBattedOut(event);
  const authoredStartMs = transition?.role === "runner"
    ? getGamecast2RunnerStartMs(event, { tagUp })
    : null;
  const hasAuthoredStart = authoredStartMs !== null
    && authoredStartMs !== undefined
    && Number.isFinite(Number(authoredStartMs));
  const fallbackStartT = tagUp ? gamecastFieldingCatchProgress(event) + 0.015 : gamecastRunnerMoveStart(event);
  const startT = Math.max(0, Math.min(
    0.975,
    hasAuthoredStart ? Number(authoredStartMs) / durationMs : fallbackStartT
  ));
  const slide = event?.outcome !== "homeRun"
    && (distance >= 2 || (transition?.role === "runner" && Boolean(transition?.out)));
  if (transition?.role === "batter" && event?.outcome === "homeRun") {
    const endT = Math.min(0.985, Math.max(startT + 0.01, 0.94));
    return {
      startT,
      endT,
      durationMs: Math.max(1, (endT - startT) * durationMs),
      distance,
      slide: false,
      tagUp: false
    };
  }
  const motionMs = distance * GAMECAST_RUN_MS_PER_BASE + (slide ? GAMECAST_SLIDE_MS : 0);
  return {
    startT,
    endT: Math.min(0.985, startT + motionMs / durationMs),
    durationMs: motionMs,
    distance,
    slide,
    tagUp
  };
}

function gamecastCaughtBattedOut(event) {
  if (event?.outcome !== "out" || event?.doublePlay) return false;
  const battedBallType = String(event?.battedBallType ?? "").toLowerCase();
  return battedBallType.includes("fly") || battedBallType.includes("line");
}

function makeRunnerSprite(path, eased, color, trailColor, moveT, role = "runner", options = {}) {
  const position = positionAlongPath(path, eased);
  const previousPosition = positionAlongPath(path, Math.max(0, eased - 0.05));
  const facing = position.x >= previousPosition.x ? 1 : -1;
  const stride = Math.floor(moveT * (options.pose === "walk" ? 4 : 12));
  const sliding = options.allowSlide === true && options.pose === "run" && moveT > 0.82;
  const pose = sliding ? "slide" : (options.pose ?? "run");
  const bob = pose === "walk" ? (stride % 2 ? 0 : -1) : (stride % 2 ? -1 : 0);
  position.y += sliding ? gamecastSize(2) : bob;
  return {
    position,
    dust: pose === "walk" || options.trail === false
      ? []
      : [
          positionAlongPath(path, Math.max(0, eased - 0.07)),
          positionAlongPath(path, Math.max(0, eased - 0.15))
        ],
    trail: options.trail === false
      ? []
      : [
          positionAlongPath(path, Math.max(0, eased - 0.12)),
          positionAlongPath(path, Math.max(0, eased - 0.24))
        ],
    color,
    jerseyColor: options.jerseyColor,
    jerseyShadow: options.jerseyShadow,
    accentColor: options.accentColor,
    uniformNumber: options.uniformNumber,
    trailColor,
    runFrame: pose === "slide" || moveT > 0.92 ? 2 : stride % (pose === "run" ? 4 : 2),
    squash: pose === "walk" || pose === "slide" ? false : moveT > 0.92,
    pose,
    animationKey: pose === "slide" ? "slide" : pose,
    animationT: pose === "run" ? moveT * 2.4 : moveT,
    animationLoop: pose === "run" || pose === "walk",
    facing,
    role,
    ...gamecastAbilitySpriteFields(options.ability, role === "batter")
  };
}

export function buildBallSprite(event, progress) {
  const bases = gamecastBasePositions();
  if (isGamecastStealEvent(event)) {
    const stealThrow = gamecastStealThrowState(event, progress);
    if (!stealThrow) return null;
    return withGamecastBallVector(stealThrow.current, stealThrow.previous, {
      kind: "throw",
      size: gamecastBallDisplaySize("throw", event),
      opacity: 1
    });
  }
  const pitchEnd = gamecastPitchEnd(event);
  if (event.outcome === "walk") {
    const pitch = gamecastWalkPitchState(progress);
    if (!pitch?.released) return null;
    const target = pitchTargetForEvent(event, bases);
    const currentT = easeOutCubic(pitch.ballT);
    const previousT = easeOutCubic(Math.max(0, pitch.ballT - 0.08));
    const current = {
      x: Math.round(lerp(bases.mound.x, target.x, currentT)),
      y: Math.round(lerp(bases.mound.y, target.y, currentT))
    };
    const previous = {
      x: Math.round(lerp(bases.mound.x, target.x, previousT)),
      y: Math.round(lerp(bases.mound.y, target.y, previousT))
    };
    return withGamecastBallVector(current, previous, {
      kind: "pitch",
      pitchNumber: pitch.pitchNumber,
      size: gamecastBallDisplaySize("pitch", event),
      opacity: 1
    });
  }
  if (progress < pitchEnd) {
    const t = Math.max(0, Math.min(1, progress / pitchEnd));
    const target = pitchTargetForEvent(event, bases);
    const current = {
      x: Math.round(lerp(bases.mound.x, target.x, easeOutCubic(t))),
      y: Math.round(lerp(bases.mound.y, target.y, easeOutCubic(t)))
    };
    const previousT = Math.max(0, t - 0.08);
    const previous = {
      x: Math.round(lerp(bases.mound.x, target.x, easeOutCubic(previousT))),
      y: Math.round(lerp(bases.mound.y, target.y, easeOutCubic(previousT)))
    };
    return withGamecastBallVector(current, previous, { kind: "pitch", size: gamecastBallDisplaySize("pitch", event), opacity: 1 });
  }
  if (event.outcome === "strikeout") return progress < gamecastResultRevealProgress(event) - 0.04 ? { ...pitchTargetForEvent(event, bases), kind: "pitch", size: gamecastBallDisplaySize("held", event), opacity: 1 } : null;
  const flightEnd = gamecastBallFlightEnd(event);
  if (!isBattedBallOutcome(event.outcome) || progress >= flightEnd) return null;
  const t = Math.max(0, Math.min(1, (progress - pitchEnd) / Math.max(0.01, flightEnd - pitchEnd)));
  const current = battedBallPoint(event, t);
  const previous = battedBallPoint(event, Math.max(0, t - 0.06));
  return withGamecastBallVector(current, previous, {
    kind: "batted",
    size: gamecastBallDisplaySize("batted", event),
    opacity: 1
  });
}

export function gamecastBallDisplaySize(phase, event = null) {
  if (phase === "throw") return 2.2;
  if (phase === "held") return 2.1;
  if (phase === "batted") {
    if (event?.outcome === "homeRun") return 3.2;
    const battedBallType = String(event?.battedBallType ?? "").toLowerCase();
    if (battedBallType.includes("fly") || battedBallType.includes("line")) return 2.7;
    return 2.4;
  }
  return 2.2;
}

function buildBallTrail(event, progress) {
  if (isGamecastStealEvent(event)) {
    const stealThrow = gamecastStealThrowState(event, progress);
    if (!stealThrow) return [];
    return [0.07, 0.13, 0.19].map((offset, index) => ({
      ...gamecastStealBallPoint(stealThrow.from, stealThrow.to, Math.max(0, stealThrow.rawT - offset)),
      size: Math.max(1.1, 2 - index * 0.25),
      opacity: Math.max(0.18, 0.64 - index * 0.14),
      color: index % 2 ? "#fff8d7" : "#fffefb"
    }));
  }
  const pitchEnd = gamecastPitchEnd(event);
  const bases = gamecastBasePositions();
  if (event.outcome === "walk") {
    const pitch = gamecastWalkPitchState(progress);
    if (!pitch?.released) return [];
    const target = pitchTargetForEvent(event, bases);
    return [0.04, 0.09, 0.15].map((offset, index) => {
      const t = easeOutCubic(Math.max(0, pitch.ballT - offset));
      return {
        x: Math.round(lerp(bases.mound.x, target.x, t)),
        y: Math.round(lerp(bases.mound.y, target.y, t)),
        size: Math.max(1.2, 2.2 - index * 0.28),
        opacity: Math.max(0.2, 0.7 - index * 0.14),
        color: index % 2 ? "#fff8d7" : "#fffefb"
      };
    });
  }
  if (progress < pitchEnd && progress > 0.06) {
    const target = pitchTargetForEvent(event, bases);
    const points = [];
    const t = Math.max(0, Math.min(1, progress / pitchEnd));
    for (const [index, offset] of [0.04, 0.09, 0.15].entries()) {
      const p = Math.max(0, t - offset / Math.max(0.01, pitchEnd));
      points.push({
        x: Math.round(lerp(bases.mound.x, target.x, easeOutCubic(p))),
        y: Math.round(lerp(bases.mound.y, target.y, easeOutCubic(p))),
        size: Math.max(1.2, 2.2 - index * 0.28),
        opacity: Math.max(0.2, 0.7 - index * 0.14),
        color: index % 2 ? "#fff8d7" : "#fffefb"
      });
    }
    return points;
  }
  const flightEnd = gamecastBallFlightEnd(event);
  if (!isBattedBallOutcome(event.outcome) || progress < pitchEnd + 0.05 || progress >= flightEnd) return [];
  const points = [];
  for (const [index, offset] of [0.045, 0.09, 0.145, 0.21, 0.28].entries()) {
    const p = Math.max(pitchEnd, progress - offset);
    const t = Math.max(0, Math.min(1, (p - pitchEnd) / Math.max(0.01, flightEnd - pitchEnd)));
    const point = battedBallPoint(event, t);
    points.push({
      ...point,
      size: Math.max(1.2, 2.7 - index * 0.28),
      opacity: Math.max(0.18, 0.72 - index * 0.14),
      color: event.outcome === "homeRun" ? "#ffb3a6" : index % 2 ? "#fff8d7" : "#fffefb"
    });
  }
  return points;
}

function withGamecastBallVector(current, previous, extra = {}) {
  return {
    ...current,
    ...extra,
    velocityX: Math.round((current.x ?? 0) - (previous.x ?? current.x ?? 0)),
    velocityY: Math.round((current.y ?? 0) - (previous.y ?? current.y ?? 0))
  };
}

function buildGamecastBallShadow(event, progress) {
  const pitchEnd = gamecastPitchEnd(event);
  const flightEnd = gamecastBallFlightEnd(event);
  if (!isBattedBallOutcome(event.outcome) || progress < pitchEnd || progress >= flightEnd) return null;
  const t = Math.max(0, Math.min(1, (progress - pitchEnd) / Math.max(0.01, flightEnd - pitchEnd)));
  const ground = battedBallGroundPoint(event, t);
  const lift = Math.sin(t * Math.PI);
  return {
    x: ground.x,
    y: ground.y + gamecastSize(2),
    width: gamecastSize(event.outcome === "homeRun" ? 7 - lift * 2 : 5 - lift)
  };
}

function buildGamecastContactBurst(event, progress) {
  if (!isBattedBallOutcome(event?.outcome)) return null;
  const pitchEnd = gamecastPitchEnd(event);
  if (progress < pitchEnd + 0.01 || progress > pitchEnd + 0.16) return null;
  const t = (progress - pitchEnd) / 0.16;
  const bases = gamecastBasePositions();
  return {
    x: bases.home.x + gamecastSize(4),
    y: bases.home.y - gamecastSize(8),
    size: gamecastSize((event.outcome === "homeRun" ? 7 : 5) * (1 - Math.abs(t - 0.35)))
  };
}

export function buildGamecastDefenseSprites(event, progress, palette) {
  if (isGamecastStealEvent(event)) return buildGamecastStealDefenseSprites(event, progress, palette);
  const pitchEnd = gamecastPitchEnd(event);
  const sprites = [];
  if (progress < pitchEnd + 0.09) {
    const bases = gamecastBasePositions();
    const walkPitch = event?.outcome === "walk" ? gamecastWalkPitchState(progress) : null;
    const windT = event?.outcome === "walk"
      ? Number(walkPitch?.localT ?? 0)
      : Math.max(0, Math.min(1, progress / Math.max(0.01, pitchEnd)));
    sprites.push({
      position: { x: bases.mound.x, y: bases.mound.y - gamecastSize(4) - (windT > 0.48 && windT < 0.72 ? 1 : 0) },
      color: event.defenseColor ?? palette.defender,
      jerseyColor: event.defenseJerseyColor ?? palette.defenderL,
      jerseyShadow: event.defenseJerseyShadow ?? palette.uniformSh,
      accentColor: event.defenseAccentColor ?? event.defenseColor ?? palette.defender,
      fieldingKey: "P",
      uniformNumber: gamecastProfileUniformNumber(event.pitcherProfile, event.pitcherName, event.pitcherId),
      runFrame: windT > 0.72 ? 1 : 2,
      squash: false,
      pose: windT < 0.48 ? "windup" : "pitch",
      animationKey: "pitch",
      animationT: windT,
      ...gamecastAbilitySpriteFields(event.pitcherAbility, true)
    });
  }
  if (!isBattedBallOutcome(event?.outcome)) return sprites;
  const resultReveal = gamecastResultRevealProgress(event);
  if (progress < pitchEnd + 0.06 || progress > Math.min(0.96, resultReveal + 0.08)) return sprites;

  const battedType = String(event.battedBallType ?? "");
  const ballTarget = battedBallGroundPoint(event, 1);
  const fieldingKey = gamecastFieldingKeyForTarget(event, ballTarget);
  const start = gamecastDefenderStartForTarget(ballTarget, event);
  const catchProgress = gamecastFieldingCatchProgress(event);
  const runStart = Math.max(0.34, pitchEnd + 0.06);
  const isHomeRun = event.outcome === "homeRun";
  const safeFlyHit = gamecastSafeFlyHit(event);
  const safeFlyLanding = safeFlyHit
    ? pitchEnd + (gamecastBallFlightEnd(event) - pitchEnd) * 0.72
    : catchProgress;
  const target = isHomeRun ? gamecastHomeRunFielderSpot(event, ballTarget, fieldingKey) : ballTarget;
  const routeEnd = isHomeRun ? Math.min(catchProgress, gamecastBallFlightEnd(event) - 0.03) : catchProgress;
  const fieldT = Math.max(0, Math.min(1, (progress - runStart) / Math.max(0.01, routeEnd - runStart)));
  const canonicalThrowTarget = gamecastCanonicalThrowTargetKey(event);
  const hasThrow = canonicalThrowTarget === undefined ? !isHomeRun : Boolean(canonicalThrowTarget);
  const pitcherCoversFirst = fieldingKey === "1B"
    && event.outcome === "out"
    && !event.doublePlay
    && (canonicalThrowTarget === "first" || canonicalThrowTarget === undefined);
  const directFirstBaseOut = fieldingKey === "1B"
    && event.outcome === "out"
    && !event.doublePlay
    && !pitcherCoversFirst
    && !hasThrow;
  let position = gamecastClampFielderPosition(fieldingKey, gamecastFielderRoutePoint(start, target, fieldT, fieldingKey, event), event);
  if (directFirstBaseOut && progress > catchProgress) {
    position = gamecastFirstBasemanCoverPosition(event, progress);
  }
  const hardPlay = !isHomeRun && gamecastDifficultFieldingPlay(event, fieldingKey, target, start);
  const throwing = hasThrow && !directFirstBaseOut && progress >= gamecastThrowStartProgress(event) && progress <= gamecastThrowEndProgress(event) && !isHomeRun;
  const impactPose = isHomeRun
    ? progress < routeEnd - 0.02 ? "run" : "watch"
    : directFirstBaseOut
      ? progress > catchProgress + 0.08 ? "field" : progress > catchProgress - 0.04 ? "catch" : "run"
    : safeFlyHit && progress >= safeFlyLanding - 0.02 && progress < catchProgress - 0.03
      ? "dive"
      : safeFlyHit && progress >= catchProgress - 0.03 && !throwing
        ? "field"
    : event.outcome === "error" && progress > catchProgress - 0.02 && progress < catchProgress + 0.12
      ? "dive"
      : hardPlay && progress > catchProgress - 0.06 && progress < catchProgress + 0.06
        ? "dive"
        : throwing
          ? "throw"
          : progress > catchProgress - 0.04
            ? "catch"
            : "run";
  const catchBurst = !isHomeRun && ((event.outcome === "out" && progress > catchProgress - 0.02 && progress < catchProgress + 0.12)
    || (event.outcome === "error" && progress > catchProgress - 0.02 && progress < catchProgress + 0.14));
  const defenseAnimation = gamecastDefenseAnimationForPose(impactPose, progress, runStart, routeEnd, fieldT);

  sprites.push({
    position,
    color: event.defenseColor ?? palette.defender,
    jerseyColor: event.defenseJerseyColor ?? palette.defenderL,
    jerseyShadow: event.defenseJerseyShadow ?? palette.uniformSh,
    accentColor: event.defenseAccentColor ?? event.defenseColor ?? palette.defender,
    fieldingKey,
    uniformNumber: gamecastProfileUniformNumber(event.defenderProfile, event.defenderName, event.defenderId || event.fieldingPosition),
    runFrame: Math.floor(fieldT * 12) % 4,
    squash: throwing,
    pose: impactPose,
    animationKey: defenseAnimation.key,
    animationT: defenseAnimation.t,
    animationLoop: defenseAnimation.loop,
    catchBurst,
    facing: target.x >= start.x ? 1 : -1,
    ...gamecastAbilitySpriteFields(gamecastFieldingAbilityForEvent(event, fieldingKey), true)
  });

  if (event.doublePlay) {
    sprites.push(...buildGamecastDoublePlaySprites(event, progress, palette, catchProgress));
  } else if (hasThrow && ["out", "single", "double", "triple", "error"].includes(event.outcome) && progress >= runStart && progress <= resultReveal) {
    const receiver = buildGamecastLegacyThrowReceiverSprite(event, progress, palette, fieldingKey, runStart, catchProgress);
    if (receiver) sprites.push(receiver);
  }

  return sprites;
}

function gamecastDefenseAnimationForPose(pose, progress, runStart, catchProgress, fieldT) {
  if (pose === "run") return { key: "run", t: fieldT * 1.8, loop: true };
  if (pose === "catch") {
    return {
      key: "catch",
      t: Math.max(0, Math.min(1, (progress - (catchProgress - 0.05)) / 0.18)),
      loop: false
    };
  }
  if (pose === "dive") {
    return {
      key: "dive",
      t: Math.max(0, Math.min(1, (progress - (catchProgress - 0.08)) / 0.24)),
      loop: false
    };
  }
  if (pose === "throw") {
    return {
      key: "throw",
      t: Math.max(0, Math.min(1, (progress - (catchProgress + 0.06)) / 0.24)),
      loop: false
    };
  }
  return { key: null, t: 0, loop: false };
}

function gamecastHomeRunFielderSpot(event, ballTarget, key) {
  const logicalX = Math.max(16, Math.min(104, (Number(ballTarget?.x ?? gamecastX(60)) / GAMECAST_PIXEL_W) * 120));
  const sideLean = key === "LF" ? -2.6 : key === "RF" ? 2.6 : 0;
  const wallY = gamecastOutfieldWallY(gamecastBallparkProfileForEvent(event), logicalX);
  return gamecastPlayableFieldPoint(event, logicalX + sideLean, wallY + 8.2 + Math.abs(gamecastEventNoise(event, 82)) * 2.4, { warningTrack: true });
}

function gamecastFielderRoutePoint(start, target, t, key, event) {
  const eased = easeInOutCubic(Math.max(0, Math.min(1, t)));
  const outfield = ["LF", "CF", "RF"].includes(key);
  const control = event?.outcome === "homeRun" && outfield
    ? {
        x: (start.x + target.x) / 2 + gamecastSize(gamecastEventNoise(event, 71) * 2),
        y: (start.y + target.y) / 2 - gamecastSize(1)
      }
    : outfield
      ? {
          x: (start.x + target.x) / 2 + gamecastSize(gamecastEventNoise(event, 71) * 8),
          y: Math.min(start.y, target.y) - gamecastSize(5 + Math.abs(gamecastEventNoise(event, 72)) * 6)
        }
      : {
          x: (start.x + target.x) / 2,
          y: (start.y + target.y) / 2 + gamecastSize(String(event?.battedBallType ?? "") === "groundBall" ? 3 : -3)
        };
  return {
    x: Math.round(quadBezier(start.x, control.x, target.x, eased)),
    y: Math.round(quadBezier(start.y, control.y, target.y, eased))
  };
}

function gamecastClampFielderPosition(key, point, event) {
  const anchor = gamecastFielderLogicalAnchor(key);
  if (!anchor || !point) return point;
  const raw = gamecastLogicalPoint(point);
  const zone = GAMECAST_FIELDER_MOVE_ZONES[key] ?? { x: 16, yTop: 13, yBottom: 13 };
  const profile = gamecastBallparkProfileForEvent(event);
  let x = gamecastClampNumber(raw.x, anchor.x - zone.x, anchor.x + zone.x);
  let y = gamecastClampNumber(raw.y, anchor.y - zone.yTop, anchor.y + zone.yBottom);
  if (["LF", "CF", "RF"].includes(key)) {
    y = Math.max(y, gamecastOutfieldWallY(profile, x) + 4.7);
  }
  x = gamecastClampNumber(x, 4, 116);
  y = gamecastClampNumber(y, 5, 104);
  return { x: gamecastX(x), y: gamecastY(y) };
}

function gamecastFielderLogicalAnchor(key) {
  const fielder = gamecastDefensiveAlignment().find((entry) => entry.key === key);
  return fielder ? gamecastLogicalPoint(fielder.position) : null;
}

function gamecastLogicalPoint(point) {
  return {
    x: (Number(point?.x ?? 0) / GAMECAST_PIXEL_W) * 120,
    y: (Number(point?.y ?? 0) / GAMECAST_PIXEL_H) * 108
  };
}

function gamecastClampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function quadBezier(a, b, c, t) {
  const inv = 1 - t;
  return inv * inv * a + 2 * inv * t * b + t * t * c;
}

function gamecastDifficultFieldingPlay(event, key, target, start) {
  const distance = Math.hypot(target.x - start.x, target.y - start.y) / Math.max(1, gamecastSize(1));
  if (event?.outcome === "error") return true;
  if (String(event?.battedBallType ?? "") === "lineDrive" && distance > 15) return true;
  if (["SS", "2B", "3B"].includes(key) && distance > 18) return true;
  return ["LF", "CF", "RF"].includes(key) && distance > 24 && gamecastEventNoise(event, 73) > 0.12;
}

function gamecastSupportFielderSprite(event, palette, key, position, pose = "field", runFrame = 0) {
  const animationKey = pose === "throw" ? "throw" : pose === "catch" ? "catch" : pose === "run" ? "run" : null;
  const profile = key === "P" ? event?.pitcherProfile : event?.defenseProfilesByPosition?.[key] ?? null;
  return {
    position,
    color: event.defenseColor ?? palette.defender,
    jerseyColor: event.defenseJerseyColor ?? palette.defenderL,
    jerseyShadow: event.defenseJerseyShadow ?? palette.uniformSh,
    accentColor: event.defenseAccentColor ?? event.defenseColor ?? palette.defender,
    fieldingKey: key,
    uniformNumber: gamecastProfileUniformNumber(profile, profile?.name ?? key, profile?.id ?? key),
    runFrame,
    squash: false,
    pose,
    animationKey,
    animationT: pose === "throw" || pose === "catch" ? 0.72 : 0,
    animationLoop: pose === "run",
    ...gamecastAbilitySpriteFields(gamecastFieldingAbilityForEvent(event, key), false)
  };
}

function buildGamecastLegacyThrowReceiverSprite(event, progress, palette, fieldingKey, runStart, catchProgress) {
  const canonicalTarget = gamecastCanonicalThrowTargetKey(event);
  if (canonicalTarget === null) return null;
  const targetBase = canonicalTarget ?? (event?.outcome === "out"
    ? "first"
    : event?.outcome === "triple"
      ? "third"
      : event?.outcome === "double"
        ? "second"
        : "home");
  const receiverKey = gamecastLegacyThrowReceiverKey(event, fieldingKey, targetBase);
  if (!receiverKey || receiverKey === fieldingKey) return null;

  const bases = gamecastBasePositions();
  const base = bases[targetBase];
  const start = gamecastDefensiveAlignment().find((fielder) => fielder.key === receiverKey)?.position;
  if (!base || !start) return null;
  const side = receiverKey === "SS" || receiverKey === "3B" || receiverKey === "P" ? -1 : 1;
  const target = {
    x: base.x + gamecastSize(targetBase === "home" ? 0 : side * 3),
    y: base.y - gamecastSize(targetBase === "home" ? 4 : 1)
  };
  const coverStart = Math.min(catchProgress - 0.04, runStart + 0.03);
  const coverEnd = Math.max(coverStart + 0.12, gamecastThrowStartProgress(event) - 0.025);
  const coverT = easeOutCubic(Math.max(0, Math.min(1, (progress - coverStart) / Math.max(0.01, coverEnd - coverStart))));
  const position = {
    x: Math.round(lerp(start.x, target.x, coverT)),
    y: Math.round(lerp(start.y, target.y, coverT))
  };
  const pose = progress < coverEnd - 0.025 ? "run" : progress <= gamecastThrowEndProgress(event) + 0.06 ? "catch" : "field";
  return gamecastSupportFielderSprite(event, palette, receiverKey, position, pose, Math.floor(coverT * 8) % 4);
}

function gamecastLegacyThrowReceiverKey(event, fieldingKey, targetBase) {
  if (targetBase === "first") return fieldingKey === "1B" ? "P" : "1B";
  if (targetBase === "third") return "3B";
  if (targetBase === "home") return "C";
  if (targetBase !== "second") return null;
  if (fieldingKey === "SS") return "2B";
  if (fieldingKey === "2B") return "SS";
  return gamecastEventNoise(event, 91) >= 0 ? "SS" : "2B";
}

function buildGamecastStealDefenseSprites(event, progress, palette) {
  const timing = gamecastStealThrowTiming(event);
  const bases = gamecastBasePositions();
  const plate = gamecastHomePlateCluster();
  const targetBase = timing.transition.toBase;
  const targetKey = targetBase === 1
    ? "1B"
    : targetBase === 2
      ? (gamecastEventNoise(event, 89) >= 0 ? "SS" : "2B")
      : targetBase === 3 ? "3B" : "C";
  const sprites = [];

  if (targetBase === 4) {
    const pitcherPose = progress >= timing.startT && progress <= timing.endT ? "throw" : "field";
    sprites.push(gamecastSupportFielderSprite(event, palette, "P", {
      x: bases.mound.x,
      y: bases.mound.y - gamecastSize(4)
    }, pitcherPose, 1));
    sprites.push(gamecastSupportFielderSprite(event, palette, "C", plate.catcher,
      progress >= timing.endT - 0.06 ? "catch" : "catcher", 1));
    return sprites;
  }

  const catcherPose = progress >= timing.startT - 0.04 && progress <= timing.endT
    ? "throw"
    : "catcher";
  sprites.push(gamecastSupportFielderSprite(event, palette, "C", plate.catcher, catcherPose, 1));

  const start = gamecastDefensiveAlignment().find((fielder) => fielder.key === targetKey)?.position
    ?? gamecastBasePoint(targetBase, bases);
  const base = gamecastBasePoint(targetBase, bases);
  const target = {
    x: base.x + gamecastSize(targetKey === "SS" || targetKey === "3B" ? -3 : 3),
    y: base.y - gamecastSize(1)
  };
  const coverStart = Math.max(0.08, timing.startT - 0.24);
  const coverEnd = Math.max(coverStart + 0.1, timing.endT - 0.035);
  const coverT = easeOutCubic(Math.max(0, Math.min(1, (progress - coverStart) / Math.max(0.01, coverEnd - coverStart))));
  const position = {
    x: Math.round(lerp(start.x, target.x, coverT)),
    y: Math.round(lerp(start.y, target.y, coverT))
  };
  const receiverPose = progress < coverEnd - 0.035
    ? "run"
    : progress <= timing.endT + 0.08 ? "catch" : "field";
  sprites.push(gamecastSupportFielderSprite(event, palette, targetKey, position, receiverPose, Math.floor(coverT * 8) % 4));
  return sprites;
}

function buildGamecastDoublePlaySprites(event, progress, palette, catchProgress) {
  const bases = gamecastBasePositions();
  const leadKey = normalizeFieldingPosition(event.fieldingPosition);
  const pivotKey = leadKey === "SS" ? "2B" : "SS";
  const pivotStart = gamecastDefensiveAlignment().find((fielder) => fielder.key === pivotKey)?.position ?? bases.second;
  const pivotT = Math.max(0, Math.min(1, (progress - catchProgress) / 0.2));
  const pivotTargetX = bases.second.x + gamecastSize(pivotKey === "SS" ? -4 : 4);
  const pivotPosition = {
    x: Math.round(lerp(pivotStart.x, pivotTargetX, easeOutCubic(pivotT))),
    y: Math.round(lerp(pivotStart.y, bases.second.y - gamecastSize(1), easeOutCubic(pivotT)))
  };
  const firstT = Math.max(0, Math.min(1, (progress - catchProgress - 0.15) / 0.22));
  const sprites = [
    gamecastSupportFielderSprite(event, palette, pivotKey, pivotPosition, progress > catchProgress + 0.12 ? "throw" : "catch", Math.floor(pivotT * 4) % 4)
  ];
  if (leadKey !== "1B") {
    sprites.push(gamecastSupportFielderSprite(event, palette, "1B", {
      x: Math.round(lerp(gamecastX(83), bases.first.x - gamecastSize(5), easeOutCubic(firstT))),
      y: Math.round(lerp(gamecastY(70), bases.first.y - gamecastSize(2), easeOutCubic(firstT)))
    }, progress > catchProgress + 0.28 ? "catch" : "field", 1));
  }
  return sprites;
}

export function buildGamecastThrowLines(event, progress) {
  if (isGamecastStealEvent(event)) {
    const stealThrow = gamecastStealThrowState(event, progress);
    if (!stealThrow) return [];
    const armScore = gamecastThrowArmScore(event, "C");
    return [{
      from: stealThrow.from,
      to: stealThrow.to,
      t: stealThrow.rawT,
      opacity: 1 - Math.max(0, stealThrow.rawT - 0.76) / 0.24,
      armScore,
      throwClass: armScore >= 150 ? "strong" : armScore <= 75 ? "weak" : "average"
    }];
  }
  if (!isBattedBallOutcome(event?.outcome)) return [];
  if (!["out", "error", "single", "double", "triple"].includes(event.outcome)) return [];
  const canonicalThrowTarget = gamecastCanonicalThrowTargetKey(event);
  if (canonicalThrowTarget === null) return [];
  const throwTiming = gamecastLegacyThrowTiming(event);
  const startProgress = throwTiming.startT;
  const endProgress = throwTiming.endT;
  if (progress < startProgress || progress > endProgress) return [];

  const target = battedBallGroundPoint(event, 1);
  const bases = gamecastBasePositions();
  const fieldingKey = gamecastFieldingKeyForTarget(event, target);
  const from = target;
  const rawT = Math.max(0, Math.min(1, (progress - startProgress) / Math.max(0.01, endProgress - startProgress)));
  if (event.doublePlay) {
    const split = 0.48;
    if (rawT <= split) {
      const localT = rawT / split;
      return [{ from, to: bases.second, t: localT, opacity: 1, armScore: throwTiming.armScore, throwClass: throwTiming.throwClass }];
    }
    const localRaw = (rawT - split) / (1 - split);
    return [{
      from: bases.second,
      to: bases.first,
      t: localRaw,
      armScore: throwTiming.armScore,
      throwClass: throwTiming.throwClass,
      opacity: 1 - Math.max(0, localRaw - 0.72) / 0.28
    }];
  }
  const throwTarget = canonicalThrowTarget
    ? bases[canonicalThrowTarget]
    : event.outcome === "out"
      ? bases.first
      : event.outcome === "triple"
        ? bases.third
      : event.outcome === "double"
        ? bases.second
        : bases.home;
  if (!throwTarget) return [];
  return [{
    from,
    to: throwTarget,
    t: rawT,
    armScore: throwTiming.armScore,
    throwClass: throwTiming.throwClass,
    opacity: 1 - Math.max(0, rawT - 0.7) / 0.3
  }];
}

function gamecastCanonicalThrowTargetKey(event) {
  if (!event || !Object.prototype.hasOwnProperty.call(event, "defensiveThrowTarget")) return undefined;
  const key = String(event.defensiveThrowTarget ?? "").trim().toLowerCase();
  return ["first", "second", "third", "home"].includes(key) ? key : null;
}

function gamecastFirstBasemanCoverPosition(event, progress) {
  const catchProgress = gamecastFieldingCatchProgress(event);
  const fieldSpot = gamecastClampFielderPosition("1B", battedBallGroundPoint(event, 1), event);
  const firstBase = gamecastBasePositions().first;
  const coverT = easeOutCubic(Math.max(0, Math.min(1, (progress - catchProgress) / 0.18)));
  return {
    x: Math.round(lerp(fieldSpot.x, firstBase.x - gamecastSize(5), coverT)),
    y: Math.round(lerp(fieldSpot.y, firstBase.y - gamecastSize(2), coverT))
  };
}

function gamecastPitchEnd(event) {
  if (event?.outcome === "walk" || event?.outcome === "strikeout") return 0.2;
  return 0.3;
}

function gamecastRunnerMoveStart(event) {
  if (gamecastCaughtBattedOut(event)) return gamecastFieldingCatchProgress(event) + 0.015;
  const durationMs = Math.max(1, Number(event?.gamecastDurationMs) || getGamecast2PlayDurationMs(event));
  const actionDurationMs = gamecastLegacyActionDurationMs(event);
  const actionStart = 0.27;
  return actionStart * actionDurationMs / durationMs;
}

function gamecastRunnerMoveEnd(event) {
  const transitions = gamecastRunnerTransitions(event);
  if (transitions.length === 0) return gamecastRunnerMoveStart(event);
  return Math.max(...transitions.map((transition) => gamecastRunnerTransitionTiming(event, transition).endT));
}

function gamecastBallFlightEnd(event) {
  if (event?.outcome === "homeRun") return 0.88;
  const arrival = gamecastNonHomerCatchProgress(event);
  return gamecastSafeFlyHit(event) ? Math.min(0.9, arrival + 0.12) : arrival;
}

function gamecastFieldingCatchProgress(event) {
  if (event?.outcome === "homeRun") return 0.78;
  return gamecastBallFlightEnd(event);
}

function gamecastNonHomerCatchProgress(event) {
  const battedType = String(event?.battedBallType ?? "").toLowerCase();
  const position = String(event?.fieldingPosition ?? "").toUpperCase();
  const outfield = ["LF", "CF", "RF", "OF"].includes(position);
  const baseProgress = battedType.includes("ground")
    ? 0.5
    : battedType.includes("line")
      ? 0.54 + (outfield ? 0.02 : 0)
      : battedType.includes("fly")
        ? 0.57 + (outfield ? 0.02 : 0)
        : event?.outcome === "out" ? 0.56 : 0.54;
  const durationMs = Math.max(1, Number(event?.gamecastDurationMs) || getGamecast2PlayDurationMs(event));
  return Math.min(0.82, baseProgress * gamecastLegacyActionDurationMs(event) / durationMs);
}

function gamecastLegacyActionDurationMs(event) {
  if (event?.outcome === "walk") return 4800;
  if (event?.outcome === "homeRun") return 5600;
  if (event?.outcome === "triple") return 6400;
  if (event?.outcome === "double") return 4400;
  if (event?.doublePlay) return 4300;
  if (event?.outcome === "sacrificeBunt") return 3500;
  if (event?.outcome === "out" && String(event?.battedBallType ?? "").toLowerCase().includes("ground")) return 3500;
  if (["single", "error", "out"].includes(event?.outcome)) return 3900;
  return 3400;
}

function gamecastThrowStartProgress(event) {
  return gamecastLegacyThrowTiming(event).startT;
}

function gamecastThrowEndProgress(event) {
  return gamecastLegacyThrowTiming(event).endT;
}

function gamecastLegacyThrowTiming(event) {
  if (event?.outcome === "homeRun") return { startT: 1, endT: 1, armScore: 100, throwClass: "average" };
  const durationMs = Math.max(1, Number(event?.gamecastDurationMs) || getGamecast2PlayDurationMs(event));
  const targetKey = gamecastCanonicalThrowTargetKey(event);
  if (targetKey === null) return { startT: 1, endT: 1, armScore: 100, throwClass: "average" };
  const fieldingKey = gamecastFieldingKeyForTarget(event, battedBallGroundPoint(event, 1));
  const armScore = gamecastThrowArmScore(event, fieldingKey);
  const armT = Math.max(0, Math.min(1, (armScore - 20) / 180));
  const bases = gamecastBasePositions();
  const from = battedBallGroundPoint(event, 1);
  const effectiveTarget = targetKey === undefined
    ? event?.outcome === "out" ? "first" : event?.outcome === "triple" ? "third" : event?.outcome === "double" ? "second" : "home"
    : targetKey;
  const target = bases[effectiveTarget] ?? bases.first;
  const distance = Math.hypot(Number(target?.x ?? 0) - Number(from?.x ?? 0), Number(target?.y ?? 0) - Number(from?.y ?? 0));
  const pixelsPerSecond = 380 + armT * 290;
  const flightMs = Math.max(170, Math.min(620, distance / pixelsPerSecond * 1000));
  const gatherMs = 190 - armT * 40;
  let startT = Math.min(0.94, gamecastFieldingCatchProgress(event) + gatherMs / durationMs);
  let endT = startT + flightMs / durationMs;
  const targetIndex = { first: 1, second: 2, third: 3, home: 4 }[effectiveTarget] ?? 0;
  const transitions = gamecastRunnerTransitions(event)
    .filter((transition) => Number(transition.toBase) === targetIndex)
    .map((transition) => ({ transition, timing: gamecastRunnerTransitionTiming(event, transition) }));
  const movement = transitions.find(({ transition }) => transition.out)
    ?? transitions.sort((a, b) => b.timing.endT - a.timing.endT)[0]
    ?? null;
  if (movement?.transition.out) endT = Math.min(endT, movement.timing.endT - 0.015);
  else if (movement) endT = Math.max(endT, movement.timing.endT + 0.015);
  endT = Math.min(0.985, endT);
  startT = Math.min(startT, endT - 0.025);
  return {
    startT: Math.max(gamecastFieldingCatchProgress(event) + 0.01, startT),
    endT,
    armScore,
    throwClass: armScore >= 150 ? "strong" : armScore <= 75 ? "weak" : "average"
  };
}

function gamecastThrowArmScore(event, key) {
  const fieldingKey = normalizeFieldingPosition(key);
  const activeKey = normalizeFieldingPosition(event?.fieldingPosition);
  const profile = fieldingKey === "P"
    ? event?.pitcherProfile
    : fieldingKey === activeKey && event?.defenderProfile
      ? event.defenderProfile
      : event?.defenseProfilesByPosition?.[fieldingKey];
  let score = Number(profile?.arm);
  if (Number.isFinite(score) && score > 0 && score <= 20) score *= 10;
  if (!Number.isFinite(score) || score <= 0) score = Number(profile?.fielding ?? profile?.ovr ?? 100);
  return Math.max(20, Math.min(200, Math.round(Number(score) || 100)));
}

function gamecastResultRevealProgress(event) {
  if (!event) return 0.82;
  let baseReveal = 0.82;
  if (event.outcome === "homeRun") baseReveal = 0.97;
  else if (event.outcome === "triple") baseReveal = 0.95;
  else if (event.outcome === "double") baseReveal = 0.92;
  else if (event.outcome === "single") baseReveal = 0.87;
  else if (event.outcome === "error") baseReveal = 0.89;
  else if (event.outcome === "walk") baseReveal = 0.62;
  else if (event.outcome === "strikeout") baseReveal = 0.46;
  else if (event.doublePlay) baseReveal = 0.8;
  if (event.outcome === "out") {
    const battedBallType = String(event.battedBallType ?? "").toLowerCase();
    baseReveal = battedBallType.includes("fly") || battedBallType.includes("line") ? 0.85 : 0.75;
  }
  const runnerEnd = gamecastRunnerMoveEnd(event);
  return Math.min(0.985, Math.max(baseReveal, runnerEnd + (runnerEnd > 0 ? 0.01 : 0)));
}

function gamecastScoreRevealProgress(event) {
  if (!event || Number(event.runs ?? 0) <= 0) return gamecastResultRevealProgress(event);
  if (event.outcome === "homeRun") return 0.94;
  return Math.max(gamecastResultRevealProgress(event), gamecastRunnerMoveEnd(event));
}

function gamecastFrameResultRevealed(frame) {
  if (!frame?.event) return false;
  if (frame.done || frame.resultRevealed) return true;
  return Number(frame.progress ?? 0) >= gamecastResultRevealProgress(frame.event);
}

function buildGamecastCamera(event, progress) {
  if (event?.outcome !== "homeRun") return null;
  const start = gamecastPitchEnd(event) + 0.08;
  const end = gamecastScoreRevealProgress(event);
  if (progress < start || progress > end) return null;
  const t = Math.max(0, Math.min(1, (progress - start) / Math.max(0.01, end - start)));
  const flightEnd = gamecastBallFlightEnd(event);
  const ballT = Math.max(0, Math.min(1, (Math.min(progress, flightEnd) - gamecastPitchEnd(event)) / Math.max(0.01, flightEnd - gamecastPitchEnd(event))));
  const ball = battedBallPoint(event, ballT);
  const bases = gamecastBasePositions();
  const runnerFocus = t > 0.72
    ? { x: bases.home.x, y: bases.home.y - gamecastSize(7) }
    : ball;
  return {
    x: runnerFocus.x,
    y: runnerFocus.y,
    zoom: 1 + Math.sin(t * Math.PI) * 0.1
  };
}

function pitchTargetForEvent(event, bases) {
  if (event?.outcome === "walk") return { x: bases.home.x + gamecastSize(12), y: bases.home.y - gamecastSize(7) };
  if (event?.outcome === "strikeout") return { x: bases.home.x - gamecastSize(6), y: bases.home.y - gamecastSize(2) };
  return { x: bases.home.x + gamecastSize(2), y: bases.home.y - gamecastSize(6) };
}

function isBattedBallOutcome(outcome) {
  return ["single", "double", "triple", "homeRun", "error", "out", "sacrificeBunt"].includes(outcome);
}

function gamecastSafeFlyHit(event) {
  return ["single", "double", "triple"].includes(event?.outcome)
    && String(event?.battedBallType ?? "").toLowerCase().includes("fly");
}

export function battedBallPoint(event, t) {
  const bases = gamecastBasePositions();
  const start = { x: bases.home.x + gamecastSize(2), y: bases.home.y - gamecastSize(7) };
  const target = battedBallTarget(event);
  const normalized = Math.max(0, Math.min(1, Number(t) || 0));
  if (gamecastSafeFlyHit(event)) {
    const landingT = 0.72;
    const landing = {
      x: Math.round(lerp(start.x, target.x, 0.88)),
      y: Math.round(lerp(start.y, target.y, 0.88))
    };
    if (normalized <= landingT) {
      const localT = normalized / landingT;
      const eased = easeOutCubic(localT);
      const lift = battedBallLift(event) * Math.sin(localT * Math.PI);
      return {
        x: Math.round(lerp(start.x, landing.x, eased)),
        y: Math.round(lerp(start.y, landing.y, eased) - lift)
      };
    }
    const bounceT = (normalized - landingT) / (1 - landingT);
    const eased = easeOutCubic(bounceT);
    const bounceLift = Math.abs(Math.sin(bounceT * Math.PI * 2)) * gamecastSize(3) * (1 - bounceT * 0.68);
    return {
      x: Math.round(lerp(landing.x, target.x, eased)),
      y: Math.round(lerp(landing.y, target.y, eased) - bounceLift)
    };
  }
  const flightTarget = gamecastCaughtBattedOut(event)
    ? gamecastCaughtBallGlovePoint(event, target)
    : target;
  const eased = easeOutCubic(normalized);
  const lift = battedBallLift(event) * Math.sin(normalized * Math.PI);
  return {
    x: Math.round(lerp(start.x, flightTarget.x, eased)),
    y: Math.round(lerp(start.y, flightTarget.y, eased) - lift)
  };
}

function gamecastCaughtBallGlovePoint(event, groundTarget) {
  const type = String(event?.battedBallType ?? "").toLowerCase();
  const fly = type.includes("fly");
  return {
    // Legacy player sprites are rooted at their feet. Finish at the drawn
    // glove instead of the ground anchor so a caught ball never reads as a
    // one-hop play. Safe fly hits keep their separate landing/bounce branch.
    x: Math.round(Number(groundTarget?.x ?? 0) - gamecastSize(1)),
    y: Math.round(Number(groundTarget?.y ?? 0) - gamecastSize(fly ? 4 : 3))
  };
}

function battedBallGroundPoint(event, t) {
  const bases = gamecastBasePositions();
  const start = { x: bases.home.x + gamecastSize(2), y: bases.home.y - gamecastSize(7) };
  const target = battedBallTarget(event);
  const eased = easeOutCubic(t);
  return {
    x: Math.round(lerp(start.x, target.x, eased)),
    y: Math.round(lerp(start.y, target.y, eased))
  };
}

function battedBallTarget(event) {
  const pullSide = gamecastEventNoise(event, 1) >= 0 ? 1 : -1;
  const xJitter = gamecastEventNoise(event, 2) * 7;
  const yJitter = gamecastEventNoise(event, 3) * 5;
  const fieldPoint = (x, y, options = {}) => gamecastPlayableFieldPoint(event, x, y, options);
  if (event?.outcome === "homeRun") {
    const logicalX = Math.max(14, Math.min(106, (pullSide > 0 ? 102 : 18) + xJitter));
    const wallY = gamecastOutfieldWallY(gamecastBallparkProfileForEvent(event), logicalX);
    return { x: gamecastX(logicalX), y: gamecastY(Math.max(8, wallY - 4 + yJitter * 0.2)) };
  }
  const fieldingSpot = gamecastFieldingSpot(event);
  if (fieldingSpot) {
    const battedType = String(event?.battedBallType ?? "");
    const liftY = battedType === "flyBall" ? -6 : battedType === "groundBall" ? 5 : 0;
    return fieldPoint(fieldingSpot.x + xJitter * 0.35, fieldingSpot.y + liftY + yJitter * 0.35, {
      warningTrack: ["LF", "CF", "RF"].includes(normalizeFieldingPosition(event?.fieldingPosition))
    });
  }
  if (event?.outcome === "triple") return fieldPoint((pullSide > 0 ? 104 : 16) + xJitter, 39 + yJitter, { warningTrack: true });
  if (event?.outcome === "double") return fieldPoint((pullSide > 0 ? 94 : 26) + xJitter, 46 + yJitter, { warningTrack: true });
  if (event?.outcome === "single") return fieldPoint((pullSide > 0 ? 78 : 42) + xJitter, 58 + yJitter);
  if (event?.outcome === "error") return fieldPoint((pullSide > 0 ? 74 : 46) + xJitter * 0.7, 75 + yJitter * 0.5);
  return fieldPoint((pullSide > 0 ? 82 : 38) + xJitter, 48 + yJitter, { warningTrack: true });
}

function battedBallLift(event) {
  const outcome = event?.outcome;
  const battedType = String(event?.battedBallType ?? "");
  if (battedType === "groundBall") return gamecastSize(outcome === "single" || outcome === "error" ? 3 : 5);
  if (battedType === "lineDrive") return gamecastSize(outcome === "homeRun" ? 18 : 10);
  if (battedType === "flyBall") return gamecastSize(outcome === "homeRun" ? 27 : 22);
  if (outcome === "homeRun") return gamecastSize(24);
  if (outcome === "triple" || outcome === "double") return gamecastSize(16);
  if (outcome === "out") return gamecastSize(20);
  if (outcome === "single") return gamecastSize(9);
  return gamecastSize(4);
}

function gamecastDefenderStartForTarget(target, event) {
  const key = gamecastFieldingKeyForTarget(event, target);
  const alignment = gamecastDefensiveAlignment().find((fielder) => fielder.key === key);
  if (alignment) return { ...alignment.position };
  const leftSide = target.x < gamecastX(60);
  const deep = target.y < gamecastY(55);
  const infield = target.y > gamecastY(67);
  if (infield) return { x: leftSide ? gamecastX(46) : gamecastX(73), y: gamecastY(65) };
  if (event?.outcome === "homeRun") return { x: leftSide ? gamecastX(31) : gamecastX(89), y: gamecastY(47) };
  return {
    x: leftSide ? gamecastX(deep ? 31 : 42) : gamecastX(deep ? 89 : 78),
    y: gamecastY(deep ? 47 : 58)
  };
}

function gamecastFieldingKeyForTarget(event, target) {
  const recorded = normalizeFieldingPosition(event?.fieldingPosition);
  if (recorded) return recorded;
  const point = target ?? battedBallGroundPoint(event, 1);
  const leftSide = point.x < gamecastX(60);
  const centerBand = Math.abs(point.x - gamecastX(60)) <= gamecastSize(15);
  const deep = point.y < gamecastY(58);
  const infield = point.y > gamecastY(68);
  if (event?.outcome === "homeRun" || deep) {
    if (centerBand) return "CF";
    return leftSide ? "LF" : "RF";
  }
  if (infield) {
    if (point.x < gamecastX(38)) return "3B";
    if (point.x > gamecastX(84)) return "1B";
    return leftSide ? "SS" : "2B";
  }
  if (centerBand) return "CF";
  return leftSide ? "LF" : "RF";
}

function gamecastFieldingSpot(event) {
  const key = normalizeFieldingPosition(event?.fieldingPosition);
  const spots = {
    P: { x: 60, y: 72 },
    C: { x: 60, y: 98 },
    "1B": { x: 91, y: 74 },
    "2B": { x: 73, y: 62 },
    "3B": { x: 29, y: 74 },
    SS: { x: 46, y: 63 },
    LF: { x: 31, y: 42 },
    CF: { x: 60, y: 29 },
    RF: { x: 89, y: 42 }
  };
  return spots[key] ?? null;
}

function gamecastPlayableFieldPoint(event, logicalX, logicalY, options = {}) {
  const x = Math.max(12, Math.min(108, Number(logicalX) || 60));
  const profile = gamecastBallparkProfileForEvent(event);
  const wallY = gamecastOutfieldWallY(profile, x);
  const playableMinY = wallY + (options.warningTrack ? 4.6 : 7.2);
  const y = Math.max(playableMinY, Math.min(90, Number(logicalY) || 60));
  return { x: gamecastX(x), y: gamecastY(y) };
}

function gamecastBallparkProfileForEvent(event) {
  const id = String(event?.ballparkId ?? "").trim();
  return KBO_GAMECAST_BALLPARKS[id] ?? gamecastBallparkByName(event?.ballparkName) ?? KBO_GAMECAST_BALLPARKS.neutral;
}

function gamecastEventNoise(event, salt = 0) {
  const seed = `${event?.id ?? ""}|${event?.hitterName ?? ""}|${event?.inning ?? ""}|${event?.sequence ?? ""}|${salt}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return (hash % 2001) / 1000 - 1;
}

function gamecastAdvanceCount(outcome) {
  if (outcome === "homeRun") return 4;
  if (outcome === "triple") return 3;
  if (outcome === "double") return 2;
  if (outcome === "single" || outcome === "walk" || outcome === "error") return 1;
  return 0;
}

function gamecastPathBetween(startBase, targetBase) {
  const bases = gamecastBasePositions();
  const points = [bases.home, bases.first, bases.second, bases.third, { x: gamecastX(60), y: gamecastY(102) }];
  const start = Math.max(0, Math.min(4, startBase));
  const target = Math.max(start, Math.min(4, targetBase));
  return points.slice(start, target + 1).map((point) => ({ ...point }));
}

function gamecastBatterPathTo(targetBase) {
  const path = gamecastPathBetween(0, targetBase);
  if (path.length) path[0] = { ...gamecastHomePlateCluster().batter };
  return path;
}

function positionAlongPath(path, t) {
  if (!path.length) return { x: gamecastX(60), y: gamecastY(96) };
  if (path.length === 1) return { ...path[0] };
  const scaled = t * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = path[index];
  const to = path[index + 1];
  return {
    x: Math.round(lerp(from.x, to.x, local)),
    y: Math.round(lerp(from.y, to.y, local))
  };
}

function syncGamecastDom(state, frame) {
  const ratingTokens = gamecastRatingTokensForFrame(frame);
  frame.ratingTokens = ratingTokens;
  if (state?.screen) {
    state.screen.__gamecastDebugFrame = frame;
    state.screen.dataset.gamecastAbilityUnderlays = String(ratingTokens.length);
  }
  if (state.scoreNodes?.[0]) state.scoreNodes[0].textContent = formatNumber(frame.score?.away ?? 0);
  if (state.scoreNodes?.[1]) state.scoreNodes[1].textContent = formatNumber(frame.score?.home ?? 0);
  if (state.nowTitle) state.nowTitle.textContent = frame.done ? "경기 종료" : frame.event ? gamecastNowTitle(frame.event) : "중계 대기";
  if (state.nowDetail) {
    state.nowDetail.textContent = frame.done
      ? `최종 스코어 ${formatNumber(frame.score?.away ?? state.sequence.finalAway ?? 0)}-${formatNumber(frame.score?.home ?? state.sequence.finalHome ?? 0)}`
      : frame.event ? gamecastFrameNowDetail(frame) : "타석 이벤트 대기";
  }
  syncGamecastMatchup(state.matchup, frame.event, frame);
  syncGamecastPlayerLabel(state.playerLabel, frame.done ? null : frame.playerLabel);
  syncGamecastActionBurst(state.actionBurst, frame.done ? null : frame.actionBurst);
  syncGamecastHud(state.hud, frame);
  syncGamecastPauseOverlay(state.pauseOverlay, state, frame);
  syncGamecastFeed(state, frame);
  syncGamecastFpsOverlay(state);
  playGamecastSoundForFrame(state, frame);
  for (const item of state.feedItems ?? []) {
    item.classList.toggle("is-live", Boolean(frame.event?.id && !frame.done && item.dataset.gamecastEventId === frame.event.id));
  }
}

function gamecastRatingTokensForFrame(frame) {
  const actors = [
    ...(frame?.staticDefense ?? []),
    ...(frame?.defenseSprites ?? []),
    ...(frame?.runners ?? []),
    ...(frame?.batter ? [frame.batter] : [])
  ];
  return actors
    .filter((actor) => actor?.abilityGrade && actor?.abilityColor && actor?.position)
    .map((actor) => ({
      playerId: String(actor.playerId ?? ""),
      playerName: String(actor.playerName ?? ""),
      role: String(actor.fieldingKey ?? actor.role ?? ""),
      ovr: Number(actor.abilityScore ?? 0),
      tier: String(actor.abilityGrade),
      color: String(actor.abilityColor),
      x: Number(actor.position.x ?? 0),
      y: Number(actor.position.y ?? 0),
      active: Boolean(actor.abilityActive)
    }));
}

function createGamecastFpsStats() {
  return {
    lastTimestamp: 0,
    lastRenderTimestamp: 0,
    samples: []
  };
}

function syncGamecastFpsOverlay(state) {
  const node = state?.fpsNode;
  const stats = state?.fpsStats;
  if (!node || !stats || typeof performance === "undefined") return;
  const now = performance.now();
  if (stats.lastTimestamp > 0) {
    const delta = now - stats.lastTimestamp;
    if (delta > 0 && delta < 1000) {
      stats.samples.push(delta);
      if (stats.samples.length > 180) stats.samples.shift();
    }
  }
  stats.lastTimestamp = now;
  if (now - stats.lastRenderTimestamp < 250 && stats.samples.length) return;
  stats.lastRenderTimestamp = now;

  if (!stats.samples.length) {
    node.innerHTML = "FPS --<small>1% --ms</small>";
    return;
  }
  const averageDelta = stats.samples.reduce((sum, value) => sum + value, 0) / stats.samples.length;
  const fps = Math.max(0, Math.min(99, Math.round(1000 / Math.max(1, averageDelta))));
  const sorted = [...stats.samples].sort((a, b) => a - b);
  const worstIndex = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99)));
  const worst = sorted[worstIndex] ?? averageDelta;
  node.innerHTML = `FPS ${formatNumber(fps)}<small>1% ${formatNumber(Math.round(worst))}ms</small>`;
}

function playGamecastSoundForFrame(state, frame) {
  if (!state?.soundEnabled || frame?.done || frame?.paused || state.sequence?.mode !== "watch") return;
  const event = frame?.event;
  if (!event?.id || !state.soundMarks) return;
  const progress = Number(frame.progress ?? 0);
  const pitchEnd = gamecastPitchEnd(event);
  const mark = (name) => {
    const key = `${event.id}:${name}`;
    if (state.soundMarks.has(key)) return false;
    state.soundMarks.add(key);
    return true;
  };

  if (isBattedBallOutcome(event.outcome) && progress >= pitchEnd + 0.015 && mark("contact")) {
    playGamecastContactSound(event);
  }
  if (event.outcome === "strikeout" && progress >= gamecastResultRevealProgress(event) && mark("strikeout")) {
    playGamecastStrikeoutSound(event);
  }
  if (event.outcome === "walk" && progress >= gamecastResultRevealProgress(event) && mark("walk")) {
    playGamecastWalkSound(event);
  }
  if ((event.outcome === "out" || event.doublePlay) && progress >= gamecastResultRevealProgress(event) && mark("catch")) {
    playGamecastCatchSound(event);
  }
  if ((Number(event.runs ?? 0) > 0 || event.outcome === "homeRun") && progress >= gamecastScoreRevealProgress(event) && mark("crowd")) {
    playGamecastCrowdSwell(event);
  }
}

function resumeGamecastAudio(allowUnlock = false) {
  if (allowUnlock) gamecastAudioUnlocked = true;
  if (!gamecastAudioUnlocked) return;
  const runtime = getGamecastAudioRuntime();
  if (!runtime) return;
  if (runtime.context.state === "suspended") {
    runtime.context.resume?.().catch?.(() => {});
  }
}

function getGamecastAudioRuntime() {
  if (!gamecastSoundEnabled || !gamecastAudioUnlocked || typeof window === "undefined") return null;
  if (gamecastAudioRuntime) return gamecastAudioRuntime;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  try {
    const context = new AudioContextCtor();
    const master = context.createGain();
    master.gain.value = 0.08;
    master.connect(context.destination);
    gamecastAudioRuntime = { context, master };
    return gamecastAudioRuntime;
  } catch (_error) {
    return null;
  }
}

function playGamecastContactSound(event) {
  const noise = gamecastEventNoise(event, 23);
  if (event.outcome === "homeRun") {
    playGamecastTone({ frequency: 124 + (noise % 18), endFrequency: 58, duration: 0.22, type: "sawtooth", gain: 0.38 });
    playGamecastNoise({ duration: 0.16, gain: 0.18, filter: 1800, seed: noise });
    return;
  }
  if (["single", "double", "triple", "error"].includes(event.outcome)) {
    playGamecastTone({ frequency: 166 + (noise % 24), endFrequency: 96, duration: 0.13, type: "triangle", gain: 0.3 });
    playGamecastNoise({ duration: 0.07, gain: 0.08, filter: 2400, seed: noise });
    return;
  }
  playGamecastTone({ frequency: 118 + (noise % 18), endFrequency: 82, duration: 0.08, type: "square", gain: 0.18 });
}

function playGamecastCatchSound(event) {
  const noise = gamecastEventNoise(event, 29);
  playGamecastTone({ frequency: 92 + (noise % 14), endFrequency: 54, duration: 0.09, type: "triangle", gain: 0.2 });
  playGamecastNoise({ duration: 0.05, gain: 0.07, filter: 1200, seed: noise });
}

function playGamecastStrikeoutSound(event) {
  const noise = gamecastEventNoise(event, 31);
  playGamecastTone({ frequency: 420 + (noise % 60), endFrequency: 300, duration: 0.16, type: "square", gain: 0.12 });
  window.setTimeout(() => playGamecastTone({ frequency: 240, endFrequency: 210, duration: 0.13, type: "triangle", gain: 0.08 }), 95);
}

function playGamecastWalkSound(event) {
  const noise = gamecastEventNoise(event, 37);
  playGamecastTone({ frequency: 260 + (noise % 45), endFrequency: 330, duration: 0.14, type: "sine", gain: 0.1 });
}

function playGamecastCrowdSwell(event) {
  const homer = event?.outcome === "homeRun";
  const runs = Math.max(1, Number(event?.runs ?? 1));
  playGamecastNoise({
    duration: homer ? 1.15 : 0.62 + runs * 0.08,
    gain: homer ? 0.28 : 0.16,
    filter: homer ? 3200 : 2200,
    swell: true,
    seed: gamecastEventNoise(event, 41)
  });
  if (homer) {
    window.setTimeout(() => playGamecastTone({ frequency: 196, endFrequency: 262, duration: 0.34, type: "triangle", gain: 0.09 }), 120);
  }
}

function playGamecastTone({ frequency, endFrequency, duration, type = "sine", gain = 0.12 }) {
  const runtime = getGamecastAudioRuntime();
  if (!runtime) return;
  resumeGamecastAudio();
  const { context, master } = runtime;
  const now = context.currentTime;
  const osc = context.createOscillator();
  const envelope = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, Number(frequency) || 120), now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, Number(endFrequency ?? frequency) || 80), now + Math.max(0.03, duration));
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.04, duration));
  osc.connect(envelope);
  envelope.connect(master);
  osc.start(now);
  osc.stop(now + Math.max(0.05, duration + 0.02));
}

function playGamecastNoise({ duration = 0.12, gain = 0.08, filter = 1800, swell = false, seed = 1 }) {
  const runtime = getGamecastAudioRuntime();
  if (!runtime) return;
  resumeGamecastAudio();
  const { context, master } = runtime;
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  let rng = (Number(seed) || 1) >>> 0;
  for (let index = 0; index < length; index += 1) {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    const value = (rng / 4294967296) * 2 - 1;
    brown = (brown + value * 0.05) / 1.05;
    data[index] = Math.max(-1, Math.min(1, brown * 3.5));
  }
  const now = context.currentTime;
  const source = context.createBufferSource();
  const biquad = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = buffer;
  biquad.type = "lowpass";
  biquad.frequency.value = Math.max(180, Number(filter) || 1800);
  envelope.gain.setValueAtTime(0.0001, now);
  if (swell) {
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + duration * 0.22);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.48), now + duration * 0.72);
  } else {
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.01);
  }
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  source.connect(biquad);
  biquad.connect(envelope);
  envelope.connect(master);
  source.start(now);
  source.stop(now + duration + 0.02);
}

function syncGamecastFeed(state, frame) {
  if (!state.feedList || state.sequence?.mode !== "watch") return;
  const events = state.sequence.events ?? [];
  if (!events.length) return;
  const rawIndex = Math.max(0, Math.min(events.length - 1, Number(frame.eventIndex ?? events.findIndex((event) => event.id === frame.event?.id))));
  const revealCurrent = Boolean(frame.done || frame.bridge || Number(frame.gapProgress ?? 0) > 0 || gamecastFrameResultRevealed(frame));
  const targetIndex = frame.done ? events.length - 1 : (revealCurrent ? rawIndex : rawIndex - 1);
  for (const item of [...(state.feedList.querySelectorAll?.("li[data-gamecast-event-id]") ?? [])]) {
    const itemIndex = Number(item.dataset.gamecastEventIndex ?? -1);
    if (itemIndex > targetIndex) item.remove();
  }
  const existingIds = new Set([...(state.feedList.querySelectorAll?.("li[data-gamecast-event-id]") ?? [])].map((item) => item.dataset.gamecastEventId));
  if (targetIndex < 0) {
    if (!state.feedList.querySelector("[data-gamecast-empty]")) {
      state.feedList.append(createGamecastEmptyFeedItem());
    }
    state.feedItems = [];
    return;
  }
  state.feedList.querySelector("[data-gamecast-empty]")?.remove();
  for (let index = 0; index <= targetIndex; index += 1) {
    const event = events[index];
    if (!event?.id || existingIds.has(event.id)) continue;
    state.feedList.append(createGamecastFeedItem(event, index));
    existingIds.add(event.id);
  }
  state.feedItems = [...state.feedList.querySelectorAll("li[data-gamecast-event-id]")];
  const active = state.feedItems.find((item) => item.dataset.gamecastEventId === frame.event?.id);
  if (active && !frame.done) {
    active.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }
}

function syncGamecastPauseOverlay(overlay, state, frame) {
  if (!overlay?.root) return;
  const hold = normalizeGamecastHold(frame?.hold ?? state?.hold);
  const active = Boolean((frame?.paused || state?.paused || hold) && !frame?.done);
  overlay.root.hidden = !active;
  overlay.root.classList.toggle("is-visible", active);
  overlay.root.dataset.holdType = hold?.type ?? (active ? "manual" : "");
  if (!active) return;

  const copy = gamecastHoldCopy(hold, frame);
  if (overlay.kicker) overlay.kicker.textContent = copy.kicker;
  if (overlay.title) overlay.title.textContent = copy.title;
  if (overlay.detail) overlay.detail.textContent = copy.detail;
  if (overlay.action) overlay.action.textContent = copy.action;
}

function gamecastHoldCopy(hold, frame) {
  const event = frame?.event;
  const situation = event
    ? `${formatNumber(event.inning)}회 ${event.side === "home" ? "말" : "초"} · ${formatNumber(outsInInning(event.outsBefore))}아웃 · ${gamecastBaseSummary(event.basesBefore)}`
    : "중계 대기";
  const matchup = event ? `${event.hitterName || "타자"} vs ${event.pitcherName || "투수"}` : "";
  if (hold?.type === "step") {
    return {
      kicker: "PA CHECK",
      title: hold.title || "타석 확인",
      detail: hold.detail || `${gamecastOutcomeShort(event)} · ${matchup}`,
      action: hold.action || "다음 타석 ▶"
    };
  }
  if (hold?.type === "inning") {
    return {
      kicker: "INNING BREAK",
      title: hold.title || "이닝 교대",
      detail: hold.detail || `${situation} · 다음 공격 준비`,
      action: hold.action || "계속 ▶"
    };
  }
  if (hold?.type === "leverage") {
    return {
      kicker: "KEY MOMENT",
      title: hold.title || "승부처",
      detail: hold.detail || `${situation} · ${matchup}`,
      action: hold.action || "승부 보기 ▶"
    };
  }
  if (hold?.type === "resume") {
    return {
      kicker: "READY",
      title: hold.title || "재개",
      detail: hold.detail || "잠시 후 이어집니다.",
      action: hold.action || "준비 중"
    };
  }
  return {
    kicker: "PAUSE",
    title: hold?.title || "일시정지",
    detail: hold?.detail || `${situation}${matchup ? ` · ${matchup}` : ""}`,
    action: hold?.action || "계속 ▶"
  };
}

function gamecastBaseSummary(bases) {
  const names = ["1루", "2루", "3루"];
  const occupied = (bases ?? []).map((value, index) => value ? names[index] : "").filter(Boolean);
  return occupied.length ? occupied.join("·") : "주자 없음";
}

function gamecastOutcomeShort(event) {
  if (!event) return "결과 대기";
  const runs = Number(event.runs ?? 0);
  const runText = runs > 0 ? ` · ${formatNumber(runs)}득점` : "";
  return `${gamecastMatchupResult(event)}${runText}`;
}

function syncGamecastHud(hud, frame) {
  if (!hud?.root) return;
  const event = frame.done ? null : frame.event;
  hud.root.classList.toggle("is-scoring", Boolean(frame.scoreFlash));
  hud.root.classList.toggle("is-homer", event?.outcome === "homeRun" && gamecastFrameResultRevealed(frame));
  if (hud.inning) hud.inning.textContent = event ? formatGamecastInningCompact(event) : "FINAL";
  if (hud.result) hud.result.textContent = event ? gamecastHudTextForFrame(frame) : "종료";
  if (hud.away) hud.away.textContent = formatNumber(frame.score?.away ?? 0);
  if (hud.home) hud.home.textContent = formatNumber(frame.score?.home ?? 0);

  const count = gamecastPitchCount(frame);
  hud.balls?.forEach((node, index) => node.classList.toggle("is-on", index < count.balls));
  hud.strikes?.forEach((node, index) => node.classList.toggle("is-on", index < count.strikes));
  hud.outs?.forEach((node, index) => node.classList.toggle("is-on", index < Math.min(2, Number(frame.outs ?? 0))));
  hud.bases?.forEach((node) => {
    const baseIndex = Math.max(0, Math.min(2, Number(node.dataset.gamecastBasePip ?? 1) - 1));
    node.classList.toggle("is-on", Boolean(frame.bases?.[baseIndex]));
  });
}

function syncGamecastMatchup(node, event, frame = null) {
  if (!node) return;
  const summary = gamecastMatchupSummary(event, frame);
  const stateNode = node.querySelector("[data-gamecast-matchup-state]");
  const hitterNode = node.querySelector("[data-gamecast-matchup-hitter]");
  const pitcherNode = node.querySelector("[data-gamecast-matchup-pitcher]");
  const resultNode = node.querySelector("[data-gamecast-matchup-result]");
  if (stateNode) stateNode.textContent = summary.state;
  if (hitterNode) hitterNode.textContent = summary.hitter;
  if (pitcherNode) pitcherNode.textContent = summary.pitcher;
  if (resultNode) {
    resultNode.textContent = summary.result;
    resultNode.className = summary.className;
  }
}

function syncGamecastActionBurst(node, burst) {
  if (!node) return;
  if (!burst?.text) {
    node.className = "gamecast-action-burst";
    node.textContent = "";
    node.removeAttribute("data-burst-text");
    node.style.removeProperty("--burst-x");
    node.style.removeProperty("--burst-y");
    node.style.removeProperty("--burst-opacity");
    node.style.removeProperty("--burst-scale-x");
    node.style.removeProperty("--burst-scale-y");
    node.style.removeProperty("--burst-shake-x");
    node.style.removeProperty("--burst-shake-y");
    node.style.removeProperty("--burst-rotate");
    node.style.removeProperty("--burst-impact");
    return;
  }
  node.textContent = burst.text;
  node.setAttribute("data-burst-text", burst.text);
  node.className = `gamecast-action-burst is-visible ${burst.className ?? ""}`.trim();
  node.style.setProperty("--burst-x", `${burst.x}%`);
  node.style.setProperty("--burst-y", `${burst.y}%`);
  node.style.setProperty("--burst-opacity", String(Math.max(0, Math.min(1, burst.opacity ?? 1))));
  node.style.setProperty("--burst-scale-x", String(Math.max(0.4, burst.scaleX ?? 1)));
  node.style.setProperty("--burst-scale-y", String(Math.max(0.4, burst.scaleY ?? burst.scaleX ?? 1)));
  node.style.setProperty("--burst-shake-x", `${burst.shakeX ?? 0}px`);
  node.style.setProperty("--burst-shake-y", `${burst.shakeY ?? 0}px`);
  node.style.setProperty("--burst-rotate", `${Math.max(-8, Math.min(8, burst.rotate ?? 0))}deg`);
  node.style.setProperty("--burst-impact", String(Math.max(0, Math.min(1, burst.impact ?? 0))));
}

function syncGamecastPlayerLabel(labelNode, label) {
  if (!labelNode) return;
  if (!label?.visible || !label.text) {
    labelNode.classList.remove("is-visible", "is-scoring");
    labelNode.textContent = "";
    labelNode.style.removeProperty("--label-x");
    labelNode.style.removeProperty("--label-y");
    labelNode.style.removeProperty("--label-opacity");
    return;
  }
  labelNode.textContent = label.text;
  labelNode.style.setProperty("--label-x", `${(label.x / GAMECAST_PIXEL_W) * 100}%`);
  labelNode.style.setProperty("--label-y", `${(label.y / GAMECAST_PIXEL_H) * 100}%`);
  labelNode.style.setProperty("--label-opacity", String(Math.max(0, Math.min(1, label.opacity ?? 1))));
  labelNode.classList.add("is-visible");
  labelNode.classList.toggle("is-scoring", Boolean(label.scoring));
}

function drawPixelScoreBurst(ctx, palette, frame) {
  const count = Math.max(1, Math.min(4, Number(frame.event?.runs ?? 1)));
  const x = gamecastX(8);
  const y = gamecastY(86);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x + gamecastSize(2), y, gamecastSize(1), gamecastSize(7));
  ctx.fillRect(x, y + gamecastSize(3), gamecastSize(5), gamecastSize(1));
  ctx.fillRect(x + gamecastSize(7), y, gamecastSize(2), gamecastSize(7));
  ctx.fillStyle = palette.homerL;
  ctx.fillRect(x + gamecastSize(2), y + gamecastSize(1), gamecastSize(1), gamecastSize(5));
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(3), gamecastSize(3), gamecastSize(1));
  ctx.fillRect(x + gamecastSize(8), y + gamecastSize(1), gamecastSize(1), gamecastSize(5));
  ctx.fillStyle = palette.runnerL;
  for (let index = 1; index < count; index += 1) {
    ctx.fillRect(x + gamecastSize(11 + index * 2), y + gamecastSize(5), gamecastSize(1), gamecastSize(1));
  }
}

// outlined pixel sprite: cells=[[x,y,color]...] gets a 1px dark silhouette border
function drawPixelSprite(ctx, palette, ox, oy, cells) {
  const set = new Set(cells.map((c) => c[0] + "," + c[1]));
  ctx.fillStyle = palette.outline;
  for (const c of cells) {
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!set.has((c[0] + ax) + "," + (c[1] + ay))) ctx.fillRect(ox + c[0] + ax, oy + c[1] + ay, 1, 1);
    }
  }
  for (const c of cells) { ctx.fillStyle = c[2]; ctx.fillRect(ox + c[0], oy + c[1], 1, 1); }
}

function drawPixelAbilityPlate(ctx, palette, position, options = {}) {
  const grade = String(options.abilityGrade ?? "").toUpperCase();
  const color = normalizeHexColor(options.abilityColor, "");
  if (!grade || !color || !position) return;
  const depth = Number(position.y ?? 0) / Math.max(1, GAMECAST_PIXEL_H);
  const width = (depth < 0.56 ? 10 : depth < 0.76 ? 12 : 14) + (options.abilityActive ? 2 : 0);
  const height = 6;
  const left = Math.round(position.x) - Math.floor(width / 2);
  const top = Math.round(position.y) - 3;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = options.abilityActive ? 0.34 : 0.2;
  ctx.fillStyle = color;
  ctx.fillRect(left - 2, top - 2, width + 4, height + 4);
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.outline;
  ctx.fillRect(left - 1, top - 1, width + 2, height + 2);
  ctx.fillStyle = color;
  ctx.fillRect(left, top, width, height);
  ctx.fillStyle = mixHexColors(options.accentColor ?? palette.defender, palette.outline, 0.74);
  ctx.fillRect(left + 1, top + 1, Math.max(1, width - 2), Math.max(1, height - 2));
  drawPixelGradeGlyph(ctx, grade, left + width - 4, top + 1, color);
  ctx.globalAlpha = previousAlpha;
}

function drawPixelGradeGlyph(ctx, grade, x, y, color) {
  const glyph = {
    S: ["111", "100", "111", "001", "111"],
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["111", "100", "100", "100", "111"],
    D: ["110", "101", "101", "101", "110"]
  }[grade];
  if (!glyph) return;
  ctx.fillStyle = color;
  glyph.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell === "1") ctx.fillRect(x + colIndex, y + rowIndex, 1, 1);
    });
  });
}

// 9x13 outlined chibi player; runFrame 0/1 = stride, 2 = standing
function drawPixelRunner(ctx, palette, position, squash, color, runFrame = 0, options = {}) {
  const S = palette.skin;
  const L = palette.legs;
  const U = options.jerseyColor ?? palette.uniform;
  const US = options.jerseyShadow ?? palette.uniformSh;
  const trim = normalizeHexColor(color, palette.runner);
  const accent = normalizeHexColor(options.accentColor ?? color, trim);
  const ink = options.uniformNumber === undefined ? palette.uniformInk : mixHexColors(palette.uniformInk, accent, 0.18);
  const pose = options.pose ?? "run";
  drawPixelAbilityPlate(ctx, palette, position, { ...options, accentColor: accent });
  if (pose === "slide") {
    drawPixelSlidingRunner(ctx, palette, position, color, options);
    return;
  }
  const ox = Math.round(position.x) - 4;
  const oy = Math.round(position.y) - (squash ? 12 : 13);
  const cells = [
    [2, 0, trim], [3, 0, trim], [4, 0, trim], [5, 0, trim],
    [1, 1, trim], [2, 1, trim], [3, 1, trim], [4, 1, trim], [5, 1, trim], [6, 1, trim],
    [6, 2, trim], [7, 2, trim],
    [2, 2, S], [3, 2, S], [4, 2, S], [5, 2, S],
    [2, 3, S], [3, 3, palette.outline], [4, 3, S], [5, 3, palette.outline],
    [2, 4, S], [3, 4, S], [4, 4, S], [5, 4, S],
    [2, 5, U], [3, 5, U], [4, 5, trim], [5, 5, U],
    [1, 6, U], [2, 6, U], [3, 6, U], [4, 6, trim], [5, 6, U], [6, 6, U],
    [2, 7, U], [3, 7, U], [4, 7, trim], [5, 7, U],
    [2, 8, US], [3, 8, trim], [4, 8, trim], [5, 8, US],
    [3, 9, L], [5, 9, L]
  ];
  cells.push(
    [3, 0, palette.uniformHi],
    [0, 2, accent],
    [7, 1, accent],
    [7, 2, accent],
    [1, 6, accent],
    [6, 6, accent],
    [2, 5, palette.uniformHi],
    [5, 5, palette.uniformHi],
    [2, 7, US],
    [5, 7, US],
    [4, 6, palette.uniformInk],
    [3, 8, palette.uniformInk],
    [4, 8, palette.uniformInk]
  );
  cells.push(...gamecastTinyUniformNumberCells(options.uniformNumber, 3, 5, ink));
  cells.push(...gamecastFieldingBadgeCells(options.fieldingKey, accent, palette.base, 1, 8));
  if (pose === "stance" || pose === "load") {
    cells.push([7, 2, palette.bat], [7, 3, palette.bat], [6, 4, palette.bat], [8, 1, palette.bat], [8, 2, palette.bat], [1, 5, S], [6, 6, S], [7, 6, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
    if (pose === "load") cells.push([6, 2, palette.bat], [5, 3, palette.bat], [6, 5, S], [8, 0, palette.bat]);
  } else if (pose === "swing") {
    cells.push([0, 4, palette.bat], [1, 4, palette.bat], [2, 4, palette.bat], [6, 4, palette.bat], [7, 4, palette.bat], [8, 4, palette.bat], [9, 4, palette.bat], [1, 5, S], [6, 5, S], [7, 5, S], [2, 10, L], [5, 10, L], [1, 11, L], [6, 11, L], [1, 12, L], [7, 12, L], [8, 11, accent]);
  } else if (pose === "follow") {
    cells.push([0, 2, palette.bat], [1, 3, palette.bat], [2, 4, palette.bat], [3, 5, palette.bat], [1, 5, S], [6, 5, S], [7, 6, S], [2, 10, L], [5, 10, L], [1, 11, L], [6, 11, L], [1, 12, L], [7, 12, L]);
  } else if (pose === "miss") {
    cells.push([6, 1, palette.bat], [7, 2, palette.bat], [7, 3, palette.bat], [8, 4, palette.bat], [0, 5, S], [6, 5, S], [2, 10, L], [5, 10, L], [2, 11, L], [5, 11, L], [2, 12, L], [6, 12, L]);
  } else if (pose === "take") {
    cells.push([0, 5, S], [1, 5, S], [6, 5, S], [7, 5, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
  } else if (pose === "windup") {
    cells.push([0, 2, palette.glove], [1, 2, palette.glove], [6, 1, S], [7, 0, S], [7, 1, palette.ballGlow], [1, 5, S], [6, 5, S], [2, 10, L], [5, 9, L], [2, 11, L], [6, 10, L], [1, 12, L], [6, 11, L]);
  } else if (pose === "pitch") {
    cells.push([0, 5, palette.glove], [1, 5, S], [7, 3, S], [8, 3, palette.ballGlow], [9, 3, palette.ballGlow], [2, 10, L], [5, 10, L], [1, 11, L], [6, 11, L], [0, 12, L], [7, 12, L]);
  } else if (pose === "throw") {
    cells.push([0, 4, palette.glove], [1, 5, S], [6, 4, S], [7, 3, S], [8, 3, palette.ballGlow], [2, 10, L], [5, 10, L], [1, 11, L], [6, 11, L], [0, 12, L], [7, 12, L]);
  } else if (pose === "walk") {
    cells.push([1, 5, S], [7, 6, S], [2, 10, L], [5, 10, L], [runFrame === 1 ? 1 : 2, 11, L], [runFrame === 1 ? 6 : 5, 11, L], [runFrame === 1 ? 1 : 2, 12, L], [runFrame === 1 ? 7 : 6, 12, L]);
  } else if (pose === "bat") {
    cells.push([0, 5, palette.bat], [0, 6, palette.bat], [1, 7, palette.bat], [1, 5, S], [6, 6, S], [7, 6, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
  } else if (pose === "catcher") {
    cells.push([1, 2, palette.outline], [6, 2, palette.outline], [1, 5, accent], [6, 5, accent], [2, 6, accent], [3, 6, accent], [4, 6, accent], [5, 6, accent], [1, 9, L], [6, 9, L], [1, 10, L], [6, 10, L], [0, 11, L], [7, 11, L], [0, 12, L], [7, 12, L]);
  } else if (pose === "field") {
    cells.push([0, 5, palette.glove], [0, 6, palette.glove], [1, 5, S], [6, 5, S], [7, 5, palette.glove], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [2, 12, L], [6, 12, L]);
  } else if (pose === "catch") {
    cells.push([0, 1, palette.glove], [0, 2, palette.glove], [1, 3, palette.glove], [1, 5, S], [6, 5, S], [7, 5, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [2, 12, L], [6, 12, L]);
  } else if (pose === "dive") {
    cells.push([0, 4, palette.glove], [1, 4, S], [7, 5, S], [8, 5, palette.glove], [1, 10, L], [2, 10, L], [6, 10, L], [7, 10, L], [0, 11, L], [8, 11, L], [0, 12, L], [8, 12, L]);
  } else if (pose === "lookUp") {
    cells.push([0, 4, S], [1, 4, S], [6, 4, S], [7, 4, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
  } else if (pose === "watch") {
    cells.push([1, 5, S], [6, 5, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
  } else if (pose === "coach") {
    cells.push([0, 3, S], [1, 4, S], [7, 3, S], [8, 2, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
  } else if (runFrame === 2) {
    cells.push([2, 10, L], [3, 10, L], [5, 10, L], [6, 10, L], [2, 11, L], [6, 11, L], [2, 12, L], [6, 12, L]);
  } else if (runFrame === 1) {
    cells.push([7, 5, S], [0, 6, S], [2, 10, L], [5, 10, L], [2, 11, L], [6, 11, L], [1, 12, L], [6, 12, L]);
  } else {
    cells.push([1, 5, S], [7, 6, S], [3, 10, L], [6, 10, L], [2, 11, L], [6, 11, L], [2, 12, L], [7, 12, L]);
  }
  if (options.scaleShadow !== false) {
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(ox, oy + 14, 9, 1);
    ctx.fillRect(ox + 2, oy + 15, 5, 1);
  }
  drawPixelSprite(ctx, palette, ox, oy, cells);
}

function drawPixelSlidingRunner(ctx, palette, position, color, options = {}) {
  const S = palette.skin;
  const L = palette.legs;
  const U = options.jerseyColor ?? palette.uniform;
  const US = options.jerseyShadow ?? palette.uniformSh;
  const trim = normalizeHexColor(color, palette.runner);
  const accent = normalizeHexColor(options.accentColor ?? color, trim);
  const ink = options.uniformNumber === undefined ? palette.uniformInk : mixHexColors(palette.uniformInk, accent, 0.18);
  const ox = Math.round(position.x) - 8;
  const oy = Math.round(position.y) - 8;
  const rawCells = [
    [1, 1, trim], [2, 1, trim], [3, 1, trim], [4, 1, trim],
    [0, 2, trim], [1, 2, S], [2, 2, S], [3, 2, S], [4, 2, S],
    [1, 3, S], [2, 3, palette.outline], [3, 3, S], [4, 3, palette.outline],
    [4, 4, U], [5, 4, U], [6, 4, trim], [7, 4, U], [8, 4, U],
    [3, 5, U], [4, 5, U], [5, 5, US], [6, 5, trim], [7, 5, US], [8, 5, U],
    [8, 6, L], [9, 6, L], [10, 6, L], [11, 6, L],
    [9, 7, L], [10, 7, L], [12, 7, L], [13, 7, L],
    [0, 4, S], [1, 5, S], [10, 4, S], [11, 3, S],
    [6, 4, palette.uniformInk], [5, 5, palette.uniformInk],
    [4, 4, palette.uniformHi], [8, 4, palette.uniformHi],
    [3, 6, accent], [2, 7, accent]
  ];
  rawCells.push(...gamecastTinyUniformNumberCells(options.uniformNumber, 5, 4, ink));
  const cells = Number(options.facing ?? 1) < 0
    ? rawCells.map(([x, y, fill]) => [13 - x, y, fill])
    : rawCells;
  ctx.fillStyle = palette.shadow;
  ctx.fillRect(ox + 1, oy + 9, 14, 1);
  ctx.fillRect(ox + 4, oy + 10, 9, 1);
  drawPixelSprite(ctx, palette, ox, oy, cells);
  ctx.fillStyle = palette.dirtL;
  ctx.fillRect(ox - 3, oy + 8, 3, 1);
  ctx.fillRect(ox - 5, oy + 10, 2, 1);
  ctx.fillStyle = palette.baseSh;
  ctx.fillRect(ox - 1, oy + 9, 1, 1);
}

function gamecastTinyUniformNumberCells(number, ox, oy, color) {
  if (number === undefined || number === null || number === "") return [];
  const digit = String(Math.abs(Math.floor(Number(number) || 0)) % 10);
  const map = {
    "0": ["11", "11", "11"],
    "1": ["01", "01", "01"],
    "2": ["11", "01", "11"],
    "3": ["11", "01", "11"],
    "4": ["10", "11", "01"],
    "5": ["11", "10", "11"],
    "6": ["10", "11", "11"],
    "7": ["11", "01", "01"],
    "8": ["11", "11", "11"],
    "9": ["11", "11", "01"]
  }[digit] ?? ["11", "11", "11"];
  const cells = [];
  map.forEach((row, rowIndex) => {
    [...row].forEach((cell, colIndex) => {
      if (cell === "1") cells.push([ox + colIndex, oy + rowIndex, color]);
    });
  });
  return cells;
}

function gamecastFieldingBadgeCells(fieldingKey, accent, light, ox, oy) {
  const key = normalizeFieldingPosition(fieldingKey);
  if (!key) return [];
  const mark = key === "P" ? [[1, 0], [0, 1], [1, 1], [0, 2]] :
    key === "C" ? [[0, 0], [1, 0], [0, 1], [0, 2], [1, 2]] :
      key.includes("B") ? [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] :
        key.includes("F") ? [[0, 0], [1, 0], [0, 1], [0, 2]] :
          [[0, 0], [1, 1], [0, 2], [1, 2]];
  return mark.map(([x, y], index) => [ox + x, oy + y, index === 1 ? light : accent]);
}

function drawPixelBall(ctx, palette, position, color) {
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  const previousAlpha = ctx.globalAlpha;
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(position.opacity ?? 1)));
  drawPixelBallWake(ctx, palette, position, color);
  const size = Math.max(3, Math.round(Number(position.size ?? 1)));
  const r = size + 1;
  // bright halo (diamond, not a hard square) so the ball pops without a boxy dark border
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(position.opacity ?? 1))) * 0.72;
  ctx.fillStyle = palette.ballGlow;
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  ctx.fillRect(x, y - r, 1, r * 2 + 1);
  ctx.fillRect(x - r + 1, y - r + 1, 1, 1);
  ctx.fillRect(x + r - 1, y - r + 1, 1, 1);
  ctx.fillRect(x - r + 1, y + r - 1, 1, 1);
  ctx.fillRect(x + r - 1, y + r - 1, 1, 1);
  // ball body: bright white with trimmed corners (round look, no dark outline square)
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(position.opacity ?? 1)));
  const d = size * 2 + 1;
  ctx.fillStyle = palette.uniformHi;
  ctx.fillRect(x - size, y - size, d, d);
  ctx.fillStyle = palette.ballGlow;
  ctx.fillRect(x - size, y - size, 1, 1);
  ctx.fillRect(x + size, y - size, 1, 1);
  ctx.fillRect(x - size, y + size, 1, 1);
  ctx.fillRect(x + size, y + size, 1, 1);
  // red seam dot for baseball identity
  ctx.fillStyle = palette.ballSeam;
  ctx.fillRect(x, y + size, 1, 1);
  ctx.globalAlpha = previousAlpha;
}

function drawPixelBallWake(ctx, palette, position, color) {
  const vx = Number(position.velocityX ?? 0);
  const vy = Number(position.velocityY ?? 0);
  const length = Math.hypot(vx, vy);
  if (length < 0.5) return;
  const dx = vx / length;
  const dy = vy / length;
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  const wakeColors = [color, palette.ballWake, palette.base];
  const previousAlpha = ctx.globalAlpha;
  for (let index = 1; index <= 4; index += 1) {
    const px = Math.round(x - dx * index * 3);
    const py = Math.round(y - dy * index * 3);
    ctx.globalAlpha = previousAlpha * Math.max(0.16, 0.64 - index * 0.12);
    ctx.fillStyle = wakeColors[index % wakeColors.length];
    ctx.fillRect(px, py, Math.max(1, 3 - Math.floor(index / 2)), 1);
    if (index < 3) ctx.fillRect(px + 1, py + 1, 1, 1);
  }
  ctx.globalAlpha = previousAlpha;
}

function drawTrail(ctx, color, trail) {
  const previousAlpha = ctx.globalAlpha;
  for (const point of trail ?? []) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    const size = Math.max(1, Math.round(Number(point.size ?? 1)));
    const alpha = Math.max(0, Math.min(1, Number(point.opacity ?? 0.78)));
    ctx.globalAlpha = previousAlpha * alpha;
    ctx.fillStyle = "#fffefb";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = point.color ?? color;
    ctx.fillRect(x + size, y + size, Math.max(1, size - 1), Math.max(1, size - 1));
  }
  ctx.globalAlpha = previousAlpha;
}

function drawPixelRunnerDust(ctx, palette, dust) {
  for (const [index, point] of (dust ?? []).entries()) {
    const x = Math.round(point.x - gamecastSize(2 + index));
    const y = Math.round(point.y + gamecastSize(2 + index));
    ctx.fillStyle = index % 2 ? palette.dirtL : palette.dirtM;
    ctx.fillRect(x, y, gamecastSize(2), gamecastSize(1));
    ctx.fillStyle = palette.baseSh;
    ctx.fillRect(x + gamecastSize(2), y + gamecastSize(1), gamecastSize(1), gamecastSize(1));
  }
}

function fillPixelDiamond(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y += 1) {
    const width = Math.max(1, Math.round((1 - Math.abs(y) / ry) * rx));
    ctx.fillRect(cx - width, cy + y, width * 2 + 1, 1);
  }
}

function fillPixelCircle(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) {
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
}

function drawPixelLine(ctx, x0, y0, x1, y1, color, size = 1) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const targetX = Math.round(x1);
  const targetY = Math.round(y1);
  const dx = Math.abs(targetX - x);
  const dy = -Math.abs(targetY - y);
  const sx = x < targetX ? 1 : -1;
  const sy = y < targetY ? 1 : -1;
  let error = dx + dy;
  ctx.fillStyle = color;
  while (true) {
    ctx.fillRect(x, y, size, size);
    if (x === targetX && y === targetY) break;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

function easeOutBack(value) {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2;
}

function normalizeHexColor(value, fallback = "#c64b74") {
  const text = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text;
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return `#${text.slice(1).split("").map((char) => char + char).join("")}`;
  }
  return fallback;
}

function mixHexColors(from, to, amount = 0.5) {
  const a = parseHexColor(normalizeHexColor(from, "#c64b74"));
  const b = parseHexColor(normalizeHexColor(to, "#fffefb"));
  const t = Math.max(0, Math.min(1, Number(amount)));
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t)
  });
}

function parseHexColor(value) {
  const hex = normalizeHexColor(value, "#000000").slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function rgbToHex(color) {
  return `#${[color.r, color.g, color.b].map((part) => Math.max(0, Math.min(255, part)).toString(16).padStart(2, "0")).join("")}`;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function renderCompactBoxScore(game, away, home) {
  const linescore = game.boxScore?.linescore;
  if (!linescore?.away || !linescore?.home) return "";

  const innings = Array.isArray(linescore.innings) ? linescore.innings : [];
  const visibleInnings = innings.slice(0, 9);

  return `
    <div class="boxscore-mini" aria-label="박스스코어">
      <div class="boxscore-row boxscore-head">
        <span>팀</span>
        ${visibleInnings.map((inning) => `<b>${formatNumber(inning)}</b>`).join("")}
        <b>R</b>
        <b>H</b>
      </div>
      ${renderBoxScoreRow(getTeamShortName(away) ?? linescore.away.team, linescore.away, visibleInnings.length)}
      ${renderBoxScoreRow(getTeamShortName(home) ?? linescore.home.team, linescore.home, visibleInnings.length)}
    </div>
  `;
}

function renderBoxScoreRow(teamLabel, line, inningCount) {
  const runsByInning = Array.isArray(line.runsByInning) ? line.runsByInning : [];
  return `
    <div class="boxscore-row">
      <span>${escapeHtml(teamLabel)}</span>
      ${Array.from({ length: inningCount }, (_, index) => `<b>${formatNumber(runsByInning[index] ?? 0)}</b>`).join("")}
      <b>${formatNumber(line.runs)}</b>
      <b>${formatNumber(line.hits)}</b>
    </div>
  `;
}

function renderScoringMoments(game) {
  const events = Array.isArray(game.scoringEvents) ? game.scoringEvents.slice(0, 2) : [];
  if (!events.length) return "";

  return `
    <div class="scoring-moments">
      ${events.map(renderScoringMoment).join("")}
    </div>
  `;
}

function renderScoringMoment(event) {
  return `
    <span>
      <b>${formatNumber(event.inning)}회</b>
      ${escapeHtml(event.hitterName || "타자")} ${escapeHtml(outcomeLabel(event.outcome))} · ${formatNumber(event.runs)}득점
    </span>
  `;
}

function renderGameDetail(game) {
  const details = [];
  const hasHits = Number.isFinite(Number(game.awayHits)) && Number.isFinite(Number(game.homeHits));
  const hasHomers = Number.isFinite(Number(game.awayHomeRuns)) && Number.isFinite(Number(game.homeHomeRuns));
  const starters = [game.awayStarter, game.homeStarter].filter(Boolean);

  if (hasHits) {
    details.push(`H ${formatNumber(game.awayHits)}-${formatNumber(game.homeHits)}`);
  }
  if (hasHomers) {
    details.push(`HR ${formatNumber(game.awayHomeRuns)}-${formatNumber(game.homeHomeRuns)}`);
  }
  if (starters.length) {
    details.push(`SP ${starters.map(escapeHtml).join(" / ")}`);
  }
  if (game.crowd || game.attendance) {
    details.push(`${formatNumber(game.crowd ?? game.attendance)}명 입장`);
  }

  return details.length ? details.join(" · ") : "예정 경기";
}

function renderSeasonStatsPanel(team, leaders) {
  const teamGames = Number(team?.wins ?? 0) + Number(team?.losses ?? 0) + Number(team?.ties ?? 0);
  return `
    <article class="panel stats-panel" id="stats">
      <div class="panel-head">
        <div>
          <span class="mini-label">시즌 기록</span>
          <h2>${escapeHtml(getTeamShortName(team) ?? "Team")} 기록실</h2>
        </div>
        <span class="pill">${formatNumber(teamGames)}G</span>
      </div>
      <div class="stat-split">
        <section>
          <h3>타자 TOP</h3>
          <ol class="player-list compact stat-list">
            ${leaders.hitters.length ? leaders.hitters.map(renderBatterLeader).join("") : renderEmptyListItem("기록 대기 중")}
          </ol>
        </section>
        <section>
          <h3>투수 TOP</h3>
          <ol class="player-list compact stat-list">
            ${leaders.pitchers.length ? leaders.pitchers.map(renderPitcherLeader).join("") : renderEmptyListItem("기록 대기 중")}
          </ol>
        </section>
      </div>
    </article>
  `;
}

function renderBatterLeader(entry, index) {
  const { player, stats } = entry;
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(player.id ?? "")}" data-team-id="${escapeAttribute(player.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${index + 1}</span>
      <span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${formatRateStat(battingAverage(stats))} / ${formatRateStat(onBasePercentage(stats))} / ${formatRateStat(sluggingPercentage(stats))} · HR ${formatNumber(stats.homeRuns)} · RBI ${formatNumber(stats.rbi)}</small>
      </span>
      <b>${formatNumber(stats.hits)}</b>
    </li>
  `;
}

function renderPitcherLeader(entry, index) {
  const { player, stats } = entry;
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(player.id ?? "")}" data-team-id="${escapeAttribute(player.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${index + 1}</span>
      <span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>ERA ${formatEra(stats)} · ${formatInnings(stats.inningsOuts)}IP · K ${formatNumber(stats.strikeouts)} · SV ${formatNumber(stats.saves)} · HLD ${formatNumber(stats.holds)}</small>
      </span>
      <b>${formatNumber(stats.wins)}승</b>
    </li>
  `;
}

function renderLineupPlayer(player, index) {
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(player.id ?? "")}" data-team-id="${escapeAttribute(player.teamId ?? "")}" tabindex="0" role="button">
      <span class="order">${index + 1}</span>
      <span>
        <strong>${escapeHtml(player.name)}</strong>
        <small>${escapeHtml(player.position ?? "UTIL")} · ${formatBatsThrows(player)}</small>
      </span>
      <b>${formatNumber(player.ovr)}</b>
    </li>
  `;
}

function renderPitchingRole(entry) {
  return `
    <li class="is-clickable" data-action="open-player-detail" data-player-id="${escapeAttribute(entry.id ?? "")}" data-team-id="" tabindex="0" role="button">
      <span class="order">${escapeHtml(pitchingRoleLabel(entry.role))}</span>
      <span>
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${entry.role === "nextStarter" ? "다음 선발 · " : ""}STA ${formatNumber(entry.stamina)} · ARM ${formatNumber(entry.armFreshness)} · 피로 ${formatNumber(entry.fatigue)}</small>
      </span>
      <b>${formatNumber(entry.ovr)}</b>
    </li>
  `;
}

function renderLogs(state) {
  const logs = state.logs ?? [];
  if (!logs.length) {
    return `<div class="empty-card">아직 프런트 소식이 없습니다. 시뮬레이션을 진행하면 뉴스가 쌓여요.</div>`;
  }

  return logs.slice(0, 8).map((log) => {
    const item = normalizeLogItem(log, state);
    return renderLogItem(item);
  }).join("");
}

function renderLogItem(item) {
  const type = logTypeClass(item.type);
  return `
    <div class="news-item ${type ? `is-${escapeAttribute(type)}` : ""}" data-news-type="${escapeAttribute(item.type)}">
      ${item.type === "kbo-official" ? `<i class="kbo-document-mark" aria-hidden="true">KBO</i>` : ""}
      <span>${escapeHtml(item.source ?? item.tag ?? "note")}</span>
      <strong>${escapeHtml(item.headline ?? item.text ?? "새 소식")}</strong>
      ${item.body ? `<p>${escapeHtml(item.body)}</p>` : ""}
      <small>${escapeHtml(item.date ?? "")}</small>
    </div>
  `;
}

function normalizeLogItem(log, state) {
  const item = typeof log === "string" ? { text: log } : (log ?? {});
  const headline = item.headline ?? item.title ?? item.text ?? item.message ?? "새 소식";
  const body = item.headline || item.title ? (item.text ?? item.message ?? item.body ?? "") : (item.body ?? "");
  return {
    ...item,
    type: item.type ?? "note",
    tag: item.tag ?? item.source ?? "note",
    headline,
    body,
    text: item.text ?? item.message ?? headline,
    date: item.date ?? state.currentDate ?? ""
  };
}

function logTypeClass(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

function renderEmptyTableRow(message, colspan) {
  return `<tr><td class="empty-row" colspan="${colspan}">${escapeHtml(message)}</td></tr>`;
}

function renderEmptyListItem(message) {
  return `<li class="empty-list">${escapeHtml(message)}</li>`;
}

function renderTeamLogo(team, className) {
  const logo = getTeamLogo(team);
  if (!logo) {
    return `<span class="team-dot" style="--dot: ${escapeAttribute(getTeamColor(team))}"></span>`;
  }

  return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(logo)}" alt="${escapeAttribute(getTeamName(team) ?? "KBO")} 로고" loading="lazy">`;
}

function getTeamRank(standings, selectedTeam) {
  if (!selectedTeam) return null;
  const index = standings.findIndex((team) => String(team.id) === String(selectedTeam.id));
  return index === -1 ? null : index + 1;
}

function normalizeGameTeam(teamOrId, state) {
  if (teamOrId && typeof teamOrId === "object") return teamOrId;
  const key = String(teamOrId ?? "");
  return state.teams.find((team) =>
    String(team.id) === key ||
    String(team.shortName) === key ||
    String(team.name) === key
  ) ?? { id: teamOrId, name: key || "TBD" };
}

function getRoster(team) {
  return [...(team?.roster ?? [])].sort(sortByOvr);
}

function getSelectedPlayerEntry(state, selectedTeam) {
  const playerId = String(state?.ui?.selectedPlayerId ?? "");
  if (!playerId) return null;
  const preferredTeamId = String(state?.ui?.selectedPlayerTeamId || selectedTeam?.id || "");
  const teams = preferredTeamId
    ? [
        ...(state?.teams ?? []).filter((team) => String(team.id) === preferredTeamId),
        ...(state?.teams ?? []).filter((team) => String(team.id) !== preferredTeamId)
      ]
    : (state?.teams ?? []);
  for (const team of teams) {
    const player = (team.roster ?? []).find((entry) =>
      String(entry.id ?? "") === playerId ||
      String(entry.playerId ?? "") === playerId ||
      String(entry.name ?? "") === playerId
    );
    if (player) return { team, player };
  }
  return null;
}

function getDefaultPlayerEntry(team) {
  const player = getRoster(team)[0];
  return player ? { team, player, isDefault: true } : null;
}

function buildSeasonLeaders(team) {
  const roster = getRoster(team);
  const hitters = roster
    .filter((player) => !isPitcher(player))
    .map((player) => ({ player, stats: getBattingStats(player) }));
  const pitchers = roster
    .filter(isPitcher)
    .map((player) => ({ player, stats: getPitchingStats(player) }));
  const activeHitters = hitters.filter(({ stats }) => Number(stats.plateAppearances ?? 0) > 0);
  const activePitchers = pitchers.filter(({ stats }) => Number(stats.inningsOuts ?? 0) > 0);

  return {
    hitters: (activeHitters.length ? activeHitters : hitters)
      .sort(sortBatterLeader)
      .slice(0, 5),
    pitchers: (activePitchers.length ? activePitchers : pitchers)
      .sort(sortPitcherLeader)
      .slice(0, 5)
  };
}

function sortBatterLeader(a, b) {
  const opsDiff = ops(b.stats) - ops(a.stats);
  if (opsDiff !== 0) return opsDiff;
  const homerDiff = Number(b.stats.homeRuns ?? 0) - Number(a.stats.homeRuns ?? 0);
  if (homerDiff !== 0) return homerDiff;
  const rbiDiff = Number(b.stats.rbi ?? 0) - Number(a.stats.rbi ?? 0);
  if (rbiDiff !== 0) return rbiDiff;
  return Number(b.player.ovr ?? 0) - Number(a.player.ovr ?? 0);
}

function sortPitcherLeader(a, b) {
  const inningsDiff = Number(b.stats.inningsOuts ?? 0) - Number(a.stats.inningsOuts ?? 0);
  if (inningsDiff !== 0) return inningsDiff;
  const eraDiff = era(a.stats) - era(b.stats);
  if (eraDiff !== 0) return eraDiff;
  const strikeoutDiff = Number(b.stats.strikeouts ?? 0) - Number(a.stats.strikeouts ?? 0);
  if (strikeoutDiff !== 0) return strikeoutDiff;
  return Number(b.player.ovr ?? 0) - Number(a.player.ovr ?? 0);
}

function getBattingStats(player) {
  return player?.seasonStats?.batting ?? {};
}

function getPitchingStats(player) {
  return player?.seasonStats?.pitching ?? {};
}

function sortByOvr(a, b) {
  return Number(b.ovr ?? 0) - Number(a.ovr ?? 0);
}

function isPitcher(player) {
  return player.role === "pitcher" || player.role === "P";
}

function getTeamName(team) {
  return team?.name ?? getTeamShortName(team);
}

function getTeamShortName(team) {
  return team?.shortName ?? TEAM_META[team?.id]?.shortName ?? team?.name;
}

function getTeamLocation(team) {
  const city = team?.city ?? TEAM_META[team?.id]?.city;
  return city ? `${city} 연고` : "KBO League";
}

function getTeamColor(team) {
  return team?.color ?? TEAM_META[team?.id]?.color ?? "#e45b75";
}

function getTeamLogo(team) {
  return team?.logo ?? TEAM_META[team?.id]?.logo ?? "";
}

function getPositionGroupLabel(key, fallback) {
  return POSITION_GROUP_LABELS[key] ?? fallback ?? "기타";
}

function getManagerProfile(state) {
  const manager = state?.manager && typeof state.manager === "object" ? state.manager : {};
  return {
    name: manager.name || "임시 감독",
    age: Number.isFinite(Number(manager.age)) ? Number(manager.age) : 42,
    style: manager.style || "balanced",
    teamId: manager.teamId || state?.selectedTeamId || "",
    appointedAt: manager.appointedAt || state?.currentDate || "",
    interviewAnswers: Array.isArray(manager.interviewAnswers) ? manager.interviewAnswers : [],
    inaugurationComplete: Boolean(manager.inaugurationComplete)
  };
}

function managerStyleLabel(style) {
  return MANAGER_STYLES.find((entry) => entry.value === style)?.label ?? "균형 운영";
}

function renderPlayerMeta(player) {
  const parts = [];

  if (player?.position) {
    parts.push(player.position);
  }

  if (hasPositiveNumber(player?.age)) {
    parts.push(`${formatNumber(player.age)}세`);
  }

  if (hasPositiveNumber(player?.ovr)) {
    parts.push(`OVR ${formatNumber(player.ovr)}`);
  }

  if (hasPositiveNumber(player?.pot)) {
    parts.push(`POT ${formatNumber(player.pot)}`);
  }

  return parts.join(" · ");
}

function renderPlayerScore(player) {
  const scores = [];

  if (hasPositiveNumber(player?.ovr)) {
    scores.push(formatNumber(player.ovr));
  }

  if (hasPositiveNumber(player?.pot)) {
    scores.push(formatNumber(player.pot));
  }

  return scores.length ? scores.join("/") : "-";
}

function renderOvrPot(summary) {
  const scores = [];

  if (hasPositiveNumber(summary?.averageOvr)) {
    scores.push(formatAverage(summary.averageOvr));
  }

  if (hasPositiveNumber(summary?.averagePot)) {
    scores.push(formatAverage(summary.averagePot));
  }

  return scores.length ? scores.join("/") : "-";
}

function renderRecord(team) {
  if (!team) return "-";
  return `${formatNumber(team.wins)}승 ${formatNumber(team.losses)}패 ${formatNumber(team.ties)}무`;
}

function renderPhase(phase) {
  if (phase === "preseason") return "프리시즌";
  if (phase === "offseason") return "스토브리그";
  if (phase === "postseason") return "포스트시즌";
  if (phase === "complete") return "정규시즌 종료";
  if (phase === "regular") return "정규시즌";
  return phase ?? "정규시즌";
}

function winningPct(team) {
  const wins = Number(team?.wins ?? 0);
  const losses = Number(team?.losses ?? 0);
  const decisions = wins + losses;
  return decisions ? wins / decisions : 0;
}

function formatPct(value) {
  return Number.isFinite(value) ? value.toFixed(3).replace(/^0/, "") : "-";
}

function formatAttendance(team) {
  const homeGames = Number(team?.homeGames ?? 0);
  const total = Number(team?.attendanceTotal ?? 0);
  return homeGames ? formatNumber(Math.round(total / homeGames)) : "-";
}

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  if (amount >= 100000000) return `${formatNumber(Math.round(amount / 100000000))}억`;
  return `${formatNumber(amount)}억`;
}

function formatKRWShort(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  if (amount >= 100000000) {
    const eok = amount / 100000000;
    return `${formatDecimal(eok, eok >= 10 ? 0 : 1)}억`;
  }
  if (amount >= 10000) {
    return `${formatNumber(Math.round(amount / 10000))}만`;
  }
  return `${formatNumber(amount)}원`;
}

function formatMoneyRoom(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${formatNumber(Math.round(Math.abs(amount)))}억`;
}

function formatPressureLevel(level) {
  if (level === "critical") return "위험";
  if (level === "high") return "높음";
  if (level === "medium") return "보통";
  return "낮음";
}

function severityLabel(level) {
  if (level === "critical") return "긴급";
  if (level === "high") return "높음";
  if (level === "normal") return "보통";
  if (level === "watch") return "관찰";
  return "낮음";
}

function proposalStatusLabel(status, gate = null) {
  if (status === "viable" && gate?.commandReady === true) return "확정 가능";
  if (status === "viable") return "검토 가능";
  if (status === "needs_sweetener") return "보강 필요";
  if (status === "needs_assets") return "자산 부족";
  return "낮은 확률";
}

function faGradeLabel(grade) {
  if (grade === "A") return "A등급";
  if (grade === "B") return "B등급";
  if (grade === "C") return "C등급";
  return "보상없음";
}

function marketCandidateStatus(status) {
  if (status === "signed") return "계약완료";
  if (status === "open") return "협상중";
  if (status === "preview") return "미리보기";
  if (status === "rights-held") return "권리확보";
  return "대기";
}

function formatCompensationText(compensation = {}) {
  const grade = compensation.grade ?? "none";
  if (grade === "A" || grade === "B") {
    return `${faGradeLabel(grade)} · ${formatNumber(compensation.protectedListSize)}인 보호 · 현금 ${formatKRWShort(compensation.cashOnlyKRW)}`;
  }
  if (grade === "C") return "C등급 · 보상선수 없음 · 현금 150%";
  if (compensation.cashKRW) return `${formatKRWShort(compensation.cashKRW)} 예정`;
  return "보상 없음";
}

function riskLabel(risk) {
  if (risk === "high") return "높음";
  if (risk === "medium") return "보통";
  if (risk === "low") return "낮음";
  return "미확인";
}

function normalizeDraftRoleFilter(value) {
  return ["all", "pitcher", "hitter"].includes(String(value)) ? String(value) : "all";
}

function draftRoleFilterLabel(value) {
  if (value === "pitcher") return "투수";
  if (value === "hitter") return "야수";
  return "전체";
}

function seriesStatusLabel(status) {
  if (status === "complete") return "종료";
  if (status === "active") return "진행 중";
  if (status === "preview") return "예상 대진";
  if (status === "pending") return "대기";
  return "승자 대기";
}

function awardInitial(label) {
  const text = String(label ?? "");
  if (text.includes("MVP")) return "M";
  if (text.includes("신인")) return "R";
  if (text.includes("골든")) return "G";
  if (text.includes("한국")) return "K";
  return "A";
}

function contractTypeLabel(type) {
  if (type === "foreign") return "외국인";
  if (type === "fa") return "FA";
  if (type === "rookie") return "신인";
  if (type === "development") return "육성";
  if (type === "militaryHold") return "군보류";
  if (type === "standard") return "표준";
  return "미확인";
}

function nextSeasonYear(state) {
  const year = Number(String(state?.currentDate ?? "").slice(0, 4));
  return Number.isFinite(year) ? year + 1 : 2027;
}

function faLabel(player) {
  if (player.faStatus === "eligibleAfterSeason") return `${formatNumber(player.eligibilitySeason)} FA`;
  if (player.faStatus === "market") return "FA 시장";
  if (player.faStatus === "filed") return "FA 신청";
  if (Number.isFinite(Number(player.faYearsUntilEligibility)) && Number(player.faYearsUntilEligibility) < 90) {
    return `${formatNumber(player.faYearsUntilEligibility)}년 후`;
  }
  return "자격 전";
}

function foreignSlotLabel(slotType) {
  if (slotType === "foreignPitcher") return "외국인 투수";
  if (slotType === "foreignHitter") return "외국인 타자";
  if (slotType === "foreignPlayer") return "외국인";
  return "국내";
}

function roleLabel(role) {
  if (role === "pitcher") return "투수";
  if (role === "hitter") return "야수";
  return "후보";
}

function pitchingRoleLabel(role) {
  if (role === "nextStarter") return "다음";
  if (role === "starter") return "선발";
  if (role === "LR") return "롱";
  if (role === "MR") return "중간";
  if (role === "SU") return "셋업";
  if (role === "CL") return "마무리";
  return "투수";
}

function sourceKindLabel(kind) {
  if (kind === "official") return "공식";
  if (kind === "reported") return "보도";
  if (kind === "estimated") return "추정";
  if (kind === "fallback") return "기본값";
  return "미확인";
}

function outcomeLabel(outcome) {
  if (outcome === "homeRun") return "홈런";
  if (outcome === "triple") return "3루타";
  if (outcome === "double") return "2루타";
  if (outcome === "single") return "안타";
  if (outcome === "walk") return "볼넷";
  if (outcome === "error") return "실책 출루";
  if (outcome === "strikeout") return "삼진";
  if (outcome === "stolenBase") return "도루 성공";
  if (outcome === "caughtStealing") return "도루자 아웃";
  return "타구";
}

function recordBoardLabel(key) {
  const labels = {
    avg: "AVG",
    homeRuns: "HR",
    rbi: "RBI",
    stolenBases: "SB",
    ops: "OPS",
    era: "ERA",
    wins: "W",
    saves: "SV",
    holds: "HLD",
    strikeouts: "K"
  };
  return labels[key] ?? String(key ?? "");
}

function recordQualificationText(entry) {
  const label = entry?.qualified ? "규정" : "미달";
  const value = Number(entry?.qualifyingValue ?? 0);
  const target = Number(entry?.qualifyingTarget ?? 0);
  if (entry?.role === "pitcher") {
    return `${label} IP ${formatInnings(value)}/${formatInnings(target)}`;
  }
  return `${label} PA ${formatNumber(value)}/${formatNumber(target)}`;
}

function formatRecordLeaderValue(entry) {
  if (entry?.stat === "avg" || entry?.stat === "ops") return formatRateStat(entry.value);
  if (entry?.stat === "era") return formatEraValue(entry.value);
  return formatNumber(entry?.value);
}

function formatEraValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : "-";
}

function currentSeasonLabel(state) {
  const year = Number(String(state?.currentDate ?? "").slice(0, 4));
  return Number.isFinite(year) ? `${year}` : "현재";
}

function formatSignedNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number > 0 ? "+" : ""}${formatAverage(number)}`;
}

function formatRatioPct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 100)}%` : "-";
}

function battingAverage(stats) {
  return rate(stats?.hits, stats?.atBats);
}

function onBasePercentage(stats) {
  return rate(Number(stats?.hits ?? 0) + Number(stats?.walks ?? 0), stats?.plateAppearances);
}

function sluggingPercentage(stats) {
  return rate(stats?.totalBases, stats?.atBats);
}

function ops(stats) {
  return onBasePercentage(stats) + sluggingPercentage(stats);
}

function era(stats) {
  const inningsOuts = Number(stats?.inningsOuts ?? 0);
  if (!Number.isFinite(inningsOuts) || inningsOuts <= 0) return Number.POSITIVE_INFINITY;
  return Number(stats?.earnedRuns ?? 0) * 27 / inningsOuts;
}

function rate(numerator, denominator) {
  const top = Number(numerator ?? 0);
  const bottom = Number(denominator ?? 0);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= 0) return 0;
  return top / bottom;
}

function formatRateStat(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "-";
  return number.toFixed(3).replace(/^0/, "");
}

function formatEra(stats) {
  const number = era(stats);
  return Number.isFinite(number) ? number.toFixed(2) : "-";
}

function formatInnings(outs) {
  const totalOuts = Math.max(0, Math.floor(Number(outs ?? 0)));
  const innings = Math.floor(totalOuts / 3);
  const remainder = totalOuts % 3;
  return remainder ? `${formatNumber(innings)}.${remainder}` : formatNumber(innings);
}

function formatAverage(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(number) : "-";
}

function formatDecimal(value, maximumFractionDigits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits }).format(number) : "-";
}

function formatTemperature(value) {
  const temp = Number(value);
  return Number.isFinite(temp) ? `${temp}°C` : "기온 준비 중";
}

function formatBatsThrows(player) {
  const bats = player.bats ? `B:${player.bats}` : "B:-";
  const throws = player.throws ? `T:${player.throws}` : "T:-";
  return `${bats} ${throws}`;
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(8, Math.min(100, Math.round(number / 80 * 100)));
}

function formatNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? new Intl.NumberFormat("ko-KR").format(number) : "0";
}

function hasPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
