import { ROSTER_SOURCE_LABEL, TEAM_ROSTERS } from "./rosters/index.js";
import { buildPlayerRatings } from "./ratings.js";
import KBO_STATS_2026 from "./ratings_sources/kboStats2026.js";
import { syncStateFoundation } from "./stateSchema.js";

export const TEAM_COUNT = 10;
export const REGULAR_SEASON_GAMES = 720;

const CURRENT_SEASON = 2026;
const KRW_PER_EOK = 100000000;
const SALARY_ROUNDING_KRW = 10000000;
const BASE_DATE = new Date("2026-03-01T12:00:00+09:00");

const FOREIGN_PLAYER_NAME_HINTS = new Set([
  "리오스",
  "웰스",
  "톨허스트",
  "오스틴",
  "벤자민",
  "잭로그",
  "네일",
  "시라카와",
  "올러",
  "카스트로",
  "오러클린",
  "후라도",
  "디아즈",
  "로드리게스",
  "비슬리",
  "이이무라",
  "레이예스",
  "에르난데스",
  "왕옌청",
  "화이트",
  "페라자",
  "베니지아노",
  "타케다",
  "해치",
  "에레디아",
  "로건",
  "사우어",
  "스기모토",
  "힐리어드",
  "라일리",
  "테일러",
  "토다",
  "알칸타라",
  "유토",
  "히우라"
]);

const KBO_STATS_BY_PLAYER_ID = new Map(
  (Array.isArray(KBO_STATS_2026.players) ? KBO_STATS_2026.players : []).map((player) => [
    String(player.playerId ?? ""),
    player
  ])
);

const TEAM_SEEDS = [
  {
    id: "lg",
    name: "LG 트윈스",
    shortName: "LG",
    company: "LG",
    city: "서울",
    home: "잠실야구장",
    color: "#C30452",
    accent: "#111111",
    logo: "./assets/logos/lg.png",
    mascotLabel: "쌍둥이",
    vibe: "밝고 세련된 인기 구단",
    market: 92,
    fan: 94,
    payroll: 141,
    budget: 85,
    baseOvr: 88
  },
  {
    id: "doosan",
    name: "두산 베어스",
    shortName: "두산",
    company: "두산",
    city: "서울",
    home: "잠실야구장",
    color: "#131230",
    accent: "#D71920",
    logo: "./assets/logos/doosan.png",
    mascotLabel: "곰",
    vibe: "끈질긴 가을야구 DNA",
    market: 86,
    fan: 88,
    payroll: 145,
    budget: 75,
    baseOvr: 82
  },
  {
    id: "kia",
    name: "KIA 타이거즈",
    shortName: "KIA",
    company: "KIA",
    city: "광주",
    home: "광주-기아 챔피언스 필드",
    color: "#EA0029",
    accent: "#06141F",
    logo: "./assets/logos/kia.png",
    mascotLabel: "호랑이",
    vibe: "강한 팬덤과 우승 DNA",
    market: 88,
    fan: 93,
    payroll: 130,
    budget: 70,
    baseOvr: 84
  },
  {
    id: "samsung",
    name: "삼성 라이온즈",
    shortName: "삼성",
    company: "삼성",
    city: "대구",
    home: "대구 삼성 라이온즈 파크",
    color: "#074CA1",
    accent: "#C0C7D2",
    logo: "./assets/logos/samsung.png",
    mascotLabel: "사자",
    vibe: "푸른 왕조를 꿈꾸는 팀",
    market: 87,
    fan: 91,
    payroll: 135,
    budget: 80,
    baseOvr: 86
  },
  {
    id: "lotte",
    name: "롯데 자이언츠",
    shortName: "롯데",
    company: "롯데",
    city: "부산",
    home: "사직야구장",
    color: "#002955",
    accent: "#DC0232",
    logo: "./assets/logos/lotte.png",
    mascotLabel: "거인",
    vibe: "뜨겁고 낭만적인 부산 야구",
    market: 90,
    fan: 95,
    payroll: 120,
    budget: 60,
    baseOvr: 80
  },
  {
    id: "hanwha",
    name: "한화 이글스",
    shortName: "한화",
    company: "한화",
    city: "대전",
    home: "대전 한화생명 볼파크",
    color: "#F37321",
    accent: "#1F1F1F",
    logo: "./assets/logos/hanwha.png",
    mascotLabel: "독수리",
    vibe: "긴 기다림 끝의 도약",
    market: 84,
    fan: 92,
    payroll: 120,
    budget: 60,
    baseOvr: 83
  },
  {
    id: "ssg",
    name: "SSG 랜더스",
    shortName: "SSG",
    company: "SSG",
    city: "인천",
    home: "인천 SSG 랜더스필드",
    color: "#CE0E2D",
    accent: "#F7B500",
    logo: "./assets/logos/ssg.png",
    mascotLabel: "상륙대",
    vibe: "공격적인 투자와 스타 파워",
    market: 85,
    fan: 87,
    payroll: 161,
    budget: 65,
    baseOvr: 85
  },
  {
    id: "kt",
    name: "KT 위즈",
    shortName: "KT",
    company: "KT",
    city: "수원",
    home: "수원 KT 위즈 파크",
    color: "#111111",
    accent: "#ED1C24",
    logo: "./assets/logos/kt.png",
    mascotLabel: "마법사",
    vibe: "조용하지만 단단한 운영",
    market: 82,
    fan: 86,
    payroll: 128,
    budget: 65,
    baseOvr: 85
  },
  {
    id: "nc",
    name: "NC 다이노스",
    shortName: "NC",
    company: "NC",
    city: "창원",
    home: "창원 NC 파크",
    color: "#315288",
    accent: "#C7A079",
    logo: "./assets/logos/nc.png",
    mascotLabel: "공룡",
    vibe: "젊고 분석적인 팀 컬러",
    market: 78,
    fan: 83,
    payroll: 125,
    budget: 50,
    baseOvr: 81
  },
  {
    id: "kiwoom",
    name: "키움 히어로즈",
    shortName: "키움",
    company: "키움",
    city: "서울",
    home: "고척스카이돔",
    color: "#570514",
    accent: "#B07A57",
    logo: "./assets/logos/kiwoom.png",
    mascotLabel: "영웅",
    vibe: "저예산 육성형 챌린지",
    market: 74,
    fan: 80,
    payroll: 95,
    budget: 40,
    baseOvr: 76
  }
];

