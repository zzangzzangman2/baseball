# KBO GM 엔진 로드맵

작성일: 2026-06-30  
작성 범위: `reports/engine-roadmap.md` 신규 작성만 수행. 기존 `src/*` 파일은 수정하지 않음.

## 0. 요약

현재 `src/engine.js`는 10개 구단, 총 720경기를 deterministic하게 끝까지 진행하는 MVP 엔진이다. 핵심 장점은 단순하고 재현 가능하다는 점이다. 다만 실제 KBO GM 시뮬레이터로 확장하려면 "경기를 돌리는 함수"보다 먼저 "리그 상태를 안전하게 바꾸는 구조"가 필요하다. 다음 단계의 중심축은 실제 일정/엔트리 규칙을 담는 `GameState`, 모든 변경을 한 곳에서 처리하는 `transaction`, 변경 이력을 남기는 `eventLog`다.

상위 5개 TODO는 문서 마지막에 다시 정리했다.

## 1. 현재 구현 진단

### 현재 하는 것

- `src/data.js`는 10개 KBO 구단 seed, 2026-03-01 프리시즌 시작일, `REGULAR_SEASON_GAMES = 720`, 초기 `state` 생성 책임을 가진다.
- `src/engine.js`는 `simulateDay`, `simulateDays`, `simulateRegularSeason`으로 상태를 직접 변경한다.
- 매일 월요일은 휴식일로 처리하고, 그 외에는 10개 팀을 정렬한 뒤 원형 로테이션 방식으로 하루 5경기 매치업을 만든다.
- `state.day`, 날짜, 경기 인덱스, 팀 id, 누적 경기 수를 해시해 점수/날씨/부상 발생을 결정하므로 같은 입력이면 같은 결과가 나온다.
- 라인업은 건강한 타자 중 점수 상위 9명으로 자동 선택하고, 투수는 `buildPitchingSnapshot()`으로 선발 5명/불펜 7명/다음 선발을 나눈다.
- 경기 결과에는 타석 이벤트, 박스스코어, 선발/불펜 투수 라인 배열, W/L/S/H 결정, `game.final` 이벤트가 남는다.
- 경기 후 팀 승/패/무, 득실점, 연승/연패, 홈 관중, 선수 피로도/컨디션/부상일수, 팀 사기를 갱신한다.
- `src/systems.js`에는 로스터 요약, 포지션 needs, 유망주 watch, payroll pressure, scout board, trade block 같은 분석 selector가 있다. 다만 실제 로스터 이동/계약/트레이드를 실행하지는 않는다.
- `src/main.js`와 `src/ui.js`는 단일 메모리 상태를 UI에 전달해 버튼 클릭 시 엔진을 호출한다. `src/contracts.md`도 아직 `localStorage`를 쓰지 말라고 명시한다.

### 현재 하지 않는 것

- 실제 KBO 일정표를 사용하지 않는다. 상대전 16경기, 홈/원정 배분, 2연전/3연전/4연전, 올스타 휴식기, 우천 취소, 재편성, 더블헤더가 없다.
- 월요일 고정 휴식 가정이 강하다. 실제 리그에서는 재편성, 퓨처스, 특별 편성 등으로 "날짜별 경기 객체"가 필요하다.
- 타석 단위 v1, 선발/불펜 교체 v1, 세이브/홀드 v1은 있으나, 연장/무승부 제한/ABS/피치클락/비디오판독/정교한 blown save 리드 추적은 없다.
- 1군 등록, 출장 가능 인원, 확대 엔트리, 소속선수 정원, 외국인/아시아쿼터, 부상자 명단, 말소 후 재등록 제한이 없다.
- 선수는 계약/연봉/서비스타임/FA 등급/보상/병역/외국인 v0 속성을 갖는다. 단 실제 자료가 없는 값은 `estimated`, `fallback`, `unknown` 출처로 구분한다.
- 드래프트 풀, 스카우팅 정확도, 지명 순서, 지명권 트레이드, 계약금/입단 처리가 없다.
- 트레이드/FA/방출/웨이버/외국인 교체 같은 로스터 변경을 검증하는 transaction 계층이 없다.
- 로그가 `data.js` 초기값에서는 객체 배열이고, `engine.js`의 `addLog`는 문자열을 넣는다. UI가 흡수하고 있지만 장기 저장/리플레이 기준으로는 이벤트 스키마 통일이 필요하다.
- 저장은 아직 없지만, 다음 단계에서 무심코 `localStorage` 자동 저장을 붙이면 이전 웹 버전의 실패 원인인 비동기 저장 오염과 분산 상태가 재발할 수 있다.

