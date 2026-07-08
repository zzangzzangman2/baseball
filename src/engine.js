import { REGULAR_SEASON_GAMES, formatDateKey } from "./data.js";
import { buildScoutAssignments, buildTradeMarket } from "./frontOffice.js";
import { appendFinanceLedger, syncStateFoundation } from "./stateSchema.js";

const KBO_TEAM_COUNT = 10;
const DAILY_GAME_COUNT = 5;
const RECENT_LIMIT = 14;
const LOG_LIMIT = 80;
const NARRATIVE_ARC_LIMIT = 24;
const NARRATIVE_BEAT_LIMIT = 80;
const NARRATIVE_EVIDENCE_LIMIT = 5;
const NARRATIVE_DAILY_DECAY = 0.94;
const EVENT_LOG_LIMIT = 1000;
const KEY_EVENT_LIMIT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OPENING_DAY = "2026-03-28";
const OPENING_DAY_MONTH_DAY = "03-28";
const PRESEASON_MEDIA_OUTLETS = ["SBS 스포츠", "KBS 스포츠", "MBC 스포츠", "JTBC 스포츠", "MBN 스포츠", "SPOTV"];
const MAIL_DECISION_LIMIT = 240;
const MAILBOX_LIMIT = 400;
const MAILBOX_DECISION_DAILY_LIMIT = 3;
const MAILBOX_DEFERRED_LIMIT = 60;
const MAILBOX_IMPORTANCE_TYPES = new Set([
  "medical-roster",
  "milestone",
  "standings-race",
  "streak",
  "owner-monthly",
  "owner-warning",
  "owner-dismissal",
  "player-meeting",
  "promise-result",
  "phase-transition"
]);
const MANAGER_TRUST_WARNING = 28;
const MANAGER_TRUST_DISMISSAL = 12;
const MANAGER_JOB_EVALUATION_LIMIT = 80;
const MANAGER_JOB_OFFER_LIMIT = 3;
const PLAYER_RELATION_ISSUE_LIMIT = 120;
const MANAGER_PROMISE_LIMIT = 100;
const PLAYER_MEETING_DAILY_LIMIT = 1;
const PROMISE_PLAYING_TIME_GAMES = 5;
const PROMISE_WINDOW_DAYS = 21;
const CLUB_PHILOSOPHIES = {
  balanced: {
    label: "균형 운영",
    summary: "현재 성적과 다음 세대 육성을 함께 본다."
  },
  winNow: {
    label: "즉시 성적",
    summary: "주전 전력과 베테랑 기용을 우선해 당장 순위를 끌어올린다."
  },
  rebuild: {
    label: "장기 리빌딩",
    summary: "젊은 선수 출전과 자산 축적을 감수하고 2~3년 뒤 창을 만든다."
  }
};
const KBO_OPTION_LOCK_DAYS = 10;
const KBO_FOREIGN_REGISTERED_LIMIT = 3;
const KBO_FOREIGN_APPEARANCE_LIMIT = 2;
const FOREIGN_FAMILY_SUPPORT_KRW = 50_000_000;
const POSTSEASON_RULE_SOURCE = "KBO 운영제도 v1: 와일드카드 4위 1승 어드밴티지, 준PO/PO 5전 3선승, 한국시리즈 7전 4선승";
const DRAFT_RULE_SOURCE = "KBO 신인 드래프트 v1: 전면 드래프트 11라운드, 최대 110명 지명";
const DRAFT_POOL_SIZE = 150;
const DRAFT_ROUNDS = 11;
const DRAFT_PICKS_PER_ROUND = 10;
const DRAFT_TOTAL_PICKS = DRAFT_ROUNDS * DRAFT_PICKS_PER_ROUND;
const SECONDARY_DRAFT_RULE_SOURCE = "KBO 2차 드래프트 v1: 보호선수 35명, 3라운드 기본 지명, 하위 3팀 4~5라운드 추가 지명";
const SECONDARY_DRAFT_SOURCE_URL = "https://www.jungannews.com/news/article.html?no=615639";
const SECONDARY_DRAFT_PROTECTED_COUNT = 35;
const SECONDARY_DRAFT_BASE_ROUNDS = 3;
const SECONDARY_DRAFT_EXTRA_ROUNDS = 2;
const SECONDARY_DRAFT_EXTRA_TEAM_COUNT = 3;
const SECONDARY_DRAFT_ORIGIN_PICK_LIMIT = 4;
const SECONDARY_DRAFT_COMPENSATION_BY_ROUND = {
  1: 400_000_000,
  2: 300_000_000,
  3: 200_000_000,
  4: 100_000_000,
  5: 100_000_000
};
const FA_MARKET_RULE_SOURCE = "KBO FA 등급제 v1: A/B/C 보상, A 20인 보호, B 25인 보호, C 현금 150%";
const FA_MARKET_SOURCE_URLS = [
  "https://www.chosun.com/sports/baseball/2025/01/22/SS7EGEWWJYJ7VA4RO6PDZV2P7I/",
  "https://potationary.tistory.com/21"
];
const FOREIGN_MARKET_RULE_SOURCE = "KBO 외국인/아시아쿼터 v1: 기존 외국인 3명+아시아쿼터 1명 체계 참고, 검증 전 후보는 코드형으로만 관리";
const FOREIGN_MARKET_SOURCE_URLS = [
  "https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11879",
  "https://www.hani.co.kr/arti/sports/baseball/1179260.html"
];
const FA_MARKET_CANDIDATE_LIMIT = 30;
const FA_MARKET_OFFER_LIMIT_PER_TEAM = 3;
const FOREIGN_MARKET_POOL_SIZE = 30;
const FOREIGN_MARKET_TIERS = 5;
const MARKET_LEDGER_LIMIT = 80;
const MARKET_MONEY_UNIT_KRW = 10_000_000;
const AI_OFFSEASON_TRADE_LIMIT = 4;
const AI_OFFSEASON_TRADE_ATTEMPTS = 24;
const ROOKIE_BASE_SALARY_KRW = 30_000_000;
const ROOKIE_CONTRACT_YEARS = 3;
const DRAFT_DIRECT_SIGNING_ROUNDS = 4;
const DRAFT_MAX_ROSTER_SIGNINGS_PER_TEAM = 6;
const ORG_ROSTER_TARGET = 68;
const ORG_ROSTER_HARD_CAP = 74;
const ACTIVE_ROSTER_TARGET = 30;
const ACTIVE_PITCHER_TARGET = 13;
const ACTIVE_HITTER_TARGET = ACTIVE_ROSTER_TARGET - ACTIVE_PITCHER_TARGET;
const ACTIVE_PITCHER_MIN_REQUIRED = 12;
const GAME_INTERVENTION_PRESETS = {
  balanced: {
    label: "균형 운영",
    approach: "balanced",
    baserunning: "balanced",
    bullpenHook: "standard",
    pinchHit: "standard",
    bunt: "selective"
  },
  smallBall: {
    label: "스몰볼",
    approach: "contact",
    baserunning: "aggressive",
    bullpenHook: "standard",
    pinchHit: "matchup",
    bunt: "aggressive"
  },
  aggressive: {
    label: "강공",
    approach: "aggressive",
    baserunning: "aggressive",
    bullpenHook: "standard",
    pinchHit: "power",
    bunt: "rare"
  },
  patient: {
    label: "출루 압박",
    approach: "patient",
    baserunning: "conservative",
    bullpenHook: "standard",
    pinchHit: "matchup",
    bunt: "rare"
  },
  bullpenEarly: {
    label: "불펜 빠르게",
    approach: "balanced",
    baserunning: "balanced",
    bullpenHook: "early",
    pinchHit: "matchup",
    bunt: "selective"
  }
};
const PAYROLL_TARGET_RATIO = 1.08;
const KBO_BALLPARK_RULE_SOURCE = "KBO 구장 성향 v1: 2024 스탯티즈 홈런 파크팩터 기반, 한화 신구장 2026은 중립 임시값";
const KBO_BALLPARK_FACTORS = {
  lg: { parkId: "jamsil", name: "잠실야구장", homeRunFactor: 0.732, sourceSeason: 2024 },
  doosan: { parkId: "jamsil", name: "잠실야구장", homeRunFactor: 0.732, sourceSeason: 2024 },
  kia: { parkId: "gwangju", name: "광주-기아 챔피언스 필드", homeRunFactor: 0.953, sourceSeason: 2024 },
  samsung: { parkId: "daegu", name: "대구 삼성 라이온즈 파크", homeRunFactor: 1.522, sourceSeason: 2024 },
  lotte: { parkId: "sajik", name: "사직야구장", homeRunFactor: 0.729, sourceSeason: 2024 },
  hanwha: { parkId: "daejeon-hanwha-life", name: "대전 한화생명 볼파크", homeRunFactor: 1.0, sourceSeason: 2026, provisional: true },
  ssg: { parkId: "incheon", name: "인천 SSG 랜더스필드", homeRunFactor: 1.489, sourceSeason: 2024 },
  kt: { parkId: "suwon", name: "수원 KT 위즈 파크", homeRunFactor: 1.01, sourceSeason: 2024 },
  nc: { parkId: "changwon", name: "창원 NC 파크", homeRunFactor: 1.085, sourceSeason: 2024 },
  kiwoom: { parkId: "gocheok", name: "고척스카이돔", homeRunFactor: 0.822, sourceSeason: 2024 }
};
const NEXT_SEASON_START_MONTH_DAY = "03-01";
const TRADE_COMMIT_MIN_ACCEPTANCE = 74;
const TRADE_COMMIT_MIN_ELITE_ACCEPTANCE = 86;
const TRADE_COMMIT_MAX_DEFICIT = -4;
const TRADE_COMMIT_MAX_OVERPAY = 38;
const TRADE_COMMIT_MIN_PLAYER_VALUE_RATIO = 0.62;
const TRADE_COMMIT_MIN_ELITE_PLAYER_VALUE_RATIO = 0.78;
const TRADE_COMMIT_MAX_OVR_GAP = 26;
const TRADE_COMMIT_MAX_ELITE_OVR_GAP = 14;
const TRADE_COMMIT_ELITE_OVR = 145;
const TRADE_COMMIT_ELITE_POT = 175;
const TRADE_COMMIT_MAX_SUPPLEMENTAL_RATIO = 0.55;
const FA_COMPENSATION_RULES = {
  A: { protectedListSize: 20, playerPlusCashMultiplier: 2, cashOnlyMultiplier: 3 },
  B: { protectedListSize: 25, playerPlusCashMultiplier: 1, cashOnlyMultiplier: 2 },
  C: { protectedListSize: 0, playerPlusCashMultiplier: 0, cashOnlyMultiplier: 1.5 },
  none: { protectedListSize: 0, playerPlusCashMultiplier: 0, cashOnlyMultiplier: 0 }
};
const RECORD_BOOK_LIMIT = 10;
const PLAYER_HISTORY_LIMIT = 24;
const LEAGUE_HISTORY_LIMIT = 24;
const BATTING_LEADERBOARDS = [
  { key: "avg", label: "AVG", statGroup: "batting", qualification: "batting", direction: "desc" },
  { key: "homeRuns", label: "HR", statGroup: "batting", statKey: "homeRuns", qualification: "batting", direction: "desc" },
  { key: "rbi", label: "RBI", statGroup: "batting", statKey: "rbi", qualification: "batting", direction: "desc" },
  { key: "stolenBases", label: "SB", statGroup: "batting", statKey: "stolenBases", qualification: "batting", direction: "desc" },
  { key: "ops", label: "OPS", statGroup: "batting", qualification: "batting", direction: "desc" }
];
const PITCHING_LEADERBOARDS = [
  { key: "era", label: "ERA", statGroup: "pitching", qualification: "pitching", direction: "asc" },
  { key: "wins", label: "W", statGroup: "pitching", statKey: "wins", qualification: "pitching", direction: "desc" },
  { key: "saves", label: "SV", statGroup: "pitching", statKey: "saves", qualification: "pitching", direction: "desc" },
  { key: "holds", label: "HLD", statGroup: "pitching", statKey: "holds", qualification: "pitching", direction: "desc" },
  { key: "strikeouts", label: "K", statGroup: "pitching", statKey: "strikeouts", qualification: "pitching", direction: "desc" }
];

const POSTSEASON_SERIES = [
  {
    id: "wild-card",
    round: "wildCard",
    label: "와일드카드",
    shortLabel: "WC",
    order: 1,
    participantSeeds: [4, 5],
    winsNeeded: 2,
    maxGames: 2,
    higherSeedStartingWins: 1,
    homePattern: ["higher", "higher"],
    nextSeriesId: "semi-playoff"
  },
  {
    id: "semi-playoff",
    round: "semiPlayoff",
    label: "준플레이오프",
    shortLabel: "준PO",
    order: 2,
    participantSeeds: [3, null],
    winsNeeded: 3,
    maxGames: 5,
    higherSeedStartingWins: 0,
    homePattern: ["higher", "higher", "lower", "lower", "higher"],
    nextSeriesId: "playoff"
  },
  {
    id: "playoff",
    round: "playoff",
    label: "플레이오프",
    shortLabel: "PO",
    order: 3,
    participantSeeds: [2, null],
    winsNeeded: 3,
    maxGames: 5,
    higherSeedStartingWins: 0,
    homePattern: ["higher", "higher", "lower", "lower", "higher"],
    nextSeriesId: "korean-series"
  },
  {
    id: "korean-series",
    round: "koreanSeries",
    label: "한국시리즈",
    shortLabel: "KS",
    order: 4,
    participantSeeds: [1, null],
    winsNeeded: 4,
    maxGames: 7,
    higherSeedStartingWins: 0,
    homePattern: ["higher", "higher", "lower", "lower", "lower", "higher", "higher"],
    nextSeriesId: null
  }
];

export function getStandings(state) {
  return [...(state?.teams ?? [])].sort((a, b) => {
    const pctDiff = winningPct(b) - winningPct(a);
    if (pctDiff !== 0) return pctDiff;
    const winsDiff = safeNumber(b.wins) - safeNumber(a.wins);
    if (winsDiff !== 0) return winsDiff;
    const runDiffA = safeNumber(a.runsFor) - safeNumber(a.runsAgainst);
    const runDiffB = safeNumber(b.runsFor) - safeNumber(b.runsAgainst);
    if (runDiffB !== runDiffA) return runDiffB - runDiffA;
    return String(a.name ?? a.id).localeCompare(String(b.name ?? b.id));
  });
}

export function getRecordBook(state, options = {}) {
  const season = safeNumber(options.season, inferSeasonFromState(state));
  const includeUnqualified = Boolean(options.includeUnqualified);
  const limit = Math.max(1, Math.floor(safeNumber(options.limit, RECORD_BOOK_LIMIT)));
  return {
    season,
    qualification: buildRecordQualification(state),
    leaders: buildLeagueLeaders(state, { includeUnqualified, limit }),
    leadersIncludingUnqualified: includeUnqualified ? null : buildLeagueLeaders(state, { includeUnqualified: true, limit }),
    teamRecords: buildTeamRecords(state),
    leagueHistory: Array.isArray(state?.leagueHistory) ? state.leagueHistory : [],
    seasonHistory: Array.isArray(state?.seasonHistory) ? state.seasonHistory : []
  };
}

export function getSelectedTeam(state) {
  return state?.teams?.find((team) => team.id === state.selectedTeamId) ?? state?.teams?.[0];
}

export function getManagerJobStatus(state, teamId = state?.selectedTeamId) {
  if (!state) return null;
  normalizeState(state);
  const team = findTeamById(state, teamId) ?? getSelectedTeam(state);
  if (!team) return null;
  const job = ensureManagerJob(state, team);
  const standings = getStandings(state);
  const rank = standings.findIndex((entry) => String(entry.id) === String(team.id)) + 1;
  const games = teamGamesPlayed(team);
  const pct = winningPct(team);
  const activePromises = (state.promises ?? []).filter((promise) =>
    String(promise.teamId) === String(team.id) && promise.status === "active"
  );
  const openIssues = (state.playerRelations?.issues ?? []).filter((issue) =>
    String(issue.teamId) === String(team.id) && ["open", "meeting-requested"].includes(issue.status)
  );
  return {
    ...job,
    teamId: team.id,
    teamName: team.shortName ?? team.name,
    rank,
    games,
    winningPct: pct,
    record: renderRecordText(team),
    trustBand: managerTrustBand(job.trust),
    trustLabel: managerTrustLabel(job.trust),
    philosophyLabel: CLUB_PHILOSOPHIES[job.philosophy]?.label ?? CLUB_PHILOSOPHIES.balanced.label,
    goalLabel: job.seasonGoal?.label ?? "시즌 목표 설정 전",
    targetRank: job.seasonGoal?.targetRank ?? job.expectedRank,
    activePromises: activePromises.length,
    openIssues: openIssues.length,
    latestEvaluation: job.evaluations?.[0] ?? null
  };
}

export function getClubhouseDynamics(state, teamId = state?.selectedTeamId) {
  if (!state) return { issues: [], promises: [], summary: { openIssues: 0, activePromises: 0, brokenPromises: 0 } };
  normalizeState(state);
  const selectedTeamId = String(teamId ?? state.selectedTeamId ?? "");
  const issues = (state.playerRelations?.issues ?? [])
    .filter((issue) => !selectedTeamId || String(issue.teamId) === selectedTeamId)
    .sort((a, b) => compareText(b.updatedAt, a.updatedAt) || safeNumber(b.severity) - safeNumber(a.severity))
    .slice(0, 8);
  const promises = (state.promises ?? [])
    .filter((promise) => !selectedTeamId || String(promise.teamId) === selectedTeamId)
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || compareText(a.dueDate, b.dueDate))
    .slice(0, 8);
  return {
    issues,
    promises,
    summary: {
      openIssues: issues.filter((issue) => ["open", "meeting-requested"].includes(issue.status)).length,
      activePromises: promises.filter((promise) => promise.status === "active").length,
      brokenPromises: promises.filter((promise) => promise.status === "broken").length
    }
  };
}

export function commitClubPhilosophy(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);
  const team = findTeamById(state, input.teamId ?? state.selectedTeamId);
  if (!team) return { ok: false, code: "missing-team", message: "구단 철학을 저장할 팀을 찾지 못했습니다." };
  const philosophy = CLUB_PHILOSOPHIES[input.philosophy] ? String(input.philosophy) : "balanced";
  const job = ensureManagerJob(state, team);
  job.philosophy = philosophy;
  job.philosophyUpdatedAt = state.currentDate;
  rememberManagerAction(state, {
    type: "club-philosophy",
    teamId: team.id,
    subject: CLUB_PHILOSOPHIES[philosophy].label,
    subjectId: philosophy,
    headline: `${team.shortName ?? team.name} 운영 철학: ${CLUB_PHILOSOPHIES[philosophy].label}`,
    summary: CLUB_PHILOSOPHIES[philosophy].summary,
    heat: philosophy === "rebuild" ? 15 : 10,
    confidence: 72,
    tags: ["philosophy", "owner", "manager"]
  });
  return {
    ok: true,
    code: "club-philosophy-saved",
    message: `${CLUB_PHILOSOPHIES[philosophy].label} 철학을 구단 운영 기준으로 저장했습니다.`,
    managerJob: job
  };
}

export function getMailboxSummary(state) {
  normalizeMailboxState(state);
  const items = state.mailbox.items;
  const openDecisions = items.filter((mail) => isOpenDecisionMail(mail));
  return {
    total: items.length,
    unread: items.filter((mail) => !mail.read).length,
    openDecisions: openDecisions.length,
    blockingDecisions: openDecisions.filter((mail) => mail.decision?.blocking).length,
    importantUnread: items.filter((mail) => !mail.read && isImportantMail(mail)).length
  };
}

export function getMailboxItems(state, filter = {}) {
  normalizeMailboxState(state);
  const category = String(filter.category ?? "all");
  const decisionOnly = Boolean(filter.decisionOnly);
  return [...state.mailbox.items]
    .filter((mail) => {
      if (decisionOnly && !isOpenDecisionMail(mail)) return false;
      if (category === "all") return true;
      if (category === "decision") return isOpenDecisionMail(mail);
      return String(mail.category ?? "") === category;
    })
    .sort(compareMailItems);
}

export function getOpenMailDecisions(state) {
  normalizeMailboxState(state);
  return state.mailbox.items
    .filter((mail) => isOpenDecisionMail(mail))
    .sort(compareMailItems);
}

export function getBlockingMailDecision(state) {
  return getOpenMailDecisions(state).find((mail) => mail.decision?.blocking) ?? null;
}

export function markMailRead(state, mailId) {
  normalizeMailboxState(state);
  const mail = state.mailbox.items.find((item) => String(item.id) === String(mailId));
  if (!mail) return { ok: false, code: "mail-not-found", message: "메일을 찾지 못했습니다." };
  mail.read = true;
  refreshMailboxDerivedState(state);
  return { ok: true, code: "mail-read", mailId: mail.id, unread: state.mailbox.unread };
}

export function deliverMail(state, mail = {}) {
  if (!state || !mail) return null;
  normalizeMailboxState(state);
  deliverDeferredMail(state, mail.date ?? state.currentDate);
  const item = normalizeMailItem(mail, state);
  if (!item.id) return null;
  insertMailboxItem(state, item, { log: true });
  return item;
}

export function buildLineup(team) {
  const activeHitters = (team?.roster ?? []).filter((player) => player.role === "hitter" && isActiveRosterPlayer(player));
  const hitterPool = activeHitters.length >= 9
    ? activeHitters
    : (team?.roster ?? []).filter((player) => player.role === "hitter" && !player.gameRestriction);
  const manualLineup = resolveManualLineup(team, hitterPool);
  if (manualLineup.length === 9) return manualLineup;

  return [...hitterPool]
    .map((player, index) => ({ player, index, score: hitterScore(player) }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const ovrDiff = safeNumber(b.player.ovr) - safeNumber(a.player.ovr);
      if (ovrDiff !== 0) return ovrDiff;
      return a.index - b.index;
    })
    .slice(0, 9)
    .map(({ player }) => player);
}

function resolveManualLineup(team, hitterPool) {
  const card = team?.lineupCard;
  const ids = Array.isArray(card?.playerIds)
    ? card.playerIds
    : Array.isArray(card?.slots)
      ? card.slots.map((slot) => slot?.playerId)
      : [];
  if (ids.length < 9) return [];

  const poolById = new Map((hitterPool ?? []).map((player) => [String(player.id ?? ""), player]));
  const lineup = [];
  const used = new Set();

  for (const rawId of ids.slice(0, 9)) {
    const id = String(rawId ?? "");
    const player = poolById.get(id);
    if (!player || used.has(id)) return [];
    used.add(id);
    lineup.push(player);
  }

  return lineup.length === 9 ? lineup : [];
}

function hasManualPitchingPlan(team) {
  const plan = team?.pitchingPlan;
  return Boolean(plan && (plan.mode === "manual" || Array.isArray(plan.rotationOrder) || Array.isArray(plan.rotationIds)));
}

function uniquePitcherIds(values) {
  const source = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const ids = [];

  for (const value of source) {
    const id = String(value ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

function mapAvailablePitchersById(pitchers) {
  return new Map((pitchers ?? []).map((player) => [String(player?.id ?? ""), player]));
}

function resolveManualRotation(team, pitchers) {
  const plan = team?.pitchingPlan ?? {};
  const pitcherById = mapAvailablePitchersById(pitchers);
  const used = new Set();
  const rotation = [];
  const plannedIds = uniquePitcherIds(plan.rotationOrder ?? plan.rotationIds ?? []);

  for (const id of plannedIds) {
    const player = pitcherById.get(id);
    const playerId = String(player?.id ?? "");
    if (!player || !playerId || used.has(playerId)) continue;
    rotation.push(player);
    used.add(playerId);
    if (rotation.length === 5) break;
  }

  const fallback = (pitchers ?? [])
    .map((player, index) => ({ player, index, score: starterScore(player) }))
    .sort(comparePitcherEntries);
  for (const { player } of fallback) {
    if (rotation.length >= 5) break;
    const playerId = String(player?.id ?? "");
    if (!playerId || used.has(playerId)) continue;
    rotation.push(player);
    used.add(playerId);
  }

  return rotation;
}

function resolveManualBullpen(team, pitchers, rotation) {
  const plan = team?.pitchingPlan ?? {};
  const pitcherById = mapAvailablePitchersById(pitchers);
  const used = new Set((rotation ?? []).map((player) => String(player?.id ?? "")).filter(Boolean));
  const bullpen = [];
  const roles = {};

  const addPitcher = (id, role) => {
    const player = pitcherById.get(String(id ?? "").trim());
    const playerId = String(player?.id ?? "");
    if (!player || !playerId || used.has(playerId)) return;
    bullpen.push(player);
    used.add(playerId);
    roles[playerId] = role;
  };

  addPitcher(plan.closerId, "CL");
  for (const id of uniquePitcherIds(plan.setupIds ?? [])) addPitcher(id, "SU");
  for (const id of uniquePitcherIds(plan.longReliefIds ?? plan.longReliefId ?? [])) addPitcher(id, "LR");

  const fallback = (pitchers ?? [])
    .map((player, index) => ({ player, index, score: bullpenScore(player) }))
    .sort(comparePitcherEntries);
  for (const { player } of fallback) {
    if (bullpen.length >= 7) break;
    const playerId = String(player?.id ?? "");
    if (!playerId || used.has(playerId)) continue;
    bullpen.push(player);
    used.add(playerId);
  }

  assignMissingBullpenRoles(bullpen, roles);
  return { bullpen, roles };
}

function assignMissingBullpenRoles(bullpen, roles) {
  const roleCount = (role) => Object.values(roles).filter((entry) => entry === role).length;
  const unassigned = () => (bullpen ?? []).filter((player) => !roles[String(player?.id ?? "")]);
  const bestUnassigned = (scoreFn) =>
    unassigned()
      .map((player, index) => ({ player, index, score: scoreFn(player) }))
      .sort(comparePitcherEntries)[0]?.player;
  const assign = (player, role) => {
    const playerId = String(player?.id ?? "");
    if (playerId && !roles[playerId]) roles[playerId] = role;
  };

  if (roleCount("CL") === 0) assign(bestUnassigned(bullpenScore), "CL");
  while (roleCount("SU") < 2) {
    const player = bestUnassigned(bullpenScore);
    if (!player) break;
    assign(player, "SU");
  }
  if (roleCount("LR") === 0) assign(bestUnassigned(starterScore), "LR");

  for (const player of bullpen ?? []) {
    const playerId = String(player?.id ?? "");
    if (playerId && !roles[playerId]) roles[playerId] = "MR";
  }
}

function buildManualPitchingSnapshot(team, pitchers) {
  const rotationPlayers = resolveManualRotation(team, pitchers);
  const bullpenPlan = resolveManualBullpen(team, pitchers, rotationPlayers);
  const nextIndex = nextRotationIndex(team, rotationPlayers.length);
  const rotation = rotationPlayers.map((player, index) =>
    toPitchingRole(player, index === nextIndex ? "nextStarter" : "starter", index + 1)
  );
  const bullpen = bullpenPlan.bullpen.map((player, index) =>
    toPitchingRole(player, bullpenPlan.roles[String(player?.id ?? "")] ?? bullpenRole(index), index + 1)
  );

  return {
    rotation,
    bullpen,
    nextStarter: rotation.find((entry) => entry.role === "nextStarter") ?? rotation[0] ?? null
  };
}

export function buildPitchingSnapshot(team) {
  const pitchers = getAvailablePitchers(team);
  if (hasManualPitchingPlan(team)) {
    return buildManualPitchingSnapshot(team, pitchers);
  }

  const rotation = pitchers
    .map((player, index) => ({ player, index, score: starterScore(player) }))
    .sort(comparePitcherEntries)
    .slice(0, 5)
    .map(({ player }, index) => toPitchingRole(player, index === nextRotationIndex(team, 5) ? "nextStarter" : "starter", index + 1));
  const rotationIds = new Set(rotation.map((entry) => entry.id));
  const bullpen = pitchers
    .filter((player) => !rotationIds.has(player.id))
    .map((player, index) => ({ player, index, score: bullpenScore(player) }))
    .sort(comparePitcherEntries)
    .slice(0, 7)
    .map(({ player }, index) => toPitchingRole(player, bullpenRole(index), index + 1));

  return {
    rotation,
    bullpen,
    nextStarter: rotation.find((entry) => entry.role === "nextStarter") ?? rotation[0] ?? null
  };
}

export function commitPitchingPlan(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);

  const team = findTeamById(state, input.teamId ?? state.selectedTeamId);
  if (!team) return { ok: false, code: "missing-team", message: "투수 운용을 저장할 구단을 찾을 수 없습니다." };

  if (input.mode === "auto" || input.clear === true) {
    team.pitchingPlan = null;
    addLog(state, `${state.currentDate} ${team.name} 투수 운용: 자동 추천으로 복귀했습니다.`);
    rememberManagerAction(state, {
      type: "pitching-plan-auto",
      teamId: team.id,
      subject: "자동 투수 운용",
      headline: `${team.shortName ?? team.name} 자동 투수 운용 복귀`,
      summary: "감독실이 수동 로테이션/불펜 역할 지정을 해제하고 자동 추천 운용으로 돌아갔습니다.",
      heat: 7,
      confidence: 58,
      tags: ["pitching", "manager", "automation"]
    });
    syncStateFoundation(state);
    return { ok: true, code: "cleared", message: "자동 투수 운용으로 되돌렸습니다.", pitchingPlan: null };
  }

  const pitchers = getAvailablePitchers(team);
  const pitcherById = new Map(pitchers.map((player) => [String(player.id ?? ""), player]));
  const rotationOrder = uniquePitcherIds(input.rotationOrder ?? input.rotationIds ?? []).slice(0, 5);
  const closerId = String(input.closerId ?? "").trim();
  const setupIds = uniquePitcherIds(input.setupIds ?? []).slice(0, 2);
  const longReliefIds = uniquePitcherIds(input.longReliefIds ?? input.longReliefId ?? []).slice(0, 2);
  const roleIds = [closerId, ...setupIds, ...longReliefIds].filter(Boolean);
  const problems = [];

  if (rotationOrder.length !== 5) {
    problems.push(`선발 로테이션은 5명이어야 합니다(${rotationOrder.length}/5).`);
  }
  for (const id of rotationOrder) {
    if (!pitcherById.has(id)) problems.push(`로테이션 선수 ${id}는 현재 가용 투수가 아닙니다.`);
  }
  for (const id of roleIds) {
    if (!pitcherById.has(id)) problems.push(`불펜 역할 선수 ${id}는 현재 가용 투수가 아닙니다.`);
  }
  const allAssignedIds = [...rotationOrder, ...roleIds];
  if (new Set(allAssignedIds).size !== allAssignedIds.length) {
    problems.push("한 투수를 로테이션/불펜 역할에 중복 지정할 수 없습니다.");
  }

  if (problems.length > 0) {
    return {
      ok: false,
      code: "invalid-pitching-plan",
      message: `투수 운용 저장 실패: ${problems[0]}`,
      problems
    };
  }

  team.pitchingPlan = {
    mode: "manual",
    rotationOrder,
    closerId,
    setupIds,
    longReliefIds,
    updatedAt: state.currentDate,
    source: "manager-pitching-plan-v1"
  };
  addLog(state, `${state.currentDate} ${team.name} 투수 운용 저장: 로테이션 ${rotationOrder.length}명, 마무리 ${pitcherById.get(closerId)?.name ?? "자동"}.`);
  rememberManagerAction(state, {
    type: "pitching-plan-manual",
    teamId: team.id,
    subject: "수동 투수 운용",
    headline: `${team.shortName ?? team.name} 투수 운용 직접 지정`,
    summary: `감독실이 선발 로테이션 5명과 불펜 핵심 역할을 저장했습니다. 다음 경기부터 수동 운용이 우선 적용됩니다.`,
    heat: 12,
    confidence: 66,
    tags: ["pitching", "manager", "game-plan"]
  });
  syncStateFoundation(state);

  return {
    ok: true,
    code: "saved",
    message: "투수 운용을 저장했습니다. 다음 경기부터 수동 운용이 우선 적용됩니다.",
    pitchingPlan: team.pitchingPlan
  };
}

export function commitGameInterventionPlan(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);

  const team = findTeamById(state, input.teamId ?? state.selectedTeamId);
  if (!team) return { ok: false, code: "missing-team", message: "경기 전략을 저장할 구단을 찾을 수 없습니다." };

  const presetKey = String(input.preset ?? input.mode ?? "balanced");
  const preset = GAME_INTERVENTION_PRESETS[presetKey] ?? GAME_INTERVENTION_PRESETS.balanced;
  const plan = {
    mode: "manual",
    preset: GAME_INTERVENTION_PRESETS[presetKey] ? presetKey : "balanced",
    label: input.label ?? preset.label,
    approach: input.approach ?? preset.approach,
    baserunning: input.baserunning ?? preset.baserunning,
    bullpenHook: input.bullpenHook ?? preset.bullpenHook,
    pinchHit: input.pinchHit ?? preset.pinchHit,
    bunt: input.bunt ?? preset.bunt,
    updatedAt: state.currentDate,
    source: "manager-game-intervention-v1"
  };

  state.gameInterventions = {
    ...(state.gameInterventions ?? {}),
    [team.id]: plan
  };
  addLog(state, {
    date: state.currentDate,
    type: "coaching",
    tag: "경기 전략",
    source: "벤치",
    headline: `${team.shortName ?? team.name} 다음 경기 전략: ${plan.label}`,
    text: `타석 접근 ${gamePlanApproachLabel(plan.approach)}, 주루 ${gamePlanTempoLabel(plan.baserunning)}, 불펜 ${gamePlanTempoLabel(plan.bullpenHook)}로 저장했습니다.`
  });
  rememberManagerAction(state, {
    type: "game-intervention",
    teamId: team.id,
    subject: "경기 중 감독 개입",
    subjectId: plan.preset,
    headline: `${team.shortName ?? team.name} ${plan.label} 플랜`,
    summary: `다음 경기 운영 방향을 ${plan.label}로 저장했습니다. 경기 결과와 함께 장기 서사에 반영됩니다.`,
    heat: 10,
    confidence: 64,
    tags: ["game-plan", "manager", "intervention"]
  });
  syncStateFoundation(state);

  return {
    ok: true,
    code: "saved",
    message: `${plan.label} 경기 전략을 저장했습니다.`,
    plan
  };
}

export function commitScoutAssignment(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);

  const team = findTeamById(state, input.teamId ?? state.selectedTeamId);
  if (!team) return { ok: false, code: "missing-team", message: "스카우트 업무를 지시할 구단을 찾을 수 없습니다." };

  const board = buildScoutAssignments(state, team.id);
  const assignment = (board.assignments ?? []).find((entry) => String(entry.id) === String(input.assignmentId)) ?? board.assignments?.[0];
  if (!assignment) return { ok: false, code: "missing-assignment", message: "지시 가능한 스카우트 업무가 없습니다." };

  state.scoutingQueue = Array.isArray(state.scoutingQueue) ? state.scoutingQueue : [];
  state.scoutingReportsById = state.scoutingReportsById && typeof state.scoutingReportsById === "object" ? state.scoutingReportsById : {};
  const queueItem = {
    id: `scout-task-${state.currentDate}-${assignment.id}`,
    assignmentId: assignment.id,
    teamId: team.id,
    title: assignment.title,
    focus: assignment.focus,
    status: "reported",
    orderedAt: state.currentDate,
    dueDate: assignment.dueDate,
    completedAt: state.currentDate,
    source: "scout-assignment-v1"
  };
  state.scoutingQueue = [queueItem, ...state.scoutingQueue.filter((item) => item.assignmentId !== assignment.id)].slice(0, 40);

  const reports = buildAssignmentScoutingReports(state, team, assignment, queueItem);
  for (const report of reports) {
    state.scoutingReportsById[report.id] = report;
  }

  addLog(state, {
    date: state.currentDate,
    type: "scout",
    tag: "스카우트 리포트",
    source: "스카우트팀",
    headline: `${assignment.title} 리포트 도착`,
    text: reports.length
      ? `${reports[0].playerName} 등 ${reports.length}명 관측치가 업데이트됐습니다. 신뢰도 평균 ${formatAverageReportConfidence(reports)}.`
      : `${assignment.focus} 업무가 완료됐지만 실명 후보 데이터가 없어 포지션 방향 리포트만 남겼습니다.`
  });
  rememberManagerAction(state, {
    type: "scouting-report",
    teamId: team.id,
    subjectId: assignment.id,
    subject: assignment.title,
    headline: `${team.shortName ?? team.name} 정보 비대칭 축소`,
    summary: reports.length
      ? `${assignment.title} 결과로 ${reports.length}명 관측 리포트가 생성됐습니다. 실제 능력치 대신 오차 범위와 협상 레버리지를 우선 표시합니다.`
      : `${assignment.title} 결과로 후보군 방향성이 뉴스함에 기록됐습니다.`,
    heat: 11,
    confidence: 70,
    tags: ["scout", "information", "negotiation"]
  });
  syncStateFoundation(state);

  return {
    ok: true,
    code: "reported",
    message: `${assignment.title} 스카우트 리포트를 생성했습니다.`,
    assignment: queueItem,
    reports
  };
}

function buildAssignmentScoutingReports(state, team, assignment, queueItem) {
  return (assignment.candidates ?? [])
    .filter(Boolean)
    .slice(0, 5)
    .map((candidate, index) => {
      const entry = findPlayerEntry(state, candidate.id, candidate.teamId) ?? findPlayerEntry(state, candidate.id);
      const player = entry?.player ?? candidate;
      const confidenceBase = candidate.sourceConfidence === "high" ? 78 : candidate.sourceConfidence === "medium" ? 66 : 54;
      const confidence = clamp(confidenceBase + deterministicRange(state.currentDate, assignment.id, candidate.id, "confidence", -7, 8), 42, 92);
      const error = scoutingErrorFromConfidence(confidence);
      const observedOvr = clamp(Math.round(safeNumber(player.ovr) / 2) + deterministicRange(state.currentDate, assignment.id, candidate.id, "ovr", -error, error), 20, 95);
      const observedPot = clamp(Math.round(safeNumber(player.pot, player.ovr) / 2) + deterministicRange(state.currentDate, assignment.id, candidate.id, "pot", -error, error), observedOvr, 98);
      const leverage = scoutingNegotiationLeverage({ state, assignment, player, confidence, index });

      return {
        id: `scout-report-${team.id}-${candidate.id}`,
        playerId: candidate.id,
        sourcePlayerId: candidate.playerId ?? "",
        teamId: candidate.teamId ?? player.teamId ?? "",
        orderedByTeamId: team.id,
        playerName: candidate.name ?? player.name ?? "후보",
        playerTeamName: candidate.teamName ?? entry?.team?.name ?? "",
        position: candidate.position ?? player.position ?? "",
        role: candidate.role ?? player.role ?? "",
        date: state.currentDate,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        currentGrade: observedOvr,
        futureGrade: observedPot,
        uncertainty: error,
        confidence,
        negotiationLeverage: leverage.score,
        leverageLabel: leverage.label,
        visibility: "scouted",
        summary: `${gamePlanTempoLabel(leverage.label)} 레버리지, 관측 OVR ${observedOvr}, POT ${observedPot}, 오차 ±${error}`,
        queueItemId: queueItem.id,
        source: "scout-assignment-v1"
      };
    });
}

function scoutingErrorFromConfidence(confidence) {
  return clamp(Math.round(18 - safeNumber(confidence, 60) / 7), 4, 12);
}

function scoutingNegotiationLeverage({ state, assignment, player, confidence, index }) {
  const agePressure = safeNumber(player.age, 27) >= 31 ? 8 : safeNumber(player.age, 27) <= 24 ? -3 : 0;
  const fatiguePressure = safeNumber(player.fatigue) >= 38 ? 6 : 0;
  const injuryPressure = safeNumber(player.injuredDays) > 0 ? 12 : 0;
  const availability = assignment.type === "trade-pro" ? 9 : 3;
  const score = clamp(
    46 + availability + agePressure + fatiguePressure + injuryPressure + deterministicRange(state.currentDate, assignment.id, player.id ?? player.name, "leverage", -8, 9) + Math.round((safeNumber(confidence) - 60) / 5) - index * 2,
    15,
    92
  );
  const label = score >= 70 ? "강함" : score >= 52 ? "보통" : "약함";
  return { score, label };
}

function formatAverageReportConfidence(reports) {
  const count = Math.max(1, reports.length);
  return `${Math.round(reports.reduce((total, report) => total + safeNumber(report.confidence), 0) / count)}%`;
}

function gamePlanApproachLabel(value) {
  const labels = {
    balanced: "균형",
    contact: "컨택",
    aggressive: "강공",
    patient: "출루"
  };
  return labels[value] ?? value ?? "균형";
}

function gamePlanTempoLabel(value) {
  const labels = {
    balanced: "균형",
    standard: "표준",
    selective: "선택",
    conservative: "보수",
    aggressive: "공격",
    early: "빠르게",
    rare: "최소",
    matchup: "매치업",
    power: "장타",
    "강함": "강함",
    "보통": "보통",
    "약함": "약함"
  };
  return labels[value] ?? value ?? "표준";
}

export function getNextGamePreview(state, teamId = state?.selectedTeamId) {
  if (!state || ["complete", "postseason", "offseason"].includes(state.phase)) {
    return { ok: false, code: "no-game", message: "진행 가능한 정규시즌 경기가 없습니다." };
  }

  const teams = Array.isArray(state.teams) ? state.teams : [];
  if (teams.length < KBO_TEAM_COUNT) {
    return { ok: false, code: "not-enough-teams", message: `${KBO_TEAM_COUNT}개 구단 데이터가 필요합니다.` };
  }

  let phase = state.phase || "preseason";
  let gamesPlayed = Math.max(0, Math.floor(safeNumber(state.gamesPlayed)));
  let date = parseDate(state.currentDate);

  if (phase === "preseason") {
    const dateKey = formatDateKey(date);
    const openingDay = openingDayForDateKey(dateKey);
    const daysToOpening = Math.max(0, Math.round((parseDate(openingDay).getTime() - date.getTime()) / MS_PER_DAY));
    return {
      ok: false,
      code: "preseason",
      date: dateKey,
      openingDay,
      daysToOpening,
      message: `프리시즌 캠프 기간입니다. 개막전은 ${openingDay}이며, 경기 보기/시뮬레이션은 개막 후 열립니다.`
    };
  }

  let skippedDays = 0;

  for (let guard = 0; guard < 220; guard += 1) {
    const dateKey = formatDateKey(date);
    if (gamesPlayed >= REGULAR_SEASON_GAMES) {
      return { ok: false, code: "season-complete", message: "정규시즌 720경기를 모두 마쳤습니다." };
    }

    if (date.getUTCDay() === 1) {
      date = new Date(date.getTime() + MS_PER_DAY);
      skippedDays += 1;
      continue;
    }

    const matchups = buildMatchups(teams, Math.floor(gamesPlayed / DAILY_GAME_COUNT));
    const gamesToPlay = Math.min(matchups.length, REGULAR_SEASON_GAMES - gamesPlayed);
    const matchup = findMatchupForTeam(matchups.slice(0, gamesToPlay), teamId) ?? matchups[0];
    if (!matchup) {
      date = new Date(date.getTime() + MS_PER_DAY);
      skippedDays += 1;
      continue;
    }

    return {
      ok: true,
      code: "ready",
      date: dateKey,
      skippedDays,
      gameNumber: gamesPlayed + (matchups.indexOf(matchup) + 1),
      awayTeamId: matchup.away?.id ?? "",
      homeTeamId: matchup.home?.id ?? "",
      awayName: matchup.away?.name ?? "",
      homeName: matchup.home?.name ?? "",
      awayShortName: matchup.away?.shortName ?? matchup.away?.name ?? "",
      homeShortName: matchup.home?.shortName ?? matchup.home?.name ?? "",
      ballpark: matchup.home?.home ?? "",
      source: "next-game-preview-v1"
    };
  }

  return { ok: false, code: "not-found", message: "다음 경기를 찾지 못했습니다." };
}

export function getTeamMonthlySchedule(state, teamId = state?.selectedTeamId, monthOffset = 0) {
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  const selectedTeam = findTeamById(state, teamId) ?? teams[0] ?? null;
  const baseDate = parseDate(state?.currentDate ?? "2026-03-01");
  const offset = clamp(Math.floor(safeNumber(monthOffset)), -12, 12);
  const firstDate = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + offset, 1));
  const lastDate = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() + 1, 0));
  const firstDateKey = formatDateKey(firstDate);
  const lastDateKey = formatDateKey(lastDate);
  const resultMap = buildMonthlyResultMap(state, selectedTeam?.id);
  const futureMap = buildMonthlyFutureScheduleMap(state, selectedTeam?.id, firstDate, lastDate);
  const days = [];

  for (let day = 1; day <= lastDate.getUTCDate(); day += 1) {
    const date = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), day));
    const dateKey = formatDateKey(date);
    const result = resultMap.get(dateKey);
    const future = futureMap.get(dateKey);
    const status = result?.status ??
      future?.status ??
      (date.getUTCDay() === 1
        ? "rest"
        : dateKey < String(state?.currentDate ?? "") && dateKey >= openingDayForDateKey(dateKey)
          ? "past"
          : "empty");
    days.push({
      date: dateKey,
      day,
      weekday: date.getUTCDay(),
      isToday: dateKey === state?.currentDate,
      isPast: dateKey < String(state?.currentDate ?? ""),
      status,
      game: result?.game ?? future?.game ?? null,
      result: result?.result ?? null
    });
  }

  return {
    ok: Boolean(selectedTeam),
    source: "team-monthly-schedule-v1",
    teamId: selectedTeam?.id ?? "",
    teamName: selectedTeam?.name ?? "",
    teamShortName: selectedTeam?.shortName ?? selectedTeam?.name ?? "",
    year: firstDate.getUTCFullYear(),
    month: firstDate.getUTCMonth() + 1,
    monthOffset: offset,
    firstWeekday: firstDate.getUTCDay(),
    firstDate: firstDateKey,
    lastDate: lastDateKey,
    currentDate: state?.currentDate ?? "",
    days
  };
}

export function simulateNextUserGame(state, options = {}) {
  if (!state || ["complete", "postseason", "offseason"].includes(state.phase)) {
    return { ok: false, code: "no-game", message: "진행 가능한 정규시즌 경기가 없습니다." };
  }

  normalizeState(state);

  if (state.phase === "preseason") {
    const date = parseDate(state.currentDate);
    const openingDay = openingDayForDateKey(formatDateKey(date));
    const daysToOpening = Math.max(0, Math.round((parseDate(openingDay).getTime() - date.getTime()) / MS_PER_DAY));
    return {
      ok: false,
      code: "preseason",
      date: state.currentDate,
      openingDay,
      daysToOpening,
      message: `아직 프리시즌입니다. 개막까지 ${daysToOpening}일 남았고, 경기 보기 대신 뉴스함/보고서를 확인하며 하루씩 진행하세요.`
    };
  }

  const teamId = options.teamId ?? state.selectedTeamId;
  const mode = options.mode === "watch" ? "watch" : "quick";
  let skippedDays = 0;

  for (let guard = 0; guard < 220; guard += 1) {
    const date = parseDate(state.currentDate);
    const dateKey = formatDateKey(date);
    const weather = buildWeather(state, date);
    state.weather = weather;
    processMailboxMorning(state, dateKey);
    recoverRoster(state.teams);

    if (date.getUTCDay() === 1) {
      addLog(state, `${dateKey} 월요일 휴식일: 다음 경기까지 회복일을 넘깁니다.`);
      addDailyMorningRoutine(state, {
        reportDate: dateKey,
        results: [],
        focusGame: null,
        newInjuries: []
      });
      tickInjuries(state.teams);
      advanceDate(state, date);
      skippedDays += 1;
      continue;
    }

    if (state.gamesPlayed >= REGULAR_SEASON_GAMES) {
      state.phase = "complete";
      return { ok: false, code: "season-complete", message: "정규시즌 720경기를 모두 마쳤습니다." };
    }

    const remaining = REGULAR_SEASON_GAMES - state.gamesPlayed;
    const matchups = buildMatchups(state.teams, Math.floor(state.gamesPlayed / DAILY_GAME_COUNT));
    const gamesToPlay = Math.min(matchups.length, Math.floor(remaining));
    const playable = matchups.slice(0, gamesToPlay);
    const focusMatchup = findMatchupForTeam(playable, teamId) ?? playable[0];
    const focusIndex = playable.indexOf(focusMatchup);
    const injurySnapshot = captureInjurySnapshot(state);
    const results = [];

    for (let i = 0; i < gamesToPlay; i += 1) {
      results.push(simulateGame(state, playable[i], i, weather, dateKey));
    }

    const focusGame = results[focusIndex] ?? results[0] ?? null;
    const orderedResults = focusGame
      ? [focusGame, ...results.filter((game) => game !== focusGame)]
      : results;
    state.lastGames = [...orderedResults, ...state.lastGames].slice(0, RECENT_LIMIT);
    state.gamesPlayed += results.length;

    if (results.length > 0) {
      const focusText = focusGame ? `${focusGame.away} ${focusGame.awayScore}-${focusGame.homeScore} ${focusGame.home}` : `${results.length}경기`;
      addLog(state, `${dateKey} ${weather.label}: ${mode === "watch" ? "경기 보기" : "빠른 시뮬레이션"} 완료, ${focusText}.`);
      addDailyMorningRoutine(state, {
        reportDate: dateKey,
        results,
        focusGame,
        newInjuries: collectNewInjuries(state, injurySnapshot)
      });
    }

    tickInjuries(state.teams);
    advanceDate(state, date);

    if (state.gamesPlayed >= REGULAR_SEASON_GAMES) {
      state.phase = "complete";
      addLog(state, `${dateKey} 정규시즌 종료: ${state.gamesPlayed}경기를 완료했습니다.`);
    }

    return {
      ok: true,
      code: "played",
      mode,
      skippedDays,
      date: dateKey,
      simulatedGames: results.length,
      game: focusGame,
      message: focusGame
        ? `${focusGame.away} ${focusGame.awayScore}-${focusGame.homeScore} ${focusGame.home}`
        : `${results.length}경기를 진행했습니다.`
    };
  }

  return { ok: false, code: "not-found", message: "다음 경기를 찾지 못했습니다." };
}

export function simulateDay(state) {
  if (!state || ["complete", "postseason", "offseason"].includes(state.phase)) return state;

  normalizeState(state);

  if (state.phase === "preseason") {
    const date = parseDate(state.currentDate);
    const dateKey = formatDateKey(date);
    const weather = buildWeather(state, date);
    state.weather = weather;
    processMailboxMorning(state, dateKey);
    recoverRoster(state.teams);
    advanceDate(state, date);
    if (state.currentDate >= openingDayForDateKey(state.currentDate)) {
      state.phase = "regular";
      addLog(state, `${state.currentDate} 정규시즌 개막일입니다. 이제 하루 진행부터 경기가 열립니다.`);
    } else {
      addPreseasonActivityLog(state, state.currentDate, weather);
    }
    return state;
  }

  const date = parseDate(state.currentDate);
  const dateKey = formatDateKey(date);
  const weather = buildWeather(state, date);
  state.weather = weather;
  processMailboxMorning(state, dateKey);

  recoverRoster(state.teams);

  if (date.getUTCDay() === 1) {
    addLog(state, `${dateKey} 월요일 휴식일: 전 구단이 이동과 회복에 집중했습니다.`);
    addDailyMorningRoutine(state, {
      reportDate: dateKey,
      results: [],
      focusGame: null,
      newInjuries: []
    });
  } else if (state.gamesPlayed < REGULAR_SEASON_GAMES && state.teams.length >= KBO_TEAM_COUNT) {
    const remaining = REGULAR_SEASON_GAMES - state.gamesPlayed;
    const matchups = buildMatchups(state.teams, Math.floor(state.gamesPlayed / DAILY_GAME_COUNT));
    const gamesToPlay = Math.min(matchups.length, Math.floor(remaining));
    const injurySnapshot = captureInjurySnapshot(state);
    const results = [];

    for (let i = 0; i < gamesToPlay; i += 1) {
      results.push(simulateGame(state, matchups[i], i, weather, dateKey));
    }

    state.lastGames = [...results, ...state.lastGames].slice(0, RECENT_LIMIT);
    state.gamesPlayed += results.length;
    if (results.length > 0) {
      addLog(state, `${dateKey} ${weather.label}: ${results.length}경기 진행, 총 ${sum(results, "totalRuns")}득점.`);
      addDailyMorningRoutine(state, {
        reportDate: dateKey,
        results,
        focusGame: findGameForTeam(results, state.selectedTeamId) ?? results[0],
        newInjuries: collectNewInjuries(state, injurySnapshot)
      });
    }
  } else if (state.teams.length < KBO_TEAM_COUNT) {
    addLog(state, `${dateKey} 구단 데이터 대기: ${KBO_TEAM_COUNT}개 구단이 필요합니다.`);
  }

  tickInjuries(state.teams);
  advanceDate(state, date);

  if (state.gamesPlayed >= REGULAR_SEASON_GAMES) {
    state.phase = "complete";
    addLog(state, `${dateKey} 정규시즌 종료: ${state.gamesPlayed}경기를 완료했습니다.`);
  }

  return state;
}

export function simulateDays(state, days) {
  const count = Math.max(0, Math.floor(safeNumber(days)));
  for (let i = 0; i < count; i += 1) {
    if (getBlockingMailDecision(state)) break;
    simulateDay(state);
  }
  return state;
}

export function advanceUntilStop(state, options = {}) {
  if (!state || ["complete", "postseason", "offseason"].includes(state.phase)) {
    return { stopped: true, reason: "phase-complete", date: state?.currentDate ?? "", days: 0, message: "진행 가능한 시즌 일정이 없습니다." };
  }
  normalizeState(state);
  const maxDays = Math.max(1, Math.floor(safeNumber(options.maxDays, 14)));
  let reason = getContinueStopReason(state);
  if (reason) {
    return { stopped: true, ...reason, date: state.currentDate, days: 0 };
  }

  let days = 0;
  for (; days < maxDays; days += 1) {
    simulateDay(state);
    reason = getContinueStopReason(state);
    if (reason) {
      return { stopped: true, ...reason, date: state.currentDate, days: days + 1 };
    }
    if (["complete", "postseason", "offseason"].includes(state.phase)) {
      return {
        stopped: true,
        reason: "phase-transition",
        date: state.currentDate,
        days: days + 1,
        message: "시즌 단계 전환 지점에서 멈췄습니다."
      };
    }
  }
  return {
    stopped: false,
    reason: "max-days",
    date: state.currentDate,
    days,
    message: `${maxDays}일을 진행했습니다.`
  };
}

export function simulateRegularSeason(state) {
  while (state?.gamesPlayed < REGULAR_SEASON_GAMES && state?.day < 260 && state?.phase !== "complete") {
    simulateDay(state);
  }
  return state;
}

export function resolveMailDecision(state, mailIdOrAction = "acknowledge", maybeAction = null, options = {}) {
  if (!state) return { ok: false, code: "no-state", message: "처리할 게임 상태가 없습니다." };
  normalizeState(state);
  const openDecisions = getOpenMailDecisions(state);
  const requestedId = String(mailIdOrAction ?? "");
  let mail = null;
  let action = "acknowledge";

  if (maybeAction == null) {
    mail = openDecisions.find((item) => String(item.id) === requestedId || String(item.decision?.id ?? "") === requestedId) ?? null;
    action = mail ? "acknowledge" : String(mailIdOrAction ?? "acknowledge");
    if (!mail) mail = openDecisions[0] ?? null;
  } else {
    mail = openDecisions.find((item) => String(item.id) === requestedId || String(item.decision?.id ?? "") === requestedId) ?? null;
    action = String(maybeAction ?? "acknowledge");
  }

  if (!mail) {
    return { ok: false, code: "no-pending-decision", message: "처리할 긴급 보고가 없습니다." };
  }

  const decision = decisionFromMail(mail);
  let result;
  if (decision.type === "medical-roster") {
    result = resolveMedicalRosterDecision(state, decision, action);
  } else if (decision.type === "foreign-lineup") {
    result = resolveForeignLineupDecision(state, decision, action);
  } else if (decision.type === "foreign-adaptation") {
    result = resolveForeignAdaptationDecision(state, decision, action);
  } else if (decision.type === "trade-offer") {
    result = resolveTradeOfferDecision(state, decision, action);
  } else if (decision.type === "waiver-claim") {
    result = resolveWaiverClaimDecision(state, decision, action);
  } else if (decision.type === "bullpen-rest") {
    result = resolveBullpenRestDecision(state, decision, action);
  } else if (decision.type === "futures-callup") {
    result = resolveFuturesCallupDecision(state, decision, action);
  } else if (decision.type === "opening-roster") {
    result = resolveOpeningRosterDecision(state, decision, action);
  } else if (decision.type === "opening-rotation") {
    result = resolveOpeningRotationDecision(state, decision, action);
  } else if (decision.type === "interview-request") {
    result = resolveInterviewDecision(state, decision, action);
  } else if (decision.type === "slumping-starter") {
    result = resolveSlumpingStarterDecision(state, decision, action);
  } else if (decision.type === "player-meeting") {
    result = resolvePlayerMeetingDecision(state, decision, action);
  } else if (decision.type === "owner-warning") {
    result = resolveOwnerWarningDecision(state, decision, action);
  } else if (decision.type === "owner-dismissal") {
    result = resolveOwnerDismissalDecision(state, decision, action);
  } else {
    result = { ok: true, code: "acknowledged", message: "보고를 확인했습니다." };
  }

  const resolvedDate = String(options.date ?? state.currentDate ?? "");
  const status = options.expired ? "expired" : "resolved";
  const resultMessage = options.expired
    ? `기한 만료로 '${decision.defaultAction ?? action}' 기본안이 자동 처리됐습니다. ${result.message ?? ""}`.trim()
    : result.message;
  mail.read = true;
  mail.decision = {
    ...mail.decision,
    status,
    resolvedAction: action,
    resolvedDate,
    resolvedAt: resolvedDate,
    resultMessage
  };
  state.mailDecisions = [
    {
      ...decision,
      status,
      resolvedAt: resolvedDate,
      resolvedDate,
      resolution: action,
      resolvedAction: action,
      resultMessage,
      followUpDate: addDaysKey(resolvedDate, 1),
      followUpSent: false
    },
    ...((state.mailDecisions ?? []).filter((entry) => entry.id !== decision.id))
  ].slice(0, MAIL_DECISION_LIMIT);
  refreshMailboxDerivedState(state);
  rememberManagerAction(state, {
    type: `mail-${decision.type ?? "decision"}`,
    teamId: decision.teamId ?? state.selectedTeamId,
    subjectId: decision.id ?? decision.headline ?? action,
    subject: decision.headline ?? "긴급 보고",
    headline: `결재 기록: ${decision.headline ?? "긴급 보고"}`,
    summary: resultMessage,
    heat: decision.blocking ? 16 : 10,
    tags: [decision.type ?? "mail", action, "decision"]
  });
  deliverMail(state, {
    id: `decision-result-${resolvedDate}-${decision.id}`,
    date: resolvedDate,
    from: { role: "개인비서", icon: "decision" },
    category: "club",
    type: options.expired ? "decision-expired" : "decision-result",
    headline: options.expired ? "기한 만료 자동 처리" : "결재 처리 완료",
    body: resultMessage,
    read: false,
    links: [{ label: "원문 보기", target: `mail:${mail.id}` }]
  });

  return { ...result, message: resultMessage, mailId: mail.id, status };
}

export function initializePostseason(state) {
  if (!state) return state;
  normalizeState(state);

  if (state.gamesPlayed < REGULAR_SEASON_GAMES) {
    simulateRegularSeason(state);
  }
  if (state.postseason?.status === "active" || state.postseason?.status === "complete") {
    return state;
  }

  const standings = getStandings(state);
  const seeds = standings.slice(0, 5).map((team, index) => toPostseasonParticipant(team, index + 1));
  const participantBySeed = new Map(seeds.map((participant) => [participant.seed, participant]));
  const series = POSTSEASON_SERIES.map((definition) => createPostseasonSeries(definition, participantBySeed));

  state.postseason = {
    status: "active",
    createdDate: state.currentDate,
    ruleSource: POSTSEASON_RULE_SOURCE,
    seeds,
    series,
    gamesPlayed: 0,
    championTeamId: null,
    championName: "",
    championSeed: null
  };
  state.awards = buildAwardCeremony(state, standings);
  state.phase = "postseason";
  addLog(state, `${state.currentDate} 포스트시즌 대진 확정: ${seeds.map((seed) => `${seed.seed}위 ${seed.shortName}`).join(", ")}.`);
  return state;
}

export function simulatePostseason(state) {
  if (!state) return state;
  initializePostseason(state);

  let guard = 0;
  while (state.postseason?.status === "active" && guard < 24) {
    guard += 1;
    const series = nextPostseasonSeries(state.postseason);
    if (!series) break;
    hydratePostseasonSeries(state.postseason, series);
    if (!series.participants.every(Boolean)) break;
    if (series.status === "pending") {
      startPostseasonSeries(state, series);
    }
    simulatePostseasonGame(state, series);
  }

  if (state.postseason?.status === "complete") {
    state.phase = "offseason";
  }
  return state;
}

export function initializeDraft(state) {
  if (!state) return state;
  normalizeState(state);

  if (state.draft?.status === "ready" || state.draft?.status === "complete") {
    return state;
  }
  if (state.postseason?.status !== "complete") {
    simulatePostseason(state);
  }

  const standings = getStandings(state);
  const draftYear = draftYearForState(state);
  const order = buildDraftOrder(standings);
  const strategies = Object.fromEntries(order.map((teamOrder) => {
    const team = findTeamById(state, teamOrder.teamId);
    return [teamOrder.teamId, buildDraftStrategy(team, teamOrder)];
  }));

  state.draft = {
    status: "ready",
    year: draftYear,
    ruleSource: DRAFT_RULE_SOURCE,
    rounds: DRAFT_ROUNDS,
    picksPerRound: DRAFT_PICKS_PER_ROUND,
    totalPicks: DRAFT_TOTAL_PICKS,
    poolSize: DRAFT_POOL_SIZE,
    order,
    strategies,
    prospects: createDraftProspectPool(draftYear, state),
    picks: []
  };
  state.phase = "offseason";
  addLog(state, `${state.currentDate} ${draftYear} 신인 드래프트 보드 생성: 익명 후보 코드 ${DRAFT_POOL_SIZE}명, ${DRAFT_ROUNDS}라운드.`);
  addLog(state, buildDraftScoutingOfficialLog(state));
  return state;
}

export function simulateDraft(state) {
  if (!state) return state;
  initializeDraft(state);
  if (state.draft?.status === "complete") {
    applyDraftSelectionsToRosters(state);
    return state;
  }

  const draft = state.draft;
  draft.pendingUserPick = null;
  let guard = 0;
  while (draft.status !== "complete" && guard < draft.totalPicks + 2) {
    guard += 1;
    const slot = getNextDraftSlot(draft);
    if (!slot) break;
    const result = commitAutomaticDraftPick(state, slot);
    if (!result.ok) break;
  }

  finalizeDraftIfComplete(state, draft);
  return state;
}

export function advanceDraftPick(state, options = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeDraft(state);
  const draft = state.draft;
  if (draft?.status === "complete") {
    applyDraftSelectionsToRosters(state);
    return { ok: true, code: "complete", message: "신인 드래프트가 이미 완료됐습니다.", draft };
  }

  const slot = getNextDraftSlot(draft);
  if (!slot) {
    finalizeDraftIfComplete(state, draft, { force: true });
    return { ok: true, code: "complete", message: "신인 드래프트가 완료됐습니다.", draft };
  }

  const userTeamId = String(options.teamId ?? state.selectedTeamId ?? "");
  if (String(slot.teamOrder.teamId) === userTeamId && options.allowUserAuto !== true) {
    draft.pendingUserPick = makeDraftPendingUserPick(draft, slot, userTeamId);
    return {
      ok: false,
      code: "pending-user-pick",
      message: `${slot.teamOrder.name} ${slot.round}라운드 지명 차례입니다.`,
      pendingUserPick: draft.pendingUserPick
    };
  }

  return commitAutomaticDraftPick(state, slot);
}

export function advanceDraftToUserPick(state, options = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeDraft(state);
  const draft = state.draft;
  const results = [];
  const maxPicks = Math.max(1, safeNumber(options.maxPicks, draft.totalPicks));
  for (let guard = 0; guard < maxPicks; guard += 1) {
    const result = advanceDraftPick(state, options);
    results.push(result);
    if (result.code === "pending-user-pick" || result.code === "complete" || !result.ok) {
      return { ...result, advancedPicks: results.filter((entry) => entry.ok && entry.pick).length, results };
    }
  }
  return { ok: true, code: "max-picks", message: `${results.length}픽 진행 후 멈췄습니다.`, advancedPicks: results.length, results };
}

export function commitUserDraftPick(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeDraft(state);
  const draft = state.draft;
  if (draft?.status === "complete") return { ok: false, code: "draft-complete", message: "이미 완료된 드래프트입니다." };

  const slot = getNextDraftSlot(draft);
  const userTeamId = String(input.teamId ?? state.selectedTeamId ?? "");
  if (!slot || String(slot.teamOrder.teamId) !== userTeamId) {
    return { ok: false, code: "not-user-turn", message: "현재 유저 구단의 지명 차례가 아닙니다." };
  }

  const prospectId = String(input.prospectId ?? "");
  const prospect = (draft.prospects ?? []).find((entry) => String(entry.id) === prospectId);
  if (!prospect) return { ok: false, code: "invalid-prospect", message: "드래프트 후보를 찾지 못했습니다." };
  if (prospect.picked || (draft.picks ?? []).some((pick) => String(pick.prospectId) === prospectId)) {
    return { ok: false, code: "duplicate-prospect", message: "이미 지명된 후보입니다." };
  }

  const pick = appendDraftPick(draft, prospect, slot, "user-command");
  draft.pendingUserPick = null;
  finalizeDraftIfComplete(state, draft);
  addLog(state, `${state.currentDate} ${slot.teamOrder.name} ${slot.round}라운드 ${prospect.displayCode} 직접 지명.`);
  return { ok: true, code: "user-pick-committed", message: `${prospect.displayCode} 지명을 확정했습니다.`, pick };
}

export function initializeSecondaryDraft(state) {
  if (!state) return state;
  normalizeState(state);

  if (state.secondaryDraft?.status === "ready" || state.secondaryDraft?.status === "complete") {
    return state;
  }
  if (state.postseason?.status !== "complete") {
    simulatePostseason(state);
  }

  const standings = getStandings(state);
  const order = buildSecondaryDraftOrder(standings);
  const protections = Object.fromEntries((state.teams ?? []).map((team) => [team.id, buildSecondaryProtectionList(team)]));
  const exposurePool = Object.values(protections).flatMap((entry) => entry.exposed);
  const strategies = Object.fromEntries(order.map((teamOrder) => {
    const team = findTeamById(state, teamOrder.teamId);
    return [teamOrder.teamId, buildSecondaryDraftStrategy(team, teamOrder)];
  }));

  state.secondaryDraft = {
    status: "ready",
    year: draftYearForState(state),
    ruleSource: SECONDARY_DRAFT_RULE_SOURCE,
    sourceUrls: [SECONDARY_DRAFT_SOURCE_URL],
    protectedCount: SECONDARY_DRAFT_PROTECTED_COUNT,
    baseRounds: SECONDARY_DRAFT_BASE_ROUNDS,
    extraRounds: SECONDARY_DRAFT_EXTRA_ROUNDS,
    extraTeamCount: SECONDARY_DRAFT_EXTRA_TEAM_COUNT,
    maxPicks: secondaryDraftMaxPicks(order),
    originPickLimit: SECONDARY_DRAFT_ORIGIN_PICK_LIMIT,
    compensationByRound: { ...SECONDARY_DRAFT_COMPENSATION_BY_ROUND },
    order,
    strategies,
    protections,
    exposurePool,
    picks: [],
    passedSlots: [],
    policyNotes: [
      "현재 531명 플레이 로스터 기준 v1입니다.",
      "외국인/FA 시장 선수는 hard-excluded 처리하고, 입단연차 자동 제외는 1,052명 원장 확장 후 공식 데이터로 엄격 적용합니다."
    ]
  };
  state.phase = "offseason";
  addLog(state, `${state.currentDate} ${state.secondaryDraft.year} 2차 드래프트 보호명단 확정: 구단별 최대 ${SECONDARY_DRAFT_PROTECTED_COUNT}명 보호.`);
  addLog(state, buildSecondaryProtectionOfficialLog(state));
  return state;
}

export function simulateSecondaryDraft(state) {
  if (!state) return state;
  initializeSecondaryDraft(state);
  if (state.secondaryDraft?.status === "complete") {
    applySecondaryDraftMoves(state);
    return state;
  }

  const draft = state.secondaryDraft;
  draft.pendingUserPick = null;
  let guard = 0;
  while (draft.status !== "complete" && guard < draft.maxPicks + 2) {
    guard += 1;
    const slot = getNextSecondaryDraftSlot(draft);
    if (!slot) break;
    const result = commitAutomaticSecondaryDraftPick(state, slot);
    if (!result.ok && result.code !== "secondary-pick-passed") break;
  }

  finalizeSecondaryDraftIfComplete(state, draft);
  return state;
}

export function setSecondaryDraftProtection(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeSecondaryDraft(state);
  const draft = state.secondaryDraft;
  if (draft?.status === "complete" || (draft?.picks ?? []).length > 0 || (draft?.passedSlots ?? []).length > 0) {
    return { ok: false, code: "secondary-draft-started", message: "2차 드래프트 지명이 시작된 뒤에는 보호명단을 바꿀 수 없습니다." };
  }

  const teamId = String(input.teamId ?? state.selectedTeamId ?? "");
  const team = findTeamById(state, teamId);
  if (!team) return { ok: false, code: "team-not-found", message: "구단을 찾지 못했습니다." };

  const playerIds = [...new Set((input.playerIds ?? []).map((id) => String(id)))];
  if (playerIds.length !== SECONDARY_DRAFT_PROTECTED_COUNT) {
    return { ok: false, code: "invalid-protected-count", message: `보호선수는 정확히 ${SECONDARY_DRAFT_PROTECTED_COUNT}명이어야 합니다.` };
  }

  const eligible = (team.roster ?? []).filter((player) => !secondaryHardExclusionReason(player));
  const eligibleIds = new Set(eligible.map((player) => String(player.id)));
  const invalidIds = playerIds.filter((id) => !eligibleIds.has(id));
  if (invalidIds.length > 0) {
    return { ok: false, code: "invalid-player", message: `보호 불가 선수가 포함됐습니다: ${invalidIds.slice(0, 3).join(", ")}` };
  }

  const protectedSet = new Set(playerIds);
  const hardExcluded = [];
  const protectedPlayers = [];
  const exposedPlayers = [];
  for (const player of team.roster ?? []) {
    const hardReason = secondaryHardExclusionReason(player);
    if (hardReason) {
      hardExcluded.push(toSecondaryDraftPlayerCard(team, player, "hardExcluded", hardReason));
      continue;
    }
    const score = Math.round(secondaryProtectionScore(player, team));
    const card = {
      ...toSecondaryDraftPlayerCard(team, player, protectedSet.has(String(player.id)) ? "protected" : "exposed", protectedSet.has(String(player.id)) ? "manager-protected-35" : "manager-exposed"),
      protectionScore: score
    };
    if (protectedSet.has(String(player.id))) {
      protectedPlayers.push(card);
    } else {
      exposedPlayers.push({ ...card, picked: false, selectedByTeamId: null });
    }
  }

  draft.protections[team.id] = {
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.shortName ?? team.name,
    protectedCount: protectedPlayers.length,
    exposedCount: exposedPlayers.length,
    hardExcludedCount: hardExcluded.length,
    protected: protectedPlayers.sort((a, b) => safeNumber(b.protectionScore) - safeNumber(a.protectionScore) || compareText(a.name, b.name)),
    exposed: exposedPlayers.sort((a, b) => safeNumber(b.protectionScore) - safeNumber(a.protectionScore) || compareText(a.name, b.name)),
    hardExcluded,
    source: "manager-protection-command-v1"
  };
  draft.exposurePool = Object.values(draft.protections).flatMap((entry) => entry.exposed ?? []);
  addLog(state, `${state.currentDate} ${team.name} 2차 드래프트 보호명단 조정: ${protectedPlayers.length}명 보호, ${exposedPlayers.length}명 노출.`);
  return { ok: true, code: "secondary-protection-updated", message: "2차 드래프트 보호명단을 저장했습니다.", protection: draft.protections[team.id] };
}

export function advanceSecondaryDraftPick(state, options = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeSecondaryDraft(state);
  const draft = state.secondaryDraft;
  if (draft?.status === "complete") {
    applySecondaryDraftMoves(state);
    return { ok: true, code: "complete", message: "2차 드래프트가 이미 완료됐습니다.", draft };
  }

  const slot = getNextSecondaryDraftSlot(draft);
  if (!slot) {
    finalizeSecondaryDraftIfComplete(state, draft, { force: true });
    return { ok: true, code: "complete", message: "2차 드래프트가 완료됐습니다.", draft };
  }

  const userTeamId = String(options.teamId ?? state.selectedTeamId ?? "");
  if (String(slot.teamId) === userTeamId && options.allowUserAuto !== true) {
    draft.pendingUserPick = makeSecondaryPendingUserPick(draft, slot, userTeamId);
    return {
      ok: false,
      code: "pending-user-pick",
      message: `${slot.teamName} 2차 드래프트 ${slot.round}라운드 지명 차례입니다.`,
      pendingUserPick: draft.pendingUserPick
    };
  }

  return commitAutomaticSecondaryDraftPick(state, slot);
}

export function advanceSecondaryDraftToUserPick(state, options = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeSecondaryDraft(state);
  const draft = state.secondaryDraft;
  const results = [];
  const maxPicks = Math.max(1, safeNumber(options.maxPicks, draft.maxPicks));
  for (let guard = 0; guard < maxPicks; guard += 1) {
    const result = advanceSecondaryDraftPick(state, options);
    results.push(result);
    if (result.code === "pending-user-pick" || result.code === "complete" || (!result.ok && result.code !== "secondary-pick-passed")) {
      return { ...result, advancedPicks: results.filter((entry) => entry.ok && entry.pick).length, results };
    }
  }
  return { ok: true, code: "max-picks", message: `${results.length}픽 진행 후 멈췄습니다.`, advancedPicks: results.length, results };
}

export function commitUserSecondaryDraftPick(state, input = {}) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeSecondaryDraft(state);
  const draft = state.secondaryDraft;
  if (draft?.status === "complete") return { ok: false, code: "secondary-draft-complete", message: "이미 완료된 2차 드래프트입니다." };

  const slot = getNextSecondaryDraftSlot(draft);
  const userTeamId = String(input.teamId ?? state.selectedTeamId ?? "");
  if (!slot || String(slot.teamId) !== userTeamId) {
    return { ok: false, code: "not-user-turn", message: "현재 유저 구단의 2차 드래프트 지명 차례가 아닙니다." };
  }

  const playerId = String(input.playerId ?? "");
  const originPickCounts = secondaryOriginPickCounts(draft);
  const candidate = (draft.exposurePool ?? []).find((entry) => String(entry.playerId) === playerId);
  if (!candidate) return { ok: false, code: "invalid-player", message: "비보호 풀에서 선수를 찾지 못했습니다." };
  if (candidate.picked || (draft.picks ?? []).some((pick) => String(pick.playerId) === playerId)) {
    return { ok: false, code: "duplicate-player", message: "이미 지명된 선수입니다." };
  }
  if (String(candidate.teamId) === userTeamId) {
    return { ok: false, code: "own-player", message: "자기 팀 선수는 지명할 수 없습니다." };
  }
  if (safeNumber(originPickCounts.get(candidate.teamId)) >= SECONDARY_DRAFT_ORIGIN_PICK_LIMIT) {
    return { ok: false, code: "origin-limit", message: "해당 원소속팀의 피지명 제한을 넘습니다." };
  }

  const pick = appendSecondaryDraftPick(draft, candidate, slot, originPickCounts, "user-command");
  draft.pendingUserPick = null;
  finalizeSecondaryDraftIfComplete(state, draft);
  addLog(state, `${state.currentDate} ${slot.teamName} 2차 드래프트 ${candidate.name} 직접 지명.`);
  return { ok: true, code: "secondary-user-pick-committed", message: `${candidate.name} 지명을 확정했습니다.`, pick };
}

export function initializeFreeAgency(state) {
  if (!state) return state;
  normalizeState(state);

  if (["ready", "active", "complete"].includes(state.freeAgency?.status)) {
    return state;
  }
  if (state.postseason?.status !== "complete") {
    simulatePostseason(state);
  }

  const year = draftYearForState(state);
  const faCandidates = buildFreeAgentCandidates(state, year);
  const offers = buildFreeAgentOffers(state, faCandidates, year);
  const foreignMarket = buildForeignMarketPool(state, year);
  const foreignOffers = buildForeignMarketOffers(state, foreignMarket, year);

  state.freeAgency = {
    status: "ready",
    year,
    ruleSource: FA_MARKET_RULE_SOURCE,
    sourceUrls: FA_MARKET_SOURCE_URLS,
    foreignRuleSource: FOREIGN_MARKET_RULE_SOURCE,
    foreignSourceUrls: FOREIGN_MARKET_SOURCE_URLS,
    faCandidates,
    offers,
    foreignMarket,
    foreignOffers,
    signings: [],
    compensationLedger: [],
    foreignSignings: [],
    policyNotes: [
      "FA 후보는 현재 검증 로스터의 국내 선수와 faStatus/compensationGrade만 사용합니다.",
      "외국인 시장은 실명 검증 전까지 FGN 코드형 후보만 만들며 roster에 가짜 이름을 넣지 않습니다."
    ]
  };
  state.phase = "offseason";
  addLog(state, `${state.currentDate} ${year} FA/외국인 시장 오픈: FA 후보 ${faCandidates.length}명, 외국인 코드 후보 ${foreignMarket.candidates.length}명.`);
  addLog(state, buildFreeAgencyOfficialLog(state));
  return state;
}

export function commitFreeAgentSigning(state, offer = null) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeFreeAgency(state);
  const market = state.freeAgency;
  const selectedOffer = offer ?? selectFreeAgentOfferForTeam(market, state.selectedTeamId) ?? market.offers.find((entry) => entry.status === "open");
  if (!selectedOffer) return { ok: false, code: "missing-offer", message: "계약 가능한 FA 오퍼가 없습니다." };
  if (selectedOffer.status === "signed" || market.signings.some((entry) => entry.offerId === selectedOffer.id || entry.playerId === selectedOffer.playerId)) {
    return { ok: false, code: "already-signed", message: "이미 계약 처리된 FA 오퍼입니다." };
  }

  const signingTeam = findTeamById(state, selectedOffer.signingTeamId);
  const originalEntry = findPlayerEntry(state, selectedOffer.playerId, selectedOffer.fromTeamId) ?? findPlayerEntry(state, selectedOffer.playerId);
  if (!signingTeam || !originalEntry) {
    return { ok: false, code: "not-found", message: "FA 선수 또는 계약 구단을 찾을 수 없습니다." };
  }

  const { team: originalTeam, player, index } = originalEntry;
  const movedTeams = String(originalTeam.id) !== String(signingTeam.id);
  if (movedTeams) {
    originalTeam.roster.splice(index, 1);
    transferPlayerToTeam(player, signingTeam.id);
    signingTeam.roster.push(player);
  } else {
    transferPlayerToTeam(player, signingTeam.id);
  }

  player.contract = createFreeAgentContract(player, selectedOffer, market.year);
  player.faStatus = {
    ...(player.faStatus ?? {}),
    status: "signed",
    marketState: "closed",
    filingSeason: market.year,
    signedTeamId: signingTeam.id,
    previousTeamId: originalTeam.id,
    signedDate: state.currentDate,
    rights: {
      canNegotiateWithAllTeams: false,
      originalTeamExclusiveUntil: null
    }
  };

  selectedOffer.status = "signed";
  selectedOffer.signedDate = state.currentDate;
  const candidate = market.faCandidates.find((entry) => entry.playerId === selectedOffer.playerId);
  if (candidate) {
    candidate.status = "signed";
    candidate.signedTeamId = signingTeam.id;
    candidate.signedTeamName = signingTeam.name;
  }

  const signing = {
    id: `fa-signing-${market.year}-${player.id}-${signingTeam.id}`,
    offerId: selectedOffer.id,
    date: state.currentDate,
    year: market.year,
    playerId: player.id,
    name: player.name,
    fromTeamId: originalTeam.id,
    fromTeamName: originalTeam.name,
    signingTeamId: signingTeam.id,
    signingTeamName: signingTeam.name,
    years: selectedOffer.years,
    annualSalaryKRW: selectedOffer.annualSalaryKRW,
    signingBonusKRW: selectedOffer.signingBonusKRW,
    incentivesKRW: selectedOffer.incentivesKRW,
    totalGuaranteeKRW: selectedOffer.totalGuaranteeKRW,
    compensationGrade: selectedOffer.compensation.grade,
    movedTeams,
    status: "complete"
  };
  market.signings.unshift(signing);
  market.signings = market.signings.slice(0, MARKET_LEDGER_LIMIT);

  const compensation = createFaCompensationLedger(selectedOffer, signing, state.currentDate);
  if (compensation) {
    market.compensationLedger.unshift(compensation);
    market.compensationLedger = market.compensationLedger.slice(0, MARKET_LEDGER_LIMIT);
    appendFinanceLedger(state, {
      id: `finance-${compensation.id}-payable`,
      date: state.currentDate,
      category: "fa-compensation",
      type: "expense",
      teamId: signingTeam.id,
      counterpartyTeamId: originalTeam.id,
      amountKRW: compensation.cashKRW,
      description: `${player.name} FA 보상금 예정`,
      sourceEventId: signing.id
    });
    appendFinanceLedger(state, {
      id: `finance-${compensation.id}-receivable`,
      date: state.currentDate,
      category: "fa-compensation",
      type: "income",
      teamId: originalTeam.id,
      counterpartyTeamId: signingTeam.id,
      amountKRW: compensation.cashKRW,
      description: `${player.name} FA 보상금 수취 예정`,
      sourceEventId: signing.id
    });
  }

  appendFinanceLedger(state, {
    id: `finance-${signing.id}`,
    date: state.currentDate,
    category: "fa-contract",
    type: "commitment",
    teamId: signingTeam.id,
    counterpartyTeamId: originalTeam.id,
    amountKRW: selectedOffer.totalGuaranteeKRW,
    description: `${player.name} FA ${selectedOffer.years}년 보장 계약`,
    sourceEventId: signing.id
  });

  appendEvent(state, {
    id: `event-${signing.id}`,
    type: "fa.signed",
    date: state.currentDate,
    playerId: player.id,
    teams: { from: originalTeam.id, to: signingTeam.id },
    contract: {
      years: selectedOffer.years,
      annualSalaryKRW: selectedOffer.annualSalaryKRW,
      totalGuaranteeKRW: selectedOffer.totalGuaranteeKRW,
      compensationGrade: selectedOffer.compensation.grade
    },
    summary: `${signingTeam.name} FA ${player.name} ${selectedOffer.years}년 계약`
  });
  addLog(state, `${state.currentDate} FA 계약: ${signingTeam.name} ${player.name} ${selectedOffer.years}년 ${formatMoneyForLog(selectedOffer.totalGuaranteeKRW)}.`);
  rememberManagerAction(state, {
    type: "fa-signing",
    teamId: signingTeam.id,
    subjectId: player.id,
    subject: player.name,
    headline: `${signingTeam.shortName ?? signingTeam.name} FA 투자 방향`,
    summary: `${player.name} ${selectedOffer.years}년 ${formatMoneyForLog(selectedOffer.totalGuaranteeKRW)} 계약으로 즉시 전력 보강 프레임이 생겼습니다.`,
    heat: 18,
    confidence: 78,
    tags: ["fa", "contract", "front-office"]
  });
  syncStateFoundation(state);

  return { ok: true, code: "signed", message: `${player.name} FA 계약을 완료했어요.`, signing, compensation };
}

export function commitForeignPlayerSigning(state, offer = null) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  initializeFreeAgency(state);
  const market = state.freeAgency;
  const selectedOffer = offer ?? selectForeignOfferForTeam(market, state.selectedTeamId) ?? market.foreignOffers.find((entry) => entry.status === "open");
  if (!selectedOffer) return { ok: false, code: "missing-offer", message: "계약 가능한 외국인 오퍼가 없습니다." };
  if (selectedOffer.status === "signed" || market.foreignSignings.some((entry) => entry.offerId === selectedOffer.id || entry.candidateId === selectedOffer.candidateId)) {
    return { ok: false, code: "already-signed", message: "이미 계약 처리된 외국인 오퍼입니다." };
  }

  const team = findTeamById(state, selectedOffer.teamId);
  const candidate = market.foreignMarket.candidates.find((entry) => entry.id === selectedOffer.candidateId);
  if (!team || !candidate) {
    return { ok: false, code: "not-found", message: "외국인 후보 또는 계약 구단을 찾을 수 없습니다." };
  }

  selectedOffer.status = "signed";
  selectedOffer.signedDate = state.currentDate;
  candidate.status = "rights-held";
  candidate.rightsTeamId = team.id;
  candidate.rightsTeamName = team.name;

  const signing = {
    id: `foreign-signing-${market.year}-${candidate.id}-${team.id}`,
    offerId: selectedOffer.id,
    date: state.currentDate,
    year: market.year,
    candidateId: candidate.id,
    displayCode: candidate.displayCode,
    teamId: team.id,
    teamName: team.name,
    tier: candidate.tier,
    role: candidate.role,
    position: candidate.position,
    slotType: candidate.slotType,
    contractKRW: selectedOffer.contractKRW,
    optionKRW: selectedOffer.optionKRW,
    rosterActivation: "pending-official-name",
    rightsStatus: "held",
    sourcePolicy: "실명 검증 전 코드형 권리 계약; roster 미등록",
    status: "rights-held"
  };
  market.foreignSignings.unshift(signing);
  market.foreignSignings = market.foreignSignings.slice(0, MARKET_LEDGER_LIMIT);

  appendFinanceLedger(state, {
    id: `finance-${signing.id}`,
    date: state.currentDate,
    category: "foreign-rights",
    type: "commitment",
    teamId: team.id,
    amountKRW: selectedOffer.contractKRW + safeNumber(selectedOffer.optionKRW),
    description: `${candidate.displayCode} 외국인 권리 계약`,
    sourceEventId: signing.id
  });

  appendEvent(state, {
    id: `event-${signing.id}`,
    type: "foreign.signed",
    date: state.currentDate,
    teamId: team.id,
    candidateId: candidate.id,
    displayCode: candidate.displayCode,
    contractKRW: selectedOffer.contractKRW,
    summary: `${team.name} 외국인 후보 ${candidate.displayCode} 권리 확보`
  });
  addLog(state, `${state.currentDate} 외국인 권리 계약: ${team.name} ${candidate.displayCode} ${formatMoneyForLog(selectedOffer.contractKRW)}.`);
  rememberManagerAction(state, {
    type: "foreign-signing",
    teamId: team.id,
    subjectId: candidate.id,
    subject: candidate.displayCode,
    headline: `${team.shortName ?? team.name} 외국인 슬롯 전략`,
    summary: `${candidate.displayCode} 권리 계약으로 ${candidate.role} 보강 기대와 KBO 적응 리스크가 함께 남았습니다.`,
    heat: 15,
    confidence: 66,
    tags: ["foreign", "contract", "front-office"]
  });
  syncStateFoundation(state);

  return { ok: true, code: "signed", message: `${candidate.displayCode} 외국인 권리 계약을 완료했어요.`, signing };
}

export function runAutonomousOffseason(state) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);

  if (state.postseason?.status !== "complete") {
    simulatePostseason(state);
  }

  const beforeRosterCount = allPlayerEntries(state).length;
  simulateDraft(state);
  simulateSecondaryDraft(state);
  initializeFreeAgency(state);

  const freeAgency = resolveFreeAgency(state);
  const foreign = resolveForeignMarket(state);
  const trades = runAiTradeMarket(state);
  const summary = {
    id: `offseason-${state.freeAgency?.year ?? draftYearForState(state)}`,
    status: "complete",
    date: state.currentDate,
    year: state.freeAgency?.year ?? draftYearForState(state),
    draftSignings: safeNumber(state.draft?.rosterLedger?.length),
    draftRights: safeNumber(state.draft?.rightsLedger?.length),
    secondaryTransfers: safeNumber(state.secondaryDraft?.transferLedger?.length),
    faSignings: freeAgency.signed,
    foreignRights: foreign.signed,
    aiTrades: trades.completed,
    rosterDelta: allPlayerEntries(state).length - beforeRosterCount,
    source: "autonomous-offseason-v1"
  };

  state.autonomousOffseason = {
    ...(state.autonomousOffseason ?? {}),
    lastRun: summary,
    history: [summary, ...((state.autonomousOffseason?.history ?? []))].slice(0, 12)
  };
  state.phase = "offseason";
  appendEvent(state, {
    id: `event-${summary.id}`,
    type: "offseason.autonomous.complete",
    date: state.currentDate,
    year: summary.year,
    summary: `자동 스토브리그 완료: 신인 ${summary.draftSignings}명, 2차 이동 ${summary.secondaryTransfers}명, FA ${summary.faSignings}건, CPU 트레이드 ${summary.aiTrades}건`
  });
  addLog(state, `${state.currentDate} 자동 스토브리그 완료: 신인 ${summary.draftSignings}명, 2차 이동 ${summary.secondaryTransfers}명, FA ${summary.faSignings}건, 외국인 권리 ${summary.foreignRights}건, CPU 트레이드 ${summary.aiTrades}건.`);

  return { ok: true, code: "complete", message: "자동 스토브리그를 완료했어요.", summary };
}

export function advanceSeason(state) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);

  if (state.phase !== "offseason" || state.postseason?.status !== "complete") {
    simulatePostseason(state);
  }
  if (!state.autonomousOffseason?.lastRun || safeNumber(state.autonomousOffseason.lastRun.year) !== draftYearForState(state)) {
    runAutonomousOffseason(state);
  }

  const nextYear = state.autonomousOffseason?.lastRun?.year ?? draftYearForState(state);
  const previousSeason = Number(String(state.currentDate ?? "").slice(0, 4)) || nextYear - 1;
  const historyEntry = buildSeasonHistoryEntry(state, previousSeason, nextYear);

  state.seasonHistory = [historyEntry, ...((state.seasonHistory ?? []))].slice(0, 12);
  archiveCompletedSeason(state, previousSeason, historyEntry);
  for (const team of state.teams ?? []) {
    resetTeamForNextSeason(team, nextYear, state);
  }

  state.day = 1;
  state.currentDate = `${nextYear}-${NEXT_SEASON_START_MONTH_DAY}`;
  state.gamesPlayed = 0;
  state.phase = "preseason";
  state.weather = { label: "맑음", temperature: 18, runFactor: 1, homerFactor: 1 };
  state.lastGames = [];
  state.postseason = null;
  state.awards = null;
  state.draft = null;
  state.secondaryDraft = null;
  state.freeAgency = null;
  state.pendingTradeApproval = null;

  appendEvent(state, {
    id: `event-season-rollover-${nextYear}`,
    type: "season.rollover",
    date: state.currentDate,
    previousSeason,
    season: nextYear,
    summary: `${nextYear}시즌 프리시즌으로 전환`
  });
  addLog(state, `${state.currentDate} ${nextYear}시즌 프리시즌 시작: 승패/기록 리셋, 나이+1, 계약/서비스타임 갱신.`);

  return { ok: true, code: "advanced", message: `${nextYear}시즌 프리시즌으로 넘어갔어요.`, season: nextYear, historyEntry };
}

export function advanceToNextSeason(state) {
  return advanceSeason(state);
}

function applyDraftSelectionsToRosters(state) {
  const draft = state?.draft;
  if (!draft || draft.status !== "complete") return { added: 0 };

  draft.rosterLedger = Array.isArray(draft.rosterLedger) ? draft.rosterLedger : [];
  draft.rightsLedger = Array.isArray(draft.rightsLedger) ? draft.rightsLedger : [];
  const existingPlayerIds = new Set(allPlayerEntries(state).map(({ player }) => String(player.id)));
  const ledgerIds = new Set(draft.rosterLedger.map((entry) => String(entry.prospectId)));
  const rightsIds = new Set(draft.rightsLedger.map((entry) => String(entry.prospectId)));
  const rosterSigningsByTeam = new Map((draft.rosterLedger ?? []).map((entry) => [String(entry.teamId), 0]));
  for (const entry of draft.rosterLedger ?? []) {
    rosterSigningsByTeam.set(String(entry.teamId), safeNumber(rosterSigningsByTeam.get(String(entry.teamId))) + 1);
  }
  let added = 0;
  let rightsHeld = 0;

  for (const pick of draft.picks ?? []) {
    const prospect = (draft.prospects ?? []).find((entry) => String(entry.id) === String(pick.prospectId));
    const team = findTeamById(state, pick.teamId);
    if (!prospect || !team) continue;
    const signedCount = safeNumber(rosterSigningsByTeam.get(String(team.id)));
    const directSigning = shouldAddDraftPickToRoster(team, prospect, pick, signedCount);

    if (!rightsIds.has(String(pick.prospectId))) {
      const rightsLedger = {
        id: `draft-rights-${draft.year}-${prospect.id}-${team.id}`,
        date: state.currentDate,
        year: draft.year,
        pickNumber: pick.pickNumber,
        round: pick.round,
        teamId: team.id,
        teamName: team.name,
        prospectId: prospect.id,
        displayCode: prospect.displayCode,
        status: directSigning ? "will-sign" : "rights-held",
        source: "anonymous-draft-rights-v1"
      };
      draft.rightsLedger.push(rightsLedger);
      rightsIds.add(String(pick.prospectId));
      rightsHeld += 1;
    }

    if (!directSigning) {
      prospect.rosterStatus = "rights-held";
      pick.rosterStatus = "rights-held";
      continue;
    }

    if (pick.rosterStatus === "signed" || ledgerIds.has(String(pick.prospectId))) continue;

    const player = createRookiePlayerFromProspect(prospect, pick, team, draft.year, team.roster.length);
    if (existingPlayerIds.has(String(player.id))) {
      pick.rosterStatus = "signed";
      pick.rosterPlayerId = player.id;
      continue;
    }

    team.roster.push(player);
    existingPlayerIds.add(String(player.id));
    prospect.rosterStatus = "signed";
    prospect.rosterPlayerId = player.id;
    pick.rosterStatus = "signed";
    pick.rosterPlayerId = player.id;

    const ledger = {
      id: `draft-signing-${draft.year}-${prospect.id}-${team.id}`,
      date: state.currentDate,
      year: draft.year,
      pickNumber: pick.pickNumber,
      round: pick.round,
      teamId: team.id,
      teamName: team.name,
      prospectId: prospect.id,
      playerId: player.id,
      displayCode: prospect.displayCode,
      status: "roster-added",
      source: "anonymous-draft-rookie-v1"
    };
    draft.rosterLedger.push(ledger);
    appendEvent(state, {
      id: `event-${ledger.id}`,
      type: "draft.rookie.signed",
      date: state.currentDate,
      year: draft.year,
      teamId: team.id,
      playerId: player.id,
      displayCode: prospect.displayCode,
      summary: `${team.name} ${prospect.displayCode} 신인 계약`
    });
    added += 1;
    rosterSigningsByTeam.set(String(team.id), signedCount + 1);
  }

  draft.rosterApplied = true;
  return { added, rightsHeld };
}

function shouldAddDraftPickToRoster(team, prospect, pick, signedCount) {
  if (signedCount >= DRAFT_MAX_ROSTER_SIGNINGS_PER_TEAM) return false;
  const rosterSize = Array.isArray(team?.roster) ? team.roster.length : 0;
  const round = safeNumber(pick?.round, 99);
  const futureGrade = safeNumber(prospect?.futureGrade);
  const presentGrade = safeNumber(prospect?.presentGrade);
  const signability = safeNumber(prospect?.signability, 50);

  if (rosterSize >= ORG_ROSTER_HARD_CAP && round > 2) return false;
  if (round <= DRAFT_DIRECT_SIGNING_ROUNDS) return signability >= 32;
  if (futureGrade >= 70 && signability >= 42) return true;
  if (round <= 6 && futureGrade >= 58 && presentGrade >= 45 && signability >= 48) return true;
  return false;
}

function createRookiePlayerFromProspect(prospect, pick, team, year, rosterIndex) {
  const seed = hashParts(prospect.id, pick.pickNumber, team.id, year);
  const role = prospect.role === "pitcher" ? "pitcher" : "hitter";
  const position = role === "pitcher" ? "P" : prospect.position;
  const presentGrade = safeNumber(prospect.presentGrade, 45);
  const futureGrade = safeNumber(prospect.futureGrade, presentGrade + 8);
  const ovr = clamp(Math.round(presentGrade * 1.55 + deterministicRange(seed, "ovr", -5, 5)), 42, 138);
  const pot = clamp(Math.max(ovr + 4, Math.round(futureGrade * 2.05 + deterministicRange(seed, "pot", -4, 8))), ovr, 178);
  const baseAbility = clamp(Math.round(presentGrade / 5), 1, 20);
  const futureAbility = clamp(Math.round(futureGrade / 5), baseAbility, 20);
  const id = `rookie-${prospect.id}-${team.id}`;
  const source = {
    kind: "estimated",
    label: "익명 드래프트 후보 v1",
    checkedDate: `${year - 1}-11-01`,
    confidence: 0.22
  };
  const player = {
    id,
    teamId: team.id,
    name: prospect.displayCode,
    age: safeNumber(prospect.age, 19),
    role,
    position,
    bats: role === "hitter" ? rookieHand(prospect.handedness, "bat") : "",
    throws: rookieHand(prospect.handedness, "throw"),
    jerseyNumber: "",
    status: "futures",
    playerId: "",
    source: "anonymous-draft-projection-v1",
    candidateType: "draftRookie",
    sourceUrls: [],
    sourceQueries: [],
    reviewNote: "실명 검증 전 코드형 신인 선수",
    verificationNote: "공식 신인 실명 DB 연결 전까지 DRF 코드로 플레이",
    school: prospect.classType ?? "",
    birthday: "",
    body: "",
    handedness: prospect.handedness ?? "",
    sourceKind: "anonymous-draft-rookie-v1",
    draftInfo: {
      year,
      round: safeNumber(pick.round),
      pickNumber: safeNumber(pick.pickNumber),
      pickInRound: safeNumber(pick.pickInRound),
      displayCode: prospect.displayCode,
      profile: prospect.profile,
      classType: prospect.classType
    },
    ovr,
    pot,
    ...rookieRatings(role, position, baseAbility, futureAbility, seed),
    ratingSource: {
      kind: "estimated",
      label: "20-80 드래프트 스카우팅 변환",
      checkedDate: `${year - 1}-11-01`,
      confidence: 0.2
    },
    seasonStats: createEmptySeasonStats(),
    fatigue: deterministicRange(seed, "fatigue", 0, 8),
    form: clamp(49 + deterministicRange(seed, "form", -4, 6), 35, 92),
    injuredDays: 0
  };

  player.contract = createRookieContract(player, team, year, rosterIndex);
  player.serviceTime = createRookieServiceTime(player, year, source);
  player.compensationGrade = createBasicCompensationGrade(year, source);
  player.faStatus = createBasicFaStatus(player, team.id, year, source);
  player.militaryStatus = createBasicMilitaryStatus(player, team.id, source);
  player.foreignPlayer = createDomesticForeignState(source);
  normalizeAnonymousDraftTools(player);
  return player;
}

function rookieRatings(role, position, baseAbility, futureAbility, seed) {
  const spread = (salt, bonus = 0) => clamp(baseAbility + deterministicRange(seed, salt, -2, 3) + bonus, 1, 20);
  const common = {
    conditionStability: spread("condition", 0),
    injuryResistance: spread("injury", 1),
    durability: spread("durability", 0),
    recovery: spread("recovery", 0),
    ageResilience: spread("ageResilience", 2),
    mentalToughness: spread("mental", -1),
    clutch: spread("clutch", -1),
    consistency: spread("consistency", -1),
    workEthic: spread("work", 2),
    leadership: spread("leadership", -2),
    adaptability: spread("adaptability", 1),
    teamwork: spread("teamwork", 0),
    leagueExperience: clamp(baseAbility - 4, 1, 20),
    bigGameExperience: clamp(baseAbility - 5, 1, 20),
    reputation: clamp(baseAbility - 2, 1, 20),
    kboAdaptation: spread("adaptation", -1)
  };

  if (role === "pitcher") {
    const stuff = spread("stuff", futureAbility >= 13 ? 1 : 0);
    const control = spread("control", -1);
    const stamina = spread("stamina", position === "P" ? 1 : -1);
    const movement = spread("movement", 0);
    return {
      ...common,
      stuff,
      control,
      velocity: spread("velocity", 1),
      stamina,
      movement,
      hrSuppression: spread("hrSuppression", 0),
      gbTendency: spread("gb", 0),
      repertoire: spread("repertoire", 0),
      pitchingIQ: spread("pitchingIQ", -1),
      holdRunners: spread("hold", -1),
      fielding: spread("fielding", -2),
      vsLHB: spread("vsLHB", 0),
      vsRHB: spread("vsRHB", 0),
      contact: 1,
      power: 1,
      eye: 1,
      speed: clamp(baseAbility - 3, 1, 20),
      defense: spread("pitcherDefense", -2)
    };
  }

  const contact = spread("contact", 0);
  const power = spread("power", ["1B", "3B", "OF", "RF"].includes(position) ? 1 : 0);
  const eye = spread("eye", -1);
  const speed = spread("speed", ["CF", "OF", "SS"].includes(position) ? 1 : 0);
  const defense = spread("defense", ["C", "SS", "CF"].includes(position) ? 1 : 0);
  return {
    ...common,
    contactL: contact,
    contactR: spread("contactR", 0),
    powerL: power,
    powerR: spread("powerR", 0),
    eye,
    situational: spread("situational", 0),
    battedBall: spread("battedBall", 0),
    patience: spread("patience", -1),
    bunting: spread("bunting", -2),
    vsLHP: spread("vsLHP", 0),
    vsRHP: spread("vsRHP", 0),
    defense,
    range: spread("range", ["SS", "CF"].includes(position) ? 1 : 0),
    arm: spread("arm", ["C", "SS", "RF"].includes(position) ? 1 : 0),
    catching: position === "C" ? spread("catching", 1) : clamp(baseAbility - 5, 1, 20),
    speed,
    stealing: spread("stealing", ["CF", "OF"].includes(position) ? 1 : -1),
    baserunning: spread("baserunning", 0),
    contact,
    power,
    stuff: 1,
    control: 1,
    stamina: clamp(baseAbility - 3, 1, 20),
    movement: 1
  };
}

function rookieHand(value, type) {
  const text = String(value ?? "").toUpperCase();
  if (type === "bat") {
    if (text.includes("S/")) return "S";
    if (text.includes("L/") || text.endsWith("/L")) return "L";
    return "R";
  }
  if (text.includes("LHP") || text.endsWith("/L")) return "L";
  return "R";
}

function createRookieContract(player, team, year, rosterIndex) {
  const salaryBySeason = Array.from({ length: ROOKIE_CONTRACT_YEARS }, (_, index) => ({
    season: year + index,
    amountKRW: ROOKIE_BASE_SALARY_KRW,
    payrollAmountKRW: ROOKIE_BASE_SALARY_KRW
  }));
  return {
    id: `contract-${player.id}-${year}`,
    status: "active",
    type: "rookie",
    teamId: team.id,
    startSeason: year,
    endSeason: year + ROOKIE_CONTRACT_YEARS - 1,
    signedDate: `${year - 1}-11-${String((rosterIndex % 20) + 1).padStart(2, "0")}`,
    guaranteedAmountKRW: ROOKIE_BASE_SALARY_KRW * ROOKIE_CONTRACT_YEARS,
    averageAnnualValueKRW: ROOKIE_BASE_SALARY_KRW,
    salary: {
      season: year,
      amountKRW: ROOKIE_BASE_SALARY_KRW,
      payrollAmountKRW: ROOKIE_BASE_SALARY_KRW,
      paymentTiming: "season",
      currency: "KRW"
    },
    salaryBySeason,
    signingBonus: {
      amountKRW: 0,
      paidSeason: year - 1,
      payrollTreatment: "unknown"
    },
    bonuses: [],
    options: [],
    clauses: {
      noTrade: "none",
      optOutAfterSeason: null,
      foreignReleaseClause: false
    },
    source: {
      kind: "estimated",
      label: "신인 기본 계약 v1",
      checkedDate: `${year - 1}-11-01`,
      confidence: 0.25
    }
  };
}

function createRookieServiceTime(player, year, source) {
  return {
    seasonsAccrued: 0,
    daysAccrued: 0,
    currentSeasonDays: 0,
    firstTeamRegistrationDays: 0,
    futuresOnlyDays: 0,
    rookieEligible: true,
    faClockStatus: "running",
    nextMilestone: {
      type: "faEligibility",
      season: year + 8,
      daysRemaining: 8 * 145
    },
    source
  };
}

function createBasicFaStatus(player, teamId, year, source) {
  const seasons = safeNumber(player?.serviceTime?.seasonsAccrued);
  const yearsUntilEligibility = Math.max(0, 8 - seasons);
  return {
    status: yearsUntilEligibility === 0 ? "eligibleAfterSeason" : "notEligible",
    eligibilitySeason: yearsUntilEligibility === 0 ? year : year + yearsUntilEligibility,
    filingSeason: null,
    marketState: "notOpen",
    yearsUntilEligibility,
    previousFaCount: safeNumber(player?.faStatus?.previousFaCount),
    qualifyingTeamId: teamId,
    compensationGrade: "none",
    compensationRule: {
      requiresProtectedList: false,
      protectedListSize: 0,
      cashCompensationMultiplier: 0
    },
    rights: {
      canNegotiateWithAllTeams: false,
      originalTeamExclusiveUntil: null
    },
    source
  };
}

function createBasicMilitaryStatus(player, teamId, source) {
  return {
    status: "unknown",
    availability: "available",
    obligation: "unknown",
    serviceType: null,
    startDate: null,
    expectedReturnDate: null,
    actualReturnDate: null,
    holdTeamId: teamId,
    countsTowardRosterLimit: false,
    notes: "공식 병역 데이터 입력 전",
    source
  };
}

function createDomesticForeignState(source) {
  return {
    isForeign: false,
    nationality: "KOR",
    registrationStatus: "notForeign",
    slotType: "domestic",
    marketTier: null,
    acquiredFrom: null,
    visaStatus: "notRequired",
    firstKboSeason: null,
    foreignRightsTeamId: null,
    replacementRisk: "low",
    previousLeagues: [],
    source
  };
}

function createBasicCompensationGrade(year, source, grade = "none", salaryKRW = 0) {
  const rule = FA_COMPENSATION_RULES[grade] ?? FA_COMPENSATION_RULES.none;
  return {
    grade,
    basisSeason: year,
    rankingBasis: grade === "none" ? "unknown" : "salaryRank",
    protectedListRequired: rule.protectedListSize > 0,
    compensationPlayerAllowed: rule.playerPlusCashMultiplier > 0,
    cashOnlyAllowed: grade === "C",
    estimatedCashKRW: roundMarketMoney(safeNumber(salaryKRW) * safeNumber(rule.cashOnlyMultiplier)),
    source
  };
}

function applySecondaryDraftMoves(state) {
  const draft = state?.secondaryDraft;
  if (!draft || draft.status !== "complete") return { moved: 0 };

  draft.transferLedger = Array.isArray(draft.transferLedger) ? draft.transferLedger : [];
  const transferredPickIds = new Set(draft.transferLedger.map((entry) => String(entry.pickNumber)));
  let moved = 0;

  for (const pick of draft.picks ?? []) {
    if (pick.transferStatus === "complete" || transferredPickIds.has(String(pick.pickNumber))) continue;
    const toTeam = findTeamById(state, pick.teamId);
    const fromTeam = findTeamById(state, pick.fromTeamId);
    if (!toTeam || !fromTeam) continue;

    const existingDestination = findPlayerEntry(state, pick.playerId, toTeam.id);
    const entry = findPlayerEntry(state, pick.playerId, fromTeam.id);
    if (existingDestination && !entry) {
      pick.transferStatus = "complete";
      continue;
    }
    if (!entry) continue;

    fromTeam.roster.splice(entry.index, 1);
    transferPlayerToTeam(entry.player, toTeam.id);
    toTeam.roster.push(entry.player);
    pick.transferStatus = "complete";
    pick.transferredDate = state.currentDate;

    const ledger = {
      id: `secondary-transfer-${draft.year}-${pick.pickNumber}-${pick.playerId}`,
      date: state.currentDate,
      year: draft.year,
      pickNumber: pick.pickNumber,
      round: pick.round,
      playerId: entry.player.id,
      name: entry.player.name,
      fromTeamId: fromTeam.id,
      fromTeamName: fromTeam.name,
      toTeamId: toTeam.id,
      toTeamName: toTeam.name,
      compensationKRW: safeNumber(pick.compensationKRW),
      status: "complete"
    };
    draft.transferLedger.push(ledger);
    appendEvent(state, {
      id: `event-${ledger.id}`,
      type: "secondaryDraft.player.transferred",
      date: state.currentDate,
      year: draft.year,
      playerId: entry.player.id,
      teams: { from: fromTeam.id, to: toTeam.id },
      summary: `${toTeam.name} 2차 드래프트로 ${entry.player.name} 지명`
    });
    moved += 1;
  }

  draft.rosterApplied = true;
  return { moved };
}

function resolveFreeAgency(state) {
  initializeFreeAgency(state);
  const market = state.freeAgency;
  const results = { signed: 0, retained: 0, failed: 0 };
  const signedPlayerIds = new Set((market.signings ?? []).map((entry) => String(entry.playerId)));

  for (const candidate of market.faCandidates ?? []) {
    if (candidate.status === "signed" || signedPlayerIds.has(String(candidate.playerId))) continue;
    let offer = bestFreeAgentOfferForCandidate(market, candidate.playerId);
    if (!offer) {
      offer = createRetentionFreeAgentOffer(state, market, candidate);
      if (offer) {
        market.offers.push(offer);
        results.retained += 1;
      }
    }
    if (!offer) {
      closeUnsignedFreeAgent(state, candidate, market.year);
      results.failed += 1;
      continue;
    }
    const result = commitFreeAgentSigning(state, offer);
    if (result.ok) {
      signedPlayerIds.add(String(candidate.playerId));
      results.signed += 1;
    } else {
      closeUnsignedFreeAgent(state, candidate, market.year);
      results.failed += 1;
    }
  }

  market.status = "complete";
  market.completedDate = state.currentDate;
  return results;
}

function bestFreeAgentOfferForCandidate(market, playerId) {
  return [...(market?.offers ?? [])]
    .filter((offer) => offer.status === "open" && String(offer.playerId) === String(playerId))
    .sort((a, b) => b.offerScore - a.offerScore || b.totalGuaranteeKRW - a.totalGuaranteeKRW)[0] ?? null;
}

function createRetentionFreeAgentOffer(state, market, candidate) {
  const team = findTeamById(state, candidate.fromTeamId);
  if (!team) return null;
  const score = candidate.marketScore + 6 + deterministicRange(market.year, team.id, candidate.playerId, "retention", -3, 5);
  return {
    ...createFreeAgentOffer(candidate, team, market.year, score, 99),
    id: `fa-retain-${market.year}-${team.id}-${candidate.playerId}`,
    source: "fa-retention-model-v1",
    retentionOffer: true
  };
}

function closeUnsignedFreeAgent(state, candidate, year) {
  const entry = findPlayerEntry(state, candidate.playerId, candidate.fromTeamId) ?? findPlayerEntry(state, candidate.playerId);
  if (!entry) return;
  candidate.status = "closed";
  entry.player.faStatus = {
    ...(entry.player.faStatus ?? {}),
    status: "eligibleAfterSeason",
    marketState: "closed",
    filingSeason: year,
    qualifyingTeamId: entry.team.id,
    rights: {
      canNegotiateWithAllTeams: false,
      originalTeamExclusiveUntil: null
    }
  };
}

function resolveForeignMarket(state) {
  initializeFreeAgency(state);
  const market = state.freeAgency;
  const results = { signed: 0, failed: 0 };
  for (const offer of market.foreignOffers ?? []) {
    if (offer.status !== "open") continue;
    const result = commitForeignPlayerSigning(state, offer);
    if (result.ok) results.signed += 1;
    else results.failed += 1;
  }
  if (market.foreignMarket) {
    market.foreignMarket.status = "complete";
  }
  return results;
}

function runAiTradeMarket(state) {
  normalizeState(state);
  const selectedTeamId = String(state.selectedTeamId ?? "");
  const usedPlayers = new Set();
  const usedPairs = new Set();
  const completed = [];
  let attempts = 0;

  for (const buyer of state.teams ?? []) {
    if (completed.length >= AI_OFFSEASON_TRADE_LIMIT || attempts >= AI_OFFSEASON_TRADE_ATTEMPTS) break;
    if (String(buyer.id) === selectedTeamId) continue;
    const market = buildTradeMarket(state, buyer.id);
    for (const proposal of market.proposals ?? []) {
      if (completed.length >= AI_OFFSEASON_TRADE_LIMIT || attempts >= AI_OFFSEASON_TRADE_ATTEMPTS) break;
      attempts += 1;
      const sellerTeamId = String(proposal.target?.teamId ?? "");
      const incomingPlayerId = String(proposal.target?.player?.id ?? "");
      const outgoingPlayerId = String(proposal.outgoingPlayers?.[0]?.player?.id ?? proposal.outgoing?.find((asset) => asset.assetType === "player")?.player?.id ?? "");
      const pairKey = [buyer.id, sellerTeamId].sort().join("-");
      if (
        !["viable", "needs_sweetener"].includes(proposal.status) ||
        tradePlayerAssetCountForProposal(proposal) !== 1 ||
        !sellerTeamId ||
        sellerTeamId === selectedTeamId ||
        sellerTeamId === String(buyer.id) ||
        usedPairs.has(pairKey) ||
        usedPlayers.has(incomingPlayerId) ||
        usedPlayers.has(outgoingPlayerId)
      ) {
        continue;
      }

      const negotiatedProposal = prepareAiTradeProposalForCommit(proposal, state, completed.length);
      const result = commitTradeProposal(state, approveAiTradeProposal(negotiatedProposal));
      if (!result.ok) continue;
      result.trade.source = "ai-offseason-v1";
      result.trade.aiManaged = true;
      completed.push(result.trade);
      usedPairs.add(pairKey);
      usedPlayers.add(incomingPlayerId);
      usedPlayers.add(outgoingPlayerId);
    }
  }

  state.aiTradeMarket = {
    status: "complete",
    date: state.currentDate,
    completed: completed.map((trade) => ({
      id: trade.id,
      buyerTeamId: trade.buyerTeamId,
      sellerTeamId: trade.sellerTeamId,
      incomingPlayerId: trade.incoming?.playerId ?? "",
      outgoingPlayerId: trade.outgoing?.playerId ?? "",
      acceptanceScore: trade.acceptanceScore
    })),
    attempts,
    source: "ai-offseason-v1"
  };
  return { completed: completed.length, attempts };
}

function tradePlayerAssetCountForProposal(proposal) {
  return (proposal?.outgoing ?? []).filter((asset) => asset.assetType === "player" && asset.player).length;
}

function prepareAiTradeProposalForCommit(proposal, state, index) {
  const targetOvr = safeNumber(proposal?.target?.player?.ovr);
  const targetPot = safeNumber(proposal?.target?.player?.pot, targetOvr);
  const eliteTarget = targetOvr >= TRADE_COMMIT_ELITE_OVR || (targetPot >= TRADE_COMMIT_ELITE_POT && targetOvr >= 135);
  const negotiatedAcceptance = Math.max(
    safeNumber(proposal.acceptanceScore),
    (eliteTarget ? TRADE_COMMIT_MIN_ELITE_ACCEPTANCE : TRADE_COMMIT_MIN_ACCEPTANCE) + deterministicRange(state.currentDate, proposal.id, index, "ai-trade-acceptance", 2, 10)
  );
  return {
    ...proposal,
    status: "viable",
    acceptanceScore: clamp(Math.round(negotiatedAcceptance), 0, 99),
    executionGate: {
      ...(proposal.executionGate ?? {}),
      commandReady: true,
      aiNegotiated: true,
      blockers: []
    },
    needsFollowUp: (proposal.needsFollowUp ?? []).filter((item) => !String(item).includes("AI 수락")),
    source: "ai-offseason-negotiated-v1"
  };
}

function approveAiTradeProposal(proposal) {
  return {
    ...proposal,
    commandApproval: {
      confirmed: true,
      proposalId: proposal.id,
      targetPlayerId: proposal.target?.player?.id ?? "",
      outgoingPlayerId: proposal.outgoingPlayers?.[0]?.player?.id ?? proposal.outgoing?.find((asset) => asset.assetType === "player")?.player?.id ?? ""
    }
  };
}

function buildSeasonHistoryEntry(state, previousSeason, nextYear) {
  const standings = getStandings(state);
  return {
    id: `season-${previousSeason}`,
    season: previousSeason,
    closedAt: state.currentDate,
    nextSeason: nextYear,
    gamesPlayed: safeNumber(state.gamesPlayed),
    championTeamId: state.postseason?.championTeamId ?? "",
    championName: state.postseason?.championName ?? "",
    standings: standings.map((team, index) => ({
      rank: index + 1,
      teamId: team.id,
      name: team.name,
      wins: safeNumber(team.wins),
      losses: safeNumber(team.losses),
      ties: safeNumber(team.ties),
      runsFor: safeNumber(team.runsFor),
      runsAgainst: safeNumber(team.runsAgainst)
    })),
    awards: state.awards ?? null,
    offseason: state.autonomousOffseason?.lastRun ?? null,
    rosterCount: allPlayerEntries(state).length
  };
}

function archiveCompletedSeason(state, previousSeason, seasonHistoryEntry = null) {
  if (!state || !Array.isArray(state.teams)) return null;

  const leagueEntry = buildLeagueHistoryEntry(state, previousSeason, seasonHistoryEntry);
  state.leagueHistory = [
    leagueEntry,
    ...((Array.isArray(state.leagueHistory) ? state.leagueHistory : [])
      .filter((entry) => safeNumber(entry?.season ?? entry?.year) !== safeNumber(previousSeason)))
  ].slice(0, LEAGUE_HISTORY_LIMIT);
  state.statsBySeason = state.statsBySeason && typeof state.statsBySeason === "object" ? state.statsBySeason : {};

  for (const { team, player } of allPlayerEntries(state)) {
    const seasonStats = cloneSeasonStats(player.seasonStats);
    const playerEntry = buildPlayerHistoryEntry(player, team, previousSeason, seasonStats, state.awards);
    player.history = [
      playerEntry,
      ...((Array.isArray(player.history) ? player.history : [])
        .filter((entry) => safeNumber(entry?.season ?? entry?.year) !== safeNumber(previousSeason)))
    ].slice(0, PLAYER_HISTORY_LIMIT);
    state.statsBySeason[player.id] = {
      ...(state.statsBySeason[player.id] ?? {}),
      [previousSeason]: seasonStats
    };
  }

  return leagueEntry;
}

function buildLeagueHistoryEntry(state, season, seasonHistoryEntry = null) {
  return {
    id: `league-season-${season}`,
    season,
    year: season,
    closedAt: state.currentDate,
    gamesPlayed: safeNumber(state.gamesPlayed),
    championTeamId: state.postseason?.championTeamId ?? seasonHistoryEntry?.championTeamId ?? "",
    championName: state.postseason?.championName ?? seasonHistoryEntry?.championName ?? "",
    standings: seasonHistoryEntry?.standings ?? buildStandingsSnapshot(state),
    awards: clonePlain(state.awards),
    leaders: buildLeagueLeaders(state, { includeUnqualified: false, limit: RECORD_BOOK_LIMIT }),
    leadersIncludingUnqualified: buildLeagueLeaders(state, { includeUnqualified: true, limit: RECORD_BOOK_LIMIT }),
    teamRecords: buildTeamRecords(state),
    qualification: buildRecordQualification(state),
    source: "season-rollover-v1"
  };
}

function buildPlayerHistoryEntry(player, team, season, seasonStats, awards) {
  return {
    id: `${player.id}-${season}`,
    season,
    year: season,
    teamId: team?.id ?? player?.teamId ?? "",
    teamName: team?.name ?? "",
    teamShortName: team?.shortName ?? team?.name ?? "",
    playerId: player?.id ?? "",
    name: player?.name ?? "",
    role: player?.role ?? "",
    position: player?.position ?? "",
    age: safeNumber(player?.age),
    ovr: safeNumber(player?.ovr),
    pot: safeNumber(player?.pot),
    batting: seasonStats.batting,
    pitching: seasonStats.pitching,
    fielding: seasonStats.fielding,
    awards: playerAwardTags(awards, player?.id),
    source: "season-rollover-v1"
  };
}

function buildStandingsSnapshot(state) {
  return getStandings(state).map((team, index) => ({
    rank: index + 1,
    teamId: team.id,
    name: team.name,
    shortName: team.shortName ?? team.name,
    wins: safeNumber(team.wins),
    losses: safeNumber(team.losses),
    ties: safeNumber(team.ties),
    pct: winningPct(team),
    runsFor: safeNumber(team.runsFor),
    runsAgainst: safeNumber(team.runsAgainst),
    runDiff: safeNumber(team.runsFor) - safeNumber(team.runsAgainst)
  }));
}

function buildRecordQualification(state) {
  const byTeam = Object.fromEntries((state?.teams ?? []).map((team) => {
    const games = teamGamesPlayed(team);
    return [team.id, {
      games,
      battingPlateAppearances: Math.ceil(games * 3.1),
      pitchingInnings: games,
      pitchingOuts: games * 3
    }];
  }));
  return {
    battingPlateAppearancesPerTeamGame: 3.1,
    pitchingInningsPerTeamGame: 1,
    byTeam
  };
}

function buildLeagueLeaders(state, options = {}) {
  const includeUnqualified = Boolean(options.includeUnqualified);
  const limit = Math.max(1, Math.floor(safeNumber(options.limit, RECORD_BOOK_LIMIT)));
  const players = allPlayerEntries(state);
  return {
    batting: Object.fromEntries(BATTING_LEADERBOARDS.map((board) => [
      board.key,
      buildLeaderboard(players, board, { includeUnqualified, limit })
    ])),
    pitching: Object.fromEntries(PITCHING_LEADERBOARDS.map((board) => [
      board.key,
      buildLeaderboard(players, board, { includeUnqualified, limit })
    ]))
  };
}

function buildLeaderboard(players, board, options) {
  return [...(players ?? [])]
    .filter((entry) => leaderRoleMatches(entry.player, board))
    .map((entry) => toLeaderEntry(entry, board))
    .filter((entry) => entry.active && (options.includeUnqualified || entry.qualified))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => compareLeaderEntries(a, b, board))
    .slice(0, options.limit);
}

function leaderRoleMatches(player, board) {
  if (board.statGroup === "pitching") return player?.role === "pitcher";
  return player?.role !== "pitcher";
}

function toLeaderEntry({ team, player }, board) {
  const stats = cloneSeasonStats(player?.seasonStats);
  const groupStats = stats[board.statGroup] ?? {};
  const qualification = playerQualification(player, team, board);
  const value = leaderValue(groupStats, board);
  return {
    playerId: player?.id ?? "",
    name: player?.name ?? "",
    teamId: team?.id ?? player?.teamId ?? "",
    teamName: team?.name ?? "",
    teamShortName: team?.shortName ?? team?.name ?? "",
    role: player?.role ?? "",
    position: player?.position ?? "",
    age: safeNumber(player?.age),
    ovr: safeNumber(player?.ovr),
    stat: board.key,
    label: board.label,
    value,
    active: isActiveLeaderLine(groupStats, board),
    qualified: qualification.qualified,
    qualifyingValue: qualification.value,
    qualifyingTarget: qualification.target,
    batting: stats.batting,
    pitching: stats.pitching,
    fielding: stats.fielding
  };
}

function playerQualification(player, team, board) {
  const games = teamGamesPlayed(team);
  if (board.qualification === "pitching") {
    const value = safeNumber(player?.seasonStats?.pitching?.inningsOuts);
    const target = games * 3;
    return { value, target, qualified: target <= 0 ? value > 0 : value >= target };
  }
  const value = safeNumber(player?.seasonStats?.batting?.plateAppearances);
  const target = Math.ceil(games * 3.1);
  return { value, target, qualified: target <= 0 ? value > 0 : value >= target };
}

function isActiveLeaderLine(stats, board) {
  if (board.statGroup === "pitching") return safeNumber(stats.inningsOuts) > 0;
  return safeNumber(stats.plateAppearances) > 0 || safeNumber(stats.atBats) > 0;
}

function leaderValue(stats, board) {
  if (board.key === "avg") return rate(stats.hits, stats.atBats);
  if (board.key === "ops") return rate(safeNumber(stats.hits) + safeNumber(stats.walks), stats.plateAppearances) + rate(stats.totalBases, stats.atBats);
  if (board.key === "era") {
    const inningsOuts = safeNumber(stats.inningsOuts);
    return inningsOuts > 0 ? safeNumber(stats.earnedRuns) * 27 / inningsOuts : Number.POSITIVE_INFINITY;
  }
  return safeNumber(stats[board.statKey ?? board.key]);
}

function compareLeaderEntries(a, b, board) {
  const valueDiff = board.direction === "asc" ? a.value - b.value : b.value - a.value;
  if (valueDiff !== 0) return valueDiff;
  const volumeDiff = board.statGroup === "pitching"
    ? safeNumber(b.pitching?.inningsOuts) - safeNumber(a.pitching?.inningsOuts)
    : safeNumber(b.batting?.plateAppearances) - safeNumber(a.batting?.plateAppearances);
  if (volumeDiff !== 0) return volumeDiff;
  const ovrDiff = safeNumber(b.ovr) - safeNumber(a.ovr);
  if (ovrDiff !== 0) return ovrDiff;
  return compareText(a.name, b.name);
}

function buildTeamRecords(state) {
  return getStandings(state).map((team, index) => {
    const batting = sumTeamBatting(team);
    const pitching = sumTeamPitching(team);
    return {
      rank: index + 1,
      teamId: team.id,
      name: team.name,
      shortName: team.shortName ?? team.name,
      wins: safeNumber(team.wins),
      losses: safeNumber(team.losses),
      ties: safeNumber(team.ties),
      games: teamGamesPlayed(team),
      pct: winningPct(team),
      runsFor: safeNumber(team.runsFor),
      runsAgainst: safeNumber(team.runsAgainst),
      runDiff: safeNumber(team.runsFor) - safeNumber(team.runsAgainst),
      battingAverage: rate(batting.hits, batting.atBats),
      onBasePercentage: rate(safeNumber(batting.hits) + safeNumber(batting.walks), batting.plateAppearances),
      sluggingPercentage: rate(batting.totalBases, batting.atBats),
      ops: rate(safeNumber(batting.hits) + safeNumber(batting.walks), batting.plateAppearances) + rate(batting.totalBases, batting.atBats),
      homeRuns: safeNumber(batting.homeRuns),
      era: pitching.inningsOuts > 0 ? safeNumber(pitching.earnedRuns) * 27 / safeNumber(pitching.inningsOuts) : Number.POSITIVE_INFINITY,
      strikeouts: safeNumber(pitching.strikeouts),
      batting,
      pitching
    };
  });
}

function sumTeamBatting(team) {
  const total = cloneSeasonStats().batting;
  for (const player of team?.roster ?? []) {
    addStatGroup(total, player?.seasonStats?.batting);
  }
  return total;
}

function sumTeamPitching(team) {
  const total = cloneSeasonStats().pitching;
  for (const player of team?.roster ?? []) {
    addStatGroup(total, player?.seasonStats?.pitching);
  }
  return total;
}

function addStatGroup(total, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    total[key] = safeNumber(total[key]) + safeNumber(value);
  }
  return total;
}

function playerAwardTags(awards, playerId) {
  const key = String(playerId ?? "");
  if (!key) return [];
  const tags = [];
  const regular = awards?.regularSeason ?? {};
  addAwardTag(tags, regular.mvp, key, "regular-mvp");
  addAwardTag(tags, regular.rookieOfYear, key, "rookie-of-year");
  for (const award of regular.goldenGloves ?? []) {
    addAwardTag(tags, award, key, "golden-glove");
  }
  addAwardTag(tags, awards?.postseason?.koreanSeriesMvp, key, "korean-series-mvp");
  return tags;
}

function addAwardTag(tags, award, playerId, type) {
  if (!award || String(award.playerId ?? "") !== playerId) return;
  tags.push({
    type,
    slotLabel: award.slotLabel ?? "",
    label: award.slotLabel ?? award.name ?? type,
    line: award.line ?? ""
  });
}

function cloneSeasonStats(source = {}) {
  const defaults = createEmptySeasonStats();
  return {
    batting: cloneStatGroup(source?.batting, defaults.batting),
    pitching: cloneStatGroup(source?.pitching, defaults.pitching),
    fielding: cloneStatGroup(source?.fielding, defaults.fielding)
  };
}

function cloneStatGroup(source = {}, defaults = {}) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(source ?? {})) {
    result[key] = safeNumber(value);
  }
  return result;
}

function clonePlain(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function teamGamesPlayed(team) {
  return safeNumber(team?.wins) + safeNumber(team?.losses) + safeNumber(team?.ties);
}

function inferSeasonFromState(state) {
  const year = Number(String(state?.currentDate ?? "").slice(0, 4));
  return Number.isFinite(year) ? year : 2026;
}

function resetTeamForNextSeason(team, season, state = null) {
  team.wins = 0;
  team.losses = 0;
  team.ties = 0;
  team.runsFor = 0;
  team.runsAgainst = 0;
  team.attendanceTotal = 0;
  team.homeGames = 0;
  team.streak = [];
  team.morale = clamp(Math.round(safeNumber(team.morale, 52) * 0.72 + 52 * 0.28), 35, 82);

  for (const player of team.roster ?? []) {
    advancePlayerForSeason(player, team, season);
  }
  refreshTeamCompensationGrades(team, season);
  team.payroll = roundNumber(sum((team.roster ?? []).map((player) => ({ value: safeNumber(player.contract?.salary?.payrollAmountKRW) })), "value") / 100_000_000, 1);
  applyRosterExitPolicy(team, season, state);
  refreshTeamCompensationGrades(team, season);
  team.payroll = roundNumber(sum((team.roster ?? []).map((player) => ({ value: safeNumber(player.contract?.salary?.payrollAmountKRW) })), "value") / 100_000_000, 1);
  assignActiveRoster(team, season);
}

function applyRosterExitPolicy(team, season, state = null) {
  if (!Array.isArray(team?.roster)) return { retired: 0, released: 0 };
  const transactions = [];
  const retained = [];
  const currentRoster = team.roster;
  const capacity = payrollCapacityEok(team);
  const payrollTarget = capacity * PAYROLL_TARGET_RATIO;

  for (const player of currentRoster) {
    if (shouldRetirePlayer(player, team, season)) {
      transactions.push(toRosterTransaction("retired", player, team, season, "age-curve"));
    } else {
      retained.push(player);
    }
  }

  team.roster = retained;
  trimRosterToTarget(team, season, transactions);
  trimPayrollToTarget(team, season, transactions, payrollTarget);

  if (transactions.length > 0 && state) {
    state.rosterTransactions = {
      ...(state?.rosterTransactions ?? {}),
      history: [...transactions, ...((state?.rosterTransactions?.history ?? []))].slice(0, MARKET_LEDGER_LIMIT)
    };
    appendEvent(state, {
      id: `event-roster-trim-${season}-${team.id}`,
      type: "roster.trimmed",
      date: `${season}-${NEXT_SEASON_START_MONTH_DAY}`,
      teamId: team.id,
      summary: `${team.name} 로스터 정리: 은퇴 ${transactions.filter((entry) => entry.type === "retired").length}명, 방출 ${transactions.filter((entry) => entry.type !== "retired").length}명`
    });
  }

  return {
    retired: transactions.filter((entry) => entry.type === "retired").length,
    released: transactions.filter((entry) => entry.type !== "retired").length
  };
}

function trimRosterToTarget(team, season, transactions) {
  while ((team.roster ?? []).length > ORG_ROSTER_HARD_CAP) {
    const candidate = selectRosterExitCandidate(team, "roster-cap");
    if (!candidate) break;
    removePlayerFromTeam(team, candidate, transactions, season, "released", "roster-cap");
  }

  while ((team.roster ?? []).length > ORG_ROSTER_TARGET) {
    const candidate = selectRosterExitCandidate(team, "depth-trim");
    if (!candidate || rosterRetentionScore(candidate, team) >= 150) break;
    removePlayerFromTeam(team, candidate, transactions, season, "released", "depth-trim");
  }
}

function trimPayrollToTarget(team, season, transactions, payrollTarget) {
  let payroll = teamPayrollEok(team);
  let guard = 0;
  while (payroll > payrollTarget && guard < 18) {
    const candidate = selectRosterExitCandidate(team, "payroll");
    if (!candidate) break;
    const salaryEok = safeNumber(candidate.contract?.salary?.payrollAmountKRW) / 100_000_000;
    if (salaryEok < 2.5 && (team.roster ?? []).length <= ORG_ROSTER_TARGET) break;
    removePlayerFromTeam(team, candidate, transactions, season, "nonTendered", "payroll-pressure");
    payroll = teamPayrollEok(team);
    guard += 1;
  }
}

function selectRosterExitCandidate(team, reason) {
  const protectedCount = reason === "payroll" ? 18 : 24;
  const protectedIds = new Set(
    [...(team.roster ?? [])]
      .sort((a, b) => rosterRetentionScore(b, team) - rosterRetentionScore(a, team))
      .slice(0, protectedCount)
      .map((player) => String(player.id))
  );
  return [...(team.roster ?? [])]
    .filter((player) => !protectedIds.has(String(player.id)))
    .filter((player) => !player?.foreignPlayer?.isForeign || reason === "payroll")
    .sort((a, b) => rosterExitScore(a, team, reason) - rosterExitScore(b, team, reason))[0] ?? null;
}

function removePlayerFromTeam(team, player, transactions, season, type, reason) {
  const index = (team.roster ?? []).findIndex((entry) => String(entry.id) === String(player.id));
  if (index < 0) return;
  team.roster.splice(index, 1);
  if (player.contract && typeof player.contract === "object") {
    player.contract.status = type === "retired" ? "terminated" : "released";
    player.contract.endSeason = Math.min(safeNumber(player.contract.endSeason, season), season - 1);
  }
  player.status = type === "retired" ? "retired" : "released";
  transactions.push(toRosterTransaction(type, player, team, season, reason));
}

function toRosterTransaction(type, player, team, season, reason) {
  return {
    id: `roster-${type}-${season}-${team.id}-${player.id}`,
    type,
    reason,
    season,
    date: `${season}-${NEXT_SEASON_START_MONTH_DAY}`,
    teamId: team.id,
    teamName: team.name,
    playerId: player.id,
    playerName: player.name,
    age: safeNumber(player.age),
    ovr: safeNumber(player.ovr),
    pot: safeNumber(player.pot),
    salaryKRW: safeNumber(player.contract?.salary?.payrollAmountKRW),
    source: "roster-ecosystem-v1"
  };
}

function shouldRetirePlayer(player, team, season) {
  const age = safeNumber(player.age, 26);
  if (age >= 45) return true;
  const score = rosterRetentionScore(player, team);
  if (age >= 42 && score < 170) return true;
  if (age >= 39 && score < 132 && deterministicRange(season, team.id, player.id, "retire", 0, 99) < 44) return true;
  return false;
}

function rosterExitScore(player, team, reason) {
  const salaryEok = safeNumber(player.contract?.salary?.payrollAmountKRW) / 100_000_000;
  const salaryPressure = reason === "payroll" ? salaryEok * 9 : salaryEok * 1.2;
  const anonymousPenalty = isAnonymousDraftPlayer(player) ? 8 : 0;
  return rosterRetentionScore(player, team) - salaryPressure - anonymousPenalty;
}

function rosterRetentionScore(player, team) {
  const age = safeNumber(player.age, 27);
  const ovr = safeNumber(player.ovr);
  const pot = safeNumber(player.pot, ovr);
  const salaryEok = safeNumber(player.contract?.salary?.payrollAmountKRW) / 100_000_000;
  const youth = age <= 23 ? 24 : age <= 26 ? 12 : age >= 36 ? -18 : age >= 33 ? -8 : 0;
  const roleScarcity = player.role === "pitcher" ? 8 : player.position === "C" ? 12 : 0;
  const activeBonus = player.status === "active" ? 8 : 0;
  const sourcePenalty = isAnonymousDraftPlayer(player) ? 5 : 0;
  return ovr * 0.94 + pot * 0.46 + youth + roleScarcity + activeBonus - salaryEok * 1.6 - sourcePenalty;
}

function assignActiveRoster(team, season) {
  if (!Array.isArray(team?.roster)) return { active: 0 };
  for (const player of team.roster) {
    if (player.status !== "retired" && player.status !== "released" && player.militaryStatus?.availability !== "unavailable") {
      player.status = "futures";
    }
  }

  const pitchers = team.roster
    .filter((player) => player.role === "pitcher" && player.militaryStatus?.availability !== "unavailable")
    .sort((a, b) => pitcherScore(b) - pitcherScore(a) || safeNumber(b.ovr) - safeNumber(a.ovr));
  const hitters = team.roster
    .filter((player) => player.role !== "pitcher" && player.militaryStatus?.availability !== "unavailable")
    .sort((a, b) => hitterScore(b) - hitterScore(a) || safeNumber(b.ovr) - safeNumber(a.ovr));

  const selected = new Set();
  for (const player of pitchers.slice(0, Math.min(ACTIVE_PITCHER_TARGET, pitchers.length))) {
    selected.add(String(player.id));
  }
  selectHittersByGroup(hitters, selected, "C", 2);
  selectHittersByGroup(hitters, selected, "IF", 6);
  selectHittersByGroup(hitters, selected, "OF", 5);
  for (const player of hitters) {
    if (selected.size >= ACTIVE_ROSTER_TARGET) break;
    selected.add(String(player.id));
  }
  for (const player of pitchers) {
    if (selected.size >= ACTIVE_ROSTER_TARGET) break;
    selected.add(String(player.id));
  }

  for (const player of team.roster) {
    if (selected.has(String(player.id))) player.status = "active";
  }
  team.activeRosterUpdatedSeason = season;
  return { active: selected.size };
}

function selectHittersByGroup(hitters, selected, group, count) {
  const matches = hitters.filter((player) => hitterRosterGroup(player) === group);
  for (const player of matches) {
    if (selected.size >= ACTIVE_ROSTER_TARGET) break;
    const current = matches.filter((entry) => selected.has(String(entry.id))).length;
    if (current >= count) break;
    selected.add(String(player.id));
  }
}

function hitterRosterGroup(player) {
  if (player.position === "C") return "C";
  if (["OF", "LF", "CF", "RF"].includes(player.position)) return "OF";
  return "IF";
}

function teamPayrollEok(team) {
  return sum((team?.roster ?? []).map((player) => ({ value: safeNumber(player.contract?.salary?.payrollAmountKRW) })), "value") / 100_000_000;
}

function payrollCapacityEok(team) {
  return safeNumber(team?.budget) + safeNumber(team?.market, 50) * 0.65 + safeNumber(team?.fan, 50) * 0.35;
}

function isAnonymousDraftPlayer(player) {
  return String(player?.sourceKind ?? "") === "anonymous-draft-rookie-v1" ||
    String(player?.id ?? "").startsWith("rookie-draft-") ||
    /^DRF-\d{4}-\d{3}$/.test(String(player?.name ?? ""));
}

function anonymousReadinessPenalty(player) {
  if (!isAnonymousDraftPlayer(player)) return 0;
  const ovr = safeNumber(player?.ovr, 115);
  const pot = safeNumber(player?.pot, ovr);
  const service = safeNumber(player?.serviceTime?.seasonsAccrued);
  const readiness = clamp((ovr - 105) * 0.62 + Math.max(0, pot - 160) * 0.08 + service * 1.4, 0, 22);
  return roundNumber(Math.max(0, 22 - readiness), 1);
}

function anonymousPerformanceProfile(player) {
  if (!isAnonymousDraftPlayer(player)) {
    return { walkScale: 1, singleScale: 1, extraBaseScale: 1, homerScale: 1, strikeoutAdd: 0 };
  }
  const ovr = safeNumber(player?.ovr, 115);
  const pot = safeNumber(player?.pot, ovr);
  const service = safeNumber(player?.serviceTime?.seasonsAccrued);
  const readiness = clamp((ovr - 104) / 46 + Math.max(0, pot - 170) / 180 + Math.min(service, 5) * 0.018, 0, 1);
  const base = clamp(0.72 + readiness * 0.24, 0.72, 0.96);
  return {
    walkScale: clamp(0.84 + readiness * 0.12, 0.84, 0.96),
    singleScale: base,
    extraBaseScale: clamp(base - 0.04, 0.66, 0.92),
    homerScale: clamp(base - 0.08, 0.58, 0.88),
    strikeoutAdd: roundNumber((1 - readiness) * 0.035, 3)
  };
}

function normalizeAnonymousDraftTools(player) {
  if (!isAnonymousDraftPlayer(player)) return;
  const ovr = safeNumber(player?.ovr, 115);
  const pot = safeNumber(player?.pot, ovr);
  const primaryCeiling = clamp(Math.round(ovr / 10 + 2 + Math.max(0, pot - 175) / 45), 9, 18);
  const secondaryCeiling = clamp(primaryCeiling + 1, 10, 19);
  const fields = player.role === "pitcher"
    ? {
        primary: ["stuff", "control", "velocity", "movement", "hrSuppression", "pitchingIQ"],
        secondary: ["stamina", "gbTendency", "repertoire", "holdRunners", "fielding", "vsLHB", "vsRHB"]
      }
    : {
        primary: ["contactL", "contactR", "powerL", "powerR", "eye", "battedBall", "patience", "contact", "power"],
        secondary: ["situational", "bunting", "vsLHP", "vsRHP", "defense", "range", "arm", "catching", "speed", "stealing", "baserunning"]
      };
  for (const field of fields.primary) {
    if (Number.isFinite(Number(player[field]))) player[field] = Math.min(safeNumber(player[field]), primaryCeiling);
  }
  for (const field of fields.secondary) {
    if (Number.isFinite(Number(player[field]))) player[field] = Math.min(safeNumber(player[field]), secondaryCeiling);
  }
}

function advancePlayerForSeason(player, team, season) {
  const previousAge = safeNumber(player.age, 26);
  player.age = previousAge + 1;
  applyPlayerDevelopment(player, team, season, previousAge);
  normalizeAnonymousDraftTools(player);
  player.seasonStats = createEmptySeasonStats();
  player.fatigue = clamp(Math.round(safeNumber(player.fatigue) * 0.18), 0, 30);
  player.form = clamp(52 + deterministicRange(season, player.id, "form", -5, 7), 35, 92);
  player.dailyCondition = clamp(55 + deterministicRange(season, player.id, "condition", -5, 8), 25, 95);
  player.sharpness = clamp(53 + deterministicRange(season, player.id, "sharpness", -6, 8), 25, 95);
  player.injuredDays = Math.max(0, Math.floor(safeNumber(player.injuredDays) * 0.35));
  if (player.role === "pitcher") {
    player.armFreshness = clamp(84 + deterministicRange(season, player.id, "arm", -4, 8), 20, 100);
  }
  if (player.serviceTime && typeof player.serviceTime === "object") {
    player.serviceTime.seasonsAccrued = safeNumber(player.serviceTime.seasonsAccrued) + 1;
    player.serviceTime.daysAccrued = safeNumber(player.serviceTime.daysAccrued) + 145;
    player.serviceTime.currentSeasonDays = 0;
    player.serviceTime.rookieEligible = player.age <= 23 && safeNumber(player.serviceTime.seasonsAccrued) <= 1;
    player.serviceTime.faClockStatus = safeNumber(player.serviceTime.seasonsAccrued) >= 8 ? "met" : "running";
    player.serviceTime.nextMilestone = {
      type: "faEligibility",
      season: season + Math.max(0, 8 - safeNumber(player.serviceTime.seasonsAccrued)),
      daysRemaining: Math.max(0, (8 - safeNumber(player.serviceTime.seasonsAccrued)) * 145)
    };
  }
  rollContractToSeason(player, team, season);
  player.faStatus = createBasicFaStatus(player, team.id, season, {
    kind: "estimated",
    label: "시즌 롤오버 v1",
    checkedDate: `${season}-03-01`,
    confidence: 0.28
  });
  if (player.militaryStatus && typeof player.militaryStatus === "object") {
    player.militaryStatus.holdTeamId = team.id;
  }
  if (player.foreignPlayer?.isForeign) {
    player.foreignPlayer.foreignRightsTeamId = team.id;
  }
}

function applyPlayerDevelopment(player, team, season, previousAge) {
  const seed = hashParts(season, team.id, player.id, previousAge, "development");
  const upside = Math.max(0, safeNumber(player.pot, player.ovr) - safeNumber(player.ovr));
  const ageCurve = previousAge <= 22 ? 2 : previousAge <= 25 ? 1 : previousAge <= 29 ? 0 : previousAge <= 33 ? -1 : -3;
  const roleNoise = deterministicRange(seed, "delta", -1, 2);
  const ovrDelta = clamp(ageCurve + Math.floor(upside / 32) + roleNoise, -5, 5);
  const potDelta = previousAge <= 23 ? deterministicRange(seed, "pot-young", -1, 2) : previousAge >= 31 ? -deterministicRange(seed, "pot-old", 0, 3) : deterministicRange(seed, "pot-mid", -1, 1);
  player.ovr = clamp(safeNumber(player.ovr) + ovrDelta, 20, 200);
  player.pot = clamp(Math.max(player.ovr, safeNumber(player.pot, player.ovr) + potDelta), player.ovr, 200);

  const abilityDelta = ovrDelta > 2 ? 1 : ovrDelta < -2 ? -1 : 0;
  if (abilityDelta !== 0) {
    const fields = player.role === "pitcher"
      ? ["stuff", "control", "velocity", "stamina", "movement", "hrSuppression", "gbTendency", "repertoire", "pitchingIQ", "holdRunners", "fielding", "vsLHB", "vsRHB"]
      : ["contactL", "contactR", "powerL", "powerR", "eye", "situational", "battedBall", "patience", "bunting", "vsLHP", "vsRHP", "defense", "range", "arm", "catching", "speed", "stealing", "baserunning", "contact", "power"];
    for (const field of fields) {
      if (Number.isFinite(Number(player[field]))) {
        player[field] = clamp(safeNumber(player[field]) + abilityDelta, 1, 20);
      }
    }
  }
}

function rollContractToSeason(player, team, season) {
  if (!player.contract || typeof player.contract !== "object") return;
  player.contract.teamId = team.id;
  player.contract.status = "active";
  player.contract.salaryBySeason = Array.isArray(player.contract.salaryBySeason) && player.contract.salaryBySeason.length
    ? player.contract.salaryBySeason
    : [{
        season,
        amountKRW: safeNumber(player.contract.salary?.amountKRW, ROOKIE_BASE_SALARY_KRW),
        payrollAmountKRW: safeNumber(player.contract.salary?.payrollAmountKRW, ROOKIE_BASE_SALARY_KRW)
      }];

  let salary = player.contract.salaryBySeason.find((entry) => safeNumber(entry.season) === season);
  if (!salary) {
    const previous = player.contract.salaryBySeason.at(-1) ?? player.contract.salary ?? { amountKRW: ROOKIE_BASE_SALARY_KRW, payrollAmountKRW: ROOKIE_BASE_SALARY_KRW };
    const amountKRW = roundMarketMoney(Math.max(ROOKIE_BASE_SALARY_KRW, safeNumber(previous.amountKRW, ROOKIE_BASE_SALARY_KRW) * 1.03));
    salary = { season, amountKRW, payrollAmountKRW: amountKRW };
    player.contract.salaryBySeason.push(salary);
    player.contract.endSeason = Math.max(safeNumber(player.contract.endSeason, season), season);
  }
  player.contract.salary = {
    ...player.contract.salary,
    season,
    amountKRW: safeNumber(salary.amountKRW, ROOKIE_BASE_SALARY_KRW),
    payrollAmountKRW: safeNumber(salary.payrollAmountKRW, salary.amountKRW),
    paymentTiming: player.contract.salary?.paymentTiming ?? "season",
    currency: player.contract.salary?.currency ?? "KRW"
  };
}

function refreshTeamCompensationGrades(team, season) {
  const ranked = [...(team.roster ?? [])]
    .sort((a, b) => safeNumber(b.contract?.salary?.payrollAmountKRW) - safeNumber(a.contract?.salary?.payrollAmountKRW));
  const rankById = new Map(ranked.map((player, index) => [String(player.id), index + 1]));
  for (const player of team.roster ?? []) {
    const salary = safeNumber(player.contract?.salary?.payrollAmountKRW);
    const seasons = safeNumber(player.serviceTime?.seasonsAccrued);
    let grade = "none";
    if (seasons >= 8) {
      const rank = safeNumber(rankById.get(String(player.id)), 99);
      if (rank <= 3 || salary >= 900_000_000) grade = "A";
      else if (rank <= 10 || salary >= 450_000_000) grade = "B";
      else grade = "C";
    }
    const source = {
      kind: grade === "none" ? "fallback" : "estimated",
      label: "시즌 롤오버 연봉순위 v1",
      checkedDate: `${season}-03-01`,
      confidence: grade === "none" ? 0.2 : 0.3
    };
    player.compensationGrade = createBasicCompensationGrade(season, source, grade, salary);
    if (player.faStatus && typeof player.faStatus === "object") {
      player.faStatus.compensationGrade = grade;
      player.faStatus.compensationRule = {
        requiresProtectedList: ["A", "B"].includes(grade),
        protectedListSize: grade === "A" ? 20 : grade === "B" ? 25 : 0,
        cashCompensationMultiplier: grade === "A" ? 3 : grade === "B" ? 2 : grade === "C" ? 1.5 : 0
      };
    }
  }
}

function createEmptySeasonStats() {
  return {
    batting: {
      games: 0,
      plateAppearances: 0,
      atBats: 0,
      runs: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      rbi: 0,
      walks: 0,
      strikeouts: 0,
      reachedOnErrors: 0,
      groundedDoublePlays: 0,
      stolenBases: 0,
      caughtStealing: 0,
      totalBases: 0
    },
    pitching: {
      games: 0,
      gamesStarted: 0,
      wins: 0,
      losses: 0,
      saves: 0,
      holds: 0,
      blownSaves: 0,
      inningsOuts: 0,
      battersFaced: 0,
      hitsAllowed: 0,
      runsAllowed: 0,
      earnedRuns: 0,
      homeRunsAllowed: 0,
      walksAllowed: 0,
      strikeouts: 0,
      pitches: 0
    },
    fielding: {
      games: 0,
      errors: 0
    }
  };
}

function buildFreeAgentCandidates(state, year) {
  const candidates = allPlayerEntries(state)
    .filter(({ player }) => !player?.foreignPlayer?.isForeign)
    .filter(({ player }) => ["eligibleAfterSeason", "filed", "market"].includes(player?.faStatus?.status) || safeNumber(player?.faStatus?.yearsUntilEligibility) <= 0)
    .map(({ team, player }) => ({ team, player, score: freeAgentCandidateScore(player, team) }))
    .sort((a, b) => b.score - a.score || safeNumber(b.player.ovr) - safeNumber(a.player.ovr) || compareText(a.player.name, b.player.name))
    .slice(0, FA_MARKET_CANDIDATE_LIMIT);

  for (const { player } of candidates) {
    player.faStatus = {
      ...(player.faStatus ?? {}),
      status: "market",
      marketState: "open",
      filingSeason: year,
      rights: {
        canNegotiateWithAllTeams: true,
        originalTeamExclusiveUntil: null
      }
    };
  }

  return candidates.map(({ team, player, score }, index) => toFreeAgentCandidate(team, player, year, score, index));
}

function freeAgentCandidateScore(player, team) {
  const salaryEok = safeNumber(player?.contract?.salary?.payrollAmountKRW) / 100_000_000;
  const gradePenalty = player?.compensationGrade?.grade === "A" ? 11 : player?.compensationGrade?.grade === "B" ? 6 : player?.compensationGrade?.grade === "C" ? 2 : 0;
  const age = safeNumber(player?.age, 30);
  const primeBonus = age <= 30 ? 10 : age <= 34 ? 4 : -Math.max(0, age - 34) * 2.4;
  return safeNumber(player?.ovr) * 0.78 + safeNumber(player?.pot) * 0.24 + primeBonus + clubMood(team) * 2 - salaryEok * 0.7 - gradePenalty;
}

function toFreeAgentCandidate(team, player, year, score, index) {
  const grade = player?.compensationGrade?.grade ?? player?.faStatus?.compensationGrade ?? "none";
  const salaryKRW = safeNumber(player?.contract?.salary?.payrollAmountKRW);
  return {
    id: `fa-${year}-${player.id}`,
    rank: index + 1,
    playerId: player.id,
    name: player.name,
    fromTeamId: team.id,
    fromTeamName: team.name,
    fromTeamShortName: team.shortName ?? team.name,
    role: player.role,
    position: player.position,
    age: safeNumber(player.age),
    ovr: safeNumber(player.ovr),
    pot: safeNumber(player.pot),
    previousSalaryKRW: salaryKRW,
    serviceSeasons: safeNumber(player.serviceTime?.seasonsAccrued),
    compensationGrade: grade,
    compensation: faCompensationRule(grade, salaryKRW),
    marketScore: Math.round(score),
    status: "open",
    source: "current-roster-fa-status-v1"
  };
}

function buildFreeAgentOffers(state, candidates, year) {
  const offers = [];
  for (const team of state.teams ?? []) {
    const teamNeeds = draftNeedsForTeam(team);
    const ranked = candidates
      .filter((candidate) => String(candidate.fromTeamId) !== String(team.id))
      .filter((candidate) => candidate.status === "open")
      .map((candidate) => ({
        candidate,
        score: freeAgentOfferScore(candidate, team, teamNeeds, year)
      }))
      .filter((entry) => entry.score >= 72)
      .sort((a, b) => b.score - a.score || safeNumber(b.candidate.ovr) - safeNumber(a.candidate.ovr) || compareText(a.candidate.name, b.candidate.name))
      .slice(0, FA_MARKET_OFFER_LIMIT_PER_TEAM);

    for (const [index, entry] of ranked.entries()) {
      offers.push(createFreeAgentOffer(entry.candidate, team, year, entry.score, index));
    }
  }
  return offers.sort((a, b) => b.offerScore - a.offerScore || b.totalGuaranteeKRW - a.totalGuaranteeKRW);
}

function freeAgentOfferScore(candidate, team, needs, year) {
  const positionGroup = draftPositionGroup(candidate.position, candidate.role);
  const need = (needs ?? []).find((entry) => entry.key === positionGroup);
  const needBonus = need ? safeNumber(need.score) * 0.9 : 0;
  const payrollRoom = payrollCapacityEok(team) - safeNumber(team?.payroll);
  const payrollBonus = payrollRoom > 0 ? Math.min(12, payrollRoom / 13) : Math.max(-34, payrollRoom / 4);
  const austerityPenalty = payrollRoom < -20 ? 16 : payrollRoom < -5 ? 7 : 0;
  const gradePenalty = candidate.compensationGrade === "A" ? 8 : candidate.compensationGrade === "B" ? 4 : candidate.compensationGrade === "C" ? 1 : 0;
  const sameLeagueNoise = deterministicRange(year, team?.id, candidate.playerId, -3, 3);
  return candidate.marketScore + needBonus + payrollBonus + sameLeagueNoise - gradePenalty - austerityPenalty;
}

function createFreeAgentOffer(candidate, team, year, score, index) {
  const grade = candidate.compensationGrade ?? "none";
  const years = candidate.age <= 29 && candidate.ovr >= 125 ? 4 : candidate.age <= 33 && candidate.ovr >= 118 ? 3 : candidate.age <= 36 ? 2 : 1;
  const salaryBase = Math.max(candidate.previousSalaryKRW, (candidate.ovr * 7_500_000) + (candidate.pot * 1_500_000));
  const payrollRoom = payrollCapacityEok(team) - safeNumber(team?.payroll);
  const pressureDiscount = payrollRoom < -20 ? 0.82 : payrollRoom < -5 ? 0.92 : 1;
  const annualSalaryKRW = roundMarketMoney(salaryBase * (1.08 + Math.max(0, score - 120) * 0.004) * pressureDiscount);
  const signingBonusKRW = roundMarketMoney(annualSalaryKRW * (grade === "A" ? 0.42 : grade === "B" ? 0.3 : grade === "C" ? 0.18 : 0.12));
  const incentivesKRW = roundMarketMoney(annualSalaryKRW * (candidate.role === "pitcher" ? 0.16 : 0.12));
  const totalGuaranteeKRW = annualSalaryKRW * years + signingBonusKRW;
  return {
    id: `fa-offer-${year}-${team.id}-${candidate.playerId}-${index + 1}`,
    type: "fa",
    status: "open",
    playerId: candidate.playerId,
    playerName: candidate.name,
    fromTeamId: candidate.fromTeamId,
    fromTeamName: candidate.fromTeamName,
    signingTeamId: team.id,
    signingTeamName: team.name,
    years,
    annualSalaryKRW,
    signingBonusKRW,
    incentivesKRW,
    totalGuaranteeKRW,
    option: years >= 3 ? { type: "club", season: year + years, amountKRW: roundMarketMoney(annualSalaryKRW * 1.04) } : null,
    noTradeClause: grade === "A" && totalGuaranteeKRW >= 4_000_000_000 ? "limited" : "none",
    agent: selectAgent(candidate.playerId, year),
    compensation: faCompensationRule(grade, candidate.previousSalaryKRW),
    offerScore: Math.round(score),
    source: "fa-offer-model-v1"
  };
}

function selectFreeAgentOfferForTeam(market, teamId) {
  return [...(market?.offers ?? [])]
    .filter((offer) => offer.status === "open" && String(offer.signingTeamId) === String(teamId))
    .sort((a, b) => b.offerScore - a.offerScore || b.totalGuaranteeKRW - a.totalGuaranteeKRW)[0] ?? null;
}

function createFreeAgentContract(player, offer, year) {
  const salaryBySeason = Array.from({ length: safeNumber(offer.years, 1) }, (_, index) => {
    const season = year + index;
    const amountKRW = roundMarketMoney(safeNumber(offer.annualSalaryKRW) * (1 + index * 0.04));
    return { season, amountKRW, payrollAmountKRW: amountKRW };
  });
  const guaranteedAmountKRW = salaryBySeason.reduce((total, item) => total + item.amountKRW, safeNumber(offer.signingBonusKRW));
  return {
    id: `contract-fa-${player.id}-${year}`,
    status: "active",
    type: "fa",
    teamId: offer.signingTeamId,
    startSeason: year,
    endSeason: year + safeNumber(offer.years, 1) - 1,
    signedDate: offer.signedDate ?? "",
    guaranteedAmountKRW,
    averageAnnualValueKRW: roundMarketMoney(guaranteedAmountKRW / Math.max(1, safeNumber(offer.years, 1))),
    salary: {
      season: year,
      amountKRW: safeNumber(offer.annualSalaryKRW),
      payrollAmountKRW: safeNumber(offer.annualSalaryKRW),
      paymentTiming: "season",
      currency: "KRW"
    },
    salaryBySeason,
    signingBonus: {
      amountKRW: safeNumber(offer.signingBonusKRW),
      paidSeason: year,
      payrollTreatment: "unknown"
    },
    bonuses: [
      {
        id: `bonus-fa-${player.id}-${year}-incentive`,
        type: "performance",
        label: player.role === "pitcher" ? "이닝/등판 인센티브" : "타석/출장 인센티브",
        amountKRW: safeNumber(offer.incentivesKRW),
        status: "pending"
      }
    ],
    options: offer.option ? [{ ...offer.option, id: `option-fa-${player.id}-${offer.option.season}` }] : [],
    clauses: {
      noTrade: offer.noTradeClause ?? "none",
      optOutAfterSeason: null,
      foreignReleaseClause: false
    },
    source: {
      kind: "estimated",
      label: "FA 시장 v1 계약 모델",
      checkedDate: "",
      confidence: 0.35
    }
  };
}

function createFaCompensationLedger(offer, signing, date) {
  if (String(signing.fromTeamId) === String(signing.signingTeamId)) return null;
  const rule = offer.compensation ?? faCompensationRule(signing.compensationGrade, 0);
  if (!rule || rule.grade === "none") return null;
  return {
    id: `fa-comp-${signing.year}-${signing.playerId}-${signing.signingTeamId}`,
    signingId: signing.id,
    date,
    year: signing.year,
    playerId: signing.playerId,
    name: signing.name,
    grade: rule.grade,
    originalTeamId: signing.fromTeamId,
    originalTeamName: signing.fromTeamName,
    signingTeamId: signing.signingTeamId,
    signingTeamName: signing.signingTeamName,
    protectedListSize: rule.protectedListSize,
    cashOnlyKRW: rule.cashOnlyKRW,
    playerPlusCashKRW: rule.playerPlusCashKRW,
    cashKRW: rule.grade === "C" ? rule.cashOnlyKRW : rule.playerPlusCashKRW,
    decision: rule.grade === "C" ? "cash-only" : "player-plus-cash-pending",
    status: "pending"
  };
}

function faCompensationRule(grade, previousSalaryKRW) {
  const normalizedGrade = ["A", "B", "C"].includes(grade) ? grade : "none";
  const rule = FA_COMPENSATION_RULES[normalizedGrade] ?? FA_COMPENSATION_RULES.none;
  const salary = safeNumber(previousSalaryKRW);
  return {
    grade: normalizedGrade,
    protectedListSize: rule.protectedListSize,
    requiresProtectedList: rule.protectedListSize > 0,
    compensationPlayerAllowed: rule.playerPlusCashMultiplier > 0,
    cashOnlyMultiplier: rule.cashOnlyMultiplier,
    playerPlusCashMultiplier: rule.playerPlusCashMultiplier,
    cashOnlyKRW: roundMarketMoney(salary * rule.cashOnlyMultiplier),
    playerPlusCashKRW: roundMarketMoney(salary * rule.playerPlusCashMultiplier)
  };
}

function buildForeignMarketPool(state, year) {
  return {
    status: "ready",
    sourcePolicy: "실명 검증 전 코드형 후보만 사용",
    candidates: Array.from({ length: FOREIGN_MARKET_POOL_SIZE }, (_, index) => createForeignMarketCandidate(state, year, index))
  };
}

function createForeignMarketCandidate(state, year, index) {
  const tier = Math.min(FOREIGN_MARKET_TIERS, Math.floor(index / Math.ceil(FOREIGN_MARKET_POOL_SIZE / FOREIGN_MARKET_TIERS)) + 1);
  const seed = hashParts(year, index, state?.teams?.length ?? KBO_TEAM_COUNT, "foreign-market");
  const role = rollUnit(seed, "role") < 0.56 ? "pitcher" : "hitter";
  const position = role === "pitcher"
    ? rollUnit(seed, "starter") < 0.68 ? "SP" : "RP"
    : ["1B", "3B", "CF", "RF", "OF"][hashParts(seed, "position") % 5];
  const displayCode = `FGN-${year}-${String(index + 1).padStart(3, "0")}`;
  const scoutingGrade = clamp(76 - tier * 7 + deterministicRange(seed, "grade", -3, 4), 34, 74);
  const askingSalaryKRW = roundMarketMoney((2_100_000_000 - tier * 260_000_000) + scoutingGrade * 8_000_000);
  return {
    id: `foreign-${year}-${index + 1}`,
    displayCode,
    sourceKind: "anonymous-foreign-market-v1",
    tier,
    role,
    position,
    slotType: role === "pitcher" ? "foreignPitcher" : "foreignHitter",
    profile: foreignMarketProfile(role, position, tier),
    age: clamp(24 + tier + deterministicRange(seed, "age", -2, 5), 23, 35),
    askingSalaryKRW,
    scoutingGrade,
    adaptationRisk: foreignRiskLabel(tier, seed, "adaptation"),
    medicalRisk: foreignRiskLabel(tier, seed, "medical"),
    status: "available"
  };
}

function buildForeignMarketOffers(state, foreignMarket, year) {
  const usedCandidateIds = new Set();
  const offers = [];
  for (const [index, team] of (state.teams ?? []).entries()) {
    const availableCandidates = (foreignMarket.candidates ?? []).filter((candidate) => !usedCandidateIds.has(candidate.id));
    const candidate = selectForeignCandidateForTeam(availableCandidates.length ? availableCandidates : foreignMarket.candidates, team, year, index);
    if (!candidate) continue;
    usedCandidateIds.add(candidate.id);
    const payrollRoom = payrollCapacityEok(team) - safeNumber(team?.payroll);
    const pressureDiscount = payrollRoom < -20 ? 0.78 : payrollRoom < -5 ? 0.9 : 1;
    const contractKRW = roundMarketMoney(candidate.askingSalaryKRW * (1 + deterministicRange(year, team.id, candidate.id, -4, 8) / 100) * pressureDiscount);
    const pressurePenalty = payrollRoom < -20 ? 14 : payrollRoom < -5 ? 6 : 0;
    offers.push({
      id: `foreign-offer-${year}-${team.id}-${candidate.id}`,
      type: "foreign",
      status: "open",
      teamId: team.id,
      teamName: team.name,
      candidateId: candidate.id,
      displayCode: candidate.displayCode,
      tier: candidate.tier,
      role: candidate.role,
      position: candidate.position,
      slotType: candidate.slotType,
      contractKRW,
      optionKRW: roundMarketMoney(contractKRW * 0.18),
      offerScore: candidate.scoutingGrade + (candidate.tier === 1 ? 10 : 0) + deterministicRange(year, team.id, candidate.id, -3, 3) - pressurePenalty,
      sourcePolicy: "코드형 후보 권리 계약"
    });
  }
  return offers;
}

function selectForeignCandidateForTeam(candidates, team, year, teamIndex) {
  const primaryNeed = draftNeedsForTeam(team)[0]?.key ?? "P";
  const preferredRole = primaryNeed === "P" ? "pitcher" : "hitter";
  return [...(candidates ?? [])]
    .map((candidate) => ({
      candidate,
      score: candidate.scoutingGrade + (candidate.role === preferredRole ? 9 : 0) - candidate.tier * 2 + deterministicRange(year, team.id, candidate.id, teamIndex, -4, 4)
    }))
    .sort((a, b) => b.score - a.score || a.candidate.tier - b.candidate.tier || compareText(a.candidate.displayCode, b.candidate.displayCode))[0]?.candidate ?? candidates[0];
}

function selectForeignOfferForTeam(market, teamId) {
  return [...(market?.foreignOffers ?? [])]
    .filter((offer) => offer.status === "open" && String(offer.teamId) === String(teamId))
    .sort((a, b) => b.offerScore - a.offerScore || a.tier - b.tier)[0] ?? null;
}

function foreignMarketProfile(role, position, tier) {
  if (role === "pitcher") {
    if (position === "SP") return tier <= 2 ? "선발 상위구속/스플리터형" : "이닝소화형 선발 후보";
    return tier <= 2 ? "하이레버리지 불펜 후보" : "멀티이닝 불펜 후보";
  }
  if (["CF", "RF", "OF"].includes(position)) return tier <= 2 ? "중심타선 외야 파워형" : "수비 겸비 외야 depth";
  return tier <= 2 ? "코너 내야 장타형" : "라인드라이브 코너 내야";
}

function foreignRiskLabel(tier, seed, salt) {
  const roll = deterministicRange(seed, salt, 0, 99);
  const adjusted = roll + tier * 7;
  if (adjusted >= 86) return "high";
  if (adjusted >= 58) return "medium";
  return "low";
}

function selectAgent(playerId, year) {
  const agents = ["에이전트 A", "에이전트 B", "에이전트 C", "에이전트 D"];
  return agents[hashParts(playerId, year, "agent") % agents.length];
}

function roundMarketMoney(value) {
  return Math.round(safeNumber(value) / MARKET_MONEY_UNIT_KRW) * MARKET_MONEY_UNIT_KRW;
}

function formatMoneyForLog(value) {
  const amount = safeNumber(value);
  if (amount >= 100_000_000) return `${roundNumber(amount / 100_000_000, amount >= 1_000_000_000 ? 0 : 1)}억`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000)}만`;
  return `${Math.round(amount)}원`;
}

export function commitTradeProposal(state, proposal) {
  if (!state) return { ok: false, code: "missing-state", message: "게임 상태가 없습니다." };
  normalizeState(state);

  const validation = validateTradeProposalForCommit(state, proposal);
  if (!validation.ok) {
    return validation;
  }

  const {
    buyerTeam,
    sellerTeam,
    incomingEntry,
    outgoingEntry,
    outgoingPlayerAsset,
    supplementalAssets,
    targetPlayerId,
    outgoingPlayerId
  } = validation;
  const incomingPlayer = incomingEntry.player;
  const outgoingPlayer = outgoingEntry.player;
  const tradeId = `trade-${state.currentDate}-${proposal.id ?? `${buyerTeam.id}-${sellerTeam.id}-${targetPlayerId}-${outgoingPlayerId}`}`;

  sellerTeam.roster.splice(incomingEntry.index, 1);
  buyerTeam.roster.splice(outgoingEntry.index, 1);
  transferPlayerToTeam(incomingPlayer, buyerTeam.id);
  transferPlayerToTeam(outgoingPlayer, sellerTeam.id);
  buyerTeam.roster.push(incomingPlayer);
  sellerTeam.roster.push(outgoingPlayer);

  const completedTrade = {
    id: tradeId,
    proposalId: proposal.id ?? "",
    type: supplementalAssets.length ? "player-plus-assets" : "player-for-player",
    status: "complete",
    date: state.currentDate,
    buyerTeamId: buyerTeam.id,
    buyerTeamName: buyerTeam.name,
    sellerTeamId: sellerTeam.id,
    sellerTeamName: sellerTeam.name,
    incoming: toTradeLedgerPlayer(incomingPlayer, sellerTeam, buyerTeam, proposal.target),
    outgoing: toTradeLedgerPlayer(outgoingPlayer, buyerTeam, sellerTeam, outgoingPlayerAsset),
    additionalAssets: supplementalAssets.map((asset) => toTradeLedgerAsset(asset, tradeId)),
    acceptanceScore: safeNumber(proposal.acceptanceScore),
    valueBalance: safeNumber(proposal.valueBalance),
    summary: `${buyerTeam.shortName ?? buyerTeam.name} acquire ${incomingPlayer.name}; ${sellerTeam.shortName ?? sellerTeam.name} acquire ${outgoingPlayer.name}`,
    source: "trade-proposal-v1"
  };

  state.trades = {
    ...(state.trades ?? {}),
    completed: [completedTrade, ...((state.trades?.completed ?? []))].slice(0, 60)
  };
  commitSupplementalTradeAssets(state, completedTrade);
  appendEvent(state, buildTradeCompletedEvent(completedTrade));
  addLog(state, `${state.currentDate} 트레이드 완료: ${buyerTeam.name} ${incomingPlayer.name} ↔ ${sellerTeam.name} ${outgoingPlayer.name}.`);
  rememberManagerAction(state, {
    type: "trade-complete",
    teamId: buyerTeam.id,
    subjectId: completedTrade.id,
    subject: incomingPlayer.name,
    headline: `${buyerTeam.shortName ?? buyerTeam.name} 트레이드 방향성`,
    summary: `${incomingPlayer.name} 영입과 ${outgoingPlayer.name} 이탈로 ${buyerTeam.shortName ?? buyerTeam.name}의 포지션 운용 서사가 바뀌었습니다.`,
    heat: 17,
    confidence: 76,
    tags: ["trade", "front-office", "roster"]
  });
  syncStateFoundation(state);

  return {
    ok: true,
    code: "committed",
    message: `${incomingPlayer.name} ↔ ${outgoingPlayer.name} 트레이드를 완료했어요.`,
    trade: completedTrade
  };
}

function buildGameInterventionForTeam(state, team) {
  const plan = state?.gameInterventions?.[team?.id];
  if (!plan || plan.mode !== "manual") return null;
  return {
    teamId: team.id,
    preset: plan.preset ?? "balanced",
    label: plan.label ?? GAME_INTERVENTION_PRESETS[plan.preset]?.label ?? "균형 운영",
    approach: plan.approach ?? "balanced",
    baserunning: plan.baserunning ?? "balanced",
    bullpenHook: plan.bullpenHook ?? "standard",
    pinchHit: plan.pinchHit ?? "standard",
    bunt: plan.bunt ?? "selective",
    updatedAt: plan.updatedAt ?? ""
  };
}

function applyPitchingIntervention(pitchingPlan, gamePlan) {
  if (!pitchingPlan || !gamePlan) return pitchingPlan;
  pitchingPlan.managerIntervention = gamePlan;
  if (gamePlan.bullpenHook === "early") {
    pitchingPlan.starterTargetOuts = Math.max(12, safeNumber(pitchingPlan.starterTargetOuts, 18) - 3);
    pitchingPlan.starterPitchLimit = Math.max(68, safeNumber(pitchingPlan.starterPitchLimit, 90) - 12);
  } else if (gamePlan.bullpenHook === "patient") {
    pitchingPlan.starterTargetOuts = Math.min(24, safeNumber(pitchingPlan.starterTargetOuts, 18) + 2);
    pitchingPlan.starterPitchLimit = Math.min(112, safeNumber(pitchingPlan.starterPitchLimit, 90) + 8);
  }
  return pitchingPlan;
}

function summarizeGameIntervention(plan) {
  if (!plan) return null;
  return {
    preset: plan.preset,
    label: plan.label,
    approach: plan.approach,
    baserunning: plan.baserunning,
    bullpenHook: plan.bullpenHook
  };
}

function recordGameInterventionOutcome(state, game, away, home, awayPlan, homePlan) {
  for (const [team, plan] of [[away, awayPlan], [home, homePlan]]) {
    if (!plan || String(team?.id ?? "") !== String(state.selectedTeamId ?? "")) continue;
    const diff = teamRunDiff(game, team.id);
    const resultText = diff > 0 ? "승리" : diff < 0 ? "패배" : "무승부";
    rememberManagerAction(state, {
      type: "game-intervention-result",
      teamId: team.id,
      subjectId: `${game.id}-${plan.preset}`,
      subject: plan.label,
      headline: `${plan.label} 플랜 ${resultText}`,
      summary: `${game.away} ${game.awayScore}-${game.homeScore} ${game.home}. ${plan.label} 전략의 타석 접근과 주루/불펜 운영이 경기 리포트에 기록됐습니다.`,
      heat: diff > 0 ? 12 : 9,
      confidence: 66,
      date: game.date,
      source: "경기 결과",
      tags: ["game-plan", "result", "manager"]
    });
  }
}

function simulateGame(state, matchup, gameIndex, weather, dateKey, options = {}) {
  const { away, home } = matchup;
  const awayLineup = buildLineup(away);
  const homeLineup = buildLineup(home);
  const awayPitchingPlan = buildPitchingPlan(away);
  const homePitchingPlan = buildPitchingPlan(home);
  const awayGamePlan = buildGameInterventionForTeam(state, away);
  const homeGamePlan = buildGameInterventionForTeam(state, home);
  applyPitchingIntervention(awayPitchingPlan, awayGamePlan);
  applyPitchingIntervention(homePitchingPlan, homeGamePlan);
  const seed = hashParts(state.day, dateKey, gameIndex, away.id, home.id, state.gamesPlayed, options.gameType ?? "regular", options.seriesId ?? "");
  const gameId = options.gameType === "postseason"
    ? makePostseasonGameId(dateKey, options, away.id, home.id)
    : makeGameId(dateKey, gameIndex, away.id, home.id, state.gamesPlayed);
  const gameEnvironment = buildGameEnvironment(weather, home);

  const awayOffense = simulateOffense({
    gameId,
    offense: away,
    defense: home,
    lineup: awayLineup,
    defenseLineup: homeLineup,
    pitchingPlan: homePitchingPlan,
    gamePlan: awayGamePlan,
    seed: seed + 11,
    weather: gameEnvironment,
    side: "away"
  });
  const homeOffense = simulateOffense({
    gameId,
    offense: home,
    defense: away,
    lineup: homeLineup,
    defenseLineup: awayLineup,
    pitchingPlan: awayPitchingPlan,
    gamePlan: homeGamePlan,
    seed: seed + 37,
    weather: gameEnvironment,
    side: "home"
  });
  let awayRuns = awayOffense.runs;
  let homeRuns = homeOffense.runs;
  const extraDecision = forcePostseasonDecision({
    away,
    home,
    awayOffense,
    homeOffense,
    awayRuns,
    homeRuns,
    seed,
    forceDecision: options.forceDecision
  });
  awayRuns = awayOffense.runs;
  homeRuns = homeOffense.runs;
  const totalRuns = awayRuns + homeRuns;
  const attendance = estimateAttendance(home, away, weather, totalRuns);
  const boxScore = buildBoxScore({
    away,
    home,
    awayPitchingPlan,
    homePitchingPlan,
    awayOffense,
    homeOffense
  });
  const plateAppearanceEvents = mergeGameEvents(awayOffense.plateAppearanceEvents, homeOffense.plateAppearanceEvents);
  const scoringEvents = mergeGameEvents(awayOffense.scoringEvents, homeOffense.scoringEvents).slice(0, KEY_EVENT_LIMIT);

  if (options.countInStandings !== false) {
    applyGameStats(home, away, homeRuns, awayRuns, attendance);
  }
  const pitcherDecisions = applyPitcherDecisions({
    awayRuns,
    homeRuns,
    awayLines: boxScore.pitching.away,
    homeLines: boxScore.pitching.home,
    awayPitchers: homeOffense.usedPitchers,
    homePitchers: awayOffense.usedPitchers
  });
  applyRosterUsage(away, awayLineup, { players: homeOffense.usedPitchers, lines: homeOffense.pitchingLines }, seed + 101, awayRuns >= homeRuns);
  applyRosterUsage(home, homeLineup, { players: awayOffense.usedPitchers, lines: awayOffense.pitchingLines }, seed + 211, homeRuns >= awayRuns);
  updateMorale(away, awayRuns, homeRuns);
  updateMorale(home, homeRuns, awayRuns);

  const result = {
    id: gameId,
    date: dateKey,
    weather: gameEnvironment.label,
    ballpark: gameEnvironment.ballpark,
    awayTeamId: away.id,
    homeTeamId: home.id,
    away: away.shortName ?? away.name,
    home: home.shortName ?? home.name,
    awayScore: awayRuns,
    homeScore: homeRuns,
    awayHits: awayOffense.hits,
    homeHits: homeOffense.hits,
    awayErrors: homeOffense.defenseErrors,
    homeErrors: awayOffense.defenseErrors,
    awayHomeRuns: awayOffense.homeRuns,
    homeHomeRuns: homeOffense.homeRuns,
    awayStarter: awayPitchingPlan.starter?.name ?? "",
    homeStarter: homePitchingPlan.starter?.name ?? "",
    awayPitchersUsed: homeOffense.pitchingLines.map((line) => line.name).filter(Boolean),
    homePitchersUsed: awayOffense.pitchingLines.map((line) => line.name).filter(Boolean),
    pitcherDecisions,
    gameType: options.gameType ?? "regular",
    postseason: options.gameType === "postseason" ? {
      seriesId: options.seriesId ?? "",
      seriesLabel: options.seriesLabel ?? "",
      round: options.round ?? "",
      gameNumber: safeNumber(options.gameNumber, gameIndex + 1)
    } : null,
    extraDecision,
    boxScore,
    managerPlans: {
      away: summarizeGameIntervention(awayGamePlan),
      home: summarizeGameIntervention(homeGamePlan)
    },
    plateAppearanceEvents,
    scoringEvents,
    totalRuns,
    attendance
  };

  appendEvent(state, buildGameFinalEvent(result));
  recordGameInterventionOutcome(state, result, away, home, awayGamePlan, homeGamePlan);
  return result;
}

function buildMatchups(teams, gameDayIndex) {
  const ordered = [...teams]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, KBO_TEAM_COUNT);
  const fixed = ordered[0];
  const rotating = ordered.slice(1);
  const round = gameDayIndex % (KBO_TEAM_COUNT - 1);
  const cycle = Math.floor(gameDayIndex / (KBO_TEAM_COUNT - 1));
  const spun = rotating.map((_, index) => rotating[(index + round) % rotating.length]);
  const row = [fixed, ...spun];
  const pairs = [];

  for (let i = 0; i < DAILY_GAME_COUNT; i += 1) {
    const first = row[i];
    const second = row[KBO_TEAM_COUNT - 1 - i];
    const flip = (round + cycle + i) % 2 === 0;
    pairs.push(flip ? { away: first, home: second } : { away: second, home: first });
  }

  return pairs;
}

function findMatchupForTeam(matchups, teamId) {
  const key = String(teamId ?? "");
  return (matchups ?? []).find((matchup) =>
    String(matchup?.away?.id ?? "") === key ||
    String(matchup?.home?.id ?? "") === key
  ) ?? null;
}

function createPostseasonSeries(definition, participantBySeed) {
  const participants = definition.participantSeeds.map((seed) => seed ? cloneParticipant(participantBySeed.get(seed)) : null);
  const wins = {};
  for (const participant of participants) {
    if (participant) wins[participant.teamId] = 0;
  }

  const higherSeed = higherSeedParticipant(participants);
  if (definition.higherSeedStartingWins && higherSeed) {
    wins[higherSeed.teamId] = definition.higherSeedStartingWins;
  }

  return {
    id: definition.id,
    round: definition.round,
    label: definition.label,
    name: definition.label,
    shortLabel: definition.shortLabel,
    order: definition.order,
    winsNeeded: definition.winsNeeded,
    maxGames: definition.maxGames,
    homePattern: definition.homePattern,
    higherSeedStartingWins: definition.higherSeedStartingWins,
    nextSeriesId: definition.nextSeriesId,
    status: participants.every(Boolean) ? "pending" : "waiting",
    participants,
    wins,
    games: [],
    winnerTeamId: null,
    winnerName: "",
    winnerSeed: null
  };
}

function nextPostseasonSeries(postseason) {
  return [...(postseason?.series ?? [])]
    .sort((a, b) => safeNumber(a.order) - safeNumber(b.order))
    .find((series) => series.status !== "complete") ?? null;
}

function hydratePostseasonSeries(postseason, series) {
  if (!series || series.participants.every(Boolean)) return;
  const previous = [...(postseason?.series ?? [])]
    .filter((candidate) => safeNumber(candidate.order) < safeNumber(series.order))
    .sort((a, b) => safeNumber(b.order) - safeNumber(a.order))[0];
  if (!previous?.winnerTeamId) return;

  const winner = findParticipant(postseason, previous.winnerTeamId);
  if (!winner) return;

  const emptyIndex = series.participants.findIndex((participant) => !participant);
  if (emptyIndex >= 0) {
    series.participants[emptyIndex] = cloneParticipant(winner);
    series.wins[winner.teamId] = series.wins[winner.teamId] ?? 0;
  }
  if (series.participants.every(Boolean) && series.status === "waiting") {
    series.status = "pending";
  }
}

function startPostseasonSeries(state, series) {
  const higherSeed = higherSeedParticipant(series.participants);
  if (series.higherSeedStartingWins && higherSeed && safeNumber(series.wins[higherSeed.teamId]) === 0) {
    series.wins[higherSeed.teamId] = series.higherSeedStartingWins;
  }
  series.status = "active";
  addLog(state, `${state.currentDate} ${series.label} 시작: ${series.participants.map((entry) => `${entry.seed}위 ${entry.shortName}`).join(" vs ")}.`);
}

function simulatePostseasonGame(state, series) {
  const date = parseDate(state.currentDate);
  const dateKey = formatDateKey(date);
  const weather = buildWeather(state, date);
  const gameNumber = series.games.length + 1;
  const homeParticipant = choosePostseasonHome(series, gameNumber);
  const awayParticipant = series.participants.find((participant) => participant.teamId !== homeParticipant.teamId) ?? series.participants[0];
  const home = findTeamById(state, homeParticipant.teamId);
  const away = findTeamById(state, awayParticipant.teamId);

  state.weather = weather;
  recoverRoster(state.teams);

  const game = simulateGame(state, { away, home }, gameNumber - 1, weather, dateKey, {
    gameType: "postseason",
    forceDecision: true,
    countInStandings: false,
    seriesId: series.id,
    seriesLabel: series.label,
    round: series.round,
    gameNumber
  });
  const winnerTeamId = game.awayScore > game.homeScore ? away.id : home.id;
  const winner = series.participants.find((participant) => participant.teamId === winnerTeamId);
  series.wins[winnerTeamId] = safeNumber(series.wins[winnerTeamId]) + 1;
  const winsAfter = { ...series.wins };

  game.postseason = {
    ...(game.postseason ?? {}),
    winnerTeamId,
    winnerName: winner?.name ?? "",
    winsAfter
  };
  series.games.push(summarizePostseasonGame(game, winnerTeamId, winsAfter));
  state.postseason.gamesPlayed = safeNumber(state.postseason.gamesPlayed) + 1;
  state.lastGames = [game, ...(state.lastGames ?? [])].slice(0, RECENT_LIMIT);

  addLog(state, `${dateKey} ${series.label} ${gameNumber}차전: ${game.away} ${game.awayScore}-${game.homeScore} ${game.home}.`);

  if (safeNumber(series.wins[winnerTeamId]) >= series.winsNeeded) {
    finishPostseasonSeries(state, series, winner);
  }

  tickInjuries(state.teams);
  advanceDate(state, date);
}

function finishPostseasonSeries(state, series, winner) {
  series.status = "complete";
  series.winnerTeamId = winner?.teamId ?? null;
  series.winnerName = winner?.name ?? "";
  series.winnerSeed = winner?.seed ?? null;
  addLog(state, `${state.currentDate} ${series.label} 종료: ${series.winnerName} 다음 라운드 진출.`);

  if (series.nextSeriesId) {
    const nextSeries = state.postseason.series.find((entry) => entry.id === series.nextSeriesId);
    if (nextSeries) {
      const emptyIndex = nextSeries.participants.findIndex((participant) => !participant);
      if (emptyIndex >= 0) {
        nextSeries.participants[emptyIndex] = cloneParticipant(winner);
        nextSeries.wins[winner.teamId] = nextSeries.wins[winner.teamId] ?? 0;
        if (nextSeries.participants.every(Boolean)) nextSeries.status = "pending";
      }
    }
    return;
  }

  state.postseason.status = "complete";
  state.postseason.championTeamId = winner?.teamId ?? null;
  state.postseason.championName = winner?.name ?? "";
  state.postseason.championSeed = winner?.seed ?? null;
  state.awards = enrichPostseasonAwards(state, state.awards, winner?.teamId);
  addLog(state, `${state.currentDate} 한국시리즈 우승: ${state.postseason.championName}. 시상식 결과가 발표되었습니다.`);
}

function choosePostseasonHome(series, gameNumber) {
  const higher = higherSeedParticipant(series.participants);
  const lower = series.participants.find((participant) => participant.teamId !== higher?.teamId) ?? higher;
  const slot = series.homePattern[Math.min(gameNumber - 1, series.homePattern.length - 1)] ?? "higher";
  return slot === "lower" ? lower : higher;
}

function summarizePostseasonGame(game, winnerTeamId, winsAfter) {
  return {
    id: game.id,
    date: game.date,
    gameNumber: game.postseason?.gameNumber ?? 0,
    awayTeamId: game.awayTeamId,
    homeTeamId: game.homeTeamId,
    away: game.away,
    home: game.home,
    awayScore: game.awayScore,
    homeScore: game.homeScore,
    winnerTeamId,
    extraDecision: game.extraDecision,
    winsAfter
  };
}

function forcePostseasonDecision({ away, home, awayOffense, homeOffense, awayRuns, homeRuns, seed, forceDecision }) {
  if (!forceDecision || awayRuns !== homeRuns) return null;

  const awayStrength = teamPlayoffStrength(away);
  const homeStrength = teamPlayoffStrength(home) + 1.8;
  const roll = deterministicRange(seed, "postseason-tiebreak", -12, 12);
  const winnerSide = awayStrength + roll > homeStrength ? "away" : "home";
  const offense = winnerSide === "away" ? awayOffense : homeOffense;
  offense.runs += 1;
  while (offense.runsByInning.length < 10) offense.runsByInning.push(0);
  offense.runsByInning[9] += 1;

  return {
    inning: 10,
    winnerSide,
    label: "연장 승부"
  };
}

function buildAwardCeremony(state, standings) {
  const players = allPlayerEntries(state);
  const mvp = awardPlayerView(bestByScore(players, ({ player, team }) => playerAwardScore(player, team, "mvp")), "정규시즌 MVP");
  const rookiePool = players.filter(({ player }) => isRookieCandidate(player));
  const rookieOfYear = awardPlayerView(bestByScore(rookiePool.length ? rookiePool : players, ({ player, team }) => playerAwardScore(player, team, "rookie")), "신인왕");
  const goldenGloves = selectGoldenGloves(players);

  return {
    status: "announced",
    generatedDate: state.currentDate,
    basis: "정규시즌 누적 기록",
    standingsSnapshot: standings.slice(0, 5).map((team, index) => ({
      seed: index + 1,
      teamId: team.id,
      name: team.name,
      wins: safeNumber(team.wins),
      losses: safeNumber(team.losses),
      ties: safeNumber(team.ties)
    })),
    regularSeason: {
      mvp,
      rookieOfYear,
      goldenGloves
    },
    postseason: {
      koreanSeriesMvp: null
    }
  };
}

function enrichPostseasonAwards(state, awards, championTeamId) {
  const baseAwards = awards ?? buildAwardCeremony(state, getStandings(state));
  const championPlayers = allPlayerEntries(state).filter(({ team }) => String(team.id) === String(championTeamId));
  return {
    ...baseAwards,
    status: "complete",
    completedDate: state.currentDate,
    postseason: {
      ...(baseAwards.postseason ?? {}),
      koreanSeriesMvp: awardPlayerView(bestByScore(championPlayers, ({ player, team }) => playerAwardScore(player, team, "mvp")), "한국시리즈 MVP")
    }
  };
}

function selectGoldenGloves(players) {
  const slots = [
    { label: "투수", count: 1, filter: ({ player }) => player.role === "pitcher" },
    { label: "포수", count: 1, filter: ({ player }) => player.position === "C" },
    { label: "내야수", count: 4, filter: ({ player }) => player.role === "hitter" && ["IF", "1B", "2B", "3B", "SS"].includes(player.position) },
    { label: "외야수", count: 3, filter: ({ player }) => player.role === "hitter" && ["OF", "LF", "CF", "RF"].includes(player.position) },
    { label: "지명타자", count: 1, filter: ({ player }) => player.role === "hitter" }
  ];
  const selectedIds = new Set();
  const winners = [];

  for (const slot of slots) {
    const candidates = players
      .filter((entry) => !selectedIds.has(entry.player.id) && slot.filter(entry))
      .sort((a, b) => playerAwardScore(b.player, b.team, "goldenGlove") - playerAwardScore(a.player, a.team, "goldenGlove"));

    for (const entry of candidates.slice(0, slot.count)) {
      selectedIds.add(entry.player.id);
      winners.push(awardPlayerView(entry, winners.filter((winner) => winner.slotLabel.startsWith(slot.label)).length ? `${slot.label} ${winners.filter((winner) => winner.slotLabel.startsWith(slot.label)).length + 1}` : slot.label));
    }
  }

  return winners;
}

function toPostseasonParticipant(team, seed) {
  return {
    seed,
    teamId: team?.id ?? "",
    name: team?.name ?? "",
    shortName: team?.shortName ?? team?.name ?? "",
    wins: safeNumber(team?.wins),
    losses: safeNumber(team?.losses),
    ties: safeNumber(team?.ties),
    pct: winningPct(team),
    runDiff: safeNumber(team?.runsFor) - safeNumber(team?.runsAgainst)
  };
}

function cloneParticipant(participant) {
  return participant ? { ...participant } : null;
}

function higherSeedParticipant(participants) {
  return [...(participants ?? [])]
    .filter(Boolean)
    .sort((a, b) => safeNumber(a.seed, 99) - safeNumber(b.seed, 99))[0] ?? null;
}

function findParticipant(postseason, teamId) {
  const key = String(teamId ?? "");
  for (const seed of postseason?.seeds ?? []) {
    if (String(seed.teamId) === key) return seed;
  }
  for (const series of postseason?.series ?? []) {
    const match = (series.participants ?? []).find((participant) => String(participant?.teamId) === key);
    if (match) return match;
  }
  return null;
}

function findTeamById(state, teamId) {
  return state?.teams?.find((team) => String(team.id) === String(teamId)) ?? null;
}

function findGameForTeam(games, teamId) {
  const key = String(teamId ?? "");
  if (!key) return null;
  return (games ?? []).find((game) => String(game.awayTeamId) === key || String(game.homeTeamId) === key) ?? null;
}

function buildMonthlyResultMap(state, teamId) {
  const key = String(teamId ?? "");
  const resultMap = new Map();
  if (!key) return resultMap;
  for (const game of state?.lastGames ?? []) {
    if (String(game?.awayTeamId ?? "") !== key && String(game?.homeTeamId ?? "") !== key) continue;
    const userIsHome = String(game.homeTeamId ?? "") === key;
    const teamScore = userIsHome ? safeNumber(game.homeScore ?? game.homeRuns) : safeNumber(game.awayScore ?? game.awayRuns);
    const opponentScore = userIsHome ? safeNumber(game.awayScore ?? game.awayRuns) : safeNumber(game.homeScore ?? game.homeRuns);
    const opponentTeamId = userIsHome ? game.awayTeamId : game.homeTeamId;
    const opponentTeam = findTeamById(state, opponentTeamId);
    resultMap.set(game.date, {
      status: "played",
      game: {
        date: game.date,
        awayTeamId: game.awayTeamId ?? "",
        homeTeamId: game.homeTeamId ?? "",
        opponentTeamId,
        opponentName: opponentTeam?.name ?? (userIsHome ? game.away : game.home) ?? "",
        opponentShortName: opponentTeam?.shortName ?? (userIsHome ? game.away : game.home) ?? "",
        isHome: userIsHome,
        ballpark: game.ballpark?.name ?? game.ballpark ?? "",
        startTime: game.startTime ?? defaultKboStartTime(parseDate(game.date)),
        teamScore,
        opponentScore
      },
      result: {
        code: teamScore > opponentScore ? "W" : teamScore < opponentScore ? "L" : "T",
        teamScore,
        opponentScore
      }
    });
  }
  return resultMap;
}

function buildMonthlyFutureScheduleMap(state, teamId, firstDate, lastDate) {
  const scheduleMap = new Map();
  if (!state || ["complete", "postseason", "offseason"].includes(state.phase)) return scheduleMap;
  const teams = Array.isArray(state.teams) ? state.teams : [];
  if (teams.length < KBO_TEAM_COUNT) return scheduleMap;

  let phase = state.phase || "preseason";
  let gamesPlayed = Math.max(0, Math.floor(safeNumber(state.gamesPlayed)));
  let cursor = parseDate(state.currentDate);
  const targetStart = cursor.getTime() > firstDate.getTime() ? cursor : new Date(firstDate.getTime());

  while (cursor.getTime() < targetStart.getTime()) {
    const projection = projectScheduleDay(state, { date: cursor, phase, gamesPlayed, teams, teamId, emit: false });
    phase = projection.phase;
    gamesPlayed = projection.gamesPlayed;
    cursor = projection.nextDate;
  }

  while (cursor.getTime() <= lastDate.getTime()) {
    const projection = projectScheduleDay(state, { date: cursor, phase, gamesPlayed, teams, teamId, emit: true });
    if (projection.entry) {
      scheduleMap.set(projection.entry.date, projection.entry);
    }
    phase = projection.phase;
    gamesPlayed = projection.gamesPlayed;
    cursor = projection.nextDate;
  }

  return scheduleMap;
}

function projectScheduleDay(state, { date, phase, gamesPlayed, teams, teamId, emit }) {
  const dateKey = formatDateKey(date);
  const nextDate = new Date(date.getTime() + MS_PER_DAY);
  if (phase === "preseason") {
    const nextPhase = formatDateKey(nextDate) >= openingDayForDateKey(formatDateKey(nextDate)) ? "regular" : "preseason";
    return {
      phase: nextPhase,
      gamesPlayed,
      nextDate,
      entry: emit ? { date: dateKey, status: "preseason" } : null
    };
  }

  if (gamesPlayed >= REGULAR_SEASON_GAMES) {
    return {
      phase,
      gamesPlayed,
      nextDate,
      entry: emit ? { date: dateKey, status: "season-complete" } : null
    };
  }

  if (date.getUTCDay() === 1) {
    return {
      phase,
      gamesPlayed,
      nextDate,
      entry: emit ? { date: dateKey, status: "rest" } : null
    };
  }

  const matchups = buildMatchups(teams, Math.floor(gamesPlayed / DAILY_GAME_COUNT));
  const gamesToPlay = Math.min(matchups.length, REGULAR_SEASON_GAMES - gamesPlayed);
  const playable = matchups.slice(0, gamesToPlay);
  const matchup = findMatchupForTeam(playable, teamId);
  return {
    phase,
    gamesPlayed: gamesPlayed + gamesToPlay,
    nextDate,
    entry: emit && matchup
      ? {
          date: dateKey,
          status: "scheduled",
          game: buildScheduleGameFromMatchup(matchup, date, teamId)
        }
      : emit
        ? { date: dateKey, status: "empty" }
        : null
  };
}

function buildScheduleGameFromMatchup(matchup, date, teamId) {
  const dateKey = formatDateKey(date);
  const userIsHome = String(matchup.home?.id ?? "") === String(teamId ?? "");
  const opponent = userIsHome ? matchup.away : matchup.home;
  return {
    date: dateKey,
    awayTeamId: matchup.away?.id ?? "",
    homeTeamId: matchup.home?.id ?? "",
    opponentTeamId: opponent?.id ?? "",
    opponentName: opponent?.name ?? "",
    opponentShortName: opponent?.shortName ?? opponent?.name ?? "",
    isHome: userIsHome,
    ballpark: matchup.home?.home ?? "",
    startTime: defaultKboStartTime(date)
  };
}

function defaultKboStartTime(date) {
  const weekday = date.getUTCDay();
  if (weekday === 0) return "14:00 KST";
  if (weekday === 6) return "17:00 KST";
  return "18:30 KST";
}

function makePostseasonGameId(dateKey, options, awayTeamId, homeTeamId) {
  return `${dateKey}-ps-${options.seriesId ?? "series"}-${safeNumber(options.gameNumber, 1)}-${awayTeamId}-${homeTeamId}`;
}

function teamPlayoffStrength(team) {
  const lineup = buildLineup(team);
  const pitching = buildPitchingSnapshot(team);
  const lineupScore = lineup.length ? averageNumbers(...lineup.map(hitterScore)) : 0;
  const starterScoreValue = pitching.nextStarter ? starterScore(findPlayerById(team, pitching.nextStarter.id)) : 0;
  const bullpenScoreValue = pitching.bullpen.length
    ? averageNumbers(...pitching.bullpen.map((entry) => bullpenScore(findPlayerById(team, entry.id))))
    : 0;
  return lineupScore * 0.52 + starterScoreValue * 0.3 + bullpenScoreValue * 0.18 + clubMood(team) * 10;
}

function findPlayerById(team, playerId) {
  return team?.roster?.find((player) => String(player.id) === String(playerId)) ?? null;
}

function allPlayerEntries(state) {
  return (state?.teams ?? []).flatMap((team) => (team.roster ?? []).map((player) => ({ team, player })));
}

function validateTradeProposalForCommit(state, proposal) {
  if (!proposal || typeof proposal !== "object") {
    return { ok: false, code: "missing-proposal", message: "실행할 트레이드 제안이 없습니다." };
  }
  if (state.trades?.completed?.some((trade) => trade.proposalId && trade.proposalId === proposal.id)) {
    return { ok: false, code: "already-committed", message: "이미 실행된 트레이드 제안입니다." };
  }
  if (proposal.status !== "viable") {
    return { ok: false, code: "not-viable", message: "AI 수락 가능 상태가 아니라 아직 실행할 수 없습니다." };
  }
  if (proposal.commandApproval?.confirmed !== true || proposal.commandApproval?.proposalId !== proposal.id) {
    return {
      ok: false,
      code: "needs-confirmation",
      message: "트레이드는 검토 잠금 후 한 번 더 확정해야 실행됩니다."
    };
  }
  const outgoingPlayerAssets = (proposal.outgoing ?? []).filter((asset) => asset.assetType === "player" && asset.player);
  const supplementalAssets = (proposal.outgoing ?? []).filter((asset) => asset.assetType !== "player");
  if (outgoingPlayerAssets.length !== 1) {
    return { ok: false, code: "not-one-player", message: "v2는 선수 1명과 보조 자산 패키지만 실행합니다." };
  }

  const targetPlayerId = proposal.target?.player?.id ?? proposal.target?.player?.playerId;
  const outgoingPlayerAsset = outgoingPlayerAssets[0];
  const outgoingPlayerId = outgoingPlayerAsset.player?.id ?? outgoingPlayerAsset.player?.playerId;
  if (
    (proposal.commandApproval.targetPlayerId && String(proposal.commandApproval.targetPlayerId) !== String(targetPlayerId)) ||
    (proposal.commandApproval.outgoingPlayerId && String(proposal.commandApproval.outgoingPlayerId) !== String(outgoingPlayerId))
  ) {
    return { ok: false, code: "approval-mismatch", message: "트레이드 승인 토큰의 선수 정보가 현재 제안과 일치하지 않습니다." };
  }
  const sellerTeamId = proposal.target?.teamId ?? proposal.target?.player?.teamId;
  const buyerTeamId = outgoingPlayerAsset.player?.teamId;
  const buyerTeam = findTeamById(state, buyerTeamId);
  const sellerTeam = findTeamById(state, sellerTeamId);
  const incomingEntry = findPlayerEntry(state, targetPlayerId, sellerTeamId);
  const outgoingEntry = findPlayerEntry(state, outgoingPlayerId, buyerTeamId);

  if (!buyerTeam || !sellerTeam) {
    return { ok: false, code: "team-not-found", message: "트레이드 대상 구단을 찾을 수 없습니다." };
  }
  if (String(buyerTeam.id) === String(sellerTeam.id)) {
    return { ok: false, code: "same-team", message: "같은 구단끼리는 트레이드를 실행할 수 없습니다." };
  }
  if (!incomingEntry || !outgoingEntry) {
    return { ok: false, code: "player-not-found", message: "트레이드 대상 선수가 현재 로스터에 없습니다." };
  }
  const incomingUnavailable = tradePlayerUnavailableReason(incomingEntry.player);
  const outgoingUnavailable = tradePlayerUnavailableReason(outgoingEntry.player);
  if (incomingUnavailable || outgoingUnavailable) {
    return {
      ok: false,
      code: "player-unavailable",
      message: `트레이드 불가 선수 상태입니다: ${incomingUnavailable || outgoingUnavailable}`
    };
  }
  const assetValidation = validateSupplementalTradeAssetsForCommit(state, supplementalAssets, buyerTeam, sellerTeam);
  if (!assetValidation.ok) {
    return assetValidation;
  }
  const gate = evaluateTradeCommitGate({ proposal, incomingEntry, outgoingEntry, supplementalAssets });
  if (!gate.ok) {
    return {
      ok: false,
      code: "gate-blocked",
      message: `트레이드 검토 기준을 통과하지 못했습니다: ${gate.blockers.slice(0, 3).join(", ")}`,
      blockers: gate.blockers,
      metrics: gate.metrics
    };
  }

  return {
    ok: true,
    buyerTeam,
    sellerTeam,
    incomingEntry,
    outgoingEntry,
    outgoingPlayerAsset,
    supplementalAssets,
    targetPlayerId,
    outgoingPlayerId
  };
}

function validateSupplementalTradeAssetsForCommit(state, assets, buyerTeam, sellerTeam) {
  const allowedTypes = new Set(["cash", "draftPick", "conditional", "ptbnl"]);
  const seenIds = new Set();
  for (const asset of assets ?? []) {
    const type = asset?.assetType ?? "";
    if (!allowedTypes.has(type)) {
      return { ok: false, code: "invalid-asset", message: `알 수 없는 보조 자산입니다: ${type || "unknown"}` };
    }
    if (!asset.id || seenIds.has(asset.id)) {
      return { ok: false, code: "duplicate-asset", message: "보조 자산 id가 비어 있거나 중복되었습니다." };
    }
    seenIds.add(asset.id);
    if (String(asset.fromTeamId ?? "") !== String(buyerTeam.id) || String(asset.toTeamId ?? "") !== String(sellerTeam.id)) {
      return { ok: false, code: "asset-route", message: "보조 자산의 이동 방향이 트레이드 구단과 일치하지 않습니다." };
    }
    if (safeNumber(asset.valueScore) <= 0) {
      return { ok: false, code: "asset-value", message: "보조 자산 가치가 0 이하입니다." };
    }
    if (type === "cash" && safeNumber(asset.amountKRW) <= 0) {
      return { ok: false, code: "cash-value", message: "현금 자산 금액이 0 이하입니다." };
    }
    if (type === "draftPick") {
      const alreadyMoved = (state.tradeAssets?.draftPickLedger ?? []).some((entry) => entry.id === asset.id || (entry.year === asset.year && entry.round === asset.round && entry.originalTeamId === asset.fromTeamId));
      if (alreadyMoved) {
        return { ok: false, code: "draft-pick-used", message: "이미 이동한 지명권 자산입니다." };
      }
    }
  }
  return { ok: true };
}

function tradePlayerUnavailableReason(player) {
  if (!player) return "missing-player";
  if (["filed", "market", "signed"].includes(player?.faStatus?.status)) return "fa-market-player";
  if (player?.militaryStatus?.availability === "unavailable") return "military-unavailable";
  if (["released", "unavailable", "negotiating"].includes(player?.foreignPlayer?.registrationStatus)) return "foreign-status-unavailable";
  if (player?.contract?.status && !["active", "reserved"].includes(player.contract.status)) return "contract-inactive";
  if (player?.status === "candidate") return "source-candidate";
  return "";
}

function evaluateTradeCommitGate({ proposal, incomingEntry, outgoingEntry, supplementalAssets }) {
  const incomingPlayer = incomingEntry?.player ?? {};
  const outgoingPlayer = outgoingEntry?.player ?? {};
  const incomingValue = Math.max(
    tradeCommitPlayerValue(incomingPlayer),
    safeNumber(proposal?.incomingValue),
    safeNumber(proposal?.target?.valueScore),
    safeNumber(proposal?.target?.player?.gameValue)
  );
  const outgoingPlayerValue = Math.max(
    tradeCommitPlayerValue(outgoingPlayer),
    safeNumber(proposal?.outgoingPlayers?.[0]?.valueScore),
    safeNumber(proposal?.outgoing?.find((asset) => asset.assetType === "player")?.valueScore)
  );
  const supplementalValue = sum(supplementalAssets ?? [], "valueScore");
  const outgoingValue = outgoingPlayerValue + supplementalValue;
  const valueBalance = roundNumber(outgoingValue - incomingValue, 2);
  const playerValueRatio = incomingValue > 0 ? outgoingPlayerValue / incomingValue : 0;
  const supplementalRatio = incomingValue > 0 ? supplementalValue / incomingValue : 0;
  const acceptanceScore = safeNumber(proposal?.acceptanceScore);
  const targetOvr = safeNumber(incomingPlayer.ovr);
  const targetPot = safeNumber(incomingPlayer.pot, targetOvr);
  const outgoingOvr = safeNumber(outgoingPlayer.ovr);
  const outgoingPot = safeNumber(outgoingPlayer.pot, outgoingOvr);
  const ovrGap = targetOvr - outgoingOvr;
  const potGap = targetPot - outgoingPot;
  const isEliteTarget = targetOvr >= TRADE_COMMIT_ELITE_OVR || (targetPot >= TRADE_COMMIT_ELITE_POT && targetOvr >= 135);
  const blockers = [];

  if (acceptanceScore < TRADE_COMMIT_MIN_ACCEPTANCE) blockers.push(`AI 수락 ${TRADE_COMMIT_MIN_ACCEPTANCE}% 미만`);
  if (valueBalance < TRADE_COMMIT_MAX_DEFICIT) blockers.push("가치 균형이 너무 불리함");
  if (valueBalance > TRADE_COMMIT_MAX_OVERPAY) blockers.push("과지불 폭이 너무 큼");
  if (playerValueRatio < TRADE_COMMIT_MIN_PLAYER_VALUE_RATIO) blockers.push("맞상대 선수 가치가 부족함");
  if (supplementalRatio > TRADE_COMMIT_MAX_SUPPLEMENTAL_RATIO) blockers.push("보조 자산 비중이 너무 큼");
  if (ovrGap > TRADE_COMMIT_MAX_OVR_GAP) blockers.push("OVR 격차가 너무 큼");
  if (potGap > 34) blockers.push("POT 격차가 너무 큼");
  if (proposal?.executionGate && proposal.executionGate.commandReady !== true) blockers.push("프런트 실행 게이트 미통과");

  if (isEliteTarget) {
    if (acceptanceScore < TRADE_COMMIT_MIN_ELITE_ACCEPTANCE) blockers.push(`S급 선수 AI 수락 ${TRADE_COMMIT_MIN_ELITE_ACCEPTANCE}% 미만`);
    if (playerValueRatio < TRADE_COMMIT_MIN_ELITE_PLAYER_VALUE_RATIO) blockers.push("S급 선수 맞상대 가치 부족");
    if (ovrGap > TRADE_COMMIT_MAX_ELITE_OVR_GAP) blockers.push("S급 선수 OVR 격차 과다");
  }

  return {
    ok: blockers.length === 0,
    blockers,
    metrics: {
      incomingValue: roundNumber(incomingValue, 2),
      outgoingValue: roundNumber(outgoingValue, 2),
      valueBalance,
      outgoingPlayerValue: roundNumber(outgoingPlayerValue, 2),
      supplementalValue: roundNumber(supplementalValue, 2),
      playerValueRatio: roundNumber(playerValueRatio, 2),
      supplementalRatio: roundNumber(supplementalRatio, 2),
      acceptanceScore,
      targetOvr,
      outgoingOvr,
      ovrGap,
      potGap,
      isEliteTarget
    }
  };
}

function tradeCommitPlayerValue(player) {
  const ovr = safeNumber(player?.ovr);
  const pot = Math.max(safeNumber(player?.pot, ovr), ovr);
  const upside = Math.max(0, pot - ovr);
  const age = safeNumber(player?.age, 29);
  const youth = Math.max(0, 28 - age);
  const durabilityPenalty = safeNumber(player?.injuredDays) * 1.4 + Math.max(0, safeNumber(player?.fatigue) - 55) * 0.12;
  return Math.max(
    0,
    rating100(ovr) * 0.95 +
      rating100(pot) * 0.42 +
      rating100(upside) * 1.7 +
      youth * 0.85 +
      safeNumber(player?.form, 50) * 0.08 -
      durabilityPenalty
  );
}

function findPlayerEntry(state, playerId, teamId = null) {
  const playerKey = String(playerId ?? "");
  if (!playerKey) return null;
  for (const team of state?.teams ?? []) {
    if (teamId != null && String(team.id) !== String(teamId)) continue;
    const index = (team.roster ?? []).findIndex((player) => String(player.id) === playerKey || String(player.playerId) === playerKey);
    if (index >= 0) {
      return { team, player: team.roster[index], index };
    }
  }
  return null;
}

function transferPlayerToTeam(player, teamId) {
  if (!player) return;
  player.teamId = teamId;
  if (player.contract && typeof player.contract === "object") {
    player.contract.teamId = teamId;
  }
  if (player.faStatus && typeof player.faStatus === "object") {
    player.faStatus.qualifyingTeamId = teamId;
  }
  if (player.militaryStatus && typeof player.militaryStatus === "object") {
    player.militaryStatus.holdTeamId = teamId;
  }
  if (player.foreignPlayer && typeof player.foreignPlayer === "object" && player.foreignPlayer.isForeign) {
    player.foreignPlayer.foreignRightsTeamId = teamId;
  }
}

function toTradeLedgerPlayer(player, fromTeam, toTeam, asset = {}) {
  return {
    playerId: player?.id ?? asset?.player?.id ?? "",
    name: player?.name ?? asset?.player?.name ?? "",
    role: player?.role ?? asset?.player?.role ?? "",
    position: player?.position ?? asset?.player?.position ?? "",
    age: safeNumber(player?.age ?? asset?.player?.age),
    ovr: safeNumber(player?.ovr ?? asset?.player?.ovr),
    pot: safeNumber(player?.pot ?? asset?.player?.pot),
    fromTeamId: fromTeam?.id ?? "",
    fromTeamName: fromTeam?.name ?? "",
    toTeamId: toTeam?.id ?? "",
    toTeamName: toTeam?.name ?? "",
    valueScore: safeNumber(asset?.valueScore ?? asset?.player?.gameValue)
  };
}

function toTradeLedgerAsset(asset, tradeId) {
  return {
    id: asset?.id ?? `${tradeId}-${asset?.assetType ?? "asset"}`,
    tradeId,
    assetType: asset?.assetType ?? "asset",
    fromTeamId: asset?.fromTeamId ?? "",
    fromTeamName: asset?.fromTeamName ?? "",
    toTeamId: asset?.toTeamId ?? "",
    toTeamName: asset?.toTeamName ?? "",
    valueScore: safeNumber(asset?.valueScore),
    amountKRW: safeNumber(asset?.amountKRW),
    year: safeNumber(asset?.year),
    round: safeNumber(asset?.round),
    pickLabel: asset?.pickLabel ?? "",
    protection: asset?.protection ?? "",
    condition: asset?.condition ?? "",
    convertsTo: asset?.convertsTo ?? "",
    deadline: asset?.deadline ?? "",
    pool: asset?.pool ?? "",
    reason: asset?.reason ?? ""
  };
}

function commitSupplementalTradeAssets(state, trade) {
  const assets = trade.additionalAssets ?? [];
  state.tradeAssets = {
    cashLedger: Array.isArray(state.tradeAssets?.cashLedger) ? state.tradeAssets.cashLedger : [],
    draftPickLedger: Array.isArray(state.tradeAssets?.draftPickLedger) ? state.tradeAssets.draftPickLedger : [],
    conditionalAssets: Array.isArray(state.tradeAssets?.conditionalAssets) ? state.tradeAssets.conditionalAssets : [],
    ptbnlSlots: Array.isArray(state.tradeAssets?.ptbnlSlots) ? state.tradeAssets.ptbnlSlots : []
  };

  for (const asset of assets) {
    if (asset.assetType === "cash") {
      state.tradeAssets.cashLedger.unshift({
        id: asset.id,
        tradeId: trade.id,
        date: trade.date,
        fromTeamId: asset.fromTeamId,
        toTeamId: asset.toTeamId,
        amountKRW: asset.amountKRW,
        status: "booked"
      });
      appendFinanceLedger(state, {
        id: `finance-${trade.id}-${asset.id}-expense`,
        date: trade.date,
        category: "trade-cash",
        type: "expense",
        teamId: asset.fromTeamId,
        counterpartyTeamId: asset.toTeamId,
        amountKRW: asset.amountKRW,
        description: `${trade.summary} 현금 지급`,
        sourceEventId: trade.id
      });
      appendFinanceLedger(state, {
        id: `finance-${trade.id}-${asset.id}-income`,
        date: trade.date,
        category: "trade-cash",
        type: "income",
        teamId: asset.toTeamId,
        counterpartyTeamId: asset.fromTeamId,
        amountKRW: asset.amountKRW,
        description: `${trade.summary} 현금 수취`,
        sourceEventId: trade.id
      });
    } else if (asset.assetType === "draftPick") {
      state.tradeAssets.draftPickLedger.unshift({
        id: asset.id,
        tradeId: trade.id,
        date: trade.date,
        year: asset.year,
        round: asset.round,
        originalTeamId: asset.fromTeamId,
        fromTeamId: asset.fromTeamId,
        toTeamId: asset.toTeamId,
        protection: asset.protection,
        status: "transferred"
      });
    } else if (asset.assetType === "conditional") {
      state.tradeAssets.conditionalAssets.unshift({
        id: asset.id,
        tradeId: trade.id,
        date: trade.date,
        fromTeamId: asset.fromTeamId,
        toTeamId: asset.toTeamId,
        condition: asset.condition,
        convertsTo: asset.convertsTo,
        deadline: asset.deadline,
        status: "pending"
      });
    } else if (asset.assetType === "ptbnl") {
      state.tradeAssets.ptbnlSlots.unshift({
        id: asset.id,
        tradeId: trade.id,
        date: trade.date,
        fromTeamId: asset.fromTeamId,
        toTeamId: asset.toTeamId,
        pool: asset.pool,
        deadline: asset.deadline,
        status: "pending"
      });
    }
  }
}

function bestByScore(entries, scorer) {
  return [...(entries ?? [])]
    .map((entry, index) => ({ entry, index, score: scorer(entry) }))
    .sort((a, b) => b.score - a.score || safeNumber(b.entry.player?.ovr) - safeNumber(a.entry.player?.ovr) || a.index - b.index)[0]?.entry ?? null;
}

function playerAwardScore(player, team, awardType) {
  const batting = player?.seasonStats?.batting ?? {};
  const pitching = player?.seasonStats?.pitching ?? {};
  const teamBonus = winningPct(team) * 28 + Math.max(-12, Math.min(12, (safeNumber(team?.runsFor) - safeNumber(team?.runsAgainst)) / 22));
  const ovrBonus = safeNumber(player?.ovr) * 0.06;

  if (player?.role === "pitcher") {
    const innings = safeNumber(pitching.inningsOuts) / 3;
    const runPenalty = pitching.inningsOuts > 0 ? safeNumber(pitching.earnedRuns) * 27 / safeNumber(pitching.inningsOuts) : 5.2;
    const decisionScore = safeNumber(pitching.wins) * 4 + safeNumber(pitching.saves) * 2.2 + safeNumber(pitching.holds) * 1.1 - safeNumber(pitching.losses) * 2;
    const base = innings * 1.25 + safeNumber(pitching.strikeouts) * 0.72 + decisionScore - runPenalty * 7 + teamBonus + ovrBonus;
    return awardType === "rookie" ? base + safeNumber(player?.pot) * 0.18 - safeNumber(player?.age) * 0.55 : base;
  }

  const average = rate(batting.hits, batting.atBats);
  const obp = rate(safeNumber(batting.hits) + safeNumber(batting.walks), batting.plateAppearances);
  const slg = rate(batting.totalBases, batting.atBats);
  const production = safeNumber(batting.homeRuns) * 5.2 + safeNumber(batting.rbi) * 1.15 + safeNumber(batting.runs) * 0.82 + safeNumber(batting.stolenBases) * 0.8;
  const base = production + (average + obp + slg) * 72 + safeNumber(batting.plateAppearances) * 0.08 + teamBonus + ovrBonus;
  return awardType === "rookie" ? base + safeNumber(player?.pot) * 0.2 - safeNumber(player?.age) * 0.62 : base;
}

function isRookieCandidate(player) {
  return player?.serviceTime?.rookieEligible === true ||
    String(player?.contract?.type ?? "") === "rookie" ||
    (safeNumber(player?.age) <= 21 && ["registered", "futures"].includes(String(player?.status ?? "")));
}

function awardPlayerView(entry, slotLabel) {
  if (!entry?.player) {
    return {
      slotLabel,
      playerId: "",
      name: "미정",
      teamId: "",
      teamName: "",
      position: "",
      role: "",
      ovr: 0,
      line: ""
    };
  }

  const { player, team } = entry;
  return {
    slotLabel,
    playerId: player.id,
    name: player.name,
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.shortName ?? team.name,
    position: player.position,
    role: player.role,
    age: safeNumber(player.age),
    ovr: safeNumber(player.ovr),
    pot: safeNumber(player.pot),
    line: player.role === "pitcher" ? formatPitchingAwardLine(player.seasonStats?.pitching) : formatBattingAwardLine(player.seasonStats?.batting)
  };
}

function formatBattingAwardLine(stats = {}) {
  return `AVG ${formatAwardRate(rate(stats.hits, stats.atBats))} · HR ${safeNumber(stats.homeRuns)} · RBI ${safeNumber(stats.rbi)}`;
}

function formatPitchingAwardLine(stats = {}) {
  const eraValue = stats.inningsOuts > 0 ? safeNumber(stats.earnedRuns) * 27 / safeNumber(stats.inningsOuts) : 0;
  return `ERA ${eraValue ? eraValue.toFixed(2) : "-"} · ${safeNumber(stats.wins)}승 · K ${safeNumber(stats.strikeouts)}`;
}

function formatAwardRate(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number.toFixed(3).replace(/^0/, "") : "-";
}

function getNextDraftSlot(draft) {
  if (!draft || draft.status === "complete") return null;
  const pickIndex = safeNumber(draft.picks?.length);
  if (pickIndex >= safeNumber(draft.totalPicks)) return null;
  const round = Math.floor(pickIndex / safeNumber(draft.picksPerRound, DRAFT_PICKS_PER_ROUND)) + 1;
  const slotIndex = pickIndex % safeNumber(draft.picksPerRound, DRAFT_PICKS_PER_ROUND);
  const teamOrder = draft.order?.[slotIndex];
  if (!teamOrder) return null;
  return {
    pickIndex,
    pickNumber: pickIndex + 1,
    round,
    pickInRound: slotIndex + 1,
    teamOrder
  };
}

function commitAutomaticDraftPick(state, slot) {
  const draft = state?.draft;
  if (!draft || !slot) return { ok: false, code: "missing-draft-slot", message: "드래프트 픽 정보를 찾지 못했습니다." };
  const strategy = draft.strategies?.[slot.teamOrder.teamId];
  const prospect = selectDraftProspect(draft.prospects, strategy, slot.round, slot.pickNumber);
  if (!prospect) {
    finalizeDraftIfComplete(state, draft, { force: true });
    return { ok: true, code: "complete", message: "지명 가능한 후보가 없어 드래프트를 종료했습니다." };
  }
  const pick = appendDraftPick(draft, prospect, slot, "auto");
  finalizeDraftIfComplete(state, draft);
  return { ok: true, code: "draft-pick-advanced", message: `${slot.teamOrder.name} ${prospect.displayCode} 지명`, pick };
}

function appendDraftPick(draft, prospect, slot, source = "auto") {
  prospect.picked = true;
  prospect.pickNumber = slot.pickNumber;
  prospect.round = slot.round;
  prospect.pickInRound = slot.pickInRound;
  prospect.selectedByTeamId = slot.teamOrder.teamId;
  prospect.selectedByTeamName = slot.teamOrder.name;

  const pick = {
    pickNumber: slot.pickNumber,
    round: slot.round,
    pickInRound: slot.pickInRound,
    teamId: slot.teamOrder.teamId,
    teamName: slot.teamOrder.name,
    prospectId: prospect.id,
    displayCode: prospect.displayCode,
    role: prospect.role,
    position: prospect.position,
    classType: prospect.classType,
    profile: prospect.profile,
    age: prospect.age,
    presentGrade: prospect.presentGrade,
    futureGrade: prospect.futureGrade,
    certainty: prospect.certainty,
    risk: prospect.risk,
    source
  };
  draft.picks.push(pick);
  return pick;
}

function makeDraftPendingUserPick(draft, slot, teamId) {
  return {
    type: "draft",
    status: "open",
    teamId,
    pickNumber: slot.pickNumber,
    round: slot.round,
    pickInRound: slot.pickInRound,
    teamName: slot.teamOrder.name,
    openedAt: draft.year,
    eligibleProspectIds: (draft.prospects ?? []).filter((prospect) => !prospect.picked).slice(0, 40).map((prospect) => prospect.id)
  };
}

function finalizeDraftIfComplete(state, draft, options = {}) {
  if (!draft || draft.status === "complete") return false;
  const complete = options.force === true ||
    safeNumber(draft.picks?.length) >= safeNumber(draft.totalPicks) ||
    !(draft.prospects ?? []).some((prospect) => !prospect.picked);
  if (!complete) return false;

  draft.status = "complete";
  draft.completedDate = state.currentDate;
  draft.pendingUserPick = null;
  const rosterResult = applyDraftSelectionsToRosters(state);
  addLog(state, `${state.currentDate} ${draft.year} 신인 드래프트 완료: ${draft.picks.length}명 지명, ${rosterResult.added}명 rookie 계약, ${draft.rightsLedger?.length ?? 0}명 보류권, 미지명 ${draft.prospects.length - draft.picks.length}명.`);
  return true;
}

function getNextSecondaryDraftSlot(draft) {
  if (!draft || draft.status === "complete") return null;
  return buildSecondaryDraftSlots(draft).find((slot) =>
    !(draft.picks ?? []).some((pick) => pick.slotId === slot.slotId) &&
    !(draft.passedSlots ?? []).some((entry) => entry.slotId === slot.slotId)
  ) ?? null;
}

function secondaryOriginPickCounts(draft) {
  const counts = new Map();
  for (const pick of draft?.picks ?? []) {
    counts.set(pick.fromTeamId, (counts.get(pick.fromTeamId) ?? 0) + 1);
  }
  return counts;
}

function commitAutomaticSecondaryDraftPick(state, slot) {
  const draft = state?.secondaryDraft;
  if (!draft || !slot) return { ok: false, code: "missing-secondary-slot", message: "2차 드래프트 픽 정보를 찾지 못했습니다." };
  const originPickCounts = secondaryOriginPickCounts(draft);
  const team = findTeamById(state, slot.teamId);
  const strategy = draft.strategies?.[slot.teamId];
  const candidate = selectSecondaryDraftCandidate(draft.exposurePool, strategy, team, slot, originPickCounts);
  if (!candidate) {
    draft.passedSlots.push({
      ...slot,
      reason: "eligible-candidate-empty"
    });
    finalizeSecondaryDraftIfComplete(state, draft);
    return { ok: true, code: "secondary-pick-passed", message: `${slot.teamName} 지명 가능 후보 없음`, pass: draft.passedSlots.at(-1) };
  }
  const pick = appendSecondaryDraftPick(draft, candidate, slot, originPickCounts, "auto");
  finalizeSecondaryDraftIfComplete(state, draft);
  return { ok: true, code: "secondary-pick-advanced", message: `${slot.teamName} ${candidate.name} 지명`, pick };
}

function appendSecondaryDraftPick(draft, candidate, slot, originPickCounts, source = "auto") {
  candidate.picked = true;
  candidate.selectedByTeamId = slot.teamId;
  candidate.selectedByTeamName = slot.teamName;
  candidate.round = slot.round;
  candidate.pickNumber = draft.picks.length + 1;
  originPickCounts.set(candidate.teamId, (originPickCounts.get(candidate.teamId) ?? 0) + 1);

  const pick = {
    slotId: slot.slotId,
    pickNumber: draft.picks.length + 1,
    round: slot.round,
    pickInRound: slot.pickInRound,
    teamId: slot.teamId,
    teamName: slot.teamName,
    fromTeamId: candidate.teamId,
    fromTeamName: candidate.teamName,
    playerId: candidate.playerId,
    name: candidate.name,
    role: candidate.role,
    position: candidate.position,
    age: candidate.age,
    ovr: candidate.ovr,
    pot: candidate.pot,
    protectionScore: candidate.protectionScore,
    acquisitionScore: candidate.acquisitionScore,
    compensationKRW: SECONDARY_DRAFT_COMPENSATION_BY_ROUND[slot.round] ?? 0,
    obligation: "next-season-registration-v1",
    source
  };
  draft.picks.push(pick);
  return pick;
}

function makeSecondaryPendingUserPick(draft, slot, teamId) {
  const originPickCounts = secondaryOriginPickCounts(draft);
  return {
    type: "secondaryDraft",
    status: "open",
    teamId,
    slotId: slot.slotId,
    round: slot.round,
    pickInRound: slot.pickInRound,
    teamName: slot.teamName,
    openedAt: draft.year,
    eligiblePlayerIds: (draft.exposurePool ?? [])
      .filter((candidate) => !candidate.picked && String(candidate.teamId) !== String(teamId))
      .filter((candidate) => safeNumber(originPickCounts.get(candidate.teamId)) < SECONDARY_DRAFT_ORIGIN_PICK_LIMIT)
      .slice(0, 40)
      .map((candidate) => candidate.playerId)
  };
}

function finalizeSecondaryDraftIfComplete(state, draft, options = {}) {
  if (!draft || draft.status === "complete") return false;
  const nextSlot = getNextSecondaryDraftSlot(draft);
  const complete = options.force === true || !nextSlot;
  if (!complete) return false;

  draft.status = "complete";
  draft.completedDate = state.currentDate;
  draft.pendingUserPick = null;
  const rosterResult = applySecondaryDraftMoves(state);
  addLog(state, `${state.currentDate} ${draft.year} 2차 드래프트 완료: ${draft.picks.length}명 지명, ${rosterResult.moved}명 소속 이동, 패스 ${draft.passedSlots.length}건.`);
  return true;
}

function draftYearForState(state) {
  const year = Number(String(state?.currentDate ?? "").slice(0, 4));
  return Number.isFinite(year) ? year + 1 : 2027;
}

function buildDraftOrder(standings) {
  return [...(standings ?? [])]
    .reverse()
    .map((team, index) => ({
      slot: index + 1,
      teamId: team.id,
      name: team.name,
      shortName: team.shortName ?? team.name,
      previousRank: standings.length - index,
      record: {
        wins: safeNumber(team.wins),
        losses: safeNumber(team.losses),
        ties: safeNumber(team.ties)
      }
    }));
}

function buildDraftStrategy(team, teamOrder) {
  const needs = draftNeedsForTeam(team);
  const riskTolerance = clamp(Math.round(42 + (11 - safeNumber(teamOrder?.slot, 5)) * 2.8 + (safeNumber(team?.budget, 60) - 60) * 0.18), 35, 72);
  const timeline = safeNumber(team?.wins) > safeNumber(team?.losses) ? "win-now-depth" : "upside-rebuild";
  const primaryNeed = needs[0]?.key ?? "P";
  const secondaryNeed = needs[1]?.key ?? "IF";
  const focus = primaryNeed === "P"
    ? "마운드 보강"
    : primaryNeed === "C"
      ? "포수 희소성"
      : timeline === "upside-rebuild"
        ? "상위 잠재력"
        : "야수 뎁스";

  return {
    teamId: team?.id ?? "",
    focus,
    timeline,
    riskTolerance,
    preferredPositions: [primaryNeed, secondaryNeed],
    needs,
    source: "roster-depth-v1"
  };
}

function draftNeedsForTeam(team) {
  const roster = team?.roster ?? [];
  const groups = [
    { key: "P", label: "투수", target: 24, count: roster.filter((player) => player.role === "pitcher").length },
    { key: "C", label: "포수", target: 4, count: roster.filter((player) => player.position === "C").length },
    { key: "IF", label: "내야", target: 14, count: roster.filter((player) => player.role === "hitter" && ["IF", "1B", "2B", "3B", "SS"].includes(player.position)).length },
    { key: "OF", label: "외야", target: 10, count: roster.filter((player) => player.role === "hitter" && ["OF", "LF", "CF", "RF"].includes(player.position)).length }
  ];

  return groups
    .map((group) => {
      const youngCount = roster.filter((player) => draftPositionGroup(player.position, player.role) === group.key && safeNumber(player.age) <= 24).length;
      const deficit = Math.max(0, group.target - group.count);
      return {
        ...group,
        youngCount,
        score: deficit * 9 + Math.max(0, 5 - youngCount) * 4 + (group.key === "C" ? 4 : 0)
      };
    })
    .sort((a, b) => safeNumber(b.score) - safeNumber(a.score) || a.key.localeCompare(b.key));
}

function createDraftProspectPool(year, state) {
  return Array.from({ length: DRAFT_POOL_SIZE }, (_, index) => createDraftProspect(year, index, state));
}

function createDraftProspect(year, index, state) {
  const seed = hashParts(year, index, state?.teams?.length ?? KBO_TEAM_COUNT, "draft-prospect");
  const classType = draftClassType(seed, index);
  const role = rollUnit(seed, "role") < 0.48 ? "pitcher" : "hitter";
  const position = role === "pitcher" ? "P" : draftHitterPosition(seed, index);
  const handedness = role === "pitcher" ? draftPitcherHand(seed) : draftHitterHand(seed);
  const profile = role === "pitcher" ? draftPitcherProfile(seed, handedness) : draftHitterProfile(seed, position, handedness);
  const base = clamp(36 + deterministicRange(seed, "base", 0, 23) + Math.floor(index < 20 ? (20 - index) / 2 : 0), 20, 80);
  const upside = clamp(base + deterministicRange(seed, "upside", 5, 24) - Math.floor(index / 34), 30, 80);
  const risk = clamp(82 - upside + deterministicRange(seed, "risk", -8, 14), 20, 80);
  const certainty = clamp(76 - risk + (classType === "대학" ? 8 : classType === "고교" ? -3 : 0) + deterministicRange(seed, "certainty", -5, 8), 20, 80);
  const signability = clamp(54 + deterministicRange(seed, "signability", -15, 18) + (classType === "해외/독립" ? -8 : 0), 20, 80);
  const presentGrade = clamp(Math.round(base / 5) * 5, 20, 80);
  const futureGrade = clamp(Math.round(upside / 5) * 5, 20, 80);

  return {
    id: `draft-${year}-${String(index + 1).padStart(3, "0")}`,
    displayCode: `DRF-${year}-${String(index + 1).padStart(3, "0")}`,
    rank: index + 1,
    sourceKind: "anonymous-projection-v1",
    sourceNote: "실명 검증 전 드래프트 후보 코드",
    classType,
    role,
    position,
    handedness,
    profile,
    age: draftProspectAge(classType, seed),
    presentGrade,
    futureGrade,
    certainty,
    risk,
    signability,
    tools: draftTools(seed, role, position, presentGrade, futureGrade),
    picked: false,
    selectedByTeamId: null
  };
}

function draftClassType(seed, index) {
  const roll = (seed + index * 17) % 100;
  if (roll < 55) return "고교";
  if (roll < 84) return "대학";
  if (roll < 94) return "얼리";
  return "해외/독립";
}

function draftProspectAge(classType, seed) {
  if (classType === "고교") return 18 + deterministicRange(seed, "age", 0, 1);
  if (classType === "대학") return 21 + deterministicRange(seed, "age", 0, 2);
  if (classType === "얼리") return 20 + deterministicRange(seed, "age", 0, 2);
  return 22 + deterministicRange(seed, "age", 0, 3);
}

function draftHitterPosition(seed, index) {
  const positions = ["C", "IF", "IF", "OF", "OF", "1B", "SS", "3B", "CF"];
  return positions[(seed + index) % positions.length];
}

function draftPitcherHand(seed) {
  return seed % 5 === 0 ? "LHP" : "RHP";
}

function draftHitterHand(seed) {
  const values = ["R/R", "L/R", "L/L", "S/R", "R/L"];
  return values[seed % values.length];
}

function draftPitcherProfile(seed, handedness) {
  const profiles = ["파워암", "커맨드형", "싱커볼러", "선발형", "불펜 즉전", "변화구형"];
  return `${handedness} ${profiles[seed % profiles.length]}`;
}

function draftHitterProfile(seed, position, handedness) {
  const profiles = ["컨택형", "장타형", "수비형", "주루형", "선구안형", "밸런스형"];
  return `${position} ${handedness} ${profiles[seed % profiles.length]}`;
}

function draftTools(seed, role, position, presentGrade, futureGrade) {
  const spread = (salt, bonus = 0) => clamp(Math.round((presentGrade + deterministicRange(seed, salt, -10, 14) + bonus) / 5) * 5, 20, 80);
  if (role === "pitcher") {
    return {
      stuff: spread("stuff", position === "P" ? 3 : 0),
      control: spread("control"),
      stamina: spread("stamina", futureGrade >= 60 ? 4 : 0),
      movement: spread("movement"),
      fielding: spread("fielding", -3)
    };
  }
  return {
    hit: spread("hit"),
    power: spread("power", position === "1B" ? 5 : 0),
    run: spread("run", position === "CF" ? 6 : 0),
    field: spread("field", ["C", "SS", "CF"].includes(position) ? 5 : 0),
    arm: spread("arm", position === "C" ? 6 : 0)
  };
}

function selectDraftProspect(prospects, strategy, round, pickNumber) {
  return [...(prospects ?? [])]
    .filter((prospect) => !prospect.picked)
    .map((prospect) => ({
      prospect,
      score: draftProspectScore(prospect, strategy, round, pickNumber)
    }))
    .sort((a, b) => b.score - a.score || safeNumber(a.prospect.rank) - safeNumber(b.prospect.rank))[0]?.prospect ?? null;
}

function draftProspectScore(prospect, strategy, round, pickNumber) {
  const positionGroup = draftPositionGroup(prospect.position, prospect.role);
  const needIndex = (strategy?.preferredPositions ?? []).indexOf(positionGroup);
  const needBonus = needIndex === 0 ? 16 : needIndex === 1 ? 9 : 0;
  const riskTolerance = safeNumber(strategy?.riskTolerance, 50);
  const upsideWeight = round <= 3 ? 1.3 : round <= 7 ? 1.08 : 0.92;
  const presentWeight = round <= 3 ? 0.52 : round <= 7 ? 0.72 : 0.9;
  const riskPenalty = Math.max(0, safeNumber(prospect.risk) - riskTolerance) * (round <= 4 ? 0.42 : 0.24);
  const certaintyBonus = safeNumber(prospect.certainty) * (round >= 8 ? 0.18 : 0.08);
  const signBonus = safeNumber(prospect.signability) * (round >= 9 ? 0.18 : 0.07);
  const scarcityBonus = positionGroup === "C" ? 4 : positionGroup === "P" ? 2 : 0;
  const boardDrift = deterministicRange(prospect.id, strategy?.teamId ?? "", pickNumber, -4, 4);

  return safeNumber(prospect.futureGrade) * upsideWeight +
    safeNumber(prospect.presentGrade) * presentWeight +
    needBonus +
    scarcityBonus +
    certaintyBonus +
    signBonus -
    riskPenalty -
    safeNumber(prospect.rank) * 0.04 +
    boardDrift;
}

function draftPositionGroup(position, role) {
  if (role === "pitcher" || position === "P") return "P";
  if (position === "C") return "C";
  if (["OF", "LF", "CF", "RF"].includes(position)) return "OF";
  return "IF";
}

function buildSecondaryDraftOrder(standings) {
  return [...(standings ?? [])]
    .reverse()
    .map((team, index) => ({
      slot: index + 1,
      teamId: team.id,
      name: team.name,
      shortName: team.shortName ?? team.name,
      previousRank: standings.length - index,
      record: {
        wins: safeNumber(team.wins),
        losses: safeNumber(team.losses),
        ties: safeNumber(team.ties)
      },
      extraRoundEligible: index < SECONDARY_DRAFT_EXTRA_TEAM_COUNT
    }));
}

function buildSecondaryProtectionList(team) {
  const hardExcluded = [];
  const scored = [];

  for (const player of team?.roster ?? []) {
    const hardReason = secondaryHardExclusionReason(player);
    const playerCard = toSecondaryDraftPlayerCard(team, player, hardReason ? "hardExcluded" : "eligible", hardReason);
    if (hardReason) {
      hardExcluded.push(playerCard);
    } else {
      scored.push({
        card: playerCard,
        score: secondaryProtectionScore(player, team)
      });
    }
  }

  const ranked = scored
    .sort((a, b) => b.score - a.score || safeNumber(b.card.ovr) - safeNumber(a.card.ovr) || compareText(a.card.name, b.card.name))
    .map(({ card, score }) => ({
      ...card,
      protectionScore: Math.round(score)
    }));
  const protectedPlayers = ranked.slice(0, SECONDARY_DRAFT_PROTECTED_COUNT).map((card) => ({
    ...card,
    status: "protected",
    reason: "club-protected-35"
  }));
  const exposedPlayers = ranked.slice(SECONDARY_DRAFT_PROTECTED_COUNT).map((card) => ({
    ...card,
    status: "exposed",
    reason: "outside-protected-35",
    picked: false,
    selectedByTeamId: null
  }));

  return {
    teamId: team?.id ?? "",
    teamName: team?.name ?? "",
    teamShortName: team?.shortName ?? team?.name ?? "",
    protectedCount: protectedPlayers.length,
    exposedCount: exposedPlayers.length,
    hardExcludedCount: hardExcluded.length,
    protected: protectedPlayers,
    exposed: exposedPlayers,
    hardExcluded,
    source: "roster-protection-v1"
  };
}

function secondaryHardExclusionReason(player) {
  if (player?.foreignPlayer?.isForeign) return "foreign-player";
  if (["filed", "market", "signed"].includes(player?.faStatus?.status)) return "fa-market-player";
  if (player?.contract?.type === "rookie" || player?.sourceKind === "anonymous-draft-rookie-v1") return "rookie-contract";
  return "";
}

function toSecondaryDraftPlayerCard(team, player, status, reason) {
  return {
    playerId: player?.id ?? "",
    name: player?.name ?? "",
    teamId: team?.id ?? "",
    teamName: team?.name ?? "",
    teamShortName: team?.shortName ?? team?.name ?? "",
    role: player?.role ?? "",
    position: player?.position ?? "",
    age: safeNumber(player?.age),
    bats: player?.bats ?? "",
    throws: player?.throws ?? "",
    ovr: safeNumber(player?.ovr),
    pot: safeNumber(player?.pot),
    salaryKRW: safeNumber(player?.contract?.salary?.payrollAmountKRW),
    serviceSeasons: safeNumber(player?.serviceTime?.seasonsAccrued),
    rookieEligible: Boolean(player?.serviceTime?.rookieEligible),
    status,
    reason,
    protectionScore: 0,
    acquisitionScore: 0,
    picked: false,
    selectedByTeamId: null
  };
}

function secondaryProtectionScore(player, team) {
  const positionGroup = draftPositionGroup(player?.position, player?.role);
  const age = safeNumber(player?.age, 29);
  const salaryEok = safeNumber(player?.contract?.salary?.payrollAmountKRW) / 100_000_000;
  const scarcity = positionGroup === "C" ? 16 : positionGroup === "P" ? 7 : ["SS", "CF"].includes(player?.position) ? 6 : 0;
  const upside = age <= 25 ? safeNumber(player?.pot) * 0.58 : age <= 30 ? safeNumber(player?.pot) * 0.34 : safeNumber(player?.pot) * 0.12;
  const present = safeNumber(player?.ovr) * (age >= 32 ? 0.92 : 1.05);
  const salaryPenalty = Math.max(0, salaryEok - 8) * 1.8;
  const moraleBonus = clubMood(team) * 4;
  return present + upside + scarcity + moraleBonus - salaryPenalty;
}

function buildSecondaryDraftStrategy(team, teamOrder) {
  const needs = draftNeedsForTeam(team);
  const primaryNeed = needs[0]?.key ?? "P";
  const secondaryNeed = needs[1]?.key ?? "IF";
  const timeline = safeNumber(team?.wins) >= safeNumber(team?.losses) ? "contender-depth" : "retool-upside";
  const salarySensitivity = clamp(Math.round(45 + (safeNumber(team?.payroll) - safeNumber(team?.budget)) * 0.12 + safeNumber(teamOrder?.slot) * 1.4), 35, 76);
  const focus = timeline === "contender-depth"
    ? "즉전 뎁스"
    : primaryNeed === "P"
      ? "투수 재정비"
      : "숨은 업사이드";

  return {
    teamId: team?.id ?? "",
    focus,
    timeline,
    salarySensitivity,
    preferredPositions: [primaryNeed, secondaryNeed],
    needs,
    source: "secondary-draft-depth-v1"
  };
}

function secondaryDraftMaxPicks(order) {
  return SECONDARY_DRAFT_BASE_ROUNDS * safeNumber(order?.length) + SECONDARY_DRAFT_EXTRA_ROUNDS * SECONDARY_DRAFT_EXTRA_TEAM_COUNT;
}

function buildSecondaryDraftSlots(draft) {
  const slots = [];
  for (let round = 1; round <= SECONDARY_DRAFT_BASE_ROUNDS + SECONDARY_DRAFT_EXTRA_ROUNDS; round += 1) {
    const teams = round <= SECONDARY_DRAFT_BASE_ROUNDS
      ? draft.order
      : draft.order.filter((team) => team.extraRoundEligible).slice(0, SECONDARY_DRAFT_EXTRA_TEAM_COUNT);
    teams.forEach((teamOrder, index) => {
      slots.push({
        slotId: `secondary-${draft.year}-r${round}-${teamOrder.teamId}`,
        round,
        pickInRound: index + 1,
        teamId: teamOrder.teamId,
        teamName: teamOrder.name,
        teamShortName: teamOrder.shortName
      });
    });
  }
  return slots;
}

function selectSecondaryDraftCandidate(pool, strategy, receivingTeam, slot, originPickCounts) {
  return [...(pool ?? [])]
    .filter((candidate) => !candidate.picked)
    .filter((candidate) => String(candidate.teamId) !== String(slot.teamId))
    .filter((candidate) => safeNumber(originPickCounts.get(candidate.teamId)) < SECONDARY_DRAFT_ORIGIN_PICK_LIMIT)
    .map((candidate) => ({
      candidate,
      score: secondaryAcquisitionScore(candidate, strategy, receivingTeam, slot)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || safeNumber(b.candidate.pot) - safeNumber(a.candidate.pot) || compareText(a.candidate.name, b.candidate.name))[0]?.candidate ?? null;
}

function secondaryAcquisitionScore(candidate, strategy, receivingTeam, slot) {
  const positionGroup = draftPositionGroup(candidate.position, candidate.role);
  const needIndex = (strategy?.preferredPositions ?? []).indexOf(positionGroup);
  const needBonus = needIndex === 0 ? 18 : needIndex === 1 ? 10 : 0;
  const age = safeNumber(candidate.age, 29);
  const salaryEok = safeNumber(candidate.salaryKRW) / 100_000_000;
  const salaryPenalty = salaryEok * (safeNumber(strategy?.salarySensitivity, 50) / 42);
  const upsideBonus = age <= 25 ? safeNumber(candidate.pot) * 0.45 : age <= 29 ? safeNumber(candidate.pot) * 0.25 : 0;
  const readyNow = safeNumber(candidate.ovr) * (slot.round <= 2 ? 1.05 : 0.92);
  const scarcityBonus = positionGroup === "C" ? 10 : positionGroup === "P" ? 5 : 0;
  const sourceTeamPenalty = safeNumber(candidate.protectionScore) > 210 ? 8 : 0;
  const budgetBonus = safeNumber(receivingTeam?.budget) > safeNumber(receivingTeam?.payroll) ? 4 : 0;
  const roundRisk = slot.round >= 4 ? 6 : 0;
  const score = readyNow + upsideBonus + needBonus + scarcityBonus + budgetBonus + roundRisk - salaryPenalty - sourceTeamPenalty;
  candidate.acquisitionScore = Math.round(score);
  return score;
}

function applyGameStats(home, away, homeRuns, awayRuns, attendance) {
  for (const team of [home, away]) {
    team.runsFor = safeNumber(team.runsFor);
    team.runsAgainst = safeNumber(team.runsAgainst);
    team.wins = safeNumber(team.wins);
    team.losses = safeNumber(team.losses);
    team.ties = safeNumber(team.ties);
  }

  home.runsFor += homeRuns;
  home.runsAgainst += awayRuns;
  away.runsFor += awayRuns;
  away.runsAgainst += homeRuns;
  home.homeGames = safeNumber(home.homeGames) + 1;
  home.attendanceTotal = safeNumber(home.attendanceTotal) + attendance;

  if (homeRuns > awayRuns) {
    home.wins += 1;
    away.losses += 1;
    home.streak = nextStreak(home.streak, "W");
    away.streak = nextStreak(away.streak, "L");
  } else if (awayRuns > homeRuns) {
    away.wins += 1;
    home.losses += 1;
    away.streak = nextStreak(away.streak, "W");
    home.streak = nextStreak(home.streak, "L");
  } else {
    home.ties += 1;
    away.ties += 1;
    home.streak = "T1";
    away.streak = "T1";
  }
}

function simulateOffense({ gameId, offense, defense, lineup, defenseLineup, pitchingPlan, gamePlan, seed, weather, side }) {
  const result = {
    runs: 0,
    hits: 0,
    homeRuns: 0,
    doubles: 0,
    triples: 0,
    walks: 0,
    strikeouts: 0,
    reachedOnErrors: 0,
    defenseErrors: 0,
    doublePlays: 0,
    atBats: 0,
    stolenBases: 0,
    caughtStealing: 0,
    leftOnBase: 0,
    plateAppearances: 0,
    pitches: 0,
    inningsOuts: 0,
    runsByInning: Array.from({ length: 9 }, () => 0),
    batterLines: new Map(),
    pitchingLines: new Map(),
    usedPitchers: [],
    plateAppearanceEvents: [],
    scoringEvents: []
  };

  if (!lineup.length) return result;

  const defenseContext = buildDefenseContext(defense, defenseLineup);
  const defenseQuality = defenseContext.overall;

  for (const hitter of lineup) {
    ensureBattingStats(hitter).games += 1;
  }
  for (const defender of defenseContext.defenders) {
    ensureSeasonStats(defender).fielding.games += 1;
  }

  let outs = 0;
  let batterIndex = 0;
  const bases = [null, null, null];
  const guardLimit = 92;

  while (outs < 27 && result.plateAppearances < guardLimit) {
    const hitter = lineup[batterIndex % lineup.length];
    batterIndex += 1;
    result.plateAppearances += 1;
    const outsBeforePlay = outs;
    const inningIndex = Math.min(8, Math.floor(outsBeforePlay / 3));
    const pitcher = choosePitcherForPlateAppearance(pitchingPlan, result, outs);

    const outcome = resolvePlateAppearance({
      hitter,
      pitcher,
      defenseQuality,
      defenseContext,
      weather,
      seed,
      plateAppearance: result.plateAppearances,
      side,
      bases,
      outs,
      gamePlan
    });
    const basesBeforePlay = [Boolean(bases[0]), Boolean(bases[1]), Boolean(bases[2])];
    const advancement = applyPlateAppearanceOutcome({
      outcome,
      hitter,
      bases,
      outs,
      seed,
      plateAppearance: result.plateAppearances
    });

    outs += advancement.outs;
    result.runs += advancement.runs;
    result.hits += advancement.hits;
    result.homeRuns += outcome.type === "homeRun" ? 1 : 0;
    result.doubles += outcome.type === "double" ? 1 : 0;
    result.triples += outcome.type === "triple" ? 1 : 0;
    result.walks += outcome.type === "walk" ? 1 : 0;
    result.strikeouts += outcome.type === "strikeout" ? 1 : 0;
    result.reachedOnErrors += outcome.type === "error" ? 1 : 0;
    result.defenseErrors += outcome.type === "error" ? 1 : 0;
    result.doublePlays += outcome.doublePlay ? 1 : 0;
    result.atBats += outcome.isAtBat ? 1 : 0;
    result.pitches += pitchEstimate(outcome);
    result.runsByInning[inningIndex] += advancement.runs;

    if (outcome.type === "error") {
      applyFieldingError(outcome.defender);
    }
    applyBattingEvent(hitter, outcome, advancement);
    applyPitchingEvent(pitcher, outcome, advancement);
    applyGamePitchingEvent(result, pitcher, pitchingPlan, outcome, advancement);
    applyGameBatterEvent(result, hitter, outcome, advancement);
    addPlateAppearanceEvent(result, {
      gameId,
      side,
      offense,
      defense,
      hitter,
      pitcher,
      inning: inningIndex + 1,
      outcome,
      advancement,
      outsBefore: outsBeforePlay,
      outsAfter: outs,
      basesBefore: basesBeforePlay,
      basesAfter: [Boolean(bases[0]), Boolean(bases[1]), Boolean(bases[2])],
      inningEnded: inningEnded(outsBeforePlay, outs),
      ballpark: weather?.ballpark
    });

    if (inningEnded(outsBeforePlay, outs)) {
      result.leftOnBase += countOccupiedBases(bases);
      clearBases(bases);
      continue;
    }

    if (outs < 27) {
      const steal = maybeAttemptSteal({
        bases,
        pitcher,
        seed,
        plateAppearance: result.plateAppearances,
        side,
        gamePlan
      });
      const outsBeforeSteal = outs;
      outs += steal.outs;
      applyGameStealEvent(result, steal);
      creditPitcherOuts(pitcher, result, steal.outs);
      if (inningEnded(outsBeforeSteal, outs)) {
        result.leftOnBase += countOccupiedBases(bases);
        clearBases(bases);
      }
    }
  }

  result.inningsOuts = Math.min(27, outs);
  if (outs < 27) {
    result.leftOnBase += countOccupiedBases(bases);
  }
  result.batterLines = [...result.batterLines.values()].sort(sortGameBatterLines);
  result.pitchingLines = [...result.pitchingLines.values()].sort(sortGamePitchingLines);

  return result;
}

function resolvePlateAppearance({ hitter, pitcher, defenseQuality, defenseContext, weather, seed, plateAppearance, side, bases, outs, gamePlan }) {
  const pitcherHand = normalizeGameHand(pitcher?.throws, "R");
  const batterSide = effectiveBatterSide(hitter, pitcherHand);
  const contact = hitterSplitRating(hitter, "contact", pitcherHand);
  const power = hitterSplitRating(hitter, "power", pitcherHand);
  const eye = safeNumber(hitter.eye, 10);
  const patience = safeNumber(hitter.patience, eye);
  const battedBall = safeNumber(hitter.battedBall, power);
  const stuff = safeNumber(pitcher?.stuff, 10);
  const control = safeNumber(pitcher?.control, 10);
  const velocity = safeNumber(pitcher?.velocity, stuff);
  const movement = safeNumber(pitcher?.movement, 10);
  const hrSuppression = safeNumber(pitcher?.hrSuppression, movement);
  const condition = (safeNumber(hitter.dailyCondition, hitter.form) - 55) * 0.002;
  const pitcherFreshness = (safeNumber(pitcher?.armFreshness, 80) - 75) * 0.001;
  const weatherRun = safeNumber(weather?.runFactor, 1);
  const weatherHomer = safeNumber(weather?.homerFactor, 1);
  const weatherHit = safeNumber(weather?.hitFactor, weatherRun);
  const anonymousProfile = anonymousPerformanceProfile(hitter);
  const pitcherPlatoon = pitcherSplitRating(pitcher, batterSide);
  const platoonPressure = (pitcherPlatoon - 10) * 0.0026;
  const battedBallType = chooseBattedBallType({ hitter, pitcher, contact, power, movement, seed, plateAppearance, side });
  const fielding = fieldingContextForBattedBall(defenseContext, battedBallType, seed, plateAppearance, hitter);
  const battedBallDefense = safeNumber(fielding.quality, defenseQuality);
  const infieldDefense = safeNumber(defenseContext?.infieldQuality, defenseQuality);
  const outfieldDefense = safeNumber(defenseContext?.outfieldQuality, defenseQuality);
  const groundBallPenalty = battedBallType === "groundBall" ? 0.006 : 0;
  const lineDriveBoost = battedBallType === "lineDrive" ? 0.018 : 0;
  const flyBallBoost = battedBallType === "flyBall" ? 0.006 : 0;

  const gamePlanAdjustment = managerPlateAppearanceAdjustment(gamePlan, hitter, bases, outs);
  const walkRate = clamp(((0.086 + (eye + patience - 20) * 0.004 - (control - 10) * 0.0052) * anonymousProfile.walkScale) + gamePlanAdjustment.walk, 0.035, 0.165);
  const strikeoutRate = clamp(
    clamp(
      0.182 + (stuff - 10) * 0.0092 + (velocity - 10) * 0.0036 - (contact - 10) * 0.0078 - (eye - 10) * 0.0023 + platoonPressure,
      0.078,
      0.35
    ) + anonymousProfile.strikeoutAdd + gamePlanAdjustment.strikeout,
    0.078,
    0.39
  );
  const homeRunRate = clamp(
    ((0.029 + (power - 10) * 0.0038 + (battedBall - 10) * 0.002 - (hrSuppression - 10) * 0.0032 - platoonPressure * 0.7 + flyBallBoost) * weatherHomer * anonymousProfile.homerScale) + gamePlanAdjustment.homeRun,
    0.005,
    0.09
  );
  const tripleRate = clamp((0.003 + (safeNumber(hitter.speed, 10) - 10) * 0.00055 - (outfieldDefense - 10) * 0.00038) * weatherHit, 0.001, 0.014);
  const doubleRate = clamp(
    ((0.047 + (power - 10) * 0.0023 + (contact - 10) * 0.001 - (movement - 10) * 0.0019 - (outfieldDefense - 10) * 0.0012 - platoonPressure * 0.5 + lineDriveBoost) * weatherRun * anonymousProfile.extraBaseScale) + gamePlanAdjustment.double,
    0.02,
    0.084
  );
  const singleRate = clamp(
    ((0.107 + (contact - 10) * 0.0045 + condition + pitcherFreshness - (stuff - 10) * 0.005 - (movement - 10) * 0.0031 - (battedBallDefense - 10) * 0.0029 - platoonPressure * 0.8 + lineDriveBoost - groundBallPenalty) * weatherHit * anonymousProfile.singleScale) + gamePlanAdjustment.single,
    0.058,
    0.18
  );
  const roll = rollUnit(seed, side, plateAppearance, hitter.id, pitcher?.id ?? "bullpen");

  if (roll < walkRate) return { type: "walk", isAtBat: false, bases: 0 };
  if (roll < walkRate + strikeoutRate) return { type: "strikeout", isAtBat: true, bases: 0 };
  if (roll < walkRate + strikeoutRate + homeRunRate) return { type: "homeRun", isAtBat: true, bases: 4, battedBallType: "flyBall", ballpark: weather?.ballpark };
  if (roll < walkRate + strikeoutRate + homeRunRate + tripleRate) return { type: "triple", isAtBat: true, bases: 3, battedBallType, fieldingPosition: fielding.position, defender: fielding.defender, ballpark: weather?.ballpark };
  if (roll < walkRate + strikeoutRate + homeRunRate + tripleRate + doubleRate) return { type: "double", isAtBat: true, bases: 2, battedBallType, fieldingPosition: fielding.position, defender: fielding.defender, ballpark: weather?.ballpark };
  if (roll < walkRate + strikeoutRate + homeRunRate + tripleRate + doubleRate + singleRate) return { type: "single", isAtBat: true, bases: 1, battedBallType, fieldingPosition: fielding.position, defender: fielding.defender, ballpark: weather?.ballpark };

  const errorRate = fieldingErrorRate({ fielding, hitter, battedBallType });
  if (rollUnit(seed, side, "fielding-error", plateAppearance, hitter.id, fielding.defender?.id ?? fielding.position) < errorRate) {
    return { type: "error", isAtBat: true, bases: 1, reachedOnError: true, battedBallType, fieldingPosition: fielding.position, defender: fielding.defender, ballpark: weather?.ballpark };
  }

  const doublePlay = shouldTurnDoublePlay({ bases, outs, hitter, pitcher, defenseContext, seed, plateAppearance, side, battedBallType });
  return { type: "out", isAtBat: true, bases: 0, battedBallType, fieldingPosition: fielding.position, defender: fielding.defender, doublePlay, ballpark: weather?.ballpark };
}

function managerPlateAppearanceAdjustment(gamePlan, hitter, bases, outs) {
  if (!gamePlan) {
    return { walk: 0, strikeout: 0, homeRun: 0, double: 0, single: 0 };
  }

  const traits = hitter?.personality?.traits ?? {};
  const coachability = (safeNumber(traits.professionalism, 10) + safeNumber(traits.adaptability, 10)) / 20;
  const pressureBonus = countOccupiedBases(bases ?? []) >= 2 && safeNumber(traits.pressure, 10) >= 15 ? 0.0015 : 0;
  const fit = clamp(0.78 + coachability * 0.22, 0.78, 1.04);
  const adjustment = { walk: 0, strikeout: 0, homeRun: 0, double: 0, single: pressureBonus };

  if (gamePlan.approach === "patient") {
    adjustment.walk += 0.010 * fit;
    adjustment.strikeout += 0.004 * fit;
    adjustment.single -= 0.004;
    adjustment.homeRun -= 0.002;
  } else if (gamePlan.approach === "aggressive") {
    adjustment.walk -= 0.007;
    adjustment.strikeout += 0.007 * fit;
    adjustment.homeRun += 0.004 * fit;
    adjustment.double += 0.003 * fit;
  } else if (gamePlan.approach === "contact") {
    adjustment.walk -= 0.002;
    adjustment.strikeout -= 0.004 * fit;
    adjustment.single += 0.006 * fit;
    adjustment.homeRun -= 0.002;
  }

  if (gamePlan.bunt === "aggressive" && outs % 3 < 2 && bases?.[0] && !bases?.[1]) {
    adjustment.strikeout -= 0.002;
    adjustment.single += 0.002;
    adjustment.homeRun -= 0.003;
  }

  return adjustment;
}

function normalizeGameHand(value, fallback = "R") {
  const text = String(value ?? "").trim();
  const hand = text.toUpperCase();
  if (hand.includes("S") || text.includes("양") || text.includes("스위치")) return "S";
  if (hand.includes("L") || text.includes("좌")) return "L";
  if (hand.includes("R") || text.includes("우")) return "R";
  return fallback;
}

function effectiveBatterSide(hitter, pitcherHand) {
  const bats = normalizeBatterHand(hitter);
  if (bats === "S") return pitcherHand === "L" ? "R" : "L";
  return bats;
}

function normalizeBatterHand(hitter) {
  const bats = normalizeGameHand(hitter?.bats, "");
  if (bats) return bats;
  const handedness = String(hitter?.handedness ?? "");
  if (handedness.includes("양타") || handedness.includes("스위치")) return "S";
  if (handedness.includes("좌타")) return "L";
  if (handedness.includes("우타")) return "R";
  return "R";
}

function hitterSplitRating(hitter, key, pitcherHand) {
  const splitKey = pitcherHand === "L" ? `${key}L` : `${key}R`;
  const fallback = safeNumber(hitter?.[key], 10);
  return safeNumber(hitter?.[splitKey], fallback);
}

function pitcherSplitRating(pitcher, batterSide) {
  if (!pitcher) return 10;
  const splitKey = batterSide === "L" ? "vsLHB" : "vsRHB";
  return safeNumber(pitcher?.[splitKey], averageNumbers(safeNumber(pitcher?.stuff, 10), safeNumber(pitcher?.movement, 10)));
}

function chooseBattedBallType({ hitter, pitcher, contact, power, movement, seed, plateAppearance, side }) {
  const speed = safeNumber(hitter?.speed, 10);
  const flyBias = clamp(0.31 + (power - 10) * 0.012 - (movement - 10) * 0.009, 0.18, 0.48);
  const lineBias = clamp(0.18 + (contact - 10) * 0.008 + (speed - 10) * 0.002, 0.1, 0.3);
  const roll = rollUnit(seed, side, "batted-ball", plateAppearance, hitter?.id ?? "", pitcher?.id ?? "");
  if (roll < lineBias) return "lineDrive";
  if (roll < lineBias + flyBias) return "flyBall";
  return "groundBall";
}

function fieldingContextForBattedBall(defenseContext, battedBallType, seed, plateAppearance, hitter) {
  if (battedBallType === "flyBall") {
    return chooseFieldingTarget(defenseContext, "outfield", seed, plateAppearance, hitter, "OF");
  }
  if (battedBallType === "lineDrive") {
    const group = rollUnit(seed, "line-drive-zone", plateAppearance, hitter?.id ?? "") < 0.42 ? "infield" : "outfield";
    return chooseFieldingTarget(defenseContext, group, seed, plateAppearance, hitter, group === "infield" ? "IF" : "OF");
  }
  return chooseFieldingTarget(defenseContext, "infield", seed, plateAppearance, hitter, "IF");
}

function chooseFieldingTarget(defenseContext, group, seed, plateAppearance, hitter, fallbackPosition) {
  const options = defenseContext?.[group] ?? [];
  if (!options.length) {
    return {
      position: fallbackPosition,
      defender: null,
      quality: safeNumber(defenseContext?.overall, 10)
    };
  }
  const index = hashParts(seed, plateAppearance, hitter?.id ?? "", group, "fielding-target") % options.length;
  return options[index];
}

function fieldingErrorRate({ fielding, hitter, battedBallType }) {
  const quality = safeNumber(fielding?.quality, 10);
  const speedPressure = battedBallType === "groundBall" ? Math.max(0, safeNumber(hitter?.speed, 10) - 11) * 0.0012 : 0;
  const baseRate = battedBallType === "flyBall" ? 0.006 : battedBallType === "lineDrive" ? 0.008 : 0.013;
  return clamp(baseRate + (10 - quality) * 0.0022 + speedPressure, 0.003, 0.034);
}

function shouldTurnDoublePlay({ bases, outs, hitter, pitcher, defenseContext, seed, plateAppearance, side, battedBallType }) {
  if (battedBallType !== "groundBall" || outs % 3 > 1 || !bases?.[0]) return false;
  const speed = safeNumber(hitter?.speed, 10);
  const baserunning = safeNumber(hitter?.baserunning, speed);
  const movement = safeNumber(pitcher?.movement, 10);
  const infield = safeNumber(defenseContext?.doublePlayQuality, defenseContext?.infieldQuality);
  const rate = clamp(0.085 + (infield - 10) * 0.008 + (movement - 10) * 0.004 - (speed + baserunning - 20) * 0.0042, 0.035, 0.24);
  return rollUnit(seed, side, "double-play", plateAppearance, hitter?.id ?? "", bases[0]?.id ?? "") < rate;
}

function applyPlateAppearanceOutcome({ outcome, hitter, bases, outs, seed, plateAppearance }) {
  const advancement = {
    runs: 0,
    earnedRuns: 0,
    hits: outcome.bases > 0 ? 1 : 0,
    outs: 0,
    rbi: 0,
    reachedOnError: outcome.type === "error",
    doublePlay: Boolean(outcome.doublePlay),
    scoredRunners: []
  };

  const scoreRunner = (runner, rbiCredit = true, earnedRun = true) => {
    if (!runner) return;
    ensureBattingStats(runner).runs += 1;
    advancement.runs += 1;
    if (earnedRun) advancement.earnedRuns += 1;
    advancement.scoredRunners.push({
      id: runner.id ?? runner.name,
      name: runner.name ?? "",
      rbiCredit,
      earnedRun
    });
    if (rbiCredit) advancement.rbi += 1;
  };

  if (outcome.type === "strikeout") {
    advancement.outs = 1;
    return advancement;
  }

  if (outcome.type === "out") {
    if (outcome.doublePlay && outs % 3 <= 1 && bases[0]) {
      advancement.outs = Math.min(2, 3 - (outs % 3));
      bases[0] = null;
      return advancement;
    }
    advancement.outs = 1;
    if (outs % 3 < 2 && bases[2] && rollUnit(seed, "sac-fly", plateAppearance, hitter.id) < 0.1) {
      scoreRunner(bases[2], true);
      bases[2] = null;
    }
    return advancement;
  }

  if (outcome.type === "error") {
    advancement.hits = 0;
    const [first, second, third] = bases;
    if (first && second && third) scoreRunner(third, false, false);
    bases[2] = first && second ? second : third;
    bases[1] = first ? first : second;
    bases[0] = hitter;
    return advancement;
  }

  if (outcome.type === "walk") {
    const [first, second, third] = bases;
    if (first && second && third) scoreRunner(third, true);
    bases[2] = first && second ? second : third;
    bases[1] = first ? first : second;
    bases[0] = hitter;
    return advancement;
  }

  if (outcome.type === "single") {
    const [first, second, third] = bases;
    bases[0] = hitter;
    bases[1] = null;
    bases[2] = null;
    scoreRunner(third, true);
    if (second) {
      const secondScores = rollUnit(seed, "single-second", plateAppearance, second.id) < 0.52 + safeNumber(second.speed, 10) * 0.008;
      if (secondScores) scoreRunner(second, true);
      else placeRunner(bases, 2, second, scoreRunner);
    }
    if (first) {
      const firstToThird = rollUnit(seed, "single-first", plateAppearance, first.id) < 0.22 + safeNumber(first.baserunning, first.speed) * 0.013;
      placeRunner(bases, firstToThird ? 2 : 1, first, scoreRunner);
    }
    return advancement;
  }

  if (outcome.type === "double") {
    const [first, second, third] = bases;
    bases[0] = null;
    bases[1] = hitter;
    bases[2] = null;
    scoreRunner(third, true);
    scoreRunner(second, true);
    if (first) {
      const firstScores = rollUnit(seed, "double-first", plateAppearance, first.id) < 0.32 + safeNumber(first.speed, 10) * 0.011;
      if (firstScores) scoreRunner(first, true);
      else placeRunner(bases, 2, first, scoreRunner);
    }
    return advancement;
  }

  if (outcome.type === "triple") {
    for (const runner of bases) scoreRunner(runner, true);
    bases[0] = null;
    bases[1] = null;
    bases[2] = hitter;
    return advancement;
  }

  if (outcome.type === "homeRun") {
    for (const runner of bases) scoreRunner(runner, true);
    bases[0] = null;
    bases[1] = null;
    bases[2] = null;
    scoreRunner(hitter, true);
    return advancement;
  }

  return advancement;
}

function placeRunner(bases, targetBase, runner, scoreRunner) {
  if (!runner) return;
  for (let base = Math.min(targetBase, bases.length - 1); base >= 0; base -= 1) {
    if (!bases[base]) {
      bases[base] = runner;
      return;
    }
  }
  scoreRunner(runner, true);
}

function inningEnded(previousOuts, currentOuts) {
  return Math.floor(previousOuts / 3) !== Math.floor(currentOuts / 3);
}

function clearBases(bases) {
  bases[0] = null;
  bases[1] = null;
  bases[2] = null;
}

function maybeAttemptSteal({ bases, pitcher, seed, plateAppearance, side, gamePlan }) {
  const runner = bases[0];
  if (!runner || bases[1]) return { outs: 0 };

  const speed = safeNumber(runner.speed, 10);
  const stealing = safeNumber(runner.stealing, speed);
  const tempoMultiplier = gamePlan?.baserunning === "aggressive" ? 1.55 : gamePlan?.baserunning === "conservative" ? 0.58 : 1;
  const personalityBoost = safeNumber(runner.personality?.traits?.pressure, 10) >= 15 ? 1.08 : 1;
  const attemptRate = clamp((speed + stealing - 18) * 0.008 * tempoMultiplier * personalityBoost, 0, 0.24);
  if (rollUnit(seed, side, "steal-attempt", plateAppearance, runner.id) >= attemptRate) return { outs: 0 };

  const hold = safeNumber(pitcher?.holdRunners, 10);
  const successRate = clamp(0.62 + (speed + stealing - 20) * 0.012 - (hold - 10) * 0.012, 0.52, 0.9);
  const battingStats = ensureBattingStats(runner);

  if (rollUnit(seed, side, "steal-success", plateAppearance, runner.id) < successRate) {
    battingStats.stolenBases += 1;
    bases[1] = runner;
    bases[0] = null;
    return { outs: 0, attempted: true, success: true, runner };
  }

  battingStats.caughtStealing += 1;
  bases[0] = null;
  return { outs: 1, attempted: true, success: false, runner };
}

function applyBattingEvent(hitter, outcome, advancement) {
  const stats = ensureBattingStats(hitter);
  stats.plateAppearances += 1;
  if (outcome.isAtBat) stats.atBats += 1;
  if (outcome.type === "walk") stats.walks += 1;
  if (outcome.type === "strikeout") stats.strikeouts += 1;
  if (outcome.doublePlay) stats.groundedDoublePlays = safeNumber(stats.groundedDoublePlays) + 1;
  if (outcome.type === "error") stats.reachedOnErrors = safeNumber(stats.reachedOnErrors) + 1;
  if (advancement.hits > 0) {
    stats.hits += 1;
    stats.totalBases += outcome.bases;
  }
  if (outcome.type === "double") stats.doubles += 1;
  if (outcome.type === "triple") stats.triples += 1;
  if (outcome.type === "homeRun") stats.homeRuns += 1;
  stats.rbi += advancement.rbi;
}

function applyPitchingEvent(pitcher, outcome, advancement) {
  if (!pitcher) return;
  const stats = ensurePitchingStats(pitcher);
  stats.battersFaced += 1;
  stats.pitches += pitchEstimate(outcome);
  stats.inningsOuts += advancement.outs;
  if (advancement.hits > 0) stats.hitsAllowed += 1;
  if (outcome.type === "homeRun") stats.homeRunsAllowed += 1;
  if (outcome.type === "walk") stats.walksAllowed += 1;
  if (outcome.type === "strikeout") stats.strikeouts += 1;
  stats.runsAllowed += advancement.runs;
  stats.earnedRuns += safeNumber(advancement.earnedRuns, advancement.runs);
}

function choosePitcherForPlateAppearance(pitchingPlan, result, outs) {
  if (!pitchingPlan?.starter) return null;
  const starterLine = getExistingGamePitchingLine(result, pitchingPlan.starter);

  if (
    outs < pitchingPlan.starterTargetOuts &&
    safeNumber(starterLine?.pitches) < pitchingPlan.starterPitchLimit &&
    safeNumber(starterLine?.runsAllowed) < 5
  ) {
    return pitchingPlan.starter;
  }

  const preferredRoles = preferredBullpenRolesForOuts(outs);
  for (const role of preferredRoles) {
    for (const candidate of pitchingPlan.bullpen ?? []) {
      if (bullpenRoleForPitcher(pitchingPlan, candidate) !== role) continue;
      const line = getExistingGamePitchingLine(result, candidate);
      if (!line || safeNumber(line.pitches) < 28) return candidate;
    }
  }

  for (const candidate of pitchingPlan.bullpen ?? []) {
    const line = getExistingGamePitchingLine(result, candidate);
    if (!line || safeNumber(line.pitches) < 28) return candidate;
  }

  return pitchingPlan.bullpen.at(-1) ?? pitchingPlan.starter;
}

function preferredBullpenRolesForOuts(outs) {
  if (outs >= 24) return ["CL", "SU", "MR", "LR", "RP"];
  if (outs >= 21) return ["SU", "CL", "MR", "LR", "RP"];
  return ["LR", "MR", "SU", "CL", "RP"];
}

function applyGamePitchingEvent(result, pitcher, pitchingPlan, outcome, advancement) {
  if (!pitcher) return;
  const line = getGamePitchingLine(result, pitcher, pitcher === pitchingPlan?.starter ? "SP" : bullpenRoleForPitcher(pitchingPlan, pitcher));
  line.battersFaced += 1;
  line.pitches += pitchEstimate(outcome);
  line.inningsOuts += advancement.outs;
  if (advancement.hits > 0) line.hitsAllowed += 1;
  if (outcome.type === "homeRun") line.homeRunsAllowed += 1;
  if (outcome.type === "walk") line.walksAllowed += 1;
  if (outcome.type === "strikeout") line.strikeouts += 1;
  line.runsAllowed += advancement.runs;
  line.earnedRuns += safeNumber(advancement.earnedRuns, advancement.runs);
}

function creditPitcherOuts(pitcher, result, outs) {
  if (!pitcher || !outs) return;
  ensurePitchingStats(pitcher).inningsOuts += outs;
  const line = getGamePitchingLine(result, pitcher, "RP");
  line.inningsOuts += outs;
}

function getExistingGamePitchingLine(result, pitcher) {
  const key = String(pitcher?.id ?? pitcher?.name ?? "");
  return key ? result.pitchingLines.get(key) : null;
}

function getGamePitchingLine(result, pitcher, role) {
  const key = String(pitcher?.id ?? pitcher?.name ?? result.pitchingLines.size);
  if (!result.pitchingLines.has(key)) {
    const seasonStats = ensurePitchingStats(pitcher);
    seasonStats.games += 1;
    if (role === "SP") seasonStats.gamesStarted += 1;
    result.usedPitchers.push(pitcher);
    result.pitchingLines.set(key, {
      playerId: key,
      name: pitcher?.name ?? "",
      role,
      appearanceOrder: result.pitchingLines.size + 1,
      decisions: [],
      decision: "",
      inningsOuts: 0,
      battersFaced: 0,
      hitsAllowed: 0,
      runsAllowed: 0,
      earnedRuns: 0,
      homeRunsAllowed: 0,
      walksAllowed: 0,
      strikeouts: 0,
      pitches: 0
    });
  }
  return result.pitchingLines.get(key);
}

function applyGameBatterEvent(result, hitter, outcome, advancement) {
  const line = getGameBatterLine(result, hitter);
  line.plateAppearances += 1;
  line.atBats += outcome.isAtBat ? 1 : 0;
  line.runs += advancement.scoredRunners.filter((runner) => String(runner.id) === String(hitter.id ?? hitter.name)).length;
  line.hits += advancement.hits;
  line.doubles += outcome.type === "double" ? 1 : 0;
  line.triples += outcome.type === "triple" ? 1 : 0;
  line.homeRuns += outcome.type === "homeRun" ? 1 : 0;
  line.rbi += advancement.rbi;
  line.walks += outcome.type === "walk" ? 1 : 0;
  line.strikeouts += outcome.type === "strikeout" ? 1 : 0;
  line.reachedOnErrors += outcome.type === "error" ? 1 : 0;
  line.groundedDoublePlays += outcome.doublePlay ? 1 : 0;
}

function applyGameStealEvent(result, steal) {
  if (!steal?.attempted || !steal.runner) return;
  const line = getGameBatterLine(result, steal.runner);
  if (steal.success) {
    result.stolenBases += 1;
    line.stolenBases += 1;
  } else {
    result.caughtStealing += 1;
    line.caughtStealing += 1;
  }
}

function getGameBatterLine(result, player) {
  const key = String(player?.id ?? player?.name ?? result.batterLines.size);
  if (!result.batterLines.has(key)) {
    result.batterLines.set(key, {
      playerId: key,
      name: player?.name ?? "",
      position: player?.position ?? "",
      battingOrder: result.batterLines.size + 1,
      plateAppearances: 0,
      atBats: 0,
      runs: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      rbi: 0,
      walks: 0,
      strikeouts: 0,
      reachedOnErrors: 0,
      groundedDoublePlays: 0,
      stolenBases: 0,
      caughtStealing: 0
    });
  }
  return result.batterLines.get(key);
}

function addPlateAppearanceEvent(result, input) {
  const event = {
    type: "plateAppearance",
    gameId: input.gameId,
    side: input.side,
    inning: input.inning,
    sequence: result.plateAppearanceEvents.length + 1,
    offenseTeamId: input.offense.id,
    defenseTeamId: input.defense.id,
    hitterId: input.hitter?.id ?? "",
    hitterName: input.hitter?.name ?? "",
    pitcherId: input.pitcher?.id ?? "",
    pitcherName: input.pitcher?.name ?? "",
    outcome: input.outcome.type,
    battedBallType: input.outcome.battedBallType ?? "",
    fieldingPosition: input.outcome.fieldingPosition ?? "",
    defenderId: input.outcome.defender?.id ?? "",
    defenderName: input.outcome.defender?.name ?? "",
    doublePlay: Boolean(input.outcome.doublePlay),
    reachedOnError: Boolean(input.outcome.reachedOnError),
    ballparkId: input.outcome.ballpark?.parkId ?? input.ballpark?.parkId ?? "",
    ballparkName: input.outcome.ballpark?.name ?? input.ballpark?.name ?? "",
    runs: input.advancement.runs,
    earnedRuns: safeNumber(input.advancement.earnedRuns, input.advancement.runs),
    rbi: input.advancement.rbi,
    outsBefore: input.outsBefore,
    outsAfter: input.outsAfter,
    basesBefore: toBaseOccupancy(input.basesBefore),
    basesAfter: toBaseOccupancy(input.basesAfter),
    scoredRunners: (input.advancement?.scoredRunners ?? []).map((runner) => ({
      id: runner.id ?? "",
      name: runner.name ?? ""
    })),
    inningEnded: Boolean(input.inningEnded)
  };

  result.plateAppearanceEvents.push(event);
  if (event.runs > 0) {
    result.scoringEvents.push(event);
  }
}

function applyPitcherDecisions({ awayRuns, homeRuns, awayLines, homeLines, awayPitchers, homePitchers }) {
  if (awayRuns === homeRuns) {
    return { winner: null, loser: null, save: null, holds: [] };
  }

  const awayPitcherMap = mapPitchersById(awayPitchers);
  const homePitcherMap = mapPitchersById(homePitchers);
  const winningSide = awayRuns > homeRuns ? "away" : "home";
  const margin = Math.abs(awayRuns - homeRuns);
  const winningLines = winningSide === "away" ? awayLines : homeLines;
  const losingLines = winningSide === "away" ? homeLines : awayLines;
  const winningPitcherMap = winningSide === "away" ? awayPitcherMap : homePitcherMap;
  const losingPitcherMap = winningSide === "away" ? homePitcherMap : awayPitcherMap;
  const winningLine = selectWinningPitcherLine(winningLines);
  const losingLine = selectLosingPitcherLine(losingLines);
  const saveLine = selectSaveLine(winningLines, winningLine, margin);
  const holdLines = selectHoldLines(winningLines, winningLine, saveLine, margin);

  markPitchingDecision(winningLine, winningPitcherMap, "wins", "W");
  markPitchingDecision(losingLine, losingPitcherMap, "losses", "L");
  markPitchingDecision(saveLine, winningPitcherMap, "saves", "S");
  for (const line of holdLines) {
    markPitchingDecision(line, winningPitcherMap, "holds", "H");
  }

  return {
    winner: decisionPlayerView(winningLine),
    loser: decisionPlayerView(losingLine),
    save: decisionPlayerView(saveLine),
    holds: holdLines.map(decisionPlayerView).filter(Boolean)
  };
}

function selectWinningPitcherLine(lines) {
  const starter = lines.find((line) => line.role === "SP");
  if (starter && safeNumber(starter.inningsOuts) >= 15) return starter;

  return [...lines]
    .filter((line) => line.role !== "SP")
    .sort((a, b) =>
      safeNumber(b.inningsOuts) - safeNumber(a.inningsOuts) ||
      safeNumber(a.runsAllowed) - safeNumber(b.runsAllowed) ||
      safeNumber(a.appearanceOrder) - safeNumber(b.appearanceOrder)
    )[0] ?? starter ?? lines[0] ?? null;
}

function selectLosingPitcherLine(lines) {
  return [...lines].sort((a, b) =>
    safeNumber(b.runsAllowed) - safeNumber(a.runsAllowed) ||
    (a.role === "SP" ? -1 : 0) - (b.role === "SP" ? -1 : 0) ||
    safeNumber(a.appearanceOrder) - safeNumber(b.appearanceOrder)
  )[0] ?? null;
}

function selectSaveLine(lines, winningLine, margin) {
  const finalReliever = [...lines]
    .filter((line) => line.role !== "SP")
    .sort((a, b) => safeNumber(b.appearanceOrder) - safeNumber(a.appearanceOrder))[0];

  if (!finalReliever || finalReliever === winningLine) return null;
  if (margin <= 3 || safeNumber(finalReliever.inningsOuts) >= 9) return finalReliever;
  return null;
}

function selectHoldLines(lines, winningLine, saveLine, margin) {
  if (!saveLine || margin > 3) return [];
  return [...lines]
    .filter((line) =>
      line.role !== "SP" &&
      line !== winningLine &&
      line !== saveLine &&
      safeNumber(line.inningsOuts) > 0 &&
      safeNumber(line.runsAllowed) === 0 &&
      safeNumber(line.appearanceOrder) < safeNumber(saveLine.appearanceOrder)
    )
    .sort((a, b) => safeNumber(a.appearanceOrder) - safeNumber(b.appearanceOrder))
    .slice(0, 3);
}

function markPitchingDecision(line, pitcherMap, statKey, label) {
  if (!line) return;
  const player = pitcherMap.get(String(line.playerId ?? ""));
  if (player) {
    const stats = ensurePitchingStats(player);
    stats[statKey] = safeNumber(stats[statKey]) + 1;
  }
  line.decisions = Array.isArray(line.decisions) ? line.decisions : [];
  if (!line.decisions.includes(label)) line.decisions.push(label);
  line.decision = line.decisions.join("/");
}

function mapPitchersById(pitchers) {
  return new Map((pitchers ?? []).map((pitcher) => [String(pitcher?.id ?? ""), pitcher]));
}

function decisionPlayerView(line) {
  if (!line) return null;
  return {
    playerId: line.playerId,
    name: line.name,
    role: line.role,
    decision: line.decision ?? ""
  };
}

function pitchEstimate(outcome) {
  if (outcome.type === "walk") return 5;
  if (outcome.type === "strikeout") return 4;
  if (outcome.type === "homeRun") return 3;
  if (outcome.type === "error") return 3;
  if (outcome.bases > 0) return 3;
  return 4;
}

function ensureSeasonStats(player) {
  if (!player) return null;
  player.seasonStats = player.seasonStats && typeof player.seasonStats === "object" ? player.seasonStats : {};
  player.seasonStats.batting = {
    games: 0,
    plateAppearances: 0,
    atBats: 0,
    runs: 0,
    hits: 0,
    doubles: 0,
    triples: 0,
    homeRuns: 0,
    rbi: 0,
    walks: 0,
    strikeouts: 0,
    reachedOnErrors: 0,
    groundedDoublePlays: 0,
    stolenBases: 0,
    caughtStealing: 0,
    totalBases: 0,
    ...(player.seasonStats.batting ?? {})
  };
  player.seasonStats.pitching = {
    games: 0,
    gamesStarted: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    holds: 0,
    blownSaves: 0,
    inningsOuts: 0,
    battersFaced: 0,
    hitsAllowed: 0,
    runsAllowed: 0,
    earnedRuns: 0,
    homeRunsAllowed: 0,
    walksAllowed: 0,
    strikeouts: 0,
    pitches: 0,
    ...(player.seasonStats.pitching ?? {})
  };
  player.seasonStats.fielding = {
    games: 0,
    errors: 0,
    ...(player.seasonStats.fielding ?? {})
  };
  return player.seasonStats;
}

function ensureBattingStats(player) {
  return ensureSeasonStats(player).batting;
}

function ensurePitchingStats(player) {
  return ensureSeasonStats(player).pitching;
}

function teamDefenseQuality(team) {
  return buildDefenseContext(team).overall;
}

function buildDefenseContext(team, lineup = null) {
  const players = (Array.isArray(lineup) && lineup.length ? lineup : team?.roster ?? [])
    .filter((player) => player?.role === "hitter");
  if (!players.length) {
    return {
      defenders: [],
      catcher: [],
      infield: [],
      outfield: [],
      overall: 10,
      infieldQuality: 10,
      outfieldQuality: 10,
      catcherQuality: 10,
      doublePlayQuality: 10
    };
  }

  const catcher = topFielders(players, (player) => player.position === "C", "C", 1);
  const infield = topFielders(players, (player) => ["IF", "1B", "2B", "3B", "SS"].includes(player.position), "IF", 4);
  const outfield = topFielders(players, (player) => ["OF", "LF", "CF", "RF"].includes(player.position), "OF", 3);
  const defenders = uniquePlayers([...catcher, ...infield, ...outfield].map((entry) => entry.defender).filter(Boolean));
  const infieldQuality = averageNumbers(...infield.map((entry) => entry.quality));
  const outfieldQuality = averageNumbers(...outfield.map((entry) => entry.quality));
  const catcherQuality = averageNumbers(...catcher.map((entry) => entry.quality));
  const doublePlayQuality = averageNumbers(
    infieldQuality,
    ...infield
      .filter((entry) => ["2B", "SS", "IF"].includes(entry.position))
      .map((entry) => entry.quality)
  );

  return {
    defenders,
    catcher,
    infield,
    outfield,
    overall: averageNumbers(infieldQuality, outfieldQuality, catcherQuality),
    infieldQuality,
    outfieldQuality,
    catcherQuality,
    doublePlayQuality
  };
}

function topFielders(players, predicate, fallbackPosition, count) {
  const pool = players.filter(predicate);
  const candidates = pool.length ? pool : players;
  return [...candidates]
    .map((player) => ({
      position: normalizeDefensePosition(player, fallbackPosition),
      defender: player,
      quality: playerDefenseQuality(player, fallbackPosition)
    }))
    .sort((a, b) => safeNumber(b.quality) - safeNumber(a.quality) || safeNumber(b.defender?.ovr) - safeNumber(a.defender?.ovr))
    .slice(0, count);
}

function normalizeDefensePosition(player, fallbackPosition) {
  const position = String(player?.position ?? fallbackPosition);
  if (fallbackPosition === "OF" && ["LF", "CF", "RF", "OF"].includes(position)) return position;
  if (fallbackPosition === "IF" && ["1B", "2B", "3B", "SS", "IF"].includes(position)) return position;
  if (fallbackPosition === "C" && position === "C") return "C";
  return fallbackPosition;
}

function playerDefenseQuality(player, fallbackPosition) {
  const defense = safeNumber(player?.defense, 10);
  const range = safeNumber(player?.range, defense);
  const arm = safeNumber(player?.arm, defense);
  const speed = safeNumber(player?.speed, 10);
  const catching = safeNumber(player?.catching, defense);
  if (fallbackPosition === "C") return defense * 0.4 + catching * 0.38 + arm * 0.22;
  if (fallbackPosition === "OF") return range * 0.44 + defense * 0.3 + arm * 0.18 + speed * 0.08;
  return defense * 0.43 + range * 0.36 + arm * 0.13 + speed * 0.08;
}

function uniquePlayers(players) {
  const seen = new Set();
  const unique = [];
  for (const player of players) {
    const key = String(player?.id ?? player?.name ?? unique.length);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(player);
  }
  return unique;
}

function applyFieldingError(defender) {
  if (!defender) return;
  ensureSeasonStats(defender).fielding.errors += 1;
}

function buildBoxScore({ away, home, awayPitchingPlan, homePitchingPlan, awayOffense, homeOffense }) {
  return {
    linescore: {
      innings: Array.from({ length: 9 }, (_, index) => index + 1),
      away: {
        teamId: away.id,
        team: away.shortName ?? away.name,
        runsByInning: awayOffense.runsByInning,
        runs: awayOffense.runs,
        hits: awayOffense.hits,
        errors: homeOffense.defenseErrors,
        leftOnBase: awayOffense.leftOnBase
      },
      home: {
        teamId: home.id,
        team: home.shortName ?? home.name,
        runsByInning: homeOffense.runsByInning,
        runs: homeOffense.runs,
        hits: homeOffense.hits,
        errors: awayOffense.defenseErrors,
        leftOnBase: homeOffense.leftOnBase
      }
    },
    batting: {
      away: awayOffense.batterLines,
      home: homeOffense.batterLines
    },
    pitching: {
      away: homeOffense.pitchingLines,
      home: awayOffense.pitchingLines
    },
    pitchingPlan: {
      away: summarizePitchingPlan(awayPitchingPlan),
      home: summarizePitchingPlan(homePitchingPlan)
    },
    totals: {
      plateAppearances: awayOffense.plateAppearances + homeOffense.plateAppearances,
      pitches: awayOffense.pitches + homeOffense.pitches,
      homeRuns: awayOffense.homeRuns + homeOffense.homeRuns,
      stolenBases: awayOffense.stolenBases + homeOffense.stolenBases,
      reachedOnErrors: awayOffense.reachedOnErrors + homeOffense.reachedOnErrors,
      doublePlays: awayOffense.doublePlays + homeOffense.doublePlays,
      errors: awayOffense.defenseErrors + homeOffense.defenseErrors,
      pitchersUsed: awayOffense.pitchingLines.length + homeOffense.pitchingLines.length
    }
  };
}

function summarizePitchingPlan(plan) {
  return {
    starter: plan?.starter ? toPitchingRole(plan.starter, "starter", 1) : null,
    bullpen: (plan?.bullpen ?? []).map((player, index) => toPitchingRole(player, bullpenRole(index), index + 1)),
    starterTargetOuts: safeNumber(plan?.starterTargetOuts),
    starterPitchLimit: safeNumber(plan?.starterPitchLimit)
  };
}

function mergeGameEvents(...eventGroups) {
  return eventGroups
    .flat()
    .sort((a, b) => {
      const inningDiff = safeNumber(a.inning) - safeNumber(b.inning);
      if (inningDiff !== 0) return inningDiff;
      const halfDiff = (a.side === "home" ? 1 : 0) - (b.side === "home" ? 1 : 0);
      if (halfDiff !== 0) return halfDiff;
      return safeNumber(a.sequence) - safeNumber(b.sequence);
    });
}

function sortGameBatterLines(a, b) {
  return safeNumber(a.battingOrder) - safeNumber(b.battingOrder);
}

function sortGamePitchingLines(a, b) {
  const roleOrder = { SP: 0, LR: 1, MR: 2, SU: 3, CL: 4, RP: 5 };
  const roleDiff = safeNumber(roleOrder[a.role], 9) - safeNumber(roleOrder[b.role], 9);
  if (roleDiff !== 0) return roleDiff;
  return compareText(a.name, b.name);
}

function buildGameFinalEvent(game) {
  return {
    id: `event-${game.id}`,
    type: "game.final",
    date: game.date,
    gameId: game.id,
    teams: {
      away: game.awayTeamId,
      home: game.homeTeamId
    },
    score: {
      away: game.awayScore,
      home: game.homeScore
    },
    totals: {
      runs: game.totalRuns,
      hits: safeNumber(game.awayHits) + safeNumber(game.homeHits),
      homeRuns: safeNumber(game.awayHomeRuns) + safeNumber(game.homeHomeRuns),
      plateAppearances: safeNumber(game.boxScore?.totals?.plateAppearances)
    },
    managerPlans: game.managerPlans ?? null
  };
}

function buildTradeCompletedEvent(trade) {
  return {
    id: `event-${trade.id}`,
    type: "trade.completed",
    date: trade.date,
    tradeId: trade.id,
    teams: {
      buyer: trade.buyerTeamId,
      seller: trade.sellerTeamId
    },
    assets: {
      incomingPlayerId: trade.incoming?.playerId ?? "",
      outgoingPlayerId: trade.outgoing?.playerId ?? "",
      additionalAssetTypes: (trade.additionalAssets ?? []).map((asset) => asset.assetType),
      cashKRW: (trade.additionalAssets ?? []).reduce((total, asset) => total + (asset.assetType === "cash" ? safeNumber(asset.amountKRW) : 0), 0),
      draftPickCount: (trade.additionalAssets ?? []).filter((asset) => asset.assetType === "draftPick").length,
      conditionalCount: (trade.additionalAssets ?? []).filter((asset) => asset.assetType === "conditional").length,
      ptbnlCount: (trade.additionalAssets ?? []).filter((asset) => asset.assetType === "ptbnl").length
    },
    summary: trade.summary,
    valueBalance: safeNumber(trade.valueBalance),
    acceptanceScore: safeNumber(trade.acceptanceScore)
  };
}

function appendEvent(state, event) {
  state.eventLog = [event, ...(Array.isArray(state.eventLog) ? state.eventLog : [])].slice(0, EVENT_LOG_LIMIT);
}

function makeGameId(dateKey, gameIndex, awayTeamId, homeTeamId, gamesPlayed) {
  return `${dateKey}-${gameIndex + 1}-${awayTeamId}-${homeTeamId}-${gamesPlayed + gameIndex + 1}`;
}

function countOccupiedBases(bases) {
  return bases.filter(Boolean).length;
}

function toBaseOccupancy(value) {
  return Array.isArray(value)
    ? [Boolean(value[0]), Boolean(value[1]), Boolean(value[2])]
    : [false, false, false];
}

function buildPitchingPlan(team) {
  const pitchers = getAvailablePitchers(team);
  if (hasManualPitchingPlan(team)) {
    return buildManualGamePitchingPlan(team, pitchers);
  }

  const rotationEntries = pitchers
    .map((player, index) => ({ player, index, score: starterScore(player) }))
    .sort(comparePitcherEntries)
    .slice(0, Math.min(5, pitchers.length));
  const rotation = rotationEntries.map((entry) => entry.player);
  const rotationIds = new Set(rotation.map((player) => player.id));
  const fallbackBullpen = pitchers.filter((player) => !rotationIds.has(player.id));
  const bullpen = fallbackBullpen
    .map((player, index) => ({ player, index, score: bullpenScore(player) }))
    .sort(comparePitcherEntries)
    .slice(0, 7)
    .map((entry) => entry.player);
  const starter = rotation[nextRotationIndex(team, rotation.length)] ?? rotation[0] ?? pitchers[0] ?? null;
  const starterTargetOuts = clamp(Math.round(12 + safeNumber(starter?.stamina, 10) * 0.7), 15, 21);
  const starterPitchLimit = clamp(Math.round(72 + safeNumber(starter?.stamina, 10) * 2.1 + (safeNumber(starter?.armFreshness, 80) - 70) * 0.45), 78, 106);

  return {
    teamId: team?.id ?? "",
    starter,
    rotation,
    bullpen: bullpen.length ? bullpen : pitchers.filter((player) => player !== starter).slice(0, 4),
    starterTargetOuts,
    starterPitchLimit,
    policy: {
      hookFatigue: 34,
      lateLeadRole: "CL"
    }
  };
}

function buildManualGamePitchingPlan(team, pitchers) {
  const rotation = resolveManualRotation(team, pitchers);
  const bullpenPlan = resolveManualBullpen(team, pitchers, rotation);
  const starter = rotation[nextRotationIndex(team, rotation.length)] ?? rotation[0] ?? pitchers[0] ?? null;
  const starterTargetOuts = clamp(Math.round(12 + safeNumber(starter?.stamina, 10) * 0.7), 15, 21);
  const starterPitchLimit = clamp(Math.round(72 + safeNumber(starter?.stamina, 10) * 2.1 + (safeNumber(starter?.armFreshness, 80) - 70) * 0.45), 78, 106);

  return {
    teamId: team?.id ?? "",
    starter,
    rotation,
    bullpen: bullpenPlan.bullpen.length ? bullpenPlan.bullpen : pitchers.filter((player) => player !== starter).slice(0, 4),
    bullpenRoles: bullpenPlan.roles,
    starterTargetOuts,
    starterPitchLimit,
    manual: true,
    policy: {
      hookFatigue: 34,
      lateLeadRole: "CL"
    }
  };
}

function getAvailablePitchers(team) {
  const pitchers = [...(team?.roster ?? [])]
    .filter((player) =>
      player.role === "pitcher" &&
      safeNumber(player.injuredDays) === 0 &&
      !player.gameRestriction &&
      player.militaryStatus?.availability !== "unavailable"
    );
  const activePitchers = pitchers.filter(isActiveRosterPlayer);
  return activePitchers.length >= ACTIVE_PITCHER_MIN_REQUIRED ? activePitchers : pitchers;
}

function nextRotationIndex(team, length = 5) {
  const rotationLength = Math.max(1, length);
  const games = safeNumber(team?.wins) + safeNumber(team?.losses) + safeNumber(team?.ties);
  return Math.floor(games) % rotationLength;
}

function starterScore(player) {
  return pitcherScore(player) + safeNumber(player.stamina) * 0.9 + safeNumber(player.pitchingIQ, player.control) * 0.18;
}

function bullpenScore(player) {
  return pitcherScore(player) + safeNumber(player.armFreshness, 80) * 0.18 + safeNumber(player.velocity, player.stuff) * 0.25 - safeNumber(player.stamina) * 0.16;
}

function comparePitcherEntries(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  return a.index - b.index;
}

function toPitchingRole(player, role, order) {
  return {
    id: player?.id ?? "",
    name: player?.name ?? "",
    role,
    order,
    position: player?.position ?? "P",
    ovr: safeNumber(player?.ovr),
    stamina: safeNumber(player?.stamina),
    armFreshness: safeNumber(player?.armFreshness, 80),
    fatigue: safeNumber(player?.fatigue)
  };
}

function bullpenRole(index) {
  if (index === 0) return "LR";
  if (index <= 3) return "MR";
  if (index <= 5) return "SU";
  return "CL";
}

function bullpenRoleForPitcher(plan, pitcher) {
  const playerId = String(pitcher?.id ?? "");
  const plannedRole = playerId ? plan?.bullpenRoles?.[playerId] : "";
  if (plannedRole) return plannedRole;
  const index = (plan?.bullpen ?? []).findIndex((entry) => String(entry.id) === String(pitcher?.id));
  return index === -1 ? "RP" : bullpenRole(index);
}

function applyRosterUsage(team, lineup, pitchingUsage, seed, positiveResult) {
  const pitcherSet = new Set((pitchingUsage?.players ?? []).map((player) => String(player?.id ?? "")));
  const pitchCounts = new Map((pitchingUsage?.lines ?? []).map((line) => [String(line.playerId ?? ""), safeNumber(line.pitches)]));

  for (const player of team.roster ?? []) {
    if (safeNumber(player.injuredDays) > 0) continue;

    const pitcherPitches = pitchCounts.get(String(player.id ?? "")) ?? 0;
    const pitched = pitcherSet.has(String(player.id ?? ""));
    const played = lineup.includes(player) || pitched;
    const fatigueChange = played ? (player.role === "pitcher" ? Math.ceil(pitcherPitches / 9) + 2 : 5) : -4;
    player.fatigue = clamp(safeNumber(player.fatigue) + fatigueChange, 0, 100);

    const formDrift = positiveResult ? 1 : -1;
    const personalDrift = deterministicRange(seed, player.id ?? player.name, -1, 1);
    player.form = clamp(safeNumber(player.form) + formDrift + personalDrift, 35, 75);
    player.sharpness = clamp(
      safeNumber(player.sharpness, player.form) + formDrift + (played ? 1 : -1) + personalDrift,
      25,
      95
    );
    player.dailyCondition = clamp(
      safeNumber(player.dailyCondition, player.form) +
        deterministicRange(seed + 300, player.id ?? player.name, -2, 2) +
        (positiveResult ? 1 : 0) -
        Math.floor(safeNumber(player.fatigue) / 40),
      25,
      95
    );
    if (player.role === "pitcher") {
      const armDelta = pitched ? -(Math.ceil(pitcherPitches / 6) + 3) : 4;
      player.armFreshness = clamp(safeNumber(player.armFreshness, 80) + armDelta, 20, 100);
    }

    const injuryRoll = deterministicRange(seed + 500, player.id ?? player.name, 0, 999);
    const injuryResistance = safeNumber(player.injuryResistance, 10);
    const risk = played ? 4 + Math.floor(player.fatigue / 18) + Math.max(0, 12 - injuryResistance) : 1;
    if (injuryRoll < risk) {
      player.injuredDays = deterministicRange(seed + 900, player.id ?? player.name, 2, 14);
      player.fatigue = clamp(player.fatigue - 12, 0, 100);
    }
  }
}

function recoverRoster(teams) {
  for (const team of teams) {
    for (const player of team.roster ?? []) {
      player.fatigue = clamp(safeNumber(player.fatigue) - 2, 0, 100);
      player.dailyCondition = clamp(safeNumber(player.dailyCondition, player.form) + 1, 25, 95);
      player.sharpness = clamp(safeNumber(player.sharpness, player.form), 25, 95);
      if (player.role === "pitcher") {
        player.armFreshness = clamp(safeNumber(player.armFreshness, 80) + 5, 20, 100);
      }
      if (safeNumber(player.injuredDays) > 0) {
        player.fatigue = clamp(player.fatigue - 5, 0, 100);
        player.dailyCondition = clamp(safeNumber(player.dailyCondition, player.form) - 2, 20, 95);
      }
    }
  }
}

function tickInjuries(teams) {
  for (const team of teams) {
    for (const player of team.roster ?? []) {
      if (safeNumber(player.injuredDays) > 0) {
        player.injuredDays = Math.max(0, safeNumber(player.injuredDays) - 1);
      }
    }
  }
}

function selectPitcher(team) {
  return getAvailablePitchers(team)
    .map((player, index) => ({ player, index, score: pitcherScore(player) }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.index - b.index;
    })[0]?.player;
}

function isActiveRosterPlayer(player) {
  return player?.status === "active" && !player.gameRestriction;
}

function hitterScore(player) {
  const injuryPenalty = safeNumber(player.injuredDays) > 0 ? 80 + safeNumber(player.injuredDays) * 2 : 0;
  const contact = averageNumbers(safeNumber(player.contactL, player.contact), safeNumber(player.contactR, player.contact));
  const power = averageNumbers(safeNumber(player.powerL, player.power), safeNumber(player.powerR, player.power));
  const running = averageNumbers(safeNumber(player.speed), safeNumber(player.stealing, player.speed), safeNumber(player.baserunning, player.speed));
  return (
    rating100(player.ovr) * 1.75 +
    safeNumber(player.form) * 0.32 +
    (safeNumber(player.dailyCondition, player.form) - 50) * 0.28 +
    (safeNumber(player.sharpness, player.form) - 50) * 0.3 +
    (safeNumber(player.morale, 50) - 50) * 0.08 +
    contact * 0.35 +
    power * 0.25 +
    safeNumber(player.eye) * 0.2 +
    safeNumber(player.patience, player.eye) * 0.14 +
    safeNumber(player.situational, contact) * 0.12 +
    safeNumber(player.battedBall, power) * 0.18 +
    running * 0.12 -
    safeNumber(player.fatigue) * 0.55 -
    injuryPenalty -
    anonymousReadinessPenalty(player)
  );
}

function pitcherScore(player) {
  if (!player) return 48;
  const injuryPenalty = safeNumber(player.injuredDays) > 0 ? 100 : 0;
  return (
    rating100(player.ovr) * 1.65 +
    safeNumber(player.form) * 0.28 +
    (safeNumber(player.dailyCondition, player.form) - 50) * 0.24 +
    (safeNumber(player.sharpness, player.form) - 50) * 0.22 +
    (safeNumber(player.armFreshness, 80) - 70) * 0.16 +
    safeNumber(player.stuff) * 0.28 +
    safeNumber(player.control) * 0.24 +
    safeNumber(player.velocity, player.stuff) * 0.14 +
    safeNumber(player.stamina) * 0.14 +
    safeNumber(player.movement) * 0.22 +
    safeNumber(player.hrSuppression, player.movement) * 0.14 +
    safeNumber(player.pitchingIQ, player.control) * 0.14 -
    safeNumber(player.fatigue) * 0.62 -
    injuryPenalty -
    anonymousReadinessPenalty(player)
  );
}

function teamOffense(lineup) {
  if (lineup.length === 0) return -1.1;
  return (lineup.reduce((total, player) => total + hitterScore(player), 0) / lineup.length - 130) / 18;
}

function pitcherPrevention(pitcher) {
  return (pitcherScore(pitcher) - 125) / 22;
}

function clubMood(team) {
  return (safeNumber(team.morale, 50) - 50) / 45 + (safeNumber(team.fan, 50) - 50) / 140;
}

function scoreFrom(seed, salt, expectedRuns) {
  const centered = Math.max(1.4, expectedRuns);
  const variance =
    deterministicRange(seed, salt, -2, 3) +
    deterministicRange(seed, salt + 17, 0, 3) +
    deterministicRange(seed, salt + 31, 0, 2);
  return Math.max(0, Math.round(centered + variance - 1.8));
}

function estimateAttendance(home, away, weather, totalRuns) {
  const market = safeNumber(home.market, 55);
  const fan = safeNumber(home.fan, 55);
  const morale = safeNumber(home.morale, 50);
  const opponentDraw = safeNumber(away.fan, 50) * 45;
  const weatherBoost = Math.round((weather.temperature - 12) * 180 + (weather.runFactor - 1) * 3500);
  const base = 7000 + market * 120 + fan * 110 + morale * 45 + opponentDraw + totalRuns * 160 + weatherBoost;
  return Math.round(clamp(base, 4500, 28500));
}

function buildGameEnvironment(weather, homeTeam) {
  const ballpark = ballparkFactorForTeam(homeTeam);
  return {
    ...weather,
    runFactor: safeNumber(weather?.runFactor, 1) * ballpark.runFactor,
    homerFactor: safeNumber(weather?.homerFactor, 1) * ballpark.homerFactor,
    hitFactor: safeNumber(weather?.runFactor, 1) * ballpark.hitFactor,
    ballpark
  };
}

function ballparkFactorForTeam(team) {
  const base = KBO_BALLPARK_FACTORS[String(team?.id ?? "")] ?? {
    parkId: String(team?.home ?? "neutral"),
    name: team?.home ?? "중립 구장",
    homeRunFactor: 1,
    sourceSeason: 2026,
    provisional: true
  };
  const homerFactor = clamp(safeNumber(base.homeRunFactor, 1), 0.68, 1.58);
  return {
    ...base,
    teamId: team?.id ?? "",
    teamName: team?.name ?? "",
    source: KBO_BALLPARK_RULE_SOURCE,
    homerFactor,
    runFactor: clamp(1 + (homerFactor - 1) * 0.16, 0.94, 1.08),
    hitFactor: clamp(1 + (homerFactor - 1) * 0.055, 0.975, 1.03)
  };
}

function buildWeather(state, date) {
  const seed = hashParts(state.day, formatDateKey(date), "weather");
  const bucket = seed % 100;
  const month = date.getUTCMonth() + 1;
  const seasonal = month <= 4 ? 14 : month >= 8 ? 25 : 21;
  const temperature = seasonal + deterministicRange(seed, "temp", -5, 6);

  if (bucket < 12) {
    return { label: "비", temperature, runFactor: 0.9, homerFactor: 0.92 };
  }
  if (bucket < 25) {
    return { label: "흐림", temperature, runFactor: 0.97, homerFactor: 0.98 };
  }
  if (bucket > 88) {
    return { label: "더움", temperature: temperature + 4, runFactor: 1.08, homerFactor: 1.1 };
  }
  return { label: "맑음", temperature, runFactor: 1.02, homerFactor: 1.03 };
}

function updateMorale(team, runsFor, runsAgainst) {
  const delta = runsFor > runsAgainst ? 2 : runsFor < runsAgainst ? -2 : 0;
  const runDelta = clamp(runsFor - runsAgainst, -5, 5) * 0.35;
  team.morale = clamp(Math.round(safeNumber(team.morale, 50) + delta + runDelta), 20, 85);
}

function nextStreak(current, marker) {
  const text = String(current ?? "");
  const count = text.startsWith(marker) ? safeNumber(text.slice(1), 0) + 1 : 1;
  return `${marker}${count}`;
}

function normalizeState(state) {
  state.day = Math.max(1, Math.floor(safeNumber(state.day, 1)));
  state.currentDate = state.currentDate || "2026-03-01";
  state.gamesPlayed = Math.max(0, Math.floor(safeNumber(state.gamesPlayed)));
  state.phase = state.phase || "preseason";
  state.lastGames = Array.isArray(state.lastGames) ? state.lastGames : [];
  state.eventLog = Array.isArray(state.eventLog) ? state.eventLog : [];
  state.logs = Array.isArray(state.logs) ? state.logs : [];
  state.seasonHistory = Array.isArray(state.seasonHistory) ? state.seasonHistory : [];
  state.leagueHistory = Array.isArray(state.leagueHistory) ? state.leagueHistory : [];
  normalizeNarratives(state);
  state.gameInterventions = normalizeGameInterventions(state.gameInterventions);
  state.managerJob = normalizeManagerJob(state.managerJob, state);
  state.playerRelations = normalizePlayerRelations(state.playerRelations, state);
  state.promises = normalizePromises(state.promises, state);
  state.scoutingQueue = Array.isArray(state.scoutingQueue) ? state.scoutingQueue.slice(0, 40) : [];
  state.scoutingReportsById = state.scoutingReportsById && typeof state.scoutingReportsById === "object"
    ? state.scoutingReportsById
    : {};
  state.mailDecisions = Array.isArray(state.mailDecisions) ? state.mailDecisions : [];
  const legacyPendingMailDecision = state.pendingMailDecision && typeof state.pendingMailDecision === "object"
    ? state.pendingMailDecision
    : null;
  normalizeMailboxState(state);
  if (legacyPendingMailDecision?.status === "open") {
    absorbLegacyPendingDecision(state, legacyPendingMailDecision);
  }
  refreshMailboxDerivedState(state);
  state.settings = normalizeSettings(state.settings);
  state.weeklySnapshot = normalizeWeeklySnapshot(state.weeklySnapshot, state);
  state.monthlySnapshot = normalizeMonthlySnapshot(state.monthlySnapshot, state);
  state.milestoneLedger = state.milestoneLedger && typeof state.milestoneLedger === "object"
    ? state.milestoneLedger
    : {};
  state.campStats = normalizeCampStats(state.campStats);
  state.teams = Array.isArray(state.teams) ? state.teams : [];
  state.trades = state.trades && typeof state.trades === "object" ? state.trades : { completed: [] };
  state.trades.completed = Array.isArray(state.trades.completed) ? state.trades.completed : [];
  state.tradeAssets = state.tradeAssets && typeof state.tradeAssets === "object" ? state.tradeAssets : {};
  state.tradeAssets.cashLedger = Array.isArray(state.tradeAssets.cashLedger) ? state.tradeAssets.cashLedger : [];
  state.tradeAssets.draftPickLedger = Array.isArray(state.tradeAssets.draftPickLedger) ? state.tradeAssets.draftPickLedger : [];
  state.tradeAssets.conditionalAssets = Array.isArray(state.tradeAssets.conditionalAssets) ? state.tradeAssets.conditionalAssets : [];
  state.tradeAssets.ptbnlSlots = Array.isArray(state.tradeAssets.ptbnlSlots) ? state.tradeAssets.ptbnlSlots : [];

  for (const team of state.teams) {
    team.wins = safeNumber(team.wins);
    team.losses = safeNumber(team.losses);
    team.ties = safeNumber(team.ties);
    team.runsFor = safeNumber(team.runsFor);
    team.runsAgainst = safeNumber(team.runsAgainst);
    team.morale = safeNumber(team.morale, 50);
    team.attendanceTotal = safeNumber(team.attendanceTotal);
    team.homeGames = safeNumber(team.homeGames);
    team.roster = Array.isArray(team.roster) ? team.roster : [];
    for (const player of team.roster) {
      player.personality = normalizePlayerPersonality(player, team);
      if (player.rosterLock && typeof player.rosterLock !== "object") {
        player.rosterLock = null;
      }
    }
  }

  syncStateFoundation(state);
}

function normalizeSettings(source) {
  const settings = source && typeof source === "object" ? source : {};
  const continueStops = settings.continueStops && typeof settings.continueStops === "object"
    ? settings.continueStops
    : {};
  return {
    ...settings,
    continueStops: {
      myGameDay: continueStops.myGameDay !== false,
      openDecision: continueStops.openDecision !== false,
      importantMail: continueStops.importantMail !== false
    }
  };
}

function normalizeManagerJob(source, state) {
  const team = findTeamById(state, source?.teamId ?? state.selectedTeamId) ?? getSelectedTeam(state);
  const goal = buildSeasonGoalForTeam(state, team);
  const job = source && typeof source === "object" ? source : {};
  const philosophy = CLUB_PHILOSOPHIES[job.philosophy] ? job.philosophy : defaultClubPhilosophy(goal);
  return {
    version: 1,
    teamId: String(job.teamId ?? team?.id ?? state.selectedTeamId ?? ""),
    season: safeNumber(job.season, inferSeasonFromState(state)),
    status: String(job.status ?? "active"),
    trust: clamp(Math.round(safeNumber(job.trust, defaultManagerTrust(goal))), 0, 100),
    seasonGoal: normalizeSeasonGoal(job.seasonGoal ?? goal, goal),
    expectedRank: safeNumber(job.expectedRank, goal.expectedRank),
    philosophy,
    philosophyUpdatedAt: String(job.philosophyUpdatedAt ?? state.currentDate ?? ""),
    warningIssued: Boolean(job.warningIssued),
    firedAt: String(job.firedAt ?? ""),
    firedReason: String(job.firedReason ?? ""),
    lastEvaluatedAt: String(job.lastEvaluatedAt ?? ""),
    lastWarningAt: String(job.lastWarningAt ?? ""),
    evaluations: Array.isArray(job.evaluations)
      ? job.evaluations.map(normalizeManagerEvaluation).filter(Boolean).slice(0, MANAGER_JOB_EVALUATION_LIMIT)
      : [],
    offers: Array.isArray(job.offers) ? job.offers.map(normalizeManagerOffer).filter(Boolean).slice(0, MANAGER_JOB_OFFER_LIMIT) : []
  };
}

function normalizeSeasonGoal(source, fallback) {
  const goal = source && typeof source === "object" ? source : fallback;
  return {
    key: String(goal.key ?? fallback.key ?? "balanced"),
    label: String(goal.label ?? fallback.label ?? "5강 경쟁"),
    targetRank: clamp(Math.round(safeNumber(goal.targetRank, fallback.targetRank ?? 5)), 1, KBO_TEAM_COUNT),
    targetWinPct: clamp(safeNumber(goal.targetWinPct, fallback.targetWinPct ?? 0.5), 0.25, 0.75),
    pressure: String(goal.pressure ?? fallback.pressure ?? "normal")
  };
}

function normalizeManagerEvaluation(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    date: String(entry.date ?? ""),
    teamId: String(entry.teamId ?? ""),
    rank: safeNumber(entry.rank),
    expectedRank: safeNumber(entry.expectedRank),
    trustBefore: clamp(Math.round(safeNumber(entry.trustBefore)), 0, 100),
    trustAfter: clamp(Math.round(safeNumber(entry.trustAfter)), 0, 100),
    delta: clamp(Math.round(safeNumber(entry.delta)), -25, 25),
    headline: String(entry.headline ?? "구단주 평가"),
    summary: String(entry.summary ?? "")
  };
}

function normalizeManagerOffer(entry) {
  if (!entry || typeof entry !== "object") return null;
  return {
    id: String(entry.id ?? ""),
    teamId: String(entry.teamId ?? ""),
    teamName: String(entry.teamName ?? ""),
    role: String(entry.role ?? "감독"),
    philosophy: CLUB_PHILOSOPHIES[entry.philosophy] ? entry.philosophy : "balanced",
    trust: clamp(Math.round(safeNumber(entry.trust, 55)), 0, 100)
  };
}

function normalizePlayerRelations(source, state) {
  const relation = source && typeof source === "object" ? source : {};
  return {
    version: 1,
    issues: Array.isArray(relation.issues)
      ? relation.issues.map((issue) => normalizePlayerIssue(issue, state)).filter(Boolean).slice(0, PLAYER_RELATION_ISSUE_LIMIT)
      : [],
    lastScannedAt: String(relation.lastScannedAt ?? "")
  };
}

function normalizePlayerIssue(issue, state) {
  if (!issue || typeof issue !== "object") return null;
  const playerId = String(issue.playerId ?? "");
  const teamId = String(issue.teamId ?? "");
  if (!playerId || !teamId) return null;
  const entry = findPlayerEntry(state, playerId, teamId);
  return {
    id: String(issue.id ?? playerIssueId(teamId, playerId, issue.type ?? "clubhouse")),
    type: String(issue.type ?? "clubhouse"),
    teamId,
    playerId,
    playerName: String(issue.playerName ?? entry?.player?.name ?? "선수"),
    status: String(issue.status ?? "open"),
    severity: clamp(Math.round(safeNumber(issue.severity, 45)), 1, 100),
    reason: String(issue.reason ?? ""),
    createdAt: String(issue.createdAt ?? state.currentDate ?? ""),
    updatedAt: String(issue.updatedAt ?? issue.createdAt ?? state.currentDate ?? ""),
    lastMailAt: String(issue.lastMailAt ?? ""),
    promiseId: String(issue.promiseId ?? "")
  };
}

function normalizePromises(source, state) {
  return (Array.isArray(source) ? source : [])
    .map((promise) => normalizePromise(promise, state))
    .filter(Boolean)
    .sort((a, b) => Number(a.status !== "active") - Number(b.status !== "active") || compareText(a.dueDate, b.dueDate))
    .slice(0, MANAGER_PROMISE_LIMIT);
}

function normalizePromise(promise, state) {
  if (!promise || typeof promise !== "object") return null;
  const playerId = String(promise.playerId ?? "");
  const teamId = String(promise.teamId ?? "");
  if (!playerId || !teamId) return null;
  const entry = findPlayerEntry(state, playerId, teamId);
  return {
    id: String(promise.id ?? `promise-${teamId}-${playerId}-${promise.madeDate ?? state.currentDate ?? ""}`),
    type: String(promise.type ?? "playing-time"),
    teamId,
    playerId,
    playerName: String(promise.playerName ?? entry?.player?.name ?? "선수"),
    label: String(promise.label ?? promiseLabel(promise.type ?? "playing-time")),
    madeDate: String(promise.madeDate ?? state.currentDate ?? ""),
    dueDate: String(promise.dueDate ?? addDaysKey(state.currentDate, PROMISE_WINDOW_DAYS)),
    status: String(promise.status ?? "active"),
    baselineGames: safeNumber(promise.baselineGames),
    targetGames: Math.max(1, Math.floor(safeNumber(promise.targetGames, PROMISE_PLAYING_TIME_GAMES))),
    fulfilledAt: String(promise.fulfilledAt ?? ""),
    brokenAt: String(promise.brokenAt ?? ""),
    sourceIssueId: String(promise.sourceIssueId ?? "")
  };
}

function buildSeasonGoalForTeam(state, team) {
  const expectedRank = getOwnerExpectedRank(state, team);
  if (expectedRank <= 2) {
    return { key: "championship", label: "한국시리즈 우승 경쟁", expectedRank, targetRank: 2, targetWinPct: 0.57, pressure: "high" };
  }
  if (expectedRank <= 5) {
    return { key: "postseason", label: "가을야구 진출", expectedRank, targetRank: 5, targetWinPct: 0.52, pressure: "normal" };
  }
  if (expectedRank <= 7) {
    return { key: "five-hundred", label: "5할 승률 경쟁", expectedRank, targetRank: 7, targetWinPct: 0.49, pressure: "normal" };
  }
  return { key: "rebuild", label: "리빌딩 원년", expectedRank, targetRank: 8, targetWinPct: 0.43, pressure: "patient" };
}

function defaultClubPhilosophy(goal) {
  if (goal?.key === "rebuild") return "rebuild";
  if (goal?.key === "championship") return "winNow";
  return "balanced";
}

function defaultManagerTrust(goal) {
  if (goal?.pressure === "patient") return 72;
  if (goal?.pressure === "high") return 64;
  return 68;
}

function ensureManagerJob(state, team = null) {
  const selected = team ?? getSelectedTeam(state);
  state.managerJob = normalizeManagerJob(state.managerJob, state);
  if (selected && String(state.managerJob.teamId) !== String(selected.id) && state.managerJob.status !== "dismissed") {
    state.managerJob = normalizeManagerJob({ teamId: selected.id }, state);
  }
  return state.managerJob;
}

function evaluateManagerJobPressure(state, team, dateKey, options = {}) {
  if (!state || !team) return null;
  const job = ensureManagerJob(state, team);
  if (job.status !== "active") return job;
  const games = teamGamesPlayed(team);
  if (games < 8 && !options.force) return job;
  if (!options.force && job.lastEvaluatedAt && daysBetween(job.lastEvaluatedAt, dateKey) < 7) return job;

  const standings = getStandings(state);
  const rank = standings.findIndex((entry) => String(entry.id) === String(team.id)) + 1 || KBO_TEAM_COUNT;
  const pct = winningPct(team);
  const goal = job.seasonGoal;
  const recent = recentTeamResults(state, team.id, 8);
  const recentLosses = recent.filter((item) => item.diff < 0).length;
  const rankDelta = safeNumber(goal.targetRank, job.expectedRank) - rank;
  const pctDelta = pct - safeNumber(goal.targetWinPct, 0.5);
  const youngShare = youngPlayerUsageShare(team);
  const philosophyDelta = managerPhilosophyTrustDelta(job.philosophy, goal, rankDelta, pctDelta, youngShare);
  const streakDelta = recent.length >= 5 && recentLosses >= 5 ? -6 : recent.length >= 5 && recentLosses <= 1 ? 3 : 0;
  const rawDelta = (pctDelta * 42) + (rankDelta * 1.6) + philosophyDelta + streakDelta;
  const delta = clamp(Math.round(rawDelta), -10, 7);
  const before = safeNumber(job.trust, 68);
  job.trust = clamp(before + delta, 0, 100);
  job.lastEvaluatedAt = String(dateKey ?? state.currentDate ?? "");
  const headline = managerEvaluationHeadline(job.trust, delta);
  const summary = `${team.shortName ?? team.name} 현재 ${rank}위(${renderRecordText(team)}), 목표 ${goal.label}. ${CLUB_PHILOSOPHIES[job.philosophy]?.label ?? "균형 운영"} 기준으로 신뢰도 ${before}→${job.trust}.`;
  const evaluation = {
    date: job.lastEvaluatedAt,
    teamId: team.id,
    rank,
    expectedRank: job.expectedRank,
    trustBefore: before,
    trustAfter: job.trust,
    delta,
    headline,
    summary
  };
  job.evaluations = [evaluation, ...(job.evaluations ?? [])].slice(0, MANAGER_JOB_EVALUATION_LIMIT);
  rememberManagerAction(state, {
    type: "owner-pressure",
    teamId: team.id,
    subject: "구단주 신뢰도",
    subjectId: `trust-${team.id}`,
    headline,
    summary,
    heat: job.trust <= MANAGER_TRUST_WARNING ? 22 : 10,
    confidence: 78,
    tags: ["owner", "trust", job.philosophy],
    date: dateKey
  });
  maybeDeliverOwnerPressureMail(state, team, job, evaluation, dateKey);
  return job;
}

function managerPhilosophyTrustDelta(philosophy, goal, rankDelta, pctDelta, youngShare) {
  if (philosophy === "rebuild") {
    return (youngShare >= 0.18 ? 3 : -2) + (goal?.key === "rebuild" ? 2 : Math.min(0, rankDelta));
  }
  if (philosophy === "winNow") {
    return pctDelta >= 0 ? 2 : Math.min(-1, Math.round(rankDelta * 0.8));
  }
  return 0;
}

function maybeDeliverOwnerPressureMail(state, team, job, evaluation, dateKey) {
  if (job.trust <= MANAGER_TRUST_DISMISSAL) {
    job.status = "dismissed";
    job.firedAt = String(dateKey ?? state.currentDate ?? "");
    job.firedReason = evaluation.summary;
    job.offers = buildManagerJobOffers(state, team, job);
    queueMailDecision(state, buildOwnerDismissalDecision(state, team, job, evaluation, dateKey));
    return;
  }
  if (job.trust <= MANAGER_TRUST_WARNING && !job.warningIssued) {
    job.warningIssued = true;
    job.lastWarningAt = String(dateKey ?? state.currentDate ?? "");
    queueMailDecision(state, buildOwnerWarningDecision(state, team, job, evaluation, dateKey));
  }
}

function buildOwnerWarningDecision(state, team, job, evaluation, dateKey) {
  return {
    id: `owner-warning-${dateKey}-${team.id}`,
    date: dateKey,
    type: "owner-warning",
    teamId: team.id,
    headline: "구단주 긴급 면담: 현장 신뢰도 경고",
    body: `${evaluation.summary} 구단주는 다음 평가 전까지 반등 계획을 요구했습니다.`,
    source: "구단주",
    blocking: true,
    severity: "danger",
    defaultAction: "accept-pressure",
    options: [
      { action: "rebuild-briefing", label: "리빌딩 설명", note: "장기 플랜으로 설득" },
      { action: "accept-pressure", label: "책임 인정", note: "즉시 반등 약속" },
      { action: "lineup-shake", label: "쇄신안 보고", note: "기용 변화 예고" }
    ]
  };
}

function buildOwnerDismissalDecision(state, team, job, evaluation, dateKey) {
  return {
    id: `owner-dismissal-${dateKey}-${team.id}`,
    date: dateKey,
    type: "owner-dismissal",
    teamId: team.id,
    headline: "구단주 결정: 감독직 해임 통보",
    body: `${evaluation.summary} 구단은 감독 교체를 통보했습니다. 다른 구단의 제안을 수락하면 커리어를 이어갈 수 있습니다.`,
    source: "구단주",
    blocking: true,
    severity: "danger",
    defaultAction: job.offers?.[0] ? `accept-offer-${job.offers[0].teamId}` : "end-career",
    options: [
      ...(job.offers ?? []).map((offer) => ({
        action: `accept-offer-${offer.teamId}`,
        label: `${offer.teamName} 제안`,
        note: `${CLUB_PHILOSOPHIES[offer.philosophy]?.label ?? "균형 운영"}`
      })),
      { action: "end-career", label: "커리어 종료", note: "현재 세이브를 종료 상태로 둠" }
    ].slice(0, 4)
  };
}

function buildManagerJobOffers(state, dismissedTeam, job) {
  return [...(state.teams ?? [])]
    .filter((team) => String(team.id) !== String(dismissedTeam.id))
    .sort((a, b) => teamStrengthScore(a) - teamStrengthScore(b))
    .slice(0, MANAGER_JOB_OFFER_LIMIT)
    .map((team) => {
      const goal = buildSeasonGoalForTeam(state, team);
      return {
        id: `manager-offer-${job.firedAt || state.currentDate}-${team.id}`,
        teamId: team.id,
        teamName: team.shortName ?? team.name,
        role: "감독",
        philosophy: defaultClubPhilosophy(goal),
        trust: defaultManagerTrust(goal)
      };
    });
}

function scanPlayerRelations(state, team, dateKey, options = {}) {
  if (!team) return [];
  state.playerRelations = normalizePlayerRelations(state.playerRelations, state);
  const today = String(dateKey ?? state.currentDate ?? "");
  if (!options.force && state.playerRelations.lastScannedAt === today) return [];
  const teamGames = teamGamesPlayed(team);
  if (teamGames < 12 && !options.force) return [];
  const created = [];
  let mailed = 0;
  for (const player of team.roster ?? []) {
    const issue = detectPlayerConcern(state, team, player, teamGames, today, options);
    if (!issue) continue;
    created.push(issue);
    if (mailed < PLAYER_MEETING_DAILY_LIMIT && !issue.lastMailAt) {
      issue.lastMailAt = today;
      queueMailDecision(state, buildPlayerMeetingDecision(state, team, player, issue, today));
      mailed += 1;
    }
  }
  state.playerRelations.lastScannedAt = today;
  return created;
}

function detectPlayerConcern(state, team, player, teamGames, dateKey, options = {}) {
  if (!player || safeNumber(player.injuredDays) > 0 || player.role !== "hitter") return null;
  const expectation = String(player.personality?.roleExpectation ?? playerRoleExpectation(player));
  const importantRole = expectation.includes("핵심") || expectation.includes("주전") || safeNumber(player.ovr) >= 135;
  if (!importantRole && !options.force) return null;
  const games = safeNumber(player.seasonStats?.batting?.games);
  const activeRate = teamGames > 0 ? games / teamGames : 0;
  let type = "";
  let reason = "";
  let severity = 0;
  if (player.status === "futures" && safeNumber(player.ovr) >= 125) {
    type = "demotion";
    reason = "주전급 선수의 2군 체류";
    severity = 62 + Math.max(0, safeNumber(player.ovr) - 130) * 0.4;
  } else if (activeRate < 0.34 || options.force) {
    type = "playing-time";
    reason = `출전 비중 ${Math.round(activeRate * 100)}%`;
    severity = 52 + Math.max(0, safeNumber(player.ovr) - 130) * 0.35;
  }
  if (!type) return null;
  const id = playerIssueId(team.id, player.id, type);
  const existing = state.playerRelations.issues.find((issue) => issue.id === id && !["closed", "resolved"].includes(issue.status));
  if (existing) {
    existing.severity = clamp(Math.round(Math.max(safeNumber(existing.severity), severity)), 1, 100);
    existing.updatedAt = dateKey;
    existing.reason = reason;
    return existing;
  }
  const issue = normalizePlayerIssue({
    id,
    type,
    teamId: team.id,
    playerId: player.id,
    playerName: player.name,
    status: "meeting-requested",
    severity,
    reason,
    createdAt: dateKey,
    updatedAt: dateKey
  }, state);
  state.playerRelations.issues = [issue, ...state.playerRelations.issues].slice(0, PLAYER_RELATION_ISSUE_LIMIT);
  rememberManagerAction(state, {
    type: "player-discontent",
    teamId: team.id,
    subjectId: player.id,
    subject: player.name,
    headline: `${player.name} 면담 요청`,
    summary: `${expectation} 기대치와 실제 기용 사이에 간극이 생겼습니다. 사유: ${reason}.`,
    heat: Math.round(severity / 3),
    confidence: 74,
    tags: ["player", "morale", "promise"],
    date: dateKey
  });
  return issue;
}

function buildPlayerMeetingDecision(state, team, player, issue, dateKey) {
  const callupOption = issue.type === "demotion"
    ? [{ action: "promise-callup", label: "1군 등록 약속", note: "14일 내 등록" }]
    : [];
  return {
    id: `player-meeting-${dateKey}-${team.id}-${player.id}`,
    date: dateKey,
    type: "player-meeting",
    teamId: team.id,
    playerId: player.id,
    playerName: player.name,
    issueId: issue.id,
    headline: `${player.name} 면담 요청`,
    body: `${player.name}이 ${issue.reason} 문제로 감독 면담을 요청했습니다. 약속을 하면 원장에 기록되고 기한 내 이행 여부를 추적합니다.`,
    source: "선수단",
    blocking: false,
    severity: issue.severity >= 70 ? "warning" : "notice",
    defaultAction: "encourage",
    options: [
      { action: "encourage", label: "격려", note: "사기 소폭 회복" },
      { action: "challenge", label: "경쟁 요구", note: "프로 의식 자극" },
      { action: "promise-playing-time", label: "출전 약속", note: "21일 내 5경기" },
      ...callupOption
    ].slice(0, 4)
  };
}

function evaluateActivePromises(state, team, dateKey) {
  state.promises = normalizePromises(state.promises, state);
  const today = String(dateKey ?? state.currentDate ?? "");
  for (const promise of state.promises) {
    if (promise.status !== "active") continue;
    if (team && String(promise.teamId) !== String(team.id)) continue;
    const entry = findPlayerEntry(state, promise.playerId, promise.teamId);
    const player = entry?.player ?? null;
    if (!player) continue;
    if (promiseFulfilled(promise, player)) {
      settlePromise(state, promise, player, "fulfilled", today);
    } else if (promise.dueDate && String(promise.dueDate) < today) {
      settlePromise(state, promise, player, "broken", today);
    }
  }
}

function promiseFulfilled(promise, player) {
  if (promise.type === "first-team") return player.status === "active";
  const currentGames = promisePlayerGames(player);
  return currentGames - safeNumber(promise.baselineGames) >= safeNumber(promise.targetGames, PROMISE_PLAYING_TIME_GAMES);
}

function settlePromise(state, promise, player, status, dateKey) {
  if (promise.status !== "active") return;
  promise.status = status;
  if (status === "fulfilled") {
    promise.fulfilledAt = dateKey;
    player.morale = clamp(safeNumber(player.morale, 50) + 8, 20, 98);
  } else {
    promise.brokenAt = dateKey;
    player.morale = clamp(safeNumber(player.morale, 50) - 16, 5, 90);
    const team = findTeamById(state, promise.teamId);
    if (team) team.morale = clamp(safeNumber(team.morale, 50) - 3, 10, 85);
  }
  const issue = state.playerRelations?.issues?.find((entry) => entry.id === promise.sourceIssueId);
  if (issue) {
    issue.status = status === "fulfilled" ? "resolved" : "open";
    issue.updatedAt = dateKey;
  }
  const headline = status === "fulfilled" ? `${promise.playerName} 약속 이행` : `${promise.playerName} 약속 파기`;
  const body = status === "fulfilled"
    ? `${promise.label} 약속이 기한 내 지켜졌습니다. 선수단은 감독 메시지를 신뢰하는 분위기입니다.`
    : `${promise.label} 약속이 기한을 넘겼습니다. 당사자 사기와 클럽하우스 신뢰가 하락했습니다.`;
  deliverMail(state, {
    id: `promise-result-${dateKey}-${promise.id}`,
    date: dateKey,
    from: { role: "개인비서", icon: "promise" },
    category: "club",
    type: "promise-result",
    headline,
    body,
    read: false,
    important: status === "broken"
  });
  rememberManagerAction(state, {
    type: status === "fulfilled" ? "promise-kept" : "promise-broken",
    teamId: promise.teamId,
    subjectId: promise.playerId,
    subject: promise.playerName,
    headline,
    summary: body,
    heat: status === "broken" ? 24 : 12,
    confidence: 82,
    tags: ["promise", status, "clubhouse"],
    date: dateKey
  });
}

function runClubhousePressureRoutine(state, team, dateKey, options = {}) {
  if (!team) return;
  evaluateActivePromises(state, team, dateKey);
  evaluateManagerJobPressure(state, team, dateKey, options);
  scanPlayerRelations(state, team, dateKey, options);
}

function promisePlayerGames(player) {
  if (player?.role === "pitcher") return safeNumber(player.seasonStats?.pitching?.games);
  return safeNumber(player?.seasonStats?.batting?.games);
}

function youngPlayerUsageShare(team) {
  const roster = team?.roster ?? [];
  const games = sum(roster.map((player) => ({ games: promisePlayerGames(player) })), "games");
  if (games <= 0) return 0;
  const youngGames = sum(roster.map((player) => ({ games: safeNumber(player.age, 99) <= 25 ? promisePlayerGames(player) : 0 })), "games");
  return youngGames / games;
}

function managerTrustBand(trust) {
  const value = safeNumber(trust, 68);
  if (value <= MANAGER_TRUST_DISMISSAL) return "dismissal";
  if (value <= MANAGER_TRUST_WARNING) return "danger";
  if (value <= 45) return "pressure";
  if (value >= 72) return "secure";
  return "stable";
}

function managerTrustLabel(trust) {
  const band = managerTrustBand(trust);
  return {
    dismissal: "경질권",
    danger: "최후 경고",
    pressure: "압박",
    stable: "보통",
    secure: "신뢰"
  }[band] ?? "보통";
}

function managerEvaluationHeadline(trust, delta) {
  if (trust <= MANAGER_TRUST_DISMISSAL) return "구단주 신뢰도 붕괴";
  if (trust <= MANAGER_TRUST_WARNING) return "구단주 압박 고조";
  if (delta > 3) return "구단주 신뢰 회복";
  if (delta < -3) return "구단주 우려 확대";
  return "구단주 평가 유지";
}

function playerIssueId(teamId, playerId, type) {
  return `issue-${teamId}-${playerId}-${type}`;
}

function promiseLabel(type) {
  if (type === "first-team") return "1군 등록";
  return "출전 기회";
}

function daysBetween(left, right) {
  const diff = parseDate(right).getTime() - parseDate(left).getTime();
  return Math.floor(diff / MS_PER_DAY);
}

function normalizeWeeklySnapshot(source, state) {
  if (source && typeof source === "object") {
    return {
      weekStartDate: String(source.weekStartDate ?? ""),
      teamRecords: source.teamRecords && typeof source.teamRecords === "object" ? source.teamRecords : {},
      playerStatMarks: source.playerStatMarks && typeof source.playerStatMarks === "object" ? source.playerStatMarks : {}
    };
  }
  return {
    weekStartDate: state?.currentDate ?? "",
    teamRecords: {},
    playerStatMarks: {}
  };
}

function normalizeMonthlySnapshot(source, state) {
  if (source && typeof source === "object") {
    return {
      monthKey: String(source.monthKey ?? ""),
      standings: source.standings && typeof source.standings === "object" ? source.standings : {},
      teamRecords: source.teamRecords && typeof source.teamRecords === "object" ? source.teamRecords : {}
    };
  }
  return {
    monthKey: String(state?.currentDate ?? "").slice(0, 7),
    standings: {},
    teamRecords: {}
  };
}

function normalizeCampStats(source) {
  const stats = source && typeof source === "object" ? source : {};
  return {
    games: Array.isArray(stats.games) ? stats.games.slice(0, 40) : [],
    notes: Array.isArray(stats.notes) ? stats.notes.slice(0, 80) : []
  };
}

function normalizeMailboxState(state) {
  if (!state || typeof state !== "object") return state;
  const source = state.mailbox && typeof state.mailbox === "object" ? state.mailbox : {};
  const seen = new Set();
  const items = [];
  for (const raw of Array.isArray(source.items) ? source.items : []) {
    const item = normalizeMailItem(raw, state);
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  const deferred = [];
  for (const raw of Array.isArray(source.deferred) ? source.deferred : []) {
    const item = normalizeMailItem(raw, state);
    if (!item.id || seen.has(`deferred:${item.id}`)) continue;
    seen.add(`deferred:${item.id}`);
    deferred.push({
      ...item,
      deliverOn: String(raw.deliverOn ?? item.deliverOn ?? item.date ?? state.currentDate ?? "")
    });
  }
  state.mailbox = {
    version: 2,
    items: items.sort(compareMailItems).slice(0, MAILBOX_LIMIT),
    deferred: deferred
      .sort((a, b) => compareText(a.deliverOn, b.deliverOn) || compareMailItems(a, b))
      .slice(0, MAILBOX_DEFERRED_LIMIT),
    unread: 0
  };
  refreshMailboxDerivedState(state);
  return state.mailbox;
}

function absorbLegacyPendingDecision(state, decision) {
  if (!decision?.id || state.mailbox.items.some((mail) => String(mail.id) === String(decision.id))) return;
  const item = normalizeMailItem({
    id: decision.id,
    date: decision.date ?? state.currentDate,
    from: { role: decision.source ?? decision.teamName ?? "개인비서", icon: decision.type ?? "decision" },
    category: "decision",
    type: decision.type ?? "decision",
    headline: decision.headline ?? "긴급 보고",
    body: decision.body ?? decision.text ?? "",
    read: false,
    important: Boolean(decision.blocking),
    decision
  }, state);
  insertMailboxItem(state, item, { log: false });
}

function normalizeMailItem(raw, state) {
  const source = typeof raw === "string" ? { body: raw, headline: raw } : (raw && typeof raw === "object" ? raw : {});
  const decisionSource = source.decision && typeof source.decision === "object" ? source.decision : null;
  const date = String(source.date ?? decisionSource?.date ?? state?.currentDate ?? "");
  const type = String(source.type ?? decisionSource?.type ?? "note");
  const headline = String(source.headline ?? source.title ?? decisionSource?.headline ?? source.body ?? source.text ?? "새 소식");
  const body = String(source.body ?? source.text ?? source.message ?? decisionSource?.body ?? decisionSource?.text ?? headline);
  const from = normalizeMailFrom(source.from ?? {
    role: source.source ?? source.tag ?? decisionSource?.source ?? decisionSource?.teamName ?? "프런트",
    icon: source.icon ?? type
  });
  const decision = decisionSource ? normalizeMailDecision(decisionSource, { id: source.id, date, type, headline, body, from }) : null;
  const category = String(source.category ?? inferMailCategory(type, decision, from));
  const id = String(source.id ?? decision?.id ?? buildMailId({ date, type, headline, from }));
  return {
    id,
    date,
    from,
    category,
    type,
    headline,
    body,
    read: Boolean(source.read),
    important: Boolean(source.important) || Boolean(decision?.blocking) || MAILBOX_IMPORTANCE_TYPES.has(type),
    decision,
    links: Array.isArray(source.links) ? source.links.map(normalizeMailLink).filter(Boolean).slice(0, 4) : [],
    eventId: String(source.eventId ?? ""),
    deliverOn: source.deliverOn ? String(source.deliverOn) : ""
  };
}

function normalizeMailDecision(source, mail = {}) {
  if (!source || typeof source !== "object") return null;
  const type = String(source.type ?? mail.type ?? "decision");
  const date = String(source.date ?? mail.date ?? "");
  const defaultAction = String(source.defaultAction ?? defaultDecisionAction(type));
  const expiresOn = String(source.expiresOn ?? defaultDecisionExpiry(date, type));
  return {
    ...source,
    id: String(source.id ?? mail.id ?? buildMailId({ date, type, headline: source.headline ?? mail.headline ?? "decision" })),
    date,
    type,
    status: String(source.status ?? "open"),
    blocking: Boolean(source.blocking),
    severity: String(source.severity ?? (source.blocking ? "danger" : "notice")),
    options: Array.isArray(source.options) ? source.options : [],
    resolvedAction: String(source.resolvedAction ?? source.resolution ?? ""),
    resolvedDate: String(source.resolvedDate ?? source.resolvedAt ?? ""),
    resultMessage: String(source.resultMessage ?? ""),
    expiresOn,
    defaultAction
  };
}

function normalizeMailFrom(source) {
  if (source && typeof source === "object") {
    return {
      role: String(source.role ?? source.source ?? "프런트"),
      icon: String(source.icon ?? source.type ?? "mail")
    };
  }
  return {
    role: String(source ?? "프런트"),
    icon: "mail"
  };
}

function normalizeMailLink(link) {
  if (!link || typeof link !== "object") return null;
  const label = String(link.label ?? "").trim();
  const target = String(link.target ?? "").trim();
  if (!label || !target) return null;
  return { label, target };
}

function inferMailCategory(type, decision, from) {
  if (decision) return "decision";
  if (["media", "streak", "milestone", "standings-race", "power-ranking", "sweep"].includes(type)) return "media";
  if (["kbo-official", "waiver", "league-news", "trade-completed"].includes(type)) return "league";
  if (String(from?.role ?? "").includes("KBO") || String(from?.role ?? "").includes("사무국")) return "league";
  return "club";
}

function buildMailId({ date, type, headline, from }) {
  return `mail-${date || "date"}-${type || "note"}-${hashParts(date, type, headline, from?.role ?? "from").toString(36)}`;
}

function insertMailboxItem(state, item, options = {}) {
  if (!item?.id) return null;
  normalizeMailboxState(state);
  const existingIndex = state.mailbox.items.findIndex((entry) => String(entry.id) === String(item.id));
  if (existingIndex >= 0) {
    state.mailbox.items[existingIndex] = {
      ...state.mailbox.items[existingIndex],
      ...item,
      read: Boolean(state.mailbox.items[existingIndex].read && item.read)
    };
  } else {
    state.mailbox.items = [item, ...state.mailbox.items];
  }
  pruneMailbox(state);
  refreshMailboxDerivedState(state);
  if (options.log) addLog(state, mailLogFromItem(item));
  return item;
}

function deferMailboxItem(state, item, deliverOn) {
  if (!item?.id) return null;
  normalizeMailboxState(state);
  if (state.mailbox.items.some((mail) => String(mail.id) === String(item.id))) return null;
  if (state.mailbox.deferred.some((mail) => String(mail.id) === String(item.id))) return null;
  state.mailbox.deferred = [
    {
      ...item,
      deliverOn: String(deliverOn ?? item.date ?? state.currentDate ?? "")
    },
    ...state.mailbox.deferred
  ].slice(0, MAILBOX_DEFERRED_LIMIT);
  return item;
}

function deliverDeferredMail(state, dateKey = state?.currentDate) {
  normalizeMailboxState(state);
  const today = String(dateKey ?? state.currentDate ?? "");
  const ready = [];
  const pending = [];
  for (const item of state.mailbox.deferred ?? []) {
    if (String(item.deliverOn ?? item.date ?? "") <= today) ready.push(item);
    else pending.push(item);
  }
  state.mailbox.deferred = pending;
  for (const item of ready.sort(compareMailItems)) {
    insertMailboxItem(state, { ...item, date: item.date || today }, { log: true });
  }
  refreshMailboxDerivedState(state);
  return ready;
}

function pruneMailbox(state) {
  const items = [...(state.mailbox?.items ?? [])].sort(compareMailItems);
  if (items.length <= MAILBOX_LIMIT) {
    state.mailbox.items = items;
    return;
  }
  const keep = [];
  const removable = [];
  for (const item of items) {
    if (isOpenDecisionMail(item) || !item.read || item.decision) keep.push(item);
    else removable.push(item);
  }
  state.mailbox.items = [...keep, ...removable].slice(0, MAILBOX_LIMIT).sort(compareMailItems);
}

function refreshMailboxDerivedState(state) {
  if (!state?.mailbox) return;
  state.mailbox.items = Array.isArray(state.mailbox.items) ? state.mailbox.items.sort(compareMailItems) : [];
  state.mailbox.unread = state.mailbox.items.filter((mail) => !mail.read).length;
  const blocking = state.mailbox.items.find((mail) => isOpenDecisionMail(mail) && mail.decision?.blocking);
  state.pendingMailDecision = blocking ? decisionFromMail(blocking) : null;
}

function compareMailItems(a, b) {
  const decisionDiff = Number(isOpenDecisionMail(b)) - Number(isOpenDecisionMail(a));
  if (decisionDiff) return decisionDiff;
  const unreadDiff = Number(!b?.read) - Number(!a?.read);
  if (unreadDiff) return unreadDiff;
  const dateDiff = compareText(String(b?.date ?? ""), String(a?.date ?? ""));
  if (dateDiff) return dateDiff;
  return compareText(String(a?.headline ?? a?.id ?? ""), String(b?.headline ?? b?.id ?? ""));
}

function isOpenDecisionMail(mail) {
  return mail?.decision?.status === "open";
}

function isImportantMail(mail) {
  return Boolean(mail?.important) || Boolean(mail?.decision?.blocking) || MAILBOX_IMPORTANCE_TYPES.has(String(mail?.type ?? ""));
}

function decisionFromMail(mail) {
  if (!mail?.decision) return null;
  return {
    ...mail,
    ...mail.decision,
    id: mail.decision.id ?? mail.id,
    mailId: mail.id,
    headline: mail.headline ?? mail.decision.headline,
    body: mail.body ?? mail.decision.body,
    source: mail.from?.role ?? mail.decision.source ?? ""
  };
}

function mailLogFromItem(item) {
  return {
    id: `log-${item.id}`,
    date: item.date,
    type: item.type,
    tag: item.from?.role ?? "프런트",
    source: item.from?.role ?? "프런트",
    headline: item.headline,
    text: item.body,
    eventId: item.eventId ?? ""
  };
}

function defaultDecisionAction(type) {
  if (type === "medical-roster") return "monitor";
  if (type === "trade-offer") return "reject";
  if (type === "waiver-claim") return "pass";
  if (type === "foreign-adaptation") return "acknowledge";
  if (type === "foreign-lineup") return "acknowledge";
  if (type === "bullpen-rest") return "manager-discretion";
  if (type === "futures-callup") return "hold";
  if (type === "player-meeting") return "encourage";
  if (type === "owner-warning") return "accept-pressure";
  if (type === "owner-dismissal") return "end-career";
  return "acknowledge";
}

function defaultDecisionExpiry(dateKey, type) {
  const days = type === "waiver-claim" ? 7 : type === "trade-offer" ? 3 : type === "player-meeting" ? 5 : 1;
  return dateKey ? addDaysKey(dateKey, days) : "";
}

function normalizeGameInterventions(source) {
  const result = {};
  const input = source && typeof source === "object" ? source : {};
  for (const [teamId, plan] of Object.entries(input)) {
    if (!plan || typeof plan !== "object") continue;
    const preset = GAME_INTERVENTION_PRESETS[plan.preset] ?? GAME_INTERVENTION_PRESETS.balanced;
    result[teamId] = {
      mode: "manual",
      preset: plan.preset ?? "balanced",
      label: plan.label ?? preset.label,
      approach: plan.approach ?? preset.approach,
      baserunning: plan.baserunning ?? preset.baserunning,
      bullpenHook: plan.bullpenHook ?? preset.bullpenHook,
      pinchHit: plan.pinchHit ?? preset.pinchHit,
      bunt: plan.bunt ?? preset.bunt,
      updatedAt: plan.updatedAt ?? "",
      source: plan.source ?? "manager-game-intervention-v1"
    };
  }
  return result;
}

function normalizePlayerPersonality(player, team) {
  const existing = player?.personality && typeof player.personality === "object" ? player.personality : {};
  const seedParts = [team?.id ?? player?.teamId ?? "", player?.id ?? "", player?.name ?? ""];
  const traits = {
    ambition: clamp(Math.round(safeNumber(existing.traits?.ambition, deterministicRange(...seedParts, "ambition", 7, 19))), 1, 20),
    loyalty: clamp(Math.round(safeNumber(existing.traits?.loyalty, deterministicRange(...seedParts, "loyalty", 6, 19))), 1, 20),
    pressure: clamp(Math.round(safeNumber(existing.traits?.pressure, deterministicRange(...seedParts, "pressure", 5, 19))), 1, 20),
    professionalism: clamp(Math.round(safeNumber(existing.traits?.professionalism, deterministicRange(...seedParts, "professionalism", 6, 19))), 1, 20),
    adaptability: clamp(Math.round(safeNumber(existing.traits?.adaptability, deterministicRange(...seedParts, "adaptability", 5, 19))), 1, 20),
    mediaTemper: clamp(Math.round(safeNumber(existing.traits?.mediaTemper, deterministicRange(...seedParts, "mediaTemper", 4, 18))), 1, 20)
  };
  const archetype = existing.archetype ?? playerPersonalityArchetype(traits);
  const roleExpectation = existing.roleExpectation ?? playerRoleExpectation(player);

  return {
    version: 1,
    archetype,
    roleExpectation,
    traits,
    clubhouseImpact: clamp(Math.round((traits.professionalism + traits.loyalty + traits.pressure) / 3), 1, 20),
    volatility: clamp(Math.round((21 - traits.professionalism + 21 - traits.mediaTemper) / 2), 1, 20),
    source: existing.source ?? "deterministic-personality-v1"
  };
}

function playerPersonalityArchetype(traits) {
  if (traits.professionalism >= 16 && traits.pressure >= 15) return "큰 경기형 리더";
  if (traits.ambition >= 16 && traits.loyalty <= 9) return "상승 지향형";
  if (traits.loyalty >= 16 && traits.professionalism >= 13) return "프랜차이즈형";
  if (traits.adaptability >= 16) return "적응형";
  if (traits.mediaTemper <= 7) return "민감형";
  if (traits.pressure <= 8) return "관리 필요형";
  return "균형형";
}

function playerRoleExpectation(player) {
  const ovr = safeNumber(player?.ovr);
  if (ovr >= 150) return "핵심 주전";
  if (ovr >= 130) return "주전 경쟁";
  if (safeNumber(player?.pot, ovr) - ovr >= 28 && safeNumber(player?.age, 99) <= 25) return "육성 우선";
  if (player?.status === "futures") return "퓨처스 대기";
  return "로테이션/백업";
}

function normalizeNarratives(state) {
  const source = state.narratives && typeof state.narratives === "object" ? state.narratives : {};
  state.narratives = {
    version: 1,
    arcs: Array.isArray(source.arcs) ? source.arcs.map(normalizeNarrativeArc).filter(Boolean) : [],
    beats: Array.isArray(source.beats) ? source.beats.map(normalizeNarrativeBeat).filter(Boolean) : [],
    counters: source.counters && typeof source.counters === "object" ? { ...source.counters } : {},
    lastUpdated: source.lastUpdated || state.currentDate || "2026-03-01"
  };
  state.narratives.arcs = state.narratives.arcs
    .sort((a, b) => safeNumber(b.heat) - safeNumber(a.heat) || compareText(b.updatedAt, a.updatedAt))
    .slice(0, NARRATIVE_ARC_LIMIT);
  state.narratives.beats = state.narratives.beats.slice(0, NARRATIVE_BEAT_LIMIT);
}

function normalizeNarrativeArc(arc) {
  if (!arc || typeof arc !== "object") return null;
  const id = String(arc.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    type: String(arc.type ?? "story"),
    teamId: String(arc.teamId ?? ""),
    subjectId: String(arc.subjectId ?? ""),
    subject: truncateNarrativeText(arc.subject ?? "구단 이슈", 48),
    headline: truncateNarrativeText(arc.headline ?? arc.subject ?? "장기 서사", 80),
    summary: truncateNarrativeText(arc.summary ?? "", 180),
    heat: clamp(Math.round(safeNumber(arc.heat, 8)), 1, 100),
    confidence: clamp(Math.round(safeNumber(arc.confidence, 55)), 1, 100),
    streak: Math.max(1, Math.floor(safeNumber(arc.streak, 1))),
    startedAt: String(arc.startedAt ?? arc.updatedAt ?? ""),
    updatedAt: String(arc.updatedAt ?? arc.startedAt ?? ""),
    lastDecayedAt: String(arc.lastDecayedAt ?? ""),
    tags: uniqueNarrativeStrings(arc.tags, 8),
    evidence: Array.isArray(arc.evidence)
      ? arc.evidence.map(normalizeNarrativeEvidence).filter(Boolean).slice(0, NARRATIVE_EVIDENCE_LIMIT)
      : []
  };
}

function normalizeNarrativeBeat(beat) {
  if (!beat || typeof beat !== "object") return null;
  return {
    id: String(beat.id ?? narrativeKey("beat", beat.date, beat.headline, beat.summary)),
    date: String(beat.date ?? ""),
    teamId: String(beat.teamId ?? ""),
    type: String(beat.type ?? "beat"),
    headline: truncateNarrativeText(beat.headline ?? "서사 기록", 80),
    summary: truncateNarrativeText(beat.summary ?? "", 180),
    impact: clamp(Math.round(safeNumber(beat.impact, 5)), -30, 30),
    tags: uniqueNarrativeStrings(beat.tags, 8)
  };
}

function normalizeNarrativeEvidence(evidence) {
  if (!evidence) return null;
  if (typeof evidence === "string") {
    return { date: "", source: "", text: truncateNarrativeText(evidence, 150) };
  }
  const text = truncateNarrativeText(evidence.text ?? evidence.summary ?? "", 150);
  if (!text) return null;
  return {
    date: String(evidence.date ?? ""),
    source: truncateNarrativeText(evidence.source ?? "", 32),
    text
  };
}

export function rememberManagerAction(state, event = {}) {
  if (!state) return null;
  normalizeNarratives(state);
  const date = String(event.date ?? state.currentDate ?? "");
  const teamId = String(event.teamId ?? state.selectedTeamId ?? "");
  const type = String(event.type ?? "manager-action");
  const subject = event.subject ?? event.headline ?? "운영 결정";
  const subjectId = event.subjectId ?? subject;
  const headline = event.headline ?? subject;
  const summary = event.summary ?? event.text ?? headline;
  const arc = upsertNarrativeArc(state, {
    id: event.id ?? narrativeKey("manager", teamId || "league", type, subjectId),
    type,
    teamId,
    subjectId: String(subjectId ?? ""),
    subject,
    headline,
    summary,
    heat: event.heat ?? 8,
    confidence: event.confidence ?? 62,
    tags: event.tags ?? [type, "manager"],
    date,
    evidence: {
      date,
      source: event.source ?? "감독실",
      text: summary
    }
  });
  addNarrativeBeat(state, {
    id: narrativeKey("beat", date, teamId || "league", type, subjectId),
    date,
    teamId,
    type,
    headline,
    summary,
    impact: event.impact ?? Math.round(safeNumber(event.heat, 8) / 2),
    tags: event.tags ?? [type]
  });
  state.narratives.lastUpdated = date || state.narratives.lastUpdated;
  return arc;
}

function upsertNarrativeArc(state, seed = {}) {
  normalizeNarratives(state);
  const date = String(seed.date ?? state.currentDate ?? "");
  const id = String(seed.id ?? narrativeKey(seed.type, seed.teamId, seed.subjectId, seed.headline));
  const heatDelta = clamp(Math.round(safeNumber(seed.heat, 8)), 1, 35);
  const evidence = normalizeNarrativeEvidence(seed.evidence ?? {
    date,
    source: seed.source ?? "",
    text: seed.summary ?? seed.headline ?? seed.subject ?? ""
  });
  const existing = state.narratives.arcs.find((arc) => arc.id === id);
  if (existing) {
    existing.type = String(seed.type ?? existing.type);
    existing.teamId = String(seed.teamId ?? existing.teamId ?? "");
    existing.subjectId = String(seed.subjectId ?? existing.subjectId ?? "");
    existing.subject = truncateNarrativeText(seed.subject ?? existing.subject, 48);
    existing.headline = truncateNarrativeText(seed.headline ?? existing.headline, 80);
    existing.summary = truncateNarrativeText(seed.summary ?? existing.summary, 180);
    existing.heat = clamp(Math.round(safeNumber(existing.heat, 1) + heatDelta), 1, 100);
    existing.confidence = clamp(Math.round((safeNumber(existing.confidence, 55) * 0.72) + (safeNumber(seed.confidence, 55) * 0.28)), 1, 100);
    existing.streak = Math.max(1, safeNumber(existing.streak, 1) + 1);
    existing.updatedAt = date || existing.updatedAt;
    existing.tags = uniqueNarrativeStrings([...(existing.tags ?? []), ...(Array.isArray(seed.tags) ? seed.tags : [seed.tags])], 8);
    if (evidence) {
      const evidenceKey = `${evidence.date}-${evidence.source}-${evidence.text}`;
      existing.evidence = [evidence, ...(existing.evidence ?? []).filter((item) => `${item.date}-${item.source}-${item.text}` !== evidenceKey)]
        .slice(0, NARRATIVE_EVIDENCE_LIMIT);
    }
    state.narratives.arcs = state.narratives.arcs
      .sort((a, b) => safeNumber(b.heat) - safeNumber(a.heat) || compareText(b.updatedAt, a.updatedAt))
      .slice(0, NARRATIVE_ARC_LIMIT);
    return existing;
  }

  const arc = normalizeNarrativeArc({
    id,
    type: seed.type,
    teamId: seed.teamId,
    subjectId: seed.subjectId,
    subject: seed.subject,
    headline: seed.headline,
    summary: seed.summary,
    heat: heatDelta,
    confidence: seed.confidence,
    streak: 1,
    startedAt: date,
    updatedAt: date,
    lastDecayedAt: "",
    tags: seed.tags,
    evidence: evidence ? [evidence] : []
  });
  if (!arc) return null;
  state.narratives.arcs = [arc, ...state.narratives.arcs]
    .sort((a, b) => safeNumber(b.heat) - safeNumber(a.heat) || compareText(b.updatedAt, a.updatedAt))
    .slice(0, NARRATIVE_ARC_LIMIT);
  return arc;
}

function addNarrativeBeat(state, beat = {}) {
  normalizeNarratives(state);
  const normalized = normalizeNarrativeBeat(beat);
  if (!normalized) return;
  state.narratives.beats = [
    normalized,
    ...state.narratives.beats.filter((item) => item.id !== normalized.id)
  ].slice(0, NARRATIVE_BEAT_LIMIT);
}

function decayNarrativeArcs(state, dateKey) {
  normalizeNarratives(state);
  const date = String(dateKey ?? state.currentDate ?? "");
  for (const arc of state.narratives.arcs) {
    if (!date || arc.updatedAt === date || arc.lastDecayedAt === date) continue;
    arc.heat = Math.max(1, Math.round(safeNumber(arc.heat, 1) * NARRATIVE_DAILY_DECAY));
    arc.lastDecayedAt = date;
  }
  state.narratives.arcs = state.narratives.arcs
    .filter((arc) => safeNumber(arc.heat) > 1 || safeNumber(arc.streak) > 1)
    .sort((a, b) => safeNumber(b.heat) - safeNumber(a.heat) || compareText(b.updatedAt, a.updatedAt))
    .slice(0, NARRATIVE_ARC_LIMIT);
}

function recordDailyNarratives(state, context = {}) {
  const team = context.team ?? findTeamById(state, state.selectedTeamId);
  const reportDate = String(context.reportDate ?? state.currentDate ?? "");
  decayNarrativeArcs(state, reportDate);

  if (team && context.focusGame) {
    const diff = teamRunDiff(context.focusGame, team.id);
    const gameText = context.gameText ?? `${context.focusGame.away} ${context.focusGame.awayScore}-${context.focusGame.homeScore} ${context.focusGame.home}`;
    if (diff !== null) {
      if (diff >= 4) {
        upsertNarrativeArc(state, {
          id: narrativeKey("team", team.id, "big-win"),
          type: "performance",
          teamId: team.id,
          subject: "대승 흐름",
          headline: `${team.shortName ?? team.name} 공격 플랜 신뢰 상승`,
          summary: `${gameText} 이후 타선 조합과 경기 플랜에 대한 긍정 프레임이 커졌습니다.`,
          heat: 12 + Math.min(10, diff),
          confidence: 72,
          tags: ["result", "offense", "media"],
          date: reportDate,
          evidence: { date: reportDate, source: "경기 결과", text: `${gameText}, 득실차 +${diff}` }
        });
      } else if (diff <= -4) {
        upsertNarrativeArc(state, {
          id: narrativeKey("team", team.id, "heavy-loss"),
          type: "pressure",
          teamId: team.id,
          subject: "대패 후 압박",
          headline: `${team.shortName ?? team.name} 벤치 운영 압박`,
          summary: `${gameText} 이후 투수 교체와 타순 고정에 대한 언론 질문이 따라붙습니다.`,
          heat: 13 + Math.min(10, Math.abs(diff)),
          confidence: 75,
          tags: ["result", "pressure", "media"],
          date: reportDate,
          evidence: { date: reportDate, source: "경기 결과", text: `${gameText}, 득실차 ${diff}` }
        });
      } else if (diff > 0) {
        upsertNarrativeArc(state, {
          id: narrativeKey("team", team.id, "close-win-trust"),
          type: "trust",
          teamId: team.id,
          subject: "승부처 운영",
          headline: "승부처 운영 신뢰 누적",
          summary: `${team.shortName ?? team.name}가 접전에서 결과를 내며 감독 선택을 지지하는 근거가 쌓입니다.`,
          heat: 8,
          confidence: 64,
          tags: ["result", "manager"],
          date: reportDate,
          evidence: { date: reportDate, source: "경기 결과", text: gameText }
        });
      } else if (diff < 0) {
        upsertNarrativeArc(state, {
          id: narrativeKey("team", team.id, "close-loss-question"),
          type: "pressure",
          teamId: team.id,
          subject: "접전 패배",
          headline: "후반 운영 논쟁",
          summary: `${team.shortName ?? team.name}가 접전을 놓치며 대타·불펜 타이밍을 둘러싼 질문이 이어집니다.`,
          heat: 9,
          confidence: 66,
          tags: ["result", "manager", "bullpen"],
          date: reportDate,
          evidence: { date: reportDate, source: "경기 결과", text: gameText }
        });
      }
    }
  }

  const recent = team ? recentTeamResults(state, team.id, 5) : [];
  const wins = recent.filter((item) => item.diff > 0).length;
  const losses = recent.filter((item) => item.diff < 0).length;
  if (team && recent.length >= 4 && wins >= 4) {
    upsertNarrativeArc(state, {
      id: narrativeKey("team", team.id, "win-streak"),
      type: "momentum",
      teamId: team.id,
      subject: "연승 흐름",
      headline: `${team.shortName ?? team.name} 상승세`,
      summary: `최근 ${recent.length}경기 중 ${wins}승으로 선수단 신뢰와 팬 기대치가 함께 올라갑니다.`,
      heat: 14,
      confidence: 78,
      tags: ["streak", "morale"],
      date: reportDate,
      evidence: { date: reportDate, source: "최근 흐름", text: `최근 ${recent.length}경기 ${wins}승` }
    });
  } else if (team && recent.length >= 4 && losses >= 4) {
    upsertNarrativeArc(state, {
      id: narrativeKey("team", team.id, "slump"),
      type: "pressure",
      teamId: team.id,
      subject: "연패 압박",
      headline: `${team.shortName ?? team.name} 분위기 관리 이슈`,
      summary: `최근 ${recent.length}경기 중 ${losses}패로 선수단 메시지와 라인업 조정의 무게가 커졌습니다.`,
      heat: 15,
      confidence: 80,
      tags: ["streak", "pressure"],
      date: reportDate,
      evidence: { date: reportDate, source: "최근 흐름", text: `최근 ${recent.length}경기 ${losses}패` }
    });
  }

  const results = Array.isArray(context.results) ? context.results : [];
  const totalRuns = safeNumber(context.totalRuns);
  if (results.length >= 3) {
    const runAverage = totalRuns / results.length;
    if (runAverage >= 10.4) {
      upsertNarrativeArc(state, {
        id: narrativeKey("league", "run-environment-high"),
        type: "league-environment",
        teamId: "league",
        subject: "타고투저 흐름",
        headline: "리그 득점 환경 상승",
        summary: `오늘 리그 평균 득점이 ${roundNumber(runAverage, 1)}점까지 올라 타선 운용과 불펜 소모가 동시에 이슈입니다.`,
        heat: 8,
        confidence: 58,
        tags: ["league", "run-environment"],
        date: reportDate,
        evidence: { date: reportDate, source: "전력분석", text: `${results.length}경기 총 ${totalRuns}득점` }
      });
    } else if (runAverage <= 6.2) {
      upsertNarrativeArc(state, {
        id: narrativeKey("league", "run-environment-low"),
        type: "league-environment",
        teamId: "league",
        subject: "투고타저 흐름",
        headline: "리그 득점 환경 하락",
        summary: `오늘 리그 평균 득점이 ${roundNumber(runAverage, 1)}점에 머물러 선발 매치업과 작전 야구 비중이 커졌습니다.`,
        heat: 8,
        confidence: 58,
        tags: ["league", "run-environment"],
        date: reportDate,
        evidence: { date: reportDate, source: "전력분석", text: `${results.length}경기 총 ${totalRuns}득점` }
      });
    }
  }

  const selectedInjuries = (context.newInjuries ?? []).filter((entry) => String(entry.teamId) === String(team?.id));
  for (const injury of selectedInjuries.slice(0, 2)) {
    upsertNarrativeArc(state, {
      id: narrativeKey("player", team?.id, "injury", injury.playerId ?? injury.name),
      type: "medical",
      teamId: team?.id ?? "",
      subjectId: injury.playerId ?? injury.name,
      subject: injury.name,
      headline: `${injury.name} 공백 관리`,
      summary: `${injuryLabel(injury.injuredDays)} 판정으로 엔트리와 포지션 뎁스 운용이 장기 이슈가 됐습니다.`,
      heat: 12 + Math.min(12, safeNumber(injury.injuredDays)),
      confidence: 86,
      tags: ["injury", "roster"],
      date: reportDate,
      evidence: { date: reportDate, source: "트레이닝 파트", text: `${injury.name} ${injury.injuredDays}일 이탈` }
    });
  }

  if (team && context.futuresReport?.player && (context.futuresReport.hot || String(context.futuresReport.note ?? "").includes("콜업"))) {
    const player = context.futuresReport.player;
    upsertNarrativeArc(state, {
      id: narrativeKey("player", team.id, "futures-callup", player.id ?? player.name),
      type: "development",
      teamId: team.id,
      subjectId: player.id ?? player.name,
      subject: player.name,
      headline: `${player.name} 1군 콜업 압박`,
      summary: `퓨처스 보고가 반복될수록 ${player.name}의 1군 기회 여부가 감독실 질문으로 남습니다.`,
      heat: 10,
      confidence: 63,
      tags: ["futures", "callup"],
      date: reportDate,
      evidence: { date: reportDate, source: "2군 감독", text: context.futuresReport.note }
    });
  }
}

function recordPreseasonNarratives(state, context = {}) {
  const team = context.team;
  const dateKey = String(context.dateKey ?? state.currentDate ?? "");
  if (!team) return;
  decayNarrativeArcs(state, dateKey);
  upsertNarrativeArc(state, {
    id: narrativeKey("preseason", team.id, context.focus),
    type: "preseason",
    teamId: team.id,
    subject: context.focus,
    headline: `${context.shortName} ${context.focus} 프레임`,
    summary: `개막까지 ${context.daysToOpening}일, ${context.focus}가 캠프 일일 보고의 중심 안건입니다.`,
    heat: 6,
    confidence: 56,
    tags: ["preseason", "camp"],
    date: dateKey,
    evidence: { date: dateKey, source: "개인비서", text: `${context.focus} 점검 필요` }
  });
  if (safeNumber(context.payrollRoom) < 0) {
    upsertNarrativeArc(state, {
      id: narrativeKey("team", team.id, "budget-pressure"),
      type: "front-office",
      teamId: team.id,
      subject: "예산 압박",
      headline: `${context.shortName} 예산 정리 압박`,
      summary: `운영 여력이 ${Math.abs(safeNumber(context.payrollRoom))}억가량 부족해 FA와 외국인 시장 선택이 계속 주목됩니다.`,
      heat: 10,
      confidence: 70,
      tags: ["budget", "front-office"],
      date: dateKey,
      evidence: { date: dateKey, source: "프런트 예산팀", text: `예산 여력 ${context.payrollRoom}억` }
    });
  }
  if (safeNumber(context.injuredCount) > 0) {
    upsertNarrativeArc(state, {
      id: narrativeKey("team", team.id, "camp-injury-depth"),
      type: "medical",
      teamId: team.id,
      subject: "캠프 부상 뎁스",
      headline: `${context.shortName} 부상 뎁스 관리`,
      summary: `프리시즌 부상자 ${context.injuredCount}명으로 개막 엔트리 압축 전에 대체 자원 검토가 필요합니다.`,
      heat: 8 + Math.min(8, safeNumber(context.injuredCount) * 2),
      confidence: 68,
      tags: ["injury", "preseason"],
      date: dateKey,
      evidence: { date: dateKey, source: "트레이닝 파트", text: `부상자 ${context.injuredCount}명` }
    });
  }
}

function buildNarrativeContext(state, team, dateKey = state?.currentDate) {
  normalizeNarratives(state);
  const arcs = getNarrativeArcsForTeam(state, team, 3);
  if (!arcs.length) {
    return {
      arcs,
      reportLine: "아직 장기 이슈는 낮은 강도입니다.",
      mediaLine: "언론 프레임은 아직 형성 전입니다.",
      assistantLine: "누적 이슈는 아직 없습니다. 오늘 결정과 경기 결과부터 기억하겠습니다."
    };
  }
  const lead = arcs[0];
  const secondary = arcs[1];
  const evidence = lead.evidence?.[0]?.text ? ` 최근 근거: ${lead.evidence[0].text}` : "";
  return {
    arcs,
    reportLine: `${lead.headline}(${Math.round(safeNumber(lead.heat))}) - ${lead.summary}`,
    mediaLine: secondary
      ? `${lead.headline} 프레임에 ${secondary.headline} 이슈가 겹쳐 있습니다.`
      : `${lead.headline} 프레임이 이어지고 있습니다.`,
    assistantLine: `${lead.headline}: ${lead.summary}${evidence}`,
    date: dateKey
  };
}

function getNarrativeArcsForTeam(state, team, limit = 4) {
  normalizeNarratives(state);
  const teamId = String(team?.id ?? state.selectedTeamId ?? "");
  return state.narratives.arcs
    .filter((arc) => !arc.teamId || arc.teamId === "league" || String(arc.teamId) === teamId)
    .sort((a, b) => safeNumber(b.heat) - safeNumber(a.heat) || compareText(b.updatedAt, a.updatedAt))
    .slice(0, limit);
}

function rememberStructuredLogNarrative(state, message) {
  if (!message || typeof message !== "object") return;
  const rememberedTypes = new Set(["medical", "coaching", "interpreter", "trade-offer", "waiver", "operations", "front-office", "kbo-official", "compliance", "futures", "development"]);
  if (!rememberedTypes.has(String(message.type ?? ""))) return;
  const teamId = message.teamId ?? state.selectedTeamId ?? "";
  const heatByType = {
    medical: 16,
    coaching: 11,
    interpreter: 10,
    "trade-offer": 15,
    waiver: 12,
    operations: 9,
    "front-office": 10,
    "kbo-official": 11,
    compliance: 12,
    futures: 10,
    development: 8
  };
  rememberManagerAction(state, {
    type: `log-${message.type}`,
    teamId,
    subjectId: message.id ?? message.playerId ?? message.headline ?? message.tag ?? message.type,
    subject: message.tag ?? message.source ?? message.type,
    headline: message.headline ?? message.text ?? "구단 보고",
    summary: message.text ?? message.headline ?? "구단 보고가 장기 서사에 기록됐습니다.",
    heat: heatByType[message.type] ?? 8,
    confidence: 58,
    date: message.date ?? state.currentDate,
    source: message.source ?? message.tag ?? "뉴스함",
    tags: [message.type, message.tag, "mail"].filter(Boolean)
  });
}

function teamRunDiff(game, teamId) {
  if (!game || !teamId) return null;
  const key = String(teamId);
  if (String(game.homeTeamId ?? "") === key) return safeNumber(game.homeScore ?? game.homeRuns) - safeNumber(game.awayScore ?? game.awayRuns);
  if (String(game.awayTeamId ?? "") === key) return safeNumber(game.awayScore ?? game.awayRuns) - safeNumber(game.homeScore ?? game.homeRuns);
  return null;
}

function recentTeamResults(state, teamId, limit = 5) {
  const results = [];
  for (const game of state?.lastGames ?? []) {
    const diff = teamRunDiff(game, teamId);
    if (diff === null) continue;
    results.push({ game, diff });
    if (results.length >= limit) break;
  }
  return results;
}

function uniqueNarrativeStrings(values, limit = 8) {
  const list = Array.isArray(values) ? values : [values];
  const seen = new Set();
  const result = [];
  for (const value of list) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function narrativeKey(...parts) {
  const text = parts
    .map((part) => String(part ?? "").trim().toLowerCase().replace(/[^\w가-힣]+/g, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean)
    .join("-");
  return (text || "narrative").slice(0, 96);
}

function truncateNarrativeText(value, maxLength = 140) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function advanceDate(state, date) {
  const next = new Date(date.getTime() + MS_PER_DAY);
  state.currentDate = formatDateKey(next);
  state.day += 1;
}

function parseDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? new Date("2026-03-01T00:00:00.000Z") : parsed;
}

function openingDayForDateKey(dateKey) {
  const year = Number(String(dateKey ?? "").slice(0, 4));
  return `${Number.isFinite(year) ? year : 2026}-${OPENING_DAY_MONTH_DAY}`;
}

function winningPct(team) {
  const decisions = safeNumber(team.wins) + safeNumber(team.losses);
  return decisions === 0 ? 0 : safeNumber(team.wins) / decisions;
}

function captureInjurySnapshot(state) {
  return new Map(allPlayerEntries(state).map(({ player }) => [String(player.id ?? player.name ?? ""), safeNumber(player.injuredDays)]));
}

function collectNewInjuries(state, snapshot = new Map()) {
  return allPlayerEntries(state)
    .filter(({ player }) => {
      const key = String(player.id ?? player.name ?? "");
      return safeNumber(player.injuredDays) > 0 && safeNumber(snapshot.get(key)) <= 0;
    })
    .map(({ team, player }) => ({
      teamId: team.id,
      teamName: team.name,
      teamShortName: team.shortName ?? team.name,
      playerId: player.id,
      name: player.name,
      role: player.role,
      position: player.position,
      injuredDays: safeNumber(player.injuredDays),
      fatigue: safeNumber(player.fatigue),
      ovr: safeNumber(player.ovr)
    }))
    .sort((a, b) => safeNumber(b.injuredDays) - safeNumber(a.injuredDays) || safeNumber(b.ovr) - safeNumber(a.ovr))
    .slice(0, 8);
}

function addDailyMorningRoutine(state, context = {}) {
  const reportDate = context.reportDate ?? state.currentDate;
  const morningDate = addDaysKey(reportDate, 1);
  const results = Array.isArray(context.results) ? context.results : [];
  const team = findTeamById(state, state.selectedTeamId) ?? state.teams?.[0] ?? null;
  const focusGame = context.focusGame ?? findGameForTeam(results, team?.id) ?? results[0] ?? null;
  const newInjuries = Array.isArray(context.newInjuries) ? context.newInjuries : [];
  const selectedInjuries = newInjuries.filter((entry) => String(entry.teamId) === String(team?.id));
  const totalRuns = sum(results, "totalRuns");
  const futuresReport = buildFuturesDailyReport(state, team, reportDate);
  const weeklyPower = results.length
    ? summarizeWeeklyPower(results, focusGame, team)
    : "전 구단 이동·회복일로 피로도와 엔트리 상태를 재점검";
  const gameText = focusGame
    ? `${focusGame.away} ${focusGame.awayScore}-${focusGame.homeScore} ${focusGame.home}`
    : results.length
      ? `${results.length}경기`
      : "경기 없는 이동일";
  const injuryText = selectedInjuries.length
    ? `${selectedInjuries[0].name} ${selectedInjuries[0].injuredDays}일 이탈 보고`
    : newInjuries.length
      ? `리그 신규 부상 ${newInjuries.length}건`
      : "신규 부상 보고 없음";
  recordDailyNarratives(state, {
    team,
    focusGame,
    results,
    newInjuries,
    futuresReport,
    weeklyPower,
    totalRuns,
    reportDate,
    gameText
  });
  runClubhousePressureRoutine(state, team, morningDate);
  const narrative = buildNarrativeContext(state, team, morningDate);

  deliverMail(state, {
    date: morningDate,
    from: { role: "전력분석팀", icon: "analysis" },
    category: "club",
    type: "daily-report",
    tag: "전력분석",
    source: "전력분석팀",
    headline: `[전력분석] ${formatKoreanMonthDay(reportDate)} 경기 결과 및 주간 전력 분석 보고`,
    text: `1군 포커스: ${gameText}. 리그 ${results.length}경기 총 ${totalRuns}득점, ${weeklyPower}. 퓨처스리그: ${futuresReport.scoreText}. 2군 감독 보고: ${futuresReport.note}. 장기 서사: ${narrative.reportLine}`
  });

  deliverMail(state, {
    date: morningDate,
    from: { role: selectMediaOutlet(reportDate, team?.id ?? "kbo"), icon: "media" },
    category: "media",
    type: "media",
    tag: selectMediaOutlet(reportDate, team?.id ?? "kbo"),
    source: selectMediaOutlet(reportDate, team?.id ?? "kbo"),
    headline: `${team?.shortName ?? "KBO"} 벤치 선택에 시선 집중`,
    text: `${gameText} 이후 ${PRESEASON_MEDIA_OUTLETS.join(", ")} 데스크가 라인업 피로도와 콜업 후보를 주요 이슈로 다뤘습니다. ${narrative.mediaLine}`
  });

  deliverMail(state, {
    date: morningDate,
    from: { role: "개인비서", icon: "assistant" },
    category: "club",
    type: "assistant",
    tag: "개인비서",
    source: "개인비서",
    headline: `${team?.shortName ?? "우리 팀"} 경기 후 아침 보고`,
    text: `${gameText}. ${injuryText}. 누적 이슈: ${narrative.assistantLine}. 오늘 확인할 항목은 엔트리 재등록 가능일, 외국인 출전 제한, 불펜 과부하, 시장 알림입니다.`
  });

  if (selectedInjuries.length) addMedicalReportLog(state, team, selectedInjuries[0], morningDate);
  addRosterReentryNotices(state, team, morningDate);
  addForeignLineupWarningLog(state, team, morningDate);
  addBullpenOverloadLog(state, team, morningDate);
  addForeignAdaptationLog(state, team, morningDate);
  addDailyMarketBreakLog(state, team, morningDate);
  addRecurringRhythmMails(state, team, morningDate, { reportDate, results, focusGame, futuresReport });
  addEventTriggerMails(state, team, morningDate, { reportDate, results, focusGame, futuresReport, newInjuries });
}

function addRecurringRhythmMails(state, team, dateKey, context = {}) {
  if (!team) return;
  const date = parseDate(dateKey);
  const weekday = date.getUTCDay();
  const dayOfMonth = date.getUTCDate();

  if (weekday === 1) {
    deliverUniqueMail(state, buildWeeklyReviewMail(state, team, dateKey));
    deliverUniqueMail(state, buildPowerRankingMail(state, team, dateKey));
    state.weeklySnapshot = buildWeeklySnapshot(state, dateKey);
  }

  if (isSeriesFirstGameDay(state, team, dateKey)) {
    deliverUniqueMail(state, buildSeriesPreviewMail(state, team, dateKey));
  }

  if (dayOfMonth === 1) {
    deliverUniqueMail(state, buildMonthlyReviewMail(state, team, dateKey));
    deliverUniqueMail(state, buildOwnerMonthlyMail(state, team, dateKey));
    state.monthlySnapshot = buildMonthlySnapshot(state, dateKey);
  }

  if (dayOfMonth === 25) {
    deliverUniqueMail(state, buildPayrollMail(state, team, dateKey));
  }

  if (context.futuresReport?.hot) {
    addFuturesCallupDecisionMail(state, team, dateKey, context.futuresReport);
  }
}

function addEventTriggerMails(state, team, dateKey, context = {}) {
  if (!team) return;
  addStreakTriggerMails(state, team, dateKey);
  addStandingsTriggerMails(state, team, dateKey);
  addMilestoneTriggerMails(state, team, dateKey);
  addLeagueTrendMails(state, team, dateKey, context);
}

function deliverUniqueMail(state, mail) {
  if (!mail?.id) return null;
  normalizeMailboxState(state);
  if (state.mailbox.items.some((item) => String(item.id) === String(mail.id))) return null;
  if (state.mailbox.deferred.some((item) => String(item.id) === String(mail.id))) return null;
  return deliverMail(state, mail);
}

function buildWeeklyReviewMail(state, team, dateKey) {
  const recent = recentTeamResults(state, team.id, 6);
  const wins = recent.filter((item) => item.diff > 0).length;
  const losses = recent.filter((item) => item.diff < 0).length;
  const mvp = selectWeeklyMvp(team);
  return {
    id: `weekly-review-${dateKey}-${team.id}`,
    date: dateKey,
    from: { role: "전력분석팀", icon: "analysis" },
    category: "club",
    type: "weekly-review",
    headline: `[전력분석] ${team.shortName ?? team.name} 주간 리뷰`,
    body: `지난 주 표본 ${recent.length}경기 기준 ${wins}승 ${losses}패입니다. 팀 득실차는 ${formatSignedNumber(safeNumber(team.runsFor) - safeNumber(team.runsAgainst))}, 주간 MVP 후보는 ${mvp?.name ?? "선정 대기"}입니다. 이번 주는 불펜 소모와 상위 타순 출루율을 같이 보겠습니다.`,
    read: false
  };
}

function buildPowerRankingMail(state, team, dateKey) {
  const standings = getStandings(state);
  const lines = standings.slice(0, 10).map((entry, index) => {
    const recent = recentTeamResults(state, entry.id, 5);
    const wins = recent.filter((item) => item.diff > 0).length;
    const tone = wins >= 4 ? "상승" : wins <= 1 ? "경계" : "유지";
    return `${index + 1}. ${entry.shortName ?? entry.name} ${renderRecordText(entry)} · 최근 ${wins}/${recent.length || 0}승 ${tone}`;
  });
  return {
    id: `power-ranking-${dateKey}`,
    date: dateKey,
    from: { role: selectMediaOutlet(dateKey, "power-ranking"), icon: "media" },
    category: "media",
    type: "power-ranking",
    headline: "리그 파워랭킹 업데이트",
    body: lines.join(" / "),
    read: false,
    important: standings[0]?.id === team.id
  };
}

function buildSeriesPreviewMail(state, team, dateKey) {
  const preview = getPreviewForDate(state, team.id, dateKey);
  const opponentId = String(preview.awayTeamId) === String(team.id) ? preview.homeTeamId : preview.awayTeamId;
  const opponent = findTeamById(state, opponentId);
  const opponentRecent = recentTeamResults(state, opponentId, 5);
  const opponentWins = opponentRecent.filter((item) => item.diff > 0).length;
  const starter = buildPitchingSnapshot(team).nextStarter?.name ?? "";
  const dangerous = selectDangerousHitters(opponent, dateKey).map((player) => player.name).join(", ") || "상위 타선";
  return {
    id: `series-preview-${dateKey}-${team.id}-${opponentId}`,
    date: dateKey,
    from: { role: "전력분석팀", icon: "analysis" },
    category: "club",
    type: "series-preview",
    headline: `${opponent?.shortName ?? "상대"} 시리즈 프리뷰`,
    body: `오늘부터 ${opponent?.shortName ?? "상대"}전입니다. 상대 최근 5경기 ${opponentWins}승, 현재 성적 ${renderRecordText(opponent)}. 우리 예상 선발은 ${starter || "로테이션 확인 중"}이며, 조심할 타자는 ${dangerous}입니다.`,
    read: false,
    important: true
  };
}

function buildMonthlyReviewMail(state, team, dateKey) {
  const standings = getStandings(state);
  const rank = standings.findIndex((entry) => String(entry.id) === String(team.id)) + 1;
  const attendance = safeNumber(team.attendanceTotal);
  return {
    id: `monthly-review-${dateKey}-${team.id}`,
    date: dateKey,
    from: { role: "운영팀", icon: "operations" },
    category: "club",
    type: "monthly-review",
    headline: `${String(dateKey).slice(5, 7)}월 구단 운영 결산`,
    body: `${team.shortName ?? team.name} 현재 ${rank || "-"}위, 성적 ${renderRecordText(team)}, 누적 관중 ${Math.round(attendance).toLocaleString("ko-KR")}명입니다. 전월 대비 순위와 관중 흐름은 운영 회의 안건으로 남겼습니다.`,
    read: false
  };
}

function buildOwnerMonthlyMail(state, team, dateKey) {
  const currentJob = ensureManagerJob(state, team);
  const job = currentJob.lastEvaluatedAt === String(dateKey)
    ? currentJob
    : evaluateManagerJobPressure(state, team, dateKey, { force: true });
  const standings = getStandings(state);
  const rank = standings.findIndex((entry) => String(entry.id) === String(team.id)) + 1;
  const expected = job?.seasonGoal?.targetRank ?? getOwnerExpectedRank(state, team);
  const tone = job?.trust <= MANAGER_TRUST_WARNING ? "우려" : rank && rank <= expected ? "격려" : rank && rank >= expected + 3 ? "우려" : "중립";
  const delta = tone === "격려" ? 1 : tone === "우려" ? -1 : 0;
  team.morale = clamp(safeNumber(team.morale, 50) + delta, 20, 90);
  return {
    id: `owner-monthly-${dateKey}-${team.id}`,
    date: dateKey,
    from: { role: "구단주", icon: "owner" },
    category: "club",
    type: "owner-monthly",
    headline: `구단주 월례 평가: ${tone}`,
    body: `시즌 목표는 ${job?.seasonGoal?.label ?? `${expected}위권`}입니다. 현재 ${rank || "-"}위, 감독 신뢰도 ${job?.trust ?? "-"}(${managerTrustLabel(job?.trust)}), 운영 철학은 ${CLUB_PHILOSOPHIES[job?.philosophy]?.label ?? "균형 운영"}입니다. 구단주는 ${tone === "격려" ? "현장 메시지를 긍정적으로 평가했습니다" : tone === "우려" ? "분위기 전환 계획을 요구했습니다" : "현 흐름을 더 지켜보겠다는 입장입니다"}.`,
    read: false,
    important: tone !== "중립"
  };
}

function buildPayrollMail(state, team, dateKey) {
  const monthlyPayroll = (safeNumber(team.payroll) * 100_000_000) / 12;
  const room = (safeNumber(team.budget) - safeNumber(team.payroll)) * 100_000_000;
  return {
    id: `payroll-${dateKey}-${team.id}`,
    date: dateKey,
    from: { role: "재정팀", icon: "finance" },
    category: "club",
    type: "payroll",
    headline: "월 급여 정산 보고",
    body: `이번 달 예상 연봉 지출은 ${formatMoneyForLog(monthlyPayroll)}입니다. 예산 여력은 ${formatMoneyForLog(room)}이며, 시장 움직임 전 현금성 지출을 재점검해야 합니다.`,
    read: false
  };
}

function addFuturesCallupDecisionMail(state, team, dateKey, futuresReport) {
  const player = futuresReport.player;
  if (!player) return;
  deliverUniqueMail(state, {
    id: `futures-hot-${dateKey}-${player.id}`,
    date: dateKey,
    from: { role: "2군 감독", icon: "futures" },
    category: "club",
    type: "futures",
    headline: `${player.name} 콜업 건의`,
    body: `${futuresReport.note} 2군 현장은 지금 1군 테스트 타이밍으로 보고 있습니다.`,
    read: false,
    important: true,
    links: [{ label: "선수 상세", target: `player:${player.id}` }]
  });
  queueMailDecision(state, {
    id: `futures-callup-${dateKey}-${player.id}`,
    date: dateKey,
    type: "futures-callup",
    blocking: false,
    severity: "notice",
    teamId: team.id,
    teamName: team.name,
    playerId: player.id,
    playerName: player.name,
    headline: `${player.name} 1군 콜업 여부`,
    body: `${player.name}이 퓨처스에서 상승세입니다. 오늘 1군 등록으로 분위기를 바꿀지, 한 차례 더 관찰할지 결정하십시오.`,
    options: [
      { action: "callup", label: "콜업", note: "1군 active 전환" },
      { action: "hold", label: "보류", note: "추가 관찰" }
    ],
    links: [{ label: "선수 상세", target: `player:${player.id}` }]
  });
}

function addStreakTriggerMails(state, team, dateKey) {
  const streak = String(team.streak ?? "");
  const marker = streak[0];
  const count = safeNumber(streak.slice(1));
  if (!["W", "L"].includes(marker) || ![3, 5, 8].includes(count)) return;
  const key = `streak-${team.id}-${marker}-${count}`;
  if (state.milestoneLedger[key]) return;
  state.milestoneLedger[key] = dateKey;
  const winning = marker === "W";
  deliverUniqueMail(state, {
    id: `streak-${dateKey}-${team.id}-${marker}-${count}`,
    date: dateKey,
    from: { role: selectMediaOutlet(dateKey, "streak"), icon: "media" },
    category: "media",
    type: "streak",
    headline: `${team.shortName ?? team.name} ${count}${winning ? "연승" : "연패"}`,
    body: winning
      ? `${team.shortName ?? team.name}가 ${count}연승으로 순위 레이스에 압박을 걸었습니다. 클럽하우스 분위기는 상승세입니다.`
      : `${team.shortName ?? team.name}가 ${count}연패에 빠졌습니다. 라인업 메시지와 불펜 운용을 둘러싼 질문이 커지고 있습니다.`,
    read: false,
    important: count >= 5
  });
  if (!winning && count >= 8) {
    team.morale = clamp(safeNumber(team.morale, 50) - 1, 20, 90);
    deliverUniqueMail(state, {
      id: `owner-streak-${dateKey}-${team.id}-${count}`,
      date: dateKey,
      from: { role: "구단주", icon: "owner" },
      category: "club",
      type: "owner-monthly",
      headline: "구단주 우려 메시지",
      body: `${count}연패 흐름에 대해 구단주는 선수단 메시지와 현장 대응 계획을 요구했습니다.`,
      read: false,
      important: true
    });
  }
}

function addStandingsTriggerMails(state, team, dateKey) {
  const standings = getStandings(state);
  const rank = standings.findIndex((entry) => String(entry.id) === String(team.id)) + 1;
  if (!rank) return;
  const band = rank === 1 ? "first" : rank <= 5 ? "top5" : "outside";
  const key = `rank-band-${team.id}`;
  if (state.milestoneLedger[key] === band) return;
  const previous = state.milestoneLedger[key];
  state.milestoneLedger[key] = band;
  if (!previous) return;
  deliverUniqueMail(state, {
    id: `rank-event-${dateKey}-${team.id}-${band}`,
    date: dateKey,
    from: { role: selectMediaOutlet(dateKey, "rank"), icon: "media" },
    category: "media",
    type: "standings-race",
    headline: band === "first" ? `${team.shortName ?? team.name} 1위 등극` : band === "top5" ? `${team.shortName ?? team.name} 5위권 진입` : `${team.shortName ?? team.name} 5위권 이탈`,
    body: `현재 순위는 ${rank}위, 성적은 ${renderRecordText(team)}입니다. 순위 레이스의 체감 압박이 바뀌었습니다.`,
    read: false,
    important: true
  });
}

function addMilestoneTriggerMails(state, team, dateKey) {
  for (const player of team.roster ?? []) {
    const batting = player.seasonStats?.batting ?? {};
    const pitching = player.seasonStats?.pitching ?? {};
    const checks = player.role === "pitcher"
      ? [
          ["wins", safeNumber(pitching.wins), [10]],
          ["saves", safeNumber(pitching.saves), [20]],
          ["strikeouts", safeNumber(pitching.strikeouts), [100]]
        ]
      : [
          ["homeRuns", safeNumber(batting.homeRuns), [10, 20, 30]],
          ["hits", safeNumber(batting.hits), [100]],
          ["stolenBases", safeNumber(batting.stolenBases), [30]]
        ];
    for (const [stat, value, thresholds] of checks) {
      for (const threshold of thresholds) {
        const key = `milestone-${team.id}-${player.id}-${stat}-${threshold}`;
        if (value >= threshold && !state.milestoneLedger[key]) {
          state.milestoneLedger[key] = dateKey;
          deliverMilestoneMail(state, team, player, stat, threshold, dateKey);
        } else if (value === threshold - 2) {
          const paceKey = `pace-${team.id}-${player.id}-${stat}-${threshold}`;
          if (!state.milestoneLedger[paceKey]) {
            state.milestoneLedger[paceKey] = dateKey;
            deliverPaceMail(state, team, player, stat, threshold, dateKey);
          }
        }
      }
    }
  }
}

function addLeagueTrendMails(state, team, dateKey, context = {}) {
  const completedTrade = (state.trades?.completed ?? [])[0];
  if (completedTrade?.date === dateKey) {
    deliverUniqueMail(state, {
      id: `league-trade-${dateKey}-${completedTrade.id}`,
      date: dateKey,
      from: { role: "리그 동향", icon: "league" },
      category: "league",
      type: "trade-completed",
      headline: "타 구단 트레이드 완료",
      body: completedTrade.summary ?? "리그 내 트레이드가 완료됐습니다. 순위 경쟁 구도와 포지션 수급에 영향을 줄 수 있습니다.",
      read: false
    });
  }
  const leagueInjury = (context.newInjuries ?? []).find((entry) => String(entry.teamId) !== String(team.id) && safeNumber(entry.ovr) >= 135);
  if (leagueInjury) {
    deliverUniqueMail(state, {
      id: `league-injury-${dateKey}-${leagueInjury.teamId}-${leagueInjury.playerId}`,
      date: dateKey,
      from: { role: "리그 동향", icon: "league" },
      category: "league",
      type: "league-news",
      headline: `${leagueInjury.teamShortName} 주전급 부상 소식`,
      body: `${leagueInjury.name} 선수가 ${leagueInjury.injuredDays}일 이탈 예정입니다. 해당 구단의 로스터 운용과 트레이드 수요가 변할 수 있습니다.`,
      read: false
    });
  }
}

function deliverMilestoneMail(state, team, player, stat, threshold, dateKey) {
  deliverUniqueMail(state, {
    id: `milestone-mail-${dateKey}-${player.id}-${stat}-${threshold}`,
    date: dateKey,
    from: { role: selectMediaOutlet(dateKey, player.id), icon: "media" },
    category: "media",
    type: "milestone",
    headline: `${player.name} 시즌 ${formatMilestoneStat(stat, threshold)} 달성`,
    body: `${team.shortName ?? team.name} ${player.name}이 시즌 ${formatMilestoneStat(stat, threshold)} 고지를 밟았습니다. 팀 서사와 팬 반응에 남을 장면입니다.`,
    read: false,
    important: true,
    links: [{ label: "선수 상세", target: `player:${player.id}` }]
  });
}

function deliverPaceMail(state, team, player, stat, threshold, dateKey) {
  deliverUniqueMail(state, {
    id: `pace-mail-${dateKey}-${player.id}-${stat}-${threshold}`,
    date: dateKey,
    from: { role: "전력분석팀", icon: "analysis" },
    category: "club",
    type: "milestone",
    headline: `${player.name} ${formatMilestoneStat(stat, threshold)} 임박`,
    body: `${player.name}이 ${formatMilestoneStat(stat, threshold)}까지 2개를 남겼습니다. 기용 타이밍과 타순/등판 간격을 조정하면 이번 시리즈 안에 달성 가능성이 있습니다.`,
    read: false,
    links: [{ label: "선수 상세", target: `player:${player.id}` }]
  });
}

function isSeriesFirstGameDay(state, team, dateKey) {
  const preview = getPreviewForDate(state, team.id, dateKey);
  if (!preview?.ok || String(preview.date) !== String(dateKey)) return false;
  const opponentId = String(preview.awayTeamId) === String(team.id) ? preview.homeTeamId : preview.awayTeamId;
  if (!opponentId) return false;
  const key = `series-preview-opponent-${team.id}`;
  if (state.milestoneLedger[key] === `${dateKey}:${opponentId}`) return false;
  const lastOpponent = state.milestoneLedger[`series-last-opponent-${team.id}`];
  state.milestoneLedger[`series-preview-opponent-${team.id}`] = `${dateKey}:${opponentId}`;
  state.milestoneLedger[`series-last-opponent-${team.id}`] = opponentId;
  return lastOpponent !== opponentId;
}

function getPreviewForDate(state, teamId, dateKey) {
  return getNextGamePreview({ ...state, currentDate: dateKey }, teamId);
}

function selectWeeklyMvp(team) {
  return [...(team?.roster ?? [])]
    .sort((a, b) => playerRecentValue(b) - playerRecentValue(a) || compareText(a.name, b.name))[0] ?? null;
}

function playerRecentValue(player) {
  const batting = player?.seasonStats?.batting ?? {};
  const pitching = player?.seasonStats?.pitching ?? {};
  if (player?.role === "pitcher") {
    return safeNumber(pitching.wins) * 18 + safeNumber(pitching.saves) * 12 + safeNumber(pitching.holds) * 6 + safeNumber(pitching.strikeouts) - safeNumber(pitching.earnedRuns) * 2;
  }
  return safeNumber(batting.homeRuns) * 12 + safeNumber(batting.hits) * 2 + safeNumber(batting.rbi) + safeNumber(batting.stolenBases) * 1.5;
}

function selectDangerousHitters(team, dateKey) {
  return [...(team?.roster ?? [])]
    .filter((player) => player.role !== "pitcher")
    .sort((a, b) =>
      (hitterScore(b) + deterministicRange(dateKey, b.id, "danger", 0, 8)) -
      (hitterScore(a) + deterministicRange(dateKey, a.id, "danger", 0, 8))
    )
    .slice(0, 2);
}

function getOwnerExpectedRank(state, team) {
  const standings = [...(state.teams ?? [])]
    .sort((a, b) => teamStrengthScore(b) - teamStrengthScore(a));
  return Math.max(1, standings.findIndex((entry) => String(entry.id) === String(team.id)) + 1);
}

function teamStrengthScore(team) {
  const roster = team?.roster ?? [];
  const top = [...roster].sort((a, b) => safeNumber(b.ovr) - safeNumber(a.ovr)).slice(0, 18);
  return averageNumbers(...top.map((player) => safeNumber(player.ovr))) + safeNumber(team?.budget) * 0.05;
}

function buildWeeklySnapshot(state, dateKey) {
  return {
    weekStartDate: dateKey,
    teamRecords: Object.fromEntries((state.teams ?? []).map((team) => [team.id, { wins: safeNumber(team.wins), losses: safeNumber(team.losses), ties: safeNumber(team.ties) }])),
    playerStatMarks: {}
  };
}

function buildMonthlySnapshot(state, dateKey) {
  const standings = getStandings(state);
  return {
    monthKey: String(dateKey).slice(0, 7),
    standings: Object.fromEntries(standings.map((team, index) => [team.id, index + 1])),
    teamRecords: Object.fromEntries((state.teams ?? []).map((team) => [team.id, { wins: safeNumber(team.wins), losses: safeNumber(team.losses), ties: safeNumber(team.ties) }]))
  };
}

function renderRecordText(team) {
  if (!team) return "-";
  return `${safeNumber(team.wins)}승 ${safeNumber(team.losses)}패 ${safeNumber(team.ties)}무`;
}

function formatSignedNumber(value) {
  const number = safeNumber(value);
  return number > 0 ? `+${number}` : `${number}`;
}

function formatMilestoneStat(stat, threshold) {
  const labels = {
    homeRuns: `${threshold}홈런`,
    hits: `${threshold}안타`,
    stolenBases: `${threshold}도루`,
    wins: `${threshold}승`,
    saves: `${threshold}세이브`,
    strikeouts: `${threshold}탈삼진`
  };
  return labels[stat] ?? `${threshold}${stat}`;
}

function resolveMedicalRosterDecision(state, decision, action) {
  const entry = findPlayerEntry(state, decision.playerId, decision.teamId) ?? findPlayerEntry(state, decision.playerId);
  const player = entry?.player ?? null;
  const team = entry?.team ?? findTeamById(state, decision.teamId);
  const callupEntry = findPlayerEntry(state, decision.callupCandidateId, decision.teamId) ??
    (team ? { team, player: selectCallupCandidate(team, player ?? decision, state.currentDate), index: -1 } : null);
  if (["callup", "auto-replace"].includes(action) && player && team) {
    const eligibleDate = addDaysKey(state.currentDate, KBO_OPTION_LOCK_DAYS);
    player.status = "futures";
    player.rosterLock = {
      type: "kbo-10day-option",
      reason: "medical",
      demotedDate: state.currentDate,
      eligibleDate,
      noticeSent: ""
    };
    player.fatigue = clamp(safeNumber(player.fatigue) - 8, 0, 100);
    if (callupEntry?.player && callupEntry.player !== player) {
      callupEntry.player.status = "active";
      callupEntry.player.rosterLock = {
        type: "first-team-registration",
        reason: "injury-replacement",
        activatedDate: state.currentDate,
        replacesPlayerId: player.id ?? decision.playerId
      };
      callupEntry.player.morale = clamp(safeNumber(callupEntry.player.morale, 50) + 4, 20, 90);
    }
    team.morale = clamp(safeNumber(team.morale, 50) + 1, 20, 85);
    const replacementText = callupEntry?.player && callupEntry.player !== player
      ? `대체 선수 ${callupEntry.player.name}을 1군 등록했습니다.`
      : "대체 등록 후보가 부족해 프런트에 추가 확인을 요청했습니다.";
    return {
      ok: true,
      code: "medical-callup",
      message: `${player.name}을 1군 엔트리에서 말소했습니다. 재등록 가능일은 ${eligibleDate}입니다. ${replacementText}`
    };
  }
  if (action === "rush" && player) {
    player.injuredDays = Math.max(0, safeNumber(player.injuredDays) - 1);
    player.fatigue = clamp(safeNumber(player.fatigue) + 12, 0, 100);
    player.dailyCondition = clamp(safeNumber(player.dailyCondition, player.form) - 8, 20, 95);
    return { ok: true, code: "rushed", message: `${player.name}의 복귀 일정을 당겼습니다. 단, 피로도와 재부상 위험이 크게 올라갔습니다.` };
  }
  if (player) {
    player.fatigue = clamp(safeNumber(player.fatigue) - 6, 0, 100);
    player.dailyCondition = clamp(safeNumber(player.dailyCondition, player.form) + 2, 20, 95);
  }
  return { ok: true, code: "medical-monitor", message: `${decision.playerName ?? player?.name ?? "부상 선수"}의 회복 우선 방침을 확정했습니다. 트레이닝 파트가 매일 상태를 재보고합니다.` };
}

function resolveForeignLineupDecision(state, decision, action) {
  const benchEntry = findPlayerEntry(state, decision.benchPlayerId, decision.teamId);
  const starterEntry = findPlayerEntry(state, decision.starterPlayerId, decision.teamId);
  if (action === "bench-hitter" && benchEntry?.player) {
    benchEntry.player.gameRestriction = {
      type: "foreign-appearance-limit",
      date: state.currentDate,
      reason: "KBO 2명 출전 제한"
    };
    benchEntry.player.dailyCondition = clamp(safeNumber(benchEntry.player.dailyCondition, benchEntry.player.form) - 2, 20, 95);
    return { ok: true, code: "foreign-hitter-benched", message: `${benchEntry.player.name}을 오늘 외국인 출전 제한 관리 대상으로 표시했습니다.` };
  }
  if (action === "rotate-pitcher" && starterEntry?.player) {
    starterEntry.player.gameRestriction = {
      type: "foreign-appearance-limit",
      date: state.currentDate,
      reason: "외국인 선발 로테이션 조정"
    };
    starterEntry.player.armFreshness = clamp(safeNumber(starterEntry.player.armFreshness, 80) + 4, 20, 100);
    return { ok: true, code: "foreign-starter-held", message: `${starterEntry.player.name}의 외국인 선발 출전안을 보류하고 로테이션 조정을 지시했습니다.` };
  }
  return { ok: true, code: "foreign-lineup-ack", message: "외국인 선수 출전 제한 경고를 확인하고 라인업 검토 안건으로 남겼습니다." };
}

function resolveForeignAdaptationDecision(state, decision, action) {
  const team = findTeamById(state, decision.teamId) ?? findTeamById(state, state.selectedTeamId);
  const entry = findPlayerEntry(state, decision.playerId, decision.teamId);
  const player = entry?.player ?? null;
  if (["extra-support", "family-support"].includes(action)) {
    if (player) {
      player.morale = clamp(safeNumber(player.morale, 50) + 10, 20, 95);
      player.dailyCondition = clamp(safeNumber(player.dailyCondition, player.form) + 8, 25, 98);
      player.form = clamp(safeNumber(player.form, 50) + 3, 35, 80);
    }
    if (team) {
      team.morale = clamp(safeNumber(team.morale, 50) + 2, 20, 85);
      team.payroll = roundNumber(safeNumber(team.payroll) + FOREIGN_FAMILY_SUPPORT_KRW / 100_000_000, 1);
      appendFinanceLedger(state, {
        id: `finance-foreign-family-${state.currentDate}-${decision.playerId ?? "player"}`,
        date: state.currentDate,
        category: "foreign-adaptation",
        type: "expense",
        teamId: team.id,
        amountKRW: FOREIGN_FAMILY_SUPPORT_KRW,
        description: `${decision.playerName ?? player?.name ?? "외국인 선수"} 가족 초청 및 통역 지원`,
        sourceEventId: decision.id ?? ""
      });
    }
    return { ok: true, code: "foreign-family-support", message: `${decision.playerName ?? player?.name ?? "외국인 선수"} 가족 초청과 통역 지원 비용 ${formatMoneyForLog(FOREIGN_FAMILY_SUPPORT_KRW)}을 승인했습니다.` };
  }
  if (action === "demote" && player) {
    player.status = "futures";
    player.morale = clamp(safeNumber(player.morale, 50) - 12, 10, 90);
    if (team) team.morale = clamp(safeNumber(team.morale, 50) - 1, 20, 85);
    return { ok: true, code: "foreign-demoted", message: `${player.name}을 2군 조정으로 보냈습니다. 단, 멘탈과 선수단 분위기가 내려갔습니다.` };
  }
  if (player) {
    player.morale = clamp(safeNumber(player.morale, 50) + 2, 20, 95);
  }
  if (team) team.morale = clamp(safeNumber(team.morale, 50) + 1, 20, 85);
  return { ok: true, code: "foreign-adaptation-monitor", message: "외국인 선수 적응 상태를 통역 파트 주간 면담으로 관리합니다." };
}

function resolveTradeOfferDecision(state, decision, action) {
  if (action === "reject") {
    return { ok: true, code: "trade-rejected", message: "트레이드 제안을 보류하고 기존 자산 가치를 유지했습니다." };
  }
  if (action === "counter") {
    return { ok: true, code: "trade-countered", message: `현금 보상 ${formatMoneyForLog(safeNumber(decision.cashKRW))}을 낮추는 역제안을 보냈습니다.` };
  }
  if (action === "accept") {
    const result = completeBreakTrade(state, decision);
    if (result.ok) return result;
  }
  return { ok: true, code: "trade-reviewed", message: "트레이드 제안을 스카우트/재정팀 검토 안건으로 넘겼습니다." };
}

function resolveWaiverClaimDecision(state, decision, action) {
  if (action === "claim") {
    const result = completeWaiverClaim(state, decision);
    if (result.ok) return result;
    return { ok: true, code: "waiver-claim-requested", message: "웨이버 클레임 우선순위 등록을 요청했습니다." };
  }
  return { ok: true, code: "waiver-pass", message: "웨이버 후보를 패스하고 현재 로스터를 유지했습니다." };
}

function resolveBullpenRestDecision(state, decision, action) {
  const entry = findPlayerEntry(state, decision.playerId, decision.teamId);
  const player = entry?.player ?? null;
  if (action === "rest" && player) {
    player.gameRestriction = {
      type: "bullpen-rest",
      date: state.currentDate,
      reason: "수석코치 혹사 경고"
    };
    player.fatigue = clamp(safeNumber(player.fatigue) - 6, 0, 100);
    player.armFreshness = clamp(safeNumber(player.armFreshness, 80) + 6, 20, 100);
    return { ok: true, code: "bullpen-rested", message: `${player.name}에게 오늘 휴식 지시를 내렸습니다. 경기 엔진은 해당 투수를 등판 제한 대상으로 표시합니다.` };
  }
  return { ok: true, code: "bullpen-discretion", message: `${decision.playerName ?? player?.name ?? "불펜 투수"} 등판 여부를 경기 흐름에 맡겼습니다.` };
}

function resolveFuturesCallupDecision(state, decision, action) {
  const entry = findPlayerEntry(state, decision.playerId, decision.teamId);
  const player = entry?.player ?? null;
  if (action === "callup" && player) {
    player.status = "active";
    player.morale = clamp(safeNumber(player.morale, 50) + 6, 20, 95);
    player.dailyCondition = clamp(safeNumber(player.dailyCondition, player.form) + 4, 20, 98);
    return { ok: true, code: "futures-callup", message: `${player.name}을 1군 콜업 후보에서 실제 등록으로 전환했습니다.` };
  }
  if (player) player.morale = clamp(safeNumber(player.morale, 50) - 1, 20, 95);
  return { ok: true, code: "futures-hold", message: `${decision.playerName ?? player?.name ?? "퓨처스 후보"} 콜업은 보류하고 추가 관찰합니다.` };
}

function resolveOpeningRosterDecision(state, decision, action) {
  const selectedId = action === "choose-b" ? decision.candidateBId : decision.candidateAId;
  const entry = findPlayerEntry(state, selectedId, decision.teamId);
  if (entry?.player) {
    entry.player.status = "active";
    entry.player.morale = clamp(safeNumber(entry.player.morale, 50) + 5, 20, 95);
    return { ok: true, code: "opening-roster-selected", message: `${entry.player.name}을 개막 엔트리 마지막 자리 후보로 확정했습니다.` };
  }
  return { ok: true, code: "opening-roster-reviewed", message: "개막 엔트리 마지막 자리는 현재 코칭스태프 안을 유지합니다." };
}

function resolveOpeningRotationDecision(state, decision, action) {
  if (action === "review-lineup") {
    return { ok: true, code: "opening-rotation-review", message: "개막 로테이션을 라인업 탭에서 재검토하기로 했습니다." };
  }
  return { ok: true, code: "opening-rotation-confirmed", message: "현재 투수 운용표를 개막 로테이션 기준안으로 확정했습니다." };
}

function resolveInterviewDecision(state, decision, action) {
  const team = findTeamById(state, decision.teamId) ?? findTeamById(state, state.selectedTeamId);
  const delta = action === "protect-clubhouse" ? 2 : action === "challenge" ? 1 : 0;
  if (team) team.morale = clamp(safeNumber(team.morale, 50) + delta, 20, 90);
  return { ok: true, code: "interview-answered", message: "인터뷰 답변 톤이 클럽하우스 서사에 기록됐습니다." };
}

function resolveSlumpingStarterDecision(state, decision, action) {
  const entry = findPlayerEntry(state, decision.playerId, decision.teamId);
  const player = entry?.player ?? null;
  if (action === "demote" && player) {
    player.status = "futures";
    player.morale = clamp(safeNumber(player.morale, 50) - 8, 10, 90);
    return { ok: true, code: "slump-demoted", message: `${player.name}을 2군 조정 대상으로 내렸습니다. 선수단 반응은 후속 보고로 확인됩니다.` };
  }
  if (player) player.morale = clamp(safeNumber(player.morale, 50) + 1, 20, 95);
  return { ok: true, code: "slump-trusted", message: `${decision.playerName ?? player?.name ?? "부진 주전"}에게 한 번 더 기회를 주기로 했습니다.` };
}

function resolvePlayerMeetingDecision(state, decision, action) {
  const entry = findPlayerEntry(state, decision.playerId, decision.teamId);
  const player = entry?.player ?? null;
  const issue = state.playerRelations?.issues?.find((item) => String(item.id) === String(decision.issueId));
  if (!player) return { ok: true, code: "player-meeting-missing", message: "면담 대상 선수를 찾지 못해 코칭스태프 메모로 남겼습니다." };
  if (action === "promise-playing-time" || action === "promise-callup") {
    const promiseType = action === "promise-callup" ? "first-team" : "playing-time";
    const dueDays = promiseType === "first-team" ? 14 : PROMISE_WINDOW_DAYS;
    const promise = normalizePromise({
      id: `promise-${state.currentDate}-${decision.teamId}-${player.id}-${promiseType}`,
      type: promiseType,
      teamId: decision.teamId,
      playerId: player.id,
      playerName: player.name,
      label: promiseLabel(promiseType),
      madeDate: state.currentDate,
      dueDate: addDaysKey(state.currentDate, dueDays),
      status: "active",
      baselineGames: promisePlayerGames(player),
      targetGames: promiseType === "first-team" ? 1 : PROMISE_PLAYING_TIME_GAMES,
      sourceIssueId: decision.issueId
    }, state);
    state.promises = [promise, ...(state.promises ?? []).filter((item) => item.id !== promise.id)].slice(0, MANAGER_PROMISE_LIMIT);
    if (issue) {
      issue.status = "promise-made";
      issue.promiseId = promise.id;
      issue.updatedAt = state.currentDate;
    }
    player.morale = clamp(safeNumber(player.morale, 50) + 3, 20, 95);
    rememberManagerAction(state, {
      type: "player-promise",
      teamId: decision.teamId,
      subjectId: player.id,
      subject: player.name,
      headline: `${player.name}에게 ${promise.label} 약속`,
      summary: `${promise.dueDate}까지 ${promise.label} 약속을 이행해야 합니다.`,
      heat: 18,
      confidence: 78,
      tags: ["promise", "player", "clubhouse"]
    });
    return { ok: true, code: "promise-created", message: `${player.name}에게 ${promise.label} 약속을 했습니다. 기한은 ${promise.dueDate}입니다.` };
  }
  if (action === "challenge") {
    player.morale = clamp(safeNumber(player.morale, 50) - 2 + Math.round(safeNumber(player.personality?.traits?.professionalism, 10) / 8), 10, 95);
    if (issue) {
      issue.status = "closed";
      issue.updatedAt = state.currentDate;
    }
    return { ok: true, code: "meeting-challenge", message: `${player.name}에게 경쟁으로 증명하라는 메시지를 전달했습니다.` };
  }
  player.morale = clamp(safeNumber(player.morale, 50) + 2, 20, 95);
  if (issue) {
    issue.status = "closed";
    issue.updatedAt = state.currentDate;
  }
  return { ok: true, code: "meeting-encouraged", message: `${player.name}을 달래고 현재 기용 방침을 설명했습니다.` };
}

function resolveOwnerWarningDecision(state, decision, action) {
  const team = findTeamById(state, decision.teamId) ?? findTeamById(state, state.selectedTeamId);
  const job = ensureManagerJob(state, team);
  if (action === "rebuild-briefing") {
    job.philosophy = "rebuild";
    job.trust = clamp(safeNumber(job.trust) + 5, 0, 100);
    return { ok: true, code: "owner-rebuild-briefing", message: "구단주에게 장기 리빌딩 철학과 젊은 선수 기용 계획을 보고했습니다. 신뢰도가 일부 회복됐습니다." };
  }
  if (action === "lineup-shake") {
    job.trust = clamp(safeNumber(job.trust) + 3, 0, 100);
    return { ok: true, code: "owner-lineup-shake", message: "라인업·불펜 쇄신안을 보고했습니다. 다음 평가에서 실제 성적 반영을 요구받았습니다." };
  }
  job.trust = clamp(safeNumber(job.trust) + 1, 0, 100);
  return { ok: true, code: "owner-pressure-accepted", message: "책임을 인정하고 다음 월례 평가까지 반등을 약속했습니다." };
}

function resolveOwnerDismissalDecision(state, decision, action) {
  const dismissedTeam = findTeamById(state, decision.teamId) ?? findTeamById(state, state.selectedTeamId);
  const currentJob = ensureManagerJob(state, dismissedTeam);
  if (String(action).startsWith("accept-offer-")) {
    const teamId = String(action).replace("accept-offer-", "");
    const team = findTeamById(state, teamId);
    const offer = currentJob.offers?.find((entry) => String(entry.teamId) === teamId);
    if (team && offer) {
      state.selectedTeamId = team.id;
      state.managerJob = normalizeManagerJob({
        teamId: team.id,
        trust: offer.trust,
        philosophy: offer.philosophy,
        status: "active",
        season: inferSeasonFromState(state)
      }, state);
      rememberManagerAction(state, {
        type: "manager-job-change",
        teamId: team.id,
        subject: `${team.shortName ?? team.name} 감독 부임`,
        headline: `${team.shortName ?? team.name} 새 감독직 수락`,
        summary: "경질 이후 새 구단 제안을 받아 커리어를 이어갑니다.",
        heat: 22,
        confidence: 82,
        tags: ["career", "owner", "job"]
      });
      return { ok: true, code: "manager-job-accepted", message: `${team.shortName ?? team.name} 감독 제안을 수락했습니다. 새 구단으로 이어서 진행합니다.` };
    }
  }
  currentJob.status = "career-ended";
  state.phase = "complete";
  return { ok: true, code: "manager-career-ended", message: "감독 커리어를 종료했습니다. 세이브는 완료 상태로 남습니다." };
}

function sendDecisionFollowUps(state, dateKey = state?.currentDate) {
  const today = String(dateKey ?? state.currentDate ?? "");
  for (const decision of state.mailDecisions ?? []) {
    if (decision.followUpSent) continue;
    if (!decision.followUpDate || String(decision.followUpDate) > today) continue;
    deliverMail(state, buildDecisionFollowUpMail(state, decision, today));
    decision.followUpSent = true;
  }
}

function buildDecisionFollowUpMail(state, decision, dateKey) {
  const subject = decision.playerName ?? decision.incomingPlayerName ?? decision.headline ?? "결재 안건";
  const action = decision.resolvedAction ?? decision.resolution ?? "";
  let body = `${decision.headline ?? "전일 결재"} 처리 결과가 반영됐습니다. ${decision.resultMessage ?? ""}`.trim();
  if (decision.type === "medical-roster") {
    body = action === "rush"
      ? `${subject} 강행 결정 이후 트레이닝 파트가 재검진 일정을 잡았습니다. 피로도와 재발 위험은 계속 관찰됩니다.`
      : `${subject} 관련 엔트리 조치가 코칭스태프 회의록에 반영됐습니다. 대체 선수 기용 결과는 다음 경기 후 다시 보고됩니다.`;
  } else if (decision.type === "trade-offer") {
    body = action === "accept"
      ? "전일 수락한 트레이드가 라커룸과 프런트 예산표에 반영됐습니다. 상대 구단 반응은 리그 동향으로 추적합니다."
      : "보류/거절한 트레이드 제안은 시장 메모에 남겼습니다. 상대 구단은 다른 카드를 찾는 분위기입니다.";
  } else if (decision.type === "waiver-claim") {
    body = action === "claim"
      ? "웨이버 클레임 요청이 접수됐습니다. 선수 등록과 잔여 연봉 반영 상태를 운영팀이 확인 중입니다."
      : "웨이버 공시 선수 패스 결정이 확정됐습니다. 해당 선수의 향후 행선지는 리그 동향에 남깁니다.";
  } else if (decision.type === "bullpen-rest") {
    body = action === "rest"
      ? `${subject} 휴식 지시가 불펜 운용표에 반영됐습니다. 수석코치는 단기 실점 위험보다 장기 컨디션 보전을 우선 평가했습니다.`
      : `${subject} 등판 여부를 현장 재량에 맡긴 결정이 기록됐습니다. 팔 컨디션은 다음 보고에서 다시 확인됩니다.`;
  }
  return {
    id: `decision-follow-${dateKey}-${decision.id}`,
    date: dateKey,
    from: { role: decisionSourceRole(decision), icon: decision.type ?? "decision" },
    category: "club",
    type: "decision-follow-up",
    headline: `후속 보고: ${decision.headline ?? "전일 결재"}`,
    body,
    read: false,
    important: false,
    links: decision.mailId ? [{ label: "결재 원문", target: `mail:${decision.mailId}` }] : []
  };
}

function buildFuturesDailyReport(state, team, dateKey) {
  const player = selectFuturesReportPlayer(team, dateKey);
  const runsFor = deterministicRange(dateKey, team?.id ?? "kbo", "futures-rf", 1, 9);
  const runsAgainst = deterministicRange(dateKey, team?.id ?? "kbo", "futures-ra", 0, 8);
  const scoreText = `${team?.shortName ?? "우리"} 퓨처스 ${runsFor}-${runsAgainst} 상대 퓨처스`;
  if (!player) {
    return {
      scoreText,
      note: "퓨처스 등록 선수 표본이 부족합니다. 육성군 원장을 보강해야 합니다.",
      player: null,
      hot: false
    };
  }
  const hot = deterministicRange(dateKey, player.id ?? player.name, "futures-hot", 0, 4) === 0;
  const statLine = player.role === "pitcher"
    ? `${deterministicRange(dateKey, player.id, "ip", 2, 6)}이닝 ${deterministicRange(dateKey, player.id, "k", 2, 8)}탈삼진`
    : `${deterministicRange(dateKey, player.id, "hit", 1, 4)}안타 ${hot ? "1홈런" : "멀티출루"}`;
  const note = hot
    ? `${player.name} 선수가 퓨처스에서 4경기 연속 장타 흐름을 보입니다. 1군 콜업을 강하게 추천합니다.`
    : `${player.name} 선수는 ${statLine}로 컨디션을 끌어올렸습니다. 다음 원정 전 한 번 더 확인하십시오.`;
  return { scoreText, note, player, hot, statLine };
}

function summarizeWeeklyPower(results, focusGame, team) {
  const closeGames = (results ?? []).filter((game) => Math.abs(safeNumber(game.awayScore) - safeNumber(game.homeScore)) <= 1).length;
  const homeRuns = sum(results ?? [], "awayHomeRuns") + sum(results ?? [], "homeHomeRuns");
  const teamResult = focusGame && team
    ? String(focusGame.homeTeamId) === String(team.id)
      ? safeNumber(focusGame.homeScore) - safeNumber(focusGame.awayScore)
      : safeNumber(focusGame.awayScore) - safeNumber(focusGame.homeScore)
    : 0;
  const trend = teamResult > 0 ? "승부처 기대득점이 개선" : teamResult < 0 ? "후반 대타/불펜 선택 재점검 필요" : "연장·동점 운영 변수 확대";
  return `1점차 ${closeGames}경기, 홈런 ${homeRuns}개, ${trend}`;
}

function addMedicalReportLog(state, team, injury, morningDate) {
  const candidate = selectCallupCandidate(team, injury, morningDate);
  const hospital = selectMedicalHospital(injury, morningDate);
  deliverMail(state, {
    date: morningDate,
    from: { role: "트레이닝 파트", icon: "medical" },
    category: "club",
    type: "medical",
    tag: "트레이닝 파트",
    source: "트레이닝 파트",
    headline: `[트레이닝 파트] ${injury.name} 선수 정밀 검진 결과 보고`,
    text: `${hospital} 검진 결과, ${injury.position ?? injury.role ?? "주전"} ${injury.name} 선수는 ${injuryLabel(injury.injuredDays)} 판정입니다. 1군 엔트리 말소(10일 통보)가 필요하며, 대체 후보는 ${candidate?.name ?? "추가 확인 필요"}입니다.`
  });
  queueMailDecision(state, {
    id: `medical-${morningDate}-${injury.playerId}`,
    date: morningDate,
    type: "medical-roster",
    blocking: true,
    severity: "danger",
    teamId: injury.teamId,
    teamName: injury.teamName,
    playerId: injury.playerId,
    playerName: injury.name,
    injuredDays: injury.injuredDays,
    callupCandidateId: candidate?.id ?? "",
    headline: `${injury.name} 부상 엔트리 조치 필요`,
    body: `${injury.teamShortName} ${injury.name}이 ${injury.injuredDays}일 이탈 예정입니다. KBO 1군 말소 시 ${KBO_OPTION_LOCK_DAYS}일 재등록 제한이 걸립니다. 오늘 경기 전 대체 콜업 또는 강행 여부를 결정하십시오.`,
    options: [
      { action: "callup", label: "말소+콜업", note: `${candidate?.name ?? "퓨처스 후보"} 등록` },
      { action: "monitor", label: "하루 관찰", note: "트레이닝 파트 집중 관리" },
      { action: "rush", label: "강행", note: "재부상 위험 증가" }
    ]
  });
}

function addRosterReentryNotices(state, team, dateKey) {
  if (!team) return;
  for (const player of team.roster ?? []) {
    const lock = player.rosterLock;
    if (!lock || lock.type !== "kbo-10day-option") continue;
    if (player.status === "active" || String(lock.noticeSent ?? "") === dateKey) continue;
    if (String(lock.eligibleDate ?? "") > dateKey) continue;
    lock.noticeSent = dateKey;
    deliverMail(state, {
      date: dateKey,
      from: { role: "운영팀", icon: "operations" },
      category: "club",
      type: "operations",
      tag: "운영팀",
      source: "운영팀",
      headline: `[운영팀] ${player.name} 선수 1군 재등록 가능일 안내`,
      text: `부상 치료차 말소되었던 ${player.name} 선수의 ${KBO_OPTION_LOCK_DAYS}일 페널티가 오늘 해제됐습니다. 1군 등록 여부를 라인업 회의에서 결정하십시오.`
    });
  }
}

function addForeignLineupWarningLog(state, team, dateKey) {
  if (!team) return;
  const registered = (team.roster ?? []).filter((player) =>
    player.foreignPlayer?.isForeign &&
    !["released", "unavailable"].includes(String(player.foreignPlayer?.registrationStatus ?? "registered"))
  );
  const activeRegistered = registered.filter((player) => player.status === "active");
  if (activeRegistered.length > KBO_FOREIGN_REGISTERED_LIMIT) {
    deliverMail(state, {
      date: dateKey,
      from: { role: "운영팀", icon: "operations" },
      category: "club",
      type: "operations",
      tag: "운영팀",
      source: "운영팀",
      headline: "[운영팀] 외국인 선수 등록 인원 초과 점검",
      text: `현재 1군 외국인 등록 후보가 ${activeRegistered.length}명입니다. KBO 기준 ${KBO_FOREIGN_REGISTERED_LIMIT}명 등록 틀에 맞춰 권리/말소 상태를 정리하십시오.`
    });
  }

  const lineup = buildLineup(team);
  const pitching = buildPitchingSnapshot(team);
  const starter = findPlayerById(team, pitching.nextStarter?.id);
  const foreignHitters = lineup.filter((player) => player.foreignPlayer?.isForeign);
  const appearanceCount = foreignHitters.length + (starter?.foreignPlayer?.isForeign ? 1 : 0);
  if (appearanceCount <= KBO_FOREIGN_APPEARANCE_LIMIT) return;

  const benchPlayer = foreignHitters.at(-1) ?? null;
  deliverMail(state, {
    date: dateKey,
    from: { role: "코칭스태프", icon: "coaching" },
    category: "club",
    type: "coaching",
    tag: "코칭스태프",
    source: "코칭스태프",
    headline: "[코칭스태프] 오늘 경기 외국인 선수 선발 라인업 경고",
    text: `선발 ${starter?.name ?? "확인 필요"}와 외국인 타자 ${foreignHitters.length}명을 동시에 쓰면 경기당 ${KBO_FOREIGN_APPEARANCE_LIMIT}명 출전 제한을 넘습니다. ${benchPlayer?.name ?? "외국인 타자 1명"} 벤치 대기가 필요합니다.`
  });
  queueMailDecision(state, {
    id: `foreign-lineup-${dateKey}-${team.id}`,
    date: dateKey,
    type: "foreign-lineup",
    blocking: false,
    severity: "warning",
    teamId: team.id,
    teamName: team.name,
    starterPlayerId: starter?.id ?? "",
    benchPlayerId: benchPlayer?.id ?? "",
    headline: "외국인 선수 출전 제한 확인",
    body: `KBO 규정상 경기당 외국인 선수 출전은 최대 ${KBO_FOREIGN_APPEARANCE_LIMIT}명입니다. 자동 라인업이 제한을 넘길 수 있어 경기 전 조정안을 남깁니다.`,
    options: [
      { action: "bench-hitter", label: "타자 1명 제외", note: benchPlayer?.name ?? "외국인 타자" },
      { action: "rotate-pitcher", label: "선발 조정", note: starter?.name ?? "외국인 선발" },
      { action: "acknowledge", label: "확인", note: "라인업 회의에서 처리" }
    ]
  });
}

function addBullpenOverloadLog(state, team, dateKey) {
  if (!team) return;
  const pitching = buildPitchingSnapshot(team);
  const overloaded = (pitching.bullpen ?? [])
    .map((entry) => findPlayerById(team, entry.id))
    .filter(Boolean)
    .filter((player) => safeNumber(player.fatigue) >= 58 || safeNumber(player.armFreshness, 80) <= 46)
    .sort((a, b) => (safeNumber(b.fatigue) - safeNumber(b.armFreshness, 80)) - (safeNumber(a.fatigue) - safeNumber(a.armFreshness, 80)))[0];
  if (!overloaded) return;
  deliverMail(state, {
    date: dateKey,
    from: { role: "수석코치", icon: "bullpen" },
    category: "club",
    type: "coaching",
    tag: "수석코치",
    source: "수석코치",
    headline: `[수석코치] 불펜 투수진 과부하(혹사) 경고`,
    text: `${overloaded.name} 투수의 피로도는 ${Math.round(safeNumber(overloaded.fatigue))}%, 팔 컨디션은 ${Math.round(safeNumber(overloaded.armFreshness, 80))}%입니다. 오늘 또 등판시키면 장기 부상 위험이 크게 올라갑니다.`
  });
  queueMailDecision(state, {
    id: `bullpen-rest-${dateKey}-${overloaded.id}`,
    date: dateKey,
    type: "bullpen-rest",
    blocking: false,
    severity: "warning",
    teamId: team.id,
    teamName: team.name,
    playerId: overloaded.id,
    playerName: overloaded.name,
    headline: `${overloaded.name} 휴식 지시 여부`,
    body: `${overloaded.name} 투수의 피로 누적이 위험 구간입니다. 오늘 경기에서 등판 제외 지시를 내리면 단기 전력은 내려가지만 부상 위험을 낮출 수 있습니다.`,
    options: [
      { action: "rest", label: "오늘 휴식", note: "등판 제외 표시" },
      { action: "manager-discretion", label: "감독 재량", note: "경기 흐름에 맡김" }
    ]
  });
}

function addForeignAdaptationLog(state, team, dateKey) {
  if (!team) return;
  const candidates = (team.roster ?? []).filter((player) =>
    player.foreignPlayer?.isForeign &&
    player.status === "active" &&
    safeNumber(player.injuredDays) === 0
  );
  const player = candidates
    .map((candidate) => ({
      player: candidate,
      score: (60 - safeNumber(candidate.form, 50)) + (60 - safeNumber(candidate.dailyCondition, candidate.form)) + deterministicRange(dateKey, candidate.id, "adapt", 0, 12)
    }))
    .sort((a, b) => b.score - a.score)[0]?.player ?? null;
  if (!player) return;
  const shouldReport = safeNumber(player.form, 50) < 46 ||
    safeNumber(player.dailyCondition, player.form) < 45 ||
    deterministicRange(dateKey, team.id, player.id, "homesick", 0, 13) === 0;
  if (!shouldReport) return;
  deliverMail(state, {
    date: dateKey,
    from: { role: "통역 파트", icon: "interpreter" },
    category: "club",
    type: "interpreter",
    tag: "통역 파트",
    source: "통역 파트",
    headline: `[통역 파트] ${player.name} 선수 최근 컨디션 저하 사유 보고`,
    text: `${player.name} 선수가 한국 생활 적응 및 향수병 스트레스를 호소했습니다. 가족 초청 비용은 ${formatMoneyForLog(FOREIGN_FAMILY_SUPPORT_KRW)}로 추산됩니다.`
  });
  queueMailDecision(state, {
    id: `foreign-adapt-${dateKey}-${player.id}`,
    date: dateKey,
    type: "foreign-adaptation",
    blocking: false,
    severity: "notice",
    teamId: team.id,
    teamName: team.name,
    playerId: player.id,
    playerName: player.name,
    headline: `${player.name} 한국 문화 적응 지원 결정`,
    body: `통역 파트는 ${player.name}의 멘탈 회복을 위해 가족 초청 또는 주간 면담을 제안했습니다. 비용 처리와 2군 조정 중 선택할 수 있습니다.`,
    options: [
      { action: "extra-support", label: "가족 초청", note: `${formatMoneyForLog(FOREIGN_FAMILY_SUPPORT_KRW)} 소모` },
      { action: "acknowledge", label: "면담 관리", note: "비용 없이 모니터링" },
      { action: "demote", label: "2군 조정", note: "멘탈 급락 위험" }
    ]
  });
}

function addDailyMarketBreakLog(state, team, dateKey) {
  if (!team || state.phase !== "regular") return;
  const roll = deterministicRange(dateKey, team.id, "market-break", 0, 17);
  if (roll === 4) {
    addTradeOfferBreakLog(state, team, dateKey);
  } else if (roll === 11) {
    addWaiverNoticeBreakLog(state, team, dateKey);
  }
}

function addTradeOfferBreakLog(state, team, dateKey) {
  const offer = buildBreakTradeOffer(state, team, dateKey);
  if (!offer) return;
  deliverMail(state, {
    date: dateKey,
    from: { role: offer.sourceTeamName, icon: "trade" },
    category: "decision",
    type: "trade-offer",
    tag: "트레이드",
    source: offer.sourceTeamName,
    headline: `[트레이드] ${offer.sourceTeamName} 구단으로부터의 선수 트레이드 제안`,
    text: `${offer.sourceTeamShortName}에서 취약 포지션 보강 카드 ${offer.incomingPlayerName}을 제시했습니다. 대가로 ${offer.outgoingPlayerName}와 현금 ${formatMoneyForLog(offer.cashKRW)}을 요구합니다.`
  });
  queueMailDecision(state, {
    ...offer,
    id: `trade-offer-${dateKey}-${offer.sourceTeamId}-${team.id}`,
    date: dateKey,
    type: "trade-offer",
    blocking: false,
    severity: "notice",
    headline: `${offer.sourceTeamShortName} 트레이드 제안`,
    body: `${offer.incomingPlayerName}을 받는 대신 ${offer.outgoingPlayerName}와 현금 ${formatMoneyForLog(offer.cashKRW)}을 내주는 제안입니다. 스카우트팀은 즉시 전력 보강, 재정팀은 현금 부담을 지적했습니다.`,
    options: [
      { action: "accept", label: "제안 수락", note: "선수 이동 처리" },
      { action: "counter", label: "현금 깎기", note: "역제안 발송" },
      { action: "reject", label: "거절", note: "자산 유지" }
    ]
  });
}

function addWaiverNoticeBreakLog(state, team, dateKey) {
  const candidate = buildWaiverCandidate(state, team, dateKey);
  if (!candidate) return;
  deliverMail(state, {
    date: dateKey,
    from: { role: "KBO 사무국", icon: "league" },
    category: "league",
    type: "waiver",
    tag: "KBO 사무국",
    source: "KBO 사무국",
    headline: "[KBO 사무국] 타 구단 웨이버 공시 선수 명단 통보",
    text: `${candidate.sourceTeamShortName} ${candidate.playerName} 선수가 웨이버 공시됐습니다. 7일 이내 잔여 연봉 ${formatMoneyForLog(candidate.salaryKRW)} 승계 신청이 가능합니다.`
  });
  queueMailDecision(state, {
    ...candidate,
    id: `waiver-${dateKey}-${candidate.playerId}`,
    date: dateKey,
    type: "waiver-claim",
    blocking: false,
    severity: "notice",
    headline: `${candidate.playerName} 웨이버 클레임 검토`,
    body: `${candidate.playerName}은 ${candidate.position} 뎁스 보강 카드입니다. 잔여 연봉 ${formatMoneyForLog(candidate.salaryKRW)}을 승계하면 조건 없이 영입할 수 있습니다.`,
    options: [
      { action: "claim", label: "클레임 신청", note: "잔여 연봉 승계" },
      { action: "pass", label: "패스", note: "현 로스터 유지" }
    ]
  });
}

function buildPendingDecision(decision) {
  const date = String(decision.date ?? "");
  const type = String(decision.type ?? "decision");
  return {
    status: "open",
    text: decision.body ?? "",
    ...decision,
    date,
    type,
    expiresOn: decision.expiresOn ?? defaultDecisionExpiry(date, type),
    defaultAction: decision.defaultAction ?? defaultDecisionAction(type),
    options: Array.isArray(decision.options) ? decision.options : []
  };
}

function completeBreakTrade(state, decision) {
  const sourceTeam = findTeamById(state, decision.sourceTeamId);
  const targetTeam = findTeamById(state, decision.teamId) ?? findTeamById(state, state.selectedTeamId);
  const incomingEntry = findPlayerEntry(state, decision.incomingPlayerId, decision.sourceTeamId);
  const outgoingEntry = findPlayerEntry(state, decision.outgoingPlayerId, decision.teamId);
  if (!sourceTeam || !targetTeam || !incomingEntry?.player || !outgoingEntry?.player) {
    return { ok: false, code: "trade-missing-player", message: "트레이드 대상 선수를 찾지 못했습니다." };
  }
  sourceTeam.roster.splice(incomingEntry.index, 1);
  targetTeam.roster.splice(outgoingEntry.index, 1);
  transferPlayerToTeam(incomingEntry.player, targetTeam.id);
  transferPlayerToTeam(outgoingEntry.player, sourceTeam.id);
  targetTeam.roster.push(incomingEntry.player);
  sourceTeam.roster.push(outgoingEntry.player);
  targetTeam.payroll = roundNumber(safeNumber(targetTeam.payroll) + safeNumber(decision.cashKRW) / 100_000_000, 1);
  const completedTrade = {
    id: `break-${state.currentDate}-${decision.incomingPlayerId}-${decision.outgoingPlayerId}`,
    type: "daily-break-offer",
    status: "complete",
    date: state.currentDate,
    buyerTeamId: targetTeam.id,
    buyerTeamName: targetTeam.name,
    sellerTeamId: sourceTeam.id,
    sellerTeamName: sourceTeam.name,
    incoming: toTradeLedgerPlayer(incomingEntry.player, sourceTeam, targetTeam),
    outgoing: toTradeLedgerPlayer(outgoingEntry.player, targetTeam, sourceTeam),
    additionalAssets: [{
      id: `cash-${state.currentDate}-${targetTeam.id}-${sourceTeam.id}`,
      assetType: "cash",
      fromTeamId: targetTeam.id,
      fromTeamName: targetTeam.name,
      toTeamId: sourceTeam.id,
      toTeamName: sourceTeam.name,
      amountKRW: safeNumber(decision.cashKRW),
      valueScore: safeNumber(decision.cashKRW) / 100_000_000
    }],
    summary: `${targetTeam.shortName ?? targetTeam.name} acquire ${incomingEntry.player.name}; ${sourceTeam.shortName ?? sourceTeam.name} acquire ${outgoingEntry.player.name}`
  };
  state.trades.completed = [completedTrade, ...(state.trades.completed ?? [])].slice(0, 60);
  return { ok: true, code: "trade-accepted", message: `${incomingEntry.player.name} ↔ ${outgoingEntry.player.name} 트레이드를 수락했습니다. 현금 ${formatMoneyForLog(decision.cashKRW)}이 함께 반영됐습니다.` };
}

function completeWaiverClaim(state, decision) {
  const targetTeam = findTeamById(state, decision.teamId) ?? findTeamById(state, state.selectedTeamId);
  const sourceEntry = findPlayerEntry(state, decision.playerId, decision.sourceTeamId);
  if (!targetTeam || !sourceEntry?.team || !sourceEntry?.player || sourceEntry.team === targetTeam) {
    return { ok: false, code: "waiver-missing-player", message: "웨이버 대상 선수를 찾지 못했습니다." };
  }
  sourceEntry.team.roster.splice(sourceEntry.index, 1);
  transferPlayerToTeam(sourceEntry.player, targetTeam.id);
  sourceEntry.player.status = "active";
  sourceEntry.player.waiverClaimedAt = state.currentDate;
  targetTeam.roster.push(sourceEntry.player);
  targetTeam.payroll = roundNumber(safeNumber(targetTeam.payroll) + safeNumber(decision.salaryKRW) / 100_000_000, 1);
  return { ok: true, code: "waiver-claimed", message: `${sourceEntry.player.name} 웨이버 클레임을 완료했습니다. 잔여 연봉 ${formatMoneyForLog(decision.salaryKRW)}을 승계합니다.` };
}

function buildBreakTradeOffer(state, team, dateKey) {
  const otherTeams = (state.teams ?? []).filter((entry) => String(entry.id) !== String(team?.id));
  const sourceTeam = otherTeams[hashParts(dateKey, team?.id ?? "team", "trade-source") % Math.max(1, otherTeams.length)];
  if (!sourceTeam) return null;
  const incoming = [...(sourceTeam.roster ?? [])]
    .filter((player) => player.status === "active" && safeNumber(player.injuredDays) === 0)
    .sort((a, b) => tradeCommitPlayerValue(b) - tradeCommitPlayerValue(a))[deterministicRange(dateKey, sourceTeam.id, "incoming-index", 2, 8)] ??
    sourceTeam.roster?.[0];
  const outgoing = [...(team.roster ?? [])]
    .filter((player) => !player.foreignPlayer?.isForeign && safeNumber(player.age, 30) <= 27 && safeNumber(player.injuredDays) === 0)
    .sort((a, b) => safeNumber(b.pot, b.ovr) - safeNumber(a.pot, a.ovr))[0] ??
    team.roster?.find((player) => !player.foreignPlayer?.isForeign);
  if (!incoming || !outgoing) return null;
  return {
    teamId: team.id,
    teamName: team.name,
    sourceTeamId: sourceTeam.id,
    sourceTeamName: sourceTeam.name,
    sourceTeamShortName: sourceTeam.shortName ?? sourceTeam.name,
    incomingPlayerId: incoming.id,
    incomingPlayerName: incoming.name,
    outgoingPlayerId: outgoing.id,
    outgoingPlayerName: outgoing.name,
    cashKRW: deterministicRange(dateKey, team.id, sourceTeam.id, "cash", 1, 5) * 100_000_000
  };
}

function buildWaiverCandidate(state, team, dateKey) {
  const otherTeams = (state.teams ?? []).filter((entry) => String(entry.id) !== String(team?.id));
  const sourceTeam = otherTeams[hashParts(dateKey, team?.id ?? "team", "waiver-source") % Math.max(1, otherTeams.length)];
  if (!sourceTeam) return null;
  const candidate = [...(sourceTeam.roster ?? [])]
    .filter((player) => !player.foreignPlayer?.isForeign && safeNumber(player.age, 30) >= 28 && safeNumber(player.injuredDays) === 0)
    .sort((a, b) => {
      const salaryA = safeNumber(a.contract?.salary?.payrollAmountKRW);
      const salaryB = safeNumber(b.contract?.salary?.payrollAmountKRW);
      return tradeCommitPlayerValue(b) / Math.max(1, salaryB / 100_000_000) - tradeCommitPlayerValue(a) / Math.max(1, salaryA / 100_000_000);
    })[0];
  if (!candidate) return null;
  return {
    teamId: team.id,
    teamName: team.name,
    sourceTeamId: sourceTeam.id,
    sourceTeamName: sourceTeam.name,
    sourceTeamShortName: sourceTeam.shortName ?? sourceTeam.name,
    playerId: candidate.id,
    playerName: candidate.name,
    position: candidate.position ?? (candidate.role === "pitcher" ? "P" : "UTIL"),
    salaryKRW: safeNumber(candidate.contract?.salary?.payrollAmountKRW, 120_000_000)
  };
}

function selectFuturesReportPlayer(team, dateKey) {
  const roster = team?.roster ?? [];
  const pool = roster.filter((player) =>
    player.status !== "active" &&
    !["released", "retired"].includes(String(player.status ?? "")) &&
    safeNumber(player.injuredDays) === 0
  );
  const fallback = roster.filter((player) => safeNumber(player.age, 30) <= 24 && safeNumber(player.injuredDays) === 0);
  return [...(pool.length ? pool : fallback)]
    .sort((a, b) =>
      (safeNumber(b.pot, b.ovr) + deterministicRange(dateKey, b.id, "futures-report", 0, 12)) -
      (safeNumber(a.pot, a.ovr) + deterministicRange(dateKey, a.id, "futures-report", 0, 12))
    )[0] ?? null;
}

function selectCallupCandidate(team, injuredPlayer, dateKey = "") {
  const injuredRole = injuredPlayer?.role ?? "";
  const injuredPosition = injuredPlayer?.position ?? "";
  return [...(team?.roster ?? [])]
    .filter((player) =>
      String(player.id) !== String(injuredPlayer?.id ?? injuredPlayer?.playerId ?? "") &&
      player.status !== "active" &&
      !["released", "retired"].includes(String(player.status ?? "")) &&
      safeNumber(player.injuredDays) === 0 &&
      !isRosterLocked(player, dateKey)
    )
    .map((player) => ({
      player,
      score:
        safeNumber(player.ovr) +
        safeNumber(player.pot, player.ovr) * 0.2 +
        (player.role === injuredRole ? 18 : 0) +
        (player.position === injuredPosition ? 12 : 0) -
        safeNumber(player.fatigue) * 0.25
    }))
    .sort((a, b) => b.score - a.score)[0]?.player ?? null;
}

function isRosterLocked(player, dateKey = "") {
  const lock = player?.rosterLock;
  if (!lock || lock.type !== "kbo-10day-option") return false;
  const referenceDate = dateKey || lock.demotedDate || "0000-00-00";
  return String(lock.eligibleDate ?? "") > String(referenceDate);
}

function selectMedicalHospital(injury, dateKey) {
  const hospitals = ["세종스포츠정형외과", "잠실스포츠메디컬센터", "광주선수촌정형외과", "부산스포츠재활병원"];
  return hospitals[hashParts(injury?.playerId ?? injury?.name, dateKey, "hospital") % hospitals.length];
}

function injuryLabel(days) {
  const count = safeNumber(days);
  if (count >= 10) return `우측 발목 인대 염좌로 ${count}일 이탈`;
  if (count >= 5) return `근육 미세 손상으로 ${count}일 관리`;
  return `타박 및 컨디션 저하로 ${count}일 관찰`;
}

function selectMediaOutlet(dateKey, salt) {
  return PRESEASON_MEDIA_OUTLETS[hashParts(dateKey, salt, "daily-media") % PRESEASON_MEDIA_OUTLETS.length];
}

function processMailboxMorning(state, dateKey = state?.currentDate) {
  normalizeMailboxState(state);
  clearExpiredGameRestrictions(state, dateKey);
  deliverDeferredMail(state, dateKey);
  expireOpenMailDecisions(state, dateKey);
  sendDecisionFollowUps(state, dateKey);
  runClubhousePressureRoutine(state, findTeamById(state, state.selectedTeamId), dateKey);
  refreshMailboxDerivedState(state);
}

function clearExpiredGameRestrictions(state, dateKey = state?.currentDate) {
  const today = String(dateKey ?? "");
  for (const { player } of allPlayerEntries(state)) {
    if (!player.gameRestriction?.date) continue;
    if (String(player.gameRestriction.date) < today) {
      player.gameRestriction = null;
    }
  }
}

function getContinueStopReason(state) {
  normalizeMailboxState(state);
  state.settings = normalizeSettings(state.settings);
  const blocking = getBlockingMailDecision(state);
  if (blocking) {
    return {
      reason: "blocking-decision",
      mailId: blocking.id,
      headline: blocking.headline,
      message: `${blocking.headline ?? "긴급 결재"} 처리 대기로 멈췄습니다.`
    };
  }

  if (state.settings.continueStops.myGameDay && isUserGameDayMorning(state)) {
    const preview = getNextGamePreview(state, state.selectedTeamId);
    const matchup = `${preview.awayShortName ?? "원정"} @ ${preview.homeShortName ?? "홈"}`;
    return {
      reason: "my-game-day",
      gameDate: preview.date,
      headline: "오늘 경기",
      message: `오늘 경기(${matchup}) 아침에 멈췄습니다.`
    };
  }

  const openDecision = getOpenMailDecisions(state)[0];
  if (state.settings.continueStops.openDecision && openDecision) {
    return {
      reason: "open-decision",
      mailId: openDecision.id,
      headline: openDecision.headline,
      message: `${openDecision.headline ?? "결재 요청"} 결재 대기로 멈췄습니다.`
    };
  }

  const important = (state.mailbox.items ?? []).find((mail) => !mail.read && isImportantMail(mail));
  if (state.settings.continueStops.importantMail && important) {
    return {
      reason: "important-mail",
      mailId: important.id,
      headline: important.headline,
      message: `${important.headline ?? "중요 메일"} 도착으로 멈췄습니다.`
    };
  }

  return null;
}

function isUserGameDayMorning(state) {
  if (state?.phase !== "regular") return false;
  const preview = getNextGamePreview(state, state.selectedTeamId);
  return Boolean(preview?.ok && String(preview.date ?? "") === String(state.currentDate ?? "") && safeNumber(preview.skippedDays) === 0);
}

function expireOpenMailDecisions(state, dateKey = state?.currentDate) {
  const today = String(dateKey ?? state.currentDate ?? "");
  const expired = getOpenMailDecisions(state).filter((mail) => {
    const expiresOn = String(mail.decision?.expiresOn ?? "");
    return expiresOn && expiresOn < today;
  });
  for (const mail of expired) {
    resolveMailDecision(state, mail.id, mail.decision.defaultAction || defaultDecisionAction(mail.decision.type), { expired: true, date: today });
  }
  return expired;
}

function queueMailDecision(state, decision) {
  normalizeMailboxState(state);
  const baseDecision = buildPendingDecision(decision);
  const dateKey = String(baseDecision.date ?? state.currentDate ?? "");
  if (state.mailbox.items.some((mail) => String(mail.id) === String(baseDecision.id))) {
    refreshMailboxDerivedState(state);
    return null;
  }
  if ((state.mailDecisions ?? []).some((entry) => String(entry.id) === String(baseDecision.id))) {
    refreshMailboxDerivedState(state);
    return null;
  }
  const sameDayOpen = state.mailbox.items.filter((mail) =>
    isOpenDecisionMail(mail) && String(mail.date ?? "") === dateKey
  ).length;
  const item = normalizeMailItem({
    id: baseDecision.id,
    date: dateKey,
    from: { role: baseDecision.source ?? decisionSourceRole(baseDecision), icon: baseDecision.type },
    category: "decision",
    type: baseDecision.type,
    headline: baseDecision.headline ?? "결재 요청",
    body: baseDecision.body ?? baseDecision.text ?? "",
    read: false,
    important: Boolean(baseDecision.blocking),
    decision: baseDecision,
    links: baseDecision.links ?? []
  }, state);
  if (sameDayOpen >= MAILBOX_DECISION_DAILY_LIMIT) {
    const deliverOn = addDaysKey(dateKey, 1);
    item.date = deliverOn;
    item.decision.date = deliverOn;
    item.decision.expiresOn = defaultDecisionExpiry(deliverOn, item.decision.type);
    deferMailboxItem(state, item, deliverOn);
    return item;
  }
  insertMailboxItem(state, item, { log: false });
  return item;
}

function decisionSourceRole(decision) {
  if (decision.type === "medical-roster") return "트레이닝 파트";
  if (decision.type === "foreign-lineup") return "코칭스태프";
  if (decision.type === "foreign-adaptation") return "통역 파트";
  if (decision.type === "trade-offer") return decision.sourceTeamShortName ?? decision.sourceTeamName ?? "트레이드";
  if (decision.type === "waiver-claim") return "KBO 사무국";
  if (decision.type === "bullpen-rest") return "수석코치";
  if (decision.type === "futures-callup") return "2군 감독";
  if (decision.type === "opening-roster") return "운영팀";
  if (decision.type === "opening-rotation") return "코칭스태프";
  if (decision.type === "player-meeting") return "선수단";
  if (decision.type === "owner-warning") return "구단주";
  if (decision.type === "owner-dismissal") return "구단주";
  return "개인비서";
}

function hasOpenMailDecision(state) {
  return getOpenMailDecisions(state).length > 0;
}

function addDaysKey(dateKey, days) {
  const date = parseDate(dateKey);
  date.setUTCDate(date.getUTCDate() + Math.floor(safeNumber(days)));
  return formatDateKey(date);
}

function formatKoreanMonthDay(dateKey) {
  const [, month = "1", day = "1"] = String(dateKey ?? "").match(/^\d{4}-(\d{2})-(\d{2})$/) ?? [];
  return `${safeNumber(month, 1)}월 ${safeNumber(day, 1)}일`;
}

function buildDraftScoutingOfficialLog(state) {
  const draft = state.draft ?? {};
  const topProspect = draft.prospects?.[0] ?? null;
  const value = estimateDraftProspectValueKRW(topProspect);
  const medical = draftRiskLabel(topProspect?.risk);
  const mental = draftMentalLabel(topProspect?.certainty);
  return buildKboOfficialLog({
    date: state.currentDate,
    headline: `${draft.year ?? draftYearForState(state)} 신인 드래프트 스카우트 리포트 접수`,
    text: topProspect
      ? `${topProspect.displayCode} (${topProspect.classType} ${topProspect.profile}) 메디컬 ${medical}, 멘탈 ${mental}, 원화 몸값 추정 ${formatMoneyForLog(value)}. 1~${DRAFT_ROUNDS}라운드 전면 드래프트 보드에 반영하십시오.`
      : `신인 드래프트 후보군이 아직 비어 있습니다. 1~${DRAFT_ROUNDS}라운드 보드 생성 상태를 확인하십시오.`
  });
}

function buildSecondaryProtectionOfficialLog(state) {
  const draft = state.secondaryDraft ?? {};
  const protections = draft.protections ?? {};
  const userProtection = protections[state.selectedTeamId] ?? Object.values(protections)[0] ?? null;
  const exposedRisk = [...(userProtection?.exposed ?? [])]
    .sort((a, b) => safeNumber(b.protectionScore) - safeNumber(a.protectionScore) || safeNumber(b.pot) - safeNumber(a.pot))[0] ?? null;
  return buildKboOfficialLog({
    date: state.currentDate,
    headline: `${draft.year ?? draftYearForState(state)} 2차 드래프트 35인 보호명단 제출 안내`,
    text: exposedRisk
      ? `${userProtection.teamShortName ?? userProtection.teamName} 보호 ${userProtection.protectedCount}명, 비보호 ${userProtection.exposedCount}명입니다. 코치진은 비보호 ${exposedRisk.name}(${exposedRisk.position}, OVR ${safeNumber(exposedRisk.ovr)}/POT ${safeNumber(exposedRisk.pot)})에 대한 타 구단 관심 가능성을 경고했습니다.`
      : `구단별 최대 ${SECONDARY_DRAFT_PROTECTED_COUNT}명 보호 원칙에 따라 명단을 제출하십시오. 비보호 유망주 경고 대상은 현재 없습니다.`
  });
}

function buildFreeAgencyOfficialLog(state) {
  const market = state.freeAgency ?? {};
  const candidates = market.faCandidates ?? [];
  const userCandidate = candidates.find((candidate) => String(candidate.fromTeamId) === String(state.selectedTeamId)) ?? candidates[0] ?? null;
  const grade = userCandidate?.compensationGrade ?? "none";
  const rule = userCandidate?.compensation ?? faCompensationRule(grade, userCandidate?.previousSalaryKRW ?? 0);
  const protectionText = rule.requiresProtectedList
    ? `${rule.protectedListSize}인 보호선수 외 보상선수+보상금 선택 대상`
    : rule.grade === "C"
      ? "보상금 선택 대상"
      : "보상 규정 확인 대상";
  return buildKboOfficialLog({
    date: state.currentDate,
    headline: `${market.year ?? draftYearForState(state)} FA 자격 취득 및 승인 공시`,
    text: userCandidate
      ? `${userCandidate.fromTeamShortName} ${userCandidate.name} 선수가 FA 자격 승인 명단에 포함됐습니다. 보상 등급 ${grade}, ${protectionText}, 기준 보상금 ${formatMoneyForLog(rule.cashOnlyKRW || rule.playerPlusCashKRW)}.`
      : `귀 구단의 FA 승인 대상자는 현재 없습니다. 타 구단 FA 후보와 외국인 권리 시장만 검토하십시오.`
  });
}

function buildKboOfficialLog({ date, headline, text }) {
  return {
    date,
    type: "kbo-official",
    tag: "한국야구위원회(KBO)",
    source: "한국야구위원회(KBO)",
    headline,
    text
  };
}

function addPreseasonActivityLog(state, dateKey, weather) {
  const team = findTeamById(state, state.selectedTeamId) ?? state.teams?.[0] ?? null;
  if (!team) {
    addLog(state, `${dateKey} 프리시즌 훈련일입니다. 정규시즌 개막까지 로스터를 점검하세요.`);
    return;
  }

  const context = buildPreseasonContext(state, team, dateKey, weather);
  recordPreseasonNarratives(state, context);
  context.narrative = buildNarrativeContext(state, team, dateKey);
  deliverMail(state, buildPreseasonMediaLog(context));
  deliverMail(state, buildPreseasonMailboxLog(context));
  deliverMail(state, buildPreseasonAssistantLog(context));
  addPreseasonCampPack(state, context);
}

function addPreseasonCampPack(state, context) {
  const dateKey = context.dateKey;
  const weekday = parseDate(dateKey).getUTCDay();
  state.campStats = state.campStats && typeof state.campStats === "object" ? state.campStats : { games: [], notes: [] };

  if (dateKey >= `${dateKey.slice(0, 4)}-03-08` && dateKey <= `${dateKey.slice(0, 4)}-03-24` && [2, 4, 6].includes(weekday)) {
    addPreseasonPracticeGameMail(state, context);
  }

  if (weekday === 1) {
    addPreseasonCompetitionMail(state, context);
    deliverUniqueMail(state, {
      id: `camp-weekly-${dateKey}-${context.team.id}`,
      date: dateKey,
      from: { role: "수석코치", icon: "camp" },
      category: "club",
      type: "preseason",
      headline: "캠프 위클리 리포트",
      body: `부상자 ${context.injuredCount}명, 컨디션 상승 후보 ${context.topHitter?.name ?? "타자"}·${context.topPitcher?.name ?? "투수"}·${context.prospect?.name ?? "유망주"}입니다. 개막까지 ${context.daysToOpening}일 남았습니다.`,
      read: false
    });
  }

  if (context.daysToOpening === 7) {
    addOpeningRosterDecisionMail(state, context);
  }
  if (context.daysToOpening === 3) {
    addOpeningRotationDecisionMail(state, context);
  }
}

function addPreseasonPracticeGameMail(state, context) {
  const team = context.team;
  const runsFor = deterministicRange(context.dateKey, team.id, "camp-rf", 1, 9);
  const runsAgainst = deterministicRange(context.dateKey, team.id, "camp-ra", 0, 8);
  const standout = deterministicRange(context.dateKey, team.id, "camp-standout", 0, 1) === 0 ? context.topHitter : context.topPitcher;
  if (standout) {
    standout.form = clamp(safeNumber(standout.form, 50) + 1, 20, 90);
    standout.sharpness = clamp(safeNumber(standout.sharpness, standout.form) + 3, 20, 98);
  }
  const game = {
    id: `camp-game-${context.dateKey}-${team.id}`,
    date: context.dateKey,
    teamId: team.id,
    runsFor,
    runsAgainst,
    standoutPlayerId: standout?.id ?? ""
  };
  if (!(state.campStats.games ?? []).some((entry) => entry.id === game.id)) {
    state.campStats.games = [game, ...(state.campStats.games ?? [])].slice(0, 40);
  }
  deliverUniqueMail(state, {
    id: game.id,
    date: context.dateKey,
    from: { role: "수석코치", icon: "camp" },
    category: "club",
    type: "preseason",
    headline: `연습경기 결과: ${context.shortName} ${runsFor}-${runsAgainst} 캠프 상대`,
    body: `${standout?.name ?? "주요 선수"}가 눈에 띄었습니다. 이 경기는 공식 기록에는 반영하지 않고 캠프 컨디션과 sharpness에만 반영했습니다.`,
    read: false,
    links: standout?.id ? [{ label: "선수 상세", target: `player:${standout.id}` }] : []
  });
}

function addPreseasonCompetitionMail(state, context) {
  const candidates = [...(context.team.roster ?? [])]
    .filter((player) => safeNumber(player.injuredDays) === 0)
    .sort((a, b) => Math.abs(safeNumber(a.ovr) - safeNumber(a.pot, a.ovr)) - Math.abs(safeNumber(b.ovr) - safeNumber(b.pot, b.ovr)))
    .slice(0, 3);
  deliverUniqueMail(state, {
    id: `camp-competition-${context.dateKey}-${context.team.id}`,
    date: context.dateKey,
    from: { role: "코칭스태프", icon: "camp" },
    category: "club",
    type: "preseason",
    headline: "포지션 경쟁 현황",
    body: candidates.length
      ? `${candidates.map((player) => `${player.name}(${player.position})`).join(", ")}가 개막 엔트리 경쟁권입니다. 남은 캠프에서 수비 포지션과 대타 활용도를 집중 확인합니다.`
      : "포지션 경쟁 표본이 부족합니다. 개막 엔트리 회의 전 추가 점검이 필요합니다.",
    read: false
  });
}

function addOpeningRosterDecisionMail(state, context) {
  const candidates = [...(context.team.roster ?? [])]
    .filter((player) => player.status !== "active" && safeNumber(player.injuredDays) === 0)
    .sort((a, b) => safeNumber(b.ovr) + safeNumber(b.pot, b.ovr) * 0.25 - (safeNumber(a.ovr) + safeNumber(a.pot, a.ovr) * 0.25))
    .slice(0, 2);
  if (candidates.length < 2) return;
  deliverUniqueMail(state, {
    id: `opening-roster-brief-${context.dateKey}-${context.team.id}`,
    date: context.dateKey,
    from: { role: "운영팀", icon: "roster" },
    category: "club",
    type: "preseason",
    headline: "개막 엔트리 마지막 한 자리",
    body: `운영팀은 베테랑 안정안 ${candidates[0].name}, 상승세 후보 ${candidates[1].name} 두 안을 올렸습니다.`,
    read: false
  });
  queueMailDecision(state, {
    id: `opening-roster-${context.dateKey}-${context.team.id}`,
    date: context.dateKey,
    type: "opening-roster",
    blocking: false,
    severity: "notice",
    teamId: context.team.id,
    candidateAId: candidates[0].id,
    candidateBId: candidates[1].id,
    headline: "개막 엔트리 마지막 한 자리 결정",
    body: `${candidates[0].name}은 안정감, ${candidates[1].name}은 상승세가 장점입니다. 개막 엔트리 마지막 한 자리를 선택하십시오.`,
    options: [
      { action: "choose-a", label: candidates[0].name, note: "베테랑/안정안" },
      { action: "choose-b", label: candidates[1].name, note: "유망주/상승세" }
    ]
  });
}

function addOpeningRotationDecisionMail(state, context) {
  const snapshot = buildPitchingSnapshot(context.team);
  const rotation = (snapshot.rotation ?? []).map((entry) => entry.name).slice(0, 5).join(" · ");
  deliverUniqueMail(state, {
    id: `opening-rotation-brief-${context.dateKey}-${context.team.id}`,
    date: context.dateKey,
    from: { role: "코칭스태프", icon: "pitching" },
    category: "club",
    type: "preseason",
    headline: "개막 로테이션 최종안",
    body: `현재 로테이션 안은 ${rotation || "자동 추천 대기"}입니다. 개막 전 마지막 조정 여부를 확인해야 합니다.`,
    read: false,
    links: [{ label: "라인업 탭", target: "tab:lineup" }]
  });
  queueMailDecision(state, {
    id: `opening-rotation-${context.dateKey}-${context.team.id}`,
    date: context.dateKey,
    type: "opening-rotation",
    blocking: false,
    severity: "notice",
    teamId: context.team.id,
    headline: "개막 로테이션 확정",
    body: `현재 투수 운용표를 개막 로테이션으로 확정할지, 라인업 탭에서 조정할지 선택하십시오.`,
    options: [
      { action: "confirm", label: "그대로 확정", note: "현재 투수 운용 유지" },
      { action: "review-lineup", label: "라인업에서 조정", note: "투수 운용 탭 확인" }
    ],
    links: [{ label: "라인업 탭", target: "tab:lineup" }]
  });
}

function buildPreseasonContext(state, team, dateKey, weather) {
  const roster = Array.isArray(team?.roster) ? team.roster : [];
  const hitters = roster.filter((player) => player.role !== "pitcher");
  const pitchers = roster.filter((player) => player.role === "pitcher");
  const topHitter = selectPreseasonPlayer(hitters, (player) => hitterScore(player), dateKey) ?? roster[0] ?? {};
  const topPitcher = selectPreseasonPlayer(pitchers, (player) => pitcherScore(player), dateKey) ?? roster[0] ?? {};
  const prospect = selectPreseasonPlayer(roster, preseasonProspectScore, dateKey) ?? roster[0] ?? {};
  const teamName = team.name ?? team.shortName ?? "KBO 구단";
  const shortName = team.shortName ?? team.name ?? "우리 팀";
  const daysToOpening = Math.max(0, Math.round((parseDate(openingDayForDateKey(dateKey)).getTime() - parseDate(dateKey).getTime()) / MS_PER_DAY));
  const payrollRoom = roundNumber(safeNumber(team.budget) - safeNumber(team.payroll), 1);
  const injured = roster.filter((player) => safeNumber(player.injuredDays) > 0);
  const focus = selectPreseasonFocus(dateKey, team.id);
  const managerName = state.manager?.name ? `${state.manager.name} 감독` : "감독";

  return {
    state,
    team,
    teamName,
    shortName,
    dateKey,
    weather,
    managerName,
    daysToOpening,
    payrollRoom,
    injuredCount: injured.length,
    topHitter,
    topPitcher,
    prospect,
    focus,
    mediaOutlet: PRESEASON_MEDIA_OUTLETS[hashParts(dateKey, team.id, "media") % PRESEASON_MEDIA_OUTLETS.length],
    moodLabel: safeNumber(team.morale, 50) >= 62 ? "분위기는 밝은 편" : safeNumber(team.morale, 50) <= 43 ? "분위기 관리가 필요한 편" : "분위기는 안정권"
  };
}

function buildPreseasonMediaLog(context) {
  const topic = hashParts(context.dateKey, context.team.id, "topic") % 6;
  const hitterName = context.topHitter?.name ?? "중심 타자";
  const pitcherName = context.topPitcher?.name ?? "주요 투수";
  const prospectName = context.prospect?.name ?? "젊은 선수";
  const outlet = context.mediaOutlet;
  const items = [
    {
      headline: `${context.shortName} 캠프, ${hitterName} 중심 타선 실험`,
      text: `${outlet}는 ${context.teamName}이 개막 전 상위 타순 조합과 대타 카드 운용을 집중 점검하고 있다고 전했습니다.`
    },
    {
      headline: `${context.shortName} 선발 경쟁, ${pitcherName} 컨디션에 시선`,
      text: `${outlet}는 ${pitcherName}의 구위와 회복 속도가 개막 로테이션 구상의 첫 변수가 될 것으로 봤습니다.`
    },
    {
      headline: `${context.shortName} 퓨처스 후보 ${prospectName}, 캠프 평가 상승`,
      text: `${outlet}는 ${prospectName}이 백업 경쟁과 장기 육성 플랜에서 동시에 이름을 올리고 있다고 보도했습니다.`
    },
    {
      headline: `${context.managerName} 취임 효과, 선수단 메시지 주목`,
      text: `${outlet}는 새 코칭스태프가 훈련 강도보다 역할 정리와 소통을 먼저 잡는 흐름이라고 분석했습니다.`
    },
    {
      headline: `${context.shortName}, 개막 전 역할 적응 리포트 강화`,
      text: `${outlet}는 ${context.focus} 점검이 캠프 후반부 핵심 체크포인트가 될 것이라고 전망했습니다.`
    },
    {
      headline: `${context.shortName} 팬심 예열, 개막까지 ${context.daysToOpening}일`,
      text: `${outlet}는 ${context.weather?.label ?? "캠프"} 속에서도 구단이 팬 기대치와 현실적인 전력 평가 사이 균형을 찾고 있다고 전했습니다.`
    }
  ];

  return {
    date: context.dateKey,
    type: "media",
    tag: outlet,
    source: outlet,
    headline: items[topic].headline,
    text: `${items[topic].text} ${context.narrative?.mediaLine ?? ""}`.trim()
  };
}

function buildPreseasonMailboxLog(context) {
  const topic = hashParts(context.dateKey, context.team.id, "mailbox") % 8;
  const hitterName = context.topHitter?.name ?? "주전 타자";
  const pitcherName = context.topPitcher?.name ?? "주요 투수";
  const prospectName = context.prospect?.name ?? "유망주";
  const salaryHint = estimatePreseasonPlayerValueKRW(context.prospect);
  const items = [
    {
      type: "kbo-official",
      tag: "한국야구위원회(KBO)",
      source: "한국야구위원회(KBO)",
      headline: "신인 드래프트 사전 스카우트 자료 접수",
      text: `스카우트 팀장 보고: 고교·대학 후보군의 메디컬/멘탈 리포트가 업데이트됐습니다. ${prospectName} 유형의 원화 몸값 추정치는 ${formatMoneyForLog(salaryHint)} 수준입니다.`
    },
    {
      type: "kbo-official",
      tag: "한국야구위원회(KBO)",
      source: "한국야구위원회(KBO)",
      headline: "2차 드래프트 보호명단 사전 점검 안내",
      text: `35인 보호명단 작성 시 ${prospectName} 같은 젊은 자원의 제외 여부를 별도 검토하십시오. 코치진은 타 구단 관심 가능성을 경고했습니다.`
    },
    {
      type: "compliance",
      tag: "규정/예산",
      source: "프런트 예산팀",
      headline: "외국인 선수 총액 제한 검토 필요",
      text: `신규 외국인 계약은 계약금·연봉·옵션·이적료를 모두 원화 환산해 검토해야 합니다. 게임 기준 약 13억~14억 원 안팎의 총액 상한을 넘지 않도록 제안서를 분리 확인하십시오.`
    },
    {
      type: "front-office",
      tag: "단장 메일",
      source: "단장실",
      headline: "현장 기용 방향 질의",
      text: `${context.managerName}님, 구단이 투자한 ${prospectName}의 캠프 활용 계획을 보고해 주십시오. 2군 고정인지, 개막 엔트리 경쟁인지 명확한 메시지가 필요합니다.`
    },
    {
      type: "ops",
      tag: "운영팀",
      source: "원정/시설 보고",
      headline: "지방 원정 및 구장 환경 점검",
      text: `${context.shortName} 운영팀은 창원·대전·광주 원정 동선과 원정 락커룸 상태를 사전 점검 중입니다. 이동 지연 발생 시 선수단 피로도가 올라갈 수 있습니다.`
    },
    {
      type: "community",
      tag: "홍보팀",
      source: "커뮤니티 모니터링",
      headline: "야구 커뮤니티 여론 일일 보고",
      text: `디시인사이드, 엠엘비파크 등에서 ${hitterName} 타순과 ${pitcherName} 기용을 두고 의견이 갈립니다. 개막 전 인터뷰 톤이 구단 신뢰도에 영향을 줄 수 있습니다.`
    },
    {
      type: "futures",
      tag: "퓨처스",
      source: "2군 감독",
      headline: "퓨처스리그 롱리포트",
      text: `${prospectName}의 훈련 집중도와 회복 루틴이 양호합니다. 1군 콜업 후보로 유지하되, 멘탈 리포트는 다음 주까지 추가 관찰을 권합니다.`
    },
    {
      type: "development",
      tag: "교육리그",
      source: "육성팀",
      headline: "질롱/교육리그 파견 후보 검토",
      text: `${prospectName}은 비시즌 교육리그 파견 시 성장 폭이 기대됩니다. 예상 체류/지원 비용은 원화 기준으로 별도 정산서가 필요합니다.`
    }
  ];

  return {
    date: context.dateKey,
    ...items[topic],
    text: `${items[topic].text} 누적 이슈: ${context.narrative?.reportLine ?? "아직 장기 이슈는 낮은 강도입니다."}`
  };
}

function buildPreseasonAssistantLog(context) {
  const concern = context.injuredCount > 0
    ? `부상자 ${context.injuredCount}명 회복 계획을 먼저 확인해야 합니다`
    : context.payrollRoom < 0
      ? `예산이 ${Math.abs(context.payrollRoom)}억가량 초과라 개막 전 정리가 필요합니다`
      : `${context.focus} 보고서를 코칭스태프에게 받아두면 좋겠습니다`;
  const prompt = selectPreseasonPressPrompt(context);

  return {
    date: context.dateKey,
    type: "assistant",
    tag: "개인비서",
    source: "개인비서",
    headline: `${context.managerName}님, 개막까지 ${context.daysToOpening}일 전 보고입니다`,
    text: `${context.moodLabel}입니다. 오늘 결정 안건은 ${concern}. 누적 이슈: ${context.narrative?.assistantLine ?? "아직 없습니다."} 예상 언론 질문은 "${prompt}"입니다.`
  };
}

function selectPreseasonFocus(dateKey, teamId) {
  const focuses = [
    "개막 엔트리 28인 압축",
    "선발 로테이션 순서",
    "필승조와 추격조 역할",
    "상위 타순 출루 루트",
    "백업 포수와 내야 멀티 포지션",
    "주루/수비 디테일",
    "외국인 선수 적응",
    "퓨처스 콜업 후보"
  ];
  return focuses[hashParts(dateKey, teamId, "focus") % focuses.length];
}

function selectPreseasonPressPrompt(context) {
  const prompts = [
    `중심 타선 고정 후보가 ${context.topHitter?.name ?? "주전 타자"}인가요?`,
    `${context.topPitcher?.name ?? "주요 투수"}의 개막 로테이션 위치는 정해졌나요?`,
    `${context.prospect?.name ?? "유망주"}에게 1군 기회를 줄 생각이 있나요?`,
    `개막 전까지 ${context.focus}에서 가장 중요한 기준은 무엇인가요?`,
    `프리시즌 성적보다 선수단 분위기를 더 중시하나요?`
  ];
  return prompts[hashParts(context.dateKey, context.team.id, "prompt") % prompts.length];
}

function selectPreseasonPlayer(players, scoreFn, dateKey) {
  return [...(players ?? [])]
    .map((player) => ({ player, score: scoreFn(player) }))
    .sort((a, b) => b.score - a.score || compareText(a.player?.name, b.player?.name) || hashParts(dateKey, a.player?.id) - hashParts(dateKey, b.player?.id))[0]?.player ?? null;
}

function preseasonProspectScore(player) {
  const ovr = safeNumber(player?.ovr);
  const pot = safeNumber(player?.pot, ovr);
  const ageBonus = Math.max(0, 27 - safeNumber(player?.age, 27)) * 3;
  const upside = Math.max(0, pot - ovr);
  return ageBonus + upside + pot * 0.16;
}

function estimatePreseasonPlayerValueKRW(player) {
  const ovr = safeNumber(player?.ovr, 100);
  const pot = safeNumber(player?.pot, ovr);
  const age = safeNumber(player?.age, 22);
  const upside = Math.max(0, pot - ovr);
  const ageBonus = Math.max(0, 25 - age) * 18_000_000;
  return roundMarketMoney(clamp((ovr * 5_500_000) + (upside * 12_000_000) + ageBonus, 80_000_000, 2_800_000_000));
}

function estimateDraftProspectValueKRW(prospect) {
  const present = safeNumber(prospect?.presentGrade, 45);
  const future = safeNumber(prospect?.futureGrade, present + 10);
  const certainty = safeNumber(prospect?.certainty, 50);
  const risk = safeNumber(prospect?.risk, 50);
  return roundMarketMoney(clamp((present * 8_000_000) + (future * 12_000_000) + (certainty * 4_000_000) - (risk * 3_000_000), 50_000_000, 3_500_000_000));
}

function draftRiskLabel(value) {
  const risk = safeNumber(value, 50);
  if (risk >= 64) return "고위험";
  if (risk >= 46) return "보통";
  return "양호";
}

function draftMentalLabel(value) {
  const certainty = safeNumber(value, 50);
  if (certainty >= 64) return "우수";
  if (certainty >= 44) return "관찰";
  return "추가 면담";
}

function addLog(state, message) {
  state.logs = [message, ...(Array.isArray(state.logs) ? state.logs : [])].slice(0, LOG_LIMIT);
  rememberStructuredLogNarrative(state, message);
}

function deterministicRange(...parts) {
  const max = parts.pop();
  const min = parts.pop();
  const span = max - min + 1;
  return min + (hashParts(...parts) % span);
}

function rollUnit(...parts) {
  return hashParts(...parts) / 0x100000000;
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

function sum(items, key) {
  return items.reduce((total, item) => total + safeNumber(item[key]), 0);
}

function rating100(value) {
  return safeNumber(value) / 2;
}

function averageNumbers(...values) {
  const validValues = values.filter((value) => Number.isFinite(Number(value)));
  if (validValues.length === 0) return 0;
  return validValues.reduce((total, value) => total + Number(value), 0) / validValues.length;
}

function rate(numerator, denominator) {
  const top = safeNumber(numerator);
  const bottom = safeNumber(denominator);
  return bottom > 0 ? top / bottom : 0;
}

function compareText(left, right) {
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function roundNumber(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(safeNumber(value) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
