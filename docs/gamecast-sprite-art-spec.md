# Gamecast 스프라이트 아트 규격

이 문서는 Gamecast 선수 아틀라스의 생성 원본, 128px 런타임 셀, 팔레트, 등록점, 애니메이션 밀도와 주·야간 변형을 고정한다. 기준 구현은 `tools/build_gamecast_sprites.py`와 `tools/build_gamecast_motion_v3.py`다.

## 1. 셀과 시트 계약

- 런타임 프레임: **128×128px** RGBA.
- 생성/정규화 셀: **256×256px**. 128px 출력은 nearest-neighbor **2배 정수 축소**만 사용한다.
- v3 경기 표시 래스터: 128px 프레임을 `centerX=64`, `baselineY=120`에 고정한 채 **96×96px**로 nearest-neighbor 사전 래스터화한다. 런타임은 이 래스터에 정수 배율만 적용하며 다시 축소하지 않는다.
- 발바닥 baseline: `y=120`. 불투명 bbox의 하단은 파이썬/Pillow의 exclusive 좌표로 120이며, 마지막 불투명 픽셀은 `y=119`다.
- 수평 중심: `x=64`.
- 권장 불투명 bbox: 최대 116×112px. 모션 오프셋 여유를 위해 기준 포즈는 최대 108×108px 안에 등록한다.
- 출력 셀 가장자리는 투명해야 한다. 안티에일리어싱, 반투명 외곽선, 반투명 스미어는 금지한다. 모든 출력 알파는 `0` 또는 `255`여야 한다.

기본 원본은 정확한 5×4×256(1280×1024) 계약 시트인 `assets/gamecast/source/player-sheet-128-contract.png`다. 이 파일은 생성기 참조 시트 `assets/gamecast/source/player-sheet-64-imagegen.png`를 전처리하고, 모든 포즈에 하나의 공통 배율을 적용해 만든다. 배포 아틀라스는 계약 시트의 256px 셀을 nearest-neighbor로 정확히 128px까지 2배 축소한다. 포즈마다 개별 최대 맞춤 배율을 적용하면 동작 전환 중 선수 크기가 달라지므로 금지한다.

원본 배경은 투명 또는 키 컬러를 권장한다. 빌더는 다음 순서로 전처리한다.

1. 셀 바깥 경계에 연결된 밝은 무채색 체크/코너 배경을 flood fill로 제거한다.
2. 기존 마젠타 키 배경을 제거한다.
3. 시트 전체에서 공통 등록 배율 하나를 계산하고 모든 포즈에 동일하게 적용한다.
4. 포즈 bbox를 256px 계약 셀의 `centerX=128`, `baselineY=240`에 맞춘다.
5. 좌표와 크기를 2의 배수로 스냅한 뒤 128px로 2배 축소한다.

레거시 포즈 입력은 5열×4행이며, v2 키 포즈 입력은 8열×6행이다. v3 출력은 프레임을 16열로 패킹한다. 런타임은 열·행을 추측하지 않고 JSON의 `frames` 좌표를 진실 원본으로 사용해야 한다.

## 2. 포즈와 모션 밀도

v2 키 포즈는 타격, 투구, 주루, 송구, 포구, 다이브, 슬라이드, 포수 및 정적 포즈를 제공한다. `build_gamecast_motion_v3.py`가 키 포즈 사이를 픽셀 스냅 보간해 밀집 모션을 만든다.

필수 하한과 현재 출력은 다음과 같다.

| 동작 | 필수 하한 | 현재 v3 |
| --- | ---: | ---: |
| swing | 10 | 24 |
| pitch | 8 | 24 |
| run | 6 | 8 |
| throw | 3 | 12 |
| catch | 3 | 10 |
| dive | 3 | 10 |
| slide | 2 | 8 |
| catcher | 2 | 8 |

`throw` 모션은 `field`/`pitch` 계열 장비 안전 포즈만 사용할 수 있으며, 배트가 포함된 `stance`/`swing`/`follow` 포즈를 참조하면 빌드를 실패시킨다. `catcher` 모션은 투수 쪽을 보는 후면 헬멧과 등 보호끈을 사용하고, 얼굴 피부나 앞면 철망 격자가 남아 있으면 빌드를 실패시킨다.

투구 키 순서는 반드시 `pitch_release` 뒤에 하나 이상의 `pitch_follow*` 키를 둔다. 현재는 `pitch_follow1`, `pitch_follow2` 두 장을 사용한다. 빌더는 프레임 수, duration 수, 프레임 존재 여부와 릴리스 이후 팔로스루를 빌드 시점에 검사한다.

## 3. 팔레트와 3톤 셰이딩

한 아틀라스의 불투명 RGB 팔레트 상한은 32색이다. 주요 재질은 `shade / base / highlight` 3톤을 사용한다.

