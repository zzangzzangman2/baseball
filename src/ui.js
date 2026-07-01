import {
  advanceSeason,
  buildLineup,
  buildPitchingSnapshot,
  commitForeignPlayerSigning,
  commitFreeAgentSigning,
  commitTradeProposal,
  getSelectedTeam,
  getNextGamePreview,
  getTeamMonthlySchedule,
  getStandings,
  initializeDraft,
  initializeFreeAgency,
  initializePostseason,
  initializeSecondaryDraft,
  resolveMailDecision,
  simulateDay,
  simulateDays,
  simulateNextUserGame,
  simulateDraft,
  simulatePostseason,
  simulateSecondaryDraft,
  runAutonomousOffseason
} from "./engine.js";

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
  { id: "news", label: "뉴스함", detail: "비서·언론·공문" },
  { id: "schedule", label: "일정", detail: "캘린더와 다음 경기" },
  { id: "lineup", label: "라인업", detail: "타순·투수 운용" },
  { id: "players", label: "선수단", detail: "상세·기록·계약" },
  { id: "standings", label: "순위", detail: "리그와 스코어" },
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

const GAMECAST_PIXEL_W = 160;
const GAMECAST_PIXEL_H = 144;
const GAMECAST_CANVAS_ID = "gamecast-pixel-canvas";
const GAMECAST_PLAYBACK_COUNT = 8;
const GAMECAST_WATCH_PA_MS = 920;
const GAMECAST_WATCH_GAP_MS = 140;
const GAMECAST_PA_MS = 850;
const GAMECAST_PA_GAP_MS = 120;
const GAMECAST_SPEED_OPTIONS = [1, 2, 3, 4];
let cleanupGamecastPixelScreen = null;
let latestGamecastSequence = null;

export function mountApp(root, state) {
  render(root, state);
}

