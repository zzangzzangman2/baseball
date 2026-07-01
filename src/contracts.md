# KBO GM Manager Module Contract

This app is a static HTML/ES module prototype. All paths are under:

`C:\Users\godho\Downloads\baseball`

## Module Ownership

- `src/data.js`
  - Owns league constants, team seed data, player generation, and initial state creation.
  - Exports `createInitialState()`, `TEAM_COUNT`, `REGULAR_SEASON_GAMES`, `formatDateKey(date)`.

- `src/engine.js`
  - Owns deterministic game simulation and state mutation.
  - Imports from `data.js` and the front-office trade market.
  - Exports `simulateDay(state)`, `simulateDays(state, days)`, `simulateRegularSeason(state)`, `initializePostseason(state)`, `simulatePostseason(state)`, `initializeDraft(state)`, `simulateDraft(state)`, `initializeSecondaryDraft(state)`, `simulateSecondaryDraft(state)`, `commitTradeProposal(state, proposal)`, `initializeFreeAgency(state)`, `commitFreeAgentSigning(state, offer?)`, `commitForeignPlayerSigning(state, offer?)`, `runAutonomousOffseason(state)`, `advanceSeason(state)`, `advanceToNextSeason(state)`, `getStandings(state)`, `getSelectedTeam(state)`, `buildLineup(team)`, `buildPitchingSnapshot(team)`.
  - Autonomous offseason v1 adds a one-cycle league loop: draft code rookies, secondary-draft transfers, FA/foreign rights, CPU trades, and season rollover. This is not a full multi-year economy/news/politics simulation.

- `src/ui.js`
  - Owns DOM rendering and event binding.
  - Imports engine functions.
  - Exports `mountApp(root, state)`.

- `src/styles.css`
  - Owns all presentation CSS.

- `src/main.js`
  - Very thin bootstrap only.

## State Shape

```js
{
  day: 1,
  currentDate: "2026-03-01",
  selectedTeamId: "lg",
  gamesPlayed: 0,
  phase: "preseason",
  ui: { screen: "welcome" },
  weather: { label, temperature, runFactor, homerFactor },
  lastGames: [],
  postseason: null,
  awards: null,
  draft: null,
  secondaryDraft: null,
  freeAgency: null,
  autonomousOffseason: null,
  seasonHistory: [],
  trades: { completed: [] },
  tradeAssets: { cashLedger: [], draftPickLedger: [], conditionalAssets: [], ptbnlSlots: [] },
  eventLog: [],
  logs: [],
  teams: [
    {
      id, name, shortName, city, color,
      wins, losses, ties, runsFor, runsAgainst,
      market, fan, payroll, budget, morale,
      attendanceTotal, homeGames, streak,
      roster: []
    }
  ]
}
```

## Player Shape

```js
{
  id, name, age, role, position, bats, throws,
  ovr, pot, fatigue, form, injuredDays,
  contact, power, eye, speed, defense,
  stuff, control, stamina, movement,
  seasonStats: {
    batting: { games, plateAppearances, atBats, runs, hits, doubles, triples, homeRuns, rbi, walks, strikeouts, stolenBases, caughtStealing, totalBases },
    pitching: { games, gamesStarted, wins, losses, saves, holds, blownSaves, inningsOuts, battersFaced, hitsAllowed, runsAllowed, earnedRuns, homeRunsAllowed, walksAllowed, strikeouts, pitches },
    fielding: { games, errors }
  },
  contract: { id, status, type, teamId, startSeason, endSeason, salary, salaryBySeason, guaranteedAmountKRW, source },
  faStatus: { status, eligibilitySeason, marketState, yearsUntilEligibility, compensationGrade, source },
  militaryStatus: { status, availability, obligation, serviceType, holdTeamId, source },
  foreignPlayer: { isForeign, nationality, registrationStatus, slotType, marketTier, visaStatus, source },
  serviceTime: { seasonsAccrued, daysAccrued, rookieEligible, faClockStatus, nextMilestone, source },
  compensationGrade: { grade, basisSeason, rankingBasis, estimatedCashKRW, source }
}
```

Contract, FA, military, foreign-player, service-time, and compensation fields are v0 business-state objects.
Real salary/military/FA data is not claimed unless `source.kind` is `official` or `reported`; generated defaults use `estimated`, `fallback`, or `unknown`.

## Recent Game Shape

`state.lastGames[]` stores compact game results plus v1 box score data for recent display and verification.

