import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  compilePlayTimeline,
  getGamecast2PlayDurationMs,
  getGamecast2RunnerStartMs,
  GAMECAST2_ATLAS_ANIMATION_KEYS,
  GAMECAST2_TIMELINE_TEMPLATES
} from "../src/gamecast2/timeline.js";
import { derivePlateActor, gamecast2FlyResolutionCue, gamecast2TimelineCueFacing } from "../src/gamecast2/scene.js";
import { gamecastEventPlayDuration, gamecastPlaybackPosition, gamecastTotalDuration } from "../src/ui.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const ATLAS_PATHS = [
  "player-home.json",
  "player-home-night.json",
  "player-away.json",
  "player-away-night.json"
].map((name) => path.join(ROOT_DIR, "assets", "gamecast", name));
const FIELD_ANCHOR_PATHS = [
  "field-jamsil-day.anchors.json",
  "field-jamsil-night.anchors.json",
  "field-gocheok-dome.anchors.json"
].map((name) => path.join(ROOT_DIR, "assets", "gamecast2", name));
const BATTER_BOX_BOUNDS = Object.freeze({
  "field-jamsil-day": Object.freeze({ xMin: 497, xMax: 536, yMin: 603, yMax: 642 }),
  "field-jamsil-night": Object.freeze({ xMin: 496, xMax: 529, yMin: 577, yMax: 609 }),
  "field-gocheok-dome": Object.freeze({ xMin: 493, xMax: 522, yMin: 599, yMax: 630 })
});
const DEFENSE_POSITIONS = Object.freeze(["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"]);
const OUTFIELD_POSITIONS = new Set(["LF", "CF", "RF"]);
// Keep aligned with src/gamecast2/scene.js. This catches timeline endpoints
// that would otherwise be silently clamped to a different visible location.
const DEFENDER_MOVE_ZONES = Object.freeze({
  P: { x: 300, yTop: 110, yBottom: 220 },
  C: { x: 30, yTop: 42, yBottom: 12 },
  "1B": { x: 54, yTop: 42, yBottom: 45 },
  "2B": { x: 132, yTop: 80, yBottom: 80 },
  "3B": { x: 54, yTop: 42, yBottom: 45 },
  SS: { x: 184, yTop: 80, yBottom: 80 },
  LF: { x: 96, yTop: 58, yBottom: 74 },
  CF: { x: 116, yTop: 62, yBottom: 84 },
  RF: { x: 96, yTop: 58, yBottom: 74 }
});

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
  verifyFieldAnchorContract();

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

  for (const item of compiled) {
    assert.equal(
      getGamecast2PlayDurationMs(item.event),
      item.timeline.durationMs,
      `${item.name}: duration helper and compiled timeline disagree.`
    );
    verifyTimelineContract(item);
    verifyThrowTargetSemantics(item.name, item.event, item.timeline);
  }
  verifyExistingRunnerPaths(compiled);
  verifyRunnerSpeedScaling();
  verifyPlaybackClock();
  verifyDefensiveRotation(compiled);
  verifyFlyBallResolution();
  verifyFielderPositionMatrix();
  verifyThrowTargetRegressionCases();
  verifyArmDrivenThrows();
  verifyPurity(cases[3].event);

  return `${compiled.length}개 플레이, ${GAMECAST2_TIMELINE_TEMPLATES.length * DEFENSE_POSITIONS.length}개 수비 조합, atlas anim ${GAMECAST2_ATLAS_ANIMATION_KEYS.length}키`;
}

function verifyFieldAnchorContract() {
  for (const anchorPath of FIELD_ANCHOR_PATHS) {
    const payload = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
    const first = payload.anchors?.first;
    const second = payload.anchors?.second;
    const third = payload.anchors?.third;
    const batter = payload.anchors?.batter;
    const shortstop = payload.anchors?.SS;
    const secondBaseman = payload.anchors?.["2B"];
    const leftFielder = payload.anchors?.LF;
    const centerFielder = payload.anchors?.CF;
    const rightFielder = payload.anchors?.RF;
    assert(first && second && third, `${path.basename(anchorPath)}: first/second/third base anchors are missing.`);
    assert(batter, `${path.basename(anchorPath)}: authored batter-box anchor is missing.`);
    assert(shortstop && secondBaseman, `${path.basename(anchorPath)}: SS/2B anchors are missing.`);
    assert(leftFielder && centerFielder && rightFielder, `${path.basename(anchorPath)}: LF/CF/RF anchors are missing.`);
    const batterBounds = BATTER_BOX_BOUNDS[payload.fieldId];
    assert(batterBounds, `${path.basename(anchorPath)}: batter-box bounds are missing.`);
    assert(
      Number(batter.x) >= batterBounds.xMin && Number(batter.x) <= batterBounds.xMax
        && Number(batter.y) >= batterBounds.yMin && Number(batter.y) <= batterBounds.yMax,
      `${path.basename(anchorPath)}: batter anchor is outside the painted box (${batter.x}, ${batter.y}).`
    );
    const resolvedBatter = derivePlateActor(payload.anchors, "batter");
    assert(
      Math.hypot(Number(resolvedBatter?.x) - Number(batter.x), Number(resolvedBatter?.y) - Number(batter.y)) <= 0.001,
      `${path.basename(anchorPath)}: scene does not honor the authored batter anchor.`
    );
    assert(Math.abs(Number(first.y) - Number(third.y)) <= 1, `${path.basename(anchorPath)}: first/third base depth is asymmetric.`);
    assert(Math.abs(Number(shortstop.y) - Number(secondBaseman.y)) <= 1, `${path.basename(anchorPath)}: SS/2B depth is asymmetric.`);
    const middleDepths = [
      [shortstop, second, third],
      [secondBaseman, second, first]
    ].map(([fielder, upperBase, lowerBase]) => {
      const t = (Number(fielder.x) - Number(upperBase.x)) / (Number(lowerBase.x) - Number(upperBase.x));
      const baselineY = Number(upperBase.y) + (Number(lowerBase.y) - Number(upperBase.y)) * t;
      return baselineY - Number(fielder.y);
    });
    assert(
      middleDepths.every((depth) => depth >= 8 && depth <= 16),
      `${path.basename(anchorPath)}: SS/2B must play 8-16px behind the adjacent baseline (${middleDepths.map((depth) => depth.toFixed(2)).join(", ")}).`
    );
    const centerFieldDepth = Number(second.y) - Number(centerFielder.y);
    const sideFieldDepths = [
      Number(payload.anchors?.["3B"]?.y) - Number(leftFielder.y),
      Number(payload.anchors?.["1B"]?.y) - Number(rightFielder.y)
    ];
    assert(
      centerFieldDepth >= 85,
      `${path.basename(anchorPath)}: CF is too close to the middle infield (${centerFieldDepth.toFixed(1)}px).`
    );
    assert(
      sideFieldDepths.every((depth) => depth >= 135),
      `${path.basename(anchorPath)}: corner outfielders are too close to the infield (${sideFieldDepths.map((depth) => depth.toFixed(1)).join(", ")}px).`
    );
    if (payload.fieldId === "field-gocheok-dome") {
      assert.deepEqual(
        { first: [Number(first.x), Number(first.y)], third: [Number(third.x), Number(third.y)] },
        { first: [724, 445], third: [236, 445] },
        "Gocheok first/third anchors no longer match the visible base-bag centers."
      );
    }
  }
}

