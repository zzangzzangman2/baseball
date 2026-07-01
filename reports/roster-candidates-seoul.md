# 서울/수도권 A그룹 후보 수집 중간 마감

## 범위

- 대상 팀: LG, 두산, 키움, KT, SSG
- 새로 작성한 후보 JSON: `src/rosters_candidates/seoul_candidates.json`
- 후보 JSON 상태: 확정 후보 정리 전이므로 빈 배열 `[]`
- 기존 로스터 파일, `src/data.js`, `src/ui.js`, `tools/scrape_kbo_rosters.py`는 수정하지 않음

## 현재까지 확인한 내용

- 기존 로스터 파일 `src/rosters/{lg,doosan,kiwoom,kt,ssg}.js`는 이미 KBO 등록현황 및 퓨처스 등록현황 기반 선수들을 상당수 포함하고 있음.
- `tools/scrape_kbo_rosters.py`는 KBO 등록/퓨처스 등록 페이지를 `20260629` 기준으로 조회하도록 되어 있었고, 대상 5팀 재조회 결과 수는 기존 파일과 같은 수준으로 확인됨.
- 따라서 추가 후보는 KBO 등록현황에 이미 있는 선수보다 각 구단 공식 선수단 페이지에 있으나 현재 JS에 없는 이름을 중심으로 검증해야 함.

## 시도한 공식 출처

- KBO 선수 등록 현황: https://www.koreabaseball.com/Player/Register.aspx
- KBO 퓨처스 선수 등록 현황: https://www.koreabaseball.com/Futures/Player/Register.aspx
- LG 트윈스 공식 선수단: https://www.lgtwins.com/team/player-list
- 두산 베어스 공식 선수단: https://www.doosanbears.com/member/pitchers, https://www.doosanbears.com/member/batters
- 두산 베어스 공식 API 확인: https://www.doosanbears.com/doosan/v1/member/lists, https://www.doosanbears.com/doosan/v1/member/profile
- 키움 히어로즈 공식 선수단: https://heroesbaseball.co.kr/players/pitcher/list.do
- KT wiz 공식 선수단/API: https://www.ktwiz.co.kr/player/pitcher, https://www.ktwiz.co.kr/api/v2/game/playerlist, https://www.ktwiz.co.kr/api/v2/game/pitcherdetail, https://www.ktwiz.co.kr/api/v2/game/batterdetail
- SSG 랜더스 공식 선수단: https://www.ssglanders.com/players/list?position=pitcher

## 현재까지 발견한 단서

- 두산 공식 API는 `memberDiv=PCER`, `memberDiv=BTER`, `memberDiv=EDUC`로 투수/타자/육성선수 목록을 조회할 수 있었음.
- 두산 공식 프로필 API는 `plerId`로 생년월일과 투타(`playerLR`)를 돌려줌. 예: `plerId=68200` 김민규는 두산 공식 프로필에서 투수, 1999-05-07, 우투좌타로 확인됨.
- KT 공식 웹 번들에서 `game/playerlist`, `game/pitcherdetail`, `game/batterdetail` API 호출 구조를 확인함.
- KT API는 `gameSearch.position=투/포/내/외`로 목록을 조회하고, `gameSearch.pcode`로 상세를 조회해야 함.
- LG 공식 선수단 페이지는 HTML 안에 선수 카드가 직접 포함되어 있으며, `ttmSeq` 기반 상세 페이지 링크가 있음. 예: 김강률 카드 확인.
- 키움 공식 선수단 페이지는 `/players/{position}/list.do` 형태로 접근 가능하고, `num=` 상세 식별자가 노출됨.
- SSG 공식 선수단 페이지는 HTML 안에 선수 카드와 이미지 URL이 직접 노출됨.

## 막힌 이유

- 제한 시간 안에 공식 페이지별 목록 파싱, 기존 로스터와의 중복 제거, 상세 페이지/API 생년월일 및 투타 보강, JSON 검증까지 끝내지 못함.
- 일부 사이트는 구조가 달라 추가 파서가 필요함.
  - 두산: Next.js 페이지지만 실제 데이터는 `/doosan/v1/member/*` API에 있음.
  - KT: React 번들 내부 API와 헤더가 필요함.
  - LG: HTML 카드와 상세 페이지를 함께 파싱해야 함.
  - 키움/SSG: 목록은 접근 가능하지만 상세 필드 추출 검증이 필요함.
- 선수명과 소속팀이 확실하지 않은 항목은 JSON에 넣지 않는 원칙 때문에, 중간 단서만으로 후보를 채우지 않았음.

## 다음 방법

1. 기존 로스터 5개 파일에서 팀별 `name` 집합을 만든다.
2. 공식 구단 API/HTML을 팀별로 파싱한다.
3. 목록에만 있는 선수는 후보 보류로 두고, 상세 페이지/API에서 포지션/투타/생년월일 중 확인 가능한 값을 보강한다.
4. 기존 로스터 이름과 중복되는 선수는 제외한다.
5. 공식 구단 또는 KBO 출처만 `confidence: "official"`로 JSON에 넣는다.
6. 나무위키/뉴스는 공식 출처에서 소속이 불명확한 경우에만 보조 확인용으로 쓰고, 교차확인이 부족하면 보고서의 `추가 확인 필요`에 남긴다.

## 후보 수

- 전체 후보 수: 0
- LG: 0
- 두산: 0
- 키움: 0
- KT: 0
- SSG: 0

