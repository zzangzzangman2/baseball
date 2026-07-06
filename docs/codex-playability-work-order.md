# Codex 작업지시서: KBO GM — "플레이어블 게임" 완성 로드맵

작성일: 2026-07-06
작성 기준: 전체 코드/문서 전수 분석 (`src/engine.js` 7,361줄, `src/ui.js` 7,648줄 포함 약 2.8만 줄) + `npm run verify` 30항목 전부 PASS 확인 시점.
이 문서 하나로 착수 가능하도록 현재 상태 → 갭 → 작업 패키지(WP) → 수용 기준 → 검증 루틴을 모두 담았다.

---

## 0. 한 줄 요약

시즌 루프(720경기·포스트시즌·오프시즌·롤오버)는 이미 완주하고 검증도 통과한다. 그러나 지금은 **"유저가 보는 시뮬레이션"에 가깝고 "유저가 운영하는 게임"이 아니다.** 유저 결정권은 라인업 9명·트레이드 확정·FA 사인 3개뿐이고, FM의 핵심 재미인 드래프트 지명, 투수 운용, 1군/2군 엔트리, 기록 열람이 전부 자동/읽기전용이다. **P0 = 유저 결정권 완성, P1 = KBO 규칙 충실도, P2 = 운영 깊이** 순서로 간다.

---

## 1. 현재 상태 스냅샷 (2026-07-06)

### 1.1 동작이 검증된 것 (`npm run verify` 30항목 PASS)

| 영역 | 상태 | 핵심 코드 |
| --- | --- | --- |
| 데이터 | 10구단 실명, 531명(공식 등록/퓨처스 기반 530명 ratingSource), 47개 능력치(내부 1-20), OVR/POT 0-200 | `src/rosters/`, `src/ratings.js` |
| 시즌 루프 | 2026-03-01 프리시즌 → 정규 720경기(팀당 144) → 포스트시즌(WC/준PO/PO/KS) → 시상식 → 자동 오프시즌 → 2027 롤오버, 전부 deterministic | `simulateDay()` engine.js:468, `runAutonomousOffseason()` engine.js:1134 |
| 경기 엔진 | 타석 단위 몬테카를로 v1: 좌우 스플릿, 구장 파크팩터, 날씨, 포지션군 수비, 실책/병살, 도루, W/L/SV/HLD 판정 | `simulateOffense()` engine.js:4286, `resolvePlateAppearance()` engine.js:4435 |
| 투수 운용 | 선발 5인 로테이션 + 불펜 7인(LR/MR/SU/CL 자동 배정), 스태미나/투구수/armFreshness 기반 교체 | `buildPitchingSnapshot()` engine.js:220 |
| 컨디션/부상 | fatigue/form/sharpness/armFreshness 일일 갱신, 부상 확률→`injuredDays` 2~14일 | engine.js:5479-5534 부근 |
| 드래프트 | 신인 11R 110픽(익명 코드 `DRF-` 후보 150명 풀, 팀별 AI 전략, 20-80 등급), 2차 드래프트(보호 35인, 36픽, 양도금) — **전부 CPU 자동** | `initializeDraft()` engine.js:661, `initializeSecondaryDraft()` engine.js:749 |
| 트레이드 | v2 command: 선수 1명+보조자산(현금/지명권/조건부/PTBNL), 23개 reject 게이트, 검토 잠금→확정 UI | `commitTradeProposal()` engine.js:2717 |
| FA/외국인 | FA 등급 A/B/C 보상 룰, 오퍼→사인 command, 외국인은 `FGN-` 코드형 권리 ledger만(실명 미등록 정책) | `commitFreeAgentSigning()` engine.js:907 |
| 은퇴/방출 | 롤오버 시 나이 기반 자동 은퇴 + 로스터 상한(74) 정리 | `shouldRetirePlayer()` engine.js:2056 |
| 저장 | JSON export/import roundtrip 검증 통과 (localStorage 미사용 정책) | `src/save.js` |
| UI | 11개 탭(클럽하우스/뉴스함/일정/라인업/선수단/순위/프런트/시장/드래프트/가을야구/시스템), 온보딩 4화면, 도트 게임캐스트(Phaser+Canvas 이중 렌더러), 긴급 메일 결정 팝업 | `src/ui.js`, `src/gamecastPhaser.js` |
| 밸런스 | 한 시즌 전체 기준 AVG .278 / OBP .347 / SLG .410 / ERA 4.64 / 경기당 HR 1.93 (2024 KBO 기준 검증) | `tools/verify_balance.mjs` |

