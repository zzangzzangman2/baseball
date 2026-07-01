# 계약/FA/병역/외국인 상태 Schema 계획서

작성일: 2026-06-30  
대상 작업 폴더: `C:\Users\godho\Downloads\baseball`  
작성 범위: 실제 구현 전 필드 설계 문서. 코드 변경 없음.

## 1. 목적

이 문서는 현재 KBO GM 시뮬레이터의 MVP 구조를 유지하면서 선수별 계약, 연봉, 보너스, 옵션, FA, 병역, 외국인, 서비스타임, 보상 등급 상태를 추가하기 위한 schema 계획서다.

현재 앱은 `GameState.teams[].roster[]` 안에 player 객체가 직접 포함되는 구조다. 따라서 v0에서는 선수 객체 안에 새 상태 객체를 직접 붙이는 최소 침습 방식을 우선한다. 이후 선수 원장(`playersById`), 계약 원장(`contractsByPlayerId`), 팀 배정 원장(`rosterAssignments`)으로 분리할 때 옮겨갈 수 있도록 필드 경계를 미리 나눈다.

## 2. 설계 원칙

- v0는 기존 `player` 객체에 `contract`, `faStatus`, `militaryStatus`, `foreignPlayer`, `serviceTime`, `compensationGrade`를 optional 필드로 추가한다.
- 기존 `team.payroll`, `team.budget`은 당장 제거하지 않는다. v0에서는 요약/검증용 팀 힌트로 유지하고, 선수별 `contract.salary` 합계와 차이가 날 수 있음을 허용한다.
- 금액은 표시 문자열이 아니라 정수 `amountKRW` 단위로 저장한다. UI에서 억/만원 단위로 변환한다.
- 날짜는 기존 `currentDate`와 맞춰 `YYYY-MM-DD` 문자열을 사용한다.
- 모든 enum은 화면 표시명과 별개로 영문 key를 저장한다.
- 실제 규칙 확정 전에는 `source`와 `confidence`를 둬서 공식/추정/fallback 데이터를 구분한다.
- v0는 transaction 없이 읽기/표시 중심으로 시작하고, FA 계약/보상선수/외국인 교체처럼 상태를 바꾸는 기능은 command 계층 도입 후 commit한다.

## 3. v0 Player 확장 shape

```js
{
  id, name, age, role, position, bats, throws,
  ovr, pot, fatigue, form, injuredDays,
  contact, power, eye, speed, defense,
  stuff, control, stamina, movement,

  contract: ContractV0 | null,
  faStatus: FaStatusV0,
  militaryStatus: MilitaryStatusV0,
  foreignPlayer: ForeignPlayerV0,
  serviceTime: ServiceTimeV0,
  compensationGrade: CompensationGradeV0
}
```

v0에서는 새 필드를 모두 optional로 읽어도 안전해야 한다. UI와 selector는 필드가 없으면 아래 기본값처럼 취급한다.

```js
{
  contract: null,
  faStatus: { status: "notEligible" },
  militaryStatus: { status: "notSubject" },
  foreignPlayer: { isForeign: false },
  serviceTime: { seasonsAccrued: 0, daysAccrued: 0 },
  compensationGrade: { grade: "none" }
}
```

## 4. ContractV0

계약은 보장 계약 본체와 연봉, 계약금, 보너스, 옵션을 한 객체에 둔다. 재정 ledger가 생기기 전까지는 이 객체가 선수 계약 표시와 payroll 계산의 1차 출처가 된다.

