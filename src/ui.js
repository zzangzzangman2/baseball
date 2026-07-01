import {
  advanceSeason,
  buildLineup,
  buildPitchingSnapshot,
  commitForeignPlayerSigning,
  commitFreeAgentSigning,
  commitTradeProposal,
  getSelectedTeam,
  getStandings,
  initializeDraft,
  initializeFreeAgency,
  initializePostseason,
  initializeSecondaryDraft,
  simulateDay,
  simulateDays,
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

const POSITION_GROUP_LABELS = {
  pitcher: "투수",
  catcher: "포수",
  infield: "내야",
  outfield: "외야",
  utility: "지명",
  other: "기타"
};

const GAMECAST_PIXEL_SIZE = 80;
const GAMECAST_CANVAS_ID = "gamecast-pixel-canvas";
const GAMECAST_PLAYBACK_COUNT = 8;
const GAMECAST_PA_MS = 850;
const GAMECAST_PA_GAP_MS = 120;
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
  const selectedRank = getTeamRank(standings, selectedTeam);
  const lineup = buildLineup(selectedTeam);
  const roster = getRoster(selectedTeam);
  const seasonLeaders = buildSeasonLeaders(selectedTeam);
  const pitchingSnapshot = buildPitchingSnapshot(selectedTeam);
  const injuries = roster.filter((player) => Number(player.injuredDays) > 0);
  const teamColor = getTeamColor(selectedTeam);
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
        <nav class="nav-list" aria-label="Dashboard sections">
          <a class="nav-item is-active" href="#clubhouse">클럽하우스</a>
          <a class="nav-item" href="#standings">순위표</a>
          <a class="nav-item" href="#contracts">계약</a>
          <a class="nav-item" href="#free-agency">FA시장</a>
          <a class="nav-item" href="#stats">기록</a>
          <a class="nav-item" href="#postseason">가을야구</a>
          <a class="nav-item" href="#draft">드래프트</a>
          <a class="nav-item" href="#secondary-draft">2차</a>
          <a class="nav-item" href="#lineup">라인업</a>
          <a class="nav-item" href="#news">소식</a>
        </nav>
        <section class="sidebar-card">
          <span class="mini-label">오늘</span>
          <strong>${escapeHtml(state.currentDate ?? "2026 Season")}</strong>
          <span>${escapeHtml(state.weather?.label ?? "야구하기 좋은 날")} · ${formatTemperature(state.weather?.temperature)}</span>
        </section>
      </aside>

      <section class="dashboard">
        <header class="topbar" id="clubhouse">
          <div class="headline">
            <span class="eyebrow">프런트 데스크</span>
            <h1>${escapeHtml(getTeamName(selectedTeam) ?? "KBO GM Manager")}</h1>
            <p>${formatNumber(state.day)}일차 · ${formatNumber(state.gamesPlayed)} / 720경기 · ${escapeHtml(renderPhase(state.phase))}</p>
          </div>
          <div class="topbar-controls">
            <label class="team-picker">
              <span>구단 선택</span>
              <select data-action="select-team" ${state.teams.length ? "" : "disabled"}>
                ${renderTeamOptions(state)}
              </select>
            </label>
            <div class="action-row" aria-label="Simulation actions">
              <button class="button button-soft" data-action="next-day">다음 날</button>
              <button class="button button-soft" data-action="week">빠른 주간</button>
              <button class="button button-soft" data-action="postseason">가을야구</button>
              <button class="button button-soft" data-action="draft">드래프트</button>
              <button class="button button-soft" data-action="secondary-draft">2차 드래프트</button>
              <button class="button button-soft" data-action="free-agency">FA시장</button>
              <button class="button button-soft" data-action="auto-offseason">자동 스토브</button>
              <button class="button button-soft" data-action="next-season">다음 시즌</button>
              <button class="button button-soft" data-action="export-save">저장</button>
              <button class="button button-soft" data-action="import-save">불러오기</button>
            </div>
            <p class="status-message" data-save-status aria-live="polite"></p>
          </div>
        </header>

        <section class="hero-card">
          <div>
            <span class="mini-label">우리 구단</span>
            <h2>${escapeHtml(getTeamName(selectedTeam) ?? "구단을 기다리는 중")}</h2>
            <p>${escapeHtml(selectedTeam?.home ?? getTeamLocation(selectedTeam))} · ${escapeHtml(selectedTeam?.vibe ?? "KBO 리그")}</p>
          </div>
          <div class="team-logo-plate" aria-hidden="true">
            ${renderTeamLogo(selectedTeam, "team-logo hero-logo")}
          </div>
        </section>

        <section class="metric-grid" aria-label="Selected team metrics">
          ${renderMetricCard("성적", renderRecord(selectedTeam), `승률 ${formatPct(winningPct(selectedTeam))}`)}
          ${renderMetricCard("순위", selectedRank ? `${selectedRank}위` : "-", `${formatNumber(state.teams.length)}개 구단`)}
          ${renderMetricCard("예산", `${formatMoney(selectedTeam?.payroll)} / ${formatMoney(selectedTeam?.budget)}`, "연봉 / 운영 여력")}
          ${renderMetricCard("관중", formatAttendance(selectedTeam), "홈 평균 관중")}
          ${renderMetricCard("부상", `${injuries.length}명`, injuries[0] ? `${escapeHtml(injuries[0].name)} 관리 필요` : "건강한 클럽하우스")}
        </section>

        ${renderFrontOfficePanels(frontOffice)}
        ${renderCommandCenterPanels(gmDesk)}
        ${renderTradeLedgerPanel(state)}
        ${renderFreeAgencyPanel(state, selectedTeam)}
        ${renderPostseasonPanel(state, standings)}
        ${renderDraftPanel(state)}
        ${renderSecondaryDraftPanel(state)}

        <section class="content-grid">
          ${renderGamecastPanel(state)}

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

          ${renderSeasonStatsPanel(selectedTeam, seasonLeaders)}

          <article class="panel team-panel" id="lineup">
            <div class="panel-head">
              <div>
                <span class="mini-label">더그아웃 노트</span>
                <h2>${escapeHtml(getTeamShortName(selectedTeam) ?? "Team")} 라인업</h2>
              </div>
              <span class="pill">${formatNumber(roster.length)}명</span>
            </div>
            <div class="lineup-grid">
              <section>
                <h3>선발 라인업</h3>
                <ol class="player-list">
                  ${lineup.length ? lineup.map(renderLineupPlayer).join("") : renderEmptyListItem("라인업을 기다리고 있어요.")}
                </ol>
              </section>
              <section>
                <h3>선발 로테이션</h3>
                <ol class="player-list compact pitching-role-list">
                  ${pitchingSnapshot.rotation.length ? pitchingSnapshot.rotation.map(renderPitchingRole).join("") : renderEmptyListItem("로테이션 준비 중입니다.")}
                </ol>
                <h3 class="pitching-subhead">불펜 역할</h3>
                <ol class="player-list compact pitching-role-list">
                  ${pitchingSnapshot.bullpen.length ? pitchingSnapshot.bullpen.slice(0, 5).map(renderPitchingRole).join("") : renderEmptyListItem("불펜 준비 중입니다.")}
                </ol>
              </section>
            </div>
          </article>

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
        </section>
      </section>
    </main>
  `;

  initGamecastPixelScreen(root);
  bindActions(root, state);
}

function renderOnboarding(root, state, screen) {
  const teams = state.teams ?? [];
  const logoStrip = renderStartLogoStrip(teams);
  root.innerHTML = `
    <main class="start-shell">
      <section class="start-hero ${screen === "team-select" ? "is-team-select" : ""}">
        <div class="start-copy">
          <div class="start-kicker">
            <span class="mini-label">KBO GM Manager</span>
            <span class="start-date">2026.03.01</span>
          </div>
          <h1>${screen === "team-select" ? "함께할 구단을 골라요" : "봄 캠프에서 시작해요"}</h1>
          <p>${screen === "team-select" ? "프런트 첫 날, 마음 가는 로고를 눌러 시즌을 열어보세요." : "프리시즌 첫날의 클럽하우스에서 당신의 프런트가 열립니다."}</p>
          ${logoStrip}
          ${screen === "team-select" ? "" : `
            <div class="start-actions">
              <button class="button button-primary" data-action="start-new" type="button">시작하기</button>
              <button class="button button-soft" data-action="load-save-start" type="button">불러오기</button>
            </div>
          `}
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
        ` : `
          ${renderStartPreview()}
        `}
      </section>
    </main>
  `;
  bindOnboardingActions(root, state);
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
      state.ui = { ...(state.ui ?? {}), screen: "game" };
      render(root, state);
      setStatus(root, "프리시즌 캠프에 합류했습니다. 다음 날 버튼으로 하루씩 진행하세요.");
    });
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
    <li>
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
  const picker = root.querySelector("[data-action='select-team']");
  picker?.addEventListener("change", (event) => {
    state.selectedTeamId = event.target.value;
    render(root, state);
  });

  root.querySelector("[data-action='next-day']")?.addEventListener("click", () => {
    simulateDay(state);
    render(root, state);
  });

  root.querySelector("[data-action='week']")?.addEventListener("click", () => {
    const beforeDate = state.currentDate;
    const beforeGames = Number(state.gamesPlayed ?? 0);
    simulateDays(state, 7);
    const gamesDelta = Number(state.gamesPlayed ?? 0) - beforeGames;
    render(root, state);
    setStatus(root, `빠른 주간 진행: ${beforeDate} → ${state.currentDate}, ${formatNumber(gamesDelta)}경기 완료.`);
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
    render(root, state);
    setStatus(root, message);
  });

  root.querySelector("[data-action='free-agency']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete" && state.phase !== "offseason") {
      setStatus(root, "FA/외국인 시장은 시즌과 한국시리즈가 끝난 뒤 열 수 있어요.");
      return;
    }
    initializeFreeAgency(state);
    render(root, state);
    setStatus(root, "FA/외국인 시장을 열었어요. 실명 FA는 로스터에서, 외국인 후보는 코드형으로 관리합니다.");
  });

  root.querySelector("[data-action='auto-offseason']")?.addEventListener("click", () => {
    if (state.postseason?.status !== "complete") {
      setStatus(root, "자동 스토브리그는 한국시리즈 종료 후 진행할 수 있어요.");
      return;
    }
    const result = runAutonomousOffseason(state);
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
    render(root, state);
    setStatus(root, result.message || "다음 시즌 전환 결과를 확인할 수 없습니다.");
  });

  root.querySelector("[data-action='sign-fa']")?.addEventListener("click", () => {
    const result = commitFreeAgentSigning(state);
    render(root, state);
    setStatus(root, result.message || "FA 계약 결과를 확인할 수 없습니다.");
  });

  root.querySelector("[data-action='sign-foreign']")?.addEventListener("click", () => {
    const result = commitForeignPlayerSigning(state);
    render(root, state);
    setStatus(root, result.message || "외국인 권리 계약 결과를 확인할 수 없습니다.");
  });

  root.querySelector("[data-action='export-save']")?.addEventListener("click", () => {
    try {
      downloadSaveFile(state);
      setStatus(root, "저장 파일을 만들었어요.");
    } catch (error) {
      setStatus(root, error.message || "저장 파일을 만들 수 없습니다.");
    }
  });

  root.querySelector("[data-action='import-save']")?.addEventListener("click", () => {
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

function setStatus(root, message) {
  const status = root.querySelector("[data-save-status]");
  if (status) {
    status.textContent = message;
  }
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

  return renderOfficeFact("핵심", player.name, renderPlayerMeta(player), renderPlayerScore(player));
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

  return `
    <li>
      <span class="order">${escapeHtml(player.position ?? "-")}</span>
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
  const game = state.lastGames?.[0];
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

  return `
    <article class="panel gamecast-panel" id="gamecast">
      <div class="panel-head">
        <div>
          <span class="mini-label">Gamecast</span>
          <h2>빠른 도트 중계</h2>
        </div>
        <span class="pill">${formatNumber(events.length)} PA</span>
      </div>
      <div class="gamecast-layout">
        <div class="gamecast-board">
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
          <div class="gamecast-screen ${featured?.outcome === "homeRun" ? "is-homer" : ""}" data-gamecast-screen aria-hidden="true">
            <canvas id="${GAMECAST_CANVAS_ID}" class="gamecast-pixel-canvas" width="${GAMECAST_PIXEL_SIZE}" height="${GAMECAST_PIXEL_SIZE}" aria-hidden="true"></canvas>
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
  `;
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
  return ["single", "double", "triple", "homeRun", "walk", "strikeout"].includes(event?.outcome);
}

function eventTeamLabel(event, state) {
  return getTeamShortName(normalizeGameTeam(event?.offenseTeamId, state)) ?? (event?.side === "home" ? "홈" : "원정");
}

function buildGamecastSequence(game, state) {
  const all = Array.isArray(game?.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
  const chrono = sortGamecastEvents(all);
  const tail = chrono.slice(-GAMECAST_PLAYBACK_COUNT);
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
    finalAway: Number(game?.awayScore ?? game?.awayRuns ?? 0),
    finalHome: Number(game?.homeScore ?? game?.homeRuns ?? 0),
    startAway,
    startHome,
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

  return {
    id: `${event?.gameId ?? "game"}-${side}-${inning}-${sequence}-${event?.outcome ?? "idle"}`,
    outcome: String(event?.outcome ?? "out"),
    inning,
    side,
    sequence,
    offenseTeamId: event?.offenseTeamId ?? "",
    offenseLabel: eventTeamLabel(event, state),
    hitterName: String(event?.hitterName ?? "타자"),
    runs,
    rbi: Number(event?.rbi ?? 0),
    outsBefore,
    outsAfter,
    basesBefore: toBaseTriple(event?.basesBefore),
    basesAfter: toBaseTriple(event?.basesAfter),
    scoredRunners,
    scoredRunnerCount: scoredRunners.length,
    inningEnded
  };
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
  return `${event?.hitterName || "타자"} ${outcomeLabel(event?.outcome)}${runs > 0 ? ` · ${formatNumber(runs)}득점` : ""}`;
}

function gamecastOutcomeClass(outcome) {
  if (outcome === "homeRun") return "is-homer";
  if (["single", "double", "triple"].includes(outcome)) return "is-hit";
  if (outcome === "walk") return "is-walk";
  if (outcome === "strikeout") return "is-out";
  return "is-ball";
}

function initGamecastPixelScreen(root) {
  if (typeof cleanupGamecastPixelScreen === "function") {
    cleanupGamecastPixelScreen();
    cleanupGamecastPixelScreen = null;
  }

  const screen = root?.querySelector?.("[data-gamecast-screen]");
  const canvas = root?.querySelector?.(`#${GAMECAST_CANVAS_ID}`);
  if (!screen || !canvas || typeof canvas.getContext !== "function") return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const scoreNodes = [...root.querySelectorAll(".gamecast-scoreline strong")];
  const nowTitle = root.querySelector(".gamecast-now strong");
  const nowDetail = root.querySelector(".gamecast-now small");
  const feedItems = [...root.querySelectorAll(".gamecast-feed li[data-gamecast-event-id]")];
  const controller = createGamecastPixelController({
    screen,
    canvas,
    ctx,
    sequence: latestGamecastSequence,
    scoreNodes,
    nowTitle,
    nowDetail,
    feedItems
  });
  cleanupGamecastPixelScreen = controller.cleanup;
}

function createGamecastPixelController({ screen, canvas, ctx, sequence, scoreNodes, nowTitle, nowDetail, feedItems }) {
  const palette = {
    outline: "#2b2830",
    grassD: "#4f8a73",
    grassM: "#74b49b",
    grassL: "#bfe8d8",
    dirtD: "#d9a94e",
    dirtM: "#ffe39a",
    dirtL: "#fff2c4",
    base: "#fffefb",
    baseSh: "#d8cdbf",
    runner: "#c64b74",
    runnerL: "#e57a9b",
    hit: "#74b49b",
    homer: "#ff8f83",
    homerL: "#ffb3a6",
    walk: "#b9d9f7",
    out: "#77717a"
  };
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const state = {
    animationFrame: 0,
    visible: true,
    hidden: typeof document !== "undefined" ? document.hidden : false,
    scale: 1,
    dpr: 1,
    elapsedMs: 0,
    lastTimestamp: 0,
    done: false,
    shakeTimer: 0,
    sequence: normalizeGamecastSequenceForPlayback(sequence),
    scoreNodes,
    nowTitle,
    nowDetail,
    feedItems,
    palette,
    prefersReducedMotion,
    shakenEventId: ""
  };

  const resize = () => resizeGamecastCanvas(screen, canvas, ctx, state);
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
    state.elapsedMs = state.sequence.events.length * (GAMECAST_PA_MS + GAMECAST_PA_GAP_MS);
    stop();
    renderCurrentFrame(true);
  };
  const pauseOffscreen = () => {
    stop();
    const frame = buildGamecastFrameState(state, false);
    drawGamecastFrame(ctx, state, frame);
    syncGamecastDom(state, { ...frame, done: true });
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
    state.elapsedMs += delta;
    const frame = renderCurrentFrame(false);
    if (frame.event?.outcome === "homeRun" && !state.prefersReducedMotion && state.shakenEventId !== frame.event.id) {
      triggerGamecastShake(screen, state);
      state.shakenEventId = frame.event.id;
    }
    if (frame.done) {
      state.done = true;
      stop();
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

  resize();
  renderCurrentFrame(state.prefersReducedMotion || !state.sequence.events.length);

  const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
    resize();
    renderCurrentFrame(state.done || state.prefersReducedMotion);
  }) : null;
  resizeObserver?.observe(screen);

  const intersectionObserver = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((entries) => {
    state.visible = entries.some((entry) => entry.isIntersecting);
    if (state.visible) start();
    else pauseOffscreen();
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
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      screen.classList.remove("is-shaking");
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
    events: Array.isArray(sequence?.events) ? sequence.events : []
  };
}

function triggerGamecastShake(screen, state) {
  screen.classList.add("is-shaking");
  if (state.shakeTimer) window.clearTimeout(state.shakeTimer);
  state.shakeTimer = window.setTimeout(() => screen.classList.remove("is-shaking"), 190);
}

function resizeGamecastCanvas(screen, canvas, ctx, state) {
  const rect = screen.getBoundingClientRect();
  const style = getComputedStyle(screen);
  const horizontalInset =
    Number.parseFloat(style.paddingLeft || "0") +
    Number.parseFloat(style.paddingRight || "0") +
    Number.parseFloat(style.borderLeftWidth || "0") +
    Number.parseFloat(style.borderRightWidth || "0");
  const available = Math.max(GAMECAST_PIXEL_SIZE, Math.floor((rect.width || 160) - horizontalInset));
  const scale = Math.max(1, Math.floor(available / GAMECAST_PIXEL_SIZE));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  state.scale = scale;
  state.dpr = dpr;
  canvas.style.width = `${GAMECAST_PIXEL_SIZE * scale}px`;
  canvas.style.height = `${GAMECAST_PIXEL_SIZE * scale}px`;
  canvas.width = Math.round(GAMECAST_PIXEL_SIZE * scale * dpr);
  canvas.height = Math.round(GAMECAST_PIXEL_SIZE * scale * dpr);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(canvas.width / GAMECAST_PIXEL_SIZE, 0, 0, canvas.height / GAMECAST_PIXEL_SIZE, 0, 0);
}

function drawGamecastFrame(ctx, state, frame) {
  const palette = state.palette;
  clearPixelCanvas(ctx, palette);
  drawPixelField(ctx, palette);
  drawPixelDiamond(ctx, palette, frame.bases);
  drawPixelOutPips(ctx, palette, frame);
  drawPixelSideIcon(ctx, palette, frame);
  drawPixelAction(ctx, palette, frame);
  if (frame.scoreFlash) drawPixelScoreBurst(ctx, palette, frame);
}

function clearPixelCanvas(ctx, palette) {
  ctx.fillStyle = palette.grassM;
  ctx.fillRect(0, 0, GAMECAST_PIXEL_SIZE, GAMECAST_PIXEL_SIZE);
}

function drawPixelField(ctx, palette) {
  ctx.fillStyle = palette.grassL;
  for (let y = 0; y < GAMECAST_PIXEL_SIZE; y += 8) {
    ctx.fillRect(0, y, GAMECAST_PIXEL_SIZE, 4);
  }
  ctx.fillStyle = palette.grassD;
  for (let y = 4; y < GAMECAST_PIXEL_SIZE; y += 12) {
    ctx.fillRect(0, y, GAMECAST_PIXEL_SIZE, 2);
  }
  ctx.fillStyle = palette.grassD;
  for (let y = 44; y < GAMECAST_PIXEL_SIZE; y += 8) {
    for (let x = y % 16 === 0 ? 2 : 6; x < GAMECAST_PIXEL_SIZE; x += 12) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  drawPixelLine(ctx, 40, 66, 6, 24, palette.base, 1);
  drawPixelLine(ctx, 40, 66, 74, 24, palette.base, 1);
}

function drawPixelDiamond(ctx, palette, baseState) {
  fillPixelDiamond(ctx, 40, 48, 27, 24, palette.outline);
  fillPixelDiamond(ctx, 40, 48, 25, 22, palette.dirtM);
  fillPixelDiamond(ctx, 40, 48, 18, 16, palette.dirtL);
  fillPixelDiamond(ctx, 40, 48, 12, 10, palette.dirtM);

  const bases = gamecastBasePositions();
  drawPixelLine(ctx, bases.home.x, bases.home.y, bases.first.x, bases.first.y, palette.dirtD, 1);
  drawPixelLine(ctx, bases.first.x, bases.first.y, bases.second.x, bases.second.y, palette.dirtD, 1);
  drawPixelLine(ctx, bases.second.x, bases.second.y, bases.third.x, bases.third.y, palette.dirtD, 1);
  drawPixelLine(ctx, bases.third.x, bases.third.y, bases.home.x, bases.home.y, palette.dirtD, 1);

  ctx.fillStyle = palette.dirtD;
  ctx.fillRect(36, 45, 9, 4);
  ctx.fillStyle = palette.base;
  ctx.fillRect(39, 45, 3, 1);
  ctx.fillRect(40, 46, 1, 1);

  drawPixelBatterBoxes(ctx, palette);
  drawPixelHomePlate(ctx, palette, bases.home);

  drawBaseAndRunner(ctx, palette, bases.first, baseState[0]);
  drawBaseAndRunner(ctx, palette, bases.second, baseState[1]);
  drawBaseAndRunner(ctx, palette, bases.third, baseState[2]);
}

function drawPixelBatterBoxes(ctx, palette) {
  ctx.fillStyle = palette.dirtL;
  ctx.fillRect(34, 62, 2, 4);
  ctx.fillRect(44, 62, 2, 4);
}

function drawPixelHomePlate(ctx, palette, position) {
  ctx.fillStyle = palette.outline;
  ctx.fillRect(position.x - 2, position.y - 2, 5, 3);
  ctx.fillStyle = palette.base;
  ctx.fillRect(position.x - 1, position.y - 2, 3, 1);
  ctx.fillRect(position.x - 1, position.y - 1, 3, 1);
  ctx.fillRect(position.x, position.y, 1, 1);
}

function drawBaseAndRunner(ctx, palette, position, occupied) {
  ctx.fillStyle = palette.baseSh;
  ctx.fillRect(position.x - 1, position.y + 1, 3, 1);
  ctx.fillStyle = palette.base;
  ctx.fillRect(position.x - 1, position.y - 1, 3, 3);
  if (!occupied) return;
  ctx.fillStyle = palette.outline;
  ctx.fillRect(position.x - 1, position.y - 3, 3, 3);
  ctx.fillStyle = palette.runner;
  ctx.fillRect(position.x, position.y - 3, 1, 2);
  ctx.fillStyle = palette.runnerL;
  ctx.fillRect(position.x, position.y - 3, 1, 1);
}

function drawPixelOutPips(ctx, palette, frame) {
  const outs = Math.min(3, Math.max(0, Number(frame.outs ?? 0)));
  for (let index = 0; index < 3; index += 1) {
    ctx.fillStyle = palette.outline;
    ctx.fillRect(52 + index * 8, 70, 5, 5);
    ctx.fillStyle = index < outs ? palette.out : palette.baseSh;
    ctx.fillRect(53 + index * 8, 71, 3, 3);
  }
}

function drawPixelSideIcon(ctx, palette, frame) {
  const x = 9;
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
  ctx.fillStyle = frame.side === "home" ? palette.runner : palette.walk;
  ctx.fillRect(x + 2, y + 4, 3, 2);
}

function drawPixelAction(ctx, palette, frame) {
  if (frame.flash) {
    ctx.fillStyle = palette.base;
    for (let y = 0; y < GAMECAST_PIXEL_SIZE; y += 4) {
      ctx.fillRect(0, y, GAMECAST_PIXEL_SIZE, 1);
    }
  }
  if (frame.ballTrail?.length) drawTrail(ctx, palette.homerL, frame.ballTrail);
  for (const runner of frame.runners ?? []) {
    drawTrail(ctx, runner.trailColor ?? palette.runnerL, runner.trail);
  }
  if (frame.ball) drawPixelBall(ctx, palette, frame.ball, frame.ballColor ?? palette.base);
  for (const runner of frame.runners ?? []) {
    drawPixelRunner(ctx, palette, runner.position, runner.squash, runner.color);
  }
}

function gamecastBasePositions() {
  return {
    home: { x: 40, y: 66 },
    first: { x: 62, y: 48 },
    second: { x: 40, y: 28 },
    third: { x: 18, y: 48 }
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
      runners: []
    };
  }

  const slotMs = GAMECAST_PA_MS + GAMECAST_PA_GAP_MS;
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
      progress: 1
    };
  }

  const index = Math.min(events.length - 1, Math.floor(state.elapsedMs / slotMs));
  const localMs = state.elapsedMs - index * slotMs;
  const event = events[index];
  const progress = Math.max(0, Math.min(1, localMs / GAMECAST_PA_MS));
  const settling = progress >= 0.72;
  const clearingInning = event.inningEnded && progress >= 0.92;
  const baseOccupancy = settling
    ? (clearingInning ? [false, false, false] : event.basesAfter)
    : baseOccupancyDuringMove(event, progress);
  const score = scoreForGamecastFrame(seq, events, index, progress >= 0.68);

  return {
    done: false,
    event,
    side: event.side,
    bases: baseOccupancy,
    outs: displayOutsForEvent(event, progress),
    score,
    runners: buildRunnerSprites(event, progress, state.palette),
    ball: buildBallSprite(event, progress),
    ballTrail: buildBallTrail(event, progress),
    ballColor: event.outcome === "homeRun" ? state.palette.homer : state.palette.base,
    scoreFlash: event.runs > 0 && progress >= 0.62 && progress <= 0.84,
    flash: event.outcome === "homeRun" && progress >= 0.68 && progress < 0.76,
    progress
  };
}