export function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function createInitialState() {
  const teams = TEAM_SEEDS.map((seed, teamIndex) => ({
    ...seed,
    wins: 0,
    losses: 0,
    ties: 0,
    runsFor: 0,
    runsAgainst: 0,
    morale: clamp(52 + Math.round((seed.baseOvr - 80) * 1.4), 35, 82),
    attendanceTotal: 0,
    homeGames: 0,
    streak: [],
    roster: createRoster(seed, teamIndex)
  }));

  const state = {
    day: 1,
    currentDate: formatDateKey(BASE_DATE),
    selectedTeamId: "lg",
    manager: null,
    gamesPlayed: 0,
    phase: "preseason",
    ui: { screen: "welcome" },
    dataSource: ROSTER_SOURCE_LABEL,
    weather: { label: "맑음", temperature: 18, runFactor: 1, homerFactor: 1 },
    lastGames: [],
    postseason: null,
    awards: null,
    draft: null,
    secondaryDraft: null,
    trades: { completed: [] },
    tradeAssets: { cashLedger: [], draftPickLedger: [], conditionalAssets: [], ptbnlSlots: [] },
    freeAgency: null,
    eventLog: [],
    logs: [
      {
        date: formatDateKey(BASE_DATE),
        tag: "시작",
        text: "2026 KBO GM 프리시즌이 시작되었습니다."
      }
    ],
    teams
  };

  return syncStateFoundation(state);
}

function createRoster(teamSeed, teamIndex) {
  const rosterSeeds = TEAM_ROSTERS[teamSeed.id] ?? [];
  const players = rosterSeeds
    .filter((player) => player?.name && player?.role)
    .map((player, index) => createPlayer(teamSeed, teamIndex, player, index))
    .sort((a, b) => b.ovr - a.ovr);

  return attachBusinessState(teamSeed, teamIndex, players);
}