function verifyAtlasContract() {
  const forbiddenThrowSources = new Set(["stance", "swing", "follow", "miss", "take"]);
  for (const atlasPath of ATLAS_PATHS) {
    const atlas = JSON.parse(fs.readFileSync(atlasPath, "utf8"));
    const label = path.basename(atlasPath);
    assert.equal(atlas.meta?.registrationScaleMode, "sheet-common", `${label}: sheet-common registration is missing.`);
    const available = new Set(Object.keys(atlas.animations ?? {}));
    const missing = GAMECAST2_ATLAS_ANIMATION_KEYS.filter((key) => !available.has(key));
    assert.deepEqual(missing, [], `${label}: missing timeline atlas keys: ${missing.join(", ")}`);

    const throwFrames = atlas.animations?.throw?.frames ?? [];
    assert(throwFrames.length >= 3, `${label}: throw animation has too few frames.`);
    assert(throwFrames.every((frameName) => String(frameName).startsWith("throw_")), `${label}: throw animation references a foreign frame.`);
    const throwSources = atlas.meta?.motionSourcePoses?.throw ?? [];
    assert.equal(throwSources.length, 3, `${label}: throw equipment source contract is missing.`);
    assert(
      throwSources.every((pose) => !forbiddenThrowSources.has(String(pose))),
      `${label}: batting pose drives a fielding throw: ${throwSources.join(", ")}`
    );
  }
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
  verifyFielderCueIntervals(name, timeline);

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
  assert.equal(ball.path.at(-1), fielding.ballPoint ?? fielding.landingPoint, `${name}: 타구 도착지점 불일치`);
  if (fielding.resolution === "safe-fly-drop") {
    assert.equal(fielder.path.at(-1), fielding.missPoint, `${name}: 뜬공 안타 수비수가 헛동작 지점으로 향하지 않습니다.`);
    assert.equal(ball.endT, fielding.ballLandingT, `${name}: 뜬공 안타 낙하 시점 메타가 타구 cue와 다릅니다.`);
    assert(fielding.fielderArrivalT > fielding.ballLandingT, `${name}: 뜬공 안타 수비수가 공이 떨어지기 전에 도착합니다.`);
  } else {
    assert.equal(fielder.path.at(-1), fielding.landingPoint, `${name}: 수비수 도착지점 불일치`);
    assert.equal(ball.endT, fielder.endT, `${name}: 공 낙하와 수비수 도착 시점 불일치`);
  }
  assert.equal(fielding.ballArrivalT, fielding.fielderArrivalT, `${name}: fielding 메타 시점 불일치`);
  assert.equal(timeline.meta.invariants.fieldingArrivalMatchesBall, true, `${name}: fielding 도착 불변식 실패`);

  const field = timeline.tracks.fielders.find((cue) => ["field", "catch", "pickup", "misplay"].includes(cue.phase) && cue.who === fielding.fielder);
  assert(field && field.t >= fielder.endT, `${name}: 포구/실책 동작이 수비 도착보다 빠릅니다.`);
  const fieldThrow = timeline.tracks.fielders.find((cue) => cue.phase === "throw" && cue.who === fielding.fielder);
  if (fieldThrow) assert(fieldThrow.t >= field.endT, `${name}: 송구가 포구보다 빠릅니다.`);
}

function verifyFlyBallResolution() {
  const caught = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 801,
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    outsAfter: 1
  }, { anchors: ANCHORS });
  const safe = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 802,
    outcome: "single",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  }, { anchors: ANCHORS });
  const caughtLine = compilePlayTimeline({
    ...BASE_EVENT,
    sequence: 803,
    outcome: "out",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    outsAfter: 1
  }, { anchors: ANCHORS });

  const caughtFlight = caught.tracks.ball.find((cue) => cue.phase === "batted");
  const caughtField = caught.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "catch");
  assert.equal(caught.meta.fielding.resolution, "caught-fly", "뜬공 아웃이 포구 판정으로 표시되지 않습니다.");
  assert.equal(caughtFlight?.flightProfile, "hang", "뜬공 아웃 타구에 체공 프로필이 없습니다.");
  assert.equal(caughtFlight?.caughtDirectly, true, "뜬공 아웃 타구가 직접 포구로 표시되지 않습니다.");
  assert.equal(caughtFlight?.path?.at(-1), "catchGlove", "뜬공 아웃 타구가 글러브로 직접 향하지 않습니다.");
  assert.equal(caughtFlight?.arrivesAt, "catchGlove", "뜬공 아웃 타구의 도착점이 글러브가 아닙니다.");
  assert(!caught.tracks.ball.some((cue) => cue.bounce === true || String(cue.phase).includes("bounce")), "뜬공 아웃에 바운드 cue가 섞였습니다.");
  assert(
    Number(caught.points.catchGlove?.y) < Number(caught.points.landing?.y) - 20,
    "뜬공 아웃의 공이 야수 발밑까지 내려가 원바운드처럼 보입니다."
  );
  assert.equal(caughtField?.at, "landing", "뜬공 아웃 포구가 낙하지점에서 이뤄지지 않습니다.");
  assert.equal(caughtField?.anim, "catch", "뜬공 아웃 수비수가 포구 동작을 하지 않습니다.");
  assert(!caught.tracks.batter.some((cue) => cue.phase === "batter-run"), "뜬공 아웃 타자가 1루로 계속 달립니다.");

  const caughtLineFlight = caughtLine.tracks.ball.find((cue) => cue.phase === "batted");
  assert.equal(caughtLineFlight?.path?.at(-1), "catchGlove", "직선타 아웃 타구가 글러브로 직접 향하지 않습니다.");
  assert.equal(caughtLineFlight?.caughtDirectly, true, "직선타 아웃이 직접 포구로 표시되지 않습니다.");
  assert(!caughtLine.tracks.ball.some((cue) => cue.bounce === true), "직선타 아웃에 바운드 cue가 섞였습니다.");

  const safeFlight = safe.tracks.ball.find((cue) => cue.phase === "batted");
  const bounce = safe.tracks.ball.find((cue) => cue.phase === "safe-bounce");
  const miss = safe.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "miss");
  const recover = safe.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "recover");
  const pickup = safe.tracks.fielders.find((cue) => cue.who === "CF" && cue.phase === "pickup");
  const batterRun = safe.tracks.batter.find((cue) => cue.phase === "batter-run");
  assert.equal(safe.meta.fielding.resolution, "safe-fly-drop", "뜬공 안타가 안전 낙하 판정으로 표시되지 않습니다.");
  assert.equal(safeFlight?.path?.at(-1), "landing", "뜬공 안타가 땅에 먼저 떨어지지 않습니다.");
  assert.equal(bounce?.path?.[0], "landing", "뜬공 안타 바운드가 낙하지점에서 시작하지 않습니다.");
  assert.equal(bounce?.path?.at(-1), "pickup", "뜬공 안타 바운드가 픽업 지점으로 이어지지 않습니다.");
  assert.equal(bounce?.bounce, true, "뜬공 안타 바운드 시각 효과 플래그가 없습니다.");
  assert.equal(miss?.anim, "dive", "뜬공 안타 수비수가 헛동작을 하지 않습니다.");
  assert.deepEqual(recover?.path, ["miss", "pickup"], "뜬공 안타 수비수가 뒤늦게 공으로 회복하지 않습니다.");
  assert.equal(pickup?.at, "pickup", "뜬공 안타 픽업 동작이 공 위치와 다릅니다.");
  assert(batterRun && batterRun.out !== true, "뜬공 안타 타자 주루가 이어지지 않습니다.");
  assert(Number(safe.meta.fielding.fielderArrivalT) > Number(safe.meta.fielding.ballLandingT), "뜬공 안타 수비수가 낙하보다 늦게 도착하지 않습니다.");

  assert.equal(gamecast2FlyResolutionCue(caught, caught.meta.fielding.ballLandingT + 0.02)?.label, "OUT", "뜬공 아웃 현장 cue가 없습니다.");
  assert.equal(gamecast2FlyResolutionCue(safe, safe.meta.fielding.ballLandingT + 0.02)?.label, "SAFE HIT", "뜬공 안타 현장 cue가 없습니다.");
  assert.equal(gamecast2FlyResolutionCue(safe, safe.meta.fielding.ballLandingT - 0.02), null, "공이 떨어지기 전에 안타 cue가 표시됩니다.");
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

  const walkPitcherNumbers = walk?.tracks.pitcher
    .filter((cue) => cue.phase === "pitch")
    .map((cue) => cue.pitchNumber);
  const walkBallCues = walk?.tracks.ball.filter((cue) => cue.phase === "pitch") ?? [];
  assert.deepEqual(walkPitcherNumbers, [4], "Walk choreography must show only the decisive fourth-ball motion.");
  assert.deepEqual(walkBallCues.map((cue) => cue.pitchNumber), [4], "Walk choreography must contain only the decisive fourth pitch.");
  const walkAdvance = walk?.tracks.batter.find((cue) => cue.phase === "take-base-walk");
  assert(walkBallCues.at(-1)?.endT <= walkAdvance?.t, "The batter starts walking before ball four reaches the plate.");
  assert(walkAdvance?.t < walk?.resultAt, "The walk result appears before the batter is awarded first base.");
  assert(Number(walk?.durationMs) >= 4800, "Walk choreography is too short for a natural walk to first.");

  const strikeout = compiled.find(({ name }) => name === "strikeout")?.timeline;
  assert.deepEqual(
    strikeout?.tracks.pitcher.filter((cue) => cue.phase === "pitch").map((cue) => cue.pitchNumber),
    [3],
    "Strikeout choreography must show only the decisive third-strike motion."
  );
  assert.deepEqual(
    strikeout?.tracks.ball.filter((cue) => cue.phase === "pitch").map((cue) => cue.pitchNumber),
    [3],
    "Strikeout choreography must contain only the decisive third pitch."
  );

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