## 2. 실제 KBO 기반 다음 단계 우선순위

### P0: 구조 기반

가장 먼저 엔진 변경 방식을 고정해야 한다. 현재는 함수가 상태 객체를 직접 바꾸므로 기능이 늘수록 UI, 저장, 시뮬레이션, 분석이 같은 선수/팀 객체를 각자 만지는 구조로 번지기 쉽다. KBO 규칙을 더 넣기 전에 단일 `GameState`와 transaction 경계부터 잡는 것이 우선이다.

### P1: 일정/시즌 캘린더

실제 KBO 정규시즌은 팀당 144경기, 총 720경기다. 2026시즌은 3월 28일 개막, 올스타전은 7월 11일, 올스타 휴식기는 7월 10일부터 15일까지로 발표됐다. 개막 2연전과 올스타 직후 4연전을 제외하면 주로 3연전 중심이며, 9월 6일까지 팀당 135경기 선편성, 미편성 45경기는 취소 경기와 함께 추후 편성되는 구조다.

엔진에서는 `buildMatchups()`를 계속 키우기보다 `CalendarGame`을 별도 상태로 둬야 한다.

- `gameId`, `date`, `homeTeamId`, `awayTeamId`, `stadiumId`, `seriesId`, `status`
- `scheduled`, `postponed`, `makeupScheduled`, `completed`, `cancelled`
- 날짜별 최대 경기 수, 팀별 당일 1경기 원칙, 더블헤더 예외, 이동일, 휴식일 검증
- deterministic MVP에서는 실제 전체 일정 파일이 없어도 "상대별 16경기 = 총 720경기"를 검증하는 생성기를 먼저 만들 수 있다.

더블헤더는 별도 규칙이 필요하다. 2026 변경 사항 기준으로 더블헤더는 4월 12일부터 5월 31일까지 토요일 취소 시 일요일 편성, 9이닝, 경기일 한정 특별 엔트리 2명 추가 같은 정책이 있다. 이 규칙은 코드 상수로 박지 말고 `leaguePoliciesByDate`로 둬야 한다.

### P2: 엔트리/로스터 규칙

2026 KBO 주요 규정은 소속선수 정원을 65명에서 68명으로 늘리고, 아시아쿼터 도입으로 기존 28명 등록/27명 출장에서 29명 등록/28명 출장으로 확대한 것으로 안내한다. 이후 2026년 제3차 실행위원회 보도에 따르면 올스타 브레이크 이후 한시적으로 30명 등록/28명 출장, 8월 25일부터 확대 엔트리 34명 등록/32명 출장 체제가 적용된다.

엔진에는 다음 레벨의 상태가 필요하다.

- `playersById`: 모든 선수 원장
- `rosterAssignments`: 소속팀, 1군, 퓨처스, 부상자명단, 군보류, 육성, FA, 방출
- `activeRoster`: 날짜별 등록 가능/출장 가능 인원 검증
- `gameRoster`: 그 경기 출장 가능 선수 snapshot
- `rosterMoveCooldowns`: 말소 후 재등록 제한, 트레이드 예외, 부상자 명단 예외

초기 TODO는 "29명 등록/28명 출장"을 완전 구현하는 것이 아니라, `activeRosterLimitForDate(date)`와 `validateRoster(state, teamId, date)`를 먼저 만드는 것이다. 그다음 실제 선수 이동 UI가 없어도 테스트로 규칙을 검증할 수 있다.

### P3: 외국인/아시아쿼터

2026시즌부터 아시아쿼터가 시행되며, KBO 기사 기준 대상은 아시아야구연맹 소속 국가 및 호주 국적 선수이고, 직전 또는 해당 연도 아시아 리그 소속 선수 1명으로 제한된다. 기존 외국인선수 3명과 아시아쿼터 1명을 합쳐 총 4명 보유가 가능하고 모두 한 경기에 출장 가능하다. 신규 아시아쿼터 영입 비용 한도도 연봉/계약금/옵션/이적료 합산 20만 달러로 제시되어 있다.

게임 모델:

- `player.nationality`, `foreignClass`: `domestic`, `foreign`, `asiaQuota`
- `contract.costUsd`, `transferFeeUsd`, `optionMaxUsd`
- `validateForeignSlots(teamId)`: 일반 외국인 3명, 아시아쿼터 1명
- `validateGameRosterForeignAvailability(gameId)`: 출전 제한이 바뀌면 여기서만 교체