function baseOccupancyDuringMove(event, progress) {
  const advance = gamecastAdvanceCount(event.outcome);
  if (progress < 0.15 || advance <= 0) return event.basesBefore;
  return [false, false, false];
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
  if (progress < 0.15 || progress >= 0.72) return [];

  const moveT = Math.max(0, Math.min(1, (progress - 0.15) / 0.57));
  const eased = easeOutCubic(moveT);
  const runners = [];

  if (advance > 0) {
    event.basesBefore.forEach((occupied, index) => {
      if (!occupied) return;
      const startBase = index + 1;
      const targetBase = Math.min(4, startBase + advance);
      runners.push(makeRunnerSprite(gamecastPathBetween(startBase, targetBase), eased, palette.runner, palette.runnerL, moveT));
    });
    const batterTarget = Math.min(4, advance);
    runners.push(makeRunnerSprite(gamecastPathBetween(0, batterTarget), eased, event.outcome === "walk" ? palette.walk : palette.runner, palette.runnerL, moveT));
    return runners;
  }

  const bases = gamecastBasePositions();
  const outT = Math.min(1, moveT * 1.3);
  runners.push({
    position: {
      x: Math.round(lerp(bases.home.x, bases.home.x + 7, outT)),
      y: Math.round(lerp(bases.home.y, bases.home.y - 3, outT))
    },
    trail: [],
    color: palette.out,
    squash: progress > 0.55
  });
  return runners;
}

