# Codex 작업 브리핑 v2: 진짜 누상 + 라이브 도트 중계 (대형 작업)

선행 문서: `docs/gamecast-pixel-brief.md` (v1, 픽셀 캔버스 기본기 — 이미 구현됨).
이 문서는 v1 위에 **진짜 누상 상태**, **라이브 중계 재생**, **필드 아트 퀄리티**를 얹는 대형 작업이다.

---

## 0. 목표 (한 문단)

지금 Gamecast는 "마지막 타석 1개 재연 + **가짜 누상**"이다. 이걸 **마지막 경기의 최근 타석들을 시간순으로 재생하는 진짜 도트 중계**로 만든다. 다이아몬드에는 **엔진이 계산한 실제 누상 주자**가 뜨고, 안타/볼넷 시 **기존 주자가 진루·득점**하며, 스코어보드/현재타석 텍스트가 재생에 맞춰 갱신된다. 픽셀은 항상 crisp, 모션은 이징·주스로 부드럽게.

이 작업은 6개 파트다: **A 엔진(누상 방출)** → **B UI 데이터 파이프라인** → **C 진짜 누상 렌더** → **D 라이브 재생 엔진** → **E 필드 아트 퀄리티** → **F 마감/주스**.

---

## 1. 현재 상태 진단 (왜 고치는지 이해하고 시작할 것)

- 렌더 진입: `src/ui.js` `renderGamecastPanel` (L1707~1754), 캔버스 컨트롤러 `createGamecastPixelController` (L1831~1935), 프레임 `drawGamecastFrame` (L1958~1970), 그리기 함수들 (L1972~2200).
- init 훅: `initGamecastPixelScreen(root)`가 매 렌더 후 호출됨 (`render()` 내부, ui.js L283). 이전 컨트롤러를 cleanup 후 재생성 — 이 구조 유지.
- **가짜 누상(핵심 결함):** `gamecastBaseState(payload)` (ui.js L2160)가 마지막 outcome 하나로 루를 추정한다. 실제 주자를 무시하고, 삼진/아웃이면 잔루가 있어도 다이아몬드가 빈다.
- **재연 한계:** 애니메이션 소스는 `data-featured` 속성에 담긴 **이벤트 1개**뿐(`toGamecastPixelPayload`, ui.js L1784). 경기 흐름/득점 과정을 못 보여준다.
- **엔진이 누상을 안 준다:** `addPlateAppearanceEvent` (engine.js L3822)는 `outsBefore/outsAfter/runs/rbi`만 저장. 그런데 엔진 내부 `bases[]`는 정확하다(`applyPlateAppearanceOutcome`, engine.js L2579). 호출부(engine.js L3423)에 그 `bases`가 살아 있다.
- **정렬 함정:** `mergeGameEvents` (engine.js L4079)는 `이닝→sequence`로만 정렬한다. sequence는 공격 팀별로 각각 1부터라, **초(원정)와 말(홈)이 뒤섞인다.** 라이브 재생은 UI에서 `이닝→초/말→순번`으로 다시 정렬해야 한다.

---

## 2. 엔진이 주는 이벤트 스키마 (파트 A 후 최종형)

`game.plateAppearanceEvents[]`의 각 원소:

| 필드 | 타입 | 설명 |
|---|---|---|
| `outcome` | string | `single\|double\|triple\|homeRun\|walk\|strikeout\|out` |
| `inning` | number | 1~ (해당 공격 이닝) |
| `side` | `"away"\|"home"` | 초=away, 말=home |
| `sequence` | number | 공격팀 내 타석 순번(팀마다 1부터 → 전역 유일 아님) |
| `hitterName` | string | 타자명 |
| `runs` | number | 이 타석으로 난 득점 |
| `rbi` | number | 타점 |
| `outsBefore` `outsAfter` | number | 공격 누적 아웃(0~27, 이닝별 리셋 아님) |
| **`basesBefore`** | `[bool,bool,bool]` | **(신규)** 플레이 직전 [1,2,3루] 점유 |
| **`basesAfter`** | `[bool,bool,bool]` | **(신규)** 플레이 직후 점유 = 이 타석 뒤 실제 누상(**진실의 원천**) |
| **`scoredRunners`** | `[{id,name}]` | **(신규)** 이 타석에 홈인한 주자들 |
| **`inningEnded`** | bool | **(신규)** 이 타석으로 이닝 종료(3아웃) 여부 |