퓨처스 시민구단 외국인 보유 한도 6명 같은 규칙은 1군 GM MVP에는 후순위다. 다만 장기적으로 퓨처스/독립/시민구단을 스카우트 풀로 쓸 경우 외국인 선수 공급 시스템과 연결된다.

### P4: 부상/피로/부상자 명단

현재 `injuredDays`는 숫자만 줄어드는 임의 부상이다. 실제 GM 플레이에는 부상자 명단과 등록일수 인정이 중요하다.

우선 상태를 이렇게 나눈다.

- `health.status`: `healthy`, `dayToDay`, `injured`, `rehab`
- `injuryRecords[]`: 부상 종류, 발생 경기/훈련, 예상 회복일, 재발 위험, IL 신청 여부
- `ilStints[]`: 10일/15일/30일, 소급일, 등록일수 인정, 연장 여부
- `availability`: 오늘 경기 출전 가능 여부

2026 변경 사항에는 시범경기 개막일 이후 경기/훈련 중 발생한 부상도 개막전 엔트리 공시 3일 이내 신청하면 부상자 명단 등재가 가능하고, 동일 부상 연장 신청자는 연장 신청부터 10일 경과 전에도 재등록할 수 있다는 내용이 있다. 이런 날짜/예외 규칙은 `leaguePoliciesByDate`에 넣는 것이 좋다.

### P5: 경기 엔진 깊이

실제 규정 반영보다 먼저 "경기 결과가 로스터 운영에 말이 되는가"가 중요하다.

- 선발 로테이션과 등판 간격
- 불펜 소모, 연투 제한, 휴식일 회복
- 포수/야수 연속 출장 피로
- 홈/원정, 구장 park factor, 날씨, 우천 취소
- 연장/무승부, 콜드/서스펜디드 게임은 후순위
- ABS, 피치클락, 체크스윙 판독, 수비 시프트 제재는 타석 단위 엔진을 만들 때 반영

현재 점수 모델은 "팀 공격력 - 상대 투수 예방력 + 사기 + 날씨"라서 MVP에는 충분하다. 다음 단계는 점수 공식을 복잡하게 만드는 것보다 투수 사용과 경기 일정의 상호작용을 만드는 쪽이 체감이 크다.

### P6: FA/계약/연봉

KBO 공식 뉴스에는 2026 FA 승인 선수 21명, 등급 A/B/C, 타 구단 FA 승인 선수 최대 3명 계약 가능 내용이 공시되어 있다. 게임 시스템은 다음을 최소 단위로 시작한다.

- `contractsByPlayerId`: 기간, 연봉, 옵션, 보장/비보장, 외국인 비용
- `serviceTime`: 1군 등록일수, FA 자격 계산용 누적
- `faStatus`: 자격 예정, 신청, 승인, 계약, 보상 필요
- `faGrade`: A/B/C 및 보상 규칙
- `compensationDecision`: 보상선수/보상금/보호선수 명단

초기 구현은 실제 FA 산식 전체보다 "스토브리그 phase에서 계약이 생성되고 payroll과 roster slot이 변한다"를 우선한다.

### P7: 신인드래프트/유망주/스카우트

2026 KBO 신인 드래프트는 전면 드래프트, 총 11라운드, 최대 110명 지명 방식으로 보도됐다. 지명 순서는 전년도 정규리그 순위 역순이며, 신인 지명권 트레이드 사례도 있었다.

게임 모델:

- `draft.year`, `rounds = 11`, `picks[]`
- `pick.ownerTeamId`와 `originalTeamId` 분리
- `prospectPool`: 고교, 대학, 얼리, 해외 아마/프로 출신
- `scoutingReports`: 도구별 현재치/잠재치/불확실성/스카우트 신뢰도
- `draftBoardByTeam`: 팀 선호, 포지션 needs, 리스크 선호

스카우트는 "정확한 능력치를 보여주는 화면"이 아니라 "불확실성을 줄이는 시스템"이어야 한다. 현재 `systems.js`의 scout board는 타팀 선수 fit 점수다. 장기적으로는 국내 신인, 외국인, 퓨처스, 트레이드 대상 각각에 대해 관찰 이벤트와 리포트 품질을 남기는 구조가 필요하다.

### P8: 트레이드

KBO 트레이드는 시즌 중 7월 31일이 사실상 중요한 마감선으로 쓰이며, 신인 지명권 트레이드도 허용되어 실제로 2026 드래프트 지명권 이동 사례가 있었다. 게임에서는 "선수 교환"보다 "검증 가능한 transaction"이 먼저다.

