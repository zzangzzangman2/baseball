import {
  ATTRIBUTE_CATEGORIES,
  COMMON_ATTRIBUTES,
  HITTER_ATTRIBUTES,
  PITCHER_ATTRIBUTES
} from "./ratings.js";

export const GAME_STATE_SCHEMA_VERSION = 2;

const EXPANSION_ATTRIBUTES = [
  { key: "framing", label: "포수 프레이밍", roles: ["hitter"], category: "technical" },
  { key: "blocking", label: "블로킹", roles: ["hitter"], category: "technical" },
  { key: "throwingAccuracy", label: "송구 정확도", roles: ["hitter"], category: "technical" },
  { key: "firstStep", label: "첫발 반응", roles: ["hitter"], category: "physical" },
  { key: "routeEfficiency", label: "타구 판단", roles: ["hitter"], category: "technical" },
  { key: "pitchCalling", label: "리드", roles: ["hitter"], category: "experience" },
  { key: "command", label: "코너워크", roles: ["pitcher"], category: "technical" },
  { key: "secondaryStuff", label: "변화구 완성도", roles: ["pitcher"], category: "technical" },
  { key: "deception", label: "디셉션", roles: ["pitcher"], category: "style" },
  { key: "pickoff", label: "견제", roles: ["pitcher"], category: "technical" },
  { key: "composure", label: "위기관리", roles: ["pitcher", "hitter"], category: "mental" },
  { key: "coachability", label: "코칭 수용", roles: ["pitcher", "hitter"], category: "mental" },
  { key: "mediaHandling", label: "미디어 대응", roles: ["pitcher", "hitter"], category: "mental" }
];

const ATTRIBUTE_LABELS = {
  conditionStability: "컨디션 안정",
  injuryResistance: "부상 저항",
  durability: "내구성",
  recovery: "회복력",
  ageResilience: "노쇠 저항",
  mentalToughness: "멘탈",
  clutch: "클러치",
  consistency: "기복 관리",
  workEthic: "훈련 태도",
  leadership: "리더십",
  adaptability: "적응력",
  teamwork: "팀워크",
  leagueExperience: "리그 경험",
  bigGameExperience: "큰 경기 경험",
  reputation: "평판",
  kboAdaptation: "KBO 적응",
  stuff: "구위",
  control: "제구",
  velocity: "구속",
  stamina: "스태미나",
  movement: "무브먼트",
  hrSuppression: "피홈런 억제",
  gbTendency: "땅볼 유도",
  repertoire: "구종 폭",
  pitchingIQ: "투구 지능",
  holdRunners: "주자 견제",
  fielding: "투수 수비",
  vsLHB: "좌타 상대",
  vsRHB: "우타 상대",
  contactL: "좌투 컨택",
  contactR: "우투 컨택",
  powerL: "좌투 파워",
  powerR: "우투 파워",
  eye: "선구안",
  situational: "상황 타격",
  battedBall: "타구 질",
  patience: "참을성",
  bunting: "번트",
  vsLHP: "좌투 상대",
  vsRHP: "우투 상대",
  defense: "수비",
  range: "수비 범위",
  arm: "송구",
  catching: "포수 수비",
  speed: "주력",
  stealing: "도루",
  baserunning: "주루"
};

export const ATTRIBUTE_DEFINITIONS = [
  ...COMMON_ATTRIBUTES.map((key) => makeAttributeDefinition(key, ["pitcher", "hitter"], "active")),
  ...PITCHER_ATTRIBUTES.map((key) => makeAttributeDefinition(key, ["pitcher"], "active")),
  ...HITTER_ATTRIBUTES.map((key) => makeAttributeDefinition(key, ["hitter"], "active")),
  ...EXPANSION_ATTRIBUTES.map((definition) => ({
    ...definition,
    status: "planned",
    scale: "1-20",
    migrationDefault: null
  }))
];