```js
{
  id, date, weather,
  awayTeamId, homeTeamId,
  awayScore, homeScore,
  awayHits, homeHits,
  awayHomeRuns, homeHomeRuns,
  awayStarter, homeStarter,
  gameType: "regular" | "postseason",
  postseason: null | { seriesId, seriesLabel, round, gameNumber, winnerTeamId, winnerName, winsAfter },
  boxScore: {
    linescore: {
      innings: [1,2,3,4,5,6,7,8,9],
      away: { teamId, team, runsByInning, runs, hits, errors, leftOnBase },
      home: { teamId, team, runsByInning, runs, hits, errors, leftOnBase }
    },
    batting: { away: [], home: [] },
    pitching: {
      away: [{ playerId, name, role, appearanceOrder, decision, decisions, inningsOuts, battersFaced, pitches, runsAllowed, earnedRuns, hitsAllowed, walksAllowed, strikeouts, homeRunsAllowed }],
      home: [{ playerId, name, role, appearanceOrder, decision, decisions, inningsOuts, battersFaced, pitches, runsAllowed, earnedRuns, hitsAllowed, walksAllowed, strikeouts, homeRunsAllowed }]
    },
    pitchingPlan: {
      away: { starter, bullpen, starterTargetOuts, starterPitchLimit },
      home: { starter, bullpen, starterTargetOuts, starterPitchLimit }
    },
    totals: { plateAppearances, pitches, homeRuns, stolenBases, pitchersUsed }
  },
  plateAppearanceEvents: [],
  scoringEvents: [],
  totalRuns,
  attendance
}
```

## Postseason and Awards Shape

`initializePostseason(state)` creates a v1 KBO postseason bracket from regular-season standings. `simulatePostseason(state)` runs it to completion without changing regular-season team wins/losses.

```js
postseason: {
  status: "active" | "complete",
  ruleSource,
  seeds: [{ seed, teamId, name, shortName, wins, losses, ties, pct, runDiff }],
  series: [{
    id, round, label, shortLabel,
    winsNeeded, maxGames, higherSeedStartingWins,
    participants: [seededTeam, seededTeam | null],
    wins: { [teamId]: wins },
    games: [{ id, date, gameNumber, awayTeamId, homeTeamId, awayScore, homeScore, winnerTeamId, winsAfter }],
    status, winnerTeamId, winnerName, winnerSeed
  }],
  championTeamId, championName, championSeed
}

awards: {
  regularSeason: { mvp, rookieOfYear, goldenGloves },
  postseason: { koreanSeriesMvp }
}
```

## Draft Shape

`initializeDraft(state)` builds a v1 amateur draft board after postseason completion. `simulateDraft(state)` completes 11 rounds and 110 picks. Until verified official amateur names are imported, prospects are anonymous candidate codes. The current autonomous offseason v1 adds selected prospects to `teams[].roster[]` as `DRF-YYYY-###` code-based rookie players and records them in `draft.rosterLedger`; it must not claim they are verified real named roster players.

```js
draft: {
  status: "ready" | "complete",
  year,
  ruleSource,
  rounds: 11,
  picksPerRound: 10,
  totalPicks: 110,
  poolSize: 150,
  order: [{ slot, teamId, name, shortName, previousRank, record }],
  strategies: {
    [teamId]: {
      focus,
      timeline,
      riskTolerance,
      preferredPositions,
      needs
    }
  },
  prospects: [{
    id,
    displayCode,
    sourceKind: "anonymous-projection-v1",
    sourceNote,
    classType,
    role,
    position,
    handedness,
    profile,
    age,
    presentGrade,
    futureGrade,
    certainty,
    risk,
    signability,
    tools,
    picked
  }],
  picks: [{
    pickNumber,
    round,
    pickInRound,
    teamId,
    teamName,
    prospectId,
    displayCode,
    role,
    position,
    classType,
    profile,
    presentGrade,
    futureGrade,
    certainty,
    risk,
    rosterStatus,
    rosterPlayerId
  }],
  rosterLedger: [{
    id,
    date,
    year,
    pickNumber,
    round,
    teamId,
    prospectId,
    playerId,
    displayCode,
    status
  }]
}
```

## Secondary Draft Shape

`initializeSecondaryDraft(state)` builds a v1 2차 드래프트 board from the current verified 531-player roster. `simulateSecondaryDraft(state)` creates the protected lists, exposed pool, pick results, and current v1 roster moves. Selected existing players are transferred in `teams[].roster[]` and recorded in `secondaryDraft.transferLedger`; refusal, mandatory registration, and real finance-ledger effects remain later transaction types.