### 1.2 유저가 실제로 내릴 수 있는 결정 (현재 전부)

1. 타순 9명 수동 편성 + 자동 추천 (라인업 탭)
2. 트레이드 제안 검토 잠금 → 확정 (시장 탭)
3. FA / 외국인(코드형) 계약 사인 (시장 탭)
4. 긴급 메일 결정 (부상 말소/외국인 라인업/트레이드 제안/웨이버 클레임 — 단 선택지는 하드코딩 fallback이 대부분, ui.js:1083 `fallbackDecisionOptions`)
5. 진행 버튼: 다음 날 / 빠른 주간 / 경기 관전 / 경기 스킵 / 드래프트·2차·FA·포스트시즌·다음 시즌 개시
6. 저장 export / import

**그 외 전부 자동이거나 읽기전용이다**: 드래프트 지명, 2차 드래프트 보호명단, 선발 로테이션 순서, 불펜 역할, 마무리 지정, 벤치, 1군/2군 이동, 방출, 연봉협상, 스카우트 업무.

---

## 2. 절대 가드레일 (모든 WP 공통)

1. **결정론 유지.** 새 확률/랜덤은 반드시 기존 `rollUnit`/`hashParts` 패턴으로. `Date.now()`, `Math.random()` 직접 사용 금지. 같은 세이브+같은 커맨드 = 같은 결과.
2. **실명 임의 생성 금지.** 선수명/팀/포지션/투타/생년월일을 만들어내지 않는다. 미검증 신인·외국인은 기존 `DRF-YYYY-###`, `FGN-YYYY-###` 코드형 정책 유지.
3. **검증 3종 통과 유지.** 매 WP 완료 시 `npm run verify`, `npm run verify:balance`, `npm run verify:browser` 전부 PASS여야 한다. 경기 확률을 건드리면 balance 기준(AVG .278 / ERA 4.64 / HR 1.93 근방)을 벗어나면 안 된다.
4. **verify에 항목 추가.** 새 시스템은 `tools/verify_app.mjs`에 검증 케이스를 같이 넣는 것이 이 리포 관례다 (현재 30항목 스타일 참고).
5. **엔진이 진실, UI는 재생.** 상태 변경은 engine.js의 command 함수(`commit*`, `initialize*`)로만. UI에서 state 직접 mutation 금지.
6. **localStorage 자동저장 금지.** 저장은 JSON export/import 유지 (이전 웹버전 실패 원인, `reports/engine-roadmap.md` §3 참고).
7. **state shape 변경 시** `save.js` roundtrip과 기존 세이브 호환(마이그레이션 함수)을 함께 처리. `schemaVersion` 필드 도입은 WP-18 참조.
8. **충돌 주의:** 현재 작업트리에 게임캐스트 관련 미커밋 변경이 있다(`src/gamecastPhaser.js`, `assets/gamecast/*`, `tools/build_gamecast_sprites.py`). 이 파일들은 별도 작업 중이므로 이번 지시서 범위에서 건드리지 말 것.
9. 규정 수치(엔트리 정원, 연장 이닝 등)는 코드에 하드코딩하지 말고 **`leaguePoliciesByDate` 데이터로** 넣고 source URL 주석을 남긴다 (`reports/engine-roadmap.md` 관례).

---

## 3. 우선순위 로드맵 요약

| 순위 | 패키지 | 왜 먼저인가 |
| --- | --- | --- |
| **P0** | WP-01~05: 드래프트 직접 지명, 2차D 보호명단, 투수 운용 편집, 리그 기록실, 상세 박스스코어 | 유저 결정권과 피드백(기록)이 게임의 본체. 전부 엔진은 이미 있고 UI/command만 없다 → 가성비 최고 |
| **P1** | WP-06~11: 실제 일정 구조, 연장/무승부, 엔트리(1군/2군), 외국인 슬롯 강제, 부상 v2, 우천/더블헤더 | "KBO답다"는 체감. 규칙 데이터화 필요 |
| **P2** | WP-12~17: 재정 루프, 연봉협상/방출/웨이버, 스카우트 루프, 군보류, 뉴스 데이터화, 코칭스태프 | 운영 깊이/장기 리플레이성 |
| **P3** | WP-18~20: 저장 스키마 v2/명예의전당, 타석엔진 v2(작전), KBO 이사회/정치 | 대형 구조 작업 |