주의: `outs`는 공격팀 경기 전체 0~27 누적이라 **이닝 종료 = `outsAfter % 3 === 0 && outsAfter !== outsBefore`** (또는 신규 `inningEnded` 사용). 아웃은 타석당 0/1만 증가(병살 모델 없음). 볼-스트라이크 카운트는 엔진에 **없다(타석을 1롤로 판정)** → 카운트 표시 만들지 말 것. 도루는 PA 이벤트 뒤에 처리되어 피드에 없음(이번 범위 밖).

---

## 3. 파트 A — 엔진: 누상 스냅샷 방출 (작지만 정확해야 함)

**대상:** `src/engine.js` `simulateOffense`의 타석 루프(≈L3405~3435)와 `addPlateAppearanceEvent`(L3822).

### A-1. 플레이 직전 누상 캡처
`const advancement = applyPlateAppearanceOutcome({...})` **바로 위 줄**에 추가:
```js
const basesBeforePlay = [Boolean(bases[0]), Boolean(bases[1]), Boolean(bases[2])];
```

### A-2. 이벤트 생성 호출에 필드 4개 추가
기존 `addPlateAppearanceEvent(result, { ... outsBefore, outsAfter })` 호출을:
```js
addPlateAppearanceEvent(result, {
  gameId, side, offense, defense, hitter, pitcher,
  inning: inningIndex + 1,
  outcome,
  advancement,
  outsBefore: outsBeforePlay,
  outsAfter: outs,
  basesBefore: basesBeforePlay,                                          // 신규
  basesAfter: [Boolean(bases[0]), Boolean(bases[1]), Boolean(bases[2])], // 신규 (이 시점 bases는 플레이 직후)
  inningEnded: inningEnded(outsBeforePlay, outs)                         // 신규 (기존 helper 재사용)
});
```
> `inningEnded`/`outsBeforePlay`/`outs`/`bases`는 모두 그 스코프에 이미 존재한다. 엔진은 이 이벤트 push **직후** `clearBases(bases)`를 호출하므로, `basesAfter`는 이닝 종료 타석의 경우 "잔루"를 진실하게 담는다(표시 처리는 UI가 담당).

### A-3. 이벤트 객체에 저장
`addPlateAppearanceEvent`의 `const event = {...}`에 추가:
```js
basesBefore: input.basesBefore ?? [false, false, false],
basesAfter:  input.basesAfter  ?? [false, false, false],
scoredRunners: (input.advancement?.scoredRunners ?? []).map((r) => ({ id: r.id ?? "", name: r.name ?? "" })),
inningEnded: Boolean(input.inningEnded),
```

### A-4. (권장) `mergeGameEvents` 정렬 보정
`src/engine.js` L4079. 초/말 뒤섞임을 고쳐 피드/재생 순서를 바르게:
```js
.sort((a, b) => {
  const inningDiff = safeNumber(a.inning) - safeNumber(b.inning);
  if (inningDiff !== 0) return inningDiff;
  const halfDiff = (a.side === "home" ? 1 : 0) - (b.side === "home" ? 1 : 0); // 초 먼저
  if (halfDiff !== 0) return halfDiff;
  return safeNumber(a.sequence) - safeNumber(b.sequence);
});
```
UI도 자체 정렬(파트 B)을 하지만, 엔진 정렬을 고치면 기존 피드(`.gamecast-feed`)도 시간순이 된다.

### A-5. 결정론 불변 (반드시)
- 신규 필드는 **읽기 전용 캡처**다. 새 `rollUnit`/`deterministicRange` 호출을 추가하지 말 것. RNG 스트림·점수·스탯은 변경 전과 **완전히 동일**해야 한다.
- 검증: `npm run verify:balance` 수치가 변경 전과 동일해야 한다(AVG .278 / ERA 4.64 / HR 1.93 근처, seed 동일 시 동일값).

---

## 4. 파트 B — UI 데이터 파이프라인 (재생용 시퀀스)

**대상:** `src/ui.js`.

