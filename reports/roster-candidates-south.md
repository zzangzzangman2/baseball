# 지방/남부 B그룹 후보 수집 진행 보고

## 범위

- 대상 팀: KIA, 삼성, 롯데, NC, 한화
- 소유 파일:
  - `reports/roster-candidates-south.md`
  - `src/rosters_candidates/south_candidates.json`
- 금지 파일(`src/rosters/*.js`, `src/data.js`, `src/ui.js`, `tools/scrape_kbo_rosters.py`)은 수정하지 않았습니다.

## 현재 결과

- JSON 후보 수: 0명
- 팀별 후보 수:
  - KIA: 0명
  - 삼성: 0명
  - 롯데: 0명
  - NC: 0명
  - 한화: 0명

후보 확정 전 사용자 중단 요청이 있어 `south_candidates.json`은 빈 배열로 마감했습니다. 선수명+소속팀+중복 여부를 끝까지 검증하지 못한 이름은 JSON에 넣지 않았습니다.

## 시도한 출처와 확인 내용

### 기존 로스터 확인

- `src/rosters/{kia,samsung,lotte,nc,hanwha}.js`를 읽어 기존 선수명 중복 회피 기준을 확인했습니다.
- 로컬 `tools/scrape_kbo_rosters.py`도 읽기만 했습니다. 이 스크립트는 KBO 등록 현황과 퓨처스 등록 현황에서 각 팀 로스터를 수집하는 구조였습니다.
- 기존 로스터 수는 대략 KIA 55명, 삼성 55명, 롯데 53명, NC 52명, 한화 53명으로 확인했습니다.

### KBO 공식

- 주요 URL:
  - `https://www.koreabaseball.com/Player/Register.aspx`
  - `https://www.koreabaseball.com/Futures/Player/Register.aspx`
  - `https://www.koreabaseball.com/Player/Search.aspx`
- `Register.aspx`는 ASP.NET 포스트백과 숨은 필드(`hfSearchTeam`, `hfSearchDate`)로 팀을 바꾸는 구조였습니다.
- 현재 기존 로스터가 이미 KBO 등록/퓨처스 등록 기반으로 보이며, 단순 재수집만으로는 신규 후보가 거의 나오지 않을 가능성이 높다고 판단했습니다.

### KIA 공식

- 주요 URL:
  - `https://tigers.co.kr/players/pitcher`
  - `https://tigers.co.kr/players/catcher`
  - `https://tigers.co.kr/players/infielder`
  - `https://tigers.co.kr/players/outfielder`
  - `https://tigers.co.kr/v1/game/playerlist`
- React 번들에서 공식 API 호출을 확인했습니다.
- API 호출 형식:
  - POST `https://tigers.co.kr/v1/game/playerlist`
  - 본문 `gameSearch.position=투`, `포`, `내`, `외`
  - 공개 헤더 `AKey`, `App-Agent` 필요
- 호출 결과 예:
  - 투수 56명
  - 포수 7명
  - 내야수 21명
  - 외야수 16명
- 목록 응답은 이름, 등번호, 포지션, 선수 코드, 이미지 URL을 제공했습니다. 상세 API(`/v1/game/pitcherdetail`, `/v1/game/batterdetail`)도 확인했지만 후보 확정 전 작업이 중단되었습니다.

### 삼성 공식

- 주요 URL:
  - `https://www.samsunglions.com/roster/roster_2_list.asp`
  - `https://www.samsunglions.com/roster/roster_3_list.asp`
  - `https://www.samsunglions.com/roster/roster_4_list.asp`
  - `https://www.samsunglions.com/roster/roster_5_list.asp`
- 확인 내용:
  - `roster_2_list.asp`: 투수 56명
  - `roster_4_list.asp`: 군입대선수 5명
  - `roster_5_list.asp`: 신입단선수 11명
- 상세 페이지 예:
  - `https://www.samsunglions.com/roster/roster_2.asp?pcode=77446`
