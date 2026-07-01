const POSITION_GROUPS = [
  { key: "pitcher", label: "Pitching", positions: ["P", "SP", "RP", "CP"], target: 18 },
  { key: "catcher", label: "Catcher", positions: ["C"], target: 3 },
  { key: "infield", label: "Infield", positions: ["IF", "1B", "2B", "3B", "SS"], target: 10 },
  { key: "outfield", label: "Outfield", positions: ["OF", "LF", "CF", "RF"], target: 7 },
  { key: "utility", label: "Utility", positions: ["DH", "UT"], target: 0 }
];

const UNKNOWN_GROUP = { key: "other", label: "Other", positions: [], target: 0 };

/**
 * @returns {{teamId: string, teamName: string, totalPlayers: number, pitchers: number, hitters: number,
 * averageAge: number, averageOvr: number, averagePot: number, topPlayers: Array<object>, byPosition: Array<object>}}
 */
export function getRosterSummary(team) {
  const roster = normalizeRoster(team);
  const groups = buildDepthGroups(team);
  const pitchers = groups.find((group) => group.key === "pitcher")?.count ?? 0;
  const sortedByOvr = sortPlayers(roster, "ovr");

  return {
    teamId: String(team?.id ?? ""),
    teamName: getTeamName(team),
    totalPlayers: roster.length,
    pitchers,
    hitters: Math.max(0, roster.length - pitchers),
    averageAge: average(roster, "age"),
    averageOvr: average(roster, "ovr"),
    averagePot: average(roster, "pot"),
    topPlayers: sortedByOvr.slice(0, 5).map(toPlayerView),
    byPosition: buildPositionBreakdown(roster)
  };
}

/**
 * @returns {{teamId: string, teamName: string, needs: Array<object>, groups: Array<object>}}
 */
export function getDepthNeeds(team) {
  const groups = buildDepthGroups(team);
  const needs = groups
    .filter((group) => group.key !== "other" && group.target > 0 && group.severity > 0)
    .sort(compareNeeds)
    .slice(0, 5)
    .map(toNeedView);

  return {
    teamId: String(team?.id ?? ""),
    teamName: getTeamName(team),
    needs,
    groups: groups.map(toNeedView)
  };
}

/**
 * @returns {{teamId: string, teamName: string, candidateCount: number, averageUpside: number, players: Array<object>}}
 */
export function getProspectWatch(team) {
  const candidates = normalizeRoster(team)
    .map((player) => ({
      ...player,
      score: prospectScore(player),
      stage: prospectStage(player)
    }))
    .filter((player) => safeNumber(player.age) <= 25 || rating100(player.upside) >= 5)
    .sort(compareProspects);

  return {
    teamId: String(team?.id ?? ""),
    teamName: getTeamName(team),
    candidateCount: candidates.length,
    averageUpside: average(candidates, "upside"),
    players: candidates.slice(0, 12).map((player) => ({
      ...toPlayerView(player),
      score: round(player.score),
      stage: player.stage
    }))
  };
}

/**
 * @returns {{teamId: string, teamName: string, payroll: number, capacity: number, ratio: number,
 * pressureScore: number, level: string, room: number, rosterEfficiency: number}}
 */
export function getPayrollPressure(team) {
  const payroll = safeNumber(team?.payroll);
  const budget = safeNumber(team?.budget);
  const market = safeNumber(team?.market, 50);
  const fan = safeNumber(team?.fan, 50);
  const roster = normalizeRoster(team);
  const capacity = round(budget + market * 0.65 + fan * 0.35);
  const ratio = capacity > 0 ? payroll / capacity : 0;
  const averageOvr = average(roster, "ovr");

  return {
    teamId: String(team?.id ?? ""),
    teamName: getTeamName(team),
    payroll,
    capacity,
    ratio: round(ratio, 3),
    pressureScore: clamp(round(ratio * 100), 0, 150),
    level: payrollPressureLevel(ratio),
    room: round(capacity - payroll),
    rosterEfficiency: payroll > 0 ? round((rating100(averageOvr) / payroll) * 100, 2) : 0
  };
}

/**
 * @returns {{teamId: string, teamName: string, totalPayrollKRW: number, payrollHintKRW: number,
 * faSoonCount: number, foreignCount: number, militaryUnknownCount: number, topContracts: Array<object>,
 * faWatch: Array<object>, foreignPlayers: Array<object>, sourceCounts: Array<object>}}
 */
