# 데이터 출처 메모

## 현재 반영된 데이터

- 팀명: 2026 KBO 10개 구단 실명
- 로고: KBO 공식 이미지 서버의 2026 regular emblem PNG
- 플레이 로스터 선수: KBO 공식 `선수 등록 현황` + `퓨처스리그 선수 등록 현황`
- 현재 플레이 로스터 선수 수: 531명
  - 등록 선수: 282명
  - 퓨처스 선수: 249명
- KBO 공식 `선수 조회` 확장 후보는 `src/rosters_candidates/`에 보관하지만, 현재 플레이 로스터에는 넣지 않는다.

## 로스터 수집 기준

수집 스크립트: `tools/scrape_kbo_rosters.py`

공식 등록 페이지의 표에 실제로 노출되는 값만 저장한다.

- 선수명
- 역할: 투수면 `pitcher`, 포수/내야수/외야수면 `hitter`
- 포지션 그룹: `P`, `C`, `IF`, `OF`
- 투타
- 생년월일 기반 나이
- 등번호
- KBO playerId
- 신체 정보
- 출처 라벨

KBO 선수조회 후보는 `tools/collect_roster_sources.py`와 `tools/collect_additional_roster_sources.py`로 수집할 수 있다. 다만 현재 게임 방향은 중요한 선수 중심 500명대 로스터이므로, 선수조회 후보는 자동 병합하지 않는다. 실수로 후보가 섞였으면 `python tools/prune_candidate_rosters.py`로 `status: "candidate"` 선수를 플레이 로스터에서 제외한다.

## 포지션 정책

KBO 등록 현황 표는 내야수/외야수처럼 넓은 포지션 그룹을 제공한다. 따라서 세부 포지션인 `1B`, `2B`, `SS`, `LF`, `CF`, `RF`를 임의 배정하지 않는다.

세부 포지션이 필요하면 다음 단계에서 KBO 선수 조회, 구단 공식 선수단 페이지, 나무위키, 뉴스 등으로 교차 확인한 뒤 별도 필드로 보강한다.

## 게임용 추정값

`ovr`, `pot`, `contact`, `power`, `stuff` 같은 능력치는 실제 기록 데이터가 아니라 현재 MVP 시뮬레이션을 돌리기 위한 게임용 추정값이다.

실제 정보처럼 취급하지 않도록 선수 객체에 `ratingSource: "game-estimate"`를 남긴다.

## 확장 후보 보관 원칙

숫자를 맞추기 위해 선수명을 생성하지 않는다. 또한 단순히 1000명을 채우기 위해 은퇴/과거 소속/검토 후보를 플레이 로스터에 넣지 않는다.

현재 공식 KBO 등록/퓨처스 소스로 531명의 플레이 로스터를 구성한다. KBO 선수조회 기반 후보는 조사 자료로 보관하고, 실제 게임 로스터에는 중요한 선수/현재 등록 상태가 충분히 확인된 경우에만 넣는다.

추가 가능한 후보는 아래 기준을 통과해야 한다.

- 선수명과 소속팀을 확인할 수 있어야 한다.
- 포지션/투타/생년월일 중 모르는 값은 임의로 채우지 않는다.
- 출처 URL이나 출처 라벨을 남긴다.
- 공식 KBO/구단 페이지를 최우선으로 쓰고, 부족하면 나무위키/뉴스를 보조 확인용으로 사용한다.

## 주요 출처

- KBO 선수 등록 현황: https://www.koreabaseball.com/Player/Register.aspx
- KBO 퓨처스 선수 등록 현황: https://www.koreabaseball.com/Futures/Player/Register.aspx
- KBO 구단 정보: https://www.koreabaseball.com/Kbo/League/TeamInfo.aspx
- KBO 영문 구단 정보: https://eng.koreabaseball.com/Teams/TeamInformation.aspx