export function syncStateFoundation(state) {
  if (!state || typeof state !== "object") return state;

  state.schemaVersion = Math.max(safeNumber(state.schemaVersion, 0), GAME_STATE_SCHEMA_VERSION);
  state.attributeDefinitions = ATTRIBUTE_DEFINITIONS;
  state.teams = Array.isArray(state.teams) ? state.teams : [];

  const teamsById = {};
  const playersById = {};
  const contractsByPlayerId = {};
  const statsBySeason = state.statsBySeason && typeof state.statsBySeason === "object"
    ? { ...state.statsBySeason }
    : {};
  const rosterAssignments = [];
  const currentSeason = inferSeason(state);

  for (const team of state.teams) {
    const teamId = String(team?.id ?? "");
    if (!teamId) continue;

    teamsById[teamId] = {
      id: teamId,
      name: team.name ?? team.shortName ?? teamId,
      shortName: team.shortName ?? team.name ?? teamId,
      city: team.city ?? "",
      home: team.home ?? "",
      logo: team.logo ?? "",
      color: team.color ?? ""
    };

    for (const [index, player] of (team.roster ?? []).entries()) {
      const playerId = String(player?.id ?? "");
      if (!playerId) continue;

      player.teamId = player.teamId ?? teamId;
      playersById[playerId] = {
        id: playerId,
        playerId: player.playerId ?? "",
        name: player.name ?? "",
        role: player.role ?? "",
        position: player.position ?? "",
        teamId,
        status: player.status ?? "registered",
        ovr: safeNumber(player.ovr),
        pot: safeNumber(player.pot, player.ovr),
        source: player.source ?? ""
      };

      rosterAssignments.push({
        id: `assign-${teamId}-${playerId}`,
        playerId,
        teamId,
        rosterLevel: player.status === "futures" ? "futures" : "firstTeam",
        slot: index + 1,
        active: player.status !== "released",
        source: "teams.roster.sync"
      });

      if (player.contract && typeof player.contract === "object") {
        contractsByPlayerId[playerId] = player.contract;
      }

      statsBySeason[playerId] = {
        ...(statsBySeason[playerId] ?? {}),
        [currentSeason]: player.seasonStats ?? null
      };
    }
  }

  state.teamsById = teamsById;
  state.playersById = playersById;
  state.rosterAssignments = rosterAssignments;
  state.contractsByPlayerId = contractsByPlayerId;
  state.statsBySeason = statsBySeason;
  state.calendar = normalizeCalendar(state, currentSeason);
  state.financeLedger = normalizeFinanceLedger(state);
  state.budgetAllocation = normalizeBudgetAllocation(state);
  state.staff = normalizeStaff(state);
  state.scoutingReportsById = normalizeScoutingReports(state);
  state.leaguePoliciesByDate = normalizeLeaguePolicies(state);
  state.newsLog = normalizeNewsLog(state);
  state.stateIndexSummary = {
    teams: Object.keys(teamsById).length,
    players: Object.keys(playersById).length,
    rosterAssignments: rosterAssignments.length,
    contracts: Object.keys(contractsByPlayerId).length,
    statSeasons: Object.keys(statsBySeason).length,
    attributes: ATTRIBUTE_DEFINITIONS.length,
    activeAttributes: ATTRIBUTE_DEFINITIONS.filter((entry) => entry.status === "active").length,
    plannedAttributes: ATTRIBUTE_DEFINITIONS.filter((entry) => entry.status === "planned").length
  };

  return state;
}

export function appendFinanceLedger(state, entry) {
  if (!state || typeof state !== "object" || !entry) return state;
  state.financeLedger = normalizeFinanceLedger(state);
  const id = String(entry.id ?? "");
  if (id && state.financeLedger.some((item) => String(item.id) === id)) return state;
  state.financeLedger = [
    {
      id: id || `finance-${Date.now()}`,
      date: entry.date ?? state.currentDate ?? "",
      category: entry.category ?? "operation",
      type: entry.type ?? "expense",
      teamId: entry.teamId ?? "",
      counterpartyTeamId: entry.counterpartyTeamId ?? "",
      amountKRW: safeNumber(entry.amountKRW),
      description: entry.description ?? "",
      sourceEventId: entry.sourceEventId ?? "",
      status: entry.status ?? "booked"
    },
    ...state.financeLedger
  ].slice(0, 240);
  return state;
}

function makeAttributeDefinition(key, roles, status) {
  return {
    key,
    label: ATTRIBUTE_LABELS[key] ?? key,
    category: ATTRIBUTE_CATEGORIES[key] ?? "technical",
    roles,
    status,
    scale: "1-20",
    migrationDefault: 10
  };
}

function normalizeCalendar(state, currentSeason) {
  const calendar = state.calendar && typeof state.calendar === "object" ? state.calendar : {};
  return {
    season: safeNumber(calendar.season, currentSeason),
    source: calendar.source ?? "generated-kbo-calendar-v1",
    openingDay: calendar.openingDay ?? `${currentSeason}-03-28`,
    regularSeasonGames: safeNumber(calendar.regularSeasonGames, 720),
    currentDate: state.currentDate ?? `${currentSeason}-03-01`,
    phase: state.phase ?? "preseason"
  };
}

function normalizeFinanceLedger(state) {
  const existing = Array.isArray(state.financeLedger) ? state.financeLedger : [];
  if (existing.length > 0) return existing.slice(0, 240);

  return (state.teams ?? []).map((team) => ({
    id: `finance-opening-${team.id}`,
    date: state.currentDate ?? "",
    category: "opening-budget",
    type: "budget",
    teamId: team.id,
    counterpartyTeamId: "",
    amountKRW: safeNumber(team.budget) * 100_000_000,
    description: `${team.shortName ?? team.name} 운영 예산 편성`,
    sourceEventId: "",
    status: "booked"
  }));
}

