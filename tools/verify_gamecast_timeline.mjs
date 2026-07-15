import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  compilePlayTimeline,
  GAMECAST2_ATLAS_ANIMATION_KEYS,
  GAMECAST2_TIMELINE_TEMPLATES
} from "../src/gamecast2/timeline.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const ATLAS_PATH = path.join(ROOT_DIR, "assets", "gamecast", "player-home.json");

const ANCHORS = deepFreeze({
  home: { x: 480, y: 617, scale: 1.01 },
  first: { x: 758, y: 415, scale: 0.86 },
  second: { x: 480, y: 321, scale: 0.79 },
  third: { x: 202, y: 415, scale: 0.86 },
  mound: { x: 480, y: 407, scale: 0.85 },
  P: { x: 480, y: 414, scale: 0.86 },
  C: { x: 480, y: 646, scale: 1.03 },
  "1B": { x: 724, y: 438, scale: 0.88 },
  "2B": { x: 592, y: 400, scale: 0.85 },
  "3B": { x: 236, y: 438, scale: 0.88 },
  SS: { x: 368, y: 400, scale: 0.85 },
  LF: { x: 260, y: 306, scale: 0.78 },
  CF: { x: 480, y: 264, scale: 0.75 },
  RF: { x: 700, y: 306, scale: 0.78 },
  leftPole: { x: 42, y: 252, scale: 0.74 },
  rightPole: { x: 918, y: 252, scale: 0.74 }
});

const BASE_EVENT = Object.freeze({
  type: "plateAppearance",
  gameId: "verify-game",
  sequence: 7,
  hitterId: "batter",
  hitterName: "검증 타자",
  outsBefore: 0,
  outsAfter: 0,
  basesBefore: [false, false, false],
  basesAfter: [false, false, false],
  baseRunnerIdsBefore: ["", "", ""],
  baseRunnerIdsAfter: ["", "", ""],
  scoredRunners: [],
  runs: 0
});

export function verifyGamecastTimeline() {
  verifyAtlasContract();

  const cases = timelineCases();
  const compiled = cases.map(({ name, event }) => ({
    name,
    event,
    timeline: compilePlayTimeline(event, { anchors: ANCHORS })
  }));

  assert.deepEqual(
    new Set(compiled.map(({ timeline }) => timeline.template)),
    new Set(GAMECAST2_TIMELINE_TEMPLATES),
    "게임캐스트 타임라인 템플릿 커버리지가 다릅니다."
  );

  for (const item of compiled) verifyTimelineContract(item);
  verifyExistingRunnerPaths(compiled);
  verifyPurity(cases[3].event);

  return `${compiled.length}개 플레이, ${GAMECAST2_TIMELINE_TEMPLATES.length}개 템플릿, atlas anim ${GAMECAST2_ATLAS_ANIMATION_KEYS.length}키`;
}

function verifyAtlasContract() {
  const atlas = JSON.parse(fs.readFileSync(ATLAS_PATH, "utf8"));
  const available = new Set(Object.keys(atlas.animations ?? {}));
  const missing = GAMECAST2_ATLAS_ANIMATION_KEYS.filter((key) => !available.has(key));
  assert.deepEqual(missing, [], `타임라인 atlas 계약 키 누락: ${missing.join(", ")}`);
}

