# Codex 작업 브리핑: Gamecast만 Phaser 3 하이브리드 이식

## 0. 목표 / 경계

경기 화면(`경기 보기 도트 중계`)의 **그라운드·선수·공·연출**을 Phaser 3 씬으로 이식한다. 나머지(HUD 텍스트·피드·컨트롤·스코어라인·B/S/O 상황판)는 **DOM 유지**. 앱의 나머지 화면(프런트오피스 등)은 손대지 않는다.

- **Phaser 담당**: 필드(스타디움/잔디/내야/베이스), 선수 스프라이트(수비 9명·타자·주자·심판·코치), 공, FX(카메라 흔들림·파티클·트레일).
- **DOM 유지**: `.gamecast-scoreline`, `.gamecast-feed`, `.gamecast-now`, 컨트롤(x1/x2/x3/x4/스킵), 그리고 **B/S/O 카운트 상황판·중앙 전광판·아웃 pip은 canvas에서 DOM 오버레이로 이전**(텍스트/한글/반응형은 DOM이 유리).

> 솔직한 전제: **Phaser가 스프라이트를 예쁘게 만들어주지 않는다.** 퀄리티 향상의 핵심은 6절 "스프라이트 아틀라스"다. Phaser는 그걸 굴리는 뼈대(트윈·아틀라스·정수줌·파티클·카메라)일 뿐. 아틀라스 없이는 Canvas 때와 똑같이 허접하다. 그래서 8절에 "실아트 전 임시 텍스처" 경로를 둬서 이식을 막지 않게 한다.

## 1. 절대 불변 (하나라도 어기면 실패)

1. **엔진 무수정·결정론 유지.** `src/engine.js`와 이벤트 스키마 건드리지 말 것. Phaser는 **순수 뷰**로 `game.plateAppearanceEvents`만 읽는다. `npm run verify:balance` 수치가 이식 전과 동일해야 한다.
2. **씬 안에서 `Math.random()`/`Date.now()`/`new Date()` 금지.** 앱 결정론 규칙과 동일. 코스메틱 변주는 **이벤트 id/시퀀스로 시드**한 해시로 뽑는다(같은 세이브→같은 재생).
3. **번들러 도입 금지.** Phaser는 `assets/vendor/phaser.min.js`(UMD)로 vendoring해서 `<script>`로 로드. CDN 금지(오프라인/Electron/CSP). 버전 핀 고정.
4. **기존 DOM UI/컨트롤 보존.** 시작 화면·모달 골격·피드·스코어라인·속도 컨트롤 그대로.
5. **생명주기.** 모달 열 때 `new Phaser.Game`, 닫을 때 `game.destroy(true)`. 중복 인스턴스 가드. 리렌더 시 누수 금지(현재 `createGamecastPixelController` cleanup 패턴 계승).
6. **폴백 플래그.** `state.ui.gamecastEngine = "phaser" | "canvas"` 플래그로 두 경로를 A/B. 패리티 도달 전까지 기존 canvas 경로 삭제 금지.

## 2. 재사용할 현재 자산 (새로 만들지 말 것)

- 시퀀스 빌더: `buildGamecastSequence(game, state, mode)` — 정규화 PA 이벤트 배열 + `startAway/startHome/finalAway/finalHome/paMs/gapMs/mode/id`. **그대로 재사용**(Phaser 재생의 입력).
- 이벤트 필드: `outcome`(single/double/triple/homeRun/walk/strikeout/out), `inning`, `side`, `basesBefore[3]`, `basesAfter[3]`, `scoredRunners`, `hitterName`, `pitcherName`, `fieldingPosition`, `battedBallType`, `doublePlay`, `reachedOnError`, `teamColor`, `teamJerseyColor`, `defenseColor`, `defenseJerseyColor` 등.
- 좌표: `gamecastBasePositions()`(home/first/second/third/mound, 120×108 논리그리드) → Phaser 월드 좌표의 기준.
- 페이싱 상수: `GAMECAST_WATCH_PA_MS`(2600), `GAMECAST_WATCH_GAP_MS`(340) → 트윈 총길이.
- 팀색: `TEAM_META[id].color`, 홈=흰 유니폼/원정=진회색 관례(이미 반영됨).
- DOM 동기화: `syncGamecastDom(state, frame)` 로직(점수/now/피드/카운트) — Phaser 재생 콜백에서 호출하도록 이관.
- 결과어 매핑: `gamecastJumbotronText`, `outcomeLabel`, `gamecastPitchCount`(B/S/O 연출값).

