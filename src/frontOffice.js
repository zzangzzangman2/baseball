import {
  getDepthNeeds,
  getPayrollPressure,
  getProspectWatch,
  getTradeBlock
} from "./systems.js";

export const FRONT_OFFICE_SCHEMA_VERSION = 1;

const DEFAULT_SEED = "kbo-gm-front-office-v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRADE_DEADLINE_MONTH_DAY = "07-31";
const MAX_TRADE_TARGETS = 42;
const MAX_TRADE_PROPOSALS = 10;
const TRADE_CASH_UNIT_KRW = 100_000_000;
const TRADE_CASH_VALUE_PER_UNIT = 5.5;
const TRADE_DRAFT_PICK_VALUES = {
  1: 42,
  2: 31,
  3: 23,
  4: 16,
  5: 11
};
const TRADE_AUTO_APPROVAL_MIN_ACCEPTANCE = 74;
const TRADE_AUTO_APPROVAL_MAX_DEFICIT = -4;
const TRADE_AUTO_APPROVAL_MAX_OVERPAY = 38;
const TRADE_MIN_PLAYER_VALUE_RATIO = 0.62;
const TRADE_MIN_ELITE_PLAYER_VALUE_RATIO = 0.78;
const TRADE_MAX_OVR_GAP = 26;
const TRADE_MAX_ELITE_OVR_GAP = 14;
const TRADE_ELITE_OVR = 145;
const TRADE_ELITE_POT = 175;

const POSITION_GROUPS = [
  { key: "pitcher", label: "투수", positions: ["P", "SP", "RP", "CP"], target: 18 },
  { key: "catcher", label: "포수", positions: ["C"], target: 3 },
  { key: "infield", label: "내야수", positions: ["IF", "1B", "2B", "3B", "SS"], target: 10 },
  { key: "outfield", label: "외야수", positions: ["OF", "LF", "CF", "RF"], target: 7 },
  { key: "utility", label: "유틸리티", positions: ["DH", "UT"], target: 0 }
];

const UNKNOWN_GROUP = { key: "other", label: "기타", positions: [], target: 0 };

const PRIORITY_WEIGHT = {
  critical: 5,
  high: 4,
  normal: 3,
  watch: 2,
  low: 1
};

/**
 * Builds a deterministic trade-market view for a club.
 *
 * This module never mutates rosters. It creates reviewable market data that
 * engine trade commands can validate and commit.
 */
export function buildTradeMarket(state, teamId) {
  const team = findTeam(state, teamId);
  if (!team) return emptyTradeMarket(state, teamId);

  const context = buildContext(state, team);
  const needs = getNeedCards(team);
  const payroll = getPayrollPressure(team);
  const surplus = getTradeBlock(state, team.id);
  const outgoingPool = buildOutgoingPool(state, team, surplus);
  const targets = buildTradeTargets(state, team, needs, context.strategy);
  const proposals = buildTradeProposals(state, team, targets, outgoingPool);

  return {
    schemaVersion: FRONT_OFFICE_SCHEMA_VERSION,
    type: "tradeMarket",
    date: context.date,
    day: context.day,
    team: context.team,
    strategy: context.strategy,
    payroll,
    needs,
    surplusGroups: surplus.surplusGroups,
    outgoingPool,
    targets,
    proposals,
    marketNotes: buildMarketNotes(context, needs, payroll, targets, proposals)
  };
}

/**
 * Builds deterministic scouting assignments for pro trade targets, internal
 * development checks, payroll audits, and broad draft coverage.
 */
export function buildScoutAssignments(state, teamId) {
  const team = findTeam(state, teamId);
  if (!team) return emptyScoutAssignments(state, teamId);

  const context = buildContext(state, team);
  const market = buildTradeMarket(state, team.id);
  const prospects = getProspectWatch(team);
  const assignments = [];

  for (const [index, need] of market.needs.slice(0, 3).entries()) {
    const matchingTargets = market.targets
      .filter((target) => target.group === need.key)
      .slice(0, 5);

    assignments.push(
      makeAssignment(state, context, {
        type: "trade-pro",
        priority: need.severity >= 30 ? "critical" : index === 0 ? "high" : "normal",
        title: `${need.label} 트레이드 시장 조사`,
        focus: `타 구단 ${need.label} 매물과 협상 난이도`,
        targetGroup: need.key,
        dueOffset: 2 + index * 2,
        workloadHours: clamp(8 + Math.round(safeNumber(need.severity) / 4), 8, 20),
        reason: `${need.count}/${need.target} 구성, 긴급도 ${need.urgency}`,
        candidates: matchingTargets.map((target) => target.player),
        deliverables: ["후보 가치 비교", "상대 구단 필요 포지션", "부상/피로 리스크 점검"]
      })
    );
  }

  if (prospects.players.length > 0) {
    assignments.push(
      makeAssignment(state, context, {
        type: "development",
        priority: context.strategy.mode === "develop" ? "high" : "normal",
        title: "내부 유망주 콜업 점검",
        focus: "현재 로스터 유망주의 성장 여지와 출전 기회",
        targetGroup: "internal",
        dueOffset: 5,
        workloadHours: 10,
        reason: `관찰 후보 ${prospects.candidateCount}명`,
        candidates: prospects.players.slice(0, 6),
        deliverables: ["출전 기회 추천", "육성 우선순위", "트레이드 보호 명단 후보"]
      })
    );
  }

  if (["critical", "high"].includes(market.payroll.level)) {
    assignments.push(
      makeAssignment(state, context, {
        type: "payroll-audit",
        priority: market.payroll.level === "critical" ? "critical" : "high",
        title: "연봉 압박 완화 플랜",
        focus: "고비용 뎁스 자산과 트레이드 가능성",
        targetGroup: "finance",
        dueOffset: 3,
        workloadHours: 8,
        reason: `payroll room ${market.payroll.room}`,
        candidates: market.outgoingPool.slice(0, 5).map((asset) => asset.player),
        deliverables: ["정리 후보", "대체 내부 자원", "협상 우선순위"]
      })
    );
  }

  const rivals = selectStandingsNeighbors(state, team.id, 2);
  if (rivals.length > 0) {
    assignments.push(
      makeAssignment(state, context, {
        type: "opponent-advance",
        priority: context.strategy.mode === "contend" ? "high" : "normal",
        title: "순위 경쟁팀 전력분석",
        focus: rivals.map((rival) => rival.shortName ?? rival.name).join(", "),
        targetGroup: "opponent",
        dueOffset: 4,
        workloadHours: 6 + rivals.length * 2,
        reason: `현재 순위 ${context.strategy.rank}위 기준 근접 구단`,
        candidates: [],
        teams: rivals.map(toTeamSummary),
        deliverables: ["상대 강점", "약점 포지션", "트레이드 경쟁 가능성"]
      })
    );
  }

  if (context.strategy.mode !== "contend" || market.needs.some((need) => need.urgency === "high")) {
    assignments.push(
      makeAssignment(state, context, {
        type: "draft-board",
        priority: context.strategy.mode === "develop" ? "high" : "normal",
        title: "국내 신인/퓨처스 보강 방향",
        focus: market.needs.slice(0, 2).map((need) => need.label).join(", ") || "전 포지션",
        targetGroup: "amateur",
        dueOffset: 9,
        workloadHours: 12,
        reason: "실제 후보 이름은 별도 검증 데이터가 붙기 전까지 생성하지 않음",
        candidates: [],
        deliverables: ["포지션별 우선순위", "관찰 지역/학교", "다음 데이터 수집 요청"]
      })
    );
  }

  const sortedAssignments = assignments
    .sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      const dueDiff = compareText(a.dueDate, b.dueDate);
      if (dueDiff !== 0) return dueDiff;
      return compareText(a.id, b.id);
    })
    .map((assignment, index) => ({ ...assignment, queueRank: index + 1 }));

  return {
    schemaVersion: FRONT_OFFICE_SCHEMA_VERSION,
    type: "scoutAssignments",
    date: context.date,
    day: context.day,
    team: context.team,
    strategy: context.strategy,
    sourcePolicy: "실제 선수명은 현재 로스터/공식 수집 데이터에서만 표시하며, 미검증 후보명은 생성하지 않습니다.",
    coverage: {
      assignments: sortedAssignments.length,
      tradeTargetsWatched: market.targets.length,
      internalProspectsWatched: prospects.players.length,
      urgentNeeds: market.needs.filter((need) => need.urgency === "high").length
    },
    assignments: sortedAssignments
  };
}

