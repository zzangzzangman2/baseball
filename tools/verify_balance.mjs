import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createInitialState } from "../src/data.js";
import { simulateRegularSeason } from "../src/engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "balance.md");

const SOURCE_URL = "https://mykbostats.com/stats";
const RUN_LABELS = ["baseline", "repeat-a", "repeat-b"];
const TARGETS = [
  { key: "avg", label: "타율", target: 0.277, tolerance: 0.015, format: formatRate },
  { key: "era", label: "ERA", target: 4.94, tolerance: 0.70, format: formatDecimal },
  { key: "homeRunsPerGame", label: "경기당 홈런", target: 2.00, tolerance: 0.35, format: formatDecimal }
];

const runs = RUN_LABELS.map(runSimulation);
const aggregate = aggregateRuns(runs);
const targetRows = TARGETS.map((target) => {
  const actual = aggregate.averages[target.key];
  const delta = actual - target.target;
  return {
    ...target,
    actual,
    delta,
    min: Math.min(...runs.map((run) => run.metrics[target.key])),
    max: Math.max(...runs.map((run) => run.metrics[target.key])),
    pass: Math.abs(delta) <= target.tolerance
  };
});
const outlierReport = buildOutlierReport(runs[0].state);
const report = buildReport(runs, aggregate, targetRows, outlierReport);

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT_PATH, report, "utf8");
console.log(report);

if (targetRows.some((row) => !row.pass) || outlierReport.failures.length > 0) {
  process.exitCode = 1;
}

function runSimulation(label) {
  const state = createInitialState();
  state.rngSeed = `balance-${label}`;
  simulateRegularSeason(state);
  return {
    label,
    state,
    metrics: calculateMetrics(state)
  };
}

function calculateMetrics(simulatedState) {
  const players = simulatedState.teams.flatMap((team) => team.roster ?? []);
  const batting = aggregateBatting(players);
  const pitching = aggregatePitching(players);
  const games = Number(simulatedState.gamesPlayed) || 1;
  const teamGames = games * 2;
  const runs = simulatedState.teams.reduce((total, team) => total + safeNumber(team.runsFor), 0);

  return {
    phase: simulatedState.phase,
    games,
    teamGames,
    avg: divide(batting.hits, batting.atBats),
    obp: divide(batting.hits + batting.walks, batting.plateAppearances),
    slg: divide(batting.totalBases, batting.atBats),
    era: pitching.inningsOuts > 0 ? pitching.earnedRuns * 27 / pitching.inningsOuts : 0,
    runsPerTeamGame: divide(runs, teamGames),
    runsPerGame: divide(runs, games),
    homeRunsPerGame: divide(batting.homeRuns, games),
    totals: { batting, pitching, runs }
  };
}

function aggregateRuns(runResults) {
  const metricKeys = ["avg", "obp", "slg", "era", "runsPerTeamGame", "runsPerGame", "homeRunsPerGame"];
  const averages = Object.fromEntries(metricKeys.map((key) => [
    key,
    runResults.reduce((total, run) => total + safeNumber(run.metrics[key]), 0) / runResults.length
  ]));
  return { averages };
}

function aggregateBatting(players) {
  return players.reduce((total, player) => {
    const stats = player.seasonStats?.batting ?? {};
    total.plateAppearances += safeNumber(stats.plateAppearances);
    total.atBats += safeNumber(stats.atBats);
    total.hits += safeNumber(stats.hits);
    total.walks += safeNumber(stats.walks);
    total.totalBases += safeNumber(stats.totalBases);
    total.homeRuns += safeNumber(stats.homeRuns);
    total.rbi += safeNumber(stats.rbi);
    total.stolenBases += safeNumber(stats.stolenBases);
    return total;
  }, { plateAppearances: 0, atBats: 0, hits: 0, walks: 0, totalBases: 0, homeRuns: 0, rbi: 0, stolenBases: 0 });
}

function aggregatePitching(players) {
  return players.reduce((total, player) => {
    const stats = player.seasonStats?.pitching ?? {};
    total.inningsOuts += safeNumber(stats.inningsOuts);
    total.earnedRuns += safeNumber(stats.earnedRuns);
    total.runsAllowed += safeNumber(stats.runsAllowed);
    total.strikeouts += safeNumber(stats.strikeouts);
    total.walksAllowed += safeNumber(stats.walksAllowed);
    return total;
  }, { inningsOuts: 0, earnedRuns: 0, runsAllowed: 0, strikeouts: 0, walksAllowed: 0 });
}

