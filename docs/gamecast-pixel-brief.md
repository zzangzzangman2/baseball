# Codex 작업 브리핑: 도트(픽셀) 중계 화면 고퀄리티 리워크

## 0. 한 줄 목표

`빠른 도트 중계`(Gamecast) 패널을 **진짜 픽셀아트 미니 전광판**으로 다시 만든다.
부드럽고(smooth game-feel), 퀄리티 있고, 한눈에 직관적으로.

---

## 1. 배경 / 지금 상태 (반드시 먼저 이해)

- 프로젝트: 정적 HTML/CSS/JS (빌드 없음). `python -m http.server 5177`로 구동. Electron 패키징만 별도. **npm 빌드 툴/프레임워크 추가 금지.**
- 대상 컴포넌트:
  - 렌더: `src/ui.js`의 `renderGamecastPanel(state)` (약 L1652~1723), 헬퍼 `renderGamecastEvent`, `gamecastOutcomeClass`(L1745), `isGamecastFeedEvent`(L1737).
  - 스타일: `src/styles.css`의 `.gamecast-*` 블록 (L1598~1826), `@keyframes gamecast-run`(L1739).
- **현재 "도트"는 도트가 아니다.** `.gamecast-dot`는 `border-radius:50%` 원형 점이고, 다이아몬드는 `border-radius`로 둥글린 사각형, 그림자는 blur 그림자, 색은 반투명 파스텔이다. 즉 **소프트 벡터**다. 이걸 픽셀아트로 교체하는 게 이 작업의 핵심.
- 엔진은 손대지 않는다. 화면에 필요한 데이터는 이미 `state.lastGames[0]`에 다 들어온다(2절 참조).

---

## 2. 사용할 데이터 (엔진에서 이미 제공됨 — 새 필드 만들지 말 것)

`const game = state.lastGames?.[0]` 기준:

- `game.awayScore` / `game.homeScore` (또는 `awayRuns`/`homeRuns`), `game.away`/`game.home`(팀명), `awayTeamId`/`homeTeamId`.
- `game.plateAppearanceEvents[]`: 각 원소에 `inning`, `side`("home"|"away"), `offenseTeamId`, `hitterName`, `outcome`, `runs`, `outsBefore`, `outsAfter` 등.
  - `outcome` 값: `"single" | "double" | "triple" | "homeRun" | "walk" | "strikeout" | "out"`.
- `game.scoringEvents[]`: 득점 이벤트 요약(피드 우선 소스).
- 프리시즌 등 경기 없을 때는 `game`이 없다 → 기존 "캠프 진행 중" 빈 상태 유지.

> 주자 위치를 실시간으로 알려주는 base-state 필드는 아직 없다. 따라서 다이아몬드의 주자 표시는 **"직전 대표 이벤트(featured) 기반 연출"**로 한다(예: 2루타면 주자 점이 2루로 이동하는 모션 1회). 풀 base-state 추적은 이 작업 범위 밖.

---

## 3. 아트 디렉션 결정 (이 결정을 그대로 따를 것)

**"파스텔 카드 안에 박힌 도트 스크린(미니 전광판)"** 컨셉.

- 앱 전체는 부드러운 파스텔 벡터 UI다. 여기에 레트로 픽셀을 마구 섞으면 싸구려로 보인다.
- 그래서 픽셀아트는 **다이아몬드 영역(스크린) 안쪽에만** 가둔다. 스크린은 깔끔한 베젤/프레임(둥근 모서리, 은은한 안쪽 그림자)으로 감싸서 "의도된 도트 전광판"으로 읽히게 한다.
- 스크린 밖 텍스트(팀명/점수/피드)는 지금처럼 부드러운 벡터 그대로 둔다. **픽셀 폰트로 바꾸지 말 것**(가독성·한글 문제).

### "부드럽게(부드러움)"의 올바른 해석 — 매우 중요
픽셀아트에서 "부드럽게 = 안티에일리어싱/블러"가 **아니다.** 픽셀을 흐리면 즉시 싸구려가 된다. 여기서 부드러움은:
1. **높은 프레임레이트 모션**(requestAnimationFrame),
2. **구간별 이징**(ease-out으로 도착, 살짝 오버슈트),
3. **주스(juice)**: 도착 시 스쿼시, 안타 플래시, 홈런 아크 + 미세 흔들림.
로 만든다. 픽셀 자체는 **항상 선명(crisp)** 하게 유지한다.

---