한 번에 하나의 WP만. 각 WP는 독립 커밋 + verify 통과 상태로 끝낸다.

---

## 4. P0 — 유저 결정권 완성

### WP-01. 신인 드래프트 유저 직접 지명

- **현재**: `initializeDraft()`(engine.js:661)가 150명 코드형 풀 생성 후 110픽을 **전부 CPU가 자동 지명**. 드래프트 탭 UI는 결과 보드 읽기전용.
- **목표**: 내 팀 픽 차례에 유저가 직접 지명. FM/OOTP의 핵심 재미.
- **스펙**:
  - 엔진: 드래프트를 픽 단위 진행형으로 분리 — `advanceDraftPick(state)` (CPU 픽 1개 진행), `commitUserDraftPick(state, { prospectId })` (유저 픽 검증+확정). 유저 차례에서 자동 진행이 멈추는 `draft.pendingUserPick` 상태 추가.
  - 검증: 이미 지명된 후보 reject, 유저 차례 아닐 때 reject, 풀에 없는 id reject.
  - UI(드래프트 탭): 후보 보드에 20-80 스카우팅 등급/포지션/나이 표시(이미 데이터 있음), 정렬/포지션 필터, [지명] 버튼, "내 차례까지 자동 진행" / "전체 자동(현행 유지)" 버튼 둘 다 제공.
  - 지명 결과는 기존 `draft.rosterLedger` 흐름 그대로 태워서 오프시즌 입단 처리와 호환 유지.
- **수용 기준**: 유저가 11라운드 전부 수동 지명으로 완주 가능 + 전체 자동 위임도 기존과 동일하게 동작 + verify의 "신인 드래프트 v1" 항목 계속 PASS + 유저픽 검증 케이스 추가.

### WP-02. 2차 드래프트: 보호명단 편집 + 유저 지명

- **현재**: `initializeSecondaryDraft()`(engine.js:749)가 보호 35인을 OVR순 자동 산출, 지명도 전부 자동. UI 읽기전용.
- **스펙**:
  - 엔진: `setSecondaryDraftProtection(state, { playerIds })` — 35명 검증(인원수/자격/자팀 소속) 후 보호명단 교체. `commitUserSecondaryPick(state, { playerId })` + WP-01과 동일한 픽 단위 진행 구조.
  - UI: 보호명단 편집 화면(자동 추천값을 기본으로 깔고 스왑 방식), 내 픽 차례에 비보호 풀에서 선택.
  - 원소속팀 피지명 4명 제한 등 기존 게이트 유지.
- **수용 기준**: 보호명단에서 1명 빼고 다른 1명 넣은 결과가 실제 지명 풀에 반영됨. 기존 verify "2차 드래프트 v1" PASS 유지.

### WP-03. 투수 운용 편집 (로테이션/불펜 역할/마무리)

- **현재**: `buildPitchingSnapshot()`(engine.js:220)이 선발 5인·불펜 역할(LR/MR/SU/CL)을 점수로 자동 배정. 라인업 탭은 타순 9명만 편집 가능, 투수 보드는 읽기전용. 타순 수동 편성은 `manualLineups` 유사 구조로 이미 우선 적용됨(개막 라인업 verify에 "수동 라인업 우선 적용" 문구 존재) — 같은 패턴을 투수로 확장하면 된다.
- **스펙**:
  - `team.pitchingPlan` (또는 기존 수동 라인업 저장 위치와 동일한 레이어)에 `{ rotationOrder: [playerId x5], closerId, setupIds, longReliefIds }` 저장.
  - `buildPitchingSnapshot()`이 plan이 있으면 우선 적용, 무효(부상/이적/은퇴 선수 포함)면 해당 슬롯만 자동 보충.
  - UI(라인업 탭): 로테이션 1~5 순서 변경, 마무리/셋업 지정 드롭다운, "자동 추천으로 초기화" 버튼.
  - 다음 선발 예고(이미 nextStarter 데이터 있음)에 plan 반영.
