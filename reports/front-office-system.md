# 프런트오피스 데이터 레이어 보고서

작성일: 2026-06-30

## 변경 요약

- `src/frontOffice.js`를 새로 추가했다.
- 기존 `src/systems.js`의 로스터/뎁스/유망주/연봉 selector를 재사용하되, 기존 파일은 수정하지 않았다.
- UI, CSS, 로스터 파일은 수정하지 않았다.

## Export API

### `buildTradeMarket(state, teamId)`

트레이드 시장 화면이 바로 소비할 수 있는 데이터를 만든다.

- 구단 전략: 윈나우, 리툴, 육성, 균형
- 보강 needs와 surplus 자산
- 타 구단 트레이드 후보
- 검토용 트레이드 패키지 제안
- 수락 가능성, 가치 균형, 소스 재검증/부상/피로 리스크 플래그

이 함수는 트레이드를 실행하지 않는다. 실제 선수 이동은 추후 transaction 계층에서 검증 후 처리해야 한다.

### `buildScoutAssignments(state, teamId)`

스카우트/분석팀 업무 큐를 만든다.

- 트레이드 시장 조사
- 내부 유망주 콜업/보호 점검
- 연봉 압박 감사
- 순위 경쟁팀 전력분석
- 국내 신인/퓨처스 보강 방향

실제 후보 이름은 현재 로스터 데이터에 존재하는 선수만 표시한다. 검증되지 않은 신인/외국인/아마추어 선수명은 생성하지 않는다.

### `buildFrontOfficeInbox(state, teamId)`

프런트 의사결정 inbox를 만든다.

- 트레이드 마감 임박/종료
- 뎁스 회의
- 트레이드 제안 검토
- 연봉 압박 경고
- 컨디션/부상 점검
- 유망주 활용 회의
- 스카우트 배정 알림

## 결정론 정책

- `Math.random`을 사용하지 않는다.
- `Date.now`를 사용하지 않는다.
- `localStorage`를 사용하지 않는다.
- 안정적인 id와 tie-break는 `state.rng`, `state.rng.seed`, `state.rngSeed` 중 존재하는 seed를 우선 사용하고, 없으면 고정 seed `kbo-gm-front-office-v1`을 사용한다.
- 모든 결과는 같은 `state`와 `teamId` 입력에서 같은 JSON shape와 정렬을 반환한다.

## 데이터 정책

- 선수명은 기존 로스터 상태에 있는 이름만 사용한다.
- 실제 세부 포지션을 임의로 만들지 않고, 현재 데이터의 `P`, `C`, `IF`, `OF` 같은 broad position group만 사용한다.
- `ovr`, `pot`, `form`, `fatigue` 등은 현재 게임 데이터의 평가값으로만 취급한다.
- `candidate` 상태 선수는 `source_recheck` 리스크로 표시해 UI에서 재검증이 필요하다는 신호를 줄 수 있게 했다.

## 테스트 결과

전 구단 API smoke test:

```powershell
& 'C:\Users\godho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --input-type=module -e "import { createInitialState } from './src/data.js'; import { buildTradeMarket, buildScoutAssignments, buildFrontOfficeInbox } from './src/frontOffice.js'; const state = createInitialState(); const summary = state.teams.map((team) => { const market = buildTradeMarket(state, team.id); const scouts = buildScoutAssignments(state, team.id); const inbox = buildFrontOfficeInbox(state, team.id); if (!Array.isArray(market.targets) || !Array.isArray(market.proposals)) throw new Error('bad market '+team.id); if (!Array.isArray(scouts.assignments)) throw new Error('bad scouts '+team.id); if (!Array.isArray(inbox.items)) throw new Error('bad inbox '+team.id); return team.shortName + ':' + market.targets.length + '/' + market.proposals.length + '/' + scouts.assignments.length + '/' + inbox.items.length; }); console.log(summary.join(', '));"
```

결과:

```text
LG:42/10/6/6, 두산:42/10/6/6, KIA:42/10/6/6, 삼성:42/10/6/6, 롯데:42/10/6/6, 한화:42/10/6/6, SSG:42/10/7/7, KT:42/10/6/6, NC:42/10/6/6, 키움:42/10/6/6
```

기존 앱 검증:

```powershell
& 'C:\Users\godho\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'C:\Users\godho\Downloads\baseball\tools\verify_app.mjs'
```

결과: `13/13 통과`

금지 API 스캔:

```powershell
rg -n "Math\.random|Date\.now|localStorage" 'C:\Users\godho\Downloads\baseball\src\frontOffice.js'
```

결과: 매칭 없음