## 4. 구현 방식: `<canvas>` 픽셀 렌더러

`.gamecast-diamond`(둥근 DOM 다이아몬드)를 **저해상도 캔버스**로 교체한다. 나머지 레이아웃(`.gamecast-layout`, `.gamecast-scoreline`, `.gamecast-now`, `.gamecast-feed`)은 유지.

### 4.1 크리스프 렌더링 체크리스트 (하나도 빠뜨리지 말 것)
- 내부 해상도는 작게: **논리 그리드 80×80 px**(정사각). 여기다 그린다.
- 화면 표시는 **정수 배율만**. 컨테이너 폭에 맞춰 `scale = Math.max(1, Math.floor(cssSize / 80))` 로 정수 스케일 계산.
- 캔버스 실제 픽셀버퍼 = `80 * scale * devicePixelRatio`, CSS 크기 = `80 * scale` px. `ctx.setTransform(scale*dpr,0,0,scale*dpr,0,0)` 후 그리드 좌표로 그린다.
- `ctx.imageSmoothingEnabled = false` (모든 컨텍스트).
- CSS: 캔버스에 `image-rendering: pixelated;`(+ 폴백 `crisp-edges`).
- **정수 좌표에만** 그린다. 서브픽셀 좌표(예: x=12.4) 금지 → 픽셀이 뭉갠다. 주자 보간 위치도 그릴 때 `Math.round`.
- 픽셀 요소에 **blur 그림자 금지.** 그림자가 필요하면 1px 오프셋 단색 픽셀로.

### 4.2 팔레트 (기존 CSS 변수에서 유도한 타이트 팔레트 — 이 값 사용)
material마다 명암 2~3단, 색상은 hue-shift(어두운 쪽=채도↑/색상 이동, 밝은 쪽=노랑 쪽).
```
outline   #2b2830
grass_d   #4f8a73   grass_m #74b49b(leaf)   grass_l #bfe8d8(mint)
dirt_d    #d9a94e   dirt_m  #ffe39a(butter)  dirt_l  #fff2c4
base      #fffefb   base_sh #d8cdbf
runner    #c64b74(berry)   runner_l #e57a9b
hit       #4f8a73 / #74b49b
homer     #ff8f83(coral)   homer_l  #ffb3a6
walk      #b9d9f7(sky)
out       #77717a
ball      #fffefb / #d8cdbf
```
- 총 색 수는 최대한 절제(16색 이내 권장). 파스텔 톤 유지해서 앱과 붙게.

### 4.3 화면 구성(80×80 그리드 기준)
- 배경: 잔디(grass_m) 바닥 + 상단 옅은 그라데이션은 **디더링(체커 패턴)**으로 표현(부드러운 CSS 그라데이션 금지).
- 내야: 다이아몬드형 흙(dirt_m) 마름모, 베이스패스 dirt_l 선.
- 베이스 4개(홈/1/2/3): 작은 사각 픽셀(예 3×3), 흰색(base) + 1px 아래 그림자(base_sh).
  - **직관성**: 현재 주자가 있는 베이스는 runner 색으로 "점등". 없으면 흰색.
- 투수 마운드: 중앙에 작은 dirt 원(픽셀).
- 카운트/아웃/이닝 **한눈에**:
  - 아웃 카운트: 화면 하단에 pip 2칸(●●), 채워짐/빔.
  - 이닝: 상단 모서리에 초/말 화살표(▲말/▼초) 픽셀 아이콘 + 숫자는 스크린 밖 `.gamecast-now`에 이미 있음(중복 금지).
- 주자 점(runner): 2×2~3×3 픽셀. 아웃카운트나 base 상태와 색으로 구분.

### 4.4 애니메이션 & 주스 (featured 이벤트에 반응해 1회 재생)
`featured = 마지막 대표 이벤트`가 바뀔 때마다 트리거:
- 공통: rAF 루프. **표시 위치는 부동소수 보간하되 그릴 때 Math.round**.
- `single/double/triple`: 주자 점이 홈→해당 베이스까지 base-to-base로 이동. 구간당 260~320ms, **ease-out**, 도착 시 3프레임 스쿼시(가로 늘고 세로 눌림). `hit` 색.
- `homeRun`: 공 픽셀이 타석→외야로 **포물선 아크**(약 700ms) + 도착 순간 스크린 1프레임 화이트 플래시 + 패널 전체 2px, 180ms 미세 흔들림(1회). `homer` 색.
- `walk`: 주자 1루로 걸어 이동(느리게, 1.1s, linear). `walk` 색.
- `strikeout`/`out`: 타석 점이 잠깐 깜빡 후 사라짐(회색 `out`). 흔들림 없음.
- 평상시(대기): 아주 미세한 유휴 모션만(예: 마운드 흙 반짝 1px) — 과한 상시 움직임 금지.
- **트레일**: 이동 점 뒤에 1~2프레임 잔상(반투명 아님, 팔레트 밝은 톤 픽셀)으로 속도감. 블러 금지.