- **수용 기준**: 마무리를 다른 투수로 지정하면 이후 경기 세이브 상황 등판이 그 투수로 바뀜(박스스코어로 확인 가능). 로테이션 순서 변경이 다음 5경기 선발에 반영. verify에 "수동 투수 운용 우선 적용" 케이스 추가.

### WP-04. 리그 기록실 (리더보드 / 팀 기록 / 커리어 히스토리)

- **현재**: 선수 상세에 당해 시즌 스탯만 표시. `renderSeasonLeaders`는 상위 5명 카드 수준. 리그 전체 리더보드/팀 기록/역대 기록 화면 없음. **치명 갭: 롤오버 시 시즌 기록이 리셋되며 어디에도 보존되지 않는다** — 다년 플레이의 기록 재미가 통째로 사라짐.
- **스펙**:
  - 엔진: 롤오버 직전에 `player.history[]`로 시즌 스탯 아카이브 `{ year, teamId, batting, pitching, fielding, awards }` push (rollover 함수는 `runAutonomousOffseason` 하위, engine.js:1921-2115 부근의 리셋 지점). `state.leagueHistory[]`에 `{ year, standings, champion, awards, leaders }` 아카이브.
  - UI: 새 "기록실" 탭 또는 순위 탭 확장 — ① 시즌 리더보드(타자: AVG/HR/RBI/SB/OPS, 투수: ERA/W/SV/HLD/K, 규정타석·규정이닝 필터 — 팀 경기수×3.1 타석, ×1.0 이닝), ② 팀 팀타율/팀ERA/득실점 테이블, ③ 선수 상세에 연도별 커리어 테이블, ④ 역대 시즌 요약(우승/MVP 목록).
  - 규정 미달 선수 토글 제공.
- **수용 기준**: 2026 시즌을 끝내고 2027로 넘어간 뒤에도 2026 기록/수상/순위를 기록실과 선수 상세에서 조회 가능. verify에 "롤오버 후 히스토리 보존" 케이스 추가. 저장 roundtrip 통과.

### WP-05. 상세 박스스코어 + 경기 로그

- **현재**: 최근 경기에 9이닝 라인스코어·타자/투수 라인·`plateAppearanceEvents`가 **이미 저장**되지만(implementation-status §box score), UI는 미니 카드(점수 4칸)뿐. 포스트시즌 경기는 상세 기록 표시 없음.
- **스펙**: 경기 카드 클릭 → 모달: 라인스코어(R/H/E), 타자 전원 AB/R/H/RBI/BB/SO/AVG, 투수 IP/H/R/ER/BB/K/투구수, 결승타/W-L-S-H 표기, 타석 로그 텍스트(이닝별 그룹). 데이터는 기존 boxScore/plateAppearanceEvents 재사용 — 엔진 변경 불필요. 포스트시즌 탭의 각 경기에도 동일 모달 연결.
- **수용 기준**: 정규시즌/포스트시즌 아무 경기나 열어 타자 9명+투수 라인 전부 확인 가능. verify:browser에 모달 렌더 체크 추가.

---

## 5. P1 — KBO 규칙 충실도

### WP-06. 시즌 캘린더 v2 (시리즈 구조)

- **현재**: `buildMatchups()`가 날마다 원형 로테이션으로 5경기 생성, 월요일 휴식만 반영. 상대별 16경기 보장 없음, 연전(시리즈) 개념 없음, 올스타 브레이크 없음.
- **스펙** (`reports/engine-roadmap.md` §P1 설계 그대로 따를 것):
  - 시즌 시작 시 720경기를 `CalendarGame{ gameId, date, home, away, stadiumId, seriesId, status }`로 선생성: 상대별 16경기(홈8/원정8), 화~목 + 금~일 3연전 축, 월요일 휴식, 개막 2연전(3/28), 올스타 브레이크 7/10~7/15.
  - `simulateDay`는 매치업 생성 대신 캘린더 조회로 전환. deterministic 생성기(시드 고정).
  - 일정 탭 캘린더에 시리즈 단위 표시(이미 월 네비 UI 있음).
- **수용 기준**: verify에 invariant 추가 — 팀당 144, 상대별 정확히 16(홈8/원정8), 총 720, 팀별 하루 1경기, 월요일 0경기, 올스타 기간 0경기. 기존 시즌 완주/밸런스 PASS 유지.