function verifyTimelineContract({ name, timeline }) {
  assert(Number.isFinite(timeline.durationMs) && timeline.durationMs > 0, `${name}: durationMs 오류`);
  assert.equal(timeline.tracks.pitcher[0]?.t, 0, `${name}: 투구가 타임라인 첫 동작이 아닙니다.`);
  assert.equal(timeline.tracks.pitcher[0]?.anim, "pitch", `${name}: 첫 투수 애니메이션이 pitch가 아닙니다.`);
  assert.equal(timeline.tracks.ball[0]?.phase, "pitch", `${name}: 공 트랙이 투구로 시작하지 않습니다.`);
  assert.equal(timeline.meta.pitchFirst, true, `${name}: pitch-first 메타 불변식 실패`);
  assert.equal(timeline.meta.invariants.animationContract, true, `${name}: animation atlas 계약 실패`);
  assert.equal(timeline.meta.invariants.resultAfterRunning, true, `${name}: 결과가 주루보다 먼저 표시됩니다.`);

  const animationKeys = allCues(timeline)
    .map((cue) => cue.anim)
    .filter(Boolean);
  assert(
    animationKeys.every((key) => GAMECAST2_ATLAS_ANIMATION_KEYS.includes(key)),
    `${name}: 미선언 animation 키가 있습니다.`
  );

  for (const cue of allCues(timeline)) {
    assert(cue.t >= 0 && cue.t <= 1, `${name}: cue.t 범위 오류 ${cue.t}`);
    if (cue.endT !== undefined) {
      assert(cue.endT >= cue.t && cue.endT <= 1, `${name}: cue.endT 범위/순서 오류 ${cue.t}→${cue.endT}`);
    }
    for (const pointName of cue.path ?? []) {
      assert(timeline.points[pointName], `${name}: path 점 '${pointName}'가 points에 없습니다.`);
    }
    if (cue.at) assert(timeline.points[cue.at], `${name}: at 점 '${cue.at}'가 points에 없습니다.`);
  }

  const runningEndT = Math.max(0, ...allCues(timeline)
    .filter((cue) => ["run", "walk", "slide"].includes(cue.anim))
    .map((cue) => Number(cue.endT ?? cue.t)));
  assert(timeline.resultAt > runningEndT, `${name}: resultAt ${timeline.resultAt} <= runningEndT ${runningEndT}`);
  assert.equal(timeline.tracks.captions[0]?.t, timeline.resultAt, `${name}: caption/result 시점 불일치`);
  assert.equal(timeline.tracks.result[0]?.t, timeline.resultAt, `${name}: result commit 시점 불일치`);

  if (timeline.meta.fielding) verifyFieldingArrival(name, timeline);

  const batterRun = timeline.tracks.batter.find((cue) => cue.path?.[0] === "home" && cue.path?.includes("first"));
  if (batterRun) {
    assert.deepEqual(batterRun.path.slice(0, 2), ["home", "first"], `${name}: 타자 첫 주루가 home→first가 아닙니다.`);
    assert(timeline.points.first.x > timeline.points.home.x, `${name}: 1루 진행 방향이 x 증가가 아닙니다.`);
  }
}

function verifyFieldingArrival(name, timeline) {
  const fielding = timeline.meta.fielding;
  const ball = timeline.tracks.ball.find((cue) => cue.phase === "batted");
  const fielder = timeline.tracks.fielders.find((cue) => cue.phase === "approach" && cue.who === fielding.fielder);
  assert(ball, `${name}: 타구 ball cue가 없습니다.`);
  assert(fielder, `${name}: 수비 접근 cue가 없습니다.`);
  assert.equal(ball.path.at(-1), fielding.landingPoint, `${name}: 타구 낙하지점 불일치`);
  assert.equal(fielder.path.at(-1), fielding.landingPoint, `${name}: 수비수 도착지점 불일치`);
  assert.equal(ball.endT, fielder.endT, `${name}: 공 낙하와 수비수 도착 시점 불일치`);
  assert.equal(fielding.ballArrivalT, fielding.fielderArrivalT, `${name}: fielding 메타 시점 불일치`);
  assert.equal(timeline.meta.invariants.fieldingArrivalMatchesBall, true, `${name}: fielding 도착 불변식 실패`);

  const field = timeline.tracks.fielders.find((cue) => ["field", "misplay"].includes(cue.phase) && cue.who === fielding.fielder);
  assert(field && field.t >= fielder.endT, `${name}: 포구/실책 동작이 수비 도착보다 빠릅니다.`);
  const fieldThrow = timeline.tracks.fielders.find((cue) => cue.phase === "throw" && cue.who === fielding.fielder);
  if (fieldThrow) assert(fieldThrow.t >= field.endT, `${name}: 송구가 포구보다 빠릅니다.`);
}