## 3. Phaser 게임 구성 (crisp 픽셀)

```js
new Phaser.Game({
  type: Phaser.AUTO,               // WebGL 우선, 폴백 Canvas
  parent: screenEl,                // .gamecast-screen DOM 노드
  width: DESIGN_W, height: DESIGN_H,
  backgroundColor: "#0d1a14",
  pixelArt: true,                  // nearest-neighbor
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, zoom: integerZoom }, // 정수배율만
  fps: { target: 60 },
  scene: [GamecastScene]
});
```
- **DESIGN_W/H**: 현재 논리그리드는 120×108. Phaser에선 스프라이트 디테일 여유를 위해 **2배(240×216) 권장** — `gamecastBasePositions()` 등 좌표에 ×2 스케일 팩터 적용. (줌은 Phaser가 처리하므로 논리해상도만 키우면 됨.)
- **정수줌**: 컨테이너 폭 기준 `zoom = max(1, floor(containerW / DESIGN_W))`. ResizeObserver로 `game.scale.setZoom(zoom)` 갱신. 흐려지면 실패.
- DPR: Phaser가 처리(`resolution`/zoom). 확대해도 픽셀 crisp여야 함.

## 4. 씬 레이어(컨테이너)와 depth

- `fieldLayer` (depth 0): 스타디움/잔디/내야/베이스 — **정적**(6절 텍스처 또는 타일맵). 매 프레임 재생성 금지(현재 오프스크린 캐시와 동일 취지).
- `playerLayer` (depth 10): 수비 9명·타자·주자·심판·코치. **y좌표로 depth 정렬**(앞 선수가 위에).
- `ballLayer` (depth 30): 공(항상 최상단, 둥근 스프라이트·후광).
- `fxLayer` (depth 40): 파티클(먼지·컨페티·트레일).
- HUD는 Phaser에 그리지 않는다(DOM 오버레이, 10절).

## 5. 엔진→Phaser 재생 브리지 (핵심)

`buildGamecastSequence`의 이벤트 배열을 Phaser 타임라인으로 재생.

- **PA 단위 재생 컨트롤러**: `playPa(event)`가 트윈 체인을 만든다:
  1. 투구: 공 mound→home 트윈(ease-in), (연출) B/S 카운트 상승.
  2. 결과 분기(`outcome`): 타구/헛스윙 포즈 전환.
  3. 진루: `advance = {single:1,double:2,triple:3,homeRun:4,walk:1}[outcome]`. `basesBefore`의 주자 + 타자를 각각 목표 베이스로 **트윈**(ease-out, 도착 시 살짝 오버슈트/스쿼시). 홈인 주자는 home 밑으로 빠지며 득점 연출.
  4. **정착 = basesAfter로 스냅**(진실의 원천). 트윈 근사와 달라도 `basesAfter`가 최종.
  5. 이닝 종료(`inningEnded`)면 정착 후 다이아몬드 비우기.
- **총길이 = paMs**(watch 2600). **속도 컨트롤**(x1/x2/x3/x4) → `scene.tweens.timeScale`(또는 game loop timeScale). **스킵** → 마지막 이벤트 최종상태로 점프.
- **DOM 콜백**: 각 PA 시작/득점/정착 시점에 `syncGamecastDom`류로 점수·now·피드·B/S/O 갱신(트윈 `onStart`/`onComplete`/`onUpdate`).
- **reduced-motion**: 트윈 스킵, 각 PA 최종상태만 즉시.
- 좌표 헬퍼: `gamecastBasePositions()` 값 ×(DESIGN 스케일)로 월드좌표 변환 유틸 하나 만들 것.

## 6. 스프라이트 아틀라스 (진짜 퀄리티 = 여기)

