# 능력치 산정용 KBO 공식 기록 수집 메모

## 담당 범위

- 작업 위치: `C:\Users\godho\Downloads\baseball`
- 작성 스크립트: `tools/collect_kbo_stats.py`
- 결과 JSON: `src/ratings_sources/kbo-stats-2026.json`
- 샘플 JSON: `src/ratings_sources/kbo-stats-2026-sample.json`
- 로스터, 엔진, UI 파일은 수정하지 않았다.

## 공식 기록 경로

조사한 KBO 공식 기록실 시즌 목록 페이지:

- KBO 정규시즌 타자 기본기록 목록: https://www.koreabaseball.com/Record/Player/HitterBasic/Basic1.aspx?sort=HRA_RT
- KBO 정규시즌 투수 기본기록 목록: https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx?sort=ERA
- KBO 퓨처스 타자 기록실: https://www.koreabaseball.com/Futures/Player/Hitter.aspx
- KBO 퓨처스 투수 기록실: https://www.koreabaseball.com/Futures/Player/Pitcher.aspx

현재 파이프라인이 playerId 조인에 사용한 KBO 공식 선수 상세 기본기록 URL:

- 정규시즌 타자 상세: `https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId={playerId}`
- 정규시즌 투수 상세: `https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId={playerId}`
- 퓨처스 타자 상세: `https://www.koreabaseball.com/Futures/Player/HitterDetail.aspx?playerId={playerId}`
- 퓨처스 투수 상세: `https://www.koreabaseball.com/Futures/Player/PitcherDetail.aspx?playerId={playerId}`

목록 페이지도 공식 시즌 기록을 제공하지만 페이징/정렬/규정타석 필터에 따라 누락이 생길 수 있다. 그래서 현재 구현은 로컬 current roster의 `playerId`마다 상세 기본기록 페이지를 직접 조회한다.

## JSON 스키마

각 선수 항목은 능력치 산정 로직에서 바로 조인할 수 있도록 아래 필드를 가진다.

- `playerId`: KBO playerId
- `name`: 로컬 current roster 선수명
- `teamId`, `teamName`: 로컬 current roster 소속
- `role`: `hitter` 또는 `pitcher`
- `season`: 수집 시즌
- `sourceUrls`: 정규시즌/퓨처스 상세 URL
- `stats`: 공식 표에서 파싱한 기록

`stats.regular`와 `stats.futures`는 각각 `official`, `normalized`, `tables`를 가진다.

- `official`: KBO 표의 표시값을 그대로 보존한다.
- `normalized`: 산정 로직에서 쓰기 쉬운 영문 키와 숫자값으로 변환한다.
- `tables`: 원래 표 헤더와 행을 보존한다.

정규시즌/퓨처스 모두 기록 행이 없으면 `stats`는 빈 객체이고 `reason`에 누락 사유를 남긴다. 기록값은 추정하지 않는다.

## 수집 결과

실행 명령:

```powershell
python tools\collect_kbo_stats.py --max-workers 8 --timeout 25
```

결과:

- current roster 대상: 531명
- 정규시즌 상세 기록 수집 성공: 380명
- 퓨처스 상세 기록 수집 성공: 401명
- 정규/퓨처스 중 하나 이상 기록 보유: 530명
- 공식 상세 기본기록 양쪽 모두 기록 없음: 1명
- 네트워크/파싱 오류: 0명
- 중복 `playerId`: 0건
- 필수 필드 누락: 0건

기록 없음:

- 삼성 라이온즈 투수 한수동, `playerId=56436`
- 사유: KBO 정규시즌/퓨처스 상세 기본기록에 2026 시즌 기록 행이 없음

## 네트워크 상태

이번 실행에서 KBO 공식 페이지 접근은 막히지 않았다.

- 정규시즌 상세 URL 요청 오류: 0건
- 퓨처스 상세 URL 요청 오류: 0건
- 응답 HTML에서 시즌 기록 블록 파싱 실패로 인한 오류: 0건

향후 네트워크가 막힐 경우 스크립트는 각 선수의 `errors`에 실패 URL, 예외 타입, 메시지를 남긴다.

## 사용 주의

- 이 파일들은 능력치 산정을 위한 공식 기록 입력 데이터다.
- `official`에 없는 기록은 만들지 않는다.
- 선수의 실제 포지션 세분화, 수비 평판, 부상, 구속 같은 정보는 이 파이프라인이 수집하지 않는다.
- 능력치 산정 로직은 `normalized`를 활용하되 표본이 작은 선수는 정규/퓨처스 출전량을 함께 고려해야 한다.