function verifyRunnerSpeedScaling() {
  const cases = [
    {
      name: "ground-single-1-to-2",
      distance: 1,
      path: ["first", "second"],
      event: {
        ...BASE_EVENT,
        outcome: "single",
        battedBallType: "groundBall",
        fieldingPosition: "2B",
        basesBefore: [true, false, false],
        baseRunnerIdsBefore: ["r1", "", ""],
        basesAfter: [true, true, false],
        baseRunnerIdsAfter: ["batter", "r1", ""]
      }
    },
    {
      name: "outfield-single-1-to-3",
      distance: 2,
      path: ["first", "second", "third"],
      event: {
        ...BASE_EVENT,
        outcome: "single",
        battedBallType: "lineDrive",
        fieldingPosition: "RF",
        basesBefore: [true, false, false],
        baseRunnerIdsBefore: ["r1", "", ""],
        basesAfter: [true, false, true],
        baseRunnerIdsAfter: ["batter", "", "r1"]
      }
    },
    ...["double", "triple"].map((outcome) => ({
      name: `${outcome}-runner-1-to-home`,
      distance: 3,
      path: ["first", "second", "third", "home"],
      event: {
        ...BASE_EVENT,
        outcome,
        battedBallType: outcome === "double" ? "lineDrive" : "flyBall",
        fieldingPosition: outcome === "double" ? "RF" : "CF",
        runs: 1,
        basesBefore: [true, false, false],
        baseRunnerIdsBefore: ["r1", "", ""],
        basesAfter: outcome === "double" ? [false, true, false] : [false, false, true],
        baseRunnerIdsAfter: outcome === "double" ? ["", "batter", ""] : ["", "", "batter"],
        scoredRunners: [{ id: "r1" }]
      }
    }))
  ];
  const runMsPerBase = new Map();

  for (const item of cases) {
    const timeline = compilePlayTimeline(item.event, { anchors: ANCHORS });
    assert.equal(
      getGamecast2PlayDurationMs(item.event),
      timeline.durationMs,
      `${item.name}: dynamic runner duration does not match the compiled timeline.`
    );
    const run = timeline.tracks.runners.find((cue) => cue.phase === "runner-advance" && cue.runnerId === "r1");
    const slide = timeline.tracks.runners.find((cue) => ["slide", "tag-play"].includes(cue.phase) && cue.runnerId === "r1");
    assert(run, `${item.name}: existing-runner cue is missing.`);
    const helperStartMs = getGamecast2RunnerStartMs(item.event);
    const timelineStartMs = Number(run.t) * timeline.durationMs;
    assert(
      Math.abs(Number(helperStartMs) - timelineStartMs) <= 0.01,
      `${item.name}: runner-start helper (${helperStartMs}ms) disagrees with timeline (${timelineStartMs}ms).`
    );
    assert.equal(run.basesAdvanced, item.distance, `${item.name}: existing runner advances the wrong number of bases.`);
    assert.deepEqual(run.path, item.path, `${item.name}: existing runner follows the wrong base path.`);
    const actualMsPerBase = ((Number(run.endT) - Number(run.t)) * timeline.durationMs) / item.distance;
    runMsPerBase.set(item.name, actualMsPerBase);
    assert(
      Math.abs(actualMsPerBase - 1400) <= 210,
      `${item.name}: existing runner pace is ${actualMsPerBase.toFixed(0)}ms/base instead of about 1400ms/base.`
    );
    if (item.distance >= 2) {
      assert(slide, `${item.name}: multi-base advance has no finishing slide.`);
      const slideMs = (Number(slide.endT) - Number(slide.t)) * timeline.durationMs;
      assert(Math.abs(slideMs - 270) <= 12, `${item.name}: slide duration is ${slideMs.toFixed(0)}ms instead of 270ms.`);
    }
    assert(
      Number(timeline.resultAt) >= Number(slide?.endT ?? run.endT),
      `${item.name}: result appears before the existing runner finishes.`
    );
  }

  const values = [...runMsPerBase.values()];
  assert(
    Math.max(...values) / Math.min(...values) <= 1.15,
    `existing-runner speed changes by play or distance: ${JSON.stringify(Object.fromEntries(runMsPerBase))}`
  );
}

