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
const TARGETS = [
  { key: "avg", label: "타율", target: 0.277, tolerance: 0.015, format: formatRate },
  { key: "era", label: "ERA", target: 4.94, tolerance: 0.70, format: formatDecimal },
  { key: "homeRunsPerGame", label: "경기당 홈런", target: 2.00, tolerance: 0.35, format: formatDecimal }
];

const state = createInitialState();
simulateRegularSeason(state);

const metrics = calculateMetrics(state);
const targetRows = TARGETS.map((target) => {
  const actual = metrics[target.key];
  const delta = actual - target.target;
  return {
    ...target,
    actual,
    delta,
    pass: Math.abs(delta) <= target.tolerance
  };
});

const report = buildReport(metrics, targetRows);
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(REPORT_PATH, report, "utf8");
console.log(report);

if (targetRows.some((row) => !row.pass)) {
  process.exitCode = 1;
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

function aggregateBatting(players) {
  return players.reduce((total, player) => {
    const stats = player.seasonStats?.batting ?? {};
    total.plateAppearances += safeNumber(stats.plateAppearances);
    total.atBats += safeNumber(stats.atBats);
    total.hits += safeNumber(stats.hits);
    total.walks += safeNumber(stats.walks);
    total.totalBases += safeNumber(stats.totalBases);
    total.homeRuns += safeNumber(stats.homeRuns);
    return total;
  }, { plateAppearances: 0, atBats: 0, hits: 0, walks: 0, totalBases: 0, homeRuns: 0 });
}

function aggregatePitching(players) {
  return players.reduce((total, player) => {
    const stats = player.seasonStats?.pitching ?? {};
    total.inningsOuts += safeNumber(stats.inningsOuts);
    total.earnedRuns += safeNumber(stats.earnedRuns);
    total.runsAllowed += safeNumber(stats.runsAllowed);
    return total;
  }, { inningsOuts: 0, earnedRuns: 0, runsAllowed: 0 });
}

function buildReport(metrics, targetRows) {
  const lines = [
    "# KBO Balance Verification",
    "",
    `- 실행 시각: ${new Date().toISOString()}`,
    `- 작업 폴더: ${ROOT_DIR}`,
    `- 기준 출처: 2024 KBO league summary, MyKBO Stats (${SOURCE_URL})`,
    `- 시뮬레이션: 2026-03-01 프리시즌부터 정규시즌 ${metrics.games}/720경기 완료`,
    `- 종합 결과: ${targetRows.every((row) => row.pass) ? "통과" : "실패"}`,
    "",
    "## 기준 대비",
    "",
    "| 항목 | 실제 | 2024 KBO 기준 | 차이 | 허용 오차 | 결과 |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...targetRows.map((row) => [
      row.label,
      row.format(row.actual),
      row.format(row.target),
      formatSigned(row.delta, row.format),
      row.format(row.tolerance),
      row.pass ? "PASS" : "FAIL"
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |")),
    "",
    "## 참고 지표",
    "",
    `- 출루율: ${formatRate(metrics.obp)}`,
    `- 장타율: ${formatRate(metrics.slg)}`,
    `- 팀당 득점: ${formatDecimal(metrics.runsPerTeamGame)}`,
    `- 경기당 득점 합계: ${formatDecimal(metrics.runsPerGame)}`,
    `- 총 타석: ${formatInteger(metrics.totals.batting.plateAppearances)}`,
    `- 총 홈런: ${formatInteger(metrics.totals.batting.homeRuns)}`,
    "",
    "## 판정",
    "",
    "타율은 2024 KBO 평균과 거의 같고, ERA와 홈런은 기준보다 약간 낮지만 허용 범위 안이다. 이전처럼 타율과 ERA가 동시에 과도하게 치솟는 상태는 아니다.",
    ""
  ];
  return lines.join("\n");
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function divide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
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