```js
{
  id: "contract-p-lg-kim-2026",
  status: "active",
  type: "standard",
  teamId: "lg",
  startSeason: 2026,
  endSeason: 2028,
  signedDate: "2026-01-12",
  guaranteedAmountKRW: 2400000000,
  averageAnnualValueKRW: 800000000,
  salary: {
    season: 2026,
    amountKRW: 700000000,
    payrollAmountKRW: 700000000,
    paymentTiming: "season"
  },
  salaryBySeason: [
    { season: 2026, amountKRW: 700000000, payrollAmountKRW: 700000000 },
    { season: 2027, amountKRW: 800000000, payrollAmountKRW: 800000000 },
    { season: 2028, amountKRW: 900000000, payrollAmountKRW: 900000000 }
  ],
  signingBonus: {
    amountKRW: 300000000,
    paidSeason: 2026,
    payrollTreatment: "included"
  },
  bonuses: [
    {
      id: "bonus-pa-500",
      type: "playingTime",
      label: "500타석 달성",
      trigger: { stat: "pa", operator: ">=", value: 500 },
      amountKRW: 50000000,
      status: "pending"
    }
  ],
  options: [
    {
      id: "opt-2029-club",
      type: "club",
      season: 2029,
      amountKRW: 900000000,
      buyoutKRW: 100000000,
      status: "pending"
    }
  ],
  clauses: {
    noTrade: "none",
    optOutAfterSeason: null,
    foreignReleaseClause: false
  },
  source: {
    kind: "official",
    label: "구단 발표",
    confidence: 1
  }
}
```

### Contract enum

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `contract.status` | `active` | 현재 유효 계약 |
|  | `expired` | 계약 만료 |
|  | `terminated` | 방출/해지 |
|  | `reserved` | 보류권은 있으나 표준 계약 표시 전 |
|  | `pending` | 합의 또는 입력 후보 |
| `contract.type` | `standard` | 일반 선수 계약 |
|  | `fa` | FA 계약 |
|  | `rookie` | 신인 계약 |
|  | `foreign` | 외국인 선수 계약 |
|  | `development` | 육성/신고선수 성격 계약 |
|  | `militaryHold` | 군보류/군입대 관련 보류 상태 |
| `salary.paymentTiming` | `season` | 시즌 단위 지급 |
|  | `monthly` | 월별 지급 모델 |
|  | `upfront` | 선지급 또는 계약 시점 지급 |
| `signingBonus.payrollTreatment` | `included` | payroll 계산에 포함 |
|  | `excluded` | 별도 지출로만 처리 |
|  | `unknown` | 규칙/출처 미확정 |
| `bonus.type` | `playingTime` | 출장/타석/이닝 조건 |
|  | `performance` | 성적 조건 |
|  | `award` | 수상 조건 |
|  | `roster` | 1군 등록/엔트리 조건 |
|  | `teamResult` | 팀 성적 조건 |
| `bonus.status` | `pending` | 아직 미충족 |
|  | `earned` | 조건 충족 |
|  | `paid` | 지급 완료 |
|  | `void` | 조건 무효 또는 계약 종료 |
| `option.type` | `club` | 구단 옵션 |
|  | `player` | 선수 옵션 |
|  | `mutual` | 상호 옵션 |
|  | `vesting` | 조건 충족 시 발동 |
| `option.status` | `pending` | 판단 전 |
|  | `exercised` | 행사 |
|  | `declined` | 거부 |
|  | `vested` | 조건 충족으로 발동 |
|  | `void` | 무효 |
| `clauses.noTrade` | `none` | 트레이드 거부권 없음 |
|  | `limited` | 일부 구단/조건 거부 |
|  | `full` | 전면 거부권 |

## 5. FaStatusV0

FA 상태는 자격, 신청 여부, 시장 상태, 보상 규칙을 나눠 저장한다. 계약 객체의 `type: "fa"`와 중복되더라도 역할이 다르다. `contract`는 체결된 계약이고, `faStatus`는 선수의 FA 권리/시장 상태다.

```js
{
  status: "eligibleAfterSeason",
  eligibilitySeason: 2026,
  filingSeason: null,
  marketState: "notOpen",
  yearsUntilEligibility: 0,
  previousFaCount: 0,
  qualifyingTeamId: "lg",
  compensationGrade: "B",
  compensationRule: {
    requiresProtectedList: true,
    protectedListSize: 20,
    cashCompensationMultiplier: 2
  },
  rights: {
    canNegotiateWithAllTeams: false,
    originalTeamExclusiveUntil: null
  }
}
```