function createPlayer(teamSeed, teamIndex, seed, index) {
  const role = seed.role === "pitcher" ? "pitcher" : "hitter";
  const position = normalizePosition(seed.position, role);
  const age = clamp(Number(seed.age ?? 26), 17, 45);
  const ratingProfile = buildPlayerRatings({
    seedPlayer: seed,
    teamSeed,
    teamIndex,
    index,
    statsRecord: getStatsRecord(seed.playerId)
  });
  const fatigue = Math.round(seededNoise(index, teamIndex, 17) * 12);
  const form = clamp(
    Math.round((ratingProfile.dailyCondition ?? 58) * 0.45 + (ratingProfile.sharpness ?? 58) * 0.55),
    30,
    92
  );

  return {
    id: `${teamSeed.id}-${index}`,
    teamId: teamSeed.id,
    name: seed.name,
    age,
    role,
    position,
    bats: role === "hitter" ? normalizeHand(seed.bats) : "",
    throws: normalizeHand(seed.throws),
    jerseyNumber: seed.jerseyNumber ?? "",
    status: seed.status ?? "registered",
    playerId: seed.playerId ?? "",
    source: seed.source ?? ROSTER_SOURCE_LABEL,
    candidateType: seed.candidateType ?? "",
    sourceUrls: Array.isArray(seed.sourceUrls) ? seed.sourceUrls : [],
    sourceQueries: Array.isArray(seed.sourceQueries) ? seed.sourceQueries : [],
    reviewNote: seed.reviewNote ?? "",
    verificationNote: seed.verificationNote ?? "",
    school: seed.school ?? "",
    birthday: seed.birthday ?? "",
    body: seed.body ?? "",
    handedness: seed.handedness ?? "",
    ...ratingProfile,
    seasonStats: createSeasonStats(),
    fatigue,
    form,
    injuredDays: 0
  };
}

function attachBusinessState(teamSeed, teamIndex, players) {
  const payrollKRW = Math.max(players.length * 30000000, safeMoneyKRW(teamSeed.payroll, 100) * KRW_PER_EOK);
  const weights = players.map((player, index) => contractWeight(player, teamIndex, index));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
  const salaryEntries = players.map((player, index) => ({
    player,
    salaryKRW: roundMoney(Math.max(30000000, payrollKRW * weights[index] / totalWeight))
  }));
  const rankedBySalary = [...salaryEntries].sort((a, b) => b.salaryKRW - a.salaryKRW);
  const salaryRanks = new Map(rankedBySalary.map((entry, index) => [entry.player.id, index + 1]));

  return salaryEntries.map(({ player, salaryKRW }, index) => {
    const isForeign = inferForeignPlayer(player);
    const serviceTime = createServiceTime(player);
    const compensationGrade = createCompensationGrade(player, salaryKRW, salaryRanks.get(player.id), serviceTime);
    const faStatus = createFaStatus(player, serviceTime, compensationGrade);

    return {
      ...player,
      contract: createContract(teamSeed, player, salaryKRW, index, isForeign),
      faStatus,
      militaryStatus: createMilitaryStatus(teamSeed, player, isForeign),
      foreignPlayer: createForeignPlayer(teamSeed, player, isForeign),
      serviceTime,
      compensationGrade
    };
  });
}

function contractWeight(player, teamIndex, index) {
  const rating = Math.max(25, Number(player.ovr ?? 80) / 2);
  const primeAge = player.role === "pitcher" ? 29 : 28;
  const ageDistance = Math.abs(Number(player.age ?? primeAge) - primeAge);
  const primeMultiplier = clamp(1.16 - ageDistance * 0.035, 0.72, 1.16);
  const statusMultiplier = player.status === "futures" ? 0.46 : 1;
  const foreignMultiplier = inferForeignPlayer(player) ? 4.2 : 1;
  const roleMultiplier = player.role === "pitcher" ? 1.08 : 1;
  const noise = 0.92 + seededNoise(index + 11, teamIndex + 23, Number(player.ovr ?? 0)) * 0.18;

  return Math.max(0.18, (rating / 48) ** 2.3 * primeMultiplier * statusMultiplier * foreignMultiplier * roleMultiplier * noise);
}

