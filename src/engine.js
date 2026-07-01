import { REGULAR_SEASON_GAMES, formatDateKey } from "./data.js";
import { buildTradeMarket } from "./frontOffice.js";

const KBO_TEAM_COUNT = 10;
const DAILY_GAME_COUNT = 5;
const RECENT_LIMIT = 14;
const LOG_LIMIT = 80;
const EVENT_LOG_LIMIT = 1000;
const KEY_EVENT_LIMIT = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const OPENING_DAY = "2026-03-28";
const OPENING_DAY_MONTH_DAY = "03-28";
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

export function getSelectedTeam(state) {
  return state?.teams?.find((team) => team.id === state.selectedTeamId) ?? state?.teams?.[0];
}

export function buildLineup(team) {
  const activeHitters = (team?.roster ?? []).filter((player) => player.role === "hitter" && isActiveRosterPlayer(player));
  const hitterPool = activeHitters.length >= 9 ? activeHitters : (team?.roster ?? []).filter((player) => player.role === "hitter");
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

export function buildPitchingSnapshot(team) {
  const pitchers = getAvailablePitchers(team);
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

export function simulateDay(state) {
  if (!state || ["complete", "postseason", "offseason"].includes(state.phase)) return state;

  normalizeState(state);

  if (state.phase === "preseason") {
    const date = parseDate(state.currentDate);
    const weather = buildWeather(state, date);
    state.weather = weather;
    recoverRoster(state.teams);
    advanceDate(state, date);
    if (state.currentDate >= openingDayForDateKey(state.currentDate)) {
      state.phase = "regular";
      addLog(state, `${state.currentDate} 정규시즌 개막일입니다. 이제 하루 진행부터 경기가 열립니다.`);
    } else {
      addLog(state, `${state.currentDate} 프리시즌 훈련일입니다. 정규시즌 개막까지 로스터를 점검하세요.`);
    }
    return state;
  }

  const date = parseDate(state.currentDate);
  const dateKey = formatDateKey(date);
  const weather = buildWeather(state, date);
  state.weather = weather;

  recoverRoster(state.teams);

  if (date.getUTCDay() === 1) {
    addLog(state, `${dateKey} 월요일 휴식일: 전 구단이 이동과 회복에 집중했습니다.`);
  } else if (state.gamesPlayed < REGULAR_SEASON_GAMES && state.teams.length >= KBO_TEAM_COUNT) {
    const remaining = REGULAR_SEASON_GAMES - state.gamesPlayed;
    const matchups = buildMatchups(state.teams, Math.floor(state.gamesPlayed / DAILY_GAME_COUNT));
    const gamesToPlay = Math.min(matchups.length, Math.floor(remaining));
    const results = [];

    for (let i = 0; i < gamesToPlay; i += 1) {
      results.push(simulateGame(state, matchups[i], i, weather, dateKey));
    }

    state.lastGames = [...results, ...state.lastGames].slice(0, RECENT_LIMIT);
    state.gamesPlayed += results.length;
    if (results.length > 0) {
      addLog(state, `${dateKey} ${weather.label}: ${results.length}경기 진행, 총 ${sum(results, "totalRuns")}득점.`);
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
    simulateDay(state);
  }
  return state;
}

export function simulateRegularSeason(state) {
  while (state?.gamesPlayed < REGULAR_SEASON_GAMES && state?.day < 260 && state?.phase !== "complete") {
    simulateDay(state);
  }
  return state;
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
  for (let pickIndex = draft.picks.length; pickIndex < draft.totalPicks; pickIndex += 1) {
    const round = Math.floor(pickIndex / DRAFT_PICKS_PER_ROUND) + 1;
    const slot = pickIndex % DRAFT_PICKS_PER_ROUND;
    const teamOrder = draft.order[slot];
    const strategy = draft.strategies[teamOrder.teamId];
    const prospect = selectDraftProspect(draft.prospects, strategy, round, pickIndex + 1);
    if (!prospect) break;

    prospect.picked = true;
    prospect.pickNumber = pickIndex + 1;
    prospect.round = round;
    prospect.pickInRound = slot + 1;
    prospect.selectedByTeamId = teamOrder.teamId;
    prospect.selectedByTeamName = teamOrder.name;

    draft.picks.push({
      pickNumber: pickIndex + 1,
      round,
      pickInRound: slot + 1,
      teamId: teamOrder.teamId,
      teamName: teamOrder.name,
      prospectId: prospect.id,
      displayCode: prospect.displayCode,
      role: prospect.role,
      position: prospect.position,
      classType: prospect.classType,
      profile: prospect.profile,
      presentGrade: prospect.presentGrade,
      futureGrade: prospect.futureGrade,
      certainty: prospect.certainty,
      risk: prospect.risk
    });
  }

  draft.status = "complete";
  draft.completedDate = state.currentDate;
  const rosterResult = applyDraftSelectionsToRosters(state);
  addLog(state, `${state.currentDate} ${draft.year} 신인 드래프트 완료: ${draft.picks.length}명 지명, ${rosterResult.added}명 rookie 계약, ${draft.rightsLedger?.length ?? 0}명 보류권, 미지명 ${draft.prospects.length - draft.picks.length}명.`);
  return state;
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
  const originPickCounts = new Map();
  for (const pick of draft.picks) {
    originPickCounts.set(pick.fromTeamId, (originPickCounts.get(pick.fromTeamId) ?? 0) + 1);
  }

  for (const slot of buildSecondaryDraftSlots(draft)) {
    if (draft.picks.some((pick) => pick.slotId === slot.slotId) || draft.passedSlots.some((entry) => entry.slotId === slot.slotId)) {
      continue;
    }

    const team = findTeamById(state, slot.teamId);
    const strategy = draft.strategies[slot.teamId];
    const candidate = selectSecondaryDraftCandidate(draft.exposurePool, strategy, team, slot, originPickCounts);
    if (!candidate) {
      draft.passedSlots.push({
        ...slot,
        reason: "eligible-candidate-empty"
      });
      continue;
    }

    candidate.picked = true;
    candidate.selectedByTeamId = slot.teamId;
    candidate.selectedByTeamName = slot.teamName;
    candidate.round = slot.round;
    candidate.pickNumber = draft.picks.length + 1;

    originPickCounts.set(candidate.teamId, (originPickCounts.get(candidate.teamId) ?? 0) + 1);
    draft.picks.push({
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
      obligation: "next-season-registration-v1"
    });
  }

  draft.status = "complete";
  draft.completedDate = state.currentDate;
  const rosterResult = applySecondaryDraftMoves(state);
  addLog(state, `${state.currentDate} ${draft.year} 2차 드래프트 완료: ${draft.picks.length}명 지명, ${rosterResult.moved}명 소속 이동, 패스 ${draft.passedSlots.length}건.`);
  return state;
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
  }

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

  return {
    ok: true,
    code: "committed",
    message: `${incomingPlayer.name} ↔ ${outgoingPlayer.name} 트레이드를 완료했어요.`,
    trade: completedTrade
  };
}

function simulateGame(state, matchup, gameIndex, weather, dateKey, options = {}) {
  const { away, home } = matchup;
  const awayLineup = buildLineup(away);
  const homeLineup = buildLineup(home);
  const awayPitchingPlan = buildPitchingPlan(away);
  const homePitchingPlan = buildPitchingPlan(home);
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
    plateAppearanceEvents,
    scoringEvents,
    totalRuns,
    attendance
  };

  appendEvent(state, buildGameFinalEvent(result));
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

function simulateOffense({ gameId, offense, defense, lineup, defenseLineup, pitchingPlan, seed, weather, side }) {
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
      outs
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
        side
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

function resolvePlateAppearance({ hitter, pitcher, defenseQuality, defenseContext, weather, seed, plateAppearance, side, bases, outs }) {
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

  const walkRate = clamp((0.086 + (eye + patience - 20) * 0.004 - (control - 10) * 0.0052) * anonymousProfile.walkScale, 0.035, 0.165);
  const strikeoutRate = clamp(
    clamp(
      0.182 + (stuff - 10) * 0.0092 + (velocity - 10) * 0.0036 - (contact - 10) * 0.0078 - (eye - 10) * 0.0023 + platoonPressure,
      0.078,
      0.35
    ) + anonymousProfile.strikeoutAdd,
    0.078,
    0.39
  );
  const homeRunRate = clamp(
    (0.029 + (power - 10) * 0.0038 + (battedBall - 10) * 0.002 - (hrSuppression - 10) * 0.0032 - platoonPressure * 0.7 + flyBallBoost) * weatherHomer * anonymousProfile.homerScale,
    0.005,
    0.09
  );
  const tripleRate = clamp((0.003 + (safeNumber(hitter.speed, 10) - 10) * 0.00055 - (outfieldDefense - 10) * 0.00038) * weatherHit, 0.001, 0.014);
  const doubleRate = clamp(
    (0.047 + (power - 10) * 0.0023 + (contact - 10) * 0.001 - (movement - 10) * 0.0019 - (outfieldDefense - 10) * 0.0012 - platoonPressure * 0.5 + lineDriveBoost) * weatherRun * anonymousProfile.extraBaseScale,
    0.02,
    0.084
  );
  const singleRate = clamp(
    (0.107 + (contact - 10) * 0.0045 + condition + pitcherFreshness - (stuff - 10) * 0.005 - (movement - 10) * 0.0031 - (battedBallDefense - 10) * 0.0029 - platoonPressure * 0.8 + lineDriveBoost - groundBallPenalty) * weatherHit * anonymousProfile.singleScale,
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

function maybeAttemptSteal({ bases, pitcher, seed, plateAppearance, side }) {
  const runner = bases[0];
  if (!runner || bases[1]) return { outs: 0 };

  const speed = safeNumber(runner.speed, 10);
  const stealing = safeNumber(runner.stealing, speed);
  const attemptRate = clamp((speed + stealing - 18) * 0.008, 0, 0.16);
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

  let bullpenIndex = outs >= 24 ? 2 : outs >= 21 ? 1 : 0;
  while (bullpenIndex < pitchingPlan.bullpen.length) {
    const candidate = pitchingPlan.bullpen[bullpenIndex];
    const line = getExistingGamePitchingLine(result, candidate);
    if (!line || safeNumber(line.pitches) < 28) return candidate;
    bullpenIndex += 1;
  }

  return pitchingPlan.bullpen.at(-1) ?? pitchingPlan.starter;
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
    }
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

function getAvailablePitchers(team) {
  const pitchers = [...(team?.roster ?? [])]
    .filter((player) =>
      player.role === "pitcher" &&
      safeNumber(player.injuredDays) === 0 &&
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
  return player?.status === "active";
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
  }
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

function addLog(state, message) {
  state.logs = [message, ...state.logs].slice(0, LOG_LIMIT);
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