### FA enum

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `faStatus.status` | `notEligible` | FA 자격 없음 |
|  | `eligibleAfterSeason` | 현재 시즌 종료 후 자격 가능 |
|  | `filed` | FA 신청 완료 |
|  | `market` | 시장에 나온 상태 |
|  | `signed` | FA 계약 체결 |
|  | `compensationPending` | 보상선수/보상금 처리 대기 |
|  | `compensationComplete` | 보상 처리 완료 |
| `faStatus.marketState` | `notOpen` | 시장 개장 전 |
|  | `exclusiveWindow` | 원소속 협상 우선 기간 |
|  | `openMarket` | 전체 구단 협상 가능 |
|  | `closed` | 시장 종료 또는 계약 완료 |
| `compensationGrade.grade` | `A` | 고보상 등급 |
|  | `B` | 중간 보상 등급 |
|  | `C` | 낮은 보상 등급 |
|  | `none` | 보상 없음 |
|  | `unknown` | 미확정 |

## 6. MilitaryStatusV0

병역 상태는 로스터 가용성과 장기 권리 보존에 직접 연결된다. 경기 엔진 v0에서는 `unavailable` 계열만 라인업 제외 조건으로 쓰고, 세부 복무 기간/복귀일은 UI와 장기 플레이에서 사용한다.

```js
{
  status: "notServed",
  availability: "available",
  obligation: "subject",
  serviceType: null,
  startDate: null,
  expectedReturnDate: null,
  actualReturnDate: null,
  holdTeamId: "lg",
  countsTowardRosterLimit: false,
  notes: null
}
```

### Military enum

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `militaryStatus.status` | `notSubject` | 병역 대상 아님 |
|  | `notServed` | 병역 미필 |
|  | `serving` | 복무 중 |
|  | `completed` | 병역 완료 |
|  | `exempt` | 면제 |
|  | `deferred` | 연기/보류 |
|  | `unknown` | 미확정 |
| `militaryStatus.availability` | `available` | 경기/로스터 사용 가능 |
|  | `unavailable` | 복무 등으로 사용 불가 |
|  | `returningSoon` | 복귀 예정 |
| `militaryStatus.obligation` | `subject` | 병역 의무 있음 |
|  | `notSubject` | 의무 없음 |
|  | `completed` | 의무 해결 |
|  | `unknown` | 미확정 |
| `militaryStatus.serviceType` | `activeDuty` | 현역 |
|  | `sangmu` | 상무 |
|  | `publicService` | 사회복무 |
|  | `exempt` | 면제 |
|  | `other` | 기타 |
|  | `null` | 해당 없음 또는 미정 |

## 7. ForeignPlayerV0

외국인 상태는 단순 국적 표시가 아니라 외국인 슬롯, 외국인 시장 티어, 교체 가능성, 비자/계약 상태를 포함한다.

```js
{
  isForeign: true,
  nationality: "USA",
  registrationStatus: "registered",
  slotType: "foreignPlayer",
  marketTier: 2,
  acquiredFrom: "foreignMarket",
  visaStatus: "cleared",
  firstKboSeason: 2026,
  foreignRightsTeamId: "lg",
  replacementRisk: "medium",
  previousLeagues: ["AAA", "NPB"]
}
```

