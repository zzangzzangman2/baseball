# Codex 명령: Gamecast 선수 스프라이트시트 아트 제작 + 연결

## 0. 목적

경기 중계(gamecast) 선수를 **파워프로(파워풀 실황야구) 감성의 2D 치비 픽셀 스프라이트**로 교체한다. 지금은 `fillRect` 손코딩(9×13)이라 천장이 낮다 → **진짜 스프라이트시트 에셋**을 이미지 생성으로 뽑고, 후처리 후 아틀라스로 게임에 연결한다. 퀄리티의 90%가 이 에셋에서 나온다.

> IP 주의: 파워프로/코나미 캐릭터를 **그대로 베끼지 말 것**. "big-head 치비 야구선수" 스타일만 참고한 **오리지널** 캐릭터로 생성.

> 매체 한계(정직): 참고 이미지는 3D 렌더다. 우리는 2D 도트라 "그 룩 그대로"는 불가. 목표는 **2D 치비 픽셀 최고 퀄**(옛 파워프로 2D/베이스볼 슈퍼스타즈급).

---

## 1. 최종 산출물

`assets/gamecast/` 아래:
- `player-home.png` + `player-home.json` — 홈(흰 유니폼) 선수 스프라이트시트 + 아틀라스(해시 포맷).
- `player-away.png` + `player-away.json` — 원정(회색 유니폼).
- `props.png` + `props.json` — 공(3프레임), 글러브/배트가 필요하면 포함.
- (선택) `umpire.png`, `coach.png`.

포맷: **PNG(투명 배경) + Phaser 텍스처 아틀라스 JSON(hash)**. Canvas 폴백이면 프레임 좌표 상수로도 사용 가능하게.

---

## 2. 프레임 규격 (엄수)

- **프레임 크기: 48×48 px, 셀 균일.** (한 캐릭터가 프레임을 넘지 않게; 배트/글러브 뻗는 포즈 포함해 48 안에.)
- **치비 비율**: 머리:몸 ≈ 1:1.2 (big-head). 캐릭터 높이 ≈ 38px, **발바닥 baseline = y 45**(모든 프레임 동일 정렬 — 프레임 갈아껴도 안 튀게).
- **정렬(레지스트레이션)**: 모든 포즈에서 몸 중심 x=24, 발 y=45 고정. 이게 안 맞으면 애니메이션이 덜덜 떨림 → 가장 중요.
- **아웃라인**: 1px 진한 외곽선(순수 검정 대신 `#20202a`). 안티에일리어싱/블러 **금지**(픽셀 crisp).
- **팔레트: 총 16~22색 이내, 플랫**(그라데이션 금지, 음영은 2~3단 hue-shift). 후처리에서 반드시 양자화.
- **투명 배경**(알파). 그림자는 프레임에 넣지 말 것(엔진이 별도 타원 그림자).
- **v2 시트 크기: 8열 × 6행, 48셀(각 48×48).** 이미지젠 소스 권장은 2048×1536(셀당 256px) → `tools/build_gamecast_sprites.py`가 48px로 축소/정규화한다.
- **레거시 호환: 5열 × 4행 18포즈 시트는 계속 유효.** 빌드 스크립트 `--layout auto`가 8×6 정방 셀 소스면 v2로, 아니면 기존 5×4로 처리한다.
- **자동 검사:** 빌드 후 불투명 bbox의 하단 baseline, 중심, 안전영역을 검사한다. 기본은 기존 에셋 호환을 위해 경고이며, 신규 v2 소스 승인 시 `--strict-registration`으로 실패 처리한다.

### 예약 색 (팔레트 스왑용 — 중요)
팀색을 코드에서 갈아끼우려면 특정 부위를 **고정 플랫색**으로 생성해 인덱스 스왑한다:
- 모자/헬멧 = **`#d23b3b`(예약 빨강)** → 엔진이 `TEAM_META[id].color`로 remap.
- 유니폼 상의 = 홈 `#f7f7f2`(흰), 원정 `#8d8a82`(회색). (시트 자체를 2벌 생성)
- 바지 = `#3a3550`(네이비), 스타킹 `#d23b3b`(모자와 같은 예약색 쓰지 말 것 — 다른 예약색 `#b23a48`).
- 피부 = `#f2c79a` / 음영 `#cf9a6a` (피부톤 1종으로 통일; 다양화는 후순위).

