import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const REPORT_DIR = path.join(ROOT_DIR, "reports");
const REPORT_PATH = path.join(REPORT_DIR, "verification.md");

const MODULE_PATHS = {
  data: path.join(SRC_DIR, "data.js"),
  engine: path.join(SRC_DIR, "engine.js"),
  ui: path.join(SRC_DIR, "ui.js"),
  main: path.join(SRC_DIR, "main.js"),
  rosters: path.join(SRC_DIR, "rosters", "index.js"),
  ratings: path.join(SRC_DIR, "ratings.js"),
  systems: path.join(SRC_DIR, "systems.js"),
  frontOffice: path.join(SRC_DIR, "frontOffice.js"),
  save: path.join(SRC_DIR, "save.js")
};

const EXPECTED_TEAM_NAMES = [
  "LG 트윈스",
  "두산 베어스",
  "KIA 타이거즈",
  "삼성 라이온즈",
  "롯데 자이언츠",
  "한화 이글스",
  "SSG 랜더스",
  "KT 위즈",
  "NC 다이노스",
  "키움 히어로즈"
];

const REQUIRED_PLAYER_KEYS = [
  "id",
  "name",
  "age",
  "role",
  "position",
  "bats",
  "throws",
  "ovr",
  "pot",
  "seasonStats",
  "fatigue",
  "form",
  "injuredDays",
  "contact",
  "power",
  "eye",
  "speed",
  "defense",
  "stuff",
  "control",
  "stamina",
  "movement"
];

const NUMERIC_PLAYER_KEYS = [
  "age",
  "ovr",
  "pot",
  "fatigue",
  "form",
  "injuredDays",
  "contact",
  "power",
  "eye",
  "speed",
  "defense",
  "stuff",
  "control",
  "stamina",
  "movement"
];

const OVERALL_PLAYER_KEYS = ["ovr", "pot"];
const OVERALL_MIN = 0;
const OVERALL_MAX = 200;
const ABILITY_MIN = 1;
const ABILITY_MAX = 20;
const OFFICIAL_KBO_RATING_SOURCE_MIN = 500;

const BUSINESS_PLAYER_KEYS = [
  "contract",
  "faStatus",
  "militaryStatus",
  "foreignPlayer",
  "serviceTime",
  "compensationGrade"
];

const SOURCE_KINDS = ["official", "reported", "estimated", "fallback", "unknown"];
const CONTRACT_STATUSES = ["active", "expired", "terminated", "reserved", "pending"];
const CONTRACT_TYPES = ["standard", "fa", "rookie", "foreign", "development", "militaryHold"];
const FA_STATUSES = ["notEligible", "eligibleAfterSeason", "filed", "market", "signed", "compensationPending", "compensationComplete"];
const MILITARY_STATUSES = ["notSubject", "notServed", "serving", "completed", "exempt", "deferred", "unknown"];
const FOREIGN_REGISTRATION_STATUSES = ["notForeign", "registered", "candidate", "released", "negotiating", "unavailable"];
const COMPENSATION_GRADES = ["A", "B", "C", "none", "unknown"];

const BATTING_STAT_KEYS = [
  "games",
  "plateAppearances",
  "atBats",
  "runs",
  "hits",
  "doubles",
  "triples",
  "homeRuns",
  "rbi",
  "walks",
  "strikeouts",
  "stolenBases",
  "caughtStealing",
  "totalBases"
];

const PITCHING_STAT_KEYS = [
  "games",
  "gamesStarted",
  "wins",
  "losses",
  "saves",
  "holds",
  "blownSaves",
  "inningsOuts",
  "battersFaced",
  "hitsAllowed",
  "runsAllowed",
  "earnedRuns",
  "homeRunsAllowed",
  "walksAllowed",
  "strikeouts",
  "pitches"
];

const FIELDING_STAT_KEYS = ["games", "errors"];

const COMPAT_ALIAS_RATING_FIELDS = [
  "contact",
  "power",
  "eye",
  "speed",
  "defense",
  "stuff",
  "control",
  "stamina",
  "movement"
];

const COMMON_RATING_FIELDS = [
  "conditionStability",
  "injuryResistance",
  "durability",
  "recovery",
  "ageResilience",
  "mentalToughness",
  "clutch",
  "consistency",
  "workEthic",
  "leadership",
  "adaptability",
  "teamwork",
  "leagueExperience",
  "bigGameExperience",
  "reputation",
  "kboAdaptation"
];

const PITCHER_RATING_FIELDS = [
  "stuff",
  "control",
  "velocity",
  "stamina",
  "movement",
  "hrSuppression",
  "gbTendency",
  "repertoire",
  "pitchingIQ",
  "holdRunners",
  "fielding",
  "vsLHB",
  "vsRHB"
];

const HITTER_RATING_FIELDS = [
  "contactL",
  "contactR",
  "powerL",
  "powerR",
  "eye",
  "situational",
  "battedBall",
  "patience",
  "bunting",
  "vsLHP",
  "vsRHP",
  "defense",
  "range",
  "arm",
  "catching",
  "speed",
  "stealing",
  "baserunning"
];

const ROLE_RATING_FIELDS = {
  pitcher: PITCHER_RATING_FIELDS,
  hitter: HITTER_RATING_FIELDS
};

const SOURCE_FAKE_PATTERNS = [
  {
    label: "old name pool",
    regex: /\b(firstNames|lastNames|namePool|sampleNames|fakeNames)\b/i
  },
  {
    label: "random/fake name generator",
    regex: /\b(randomName|generateName|fakePlayer|createFake|dummyPlayer|samplePlayer)\b/i
  },
  {
    label: "placeholder Korean player name",
    regex: /(홍길동|김철수|이영희|박영수|가상선수|테스트선수|샘플선수|무명선수)/
  }
];

const PLAYER_FAKE_NAME_PATTERN =
  /^(?:홍길동|김철수|이영희|박영수|John Doe|Jane Doe|Player\s*\d+|Test Player|Sample Player|Dummy Player|Fake Player|가상선수|테스트선수|샘플선수|무명선수)$/i;

const warnings = [];
const results = [];
let dataModule;
let engineModule;
let rostersModule;
let ratingsModule;
let systemsModule;
let frontOfficeModule;
let saveModule;
let initialState;

process.on("warning", (warning) => {
  warnings.push(`${warning.code ?? warning.name}: ${warning.message}`);
});

class VerificationError extends Error {
  constructor(message, location) {
    super(message);
    this.name = "VerificationError";
    this.location = location;
  }
}

async function main() {
  await runCheck("ESM 모듈 import 및 핵심 export", checkModuleImports);
  await runCheck("createInitialState 실행", checkCreateInitialState);
  await runCheck("팀 10개", checkTeamCount);
  await runCheck("팀명 실제 KBO명", checkTeamNames);
  await runCheck("총 선수 수", checkPlayerTotal);
  await runCheck("각 선수 필수 키", checkRequiredPlayerKeys);
  await runCheck("FMKorea 능력치 필드", checkRatingFieldSchema);
  await runCheck("계약/FA/병역/외국인 schema", checkBusinessPlayerSchema);
  await runCheck("공식 KBO ratingSource 최소 500명", checkOfficialKboRatingSources);
  await runCheck("ratings.js validateRatingWeights optional 실행", checkValidateRatingWeights);
  await runCheck("영문-only 선수명 없음", checkNoEnglishOnlyNames);
  await runCheck("가짜 이름 생성 잔재 없음", checkNoFakeNameResidue);
  await runCheck("개막 라인업 active 로스터 검증", checkOpeningLineupActiveRoster);
  await runCheck("simulateDay 실행 및 하루 5경기", checkSimulateDay);
  await runCheck("선수 누적 기록 모델", checkPlayerSeasonStats);
  await runCheck("경기 박스스코어/eventLog", checkGameBoxScoreEventLog);
  await runCheck("로테이션/불펜 운용 snapshot", checkPitchingSnapshotUsage);
  await runCheck("simulateDays 실행", checkSimulateDays);
  await runCheck("simulateRegularSeason 종료 상태", checkSimulateRegularSeason);
  await runCheck("포스트시즌/시상식 자동 생성", checkPostseasonAwards);
  await runCheck("신인 드래프트 v1", checkDraftSystem);
  await runCheck("2차 드래프트 v1", checkSecondaryDraftSystem);
  await runCheck("트레이드 v2 command", checkTradeCommand);
  await runCheck("트레이드 안전 게이트 23케이스", checkTradeSafetyGate);
  await runCheck("FA/외국인 시장 command", checkFreeAgencyMarket);
  await runCheck("자동 오프시즌/시즌 롤오버", checkAutonomousOffseasonRollover);
  await runCheck("프런트오피스 selector 실행", checkSystemsSelectors);
  await runCheck("GM 데스크 데이터 실행", checkFrontOfficeData);
  await runCheck("JSON 저장 roundtrip", checkSaveRoundtrip);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const report = buildReport();
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf8");

  console.log(report);

  if (results.some((result) => result.status === "FAIL")) {
    process.exitCode = 1;
  }
}

async function runCheck(name, checker) {
  try {
    const detail = await checker();
    results.push({
      name,
      status: "PASS",
      detail: detail || "정상",
      location: ""
    });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      detail: error?.message ?? String(error),
      location: error?.location ?? guessLocation(name)
    });
  }
}

async function checkModuleImports() {
  dataModule = await importModule(MODULE_PATHS.data);
  engineModule = await importModule(MODULE_PATHS.engine);
  rostersModule = await importModule(MODULE_PATHS.rosters);
  systemsModule = await importModule(MODULE_PATHS.systems);
  frontOfficeModule = await importModule(MODULE_PATHS.frontOffice);
  saveModule = await importModule(MODULE_PATHS.save);
  const uiModule = await importModule(MODULE_PATHS.ui);

  assertExport(dataModule, "createInitialState", MODULE_PATHS.data);
  assertExport(engineModule, "simulateDay", MODULE_PATHS.engine);
  assertExport(engineModule, "simulateDays", MODULE_PATHS.engine);
  assertExport(engineModule, "simulateRegularSeason", MODULE_PATHS.engine);
  assertExport(engineModule, "initializePostseason", MODULE_PATHS.engine);
  assertExport(engineModule, "simulatePostseason", MODULE_PATHS.engine);
  assertExport(engineModule, "initializeDraft", MODULE_PATHS.engine);
  assertExport(engineModule, "simulateDraft", MODULE_PATHS.engine);
  assertExport(engineModule, "initializeSecondaryDraft", MODULE_PATHS.engine);
  assertExport(engineModule, "simulateSecondaryDraft", MODULE_PATHS.engine);
  assertExport(engineModule, "initializeFreeAgency", MODULE_PATHS.engine);
  assertExport(engineModule, "commitFreeAgentSigning", MODULE_PATHS.engine);
  assertExport(engineModule, "commitForeignPlayerSigning", MODULE_PATHS.engine);
  assertExport(engineModule, "commitTradeProposal", MODULE_PATHS.engine);
  assertExport(engineModule, "runAutonomousOffseason", MODULE_PATHS.engine);
  assertExport(engineModule, "advanceSeason", MODULE_PATHS.engine);
  assertExport(engineModule, "advanceToNextSeason", MODULE_PATHS.engine);
  assertExport(engineModule, "buildLineup", MODULE_PATHS.engine);
  assertExport(engineModule, "buildPitchingSnapshot", MODULE_PATHS.engine);
  assertExport(uiModule, "mountApp", MODULE_PATHS.ui);
  assertExport(systemsModule, "getRosterSummary", MODULE_PATHS.systems);
  assertExport(systemsModule, "getContractSummary", MODULE_PATHS.systems);
  assertExport(systemsModule, "getScoutBoard", MODULE_PATHS.systems);
  assertExport(frontOfficeModule, "buildTradeMarket", MODULE_PATHS.frontOffice);
  assertExport(frontOfficeModule, "buildScoutAssignments", MODULE_PATHS.frontOffice);
  assertExport(frontOfficeModule, "buildFrontOfficeInbox", MODULE_PATHS.frontOffice);
  assertExport(saveModule, "exportGameState", MODULE_PATHS.save);
  assertExport(saveModule, "importGameState", MODULE_PATHS.save);

  const fakeRoot = createFakeRoot();
  const hadDocument = Object.prototype.hasOwnProperty.call(globalThis, "document");
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById(id) {
      return id === "app" ? fakeRoot : null;
    }
  };

  try {
    await import(`${pathToFileURL(MODULE_PATHS.main).href}?verify=${Date.now()}`);
  } finally {
    if (hadDocument) {
      globalThis.document = previousDocument;
    } else {
      delete globalThis.document;
    }
  }

  assert(
    fakeRoot.innerHTML.includes("KBO GM"),
    "main.js import 후 앱 루트 렌더링 흔적을 찾지 못했습니다.",
    MODULE_PATHS.main
  );

  return "src/data.js, src/engine.js, src/rosters/index.js, src/ui.js, src/main.js, src/systems.js, src/frontOffice.js, src/save.js import 완료";
}