### WP-07. 연장전 + 무승부 규칙

- **현재**: 정규시즌 9회 동점 = 즉시 무승부(engine.js:4279 `ties += 1`, 연장 없음). 포스트시즌만 10회 강제 결판(`forcePostseasonDecision` engine.js:3110) — 실제 KBO와 둘 다 다름.
- **스펙**:
  - 정규시즌: 동점 시 최대 12회까지 연장, 12회 종료 동점 = 무승부. 포스트시즌: 최대 15회, 15회 동점 = 서스펜디드 대신 v1은 무승부 후 시리즈 재경기 편성(간단화 가능, 정책 데이터로).
  - 이닝 수치는 `leaguePoliciesByDate`에 `{ regularExtraInnings: 12, postseasonExtraInnings: 15 }`로 (2026 공식 규정은 리포 참고자료 koreabaseball.com GameManage2026 페이지로 확인 후 소스 주석).
  - `simulateOffense`의 27아웃/92타석 상한(engine.js:4328 부근)을 연장 이닝만큼 확장, 라인스코어 10회+ 칸 지원(박스스코어 UI 포함).
  - `forcePostseasonDecision`의 인위적 +1.8 홈 보정 제거하고 실제 연장 이닝 시뮬로 대체.
- **수용 기준**: 한 시즌 무승부 수가 현실 범위(팀당 0~5, 리그 10~25 수준)로 나오고 밸런스 검증 PASS 유지. 연장 경기 박스스코어가 10회 이상 라인스코어로 표시.

### WP-08. 엔트리/1군·2군 로스터 트랜잭션

- **현재**: `status: futures` 태그만 있고 이동 수단이 없음. 경기 라인업은 active 로스터 자동 선발. 엔트리 정원 개념 없음.
- **스펙** (`reports/engine-roadmap.md` §P2 설계 따름):
  - `leaguePoliciesByDate`: 2026 기준 등록 29/출장 28, 후반기(올스타 후) 30/28, 8/25부터 확대 34/32.
  - command: `registerPlayer(state, {teamId, playerId})` (1군 등록), `optionPlayer(...)` (말소 → 10일 재등록 제한, 부상 말소는 예외 규정 별도), `validateRoster(state, teamId, date)`.
  - 경기 엔진은 등록(active) 명단만 사용 — 이미 active 우선이므로 정원 검증만 추가.
  - UI: 선수단 탭에 1군/퓨처스 구분 리스트 + [등록]/[말소] 버튼 + 정원 카운터(29/28), 재등록 제한 D-day 표시. 기존 메일 결정(medical-roster)의 "말소+콜업" 선택지를 이 command에 연결(현재는 하드코딩 fallback).
- **수용 기준**: 정원 초과 등록 reject, 말소 후 10일 내 재등록 reject(부상 예외), 확대 엔트리 날짜에 한도 자동 변경. verify 케이스 추가.

### WP-09. 외국인 3+1 슬롯 강제

- **현재**: 규칙이 문자열 상수 하나뿐(engine.js:49). 보유/출전 검증이 어디에도 없다. `player.foreignClass` 없음(외국인 추정 35명은 계약 schema로만 식별).
- **스펙**:
  - `player.foreignClass: 'domestic' | 'foreign' | 'asiaQuota'` 필드 추가 (기존 외국인 추정 선수 마킹, 아시아쿼터는 코드형 `FGN-` 권리에만 우선 적용).
  - `validateForeignSlots(teamId)`: 일반 외국인 보유 3, 아시아쿼터 1. 2026 규정 기준 4명 전원 출장 가능(리포 `reports/engine-roadmap.md` §P3 명시) — 단 동시 등록은 엔트리 검증(WP-08)과 결합.
  - 외국인 계약/트레이드/웨이버 클레임 시 슬롯 검증 게이트 추가(기존 트레이드 23개 reject 게이트에 케이스 추가).
  - 아시아쿼터 신규 영입 비용 상한(연봉+계약금+옵션+이적료 합산 $200k)을 FA/외국인 시장 command에 반영.
- **수용 기준**: 외국인 4명째 일반 슬롯 계약 reject, 아시아쿼터 2명째 reject, 상한 초과 오퍼 reject. verify 케이스 추가.

### WP-10. 부상 시스템 v2 (부상 종류 + 부상자 명단)