function normalizeBudgetAllocation(state) {
  const existing = state.budgetAllocation && typeof state.budgetAllocation === "object" ? state.budgetAllocation : {};
  const result = { ...existing };

  for (const team of state.teams ?? []) {
    if (result[team.id]) continue;
    const budgetKRW = safeNumber(team.budget) * 100_000_000;
    result[team.id] = {
      teamId: team.id,
      playerPayrollKRW: safeNumber(team.payroll) * 100_000_000,
      scoutingKRW: Math.round(budgetKRW * 0.08),
      playerDevelopmentKRW: Math.round(budgetKRW * 0.12),
      medicalKRW: Math.round(budgetKRW * 0.07),
      reserveKRW: Math.round(budgetKRW * 0.18),
      source: "budget-allocation-v1"
    };
  }

  return result;
}

function normalizeStaff(state) {
  const existing = Array.isArray(state.staff) ? state.staff : [];
  if (existing.length > 0) return existing;

  const team = (state.teams ?? []).find((entry) => String(entry.id) === String(state.selectedTeamId)) ?? state.teams?.[0] ?? {};
  const manager = state.manager ?? {};
  const teamId = state.selectedTeamId ?? team.id ?? "";
  const managerName = manager.name || "임시 감독";

  return [
    makeStaff(teamId, "manager", managerName, "감독", 62, 58, 64),
    makeStaff(teamId, "bench", `${team.shortName ?? "구단"} 수석코치`, "수석코치", 56, 61, 58),
    makeStaff(teamId, "hitting", `${team.shortName ?? "구단"} 타격코치`, "타격코치", 54, 66, 52),
    makeStaff(teamId, "pitching", `${team.shortName ?? "구단"} 투수코치`, "투수코치", 65, 53, 57),
    makeStaff(teamId, "scouting", `${team.shortName ?? "구단"} 스카우트팀장`, "스카우트팀장", 58, 59, 63)
  ];
}

function makeStaff(teamId, id, name, role, pitching, hitting, scouting) {
  return {
    id: `staff-${teamId}-${id}`,
    teamId,
    name,
    role,
    contractStatus: "active",
    ability: {
      pitching,
      hitting,
      scouting,
      development: Math.round((pitching + hitting + scouting) / 3),
      medical: 52,
      morale: 60
    },
    source: "staff-v1-generated-role"
  };
}

function normalizeScoutingReports(state) {
  const existing = state.scoutingReportsById && typeof state.scoutingReportsById === "object" ? state.scoutingReportsById : {};
  const reports = { ...existing };
  const team = (state.teams ?? []).find((entry) => String(entry.id) === String(state.selectedTeamId)) ?? state.teams?.[0];
  const prospects = [...(team?.roster ?? [])]
    .filter((player) => safeNumber(player.pot, player.ovr) > safeNumber(player.ovr) && safeNumber(player.age, 99) <= 26)
    .sort((a, b) => safeNumber(b.pot, b.ovr) - safeNumber(a.pot, a.ovr))
    .slice(0, 6);

  for (const player of prospects) {
    const id = `scout-report-${player.id}`;
    if (reports[id]) continue;
    reports[id] = {
      id,
      playerId: player.id,
      teamId: player.teamId ?? team.id,
      date: state.currentDate ?? "",
      currentGrade: Math.round(safeNumber(player.ovr) / 2),
      futureGrade: Math.round(safeNumber(player.pot, player.ovr) / 2),
      uncertainty: Math.max(6, 28 - Math.max(0, safeNumber(player.pot, player.ovr) - safeNumber(player.ovr)) / 2),
      bias: "home-org",
      workloadHours: 6,
      source: "scouting-report-v1"
    };
  }

  return reports;
}

function normalizeLeaguePolicies(state) {
  const existing = Array.isArray(state.leaguePoliciesByDate) ? state.leaguePoliciesByDate : [];
  if (existing.length > 0) return existing;

  const season = inferSeason(state);
  return [
    {
      id: `policy-${season}-foreign-limit`,
      effectiveDate: `${season}-03-01`,
      category: "foreign-roster",
      title: "외국인 선수 등록/출전 제한",
      body: "3명 등록, 경기당 2명 출전 기준을 기본 운영 규정으로 적용합니다.",
      source: "league-policy-v1"
    },
    {
      id: `policy-${season}-option-lock`,
      effectiveDate: `${season}-03-01`,
      category: "roster-option",
      title: "1군 재등록 10일 제한",
      body: "말소 선수는 10일 경과 전 재등록 불가 경고 대상으로 관리합니다.",
      source: "league-policy-v1"
    }
  ];
}

function normalizeNewsLog(state) {
  const logs = Array.isArray(state.logs) ? state.logs : [];
  return logs.slice(0, 80).map((item, index) => {
    const log = typeof item === "string" ? { text: item } : item;
    return {
      id: log.id ?? `news-${index}`,
      date: log.date ?? state.currentDate ?? "",
      type: log.type ?? "note",
      source: log.source ?? log.tag ?? "프런트",
      headline: log.headline ?? log.title ?? log.text ?? "새 소식",
      body: log.body ?? log.message ?? log.text ?? "",
      eventId: log.eventId ?? ""
    };
  });
}

function inferSeason(state) {
  const year = Number(String(state?.currentDate ?? "").slice(0, 4));
  return Number.isFinite(year) ? year : 2026;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