function checkCreateInitialState() {
  ensureImportsReady();
  initialState = dataModule.createInitialState();
  assert(initialState && typeof initialState === "object", "초기 상태 객체가 생성되지 않았습니다.", MODULE_PATHS.data);
  assert(Array.isArray(initialState.teams), "초기 상태의 teams가 배열이 아닙니다.", MODULE_PATHS.data);
  assert(Array.isArray(initialState.eventLog), "초기 상태의 eventLog가 배열이 아닙니다.", MODULE_PATHS.data);
  return `초기 날짜 ${initialState.currentDate}, 팀 ${initialState.teams.length}개`;
}

function checkTeamCount() {
  ensureStateReady();
  assert(initialState.teams.length === 10, `팀 수가 10개가 아닙니다: ${initialState.teams.length}개`, MODULE_PATHS.data);
  return "10개 구단 확인";
}

function checkTeamNames() {
  ensureStateReady();
  const actualNames = new Set(initialState.teams.map((team) => team.name));
  const missing = EXPECTED_TEAM_NAMES.filter((name) => !actualNames.has(name));
  const unexpected = [...actualNames].filter((name) => !EXPECTED_TEAM_NAMES.includes(name));

  assert(
    missing.length === 0 && unexpected.length === 0,
    `팀명 불일치. 누락: ${missing.join(", ") || "없음"} / 예상 외: ${unexpected.join(", ") || "없음"}`,
    MODULE_PATHS.data
  );

  return EXPECTED_TEAM_NAMES.join(", ");
}

function checkPlayerTotal() {
  ensureStateReady();
  const actualTotal = allPlayers(initialState).length;
  const expectedPerTeam = Object.fromEntries(
    Object.entries(rostersModule.TEAM_ROSTERS).map(([teamId, roster]) => [
      teamId,
      roster.filter((player) => player?.name && player?.role).length
    ])
  );
  const expectedTotal = Object.values(expectedPerTeam).reduce((total, count) => total + count, 0);

  const perTeamMismatches = initialState.teams
    .map((team) => {
      const expected = expectedPerTeam[team.id] ?? 0;
      const actual = team.roster.length;
      return actual === expected ? null : `${team.id}: ${actual}/${expected}`;
    })
    .filter(Boolean);

  assert(actualTotal > 0, "선수 수가 0명입니다.", MODULE_PATHS.data);
  assert(
    actualTotal === expectedTotal && perTeamMismatches.length === 0,
    `생성된 선수 수가 로스터 원본과 다릅니다. 총 ${actualTotal}/${expectedTotal}, 팀별 ${perTeamMismatches.join(", ")}`,
    MODULE_PATHS.data
  );

  const perTeamSummary = initialState.teams.map((team) => `${team.shortName}:${team.roster.length}`).join(", ");
  return `총 ${actualTotal}명 (${perTeamSummary})`;
}

function checkRequiredPlayerKeys() {
  ensureStateReady();
  const problems = [];

  for (const { team, player } of allPlayers(initialState)) {
    const missing = REQUIRED_PLAYER_KEYS.filter((key) => !Object.hasOwn(player, key));
    const badNumbers = NUMERIC_PLAYER_KEYS.filter((key) => !Number.isFinite(Number(player[key])));
    const badOverallRanges = OVERALL_PLAYER_KEYS.filter(
      (key) => Object.hasOwn(player, key) &&
        Number.isFinite(Number(player[key])) &&
        !isNumberInRange(player[key], OVERALL_MIN, OVERALL_MAX)
    );

    if (missing.length > 0) {
      problems.push(`${team.id}/${player.name ?? player.id}: 누락 ${missing.join(", ")}`);
    }
    if (!String(player.name ?? "").trim()) {
      problems.push(`${team.id}/${player.id}: name 비어 있음`);
    }
    if (!["hitter", "pitcher"].includes(player.role)) {
      problems.push(`${team.id}/${player.name ?? player.id}: role=${player.role}`);
    }
    if (!String(player.position ?? "").trim()) {
      problems.push(`${team.id}/${player.name ?? player.id}: position 비어 있음`);
    }
    if (!String(player.throws ?? "").trim()) {
      problems.push(`${team.id}/${player.name ?? player.id}: throws 비어 있음`);
    }
    if (badNumbers.length > 0) {
      problems.push(`${team.id}/${player.name ?? player.id}: 숫자 아님 ${badNumbers.join(", ")}`);
    }
    if (badOverallRanges.length > 0) {
      problems.push(
        `${team.id}/${player.name ?? player.id}: OVR/POT ${OVERALL_MIN}-${OVERALL_MAX} 범위 아님 ${badOverallRanges.join(", ")}`
      );
    }
  }

  assert(
    problems.length === 0,
    `필수 키/값 오류 ${problems.length}건. 예: ${problems.slice(0, 5).join(" / ")}`,
    MODULE_PATHS.data
  );

  return `${allPlayers(initialState).length}명 모두 필수 키 ${REQUIRED_PLAYER_KEYS.length}개 보유, OVR/POT ${OVERALL_MIN}-${OVERALL_MAX} 범위`;
}

function checkRatingFieldSchema() {
  ensureStateReady();
  const problems = [];
  const roleCounts = { pitcher: 0, hitter: 0 };

  for (const { team, player } of allPlayers(initialState)) {
    const roleFields = ROLE_RATING_FIELDS[player.role] ?? [];
    const expectedFields = unique([
      ...COMMON_RATING_FIELDS,
      ...roleFields,
      ...COMPAT_ALIAS_RATING_FIELDS
    ]);
    const missing = expectedFields.filter((key) => !Object.hasOwn(player, key));
    const badNumbers = expectedFields.filter((key) => Object.hasOwn(player, key) && !Number.isFinite(Number(player[key])));
    const outOfRange = expectedFields.filter(
      (key) => Object.hasOwn(player, key) &&
        Number.isFinite(Number(player[key])) &&
        !isNumberInRange(player[key], ABILITY_MIN, ABILITY_MAX)
    );

    if (Object.hasOwn(roleCounts, player.role)) {
      roleCounts[player.role] += 1;
    }
    if (missing.length > 0) {
      problems.push(`${team.id}/${player.name ?? player.id}: 능력치 누락 ${missing.join(", ")}`);
    }
    if (badNumbers.length > 0) {
      problems.push(`${team.id}/${player.name ?? player.id}: 능력치 숫자 아님 ${badNumbers.join(", ")}`);
    }
    if (outOfRange.length > 0) {
      problems.push(
        `${team.id}/${player.name ?? player.id}: 능력치 ${ABILITY_MIN}-${ABILITY_MAX} 범위 아님 ${outOfRange.join(", ")}`
      );
    }
  }

  assert(
    problems.length === 0,
    `FMKorea 능력치 필드 오류 ${problems.length}건. 예: ${problems.slice(0, 5).join(" / ")}`,
    MODULE_PATHS.data
  );

  return [
    `${allPlayers(initialState).length}명 공통 ${COMMON_RATING_FIELDS.length}개`,
    `pitcher ${roleCounts.pitcher}명/${PITCHER_RATING_FIELDS.length}개`,
    `hitter ${roleCounts.hitter}명/${HITTER_RATING_FIELDS.length}개`,
    `alias ${COMPAT_ALIAS_RATING_FIELDS.length}개 ${ABILITY_MIN}-${ABILITY_MAX} 범위`
  ].join(", ");
}

function checkBusinessPlayerSchema() {
  ensureStateReady();
  assert(systemsModule, "systems.js import가 선행되지 않았습니다.", MODULE_PATHS.systems);

  const problems = [];
  const players = allPlayers(initialState);

  for (const { team, player } of players) {
    const missing = BUSINESS_PLAYER_KEYS.filter((key) => !Object.hasOwn(player, key));
    if (missing.length > 0) {
      problems.push(`${team.id}/${player.name ?? player.id}: 비즈니스 필드 누락 ${missing.join(", ")}`);
      continue;
    }

    validateContractShape(problems, team, player);
    validateFaShape(problems, team, player);
    validateMilitaryShape(problems, team, player);
    validateForeignShape(problems, team, player);
    validateServiceTimeShape(problems, team, player);
    validateCompensationShape(problems, team, player);
  }

  for (const team of initialState.teams) {
    const summary = systemsModule.getContractSummary(team);
    const salarySum = sumNumbers(team.roster, (player) => player.contract.salary.payrollAmountKRW);
    const foreignCount = team.roster.filter((player) => player.foreignPlayer.isForeign).length;

    if (summary.totalPayrollKRW !== salarySum) {
      problems.push(`${team.id}: 계약 요약 payroll 합계 ${summary.totalPayrollKRW}/${salarySum}`);
    }
    if (summary.foreignCount !== foreignCount) {
      problems.push(`${team.id}: 외국인 요약 ${summary.foreignCount}/${foreignCount}`);
    }
    if (!Array.isArray(summary.topContracts) || summary.topContracts.length === 0) {
      problems.push(`${team.id}: topContracts 비어 있음`);
    }
  }

  const exported = saveModule.exportGameState(initialState);
  const imported = saveModule.importGameState(exported);
  const originalFirst = allPlayers(initialState)[0]?.player;
  const importedFirst = allPlayers(imported)[0]?.player;

  if (originalFirst?.contract?.id !== importedFirst?.contract?.id) {
    problems.push("저장 roundtrip 후 contract.id 보존 실패");
  }
  if (originalFirst?.faStatus?.status !== importedFirst?.faStatus?.status) {
    problems.push("저장 roundtrip 후 faStatus.status 보존 실패");
  }

  assert(
    problems.length === 0,
    `계약/FA schema 오류 ${problems.length}건. 예: ${problems.slice(0, 6).join(" / ")}`,
    MODULE_PATHS.data
  );

  const foreignPlayers = players.filter(({ player }) => player.foreignPlayer.isForeign).length;
  const faSoonPlayers = players.filter(({ player }) => player.faStatus.yearsUntilEligibility <= 1).length;
  const estimatedContracts = players.filter(({ player }) => player.contract.source?.kind === "estimated").length;
  return `${players.length}명 계약 schema, 외국인 추정 ${foreignPlayers}명, FA 1년 이내 ${faSoonPlayers}명, 추정계약 ${estimatedContracts}명`;
}

function checkOfficialKboRatingSources() {
  ensureStateReady();
  const officialPlayers = allPlayers(initialState).filter(({ player }) => isOfficialKboRatingSource(player.ratingSource));

  assert(
    officialPlayers.length >= OFFICIAL_KBO_RATING_SOURCE_MIN,
    `official KBO stats 기반 ratingSource 선수 ${officialPlayers.length}/${OFFICIAL_KBO_RATING_SOURCE_MIN}명`,
    MODULE_PATHS.data
  );

  const sourceSummary = summarizeCounts(officialPlayers.map(({ player }) => player.ratingSource)).slice(0, 4);
  return `${officialPlayers.length}명 official KBO stats 기반 ratingSource 확인 (${sourceSummary.join(", ")})`;
}

async function checkValidateRatingWeights() {
  if (!fs.existsSync(MODULE_PATHS.ratings)) {
    return "src/ratings.js 없음(optional)";
  }

  ratingsModule = await importModule(MODULE_PATHS.ratings);

  if (!Object.hasOwn(ratingsModule, "validateRatingWeights")) {
    return "validateRatingWeights export 없음(optional)";
  }

  assert(
    typeof ratingsModule.validateRatingWeights === "function",
    "validateRatingWeights export가 function이 아닙니다.",
    MODULE_PATHS.ratings
  );

  const validationResult = await ratingsModule.validateRatingWeights();
  const failure = describeValidationFailure(validationResult);

  assert(!failure, failure, MODULE_PATHS.ratings);

  return `validateRatingWeights 호출 통과${summarizeValidationResult(validationResult)}`;
}

