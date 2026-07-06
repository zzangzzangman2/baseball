# Codex 작업지시서: 게임캐스트(실시간 도트 중계) 진단과 수리

작성일: 2026-07-06
분석 방법: `src/gamecastPhaser.js` 865줄 전체 정독 + `src/ui.js` 게임캐스트 계층 정독 + **실제 브라우저 구동 관찰**(신규 QA 랩 `gamecast-lab.html`로 정규시즌 경기 관전을 즉시 열어 픽셀 샘플링/캔버스 추적/모바일 리사이즈 검증).
선행 문서: `docs/codex-playability-work-order.md`(전체 로드맵), `docs/codex-daily-loop-work-order.md`(하루 루프).

---

## 0. 새 QA 랩 (이번에 추가됨 — 앞으로 게임캐스트 작업은 반드시 이걸로 확인)

- **`gamecast-lab.html`** + `src/gamecastLab.js`: 온보딩/프리시즌을 건너뛰고 로드 즉시 정규시즌 경기 관전을 연다.
- 옵션: `?engine=canvas|phaser` `?days=N`(개막 후 진행일수, 기본 3) `?fullscreen=0`(큰 화면 자동 열기 끔) `?team=lg`
- `window.__labState`로 상태 인스펙션 가능. 실제 앱 모듈(data/engine/ui)을 그대로 import하므로 코드 중복 없음.
- 서버: `python -m http.server 5177` 후 `http://127.0.0.1:5177/gamecast-lab.html`

---

## 1. 한 줄 진단

연출 소재(도트 필드, 스프라이트 아틀라스, 팀컬러 리컬러, HUD, 액션 버스트)는 이미 풍부한데, **재생 수명주기가 부서져 있다**: 탭을 잠깐 벗어나면 경기가 통째로 스킵되고, 아무 상태 변경에도 1회초부터 재시작하며, 관전 화면 바로 아래 피드에 최종 결과가 처음부터 스포일러로 떠 있다. "실시간 경기를 본다"는 감각을 만드는 건 그림이 아니라 **시간 관리와 정보 공개 순서**다 — 지금 그 두 개가 고장이다.

## 2. 라이브 구동에서 확정한 문제 (증거 포함)

### A급 — 관전 경험을 부수는 것

**A-1. 탭이 백그라운드가 되면 경기를 통째로 스킵한다.**
- `onVisibilityChange`: `if (state.hidden) finish();` — Phaser 경로 ui.js:5056-5060, Canvas 경로 ui.js:5208-5209.
- 관찰: 자동화 탭이 백그라운드인 동안 로드된 모든 관전이 수 초 안에 "9말 2OUT 최종 타석" 상태로 점프. 유저 시나리오 = 경기 틀어놓고 카톡 잠깐 확인 → 돌아오면 끝나 있음.
- 수리: hidden → `pause()`, visible 복귀 → `resume()`. (finish는 절대 금지. rAF가 백그라운드에서 멈추므로 pause만으로 충분하다.)

**A-2. 최종 결과 스포일러.**
- 피드가 경기 **전체** PA(9회 결과 포함)를 처음부터 DOM에 렌더한다: `feedItems` 사전 수집 ui.js:4879, 재생 중에는 `is-live` 클래스만 옮겨 다님(`syncGamecastDom` ui.js:7181-7183). 관찰: 관전 시작 직후 피드 최상단에 "9회 말 · 홍창기 삼진"(경기 마지막 타석)이 보였다.
- 정적 렌더 시점의 매치업 칩/`gamecast-now`에도 마지막 PA가 박힌다(`featured`가 최종 이벤트, ui.js:4495-4501) — 첫 프레임 sync 전까지 "9말 · 삼진 · 6-1"이 노출.
- 수리: watch 모드에서는 ① 피드를 현재 진행 시점까지만 공개(`is-upcoming` 숨김 클래스 or 진행에 따라 li 삽입), ② 초기 featured를 첫 이벤트(또는 "경기 시작 대기")로, ③ 스코어라인·HUD 초기값 0-0(이미 startAway/Home=0 사용 중 — 매치업 칩만 어긋남).