export function getContractSummary(team) {
  const roster = Array.isArray(team?.roster) ? team.roster : [];
  const contractPlayers = roster.map((player) => toContractPlayerView(player));
  const totalPayrollKRW = contractPlayers.reduce((total, entry) => total + safeNumber(entry.payrollAmountKRW), 0);
  const payrollHintKRW = safeNumber(team?.payroll) * 100000000;
  const faWatch = contractPlayers
    .filter((entry) => entry.faYearsUntilEligibility <= 1 || entry.faStatus === "eligibleAfterSeason")
    .sort(compareFaWatch)
    .slice(0, 6);
  const foreignPlayers = contractPlayers
    .filter((entry) => entry.isForeign)
    .sort((a, b) => safeNumber(b.payrollAmountKRW) - safeNumber(a.payrollAmountKRW) || compareText(a.name, b.name));
  const topContracts = [...contractPlayers]
    .sort((a, b) => safeNumber(b.payrollAmountKRW) - safeNumber(a.payrollAmountKRW) || compareText(a.name, b.name))
    .slice(0, 6);

  return {
    teamId: String(team?.id ?? ""),
    teamName: getTeamName(team),
    totalPayrollKRW,
    payrollHintKRW,
    payrollCoverageRatio: payrollHintKRW > 0 ? round(totalPayrollKRW / payrollHintKRW, 3) : 0,
    faSoonCount: faWatch.length,
    foreignCount: foreignPlayers.length,
    militaryUnknownCount: contractPlayers.filter((entry) => entry.militaryStatus === "unknown").length,
    topContracts,
    faWatch,
    foreignPlayers,
    sourceCounts: summarizeSourceKinds(contractPlayers.map((entry) => entry.sourceKind))
  };
}

/**
 * @returns {{teamId: string, teamName: string, needs: Array<object>, targets: Array<object>}}
 */
export function getScoutBoard(state, teamId) {
  const team = findTeam(state, teamId);
  if (!team) {
    return { teamId: String(teamId ?? ""), teamName: "", needs: [], targets: [] };
  }

  const needs = getDepthNeeds(team).needs;
  const needMap = new Map(buildDepthGroups(team).map((group) => [group.key, group]));
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  const targets = teams
    .filter((otherTeam) => String(otherTeam?.id ?? "") !== String(team.id ?? ""))
    .flatMap((otherTeam) => {
      return normalizeRoster(otherTeam).map((player) => {
        const need = needMap.get(player.groupKey) ?? UNKNOWN_GROUP;
        const score = scoutFitScore(player, need);
        return {
          teamId: String(otherTeam?.id ?? ""),
          teamName: getTeamName(otherTeam),
          player,
          group: player.groupKey,
          fit: scoutFitType(player, need),
          fitScore: round(score)
        };
      });
    })
    .sort(compareScoutTargets)
    .slice(0, 24)
    .map((target) => ({
      teamId: target.teamId,
      teamName: target.teamName,
      group: target.group,
      fit: target.fit,
      fitScore: target.fitScore,
      player: toPlayerView(target.player)
    }));

  return {
    teamId: String(team.id ?? ""),
    teamName: getTeamName(team),
    needs: needs.slice(0, 3),
    targets
  };
}

/**
 * @returns {{teamId: string, teamName: string, surplusGroups: Array<object>, players: Array<object>}}
 */
export function getTradeBlock(state, teamId) {
  const team = findTeam(state, teamId);
  if (!team) {
    return { teamId: String(teamId ?? ""), teamName: "", surplusGroups: [], players: [] };
  }

  const groups = buildDepthGroups(team);
  const groupMap = new Map(groups.map((group) => [group.key, group]));
  const rankedPlayers = rankPlayersByGroup(normalizeRoster(team));
  const surplusGroups = groups
    .filter((group) => group.key !== "other" && group.surplus > 0)
    .sort((a, b) => b.surplus - a.surplus || compareText(a.label, b.label))
    .map((group) => ({
      key: group.key,
      label: group.label,
      count: group.count,
      target: group.target,
      surplus: group.surplus
    }));

  const players = rankedPlayers
    .map((entry) => {
      const group = groupMap.get(entry.player.groupKey) ?? UNKNOWN_GROUP;
      return {
        ...entry,
        group,
        score: tradeBlockScore(entry.player, entry.depthRank, group),
        valueScore: tradeValueScore(entry.player)
      };
    })
    .filter((entry) => entry.group.surplus > 0 && entry.depthRank > Math.max(1, entry.group.target))
    .sort(compareTradeBlock)
    .slice(0, 16)
    .map((entry) => ({
      group: entry.group.key,
      depthRank: entry.depthRank,
      surplus: entry.group.surplus,
      reason: tradeBlockReason(entry.player, entry.depthRank, entry.group),
      blockScore: round(entry.score),
      valueScore: round(entry.valueScore),
      player: toPlayerView(entry.player)
    }));

  return {
    teamId: String(team.id ?? ""),
    teamName: getTeamName(team),
    surplusGroups,
    players
  };
}