function verifyPlaybackClock() {
  const cases = [
    {
      event: {
        ...BASE_EVENT,
        outcome: "single",
        battedBallType: "groundBall",
        fieldingPosition: "SS",
        basesAfter: [true, false, false],
        baseRunnerIdsAfter: ["batter", "", ""]
      },
      basesAdvanced: 1,
      expectedPath: ["home", "first"],
      legacyDurationMs: 3900,
      legacyLandingT: 0.46,
      legacyThrowEndT: null,
      fieldingDelayMs: 0
    },
    {
      event: {
        ...BASE_EVENT,
        outcome: "out",
        battedBallType: "groundBall",
        fieldingPosition: "2B",
        outsAfter: 1
      },
      basesAdvanced: 1,
      expectedPath: ["home", "first"],
      legacyDurationMs: 3500,
      legacyLandingT: 0.41,
      legacyThrowEndT: 0.64,
      fieldingDelayMs: 0
    },
    {
      event: {
        ...BASE_EVENT,
        outcome: "double",
        battedBallType: "lineDrive",
        fieldingPosition: "RF",
        basesAfter: [false, true, false],
        baseRunnerIdsAfter: ["", "batter", ""]
      },
      basesAdvanced: 2,
      expectedPath: ["home", "first", "second"],
      legacyDurationMs: 4400,
      legacyLandingT: 0.48,
      legacyThrowEndT: 0.72,
      fieldingDelayMs: 900
    },
    {
      event: {
        ...BASE_EVENT,
        outcome: "triple",
        battedBallType: "flyBall",
        fieldingPosition: "CF",
        basesAfter: [false, false, true],
        baseRunnerIdsAfter: ["", "", "batter"]
      },
      basesAdvanced: 3,
      expectedPath: ["home", "first", "second", "third"],
      legacyDurationMs: 4800,
      legacyLandingT: 0.51,
      legacyThrowEndT: 0.76,
      fieldingDelayMs: 1000,
      safeFlyRecoveryMs: 300
    }
  ];
  const sequence = {
    mode: "watch",
    paMs: 2600,
    gapMs: 340,
    events: []
  };
  const batterRunTimes = new Map();
  const oneBaseRunTimes = new Map();

  for (const item of cases) {
    const timeline = compilePlayTimeline(item.event, { anchors: ANCHORS });
    const event = {
      ...item.event,
      gamecastDurationMs: getGamecast2PlayDurationMs(item.event)
    };
    sequence.events.push(event);
    const playbackMs = gamecastEventPlayDuration(sequence, event);
    assert.equal(playbackMs, timeline.durationMs, `${timeline.template}: authored timeline duration is not used by watch playback.`);
    const run = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    assert(run, `${timeline.template}: batter-run cue is missing.`);
    assert.equal(run.basesAdvanced, item.basesAdvanced, `${timeline.template}: batter advances the wrong number of bases.`);
    assert.deepEqual(run.path, item.expectedPath, `${timeline.template}: batter follows the wrong base path.`);
    const actualRunMsPerBase = ((Number(run.endT) - Number(run.t)) * playbackMs) / item.basesAdvanced;
    batterRunTimes.set(timeline.template, actualRunMsPerBase);
    assert(
      actualRunMsPerBase >= 850,
      `${timeline.template}: batter is too fast at ${actualRunMsPerBase.toFixed(0)}ms/base.`
    );
    if (timeline.template === "single") {
      oneBaseRunTimes.set("single", actualRunMsPerBase);
      assert(actualRunMsPerBase >= 1300, `ground-ball single reaches first too quickly: ${actualRunMsPerBase.toFixed(0)}ms.`);
    } else if (timeline.template === "infieldOut") {
      oneBaseRunTimes.set("infieldOut", actualRunMsPerBase);
    }

    const actionCues = [
      ["pitch", timeline.tracks.ball.find((cue) => cue.phase === "pitch"), 0.2 * item.legacyDurationMs],
      ["landing", timeline.tracks.ball.find((cue) => cue.phase === "batted"), item.legacyLandingT * item.legacyDurationMs + item.fieldingDelayMs]
    ];
    if (item.legacyThrowEndT !== null) {
      actionCues.push([
        "throw",
        timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
        item.legacyThrowEndT * item.legacyDurationMs + item.fieldingDelayMs + Number(item.safeFlyRecoveryMs ?? 0)
      ]);
    }
    for (const [phase, cueEntry, legacyMs] of actionCues) {
      assert(cueEntry, `${timeline.template}: ${phase} cue is missing.`);
      const actualMs = Number(cueEntry.endT) * playbackMs;
      const toleranceMs = Math.max(20, legacyMs * 0.03);
      assert(
        Math.abs(actualMs - legacyMs) <= toleranceMs,
        `${timeline.template}: ${phase} timing drifted from ${legacyMs.toFixed(0)}ms to ${actualMs.toFixed(0)}ms.`
      );
    }
  }

  const oneBaseTimes = [...oneBaseRunTimes.values()];
  assert(
    Math.max(...oneBaseTimes) / Math.min(...oneBaseTimes) <= 1.15,
    `ground-ball one-base running speed changes by outcome: ${JSON.stringify(Object.fromEntries(oneBaseRunTimes))}`
  );
  const allBatterRunTimes = [...batterRunTimes.values()];
  assert(
    Math.max(...allBatterRunTimes) / Math.min(...allBatterRunTimes) <= 1.15,
    `batter running speed changes by distance: ${JSON.stringify(Object.fromEntries(batterRunTimes))}`
  );

  const emptyBasesRightFieldSingle = compilePlayTimeline({
    ...BASE_EVENT,
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    basesBefore: [false, false, false],
    baseRunnerIdsBefore: ["", "", ""],
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  }, { anchors: ANCHORS });
  const rightFieldFlight = emptyBasesRightFieldSingle.tracks.ball.find((cue) => cue.phase === "batted");
  const rightFielderRoute = emptyBasesRightFieldSingle.tracks.fielders.find((cue) => cue.who === "RF" && cue.phase === "approach");
  assert(rightFieldFlight && rightFielderRoute, "empty-bases right-field single has no RF flight/route cues.");
  const rightFieldFlightMs = (Number(rightFieldFlight.endT) - Number(rightFieldFlight.t)) * emptyBasesRightFieldSingle.durationMs;
  const rightFielderRouteMs = (Number(rightFielderRoute.endT) - Number(rightFielderRoute.t)) * emptyBasesRightFieldSingle.durationMs;
  assert(
    rightFieldFlightMs >= 1800,
    `right-field single reaches the outfield too quickly (${rightFieldFlightMs.toFixed(0)}ms after contact).`
  );
  assert(
    rightFielderRouteMs >= 1700,
    `right fielder gets to the ball too quickly (${rightFielderRouteMs.toFixed(0)}ms route).`
  );

  const expectedTotal = sequence.events.reduce((total, event) => total + event.gamecastDurationMs + sequence.gapMs, 0);
  assert.equal(gamecastTotalDuration(sequence), expectedTotal, "watch total duration does not accumulate per-play timeline durations.");
  const firstSlotMs = sequence.events[0].gamecastDurationMs + sequence.gapMs;
  const endOfFirst = gamecastPlaybackPosition(sequence, firstSlotMs - 1);
  const startOfSecond = gamecastPlaybackPosition(sequence, firstSlotMs);
  assert.equal(endOfFirst.index, 0, "playback leaves the first variable-duration event too early.");
  assert.equal(startOfSecond.index, 1, "playback does not advance at the accumulated event boundary.");
  assert.equal(startOfSecond.localMs, 0, "second event does not start at local time zero.");
  assert.equal(startOfSecond.playMs, sequence.events[1].gamecastDurationMs, "second event uses the wrong authored duration.");
  assert.equal(
    gamecastEventPlayDuration({ ...sequence, mode: "summary" }, sequence.events[0]),
    sequence.paMs,
    "summary playback no longer uses its compact fixed duration."
  );
}

function verifyFielderCueIntervals(name, timeline) {
  const grouped = new Map();
  for (const cue of timeline.tracks.fielders) {
    const entries = grouped.get(cue.who) ?? [];
    entries.push(cue);
    grouped.set(cue.who, entries);
  }
  for (const [who, entries] of grouped) {
    const ordered = [...entries].sort((a, b) => a.t - b.t || Number(a.endT ?? a.t) - Number(b.endT ?? b.t));
    for (let index = 1; index < ordered.length; index += 1) {
      const previousEnd = Number(ordered[index - 1].endT ?? ordered[index - 1].t);
      assert(
        ordered[index].t >= previousEnd - 0.000001,
        `${name}: ${who} 수비 cue가 겹칩니다 (${ordered[index - 1].phase} -> ${ordered[index].phase}).`
      );
    }
  }
}

