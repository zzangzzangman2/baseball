# Electron 렌더링/패키징 QA 보고서

- 실행 시각: 2026-07-16T03:10:43.930Z
- 작업 폴더: C:\Users\godho\Downloads\baseball
- 실행 Node: C:\Program Files\nodejs\node.exe (v24.18.0)
- 렌더링 검증 URL: http://127.0.0.1:57956/index.html
- 검증 렌더러: chrome.exe
- 종합 결과: 통과 (8/8 통과, 경고 1건)

## 체크 결과

| 항목 | 결과 | 상세 | 위치 |
| --- | --- | --- | --- |
| 정적 로컬 서버 시작 | PASS | http://127.0.0.1:57956/index.html | - |
| Chromium 브라우저 연결 | PASS | chrome.exe CDP 연결 완료 | - |
| Electron 패키징 구성 | PASS | main=electron-main.cjs, preload=electron-preload.cjs, product=KBO GM Manager | - |
| 선수 총원 기준 | PASS | 총 531명 | - |
| desktop 렌더링 | PASS | 1280x900, 팀명 10/10, 로고 23/23, 계약패널 OK, 가을야구 OK, 드래프트 OK, 2차드래프트 OK, 트레이드실행 OK, FA시장 OK, 자동스토브 OK, 다음시즌 OK, 다음경기선택 OK, 라인업보드 OK, 선수상세 OK, 프리시즌 OK, 빠른주간 OK, 도트중계 OK, 선수이름표 OK, 클리핑 0, 투수운용 OK, 기록실 OK, 박스스코어 5, body/client 1265/1265, overflow 0px | - |
| mobile 렌더링 | PASS | 390x844, 팀명 10/10, 로고 23/23, 계약패널 OK, 가을야구 OK, 드래프트 OK, 2차드래프트 OK, 트레이드실행 OK, FA시장 OK, 자동스토브 OK, 다음시즌 OK, 다음경기선택 OK, 라인업보드 OK, 선수상세 OK, 프리시즌 OK, 빠른주간 OK, 도트중계 OK, 선수이름표 OK, 클리핑 0, 투수운용 OK, 기록실 OK, 박스스코어 5, body/client 390/390, overflow 0px | - |
| 게임캐스트 랩 | PASS | desktop 953x858, feed 0/77, single-instance OK, speed-persist OK, defense/skip/x4 OK, pause/step OK, playfeel ball 20/36, midview 800/920/1100, mobile canvas 305px, v2 anchors 18, players 10, v2 atlas/timeline 128-day/single, equipment catcher catcher_frame, runner idle @ 0px, v2 fx camera<=1.000, particles 0, underlays 3, inline default v2 960x720 | - |
| 브라우저 콘솔 에러 | PASS | 5개 콘솔 이벤트 수집, error 0건 | - |

## 경고

- 선수 총원은 531명입니다. 현재 정책은 검증된 등록/퓨처스 중심 500명대 로스터입니다.

## 실행 명령

```powershell
npm run verify:electron
```