---

## 3. 포즈/프레임 목록 (gamecast 애니에 매핑)

v2는 포즈 1장 교체가 아니라 액션별 시퀀스를 기본 단위로 삼는다. 현재 코드의 레거시 pose 키(`idle, run, walk, stance, swing, follow, miss, take, windup, pitch, field, catch, dive, slide, catcher, lookUp`)는 계속 JSON `frames`에 남기며, v2 프레임의 별칭으로 제공한다.

### v2 시트 레이아웃(8×6)

각 셀은 48×48이며, 소스 시트는 같은 비율의 고해상도 그리드(권장 2048×1536)를 사용한다.

```
row0 타격: stance | load | stride | swing1 | contact | swing2 | follow1 | follow2
row1 투구: pitch_set | pitch_kick | pitch_stride | pitch_cock | pitch_release | pitch_follow1 | pitch_follow2 | idle
row2 주루/송구: run1 | run2 | run3 | run4 | walk1 | walk2 | throw_plant | throw_release
row3 수비: throw_follow | field | catch_track | catch_reach | catch_squeeze | dive_launch | dive_slide | dive_getup
row4 기타: slide_in | slide_hold | catcher_frame | catcher_block | miss | take | lookUp | reserved
row5 예약: stance_open | load_open | stance_crouch | load_crouch | pitch_alt_set | pitch_alt_release | reserved | reserved
```

row5는 아직 엔진이 필수로 사용하지 않는 확장 슬롯이다. v2 소스 제작 시 비워도 되지만, 배경 투명/마젠타 키아웃 규칙은 동일하게 지킨다.

### v2 애니메이션 메타

빌드 스크립트는 atlas JSON 최상위에 `animations`를 쓴다. 기본 duration 단위는 ms이며, `contact`와 `pitch_release`처럼 타격감/릴리스감이 중요한 프레임은 짧거나 홀드가 길게 잡혀 있다.

| 액션 | 프레임 | 기본 duration |
| --- | --- | --- |
| `swing` | `stance, load, stride, swing1, contact, swing2, follow1, follow2` | `90,70,70,45,90,45,70,100` |
| `pitch` | `pitch_set, pitch_kick, pitch_stride, pitch_cock, pitch_release, pitch_follow1, pitch_follow2` | `100,90,70,60,45,70,100` |
| `run` | `run1, run2, run3, run4` | `70,70,70,70` |
| `walk` | `walk1, walk2` | `120,120` |
| `throw` | `throw_plant, throw_release, throw_follow` | `80,50,90` |
| `catch` | `catch_track, catch_reach, catch_squeeze` | `90,60,100` |
| `dive` | `dive_launch, dive_slide, dive_getup` | `70,90,120` |
| `slide` | `slide_in, slide_hold` | `80,140` |
| `catcher` | `catcher_frame, catcher_block` | `120,120` |

### 레거시 별칭

기존 renderer/Canvas fallback이 끊기지 않도록 v2 JSON은 다음 pose 키도 함께 제공한다.

| 레거시 키 | v2 대상 |
| --- | --- |
| `swing` | `contact` |
| `follow` | `follow1` |
| `windup` | `pitch_set` |
| `pitch` | `pitch_release` |
| `run` | `run1` |
| `walk` | `walk1` |
| `catch` | `catch_squeeze` |
| `dive` | `dive_slide` |
| `slide` | `slide_hold` |
| `catcher` | `catcher_frame` |
| `coach`, `umpire` | `idle` |

### 레거시 5×4 시트(현재 에셋 호환)

기존 시트 레이아웃도 계속 입력으로 허용한다.