function checkNoEnglishOnlyNames() {
  ensureStateReady();
  const englishOnly = allPlayers(initialState).filter(({ player }) => /^[A-Za-z][A-Za-z .'-]*$/.test(player.name.trim()));

  assert(
    englishOnly.length === 0,
    `영문-only 선수명 ${englishOnly.length}건. 예: ${englishOnly
      .slice(0, 8)
      .map(({ team, player }) => `${team.id}/${player.name}`)
      .join(", ")}`,
    path.join(SRC_DIR, "rosters")
  );

  return "선수명은 모두 한글 표기 포함";
}

function checkNoFakeNameResidue() {
  ensureStateReady();
  const fakePlayers = allPlayers(initialState).filter(({ player }) => PLAYER_FAKE_NAME_PATTERN.test(player.name.trim()));
  const sourceMatches = scanSourceForFakeGenerators();

  assert(
    fakePlayers.length === 0 && sourceMatches.length === 0,
    [
      fakePlayers.length
        ? `가짜 선수명: ${fakePlayers
            .slice(0, 8)
            .map(({ team, player }) => `${team.id}/${player.name}`)
            .join(", ")}`
        : "",
      sourceMatches.length
        ? `소스 잔재: ${sourceMatches
            .slice(0, 8)
            .map((match) => `${relativePath(match.file)}:${match.line}(${match.label})`)
            .join(", ")}`
        : ""
    ]
      .filter(Boolean)
      .join(" / "),
    sourceMatches[0]?.file ?? path.join(SRC_DIR, "rosters")
  );

  return "현재 src ESM 앱과 생성된 선수명에서 placeholder/name-generator 잔재 미검출";
}

function checkOpeningLineupActiveRoster() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  const problems = [];
  const summaries = [];

  for (const team of state.teams ?? []) {
    const rosterById = new Map((team.roster ?? []).map((player) => [String(player.id), player]));
    const activeHitters = (team.roster ?? []).filter((player) => player.status === "active" && player.role === "hitter");
    const activePitchers = (team.roster ?? []).filter((player) => player.status === "active" && player.role === "pitcher");
    const lineup = engineModule.buildLineup(team);
    const pitching = engineModule.buildPitchingSnapshot(team);
    const pitchingEntries = [...(pitching.rotation ?? []), ...(pitching.bullpen ?? [])];
    const pitcherIds = pitchingEntries.map((entry) => String(entry.id ?? ""));

    if (activeHitters.length < 9) {
      problems.push(`${team.shortName}: active hitter ${activeHitters.length}/9`);
    }
    if (activePitchers.length < 12) {
      problems.push(`${team.shortName}: active pitcher ${activePitchers.length}/12`);
    }
    if (lineup.length !== 9) {
      problems.push(`${team.shortName}: lineup ${lineup.length}/9`);
    }
    if (unique(lineup.map((player) => player.id)).length !== lineup.length) {
      problems.push(`${team.shortName}: lineup 중복 선수`);
    }
    if ((pitching.rotation ?? []).length !== 5 || (pitching.bullpen ?? []).length !== 7) {
      problems.push(`${team.shortName}: 투수 snapshot ${pitching.rotation?.length ?? 0}+${pitching.bullpen?.length ?? 0}/12`);
    }
    if (unique(pitcherIds).length !== pitcherIds.length) {
      problems.push(`${team.shortName}: 투수 snapshot 중복 선수`);
    }

    for (const player of lineup) {
      const rosterPlayer = rosterById.get(String(player.id));
      if (!rosterPlayer) {
        problems.push(`${team.shortName}: 라인업 ${player.name} 로스터 미존재`);
      } else if (rosterPlayer.status !== "active" || rosterPlayer.role !== "hitter") {
        problems.push(`${team.shortName}: 라인업 ${rosterPlayer.name} status=${rosterPlayer.status}, role=${rosterPlayer.role}`);
      }
    }

    for (const entry of pitchingEntries) {
      const rosterPlayer = rosterById.get(String(entry.id));
      if (!rosterPlayer) {
        problems.push(`${team.shortName}: 투수 ${entry.name} 로스터 미존재`);
      } else if (rosterPlayer.status !== "active" || rosterPlayer.role !== "pitcher") {
        problems.push(`${team.shortName}: 투수 ${rosterPlayer.name} status=${rosterPlayer.status}, role=${rosterPlayer.role}`);
      }
    }

    summaries.push(`${team.shortName} 타선 ${lineup.length}명/투수 ${pitchingEntries.length}명`);
  }

  assert(
    problems.length === 0,
    `개막 라인업/투수진 오류 ${problems.length}건. 예: ${problems.slice(0, 8).join(" / ")}`,
    MODULE_PATHS.engine
  );

  return `${summaries.join(", ")} 모두 active 로스터`;
}

function advanceToRegularSeason(state) {
  let guard = 0;
  while (state.phase === "preseason" && guard < 40) {
    engineModule.simulateDay(state);
    guard += 1;
  }
  assert(state.phase === "regular", `프리시즌 진행 후 phase=${state.phase}`, MODULE_PATHS.engine);
  assert(state.gamesPlayed === 0, `개막 전 진행 중 gamesPlayed=${state.gamesPlayed}, 기대값 0`, MODULE_PATHS.engine);
}

function checkSimulateDay() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  advanceToRegularSeason(state);
  engineModule.simulateDay(state);

  assert(state.gamesPlayed === 5, `하루 진행 후 gamesPlayed=${state.gamesPlayed}, 기대값 5`, MODULE_PATHS.engine);
  assert(state.lastGames.length === 5, `하루 진행 후 lastGames=${state.lastGames.length}, 기대값 5`, MODULE_PATHS.engine);

  const malformedGames = state.lastGames.filter(
    (game) =>
      !game.date ||
      !game.awayTeamId ||
      !game.homeTeamId ||
      !Number.isFinite(Number(game.awayScore)) ||
      !Number.isFinite(Number(game.homeScore)) ||
      !Number.isFinite(Number(game.awayHits)) ||
      !Number.isFinite(Number(game.homeHits)) ||
      !Number.isFinite(Number(game.awayHomeRuns)) ||
      !Number.isFinite(Number(game.homeHomeRuns)) ||
      !game.id ||
      !game.boxScore
  );
  assert(
    malformedGames.length === 0,
    `경기 결과 필드가 부족한 항목 ${malformedGames.length}건`,
    MODULE_PATHS.engine
  );

  return `${state.currentDate}로 진행, 누적 ${state.gamesPlayed}경기, 최근 경기 ${state.lastGames.length}건`;
}

function checkPlayerSeasonStats() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  advanceToRegularSeason(state);
  engineModule.simulateDay(state);
  const players = allPlayers(state);
  const problems = [];

  for (const { team, player } of players) {
    const seasonStats = player.seasonStats;
    if (!seasonStats || typeof seasonStats !== "object") {
      problems.push(`${team.id}/${player.name ?? player.id}: seasonStats 없음`);
      continue;
    }

    problems.push(...validateNumericStatKeys(team, player, seasonStats.batting, "batting", BATTING_STAT_KEYS));
    problems.push(...validateNumericStatKeys(team, player, seasonStats.pitching, "pitching", PITCHING_STAT_KEYS));
    problems.push(...validateNumericStatKeys(team, player, seasonStats.fielding, "fielding", FIELDING_STAT_KEYS));
  }

  assert(
    problems.length === 0,
    `seasonStats schema 오류 ${problems.length}건. 예: ${problems.slice(0, 5).join(" / ")}`,
    MODULE_PATHS.data
  );

  const teamRuns = sumNumbers(state.teams, (team) => team.runsFor);
  const battingRuns = sumNumbers(players, ({ player }) => player.seasonStats.batting.runs);
  const pitchingRuns = sumNumbers(players, ({ player }) => player.seasonStats.pitching.runsAllowed);
  const battingPa = sumNumbers(players, ({ player }) => player.seasonStats.batting.plateAppearances);
  const pitcherBf = sumNumbers(players, ({ player }) => player.seasonStats.pitching.battersFaced);
  const pitchingOuts = sumNumbers(players, ({ player }) => player.seasonStats.pitching.inningsOuts);
  const hittersWithPa = players.filter(({ player }) => player.seasonStats.batting.plateAppearances > 0).length;
  const pitchersWithOuts = players.filter(({ player }) => player.seasonStats.pitching.inningsOuts > 0).length;

  assert(teamRuns === battingRuns, `팀 득점 ${teamRuns}과 타자 득점 ${battingRuns}이 다릅니다.`, MODULE_PATHS.engine);
  assert(teamRuns === pitchingRuns, `팀 득점 ${teamRuns}과 투수 실점 ${pitchingRuns}이 다릅니다.`, MODULE_PATHS.engine);
  assert(battingPa === pitcherBf, `타석 ${battingPa}과 투수 상대타자 ${pitcherBf}가 다릅니다.`, MODULE_PATHS.engine);
  assert(
    pitchingOuts === state.gamesPlayed * 54,
    `투수 아웃카운트 ${pitchingOuts}, 기대값 ${state.gamesPlayed * 54}`,
    MODULE_PATHS.engine
  );
  assert(hittersWithPa >= 80, `하루 진행 후 타석 기록 보유 타자 ${hittersWithPa}명`, MODULE_PATHS.engine);
  assert(pitchersWithOuts >= 10, `하루 진행 후 이닝 기록 보유 투수 ${pitchersWithOuts}명`, MODULE_PATHS.engine);

  return `타자 ${hittersWithPa}명/투수 ${pitchersWithOuts}명 기록, 득점 ${teamRuns}, PA ${battingPa}`;
}

function checkGameBoxScoreEventLog() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  advanceToRegularSeason(state);
  engineModule.simulateDay(state);
  const problems = [];
  const gameIds = new Set(state.lastGames.map((game) => game.id));
  let multiRunnerBaseStateSeen = false;
  let paSchemaCount = 0;

  if (!Array.isArray(state.eventLog)) {
    problems.push("state.eventLog가 배열이 아님");
  } else {
    const gameFinalEvents = state.eventLog.filter((event) => event.type === "game.final");
    if (gameFinalEvents.length !== state.gamesPlayed) {
      problems.push(`game.final 이벤트 ${gameFinalEvents.length}/${state.gamesPlayed}`);
    }
    for (const event of gameFinalEvents) {
      if (!gameIds.has(event.gameId)) {
        problems.push(`eventLog gameId가 최근 경기와 불일치: ${event.gameId}`);
      }
      if (!Number.isFinite(Number(event.totals?.plateAppearances))) {
        problems.push(`event ${event.id ?? event.gameId}: plateAppearances 누락`);
      }
    }
  }

  for (const game of state.lastGames) {
    const boxScore = game.boxScore;
    const lineAway = boxScore?.linescore?.away;
    const lineHome = boxScore?.linescore?.home;
    const awayBatting = Array.isArray(boxScore?.batting?.away) ? boxScore.batting.away : [];
    const homeBatting = Array.isArray(boxScore?.batting?.home) ? boxScore.batting.home : [];
    const paEvents = Array.isArray(game.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
    const scoringEvents = Array.isArray(game.scoringEvents) ? game.scoringEvents : [];

    if (!boxScore || !lineAway || !lineHome) {
      problems.push(`${game.id}: boxScore linescore 누락`);
      continue;
    }

    if (lineAway.runs !== game.awayScore || lineHome.runs !== game.homeScore) {
      problems.push(`${game.id}: linescore 득점 불일치`);
    }
    if (lineAway.hits !== game.awayHits || lineHome.hits !== game.homeHits) {
      problems.push(`${game.id}: linescore 안타 불일치`);
    }
    if (sumArray(lineAway.runsByInning) !== lineAway.runs || sumArray(lineHome.runsByInning) !== lineHome.runs) {
      problems.push(`${game.id}: 이닝별 득점 합계 불일치`);
    }
    if (sumArray(awayBatting.map((line) => line.hits)) !== lineAway.hits) {
      problems.push(`${game.id}: 원정 타자 안타 합계 불일치`);
    }
    if (sumArray(homeBatting.map((line) => line.hits)) !== lineHome.hits) {
      problems.push(`${game.id}: 홈 타자 안타 합계 불일치`);
    }
    if (safeInteger(boxScore.totals?.plateAppearances) !== paEvents.length) {
      problems.push(`${game.id}: PA 이벤트 ${paEvents.length}/${boxScore.totals?.plateAppearances}`);
    }
    if (!Array.isArray(game.scoringEvents)) {
      problems.push(`${game.id}: scoringEvents 배열 누락`);
    }
    if (scoringEvents.some((event) => safeInteger(event.runs) <= 0)) {
      problems.push(`${game.id}: 득점 이벤트 runs 값 오류`);
    }
    for (const event of paEvents) {
      paSchemaCount += 1;
      if (!isBooleanTriple(event.basesBefore)) {
        problems.push(`${game.id}: PA ${event.sequence} basesBefore schema 오류`);
      }
      if (!isBooleanTriple(event.basesAfter)) {
        problems.push(`${game.id}: PA ${event.sequence} basesAfter schema 오류`);
      }
      const runs = safeInteger(event.runs);
      const scoredRunners = Array.isArray(event.scoredRunners) ? event.scoredRunners : [];
      if (runs > 0 && scoredRunners.length !== runs) {
        problems.push(`${game.id}: PA ${event.sequence} scoredRunners ${scoredRunners.length}/${runs}`);
      }
      if (safeInteger(event.outsAfter) % 3 === 0 && safeInteger(event.outsAfter) !== safeInteger(event.outsBefore) && event.inningEnded !== true) {
        problems.push(`${game.id}: PA ${event.sequence} inningEnded 누락`);
      }
      if ((event.basesAfter ?? []).filter(Boolean).length >= 2) {
        multiRunnerBaseStateSeen = true;
      }
    }
  }

  if (paSchemaCount > 0 && !multiRunnerBaseStateSeen) {
    problems.push("하루 경기 PA 이벤트에서 2명 이상 누상 상태가 한 번도 감지되지 않음");
  }

  assert(
    problems.length === 0,
    `박스스코어/eventLog 오류 ${problems.length}건. 예: ${problems.slice(0, 6).join(" / ")}`,
    MODULE_PATHS.engine
  );

  const totalPaEvents = sumNumbers(state.lastGames, (game) => game.plateAppearanceEvents.length);
  return `game.final ${state.eventLog.length}개, 박스스코어 ${state.lastGames.length}경기, PA 이벤트 ${totalPaEvents}개`;
}