function makeRunnerSprite(path, eased, color, trailColor, moveT) {
  const position = positionAlongPath(path, eased);
  return {
    position,
    trail: [
      positionAlongPath(path, Math.max(0, eased - 0.12)),
      positionAlongPath(path, Math.max(0, eased - 0.24))
    ],
    color,
    trailColor,
    squash: moveT > 0.92
  };
}

function buildBallSprite(event, progress) {
  const bases = gamecastBasePositions();
  if (progress < 0.15) {
    const t = progress / 0.15;
    return {
      x: Math.round(lerp(40, bases.home.x, t)),
      y: Math.round(lerp(46, bases.home.y - 4, t))
    };
  }
  if (event.outcome !== "homeRun" || progress >= 0.72) return null;
  const t = Math.max(0, Math.min(1, (progress - 0.15) / 0.57));
  const eased = easeOutCubic(t);
  return {
    x: Math.round(40 + Math.sin(t * Math.PI) * 22),
    y: Math.round(63 - 48 * eased - Math.sin(t * Math.PI) * 12)
  };
}

function buildBallTrail(event, progress) {
  if (event.outcome !== "homeRun" || progress < 0.18 || progress >= 0.72) return [];
  const points = [];
  for (const offset of [0.08, 0.16]) {
    const p = Math.max(0.15, progress - offset);
    const t = Math.max(0, Math.min(1, (p - 0.15) / 0.57));
    const eased = easeOutCubic(t);
    points.push({
      x: Math.round(40 + Math.sin(t * Math.PI) * 22),
      y: Math.round(63 - 48 * eased - Math.sin(t * Math.PI) * 12)
    });
  }
  return points;
}