function createContract(teamSeed, player, salaryKRW, index, isForeign) {
  const years = estimateContractYears(player, isForeign);
  const signingBonusKRW = roundMoney(salaryKRW * (isForeign ? 0.18 : years > 1 ? 0.12 : 0));
  const annualStep = years > 1 ? 0.05 : 0;
  const salaryBySeason = Array.from({ length: years }, (_, offset) => {
    const season = CURRENT_SEASON + offset;
    const amountKRW = roundMoney(salaryKRW * (1 + annualStep * offset));
    return { season, amountKRW, payrollAmountKRW: amountKRW };
  });
  const guaranteedAmountKRW = salaryBySeason.reduce((total, item) => total + item.amountKRW, signingBonusKRW);

  return {
    id: `contract-${player.id}-${CURRENT_SEASON}`,
    status: "active",
    type: isForeign ? "foreign" : player.status === "futures" ? "development" : Number(player.age) <= 20 ? "rookie" : "standard",
    teamId: teamSeed.id,
    startSeason: CURRENT_SEASON,
    endSeason: CURRENT_SEASON + years - 1,
    signedDate: `${CURRENT_SEASON}-01-${String((index % 27) + 1).padStart(2, "0")}`,
    guaranteedAmountKRW,
    averageAnnualValueKRW: roundMoney(guaranteedAmountKRW / years),
    salary: {
      season: CURRENT_SEASON,
      amountKRW: salaryKRW,
      payrollAmountKRW: salaryKRW,
      paymentTiming: "season"
    },
    salaryBySeason,
    signingBonus: {
      amountKRW: signingBonusKRW,
      paidSeason: CURRENT_SEASON,
      payrollTreatment: "unknown"
    },
    bonuses: createContractBonuses(player, salaryKRW),
    options: isForeign ? [createForeignOption(player, salaryKRW)] : [],
    clauses: {
      noTrade: Number(player.age) >= 34 && salaryKRW >= 700000000 ? "limited" : "none",
      optOutAfterSeason: null,
      foreignReleaseClause: isForeign
    },
    source: {
      kind: "estimated",
      label: "앱 v0 연봉 배분 모델",
      checkedDate: formatDateKey(BASE_DATE),
      confidence: 0.35
    }
  };
}

function createContractBonuses(player, salaryKRW) {
  if (Number(player.ovr ?? 0) < 118) return [];
  const stat = player.role === "pitcher" ? "ip" : "pa";
  const value = player.role === "pitcher" ? 120 : 450;
  return [
    {
      id: `bonus-${player.id}-${stat}-${value}`,
      type: "playingTime",
      label: player.role === "pitcher" ? "120이닝 달성" : "450타석 달성",
      trigger: { stat, operator: ">=", value },
      amountKRW: roundMoney(Math.max(10000000, salaryKRW * 0.06)),
      status: "pending"
    }
  ];
}

function createForeignOption(player, salaryKRW) {
  return {
    id: `option-${player.id}-${CURRENT_SEASON + 1}-club`,
    type: "club",
    season: CURRENT_SEASON + 1,
    amountKRW: roundMoney(salaryKRW * 1.08),
    buyoutKRW: roundMoney(salaryKRW * 0.08),
    status: "pending"
  };
}

function createFaStatus(player, serviceTime, compensationGrade) {
  const yearsUntilEligibility = Math.max(0, 8 - Number(serviceTime.seasonsAccrued ?? 0));
  const eligibleAfterSeason = yearsUntilEligibility === 0;

  return {
    status: eligibleAfterSeason ? "eligibleAfterSeason" : "notEligible",
    eligibilitySeason: eligibleAfterSeason ? CURRENT_SEASON : CURRENT_SEASON + yearsUntilEligibility,
    filingSeason: null,
    marketState: "notOpen",
    yearsUntilEligibility,
    previousFaCount: Number(player.age) >= 36 && eligibleAfterSeason ? 1 : 0,
    qualifyingTeamId: player.teamId,
    compensationGrade: compensationGrade.grade,
    compensationRule: {
      requiresProtectedList: ["A", "B"].includes(compensationGrade.grade),
      protectedListSize: compensationGrade.grade === "A" ? 20 : compensationGrade.grade === "B" ? 25 : 0,
      cashCompensationMultiplier: compensationGrade.grade === "A" ? 3 : compensationGrade.grade === "B" ? 2 : compensationGrade.grade === "C" ? 1.5 : 0
    },
    rights: {
      canNegotiateWithAllTeams: false,
      originalTeamExclusiveUntil: null
    },
    source: {
      kind: "estimated",
      label: "나이/서비스타임 v0 추정",
      checkedDate: formatDateKey(BASE_DATE),
      confidence: 0.3
    }
  };
}