function render(root, state) {
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
  const selectedPlayerEntry = getSelectedPlayerEntry(state, selectedTeam);
  const seasonLeaders = buildSeasonLeaders(selectedTeam);
  const pitchingSnapshot = buildPitchingSnapshot(selectedTeam);
  const injuries = roster.filter((player) => Number(player.injuredDays) > 0);
  const teamColor = getTeamColor(selectedTeam);
  const activeTab = normalizeActiveTab(state?.ui?.activeTab);
  const activeTabMeta = DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0];
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
        ${renderSidebarNav(activeTab)}
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
              <span>구단 선택</span>
              <select data-action="select-team" ${state.teams.length ? "" : "disabled"}>
                ${renderTeamOptions(state)}
              </select>
            </label>
            <div class="manager-chip">
              <span>감독</span>
              <strong>${escapeHtml(manager.name)}</strong>
              <small>${formatNumber(manager.age)}세 · ${escapeHtml(managerStyleLabel(manager.style))}</small>
            </div>
            <div class="quick-action-row">
              <button class="button button-primary" data-action="next-day" type="button">다음 날</button>
              <button class="button button-soft" data-action="export-save" type="button">저장</button>
            </div>
            <p class="status-message" data-save-status aria-live="polite"></p>
          </div>
        </header>

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
          roster,
          lineup,
          pitchingSnapshot,
          injuries,
          frontOffice,
          gmDesk
        })}
      </section>
    </main>
  `;

  initGamecastPixelScreen(root);
  bindActions(root, state);
}

function renderSidebarNav(activeTab) {
  return `
    <nav class="nav-list" aria-label="Dashboard sections">
      ${DASHBOARD_TABS.map((tab) => `
        <button class="nav-item ${tab.id === activeTab ? "is-active" : ""}" data-action="switch-tab" data-tab-id="${escapeAttribute(tab.id)}" type="button">
          <span>${escapeHtml(tab.label)}</span>
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
    roster,
    lineup,
    pitchingSnapshot,
    injuries,
    frontOffice,
    gmDesk
  } = context;

  if (activeTab === "news") {
    return renderTabSurface("news", "뉴스함", `
      ${renderNewsInboxPanel(state, selectedTeam, manager)}
      ${renderPendingMailDecisionPanel(state)}
      ${renderNewsLogPanel(state)}
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

  if (activeTab === "front-office") {
    return renderTabSurface("front-office", "프런트", `
      ${renderCommandCenterPanels(gmDesk)}
      ${renderFrontOfficePanels(frontOffice)}
    `);
  }

  if (activeTab === "market") {
    return renderTabSurface("market", "시장", `
      ${renderCommandCenterPanels(gmDesk)}
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
      ${renderOperationsBar()}
      ${renderStateFoundationPanel(state)}
    `);
  }

  return renderTabSurface("clubhouse", "클럽하우스", `
    ${renderMetricGrid(state, selectedTeam, selectedRank, injuries)}
    ${renderManagerBriefingPanel(state, selectedTeam, manager)}
    ${renderNewsInboxPanel(state, selectedTeam, manager)}
    ${renderPendingMailDecisionPanel(state)}
    ${renderNextGamePanel(state, selectedTeam, nextGame)}
  `);
}

function renderTabSurface(tabId, title, body) {
  return `
    <section class="tab-surface" data-active-tab="${escapeAttribute(tabId)}" aria-label="${escapeAttribute(title)}">
      ${body}
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

function renderOperationsBar() {
  return `
    <section class="operations-bar" aria-label="운영 메뉴">
      <div class="operation-group">
        <span>진행</span>
        <button class="button button-primary" data-action="next-day">다음 날</button>
        <button class="button button-soft" data-action="week">빠른 주간</button>
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

function renderLineupManagerPanel(state, selectedTeam, roster, lineup, pitchingSnapshot) {
  const eligibleHitters = getLineupEligibleHitters(roster);
  const selectedIds = buildLineupSelectionIds(selectedTeam, lineup, eligibleHitters);
  const selectedLineup = selectedIds
    .map((id) => eligibleHitters.find((player) => String(player.id) === String(id)))
    .filter(Boolean);
  const bench = eligibleHitters.filter((player) => !selectedIds.includes(String(player.id))).slice(0, 6);
  const summary = summarizeLineup(selectedLineup);
  const manual = isManualLineupActive(selectedTeam, lineup);
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

          <aside class="lineup-command-board" aria-label="라인업 밸런스">
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
            <section class="lineup-bench-board">
              <h3>벤치 후보</h3>
              <ol class="player-list compact">
                ${bench.length ? bench.map(renderBenchCandidate).join("") : renderEmptyListItem("가용 벤치가 부족합니다.")}
              </ol>
            </section>
          </aside>

          <section class="lineup-pitching-board" aria-label="투수 운용">
            <div class="lineup-section-head">
              <h3>투수 운용</h3>
              <small>오늘 기준</small>
            </div>
            <h4>선발 로테이션</h4>
            <ol class="player-list compact pitching-role-list">
              ${pitchingSnapshot.rotation.length ? pitchingSnapshot.rotation.map(renderPitchingRole).join("") : renderEmptyListItem("로테이션 준비 중입니다.")}
            </ol>
            <h4>불펜 역할</h4>
            <ol class="player-list compact pitching-role-list">
              ${pitchingSnapshot.bullpen.length ? pitchingSnapshot.bullpen.slice(0, 5).map(renderPitchingRole).join("") : renderEmptyListItem("불펜 준비 중입니다.")}
            </ol>
          </section>
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
      <label>
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

function isManualLineupActive(team, lineup) {
  const ids = Array.isArray(team?.lineupCard?.playerIds) ? team.lineupCard.playerIds.map(String) : [];
  if (ids.length < 9 || lineup.length < 9) return false;
  return ids.slice(0, 9).every((id, index) => String(lineup[index]?.id ?? "") === id);
}

function renderManagerBriefingPanel(state, selectedTeam, manager) {
  const answers = Array.isArray(manager.interviewAnswers) ? manager.interviewAnswers : [];
  const goal = answers.find((answer) => answer.id === "goal")?.label ?? "매 경기 준비";
  const front = answers.find((answer) => answer.id === "front")?.label ?? "균형 있는 운영";
  const message = answers.find((answer) => answer.id === "message")?.label ?? "선수단 신뢰";

  return `
    <section class="manager-briefing-panel" aria-label="감독 브리핑">
      <div class="manager-briefing-main">
        <span class="mini-label">감독실</span>
        <h2>${escapeHtml(manager.name)} 감독 취임 브리핑</h2>
        <p>${escapeHtml(getTeamShortName(selectedTeam) ?? "우리 팀")} · ${formatNumber(manager.age)}세 · ${escapeHtml(managerStyleLabel(manager.style))}</p>
      </div>
      <div class="manager-briefing-quotes">
        <span>${escapeHtml(goal)}</span>
        <span>${escapeHtml(message)}</span>
        <span>${escapeHtml(front)}</span>
      </div>
      <small>${escapeHtml(manager.appointedAt ?? state.currentDate ?? "")} 취임</small>
    </section>
  `;
}

function renderNewsInboxPanel(state, selectedTeam, manager) {
  const items = buildNewsInboxItems(state, selectedTeam, manager);
  const assistant = items.find((item) => item.type === "assistant") ?? buildFallbackAssistantBriefing(state, selectedTeam, manager);
  const lead = items.find((item) => item.type === "media") ?? items.find((item) => item.type === "kbo-official") ?? items[0];
  const unreadCount = items.length;
  const phaseLabel = state.phase === "preseason" ? "프리시즌 뉴스함" : "뉴스함";

  return `
    <section class="news-inbox-panel" id="news-inbox" data-main-news-inbox data-preseason-desk aria-label="뉴스함과 개인비서 보고">
      <div class="news-inbox-head">
        <div>
          <span class="mini-label">${escapeHtml(phaseLabel)}</span>
          <h2>개인비서 / 언론 브리핑</h2>
          <p>SBS · KBS · MBC · JTBC · MBN · SPOTV 기사와 구단 공문이 이곳에 쌓입니다.</p>
        </div>
        <span class="pill">${formatNumber(unreadCount)}건</span>
      </div>
      <div class="news-inbox-grid">
        <article class="inbox-assistant-card" data-news-type="assistant">
          <span>${escapeHtml(assistant.source ?? assistant.tag ?? "개인비서")}</span>
          <h3>${escapeHtml(assistant.headline)}</h3>
          <p>${escapeHtml(assistant.body || assistant.text)}</p>
          <small>${escapeHtml(assistant.date ?? state.currentDate ?? "")}</small>
        </article>
        <div class="news-inbox-list" aria-label="받은 뉴스와 공문">
          ${items.slice(0, 7).map(renderInboxNewsItem).join("")}
        </div>
        ${lead ? `
          <article class="news-inbox-feature is-${escapeAttribute(logTypeClass(lead.type))}" data-news-type="${escapeAttribute(lead.type)}">
            <span>${escapeHtml(lead.source ?? lead.tag ?? "뉴스")}</span>
            <h3>${escapeHtml(lead.headline)}</h3>
            <p>${escapeHtml(lead.body || lead.text)}</p>
            <small>${escapeHtml(lead.date ?? state.currentDate ?? "")}</small>
          </article>
        ` : ""}
      </div>
    </section>
  `;
}

function buildNewsInboxItems(state, selectedTeam, manager) {
  const normalized = (state.logs ?? []).map((log) => normalizeLogItem(log, state));
  const fallbacks = [
    buildFallbackAssistantBriefing(state, selectedTeam, manager),
    buildFallbackMediaBriefing(state, selectedTeam)
  ];
  const merged = [...normalized, ...fallbacks];
  const seen = new Set();
  return merged.filter((item) => {
    const key = `${item.date ?? ""}-${item.type ?? ""}-${item.source ?? item.tag ?? ""}-${item.headline ?? item.text ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function renderInboxNewsItem(item, index) {
  const type = logTypeClass(item.type);
  return `
    <article class="news-inbox-item ${type ? `is-${escapeAttribute(type)}` : ""}" data-news-type="${escapeAttribute(item.type)}">
      <span>${escapeHtml(item.source ?? item.tag ?? "뉴스")}</span>
      <strong>${escapeHtml(item.headline ?? item.text ?? "새 소식")}</strong>
      <small>${escapeHtml(item.date ?? "")} · ${index === 0 ? "방금 도착" : "읽지 않음"}</small>
    </article>
  `;
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
          <button class="decision-choice" data-action="resolve-mail-decision" data-decision-action="${escapeAttribute(option.action ?? "acknowledge")}">
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
  return [{ action: "acknowledge", label: "확인", note: "보고 처리" }];
}

function buildFallbackAssistantBriefing(state, selectedTeam, manager) {
  const teamName = getTeamShortName(selectedTeam) ?? "우리 팀";
  return {
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
  if (screen === "team-select") return "함께할 구단을 고르세요";
  if (screen === "manager-setup") return "감독 프로필 작성";
  if (screen === "appointment") return "취임식과 첫 기자회견";
  return "프리시즌을 시작합니다";
}

function onboardingLead(screen, selectedTeam) {
  if (screen === "team-select") return "프런트 첫날, 맡을 구단을 선택하세요.";
  if (screen === "manager-setup") return `${getTeamName(selectedTeam) ?? "선택한 구단"}의 새 감독으로 등록됩니다.`;
  if (screen === "appointment") return "구단 공식 취임식 뒤 첫 인터뷰 답변이 감독실 브리핑과 뉴스함에 남습니다.";
  return "구단을 고르고 감독 이름과 나이를 정한 뒤 취임식으로 시즌을 엽니다.";
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
          <input name="managerName" type="text" maxlength="12" autocomplete="name" value="${escapeAttribute(manager.name === "임시 감독" ? "" : manager.name)}" placeholder="예: 김민준" required>
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
      <div class="start-ticket">
        <span>Spring Camp</span>
        <strong>Preseason Day 1</strong>
        <small>Front Office Open</small>
      </div>
      <div class="start-preview-grid">
        <span><strong>10</strong><small>구단</small></span>
        <span><strong>720</strong><small>경기</small></span>
        <span><strong>1</strong><small>일차</small></span>
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
  });

  root.querySelector("[data-action='back-to-start']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "welcome" };
    render(root, state);
  });

  (root.querySelectorAll?.("[data-action='choose-start-team']") ?? []).forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTeamId = button.dataset.teamId;
      state.ui = { ...(state.ui ?? {}), screen: "manager-setup" };
      render(root, state);
    });
  });

  root.querySelector("[data-action='back-to-team-select']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "team-select" };
    render(root, state);
  });

  root.querySelector("[data-action='back-to-manager-setup']")?.addEventListener("click", () => {
    state.ui = { ...(state.ui ?? {}), screen: "manager-setup" };
    render(root, state);
  });

  root.querySelector("[data-manager-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(form.elements.managerName?.value ?? "").trim();
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
    state.logs = [
      ...buildAppointmentNewsLogs(state, selectedTeam, manager, answers),
      ...((state.logs ?? []))
    ].slice(0, 60);
    state.ui = { ...(state.ui ?? {}), screen: "game" };
    render(root, state);
    setStatus(root, `${manager.name} 감독 취임 완료. 프리시즌 캠프에 합류했습니다.`);
  });

  root.querySelector("[data-action='load-save-start']")?.addEventListener("click", () => {
    openSaveFile()
      .then((text) => {
        const loadedState = importGameState(text);
        loadedState.ui = { ...(loadedState.ui ?? {}), screen: "game" };
        replaceState(state, loadedState);
        render(root, state);
        setStatus(root, "저장 파일을 불러왔어요.");
      })
      .catch(() => {});
  });
}

function renderCommandCenterPanels(gmDesk) {
  const { tradeMarket, scoutAssignments, inbox } = gmDesk;
  const executableProposal = findExecutableTradeProposal(tradeMarket.proposals);
  const topProposal = executableProposal ?? tradeMarket.proposals?.[0];

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
      <b>${formatNumber(assignment.queueRank)}</b>
    </li>
  `).join("");
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

  root.querySelectorAll("[data-action='resolve-mail-decision']").forEach((button) => {
    button.addEventListener("click", () => {
      const result = resolveMailDecision(state, button.dataset.decisionAction || "acknowledge");
      render(root, state);
      setStatus(root, result.message || "긴급 보고를 처리했습니다.");
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
    render(root, state);
    setStatus(root, "라인업을 저장했습니다. 다음 경기 시뮬레이션에 이 타순이 적용됩니다.");
  });

  root.querySelector("[data-action='auto-lineup']")?.addEventListener("click", () => {
    const selectedTeam = getSelectedTeam(state);
    if (!selectedTeam) return;
    selectedTeam.lineupCard = null;
    render(root, state);
    setStatus(root, "자동 추천 라인업으로 되돌렸습니다.");
  });

  root.querySelectorAll("[data-action='next-day']").forEach((button) => {
    button.addEventListener("click", () => {
      if (stopForBlockingMail(root, state)) return;
      simulateDay(state);
      render(root, state);
    });
  });

  root.querySelectorAll("[data-action='week']").forEach((button) => {
    button.addEventListener("click", () => {
      if (stopForBlockingMail(root, state)) return;
      const beforeDate = state.currentDate;
      const beforeGames = Number(state.gamesPlayed ?? 0);
      simulateDays(state, 7);
      const gamesDelta = Number(state.gamesPlayed ?? 0) - beforeGames;
      render(root, state);
      setStatus(root, `빠른 주간 진행: ${beforeDate} → ${state.currentDate}, ${formatNumber(gamesDelta)}경기 완료.`);
    });
  });

  root.querySelector("[data-action='watch-next-game']")?.addEventListener("click", () => {
    if (stopForBlockingMail(root, state)) return;
    if (state.phase !== "regular") {
      setStatus(root, "프리시즌에는 경기 보기로 개막전까지 건너뛰지 않습니다. 캠프 하루 진행으로 뉴스함을 확인하세요.");
      return;
    }
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
    setStatus(root, result.ok ? `경기 보기 시작: ${result.message}` : result.message);
  });

  root.querySelector("[data-action='simulate-next-game']")?.addEventListener("click", () => {
    if (stopForBlockingMail(root, state)) return;
    if (state.phase !== "regular") {
      setStatus(root, "프리시즌에는 경기 시뮬레이션을 열지 않습니다. 개막 후 다음 경기 패널이 활성화됩니다.");
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
    setStatus(root, result.ok ? `경기 시뮬레이션 완료: ${result.message}` : result.message);
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
    if (state.draft?.status === "ready") {
      simulateDraft(state);
      message = "신인 드래프트 11라운드를 완료했어요.";
    } else if (state.draft?.status === "complete") {
      message = "드래프트 결과가 이미 확정되어 있어요.";
    } else {
      initializeDraft(state);
      message = "드래프트 보드 150명을 만들었어요.";
    }
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, message);
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
    if (state.secondaryDraft?.status === "ready") {
      simulateSecondaryDraft(state);
      message = "2차 드래프트 지명 결과를 확정했어요.";
    } else if (state.secondaryDraft?.status === "complete") {
      message = "2차 드래프트 결과가 이미 확정되어 있어요.";
    } else {
      initializeSecondaryDraft(state);
      message = "2차 드래프트 보호명단과 비보호 풀을 만들었어요.";
    }
    state.ui = { ...(state.ui ?? {}), activeTab: "drafts" };
    render(root, state);
    setStatus(root, message);
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
          <small>경기 보기/시뮬레이션은 정규시즌 개막 후 활성화됩니다.</small>
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
        <button class="button button-primary" data-action="watch-next-game" ${disabled}>경기 보기</button>
        <button class="button button-soft" data-action="simulate-next-game" ${disabled}>시뮬레이션</button>
        <small>${nextGame?.ok ? `${escapeHtml(getTeamShortName(opponent) ?? "상대")}전 · 도트 중계 또는 결과만 선택` : "정규시즌 가능 상태에서 진행됩니다."}</small>
      </div>
    </section>
  `;
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
          <button class="button button-soft" data-action="close-player-detail" type="button">닫기</button>
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
          <span class="mini-label">2026 시즌 기록</span>
          <div class="player-stat-grid">
            ${pitcher ? renderPitcherDetailStats(stats) : renderBatterDetailStats(stats)}
          </div>
        </article>
      </div>
    </section>
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
        ${board.slice(0, 8).map((prospect) => renderDraftCard(prospect, selectedTeamId)).join("")}
      </div>
      <ol class="draft-pick-list">
        ${draft?.picks?.length ? draft.picks.slice(0, 14).map(renderDraftPick).join("") : renderEmptyListItem("드래프트 버튼을 누르면 1라운드부터 결과가 쌓입니다.")}
      </ol>
    </section>
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

function renderDraftCard(prospect, selectedTeamId) {
  const classes = [
    "draft-card",
    prospect.picked ? "is-picked" : "",
    String(prospect.selectedByTeamId ?? "") === String(selectedTeamId) ? "is-user-fit" : ""
  ].filter(Boolean).join(" ");
  return `
    <article class="${classes}">
      <div>
        <span class="mini-label">${escapeHtml(prospect.classType)} · ${escapeHtml(prospect.position)}</span>
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
      <small>${prospect.picked ? `${formatNumber(prospect.pickNumber)}픽 · ${escapeHtml(prospect.selectedByTeamName)}` : "스카우트 코드 후보"}</small>
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
  const selectedPicks = (draft?.picks ?? []).filter((pick) => String(pick.teamId) === String(selectedTeamId));
  const lostPlayers = (draft?.picks ?? []).filter((pick) => String(pick.fromTeamId) === String(selectedTeamId));
  const cards = [
    ...(protection.protected ?? []).slice(0, 4),
    ...(protection.exposed ?? []).slice(0, 4)
  ];
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
        ${cards.length ? cards.map(renderProtectionCard).join("") : `<div class="empty-card">보호명단을 기다리고 있어요.</div>`}
      </div>
      <ol class="secondary-pick-list">
        ${draft?.picks?.length ? draft.picks.slice(0, 14).map(renderSecondaryPick).join("") : renderEmptyListItem("2차 드래프트 버튼을 누르면 지명 결과가 쌓입니다.")}
      </ol>
    </section>
  `;
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

function renderProtectionCard(player) {
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
  const sequence = buildGamecastSequence(game, state);
  latestGamecastSequence = sequence;
  const feedEvents = sequence.events.length
    ? sequence.events
    : sortGamecastEvents(events).slice(-GAMECAST_PLAYBACK_COUNT).map((event) => normalizeGamecastEvent(event, state));
  const featured = feedEvents[0] ?? sequence.events[0] ?? null;
  const broadcastModal = renderGamecastBroadcastModal(state, sequence, away, home, feedEvents, featured);

  return `
    <article class="panel gamecast-panel" id="gamecast" data-gamecast-instance-root>
      <div class="panel-head">
        <div>
          <span class="mini-label">Gamecast</span>
          <h2>${sequence.mode === "watch" ? "경기 보기 도트 중계" : "빠른 도트 중계"}</h2>
        </div>
        <div class="gamecast-head-actions">
          ${game ? `<button class="button button-soft gamecast-expand-button" data-action="open-gamecast-broadcast" type="button">큰 화면</button>` : ""}
          <span class="pill">${sequence.mode === "watch" ? "LIVE" : `${formatNumber(events.length)} PA`}</span>
        </div>
      </div>
      <div class="gamecast-layout">
        <div class="gamecast-board" data-gamecast-board>
          <div class="gamecast-scoreline">
            <span>
              ${renderTeamLogo(away, "team-logo mini-logo")}
              <b>${escapeHtml(getTeamShortName(away) ?? "Away")}</b>
              <strong>${formatNumber(sequence.startAway)}</strong>
            </span>
            <span>
              ${renderTeamLogo(home, "team-logo mini-logo")}
              <b>${escapeHtml(getTeamShortName(home) ?? "Home")}</b>
              <strong>${formatNumber(sequence.startHome)}</strong>
            </span>
          </div>
          ${renderGamecastControls(sequence)}
          <div class="gamecast-screen ${featured?.outcome === "homeRun" ? "is-homer" : ""}" data-gamecast-screen aria-hidden="true">
            ${renderGamecastPixelStage("inline")}
          </div>
          <div class="gamecast-now">
            <strong>${featured ? escapeHtml(gamecastNowTitle(featured)) : "경기 종료"}</strong>
            <small>${featured ? escapeHtml(gamecastNowDetail(featured)) : "타석 이벤트 대기"}</small>
          </div>
        </div>
        <ol class="gamecast-feed">
          ${feedEvents.length ? feedEvents.map((event) => renderGamecastEvent(event, state)).join("") : `<li><span>경기 이벤트 대기</span><small>PA 기록 없음</small></li>`}
        </ol>
      </div>
    </article>
    ${broadcastModal}
  `;
}

function renderGamecastBroadcastModal(state, sequence, away, home, feedEvents, featured) {
  if (sequence.mode !== "watch" || state.ui?.gamecastExpanded !== true) return "";

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
              <span>
                ${renderTeamLogo(away, "team-logo mini-logo")}
                <b>${escapeHtml(getTeamShortName(away) ?? "Away")}</b>
                <strong>${formatNumber(sequence.startAway)}</strong>
              </span>
              <span>
                ${renderTeamLogo(home, "team-logo mini-logo")}
                <b>${escapeHtml(getTeamShortName(home) ?? "Home")}</b>
                <strong>${formatNumber(sequence.startHome)}</strong>
              </span>
            </div>
            ${renderGamecastControls(sequence, "broadcast")}
            <div class="gamecast-screen gamecast-screen-large ${featured?.outcome === "homeRun" ? "is-homer" : ""}" data-gamecast-screen aria-hidden="true">
              ${renderGamecastPixelStage("broadcast")}
            </div>
            <div class="gamecast-now gamecast-broadcast-now">
              <strong>${featured ? escapeHtml(gamecastNowTitle(featured)) : "경기 종료"}</strong>
              <small>${featured ? escapeHtml(gamecastNowDetail(featured)) : "타석 이벤트 대기"}</small>
            </div>
            <ol class="gamecast-feed gamecast-broadcast-feed">
              ${feedEvents.length ? feedEvents.map((event) => renderGamecastEvent(event, state)).join("") : `<li><span>경기 이벤트 대기</span><small>PA 기록 없음</small></li>`}
            </ol>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderGamecastPixelStage(instanceId) {
  const safeInstanceId = escapeAttribute(instanceId);
  return `
    <div class="gamecast-pixel-stage" data-gamecast-stage>
      <canvas id="${GAMECAST_CANVAS_ID}-${safeInstanceId}" class="gamecast-pixel-canvas" width="${GAMECAST_PIXEL_W}" height="${GAMECAST_PIXEL_H}" data-gamecast-canvas data-pixel-w="${GAMECAST_PIXEL_W}" data-pixel-h="${GAMECAST_PIXEL_H}" aria-hidden="true"></canvas>
      <span class="gamecast-player-label" data-gamecast-player-label></span>
      <span class="gamecast-action-burst" data-gamecast-action-burst></span>
    </div>
  `;
}

function renderGamecastControls(sequence, variant = "inline") {
  if (sequence.mode !== "watch") return "";
  return `
    <div class="gamecast-controls ${variant === "broadcast" ? "is-broadcast" : ""}" aria-label="중계 재생 속도">
      ${GAMECAST_SPEED_OPTIONS.map((speed) => `
        <button class="gamecast-speed-button ${speed === 1 ? "is-active" : ""}" data-gamecast-speed="${speed}" type="button" aria-pressed="${speed === 1 ? "true" : "false"}">x${formatNumber(speed)}</button>
      `).join("")}
      <button class="gamecast-speed-button is-skip" data-gamecast-skip type="button">스킵</button>
    </div>
  `;
}

function getFocusedGamecastGame(state) {
  const games = state.lastGames ?? [];
  const focusId = String(state.ui?.focusGameId ?? "");
  return (focusId ? games.find((game) => String(game?.id ?? "") === focusId) : null) ?? games[0] ?? null;
}

function renderGamecastEvent(event, state) {
  const normalized = event?.id ? event : normalizeGamecastEvent(event, state);
  return `
    <li class="${normalized.runs > 0 ? "is-scoring" : ""}" data-gamecast-event-id="${escapeAttribute(normalized.id)}">
      <span>
        <b>${formatNumber(normalized.inning)}회 ${normalized.side === "home" ? "말" : "초"}</b>
        ${escapeHtml(normalized.offenseLabel || eventTeamLabel(normalized, state))}
      </span>
      <small>${escapeHtml(gamecastNowDetail(normalized))}</small>
    </li>
  `;
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
    paMs: mode === "watch" ? GAMECAST_WATCH_PA_MS : GAMECAST_PA_MS,
    gapMs: mode === "watch" ? GAMECAST_WATCH_GAP_MS : GAMECAST_PA_GAP_MS,
    events: tail.map((event) => normalizeGamecastEvent(event, state))
  };
}

function sortGamecastEvents(events) {
  return [...(events ?? [])].sort((a, b) =>
    (Number(a?.inning ?? 0) - Number(b?.inning ?? 0)) ||
    ((a?.side === "home" ? 1 : 0) - (b?.side === "home" ? 1 : 0)) ||
    (Number(a?.sequence ?? 0) - Number(b?.sequence ?? 0))
  );
}

function normalizeGamecastEvent(event, state) {
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
  const teamColor = normalizeHexColor(getTeamColor(offenseTeam), side === "home" ? "#c64b74" : "#315288");
  const defenseColor = normalizeHexColor(getTeamColor(defenseTeam), side === "home" ? "#315288" : "#c64b74");
  const teamJerseyColor = side === "home" ? "#fffefb" : "#d9d3ca";
  const teamJerseyShadow = side === "home" ? "#e8ded0" : "#c9bcab";
  const defenseJerseyColor = side === "home" ? "#d9d3ca" : "#fffefb";
  const defenseJerseyShadow = side === "home" ? "#c9bcab" : "#e8ded0";

  return {
    id: `${event?.gameId ?? "game"}-${side}-${inning}-${sequence}-${event?.outcome ?? "idle"}`,
    outcome: String(event?.outcome ?? "out"),
    inning,
    side,
    sequence,
    offenseTeamId: event?.offenseTeamId ?? "",
    defenseTeamId: event?.defenseTeamId ?? "",
    offenseLabel: eventTeamLabel(event, state),
    hitterName: String(event?.hitterName ?? "타자"),
    pitcherName: String(event?.pitcherName ?? "투수"),
    defenderName: String(event?.defenderName ?? ""),
    battedBallType: String(event?.battedBallType ?? ""),
    fieldingPosition: String(event?.fieldingPosition ?? ""),
    doublePlay: Boolean(event?.doublePlay),
    reachedOnError: Boolean(event?.reachedOnError),
    ballparkName: String(event?.ballparkName ?? ""),
    runs,
    rbi: Number(event?.rbi ?? 0),
    outsBefore,
    outsAfter,
    basesBefore: toBaseTriple(event?.basesBefore),
    basesAfter: toBaseTriple(event?.basesAfter),
    scoredRunners,
    scoredRunnerCount: scoredRunners.length,
    inningEnded,
    teamColor,
    teamJerseyColor,
    teamJerseyShadow,
    teamAccentColor: mixHexColors(teamColor, "#23202a", 0.08),
    hitterUniformNumber: gamecastUniformNumber(event?.hitterName, event?.hitterId ?? event?.batterId),
    defenseColor,
    defenseJerseyColor,
    defenseJerseyShadow,
    defenseAccentColor: mixHexColors(defenseColor, "#23202a", 0.08),
    teamTrailColor: mixHexColors(teamColor, "#fffefb", 0.42)
  };
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

function gamecastNowTitle(event) {
  return `${formatNumber(event?.inning ?? 1)}회 ${event?.side === "home" ? "말" : "초"} · ${event?.offenseLabel ?? ""}`;
}

function gamecastNowDetail(event) {
  const runs = Number(event?.runs ?? 0);
  const parts = [`${event?.hitterName || "타자"} ${outcomeLabel(event?.outcome)}`];
  const batted = battedBallTypeLabel(event?.battedBallType);
  const fielder = event?.defenderName ? `${event.defenderName}${event.fieldingPosition ? `(${event.fieldingPosition})` : ""}` : "";
  if (batted) parts.push(batted);
  if (fielder && ["out", "error"].includes(event?.outcome)) parts.push(fielder);
  if (event?.doublePlay) parts.push("병살");
  if (runs > 0) parts.push(`${formatNumber(runs)}득점`);
  return parts.join(" · ");
}

function battedBallTypeLabel(type) {
  if (type === "groundBall") return "땅볼";
  if (type === "lineDrive") return "라이너";
  if (type === "flyBall") return "뜬공";
  if (type === "popUp") return "팝플라이";
  return "";
}

function gamecastOutcomeClass(outcome) {
  if (outcome === "homeRun") return "is-homer";
  if (["single", "double", "triple"].includes(outcome)) return "is-hit";
  if (outcome === "walk") return "is-walk";
  if (outcome === "error") return "is-error";
  if (outcome === "strikeout") return "is-out";
  return "is-ball";
}

function initGamecastPixelScreen(root) {
  if (typeof cleanupGamecastPixelScreen === "function") {
    cleanupGamecastPixelScreen();
    cleanupGamecastPixelScreen = null;
  }

  const screens = [...(root?.querySelectorAll?.("[data-gamecast-screen]") ?? [])];
  const controllers = [];

  for (const screen of screens) {
    const board = screen.closest("[data-gamecast-board]");
    const instanceRoot = screen.closest("[data-gamecast-instance-root]") ?? root;
    const canvas = screen.querySelector("[data-gamecast-canvas]");
    const stage = screen.querySelector("[data-gamecast-stage]");
    const playerLabel = screen.querySelector("[data-gamecast-player-label]");
    const actionBurst = screen.querySelector("[data-gamecast-action-burst]");
    if (!board || !canvas || typeof canvas.getContext !== "function") continue;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    controllers.push(createGamecastPixelController({
      screen,
      stage,
      canvas,
      ctx,
      sequence: latestGamecastSequence,
      scoreNodes: [...board.querySelectorAll(".gamecast-scoreline strong")],
      nowTitle: board.querySelector(".gamecast-now strong"),
      nowDetail: board.querySelector(".gamecast-now small"),
      playerLabel,
      actionBurst,
      feedItems: [...instanceRoot.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]")],
      speedControls: [...board.querySelectorAll("[data-gamecast-speed]")],
      skipControls: [...board.querySelectorAll("[data-gamecast-skip]")]
    }));
  }

  cleanupGamecastPixelScreen = () => {
    for (const controller of controllers) controller.cleanup();
  };
}

function createGamecastPixelController({ screen, stage, canvas, ctx, sequence, scoreNodes, nowTitle, nowDetail, playerLabel, actionBurst, feedItems, speedControls = [], skipControls = [] }) {
  const palette = {
    outline: "#23202a",
    grassLo: "#4f8a73",
    grassHi: "#8fd0b4",
    grassEdge: "#3f7361",
    grassD: "#4f8a73",
    grassM: "#8fd0b4",
    grassL: "#8fd0b4",
    dirtD: "#c78a3e",
    dirtM: "#e8b866",
    dirtL: "#ffe39a",
    base: "#fffefb",
    baseSh: "#c9bcab",
    uniform: "#fffefb",
    uniformSh: "#e8ded0",
    uniformAway: "#d9d3ca",
    uniformInk: "#575160",
    uniformHi: "#ffffff",
    runner: "#c64b74",
    runnerL: "#e57a9b",
    defender: "#315288",
    defenderL: "#b9d9f7",
    defenderSh: "#223f68",
    bat: "#8a5f39",
    glove: "#7a4c2a",
    ballSeam: "#d92f42",
    ballGlow: "#fff3bf",
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
    skin: "#f2c79a",
    wall: "#24483a",
    wallCap: "#1b3a2e",
    track: "#caa25f",
    stand: "#6f6874",
    standD: "#575160",
    crowdA: "#c64b74",
    crowdB: "#b9d9f7",
    crowdC: "#ffe39a",
    crowdSkin: "#f2c79a",
    crowdHair: "#2d2630",
    pole: "#ffd23f",
    out: "#77717a"
  };
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const state = {
    animationFrame: 0,
    visible: true,
    hidden: typeof document !== "undefined" ? document.hidden : false,
    scale: 1,
    dpr: 1,
    playbackRate: 1,
    elapsedMs: 0,
    lastTimestamp: 0,
    done: false,
    shakeTimer: 0,
    offscreenTimer: 0,
    sequence: normalizeGamecastSequenceForPlayback(sequence),
    scoreNodes,
    nowTitle,
    nowDetail,
    playerLabel,
    actionBurst,
    feedItems,
    palette,
    fieldCache: buildGamecastFieldCache(palette),
    prefersReducedMotion,
    shakenEventId: ""
  };
  state.playbackRate = sanitizeGamecastSpeed(state.sequence.playbackRate);

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
    drawGamecastFrame(ctx, state, frame);
    syncGamecastDom(state, frame);
    return frame;
  };
  const finish = () => {
    state.done = true;
    state.elapsedMs = state.sequence.events.length * gamecastEventDuration(state.sequence);
    stop();
    renderCurrentFrame(true);
    syncGamecastSpeedControls(state, speedControls, skipControls);
  };
  const pauseOffscreen = () => {
    stop();
    const frame = buildGamecastFrameState(state, false);
    drawGamecastFrame(ctx, state, frame);
    syncGamecastDom(state, { ...frame, done: true });
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
      finish();
      return;
    }
    if (!state.visible) {
      pauseOffscreen();
      return;
    }
    if (!state.lastTimestamp) state.lastTimestamp = timestamp;
    const delta = Math.min(80, Math.max(0, timestamp - state.lastTimestamp));
    state.lastTimestamp = timestamp;
    state.elapsedMs += delta * state.playbackRate;
    const frame = renderCurrentFrame(false);
    if (shouldTriggerGamecastImpactShake(frame) && !state.prefersReducedMotion && state.shakenEventId !== frame.event.id) {
      triggerGamecastShake(screen, state);
      state.shakenEventId = frame.event.id;
    }
    if (frame.done) {
      state.done = true;
      stop();
      syncGamecastSpeedControls(state, speedControls, skipControls);
      return;
    }
    state.animationFrame = window.requestAnimationFrame(loop);
  };
  const start = () => {
    if (state.prefersReducedMotion || !state.sequence.events.length || state.done) {
      stop();
      state.done = true;
      renderCurrentFrame(true);
      return;
    }
    if (!state.animationFrame && state.visible && !state.hidden) {
      state.animationFrame = window.requestAnimationFrame(loop);
    }
  };
  const onVisibilityChange = () => {
    state.hidden = Boolean(document.hidden);
    if (state.hidden) finish();
    else start();
  };
  const setSpeed = (speed) => {
    state.playbackRate = sanitizeGamecastSpeed(speed);
    state.done = false;
    state.lastTimestamp = 0;
    syncGamecastSpeedControls(state, speedControls, skipControls);
    start();
  };
  const onSpeedClick = (event) => {
    event.preventDefault();
    setSpeed(event.currentTarget?.dataset?.gamecastSpeed);
  };
  const onSkipClick = (event) => {
    event.preventDefault();
    finish();
  };

  resize();
  renderCurrentFrame(state.prefersReducedMotion || !state.sequence.events.length);
  syncGamecastSpeedControls(state, speedControls, skipControls);
  for (const button of speedControls) button.addEventListener("click", onSpeedClick);
  for (const button of skipControls) button.addEventListener("click", onSkipClick);

  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
    resize();
    renderCurrentFrame(state.done || state.prefersReducedMotion);
  }) : null;
  resizeObserver?.observe(screen);

  const intersectionObserver = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
    state.visible = entries.some((entry) => entry.isIntersecting);
    if (state.visible) {
      clearOffscreenPause();
      start();
    } else {
      scheduleOffscreenPause();
    }
  }, { threshold: 0.05 }) : null;
  intersectionObserver?.observe(screen);

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  start();

  return {
    cleanup() {
      stop();
      if (state.shakeTimer) window.clearTimeout(state.shakeTimer);
      clearOffscreenPause();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      for (const button of speedControls) button.removeEventListener("click", onSpeedClick);
      for (const button of skipControls) button.removeEventListener("click", onSkipClick);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      screen.classList.remove("is-shaking");
      if (state.playerLabel) state.playerLabel.classList.remove("is-visible", "is-scoring");
      if (state.actionBurst) state.actionBurst.className = "gamecast-action-burst";
      for (const item of state.feedItems ?? []) item.classList.remove("is-live");
    }
  };
}

function normalizeGamecastSequenceForPlayback(sequence) {
  return {
    id: String(sequence?.id ?? "gamecast-idle"),
    startAway: Number(sequence?.startAway ?? sequence?.finalAway ?? 0),
    startHome: Number(sequence?.startHome ?? sequence?.finalHome ?? 0),
    finalAway: Number(sequence?.finalAway ?? sequence?.startAway ?? 0),
    finalHome: Number(sequence?.finalHome ?? sequence?.startHome ?? 0),
    mode: String(sequence?.mode ?? "summary"),
    paMs: Math.max(80, Number(sequence?.paMs ?? GAMECAST_PA_MS)),
    gapMs: Math.max(0, Number(sequence?.gapMs ?? GAMECAST_PA_GAP_MS)),
    playbackRate: sanitizeGamecastSpeed(sequence?.playbackRate),
    events: Array.isArray(sequence?.events) ? sequence.events : []
  };
}

function gamecastEventDuration(sequence) {
  return Math.max(80, Number(sequence?.paMs ?? GAMECAST_PA_MS)) + Math.max(0, Number(sequence?.gapMs ?? GAMECAST_PA_GAP_MS));
}

function sanitizeGamecastSpeed(value) {
  const speed = Number(value);
  return GAMECAST_SPEED_OPTIONS.includes(speed) ? speed : 1;
}

function shouldTriggerGamecastImpactShake(frame) {
  const event = frame.event;
  if (!event || frame.done) return false;
  const progress = Number(frame.progress ?? 0);
  if (event.outcome === "homeRun" && progress >= 0.68) return true;
  if (Number(event.runs ?? 0) > 0 && progress >= 0.64) return true;
  if (["double", "triple", "strikeout"].includes(event.outcome) && progress >= 0.36) return true;
  return false;
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
  const available = Math.max(GAMECAST_PIXEL_W, Math.floor((rect.width || 240) - horizontalInset));
  const scale = Math.max(1, Math.floor(available / GAMECAST_PIXEL_W));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  state.scale = scale;
  state.dpr = dpr;
  if (stage) {
    stage.style.width = `${GAMECAST_PIXEL_W * scale}px`;
    stage.style.height = `${GAMECAST_PIXEL_H * scale}px`;
  }
  canvas.style.width = `${GAMECAST_PIXEL_W * scale}px`;
  canvas.style.height = `${GAMECAST_PIXEL_H * scale}px`;
  canvas.width = Math.round(GAMECAST_PIXEL_W * scale * dpr);
  canvas.height = Math.round(GAMECAST_PIXEL_H * scale * dpr);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(canvas.width / GAMECAST_PIXEL_W, 0, 0, canvas.height / GAMECAST_PIXEL_H, 0, 0);
}

function drawGamecastFrame(ctx, state, frame) {
  const palette = state.palette;
  if (state.fieldCache) ctx.drawImage(state.fieldCache, 0, 0);
  else drawGamecastFieldTo(ctx, palette);
  drawPixelAtmosphere(ctx, palette, frame);
  drawPixelFielders(ctx, palette, frame);
  drawGamecastBaseRunners(ctx, palette, frame.bases, frame);
  drawPixelOutPips(ctx, palette, frame);
  drawPixelSideIcon(ctx, palette, frame);
  drawPixelAction(ctx, palette, frame);
  if (frame.scoreFlash) drawPixelScoreBurst(ctx, palette, frame);
  drawPixelCameraFx(ctx, palette, frame);
  drawPixelBroadcastBug(ctx, palette, frame);
}

function buildGamecastFieldCache(palette) {
  if (typeof document === "undefined") return null;
  const field = document.createElement("canvas");
  field.width = GAMECAST_PIXEL_W;
  field.height = GAMECAST_PIXEL_H;
  const fieldCtx = field.getContext("2d");
  if (!fieldCtx) return null;
  fieldCtx.imageSmoothingEnabled = false;
  drawGamecastFieldTo(fieldCtx, palette);
  return field;
}

function drawGamecastFieldTo(ctx, palette) {
  drawBallparkOutfield(ctx, palette);
  drawBallparkInfield(ctx, palette);
  drawBallparkBases(ctx, palette);
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

function drawBallparkOutfield(ctx, palette) {
  const fx = gamecastX(60);
  const fy = gamecastY(104);
  const wallRadius = gamecastSize(90);
  for (let y = 0; y < GAMECAST_PIXEL_H; y += 1) {
    for (let x = 0; x < GAMECAST_PIXEL_W; x += 1) {
      const distance = Math.hypot(x - fx, y - fy);
      if (distance > wallRadius) {
        const crowd = [palette.crowdA, palette.crowdB, palette.crowdC][(x + y) % 3];
        const color = (x * 5 + y * 3) % 9 === 0 ? crowd : ((x + y) % 2 ? palette.stand : palette.standD);
        drawPixel(ctx, x, y, color);
      } else if (distance > wallRadius - gamecastSize(2)) {
        drawPixel(ctx, x, y, y < gamecastY(30) ? palette.wallCap : palette.wall);
      } else if (distance > wallRadius - gamecastSize(5)) {
        drawPixel(ctx, x, y, palette.track);
      } else {
        drawPixel(ctx, x, y, Math.floor(distance / gamecastSize(6)) % 2 ? palette.grassLo : palette.grassHi);
      }
    }
  }

  drawPixelCrowd(ctx, palette, fx, fy, wallRadius);
  drawBallparkArchitecture(ctx, palette);

  ctx.fillStyle = palette.outline;
  ctx.fillRect(gamecastX(48), gamecastY(4), gamecastSize(24), gamecastSize(8));
  ctx.fillStyle = "#12211b";
  ctx.fillRect(gamecastX(49), gamecastY(5), gamecastSize(22), gamecastSize(6));
  for (let index = 0; index < 6; index += 1) {
    ctx.fillStyle = index % 2 ? palette.crowdC : palette.grassHi;
    ctx.fillRect(gamecastX(51 + index * 3), gamecastY(8), gamecastSize(1), gamecastSize(1));
  }

  for (let y = gamecastY(30); y < gamecastY(48); y += 1) {
    drawPixel(ctx, gamecastX(15), y, palette.pole);
    drawPixel(ctx, gamecastX(105), y, palette.pole);
  }

  const bases = gamecastBasePositions();
  drawPixelLine(ctx, bases.home.x, bases.home.y, gamecastX(16), gamecastY(46), palette.base, gamecastSize(1));
  drawPixelLine(ctx, bases.home.x, bases.home.y, gamecastX(104), gamecastY(46), palette.base, gamecastSize(1));
}

function drawBallparkArchitecture(ctx, palette) {
  drawPixelLightTower(ctx, palette, gamecastX(9), gamecastY(4), -1);
  drawPixelLightTower(ctx, palette, gamecastX(111), gamecastY(4), 1);

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

function drawPixelCrowd(ctx, palette, fx, fy, wallRadius) {
  const stepX = gamecastSize(4);
  const stepY = gamecastSize(5);
  const startY = gamecastY(2);
  const endY = gamecastY(43);
  const shirts = [palette.crowdA, palette.crowdB, palette.crowdC, palette.standD];

  for (let y = startY; y < endY; y += stepY) {
    const row = Math.floor((y - startY) / stepY);
    for (let x = gamecastX(2) + (row % 2 ? gamecastSize(2) : 0); x < GAMECAST_PIXEL_W - gamecastX(3); x += stepX) {
      const distance = Math.hypot(x - fx, y - fy);
      if (distance <= wallRadius + gamecastSize(1)) continue;
      if ((row * 11 + x) % 37 === 0) {
        drawPixelFanSign(ctx, palette, x - 1, y + 1, shirts[(row + x + 1) % shirts.length]);
        continue;
      }
      drawPixelFan(ctx, palette, x, y, shirts[(row + x) % shirts.length]);
    }
  }
}

function drawPixelFan(ctx, palette, x, y, shirt) {
  ctx.fillStyle = palette.crowdHair;
  ctx.fillRect(x, y, 4, 1);
  ctx.fillStyle = shirt;
  ctx.fillRect(x + 1, y, 2, 1);
  ctx.fillStyle = palette.crowdSkin;
  ctx.fillRect(x + 1, y + 1, 2, 1);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x + 1, y + 1, 1, 1);
  ctx.fillRect(x + 2, y + 1, 1, 1);
  ctx.fillStyle = shirt;
  ctx.fillRect(x, y + 2, 4, 3);
  ctx.fillStyle = palette.crowdSkin;
  ctx.fillRect(x - 1, y + 3, 1, 1);
  ctx.fillRect(x + 4, y + 2, 1, 1);
  ctx.fillStyle = palette.stand;
  ctx.fillRect(x, y + 5, 4, 1);
}

function drawPixelFanSign(ctx, palette, x, y, color) {
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, 6, 4);
  ctx.fillStyle = palette.base;
  ctx.fillRect(x + 1, y + 1, 4, 2);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 1, 2, 1);
  ctx.fillRect(x + 1, y + 2, 1, 1);
  ctx.fillRect(x + 4, y + 2, 1, 1);
  ctx.fillStyle = palette.crowdSkin;
  ctx.fillRect(x, y + 4, 1, 1);
  ctx.fillRect(x + 5, y + 4, 1, 1);
}

function drawBallparkInfield(ctx, palette) {
  const bases = gamecastBasePositions();
  drawPixelLine(ctx, bases.home.x, bases.home.y, bases.first.x, bases.first.y, palette.dirtM, gamecastSize(3));
  drawPixelLine(ctx, bases.first.x, bases.first.y, bases.second.x, bases.second.y, palette.dirtM, gamecastSize(3));
  drawPixelLine(ctx, bases.second.x, bases.second.y, bases.third.x, bases.third.y, palette.dirtM, gamecastSize(3));
  drawPixelLine(ctx, bases.third.x, bases.third.y, bases.home.x, bases.home.y, palette.dirtM, gamecastSize(3));

  for (const base of [bases.first, bases.second, bases.third]) fillPixelCircle(ctx, base.x, base.y, gamecastSize(5), palette.dirtM);
  fillPixelCircle(ctx, bases.home.x, bases.home.y, gamecastSize(6), palette.dirtM);
  fillPixelCircle(ctx, bases.mound.x, bases.mound.y, gamecastSize(6), palette.dirtL);
  fillPixelCircle(ctx, bases.mound.x, bases.mound.y, gamecastSize(4), palette.dirtM);

  ctx.fillStyle = palette.base;
  ctx.fillRect(bases.mound.x - gamecastSize(1), bases.mound.y - gamecastSize(1), gamecastSize(3), gamecastSize(1));
  ctx.fillStyle = palette.dirtL;
  ctx.fillRect(bases.home.x - gamecastSize(8), bases.home.y - gamecastSize(5), gamecastSize(3), gamecastSize(7));
  ctx.fillRect(bases.home.x + gamecastSize(6), bases.home.y - gamecastSize(5), gamecastSize(3), gamecastSize(7));
  ctx.fillStyle = palette.chalkSh;
  ctx.fillRect(bases.home.x - gamecastSize(9), bases.home.y + gamecastSize(3), gamecastSize(18), gamecastSize(1));
  ctx.fillRect(bases.home.x - gamecastSize(10), bases.home.y - gamecastSize(6), gamecastSize(1), gamecastSize(9));
  ctx.fillRect(bases.home.x + gamecastSize(10), bases.home.y - gamecastSize(6), gamecastSize(1), gamecastSize(9));
  drawPixelSprite(ctx, palette, bases.home.x - gamecastSize(2), bases.home.y - gamecastSize(2), [
    [0, 0, palette.base],
    [1, 0, palette.base],
    [2, 0, palette.base],
    [1, 1, palette.base]
  ]);

  drawPixelBaseCoach(ctx, palette, { x: bases.first.x + gamecastSize(13), y: bases.first.y + gamecastSize(7) });
  drawPixelBaseCoach(ctx, palette, { x: bases.third.x - gamecastSize(13), y: bases.third.y + gamecastSize(7) });
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
  const y = gamecastY(91);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x, y, gamecastSize(31), gamecastSize(14));
  ctx.fillStyle = "#12211b";
  ctx.fillRect(x + gamecastSize(1), y + gamecastSize(1), gamecastSize(29), gamecastSize(12));

  drawPixelScoreDigits(ctx, palette, x + gamecastSize(3), y + gamecastSize(3), Number(frame.score?.away ?? 0), palette.base);
  ctx.fillStyle = palette.baseSh;
  ctx.fillRect(x + gamecastSize(11), y + gamecastSize(6), gamecastSize(2), gamecastSize(1));
  drawPixelScoreDigits(ctx, palette, x + gamecastSize(15), y + gamecastSize(3), Number(frame.score?.home ?? 0), palette.base);

  const sideY = y + gamecastSize(3);
  ctx.fillStyle = frame.side === "home" ? palette.homerL : palette.defenderL;
  ctx.fillRect(x + gamecastSize(24), sideY, gamecastSize(3), gamecastSize(2));
  ctx.fillStyle = palette.baseSh;
  ctx.fillRect(x + gamecastSize(24), sideY + gamecastSize(4), gamecastSize(1 + Math.min(3, Number(frame.outs ?? 0)) * 2), gamecastSize(1));

  const bases = [frame.bases?.[0], frame.bases?.[1], frame.bases?.[2]];
  const bx = x + gamecastSize(25);
  const by = y + gamecastSize(10);
  [[1, 0], [0, -1], [-1, 0]].forEach(([dx, dy], index) => {
    ctx.fillStyle = bases[index] ? palette.spark : palette.stand;
    ctx.fillRect(bx + gamecastSize(dx * 2), by + gamecastSize(dy * 2), gamecastSize(2), gamecastSize(2));
  });

  if (frame.event?.doublePlay) drawMiniPixelLetters(ctx, palette, "DP", x + gamecastSize(2), y + gamecastSize(10), palette.spark);
  else if (frame.event?.fieldingPosition) drawMiniPixelLetters(ctx, palette, frame.event.fieldingPosition.slice(0, 2), x + gamecastSize(2), y + gamecastSize(10), palette.defenderL);
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
  const letters = {
    P: ["110", "101", "110", "100", "100"],
    C: ["111", "100", "100", "100", "111"],
    B: ["110", "101", "110", "101", "110"],
    S: ["111", "100", "111", "001", "111"],
    L: ["100", "100", "100", "100", "111"],
    R: ["110", "101", "110", "101", "101"],
    F: ["111", "100", "110", "100", "100"],
    D: ["110", "101", "101", "101", "110"]
  };
  ctx.fillStyle = color;
  String(text ?? "").toUpperCase().slice(0, 2).split("").forEach((letter, letterIndex) => {
    const map = letters[letter] ?? letters.F;
    map.forEach((row, rowIndex) => {
      [...row].forEach((cell, colIndex) => {
        if (cell === "1") ctx.fillRect(x + gamecastSize(letterIndex * 4 + colIndex), y + gamecastSize(rowIndex), gamecastSize(1), gamecastSize(1));
      });
    });
  });
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
    drawPixelRunner(ctx, palette, defender.position, defender.squash, defender.color, defender.runFrame, {
      jerseyColor: defender.jerseyColor,
      jerseyShadow: defender.jerseyShadow,
      accentColor: defender.accentColor,
      pose: defender.pose,
      fieldingKey: defender.fieldingKey,
      uniformNumber: defender.uniformNumber
    });
  }
  for (const runner of frame.runners ?? []) {
    drawTrail(ctx, runner.trailColor ?? palette.runnerL, runner.trail);
    drawPixelRunnerDust(ctx, palette, runner.dust);
  }
  if (frame.contactBurst) drawPixelContactBurst(ctx, palette, frame.contactBurst);
  if (frame.batter) {
    drawPixelRunner(ctx, palette, frame.batter.position, false, frame.batter.color, frame.batter.runFrame ?? 2, {
      pose: frame.batter.pose ?? "stance",
      jerseyColor: frame.batter.jerseyColor,
      jerseyShadow: frame.batter.jerseyShadow,
      accentColor: frame.batter.accentColor,
      uniformNumber: frame.batter.uniformNumber
    });
  }
  if (frame.ball) drawPixelBall(ctx, palette, frame.ball, frame.ballColor ?? palette.base);
  for (const runner of frame.runners ?? []) {
    drawPixelRunner(ctx, palette, runner.position, runner.squash, runner.color, runner.runFrame, {
      jerseyColor: runner.jerseyColor,
      jerseyShadow: runner.jerseyShadow,
      accentColor: runner.accentColor,
      pose: runner.pose,
      uniformNumber: runner.uniformNumber
    });
  }
}

function drawPixelAtmosphere(ctx, palette, frame) {
  const progress = Number(frame.progress ?? 0);
  drawPixelCrowdWave(ctx, palette, frame, progress);
  if (frame.event?.outcome === "homeRun" && progress >= 0.66) {
    const t = Math.max(0, Math.min(1, (progress - 0.66) / 0.3));
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

function drawPixelCrowdWave(ctx, palette, frame, progress) {
  const event = frame.event;
  if (!event || progress <= 0.18) return;
  const heat = event.outcome === "homeRun" ? 1 : frame.scoreFlash ? 0.82 : ["double", "triple", "strikeout"].includes(event.outcome) ? 0.48 : 0.24;
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
  drawPixelLine(ctx, line.from.x, line.from.y, line.to.x, line.to.y, color, gamecastSize(1));
  const ball = positionAlongPath([line.from, line.to], Math.max(0, Math.min(1, Number(line.t ?? 0))));
  drawPixelBall(ctx, palette, ball, palette.base);
}

function drawPixelContactBurst(ctx, palette, burst) {
  const x = Math.round(burst.x);
  const y = Math.round(burst.y);
  const size = Math.max(1, Math.round(burst.size ?? gamecastSize(5)));
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - size - 1, y, size * 2 + 3, 1);
  ctx.fillRect(x, y - size - 1, 1, size * 2 + 3);
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
}

function drawPixelCameraFx(ctx, palette, frame) {
  const event = frame.event;
  if (!event || frame.done) return;
  const progress = Number(frame.progress ?? 0);
  const pitchEnd = gamecastPitchEnd(event);
  if (progress < pitchEnd) drawPixelPitchTunnel(ctx, palette, event, progress, pitchEnd);

  if (isBattedBallOutcome(event.outcome) && progress >= pitchEnd + 0.06 && progress <= 0.84) {
    const t = Math.max(0, Math.min(1, (progress - pitchEnd) / Math.max(0.01, 0.76 - pitchEnd)));
    const point = frame.ball ?? battedBallPoint(event, Math.min(1, t));
    drawPixelTrackingReticle(ctx, palette, point, progress, event);
  }

  if (event.outcome === "strikeout" && progress >= 0.34 && progress <= 0.78) {
    const fade = Math.sin(Math.max(0, Math.min(1, (progress - 0.34) / 0.44)) * Math.PI);
    drawPixelBlockLetters(ctx, palette, "K", gamecastX(19), gamecastY(63), 3, palette.out, palette.base, fade);
  } else if (event.outcome === "walk" && progress >= 0.42 && progress <= 0.78) {
    const fade = Math.sin(Math.max(0, Math.min(1, (progress - 0.42) / 0.36)) * Math.PI);
    drawPixelBlockLetters(ctx, palette, "BB", gamecastX(17), gamecastY(63), 2, palette.walk, palette.outline, fade);
  } else if (event.doublePlay && progress >= 0.56 && progress <= 0.86) {
    const fade = Math.sin(Math.max(0, Math.min(1, (progress - 0.56) / 0.3)) * Math.PI);
    drawPixelBlockLetters(ctx, palette, "DP", gamecastX(15), gamecastY(62), 2, palette.spark, palette.outline, fade);
  }
}

function drawPixelPitchTunnel(ctx, palette, event, progress, pitchEnd) {
  const bases = gamecastBasePositions();
  const target = pitchTargetForEvent(event, bases);
  const t = Math.max(0, Math.min(1, progress / Math.max(0.01, pitchEnd)));
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
    B: ["1110", "1001", "1110", "1001", "1110"],
    D: ["1110", "1001", "1001", "1001", "1110"],
    K: ["1001", "1010", "1100", "1010", "1001"],
    P: ["1110", "1001", "1110", "1000", "1000"]
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

function drawPixelFielders(ctx, palette, frame) {
  const positions = gamecastDefensiveAlignment();
  const activePosition = normalizeFieldingPosition(frame.event?.fieldingPosition);
  const defenderColor = frame.defenseColor ?? (frame.side === "home" ? palette.defender : "#575160");
  const jerseyColor = frame.defenseJerseyColor ?? palette.defenderL;
  const activeProgress = Number(frame.progress ?? 0);
  const pitchingNow = frame.event && activeProgress < gamecastPitchEnd(frame.event) + 0.04;

  for (const fielder of positions) {
    const isActive = activePosition && fielder.key === activePosition && activeProgress >= 0.28 && activeProgress <= 0.82;
    if (isActive || (pitchingNow && fielder.key === "P")) continue;
    const pose = fielder.key === "C" ? "catcher" : activePosition === fielder.key && activeProgress > 0.82 ? "catch" : "field";
    drawPixelRunner(ctx, palette, fielder.position, false, defenderColor, fielder.frame, {
      jerseyColor,
      jerseyShadow: frame.defenseJerseyShadow ?? palette.uniformSh,
      accentColor: frame.defenseAccentColor ?? defenderColor,
      pose,
      fieldingKey: fielder.key
    });
  }
}

function gamecastDefensiveAlignment() {
  const bases = gamecastBasePositions();
  return [
    { key: "LF", position: { x: gamecastX(30), y: gamecastY(44) }, frame: 1 },
    { key: "CF", position: { x: gamecastX(60), y: gamecastY(34) }, frame: 2 },
    { key: "RF", position: { x: gamecastX(90), y: gamecastY(44) }, frame: 0 },
    { key: "SS", position: { x: gamecastX(46), y: gamecastY(64) }, frame: 1 },
    { key: "2B", position: { x: gamecastX(74), y: gamecastY(64) }, frame: 0 },
    { key: "3B", position: { x: gamecastX(29), y: gamecastY(76) }, frame: 2 },
    { key: "1B", position: { x: gamecastX(91), y: gamecastY(76) }, frame: 2 },
    { key: "P", position: { x: bases.mound.x, y: bases.mound.y + gamecastSize(2) }, frame: 2 },
    { key: "C", position: { x: bases.home.x - gamecastSize(8), y: bases.home.y + gamecastSize(4) }, frame: 2 }
  ];
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
    first: { x: gamecastX(86), y: gamecastY(76) },
    second: { x: gamecastX(60), y: gamecastY(56) },
    third: { x: gamecastX(34), y: gamecastY(76) },
    mound: { x: gamecastX(60), y: gamecastY(76) }
  };
}

function buildGamecastFrameState(state, forceFinal = false) {
  const seq = state.sequence;
  const events = seq.events;
  if (!events.length) {
    return {
      done: true,
      event: null,
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
      actionBurst: null
    };
  }

  const paMs = Math.max(80, Number(seq.paMs ?? GAMECAST_PA_MS));
  const slotMs = gamecastEventDuration(seq);
  const totalMs = events.length * slotMs;
  if (forceFinal || state.prefersReducedMotion || state.elapsedMs >= totalMs) {
    const last = events[events.length - 1];
    return {
      done: true,
      event: last,
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
      progress: 1
    };
  }

  const index = Math.min(events.length - 1, Math.floor(state.elapsedMs / slotMs));
  const localMs = state.elapsedMs - index * slotMs;
  const event = events[index];
  const progress = Math.max(0, Math.min(1, localMs / paMs));
  const settling = progress >= 0.72;
  const clearingInning = event.inningEnded && progress >= 0.92;
  const baseOccupancy = settling
    ? (clearingInning ? [false, false, false] : event.basesAfter)
    : baseOccupancyDuringMove(event, progress);
  const score = scoreForGamecastFrame(seq, events, index, progress >= 0.68);
  const runners = buildRunnerSprites(event, progress, state.palette);

  return {
    done: false,
    event,
    side: event.side,
    bases: baseOccupancy,
    outs: displayOutsForEvent(event, progress),
    score,
    runners,
    batter: buildBatterSprite(event, progress, state.palette),
    ball: buildBallSprite(event, progress),
    ballTrail: buildBallTrail(event, progress),
    ballShadow: buildGamecastBallShadow(event, progress),
    defenseSprites: buildGamecastDefenseSprites(event, progress, state.palette),
    throwLines: buildGamecastThrowLines(event, progress),
    contactBurst: buildGamecastContactBurst(event, progress),
    ballTrailColor: event.outcome === "homeRun" ? state.palette.homerL : state.palette.baseSh,
    ballColor: state.palette.base,
    playerLabel: buildGamecastPlayerLabel(event, progress, runners),
    actionBurst: buildGamecastActionBurst(event, progress),
    scoreFlash: event.runs > 0 && progress >= 0.62 && progress <= 0.84,
    flash: event.outcome === "homeRun" && progress >= 0.68 && progress < 0.76,
    offenseColor: event.teamColor ?? state.palette.runner,
    offenseJerseyColor: event.teamJerseyColor ?? state.palette.uniform,
    offenseJerseyShadow: event.teamJerseyShadow ?? state.palette.uniformSh,
    offenseAccentColor: event.teamAccentColor ?? event.teamColor ?? state.palette.runner,
    defenseColor: event.defenseColor ?? state.palette.defender,
    defenseJerseyColor: event.defenseJerseyColor ?? state.palette.defenderL,
    defenseJerseyShadow: event.defenseJerseyShadow ?? state.palette.uniformSh,
    defenseAccentColor: event.defenseAccentColor ?? event.defenseColor ?? state.palette.defender,
    progress
  };
}

function buildGamecastActionBurst(event, progress) {
  if (!event) return null;
  const start = gamecastPitchEnd(event) + 0.02;
  const end = event.outcome === "homeRun" ? 0.94 : event.outcome === "strikeout" ? 0.82 : 0.8;
  if (progress < start || progress > end) return null;

  const t = Math.max(0, Math.min(1, (progress - start) / Math.max(0.01, end - start)));
  const pop = Math.sin(Math.min(1, t * 1.25) * Math.PI);
  const text = gamecastBurstText(event.outcome);
  if (!text) return null;

  return {
    text,
    className: gamecastBurstClass(event.outcome),
    x: event.outcome === "homeRun" ? 50 : event.outcome === "strikeout" ? 52 : 58,
    y: event.outcome === "homeRun" ? 28 : event.outcome === "strikeout" ? 42 : 36,
    opacity: Math.max(0, Math.min(1, t < 0.16 ? t / 0.16 : (1 - t) / 0.34)),
    scale: 0.82 + pop * (event.outcome === "homeRun" ? 0.95 : 0.62),
    shake: Math.round(Math.sin(t * Math.PI * 12) * (event.outcome === "homeRun" ? 7 : 4))
  };
}

function gamecastBurstText(outcome) {
  if (outcome === "homeRun") return "홈런!";
  if (outcome === "triple") return "3루타!";
  if (outcome === "double") return "2루타!";
  if (outcome === "single" || outcome === "error") return "안타!";
  if (outcome === "strikeout") return "삼진!";
  if (outcome === "walk") return "볼넷!";
  if (outcome === "out") return "아웃!";
  return "";
}

function gamecastBurstClass(outcome) {
  if (outcome === "homeRun") return "is-homer";
  if (["single", "double", "triple", "error"].includes(outcome)) return "is-hit";
  if (outcome === "strikeout" || outcome === "out") return "is-out";
  if (outcome === "walk") return "is-walk";
  return "";
}

function buildBatterSprite(event, progress, palette) {
  if (!event || progress >= 0.72) return null;
  const advance = gamecastAdvanceCount(event.outcome);
  if ((advance > 0 || event.outcome === "walk") && progress >= gamecastRunnerMoveStart(event) + 0.06) return null;
  const bases = gamecastBasePositions();
  const pitchEnd = gamecastPitchEnd(event);
  let pose = "stance";
  if (progress >= pitchEnd - 0.08 && progress < pitchEnd + 0.01) pose = "load";
  else if (progress >= pitchEnd + 0.01 && progress < pitchEnd + 0.16) {
    if (event.outcome === "walk") pose = "take";
    else if (event.outcome === "strikeout") pose = "miss";
    else pose = "swing";
  } else if (progress >= pitchEnd + 0.16) {
    pose = event.outcome === "strikeout" ? "miss" : "follow";
  }

  return {
    position: {
      x: bases.home.x + gamecastSize(8),
      y: bases.home.y - gamecastSize(1)
    },
    color: event.teamColor ?? palette.runner,
    jerseyColor: event.teamJerseyColor ?? palette.uniform,
    jerseyShadow: event.teamJerseyShadow ?? palette.uniformSh,
    accentColor: event.teamAccentColor ?? event.teamColor ?? palette.runner,
    uniformNumber: event.hitterUniformNumber,
    pose,
    runFrame: 2
  };
}

function buildGamecastPlayerLabel(event, progress, runners) {
  if (!event || progress >= 0.96) {
    return { visible: false, text: "", x: 50, y: 50, scoring: false };
  }
  const showFielder = event.defenderName && isBattedBallOutcome(event.outcome) && progress >= 0.48 && progress < 0.84;
  if (showFielder) {
    const pitchEnd = gamecastPitchEnd(event);
    const fieldT = Math.max(0, Math.min(1, (progress - pitchEnd - 0.12) / 0.46));
    const target = battedBallGroundPoint(event, 1);
    const start = gamecastDefenderStartForTarget(target, event);
    const eased = easeOutCubic(fieldT);
    const position = {
      x: Math.round(lerp(start.x, target.x, eased)),
      y: Math.round(lerp(start.y, target.y, eased))
    };
    const fadeOut = progress > 0.76 ? Math.max(0, (0.84 - progress) / 0.08) : 1;
    return {
      visible: fadeOut > 0.08,
      text: shortenGamecastPlayerName(event.defenderName),
      x: Math.max(gamecastX(10), Math.min(gamecastX(110), position.x)),
      y: Math.max(gamecastY(10), Math.min(gamecastY(98), position.y - gamecastSize(14))),
      opacity: fadeOut,
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
    ?? (progress < 0.72 ? { x: bases.home.x, y: bases.home.y - gamecastSize(4) } : target)
    ?? { x: bases.home.x, y: bases.home.y - gamecastSize(4) };
  const fadeIn = Math.min(1, Math.max(0, progress / 0.08));
  const fadeOut = progress > 0.82 ? Math.max(0, (0.96 - progress) / 0.14) : 1;
  const opacity = Math.max(0, Math.min(1, fadeIn * fadeOut));
  return {
    visible: opacity > 0.08,
    text: shortenGamecastPlayerName(event.hitterName),
    x: Math.max(gamecastX(10), Math.min(gamecastX(110), position.x)),
    y: Math.max(gamecastY(10), Math.min(gamecastY(98), position.y - gamecastSize(14))),
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
  const advance = gamecastAdvanceCount(event.outcome);
  if (progress < gamecastRunnerMoveStart(event) || advance <= 0) return event.basesBefore;
  if (progress >= 0.58) return event.basesAfter;
  return event.basesBefore.map((occupied, index) => occupied && progress < (0.44 + index * 0.03));
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
  if (event.inningEnded && progress >= 0.72 && progress < 0.92) return 3;
  if (event.inningEnded && progress >= 0.92) return 0;
  return outsInInning(progress >= 0.72 ? event.outsAfter : event.outsBefore);
}

function outsInInning(value) {
  const outs = Math.max(0, Math.floor(Number(value ?? 0)));
  return outs % 3;
}

function buildRunnerSprites(event, progress, palette) {
  const advance = gamecastAdvanceCount(event.outcome);
  if (event.outcome === "strikeout") return [];
  const moveStart = gamecastRunnerMoveStart(event);
  if (progress < moveStart || progress >= 0.72) return [];

  const moveT = Math.max(0, Math.min(1, (progress - moveStart) / Math.max(0.01, 0.72 - moveStart)));
  const walking = event.outcome === "walk";
  const eased = walking ? easeInOutCubic(moveT) : easeOutCubic(moveT);
  const runners = [];
  const runnerColor = event.teamColor ?? palette.runner;
  const trailColor = event.teamTrailColor ?? palette.runnerL;
  const jerseyColor = event.teamJerseyColor ?? palette.uniform;
  const jerseyShadow = event.teamJerseyShadow ?? palette.uniformSh;
  const accentColor = event.teamAccentColor ?? runnerColor;
  const uniformNumber = event.hitterUniformNumber;

  if (advance > 0) {
    event.basesBefore.forEach((occupied, index) => {
      if (!occupied) return;
      const startBase = index + 1;
      const targetBase = Math.min(4, startBase + advance);
      runners.push(makeRunnerSprite(gamecastPathBetween(startBase, targetBase), eased, runnerColor, trailColor, moveT, "runner", {
        jerseyColor,
        jerseyShadow,
        accentColor,
        pose: walking ? "walk" : "run",
        trail: !walking
      }));
    });
    const batterTarget = Math.min(4, advance);
    runners.push(makeRunnerSprite(gamecastPathBetween(0, batterTarget), eased, runnerColor, trailColor, moveT, "batter", {
      jerseyColor,
      jerseyShadow,
      accentColor,
      uniformNumber,
      pose: walking ? "walk" : "run",
      trail: !walking
    }));
    return runners;
  }

  const bases = gamecastBasePositions();
  const outT = Math.min(1, moveT * 1.3);
  runners.push({
    position: {
      x: Math.round(lerp(bases.home.x, bases.home.x + gamecastSize(7), outT)),
      y: Math.round(lerp(bases.home.y, bases.home.y - gamecastSize(3), outT))
    },
    trail: [],
    color: runnerColor,
    jerseyColor,
    jerseyShadow,
    accentColor,
    uniformNumber,
    runFrame: Math.floor(moveT * 8) % 2,
    squash: progress > 0.55,
    role: "batter",
    pose: "run"
  });
  return runners;
}

function makeRunnerSprite(path, eased, color, trailColor, moveT, role = "runner", options = {}) {
  const position = positionAlongPath(path, eased);
  const stride = Math.floor(moveT * (options.pose === "walk" ? 4 : 8));
  const bob = options.pose === "walk" ? (stride % 2 ? 0 : -1) : (stride % 2 ? -1 : 0);
  position.y += bob;
  return {
    position,
    dust: options.pose === "walk" || options.trail === false
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
    runFrame: moveT > 0.92 ? 2 : stride % 2,
    squash: options.pose === "walk" ? false : moveT > 0.92,
    pose: options.pose ?? "run",
    role
  };
}

function buildBallSprite(event, progress) {
  const bases = gamecastBasePositions();
  const pitchEnd = gamecastPitchEnd(event);
  if (progress < pitchEnd) {
    const t = Math.max(0, Math.min(1, progress / pitchEnd));
    const target = pitchTargetForEvent(event, bases);
    return {
      x: Math.round(lerp(bases.mound.x, target.x, easeOutCubic(t))),
      y: Math.round(lerp(bases.mound.y, target.y, easeOutCubic(t)))
    };
  }
  if (event.outcome === "walk") return progress < pitchEnd + 0.12 ? pitchTargetForEvent(event, bases) : null;
  if (event.outcome === "strikeout") return progress < pitchEnd + 0.18 ? pitchTargetForEvent(event, bases) : null;
  if (!isBattedBallOutcome(event.outcome) || progress >= 0.76) return null;
  return battedBallPoint(event, Math.max(0, Math.min(1, (progress - pitchEnd) / Math.max(0.01, 0.76 - pitchEnd))));
}

function buildBallTrail(event, progress) {
  const pitchEnd = gamecastPitchEnd(event);
  if (!isBattedBallOutcome(event.outcome) || progress < pitchEnd + 0.05 || progress >= 0.76) return [];
  const points = [];
  for (const offset of [0.06, 0.12, 0.18]) {
    const p = Math.max(pitchEnd, progress - offset);
    points.push(battedBallPoint(event, Math.max(0, Math.min(1, (p - pitchEnd) / Math.max(0.01, 0.76 - pitchEnd)))));
  }
  return points;
}

function buildGamecastBallShadow(event, progress) {
  const pitchEnd = gamecastPitchEnd(event);
  if (!isBattedBallOutcome(event.outcome) || progress < pitchEnd || progress >= 0.76) return null;
  const t = Math.max(0, Math.min(1, (progress - pitchEnd) / Math.max(0.01, 0.76 - pitchEnd)));
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

function buildGamecastDefenseSprites(event, progress, palette) {
  const pitchEnd = gamecastPitchEnd(event);
  const sprites = [];
  if (progress < pitchEnd + 0.04) {
    const bases = gamecastBasePositions();
    const windT = Math.max(0, Math.min(1, progress / Math.max(0.01, pitchEnd)));
    sprites.push({
      position: { x: bases.mound.x, y: bases.mound.y + gamecastSize(2) - (windT > 0.48 && windT < 0.72 ? 1 : 0) },
      color: event.defenseColor ?? palette.defender,
      jerseyColor: event.defenseJerseyColor ?? palette.defenderL,
      jerseyShadow: event.defenseJerseyShadow ?? palette.uniformSh,
      accentColor: event.defenseAccentColor ?? event.defenseColor ?? palette.defender,
      fieldingKey: "P",
      uniformNumber: gamecastUniformNumber(event.pitcherName, "P"),
      runFrame: windT > 0.72 ? 1 : 2,
      squash: false,
      pose: windT < 0.48 ? "windup" : "pitch"
    });
  }
  if (!isBattedBallOutcome(event?.outcome)) return sprites;
  if (progress < pitchEnd + 0.12 || progress > 0.88) return sprites;

  const t = Math.max(0, Math.min(1, (progress - pitchEnd - 0.12) / 0.46));
  const target = battedBallGroundPoint(event, 1);
  const start = gamecastDefenderStartForTarget(target, event);
  const eased = easeOutCubic(t);
  const position = {
    x: Math.round(lerp(start.x, target.x, eased)),
    y: Math.round(lerp(start.y, target.y, eased))
  };
  const impactPose = event.outcome === "error" && progress > 0.5
    ? "dive"
    : event.outcome === "out" && progress > 0.52
      ? "catch"
      : "field";

  sprites.push({
    position,
    color: event.defenseColor ?? palette.defender,
    jerseyColor: event.defenseJerseyColor ?? palette.defenderL,
    jerseyShadow: event.defenseJerseyShadow ?? palette.uniformSh,
    accentColor: event.defenseAccentColor ?? event.defenseColor ?? palette.defender,
    fieldingKey: normalizeFieldingPosition(event.fieldingPosition),
    uniformNumber: gamecastUniformNumber(event.defenderName, event.fieldingPosition),
    runFrame: Math.floor(t * 8) % 2,
    squash: t > 0.88,
    pose: impactPose
  });

  if (event.outcome === "homeRun" && progress > 0.64) {
    sprites.push({
      position: { x: Math.round(target.x), y: Math.round(target.y + gamecastSize(7)) },
      color: event.defenseColor ?? palette.defenderSh,
      jerseyColor: event.defenseJerseyColor ?? palette.defenderL,
      jerseyShadow: event.defenseJerseyShadow ?? palette.uniformSh,
      accentColor: event.defenseAccentColor ?? event.defenseColor ?? palette.defender,
      fieldingKey: normalizeFieldingPosition(event.fieldingPosition),
      uniformNumber: gamecastUniformNumber(event.defenderName, event.fieldingPosition),
      runFrame: 2,
      squash: false,
      pose: "lookUp"
    });
  }

  return sprites;
}

function buildGamecastThrowLines(event, progress) {
  if (!isBattedBallOutcome(event?.outcome)) return [];
  if (!["out", "error", "single", "double"].includes(event.outcome)) return [];
  if (progress < 0.58 || progress > 0.78) return [];

  const target = battedBallGroundPoint(event, 1);
  const bases = gamecastBasePositions();
  const throwTarget = event.outcome === "out"
    ? bases.first
    : event.outcome === "double"
      ? bases.second
      : bases.home;
  const t = Math.max(0, Math.min(1, (progress - 0.58) / 0.2));
  return [{
    from: target,
    to: throwTarget,
    t: easeOutCubic(t),
    opacity: 1 - Math.max(0, t - 0.7) / 0.3
  }];
}

function gamecastPitchEnd(event) {
  if (event?.outcome === "walk") return 0.34;
  if (event?.outcome === "strikeout") return 0.26;
  return 0.22;
}

function gamecastRunnerMoveStart(event) {
  if (event?.outcome === "walk") return 0.34;
  return 0.25;
}

function pitchTargetForEvent(event, bases) {
  if (event?.outcome === "walk") return { x: bases.home.x + gamecastSize(12), y: bases.home.y - gamecastSize(7) };
  if (event?.outcome === "strikeout") return { x: bases.home.x - gamecastSize(6), y: bases.home.y - gamecastSize(2) };
  return { x: bases.home.x + gamecastSize(2), y: bases.home.y - gamecastSize(6) };
}

function isBattedBallOutcome(outcome) {
  return ["single", "double", "triple", "homeRun", "error", "out"].includes(outcome);
}

function battedBallPoint(event, t) {
  const bases = gamecastBasePositions();
  const start = { x: bases.home.x + gamecastSize(2), y: bases.home.y - gamecastSize(7) };
  const target = battedBallTarget(event);
  const eased = easeOutCubic(t);
  const lift = battedBallLift(event) * Math.sin(t * Math.PI);
  return {
    x: Math.round(lerp(start.x, target.x, eased)),
    y: Math.round(lerp(start.y, target.y, eased) - lift)
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
  const clampX = (value) => gamecastX(Math.max(10, Math.min(110, value)));
  const clampY = (value) => gamecastY(Math.max(18, Math.min(88, value)));
  const fieldingSpot = gamecastFieldingSpot(event);
  if (fieldingSpot) {
    const battedType = String(event?.battedBallType ?? "");
    const liftY = battedType === "flyBall" ? -6 : battedType === "groundBall" ? 5 : 0;
    return {
      x: clampX(fieldingSpot.x + xJitter * 0.35),
      y: clampY(fieldingSpot.y + liftY + yJitter * 0.35)
    };
  }
  if (event?.outcome === "homeRun") return { x: clampX((pullSide > 0 ? 102 : 18) + xJitter), y: clampY(22 + yJitter * 0.5) };
  if (event?.outcome === "triple") return { x: clampX((pullSide > 0 ? 104 : 16) + xJitter), y: clampY(35 + yJitter) };
  if (event?.outcome === "double") return { x: clampX((pullSide > 0 ? 94 : 26) + xJitter), y: clampY(43 + yJitter) };
  if (event?.outcome === "single") return { x: clampX((pullSide > 0 ? 78 : 42) + xJitter), y: clampY(58 + yJitter) };
  if (event?.outcome === "error") return { x: clampX((pullSide > 0 ? 74 : 46) + xJitter * 0.7), y: clampY(75 + yJitter * 0.5) };
  return { x: clampX((pullSide > 0 ? 82 : 38) + xJitter), y: clampY(48 + yJitter) };
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
  const key = normalizeFieldingPosition(event?.fieldingPosition);
  const alignment = gamecastDefensiveAlignment().find((fielder) => fielder.key === key);
  if (alignment) return { ...alignment.position };
  const leftSide = target.x < gamecastX(60);
  const deep = target.y < gamecastY(52);
  const infield = target.y > gamecastY(68);
  if (infield) return { x: leftSide ? gamecastX(45) : gamecastX(74), y: gamecastY(72) };
  if (event?.outcome === "homeRun") return { x: leftSide ? gamecastX(30) : gamecastX(90), y: gamecastY(48) };
  return {
    x: leftSide ? gamecastX(deep ? 31 : 40) : gamecastX(deep ? 89 : 80),
    y: gamecastY(deep ? 42 : 55)
  };
}

function gamecastFieldingSpot(event) {
  const key = normalizeFieldingPosition(event?.fieldingPosition);
  const spots = {
    P: { x: 60, y: 74 },
    C: { x: 58, y: 92 },
    "1B": { x: 87, y: 73 },
    "2B": { x: 73, y: 62 },
    "3B": { x: 31, y: 74 },
    SS: { x: 46, y: 62 },
    LF: { x: 30, y: 42 },
    CF: { x: 60, y: 34 },
    RF: { x: 91, y: 42 }
  };
  return spots[key] ?? null;
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
  if (state.scoreNodes?.[0]) state.scoreNodes[0].textContent = formatNumber(frame.score?.away ?? 0);
  if (state.scoreNodes?.[1]) state.scoreNodes[1].textContent = formatNumber(frame.score?.home ?? 0);
  if (state.nowTitle) state.nowTitle.textContent = frame.event ? gamecastNowTitle(frame.event) : "경기 종료";
  if (state.nowDetail) state.nowDetail.textContent = frame.event ? gamecastNowDetail(frame.event) : "타석 이벤트 대기";
  syncGamecastPlayerLabel(state.playerLabel, frame.playerLabel);
  syncGamecastActionBurst(state.actionBurst, frame.actionBurst);
  for (const item of state.feedItems ?? []) {
    item.classList.toggle("is-live", Boolean(frame.event?.id && !frame.done && item.dataset.gamecastEventId === frame.event.id));
  }
}

function syncGamecastActionBurst(node, burst) {
  if (!node) return;
  if (!burst?.text) {
    node.className = "gamecast-action-burst";
    node.textContent = "";
    node.style.removeProperty("--burst-x");
    node.style.removeProperty("--burst-y");
    node.style.removeProperty("--burst-opacity");
    node.style.removeProperty("--burst-scale");
    node.style.removeProperty("--burst-shake");
    return;
  }
  node.textContent = burst.text;
  node.className = `gamecast-action-burst is-visible ${burst.className ?? ""}`.trim();
  node.style.setProperty("--burst-x", `${burst.x}%`);
  node.style.setProperty("--burst-y", `${burst.y}%`);
  node.style.setProperty("--burst-opacity", String(Math.max(0, Math.min(1, burst.opacity ?? 1))));
  node.style.setProperty("--burst-scale", String(Math.max(0.4, burst.scale ?? 1)));
  node.style.setProperty("--burst-shake", `${burst.shake ?? 0}px`);
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

// 9x13 outlined chibi player; runFrame 0/1 = stride, 2 = standing
function drawPixelRunner(ctx, palette, position, squash, color, runFrame = 0, options = {}) {
  const S = palette.skin;
  const L = palette.legs;
  const U = options.jerseyColor ?? palette.uniform;
  const US = options.jerseyShadow ?? palette.uniformSh;
  const trim = normalizeHexColor(color, palette.runner);
  const accent = normalizeHexColor(options.accentColor ?? color, trim);
  const ink = options.uniformNumber === undefined ? palette.uniformInk : mixHexColors(palette.uniformInk, accent, 0.18);
  const ox = Math.round(position.x) - 4;
  const oy = Math.round(position.y) - (squash ? 12 : 13);
  const pose = options.pose ?? "run";
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
  ctx.fillStyle = palette.ballGlow;
  ctx.fillRect(x - 2, y - 1, 7, 3);
  ctx.fillRect(x - 1, y - 2, 5, 5);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - 1, y - 1, 5, 5);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = palette.uniformHi;
  ctx.fillRect(x, y, 1, 1);
  ctx.fillStyle = palette.ballSeam;
  ctx.fillRect(x + 2, y + 2, 1, 1);
  ctx.fillRect(x, y + 2, 1, 1);
}

function drawTrail(ctx, color, trail) {
  for (const point of trail ?? []) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    ctx.fillStyle = "#fffefb";
    ctx.fillRect(x, y, gamecastSize(1), gamecastSize(1));
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, gamecastSize(1), gamecastSize(1));
  }
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
  return "타구";
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
