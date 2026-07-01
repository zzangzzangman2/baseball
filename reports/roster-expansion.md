# KBO 실제 선수 1000명급 확장 조사 메모

## 현재 플레이 로스터 정책

- 2026-06-30 현재 플레이 로스터는 KBO 공식 등록 현황 + 퓨처스 등록 현황 중심 531명이다.
- KBO 선수조회 확장 후보는 조사 자료로만 보관한다.
- 중요한 선수 중심의 500명대 로스터가 MVP에 더 적합하므로, 단순 숫자 맞추기용 `candidate` 선수는 `src/rosters/*.js`에서 제외했다.
- 실수로 후보가 섞이면 `python tools/prune_candidate_rosters.py`로 다시 제외한다.

## 현재 확인 상태

- 기존 `tools/scrape_kbo_rosters.py`는 KBO 등록현황(`/Player/Register.aspx`)과 퓨처스 등록현황(`/Futures/Player/Register.aspx`)을 팀별로 합쳐 수집한다.
- 2026-06-30 실행 확인 결과 팀별 수집 수는 LG 55, 두산 53, KIA 55, 삼성 55, 롯데 53, 한화 53, SSG 49, KT 54, NC 52, 키움 52로 총 531명이다.
- 기존 `src/rosters/*.js`, `src/data.js`, `src/ui.js`, `src/styles.css`는 수정하지 않았다.

## 생성한 후보 데이터

- `tools/collect_roster_sources.py`: KBO 공식 선수조회 기반 후보 수집 스크립트.
- `src/rosters_candidates/kbo-player-search-candidates.json`: 빠른 기본 수집 결과. 후보 265명.
- `src/rosters_candidates/kbo-player-search-candidates-core.json`: 공통 성 토큰 보강 수집 결과. 후보 434명.

`kbo-player-search-candidates-core.json` 기준:

- KBO 공식 선수조회 팀별 검색 총합: 989건
- 실제 회수한 검색 행: 953건
- 기존 531명과 `playerId` 또는 팀+이름+생년월일이 겹치지 않는 1차 후보: 446명
- 상세 페이지에서 이름/생년월일/포지션/투타를 확인해 최종 후보로 남긴 선수: 434명
- 상세 확인 실패 또는 필수값 부족으로 제외: 12명
- 기존 531명과 단순 합산 시 최대 965명 수준

## 왜 1000명 확장이 바로 어려운가

- KBO 등록현황+퓨처스 등록현황은 현재 등록 선수 중심이라 531명에서 멈춘다.
- KBO 공식 선수조회는 팀 필터 총합이 989건으로, 공식 KBO 단일 소스만으로도 1000명을 약간 밑돈다.
- 선수조회에는 현재 등록선수 외 과거/미등록/군보류/육성 성격의 선수가 섞일 수 있어 바로 1군/퓨처스 로스터처럼 통합하면 안 된다.
- KBO 선수조회 페이지는 ASP.NET 페이징이 있어 팀+포지션 검색만 하면 20건으로 잘리는 구간이 있다. 현재 스크립트는 공통 성 토큰으로 보강했지만, 989건 전부를 완전 보장하려면 페이징 자동화 또는 더 촘촘한 이름 토큰 분할이 필요하다.
- 요청 조건상 선수명/팀/포지션/투타/생년월일이 불확실하면 후보에 넣지 않았기 때문에, 뉴스/위키/구단 페이지에서 일부 정보가 빠지는 선수는 보고서 검토 대상으로 남겨야 한다.

## 출처별 신뢰도와 자동화 가능성

| 출처 | 신뢰도 | 예상 추가 인원 | 자동화 가능성 | 메모 |
| --- | --- | ---: | --- | --- |
| KBO 등록현황 | 매우 높음 | 이미 1차 포함 | 완료 | 현재 등록 선수. 기존 스크립트로 수집됨. |
| KBO 퓨처스 등록현황 | 매우 높음 | 이미 1차 포함 | 완료 | 기존 스크립트로 수집됨. |
| KBO 공식 선수조회 | 높음 | 후보 434명 | 부분 자동화 완료 | `playerId`, 팀, 포지션, 생년월일, 상세 페이지 투타 확인 가능. 현재 가장 좋은 확장 소스. |
| 구단 공식 선수단 페이지 | 높음 | 팀별 수~수십 명 검증용 | 팀별 파서 필요 | 삼성 페이지는 정적 HTML 선수 카드 구조 확인. 다른 구단은 구조가 제각각이라 별도 파서 필요. |
| KBO 기록 상세 페이지 | 높음 | 후보 검증용 | 완료 일부 | 선수조회 행의 상세 URL로 투타/생년월일/체격 확인에 사용. |
| 나무위키/뉴스 | 낮음~중간 | 누락자 보조 확인 | 제한적 | 공식 출처 누락 또는 구단 페이지 필드 부족 시 사람이 교차검증하는 보조 자료로만 권장. |

## 통합 시 주의점