### B-1. 시퀀스 빌더
```js
const GAMECAST_PLAYBACK_COUNT = 8; // 재생할 최근 타석 수 (튜닝값)

function buildGamecastSequence(game, state) {
  const all = Array.isArray(game?.plateAppearanceEvents) ? game.plateAppearanceEvents : [];
  const chrono = [...all].sort((a, b) =>
    (Number(a.inning) - Number(b.inning)) ||
    ((a.side === "home" ? 1 : 0) - (b.side === "home" ? 1 : 0)) ||
    (Number(a.sequence) - Number(b.sequence))
  );
  const tail = chrono.slice(-GAMECAST_PLAYBACK_COUNT);
  // 재생 시작 시점의 사전 점수(꼬리 이전까지 누적)
  const tailSet = new Set(tail);
  let startAway = 0, startHome = 0;
  for (const e of chrono) {
    if (tailSet.has(e)) continue;
    if (e.side === "home") startHome += Number(e.runs || 0);
    else startAway += Number(e.runs || 0);
  }
  return {
    id: game.id ?? `${game.awayTeamId}-${game.homeTeamId}`,
    awayId: game.awayTeamId, homeId: game.homeTeamId,
    finalAway: Number(game.awayScore ?? game.awayRuns ?? 0),
    finalHome: Number(game.homeScore ?? game.homeRuns ?? 0),
    startAway, startHome,
    events: tail.map((e) => normalizeGamecastEvent(e)),
  };
}

function normalizeGamecastEvent(e) {
  return {
    outcome: String(e.outcome ?? "out"),
    inning: Number(e.inning ?? 1),
    side: e.side === "home" ? "home" : "away",
    hitterName: String(e.hitterName ?? "타자"),
    runs: Number(e.runs ?? 0),
    outsBefore: Number(e.outsBefore ?? 0),
    outsAfter: Number(e.outsAfter ?? 0),
    basesBefore: toBaseTriple(e.basesBefore),
    basesAfter: toBaseTriple(e.basesAfter),
    scoredRunners: Array.isArray(e.scoredRunners) ? e.scoredRunners.length : Number(e.runs ?? 0),
    inningEnded: Boolean(e.inningEnded) || (Number(e.outsAfter) % 3 === 0 && Number(e.outsAfter) !== Number(e.outsBefore)),
  };
}
function toBaseTriple(v){ return Array.isArray(v) ? [Boolean(v[0]),Boolean(v[1]),Boolean(v[2])] : [false,false,false]; }
```

### B-2. 렌더 → 컨트롤러 전달 (거대 data 속성 금지)
- 모듈 스코프 변수 사용: `let latestGamecastSequence = null;`
- `renderGamecastPanel`에서 `game`이 있으면 `latestGamecastSequence = buildGamecastSequence(game, state);` 세팅. 없으면 `null`.
- `data-featured`(단일 payload)는 제거하거나 rest 프레임 fallback으로만 유지.
- `initGamecastPixelScreen(root)`는 `latestGamecastSequence`를 읽어 컨트롤러에 넘긴다. 스코어보드/현재타석 텍스트도 갱신해야 하므로, DOM 참조도 함께 찾아 넘긴다:
  - 원정/홈 점수: `.gamecast-scoreline strong` 2개.
  - 현재타석: `.gamecast-now strong`, `.gamecast-now small`.

---

## 5. 파트 C — 진짜 누상 렌더 (가짜 제거)

**대상:** `src/ui.js` `gamecastBaseState`(L2160), `drawPixelDiamond`(L1996), `drawPixelBase`(L2024).

- `gamecastBaseState(payload)`를 **삭제**하고, "현재 표시할 누상"은 재생 상태가 준다(파트 D). rest(정지) 상태의 누상 = 재생 마지막 타석의 `basesAfter`(단, `inningEnded`면 빈 루).
- **주자를 베이스와 분리해 그린다.** 베이스는 흰색 정사각 그대로 두고, 점유 시 그 위에 **주자 픽셀**(2×2, `runner` + 1px `runnerL` 하이라이트, 1px `outline`)을 얹는다. 색만 바꾸지 말 것(베이스/주자 구분이 안 됨).
```js
function drawBaseAndRunner(ctx, palette, pos, occupied) {
  // 베이스(흰색) + 아래 1px 그림자
  ctx.fillStyle = palette.baseSh; ctx.fillRect(pos.x - 1, pos.y + 1, 3, 1);
  ctx.fillStyle = palette.base;   ctx.fillRect(pos.x - 1, pos.y - 1, 3, 3);
  if (!occupied) return;
  ctx.fillStyle = palette.outline; ctx.fillRect(pos.x - 1, pos.y - 3, 3, 3);
  ctx.fillStyle = palette.runner;  ctx.fillRect(pos.x, pos.y - 3, 1, 2);
  ctx.fillStyle = palette.runnerL; ctx.fillRect(pos.x, pos.y - 3, 1, 1);
}
```
- 아웃 pip(`drawPixelOutPips`)은 재생 상태의 현재 아웃을 반영(파트 D). HR "홈 점등" 로직은 제거.