- **현재**: `injuredDays` 숫자 하나(2~14일 난수, 경기당 -1). 부상 종류/부위/IL 개념 없음. 메일 결정에 medical-roster 타입은 이미 존재.
- **스펙** (`reports/engine-roadmap.md` §P4 설계 따름):
  - `player.health = { status: 'healthy'|'dayToDay'|'injured'|'rehab', injuryRecords: [{ type, part, occurredOn, expectedDays, source }] }` — 기존 `injuredDays`는 파생값으로 유지(하위호환).
  - 부상 카탈로그 데이터: 부위(어깨/팔꿈치/햄스트링/발목/허리/손가락/타박 등)×경중(일수 범위·재발위험). 투수는 투구수/armFreshness, 야수는 연속출장 피로가 발생률에 반영(기존 fatigue 공식 확장).
  - IL 등재 command: 등재 시 엔트리 슬롯 해제(WP-08 연동), 최소 등재일(10일), 복귀 시 재등록.
  - 뉴스/메일: 부상 발생 → 팀닥터 보고 메일(예상 복귀일 범위로 표기, 정확값 숨김) — 기존 mail-decision 파이프에 데이터 공급.
- **수용 기준**: 시즌당 팀 부상 건수가 현실 범위(구단당 연 15~30건)로 나오고 balance PASS 유지. 부상 종류가 선수 상세/뉴스에 표기. IL 등재 중 경기 출전 불가 검증.

### WP-11. 우천취소 + 더블헤더 + 재편성

- **현재**: 날씨는 경기 환경 보정에만 쓰임. 취소/순연 없음.
- **스펙** (WP-06 캘린더 v2 완료 후):
  - 우천 확률(월별/지역별 간단 테이블, deterministic roll) → 경기 `status: postponed` → 캘린더 뒤쪽 재편성(같은 카드 잔여 일정 or 월요일). 돔구장(고척)은 취소 없음 — 구장 데이터에 `roofed` 플래그.
  - 더블헤더 정책은 `leaguePoliciesByDate`로 (2026: 4/12~5/31 토요일 취소 시 일요일 더블헤더, 엔트리 +2 특례).
- **수용 기준**: 시즌 종료 시 팀당 144경기 완주 invariant 유지(취소분 전부 재편성). 더블헤더 날 팀 2경기 허용 예외 검증.

---

## 6. P2 — 운영 깊이

### WP-12. 재정 루프 v1

- **현재**: 팀 `payroll/budget` 힌트 + 예산 배분 상수(stateSchema.js:257-262) + financeLedger 카테고리 골격만. 수입이 없다. 홈 관중 수는 이미 경기마다 기록됨.
- **스펙**: 경기별 티켓수입(관중×객단가), 월별 정산(연봉 월할 지출, 스폰서/모기업 지원 고정+성적 연동), `financeLedger`에 월 단위 append. 시즌 재정 요약 UI(프런트 탭). 예산 잔액이 트레이드 AI(`acceptanceScore`)와 FA 오퍼 상한에 반영.
- **수용 기준**: 한 시즌 수입/지출 합계가 ledger와 일치, 예산 초과 FA 오퍼 reject 케이스, verify 추가.

### WP-13. 연봉협상 / 방출 / 웨이버 공시

- **현재**: 롤오버 때 자동 정리(상한 74명)만. 유저 주도 방출/재계약 없음. 웨이버는 메일 결정 스텁.
- **스펙**: 스토브리그 단계에 비FA 연봉 갱신(성적/서비스타임 기반 제시액, 유저팀은 승인/조정 UI, CPU팀 자동), `releasePlayer` command → 웨이버 공시 3일(타 구단 클레임 이벤트, 기존 waiver-claim 메일 연결) → 자유계약. 방출 시 잔여연봉 처리 규칙.
- **수용 기준**: 유저가 임의 선수 방출 → 타 팀 클레임 or FA 전환까지 이벤트로그로 추적 가능.

### WP-14. 스카우트 루프 (고아 시스템 연결)