Aseprite 등으로 제작 → **PNG 아틀라스 + JSON(Phaser atlas hash 포맷)**, `assets/gamecast/`에 동봉.

- **player.atlas** — 프레임: `idle`, `run1`,`run2`(달리기 2~4프레임), `slide`, `stance`(타격준비), `swing`, `follow`, `pitch`, `windup`, `field`, `catch`, `dive`, `walk`. 규격 권장 **16×24px**(현 9×13보다 크게 → 실루엣 또렷). 유니폼은 **흰/회색 2벌 베이스** + **모자/트림은 팀색 tint**(7절).
- **ball.atlas** — 공(정지/모션블러 2~3프레임), 흰 공 + 빨간 실밥, 검은 사각 테두리 없음(둥글게).
- **field**: 타일맵 또는 단일 배경 텍스처(외야 동심원 잔디·담장·워닝트랙·마운드·홈·파울라인). 정적.
- **base.atlas**: 베이스(빈/점유), 홈플레이트.
- **크라우드**: 타일 스트립(관중 열) 텍스처 + 팀색 변주. 웨이브는 스프라이트 애니 or tween.

> 아트 스펙 문서를 별도로 뽑아도 됨(포즈표·프레임규격·팔레트·안티에일리어싱 금지·단일광원). 요청 시 작성.

## 7. 팀 유니폼/색

- 베이스 텍스처는 **무채색(흰/회색)** 1벌씩. 팀 아이덴티티는 **모자/트림 레이어를 `setTint(TEAM_META[id].color)`** 또는 팔레트 스왑으로 입힘.
- 홈=흰 베이스, 원정=진회색 베이스(현행 관례 유지) → 몸통 대비로 팀 구분, 모자색으로 팀 식별. (LG·키움처럼 둘 다 붉은 팀도 흰/회색으로 갈림.)

## 8. 실아트 전 "임시 텍스처" 경로 (이식 비차단)

아틀라스가 준비되기 전에도 씬이 돌게: 부팅 시 **현재 `drawPixel*` 코드로 `Phaser.GameObjects.RenderTexture`/`scene.textures.generate`에 스프라이트를 1회 렌더**해 키 등록 → 스프라이트로 사용. 이러면 브리지·트윈·정수줌·DOM연동을 **실아트 전에 완성**하고, 나중에 아틀라스만 스왑. (임시 텍스처 품질=현행 수준이지만 구조는 완성됨.)

## 9. FX

- 홈런: `scene.cameras.main.shake(180, 0.006)` + 화면 플래시(오버레이 rect fadeOut) + 공 포물선 트윈 + 파티클 트레일.
- 슬라이딩/도루: 먼지 파티클(dust). 득점: 홈플레이트 컨페티 + 점수 tick.
- 공 트레일: 파티클 emitter(공 뒤).
- 모두 seed된 변주만(2절).

## 10. DOM HUD 오버레이 이전

canvas에 그리던 것들을 **Phaser 위에 절대배치 DOM**으로:
- **B/S/O 카운트 상황판**(현 `drawPixelBroadcastBug`) → DOM 요소. 재생 progress로 B/S 연출값 갱신(엔진에 카운트 없음 명시 주석 유지), O는 실제값.
- **중앙 전광판**(현 `drawPixelCenterScoreboard`) → DOM(팀 약자·이닝·점수·결과어). 팀 약자/한글은 DOM이 깔끔.
- **아웃 pip / side 아이콘** → DOM.
- `.gamecast-scoreline`/`.gamecast-feed`/`.gamecast-now`/컨트롤 = 그대로.
- 오버레이는 `.gamecast-screen`을 `position:relative`로 두고 그 위에 `position:absolute` 레이어. Phaser 캔버스와 정렬.

## 11. 파일 변경

