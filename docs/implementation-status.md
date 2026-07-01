# 구현 상태 매트릭스

작성일: 2026-06-30  
작성 범위: `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md`, `src/contracts.md` 기준 현황 정리  
상태 기준: `implemented`는 현재 검증 가능한 MVP 동작이 있는 축, `partial`은 일부 구조나 화면/selector/초기 모델만 있는 축, `not-started`는 아직 독립 시스템으로 확인되지 않는 축이다.

## 핵심 요약

- 현재 앱은 정적 HTML/ES module 기반 MVP이며, 10개 구단/531명 로스터로 2026-03-01 프리시즌 시작과 정규시즌 720경기 deterministic 완주가 검증됐다.
- 선수 능력치는 공통 16개, 투수 13개, 타자 18개로 총 47개가 구현되어 있고, OVR/POT 0-200 범위 검증도 통과했다.
- 현재 엔진은 경기 단위 시즌 진행 위에 내부 타석 v1, 선수 `seasonStats` v0, 최근 경기 `boxScore` v1, 경기 종료 `eventLog` v1을 가진다.
- `plateAppearanceEvents`와 `boxScore`는 최근 경기 결과에 저장되지만, 아직 전체 시즌을 재생 가능한 표준 ledger/reducer 구조는 아니다.
- 포스트시즌 v1은 와일드카드, 준PO, PO, 한국시리즈를 자동 생성/진행하고 MVP, 신인왕, 골든글러브, 한국시리즈 MVP를 산출한다.
- 신인 드래프트 v1은 150명 익명 후보 코드 풀, 11라운드 110픽, 팀별 AI 전략, 20-80 스카우팅 등급을 검증한다. autonomous offseason v1 기준에서는 지명 결과를 실명 없는 `DRF-YYYY-###` 코드형 신인 선수로 실제 roster에 추가하고 `draft.rosterLedger`에 남긴다.
- 2차 드래프트 v1은 35인 보호명단, 비보호 풀, 36픽, 원소속팀 피지명 4명 제한, 양도금 기록을 검증한다. autonomous offseason v1 기준에서는 검증된 기존 선수의 실제 소속을 바꾸고 `secondaryDraft.transferLedger`에 남긴다.
- 트레이드 v2는 프런트오피스 제안 중 엄격 게이트를 통과한 선수 1명+보조 자산 패키지를 1차 검토 잠금/2차 확정으로 commit하며, 실제 로스터 이동, 현금/지명권/조건부/PTBNL ledger, eventLog, 저장 roundtrip까지 검증한다.
- 선수별 계약/FA/병역/외국인/서비스타임/보상등급 v0 schema가 생성되고, 공식 데이터 전 값은 `estimated`, `fallback`, `unknown` 출처로 구분된다.
- FA/외국인 시장 v1은 `initializeFreeAgency`, `commitFreeAgentSigning`, `commitForeignPlayerSigning`으로 구현됐다. 실제 국내 FA만 roster를 이동하며, 외국인 후보는 검증 전 `FGN-YYYY-###` 코드형 보류권 ledger로만 처리한다.
- 시작 UX는 시작하기/불러오기 화면, 새 게임 팀 선택, 2026-03-01 프리시즌 시작으로 바뀌었고 UI는 `다음 날`과 제한된 `빠른 주간`을 제공하며 전체 시즌 한방 진행 버튼은 제거됐다.
- 밸런스 검증은 2024 KBO 기준 대비 한 시즌 전체 AVG .278, ERA 4.64, 경기당 홈런 1.93으로 통과했다.
- 장기 플레이는 full multi-year 운영이 아니라 autonomous offseason v1 범위로 갱신한다. 즉 포스트시즌 이후 오프시즌 단계 실행, FA/외국인 권리 처리, 드래프트/2차 드래프트 결과 반영, CPU끼리 트레이드, 다음 시즌 rollover가 구현 기준이며, 은퇴/재정/뉴스/정치/실명 외국인 데이터는 후속 한계로 남긴다.

## 시스템별 상태 매트릭스