---

## 6. 파트 D — 라이브 재생 엔진 (이 작업의 심장)

**대상:** `createGamecastPixelController` 및 신규 함수들.

### D-1. 재생 상태 머신
컨트롤러에 시퀀스(`latestGamecastSequence`)를 받아 상태:
```js
const play = {
  seq,                 // buildGamecastSequence 결과
  index: 0,            // 현재 타석 인덱스
  paStart: 0,          // 현재 타석 시작 시각(ms, loop 기준)
  away: seq.startAway, // 재생 중 러닝 스코어
  home: seq.startHome,
  done: false,
};
const PA_MS = 850;       // 타석당 길이
const PA_GAP_MS = 120;   // 타석 사이 여백
```
루프(rAF)에서 `elapsed = timestamp - startTime`로 현재 타석 진행도를 계산. 한 타석이 끝나면(`elapsed - paStart >= PA_MS + PA_GAP_MS`) `index++`, 스코어/텍스트 커밋. 마지막 타석 종료 시 `done=true` → **rest 상태로 정지(파트 F: rAF 중단)**.

빈 시퀀스/`prefers-reduced-motion`이면 재생 없이 rest(최종 누상+최종 점수)만 그리고 정지.

### D-2. 한 타석 애니메이션 모델 (근사 후 basesAfter로 스냅 = 진실 보정)
현재 타석 `e`, 로컬 진행 `p = clamp((elapsed - paStart)/PA_MS, 0, 1)`:

- **베이스 좌표:** `gamecastBasePositions()` 재사용. home(40,66)·1루(62,48)·2루(40,28)·3루(18,48). "홈인"은 home보다 아래(40,70) 목표로 빠지게.
- **0.00–0.15 (투구):** 공 픽셀 mound(40,46)→plate(40,63). 생략 가능하나 있으면 리듬이 산다.
- **0.15–0.72 (진루):** `adv = {single:1,double:2,triple:3,homeRun:4,walk:1}[outcome] ?? 0`.
  - **기존 주자:** `e.basesBefore`의 각 점유 루 주자는 `기준루+adv`로 이징 이동(ease-out). `기준루+adv >= 4`면 홈으로 빠지며 **홈인 연출**(아래).
  - **타자 주자:** home에서 출발해 `adv`만큼(single→1, double→2, triple→3, walk→1). `homeRun`이면 타자도 홈인. `out/strikeout`이면 타자만 1루쪽으로 짧게 돌진 후 사라짐(주자 이동 없음).
- **0.72–1.00 (정착·보정):** 주자들을 **정확히 `e.basesAfter`** 위치로 스냅(근사 tween과 달라도 basesAfter가 우선). 이때부터 rest 누상 = `basesAfter`.
- **홈인 연출:** `e.scoredRunners` 수만큼 주자가 home 아래로 빠지며, home 근처에 `+1` 픽셀 플래시(밝은 `runnerL`/`homerL`) 1~2프레임. 동시에 러닝 스코어 +1 (side에 따라 away/home).
- **아웃 pip:** 진행 중 `outsBefore→outsAfter` 반영. `inningEnded`면 3아웃 표시 후, 타석 종료 200ms 뒤 다이아몬드 **비우고** 아웃 0으로 리셋(다음 타석/이닝 준비).
- **홈런 전용:** 공이 담장 밖으로 포물선(기존 `homeRunAnimationState` 재사용/개선) + 화면 1프레임 화이트 플래시 + 패널 `is-shaking` 1회. 모든 주자 + 타자 홈인.

