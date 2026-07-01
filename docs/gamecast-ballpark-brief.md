# Codex 작업 브리핑 v3: 볼파크 필드 + 외야 확대 (해상도 상향)

선행: v1(`gamecast-pixel-brief.md`), v2(`gamecast-live-broadcast-brief.md`)는 구현 완료.
**주자 스프라이트(짝대기→사람)는 Claude가 이미 `src/ui.js`에 직접 반영·검증 완료** (`drawPixelSprite`, `drawPixelRunner` 5셀 사람, `drawBaseAndRunner` 사람화). 이 문서는 **남은 "외야가 작다" 문제** = 필드 아트 + 해상도/화면 확대만 다룬다.

## 0. 목표

Gamecast 필드를 "흙 마름모"에서 **진짜 볼파크**로. 넓은 외야(동심원 잔디 무늬)·외야 담장·워닝트랙·원형 마운드·홈 흙·파울폴. 핵심 제약: **내부해상도를 키우면(80→120×108) 좁은 화면에서 정수배율이 1x로 떨어져 오히려 작아진다.** 따라서 **화면(`.gamecast-screen`)도 함께 키워 정수배율 ≥2**를 확보해야 한다.

## 1. 정답지 = 목업 (그대로 이식)

`docs/gamecast-quality-mockup.html` 를 브라우저로 열어 확인(왼쪽=제안). **이 파일의 draw 코드가 검증된 레퍼런스다.** 그대로 포팅:
- `drawField(c,t)` — 픽셀단위 분류기: `dist(x,y)` 기준 관중석/담장(`wall/wallCap`)/워닝트랙(`track`)/동심원 잔디(`grassHi↔grassLo`). focal `FX=60,FY=104`, `WALLR=90`.
- `drawInfield(c)` — 베이스패스(굵은 dirt), 베이스 컷아웃(`fillCircle`), 원형 마운드+러버, 타석박스, 홈플레이트(`sprite`).
- `sprite(c,ox,oy,cells)` — 외곽선 실루엣 헬퍼(이미 `ui.js`에 `drawPixelSprite`로 존재 → 재사용).
- `fillCircle` — `ui.js`에 `fillPixelCircle`로 추가.
- 정적 필드 **오프스크린 1회 캐시** 패턴(목업의 `bg` 캔버스). **매 프레임 픽셀루프 금지**(느려서 렌더가 멈춘다 — 실측 확인됨).

## 2. 해상도 상향 (`src/ui.js`)

1. `const GAMECAST_PIXEL_SIZE = 80;` (ui.js L66) →
   ```js
   const GAMECAST_PIXEL_W = 120;
   const GAMECAST_PIXEL_H = 108;
   ```
   그리고 **모든 `GAMECAST_PIXEL_SIZE` 참조를 W/H로 치환**(canvas width/height 속성, `resizeGamecastCanvas`, `clearPixelCanvas`, `drawPixelAction`의 flash 루프 등).
2. `renderGamecastPanel`의 `<canvas ... width height>` → `width="${GAMECAST_PIXEL_W}" height="${GAMECAST_PIXEL_H}"`.
3. `resizeGamecastCanvas`:
   ```js
   const scale = Math.max(1, Math.floor(available / GAMECAST_PIXEL_W));
   canvas.style.width  = `${GAMECAST_PIXEL_W * scale}px`;
   canvas.style.height = `${GAMECAST_PIXEL_H * scale}px`;
   canvas.width  = Math.round(GAMECAST_PIXEL_W * scale * dpr);
   canvas.height = Math.round(GAMECAST_PIXEL_H * scale * dpr);
   ctx.setTransform(canvas.width / GAMECAST_PIXEL_W, 0, 0, canvas.height / GAMECAST_PIXEL_H, 0, 0);
   ```

## 3. 화면 확대 (`src/styles.css`) — 정수배율 ≥2 필수

현재 `.gamecast-screen`은 `width: min(178px,100%); aspect-ratio: 1;` → 120 내부해상도면 scale=1(흐릿·작음). 고쳐야 함:
- **`.gamecast-layout`를 단일 열(스택)로** 변경(현재 2열 `minmax(220px,...) minmax(...)`). 그래야 스크린이 패널 폭 전체를 쓴다. 피드(`.gamecast-feed`)는 스크린 아래로.
- `.gamecast-screen { width: min(300px, 100%); aspect-ratio: 120 / 108; }` (기존 `aspect-ratio:1` 제거). 안쪽 여유 ≥240 → scale 2 → 240×216 표시.
- 모바일 미디어쿼리(styles.css의 `.gamecast-layout`/`.gamecast-screen` 블록, 약 L2902·L3137)도 스택/새 비율에 맞게 정리.
- 목표: 데스크톱/모바일 모두 canvas 표시폭이 **120의 정수배(240·360…)**가 되도록. 흐려지면 실패.

## 4. 좌표 재매핑 (120×108 기준)

