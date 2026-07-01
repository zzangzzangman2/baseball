# KBO GM Manager

KBO용 GM/프런트오피스 시뮬레이터 프로토타입입니다.

현재는 HTML/CSS/JS로 빠르게 개발하고, 데스크톱 배포가 필요해지면 Electron으로 EXE를 만듭니다.

## 실행

현재 정적 서버:

- http://127.0.0.1:5177/

직접 서버를 새로 띄우려면:

```powershell
cd C:\Users\godho\Downloads\baseball
python -m http.server 5177
```

Electron 실행/패키징은 Node와 npm 설치 후:

```powershell
npm install
npm run dev
npm run package
```

## 검증

```powershell
npm run verify
npm run verify:balance
npm run verify:browser
```

현재 검증 항목은 ESM import, 실제 팀명, 선수 필수 키, 영문-only 이름 차단, 가짜 이름 생성 잔재 차단, 개막 라인업 active 로스터, 시즌 시뮬레이션, 포스트시즌/시상식 자동 생성, 신인 드래프트 v1, 2차 드래프트 v1, 트레이드 v2 command, 트레이드 안전 게이트 23개 reject 케이스, FA/외국인 시장 command, 자동 오프시즌/시즌 롤오버, 프런트오피스/GM 데스크 데이터, JSON 저장 roundtrip을 포함합니다. 밸런스 QA는 2024 KBO 기준 대비 타율/ERA/홈런을 확인하고, 브라우저 QA는 데스크톱/모바일 렌더링, 수평 overflow, 주요 텍스트 클리핑을 확인합니다.

## 현재 데이터

- 팀: KBO 10개 구단 실명
- 로고: KBO 공식 2026 emblem PNG
- 선수: KBO 공식 선수 등록 현황 + 퓨처스 선수 등록 현황 중심 531명
- 현재 총 선수 수: 531명
- 선수명: 한글명만 반영
- 시작 흐름: 시작 화면에서 `시작하기`/`불러오기`, 새 게임은 구단 선택 후 2026-03-01 프리시즌부터 시작
- 진행 방식: `다음 날`과 `빠른 주간` 진행 중심이며, 정규시즌 개막 전에는 경기 없이 날짜와 컨디션만 진행
- 경기 보기: 최근 경기 기반 빠른 도트 게임캐스트와 박스스코어 미니 보드
- 밸런스: 한 시즌 전체 검증 기준 AVG .278, OBP .347, SLG .410, ERA 4.64, 경기당 홈런 1.93
- 시즌 루프: 정규시즌 720경기, 와일드카드/준PO/PO/한국시리즈 v1, MVP/신인왕/골든글러브/한국시리즈 MVP v1
- 오프시즌/시즌 이월: autonomous offseason v1 기준으로 한국시리즈 이후 FA/외국인 권리, 신인 드래프트 코드형 신인 입단, 2차 드래프트 소속 변경, CPU끼리 트레이드, 다음 시즌 rollover를 한 루프로 연결
- 드래프트: 신인 드래프트 v1, 익명 후보 코드 150명 풀, 11라운드 110픽, 팀별 AI 지명 전략, 20-80 등급
- 2차 드래프트: 보호선수 35명x10팀, 비보호 풀, 최대 36픽, 원소속팀 피지명 4명 제한, 양도금 기록 v1
- 트레이드: 엄격 게이트를 통과한 선수 1명+보조 자산 패키지 command, 1차 검토 잠금/2차 확정, 실제 로스터 이동, 현금/지명권/조건부/PTBNL ledger, `trade.completed` eventLog, 저장 roundtrip
- 계약/FA/외국인: 선수별 v0 schema, FA/외국인 시장 v1 command, FA 계약 roster 이동/계약 갱신/보상 ledger, 외국인 코드형 권리 계약 ledger

자세한 기준은 `reports/data-sources.md`에 있습니다.

## 구현 완료: FA/외국인 시장 v1