> 정확히 어느 주자가 어디로 갔는지는 booleans만으로 100% 복원 불가하다. 위 "adv 근사 → basesAfter 스냅"이 **의도된 설계**다. 눈으로는 살아 움직이고, 최종 상태는 항상 엔진 진실과 일치한다. 절대 basesAfter를 무시하지 말 것.

### D-3. DOM 동기화 (스코어보드/현재타석)
매 타석 커밋 시:
- `.gamecast-scoreline strong` 2개 = `play.away` / `play.home` (재생 진행에 따라 증가, 마지막엔 `finalAway/finalHome`와 일치).
- `.gamecast-now strong` = `${e.inning}회 ${e.side==="home"?"말":"초"} · ${상대/공격팀 라벨}`.
- `.gamecast-now small` = `${e.hitterName} ${outcomeLabel(e.outcome)}${e.runs>0?` · ${e.runs}득점`:""}`.
- (선택) `.gamecast-feed`에서 현재 타석에 해당하는 `<li>`에 `is-live` 클래스 부여.

`prefers-reduced-motion`이면 위 값들을 최종값으로 즉시 세팅.

---

## 7. 파트 E — 필드 아트 퀄리티 업 (80×80, 픽셀 유지)

**대상:** `drawPixelField`, `drawPixelDiamond`.

지금 필드는 잔디 디더 + 마름모뿐이라 밋밋하다. 다음을 픽셀로 추가(모두 정수좌표·anti-alias 금지):

- **외야 잔디 2톤 모우 스트라이프**를 디더 체커로(현 `grassM`/`grassL`) + 하단 내야쪽 `grassD` 미세 노이즈.
- **파울라인 2줄**: home→좌측 담장, home→우측 담장으로 `base`(흰) 1px 선.
- **홈플레이트 오각형**(픽셀): home 위치에 3~4px 흰색 픽셀 조합.
- **타석 박스 2개**: 홈플레이트 좌우 dirtL 2×3.
- **투수 마운드**: 중앙 dirtM 원 + 러버 1px `base`(현재 유사물 개선).
- **내야 흙 다이아몬드**: 현 구조 유지하되 베이스패스를 조금 더 또렷하게(`dirtL`).
- 배치: 다이아몬드를 살짝 아래로(외야/상단 스코어스트립 여유). 상단 좌측 초/말 화살표 아이콘 유지, 우측 하단 아웃 pip 유지.
- (선택·스트레치) **3×5 픽셀 숫자 폰트**로 이닝/스코어를 캔버스 상단에 얹기. 하되 순수 픽셀·정수정렬 필수. DOM과 중복이면 생략 가능.

색 수는 팔레트(v1) 안에서. 새 색 추가 최소화.

---

## 8. 파트 F — 마감/주스/성능

- **유휴 rAF 정지(중요):** 재생 완료(`done`) 또는 reduced-motion이면 최종 프레임 1회 그리고 **rAF 중단**. 지금은 끝나도 무한 재요청 → 반드시 고칠 것. 새 경기(`seq.id` 변경)로 재렌더될 때만 재생 재시작.
- **가시성/포커스:** IntersectionObserver + `visibilitychange` 유지. 화면 밖/백그라운드면 정지, 복귀 시 이어서(또는 최종 상태로).
- **리사이즈:** ResizeObserver로 정수배율 재계산 유지(v1).
- **cleanup:** rAF/timers/observers/`document` 리스너 전부 해제(v1 구조 유지). `is-shaking`/`is-live` 클래스 잔재 제거.
- **주스 절제:** 득점 `+1` 플래시, 홈런 플래시+흔들림 1회, 진루 트레일 1~2px. 상시(유휴) 움직임은 넣지 말 것(정지가 기본).
- **부드러움 = 블러 아님(재확인):** 고프레임 + 이징 + 스쿼시/트레일로. 픽셀은 항상 선명. `image-rendering: pixelated` 유지, blur 그림자 금지.

---

## 9. 반응형 / 접근성 / 세이브

- 모바일(~380px)~데스크톱 모두 정수배율로 선명. 좁으면 scale 1~2로 떨어져도 흐려지면 실패.
- 캔버스 `aria-hidden="true"` 유지. 상태 정보는 `.gamecast-now`/`.gamecast-feed` 텍스트가 담당(스크린리더).
- reduced-motion: 재생/흔들림/플래시 전부 생략, **최종 누상 + 최종 점수** 즉시.
- 세이브 roundtrip: 신규 이벤트 필드는 순수 JSON(boolean/number/string)이라 export/import 무해. 그래도 `npm run verify`로 roundtrip 확인.