`gamecastBasePositions()` 를 목업 값으로:
```js
home:{x:60,y:96}, first:{x:86,y:76}, second:{x:60,y:56}, third:{x:34,y:76}, mound:{x:60,y:76}
```
이걸 바꾸면 대부분의 재생 애니(경로)가 자동 전파된다. 단, **하드코딩 좌표**를 함께 고쳐야 함:
- `gamecastPathBetween`의 홈인 지점 `{x:40,y:70}` → `{x:60,y:102}`.
- `positionAlongPath` fallback `{x:40,y:66}` → `{x:60,y:96}`.
- `buildBallSprite`/`buildBallTrail`: 투구 시작 마운드 `(40,46)`→`(60,76)`, 홈런 아크 수식(`40+sin*22`, `63-48*eased`)을 새 home/해상도에 맞게(예: `60+sin*34`, `96-4-(96-18)*eased-sin*16`).
- `drawPixelOutPips` `(52+i*8,70)` → 우하단 `(96+i*8,98)`.
- `drawPixelSideIcon` `(9,8)` → `(8,8)` 유지 가능.
- `drawPixelScoreBurst` `(8,63)` → `(8,86)`.
- `clearPixelCanvas`/flash 루프 → `GAMECAST_PIXEL_W/H` 사용.

## 5. drawGamecastFrame 재구성 (오프스크린 캐시)

```js
function drawGamecastFrame(ctx, state, frame){
  if(state.fieldCache) ctx.drawImage(state.fieldCache,0,0);   // 정적 볼파크 1회 캐시 blit
  else drawGamecastFieldTo(ctx,state.palette);
  drawGamecastBaseRunners(ctx,state.palette,frame.bases);      // 누상 주자(사람, 서있는 프레임)
  drawPixelOutPips(ctx,state.palette,frame);
  drawPixelSideIcon(ctx,state.palette,frame);
  drawPixelAction(ctx,state.palette,frame);                    // 애니 주자/공/플래시
  if(frame.scoreFlash) drawPixelScoreBurst(ctx,state.palette,frame);
}
```
- `buildGamecastField(palette)`: 오프스크린 캔버스(120×108)에 `drawGamecastFieldTo`(=목업 drawField+drawInfield+빈 베이스) 1회 렌더 → `state.fieldCache`에 저장(컨트롤러 생성 시).
- 팔레트에 색 추가: `grassLo #4f8a73, grassHi #8fd0b4, grassEdge #3f7361, wall #24483a, wallCap #1b3a2e, track #caa25f, stand #6f6874, standD #575160, crowdA/B/C, pole #ffd23f, dirtD #c78a3e, dirtM #e8b866, dirtL #ffe39a` (dirt은 목업 톤으로 교체).

## 6. 주자 러닝 사이클 (선택 폴리시)

현재 이동 주자는 `runFrame` 없이 그려짐(다리 고정). `buildRunnerSprites`/`makeRunnerSprite`가 각 주자 객체에 `runFrame`을 넣고(`moveT>0.92?2:Math.floor(moveT*8)%2`), `drawPixelAction`이 `drawPixelRunner(..., runner.runFrame)`로 넘기면 다리가 2프레임으로 교차해 "뛰는" 느낌이 산다. 해상도 상향 시 사람 스프라이트를 5×8로 키우면 더 또렷.

## 7. 유지/불변

- 재생 로직(`buildGamecastFrameState`, `scoreForGamecastFrame`, `syncGamecastDom`, 시퀀스 빌더)·엔진·데이터 스키마 **건드리지 말 것**.
- 크리스프 규칙: `imageSmoothingEnabled=false`, `image-rendering:pixelated`, 정수좌표, blur 그림자 금지, 정수배율만.
- reduced-motion: 최종 정지 프레임만. 유휴 시 rAF 정지 유지.

## 8. 수용 기준

1. 외야가 화면의 큰 비중(동심원 잔디 밴드가 뚜렷)이고, 담장/워닝트랙/원형 마운드/홈 흙이 보인다.
2. 확대해도 픽셀 crisp(안티에일리어싱/블러 0), 표시폭이 120의 정수배.
3. 누상 주자·이동 주자가 사람으로 보이고(이미 반영됨) 필드와 대비된다.
4. 정적 필드는 오프스크린 캐시(프로파일러에서 매 프레임 픽셀루프 없음).
5. 모바일~데스크톱 레이아웃 정상, 가로 스크롤 0, 콘솔 에러 0.
6. `npm run verify`, `verify:balance`, `verify:browser` 통과.

## 9. 자가 검증

- `.claude/launch.json`의 `kbo`(python http.server, baseball 서빙) 또는 유저 서버(5177)로 앱 실행 → 새 게임 → `주(week)`로 여러 번 진행 → Gamecast 확인.
- 확대 스크린샷으로 crisp 확인. DevTools 모바일/데스크톱 각각.
- 목업(`docs/gamecast-quality-mockup.html`)과 나란히 비교해 외야 비중·담장·마운드가 목업 수준인지.