function createMilitaryStatus(teamSeed, player, isForeign) {
  if (isForeign) {
    return {
      status: "notSubject",
      availability: "available",
      obligation: "notSubject",
      serviceType: null,
      startDate: null,
      expectedReturnDate: null,
      actualReturnDate: null,
      holdTeamId: teamSeed.id,
      countsTowardRosterLimit: false,
      notes: "외국인 선수 v0 추정",
      source: { kind: "estimated", label: "외국인 슬롯 추정", checkedDate: formatDateKey(BASE_DATE), confidence: 0.35 }
    };
  }

  return {
    status: "unknown",
    availability: "available",
    obligation: "unknown",
    serviceType: null,
    startDate: null,
    expectedReturnDate: null,
    actualReturnDate: null,
    holdTeamId: teamSeed.id,
    countsTowardRosterLimit: false,
    notes: "공식 병역 데이터 입력 전",
    source: { kind: "unknown", label: "미확인", checkedDate: formatDateKey(BASE_DATE), confidence: 0 }
  };
}

function createForeignPlayer(teamSeed, player, isForeign) {
  return {
    isForeign,
    nationality: player.nationality ?? (isForeign ? "unknown" : "KOR"),
    registrationStatus: isForeign ? "registered" : "notForeign",
    slotType: isForeign ? player.role === "pitcher" ? "foreignPitcher" : "foreignHitter" : "domestic",
    marketTier: isForeign ? estimateForeignTier(player) : null,
    acquiredFrom: isForeign ? "foreignMarket" : null,
    visaStatus: isForeign ? "unknown" : "notRequired",
    firstKboSeason: isForeign ? CURRENT_SEASON : null,
    foreignRightsTeamId: isForeign ? teamSeed.id : null,
    replacementRisk: isForeign ? estimateReplacementRisk(player) : "low",
    previousLeagues: [],
    source: {
      kind: isForeign ? "estimated" : "fallback",
      label: isForeign ? "외국인명 힌트 v0" : "국내 선수 기본값",
      checkedDate: formatDateKey(BASE_DATE),
      confidence: isForeign ? 0.45 : 0.2
    }
  };
}

function createServiceTime(player) {
  const age = Number(player.age ?? 24);
  const proStartAge = player.role === "pitcher" ? 21 : 20;
  const statusPenalty = player.status === "futures" ? 2 : 0;
  const seasonsAccrued = clamp(Math.floor(age - proStartAge - statusPenalty), 0, 14);
  const daysAccrued = seasonsAccrued * 145 + Math.round(seededNoise(age, Number(player.ovr ?? 0), Number(player.pot ?? 0)) * 85);
  const daysRemaining = Math.max(0, (8 - seasonsAccrued) * 145);

  return {
    seasonsAccrued,
    daysAccrued,
    currentSeasonDays: 0,
    firstTeamRegistrationDays: player.status === "futures" ? 0 : 0,
    futuresOnlyDays: player.status === "futures" ? 145 : 0,
    rookieEligible: age <= 23 && seasonsAccrued <= 1,
    faClockStatus: seasonsAccrued >= 8 ? "met" : "running",
    nextMilestone: {
      type: "faEligibility",
      season: CURRENT_SEASON + Math.max(0, 8 - seasonsAccrued),
      daysRemaining
    },
    source: {
      kind: "estimated",
      label: "나이 기반 서비스타임 v0",
      checkedDate: formatDateKey(BASE_DATE),
      confidence: 0.28
    }
  };
}