### Foreign player enum

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `foreignPlayer.registrationStatus` | `notForeign` | 국내 선수 |
|  | `registered` | 외국인 선수 등록 |
|  | `candidate` | 외국인 후보 pool |
|  | `released` | 방출 |
|  | `negotiating` | 협상 중 |
|  | `unavailable` | 비자/부상/계약 문제로 불가 |
| `foreignPlayer.slotType` | `domestic` | 국내 슬롯 |
|  | `foreignPlayer` | 일반 외국인 슬롯 |
|  | `foreignPitcher` | 외국인 투수 슬롯 구분이 필요할 때 |
|  | `foreignHitter` | 외국인 타자 슬롯 구분이 필요할 때 |
| `foreignPlayer.marketTier` | `1` | 최상위 후보 |
|  | `2` | 주전급 후보 |
|  | `3` | 평균적 후보 |
|  | `4` | 리스크 있는 저비용 후보 |
|  | `5` | 대체/테스트 후보 |
| `foreignPlayer.visaStatus` | `notRequired` | 국내 선수 또는 비자 불필요 |
|  | `pending` | 처리 중 |
|  | `cleared` | 등록 가능 |
|  | `blocked` | 등록 불가 |
|  | `unknown` | 미확정 |
| `foreignPlayer.replacementRisk` | `low` | 교체 가능성 낮음 |
|  | `medium` | 보통 |
|  | `high` | 교체 후보 |

## 8. ServiceTimeV0

서비스타임은 FA 자격, 연봉 협상, 2차 드래프트, 군보류 판단의 공통 입력이다. v0에서는 정확한 KBO 규정 계산기가 없더라도 수동 입력/추정값을 저장할 수 있어야 한다.

```js
{
  seasonsAccrued: 5,
  daysAccrued: 612,
  currentSeasonDays: 74,
  firstTeamRegistrationDays: 61,
  futuresOnlyDays: 13,
  rookieEligible: false,
  faClockStatus: "running",
  nextMilestone: {
    type: "faEligibility",
    season: 2026,
    daysRemaining: 0
  },
  source: {
    kind: "estimated",
    confidence: 0.7
  }
}
```

### Service time enum

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `serviceTime.faClockStatus` | `running` | FA 시계 진행 |
|  | `pausedMilitary` | 군복무로 정지 |
|  | `pausedInjury` | 장기 부상/등록 제외로 정지 처리 필요 |
|  | `met` | FA 기준 충족 |
|  | `unknown` | 계산 불가 |
| `serviceTime.nextMilestone.type` | `faEligibility` | FA 자격 |
|  | `salaryArbitration` | 향후 연봉조정/협상 규칙용 |
|  | `rookieExpiry` | 신인 자격 종료 |
|  | `militaryDeadline` | 병역 판단 마감 |

## 9. CompensationGradeV0

보상 등급은 FA 상태 안에도 들어가지만, UI/트레이드/로스터 화면에서 독립적으로 읽기 쉽도록 player 상위 필드로도 둔다. 중복 필드가 생기는 대신 v0 구현 난이도를 낮춘다. 정규화 후에는 `faRightsByPlayerId` 또는 `compensationByPlayerId`로 합친다.

```js
{
  grade: "B",
  basisSeason: 2026,
  rankingBasis: "salaryRank",
  protectedListRequired: true,
  compensationPlayerAllowed: true,
  cashOnlyAllowed: true,
  estimatedCashKRW: 900000000,
  source: {
    kind: "estimated",
    confidence: 0.6
  }
}
```

### Compensation enum

| 필드 | 값 | 의미 |
| --- | --- | --- |
| `compensationGrade.grade` | `A` | A등급 |
|  | `B` | B등급 |
|  | `C` | C등급 |
|  | `none` | 보상 없음 |
|  | `unknown` | 미정 |
| `compensationGrade.rankingBasis` | `salaryRank` | 연봉 순위 기반 |
|  | `serviceTime` | 연차/서비스타임 기반 |
|  | `manual` | 수동 입력 |
|  | `unknown` | 기준 미정 |

## 10. Source 공통 shape

계약, 병역, 서비스타임, 보상 등급은 실제 데이터와 추정 데이터가 섞일 가능성이 높다. 모든 하위 객체에 같은 `source` shape를 사용할 수 있다.

```js
{
  kind: "official",
  label: "KBO 공시",
  url: "https://...",
  checkedDate: "2026-06-30",
  confidence: 1
}
```