function gamecastAdvanceCount(outcome) {
  if (outcome === "homeRun") return 4;
  if (outcome === "triple") return 3;
  if (outcome === "double") return 2;
  if (outcome === "single" || outcome === "walk") return 1;
  return 0;
}

function gamecastPathBetween(startBase, targetBase) {
  const bases = gamecastBasePositions();
  const points = [bases.home, bases.first, bases.second, bases.third, { x: 40, y: 70 }];
  const start = Math.max(0, Math.min(4, startBase));
  const target = Math.max(start, Math.min(4, targetBase));
  return points.slice(start, target + 1).map((point) => ({ ...point }));
}

function positionAlongPath(path, t) {
  if (!path.length) return { x: 40, y: 66 };
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
  for (const item of state.feedItems ?? []) {
    item.classList.toggle("is-live", Boolean(frame.event?.id && !frame.done && item.dataset.gamecastEventId === frame.event.id));
  }
}

function drawPixelScoreBurst(ctx, palette, frame) {
  const count = Math.max(1, Math.min(4, Number(frame.event?.runs ?? 1)));
  const x = 8;
  const y = 63;
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x + 2, y, 1, 7);
  ctx.fillRect(x, y + 3, 5, 1);
  ctx.fillRect(x + 7, y, 2, 7);
  ctx.fillStyle = palette.homerL;
  ctx.fillRect(x + 2, y + 1, 1, 5);
  ctx.fillRect(x + 1, y + 3, 3, 1);
  ctx.fillRect(x + 8, y + 1, 1, 5);
  ctx.fillStyle = palette.runnerL;
  for (let index = 1; index < count; index += 1) {
    ctx.fillRect(x + 11 + index * 2, y + 5, 1, 1);
  }
}