**A-3. 아무 상태 변경이든 일어나면 중계가 1회초부터 재시작 + 속도 x1로 리셋.**
- 매 render마다 `initGamecastPixelScreen()`이 이전 컨트롤러 전부 cleanup 후 재생성(ui.js:4849-4906), 새 컨트롤러는 `elapsedMs: 0`(ui.js:4986). 재생 위치/속도를 담을 자리가 시퀀스에 없음(`normalizeGamecastSequenceForPlayback` ui.js:5276-5289에 position 필드 부재).
- 트리거 예: 엔진 토글, 큰 화면 열기/닫기, 뉴스 도착으로 인한 재렌더, 다른 버튼 클릭 등 전부.
- 수리: 모듈 레벨 `gamecastPlaybackStore = { sequenceId, elapsedMs, playbackRate, done }`를 두고 remount 시 같은 sequenceId면 이어서 재생. cleanup에서 현재 위치 저장.

**A-4. 관전 1회 = 라이브 인스턴스 2개.**
- watch 시작이 곧바로 broadcast 모달을 열고(`gamecastExpanded`), 인라인 screen + 모달 screen이 **둘 다** `[data-gamecast-screen]`으로 mount된다(ui.js:4496 vs 4543). 관찰: 캔버스 2개, 클래스 `is-phaser-active` 2개(인라인은 화면 밖 y=3862에서도 active). IntersectionObserver가 offscreen을 pause해 주긴 하나 생성 비용·메모리·유지 복잡도가 2배고, 진행 연출(아래 A-5)마다 2개씩 재생성된다.
- 수리: watch 모드에서는 화면에 보이는 인스턴스 하나만 mount(모달 열리면 인라인 stage를 placeholder로).

**A-5. 날짜 진행 연출마다 Phaser 인스턴스를 5~6회 재생성.**
- `runCalendarAdvance`가 진행바 5단계 각각 `render(root, state)` 호출(ui.js:2743-2760) + 완료 1회 — 순위 탭 등에 게임캐스트가 있으면 매 단계 파괴/재생성(Phaser.Game 생성은 프레임버퍼/씬 구축 포함, 체감 랙).
- 수리: A-3의 playback store가 있으면 완화되지만, 근본적으로는 진행바 단계 갱신을 full render 대신 진행 패널만 부분 갱신으로.