| `source.kind` 값 | 의미 |
| --- | --- |
| `official` | KBO/구단/공식 공시 |
| `reported` | 언론 보도 |
| `estimated` | 계산 또는 추정 |
| `fallback` | 앱 기본값 |
| `unknown` | 출처 없음 |

## 11. 샘플 JSON

현재 구조를 존중한 v0 샘플이다. 팀 roster 안의 player 객체에 상태 객체를 직접 포함한다.

```json
{
  "id": "lg-kim-example",
  "name": "김예시",
  "age": 29,
  "role": "hitter",
  "position": "CF",
  "bats": "L",
  "throws": "R",
  "ovr": 142,
  "pot": 151,
  "fatigue": 12,
  "form": 6,
  "injuredDays": 0,
  "contact": 15,
  "power": 12,
  "eye": 14,
  "speed": 16,
  "defense": 15,
  "contract": {
    "id": "contract-lg-kim-example-2026",
    "status": "active",
    "type": "fa",
    "teamId": "lg",
    "startSeason": 2026,
    "endSeason": 2029,
    "signedDate": "2026-01-12",
    "guaranteedAmountKRW": 3600000000,
    "averageAnnualValueKRW": 900000000,
    "salary": {
      "season": 2026,
      "amountKRW": 800000000,
      "payrollAmountKRW": 800000000,
      "paymentTiming": "season"
    },
    "salaryBySeason": [
      { "season": 2026, "amountKRW": 800000000, "payrollAmountKRW": 800000000 },
      { "season": 2027, "amountKRW": 900000000, "payrollAmountKRW": 900000000 },
      { "season": 2028, "amountKRW": 900000000, "payrollAmountKRW": 900000000 },
      { "season": 2029, "amountKRW": 1000000000, "payrollAmountKRW": 1000000000 }
    ],
    "signingBonus": {
      "amountKRW": 400000000,
      "paidSeason": 2026,
      "payrollTreatment": "included"
    },
    "bonuses": [
      {
        "id": "bonus-gg",
        "type": "award",
        "label": "골든글러브 수상",
        "trigger": { "award": "goldenGlove" },
        "amountKRW": 50000000,
        "status": "pending"
      }
    ],
    "options": [
      {
        "id": "option-2030-club",
        "type": "club",
        "season": 2030,
        "amountKRW": 1000000000,
        "buyoutKRW": 100000000,
        "status": "pending"
      }
    ],
    "clauses": {
      "noTrade": "limited",
      "optOutAfterSeason": null,
      "foreignReleaseClause": false
    },
    "source": {
      "kind": "estimated",
      "label": "테스트 데이터",
      "checkedDate": "2026-06-30",
      "confidence": 0.5
    }
  },
  "faStatus": {
    "status": "signed",
    "eligibilitySeason": 2025,
    "filingSeason": 2025,
    "marketState": "closed",
    "yearsUntilEligibility": 0,
    "previousFaCount": 1,
    "qualifyingTeamId": "lg",
    "compensationGrade": "B",
    "compensationRule": {
      "requiresProtectedList": true,
      "protectedListSize": 20,
      "cashCompensationMultiplier": 2
    },
    "rights": {
      "canNegotiateWithAllTeams": false,
      "originalTeamExclusiveUntil": null
    }
  },
  "militaryStatus": {
    "status": "completed",
    "availability": "available",
    "obligation": "completed",
    "serviceType": "activeDuty",
    "startDate": "2020-12-01",
    "expectedReturnDate": "2022-06-01",
    "actualReturnDate": "2022-06-01",
    "holdTeamId": "lg",
    "countsTowardRosterLimit": false,
    "notes": null
  },
  "foreignPlayer": {
    "isForeign": false,
    "registrationStatus": "notForeign",
    "slotType": "domestic",
    "marketTier": null,
    "visaStatus": "notRequired"
  },
  "serviceTime": {
    "seasonsAccrued": 8,
    "daysAccrued": 982,
    "currentSeasonDays": 0,
    "firstTeamRegistrationDays": 0,
    "futuresOnlyDays": 0,
    "rookieEligible": false,
    "faClockStatus": "met",
    "nextMilestone": null,
    "source": {
      "kind": "estimated",
      "confidence": 0.7
    }
  },
  "compensationGrade": {
    "grade": "B",
    "basisSeason": 2025,
    "rankingBasis": "salaryRank",
    "protectedListRequired": true,
    "compensationPlayerAllowed": true,
    "cashOnlyAllowed": true,
    "estimatedCashKRW": 1600000000,
    "source": {
      "kind": "estimated",
      "confidence": 0.6
    }
  }
}
```