function verifyDefensiveRotation(compiled) {
  const fielded = compiled.filter(({ timeline }) => timeline.meta.fielding);
  for (const { name, timeline } of fielded) {
    const throwBall = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
    if (!throwBall) continue;
    const target = throwBall.path?.at(-1);
    const receive = timeline.tracks.fielders.find((cue) => cue.phase === `receive-${target}`);
    assert(receive, `${name}: ${target} 송구를 받는 수비수 포구 cue가 없습니다.`);
    assert(receive.t <= throwBall.endT && receive.endT >= throwBall.endT, `${name}: 포구 cue가 공 도착 시점을 감싸지 않습니다.`);
    assert.equal(receive.at, target, `${name}: 수신 수비수와 송구 도착 베이스가 다릅니다.`);
  }

  const infieldOut = compiled.find(({ name }) => name === "infield-out")?.timeline;
  const firstCover = infieldOut?.tracks.fielders.find((cue) => cue.who === "1B" && cue.phase === "cover-first");
  assert.deepEqual(firstCover?.path, ["1B", "first"], "내야 땅볼에서 1루수가 1루 포구 위치로 움직이지 않습니다.");
  const supportKeys = new Set(
    infieldOut?.tracks.fielders
      .filter((cue) => cue.phase === "defensive-shift")
      .map((cue) => cue.who)
  );
  assert(supportKeys.size >= 5, `내야 땅볼 커버 수비가 부족합니다: ${[...supportKeys].join(", ")}`);

  const doublePlay = compiled.find(({ name }) => name === "double-play")?.timeline;
  assert(
    doublePlay?.tracks.fielders.some((cue) => cue.phase === "relay-receive-first" && cue.at === "first"),
    "병살 릴레이에서 1루 포구 수비수가 움직이지 않습니다."
  );
  const relayBall = doublePlay?.tracks.ball.find((cue) => cue.phase === "relay-throw");
  const relayReceive = doublePlay?.tracks.fielders.find((cue) => cue.phase === "relay-receive-first");
  assert(
    relayBall && relayReceive && relayReceive.t <= relayBall.endT && relayReceive.endT >= relayBall.endT,
    "병살 1루 포구 cue가 릴레이 공 도착 시점을 감싸지 않습니다."
  );
}

function verifyFielderPositionMatrix() {
  const plays = matrixPlayCases();
  let matrixCount = 0;
  for (const [playName, overrides] of plays) {
    for (const fieldingPosition of DEFENSE_POSITIONS) {
      matrixCount += 1;
      const timeline = compilePlayTimeline(
        { ...BASE_EVENT, ...overrides, sequence: matrixCount, fieldingPosition },
        { anchors: ANCHORS }
      );
      const event = { ...BASE_EVENT, ...overrides, sequence: matrixCount, fieldingPosition };
      const label = `${playName}-${fieldingPosition}`;
      verifyTimelineContract({ name: label, timeline });
      verifyThrowChains(label, timeline);
      verifyThrowTargetSemantics(label, event, timeline);
      verifyMovementCoverage(label, playName, timeline);
      verifyDefenderEndpoints(label, timeline, ANCHORS);
      if (playName === "double-play" && fieldingPosition === "1B") {
        const firstReceiver = timeline.tracks.fielders.find((cue) => cue.phase === "relay-receive-first");
        assert.equal(firstReceiver?.who, "P", "1B double-play ball must end with the pitcher covering first.");
      }
    }
  }
  assert.equal(
    matrixCount,
    GAMECAST2_TIMELINE_TEMPLATES.length * DEFENSE_POSITIONS.length,
    "The verifier did not cover the complete 12x9 play/position matrix."
  );

  for (const anchorPath of FIELD_ANCHOR_PATHS) {
    const payload = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
    const anchors = payload.anchors ?? payload;
    for (const [playName, overrides] of plays) {
      for (const fieldingPosition of DEFENSE_POSITIONS) {
        const label = `${path.basename(anchorPath)}-${playName}-${fieldingPosition}`;
        const event = { ...BASE_EVENT, ...overrides, fieldingPosition };
        const timeline = compilePlayTimeline(event, { anchors });
        verifyFielderCueIntervals(label, timeline);
        verifyThrowChains(label, timeline);
        verifyThrowTargetSemantics(label, event, timeline);
        verifyDefenderEndpoints(label, timeline, anchors);
      }
    }
  }
}