필수 검증:

- 양 팀 자산 존재 여부
- 선수/지명권/현금/외국인 slot/연봉 여유 검증
- 트레이드 마감일과 포스트시즌 출전 자격 플래그
- 활성 로스터 초과 시 후속 roster move 요구
- AI 팀의 needs, budget, contention 상태에 따른 수락 확률

## 3. 이전 웹 버전 실패를 피하는 구조

### 단일 GameState

상태는 하나의 객체 그래프가 기준이어야 한다. UI 컴포넌트, 저장소, 엔진 모듈이 각자 복사본을 진실처럼 들고 있으면 localStorage와 비동기 저장이 붙는 순간 오염된다.

권장 shape:

```js
{
  schemaVersion: 1,
  seasonYear: 2026,
  rngSeed: "kbo-gm-2026",
  version: 0,
  phase: "preseason",
  currentDate: "2026-03-01",
  selectedTeamId: "lg",
  leaguePoliciesByDate: [],
  calendar: {
    gamesById: {},
    gameIdsByDate: {}
  },
  teamsById: {},
  playersById: {},
  rosterAssignments: {},
  contractsByPlayerId: {},
  injuriesByPlayerId: {},
  draft: {
    year: 2027,
    picksById: {},
    prospectPoolById: {}
  },
  eventLog: []
}
```

UI 전용 값은 `selectedTeamId` 정도만 허용한다. 나머지 화면 데이터는 selector에서 계산한다.

### Transaction

엔진 변경은 모두 command를 받아 transaction 안에서만 일어난다.

```js
dispatch(state, {
  type: "SIMULATE_DAY",
  payload: { date: state.currentDate }
});
```

transaction 흐름:

1. command를 받는다.
2. precondition을 검증한다.
3. draft state 또는 patch에 변경을 적용한다.
4. invariant를 검증한다.
5. event를 만든다.
6. `state.version`을 증가시키고 commit한다.
7. commit된 snapshot만 UI와 저장소에 공개한다.

중요 원칙:

- 엔진 내부에서 `localStorage`, `Date.now()`, 네트워크, DOM 접근 금지
- deterministic RNG는 `state.rngSeed + commandId + gameId`로만 계산
- 저장은 transaction commit 이후 단일 queue에서만 실행
- UI는 state를 직접 mutate하지 않고 command만 보낸다.

### Event Log

로그는 사람이 보는 뉴스와 리플레이 가능한 이벤트를 분리한다.

```js
{
  id: "evt_000001",
  version: 17,
  date: "2026-04-03",
  type: "GAME_COMPLETED",
  actor: { type: "engine" },
  payload: {
    gameId: "2026-04-03-lg-kt-001",
    homeTeamId: "lg",
    awayTeamId: "kt",
    homeScore: 5,
    awayScore: 3
  }
}
```

사람이 보는 뉴스는 event에서 생성한 view다. 저장 대상은 event다.

### 저장 전략

1. 지금: 메모리 only + 개발용 JSON export/import.
2. 다음: Electron 환경에서 save 파일 하나를 원자적으로 쓰기. `localStorage` 자동 저장은 사용하지 않는다.
3. 중기: append-only `events.jsonl` + 주기적 `snapshot.json`.
4. 장기: SQLite.

SQLite로 갈 때의 최소 테이블:

- `save_meta(id, schema_version, season_year, current_version)`
- `snapshots(version, created_at, state_json)`
- `events(id, version, date, type, payload_json)`
- `players(player_id, current_team_id, status, static_json)`
- `contracts(player_id, team_id, start_year, end_year, payload_json)`
- `games(game_id, date, home_team_id, away_team_id, status, payload_json)`

SQLite에서도 진실은 "latest snapshot + event replay"로 유지한다. UI가 여러 테이블을 임의로 수정하는 구조로 가지 않는다.

## 4. 당장 코딩 가능한 작은 TODO