## 12. UI 요약 필드

v0 UI는 전체 계약 세부사항보다 빠르게 스캔 가능한 요약 필드를 먼저 노출한다.

| UI 위치 | 표시 필드 | 계산/출처 |
| --- | --- | --- |
| 로스터 테이블 | 계약 상태 | `contract.status`, 없으면 `미입력` |
| 로스터 테이블 | 2026 연봉 | `contract.salary.amountKRW` |
| 로스터 테이블 | 계약 만료 | `contract.endSeason` |
| 로스터 테이블 | FA | `faStatus.status`, `faStatus.eligibilitySeason` |
| 로스터 테이블 | 보상 등급 | `compensationGrade.grade` |
| 로스터 테이블 | 병역 | `militaryStatus.status`, `militaryStatus.availability` |
| 로스터 테이블 | 외국인 | `foreignPlayer.isForeign`, `foreignPlayer.registrationStatus` |
| 선수 상세 | 보장 총액 | `contract.guaranteedAmountKRW` |
| 선수 상세 | 연도별 연봉 | `contract.salaryBySeason[]` |
| 선수 상세 | 옵션/보너스 | `contract.options[]`, `contract.bonuses[]` |
| 선수 상세 | 서비스타임 | `serviceTime.seasonsAccrued`, `serviceTime.daysAccrued` |
| GM 데스크 | 시즌 후 FA 예정 | `faStatus.status === "eligibleAfterSeason"` |
| GM 데스크 | 병역 리스크 | `militaryStatus.status`가 `notServed`, `deferred`, `serving`인 선수 |
| 외국인 화면 | 외국인 슬롯 | `foreignPlayer.registrationStatus === "registered"` |
| 외국인 화면 | 교체 위험 | `foreignPlayer.replacementRisk` |

권장 요약 helper 이름:

- `getPlayerContractSummary(player, season)`
- `getPlayerRosterAvailability(player)`
- `getPendingFaPlayers(state, season)`
- `getForeignSlotSummary(team)`
- `getPayrollCommitments(team, season)`

## 13. v0 최소 침습 구현 단계

1. `data.js`의 선수 생성 또는 seed 조립 단계에서 optional 상태 필드를 추가한다.
2. 기존 `Player Shape`를 깨지 않도록 모든 새 필드는 읽기 fallback을 둔다.
3. UI는 로스터/선수 상세에 요약 필드만 추가하고, 계약 수정/FA 체결 같은 mutation은 만들지 않는다.
4. 팀 payroll 계산은 우선 `team.payroll`을 유지하되, 개발 검증용으로 `sum(player.contract.salary.payrollAmountKRW)`를 별도 계산한다.
5. 라인업/로스터 제외 조건은 우선 `injuredDays > 0`에 더해 `militaryStatus.availability === "unavailable"` 정도만 반영한다.
6. 저장 roundtrip은 새 필드가 JSON으로 보존되는지만 확인한다. 별도 localStorage나 build tooling은 추가하지 않는다.

## 14. 이후 player registry 분리 시 migration 포인트

정규화 단계에서는 현재 `teams[].roster[]`에 중복 저장된 선수 객체를 `playersById`로 옮기고, 팀 로스터에는 player id만 둔다.