function checkPitchingSnapshotUsage() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  advanceToRegularSeason(state);
  const problems = [];

  for (const team of state.teams) {
    const snapshot = engineModule.buildPitchingSnapshot(team);
    const rotationIds = new Set((snapshot.rotation ?? []).map((entry) => entry.id));
    const bullpenIds = new Set((snapshot.bullpen ?? []).map((entry) => entry.id));
    const overlap = [...rotationIds].filter((id) => bullpenIds.has(id));

    if (!snapshot.nextStarter?.id) {
      problems.push(`${team.id}: nextStarter 없음`);
    }
    if ((snapshot.rotation ?? []).length === 0 || (snapshot.rotation ?? []).length > 5) {
      problems.push(`${team.id}: rotation 길이 ${(snapshot.rotation ?? []).length}`);
    }
    if ((snapshot.bullpen ?? []).length === 0) {
      problems.push(`${team.id}: bullpen 비어 있음`);
    }
    if (overlap.length > 0) {
      problems.push(`${team.id}: rotation/bullpen 중복 ${overlap.join(", ")}`);
    }
  }

  const starterByTeam = new Map();
  for (let i = 0; i < 7; i += 1) {
    for (const team of state.teams) {
      const snapshot = engineModule.buildPitchingSnapshot(team);
      const starters = starterByTeam.get(team.id) ?? new Set();
      if (snapshot.nextStarter?.id) starters.add(snapshot.nextStarter.id);
      starterByTeam.set(team.id, starters);
    }
    engineModule.simulateDay(state);
  }

  const teamsWithoutRotation = [...starterByTeam.entries()].filter(([, starters]) => starters.size < 2);
  if (teamsWithoutRotation.length > 0) {
    problems.push(`7일간 선발 순환 부족: ${teamsWithoutRotation.map(([teamId, starters]) => `${teamId}:${starters.size}`).join(", ")}`);
  }

  for (const game of state.lastGames) {
    const allPitchingLines = [
      ...(game.boxScore?.pitching?.away ?? []),
      ...(game.boxScore?.pitching?.home ?? [])
    ];
    const isTie = Number(game.awayScore) === Number(game.homeScore);
    const winLines = allPitchingLines.filter((line) => String(line.decision ?? "").includes("W"));
    const lossLines = allPitchingLines.filter((line) => String(line.decision ?? "").includes("L"));
    const saveLines = allPitchingLines.filter((line) => String(line.decision ?? "").includes("S"));

    if (!isTie && winLines.length !== 1) {
      problems.push(`${game.id}: 승리투수 결정 ${winLines.length}`);
    }
    if (!isTie && lossLines.length !== 1) {
      problems.push(`${game.id}: 패전투수 결정 ${lossLines.length}`);
    }
    if (saveLines.length > 1) {
      problems.push(`${game.id}: 세이브 결정 ${saveLines.length}`);
    }

    for (const side of ["away", "home"]) {
      const lines = game.boxScore?.pitching?.[side];
      if (!Array.isArray(lines)) {
        problems.push(`${game.id}/${side}: pitching lines 배열 아님`);
        continue;
      }

      const outs = sumArray(lines.map((line) => line.inningsOuts));
      const starters = lines.filter((line) => line.role === "SP");
      const battersFaced = sumArray(lines.map((line) => line.battersFaced));
      const paEvents = (game.plateAppearanceEvents ?? []).filter((event) =>
        side === "away"
          ? event.defenseTeamId === game.awayTeamId
          : event.defenseTeamId === game.homeTeamId
      ).length;

      if (outs !== 27) {
        problems.push(`${game.id}/${side}: 투수 아웃 ${outs}/27`);
      }
      if (starters.length !== 1) {
        problems.push(`${game.id}/${side}: 선발 라인 ${starters.length}`);
      }
      if (battersFaced !== paEvents) {
        problems.push(`${game.id}/${side}: BF/PA ${battersFaced}/${paEvents}`);
      }
    }
  }

  const players = allPlayers(state);
  const gamesStarted = players.filter(({ player }) => player.seasonStats.pitching.gamesStarted > 0).length;
  const pitchersUsed = players.filter(({ player }) => player.seasonStats.pitching.games > 0).length;
  const teamWins = sumNumbers(state.teams, (team) => team.wins);
  const teamLosses = sumNumbers(state.teams, (team) => team.losses);
  const pitcherWins = sumNumbers(players, ({ player }) => player.seasonStats.pitching.wins);
  const pitcherLosses = sumNumbers(players, ({ player }) => player.seasonStats.pitching.losses);
  const pitcherSaves = sumNumbers(players, ({ player }) => player.seasonStats.pitching.saves);
  const pitcherHolds = sumNumbers(players, ({ player }) => player.seasonStats.pitching.holds);

  assert(
    problems.length === 0,
    `로테이션/불펜 오류 ${problems.length}건. 예: ${problems.slice(0, 6).join(" / ")}`,
    MODULE_PATHS.engine
  );
  assert(gamesStarted >= 20, `7일 진행 후 선발 등판 투수 ${gamesStarted}명`, MODULE_PATHS.engine);
  assert(pitchersUsed > gamesStarted, `불펜 등판이 선발보다 많지 않습니다: ${pitchersUsed}/${gamesStarted}`, MODULE_PATHS.engine);
  assert(pitcherWins === teamWins, `투수 승 ${pitcherWins}, 팀 승 ${teamWins}`, MODULE_PATHS.engine);
  assert(pitcherLosses === teamLosses, `투수 패 ${pitcherLosses}, 팀 패 ${teamLosses}`, MODULE_PATHS.engine);

  return `7일 선발 ${gamesStarted}명, 등판 투수 ${pitchersUsed}명, W-L ${pitcherWins}-${pitcherLosses}, SV ${pitcherSaves}, HLD ${pitcherHolds}`;
}

function checkSimulateDays() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  advanceToRegularSeason(state);
  const startDay = state.day;
  engineModule.simulateDays(state, 7);

  assert(state.day === startDay + 7, `7일 진행 후 day=${state.day}, 기대값 ${startDay + 7}`, MODULE_PATHS.engine);
  assert(state.gamesPlayed <= 35, `7일 진행 후 경기 수가 35를 초과했습니다: ${state.gamesPlayed}`, MODULE_PATHS.engine);
  assert(state.gamesPlayed > 0, "7일 진행 후 경기 수가 0입니다.", MODULE_PATHS.engine);

  return `7일 진행 후 day=${state.day}, gamesPlayed=${state.gamesPlayed}`;
}

function checkSimulateRegularSeason() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  const maxGames = Number(dataModule.REGULAR_SEASON_GAMES ?? 720);
  engineModule.simulateRegularSeason(state);

  assert(state.gamesPlayed <= maxGames, `시즌 진행 후 ${state.gamesPlayed}경기로 ${maxGames}경기를 초과했습니다.`, MODULE_PATHS.engine);
  assert(state.phase === "complete", `시즌 진행 후 phase=${state.phase}, 기대값 complete`, MODULE_PATHS.engine);
  assert(state.gamesPlayed === maxGames, `시즌 종료 경기 수가 ${state.gamesPlayed}입니다. 기대값 ${maxGames}`, MODULE_PATHS.engine);

  return `정규시즌 종료: ${state.gamesPlayed}/${maxGames}경기, day=${state.day}, phase=${state.phase}`;
}

function checkPostseasonAwards() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  const maxGames = Number(dataModule.REGULAR_SEASON_GAMES ?? 720);
  engineModule.simulateRegularSeason(state);
  const teamWinsBefore = sumNumbers(state.teams, (team) => team.wins);
  const teamLossesBefore = sumNumbers(state.teams, (team) => team.losses);

  engineModule.initializePostseason(state);

  assert(state.phase === "postseason", `initializePostseason 후 phase=${state.phase}`, MODULE_PATHS.engine);
  assert(state.postseason?.status === "active", `postseason.status=${state.postseason?.status}`, MODULE_PATHS.engine);
  assert(Array.isArray(state.postseason?.seeds) && state.postseason.seeds.length === 5, "포스트시즌 seed 5팀이 아닙니다.", MODULE_PATHS.engine);
  assert(Array.isArray(state.postseason?.series) && state.postseason.series.length === 4, "포스트시즌 시리즈 4개가 아닙니다.", MODULE_PATHS.engine);
  assert(state.postseason.series[0].higherSeedStartingWins === 1, "와일드카드 4위 1승 어드밴티지가 없습니다.", MODULE_PATHS.engine);
  assert(state.awards?.regularSeason?.mvp?.name, "정규시즌 MVP가 없습니다.", MODULE_PATHS.engine);
  assert(state.awards?.regularSeason?.rookieOfYear?.name, "신인왕이 없습니다.", MODULE_PATHS.engine);
  assert((state.awards?.regularSeason?.goldenGloves ?? []).length === 10, "골든글러브 10명이 아닙니다.", MODULE_PATHS.engine);

  engineModule.simulatePostseason(state);

  const teamWinsAfter = sumNumbers(state.teams, (team) => team.wins);
  const teamLossesAfter = sumNumbers(state.teams, (team) => team.losses);
  const completedSeries = state.postseason.series.filter((series) => series.status === "complete");
  const postseasonGames = sumNumbers(state.postseason.series, (series) => series.games.length);
  const postseasonLastGames = state.lastGames.filter((game) => game.gameType === "postseason");

  assert(state.gamesPlayed === maxGames, `포스트시즌 후 정규시즌 gamesPlayed=${state.gamesPlayed}`, MODULE_PATHS.engine);
  assert(teamWinsAfter === teamWinsBefore, `포스트시즌이 팀 승수를 바꿨습니다: ${teamWinsBefore}/${teamWinsAfter}`, MODULE_PATHS.engine);
  assert(teamLossesAfter === teamLossesBefore, `포스트시즌이 팀 패수를 바꿨습니다: ${teamLossesBefore}/${teamLossesAfter}`, MODULE_PATHS.engine);
  assert(state.phase === "offseason", `simulatePostseason 후 phase=${state.phase}`, MODULE_PATHS.engine);
  assert(state.postseason.status === "complete", `postseason.status=${state.postseason.status}`, MODULE_PATHS.engine);
  assert(completedSeries.length === 4, `완료 시리즈 ${completedSeries.length}/4`, MODULE_PATHS.engine);
  assert(postseasonGames >= 10 && postseasonGames <= 19, `포스트시즌 경기 수 ${postseasonGames}`, MODULE_PATHS.engine);
  assert(state.postseason.championTeamId, "한국시리즈 우승팀이 없습니다.", MODULE_PATHS.engine);
  assert(state.awards?.postseason?.koreanSeriesMvp?.name, "한국시리즈 MVP가 없습니다.", MODULE_PATHS.engine);
  assert(postseasonLastGames.length > 0, "최근 경기 목록에 포스트시즌 경기가 없습니다.", MODULE_PATHS.engine);

  return `${state.postseason.championName} 우승, PS ${postseasonGames}경기, MVP ${state.awards.regularSeason.mvp.name}, GG ${state.awards.regularSeason.goldenGloves.length}명`;
}