| 시스템 축 | 상태 | 관련 파일 | 현재 구현/근거 | 다음 blocker |
| --- | --- | --- | --- | --- |
| 정적 앱/Electron 패키징 골격 | implemented | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md` | HTML 정적 앱 + Electron 패키징 가능한 skeleton이다. 시작 화면에서 시작하기/불러오기, 새 게임 팀 선택, 프리시즌 진입을 처리한다. `src/main.js`는 bootstrap, `src/ui.js`는 DOM 렌더링, `src/styles.css`는 표현 CSS를 담당한다. | 대형 시스템 추가 전 데이터/엔진/UI 경계를 계속 유지해야 한다. |
| 기본 `GameState` 생성 | partial | `docs/system-blueprint-index.md`, `src/contracts.md`, `reports/verification.md` | `createInitialState()`가 팀 10개와 초기 상태를 생성하고 검증 통과했다. 다만 현재 shape는 `teams[].roster[]` 중심이며 `playersById`, `teamsById`, `calendar`, `contractsByPlayerId` 정규화 전이다. | 정규화된 단일 `GameState`와 schemaVersion/migration 정책 확정. |
| Transaction/Command 기반 상태 변경 | partial | `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `tools/verify_app.mjs` | `commitTradeProposal`, `commitFreeAgentSigning`, `commitForeignPlayerSigning`이 state 변경을 검증 후 commit한다. P0 완료 후 autonomous offseason v1 기준에서는 오프시즌 단계 실행, 드래프트 권리/입단 예정 반영, 2차 드래프트 소속 이월, 시즌 rollover도 command성 상태 변경으로 다룬다. | 보상선수 지명, 다자산 트레이드, 재정 지급, 다년 저장 migration까지 공통 `PROPOSE_*`, `ACCEPT_*`, `COMMIT_*` 계층 확장. |
| Event ledger | partial | `docs/system-blueprint-index.md`, `docs/fmkorea-gm-source-map.md`, `src/contracts.md`, `src/engine.js` | `state.eventLog`가 `game.final`, `trade.completed`, `fa.signed`, `foreign.signed` 이벤트를 기록한다. 아직 부상/뉴스/회의/트랜잭션 전체를 포괄하는 원장 구조는 아니다. | 모든 변경을 재생 가능한 event로 남기는 event schema와 append 규칙 확장. |
| 저장/불러오기 | implemented | `docs/system-blueprint-index.md`, `reports/verification.md`, `src/contracts.md` | JSON 저장 roundtrip이 검증 통과했다. `src/save.js`는 JSON export/import 순수 함수로 언급된다. | 정규화된 state와 event ledger 도입 후 저장 포맷 버전 관리. |
| 실제 로스터 DB | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md` | 현재 플레이 로스터는 10개 구단 531명이며, 검증 기준 530명은 KBO 공식 2026 regular/futures ratingSource를 가진다. autonomous offseason v1은 현재 `teams[].roster[]` 직접 반영과 ledger(`draft.rosterLedger`, `secondaryDraft.transferLedger`)로 FA, 드래프트, 2차 드래프트, 시즌 rollover 결과를 추적한다. 정규화된 장기 `rosterAssignments`는 후속 구조다. | 1,052명 공식 원장, 2025 기록, 실제 계약/병역/FA/외국인/연봉 데이터 보강. |
| 선수 능력치 47개/OVR/POT | implemented | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md` | 공통 16개, 투수 13개, 타자 18개 총 47개 능력치와 OVR/POT 0-200 범위 검증이 통과했다. | 60개 확장 대비 `attributeDefinitions` registry와 저장본 migration. |
| 선수 `seasonStats` v0 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/engine.js`, `tools/verify_app.mjs` | 선수별 batting/pitching/fielding `seasonStats`가 초기화되고 타석 엔진에서 직접 누적된다. 팀 득점, 타자 득점, 투수 실점, PA/BF 합계 검증이 통과한다. | 장기적으로 `plateAppearanceEvents`/box score reducer에서 파생할지, 직접 누적을 유지할지 원칙 확정. |
| 시즌 시뮬레이션 코어 | implemented | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md`, `src/contracts.md` | `simulateDay`, `simulateDays`, `simulateRegularSeason`이 검증 통과했다. 2026-03-01 프리시즌은 경기 없이 하루씩 진행하고, 개막 후 하루 5경기, 7일 30경기, 정규시즌 720/720경기 complete 상태가 확인됐다. UI는 `다음 날` 진행만 노출한다. | 실제/생성형 캘린더, 라인업/로테이션 snapshot, 선수 누적 기록 연결. |
| 내부 타석 v1 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/engine.js` | 타석 단위 결과가 `plateAppearanceEvents`로 최근 경기 결과에 남고, 득점 이벤트 일부가 `scoringEvents`로 저장된다. 아직 전체 시즌 원장, 교체/불펜/수비 실책은 없다. | 타석 이벤트 schema 고정, 결과 확률 튜닝, 주자/아웃/득점 상태 모델 확장. |
| Box score | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | 최근 경기마다 9이닝 linescore, 팀 합계, 타자 라인, 선발/불펜 투수 라인, PA 이벤트가 저장되고 UI 미니 박스스코어가 표시된다. 검증은 5경기 박스스코어와 PA 이벤트 합계를 확인한다. | 수비 실책/전체 선수 box score reducer와 상세 모달. |
| 라인업/로테이션 | partial | `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | `buildLineup(team)`과 `buildPitchingSnapshot(team)`이 있고 선발 5명, 불펜 7명, 다음 선발, 역할별 불펜을 UI에 표시한다. 경기 엔진은 active 로스터를 우선해 라인업/투수진을 구성하고, 검증은 10개 팀 모두 개막 타선 9명/투수 12명이 현재 팀 active 로스터임을 확인한다. | 상대 좌우 상성, blown save 리드 추적, 교체 타이밍 고도화, 경기 전 lineup/pitching snapshot 저장. |
| 부상/피로/컨디션 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md` | `fatigue`, `form`, `injuredDays` 같은 선수 상태 필드가 있고, 시즌 엔진에서 간단 반영되는 것으로 정리되어 있다. | 부상 발생/회복 ledger, 팔 상태, 포지션/등판 간격별 위험도 모델. |
| 밸런스 튜닝/검증 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md`, `reports/balance.md`, `tools/verify_balance.mjs` | 높은 타율/ERA를 낮추도록 타석 결과 확률을 조정했다. 2024 KBO 기준 대비 한 시즌 전체 검증은 AVG .278, OBP .347, SLG .410, ERA 4.64, 경기당 홈런 1.93으로 통과한다. | 고정 seed 다회 시뮬레이션과 세부 팀/선수 이상치 리포트. |
| 순위표/시즌 종료 | partial | `docs/system-blueprint-index.md`, `reports/verification.md`, `src/contracts.md`, `src/engine.js` | `getStandings(state)` export가 있고 정규시즌 종료 `phase=complete`는 검증 통과했다. `initializePostseason(state)`가 상위 5팀 seed를 만들어 `phase=postseason`으로 전환한다. | 정교한 KBO 동률/상대전 타이브레이커. |
| 포스트시즌 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | 와일드카드 4위 1승 어드밴티지, 준PO/PO 5전3선승, 한국시리즈 7전4선승 v1이 있고 `simulatePostseason(state)`가 정규시즌 팀 승패를 바꾸지 않고 완료한다. 검증은 PS 13경기, 4개 시리즈 완료, 우승팀 생성을 확인했다. | 실제 일정/휴식일, 홈구장 세부 규칙, 포스트시즌 전용 기록 분리. |
| 시상식 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | 정규시즌 MVP, 보수적 신인 후보 기반 신인왕, 골든글러브 10명, 한국시리즈 MVP가 자동 산출되고 UI에 표시된다. 검증은 MVP와 GG 10명을 확인했다. | 실제 KBO 투표/포지션 자격, 수비 이닝, 신인 자격 공식 데이터. |
| 트레이드 보드/제안/v2 실행 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `src/frontOffice.js`, `src/ui.js`, `reports/verification.md` | 프런트오피스 selector는 시장 후보 42명, 제안 10건을 만들고, `viable`과 `executable`을 분리한다. `commitTradeProposal`은 승인 토큰, acceptance/value/OVR/POT/보조자산 방향/금액/중복을 재검증하고 23개 reject 케이스를 통과한다. UI는 검토 잠금 후 확정 실행한다. | 선수 다자산 패키지, 지명권 보호조건 정교화, AI 수락/거절 협상 단계, 재정 ledger와 실제 예산 반영. |
| 스카우트 보드/업무 큐 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md` | 스카우트 후보 24명, 업무 6개 같은 selector는 검증 통과했다. 스카우트 인물, 32개 스탯, 편향/피로/리포트 정확도 시스템은 없다. | `scoutingReportsById`를 원본 능력치와 분리하고 관측치/오차범위/신뢰도 모델 설계. |
| GM 데스크/inbox | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md` | GM 데스크 데이터 생성은 통과했고 알림 6건, 업무 6개 등이 확인됐다. 이벤트 기반 업무/뉴스/시장 반응 시스템은 아니다. | event ledger 기반 알림 생성과 실제 command로 이어지는 업무 처리. |
| 드래프트 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | 150명 익명 후보 코드 풀, 11라운드 110픽, 정규시즌 역순 지명 순서, 팀별 뎁스 기반 AI 전략, 20-80 등급, 드래프트 보드 UI가 있다. autonomous offseason v1에서는 지명자를 실명 없는 `DRF-YYYY-###` 코드형 신인 선수로 roster에 추가하고 `draft.rosterLedger`에 반영한다. | 공식 신인 명단 수집, 실명/생년월일/학교/계약금 등록, 지명권 트레이드, 스카우트 불확실성/리포트, 실제 계약 command 고도화. |
| 2차 드래프트 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | 531명 플레이 로스터 기준 구단별 35인 보호명단, 비보호 146명 풀, 최대 36픽, 하위 3팀 추가 라운드, 원소속팀 피지명 4명 제한, 라운드별 양도금, UI 보드가 있다. autonomous offseason v1에서는 지명된 기존 선수의 실제 roster 소속을 바꾸고 `secondaryDraft.transferLedger`에 반영한다. 외국인/FA 시장 선수와 신인 계약자는 제외한다. | 1,052명 원장 확장, 공식 입단연차/자동 제외 엄격 적용, 지명 거부, 보상/의무등록, 재정 ledger 반영. |
| FA/외국인 시장 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/data.js`, `src/engine.js`, `src/ui.js`, `tools/verify_app.mjs` | `initializeFreeAgency`가 FA 후보 30명, FA 오퍼 30건, 외국인 코드 후보 30명/5티어, 외국인 오퍼 10건을 만든다. `commitFreeAgentSigning`은 국내 FA roster 이동/계약/faStatus/보상 ledger/eventLog를 갱신한다. `commitForeignPlayerSigning`은 roster에 가짜 이름을 넣지 않고 rights/activation pending ledger만 남긴다. P0 완료 후 season rollover는 이 권리 상태를 다음 시즌으로 넘기되, 외국인은 계속 코드형 권리로 유지한다. | 보상선수 보호명단/지명, 공식 외국인 실명/국적/계약 데이터, 실제 등록/비자/엔트리 activation. |
| 계약/연봉 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md`, `src/data.js`, `src/systems.js` | 531명 전원에게 `contract`, `serviceTime`, `militaryStatus` 등 v0 객체가 붙고 검증 20/20을 통과했다. 금액은 팀 payroll 힌트를 배분한 추정값이며 `source.kind=estimated`로 표시된다. | 실제 연봉/계약/병역/FA 데이터 수집, `contractsByPlayerId`, command 기반 계약 갱신. |
| 재정 시스템 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md` | 팀 단위 `payroll`, `budget`, `market`, `fan` 힌트와 payroll pressure 수준만 있다. 수입/지출 ledger는 없다. | 월별 `financeLedger`, 경기별 관중 수입, 계약 지급 시점, CBT/부채 규칙. |
| 코칭 스태프 | not-started | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md` | 감독/코치 인물 원장, 역할별 능력치, 계약/해임/성장 영향은 없다. | staff 원장, 역할별 영향 범위, 계약/훈련/부상 회복 연결. |
| KBO 회의/정치 | not-started | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md` | 이사회/실행위원회/총회, 정치적 자본, 안건/투표/회의록 시스템은 없다. | league policy event, 구단 성향, 규정 변경 저장/적용 구조. |
| 뉴스/여론 | not-started | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `reports/verification.md` | 로그/inbox/marketNotes는 있으나 본격 뉴스/여론 시스템은 없다. placeholder/name-generator 잔재는 검증에서 미검출됐다. | eventLog 파생 뉴스 템플릿, 루머/확정 사건 구분, 여론 차원 정의. |
| 장기 플레이/오프시즌 | partial | `docs/fmkorea-gm-source-map.md`, `docs/system-blueprint-index.md`, `src/contracts.md` | 기준은 autonomous offseason v1이다. 한국시리즈 종료 후 오프시즌 단계를 순차 실행하고, FA/외국인 권리, 신인 드래프트 코드형 입단, 2차 드래프트 소속 변경, CPU끼리 트레이드, 다음 시즌 rollover를 한 번의 시즌 순환으로 연결한다. rollover는 승패/기록 리셋, 나이+1, 기초 성장/노쇠, 계약 시즌 갱신을 포함한다. | 은퇴, 공식 신인/외국인 실명 등록, 재정/뉴스/정치, 다년 저장 migration, 완전한 1,052명 원장. |
| 데이터 출처/검증 정책 | partial | `docs/system-blueprint-index.md`, `reports/verification.md` | `ratingSource`와 `sourceUrls`가 일부 존재하며, 공식 KBO ratingSource 530명 검증이 통과했다. | 1,052명 확장 시 후보/확정/공식/fallback 신뢰도 분리. |

## 우선 blocker 정리

| 우선순위 | blocker | 막고 있는 시스템 |
| --- | --- | --- |
| P0 완료 후 잔여 | autonomous offseason v1 확장 | 오프시즌 단계 UI 고도화, 보상선수/지명 거부, 다년 저장 migration, 정규화 roster assignment 설계 |
| P1 | 선수 기록 ledger/`seasonStats` 확정 | 시상식 고도화, 밸런스 튜닝, FA 가치, 트레이드 가치 |
| P1 | 타석 이벤트 schema 확정 | 불펜/교체, 상세 box score, 선수 누적 기록 reducer |
| P1 | 선수 원장/roster assignment 공식 데이터 보강 | 1,052명 확장, 군보류, 공식 입단연차, FA/외국인 실명 데이터 |
| P2 | 계약 schema 확정/공식 데이터 보강 | FA, 외국인, 재정, 트레이드 연봉 부담 |
| P2 | 보상선수/지명 거부/의무등록 command | FA 보상선수, 2차 드래프트 후속 처리, 실제 재정 ledger |
| P2 | 라인업/로테이션 snapshot 고도화 | 좌우 상성, 감독 성향, 투수 사용량, 포스트시즌 휴식일 |

## 다음 문서화 필요 항목

- `eventLog` v1과 `boxScore` v1의 책임 분리: 원천 이벤트, 파생 박스스코어, 누적 기록의 생성 순서.
- 내부 타석 v1과 선수 `seasonStats` v0의 현재 필드 목록 및 저장 호환성.
- 531명 플레이 로스터와 1,052명 목표 원장의 공존 정책.
- autonomous offseason v1에서 각 단계가 읽고 쓰는 상태: FA, 외국인 권리, 신인 드래프트 코드형 권리, 2차 드래프트 소속 변경, season rollover.
- 드래프트/외국인 권리의 한계: `DRF-YYYY-###`, `FGN-YYYY-###` 코드는 실제 실명 선수 등록이 아니며 공식 데이터 수집 전까지 권리/입단 예정 상태로만 유지한다.
- 계약/FA/병역/외국인 v0 추정값을 official/reported 데이터로 교체하는 수집 정책.