function verifyExistingRunnerPaths(compiled) {
  const single = compiled.find(({ name }) => name === "single-loaded")?.timeline;
  assert(single, "단타 만루 검증 타임라인이 없습니다.");
  const runnerMoves = single.tracks.runners.filter((cue) => cue.phase === "runner-advance");
  assert.equal(runnerMoves.length, 3, "단타에서 기존 주자 3명의 진루를 모두 만들지 못했습니다.");
  assert.deepEqual(
    runnerMoves.find((cue) => cue.runnerId === "r1")?.path,
    ["first", "second", "third"],
    "1루 주자의 3루 진루 경로가 다릅니다."
  );
  assert.deepEqual(
    runnerMoves.find((cue) => cue.runnerId === "r2")?.path,
    ["second", "third", "home"],
    "2루 득점 주자의 경로가 다릅니다."
  );
  assert.deepEqual(
    runnerMoves.find((cue) => cue.runnerId === "r3")?.path,
    ["third", "home"],
    "3루 득점 주자의 경로가 다릅니다."
  );

  const walk = compiled.find(({ name }) => name === "walk-loaded")?.timeline;
  const walkMoves = walk?.tracks.runners.filter((cue) => cue.phase === "runner-advance") ?? [];
  assert.deepEqual(walkMoves.find((cue) => cue.runnerId === "r1")?.path, ["first", "second"], "볼넷 밀어내기 1루 주자 경로 오류");
  assert.deepEqual(walkMoves.find((cue) => cue.runnerId === "r2")?.path, ["second", "third"], "볼넷 밀어내기 2루 주자 경로 오류");
  assert.deepEqual(walkMoves.find((cue) => cue.runnerId === "r3")?.path, ["third", "home"], "볼넷 밀어내기 3루 주자 경로 오류");

  const steal = compiled.find(({ name }) => name === "steal-success")?.timeline;
  assert.deepEqual(
    steal?.tracks.runners.find((cue) => cue.phase === "runner-advance")?.path,
    ["first", "second"],
    "도루 주자 경로 오류"
  );

  const doublePlay = compiled.find(({ name }) => name === "double-play")?.timeline;
  const forcedRunner = doublePlay?.tracks.runners.find((cue) => cue.phase === "runner-advance");
  assert.equal(forcedRunner?.out, true, "병살 선행주자가 out으로 표시되지 않았습니다.");
  assert.equal(doublePlay?.tracks.batter.find((cue) => cue.phase === "batter-run")?.out, true, "병살 타자가 out으로 표시되지 않았습니다.");
}

function verifyPurity(event) {
  const frozenEvent = deepFreeze(structuredClone(event));
  const first = compilePlayTimeline(frozenEvent, { anchors: ANCHORS });
  const second = compilePlayTimeline(frozenEvent, { anchors: ANCHORS });
  assert.deepEqual(first, second, "동일 입력의 타임라인 결과가 결정적이지 않습니다.");
  assert.notEqual(first.points.home, ANCHORS.home, "출력 points가 입력 anchor 객체를 공유합니다.");
}

function timelineCases() {
  return [
    named("strikeout", { outcome: "strikeout", outsAfter: 1 }),
    named("walk-loaded", loadedBases({
      outcome: "walk",
      basesAfter: [true, true, true],
      baseRunnerIdsAfter: ["batter", "r1", "r2"],
      scoredRunners: [{ id: "r3" }],
      runs: 1
    })),
    named("hit-by-pitch", { outcome: "HBP", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }),
    named("single-loaded", loadedBases({
      outcome: "single",
      battedBallType: "lineDrive",
      fieldingPosition: "RF",
      basesAfter: [true, false, true],
      baseRunnerIdsAfter: ["batter", "", "r1"],
      scoredRunners: [{ id: "r2" }, { id: "r3" }],
      runs: 2
    })),
    named("double", { outcome: "double", battedBallType: "lineDrive", fieldingPosition: "LF", basesAfter: [false, true, false], baseRunnerIdsAfter: ["", "batter", ""] }),
    named("triple", { outcome: "triple", battedBallType: "flyBall", fieldingPosition: "CF", basesAfter: [false, false, true], baseRunnerIdsAfter: ["", "", "batter"] }),
    named("home-run", { outcome: "homeRun", battedBallType: "flyBall", runs: 1, scoredRunners: [{ id: "batter" }] }),
    named("infield-out", { outcome: "out", battedBallType: "groundBall", fieldingPosition: "SS", outsAfter: 1 }),
    named("outfield-out", { outcome: "out", battedBallType: "flyBall", fieldingPosition: "CF", outsAfter: 1 }),
    named("double-play", {
      outcome: "out",
      battedBallType: "groundBall",
      fieldingPosition: "SS",
      doublePlay: true,
      outsAfter: 2,
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""]
    }),
    named("error", { outcome: "error", battedBallType: "groundBall", fieldingPosition: "3B", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }),
    named("steal-success", {
      type: "stolenBase",
      outcome: "stolenBase",
      success: true,
      runnerId: "r1",
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""],
      basesAfter: [false, true, false],
      baseRunnerIdsAfter: ["", "r1", ""]
    })
  ];
}

function named(name, overrides) {
  return {
    name,
    event: deepFreeze({ ...BASE_EVENT, ...overrides })
  };
}

function loadedBases(overrides) {
  return {
    basesBefore: [true, true, true],
    baseRunnerIdsBefore: ["r1", "r2", "r3"],
    ...overrides
  };
}

function allCues(timeline) {
  return Object.values(timeline.tracks).flat();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  console.log(verifyGamecastTimeline());
}