- 후보 JSON은 기존 로스터에 바로 합치기보다 `playerId` 기준 중복 제거를 먼저 해야 한다.
- 외국인 선수, 개명 선수, 동명이인은 이름만으로 중복 판단하면 위험하다. `playerId` 우선, 없으면 팀+이름+생년월일 조합을 쓰는 편이 안전하다.
- 후보의 `status`는 `candidate`로 둔다. 기존 `active`/`futures`와 같은 의미로 해석하지 말아야 한다.
- `sourceUrls`와 `sourceQueries`를 보존하면 통합 후 문제가 생겼을 때 출처 추적이 가능하다.
- `age` 계산은 기존 스크립트와 맞추려고 `2026 - 출생연도` 방식으로 넣었다. 실제 만 나이가 필요한 화면에서는 별도 계산이 필요하다.

## 다음 자동화 방법

1. `python tools/collect_roster_sources.py --token-profile core`를 기본 후보 생성 명령으로 사용한다.
2. KBO 선수조회의 남은 페이징 누락분은 Playwright 또는 Chrome 세션 기반으로 실제 pager 클릭을 자동화해 989건 전부를 회수한다.
3. 팀별 공식 선수단 페이지 파서를 추가하되, 후보로 넣는 기준은 이름/팀/포지션/투타/생년월일이 모두 확인된 경우로 제한한다.
4. KBO 선수조회 후보와 구단 공식 선수단 후보를 `playerId` 또는 팀+이름+생년월일로 병합하고, 충돌 목록은 별도 검토 파일로 남긴다.
5. 1000명 목표는 공식 KBO 단일 소스만으로는 부족하므로, 군보류/육성/신인/최근 입단 공지까지 공식 구단 출처로 보강해야 한다.

## 2026-06-30 추가 보강 파이프라인

- 추가 스크립트: `tools/collect_additional_roster_sources.py`
- 생성 후보 파일: `src/rosters_candidates/kbo-additional-candidates.json`
- 실행 명령: `python tools/collect_additional_roster_sources.py --max-workers 8 --timeout 25`
- 기존 `src/rosters/*.js`는 읽기만 했고 수정하지 않았다.

### 사용 출처

| 출처 | URL | 사용 방식 |
| --- | --- | --- |
| KBO 공식 선수조회 | https://www.koreabaseball.com/Player/Search.aspx | 팀+포지션 검색의 ASP.NET 페이징을 실제로 따라가 누락 후보를 회수했다. |
| KBO 선수 상세 | https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId={playerId} 등 | 이름, 생년월일, 광범위 포지션, 투타, 체격을 확인했다. |
| KBO 퓨처스 선수 상세 | https://www.koreabaseball.com/Futures/Player/PitcherDetail.aspx?playerId={playerId} 등 | 퓨처스 상세 페이지로 연결되는 후보도 동일하게 확인했다. |

### 결과 요약

- 현재 앱 로스터 기준 인원: 965명
- 새 후보 수: 108명
- 단순 병합 시 예상 총원: 1073명
- 필수 필드 검증 결과: 팀, 이름, `position`, `sourceUrls`, `status` 누락 0건
- `position: unknown` 후보: 0건
- 상세 검증 후 제외: 0건

후보 유형별:

| candidateType | 후보 수 | 해석 |
| --- | ---: | --- |
| `kbo-current-team-paged` | 28 | KBO 선수조회에서 팀+포지션 검색 후 페이지 2, 3까지 따라가며 기존 965명과 중복되지 않은 후보. 현재 팀 필터 기반이라 우선 검토 가치가 높다. |
| `kbo-name-search-supplemental` | 80 | KBO 공식 이름검색 결과에서 현재 10개 팀 텍스트로 매핑 가능한 후보. 현역/보류/은퇴/과거 소속이 섞일 수 있으므로 바로 active/futures로 보지 말고 `candidate`로만 다뤄야 한다. |

팀별 새 후보 수:

| 팀 | 후보 수 |
| --- | ---: |
| LG 트윈스 | 10 |
| 두산 베어스 | 16 |
| KIA 타이거즈 | 17 |
| 삼성 라이온즈 | 11 |
| 롯데 자이언츠 | 13 |
| 한화 이글스 | 10 |
| SSG 랜더스 | 12 |
| KT 위즈 | 5 |
| NC 다이노스 | 9 |
| 키움 히어로즈 | 5 |

### 병합 전 주의

- `kbo-current-team-paged` 28명은 이전 수집기의 토큰 보강으로도 놓친 페이징 누락분이므로 우선 병합 후보로 볼 수 있다.
- `kbo-name-search-supplemental` 80명은 KBO 공식 선수조회 출처지만 현재 등록 선수라는 뜻은 아니다. 최종 병합 전 구단 공식 페이지, KBO 등록/퓨처스 등록, 최근 뉴스, 위키 보조 출처로 현재 상태를 한 번 더 확인하는 편이 안전하다.
- 모든 후보는 `status: "candidate"`로 저장했다. 임의로 선수명/포지션을 만든 항목은 없다.