function matrixPlayCases() {
  return [
    ["strikeout", { outcome: "strikeout", outsAfter: 1 }],
    ["walk", { outcome: "walk", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["hit-by-pitch", { outcome: "HBP", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["single", { outcome: "single", battedBallType: "lineDrive", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["double", { outcome: "double", battedBallType: "lineDrive", basesAfter: [false, true, false], baseRunnerIdsAfter: ["", "batter", ""] }],
    ["triple", { outcome: "triple", battedBallType: "flyBall", basesAfter: [false, false, true], baseRunnerIdsAfter: ["", "", "batter"] }],
    ["home-run", { outcome: "homeRun", battedBallType: "flyBall", runs: 1, scoredRunners: [{ id: "batter" }] }],
    ["infield-out", { outcome: "out", battedBallType: "groundBall", outsAfter: 1 }],
    ["outfield-out", { outcome: "out", battedBallType: "flyBall", outsAfter: 1 }],
    ["double-play", {
      outcome: "out",
      battedBallType: "groundBall",
      doublePlay: true,
      outsAfter: 2,
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""]
    }],
    ["error", { outcome: "error", battedBallType: "groundBall", basesAfter: [true, false, false], baseRunnerIdsAfter: ["batter", "", ""] }],
    ["steal", {
      type: "stolenBase",
      outcome: "stolenBase",
      success: true,
      runnerId: "r1",
      basesBefore: [true, false, false],
      baseRunnerIdsBefore: ["r1", "", ""],
      basesAfter: [false, true, false],
      baseRunnerIdsAfter: ["", "r1", ""]
    }]
  ];
}

function verifyThrowChains(name, timeline) {
  const actorThrows = [...timeline.tracks.fielders, ...timeline.tracks.catcher]
    .filter((cue) => cue.anim === "throw" || String(cue.phase ?? "").includes("throw"));
  for (const cue of actorThrows) {
    assert.equal(cue.anim, "throw", `${name}: ${cue.who ?? "C"} throw cue uses '${cue.anim}' instead of throw.`);
    verifyCueFacing(name, cue, timeline.points, "thrower");
  }

  const ballThrows = timeline.tracks.ball.filter((cue) => ["fielding-throw", "relay-throw", "steal-throw"].includes(cue.phase));
  for (const ball of ballThrows) {
    const from = ball.path?.[0];
    const target = ball.path?.at(-1);
    const thrower = actorThrows.find((cue) => {
      const cueFrom = cue.at === "C" ? "home" : cue.at;
      const end = Number(cue.endT ?? cue.t);
      return cueFrom === from && cue.toward === target && cue.t <= ball.t + 0.000001 && end >= ball.t - 0.000001;
    });
    assert(thrower, `${name}: ${ball.phase} ball departs without a matching throw release cue.`);

    const receiver = timeline.tracks.fielders.find((cue) => {
      const end = Number(cue.endT ?? cue.t);
      return cue.anim === "catch" && cue.at === target && cue.t <= ball.endT + 0.000001 && end >= ball.endT - 0.000001;
    });
    assert(receiver, `${name}: ${target} receiver does not cover the ${ball.phase} arrival.`);
    assert(receiver.toward, `${name}: ${target} receiver has no incoming-throw facing point.`);
    verifyCueFacing(name, receiver, timeline.points, "receiver");
  }
}

function verifyThrowTargetSemantics(name, event, timeline) {
  const fieldingThrow = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const fieldingTarget = fieldingThrow?.path?.at(-1) ?? null;
  const runnerTarget = leadRunnerDestination(timeline);
  const canonicalTargetRaw = String(event?.defensiveThrowTarget ?? "").trim().toLowerCase();
  const canonicalTarget = ["first", "second", "third", "home"].includes(canonicalTargetRaw)
    ? canonicalTargetRaw
    : null;
  const battedType = String(event?.battedBallType ?? "").toLowerCase();
  const caughtBattedOut = timeline.outcome === "out"
    && timeline.template !== "doublePlay"
    && (battedType.includes("fly") || battedType.includes("line"));

  if (timeline.template === "single") {
    assert.equal(
      fieldingTarget,
      canonicalTarget ?? runnerTarget,
      `${name}: single throw must follow the lead existing runner; empty bases require no competitive throw.`
    );
    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    const field = timeline.tracks.fielders.find((cue) => ["field", "pickup"].includes(cue.phase));
    const outfieldSingle = OUTFIELD_POSITIONS.has(String(timeline.meta.fielding?.fielder ?? ""));
    assert(batterRun && field, `${name}: single has no batter-run/fielding cues.`);
    if (outfieldSingle) {
      assert(batterRun.endT <= field.endT, `${name}: outfielder completes the pickup unrealistically before the batter reaches first.`);
    } else {
      assert(batterRun.endT >= field.endT, `${name}: infield single batter reaches first before the fielding play develops.`);
    }
  }

  if (caughtBattedOut) {
    assert.equal(
      fieldingTarget,
      canonicalTarget ?? runnerTarget,
      `${name}: caught fly/line may throw only behind an actually advancing runner.`
    );
    assert(
      !timeline.tracks.batter.some((cue) => cue.phase === "batter-run"),
      `${name}: batter runs to first after already being retired on a catch.`
    );
    assert.equal(timeline.meta.fielding?.outRecordedAt, "landing", `${name}: caught-ball out is not recorded at the catch point.`);
  } else if (timeline.outcome === "out") {
    if (timeline.template === "doublePlay") {
      assert.equal(fieldingTarget, "second", `${name}: valid double play must take the lead force at second first.`);
    } else {
      assert.equal(fieldingTarget, canonicalTarget ?? "first", `${name}: ordinary ground-ball out uses the wrong defensive target.`);
    }

    const batterRun = timeline.tracks.batter.find((cue) => cue.phase === "batter-run");
    const firstBaseOutThrow = timeline.tracks.ball.find((cue) => (
      ["fielding-throw", "relay-throw"].includes(cue.phase)
      && cue.path?.at(-1) === "first"
    ));
    if (fieldingTarget === "first") {
      assert(
        batterRun && firstBaseOutThrow && firstBaseOutThrow.endT <= batterRun.endT,
        `${name}: first-base force arrives after the retired batter-runner.`
      );
      verifyFirstBaseReceiverSet(name, timeline, firstBaseOutThrow);
    }
  }

  if (fieldingTarget === "second") {
    assert(
      timeline.template === "doublePlay" || runnerTarget === "second" || canonicalTarget === "second",
      `${name}: unjustified throw to second without a double play or an actual runner destination.`
    );
  }

  const stealThrow = timeline.tracks.ball.find((cue) => cue.phase === "steal-throw");
  if (timeline.template === "steal") {
    if (runnerTarget === "home") {
      assert.equal(stealThrow, undefined, `${name}: steal of home creates a zero-length home-to-home throw.`);
      assert(
        timeline.tracks.catcher.some((cue) => String(cue.phase ?? "").endsWith("tag-home")),
        `${name}: steal of home has no catcher plate-tag cue.`
      );
    } else {
      assert.equal(
        stealThrow?.path?.at(-1),
        runnerTarget,
        `${name}: steal throw does not follow the runner's actual destination.`
      );
    }
  }
}

function verifyFirstBaseReceiverSet(name, timeline, throwBall) {
  const receive = timeline.tracks.fielders.find((cue) => {
    const end = Number(cue.endT ?? cue.t);
    return cue.anim === "catch"
      && cue.at === "first"
      && cue.t <= throwBall.endT + 0.000001
      && end >= throwBall.endT - 0.000001;
  });
  assert(receive, `${name}: first-base throw has no receiver planted at first.`);

  const cover = timeline.tracks.fielders.find((cue) => (
    cue.who === receive.who
    && cue.assignment === "receiver"
    && cue.path?.at(-1) === "first"
    && Number(cue.endT ?? cue.t) <= receive.t + 0.000001
  ));
  assert(cover, `${name}: first-base receiver never runs all the way to first.`);
  assert.equal(cover.arrivesAt, "first", `${name}: first-base cover lacks an explicit baseline arrival contract.`);

  const coverPoint = timeline.points?.[cover.path.at(-1)];
  const receivePoint = timeline.points?.[receive.at];
  const first = timeline.points?.first;
  assert.deepEqual(coverPoint, first, `${name}: receiver feet do not finish on the first-base anchor.`);
  assert.deepEqual(receivePoint, first, `${name}: catch pose is not rooted on the first-base anchor.`);

  const arrivalLeadT = Number(throwBall.endT) - Number(cover.endT ?? cover.t);
  const settleT = Number(receive.t) - Number(cover.endT ?? cover.t);
  assert(arrivalLeadT >= 0.119999, `${name}: first-base receiver arrives only ${arrivalLeadT.toFixed(3)}T before the ball.`);
  assert(settleT >= 0.059999, `${name}: first-base receiver has no visible foot-plant interval before the catch.`);
}

function leadRunnerDestination(timeline) {
  const rank = { first: 1, second: 2, third: 3, home: 4 };
  return timeline.tracks.runners
    .filter((cue) => cue.phase === "runner-advance")
    .map((cue) => cue.path?.at(-1))
    .filter(Boolean)
    .sort((a, b) => Number(rank[b] ?? 0) - Number(rank[a] ?? 0))[0]
    ?? null;
}

function verifyArmDrivenThrows() {
  const groundOut = (arm) => compilePlayTimeline({
    ...BASE_EVENT,
    id: `arm-ground-out-${arm}`,
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    defenderProfile: { id: "ss", arm },
    outsAfter: 1
  }, { anchors: ANCHORS });
  const weak = groundOut(60);
  const strong = groundOut(180);
  const weakThrow = weak.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const strongThrow = strong.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  assert(weakThrow && strongThrow, "Arm regression setup has no fielding throw.");
  assert.equal(weakThrow.armScore, 60, "Weak arm score was not preserved on the throw cue.");
  assert.equal(strongThrow.armScore, 180, "Strong arm score was not preserved on the throw cue.");
  assert(Number(strongThrow.arc) < Number(weakThrow.arc), "Strong arm throw is not flatter than weak arm throw.");
  assert(Number(strongThrow.flightMs) < Number(weakThrow.flightMs), "Strong arm throw is not faster than weak arm throw.");
  assert(Number(weakThrow.arc) <= 0.055 && Number(strongThrow.arc) >= 0.015, "Arm throw arc escaped the flat 0.015-0.055 range.");
  for (const timeline of [weak, strong]) {
    const throwBall = timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
    const retired = timeline.tracks.batter.find((cue) => cue.phase === "batter-run" && cue.out);
    assert(
      Number(throwBall.endT) <= Number(retired.endT) - 0.014999,
      "Recorded first-base out does not show the ball arriving .015T before the runner."
    );
  }

  const safeTriple = compilePlayTimeline({
    ...BASE_EVENT,
    id: "arm-safe-triple",
    outcome: "triple",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    defenderProfile: { id: "cf", arm: 180 },
    defensiveThrowTarget: "third",
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "batter"]
  }, { anchors: ANCHORS });
  const tripleThrow = safeTriple.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const tripleArrival = Math.max(...safeTriple.tracks.batter
    .filter((cue) => cue.path?.at(-1) === "third" || cue.at === "third")
    .map((cue) => Number(cue.endT ?? cue.t)));
  assert.equal(tripleThrow.ordering, "runner-safe-first", "Safe triple throw lacks safe-order metadata.");
  assert(Number(tripleThrow.endT) >= tripleArrival + 0.014999, "Safe triple visually shows the throw beating the runner.");

  const doublePlay = compilePlayTimeline({
    ...BASE_EVENT,
    id: "arm-double-play",
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    defenderProfile: { id: "ss", arm: 180 },
    defenseProfilesByPosition: { SS: { id: "ss", arm: 180 }, "2B": { id: "2b", arm: 60 } },
    doublePlay: true,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""]
  }, { anchors: ANCHORS });
  const firstLeg = doublePlay.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const relay = doublePlay.tracks.ball.find((cue) => cue.phase === "relay-throw");
  assert.equal(firstLeg?.armScore, 180, "Double-play first leg ignored the primary fielder arm.");
  assert.equal(relay?.armScore, 60, "Double-play relay ignored the pivot fielder arm.");
  assert(Number(firstLeg.arc) < Number(relay.arc), "Double-play relay arc does not vary by each thrower's arm.");
}

function verifyThrowTargetRegressionCases() {
  const compile = (overrides) => {
    const event = { ...BASE_EVENT, ...overrides };
    const timeline = compilePlayTimeline(event, { anchors: ANCHORS });
    return { event, timeline };
  };

  const groundOutByRightFielder = compile({
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "RF",
    outsAfter: 1
  });
  assert.equal(
    groundOutByRightFielder.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "first",
    "Regression: RF ground-ball out was thrown to second instead of first."
  );

  const caughtFly = compile({
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    outsAfter: 1
  });
  assert.equal(
    caughtFly.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: routine caught fly created an unnecessary competitive throw."
  );
  assert(!caughtFly.timeline.tracks.batter.some((cue) => cue.phase === "batter-run"), "Regression: caught-fly batter still ran to first.");

  const emptyBasesSingle = compile({
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  });
  assert.equal(
    emptyBasesSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: empty-bases single still throws to second."
  );
  verifyThrowTargetSemantics("regression-empty-bases-single", emptyBasesSingle.event, emptyBasesSingle.timeline);

  const firstToThirdSingle = compile({
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [true, false, true],
    baseRunnerIdsAfter: ["batter", "", "r1"]
  });
  assert.equal(
    firstToThirdSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "third",
    "Regression: single ignored a first-to-third runner and threw to second."
  );

  const forcedFirstToSecondSingle = compile({
    outcome: "single",
    battedBallType: "groundBall",
    fieldingPosition: "2B",
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""],
    basesAfter: [true, true, false],
    baseRunnerIdsAfter: ["batter", "r1", ""]
  });
  assert.equal(
    forcedFirstToSecondSingle.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "second",
    "Regression: an actual first-to-second forced advance did not permit a second-base throw."
  );
  verifyThrowTargetSemantics(
    "regression-forced-first-to-second-single",
    forcedFirstToSecondSingle.event,
    forcedFirstToSecondSingle.timeline
  );

  const canonicalEmptyDouble = compile({
    outcome: "double",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    defensiveThrowTarget: "second",
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  });
  assert.equal(
    canonicalEmptyDouble.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "second",
    "Regression: canonical empty-bases double target was not second."
  );
  verifyThrowTargetSemantics("regression-canonical-empty-double", canonicalEmptyDouble.event, canonicalEmptyDouble.timeline);

  const canonicalEmptyTriple = compile({
    outcome: "triple",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    defensiveThrowTarget: "third",
    basesAfter: [false, false, true],
    baseRunnerIdsAfter: ["", "", "batter"]
  });
  assert.equal(
    canonicalEmptyTriple.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "third",
    "Regression: canonical empty-bases triple target was not third."
  );
  verifyThrowTargetSemantics("regression-canonical-empty-triple", canonicalEmptyTriple.event, canonicalEmptyTriple.timeline);

  const canonicalScoringThrow = compile({
    outcome: "single",
    battedBallType: "lineDrive",
    fieldingPosition: "RF",
    defensiveThrowTarget: "home",
    runs: 1,
    basesBefore: [false, true, false],
    baseRunnerIdsBefore: ["", "r2", ""],
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""],
    scoredRunners: [{ id: "r2" }]
  });
  assert.equal(
    canonicalScoringThrow.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "home",
    "Regression: scoring runner did not produce the canonical throw home."
  );
  verifyThrowTargetSemantics("regression-canonical-scoring-throw", canonicalScoringThrow.event, canonicalScoringThrow.timeline);

  const canonicalTagUpThrow = compile({
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "RF",
    defensiveThrowTarget: "home",
    runs: 1,
    outsBefore: 0,
    outsAfter: 1,
    basesBefore: [false, false, true],
    baseRunnerIdsBefore: ["", "", "r3"],
    basesAfter: [false, false, false],
    baseRunnerIdsAfter: ["", "", ""],
    scoredRunners: [{ id: "r3" }]
  });
  const tagUpThrow = canonicalTagUpThrow.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  const tagUpCatch = canonicalTagUpThrow.timeline.tracks.ball.find((cue) => cue.phase === "batted");
  const tagUpRunner = canonicalTagUpThrow.timeline.tracks.runners.find((cue) => (
    cue.phase === "runner-advance" && cue.runnerId === "r3"
  ));
  const tagUpReceiver = canonicalTagUpThrow.timeline.tracks.fielders.find((cue) => (
    cue.anim === "catch"
    && cue.at === "home"
    && Number(cue.endT ?? cue.t) >= Number(tagUpThrow?.endT ?? 2)
  ));
  assert(tagUpCatch && tagUpRunner, "Regression: tag-up play has no caught-ball/runner cues.");
  assert(
    Number(tagUpRunner.t) >= Number(tagUpCatch.endT),
    `Regression: tag-up runner leaves before the catch (${tagUpRunner.t} < ${tagUpCatch.endT}).`
  );
  const tagUpRunMsPerBase = (
    (Number(tagUpRunner.endT) - Number(tagUpRunner.t)) * canonicalTagUpThrow.timeline.durationMs
  ) / Number(tagUpRunner.basesAdvanced ?? 1);
  assert(
    Math.abs(tagUpRunMsPerBase - 1400) <= 12,
    `Regression: tag-up runner pace is ${tagUpRunMsPerBase.toFixed(0)}ms/base instead of 1400ms/base.`
  );
  const tagUpHelperStartMs = getGamecast2RunnerStartMs(canonicalTagUpThrow.event);
  const tagUpTimelineStartMs = Number(tagUpRunner.t) * canonicalTagUpThrow.timeline.durationMs;
  assert(
    Math.abs(Number(tagUpHelperStartMs) - tagUpTimelineStartMs) <= 0.01,
    `Regression: tag-up helper (${tagUpHelperStartMs}ms) disagrees with timeline (${tagUpTimelineStartMs}ms).`
  );
  assert.equal(tagUpThrow?.path?.at(-1), "home", "Regression: tag-up scoring play ignored the canonical throw home.");
  assert(tagUpReceiver, "Regression: tag-up throw reaches home after the catcher cue has ended.");
  assert(Number(tagUpThrow.endT) <= 0.985, `Regression: tag-up throw exceeds the timeline throw boundary (${tagUpThrow.endT}).`);
  assert(
    Number(tagUpThrow.endT) >= Number(tagUpRunner.endT) + 0.014999,
    `Regression: safe tag-up shows the throw beating the scoring runner (${tagUpThrow.endT} < ${tagUpRunner.endT} + .015).`
  );
  assert(Number(canonicalTagUpThrow.timeline.resultAt) >= Number(tagUpThrow.endT), "Regression: tag-up result appears before the throw home arrives.");
  assert(
    Number(canonicalTagUpThrow.timeline.resultAt) >= Number(tagUpRunner.endT),
    "Regression: tag-up result appears before the runner reaches home."
  );
  verifyThrowChains("regression-canonical-tag-up-throw", canonicalTagUpThrow.timeline);
  verifyThrowTargetSemantics("regression-canonical-tag-up-throw", canonicalTagUpThrow.event, canonicalTagUpThrow.timeline);

  const canonicalErrorThrow = compile({
    outcome: "error",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    defensiveThrowTarget: "first",
    basesAfter: [true, false, false],
    baseRunnerIdsAfter: ["batter", "", ""]
  });
  const errorField = canonicalErrorThrow.timeline.tracks.fielders.find((cue) => cue.phase === "misplay");
  const errorThrow = canonicalErrorThrow.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw");
  assert(errorField && errorThrow, "Regression: error event has no visible misplay-followed-by-throw sequence.");
  assert.equal(errorThrow.path?.at(-1), "first", "Regression: error throw ignored its canonical first-base target.");
  assert(
    Number(errorThrow.t) >= Number(errorField.endT),
    "Regression: error throw starts before the misplay finishes."
  );

  const legacyDoubleTarget = compile({
    outcome: "double",
    battedBallType: "lineDrive",
    fieldingPosition: "LF",
    basesAfter: [false, true, false],
    baseRunnerIdsAfter: ["", "batter", ""]
  });
  assert.equal(
    legacyDoubleTarget.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
    "third",
    "Regression: legacy double inference no longer falls back to third."
  );

  for (const [label, overrides] of [
    ["no-runner", { basesBefore: [false, false, false], baseRunnerIdsBefore: ["", "", ""] }],
    ["one-out-delta", { basesBefore: [true, false, false], baseRunnerIdsBefore: ["r1", "", ""] }]
  ]) {
    const invalidDoublePlay = compile({
      outcome: "out",
      battedBallType: "groundBall",
      fieldingPosition: "SS",
      doublePlay: true,
      outsBefore: 0,
      outsAfter: 1,
      ...overrides
    });
    assert.notEqual(invalidDoublePlay.timeline.template, "doublePlay", `Regression: invalid DP (${label}) was not downgraded.`);
    assert.equal(
      invalidDoublePlay.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw")?.path?.at(-1),
      "first",
      `Regression: invalid DP (${label}) did not become a first-base out.`
    );
  }

  const airBallDoublePlayFlag = compile({
    outcome: "out",
    battedBallType: "flyBall",
    fieldingPosition: "CF",
    doublePlay: true,
    outsBefore: 0,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""]
  });
  assert.equal(airBallDoublePlayFlag.timeline.template, "outfieldOut", "Regression: fly-ball DP flag was not downgraded to a caught out.");
  assert.equal(
    airBallDoublePlayFlag.timeline.tracks.ball.find((cue) => cue.phase === "fielding-throw"),
    undefined,
    "Regression: invalid fly-ball DP still created a second-base throw."
  );

  const validDoublePlay = compile({
    outcome: "out",
    battedBallType: "groundBall",
    fieldingPosition: "SS",
    doublePlay: true,
    outsBefore: 0,
    outsAfter: 2,
    basesBefore: [true, false, false],
    baseRunnerIdsBefore: ["r1", "", ""]
  });
  assert.deepEqual(
    validDoublePlay.timeline.tracks.ball
      .filter((cue) => ["fielding-throw", "relay-throw"].includes(cue.phase))
      .map((cue) => cue.path?.at(-1)),
    ["second", "first"],
    "Regression: valid double play no longer goes second-to-first."
  );

  for (const [label, overrides] of [
    ["success", { outcome: "stolenBase", success: true, basesAfter: [false, false, true], baseRunnerIdsAfter: ["", "", "r2"] }],
    ["caught", { outcome: "caughtStealing", success: false, caught: true, out: true, outsAfter: 1, basesAfter: [false, false, false], baseRunnerIdsAfter: ["", "", ""] }]
  ]) {
    const stealThird = compile({
      type: "stolenBase",
      runnerId: "r2",
      basesBefore: [false, true, false],
      baseRunnerIdsBefore: ["", "r2", ""],
      ...overrides
    });
    assert.equal(
      stealThird.timeline.tracks.ball.find((cue) => cue.phase === "steal-throw")?.path?.at(-1),
      "third",
      `Regression: steal of third (${label}) was thrown to second.`
    );
    verifyThrowChains(`regression-steal-third-${label}`, stealThird.timeline);
    verifyThrowTargetSemantics(`regression-steal-third-${label}`, stealThird.event, stealThird.timeline);
  }

  for (const [label, overrides] of [
    ["success", { outcome: "stolenBase", success: true, runs: 1, scoredRunners: [{ id: "r3" }] }],
    ["caught", { outcome: "caughtStealing", success: false, caught: true, out: true, outsAfter: 1 }]
  ]) {
    const stealHome = compile({
      type: "stolenBase",
      runnerId: "r3",
      basesBefore: [false, false, true],
      baseRunnerIdsBefore: ["", "", "r3"],
      basesAfter: [false, false, false],
      baseRunnerIdsAfter: ["", "", ""],
      ...overrides
    });
    assert.equal(
      stealHome.timeline.tracks.ball.find((cue) => cue.phase === "steal-throw"),
      undefined,
      `Regression: steal of home (${label}) created a home-to-home throw.`
    );
    verifyThrowTargetSemantics(`regression-steal-home-${label}`, stealHome.event, stealHome.timeline);
  }
}