function drawPixelRunner(ctx, palette, position, squash, color) {
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - 2, y - 2, squash ? 6 : 5, squash ? 4 : 5);
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, y - 1, squash ? 4 : 3, squash ? 2 : 3);
  ctx.fillStyle = palette.runnerL;
  ctx.fillRect(x, y - 1, 1, 1);
}

function drawPixelBall(ctx, palette, position, color) {
  const x = Math.round(position.x);
  const y = Math.round(position.y);
  ctx.fillStyle = palette.outline;
  ctx.fillRect(x - 1, y - 1, 4, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 2, 2);
}

function drawTrail(ctx, color, trail) {
  ctx.fillStyle = color;
  for (const point of trail ?? []) {
    ctx.fillRect(Math.round(point.x), Math.round(point.y), 2, 2);
  }
}

function fillPixelDiamond(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y += 1) {
    const width = Math.max(1, Math.round((1 - Math.abs(y) / ry) * rx));
    ctx.fillRect(cx - width, cy + y, width * 2 + 1, 1);
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

function easeOutBack(value) {
  const c1 = 1.1;
  const c3 = c1 + 1;
  return 1 + c3 * (value - 1) ** 3 + c1 * (value - 1) ** 2;
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
    <li>
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
    <li>
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
    <li>
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
    <li>
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
    const item = typeof log === "string" ? { text: log } : log;
    return `
      <div class="news-item">
        <span>${escapeHtml(item.tag ?? "note")}</span>
        <strong>${escapeHtml(item.text ?? item.message ?? "새 소식")}</strong>
        <small>${escapeHtml(item.date ?? state.currentDate ?? "")}</small>
      </div>
    `;
  }).join("");
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