- **현재**: `buildScoutAssignments()`(frontOffice.js:91)가 업무 6개를 만들지만 **완료/결과 개념이 없는 순수 표시용**. 타팀 선수 능력치가 그대로 노출(fog of war 없음).
- **스펙(v0 최소)**: 업무에 [지시] 버튼 → N일 후 스카우트 리포트 이벤트 생성(대상 선수 관측 OVR±오차, 코멘트 템플릿) → 뉴스함/프런트 탭에 리포트 열람. 오차는 deterministic. fog of war 전면 도입(타팀 능력치 관측치 표시)은 대형 작업이므로 **후속 분리** — 이번엔 리포트 생성 루프만.
- **수용 기준**: 지시→완료→리포트 열람 사이클 동작, 리포트가 저장에 포함.

### WP-15. 군보류 (병역) v1

- **현재**: `militaryStatus` 필드만 존재(추적용). 입대/복귀 시뮬 없음.
- **스펙**: 롤오버 시 대상자(연령/서비스타임 조건, 미필) 중 일부가 상무 입대 → `rosterStatus: military`로 2시즌 이탈(엔트리 제외) → 복귀 시 성장 보정(퓨처스 수준 성장). 유저팀은 입대 승인 메일 결정. 실명 선수의 실제 병역 정보는 임의 단정하지 않고 `militaryStatus` v0 추정치 기반 + `source` 표기 유지.
- **수용 기준**: 다년 시뮬에서 입대→복귀 라이프사이클 확인, 군보류 선수 경기 출전 불가.

### WP-16. 뉴스/내러티브 데이터화

- **현재**: 뉴스함 fallback 템플릿 의존 높음(`buildFallbackAssistantBriefing` 등 매일 유사 문구), 메일 선택지 하드코딩(ui.js:1083). `state.narratives.arcs`(장기 서사) 골격은 있음.
- **스펙**: eventLog 기반 뉴스 생성기 확장 — 트리거: 연승/연패(5+), 개인 기록(사이클링/노히트/시즌 10승/30홈런/100타점 도달), 순위 변동(1위 탈환/가을야구 매직넘버), 트레이드/FA/부상 후속 기사. 메일 선택지를 실제 컨텍스트(대상 선수/수치)로 생성. fallback은 이벤트 0건인 날만.
- **수용 기준**: 한 주 진행 시 뉴스함 항목의 과반이 실제 이벤트 기반(수동 확인), placeholder 검증(기존 verify 항목) PASS 유지.

### WP-17. 코칭스태프 v0

- **현재**: 없음 (not-started, implementation-status §코칭 스태프).
- **스펙(최소)**: 감독+투수/타격 코치 3인 슬롯, 코드형 인물(실명 수집 전) + 성향(불펜 적극성, 도루 선호, 육성 가중치)이 경기 AI 파라미터와 성장 공식에 소폭 반영. 계약/교체는 오프시즌만.
- **수용 기준**: 감독 성향에 따라 도루 시도수/불펜 투입 타이밍 통계가 유의미하게 달라짐(시즌 시뮬 비교), balance PASS 유지.

---

## 7. P3 — 장기 (설계 문서 선행 권장)

- **WP-18. 저장 v2**: `schemaVersion` + 마이그레이션 체인, 다년 세이브 호환, 명예의 전당(커리어 아카이브 기반 헌액 로직) — WP-04 히스토리가 선행 조건.
- **WP-19. 타석 엔진 v2**: 볼카운트/투구수 정밀화, 구종, 번트/히트앤런/스퀴즈 작전, 유저 경기 중 개입(게임캐스트 연동 감독 모드). 매 단계 verify:balance 필수 (`docs/kbo-ootp-gap-roadmap.md` §5).
- **WP-20. KBO 이사회/정치, 여론 7차원**: `docs/fmkorea-gm-source-map.md` §14~15 요구사항 참조. eventLog/뉴스 시스템(WP-16) 위에 얹는다.

---

## 8. 데이터/콘텐츠 트랙 (코딩과 별개 병행 가능)

1. **로스터 1,052명 확장**: 목표는 전 구단 등록+육성+퓨처스 전체. 수집 파이프라인은 `tools/collect_roster_sources.py`, `tools/merge_player_search_candidates.py` 등 기존 스크립트 재사용. 후보는 `src/rosters_candidates/`에 있고 검증 통과분만 플레이 로스터 승격(현행 정책 유지).
2. **2025 시즌 상세 기록** 보강 → 능력치 산정 재료 (FIP/BABIP/WAR 후보, source-map §1).
3. **실제 연봉/계약/FA 데이터**: 현재 전원 `estimated`. 공시 데이터 수집 후 `source.kind` 교체.
4. **드래프트 실명화**: 공식 신인 명단 수집 전까지 코드형 유지(원칙). 수집 시 `DRF-` 코드 → 실명 치환 마이그레이션.
5. **구장 데이터**: 파크팩터는 있음. 수용인원/돔 여부(WP-11 필요)/좌우 펜스 등 추가.