- 엔진 export: `initializeFreeAgency(state)`, `commitFreeAgentSigning(state, offer?)`, `commitForeignPlayerSigning(state, offer?)`
- `state.freeAgency`: `{ status, year, ruleSource, sourceUrls, faCandidates, offers, foreignMarket, foreignOffers, signings, compensationLedger, foreignSignings }`
- FA 후보는 실제 로스터 DB의 국내 선수 중 `faStatus`와 `compensationGrade`가 있는 선수만 사용합니다.
- FA 계약 시 선수 `teamId`, `contract`, `faStatus`와 보상 ledger를 함께 갱신합니다.
- 보상 룰 v1: A=20인 보호+전년도 연봉 200% 또는 300% 현금, B=25인 보호+100% 또는 200% 현금, C=150% 현금/보상선수 없음.
- 외국인 시장은 실명 검증 전까지 `FGN-YYYY-###` 코드형 30명/5티어 후보만 만들고, 계약 시 실제 roster에 가짜 이름을 넣지 않습니다. 보류권/활성화 대기 ledger만 남깁니다.

## 구현 범위: Autonomous Offseason v1

P0 완료 후 문서 기준의 오프시즌은 완전한 다년 운영이 아니라 한 시즌을 다음 시즌으로 넘기는 v1 루프입니다.

- 신인 드래프트 지명자는 공식 실명 데이터가 들어오기 전까지 `DRF-YYYY-###` 코드형 신인 선수로 roster에 입단시키고 `draft.rosterLedger`에 남깁니다.
- 2차 드래프트 지명자는 기존 검증 선수이므로 실제 소속을 바꾸고 `secondaryDraft.transferLedger`에 남깁니다.
- 외국인 계약은 `FGN-YYYY-###` 코드형 권리와 activation pending 상태만 이월하며, 실제 실명 선수 등록은 하지 않습니다.
- 시즌 rollover는 승패/기록 리셋, 나이+1, 기초 성장/노쇠, 계약 시즌 갱신을 처리합니다. 은퇴, 실제 외국인 실명/국적/계약 데이터, 재정 ledger, 뉴스/여론, KBO 정치/규정 변경은 후속 범위입니다.

## 중요한 원칙

- 선수명/팀/포지션/투타/생년월일은 임의 생성하지 않습니다.
- 확실하지 않은 세부 포지션은 `IF`, `OF`, `P`처럼 공식 표의 넓은 포지션으로 남깁니다.
- `ovr`, `pot` 등은 현재 게임 진행용 추정값이며 실제 기록 데이터가 아닙니다.
- KBO 선수조회 확장 후보는 `src/rosters_candidates/`에 자료로 남기지만, 현재 플레이 로스터에는 넣지 않습니다.
- 저장은 `localStorage` 자동 저장 대신 JSON export/import부터 사용합니다.

## 주요 파일

- `src/data.js`: 초기 GameState와 팀 seed
- `src/engine.js`: deterministic 시즌/포스트시즌/드래프트/2차 드래프트 시뮬레이션, 트레이드 v2 command, FA/외국인 시장 command, 자동 오프시즌/시즌 롤오버
- `src/ui.js`: 대시보드 UI
- `src/systems.js`: 프런트오피스 selector
- `src/frontOffice.js`: 트레이드 시장, 스카우트 업무, GM 알림함 데이터
- `src/save.js`: JSON 저장/불러오기 순수 함수
- `src/rosters/`: 현재 반영된 공식 기준 로스터
- `tools/scrape_kbo_rosters.py`: KBO 공식 등록/퓨처스 로스터 수집
- `tools/collect_roster_sources.py`: KBO 공식 선수조회 후보 수집
- `tools/merge_player_search_candidates.py`: 선수조회 후보 병합
- `tools/prune_candidate_rosters.py`: 플레이 로스터에서 후보 확장분 제외
- `tools/verify_app.mjs`: 검증 스크립트
- `desktop/README.md`: EXE 패키징 메모
- `reports/engine-roadmap.md`: 다음 엔진 구조 로드맵