function createCompensationGrade(player, salaryKRW, salaryRankInTeam, serviceTime) {
  let grade = "none";
  if (Number(serviceTime.seasonsAccrued ?? 0) >= 8) {
    if (salaryRankInTeam <= 3 || salaryKRW >= 900000000) grade = "A";
    else if (salaryRankInTeam <= 10 || salaryKRW >= 450000000) grade = "B";
    else grade = "C";
  }

  return {
    grade,
    basisSeason: CURRENT_SEASON,
    rankingBasis: grade === "none" ? "unknown" : "salaryRank",
    protectedListRequired: ["A", "B"].includes(grade),
    compensationPlayerAllowed: ["A", "B"].includes(grade),
    cashOnlyAllowed: grade === "C",
    estimatedCashKRW: grade === "none" ? 0 : roundMoney(salaryKRW * (grade === "A" ? 3 : grade === "B" ? 2 : 1.5)),
    source: {
      kind: grade === "none" ? "fallback" : "estimated",
      label: "연봉순위 v0 추정",
      checkedDate: formatDateKey(BASE_DATE),
      confidence: grade === "none" ? 0.2 : 0.3
    }
  };
}

function estimateContractYears(player, isForeign) {
  if (isForeign) return 1;
  const age = Number(player.age ?? 26);
  const rating = Number(player.ovr ?? 100);
  if (age <= 22) return 3;
  if (rating >= 135 && age <= 32) return 4;
  if (rating >= 118 && age <= 34) return 2;
  return 1;
}

function inferForeignPlayer(player) {
  if (player.foreignPlayer?.isForeign === true || player.isForeign === true) return true;
  if (typeof player.nationality === "string" && player.nationality && player.nationality !== "KOR") return true;
  return FOREIGN_PLAYER_NAME_HINTS.has(String(player.name ?? "").trim());
}

function estimateForeignTier(player) {
  const rating = Number(player.ovr ?? 100);
  if (rating >= 140) return 1;
  if (rating >= 125) return 2;
  if (rating >= 110) return 3;
  if (rating >= 95) return 4;
  return 5;
}

function estimateReplacementRisk(player) {
  const rating = Number(player.ovr ?? 100);
  if (rating >= 124) return "low";
  if (rating >= 108) return "medium";
  return "high";
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) / SALARY_ROUNDING_KRW) * SALARY_ROUNDING_KRW;
}

function safeMoneyKRW(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getStatsRecord(playerId) {
  const key = String(playerId ?? "");
  return key ? KBO_STATS_BY_PLAYER_ID.get(key) ?? null : null;
}

function estimateGameOverall(teamSeed, teamIndex, player, index, age, role, position) {
  const base = 52 + (teamSeed.baseOvr - 80) * 0.35;
  const statusPenalty = player.status === "futures" ? -6 : 0;
  const prime = role === "pitcher" ? 28 : 27;
  const primeBonus = Math.max(0, 7 - Math.abs(age - prime)) * 0.7;
  const positionBonus = ["C", "P"].includes(position) ? 1.2 : 0;
  const spread = seededNoise(index + 3, teamIndex + 7, teamSeed.baseOvr) * 18;
  return clamp(Math.round(base + statusPenalty + primeBonus + positionBonus + spread), 38, 88);
}

function normalizePosition(value, role) {
  const position = String(value ?? "").trim();
  if (!position || position === "투수") return role === "pitcher" ? "P" : "UT";
  if (position === "포수") return "C";
  if (position === "내야수") return "IF";
  if (position === "외야수") return "OF";
  return position;
}

function normalizeHand(value) {
  const hand = String(value ?? "").trim().toUpperCase();
  return ["L", "R", "S"].includes(hand) ? hand : "R";
}

function createSeasonStats() {
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

function rating(ovr, noise, weight) {
  return clamp(Math.round(4 + (ovr - 52) / 4.8 * weight + noise * 5), 1, 20);
}

function seededNoise(a, b, c) {
  const value = Math.sin(a * 92821 + b * 68917 + c * 31337) * 10000;
  return value - Math.floor(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