### 4.5 접근성 / 성능
- `prefers-reduced-motion: reduce`면 모든 이동/흔들림 생략하고 **최종 상태만** 즉시 표시.
- 탭이 백그라운드거나 패널이 뷰포트 밖이면 rAF 멈춤(IntersectionObserver + `document.hidden`). 재진입 시 재개.
- 캔버스에 `aria-hidden="true"` 유지(정보는 스크린 밖 텍스트/피드가 이미 담당). 스크린리더용 요약은 `.gamecast-now` 텍스트로 충분.
- 리렌더로 캔버스가 새로 생성될 때 이전 rAF/observer를 반드시 정리(누수 방지). 컴포넌트가 매번 innerHTML로 다시 그려지는 구조이므로, init 함수를 렌더 후 1회 부착하고 중복 부착을 가드할 것.

---

## 5. 반응형
- 모바일(~380px)~데스크톱 모두 정수 배율 유지. 폭이 좁으면 scale이 1~2로 떨어져도 **선명**해야 한다(흐려지면 실패).
- 기존 `.gamecast-layout` 2열 그리드가 모바일에서 1열로 접히는 규칙(styles.css의 미디어쿼리 L2902 근처) 유지.
- 캔버스는 컨테이너 폭 변화(ResizeObserver)에 맞춰 정수 배율 재계산.

---

## 6. 수용 기준 (Acceptance) — 전부 충족해야 완료
1. 다이아몬드가 **선명한 픽셀**로 보인다(확대해도 안티에일리어싱/블러 없음, 픽셀 크기 균일).
2. 안타/2·3루타/홈런/볼넷/삼진에 따라 **서로 다른 색·모션**이 재생되고, 홈런은 아크+플래시로 확실히 구분된다.
3. 베이스 점등·아웃 pip·이닝 표시로 **경기 상황이 한눈에** 읽힌다.
4. 모션이 이징/스쿼시/트레일로 **부드럽게** 느껴지되, 픽셀은 항상 crisp.
5. `prefers-reduced-motion`에서 정적으로 동작. 탭 비활성/오프스크린에서 CPU 안 씀.
6. 모바일~데스크톱 어디서도 흐려지지 않고 레이아웃이 안 깨진다(가로 스크롤 없음).
7. 엔진/데이터 스키마/기타 패널 회귀 없음. `npm run verify`, `npm run verify:browser` 통과.

### 자가 검증 절차
- `python -m http.server 5177` 후 브라우저에서 새 게임 시작 → "다음 날" 여러 번 → 경기 발생 후 Gamecast 확인.
- 확대 스크린샷으로 픽셀 선명도 확인(블러 없어야 함).
- DevTools 모바일 뷰(375px)와 데스크톱에서 각각 확인.
- 콘솔 에러 0.

---

## 7. 스코프 밖 (건드리지 말 것)
- `src/engine.js` 및 경기/이벤트 데이터 스키마 변경 금지.
- 픽셀 폰트, npm 빌드 도구, 외부 라이브러리/스프라이트 애셋 추가 금지(전부 코드로 그린다).
- 다른 패널의 파스텔 벡터 톤 변경 금지.
- 팀 로고(64×41 래스터)는 그대로. 픽셀 다이아몬드 안에 억지로 넣지 말 것.

## 8. 지켜야 할 픽셀아트 품질 원칙 (요약)
- **DO**: 균일한 픽셀 크기, 절제된 팔레트+hue-shift 명암, 단일 광원, 선택적 1px 외곽선(순수 검정 대신 어두운 톤), 읽히는 실루엣, 정수 스케일, 이징/오버슈트가 있는 절제된 모션, 그라데이션은 디더링.
- **DON'T**: 픽셀 크기 혼용(제일 큰 아마추어 표시 — 예: 선명 픽셀 위 blur 그림자), 픽셀에 blur 그림자, 소수 배율, 과한 색 수, 전부 순수 검정 외곽선, 쉼 없는 상시 움직임.