- 상세 페이지에는 생년월일, 포지션/투타, 키/몸무게, 경력, 입단연도 등이 있어 후보 JSON 필드 채우기에 적합했습니다.
- 군입대선수 페이지는 일부 상세 링크 없이 이름/포지션/전역예정일만 보여 후보로 넣으려면 KBO/뉴스 교차확인이 필요합니다.

### 롯데 공식

- 주요 URL:
  - `https://www.giantsclub.com/html/`
  - `https://www.giantsclub.com/html/?pcode=819`
  - `https://www.giantsclub.com/html/?pcode=820`
  - `https://www.giantsclub.com/html/?pcode=821`
  - `https://www.giantsclub.com/html/?pcode=822`
  - `https://www.giantsclub.com/html/?pcode=827`
- 기존 예상 경로 `https://www.giantsclub.com/html/players/players.php`는 오류 페이지였습니다.
- 현행 CMS 메뉴에서 선수단 페이지를 확인했습니다.
- `pcode=819` 투수 목록 등에서 선수 상세 링크(`?pcode=819&pc=...`)를 확인했습니다.
- 상세 페이지 예:
  - `https://www.giantsclub.com/html/?pcode=819&pc=68130`
- 상세 페이지에는 생년월일, 투타, 신장/체중, 경력, 입단년도와 “위 정보는 KBO 등록 정보 기준” 문구가 있어 공식 후보 검증에 적합했습니다.

### NC 공식

- 주요 URL:
  - `https://www.ncdinos.com/player/all/list.do`
  - `https://www.ncdinos.com/player/pitcher/list.do`
  - `https://www.ncdinos.com/player/catcher/list.do`
  - `https://www.ncdinos.com/player/infielder/list.do`
  - `https://www.ncdinos.com/player/outfielder/list.do`
- `all/list.do`는 코칭스태프/트레이너도 포함하므로 포지션별 페이지에서 선수만 걸러야 합니다.
- 포지션별 페이지는 서버 렌더링 목록으로 확인했습니다.
- 상세 페이지 확인 직전 작업이 중단되어 생년월일/투타 필드까지는 확정하지 못했습니다.

### 한화 공식

- 한화는 공식 선수단 페이지/API 확인 단계까지 도달하지 못했습니다.
- 다음 작업에서 최우선으로 확인해야 합니다.

## 막힌 이유

- 중간에 마감 요청이 들어와 후보별 중복 제거와 필드 확정 작업을 완료하지 못했습니다.
- KIA/삼성/롯데/NC는 공식 출처 구조를 상당 부분 확인했지만, 기존 로스터와의 이름 중복 비교 및 후보 JSON 변환을 끝까지 수행하지 못했습니다.
- 한화 공식 출처 확인은 시작하지 못했습니다.
- 정확성이 목표이므로 확실하지 않은 후보를 JSON에 넣지 않았습니다.

## 다음 방법

1. 기존 로스터 이름을 팀별 `Set`으로 만들고, 공식 페이지/API 목록에서 동일 이름을 제외합니다.
2. KIA는 `/v1/game/playerlist`와 상세 API(`/v1/game/pitcherdetail`, `/v1/game/batterdetail`)를 조합합니다.
3. 삼성은 `roster_2/3/4/5_list.asp` 목록과 상세 페이지를 조합합니다. 상세 링크가 없는 군입대선수는 KBO 또는 뉴스로 교차확인합니다.
4. 롯데는 `pcode=819/820/821/822/827` 목록과 `pc` 상세 페이지를 조합합니다.
5. NC는 포지션별 `list.do`에서 선수만 수집하고, `view.do?playerId=...` 상세 페이지에서 생년월일/투타를 확인합니다.
6. 한화는 공식 구단 선수단 페이지를 먼저 찾고, 부족하면 KBO 선수 조회/뉴스 교차확인으로 보완합니다.
7. 확정 후보만 `teamId`, `name`, `position`, `bats`, `throws`, `birthday`, `sourceUrl`, `sourceLabel`, `confidence` 형식으로 저장합니다.