---

## 9. UX 퀵픽스 목록 (WP 사이 반나절 단위로 소화)

1. 저장/불러오기 피드백: `data-save-status`(ui.js:242) 채우기, import 실패 시 무음 `.catch(() => {})` → 사용자 에러 표시.
2. 순위표 영문 헤더 한글화: Rk/Team/W/L/T/Pct/Diff → 순위/팀/승/패/무/승률/득실차.
3. "자동 스토브" 실행 중 진행 표시(현재 무반응 버튼 → 기존 simulationProgress 패널 재사용).
4. 게임캐스트 Phaser/Canvas 이중 렌더 방지(활성 엔진 하나만 mount — 단 §2-8 충돌 주의, 게임캐스트 작업 완료 후).
5. 뉴스 기사 "전문 보기" 모달.
6. 구단 전환 시 선수 상세 선택 컨텍스트 유지(ui.js:1952 부근 초기화 완화).
7. "일정 진행" vs "경기 시작/스킵" 버튼 라벨 정리(유저 혼동 — 경기 있는 날은 3버튼 그룹으로 통일).
8. 빠른 주간 진행을 "다음 내 경기까지 / 주간 / 월간" 옵션으로 확장.

---

## 10. 알려진 버그/의심 지점 (수리 우선)

1. **`buildLineup()` 9명 미만 시 빈 배열 반환**(engine.js:177 이하) — 부상 폭주+소규모 로스터에서 경기 불능 가능. 최소 보충 로직(퓨처스 승격 or 포지션 무시 충원) 필요. WP-08과 함께 해결 권장.
2. **2차 드래프트 양도금 테이블이 1~5라운드만 정의**(engine.js:36-42) — 하위 3팀 추가 라운드가 5라운드를 넘는 경우 fallback 값 확인/명시.
3. **포스트시즌 10회 강제 결판의 인위 홈보정 +1.8**(engine.js:3110-3127) — WP-07에서 실제 연장으로 대체.
4. **외국인 슬롯 무검증** — WP-09.
5. 메일 결정 선택지가 컨텍스트 무관 하드코딩(ui.js:1083) — WP-16.
6. `renderSeasonLeaders` 미완(상위 5명 카드) — WP-04에 흡수.

---

## 11. 검증 루틴 (매 WP 종료 시)

```powershell
cd C:\Users\godho\Downloads\baseball
npm run verify            # 엔진/데이터/커맨드 30+ 항목
npm run verify:balance    # 한 시즌 풀시뮬 AVG/OBP/SLG/ERA/HR 기준
npm run verify:browser    # 데스크톱/모바일 렌더, overflow, 클리핑
```

- 셋 다 PASS + 새 기능 검증 항목 추가가 완료 조건.
- 경기 확률 계수를 바꿨다면 `reports/balance.md`에 결과 갱신.
- 수동 확인: `python -m http.server 5177` 후 http://127.0.0.1:5177/ (Electron은 `npm run dev`).

## 12. 참고 문서 맵 (이 리포 안)

| 문서 | 내용 |
| --- | --- |
| `docs/implementation-status.md` | 시스템별 상태 매트릭스 (2026-06-30 기준) |
| `reports/engine-roadmap.md` | GameState/transaction/calendar 구조 설계 + 2026 규정 출처 URL — **P1 작업의 설계 원본** |
| `docs/kbo-ootp-gap-roadmap.md` | KBO식 우선순위 원칙 |
| `docs/fmkorea-gm-source-map.md` | 원 기획(펨코 연재) 전체 요구사항 체크리스트 |
| `docs/contract-fa-schema-plan.md` | 계약/FA 스키마 상세 계획 |
| `src/contracts.md` | 모듈 간 계약 (엔진/UI/저장 경계) |
| `docs/gamecast-*.md` | 게임캐스트 브리프 (현재 별도 작업 중 — 건드리지 말 것) |