function buildDepthGroups(team) {
  const roster = normalizeRoster(team);
  const groups = [...POSITION_GROUPS, UNKNOWN_GROUP].map((template) => {
    const players = roster.filter((player) => player.groupKey === template.key);
    const sorted = sortPlayers(players, "ovr");
    const topPlayers = sorted.slice(0, 3);
    const topAverageOvr = average(topPlayers, "ovr");
    const youngUpsideCount = players.filter((player) => safeNumber(player.age) <= 25 && rating100(player.upside) >= 3).length;
    const countGap = Math.max(0, template.target - players.length);
    const qualityGap = template.target > 0 ? Math.max(0, 60 - rating100(topAverageOvr)) : 0;
    const upsideGap = template.target > 0 ? Math.max(0, 2 - youngUpsideCount) : 0;
    const severity = round(countGap * 20 + qualityGap * 1.25 + upsideGap * 4);

    return {
      key: template.key,
      label: template.label,
      positions: template.positions,
      target: template.target,
      count: players.length,
      countGap,
      surplus: Math.max(0, players.length - template.target),
      averageAge: average(players, "age"),
      averageOvr: average(players, "ovr"),
      averagePot: average(players, "pot"),
      topAverageOvr,
      topPlayer: sorted[0] ? toPlayerView(sorted[0]) : null,
      topPlayers: topPlayers.map(toPlayerView),
      prospectCount: youngUpsideCount,
      severity,
      urgency: needUrgency(countGap, qualityGap, upsideGap)
    };
  });

  return groups.filter((group) => group.count > 0 || group.target > 0);
}

function buildPositionBreakdown(roster) {
  const byPosition = new Map();

  for (const player of roster) {
    const position = player.position;
    const players = byPosition.get(position) ?? [];
    players.push(player);
    byPosition.set(position, players);
  }

  return [...byPosition.entries()]
    .map(([position, players]) => {
      const sorted = sortPlayers(players, "ovr");
      return {
        position,
        count: players.length,
        averageAge: average(players, "age"),
        averageOvr: average(players, "ovr"),
        averagePot: average(players, "pot"),
        topPlayer: sorted[0] ? toPlayerView(sorted[0]) : null
      };
    })
    .sort((a, b) => b.count - a.count || compareText(a.position, b.position));
}

function normalizeRoster(team) {
  const roster = Array.isArray(team?.roster) ? team.roster : [];
  return roster
    .map((player, index) => normalizePlayer(player, index))
    .filter(Boolean);
}

function normalizePlayer(player, index) {
  const name = String(player?.name ?? "").trim();
  if (!name) return null;

  const position = normalizePosition(player?.position);
  const ovr = safeNumber(player?.ovr);
  const pot = Math.max(safeNumber(player?.pot, ovr), ovr);
  const age = safeNumber(player?.age);
  const group = getPositionGroup(position);

  return {
    id: String(player?.id ?? ""),
    name,
    position,
    age,
    ovr,
    pot,
    upside: Math.max(0, pot - ovr),
    groupKey: group.key,
    index
  };
}