```js
{
  playersById: {
    "lg-kim-example": {
      id,
      name,
      age,
      role,
      position,
      ratings,
      statusRefs
    }
  },
  contractsByPlayerId: {
    "lg-kim-example": ContractV1
  },
  faRightsByPlayerId: {
    "lg-kim-example": FaStatusV1
  },
  militaryByPlayerId: {
    "lg-kim-example": MilitaryStatusV1
  },
  foreignPlayersById: {
    "lg-kim-example": ForeignPlayerV1
  },
  serviceTimeByPlayerId: {
    "lg-kim-example": ServiceTimeV1
  },
  rosterAssignments: [
    {
      playerId: "lg-kim-example",
      teamId: "lg",
      level: "active",
      startDate: "2026-03-01",
      endDate: null
    }
  ]
}
```

Migration 순서:

1. `teams[].roster[]`를 순회해 `playersById[player.id]`를 만든다.
2. `player.contract`를 `contractsByPlayerId[player.id]`로 이동한다.
3. `player.faStatus`, `player.compensationGrade`를 `faRightsByPlayerId[player.id]` 또는 `compensationByPlayerId[player.id]`로 이동한다.
4. `player.militaryStatus`를 `militaryByPlayerId[player.id]`로 이동한다.
5. `player.foreignPlayer`를 `foreignPlayersById[player.id]`로 이동한다. 국내 선수 기본값은 저장하지 않고 필요 시 selector에서 생성해도 된다.
6. `player.serviceTime`을 `serviceTimeByPlayerId[player.id]`로 이동한다.
7. 각 팀의 `roster`는 player 객체 배열에서 player id 배열 또는 `rosterAssignments`로 변환한다.
8. 기존 저장본 호환을 위해 `schemaVersion`과 `migrations["player-contract-v0-to-v1"]`를 둔다.

## 15. Transaction/Command로 승격할 상태 변경

아래 작업은 v0 문서/표시 단계에서는 직접 구현하지 않는 편이 안전하다. 이후 command와 event ledger가 생긴 뒤 commit 대상으로 만든다.

| Command 후보 | 읽는 상태 | 쓰는 상태 |
| --- | --- | --- |
| `SIGN_CONTRACT` | player, team budget, FA status | contract, team payroll hint, eventLog |
| `FILE_FA` | serviceTime, faStatus, contract | faStatus, eventLog |
| `SIGN_FA_CONTRACT` | faStatus, compensationGrade, contract offer | contract, faStatus, compensation pending event |
| `RESOLVE_FA_COMPENSATION` | compensationGrade, protected list, roster | roster assignment, compensation event |
| `REGISTER_FOREIGN_PLAYER` | foreignPlayer, contract, team foreign slots | foreignPlayer, roster assignment |
| `RELEASE_FOREIGN_PLAYER` | foreignPlayer, contract | foreignPlayer, contract status, eventLog |
| `START_MILITARY_SERVICE` | militaryStatus, roster assignment | militaryStatus, roster assignment |
| `RETURN_FROM_MILITARY_SERVICE` | militaryStatus, holdTeamId | militaryStatus, roster assignment |

## 16. 검증 체크리스트

- 모든 기존 선수는 새 필드가 없어도 앱이 동작해야 한다.
- 새 필드가 있는 선수와 없는 선수가 같은 roster 안에 섞여도 UI가 깨지지 않아야 한다.
- 금액 필드는 숫자로 저장하고 UI에서만 문자열로 포맷한다.
- `foreignPlayer.isForeign === false`인 선수는 외국인 슬롯 계산에서 제외한다.
- `militaryStatus.availability === "unavailable"`인 선수는 라인업 후보에서 제외할 수 있어야 한다.
- 계약 만료, FA 예정, 외국인 등록, 병역 복귀 예정은 모두 `currentDate` 또는 season 기준 selector로 계산한다.
- 저장/불러오기 roundtrip 후 `contract`, `faStatus`, `militaryStatus`, `foreignPlayer`, `serviceTime`, `compensationGrade`가 유지되어야 한다.