---

## 10. 수용 기준 (전부 충족)

1. **진짜 누상:** 만루 안타면 다이아몬드에 주자 다수가 뜨고, 삼진/뜬공이어도 잔루가 유지된다(다음 이닝 전까지). 최종 정지 상태는 `basesAfter`와 정확히 일치.
2. **진루/득점:** 안타/볼넷 시 기존 주자가 앞으로 가고, 홈인 시 스코어보드 숫자가 오르며 `+1` 연출이 뜬다. 재생 끝 점수 = `finalAway/finalHome`.
3. **시간순 재생:** 최근 N타석이 이닝→초/말→순번 순으로 재생된다(초/말 안 뒤섞임).
4. **동기화:** 재생 중 `.gamecast-now`(이닝/타자/결과)와 스코어라인이 타석마다 갱신된다.
5. **crisp + 부드러움:** 확대해도 안티에일리어싱/블러 없음, 픽셀 크기 균일. 모션은 이징/트레일/스쿼시로 매끄럽다.
6. **성능:** 재생 종료 후 rAF 정지(프로파일러에서 유휴 시 gamecast 프레임 0). 탭 비활성/오프스크린 시 정지.
7. **결정론:** `npm run verify:balance` 수치가 변경 전과 동일. `npm run verify`, `npm run verify:browser` 통과.
8. 모바일/데스크톱 레이아웃 정상, 가로 스크롤 없음, 콘솔 에러 0.

### (권장) 검증 스크립트 보강
`tools/verify_app.mjs`에 PA 이벤트 검증 추가:
- 임의 경기의 PA 이벤트 전부에 `basesBefore/basesAfter`가 길이 3 boolean 배열로 존재.
- 득점 타석(`runs>0`)은 `scoredRunners`(또는 length)와 `runs` 정합.
- 이닝 종료 타석은 `inningEnded===true`.
- 최소 1개 경기에서 basesAfter에 2개 이상 true가 뜨는 상황(주자 누적)이 존재하는지 스모크 체크.

---

## 11. 자가 검증 절차

1. 프리뷰: `.claude/launch.json`의 `kbo` 설정(이미 있음, `python -m http.server 5177`, cwd=프로젝트)로 서버 실행. `http://127.0.0.1:5177/` 접속.
2. 새 게임 → 구단 선택 → "다음 날" 반복해 정규시즌 경기 발생.
3. Gamecast에서: 최근 타석들이 시간순 재생되는지, 주자가 실제로 여러 루에 뜨는지, 득점 시 점수 오르는지 확인.
4. 확대 스크린샷으로 픽셀 선명도 확인(블러 0).
5. DevTools 모바일(375px)/데스크톱 각각 확인. Performance 탭에서 재생 종료 후 유휴 프레임 0 확인.
6. 콘솔 에러 0. `npm run verify`, `npm run verify:balance`, `npm run verify:browser` 통과.

---

## 12. 스코프 밖 (건드리지 말 것)

- 엔진의 경기 결과/점수/스탯/RNG 로직 변경 금지(누상 **캡처**만 추가, 결정론 유지).
- 볼-스트라이크 카운트, 도루 연출(엔진 미제공) 지어내기 금지.
- 픽셀 폰트로 한글 텍스트 교체 금지. npm 빌드툴/외부 라이브러리/스프라이트 파일 추가 금지(전부 코드로 그림).
- 다른 패널의 파스텔 벡터 톤 변경 금지. 팀 로고(64×41) 캔버스에 억지로 넣지 말 것.

## 13. 픽셀아트 품질 원칙 (재확인)
- DO: 균일 픽셀, 절제된 팔레트+hue-shift, 단일 광원, 선택적 1px 어두운 외곽선, 읽히는 실루엣, 정수 스케일, 이징/오버슈트, 그라데이션은 디더링, 주자·베이스 명확 구분.
- DON'T: 픽셀 크기 혼용, 픽셀에 blur 그림자, 소수 배율, 과한 색 수, 순수 검정 외곽선 남발, 유휴 상시 움직임, basesAfter 무시.