function toContractPlayerView(player) {
  const contract = player?.contract ?? {};
  const salary = contract.salary ?? {};
  const faStatus = player?.faStatus ?? {};
  const militaryStatus = player?.militaryStatus ?? {};
  const foreignPlayer = player?.foreignPlayer ?? {};
  const compensationGrade = player?.compensationGrade ?? {};
  const serviceTime = player?.serviceTime ?? {};

  return {
    id: String(player?.id ?? ""),
    name: String(player?.name ?? ""),
    position: String(player?.position ?? ""),
    age: safeNumber(player?.age),
    ovr: safeNumber(player?.ovr),
    pot: safeNumber(player?.pot),
    contractId: String(contract.id ?? ""),
    contractStatus: String(contract.status ?? "unknown"),
    contractType: String(contract.type ?? "unknown"),
    startSeason: safeNumber(contract.startSeason),
    endSeason: safeNumber(contract.endSeason),
    salaryAmountKRW: safeNumber(salary.amountKRW),
    payrollAmountKRW: safeNumber(salary.payrollAmountKRW ?? salary.amountKRW),
    guaranteedAmountKRW: safeNumber(contract.guaranteedAmountKRW),
    sourceKind: String(contract.source?.kind ?? "unknown"),
    sourceConfidence: safeNumber(contract.source?.confidence),
    faStatus: String(faStatus.status ?? "unknown"),
    faYearsUntilEligibility: safeNumber(faStatus.yearsUntilEligibility, 99),
    eligibilitySeason: safeNumber(faStatus.eligibilitySeason),
    compensationGrade: String(compensationGrade.grade ?? faStatus.compensationGrade ?? "unknown"),
    militaryStatus: String(militaryStatus.status ?? "unknown"),
    militaryAvailability: String(militaryStatus.availability ?? "available"),
    isForeign: Boolean(foreignPlayer.isForeign),
    foreignRegistrationStatus: String(foreignPlayer.registrationStatus ?? "unknown"),
    foreignSlotType: String(foreignPlayer.slotType ?? "domestic"),
    foreignMarketTier: safeNumber(foreignPlayer.marketTier),
    serviceSeasons: safeNumber(serviceTime.seasonsAccrued),
    rookieEligible: Boolean(serviceTime.rookieEligible)
  };
}

function compareFaWatch(a, b) {
  const yearDiff = safeNumber(a.faYearsUntilEligibility, 99) - safeNumber(b.faYearsUntilEligibility, 99);
  if (yearDiff !== 0) return yearDiff;
  const salaryDiff = safeNumber(b.payrollAmountKRW) - safeNumber(a.payrollAmountKRW);
  if (salaryDiff !== 0) return salaryDiff;
  return compareText(a.name, b.name);
}

function summarizeSourceKinds(values) {
  const counts = new Map();
  for (const value of values) {
    const key = String(value ?? "unknown") || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .map(([kind, count]) => ({ kind, count }));
}

function normalizePosition(value) {
  return String(value ?? "").trim().toUpperCase() || "UT";
}

function getPositionGroup(position) {
  return POSITION_GROUPS.find((group) => group.positions.includes(position)) ?? UNKNOWN_GROUP;
}

function toPlayerView(player) {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    age: player.age,
    ovr: player.ovr,
    pot: player.pot,
    upside: player.upside
  };
}

function toNeedView(group) {
  return {
    key: group.key,
    label: group.label,
    positions: group.positions,
    count: group.count,
    target: group.target,
    countGap: group.countGap,
    surplus: group.surplus,
    averageAge: group.averageAge,
    averageOvr: group.averageOvr,
    averagePot: group.averagePot,
    topAverageOvr: group.topAverageOvr,
    topPlayer: group.topPlayer,
    prospectCount: group.prospectCount,
    severity: group.severity,
    urgency: group.urgency
  };
}

function rankPlayersByGroup(roster) {
  const groups = new Map();

  for (const player of roster) {
    const players = groups.get(player.groupKey) ?? [];
    players.push(player);
    groups.set(player.groupKey, players);
  }

  return [...groups.values()].flatMap((players) => {
    return sortPlayers(players, "ovr").map((player, index) => ({
      player,
      depthRank: index + 1
    }));
  });
}

function sortPlayers(players, primaryKey) {
  return [...players].sort((a, b) => comparePlayers(a, b, primaryKey));
}

function prospectScore(player) {
  const youth = Math.max(0, 28 - safeNumber(player.age));
  return rating100(player.pot) * 0.75 + rating100(player.upside) * 4 + youth * 1.6 + rating100(player.ovr) * 0.25;
}

function prospectStage(player) {
  if (rating100(player.ovr) >= 65 && player.age <= 25) return "near_ready";
  if (player.age <= 22 && rating100(player.upside) >= 6) return "development";
  if (rating100(player.upside) >= 8) return "high_upside";
  return "follow";
}