```
row0 (타자):  stance | swing | follow | miss | take
row1 (주자):  idle | run1 | run2 | walk1 | slide
row2 (투수):  windup | pitch
row3 (수비):  field | catch | dive | catcher | lookUp
```

`props.png`: `ball1|ball2|ball3`(흰 공 + 빨간 실밥, 검은 사각테두리 금지, 살짝 모션블러 프레임).

---

## 4. 이미지 생성 워크플로 (디퓨전은 그대로 못 씀 — 파이프라인 필수)

이미지젠은 깔끔한 48px 프레임그리드/일관 캐릭터/투명배경을 바로 못 준다. 아래 순서 강제:

1. **베이스 캐릭터 확정**: 정면 idle 1장을 먼저 생성 → 이걸 레퍼런스로 나머지 포즈를 **img2img/동일 시드**로 생성해 캐릭터 일관성 확보. (포즈마다 랜덤 생성하면 얼굴/체형이 달라져 실패.)
2. **고해상 생성 후 다운스케일**: 512~1024px로 생성 → **nearest-neighbor로 48×48 다운스케일** → **팔레트 양자화(≤22색)** → AA/잔여 흐림 제거.
3. **배경 제거**: 단색 배경(마젠타 `#ff00ff`)으로 생성 지시 후 키아웃 → 투명 알파.
4. **레지스트레이션 정렬**: 모든 프레임을 발 baseline y=45, center x=24로 스냅(스크립트로 바운딩박스 기준 정렬).
5. **홈/원정 2벌**: 유니폼 상의색만 흰/회색으로 바꿔 2세트. (모자는 예약 빨강 유지 → 인게임 tint.)
6. **아틀라스로 슬라이스**: 48×48 그리드를 컷 → PNG+JSON 생성(TexturePacker 포맷/Phaser hash). v2 JSON에는 `meta.layout="v2"`, `meta.frameSize`, `meta.baselineY`, `meta.centerX`, `animations`가 포함된다.
7. **모션 프리뷰 생성**: `python tools/preview_gamecast_anims.py`로 `reports/motion-samples/*.gif`와 `contact-sheet.png`를 확인한다.

### 생성 프롬프트 템플릿 (Codex가 이미지젠에 투입)
Positive (base idle 예):
```
2D pixel art sprite of an original chibi baseball player, big head small body (2-head tall),
white baseball jersey, navy pants, red cap, friendly simple face, front-facing idle stance,
limited flat color palette, clean 1px dark outline, NES/SNES sprite style, crisp pixels,
centered, full body with feet visible, solid magenta (#ff00ff) background, no text, no logo
```
v2 프레임별로 `front-facing idle stance`만 교체한다. 예: `batting load with hands back`, `stride foot lifted`, `contact frame bat horizontal`, `one hand finish follow-through`, `pitching leg kick`, `pitching release`, `fielder glove reach`, `horizontal diving catch`, `feet-first slide`.
Negative:
```
anti-aliasing, blur, gradient, 3d render, realistic, photo, drop shadow, background scenery,
text, watermark, extra limbs, inconsistent proportions, cropped feet
```
> 각 포즈는 base 캐릭터 이미지를 레퍼런스(img2img, denoise 0.4~0.6)로 넣어 **같은 캐릭터**를 유지할 것.

---

## 5. 필드 해상도 상향 (선수가 커지므로)

48px 선수가 어울리려면 gamecast 내부해상도를 키운다:
- 현재 논리그리드 120×108 → **320×288 권장**. `gamecastX/Y/Size`의 분모(120/108)와 `gamecastBasePositions()` 좌표를 스케일 팩터로 갱신(≈×2.66). 선수 발 baseline을 각 수비 위치에 정렬.
- Phaser면 zoom이 정수배율 처리(이식 브리핑 `gamecast-phaser-migration-brief.md` 참조). Canvas면 리사이즈/좌표만 스케일.
- 필드(잔디 링·담장·마운드)도 해상도 상향에 맞춰 재배치. **동심원 잔디 링은 대비 낮춰** 차분하게(현재 bullseye처럼 강함).