1. `state.schemaVersion`과 `state.version`을 초기 state에 추가한다.
2. `logs`를 문자열/객체 혼합에서 `eventLog`와 `newsLog`로 분리하는 마이그레이션 함수를 만든다.
3. `appendEvent(state, event)` 헬퍼를 만들고 `simulateDay`의 `addLog`를 나중에 교체할 수 있게 이벤트 타입을 정의한다.
4. `runTransaction(state, command, reducer)` 얇은 wrapper를 추가한다.
5. `SIMULATE_DAY` command를 만들고 내부에서 기존 `simulateDay`를 호출하게 해 동작을 유지한다.
6. `validateLeagueState(state)`를 만들어 팀 수, 선수 id 중복, 경기 수, 승패무 합계 같은 invariant를 점검한다.
7. `CalendarGame` 타입 주석과 `calendar.gamesById`, `calendar.gameIdsByDate` shape를 문서화한다.
8. 현재 `buildMatchups()` 결과를 `gameId`가 있는 예정 경기로 바꾸는 어댑터를 만든다.
9. 시즌 시작 시 720개 예정 경기를 먼저 생성하는 `buildSeasonCalendar()` 초안을 만든다.
10. 캘린더 검증 테스트를 추가한다: 팀당 144경기, 상대별 16경기, 전체 720경기.
11. `leaguePoliciesByDate`에 2026 기본 엔트리 29/28, 후반기 30/28, 8월 25일 34/32 규칙을 데이터로 넣는다.
12. `activeRosterLimitForDate(date)` selector를 만든다.
13. 선수 상태 enum을 `registered`, `active`, `futures`, `injuredList`, `released`, `fa`로 정리한다.
14. 기존 `injuredDays`를 유지하되 `injuryRecords`를 추가하는 backward-compatible migration을 설계한다.
15. `selectPitcher`를 "최고 점수 1명"에서 `rotationSlot`/최근 등판 피로를 고려하도록 분리한다.
16. `applyRosterUsage`에서 투수와 야수 피로 규칙을 별도 policy 함수로 추출한다.
17. `contractsByPlayerId` 최소 shape를 추가하고 현재 `payroll`은 팀 합산 seed 값으로 남긴다.
18. `draft.picksById`와 11라운드 기본 지명권 생성기를 만든다.
19. `tradeAssets` 타입을 정의한다: 선수, 지명권, 현금, 외국인 slot 관련 조건.
20. 저장은 아직 붙이지 말고, 먼저 `exportStateToJson(state)`와 `importStateFromJson(json)` 검증만 만든다.

## 5. 변경 파일 및 상위 5개 TODO

변경 파일:

- `reports/engine-roadmap.md`

상위 5개 TODO:

1. `GameState`에 `schemaVersion`, `version`, `eventLog`를 도입하고 로그 스키마를 통일한다.
2. 모든 엔진 변경을 `runTransaction(command)` 경유로 처리하게 만들어 UI 직접 mutation과 저장 오염을 차단한다.
3. `CalendarGame` 기반 시즌 캘린더를 만들고 팀당 144경기/상대별 16경기/총 720경기 invariant를 검증한다.
4. 날짜 기반 `leaguePoliciesByDate`와 `activeRosterLimitForDate()`로 2026 엔트리/확대 엔트리/아시아쿼터 규칙을 데이터화한다.
5. 선수 상태, 부상 기록, 계약/드래프트/트레이드 asset 타입을 먼저 정의해 FA/신인/트레이드 시스템의 공통 기반을 만든다.

## 6. 참고 자료

- KBO 공식 2026 주요 규정/규칙: https://www.koreabaseball.com/Kbo/League/GameManage2026.aspx
- KBO 공식 선수 등록 현황: https://www.koreabaseball.com/Player/Register.aspx
- KBO 뉴스, 2026시즌 달라지는 사항 및 아시아쿼터/부상자명단/더블헤더: https://www.koreabaseball.com/MediaNews/News/KboPhoto/View.aspx?bdSe=520974
- KBO 뉴스, 2026 FA 승인 선수 공시: https://www.koreabaseball.com/MediaNews/News/KboPhoto/View.aspx?bdSe=514301
- KBO 뉴스, 2026 신인 드래프트 11라운드/110명: https://www.koreabaseball.com/MediaNews/News/KboPhoto/View.aspx?bdSe=506896
- 2026 KBO 일정 발표 보도자료 PDF 미러: https://life.joyinfo2026.com/wp-content/uploads/2026/03/2026-KBO-%EC%A0%95%EA%B7%9C%EC%8B%9C%EC%A6%8C-%EA%B2%BD%EA%B8%B0-%EC%9D%BC%EC%A0%95-%EB%B0%9C%ED%91%9C.pdf
- 연합뉴스, KBO 트레이드 마감/기간 설명: https://www.yna.co.kr/view/AKR20220801121000007
- 연합뉴스, 퓨처스 외국인 보유 한도 및 2026 후반기 엔트리 조정: https://www.yna.co.kr/view/AKR20260608130100007