function scoutFitScore(player, need) {
  const needBonus = safeNumber(need.severity) * 1.35 + safeNumber(need.countGap) * 10;
  const youth = Math.max(0, 27 - safeNumber(player.age));
  return rating100(player.ovr) * 1.2 + rating100(player.pot) * 0.45 + rating100(player.upside) * 2.2 + youth + needBonus;
}

function scoutFitType(player, need) {
  if (safeNumber(need.countGap) > 0 || safeNumber(need.severity) >= 15) return "priority_need";
  if (rating100(player.upside) >= 7 && safeNumber(player.age) <= 25) return "prospect_fit";
  return "talent_upgrade";
}

function tradeBlockScore(player, depthRank, group) {
  const blockedDepth = Math.max(0, depthRank - safeNumber(group.target));
  const limitedGrowth = Math.max(0, 5 - rating100(player.upside));
  const veteranDepth = safeNumber(player.age) >= 30 ? 6 : 0;
  return safeNumber(group.surplus) * 9 + blockedDepth * 7 + limitedGrowth * 2 + veteranDepth + tradeValueScore(player) * 0.12;
}

function tradeValueScore(player) {
  const youth = Math.max(0, 28 - safeNumber(player.age));
  return rating100(player.ovr) * 0.9 + rating100(player.pot) * 0.45 + rating100(player.upside) * 1.5 + youth;
}

function tradeBlockReason(player, depthRank, group) {
  if (safeNumber(player.age) <= 25 && depthRank > safeNumber(group.target)) return "blocked_prospect";
  if (safeNumber(player.age) >= 30 && rating100(player.upside) <= 2) return "veteran_depth";
  return "surplus_depth";
}

function compareNeeds(a, b) {
  const severityDiff = b.severity - a.severity;
  if (severityDiff !== 0) return severityDiff;
  return compareText(a.label, b.label);
}

function compareProspects(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  return comparePlayers(a, b, "pot");
}

function compareScoutTargets(a, b) {
  const scoreDiff = b.fitScore - a.fitScore;
  if (scoreDiff !== 0) return scoreDiff;
  const playerDiff = comparePlayers(a.player, b.player, "ovr");
  if (playerDiff !== 0) return playerDiff;
  return compareText(a.teamName, b.teamName);
}

function compareTradeBlock(a, b) {
  const scoreDiff = b.score - a.score;
  if (scoreDiff !== 0) return scoreDiff;
  const rankDiff = b.depthRank - a.depthRank;
  if (rankDiff !== 0) return rankDiff;
  return compareText(a.player.name, b.player.name);
}

function comparePlayers(a, b, primaryKey) {
  const primaryDiff = safeNumber(b[primaryKey]) - safeNumber(a[primaryKey]);
  if (primaryDiff !== 0) return primaryDiff;
  const potDiff = safeNumber(b.pot) - safeNumber(a.pot);
  if (potDiff !== 0) return potDiff;
  const ageDiff = safeNumber(a.age) - safeNumber(b.age);
  if (ageDiff !== 0) return ageDiff;
  const nameDiff = compareText(a.name, b.name);
  if (nameDiff !== 0) return nameDiff;
  return safeNumber(a.index) - safeNumber(b.index);
}

function needUrgency(countGap, qualityGap, upsideGap) {
  if (countGap > 0 || qualityGap >= 8) return "high";
  if (qualityGap >= 4 || upsideGap > 0) return "medium";
  return "low";
}

function payrollPressureLevel(ratio) {
  if (ratio >= 1.15) return "critical";
  if (ratio >= 1) return "high";
  if (ratio >= 0.88) return "medium";
  return "low";
}

function findTeam(state, teamId) {
  const teams = Array.isArray(state?.teams) ? state.teams : [];
  const id = teamId ?? state?.selectedTeamId;
  if (id == null) return null;
  return teams.find((team) => String(team?.id ?? "") === String(id)) ?? null;
}

function getTeamName(team) {
  return String(team?.name ?? team?.shortName ?? team?.id ?? "");
}

function average(items, key) {
  if (!items.length) return 0;
  return round(items.reduce((total, item) => total + safeNumber(item[key]), 0) / items.length);
}

function rating100(value) {
  return safeNumber(value) / 2;
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

function compareText(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