function checkDraftSystem() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  const initialRosterCount = allPlayers(state).length;

  engineModule.simulateDraft(state);

  const draft = state.draft;
  const standings = engineModule.getStandings(state);
  const pickCountsByTeam = new Map();
  const pickedIds = new Set();
  const problems = [];
  const gradeKeys = ["presentGrade", "futureGrade", "certainty", "risk", "signability"];
  const toolKeys = ["hit", "power", "speed", "defense", "arm", "stuff", "control", "movement", "stamina"];

  for (const pick of draft?.picks ?? []) {
    pickCountsByTeam.set(pick.teamId, (pickCountsByTeam.get(pick.teamId) ?? 0) + 1);
    if (pickedIds.has(pick.prospectId)) {
      problems.push(`중복 지명 prospectId=${pick.prospectId}`);
    }
    pickedIds.add(pick.prospectId);
  }

  for (const prospect of draft?.prospects ?? []) {
    if (Object.hasOwn(prospect, "name")) {
      problems.push(`${prospect.id}: 실명 필드가 있습니다.`);
    }
    if (!/^DRF-\d{4}-\d{3}$/.test(String(prospect.displayCode ?? ""))) {
      problems.push(`${prospect.id}: displayCode=${prospect.displayCode}`);
    }
    for (const key of gradeKeys) {
      if (!isNumberInRange(prospect[key], 20, 80)) {
        problems.push(`${prospect.id}: ${key}=${prospect[key]}`);
      }
    }
    for (const key of toolKeys) {
      if (Object.hasOwn(prospect.tools ?? {}, key) && !isNumberInRange(prospect.tools[key], 20, 80)) {
        problems.push(`${prospect.id}: tools.${key}=${prospect.tools[key]}`);
      }
    }
  }

  const pickedProspects = (draft?.prospects ?? []).filter((prospect) => prospect.picked);
  const unpickedProspects = (draft?.prospects ?? []).filter((prospect) => !prospect.picked);
  const teamPickCounts = [...pickCountsByTeam.values()];
  const rosterPlayers = allPlayers(state);
  const rookiePlayers = rosterPlayers.filter(({ player }) => player.sourceKind === "anonymous-draft-rookie-v1");
  const rookieCodes = new Set(rookiePlayers.map(({ player }) => player.name));

  for (const { team, player } of rookiePlayers) {
    if (!/^DRF-\d{4}-\d{3}$/.test(String(player.name ?? ""))) {
      problems.push(`${team.id}/${player.id}: 신인 코드명 오류 ${player.name}`);
    }
    if (player.teamId !== team.id || player.contract?.teamId !== team.id) {
      problems.push(`${team.id}/${player.name}: teamId/contract.teamId 불일치`);
    }
    if (player.contract?.type !== "rookie" || player.status !== "futures") {
      problems.push(`${team.id}/${player.name}: rookie 계약/status 오류`);
    }
    validateContractShape(problems, team, player);
    validateFaShape(problems, team, player);
    validateMilitaryShape(problems, team, player);
    validateForeignShape(problems, team, player);
    validateServiceTimeShape(problems, team, player);
    validateCompensationShape(problems, team, player);
  }

  assert(draft?.status === "complete", `draft.status=${draft?.status}`, MODULE_PATHS.engine);
  assert(draft.prospects.length === 150, `드래프트 후보 풀 ${draft.prospects.length}/150`, MODULE_PATHS.engine);
  assert(draft.picks.length === 110, `드래프트 픽 ${draft.picks.length}/110`, MODULE_PATHS.engine);
  assert(draft.rounds === 11, `드래프트 라운드 ${draft.rounds}/11`, MODULE_PATHS.engine);
  assert(draft.totalPicks === 110, `드래프트 totalPicks ${draft.totalPicks}/110`, MODULE_PATHS.engine);
  assert(draft.order.length === 10, `드래프트 순번 팀 ${draft.order.length}/10`, MODULE_PATHS.engine);
  assert(teamPickCounts.length === 10, `지명한 팀 수 ${teamPickCounts.length}/10`, MODULE_PATHS.engine);
  assert(teamPickCounts.every((count) => count === 11), `팀별 지명 수 ${teamPickCounts.join(", ")}`, MODULE_PATHS.engine);
  assert(pickedIds.size === 110, `고유 지명 후보 ${pickedIds.size}/110`, MODULE_PATHS.engine);
  assert(pickedProspects.length === 110, `picked 후보 ${pickedProspects.length}/110`, MODULE_PATHS.engine);
  assert(unpickedProspects.length === 40, `미지명 후보 ${unpickedProspects.length}/40`, MODULE_PATHS.engine);
  assert(draft.order[0]?.teamId === standings.at(-1)?.id, "드래프트 1순위가 정규시즌 역순 꼴찌팀이 아닙니다.", MODULE_PATHS.engine);
  assert(rosterPlayers.length === initialRosterCount + 110, `드래프트 후 roster ${rosterPlayers.length}/${initialRosterCount + 110}`, MODULE_PATHS.engine);
  assert((draft.rosterLedger ?? []).length === 110, `드래프트 rosterLedger ${draft.rosterLedger?.length ?? 0}/110`, MODULE_PATHS.engine);
  assert(rookiePlayers.length === 110, `코드형 신인 로스터 ${rookiePlayers.length}/110`, MODULE_PATHS.engine);
  assert(rookieCodes.size === 110, `코드형 신인 코드 고유값 ${rookieCodes.size}/110`, MODULE_PATHS.engine);
  assert(problems.length === 0, `드래프트 후보 schema 오류 ${problems.length}건. 예: ${problems.slice(0, 6).join(" / ")}`, MODULE_PATHS.engine);

  return `${draft.year} 드래프트 ${draft.prospects.length}명 풀, ${draft.picks.length}픽, 팀당 ${teamPickCounts[0]}명, 코드형 신인 ${rookiePlayers.length}명 roster 반영`;
}

function checkSecondaryDraftSystem() {
  ensureImportsReady();
  const state = dataModule.createInitialState();
  const initialRosterCount = allPlayers(state).length;
  const beforeOwnerByPlayerId = new Map(allPlayers(state).map(({ team, player }) => [String(player.id), team.id]));

  engineModule.simulateSecondaryDraft(state);

  const draft = state.secondaryDraft;
  const protectionEntries = Object.values(draft?.protections ?? {});
  const pickedPlayerIds = new Set();
  const originCounts = new Map();
  const problems = [];

  for (const protection of protectionEntries) {
    const protectedIds = new Set((protection.protected ?? []).map((player) => player.playerId));
    const exposedIds = new Set((protection.exposed ?? []).map((player) => player.playerId));
    const overlap = [...protectedIds].filter((id) => exposedIds.has(id));
    if ((protection.protected ?? []).length !== 35) {
      problems.push(`${protection.teamId}: 보호 ${protection.protected?.length}/35`);
    }
    if (overlap.length > 0) {
      problems.push(`${protection.teamId}: 보호/비보호 중복 ${overlap.slice(0, 3).join(",")}`);
    }
  }

  for (const pick of draft?.picks ?? []) {
    if (String(pick.teamId) === String(pick.fromTeamId)) {
      problems.push(`${pick.pickNumber}: 자기 팀 선수 지명`);
    }
    if (pickedPlayerIds.has(pick.playerId)) {
      problems.push(`${pick.pickNumber}: 중복 지명 ${pick.playerId}`);
    }
    pickedPlayerIds.add(pick.playerId);
    originCounts.set(pick.fromTeamId, (originCounts.get(pick.fromTeamId) ?? 0) + 1);
    if (!isPositiveNumber(pick.compensationKRW)) {
      problems.push(`${pick.pickNumber}: 양도금 오류 ${pick.compensationKRW}`);
    }
    const currentEntry = allPlayers(state).find(({ player }) => String(player.id) === String(pick.playerId));
    if (beforeOwnerByPlayerId.get(String(pick.playerId)) !== pick.fromTeamId) {
      problems.push(`${pick.pickNumber}: 지명 전 소속 스냅샷 불일치`);
    }
    if (currentEntry?.team.id !== pick.teamId || currentEntry?.player.teamId !== pick.teamId || currentEntry?.player.contract?.teamId !== pick.teamId) {
      problems.push(`${pick.pickNumber}: 지명 선수 소속 미반영`);
    }
    if (state.teams.find((team) => team.id === pick.fromTeamId)?.roster.some((player) => String(player.id) === String(pick.playerId))) {
      problems.push(`${pick.pickNumber}: 지명 선수가 원소속 roster에 남음`);
    }
  }

  const maxOriginCount = Math.max(0, ...originCounts.values());
  const exposurePicked = (draft?.exposurePool ?? []).filter((player) => player.picked);

  assert(draft?.status === "complete", `secondaryDraft.status=${draft?.status}`, MODULE_PATHS.engine);
  assert(draft.protectedCount === 35, `보호명단 기준 ${draft.protectedCount}/35`, MODULE_PATHS.engine);
  assert(draft.order.length === 10, `2차 드래프트 순번 팀 ${draft.order.length}/10`, MODULE_PATHS.engine);
  assert(draft.maxPicks === 36, `2차 드래프트 최대 픽 ${draft.maxPicks}/36`, MODULE_PATHS.engine);
  assert(draft.picks.length === 36, `2차 드래프트 실제 픽 ${draft.picks.length}/36`, MODULE_PATHS.engine);
  assert(draft.exposurePool.length >= 100, `비보호 풀 ${draft.exposurePool.length}/100 이상`, MODULE_PATHS.engine);
  assert(protectionEntries.length === 10, `보호명단 팀 ${protectionEntries.length}/10`, MODULE_PATHS.engine);
  assert(maxOriginCount <= 4, `원소속팀 피지명 최대 ${maxOriginCount}/4`, MODULE_PATHS.engine);
  assert(exposurePicked.length === draft.picks.length, `비보호 풀 picked ${exposurePicked.length}/${draft.picks.length}`, MODULE_PATHS.engine);
  assert((draft.transferLedger ?? []).length === draft.picks.length, `2차 드래프트 transferLedger ${draft.transferLedger?.length ?? 0}/${draft.picks.length}`, MODULE_PATHS.engine);
  assert(allPlayers(state).length === initialRosterCount, `2차 드래프트 총원 보존 ${allPlayers(state).length}/${initialRosterCount}`, MODULE_PATHS.engine);
  assert(problems.length === 0, `2차 드래프트 오류 ${problems.length}건. 예: ${problems.slice(0, 6).join(" / ")}`, MODULE_PATHS.engine);

  return `${draft.year} 2차 드래프트 보호 35명x10팀, 비보호 ${draft.exposurePool.length}명, ${draft.picks.length}/${draft.maxPicks}픽, ${draft.transferLedger.length}명 실제 이동`;
}

function checkTradeCommand() {
  ensureImportsReady();
  assert(frontOfficeModule, "frontOffice.js import가 선행되지 않았습니다.", MODULE_PATHS.frontOffice);
  assert(saveModule, "save.js import가 선행되지 않았습니다.", MODULE_PATHS.save);

  const state = dataModule.createInitialState();
  const { proposal } = findExecutableTradeProposalForState(state);
  const initialRosterCount = allPlayers(state).length;
  const beforeCounts = new Map(state.teams.map((team) => [team.id, team.roster.length]));

  assert(proposal, "엄격 게이트를 통과한 트레이드 v2 제안을 찾지 못했습니다.", MODULE_PATHS.frontOffice);

  const outgoingPlayerAsset = proposal.outgoing.find((asset) => asset.assetType === "player");
  const buyerTeamId = outgoingPlayerAsset.player.teamId;
  const sellerTeamId = proposal.target.teamId;
  const incomingPlayerId = proposal.target.player.id;
  const outgoingPlayerId = outgoingPlayerAsset.player.id;
  const proposalAssetTypes = unique(proposal.outgoing.map((asset) => asset.assetType));
  const firstClick = engineModule.commitTradeProposal(state, proposal);
  const result = engineModule.commitTradeProposal(state, approveTradeProposal(proposal));
  const buyerTeam = state.teams.find((team) => team.id === buyerTeamId);
  const sellerTeam = state.teams.find((team) => team.id === sellerTeamId);
  const incomingPlayer = buyerTeam?.roster.find((player) => player.id === incomingPlayerId);
  const outgoingPlayer = sellerTeam?.roster.find((player) => player.id === outgoingPlayerId);
  const tradeEvents = state.eventLog.filter((event) => event.type === "trade.completed");
  const secondAttempt = engineModule.commitTradeProposal(state, proposal);
  const imported = saveModule.importGameState(saveModule.exportGameState(state));

  assert(firstClick.ok === false && firstClick.code === "needs-confirmation", "트레이드 1차 클릭이 차단되지 않았습니다.", MODULE_PATHS.engine);
  assert(result.ok === true, `트레이드 commit 실패: ${result.message}`, MODULE_PATHS.engine);
  assert(allPlayers(state).length === initialRosterCount, "트레이드 후 총 선수 수가 바뀌었습니다.", MODULE_PATHS.engine);
  assert(buyerTeam?.roster.length === beforeCounts.get(buyerTeamId), "영입팀 roster 수가 유지되지 않았습니다.", MODULE_PATHS.engine);
  assert(sellerTeam?.roster.length === beforeCounts.get(sellerTeamId), "상대팀 roster 수가 유지되지 않았습니다.", MODULE_PATHS.engine);
  assert(incomingPlayer, "영입 선수가 구매팀 roster에 없습니다.", MODULE_PATHS.engine);
  assert(outgoingPlayer, "보낸 선수가 상대팀 roster에 없습니다.", MODULE_PATHS.engine);
  assert(incomingPlayer.teamId === buyerTeamId, `영입 선수 teamId=${incomingPlayer.teamId}`, MODULE_PATHS.engine);
  assert(outgoingPlayer.teamId === sellerTeamId, `보낸 선수 teamId=${outgoingPlayer.teamId}`, MODULE_PATHS.engine);
  assert(incomingPlayer.contract?.teamId === buyerTeamId, "영입 선수 contract.teamId가 갱신되지 않았습니다.", MODULE_PATHS.engine);
  assert(outgoingPlayer.contract?.teamId === sellerTeamId, "보낸 선수 contract.teamId가 갱신되지 않았습니다.", MODULE_PATHS.engine);
  assert((state.trades?.completed ?? []).length === 1, "트레이드 원장 completed 1건이 아닙니다.", MODULE_PATHS.engine);
  assert(tradeEvents.length === 1, `trade.completed 이벤트 ${tradeEvents.length}/1`, MODULE_PATHS.engine);
  assert(
    unique((state.trades.completed[0].additionalAssets ?? []).map((asset) => asset.assetType)).length === proposalAssetTypes.filter((type) => type !== "player").length,
    "트레이드 원장의 보조 자산 타입이 제안과 일치하지 않습니다.",
    MODULE_PATHS.engine
  );
  assert(secondAttempt.ok === false && secondAttempt.code === "already-committed", "중복 트레이드 실행이 차단되지 않았습니다.", MODULE_PATHS.engine);
  assert((imported.trades?.completed ?? []).length === 1, "저장 roundtrip 후 트레이드 원장이 사라졌습니다.", MODULE_PATHS.save);
  assert(imported.eventLog?.[0]?.type === "trade.completed", "저장 roundtrip 후 trade.completed 이벤트가 없습니다.", MODULE_PATHS.save);

  const assetCoverage = checkTradeSupplementalAssetCoverage();

  return `${buyerTeam?.name} ${incomingPlayer.name} 영입, ${sellerTeam?.name} ${outgoingPlayer.name} 영입, 자산 ${proposalAssetTypes.join("+")}, ${assetCoverage}`;
}