function verifyCueFacing(name, cue, points, role) {
  if (!cue.at || !cue.toward || !points?.[cue.at] || !points?.[cue.toward]) return;
  const deltaX = Number(points[cue.toward].x) - Number(points[cue.at].x);
  const expected = Math.abs(deltaX) < 0.01 ? 1 : deltaX > 0 ? 1 : -1;
  const actual = gamecast2TimelineCueFacing(cue, points, 0.5, "fielder");
  assert.equal(actual, expected, `${name}: ${role} faces away from '${cue.toward}'.`);
}

function verifyMovementCoverage(name, playName, timeline) {
  const movers = new Set(timeline.tracks.fielders.filter((cue) => (cue.path?.length ?? 0) > 1).map((cue) => cue.who));
  if (["single", "double", "triple", "infield-out", "outfield-out", "double-play", "error"].includes(playName)) {
    assert(movers.size >= 7, `${name}: chained defense moves only ${movers.size} players.`);
  }
  if (playName === "home-run") {
    const chaser = timeline.tracks.fielders.find((cue) => cue.phase === "warning-track");
    assert(chaser && OUTFIELD_POSITIONS.has(chaser.who), `${name}: a non-outfielder chases the home-run ball to the wall.`);
  }
}

function verifyDefenderEndpoints(name, timeline, anchors) {
  for (const cue of timeline.tracks.fielders) {
    assert(DEFENSE_POSITIONS.includes(cue.who), `${name}: unknown defender '${cue.who}'.`);
    const destinationName = cue.at ?? cue.path?.at(-1);
    const destination = timeline.points?.[destinationName];
    const origin = anchors?.[cue.who];
    const zone = DEFENDER_MOVE_ZONES[cue.who];
    if (!destination || !origin || !zone) continue;
    const dx = Number(destination.x) - Number(origin.x);
    const dy = Number(destination.y) - Number(origin.y);
    assert(
      dx >= -zone.x - 0.000001 && dx <= zone.x + 0.000001 &&
        dy >= -zone.yTop - 0.000001 && dy <= zone.yBottom + 0.000001,
      `${name}: ${cue.who} ${cue.phase} endpoint is clamped by the scene (dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}).`
    );
  }
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