```js
secondaryDraft: {
  status: "ready" | "complete",
  year,
  ruleSource,
  sourceUrls,
  protectedCount: 35,
  baseRounds: 3,
  extraRounds: 2,
  extraTeamCount: 3,
  maxPicks: 36,
  originPickLimit: 4,
  compensationByRound: { 1, 2, 3, 4, 5 },
  order: [{ slot, teamId, name, shortName, previousRank, record, extraRoundEligible }],
  strategies: { [teamId]: { focus, timeline, salarySensitivity, preferredPositions, needs } },
  protections: {
    [teamId]: {
      protectedCount,
      exposedCount,
      hardExcludedCount,
      protected: [secondaryPlayerCard],
      exposed: [secondaryPlayerCard],
      hardExcluded: [secondaryPlayerCard]
    }
  },
  exposurePool: [secondaryPlayerCard],
  picks: [{
    pickNumber,
    round,
    pickInRound,
    teamId,
    teamName,
    fromTeamId,
    fromTeamName,
    playerId,
    name,
    role,
    position,
    age,
    ovr,
    pot,
    compensationKRW,
    obligation,
    transferStatus,
    transferredDate
  }],
  transferLedger: [{
    id,
    date,
    year,
    pickNumber,
    round,
    playerId,
    fromTeamId,
    toTeamId,
    compensationKRW,
    status
  }],
  passedSlots: [],
  policyNotes: []
}
```

The v1 implementation hard-excludes foreign players, active FA-market players, and code-based rookie contracts. Full official acquisition-year exclusions remain deferred until the 1,052-player master roster has official acquisition-year data.

## Free Agency and Foreign Market Shape

`initializeFreeAgency(state)` builds the v1 offseason FA and foreign-player market. Domestic FA candidates must come from the real roster database. Foreign-player candidates are anonymous code records until verified real names and source data exist.

```js
freeAgency: {
  status: "ready" | "complete",
  year,
  ruleSource,
  sourceUrls,
  faCandidates: [{
    playerId,
    name,
    previousTeamId,
    role,
    position,
    age,
    ovr,
    pot,
    previousSalaryKRW,
    faStatus,
    compensationGrade
  }],
  offers: [{
    id,
    playerId,
    fromTeamId,
    years,
    annualSalaryKRW,
    signingBonusKRW,
    incentivesKRW,
    options,
    noTradeClause,
    status
  }],
  foreignMarket: {
    status: "ready",
    sourcePolicy,
    candidates: [{
      id,
      displayCode, // FGN-YYYY-###
      sourceKind: "anonymous-foreign-market-v1",
      tier,
      role,
      position,
      slotType,
      profile,
      age,
      askingSalaryKRW,
      scoutingGrade,
      adaptationRisk,
      medicalRisk,
      status
    }]
  },
  foreignOffers: [{
    id,
    candidateId,
    displayCode,
    teamId,
    contractKRW,
    optionKRW,
    offerScore,
    status
  }],
  signings: [{
    id,
    playerId,
    fromTeamId,
    signingTeamId,
    contract,
    compensationGrade,
    status
  }],
  compensationLedger: [{
    id,
    signingId,
    playerId,
    fromTeamId,
    toTeamId,
    grade,
    protectedCount,
    compensationPlayerId,
    cashKRW,
    cashMultiplier,
    status
  }],
  foreignSignings: [{
    id,
    candidateId,
    displayCode,
    teamId,
    tier,
    slotType,
    contractKRW,
    optionKRW,
    rosterActivation: "pending-official-name",
    rightsStatus: "held",
    status
  }]
}
```

Domestic FA rules:

- `faCandidates` only includes domestic players already present in verified rosters with eligible `faStatus` and `compensationGrade`.
- `commitFreeAgentSigning(state, offer?)` updates the player's roster ownership, `player.teamId`, `player.contract`, and `player.faStatus`.
- The command also appends the compensation result to `state.freeAgency.compensationLedger`.
- v1 compensation rules: A grade = 20-player protection list + 200% previous salary, or 300% cash only. B grade = 25-player protection list + 100% previous salary, or 200% cash only. C grade = 150% cash only and no compensation player.

Foreign-market rules:

- `foreignMarket` contains 30 candidates split into five tiers.
- Candidate ids/display codes use `FGN-YYYY-###`; no unverified real names are generated.
- `commitForeignPlayerSigning(state, offer?)` does not insert a fake named player into any real roster.
- The command records rights and activation-pending status in `foreignSignings`; later activation can create or attach a verified roster player when source data exists.

## Autonomous Offseason v1 Shape

Autonomous offseason v1 is the P0 season-loop contract after postseason completion. It is intentionally narrow: it connects already-modeled systems into the next season, but it does not imply retirement, real-name amateur imports, real-name foreign-player activation, finance, news, or league-politics simulation.

```js
autonomousOffseason: {
  lastRun: {
    id,
    status,
    date,
    year,
    draftSignings,
    secondaryTransfers,
    faSignings,
    foreignRights,
    aiTrades,
    rosterDelta,
    source
  },
  history: [lastRun]
},
seasonHistory: [{
  id,
  season,
  closedAt,
  nextSeason,
  gamesPlayed,
  championTeamId,
  championName,
  standings,
  awards,
  offseason,
  rosterCount
}]
}
```

Current v1 writes directly to `teams[].roster[]` plus ledgers:

```js
draft.rosterLedger[]              // DRF code rookies added to roster
secondaryDraft.transferLedger[]   // verified players moved between rosters
freeAgency.signings[]             // domestic FA roster/contract commits
freeAgency.foreignSignings[]      // FGN rights only, no fake roster player
trades.completed[]                // user and CPU trade commits
```

Future normalized roster-assignment records should distinguish real verified players from code-based rights:

- Amateur draft picks without official imported names use `DRF-YYYY-###` code players and must not pretend to be verified real names.
- Secondary-draft picks are existing verified players and can move to the selecting team.
- Foreign-market signings use `FGN-YYYY-###` rights and `pendingActivation`; they do not create fake named players.
- Season rollover resets team records/player season stats, advances age/service time/contracts, applies a basic growth/decline curve, and starts the next preseason.

## Event Log Shape

`state.eventLog[]` is the v1 source event ledger. It currently records game finals, trade commits, domestic FA signings, and foreign-player rights signings. P0 autonomous offseason v1 also uses event entries for offseason stage completion, draft/secondary-draft roster assignment, and season rollover.

```js
{
  id,
  type: "game.final",
  date,
  gameId,
  teams: { away, home },
  score: { away, home },
  totals: { runs, hits, homeRuns, plateAppearances }
}
```

```js
{
  id,
  type: "trade.completed",
  date,
  tradeId,
  teams: { buyer, seller },
  assets: { incomingPlayerId, outgoingPlayerId, additionalAssetTypes, cashKRW, draftPickCount, conditionalCount, ptbnlCount },
  summary,
  valueBalance,
  acceptanceScore
}
```

```js
{
  id,
  type: "fa.signed",
  date,
  playerId,
  teams: { from, to },
  contract: { years, annualSalaryKRW, totalGuaranteeKRW, compensationGrade },
  summary
}
```

```js
{
  id,
  type: "foreign.signed",
  date,
  teamId,
  candidateId,
  displayCode,
  contractKRW,
  summary
}
```

```js
{
  id,
  type: "offseason.stage.completed",
  date,
  season,
  stage,
  resultCounts,
  summary
}
```

```js
{
  id,
  type: "season.rolled_over",
  date,
  fromSeason,
  toSeason,
  rosterAssignmentCount,
  draftRightsCount,
  foreignRightsCount,
  summary
}
```

## Trade Command Shape

`commitTradeProposal(state, proposal)` validates and commits a v2 trade package from a `frontOffice.buildTradeMarket()` proposal. It only commits proposals with `status === "viable"`, `executionGate.commandReady === true`, a matching `commandApproval.confirmed` token, and exactly one outgoing player asset, plus optional cash, draft-pick, conditional, and PTBNL assets.

```js
trades: {
  completed: [{
    id,
    proposalId,
    type: "player-for-player" | "player-plus-assets",
    status: "complete",
    date,
    buyerTeamId,
    buyerTeamName,
    sellerTeamId,
    sellerTeamName,
    incoming: { playerId, name, role, position, age, ovr, pot, fromTeamId, toTeamId, valueScore },
    outgoing: { playerId, name, role, position, age, ovr, pot, fromTeamId, toTeamId, valueScore },
    additionalAssets: [{ id, tradeId, assetType, fromTeamId, toTeamId, valueScore, amountKRW, year, round, condition, convertsTo, deadline, pool }],
    acceptanceScore,
    valueBalance,
    summary,
    source
  }]
}
```

```js
tradeAssets: {
  cashLedger: [{ id, tradeId, date, fromTeamId, toTeamId, amountKRW, status }],
  draftPickLedger: [{ id, tradeId, date, year, round, originalTeamId, fromTeamId, toTeamId, protection, status }],
  conditionalAssets: [{ id, tradeId, date, fromTeamId, toTeamId, condition, convertsTo, deadline, status }],
  ptbnlSlots: [{ id, tradeId, date, fromTeamId, toTeamId, pool, deadline, status }]
}
```

The command updates both rosters and player ownership fields such as `player.teamId`, `contract.teamId`, FA rights team, military hold team, and foreign-player rights team when applicable. Cash, draft-pick, conditional, and PTBNL assets are recorded in dedicated ledgers. Multi-player player packages and full negotiation/acceptance workflows are still future transaction types.

## Rules

- Keep all simulation deterministic from `state.day`, team ids, and player ids.
- Do not use `localStorage` yet.
- Do not introduce build tooling yet.
- Do not edit files outside `C:\Users\godho\Downloads\baseball`.
- `logs` is user-facing news/status text; `eventLog` is source-state history.
- `DRF-YYYY-###` and `FGN-YYYY-###` are code-based rights, not verified real named players.
- Autonomous offseason v1 means one deterministic offseason-to-next-season loop. It does not claim full real-data coverage or complete multi-year league simulation.
