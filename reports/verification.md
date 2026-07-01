# 검증 보고서

- 실행 시각: 2026-07-01T05:33:07.189Z
- 작업 폴더: C:\Users\godho\Downloads\baseball
- 실행 Node: C:\Users\godho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe (v24.14.0)
- 검증 범위: src ESM 앱 모듈 및 생성 상태
- 종합 결과: 통과 (30/30 통과)

## 체크 결과

| 항목 | 결과 | 상세 | 위치 |
| --- | --- | --- | --- |
| ESM 모듈 import 및 핵심 export | PASS | src/data.js, src/engine.js, src/rosters/index.js, src/ui.js, src/main.js, src/systems.js, src/frontOffice.js, src/save.js import 완료 | - |
| createInitialState 실행 | PASS | 초기 날짜 2026-03-01, 팀 10개 | - |
| 팀 10개 | PASS | 10개 구단 확인 | - |
| 팀명 실제 KBO명 | PASS | LG 트윈스, 두산 베어스, KIA 타이거즈, 삼성 라이온즈, 롯데 자이언츠, 한화 이글스, SSG 랜더스, KT 위즈, NC 다이노스, 키움 히어로즈 | - |
| 총 선수 수 | PASS | 총 531명 (LG:55, 두산:53, KIA:55, 삼성:55, 롯데:53, 한화:53, SSG:49, KT:54, NC:52, 키움:52) | - |
| 각 선수 필수 키 | PASS | 531명 모두 필수 키 22개 보유, OVR/POT 0-200 범위 | - |
| FMKorea 능력치 필드 | PASS | 531명 공통 16개, pitcher 227명/13개, hitter 304명/18개, alias 9개 1-20 범위 | - |
| 계약/FA/병역/외국인 schema | PASS | 531명 계약 schema, 외국인 추정 35명, FA 1년 이내 191명, 추정계약 531명 | - |
| 공식 KBO ratingSource 최소 500명 | PASS | 530명 official KBO stats 기반 ratingSource 확인 (kbo-official:regular+futures:249, kbo-official:futures:152, kbo-official:regular:129) | - |
| ratings.js validateRatingWeights optional 실행 | PASS | validateRatingWeights 호출 통과 (valid, issues) | - |
| 영문-only 선수명 없음 | PASS | 선수명은 모두 한글 표기 포함 | - |
| 가짜 이름 생성 잔재 없음 | PASS | 현재 src ESM 앱과 생성된 선수명에서 placeholder/name-generator 잔재 미검출 | - |
| 개막 라인업 active 로스터 검증 | PASS | LG 타선 9명/투수 12명, 두산 타선 9명/투수 12명, KIA 타선 9명/투수 12명, 삼성 타선 9명/투수 12명, 롯데 타선 9명/투수 12명, 한화 타선 9명/투수 12명, SSG 타선 9명/투수 12명, KT 타선 9명/투수 12명, NC 타선 9명/투수 12명, 키움 타선 9명/투수 12명 모두 active 로스터 | - |
| simulateDay 실행 및 하루 5경기 | PASS | 2026-03-29로 진행, 누적 5경기, 최근 경기 5건 | - |
| 다음 경기 보기/시뮬레이션 플로우 | PASS | 2026-03-28 KT@LG, Gamecast PA 85개 포커스 | - |
| 선수 누적 기록 모델 | PASS | 타자 90명/투수 38명 기록, 득점 42, PA 418 | - |
| 경기 박스스코어/eventLog | PASS | game.final 5개, 박스스코어 5경기, PA 이벤트 418개, 실책 1, 병살 1 | - |
| 로테이션/불펜 운용 snapshot | PASS | 7일 선발 38명, 등판 투수 92명, W-L 28-28, SV 11, HLD 11 | - |
| simulateDays 실행 | PASS | 7일 진행 후 day=35, gamesPlayed=30 | - |
| simulateRegularSeason 종료 상태 | PASS | 정규시즌 종료: 720/720경기, day=196, phase=complete | - |
| 포스트시즌/시상식 자동 생성 | PASS | 한화 이글스 우승, PS 17경기, MVP 올러, GG 10명 | - |
| 신인 드래프트 v1 | PASS | 2027 드래프트 150명 풀, 110픽, 팀당 11명, 보류권 110명, 코드형 신인 55명 roster 반영 | - |
| 2차 드래프트 v1 | PASS | 2027 2차 드래프트 보호 35명x10팀, 비보호 128명, 36/36픽, 36명 실제 이동 | - |
| 트레이드 v2 command | PASS | LG 트윈스 이용현 영입, KT 위즈 서영준 영입, 자산 player+cash+conditional+ptbnl, 자산타입 player/cash/draftPick/conditional/ptbnl, 조건부/현금/PTBNL ledger | - |
| 트레이드 안전 게이트 23케이스 | PASS | 23개 reject 케이스 + 1개 성공 케이스 | - |
| FA/외국인 시장 command | PASS | FA 30명/오퍼 30건, 외국인 코드 30명, roster 531명 유지 | - |
| 자동 오프시즌/시즌 롤오버 | PASS | 자동 스토브 roster +55, 신인입단 55/보류권 110, FA 30건, CPU 트레이드 4건, 2027 프리시즌 롤오버 | - |
| 프런트오피스 selector 실행 | PASS | LG 트윈스 요약 55명, 스카우트 후보 24명 | - |
| GM 데스크 데이터 실행 | PASS | LG 트윈스 시장 후보 42명, 제안 10건, 업무 6개, 알림 6건 | - |
| JSON 저장 roundtrip | PASS | roundtrip 10팀/531명, kbo-gm-2026-03-01-day1-lg.json | - |