/**
 * Builds actionable front-office inbox items from the current deterministic
 * state. Items are review prompts, not automatic decisions.
 */
export function buildFrontOfficeInbox(state, teamId) {
  const team = findTeam(state, teamId);
  if (!team) return emptyInbox(state, teamId);

  const context = buildContext(state, team);
  const market = buildTradeMarket(state, team.id);
  const scouting = buildScoutAssignments(state, team.id);
  const prospects = getProspectWatch(team);
  const health = getHealthSummary(team);
  const deadline = getTradeDeadlineInfo(context.date);
  const items = [];

  if (deadline.daysRemaining >= 0 && deadline.daysRemaining <= 30) {
    items.push(
      makeInboxItem(context, {
        category: "trade",
        severity: deadline.daysRemaining <= 7 ? "critical" : "high",
        title: "트레이드 마감 임박",
        body: `${deadline.deadlineDate}까지 ${deadline.daysRemaining}일 남았습니다. 상위 제안 ${market.proposals.length}건을 먼저 검토하세요.`,
        action: "review_trade_market",
        payload: {
          deadlineDate: deadline.deadlineDate,
          daysRemaining: deadline.daysRemaining,
          proposalIds: market.proposals.slice(0, 3).map((proposal) => proposal.id)
        }
      })
    );
  } else if (deadline.daysRemaining < 0) {
    items.push(
      makeInboxItem(context, {
        category: "trade",
        severity: "watch",
        title: "트레이드 마감 종료",
        body: `${deadline.deadlineDate} 마감 이후입니다. 로스터 이동은 다음 phase 규칙이 필요합니다.`,
        action: "lock_trade_market",
        payload: { deadlineDate: deadline.deadlineDate }
      })
    );
  }

  for (const need of market.needs.filter((entry) => entry.urgency === "high").slice(0, 2)) {
    items.push(
      makeInboxItem(context, {
        category: "roster",
        severity: safeNumber(need.severity) >= 35 ? "critical" : "high",
        title: `${need.label} 뎁스 회의`,
        body: `${need.count}/${need.target} 구성입니다. 스카우트 보드와 내부 대체 자원을 같이 확인하세요.`,
        action: "review_depth_need",
        payload: { group: need.key, severity: need.severity, target: need.target, count: need.count }
      })
    );
  }

  for (const proposal of market.proposals.slice(0, 3)) {
    items.push(
      makeInboxItem(context, {
        category: "trade",
        severity: proposal.status === "viable" ? "high" : "normal",
        title: `${proposal.target.player.name} 트레이드 검토`,
        body: `${proposal.target.teamName}와의 패키지 균형 ${proposal.valueBalance}, 수락 가능성 ${proposal.acceptanceScore}/100.`,
        action: "review_trade_proposal",
        payload: { proposalId: proposal.id, status: proposal.status }
      })
    );
  }

  if (["critical", "high"].includes(market.payroll.level)) {
    items.push(
      makeInboxItem(context, {
        category: "finance",
        severity: market.payroll.level === "critical" ? "critical" : "high",
        title: "연봉 압박 경고",
        body: `현재 payroll pressure ${market.payroll.pressureScore}/100입니다. 정리 후보와 대체 자원을 먼저 비교하세요.`,
        action: "review_payroll",
        payload: {
          level: market.payroll.level,
          room: market.payroll.room,
          pressureScore: market.payroll.pressureScore
        }
      })
    );
  }

  if (health.unavailable > 0 || health.highFatigue >= 5) {
    items.push(
      makeInboxItem(context, {
        category: "health",
        severity: health.unavailable >= 3 ? "high" : "normal",
        title: "컨디션/부상 점검",
        body: `부상 ${health.unavailable}명, 고피로 ${health.highFatigue}명입니다. 라인업과 콜업 판단이 필요합니다.`,
        action: "review_health",
        payload: health
      })
    );
  }

  const readyProspects = prospects.players
    .filter((player) => player.stage === "near_ready" || rating100(player.upside) >= 6)
    .slice(0, 3);
  if (readyProspects.length > 0) {
    items.push(
      makeInboxItem(context, {
        category: "development",
        severity: context.strategy.mode === "develop" ? "high" : "normal",
        title: "유망주 활용 회의",
        body: `${readyProspects.map((player) => player.name).join(", ")}의 출전 기회와 보호 우선순위를 확인하세요.`,
        action: "review_prospects",
        payload: { playerIds: readyProspects.map((player) => player.id) }
      })
    );
  }

  for (const assignment of scouting.assignments.slice(0, 2)) {
    items.push(
      makeInboxItem(context, {
        category: "scout",
        severity: assignment.priority,
        title: `${assignment.title} 배정`,
        body: `${assignment.dueDate}까지 ${assignment.workloadHours}시간 배정. 산출물: ${assignment.deliverables.join(", ")}.`,
        action: "review_scout_assignment",
        payload: { assignmentId: assignment.id, type: assignment.type }
      })
    );
  }

  const sortedItems = items
    .sort((a, b) => {
      const severityDiff = PRIORITY_WEIGHT[b.severity] - PRIORITY_WEIGHT[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return compareText(a.id, b.id);
    })
    .map((item, index) => ({ ...item, queueRank: index + 1 }));

  return {
    schemaVersion: FRONT_OFFICE_SCHEMA_VERSION,
    type: "frontOfficeInbox",
    date: context.date,
    day: context.day,
    team: context.team,
    strategy: context.strategy,
    summary: {
      totalItems: sortedItems.length,
      critical: sortedItems.filter((item) => item.severity === "critical").length,
      high: sortedItems.filter((item) => item.severity === "high").length,
      tradeProposals: market.proposals.length,
      scoutAssignments: scouting.assignments.length
    },
    items: sortedItems
  };
}

function buildContext(state, team) {
  const date = normalizeDateKey(state?.currentDate);
  const day = Math.max(1, Math.floor(safeNumber(state?.day, 1)));
  const strategy = buildTeamStrategy(state, team);

  return {
    date,
    day,
    seed: resolveSeed(state),
    team: toTeamSummary(team, strategy),
    strategy
  };
}

function buildTeamStrategy(state, team) {
  const standings = rankStandings(state);
  const ranked = standings.find((entry) => String(entry.team.id) === String(team.id));
  const roster = normalizeRoster(team);
  const topTalent = average(sortPlayers(roster, "ovr").slice(0, 12), "ovr");
  const topTalent100 = rating100(topTalent);
  const youngUpside = roster.filter((player) => player.age <= 25 && rating100(player.upside) >= 4).length;
  const veteranLoad = roster.filter((player) => player.age >= 32).length;
  const injured = roster.filter((player) => player.injuredDays > 0).length;
  const payroll = getPayrollPressure(team);
  const rank = ranked?.rank ?? standings.length;
  const pct = ranked?.pct ?? 0;
  const morale = safeNumber(team?.morale, 50);
  const contentionScore = clamp(
    Math.round(topTalent100 * 0.7 + pct * 35 + (11 - rank) * 4 + morale * 0.25 - injured * 2),
    0,
    100
  );
  const timelineScore = clamp(Math.round(youngUpside * 5 - veteranLoad * 2 + (100 - contentionScore) * 0.25), 0, 100);

  let mode = "balanced";
  if (contentionScore >= 70 && !["critical"].includes(payroll.level)) mode = "contend";
  if (contentionScore < 48 || timelineScore >= 62) mode = "develop";
  if (["critical", "high"].includes(payroll.level) && contentionScore < 64) mode = "retool";

  return {
    mode,
    label: strategyLabel(mode),
    rank,
    teamCount: standings.length,
    pct: round(pct, 3),
    contentionScore,
    timelineScore,
    topTalent: round(topTalent),
    youngUpside,
    veteranLoad,
    injured,
    payrollLevel: payroll.level
  };
}

function getNeedCards(team) {
  const depthNeeds = getDepthNeeds(team);
  const source = depthNeeds.needs.length > 0
    ? depthNeeds.needs
    : depthNeeds.groups.filter((group) => group.target > 0).sort((a, b) => b.severity - a.severity);

  return source.slice(0, 5).map((need) => ({
    key: need.key,
    label: groupLabel(need.key, need.label),
    positions: need.positions,
    count: need.count,
    target: need.target,
    countGap: need.countGap,
    surplus: need.surplus,
    averageAge: need.averageAge,
    averageOvr: need.averageOvr,
    averagePot: need.averagePot,
    topAverageOvr: need.topAverageOvr,
    topPlayer: need.topPlayer,
    prospectCount: need.prospectCount,
    severity: need.severity,
    urgency: need.urgency
  }));
}

function buildOutgoingPool(state, team, tradeBlock) {
  const blockPlayers = Array.isArray(tradeBlock?.players) ? tradeBlock.players : [];
  const blockIds = new Set(blockPlayers.map((entry) => entry.player?.id).filter(Boolean));
  const roster = normalizeRoster(team);
  const ranked = rankRosterByGroup(roster);
  const groupMap = buildGroupSummary(team);
  const pool = [];

  for (const entry of blockPlayers) {
    const player = normalizePlayer(entry.player, 0, team);
    if (!player) continue;
    pool.push({
      assetType: "player",
      reason: entry.reason,
      depthRank: entry.depthRank,
      surplus: entry.surplus,
      blockScore: entry.blockScore,
      valueScore: round(entry.valueScore),
      player: toPlayerCard(player, state, team),
      riskFlags: buildPlayerRiskFlags(player)
    });
  }

  for (const entry of ranked) {
    if (blockIds.has(entry.player.id)) continue;
    const group = groupMap.get(entry.player.groupKey) ?? UNKNOWN_GROUP;
    if (group.surplus <= 0 || entry.depthRank <= group.target) continue;

    pool.push({
      assetType: "player",
      reason: entry.player.age <= 25 ? "blocked_prospect" : "surplus_depth",
      depthRank: entry.depthRank,
      surplus: group.surplus,
      blockScore: round(group.surplus * 7 + entry.depthRank * 2 + tradeValueScore(entry.player) * 0.08),
      valueScore: round(tradeValueScore(entry.player)),
      player: toPlayerCard(entry.player, state, team),
      riskFlags: buildPlayerRiskFlags(entry.player)
    });
  }

  return uniqueBy(pool, (asset) => asset.player.id)
    .sort((a, b) => b.blockScore - a.blockScore || b.valueScore - a.valueScore || compareText(a.player.name, b.player.name))
    .slice(0, 18);
}

function buildTradeTargets(state, buyerTeam, needs, buyerStrategy) {
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  const needByGroup = new Map(needs.map((need) => [need.key, need]));
  const targets = [];

  for (const sellerTeam of teams) {
    if (String(sellerTeam?.id) === String(buyerTeam.id)) continue;

    const sellerStrategy = buildTeamStrategy(state, sellerTeam);
    const sellerPayroll = getPayrollPressure(sellerTeam);
    const sellerBlock = getTradeBlock(state, sellerTeam.id);
    const blockIds = new Set((sellerBlock.players ?? []).map((entry) => entry.player?.id).filter(Boolean));

    for (const player of normalizeRoster(sellerTeam)) {
      const need = needByGroup.get(player.groupKey);
      const availabilityScore = targetAvailabilityScore(player, sellerStrategy, sellerPayroll, blockIds.has(player.id));
      const fitScore = targetFitScore(player, need, buyerStrategy);
      const marketScore = round(fitScore + availabilityScore * 0.55 + seededTieBreak(state, buyerTeam.id, sellerTeam.id, player.id) * 0.01);

      if (marketScore < 74 && !need) continue;

      targets.push({
        assetType: "player",
        teamId: String(sellerTeam.id ?? ""),
        teamName: getTeamName(sellerTeam),
        teamShortName: String(sellerTeam.shortName ?? sellerTeam.name ?? ""),
        group: player.groupKey,
        groupLabel: groupLabel(player.groupKey),
        fitType: targetFitType(player, need, buyerStrategy),
        fitScore: round(fitScore),
        availabilityScore: round(availabilityScore),
        marketScore,
        valueScore: round(tradeValueScore(player)),
        sourceConfidence: sourceConfidence(player),
        sellerStrategy: {
          mode: sellerStrategy.mode,
          label: sellerStrategy.label,
          contentionScore: sellerStrategy.contentionScore,
          payrollLevel: sellerStrategy.payrollLevel
        },
        need: need ? compactNeed(need) : null,
        player: toPlayerCard(player, state, sellerTeam),
        riskFlags: buildPlayerRiskFlags(player)
      });
    }
  }

  return targets
    .sort((a, b) => {
      const scoreDiff = b.marketScore - a.marketScore;
      if (scoreDiff !== 0) return scoreDiff;
      const valueDiff = b.valueScore - a.valueScore;
      if (valueDiff !== 0) return valueDiff;
      return compareText(a.player.name, b.player.name);
    })
    .slice(0, MAX_TRADE_TARGETS);
}

function buildTradeProposals(state, buyerTeam, targets, outgoingPool) {
  return targets.slice(0, MAX_TRADE_PROPOSALS).map((target, index) => {
    const playerAssets = selectOutgoingPackage(state, target, outgoingPool, index);
    const targetValue = safeNumber(target.valueScore);
    const supplementalAssets = buildSupplementalTradeAssets(state, buyerTeam, target, playerAssets, targetValue, index);
    const outgoing = [...playerAssets, ...supplementalAssets];
    const outgoingValue = round(sum(outgoing, "valueScore"));
    const valueBalance = round(outgoingValue - targetValue);
    const acceptanceScore = estimateAcceptanceScore(target, outgoing, valueBalance);
    const executionGate = evaluateTradeExecutionGate({
      target,
      outgoing,
      playerAssets,
      targetValue,
      outgoingValue,
      valueBalance,
      acceptanceScore
    });
    const status = proposalStatus(acceptanceScore, playerAssets.length, executionGate);
    const needsFollowUp = [
      playerAssets.length === 0 ? "보낼 선수 자산 부족" : "",
      target.sourceConfidence !== "high" ? "선수 소스 재검증" : "",
      target.riskFlags.length > 0 ? "리스크 메디컬/컨디션 체크" : "",
      supplementalAssets.some((asset) => asset.assetType === "conditional") ? "조건부 자산 트리거 확인" : "",
      supplementalAssets.some((asset) => asset.assetType === "ptbnl") ? "후일결정선수 deadline 필요" : "",
      ...executionGate.blockers
    ].filter(Boolean);

    return {
      id: makeStableId(state, "trade", buyerTeam.id, target.teamId, target.player.id, index),
      status,
      target,
      outgoing,
      outgoingPlayers: playerAssets,
      supplementalAssets,
      incomingValue: targetValue,
      outgoingValue,
      valueBalance,
      acceptanceScore,
      executionGate,
      needsFollowUp,
      summary: `${buyerTeam.shortName ?? buyerTeam.name} 영입: ${target.player.name}; ${target.teamShortName} 수령: ${formatTradeAssetSummary(outgoing)}`
    };
  });
}

function selectOutgoingPackage(state, target, outgoingPool, proposalIndex) {
  const targetValue = safeNumber(target.valueScore);
  const candidates = outgoingPool
    .filter((asset) => asset.player.teamId !== target.teamId)
    .map((asset) => ({
      ...asset,
      packageScore:
        Math.abs(targetValue - safeNumber(asset.valueScore)) -
        (asset.player.group === target.group ? 4 : 0) -
        seededTieBreak(state, target.player.id, asset.player.id, proposalIndex) * 0.001
    }))
    .sort((a, b) => a.packageScore - b.packageScore || b.valueScore - a.valueScore);

  if (candidates.length === 0) return [];

  const packageAssets = [stripPackageScore(candidates[0])];
  const firstValue = safeNumber(candidates[0].valueScore);

  if (firstValue < targetValue * 0.82) {
    const second = candidates
      .slice(1)
      .find((asset) => asset.player.id !== candidates[0].player.id && firstValue + safeNumber(asset.valueScore) <= targetValue * 1.35);
    if (second) packageAssets.push(stripPackageScore(second));
  }

  return packageAssets;
}

function buildSupplementalTradeAssets(state, buyerTeam, target, playerAssets, targetValue, proposalIndex) {
  const assets = [];
  const buyerTeamId = String(buyerTeam?.id ?? "");
  const sellerTeamId = String(target?.teamId ?? "");
  let gap = Math.max(0, safeNumber(targetValue) - sum(playerAssets, "valueScore"));
  if (!buyerTeamId || !sellerTeamId || gap <= 4) return assets;

  if (gap >= 18) {
    const pickRound = chooseTradePickRound(gap, proposalIndex);
    const pickValue = TRADE_DRAFT_PICK_VALUES[pickRound] ?? 10;
    assets.push({
      assetType: "draftPick",
      id: makeStableId(state, "pick", buyerTeamId, sellerTeamId, target.player.id, pickRound, proposalIndex),
      fromTeamId: buyerTeamId,
      fromTeamName: getTeamName(buyerTeam),
      toTeamId: sellerTeamId,
      toTeamName: target.teamName,
      year: tradePickYear(state),
      round: pickRound,
      pickLabel: `${tradePickYear(state)} 신인 ${pickRound}라운드 지명권`,
      protection: pickRound <= 2 ? "top-3-protected-v1" : "none",
      valueScore: pickValue,
      reason: "value-gap-pick-sweetener"
    });
    gap -= pickValue;
  }

  if (gap >= 5 || proposalIndex % 3 === 1) {
    const cashUnits = clamp(Math.ceil(Math.max(gap, 5) / TRADE_CASH_VALUE_PER_UNIT), 1, 5);
    assets.push({
      assetType: "cash",
      id: makeStableId(state, "cash", buyerTeamId, sellerTeamId, target.player.id, proposalIndex, cashUnits),
      fromTeamId: buyerTeamId,
      fromTeamName: getTeamName(buyerTeam),
      toTeamId: sellerTeamId,
      toTeamName: target.teamName,
      amountKRW: cashUnits * TRADE_CASH_UNIT_KRW,
      valueScore: round(cashUnits * TRADE_CASH_VALUE_PER_UNIT),
      reason: "cash-balance"
    });
    gap -= cashUnits * TRADE_CASH_VALUE_PER_UNIT;
  }

  if (gap > 5 || target.riskFlags?.length || proposalIndex % 5 === 2) {
    assets.push({
      assetType: "conditional",
      id: makeStableId(state, "conditional", buyerTeamId, sellerTeamId, target.player.id, proposalIndex),
      fromTeamId: buyerTeamId,
      fromTeamName: getTeamName(buyerTeam),
      toTeamId: sellerTeamId,
      toTeamName: target.teamName,
      condition: "acquired-player-80-games-or-40-innings",
      convertsTo: "cash-100m-or-2028-5R",
      deadline: `${tradePickYear(state)}-11-30`,
      valueScore: 8,
      reason: "risk-sharing"
    });
    gap -= 8;
  }

  if (gap > 6 || target.sourceConfidence !== "high" || proposalIndex % 7 === 3) {
    assets.push({
      assetType: "ptbnl",
      id: makeStableId(state, "ptbnl", buyerTeamId, sellerTeamId, target.player.id, proposalIndex),
      fromTeamId: buyerTeamId,
      fromTeamName: getTeamName(buyerTeam),
      toTeamId: sellerTeamId,
      toTeamName: target.teamName,
      pool: "40-man-excluded-followup-pool-v1",
      deadline: `${tradePickYear(state)}-12-15`,
      valueScore: 10,
      reason: "player-to-be-named-later"
    });
  }

  return assets;
}

function chooseTradePickRound(gap, proposalIndex) {
  if (gap >= 38 && proposalIndex % 4 === 0) return 1;
  if (gap >= 26) return 2;
  if (gap >= 18) return 3;
  return 4;
}

function tradePickYear(state) {
  const year = Number(String(state?.currentDate ?? "").slice(0, 4));
  return Number.isFinite(year) ? year + 1 : 2027;
}

function formatTradeAssetSummary(assets) {
  if (!assets?.length) return "추가 자산 필요";
  return assets.map(formatTradeAssetLabel).join(", ");
}

function formatTradeAssetLabel(asset) {
  if (asset.assetType === "player") return asset.player?.name ?? "선수";
  if (asset.assetType === "cash") return `현금 ${Math.round(safeNumber(asset.amountKRW) / 100_000_000)}억`;
  if (asset.assetType === "draftPick") return asset.pickLabel ?? `${asset.round}R 지명권`;
  if (asset.assetType === "conditional") return "조건부 자산";
  if (asset.assetType === "ptbnl") return "후일결정선수";
  return asset.assetType ?? "자산";
}

function makeAssignment(state, context, input) {
  const id = makeStableId(state, "scout", context.team.id, input.type, input.targetGroup, input.title);

  return {
    id,
    type: input.type,
    priority: input.priority,
    title: input.title,
    focus: input.focus,
    targetGroup: input.targetGroup,
    dueDate: addDays(context.date, input.dueOffset),
    workloadHours: input.workloadHours,
    reason: input.reason,
    candidates: (input.candidates ?? []).map((candidate) => normalizeCandidateCard(candidate)),
    teams: input.teams ?? [],
    deliverables: input.deliverables,
    sourcePolicy: input.candidates?.length
      ? "현재 로스터 데이터에 존재하는 선수만 후보로 표시"
      : "선수명 생성 없음; 다음 데이터 수집 작업 필요"
  };
}

function makeInboxItem(context, input) {
  return {
    id: makeStableId({ rngSeed: context.seed }, "inbox", context.team.id, context.date, input.category, input.title),
    date: context.date,
    category: input.category,
    severity: input.severity,
    title: input.title,
    body: input.body,
    action: input.action,
    payload: input.payload
  };
}

function targetFitScore(player, need, buyerStrategy) {
  const needSeverity = safeNumber(need?.severity);
  const needBonus = need ? 18 + needSeverity * 0.7 + safeNumber(need.countGap) * 6 : 0;
  const contenderBonus = buyerStrategy.mode === "contend" ? rating100(player.ovr) * 0.35 : rating100(player.pot) * 0.3;
  const youthBonus = buyerStrategy.mode === "develop" ? Math.max(0, 28 - player.age) * 1.8 + rating100(player.upside) * 3 : rating100(player.upside) * 1.5;

  return round(rating100(player.ovr) * 0.9 + rating100(player.pot) * 0.35 + needBonus + contenderBonus + youthBonus);
}

function targetAvailabilityScore(player, sellerStrategy, sellerPayroll, onTradeBlock) {
  let score = onTradeBlock ? 42 : 16;
  if (sellerStrategy.mode === "retool") score += player.age >= 29 ? 18 : 7;
  if (sellerStrategy.mode === "develop") score += player.age >= 30 ? 16 : -8;
  if (sellerStrategy.mode === "contend" && rating100(player.ovr) >= 65) score -= 18;
  if (["critical", "high"].includes(sellerPayroll.level)) score += 12;
  if (player.status === "candidate") score -= 8;
  if (player.injuredDays > 0) score += 5;

  return clamp(score, 0, 100);
}

function targetFitType(player, need, buyerStrategy) {
  if (need && safeNumber(need.severity) >= 25) return "priority_need";
  if (buyerStrategy.mode === "develop" && player.age <= 25 && rating100(player.upside) >= 5) return "development_target";
  if (buyerStrategy.mode === "contend" && rating100(player.ovr) >= 64) return "win_now_upgrade";
  return "depth_upgrade";
}

function estimateAcceptanceScore(target, outgoing, valueBalance) {
  const base = 42 + valueBalance * 0.75 + safeNumber(target.availabilityScore) * 0.32;
  const playerAssets = outgoing.filter((asset) => asset.assetType === "player");
  const supplementalValue = sum(outgoing.filter((asset) => asset.assetType !== "player"), "valueScore");
  const packagePenalty = playerAssets.length === 0 ? -30 : 0;
  const qualityBonus = playerAssets.some((asset) => asset.player.age <= 25 && rating100(asset.player.upside) >= 4) ? 8 : 0;
  const sweetenerBonus = Math.min(12, supplementalValue * 0.18);
  const contenderPenalty = target.sellerStrategy.mode === "contend" && rating100(target.player.ovr) >= 65 ? -14 : 0;

  return clamp(Math.round(base + packagePenalty + qualityBonus + sweetenerBonus + contenderPenalty), 0, 100);
}

function evaluateTradeExecutionGate({ target, outgoing, playerAssets, targetValue, outgoingValue, valueBalance, acceptanceScore }) {
  const blockers = [];
  const warnings = [];
  const primaryAsset = [...(playerAssets ?? [])].sort((a, b) => safeNumber(b.valueScore) - safeNumber(a.valueScore))[0];
  const targetPlayer = target?.player ?? {};
  const outgoingPlayer = primaryAsset?.player ?? {};
  const targetOvr = safeNumber(targetPlayer.ovr);
  const targetPot = safeNumber(targetPlayer.pot, targetOvr);
  const outgoingOvr = safeNumber(outgoingPlayer.ovr);
  const outgoingPot = safeNumber(outgoingPlayer.pot, outgoingOvr);
  const primaryPlayerValue = safeNumber(primaryAsset?.valueScore);
  const supplementalValue = sum((outgoing ?? []).filter((asset) => asset.assetType !== "player"), "valueScore");
  const playerValueRatio = targetValue > 0 ? primaryPlayerValue / targetValue : 0;
  const supplementalRatio = targetValue > 0 ? supplementalValue / targetValue : 0;
  const isEliteTarget = targetOvr >= TRADE_ELITE_OVR || (targetPot >= TRADE_ELITE_POT && targetOvr >= 135);
  const ovrGap = targetOvr - outgoingOvr;
  const potGap = targetPot - outgoingPot;

  if (!primaryAsset) blockers.push("선수 자산 1명 필요");
  if (acceptanceScore < TRADE_AUTO_APPROVAL_MIN_ACCEPTANCE) blockers.push(`AI 수락 ${TRADE_AUTO_APPROVAL_MIN_ACCEPTANCE}% 미만`);
  if (valueBalance < TRADE_AUTO_APPROVAL_MAX_DEFICIT) blockers.push("가치 균형 마이너스 과다");
  if (valueBalance > TRADE_AUTO_APPROVAL_MAX_OVERPAY) warnings.push("과지불 위험");
  if (playerValueRatio < TRADE_MIN_PLAYER_VALUE_RATIO) blockers.push("보내는 선수 가치 축 부족");
  if (ovrGap > TRADE_MAX_OVR_GAP) blockers.push("OVR 격차 과다");
  if (potGap > 34) blockers.push("POT 격차 과다");
  if (supplementalRatio > 0.55) blockers.push("보조 자산 비중 과다");
  if (target?.sourceConfidence !== "high") blockers.push("대상 선수 출처 재검증 필요");
  if (target?.sellerStrategy?.mode === "contend" && targetOvr >= 132 && safeNumber(target.availabilityScore) < 42) {
    blockers.push("컨텐더 핵심 전력 매각 불가");
  }
  if (isEliteTarget) {
    if (acceptanceScore < 86) blockers.push("S급 선수 AI 수락 86% 미만");
    if (playerValueRatio < TRADE_MIN_ELITE_PLAYER_VALUE_RATIO) blockers.push("S급 선수 맞상대 자산 부족");
    if (ovrGap > TRADE_MAX_ELITE_OVR_GAP) blockers.push("S급 선수 OVR 격차 과다");
    if (safeNumber(target.availabilityScore) < 50) blockers.push("S급 선수 availability 낮음");
  }

  return {
    commandReady: blockers.length === 0,
    blockers,
    warnings,
    requiresTwoStepApproval: true,
    metrics: {
      targetValue: round(targetValue),
      outgoingValue: round(outgoingValue),
      valueBalance: round(valueBalance),
      acceptanceScore: safeNumber(acceptanceScore),
      primaryPlayerValue: round(primaryPlayerValue),
      playerValueRatio: round(playerValueRatio, 2),
      supplementalValue: round(supplementalValue),
      supplementalRatio: round(supplementalRatio, 2),
      targetOvr,
      outgoingOvr,
      ovrGap,
      potGap,
      isEliteTarget
    }
  };
}

function proposalStatus(acceptanceScore, outgoingCount, executionGate) {
  if (outgoingCount === 0) return "needs_assets";
  if (executionGate?.commandReady) return "viable";
  if (acceptanceScore >= 42) return "needs_sweetener";
  return "unlikely";
}

function buildMarketNotes(context, needs, payroll, targets, proposals) {
  const notes = [];
  const topNeed = needs[0];
  if (topNeed) {
    notes.push({
      type: "need",
      text: `${topNeed.label} 보강 우선순위가 가장 높습니다.`,
      payload: { group: topNeed.key, severity: topNeed.severity }
    });
  }
  if (["critical", "high"].includes(payroll.level)) {
    notes.push({
      type: "payroll",
      text: "연봉 압박 때문에 받는 자산보다 보내는 자산의 구조가 중요합니다.",
      payload: { level: payroll.level, room: payroll.room }
    });
  }
  if (context.strategy.mode === "contend") {
    notes.push({
      type: "strategy",
      text: "윈나우 모드에서는 즉시 전력의 fitScore를 더 높게 봅니다.",
      payload: { mode: context.strategy.mode }
    });
  }
  if (targets.some((target) => target.sourceConfidence !== "high")) {
    notes.push({
      type: "source",
      text: "일부 후보는 후보 데이터 출처라 트레이드 UI 연결 전에 소속/상태 재검증이 필요합니다.",
      payload: { lowerConfidenceTargets: targets.filter((target) => target.sourceConfidence !== "high").length }
    });
  }
  if (proposals.length === 0) {
    notes.push({
      type: "proposal",
      text: "현재 surplus 자산이 부족해 즉시 제안보다 스카우트 보드 검토가 먼저입니다.",
      payload: {}
    });
  }
  return notes;
}

function getHealthSummary(team) {
  const roster = normalizeRoster(team);
  const unavailable = roster.filter((player) => player.injuredDays > 0).length;
  const highFatigue = roster.filter((player) => player.fatigue >= 70).length;
  const lowForm = roster.filter((player) => player.form <= 38).length;

  return {
    unavailable,
    highFatigue,
    lowForm,
    rosterSize: roster.length
  };
}

function getTradeDeadlineInfo(dateKey) {
  const year = normalizeDateKey(dateKey).slice(0, 4);
  const deadlineDate = `${year}-${TRADE_DEADLINE_MONTH_DAY}`;
  const daysRemaining = daysBetween(dateKey, deadlineDate);

  return {
    deadlineDate,
    daysRemaining
  };
}

function selectStandingsNeighbors(state, teamId, radius) {
  const ranked = rankStandings(state);
  const current = ranked.find((entry) => String(entry.team.id) === String(teamId));
  if (!current) return [];

  return ranked
    .filter((entry) => entry.team.id !== teamId && Math.abs(entry.rank - current.rank) <= radius)
    .map((entry) => entry.team)
    .slice(0, 4);
}

function rankStandings(state) {
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  return [...teams]
    .map((team) => {
      const wins = safeNumber(team?.wins);
      const losses = safeNumber(team?.losses);
      const decisions = wins + losses;
      const pct = decisions > 0 ? wins / decisions : average(normalizeRoster(team).slice(0, 18), "ovr") / 200;
      const runDiff = safeNumber(team?.runsFor) - safeNumber(team?.runsAgainst);
      return { team, pct, wins, losses, runDiff };
    })
    .sort((a, b) => {
      const pctDiff = b.pct - a.pct;
      if (pctDiff !== 0) return pctDiff;
      const winDiff = b.wins - a.wins;
      if (winDiff !== 0) return winDiff;
      const runDiff = b.runDiff - a.runDiff;
      if (runDiff !== 0) return runDiff;
      return compareText(getTeamName(a.team), getTeamName(b.team));
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildGroupSummary(team) {
  const map = new Map(POSITION_GROUPS.map((group) => [group.key, { ...group, count: 0, surplus: 0 }]));
  map.set(UNKNOWN_GROUP.key, { ...UNKNOWN_GROUP, count: 0, surplus: 0 });

  for (const player of normalizeRoster(team)) {
    const group = map.get(player.groupKey) ?? map.get(UNKNOWN_GROUP.key);
    group.count += 1;
  }

  for (const group of map.values()) {
    group.surplus = Math.max(0, group.count - group.target);
  }

  return map;
}

function rankRosterByGroup(roster) {
  const byGroup = new Map();

  for (const player of roster) {
    const players = byGroup.get(player.groupKey) ?? [];
    players.push(player);
    byGroup.set(player.groupKey, players);
  }

  return [...byGroup.values()].flatMap((players) =>
    sortPlayers(players, "ovr").map((player, index) => ({
      player,
      depthRank: index + 1
    }))
  );
}

function normalizeRoster(team) {
  const roster = Array.isArray(team?.roster) ? team.roster : [];
  return roster.map((player, index) => normalizePlayer(player, index, team)).filter(Boolean);
}

function normalizePlayer(player, index, team) {
  const name = String(player?.name ?? "").trim();
  if (!name) return null;

  const position = normalizePosition(player?.position, player?.role);
  const group = getPositionGroup(position);
  const ovr = safeNumber(player?.ovr);
  const pot = Math.max(safeNumber(player?.pot, ovr), ovr);
  const age = safeNumber(player?.age);

  return {
    id: String(player?.id ?? `${team?.id ?? "team"}-${index}`),
    playerId: String(player?.playerId ?? ""),
    teamId: String(player?.teamId ?? team?.id ?? ""),
    teamName: getTeamName(team),
    name,
    position,
    groupKey: group.key,
    groupLabel: group.label,
    role: player?.role === "pitcher" ? "pitcher" : "hitter",
    age,
    ovr,
    pot,
    upside: Math.max(0, pot - ovr),
    fatigue: safeNumber(player?.fatigue),
    form: safeNumber(player?.form, 50),
    injuredDays: safeNumber(player?.injuredDays),
    status: String(player?.status ?? "registered"),
    source: String(player?.source ?? ""),
    sourceUrls: Array.isArray(player?.sourceUrls) ? player.sourceUrls : [],
    ratingSource: String(player?.ratingSource ?? ""),
    jerseyNumber: player?.jerseyNumber ?? ""
  };
}

function toPlayerCard(player, state, team) {
  return {
    id: player.id,
    playerId: player.playerId,
    teamId: player.teamId || String(team?.id ?? ""),
    teamName: player.teamName || getTeamName(team),
    name: player.name,
    position: player.position,
    group: player.groupKey,
    groupLabel: player.groupLabel,
    role: player.role,
    age: player.age,
    ovr: player.ovr,
    pot: player.pot,
    upside: player.upside,
    form: player.form,
    fatigue: player.fatigue,
    injuredDays: player.injuredDays,
    status: player.status,
    sourceConfidence: sourceConfidence(player),
    ratingSource: player.ratingSource,
    gameValue: round(tradeValueScore(player)),
    tieBreak: seededTieBreak(state, player.teamId, player.id)
  };
}

function normalizeCandidateCard(candidate) {
  if (!candidate) return null;
  const groupKey = candidate.group ?? getPositionGroup(candidate.position).key;

  return {
    id: candidate.id,
    playerId: candidate.playerId ?? "",
    teamId: candidate.teamId ?? "",
    teamName: candidate.teamName ?? "",
    name: candidate.name,
    position: candidate.position,
    group: groupKey,
    groupLabel: candidate.groupLabel ?? groupLabel(groupKey),
    role: candidate.role,
    age: candidate.age,
    ovr: candidate.ovr,
    pot: candidate.pot,
    upside: candidate.upside,
    status: candidate.status,
    sourceConfidence: candidate.sourceConfidence ?? sourceConfidence(candidate),
    gameValue: candidate.gameValue ?? round(tradeValueScore(candidate))
  };
}

function toTeamSummary(team, strategy) {
  return {
    id: String(team?.id ?? ""),
    name: getTeamName(team),
    shortName: String(team?.shortName ?? team?.name ?? ""),
    logo: team?.logo ?? "",
    city: team?.city ?? "",
    rank: strategy?.rank,
    strategyMode: strategy?.mode,
    strategyLabel: strategy?.label
  };
}

function compactNeed(need) {
  return {
    key: need.key,
    label: need.label,
    count: need.count,
    target: need.target,
    severity: need.severity,
    urgency: need.urgency
  };
}

function buildPlayerRiskFlags(player) {
  return [
    player.injuredDays > 0 ? "injured" : "",
    player.fatigue >= 70 ? "high_fatigue" : "",
    player.form <= 38 ? "low_form" : "",
    player.status === "candidate" ? "source_recheck" : ""
  ].filter(Boolean);
}

function tradeValueScore(player) {
  const youth = Math.max(0, 28 - safeNumber(player.age));
  const durabilityPenalty = safeNumber(player.injuredDays) * 1.4 + Math.max(0, safeNumber(player.fatigue) - 55) * 0.12;
  return Math.max(
    0,
    rating100(player.ovr) * 0.95 +
      rating100(player.pot) * 0.42 +
      rating100(player.upside) * 1.7 +
      youth * 0.85 +
      safeNumber(player.form, 50) * 0.08 -
      durabilityPenalty
  );
}

function sourceConfidence(player) {
  if (player.status === "registered" || player.status === "futures") return "high";
  if (Array.isArray(player.sourceUrls) && player.sourceUrls.length > 0) return "medium";
  if (player.source || player.playerId) return "medium";
  return "low";
}

function stripPackageScore(asset) {
  const { packageScore, ...clean } = asset;
  return clean;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function findTeam(state, teamId) {
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  const id = teamId ?? state?.selectedTeamId;
  if (id == null) return null;
  return teams.find((team) => String(team?.id) === String(id)) ?? null;
}

function emptyTradeMarket(state, teamId) {
  return {
    schemaVersion: FRONT_OFFICE_SCHEMA_VERSION,
    type: "tradeMarket",
    date: normalizeDateKey(state?.currentDate),
    day: Math.max(1, Math.floor(safeNumber(state?.day, 1))),
    team: { id: String(teamId ?? ""), name: "", shortName: "" },
    strategy: null,
    payroll: null,
    needs: [],
    surplusGroups: [],
    outgoingPool: [],
    targets: [],
    proposals: [],
    marketNotes: []
  };
}

function emptyScoutAssignments(state, teamId) {
  return {
    schemaVersion: FRONT_OFFICE_SCHEMA_VERSION,
    type: "scoutAssignments",
    date: normalizeDateKey(state?.currentDate),
    day: Math.max(1, Math.floor(safeNumber(state?.day, 1))),
    team: { id: String(teamId ?? ""), name: "", shortName: "" },
    strategy: null,
    sourcePolicy: "팀을 찾지 못했습니다.",
    coverage: { assignments: 0, tradeTargetsWatched: 0, internalProspectsWatched: 0, urgentNeeds: 0 },
    assignments: []
  };
}

function emptyInbox(state, teamId) {
  return {
    schemaVersion: FRONT_OFFICE_SCHEMA_VERSION,
    type: "frontOfficeInbox",
    date: normalizeDateKey(state?.currentDate),
    day: Math.max(1, Math.floor(safeNumber(state?.day, 1))),
    team: { id: String(teamId ?? ""), name: "", shortName: "" },
    strategy: null,
    summary: { totalItems: 0, critical: 0, high: 0, tradeProposals: 0, scoutAssignments: 0 },
    items: []
  };
}

function getPositionGroup(position) {
  const normalized = normalizePosition(position);
  return POSITION_GROUPS.find((group) => group.positions.includes(normalized)) ?? UNKNOWN_GROUP;
}

function normalizePosition(value, role) {
  const position = String(value ?? "").trim().toUpperCase();
  if (!position || position === "투수") return role === "pitcher" ? "P" : "UT";
  if (position === "포수") return "C";
  if (position === "내야수") return "IF";
  if (position === "외야수") return "OF";
  return position;
}

function groupLabel(key, fallback) {
  return POSITION_GROUPS.find((group) => group.key === key)?.label ?? fallback ?? UNKNOWN_GROUP.label;
}

function sortPlayers(players, primaryKey) {
  return [...players].sort((a, b) => {
    const primaryDiff = safeNumber(b[primaryKey]) - safeNumber(a[primaryKey]);
    if (primaryDiff !== 0) return primaryDiff;
    const potDiff = safeNumber(b.pot) - safeNumber(a.pot);
    if (potDiff !== 0) return potDiff;
    const ageDiff = safeNumber(a.age) - safeNumber(b.age);
    if (ageDiff !== 0) return ageDiff;
    return compareText(a.name, b.name);
  });
}

function strategyLabel(mode) {
  if (mode === "contend") return "윈나우";
  if (mode === "retool") return "리툴";
  if (mode === "develop") return "육성";
  return "균형";
}

function makeStableId(state, ...parts) {
  return `fo_${hashParts(resolveSeed(state), ...parts).toString(36)}`;
}

function seededTieBreak(state, ...parts) {
  return hashParts(resolveSeed(state), ...parts) % 10000;
}

function resolveSeed(state) {
  if (typeof state?.rng === "string" && state.rng.trim()) return state.rng;
  if (typeof state?.rng?.seed === "string" && state.rng.seed.trim()) return state.rng.seed;
  if (typeof state?.rngSeed === "string" && state.rngSeed.trim()) return state.rngSeed;
  return DEFAULT_SEED;
}

function hashParts(...parts) {
  let hash = 2166136261;
  const text = parts.map((part) => String(part)).join("|");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeDateKey(value) {
  const text = String(value ?? "2026-03-01").slice(0, 10);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? "2026-03-01" : parsed.toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const parsed = new Date(`${normalizeDateKey(dateKey)}T00:00:00.000Z`);
  return new Date(parsed.getTime() + Math.max(0, Math.floor(safeNumber(days))) * MS_PER_DAY).toISOString().slice(0, 10);
}

function daysBetween(startDateKey, endDateKey) {
  const start = new Date(`${normalizeDateKey(startDateKey)}T00:00:00.000Z`);
  const end = new Date(`${normalizeDateKey(endDateKey)}T00:00:00.000Z`);
  return Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function average(items, key) {
  if (!items.length) return 0;
  return round(items.reduce((total, item) => total + safeNumber(item[key]), 0) / items.length);
}

function rating100(value) {
  return safeNumber(value) / 2;
}

function sum(items, key) {
  return items.reduce((total, item) => total + safeNumber(item[key]), 0);
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(safeNumber(value) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getTeamName(team) {
  return String(team?.name ?? team?.shortName ?? team?.id ?? "");
}

function compareText(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