---

## 6. 엔진 연결

- **Phaser 이식과 함께 가는 게 정석**(`gamecast-phaser-migration-brief.md` 6절 아틀라스 로드에 이 시트 투입). 스프라이트 애니: `run1/run2` 루프, `swing→follow` 시퀀스 등 `scene.anims`로 등록.
- **아직 Canvas면**: `drawPixelRunner`/`drawPixelFielders`/`buildBatterSprite`의 `fillRect` 셀 → `ctx.drawImage(atlas, frameRect, destRect)`로 교체. pose 키가 이미 있으니 pose→frame 매핑 테이블만 추가.
- **모자 팀색**: 로드 후 예약색 `#d23b3b` 픽셀을 `TEAM_META[teamId].color`로 remap(캔버스 오프스크린에서 1회 팔레트 스왑해 팀별 텍스처 캐시) → 홈/원정 유니폼(흰/회색) + 팀 모자색.
- **타격 스윙**: `stance→swing→follow` 프레임을 임팩트 타이밍(pitchEnd)에 재생 → "치는 모션 없음" 해결.

---

## 7. 불변/제약

- 엔진(`engine.js`)·데이터 스키마·결정론 무수정. 에셋은 정적이라 결정론 영향 없음.
- CDN 금지, 외부 런타임 의존 금지 — PNG/JSON을 `assets/gamecast/`에 동봉. `package.json` `build.files`에 포함(Electron).
- 픽셀 crisp 유지(`image-rendering: pixelated`, `imageSmoothingEnabled=false`, 정수배율). AA/블러 금지.
- 캐릭터는 오리지널(파워프로 IP 복제 금지).

---

## 8. 수용 기준

1. 홈/원정 두 시트가 48×48 균일 그리드, 투명 배경, 팔레트 ≤22색, AA 없음.
2. 모든 포즈에서 발 baseline·중심 정렬 일치(교체 시 안 튐), 캐릭터 일관(같은 얼굴/체형).
3. 인게임에서 홈=흰/원정=회색 + 모자=팀색(remap)으로 명확히 구분.
4. `stance→swing→follow`로 **타격 모션**이 보이고, `run1/run2`로 달리기 루프.
5. 확대해도 crisp, 모바일/데스크톱 정상, 오프라인/Electron 로드 성공.
6. `npm run verify`, `verify:browser` 통과(회귀 없음).

## 9. 자가 검증

- `.claude/launch.json`의 `kbo` 또는 유저 서버(5177)로 실행 → 새 게임 → `경기 보기` → 선수가 스프라이트로 뜨고 팀 구분·타격 모션 확인.
- `python tools/build_gamecast_sprites.py` → 현재 소스 기준 홈/원정/props atlas 재생성. v2 소스 승인 때는 `--strict-registration`을 추가해 bbox 레지스트레이션 실패를 빌드 실패로 본다.
- `python tools/preview_gamecast_anims.py` → `reports/motion-samples/`에서 action GIF와 `contact-sheet.png` 검수.
- 확대 스크린샷으로 crisp·정렬 확인.
- 프레임 그리드가 어긋나면(캐릭터 튐) 레지스트레이션(4-4단계) 재정렬.

## 10. 정직한 리스크 / 폴백

- **이미지젠 픽셀아트는 까다롭다**: 프레임 일관성·투명·정확한 48px가 첫 시도에 안 나올 확률 높음 → 4절 파이프라인(다운스케일·양자화·정렬)과 img2img 일관 시드가 필수. 수작업 클린업 각오.
- 일관성이 계속 깨지면 **완성형 에셋팩**(itch.io/OpenGameArt의 chibi baseball sprite) 도입이 더 빠를 수 있음 — 라이선스 확인 후 대체 가능.
- 첫 목표는 **홈/원정 각 1캐릭터 풀세트**만 완성해 파이프라인 검증 → 이후 스킨/얼굴 다양화는 후순위.