function checkTradeSupplementalAssetCoverage() {
  const state = dataModule.createInitialState();
  const seenAssetTypes = new Set();

  for (const team of state.teams) {
    const market = frontOfficeModule.buildTradeMarket(state, team.id);
    for (const proposal of market.proposals) {
      for (const asset of proposal.outgoing ?? []) {
        seenAssetTypes.add(asset.assetType);
      }
    }
  }

  const requiredTypes = ["player", "cash", "draftPick", "conditional", "ptbnl"];
  const missing = requiredTypes.filter((type) => !seenAssetTypes.has(type));
  assert(missing.length === 0, `트레이드 제안 자산 타입 누락: ${missing.join(", ")}`, MODULE_PATHS.frontOffice);

  const conditionalState = dataModule.createInitialState();
  const conditionalProposal = findExecutableTradeProposalForState(conditionalState, (proposal) =>
    (proposal.supplementalAssets ?? []).some((asset) => asset.assetType === "conditional")
  ).proposal;
  assert(conditionalProposal, "조건부 자산 포함 실행 가능 제안을 찾지 못했습니다.", MODULE_PATHS.frontOffice);
  const conditionalResult = engineModule.commitTradeProposal(conditionalState, approveTradeProposal(conditionalProposal));
  assert(conditionalResult.ok === true, `조건부 자산 트레이드 commit 실패: ${conditionalResult.message}`, MODULE_PATHS.engine);
  assert((conditionalState.tradeAssets?.cashLedger ?? []).length >= 1, "현금 ledger가 기록되지 않았습니다.", MODULE_PATHS.engine);
  assert((conditionalState.tradeAssets?.conditionalAssets ?? []).length === 1, "조건부 자산 ledger가 기록되지 않았습니다.", MODULE_PATHS.engine);

  const ptbnlState = dataModule.createInitialState();
  const ptbnlProposal = findExecutableTradeProposalForState(ptbnlState, (proposal) =>
    (proposal.supplementalAssets ?? []).some((asset) => asset.assetType === "ptbnl")
  ).proposal;
  assert(ptbnlProposal, "후일결정선수 포함 실행 가능 제안을 찾지 못했습니다.", MODULE_PATHS.frontOffice);
  const ptbnlResult = engineModule.commitTradeProposal(ptbnlState, approveTradeProposal(ptbnlProposal));
  assert(ptbnlResult.ok === true, `후일결정선수 트레이드 commit 실패: ${ptbnlResult.message}`, MODULE_PATHS.engine);
  assert((ptbnlState.tradeAssets?.ptbnlSlots ?? []).length === 1, "후일결정선수 ledger가 기록되지 않았습니다.", MODULE_PATHS.engine);

  return `자산타입 ${requiredTypes.join("/")}, 조건부/현금/PTBNL ledger`;
}

function tradePlayerAssetCount(proposal) {
  return (proposal?.outgoing ?? []).filter((asset) => asset.assetType === "player").length;
}

function findExecutableTradeProposalForState(state, predicate = null) {
  for (const team of state.teams ?? []) {
    const market = frontOfficeModule.buildTradeMarket(state, team.id);
    const proposal = market.proposals.find((entry) =>
      entry.status === "viable" &&
      entry.executionGate?.commandReady === true &&
      tradePlayerAssetCount(entry) === 1 &&
      (!predicate || predicate(entry, market, team))
    );
    if (proposal) return { team, market, proposal };
  }
  return { team: null, market: null, proposal: null };
}