| 재질 | shade | base | highlight |
| --- | --- | --- | --- |
| 피부 | `#b84e59` | `#f8a683` | `#ffd7a7` |
| 모자/팀색 | `#b23a48` | `#d23b3b` | `#ed6a5f` |
| 홈 유니폼 | `#cad5e1` | `#f2f6f9` | `#fffffc` |
| 원정 유니폼 | `#364154` | `#5b6d84` | `#9ab0c8` |
| 바지 | `#242235` | `#3a3550` | `#5a5374` |
| 배트 | `#2d1a35` | `#67274b` | `#c2556c` |
| 글러브 | `#2d1a35` | `#4f2041` | `#a54669` |

광원은 화면 상단으로 고정한다. 하이라이트는 위·앞 면에, 셰이드는 아래·뒤 면에 둔다. 빌더는 피부와 유니폼을 포함해 최소 세 재질군이 완전한 3톤을 갖는지 검사한다.

## 4. 예약색과 selout

다음 색은 의미가 고정된 예약색이다. 비슷한 색으로 대체하지 말고 정확한 RGB를 쓴다.

| 예약색 | 의미 |
| --- | --- |
| `#1c2336` | 가장 깊은 내부선/하드 아웃라인 |
| `#30384e` | 외곽 selout 기본색 |
| `#d23b3b` | 런타임 팀색 교체용 primary |
| `#b23a48` | 런타임 팀색 교체용 shadow/양말 |
| `#9dd7ff` | 야간 전용 상단 림라이트 |

순수 검정 `#000000`은 금지한다. 불투명 실루엣 경계는 진한 남색 `#1c2336` 또는 `#30384e`의 1px selout으로 닫는다. 96px 네이티브 래스터 뒤에도 selout을 다시 닫아 흙·잔디가 피부나 장비와 직접 맞닿지 않게 한다. 피부, 원정 유니폼, 배트·글러브 팔레트는 세 구장 플레이 영역 표본과 최소 44 RGB 거리로 분리한다. 빌더는 외곽 경계의 selout 비율, 필드색 거리, 순수 검정, 예약색 근사치, 비허용 팔레트색을 검사한다. 팀색 교체 코드는 `#d23b3b`과 `#b23a48`만 대상으로 삼는다.

## 5. 야간 림라이트와 변형 이름

주간 아틀라스에는 림라이트를 넣지 않는다. 야간 아틀라스는 상단 광원에 노출된 불투명 경계 한 줄만 `#9dd7ff`로 바꾼다. 림라이트는 1px이며, 픽셀 바로 위가 투명해야 하고 baseline의 상단 65% 영역 안에 있어야 한다.

빌더는 항상 다음 네 변형을 함께 생성한다.

- `player-home.png` + `player-home.json` (`lighting: day`)
- `player-away.png` + `player-away.json` (`lighting: day`)
- `player-home-night.png` + `player-home-night.json` (`lighting: night`)
- `player-away-night.png` + `player-away-night.json` (`lighting: night`)

네 JSON 모두 `frameSize: 128×128`, `baselineY: 120`, `centerX: 64`, `sourceCellSize: 256×256`, `integerDownscale: 2`, `nativeDisplaySize: 96×96`, `nativeRenderScale: 1`을 기록한다. 야간 구장은 `*-night` 아틀라스를 선택하고, 그 외 구장은 주간 아틀라스를 선택한다.

## 6. 그림자와 등록

바닥 그림자는 아틀라스에 굽지 않는다. 런타임이 포즈와 깊이에 맞춰 별도로 그린다. 기본/주루 포즈는 짧은 타원, 다이브·슬라이드는 긴 타원, 점프·릴리스는 작고 옅은 타원을 사용한다. 그림자의 중심은 스프라이트의 `centerX=64`, 바닥은 `baselineY=120`을 기준으로 한다.

레지스트레이션 검사 항목은 빈 프레임, baseline 편차, 중심 편차, 셀 가장자리 접촉, 안전 bbox 초과다. 공중·낮은 포즈와 밀집 모션의 중간 프레임은 넓은 baseline 허용치를 쓰되 셀 클리핑은 허용하지 않는다.

## 7. 빌드와 검증

참조 시트에서 정확한 계약 시트 재생성:

```powershell
python tools/build_gamecast_sprites.py --source assets/gamecast/source/player-sheet-64-imagegen.png --contract-output assets/gamecast/source/player-sheet-128-contract.png
```

기본 밀집 아틀라스 빌드:

```powershell
python tools/build_gamecast_motion_v3.py --strict-source-grid --strict-registration --strict-art
```

키 포즈 v2 아틀라스 빌드:

```powershell
python tools/build_gamecast_sprites.py --strict-source-grid --strict-registration --strict-art
```

`--strict-source-grid`는 기본 계약 시트가 정확히 1280×1024이고 각 셀이 256px인지 강제한다. 빌더는 공통 포즈 배율, 발 사이 투명 간격, 바닥 그림자 잔여물, 이진 알파도 함께 검사한다. `tools/verify_app.mjs`는 배포 아틀라스 네 벌의 128px 크기, 등록점, 주·야간 메타와 밀집 모션 하한을 다시 검사한다.