- `assets/vendor/phaser.min.js` (신규, vendoring). `index.html`에 `<script src="./assets/vendor/phaser.min.js"></script>`를 `main.js`보다 먼저.
- `src/gamecastPhaser.js` (신규): `GamecastScene` + 재생 브리지 + 좌표 유틸 + 임시 텍스처 생성.
- `src/ui.js`: 모달 오픈 시 `mountGamecastPhaser(screenEl, sequence, hooks)` 호출, 클로즈/리렌더 시 `destroy`. `state.ui.gamecastEngine` 플래그 분기. DOM HUD 오버레이 렌더.
- `src/styles.css`: 오버레이 절대배치·정렬.
- `package.json` `build.files`에 `assets/vendor/**/*`, `assets/gamecast/**/*` 포함(Electron 패키징).
- `electron-main.cjs`/CSP: 로컬 스크립트 허용 확인(기본 허용).

## 12. 점진 이식 순서 (안전)

1. Phaser vendoring + `<script>` + 로드 가드. 플래그 추가(기본 canvas 유지).
2. `GamecastScene` 스켈레톤 + 정수줌 + ResizeObserver + 생명주기.
3. 임시 텍스처(8절)로 필드/선수/공 표시.
4. 시퀀스→트윈 재생 브리지 + 속도/스킵 + reduced-motion.
5. DOM HUD 오버레이 이전(카운트/전광판/pip).
6. 필드 정적 텍스처/타일맵.
7. 실 스프라이트 아틀라스 임포트 → 임시 텍스처 스왑.
8. FX(카메라 흔들림·파티클).
9. 패리티 확인 후 플래그 기본값 phaser로 전환, 기존 canvas 경로 제거.

## 13. 수용 기준

1. `경기 보기`가 Phaser로 렌더되고, 확대해도 픽셀 crisp(정수줌), 모바일/데스크톱 레이아웃 정상.
2. 타석이 트윈으로 부드럽게 진행(2.9s/타석), x1~x4·스킵·reduced-motion 동작.
3. 홈=흰/원정=회색으로 팀 구분, 주자·수비·타자·심판이 스프라이트로 명확.
4. 점수·now·피드·B/S/O(연출)·아웃(실제)이 재생과 동기화(DOM).
5. 공은 둥글고 잘 보이며 검은 사각 테두리 없음, 홈런에 카메라 흔들림/파티클.
6. **결정론 유지**: `npm run verify`, `verify:balance`, `verify:browser` 통과. 씬에 `Math.random`/`Date.now` 없음(seed된 변주만).
7. 모달 닫으면 `game.destroy`로 정리, 탭 비활성/오프스크린 시 씬 pause(누수·유휴부하 0).
8. 오프라인/Electron에서 Phaser 로컬 로드 성공(CDN 미사용).

## 14. 자가 검증

- `.claude/launch.json`의 `kbo`(python http.server, baseball 서빙) 또는 유저 서버(5177)로 실행 → 새 게임 → 정규시즌 진입 → `경기 보기`.
- 확대 스크린샷으로 crisp 확인. DevTools 모바일(375)/데스크톱. Performance: 재생 종료·오프스크린 시 유휴부하 확인.
- 플래그를 canvas↔phaser 토글해 회귀 비교.
- `verify` 3종 통과.

## 15. 스코프 밖 (건드리지 말 것)

- 엔진/데이터 스키마/RNG 변경 금지.
- 번들러/프레임워크 추가 금지(Phaser UMD script만). CDN 금지.
- 씬 내 `Math.random`/`Date.now` 금지.
- DOM HUD를 Phaser로 옮기지 말 것(텍스트/한글/반응형은 DOM).
- 다른 화면·프런트오피스 UI 변경 금지.
- 실 스프라이트 아틀라스가 없으면 임시 텍스처로 진행(품질은 아트 임포트 후 상승).

## 16. 참고 (엔진 한계 = 정직하게)

- 볼/스트라이크 카운트는 엔진에 없음(타석 1롤 판정) → B/S 상황판은 재생 progress 기반 **연출값**, O만 실제. 진짜 카운트를 원하면 엔진에 투구 단위 시뮬 추가가 선행돼야 함(별도 대형 작업).
- 좌우 상성/파크팩터/수비 포지셔닝 등도 엔진 미모델 → 중계 연출은 이벤트가 주는 범위(outcome·basesAfter·fieldingPosition) 내에서만.