function approveTradeProposal(proposal) {
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

function checkTradeSafetyGate() {
  ensureImportsReady();
  assert(frontOfficeModule, "frontOffice.js import가 선행되지 않았습니다.", MODULE_PATHS.frontOffice);

  const successState = dataModule.createInitialState();
  const successProposal = findExecutableTradeProposalForState(successState).proposal;
  assert(successProposal, "성공 기준용 executable 트레이드 제안을 찾지 못했습니다.", MODULE_PATHS.frontOffice);
  const success = engineModule.commitTradeProposal(successState, approveTradeProposal(cloneForTest(successProposal)));
  assert(success.ok === true, `기준 executable 트레이드가 실패했습니다: ${success.message}`, MODULE_PATHS.engine);

  const cases = [
    ["missing proposal", ({ state }) => engineModule.commitTradeProposal(state, null), "missing-proposal"],
    ["first click blocked", ({ state, proposal }) => engineModule.commitTradeProposal(state, proposal), "needs-confirmation"],
    ["wrong approval id", ({ state, proposal }) => engineModule.commitTradeProposal(state, { ...proposal, commandApproval: { confirmed: true, proposalId: "wrong" } }), "needs-confirmation"],
    ["wrong approval player", ({ state, proposal }) => engineModule.commitTradeProposal(state, { ...approveTradeProposal(proposal), commandApproval: { ...approveTradeProposal(proposal).commandApproval, targetPlayerId: "wrong-player" } }), "approval-mismatch"],
    ["not viable status", ({ state, proposal }) => { proposal.status = "needs_sweetener"; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "not-viable"],
    ["low acceptance", ({ state, proposal }) => { proposal.acceptanceScore = 0; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "gate-blocked"],
    ["no outgoing asset", ({ state, proposal }) => { proposal.outgoing = []; proposal.outgoingPlayers = []; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "not-one-player"],
    ["two player assets", ({ state, proposal }) => { const playerAsset = proposal.outgoing.find((asset) => asset.assetType === "player"); proposal.outgoing = [playerAsset, cloneForTest(playerAsset), ...proposal.supplementalAssets]; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "not-one-player"],
    ["invalid asset type", ({ state, proposal }) => { pushSupplemental(proposal, { assetType: "mystery", id: "bad-asset", valueScore: 1 }); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "invalid-asset"],
    ["wrong asset route", ({ state, proposal }) => { proposal.supplementalAssets[0].fromTeamId = proposal.target.teamId; proposal.outgoing = [...proposal.outgoingPlayers, ...proposal.supplementalAssets]; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "asset-route"],
    ["zero cash", ({ state, proposal }) => { const cash = proposal.supplementalAssets.find((asset) => asset.assetType === "cash"); cash.amountKRW = 0; syncTradeOutgoing(proposal); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "cash-value"],
    ["zero value", ({ state, proposal }) => { proposal.supplementalAssets[0].valueScore = 0; syncTradeOutgoing(proposal); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "asset-value"],
    ["duplicate asset id", ({ state, proposal }) => { pushSupplemental(proposal, cloneForTest(proposal.supplementalAssets[0])); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "duplicate-asset"],
    ["S/F underpay", ({ state, proposal }) => { const outgoing = proposal.outgoingPlayers[0].player; const rosterPlayer = findRosterPlayerForProposal(state, outgoing.teamId, outgoing.id); rosterPlayer.ovr = 45; rosterPlayer.pot = 55; proposal.supplementalAssets = []; proposal.outgoing = [...proposal.outgoingPlayers]; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "gate-blocked"],
    ["extreme overpay", ({ state, proposal }) => { pushSupplemental(proposal, makeCashAsset(proposal, "huge-cash", 99_000_000_000, 999)); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "gate-blocked"],
    ["target stale", ({ state, proposal }) => { removePlayerForProposal(state, proposal.target.teamId, proposal.target.player.id); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "player-not-found"],
    ["outgoing stale", ({ state, proposal }) => { const outgoing = proposal.outgoingPlayers[0].player; removePlayerForProposal(state, outgoing.teamId, outgoing.id); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "player-not-found"],
    ["seller unknown", ({ state, proposal }) => { proposal.target.teamId = "missing-team"; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "team-not-found"],
    ["buyer unknown", ({ state, proposal }) => { proposal.outgoingPlayers[0].player.teamId = "missing-team"; proposal.outgoing[0].player.teamId = "missing-team"; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "team-not-found"],
    ["fa market player unavailable", ({ state, proposal }) => { findRosterPlayerForProposal(state, proposal.target.teamId, proposal.target.player.id).faStatus.status = "market"; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "player-unavailable"],
    ["military unavailable", ({ state, proposal }) => { const outgoing = proposal.outgoingPlayers[0].player; findRosterPlayerForProposal(state, outgoing.teamId, outgoing.id).militaryStatus.availability = "unavailable"; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "player-unavailable"],
    ["execution gate false", ({ state, proposal }) => { proposal.executionGate = { commandReady: false }; return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "gate-blocked"],
    ["draft pick already used", ({ state, proposal }) => { const pick = makeDraftPickAsset(proposal); pushSupplemental(proposal, pick); state.tradeAssets.draftPickLedger.push({ id: pick.id, year: pick.year, round: pick.round, originalTeamId: pick.fromTeamId }); return engineModule.commitTradeProposal(state, approveTradeProposal(proposal)); }, "draft-pick-used"]
  ];

  const failures = [];
  for (const [name, run, expectedCode] of cases) {
    const state = dataModule.createInitialState();
    const proposal = cloneForTest(findExecutableTradeProposalForState(state).proposal);
    assert(proposal, `안전 게이트 케이스 ${name}: executable 제안 없음`, MODULE_PATHS.frontOffice);
    const result = run({ state, proposal });
    if (result.ok !== false || result.code !== expectedCode) {
      failures.push(`${name}: ${result.code ?? "ok"} != ${expectedCode}`);
    }
  }

  assert(failures.length === 0, `트레이드 안전 게이트 실패 ${failures.length}건: ${failures.slice(0, 5).join(" / ")}`, MODULE_PATHS.engine);
  return `${cases.length}개 reject 케이스 + 1개 성공 케이스`;
}

function checkFreeAgencyMarket() {
  ensureImportsReady();
  assert(saveModule, "save.js import가 선행되지 않았습니다.", MODULE_PATHS.save);

  const state = dataModule.createInitialState();
  const initialRosterCount = allPlayers(state).length;
  engineModule.initializeFreeAgency(state);
  const market = state.freeAgency;

  assert(market?.status === "ready", "FA/외국인 시장 status가 ready가 아닙니다.", MODULE_PATHS.engine);
  assert((market.faCandidates ?? []).length >= 20, `FA 후보 ${market.faCandidates?.length ?? 0}/20`, MODULE_PATHS.engine);
  assert((market.offers ?? []).length >= 10, `FA 오퍼 ${market.offers?.length ?? 0}/10`, MODULE_PATHS.engine);
  assert(market.foreignMarket?.candidates?.length === 30, `외국인 후보 ${market.foreignMarket?.candidates?.length ?? 0}/30`, MODULE_PATHS.engine);
  assert((market.foreignOffers ?? []).length === 10, `외국인 오퍼 ${market.foreignOffers?.length ?? 0}/10`, MODULE_PATHS.engine);
  assert(market.foreignMarket.candidates.every((candidate) => /^FGN-\d{4}-\d{3}$/.test(candidate.displayCode) && !Object.hasOwn(candidate, "name")), "외국인 후보가 코드형이 아니거나 name 필드를 포함합니다.", MODULE_PATHS.engine);
  assert(unique(market.foreignMarket.candidates.map((candidate) => candidate.tier)).length === 5, "외국인 5티어 풀이 아닙니다.", MODULE_PATHS.engine);

  const faResult = engineModule.commitFreeAgentSigning(state);
  assert(faResult.ok === true, `FA 계약 실패: ${faResult.message}`, MODULE_PATHS.engine);
  assert(allPlayers(state).length === initialRosterCount, "FA 계약 후 총 선수 수가 바뀌었습니다.", MODULE_PATHS.engine);
  assert((state.freeAgency.signings ?? []).length === 1, "FA signing ledger가 1건이 아닙니다.", MODULE_PATHS.engine);
  assert(state.eventLog.some((event) => event.type === "fa.signed"), "fa.signed 이벤트가 없습니다.", MODULE_PATHS.engine);
  const signedEntry = state.teams.flatMap((team) => team.roster.map((player) => ({ team, player }))).find(({ player }) => player.id === faResult.signing.playerId);
  assert(signedEntry?.team.id === faResult.signing.signingTeamId, "FA 계약 선수의 roster/teamId 이동이 반영되지 않았습니다.", MODULE_PATHS.engine);
  assert(signedEntry.player.contract?.type === "fa", "FA 계약 선수 contract.type이 fa가 아닙니다.", MODULE_PATHS.engine);
  assert(signedEntry.player.faStatus?.status === "signed", "FA 계약 선수 faStatus.status가 signed가 아닙니다.", MODULE_PATHS.engine);

  const beforeForeignRosterCount = allPlayers(state).length;
  const foreignResult = engineModule.commitForeignPlayerSigning(state);
  assert(foreignResult.ok === true, `외국인 권리 계약 실패: ${foreignResult.message}`, MODULE_PATHS.engine);
  assert(allPlayers(state).length === beforeForeignRosterCount, "외국인 권리 계약이 roster에 가짜 선수를 추가했습니다.", MODULE_PATHS.engine);
  assert((state.freeAgency.foreignSignings ?? []).length === 1, "foreignSignings ledger가 1건이 아닙니다.", MODULE_PATHS.engine);
  assert(state.eventLog.some((event) => event.type === "foreign.signed"), "foreign.signed 이벤트가 없습니다.", MODULE_PATHS.engine);
  assert(foreignResult.signing.rosterActivation === "pending-official-name", "외국인 권리 계약 activation 상태가 다릅니다.", MODULE_PATHS.engine);

  const imported = saveModule.importGameState(saveModule.exportGameState(state));
  assert((imported.freeAgency?.signings ?? []).length === 1, "저장 roundtrip 후 FA signing ledger가 사라졌습니다.", MODULE_PATHS.save);
  assert((imported.freeAgency?.foreignSignings ?? []).length === 1, "저장 roundtrip 후 외국인 signing ledger가 사라졌습니다.", MODULE_PATHS.save);
  assert((imported.eventLog ?? []).some((event) => event.type === "foreign.signed"), "저장 roundtrip 후 foreign.signed 이벤트가 없습니다.", MODULE_PATHS.save);

  return `FA ${market.faCandidates.length}명/오퍼 ${market.offers.length}건, 외국인 코드 ${market.foreignMarket.candidates.length}명, roster ${initialRosterCount}명 유지`;
}

function checkAutonomousOffseasonRollover() {
  ensureImportsReady();
  assert(saveModule, "save.js import가 선행되지 않았습니다.", MODULE_PATHS.save);

  const state = dataModule.createInitialState();
  const initialRosterCount = allPlayers(state).length;
  engineModule.simulatePostseason(state);

  const postseasonCompleteDate = state.currentDate;
  const beforeRolloverPlayer = allPlayers(state)[0]?.player;
  const beforeRolloverPlayerId = beforeRolloverPlayer?.id;
  const beforeRolloverAge = Number(beforeRolloverPlayer?.age ?? 0);
  const offseason = engineModule.runAutonomousOffseason(state);
  const afterOffseasonRosterCount = allPlayers(state).length;
  const importedOffseason = saveModule.importGameState(saveModule.exportGameState(state));

  assert(offseason.ok === true, `자동 오프시즌 실패: ${offseason.message}`, MODULE_PATHS.engine);
  assert(state.phase === "offseason", `자동 오프시즌 phase=${state.phase}`, MODULE_PATHS.engine);
  assert(afterOffseasonRosterCount === initialRosterCount + 110, `자동 오프시즌 roster ${afterOffseasonRosterCount}/${initialRosterCount + 110}`, MODULE_PATHS.engine);
  assert((state.draft?.rosterLedger ?? []).length === 110, `자동 오프시즌 신인 ledger ${state.draft?.rosterLedger?.length ?? 0}/110`, MODULE_PATHS.engine);
  assert((state.secondaryDraft?.transferLedger ?? []).length === state.secondaryDraft?.picks?.length, "자동 오프시즌 2차 드래프트 이동 ledger가 픽 수와 다릅니다.", MODULE_PATHS.engine);
  assert((state.freeAgency?.signings ?? []).length >= 25, `자동 FA 계약 ${state.freeAgency?.signings?.length ?? 0}/25`, MODULE_PATHS.engine);
  assert((state.freeAgency?.foreignSignings ?? []).length === 10, `자동 외국인 권리 ${state.freeAgency?.foreignSignings?.length ?? 0}/10`, MODULE_PATHS.engine);
  assert((state.aiTradeMarket?.completed ?? []).length >= 1, `CPU 트레이드 ${state.aiTradeMarket?.completed?.length ?? 0}/1`, MODULE_PATHS.engine);
  assert(state.eventLog.some((event) => event.type === "offseason.autonomous.complete"), "offseason.autonomous.complete 이벤트가 없습니다.", MODULE_PATHS.engine);
  assert((importedOffseason.draft?.rosterLedger ?? []).length === 110, "저장 roundtrip 후 신인 ledger가 사라졌습니다.", MODULE_PATHS.save);
  assert((importedOffseason.freeAgency?.foreignSignings ?? []).length === 10, "저장 roundtrip 후 외국인 권리 ledger가 사라졌습니다.", MODULE_PATHS.save);

  const rollover = engineModule.advanceSeason(state);
  const afterRolloverPlayers = allPlayers(state);
  const rolledPlayer = afterRolloverPlayers.find(({ player }) => player.id === beforeRolloverPlayerId)?.player;
  const rosterProblems = [];
  for (const { team, player } of afterRolloverPlayers) {
    if (player.teamId !== team.id || player.contract?.teamId !== team.id) {
      rosterProblems.push(`${team.id}/${player.name}: teamId 불일치`);
    }
    if (player.seasonStats?.batting?.plateAppearances !== 0 || player.seasonStats?.pitching?.inningsOuts !== 0) {
      rosterProblems.push(`${team.id}/${player.name}: 시즌 기록 미리셋`);
    }
    if (player.contract?.salary?.season !== 2027) {
      rosterProblems.push(`${team.id}/${player.name}: 계약 salary season=${player.contract?.salary?.season}`);
    }
    validateContractShape(rosterProblems, team, player);
    validateFaShape(rosterProblems, team, player);
    validateServiceTimeShape(rosterProblems, team, player);
  }

  assert(rollover.ok === true, `시즌 롤오버 실패: ${rollover.message}`, MODULE_PATHS.engine);
  assert(state.currentDate === "2027-03-01", `롤오버 날짜 ${state.currentDate}/2027-03-01`, MODULE_PATHS.engine);
  assert(state.phase === "preseason", `롤오버 phase=${state.phase}`, MODULE_PATHS.engine);
  assert(state.gamesPlayed === 0, `롤오버 gamesPlayed=${state.gamesPlayed}`, MODULE_PATHS.engine);
  assert(state.teams.every((team) => team.wins === 0 && team.losses === 0 && team.ties === 0 && team.runsFor === 0 && team.runsAgainst === 0), "팀 성적이 리셋되지 않았습니다.", MODULE_PATHS.engine);
  assert(afterRolloverPlayers.length === afterOffseasonRosterCount, `롤오버 roster 보존 ${afterRolloverPlayers.length}/${afterOffseasonRosterCount}`, MODULE_PATHS.engine);
  assert(rolledPlayer?.age === beforeRolloverAge + 1, `나이 롤오버 ${rolledPlayer?.age}/${beforeRolloverAge + 1}`, MODULE_PATHS.engine);
  assert((state.seasonHistory ?? []).length >= 1 && state.seasonHistory[0].closedAt === postseasonCompleteDate, "seasonHistory에 종료 시즌 스냅샷이 없습니다.", MODULE_PATHS.engine);
  assert(state.draft === null && state.secondaryDraft === null && state.freeAgency === null, "다음 시즌 전환 후 오프시즌 작업 상태가 초기화되지 않았습니다.", MODULE_PATHS.engine);
  assert(rosterProblems.length === 0, `롤오버 roster schema 오류 ${rosterProblems.length}건. 예: ${rosterProblems.slice(0, 6).join(" / ")}`, MODULE_PATHS.engine);

  engineModule.simulateDays(state, 27);
  assert(state.currentDate === "2027-03-28", `2027 프리시즌 진행 날짜 ${state.currentDate}/2027-03-28`, MODULE_PATHS.engine);
  assert(state.phase === "regular", `2027 개막 phase=${state.phase}`, MODULE_PATHS.engine);
  assert(state.gamesPlayed === 0, `2027 개막 전 gamesPlayed=${state.gamesPlayed}`, MODULE_PATHS.engine);

  return `자동 스토브 roster +${afterOffseasonRosterCount - initialRosterCount}, FA ${offseason.summary.faSignings}건, CPU 트레이드 ${offseason.summary.aiTrades}건, 2027 프리시즌 롤오버`;
}

function cloneForTest(value) {
  return JSON.parse(JSON.stringify(value));
}

function pushSupplemental(proposal, asset) {
  proposal.supplementalAssets = [...(proposal.supplementalAssets ?? []), asset];
  syncTradeOutgoing(proposal);
}

function syncTradeOutgoing(proposal) {
  proposal.outgoing = [...(proposal.outgoingPlayers ?? proposal.outgoing.filter((entry) => entry.assetType === "player")), ...(proposal.supplementalAssets ?? [])];
}

function makeCashAsset(proposal, id, amountKRW, valueScore) {
  const buyerTeamId = proposal.outgoingPlayers[0].player.teamId;
  return {
    assetType: "cash",
    id,
    fromTeamId: buyerTeamId,
    fromTeamName: proposal.outgoingPlayers[0].player.teamName,
    toTeamId: proposal.target.teamId,
    toTeamName: proposal.target.teamName,
    amountKRW,
    valueScore
  };
}

function makeDraftPickAsset(proposal) {
  const buyerTeamId = proposal.outgoingPlayers[0].player.teamId;
  return {
    assetType: "draftPick",
    id: `test-pick-${buyerTeamId}-${proposal.target.teamId}`,
    fromTeamId: buyerTeamId,
    fromTeamName: proposal.outgoingPlayers[0].player.teamName,
    toTeamId: proposal.target.teamId,
    toTeamName: proposal.target.teamName,
    year: 2027,
    round: 2,
    valueScore: 12
  };
}

function removePlayerForProposal(state, teamId, playerId) {
  const team = state.teams.find((entry) => String(entry.id) === String(teamId));
  const index = team?.roster.findIndex((player) => String(player.id) === String(playerId)) ?? -1;
  if (index >= 0) team.roster.splice(index, 1);
}

function findRosterPlayerForProposal(state, teamId, playerId) {
  const player = state.teams.find((entry) => String(entry.id) === String(teamId))?.roster.find((entry) => String(entry.id) === String(playerId));
  assert(player, `테스트 대상 선수 ${teamId}/${playerId}를 찾지 못했습니다.`, MODULE_PATHS.engine);
  return player;
}

function checkSystemsSelectors() {
  ensureStateReady();
  assert(systemsModule, "systems.js import가 선행되지 않았습니다.", MODULE_PATHS.systems);

  const team = initialState.teams[0];
  const summary = systemsModule.getRosterSummary(team);
  const scoutBoard = systemsModule.getScoutBoard(initialState, team.id);
  const tradeBlock = systemsModule.getTradeBlock(initialState, team.id);

  assert(summary.totalPlayers === team.roster.length, "로스터 요약의 totalPlayers가 실제 roster 길이와 다릅니다.", MODULE_PATHS.systems);
  assert(Array.isArray(summary.topPlayers), "로스터 요약 topPlayers가 배열이 아닙니다.", MODULE_PATHS.systems);
  assert(Array.isArray(scoutBoard.targets), "스카우트 보드 targets가 배열이 아닙니다.", MODULE_PATHS.systems);
  assert(Array.isArray(tradeBlock.players), "트레이드 블록 players가 배열이 아닙니다.", MODULE_PATHS.systems);

  return `${team.name} 요약 ${summary.totalPlayers}명, 스카우트 후보 ${scoutBoard.targets.length}명`;
}

function checkFrontOfficeData() {
  ensureStateReady();
  assert(frontOfficeModule, "frontOffice.js import가 선행되지 않았습니다.", MODULE_PATHS.frontOffice);

  const team = initialState.teams[0];
  const market = frontOfficeModule.buildTradeMarket(initialState, team.id);
  const scouting = frontOfficeModule.buildScoutAssignments(initialState, team.id);
  const inbox = frontOfficeModule.buildFrontOfficeInbox(initialState, team.id);

  assert(Array.isArray(market.targets), "트레이드 시장 targets가 배열이 아닙니다.", MODULE_PATHS.frontOffice);
  assert(Array.isArray(market.proposals), "트레이드 시장 proposals가 배열이 아닙니다.", MODULE_PATHS.frontOffice);
  assert(Array.isArray(scouting.assignments), "스카우트 assignments가 배열이 아닙니다.", MODULE_PATHS.frontOffice);
  assert(Array.isArray(inbox.items), "프런트 inbox items가 배열이 아닙니다.", MODULE_PATHS.frontOffice);

  return `${team.name} 시장 후보 ${market.targets.length}명, 제안 ${market.proposals.length}건, 업무 ${scouting.assignments.length}개, 알림 ${inbox.items.length}건`;
}

function checkSaveRoundtrip() {
  ensureStateReady();
  assert(saveModule, "save.js import가 선행되지 않았습니다.", MODULE_PATHS.save);

  const exported = saveModule.exportGameState(initialState);
  const imported = saveModule.importGameState(exported);
  const fileName = saveModule.makeSaveFileName(initialState);

  assert(imported.teams.length === initialState.teams.length, "저장 roundtrip 후 팀 수가 달라졌습니다.", MODULE_PATHS.save);
  assert(
    allPlayers(imported).length === allPlayers(initialState).length,
    "저장 roundtrip 후 선수 수가 달라졌습니다.",
    MODULE_PATHS.save
  );
  assert(fileName.endsWith(".json"), "저장 파일명이 .json으로 끝나지 않습니다.", MODULE_PATHS.save);

  return `roundtrip ${imported.teams.length}팀/${allPlayers(imported).length}명, ${fileName}`;
}

function ensureImportsReady() {
  assert(dataModule, "data.js import가 선행되지 않았습니다.", MODULE_PATHS.data);
  assert(engineModule, "engine.js import가 선행되지 않았습니다.", MODULE_PATHS.engine);
}

function ensureStateReady() {
  ensureImportsReady();
  assert(initialState, "createInitialState 결과가 없습니다.", MODULE_PATHS.data);
}

function assert(condition, message, location) {
  if (!condition) {
    throw new VerificationError(message, relativePath(location));
  }
}

function assertExport(moduleValue, exportName, modulePath) {
  assert(
    typeof moduleValue?.[exportName] === "function",
    `${relativePath(modulePath)}에서 ${exportName} function export를 찾지 못했습니다.`,
    modulePath
  );
}

function importModule(filePath) {
  return import(pathToFileURL(filePath).href);
}

function allPlayers(state) {
  return state.teams.flatMap((team) => (team.roster ?? []).map((player) => ({ team, player })));
}

function validateContractShape(problems, team, player) {
  const contract = player.contract;
  if (!contract || typeof contract !== "object") {
    problems.push(`${team.id}/${player.name}: contract 객체 아님`);
    return;
  }

  if (!contract.id || contract.teamId !== team.id) {
    problems.push(`${team.id}/${player.name}: contract id/teamId 오류`);
  }
  if (!CONTRACT_STATUSES.includes(contract.status)) {
    problems.push(`${team.id}/${player.name}: contract.status=${contract.status}`);
  }
  if (!CONTRACT_TYPES.includes(contract.type)) {
    problems.push(`${team.id}/${player.name}: contract.type=${contract.type}`);
  }
  if (!isPositiveNumber(contract.salary?.amountKRW) || !isPositiveNumber(contract.salary?.payrollAmountKRW)) {
    problems.push(`${team.id}/${player.name}: contract salary 숫자 오류`);
  }
  if (!Array.isArray(contract.salaryBySeason) || contract.salaryBySeason.length === 0) {
    problems.push(`${team.id}/${player.name}: salaryBySeason 비어 있음`);
  }
  validateSourceShape(problems, team, player, contract.source, "contract.source");
}

function validateFaShape(problems, team, player) {
  const faStatus = player.faStatus;
  if (!faStatus || typeof faStatus !== "object") {
    problems.push(`${team.id}/${player.name}: faStatus 객체 아님`);
    return;
  }
  if (!FA_STATUSES.includes(faStatus.status)) {
    problems.push(`${team.id}/${player.name}: faStatus.status=${faStatus.status}`);
  }
  if (!Number.isFinite(Number(faStatus.yearsUntilEligibility))) {
    problems.push(`${team.id}/${player.name}: faStatus.yearsUntilEligibility 숫자 아님`);
  }
  validateSourceShape(problems, team, player, faStatus.source, "faStatus.source");
}

function validateMilitaryShape(problems, team, player) {
  const militaryStatus = player.militaryStatus;
  if (!militaryStatus || typeof militaryStatus !== "object") {
    problems.push(`${team.id}/${player.name}: militaryStatus 객체 아님`);
    return;
  }
  if (!MILITARY_STATUSES.includes(militaryStatus.status)) {
    problems.push(`${team.id}/${player.name}: militaryStatus.status=${militaryStatus.status}`);
  }
  if (!["available", "unavailable", "returningSoon"].includes(militaryStatus.availability)) {
    problems.push(`${team.id}/${player.name}: militaryStatus.availability=${militaryStatus.availability}`);
  }
  validateSourceShape(problems, team, player, militaryStatus.source, "militaryStatus.source");
}

function validateForeignShape(problems, team, player) {
  const foreignPlayer = player.foreignPlayer;
  if (!foreignPlayer || typeof foreignPlayer !== "object") {
    problems.push(`${team.id}/${player.name}: foreignPlayer 객체 아님`);
    return;
  }
  if (typeof foreignPlayer.isForeign !== "boolean") {
    problems.push(`${team.id}/${player.name}: foreignPlayer.isForeign boolean 아님`);
  }
  if (!FOREIGN_REGISTRATION_STATUSES.includes(foreignPlayer.registrationStatus)) {
    problems.push(`${team.id}/${player.name}: foreignPlayer.registrationStatus=${foreignPlayer.registrationStatus}`);
  }
  if (foreignPlayer.isForeign && !foreignPlayer.foreignRightsTeamId) {
    problems.push(`${team.id}/${player.name}: 외국인 foreignRightsTeamId 없음`);
  }
  validateSourceShape(problems, team, player, foreignPlayer.source, "foreignPlayer.source");
}

function validateServiceTimeShape(problems, team, player) {
  const serviceTime = player.serviceTime;
  if (!serviceTime || typeof serviceTime !== "object") {
    problems.push(`${team.id}/${player.name}: serviceTime 객체 아님`);
    return;
  }
  for (const key of ["seasonsAccrued", "daysAccrued", "currentSeasonDays"]) {
    if (!Number.isFinite(Number(serviceTime[key]))) {
      problems.push(`${team.id}/${player.name}: serviceTime.${key} 숫자 아님`);
    }
  }
  validateSourceShape(problems, team, player, serviceTime.source, "serviceTime.source");
}

function validateCompensationShape(problems, team, player) {
  const compensationGrade = player.compensationGrade;
  if (!compensationGrade || typeof compensationGrade !== "object") {
    problems.push(`${team.id}/${player.name}: compensationGrade 객체 아님`);
    return;
  }
  if (!COMPENSATION_GRADES.includes(compensationGrade.grade)) {
    problems.push(`${team.id}/${player.name}: compensationGrade.grade=${compensationGrade.grade}`);
  }
  if (!Number.isFinite(Number(compensationGrade.estimatedCashKRW))) {
    problems.push(`${team.id}/${player.name}: compensationGrade.estimatedCashKRW 숫자 아님`);
  }
  validateSourceShape(problems, team, player, compensationGrade.source, "compensationGrade.source");
}

function validateSourceShape(problems, team, player, source, label) {
  if (!source || typeof source !== "object") {
    problems.push(`${team.id}/${player.name}: ${label} 객체 아님`);
    return;
  }
  if (!SOURCE_KINDS.includes(source.kind)) {
    problems.push(`${team.id}/${player.name}: ${label}.kind=${source.kind}`);
  }
  const confidence = Number(source.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    problems.push(`${team.id}/${player.name}: ${label}.confidence=${source.confidence}`);
  }
}

function validateNumericStatKeys(team, player, stats, group, keys) {
  if (!stats || typeof stats !== "object") {
    return [`${team.id}/${player.name ?? player.id}: seasonStats.${group} 없음`];
  }

  const missing = keys.filter((key) => !Object.hasOwn(stats, key));
  const badNumbers = keys.filter((key) => Object.hasOwn(stats, key) && !Number.isFinite(Number(stats[key])));
  const problems = [];

  if (missing.length > 0) {
    problems.push(`${team.id}/${player.name ?? player.id}: ${group} 누락 ${missing.join(", ")}`);
  }
  if (badNumbers.length > 0) {
    problems.push(`${team.id}/${player.name ?? player.id}: ${group} 숫자 아님 ${badNumbers.join(", ")}`);
  }

  return problems;
}

function sumNumbers(items, selector) {
  return items.reduce((total, item) => {
    const value = Number(selector(item) ?? 0);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function sumArray(values) {
  return (Array.isArray(values) ? values : []).reduce((total, value) => total + safeInteger(value), 0);
}

function safeInteger(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function isBooleanTriple(value) {
  return Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === "boolean");
}

function isPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function unique(values) {
  return [...new Set(values)];
}

function isNumberInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function isOfficialKboRatingSource(value) {
  const text = String(value ?? "");
  const normalized = text.toLowerCase();

  return /\bkbo[-_ ]?official\b/.test(normalized) ||
    /\bofficial[-_ ]?kbo\b/.test(normalized) ||
    /\bkbo[-_ ]?stats?\b/.test(normalized) ||
    /\bstats?[-_ ]?kbo\b/.test(normalized) ||
    /kbo.*공식|공식.*kbo/i.test(text);
}

function summarizeCounts(values) {
  const counts = new Map();

  for (const value of values) {
    const label = String(value ?? "").trim() || "(empty)";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => `${label}:${count}`);
}

function describeValidationFailure(result) {
  if (result === false) {
    return "validateRatingWeights가 false를 반환했습니다.";
  }
  if (Array.isArray(result) && result.length > 0) {
    return `validateRatingWeights가 이슈 ${result.length}건을 반환했습니다. 예: ${result.slice(0, 3).join(", ")}`;
  }
  if (!result || typeof result !== "object") {
    return "";
  }
  if (result.ok === false || result.valid === false || result.passed === false) {
    return `validateRatingWeights 실패 반환: ${JSON.stringify(result)}`;
  }

  const errors = Array.isArray(result.errors) ? result.errors : [];
  const failures = Array.isArray(result.failures) ? result.failures : [];
  const issues = [...errors, ...failures];

  if (issues.length > 0) {
    return `validateRatingWeights 이슈 ${issues.length}건. 예: ${issues.slice(0, 3).join(", ")}`;
  }

  return "";
}

function summarizeValidationResult(result) {
  if (result === undefined) return "";
  if (result === true) return " (true)";
  if (Array.isArray(result)) return " (0개 이슈)";
  if (result && typeof result === "object") {
    const keys = Object.keys(result);
    return keys.length > 0 ? ` (${keys.slice(0, 3).join(", ")})` : " (object)";
  }
  return ` (${String(result)})`;
}

function scanSourceForFakeGenerators() {
  const matches = [];
  const files = listFiles(SRC_DIR).filter((file) => file.endsWith(".js"));

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((lineText, index) => {
      for (const pattern of SOURCE_FAKE_PATTERNS) {
        if (pattern.regex.test(lineText)) {
          matches.push({
            file,
            line: index + 1,
            label: pattern.label,
            text: lineText.trim()
          });
        }
      }
    });
  }

  return matches;
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function createFakeRoot() {
  return {
    innerHTML: "",
    querySelector() {
      return null;
    }
  };
}

function buildReport() {
  const passed = results.filter((result) => result.status === "PASS").length;
  const failed = results.length - passed;
  const status = failed === 0 ? "통과" : "실패";
  const generatedAt = new Date().toISOString();

  const lines = [
    "# 검증 보고서",
    "",
    `- 실행 시각: ${generatedAt}`,
    `- 작업 폴더: ${ROOT_DIR}`,
    `- 실행 Node: ${process.execPath} (${process.version})`,
    `- 검증 범위: src ESM 앱 모듈 및 생성 상태`,
    `- 종합 결과: ${status} (${passed}/${results.length} 통과)`,
    "",
    "## 체크 결과",
    "",
    "| 항목 | 결과 | 상세 | 위치 |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| ${escapeMarkdown(result.name)} | ${result.status === "PASS" ? "PASS" : "FAIL"} | ${escapeMarkdown(
          result.detail
        )} | ${escapeMarkdown(result.location || "-")} |`
    )
  ];

  if (warnings.length > 0) {
    lines.push(
      "",
      "## 실행 경고",
      "",
      ...warnings.map((warning) => `- ${escapeMarkdown(warning)}`)
    );
  }

  const failures = results.filter((result) => result.status === "FAIL");
  if (failures.length > 0) {
    lines.push(
      "",
      "## 실패 원인",
      "",
      ...failures.map((result) => `- ${result.name}: ${result.detail} (${result.location || "위치 미상"})`)
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

function guessLocation(name) {
  if (name.includes("simulate")) return relativePath(MODULE_PATHS.engine);
  if (name.includes("ratings.js")) return relativePath(MODULE_PATHS.ratings);
  if (name.includes("ratingSource") || name.includes("능력치") || name.includes("OVR")) return relativePath(MODULE_PATHS.data);
  if (name.includes("selector")) return relativePath(MODULE_PATHS.systems);
  if (name.includes("GM 데스크")) return relativePath(MODULE_PATHS.frontOffice);
  if (name.includes("저장")) return relativePath(MODULE_PATHS.save);
  if (name.includes("선수")) return relativePath(path.join(SRC_DIR, "rosters"));
  return relativePath(SRC_DIR);
}

function relativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).replaceAll(path.sep, "/");
}

main().catch((error) => {
  results.push({
    name: "검증 스크립트",
    status: "FAIL",
    detail: error?.stack ?? error?.message ?? String(error),
    location: "tools/verify_app.mjs"
  });

  try {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, buildReport(), "utf8");
  } finally {
    console.error(error);
    process.exitCode = 1;
  }
});