**A-6. 종료/닫기 후 검은 화면.**
- 관찰: 경기 종료 상태에서 캔버스가 순수 검정(0,0,0 — Phaser 배경색 #0d1a14도 아님)이었다가, 다른 시점엔 필드 정지화면이 남는 등 비결정적. `cleanup()`의 `game.destroy(true)`(gamecastPhaser.js:127)가 캔버스를 지우는 타이밍과 `paintStaticHoldFrame`(gamecastPhaser.js:326)의 순서 경합으로 보임.
- 수리: 종료 상태의 공식 화면을 정의하라 — 필드 + 최종 스코어보드 + "경기 종료 · 박스스코어 보기" 오버레이를 DOM으로 얹고, destroy는 그 뒤에.

### B급 — 레이아웃/스케일

**B-1. 모바일에서 필드 좌우가 잘린다.**
- `calculatePhaserMetrics`: `available = Math.max(runtime.width, ...)` → 최소 400 CSS px 강제(gamecastPhaser.js:152). 관찰: 375px 뷰포트에서 캔버스/스테이지 400px, 조상 `overflow:hidden`으로 페이지 오버플로 0을 유지하며 **필드 양옆 ~14%가 크롭**(코너 외야/파울 폴 안 보임). verify:browser가 "overflow 0"으로 통과하는 이유가 바로 이 크롭이다.
- 수리: 컨테이너가 400px 미만이면 정수 스케일 고집을 버리고 CSS transform scale(<1)로 전체 필드를 축소해 보여줄 것(픽셀아트 흐림은 image-rendering: pixelated로 완화).

**B-2. 데스크톱 "큰 화면"이 크지 않다.**
- 정수 스케일(1x, 2x, ...)만 지원: 컨테이너 799px면 1x(400px)로 절반이 빈다. 관찰: 큰 화면 모달에서도 캔버스 400px.
- 수리: 큰 화면 모달은 컨테이너에 맞춘 최대 정수 스케일 + 잔여분 CSS scale 보정(또는 0.5 단위 스케일 허용). `ResizeObserver`가 재렌더로 교체된 screen 노드를 계속 관찰하는지도 함께 점검(교체되면 관찰 대상이 detached — resize 미동작).

### C급 — 연출/콘텐츠

**C-1. PA 텍스트가 중계 문장이 아니라 태그 나열이다.**
- 관찰된 피드: "구자욱 홈런 · 뜬공 · 1득점", "최형우 타구 · 땅볼 · 천성호(IF)". `gamecastMatchupResult`가 outcome+타구질+수비수를 `·`로 기계 연결(ui.js:4609-4617). "홈런 · 뜬공"처럼 어색한 조합이 그대로 노출.
- 수리: outcome별 문장 템플릿 3~5종(deterministic 선택, hashParts) — "구자욱, 좌측 담장을 넘기는 솔로포!", "유격수 정면 땅볼, 천성호가 처리". 홈런은 타구질 언급 금지, 병살/실책/득점권은 전용 문구.

**C-2. 볼카운트(B/S)는 연출용 합성값이다.**
- 엔진에 투구 단위가 없으므로 `gamecastPitchCount(frame)`가 만들어낸 값(HUD 핍 ui.js:7196-7198). 지금은 괜찮은 트릭이지만, 문서화되어 있지 않고 삼진/볼넷 결과와 카운트 전개가 모순될 수 있다.
- 수리(소형): outcome과 정합적인 카운트 시퀀스 생성(삼진→2S에서 종료, 볼넷→3B 경유). 수리(대형·후속): 타석엔진 v2(투구 단위)와 함께 진짜 데이터로 — 선행 문서 WP-19.

**C-3. 구장/시간대/날씨 연출 부재.**
- 엔진은 구장 파크팩터·날씨(기온/런팩터)·관중수를 이미 계산하지만, 필드는 단일 그림(`drawFieldCanvas` gamecastPhaser.js:356-421 고정 팔레트), 밤/낮·우천·구장 개성(고척 돔, 사직 등) 없음. 잠실이든 창원이든 같은 화면.
- 수리(단계): ① 홈팀별 팔레트 스킨(잔디 톤/담장색/광고판 색만 바꿔도 체감 큼), ② 날씨 오버레이(비/더위 이글거림), ③ 야간 경기 조명 톤. `docs/gamecast-ballpark-brief.md` 참조.

**C-4. 군중/분위기 반응이 정적.**
- 관중은 필드 텍스처에 구운 정적 픽셀(drawCanvasCrowd). 득점/홈런 때 flash·shake는 있지만 응원 리듬, 점수차·상황별 분위기 변화 없음. 홈런 순간 관중석 파도/플래시 정도의 저비용 연출 여지.

**C-5. 매 타석 동일한 카메라·동일한 템포.**
- 모든 PA가 paMs(watch 2600ms) 고정 길이. 만루 위기든 3구 삼진이든 같은 호흡. 수리: 상황 가중 템포 — 득점권/동점/역전 타석은 pre-pitch 홀드를 길게(긴장), 범타는 짧게. `leverage` 근사(이닝·점수차·주자)로 가중.

### D급 — 조작성

**D-1. 스킵이 "경기 끝"뿐이다.** `finish()` 일괄 점프(ui.js:5052-5055). 타석 스킵/이닝 스킵/다음 득점 장면까지 같은 세분화 없음. 되감기·타임라인 탐색 없음(이벤트 배열이 이미 있으므로 elapsedMs 세팅만으로 구현 가능).
**D-2. 일시정지 버튼이 없다.** pause는 가시성 이벤트 내부용뿐. 스페이스바/버튼 일시정지 필요.
**D-3. 경기 중 개입 불가(감독 모드 없음).** 투수 교체·대타·작전은 시뮬이 끝난 리플레이라 원천 불가 — 이건 버그가 아니라 아키텍처(전체 시뮬 후 재생). 라이브 개입은 엔진의 이닝 단위 재개(suspend/resume) 지원이 필요한 대형 작업 → 선행 문서 WP-19와 함께 P3로 명시.

### E급 — 미확정 관찰 (조사 항목)

**E-1. 장시간 재생 후 탭 프리즈 1회 재현.** 최초 세션에서 관전 수 분 후 페이지가 스크린샷/eval에 완전 무응답(콘솔 에러 0). 이중 인스턴스 + visibility-finish + destroy 경합 조합 의심. A-1~A-5 수리 후 랩에서 풀경기 3회 연속 재생으로 재검증할 것.
**E-2. `renderScene`이 매 프레임 스프라이트 전체 파괴/재생성.** `spriteLayer.removeAll(true)` + `scene.add.image(...)` per-frame(gamecastPhaser.js:306-319) — 60fps에서 GC 압박. 스프라이트 풀로 교체 권장(포즈는 setFrame, 위치는 setPosition만).

## 3. 수리 순서 (WP-G 시리즈)

| 순서 | 작업 | 내용 | 수용 기준 (랩 기준) |
| --- | --- | --- | --- |
| G-1 | 수명주기 수리 | A-1(hidden→pause), A-3(playback store: 위치·속도·done 보존), A-6(종료 화면 정의) | 탭 전환 후 복귀 시 이어서 재생. 엔진 토글/모달 열닫기 후 위치 유지. 종료 후 필드+최종스코어 정지화면 |
| G-2 | 단일 인스턴스 | A-4(보이는 스크린 하나만 mount), A-5(진행바 부분 갱신) | 관전 중 캔버스 1개. 날짜 진행 중 Phaser 재생성 0회 |
| G-3 | 스포일러 차단 | A-2(피드 점진 공개, 초기 featured=첫 이벤트) | 관전 시작 화면에 9회 정보가 DOM에도 없음(display:none이 아니라 미렌더) |
| G-4 | 반응형 스케일 | B-1(<400px 축소), B-2(모달 최대 스케일) | 375px에서 필드 전체 보임(크롭 0). 1280px 모달에서 캔버스 ≥800px |
| G-5 | 중계 문장 팩 | C-1(문장 템플릿), C-2(정합 카운트) | 피드/매치업이 자연문. "홈런 · 뜬공" 류 조합 0건 |
| G-6 | 분위기 팩 | C-3(구장 스킨·날씨·야간), C-4(군중 반응), C-5(상황 템포) | 랩에서 팀/날씨 바꿔 스킨 차이 확인 |
| G-7 | 조작성 | D-1(타석/이닝 스킵, 타임라인), D-2(일시정지) | 이닝 점프 후 해당 시점부터 재생 |
| G-8 | 렌더 성능 | E-2(스프라이트 풀), E-1(프리즈 재검증) | 풀경기 x4 재생 3회 연속 프리즈 없음 |

## 4. 가드레일

1. **엔진(경기 결과) 로직은 건드리지 않는다** — 게임캐스트는 `plateAppearanceEvents` 리플레이 계층이다. `npm run verify` / `verify:balance` 무영향이 원칙.
2. `verify:browser`에 랩 기반 체크 추가 권장: gamecast-lab 로드 → 캔버스 1개 · 피드 미래 이벤트 미노출 · 375px 크롭 0 · hidden→visible 재개.
3. 연출 랜덤은 `hashParts` 기반(문장 템플릿 선택 포함). 선수 실명은 이벤트 데이터의 것만 사용.
4. `assets/gamecast/` 스프라이트 원본과 `tools/build_gamecast_sprites.py` 파이프라인 규격은 `docs/gamecast-sprite-art-spec.md`를 따른다.
5. 게임캐스트 브리프 5종(`docs/gamecast-*.md`)의 기존 의도와 어긋나는 변경은 브리프에 결정 기록을 남길 것.

## 5. 참고: 현재 구조 지도

- **데이터**: engine `simulateNextUserGame(mode:"watch")` → `lastGames[0].plateAppearanceEvents`(74~92개, outcome/타구질/수비수/주자/득점 포함)
- **시퀀스**: `buildGamecastSequence` ui.js:4690 (watch=전체 이벤트·PA당 2600ms / summary=마지막 N개·850ms)
- **컨트롤러**: `initGamecastPixelScreen` ui.js:4848 → screen마다 `createGamecastPhaserController`(ui.js:4981) 또는 `createGamecastPixelController`(ui.js:5097)
- **프레임 생성**: `buildGamecastFrameState` ui.js:6411 (타구 궤적·주자 이동·포즈는 이벤트 기반 연출 계산)
- **DOM 동기화**: `syncGamecastDom` ui.js:7172 (스코어/매치업/HUD 핍/피드 is-live)
- **Phaser 렌더러**: `src/gamecastPhaser.js` (필드 텍스처, 스프라이트 아틀라스+팀컬러 리컬러, 카메라 셰이크, reduced-motion 시 정지화면)