function buildOutlierReport(state) {
  const teams = (state.teams ?? []).map((team) => {
    const games = Math.max(1, safeNumber(team.wins) + safeNumber(team.losses) + safeNumber(team.ties));
    return {
      name: team.name,
      wins: safeNumber(team.wins),
      losses: safeNumber(team.losses),
      pct: divide(team.wins, safeNumber(team.wins) + safeNumber(team.losses)),
      runsPerGame: divide(team.runsFor, games),
      runsAllowedPerGame: divide(team.runsAgainst, games),
      runDiff: safeNumber(team.runsFor) - safeNumber(team.runsAgainst)
    };
  });

  const hitters = [];
  const pitchers = [];
  for (const team of state.teams ?? []) {
    for (const player of team.roster ?? []) {
      if (player.role === "pitcher") {
        const stats = player.seasonStats?.pitching ?? {};
        const innings = safeNumber(stats.inningsOuts) / 3;
        if (innings >= 40) {
          pitchers.push({
            team: team.shortName ?? team.name,
            name: player.name,
            innings,
            era: stats.inningsOuts > 0 ? safeNumber(stats.earnedRuns) * 27 / safeNumber(stats.inningsOuts) : 0,
            strikeouts: safeNumber(stats.strikeouts),
            wins: safeNumber(stats.wins),
            saves: safeNumber(stats.saves)
          });
        }
      } else {
        const stats = player.seasonStats?.batting ?? {};
        if (safeNumber(stats.plateAppearances) >= 180) {
          const avg = divide(stats.hits, stats.atBats);
          const obp = divide(safeNumber(stats.hits) + safeNumber(stats.walks), stats.plateAppearances);
          const slg = divide(stats.totalBases, stats.atBats);
          hitters.push({
            team: team.shortName ?? team.name,
            name: player.name,
            plateAppearances: safeNumber(stats.plateAppearances),
            avg,
            ops: obp + slg,
            homeRuns: safeNumber(stats.homeRuns),
            rbi: safeNumber(stats.rbi),
            stolenBases: safeNumber(stats.stolenBases)
          });
        }
      }
    }
  }

  const topHitters = [...hitters].sort((a, b) => b.ops - a.ops).slice(0, 8);
  const topPower = [...hitters].sort((a, b) => b.homeRuns - a.homeRuns).slice(0, 5);
  const topPitchers = [...pitchers].sort((a, b) => a.era - b.era || b.innings - a.innings).slice(0, 8);
  const failures = [
    ...topHitters.filter((player) => player.ops >= 1.150).map((player) => `${player.name} OPS ${formatRate(player.ops)}`),
    ...topPower.filter((player) => player.homeRuns >= 58).map((player) => `${player.name} HR ${player.homeRuns}`),
    ...topPitchers.filter((player) => player.era <= 1.55 && player.innings >= 90).map((player) => `${player.name} ERA ${formatDecimal(player.era)}`),
    ...teams.filter((team) => team.wins >= 105 || team.wins <= 35).map((team) => `${team.name} ${team.wins}승/${team.losses}패`)
  ];

  return {
    teams: [...teams].sort((a, b) => b.wins - a.wins),
    topHitters,
    topPower,
    topPitchers,
    failures
  };
}

function buildReport(runResults, aggregate, targetRows, outliers) {
  const lines = [
    "# KBO Balance Verification",
    "",
    `- 실행 시각: ${new Date().toISOString()}`,
    `- 작업 폴더: ${ROOT_DIR}`,
    `- 기준 출처: 2024 KBO league summary, MyKBO Stats (${SOURCE_URL})`,
    `- 시뮬레이션: ${runResults.length}회, 각 ${runResults[0].metrics.games}/720경기 완료`,
    `- 종합 결과: ${targetRows.every((row) => row.pass) && outliers.failures.length === 0 ? "통과" : "실패"}`,
    "",
    "## 기준 대비",
    "",
    "| 항목 | 평균 | 범위 | 2024 KBO 기준 | 차이 | 허용 오차 | 결과 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...targetRows.map((row) => [
      row.label,
      row.format(row.actual),
      `${row.format(row.min)}~${row.format(row.max)}`,
      row.format(row.target),
      formatSigned(row.delta, row.format),
      row.format(row.tolerance),
      row.pass ? "PASS" : "FAIL"
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |")),
    "",
    "## 참고 지표",
    "",
    `- 출루율: ${formatRate(aggregate.averages.obp)}`,
    `- 장타율: ${formatRate(aggregate.averages.slg)}`,
    `- 팀당 득점: ${formatDecimal(aggregate.averages.runsPerTeamGame)}`,
    `- 경기당 득점 합계: ${formatDecimal(aggregate.averages.runsPerGame)}`,
    "",
    "## 팀 이상치",
    "",
    "| 팀 | 승 | 패 | 승률 | 득점/경기 | 실점/경기 | 득실 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...outliers.teams.map((team) => `| ${team.name} | ${team.wins} | ${team.losses} | ${formatRate(team.pct)} | ${formatDecimal(team.runsPerGame)} | ${formatDecimal(team.runsAllowedPerGame)} | ${formatInteger(team.runDiff)} |`),
    "",
    "## 선수 이상치",
    "",
    "### OPS 상위",
    "",
    ...outliers.topHitters.map((player) => `- ${player.team} ${player.name}: OPS ${formatRate(player.ops)}, AVG ${formatRate(player.avg)}, HR ${player.homeRuns}, RBI ${player.rbi}`),
    "",
    "### 홈런 상위",
    "",
    ...outliers.topPower.map((player) => `- ${player.team} ${player.name}: HR ${player.homeRuns}, OPS ${formatRate(player.ops)}`),
    "",
    "### ERA 상위",
    "",
    ...outliers.topPitchers.map((player) => `- ${player.team} ${player.name}: ERA ${formatDecimal(player.era)}, IP ${formatDecimal(player.innings)}, K ${player.strikeouts}`),
    "",
    "## 판정",
    "",
    outliers.failures.length
      ? `이상치 경고: ${outliers.failures.join(" / ")}`
      : "타율, ERA, 홈런 페이스가 허용 범위이며 OPS/홈런/ERA/팀 승수에서 과도한 괴물 시즌은 발견되지 않았다.",
    ""
  ];
  return lines.join("\n");
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function divide(numerator, denominator) {
  return safeNumber(denominator) > 0 ? safeNumber(numerator) / safeNumber(denominator) : 0;
}

function formatRate(value) {
  return Number(value).toFixed(3).replace(/^0/, "");
}

function formatDecimal(value) {
  return Number(value).toFixed(2);
}

function formatInteger(value) {
  return Math.round(Number(value)).toLocaleString("ko-KR");
}

function formatSigned(value, formatter) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${formatter(value)}`;
}
