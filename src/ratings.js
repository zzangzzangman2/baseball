export const RATINGS_FORMULA_VERSION = "2026-06-30.fm-style-1";

export const COMMON_ATTRIBUTES = [
  "conditionStability",
  "injuryResistance",
  "durability",
  "recovery",
  "ageResilience",
  "mentalToughness",
  "clutch",
  "consistency",
  "workEthic",
  "leadership",
  "adaptability",
  "teamwork",
  "leagueExperience",
  "bigGameExperience",
  "reputation",
  "kboAdaptation"
];

export const PITCHER_ATTRIBUTES = [
  "stuff",
  "control",
  "velocity",
  "stamina",
  "movement",
  "hrSuppression",
  "gbTendency",
  "repertoire",
  "pitchingIQ",
  "holdRunners",
  "fielding",
  "vsLHB",
  "vsRHB"
];

export const HITTER_ATTRIBUTES = [
  "contactL",
  "contactR",
  "powerL",
  "powerR",
  "eye",
  "situational",
  "battedBall",
  "patience",
  "bunting",
  "vsLHP",
  "vsRHP",
  "defense",
  "range",
  "arm",
  "catching",
  "speed",
  "stealing",
  "baserunning"
];

export const ATTRIBUTE_CATEGORIES = {
  conditionStability: "physical",
  injuryResistance: "physical",
  durability: "physical",
  recovery: "physical",
  ageResilience: "physical",
  mentalToughness: "mental",
  clutch: "mental",
  consistency: "mental",
  workEthic: "mental",
  leadership: "mental",
  adaptability: "mental",
  teamwork: "mental",
  leagueExperience: "experience",
  bigGameExperience: "experience",
  reputation: "experience",
  kboAdaptation: "experience",
  stuff: "technical",
  control: "technical",
  velocity: "physical",
  stamina: "physical",
  movement: "technical",
  hrSuppression: "technical",
  gbTendency: "style",
  repertoire: "experience",
  pitchingIQ: "experience",
  holdRunners: "technical",
  fielding: "technical",
  vsLHB: "technical",
  vsRHB: "technical",
  contactL: "technical",
  contactR: "technical",
  powerL: "technical",
  powerR: "technical",
  eye: "technical",
  situational: "technical",
  battedBall: "technical",
  patience: "technical",
  bunting: "technical",
  vsLHP: "technical",
  vsRHP: "technical",
  defense: "technical",
  range: "physical",
  arm: "physical",
  catching: "technical",
  speed: "physical",
  stealing: "technical",
  baserunning: "technical"
};

export const OVR_WEIGHTS = {
  P: {
    stuff: 0.12,
    control: 0.11,
    velocity: 0.07,
    stamina: 0.07,
    movement: 0.09,
    hrSuppression: 0.08,
    gbTendency: 0.03,
    repertoire: 0.06,
    pitchingIQ: 0.07,
    holdRunners: 0.025,
    fielding: 0.025,
    vsLHB: 0.05,
    vsRHB: 0.05,
    conditionStability: 0.015,
    injuryResistance: 0.012,
    durability: 0.012,
    recovery: 0.01,
    mentalToughness: 0.015,
    clutch: 0.012,
    consistency: 0.018,
    leagueExperience: 0.012,
    reputation: 0.012
  },
  C: {
    contactL: 0.07,
    contactR: 0.07,
    powerL: 0.045,
    powerR: 0.045,
    eye: 0.055,
    situational: 0.04,
    battedBall: 0.04,
    patience: 0.035,
    bunting: 0.02,
    vsLHP: 0.03,
    vsRHP: 0.03,
    defense: 0.09,
    range: 0.04,
    arm: 0.075,
    catching: 0.13,
    speed: 0.025,
    stealing: 0.015,
    baserunning: 0.025,
    conditionStability: 0.015,
    injuryResistance: 0.012,
    durability: 0.014,
    mentalToughness: 0.014,
    consistency: 0.018,
    leadership: 0.012,
    leagueExperience: 0.012,
    reputation: 0.012
  },
  IF: {
    contactL: 0.085,
    contactR: 0.085,
    powerL: 0.055,
    powerR: 0.055,
    eye: 0.06,
    situational: 0.04,
    battedBall: 0.045,
    patience: 0.04,
    bunting: 0.025,
    vsLHP: 0.035,
    vsRHP: 0.035,
    defense: 0.085,
    range: 0.085,
    arm: 0.06,
    catching: 0.005,
    speed: 0.055,
    stealing: 0.04,
    baserunning: 0.05,
    conditionStability: 0.014,
    injuryResistance: 0.01,
    durability: 0.012,
    mentalToughness: 0.012,
    consistency: 0.016,
    leagueExperience: 0.01,
    reputation: 0.01
  },
  OF: {
    contactL: 0.08,
    contactR: 0.08,
    powerL: 0.065,
    powerR: 0.065,
    eye: 0.055,
    situational: 0.035,
    battedBall: 0.055,
    patience: 0.035,
    bunting: 0.015,
    vsLHP: 0.035,
    vsRHP: 0.035,
    defense: 0.065,
    range: 0.085,
    arm: 0.07,
    catching: 0.005,
    speed: 0.075,
    stealing: 0.055,
    baserunning: 0.06,
    conditionStability: 0.014,
    injuryResistance: 0.01,
    durability: 0.012,
    mentalToughness: 0.012,
    consistency: 0.016,
    leagueExperience: 0.01,
    reputation: 0.01
  },
  DH: {
    contactL: 0.12,
    contactR: 0.12,
    powerL: 0.12,
    powerR: 0.12,
    eye: 0.09,
    situational: 0.065,
    battedBall: 0.08,
    patience: 0.06,
    vsLHP: 0.045,
    vsRHP: 0.045,
    speed: 0.025,
    baserunning: 0.025,
    conditionStability: 0.02,
    mentalToughness: 0.02,
    consistency: 0.025,
    leagueExperience: 0.015,
    reputation: 0.02
  },
  UT: {
    contactL: 0.08,
    contactR: 0.08,
    powerL: 0.055,
    powerR: 0.055,
    eye: 0.06,
    situational: 0.04,
    battedBall: 0.045,
    patience: 0.04,
    bunting: 0.025,
    vsLHP: 0.035,
    vsRHP: 0.035,
    defense: 0.07,
    range: 0.07,
    arm: 0.055,
    speed: 0.055,
    stealing: 0.04,
    baserunning: 0.05,
    conditionStability: 0.014,
    injuryResistance: 0.01,
    durability: 0.012,
    mentalToughness: 0.012,
    consistency: 0.016,
    leagueExperience: 0.01,
    reputation: 0.01
  }
};

const REGULAR_WEIGHT = 1;
const FUTURES_WEIGHT = 0.72;
const SAMPLE_TARGET = {
  hitter: 190,
  pitcher: 52
};

const POSITION_DEFAULTS = {
  C: { defense: 11.8, range: 7.2, arm: 12.2, catching: 13, speed: 6.5 },
  IF: { defense: 11.2, range: 11.4, arm: 10.8, catching: 2.5, speed: 10.4 },
  OF: { defense: 10.4, range: 11.8, arm: 11.5, catching: 2.2, speed: 11.6 },
  DH: { defense: 4.8, range: 4.5, arm: 6.5, catching: 1.5, speed: 7.4 },
  UT: { defense: 9.4, range: 9.5, arm: 9.2, catching: 2.2, speed: 9.4 }
};

export function buildPlayerRatings({ seedPlayer = {}, teamSeed = {}, teamIndex = 0, index = 0, statsRecord = null } = {}) {
  const role = seedPlayer?.role === "pitcher" ? "pitcher" : "hitter";
  const position = normalizePosition(seedPlayer?.position, role);
  const age = clamp(Number(seedPlayer?.age ?? 26), 17, 45);
  const fallback = buildFallbackProfile({ seedPlayer, teamSeed, teamIndex, index, role, position, age });
  const official = buildOfficialComposite(statsRecord, role);

  if (!official.usable) {
    return finalizeProfile({
      role,
      position,
      age,
      fallback,
      roleAttributes: fallback.roleAttributes,
      commonAttributes: fallback.commonAttributes,
      source: {
        ratingSource: "seed-fallback",
        ratingLeague: "none",
        ratingConfidence: "low",
        sourceConfidence: fallbackSourceConfidence(seedPlayer),
        ratingReliability: 0,
        ratingSample: 0,
        ratingStats: {},
        ratingSourceUrls: [],
        ratingReasons: [
          "KBO 공식 2026 기록 표본을 찾지 못해 로스터 정보 기반 결정적 fallback을 사용했습니다.",
          "직접 출처가 없는 세부 능력치는 게임용 보수값이며 실제 스카우팅 등급을 주장하지 않습니다."
        ]
      }
    });
  }

  const roleAttributes = role === "pitcher"
    ? buildPitcherAttributes({ official, fallback, age, seedPlayer, teamIndex, index })
    : buildHitterAttributes({ official, fallback, age, seedPlayer, position, teamIndex, index });
  const core20 = weightedRating20(roleAttributes, position, role);
  const commonAttributes = buildCommonAttributes({ official, fallback, age, seedPlayer, core20, role, position });

  return finalizeProfile({
    role,
    position,
    age,
    fallback,
    roleAttributes,
    commonAttributes,
    source: {
      ratingSource: `kbo-official:${official.league}`,
      ratingLeague: official.league,
      ratingConfidence: confidenceFromReliability(official.reliability),
      sourceConfidence: sourceConfidenceFromReliability(official.reliability),
      ratingReliability: official.reliability,
      ratingSample: official.sample,
      ratingStats: official.stats,
      ratingSourceUrls: official.sourceUrls,
      ratingReasons: buildRatingReasons(official, role)
    }
  });
}

export function validateRatingWeights() {
  const issues = [];
  const knownAttributes = new Set([...COMMON_ATTRIBUTES, ...PITCHER_ATTRIBUTES, ...HITTER_ATTRIBUTES]);

  for (const [position, weights] of Object.entries(OVR_WEIGHTS)) {
    const sum = Object.values(weights).reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 0.055) {
      issues.push(`${position} raw weight sum ${sum.toFixed(3)}`);
    }
    for (const key of Object.keys(weights)) {
      if (!knownAttributes.has(key)) {
        issues.push(`${position} unknown weight key ${key}`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function buildHitterAttributes({ official, fallback, age, seedPlayer, position, teamIndex, index }) {
  const stats = official.stats;
  const reliability = official.reliability;
  const pa = plateAppearances(stats);
  const ab = safeNumber(stats.atBats);
  const hits = safeNumber(stats.hits);
  const doubles = safeNumber(stats.doubles);
  const triples = safeNumber(stats.triples);
  const homeRuns = safeNumber(stats.homeRuns);
  const walks = safeNumber(stats.walks);
  const hbp = safeNumber(stats.hitByPitch);
  const strikeouts = safeNumber(stats.strikeouts);
  const sb = safeNumber(stats.stolenBases);
  const cs = safeNumber(stats.caughtStealing);
  const sac = safeNumber(stats.sacrificeBunts);
  const sf = safeNumber(stats.sacrificeFlies);
  const rbi = safeNumber(stats.rbi);
  const runs = safeNumber(stats.runs);
  const errors = safeNumber(stats.errors);
  const totalBases = stats.totalBases ?? hits + doubles + triples * 2 + homeRuns * 3;
  const avg = ab > 0 ? hits / ab : safeNumber(stats.avg, null);
  const obpDenominator = ab + walks + hbp + sf;
  const obp = obpDenominator > 0 ? (hits + walks + hbp) / obpDenominator : safeNumber(stats.onBasePercentage, null);
  const slg = ab > 0 ? totalBases / ab : safeNumber(stats.slugging, null);
  const ops = Number.isFinite(obp) && Number.isFinite(slg) ? obp + slg : safeNumber(stats.ops, null);
  const iso = Number.isFinite(avg) && Number.isFinite(slg) ? Math.max(0, slg - avg) : null;
  const bbRate = pa > 0 ? (walks + hbp * 0.5) / pa : 0;
  const kRate = pa > 0 ? strikeouts / pa : 0;
  const hrRate = pa > 0 ? homeRuns / pa : 0;
  const xbhRate = ab > 0 ? (doubles + triples + homeRuns) / ab : 0;
  const sbAttempt = sb + cs;
  const sbRate = pa > 0 ? sb / pa : 0;
  const sbSuccess = sbAttempt > 0 ? sb / sbAttempt : null;
  const risp = safeNumber(stats.rispAverage, null);
  const defaults = positionDefaults(position);
  const batSide = normalizeHand(seedPlayer?.bats);
  const platoon = hitterPlatoonAdjust(batSide);
  const defenseReliability = Math.min(0.5, reliability * 0.5 + (pa >= 80 ? 0.08 : 0));

  const baseContact = shrinkRating(
    weightedAverage([
      [scaleToRating(avg, 0.18, 0.34), 0.45],
      [scaleToRating(1 - kRate, 0.62, 0.92), 0.28],
      [scaleToRating(ops, 0.52, 0.98), 0.17],
      [fallback.contact, 0.1]
    ]),
    10.2,
    reliability
  );
  const basePower = shrinkRating(
    weightedAverage([
      [scaleToRating(iso, 0.055, 0.29), 0.34],
      [scaleToRating(hrRate, 0.002, 0.07), 0.28],
      [scaleToRating(slg, 0.29, 0.59), 0.25],
      [scaleToRating(xbhRate, 0.055, 0.25), 0.13]
    ]),
    9.8,
    reliability
  );
  const eye = shrinkRating(
    weightedAverage([
      [scaleToRating(obp, 0.275, 0.445), 0.42],
      [scaleToRating(bbRate, 0.035, 0.165), 0.35],
      [scaleToRating(1 - kRate, 0.58, 0.91), 0.23]
    ]),
    10.1,
    reliability
  );
  const patience = shrinkRating(
    weightedAverage([
      [scaleToRating(bbRate, 0.035, 0.17), 0.46],
      [scaleToRating(1 - kRate, 0.58, 0.92), 0.34],
      [eye, 0.2]
    ]),
    10,
    reliability
  );
  const battedBall = shrinkRating(
    weightedAverage([
      [scaleToRating(xbhRate, 0.055, 0.245), 0.34],
      [scaleToRating(slg, 0.29, 0.59), 0.34],
      [scaleToRating(avg, 0.18, 0.33), 0.16],
      [basePower, 0.16]
    ]),
    10,
    reliability
  );
  const situational = shrinkRating(
    weightedAverage([
      [scaleToRating(risp, 0.19, 0.34), risp === null ? 0 : 0.38],
      [scaleToRating((rbi + runs) / Math.max(1, pa), 0.08, 0.32), 0.31],
      [scaleToRating(1 - kRate, 0.58, 0.91), 0.16],
      [baseContact, 0.15]
    ]),
    10.1,
    Math.min(0.78, reliability)
  );
  const bunting = shrinkRating(
    weightedAverage([
      [scaleToRating(sac / Math.max(1, pa), 0, 0.04), 0.6],
      [position === "C" ? 7.5 : position === "IF" ? 10 : 8.5, 0.4]
    ]),
    fallback.bunting,
    Math.min(0.55, reliability + (sac > 0 ? 0.15 : 0))
  );
  const speed = shrinkRating(
    weightedAverage([
      [scaleToRating(sbRate, 0, 0.075), 0.32],
      [scaleToRating(triples / Math.max(1, pa), 0, 0.025), 0.2],
      [defaults.speed, 0.28],
      [fallback.speed, 0.2]
    ]),
    defaults.speed,
    Math.min(0.72, reliability + (sbAttempt > 0 ? 0.12 : 0))
  );
  const stealing = shrinkRating(
    weightedAverage([
      [scaleToRating(sbRate, 0, 0.075), 0.38],
      [scaleToRating(sbSuccess, 0.48, 0.9), sbSuccess === null ? 0 : 0.32],
      [speed, 0.3]
    ]),
    fallback.stealing,
    Math.min(0.72, reliability + (sbAttempt > 0 ? 0.16 : 0))
  );
  const baserunning = shrinkRating(
    weightedAverage([
      [speed, 0.34],
      [stealing, 0.24],
      [scaleToRating((runs + sb) / Math.max(1, pa), 0.06, 0.28), 0.24],
      [scaleToRating(triples / Math.max(1, pa), 0, 0.025), 0.18]
    ]),
    fallback.baserunning,
    Math.min(0.68, reliability + 0.08)
  );
  const defense = shrinkRating(
    weightedAverage([
      [defaults.defense, 0.52],
      [fallback.defense, 0.28],
      [scaleToRating(1 - errors / Math.max(1, pa), 0.965, 1), 0.2]
    ]),
    defaults.defense,
    defenseReliability
  );
  const range = shrinkRating(
    weightedAverage([
      [defaults.range, 0.5],
      [speed, 0.24],
      [fallback.range, 0.26]
    ]),
    defaults.range,
    defenseReliability
  );
  const arm = shrinkRating(
    weightedAverage([
      [defaults.arm, 0.58],
      [fallback.arm, 0.42]
    ]),
    defaults.arm,
    Math.min(0.38, defenseReliability)
  );
  const catching = position === "C"
    ? shrinkRating(weightedAverage([[defaults.catching, 0.62], [fallback.catching, 0.38]]), defaults.catching, defenseReliability)
    : shrinkRating(weightedAverage([[defaults.catching, 0.7], [fallback.catching, 0.3]]), defaults.catching, Math.min(0.25, defenseReliability));

  return roundAttributes({
    contactL: baseContact + platoon.contactL,
    contactR: baseContact + platoon.contactR,
    powerL: basePower + platoon.powerL,
    powerR: basePower + platoon.powerR,
    eye,
    situational,
    battedBall,
    patience,
    bunting,
    vsLHP: baseContact * 0.58 + basePower * 0.28 + eye * 0.14 + platoon.vsLHP,
    vsRHP: baseContact * 0.58 + basePower * 0.28 + eye * 0.14 + platoon.vsRHP,
    defense,
    range,
    arm,
    catching,
    speed,
    stealing,
    baserunning
  });
}

function buildPitcherAttributes({ official, fallback, age, seedPlayer, teamIndex, index }) {
  const stats = official.stats;
  const reliability = official.reliability;
  const innings = safeNumber(stats.inningsPitched);
  const games = safeNumber(stats.games);
  const starts = safeNumber(stats.starts);
  const saves = safeNumber(stats.saves);
  const holds = safeNumber(stats.holds);
  const strikeouts = safeNumber(stats.strikeouts);
  const walks = safeNumber(stats.walks);
  const hitByPitch = safeNumber(stats.hitByPitch);
  const hits = safeNumber(stats.hits);
  const homeRuns = safeNumber(stats.homeRuns);
  const wildPitches = safeNumber(stats.wildPitches);
  const balks = safeNumber(stats.balks);
  const earnedRuns = safeNumber(stats.earnedRuns);
  const runs = safeNumber(stats.runs);
  const era = innings > 0 ? earnedRuns * 9 / innings : safeNumber(stats.era, null);
  const whip = innings > 0 ? (hits + walks) / innings : safeNumber(stats.whip, null);
  const oppAvg = safeNumber(stats.avg, null);
  const k9 = innings > 0 ? strikeouts * 9 / innings : 0;
  const bb9 = innings > 0 ? walks * 9 / innings : 9;
  const hbp9 = innings > 0 ? hitByPitch * 9 / innings : 0;
  const hr9 = innings > 0 ? homeRuns * 9 / innings : 2.1;
  const ipPerGame = games > 0 ? innings / games : 0;
  const leverageRate = games > 0 ? (saves + holds) / games : 0;
  const throws = normalizeHand(seedPlayer?.throws);
  const platoon = pitcherPlatoonAdjust(throws);
  const heightCm = parseHeight(seedPlayer?.body);
  const sizeVelocityHint = heightCm ? scaleToRating(heightCm, 175, 195) : fallback.velocity;
  const youthVelocityHint = age <= 25 ? 0.8 : age >= 34 ? -0.8 : 0;
  const experience = clamp(5.5 + Math.min(age - 18, 18) * 0.46 + Math.log1p(games + starts) * 0.65, 1, 20);

  const stuff = shrinkRating(
    weightedAverage([
      [scaleToRating(k9, 4.4, 10.8), 0.46],
      [scaleToRating(1 - oppAvg, 0.68, 0.82), 0.22],
      [scaleToRating(1 / Math.max(0.55, whip), 0.52, 1.08), 0.18],
      [scaleToRating(leverageRate, 0, 0.55), 0.14]
    ]),
    10.4,
    reliability
  );
  const control = shrinkRating(
    weightedAverage([
      [scaleToRating(1 / Math.max(0.7, bb9), 0.13, 0.55), 0.48],
      [scaleToRating(1 / Math.max(0.75, whip), 0.52, 1.08), 0.32],
      [scaleToRating(1 / Math.max(0.01, hbp9 + wildPitches * 0.18 + balks * 0.25), 1.7, 16), 0.2]
    ]),
    10,
    reliability
  );
  const velocity = shrinkRating(
    weightedAverage([
      [fallback.velocity + youthVelocityHint, 0.48],
      [sizeVelocityHint, 0.25],
      [stuff, 0.2],
      [starts > 0 ? 10.8 : 11.3, 0.07]
    ]),
    fallback.velocity,
    0.42
  );
  const stamina = shrinkRating(
    weightedAverage([
      [scaleToRating(ipPerGame, 0.75, 6.2), 0.46],
      [scaleToRating(starts, 0, 18), 0.26],
      [scaleToRating(safeNumber(stats.qualityStarts), 0, 12), 0.18],
      [fallback.stamina, 0.1]
    ]),
    fallback.stamina,
    Math.min(0.9, reliability + (starts > 0 ? 0.14 : 0))
  );
  const movement = shrinkRating(
    weightedAverage([
      [scaleToRating(1 / Math.max(0.22, hr9), 0.38, 3.5), 0.32],
      [scaleToRating(1 / Math.max(2.1, era), 0.11, 0.44), 0.28],
      [scaleToRating(1 - oppAvg, 0.67, 0.83), 0.25],
      [fallback.movement, 0.15]
    ]),
    10.1,
    reliability
  );
  const hrSuppression = shrinkRating(
    weightedAverage([
      [scaleToRating(1 / Math.max(0.22, hr9), 0.38, 3.6), 0.58],
      [movement, 0.24],
      [scaleToRating(1 / Math.max(2.1, era), 0.11, 0.44), 0.18]
    ]),
    10,
    reliability
  );
  const gbTendency = shrinkRating(
    weightedAverage([
      [fallback.gbTendency, 0.48],
      [movement, 0.26],
      [hrSuppression, 0.26]
    ]),
    fallback.gbTendency,
    0.32
  );
  const repertoire = shrinkRating(
    weightedAverage([
      [experience, 0.36],
      [stamina, 0.22],
      [control, 0.2],
      [fallback.repertoire, 0.22]
    ]),
    fallback.repertoire,
    Math.min(0.68, reliability + 0.12)
  );
  const pitchingIQ = shrinkRating(
    weightedAverage([
      [experience, 0.28],
      [control, 0.3],
      [movement, 0.18],
      [scaleToRating(1 / Math.max(2.1, era), 0.11, 0.44), 0.16],
      [fallback.pitchingIQ, 0.08]
    ]),
    fallback.pitchingIQ,
    Math.min(0.72, reliability + 0.12)
  );
  const holdRunners = shrinkRating(
    weightedAverage([
      [fallback.holdRunners, 0.5],
      [control, 0.2],
      [fieldingBaseline(seedPlayer, teamIndex, index), 0.3]
    ]),
    fallback.holdRunners,
    0.3
  );
  const fielding = shrinkRating(
    weightedAverage([
      [fieldingBaseline(seedPlayer, teamIndex, index), 0.58],
      [fallback.fielding, 0.42]
    ]),
    fallback.fielding,
    0.32
  );
  const runPrevention = weightedAverage([
    [scaleToRating(1 / Math.max(2.1, era), 0.11, 0.44), 0.38],
    [scaleToRating(1 / Math.max(0.75, whip), 0.52, 1.08), 0.28],
    [stuff, 0.18],
    [control, 0.16]
  ]);

  return roundAttributes({
    stuff,
    control,
    velocity,
    stamina,
    movement,
    hrSuppression,
    gbTendency,
    repertoire,
    pitchingIQ,
    holdRunners,
    fielding,
    vsLHB: runPrevention + platoon.vsLHB,
    vsRHB: runPrevention + platoon.vsRHB
  });
}

function buildCommonAttributes({ official, fallback, age, seedPlayer, core20, role }) {
  const reliability = official?.reliability ?? 0;
  const sample = official?.sample ?? 0;
  const activeBonus = seedPlayer?.status === "active" ? 0.7 : seedPlayer?.status === "futures" ? -0.4 : 0;
  const sampleRating = role === "pitcher"
    ? scaleToRating(sample, 5, 95)
    : scaleToRating(sample, 20, 360);
  const ageExperience = clamp(4.5 + Math.max(0, age - 18) * 0.48, 1, 20);
  const primeHealth = clamp(14 - Math.max(0, age - 29) * 0.65 + Math.max(0, 24 - age) * 0.16, 1, 20);
  const careerStability = weightedAverage([
    [core20, 0.4],
    [sampleRating, 0.35],
    [fallback.consistency, 0.25]
  ]);
  const reputation = shrinkRating(
    weightedAverage([
      [core20, 0.48],
      [sampleRating, 0.22],
      [ageExperience, 0.18],
      [fallback.reputation, 0.12]
    ]),
    fallback.reputation,
    Math.min(0.7, reliability + 0.18)
  );

  return roundAttributes({
    conditionStability: shrinkRating(careerStability + activeBonus, fallback.conditionStability, Math.min(0.58, reliability + 0.12)),
    injuryResistance: shrinkRating(weightedAverage([[primeHealth, 0.58], [fallback.injuryResistance, 0.42]]), fallback.injuryResistance, 0.34),
    durability: shrinkRating(weightedAverage([[sampleRating, 0.42], [primeHealth, 0.22], [fallback.durability, 0.36]]), fallback.durability, Math.min(0.58, reliability + 0.08)),
    recovery: shrinkRating(weightedAverage([[primeHealth, 0.45], [fallback.recovery, 0.55]]), fallback.recovery, 0.34),
    ageResilience: shrinkRating(weightedAverage([[primeHealth, 0.5], [ageExperience, 0.18], [fallback.ageResilience, 0.32]]), fallback.ageResilience, 0.38),
    mentalToughness: shrinkRating(weightedAverage([[careerStability, 0.42], [ageExperience, 0.24], [fallback.mentalToughness, 0.34]]), fallback.mentalToughness, Math.min(0.52, reliability + 0.08)),
    clutch: shrinkRating(weightedAverage([[core20, 0.34], [ageExperience, 0.24], [fallback.clutch, 0.42]]), fallback.clutch, Math.min(0.48, reliability + 0.08)),
    consistency: shrinkRating(careerStability, fallback.consistency, Math.min(0.62, reliability + 0.12)),
    workEthic: fallback.workEthic,
    leadership: shrinkRating(weightedAverage([[ageExperience, 0.52], [reputation, 0.2], [fallback.leadership, 0.28]]), fallback.leadership, 0.38),
    adaptability: shrinkRating(weightedAverage([[fallback.adaptability, 0.46], [ageExperience, 0.24], [core20, 0.3]]), fallback.adaptability, 0.36),
    teamwork: fallback.teamwork,
    leagueExperience: shrinkRating(weightedAverage([[ageExperience, 0.58], [sampleRating, 0.26], [fallback.leagueExperience, 0.16]]), fallback.leagueExperience, Math.min(0.72, reliability + 0.12)),
    bigGameExperience: shrinkRating(weightedAverage([[ageExperience, 0.36], [reputation, 0.24], [fallback.bigGameExperience, 0.4]]), fallback.bigGameExperience, 0.34),
    reputation,
    kboAdaptation: shrinkRating(weightedAverage([[ageExperience, 0.24], [sampleRating, 0.28], [fallback.kboAdaptation, 0.48]]), fallback.kboAdaptation, Math.min(0.62, reliability + 0.1))
  });
}

function finalizeProfile({ role, position, age, fallback, roleAttributes, commonAttributes, source }) {
  const attributes = { ...commonAttributes, ...roleAttributes };
  const ovr20 = weightedRating20(attributes, position, role);
  const ovr = displayOverallFrom20(ovr20);
  const attributePotential = buildAttributePotential(attributes, { age, role, status: fallback.status, reliability: source.ratingReliability });
  const pot20 = weightedRating20(attributePotential, position, role);
  const pot = clamp(Math.max(ovr, displayOverallFrom20(pot20)), ovr, 200);
  const aliases = buildCompatibilityAliases(role, roleAttributes);

  return {
    abilityScale: "internal-1-20/display-0-200",
    formulaVersion: RATINGS_FORMULA_VERSION,
    ...attributes,
    ...aliases,
    attributePotential,
    ovr,
    pot,
    currentAbility: ovr,
    potentialAbility: pot,
    dailyCondition: clamp(Math.round(46 + commonAttributes.conditionStability * 2 + source.ratingReliability * 8), 35, 92),
    morale: clamp(Math.round(47 + commonAttributes.mentalToughness * 1.7), 35, 90),
    sharpness: clamp(Math.round(42 + commonAttributes.consistency * 1.9 + source.ratingReliability * 8), 30, 92),
    armFreshness: role === "pitcher" ? clamp(Math.round(58 + roleAttributes.stamina * 1.7 + commonAttributes.recovery), 45, 96) : 100,
    ratingSource: source.ratingSource,
    ratingLeague: source.ratingLeague,
    ratingConfidence: source.ratingConfidence,
    sourceConfidence: source.sourceConfidence,
    ratingReliability: round(source.ratingReliability, 3),
    ratingSample: round(source.ratingSample, 1),
    ratingStats: source.ratingStats,
    ratingSourceUrls: source.ratingSourceUrls,
    ratingReasons: source.ratingReasons,
    ratingDetails: {
      formulaVersion: RATINGS_FORMULA_VERSION,
      role,
      position,
      scale: "OVR/POT 0-200, attributes 1-20",
      sampleSize: round(source.ratingSample, 1),
      sampleReliability: round(source.ratingReliability, 3),
      league: source.ratingLeague,
      sourceUrls: source.ratingSourceUrls,
      gameRatingNotice: "KBO 공식 기록과 로스터 정보로 만든 게임용 산정치이며 실제 스카우팅 등급을 주장하지 않습니다."
    }
  };
}

function buildCompatibilityAliases(role, attrs) {
  if (role === "pitcher") {
    return {
      contact: 3,
      power: 2,
      eye: 3,
      speed: 3,
      defense: attrs.fielding,
      stuff: attrs.stuff,
      control: attrs.control,
      stamina: attrs.stamina,
      movement: attrs.movement
    };
  }

  return {
    contact: Math.round((attrs.contactL + attrs.contactR) / 2),
    power: Math.round((attrs.powerL + attrs.powerR) / 2),
    eye: attrs.eye,
    speed: attrs.speed,
    defense: attrs.defense,
    stuff: 3,
    control: 3,
    stamina: 4,
    movement: 3
  };
}

function buildAttributePotential(attributes, context) {
  const result = {};
  for (const [key, value] of Object.entries(attributes)) {
    const category = ATTRIBUTE_CATEGORIES[key] ?? "technical";
    const room = potentialRoom(category, context.age, context.status, context.reliability, value);
    result[key] = clamp(Math.round(value + room), Math.round(value), 20);
  }
  return result;
}

function potentialRoom(category, age, status, reliability, value) {
  const youthBonus = status === "futures" ? 0.75 : 0.35;
  const uncertainty = clamp((1 - reliability) * 1.6, 0, 2.2);
  const ceilingRoom = Math.max(0, 20 - value) * 0.22;
  let ageRoom = 0;

  if (category === "physical") {
    ageRoom = age <= 22 ? 2.8 : age <= 25 ? 1.7 : age <= 27 ? 0.7 : age >= 33 ? -0.5 : 0.2;
  } else if (category === "technical") {
    ageRoom = age <= 23 ? 3.1 : age <= 26 ? 2.1 : age <= 29 ? 1.1 : age <= 32 ? 0.35 : 0;
  } else if (category === "mental") {
    ageRoom = age <= 24 ? 2.5 : age <= 28 ? 1.6 : age <= 32 ? 0.8 : 0.25;
  } else if (category === "experience") {
    ageRoom = age <= 24 ? 3 : age <= 29 ? 2.1 : age <= 34 ? 1.1 : 0.3;
  } else {
    ageRoom = 0;
  }

  return clamp(ageRoom + youthBonus + uncertainty + ceilingRoom, 0, 6);
}

function buildOfficialComposite(statsRecord, role) {
  if (!statsRecord?.stats) {
    return { usable: false, league: "none", sample: 0, reliability: 0, stats: {}, sourceUrls: [] };
  }

  const regular = normalizeLeague(statsRecord.stats.regular, role, REGULAR_WEIGHT);
  const futures = normalizeLeague(statsRecord.stats.futures, role, FUTURES_WEIGHT);
  const entries = [regular, futures].filter((entry) => entry.usable);
  if (entries.length === 0) {
    return { usable: false, league: "none", sample: 0, reliability: 0, stats: {}, sourceUrls: [] };
  }

  const stats = role === "pitcher" ? combinePitcherStats(entries) : combineHitterStats(entries);
  const sample = role === "pitcher" ? safeNumber(stats.inningsPitched) : plateAppearances(stats);
  const reliability = sampleReliability(sample, SAMPLE_TARGET[role]);
  const league = entries.length > 1 ? "regular+futures" : entries[0].key;

  return {
    usable: true,
    role,
    league,
    leagueLabel: league === "regular+futures" ? "KBO 정규+퓨처스" : entries[0].label,
    sample,
    reliability,
    stats,
    sourceUrls: unique(entries.map((entry) => entry.sourceUrl).filter(Boolean)),
    sourceEntries: entries.map((entry) => ({
      league: entry.key,
      sample: entry.sample,
      sourceUrl: entry.sourceUrl
    }))
  };
}

function normalizeLeague(entry, role, weight) {
  if (!entry?.available || !entry?.normalized) {
    return { usable: false };
  }

  const stats = entry.normalized;
  const sample = role === "pitcher" ? safeNumber(stats.inningsPitched) : plateAppearances(stats);
  if (sample <= 0) {
    return { usable: false };
  }

  return {
    usable: true,
    key: entry.league?.includes("퓨처스") ? "futures" : "regular",
    label: entry.league ?? "KBO 공식 기록",
    weight,
    sample,
    stats,
    sourceUrl: entry.sourceUrl ?? ""
  };
}

function combineHitterStats(entries) {
  const fields = [
    "games",
    "plateAppearances",
    "atBats",
    "runs",
    "hits",
    "doubles",
    "triples",
    "homeRuns",
    "totalBases",
    "rbi",
    "stolenBases",
    "caughtStealing",
    "sacrificeBunts",
    "sacrificeFlies",
    "walks",
    "hitByPitch",
    "strikeouts",
    "groundedDoublePlays",
    "errors",
    "multiHitGames"
  ];
  const combined = {};
  for (const field of fields) {
    combined[field] = weightedSum(entries, field);
  }
  const ab = safeNumber(combined.atBats);
  const hits = safeNumber(combined.hits);
  const walks = safeNumber(combined.walks);
  const hbp = safeNumber(combined.hitByPitch);
  const sf = safeNumber(combined.sacrificeFlies);
  const totalBases = combined.totalBases || hits + safeNumber(combined.doubles) + safeNumber(combined.triples) * 2 + safeNumber(combined.homeRuns) * 3;
  const obpDenominator = ab + walks + hbp + sf;

  combined.avg = ab > 0 ? hits / ab : weightedRate(entries, "avg");
  combined.slugging = ab > 0 ? totalBases / ab : weightedRate(entries, "slugging");
  combined.onBasePercentage = obpDenominator > 0 ? (hits + walks + hbp) / obpDenominator : weightedRate(entries, "onBasePercentage");
  combined.ops = safeNumber(combined.onBasePercentage) + safeNumber(combined.slugging);
  combined.rispAverage = weightedRate(entries, "rispAverage");
  combined.pinchHitAverage = weightedRate(entries, "pinchHitAverage");
  combined.stolenBasePercentage = safeNumber(combined.stolenBases) + safeNumber(combined.caughtStealing) > 0
    ? safeNumber(combined.stolenBases) / (safeNumber(combined.stolenBases) + safeNumber(combined.caughtStealing))
    : null;
  combined.sourceLeagues = entries.map((entry) => entry.key);
  return combined;
}

function combinePitcherStats(entries) {
  const fields = [
    "games",
    "wins",
    "losses",
    "saves",
    "holds",
    "completeGames",
    "shutouts",
    "battersFaced",
    "pitches",
    "inningsPitched",
    "hits",
    "doubles",
    "triples",
    "homeRuns",
    "sacrificeBunts",
    "sacrificeFlies",
    "walks",
    "hitByPitch",
    "strikeouts",
    "wildPitches",
    "balks",
    "runs",
    "earnedRuns",
    "blownSaves",
    "qualityStarts"
  ];
  const combined = {};
  for (const field of fields) {
    combined[field] = weightedSum(entries, field);
  }
  combined.starts = weightedSum(entries, "starts");
  const ip = safeNumber(combined.inningsPitched);
  combined.era = ip > 0 ? safeNumber(combined.earnedRuns) * 9 / ip : weightedRate(entries, "era");
  combined.whip = ip > 0 ? (safeNumber(combined.hits) + safeNumber(combined.walks)) / ip : weightedRate(entries, "whip");
  combined.avg = weightedRate(entries, "avg");
  combined.winningPercentage = weightedRate(entries, "winningPercentage");
  combined.sourceLeagues = entries.map((entry) => entry.key);
  return combined;
}

function buildFallbackProfile({ seedPlayer, teamSeed, teamIndex, index, role, position, age }) {
  const explicitOvr = Number(seedPlayer?.ovr);
  const ovr = Number.isFinite(explicitOvr) && explicitOvr > 100 ? explicitOvr : estimateFallbackOverall(teamSeed, teamIndex, seedPlayer, index, age, role, position);
  const ovr20 = clamp(ovr / 10, 1, 20);
  const noise = seededNoise(teamIndex + 1, index + 11, teamSeed?.baseOvr ?? 80);
  const defaults = positionDefaults(position);
  const status = seedPlayer?.status ?? "registered";
  const commonAttributes = roundAttributes({
    conditionStability: attrFromOverall(ovr20, noise, 0.2),
    injuryResistance: clamp(12 - Math.max(0, age - 30) * 0.35 + noise * 2, 1, 20),
    durability: clamp(10 + seededNoise(index, 17, teamIndex) * 5 - Math.max(0, age - 33) * 0.22, 1, 20),
    recovery: clamp(11 + seededNoise(index, 19, teamIndex) * 4 - Math.max(0, age - 31) * 0.25, 1, 20),
    ageResilience: clamp(13 - Math.max(0, age - 30) * 0.45 + seededNoise(index, 23, teamIndex) * 2, 1, 20),
    mentalToughness: attrFromOverall(ovr20, seededNoise(index, 29, teamIndex), 0.25),
    clutch: attrFromOverall(ovr20, seededNoise(index, 31, teamIndex), 0.35),
    consistency: attrFromOverall(ovr20, seededNoise(index, 37, teamIndex), 0.22),
    workEthic: clamp(9 + seededNoise(index, 41, teamIndex) * 7, 1, 20),
    leadership: clamp(5 + Math.max(0, age - 21) * 0.35 + seededNoise(index, 43, teamIndex) * 4, 1, 20),
    adaptability: clamp(8 + seededNoise(index, 47, teamIndex) * 7, 1, 20),
    teamwork: clamp(9 + seededNoise(index, 53, teamIndex) * 6, 1, 20),
    leagueExperience: clamp(4 + Math.max(0, age - 18) * 0.48, 1, 20),
    bigGameExperience: clamp(4 + Math.max(0, age - 22) * 0.35 + seededNoise(index, 59, teamIndex) * 3, 1, 20),
    reputation: attrFromOverall(ovr20, seededNoise(index, 61, teamIndex), 0.15),
    kboAdaptation: clamp(hasForeignNameHint(seedPlayer?.name) ? 9 + seededNoise(index, 67, teamIndex) * 5 : 12 + seededNoise(index, 67, teamIndex) * 4, 1, 20)
  });
  const roleAttributes = role === "pitcher"
    ? roundAttributes({
        stuff: attrFromOverall(ovr20, noise, 0.52),
        control: attrFromOverall(ovr20, 1 - noise, 0.48),
        velocity: clamp(9 + seededNoise(index, 71, teamIndex) * 7 + (age <= 24 ? 1 : age >= 34 ? -1 : 0), 1, 20),
        stamina: clamp(7 + seededNoise(index, 73, teamIndex) * 9, 1, 20),
        movement: attrFromOverall(ovr20, seededNoise(index, 79, teamIndex), 0.5),
        hrSuppression: attrFromOverall(ovr20, seededNoise(index, 83, teamIndex), 0.45),
        gbTendency: clamp(5 + seededNoise(index, 89, teamIndex) * 14, 1, 20),
        repertoire: clamp(6 + Math.max(0, age - 21) * 0.3 + seededNoise(index, 97, teamIndex) * 5, 1, 20),
        pitchingIQ: attrFromOverall(ovr20, seededNoise(index, 101, teamIndex), 0.35),
        holdRunners: clamp(7 + seededNoise(index, 103, teamIndex) * 8, 1, 20),
        fielding: fieldingBaseline(seedPlayer, teamIndex, index),
        vsLHB: attrFromOverall(ovr20, seededNoise(index, 107, teamIndex), 0.45),
        vsRHB: attrFromOverall(ovr20, seededNoise(index, 109, teamIndex), 0.45)
      })
    : roundAttributes({
        contactL: attrFromOverall(ovr20, noise, 0.46),
        contactR: attrFromOverall(ovr20, 1 - noise, 0.46),
        powerL: attrFromOverall(ovr20, seededNoise(index, 113, teamIndex), 0.5),
        powerR: attrFromOverall(ovr20, seededNoise(index, 127, teamIndex), 0.5),
        eye: attrFromOverall(ovr20, seededNoise(index, 131, teamIndex), 0.42),
        situational: attrFromOverall(ovr20, seededNoise(index, 137, teamIndex), 0.38),
        battedBall: attrFromOverall(ovr20, seededNoise(index, 139, teamIndex), 0.45),
        patience: attrFromOverall(ovr20, seededNoise(index, 149, teamIndex), 0.38),
        bunting: clamp(6 + seededNoise(index, 151, teamIndex) * 9, 1, 20),
        vsLHP: attrFromOverall(ovr20, seededNoise(index, 157, teamIndex), 0.45),
        vsRHP: attrFromOverall(ovr20, seededNoise(index, 163, teamIndex), 0.45),
        defense: defaults.defense,
        range: defaults.range,
        arm: defaults.arm,
        catching: defaults.catching,
        speed: defaults.speed,
        stealing: clamp(defaults.speed - 1 + seededNoise(index, 167, teamIndex) * 4, 1, 20),
        baserunning: clamp(defaults.speed + seededNoise(index, 173, teamIndex) * 3, 1, 20)
      });

  return {
    status,
    ovr,
    roleAttributes,
    commonAttributes,
    ...commonAttributes,
    ...roleAttributes,
    contact: role === "hitter" ? Math.round((roleAttributes.contactL + roleAttributes.contactR) / 2) : 3,
    power: role === "hitter" ? Math.round((roleAttributes.powerL + roleAttributes.powerR) / 2) : 2,
    eye: role === "hitter" ? roleAttributes.eye : 3,
    speed: role === "hitter" ? roleAttributes.speed : 3,
    defense: role === "hitter" ? roleAttributes.defense : roleAttributes.fielding,
    stuff: role === "pitcher" ? roleAttributes.stuff : 3,
    control: role === "pitcher" ? roleAttributes.control : 3,
    stamina: role === "pitcher" ? roleAttributes.stamina : 4,
    movement: role === "pitcher" ? roleAttributes.movement : 3
  };
}

function estimateFallbackOverall(teamSeed, teamIndex, player, index, age, role, position) {
  const base = 103 + ((teamSeed?.baseOvr ?? 80) - 80) * 0.9;
  const statusPenalty = player?.status === "futures" ? -16 : player?.status === "candidate" ? -22 : 0;
  const prime = role === "pitcher" ? 28 : 27;
  const primeBonus = Math.max(0, 7 - Math.abs(age - prime)) * 1.2;
  const positionBonus = ["C", "P"].includes(position) ? 2 : 0;
  const spread = seededNoise(index + 3, teamIndex + 7, teamSeed?.baseOvr ?? 80) * 34;
  return clamp(Math.round(base + statusPenalty + primeBonus + positionBonus + spread), 48, 154);
}

function buildRatingReasons(official, role) {
  if (role === "pitcher") {
    const s = official.stats;
    const ip = safeNumber(s.inningsPitched);
    const k9 = ip > 0 ? safeNumber(s.strikeouts) * 9 / ip : 0;
    const bb9 = ip > 0 ? safeNumber(s.walks) * 9 / ip : 0;
    return [
      `${official.leagueLabel} 공식 2026 상세기록 기반: IP ${formatInnings(ip)}, ERA ${formatStat(s.era)}, WHIP ${formatStat(s.whip)}, K/9 ${formatStat(k9)}, BB/9 ${formatStat(bb9)}.`,
      "구속, 주자견제, 땅볼 성향, 멘탈/리더십은 KBO 기본기록에 직접 항목이 없어 로스터 정보와 공식 성적 기반 fallback을 낮은 비중으로 섞었습니다.",
      `표본 신뢰도 ${Math.round(official.reliability * 100)}%.`
    ];
  }

  const s = official.stats;
  return [
    `${official.leagueLabel} 공식 2026 상세기록 기반: PA ${Math.round(plateAppearances(s))}, AVG ${formatStat(s.avg)}, OBP ${formatStat(s.onBasePercentage)}, SLG ${formatStat(s.slugging)}, OPS ${formatStat(s.ops)}.`,
    "좌우 상대 split, 상세 수비범위, 송구, 포수 리드/블로킹은 KBO 기본기록에 직접 항목이 없어 타격/주루 공식기록과 포지션 fallback을 낮은 비중으로 섞었습니다.",
    `표본 신뢰도 ${Math.round(official.reliability * 100)}%.`
  ];
}

function weightedRating20(attributes, position, role) {
  const weights = weightsFor(position, role);
  const entries = Object.entries(weights).map(([key, weight]) => [attributes[key], weight]);
  return weightedAverage(entries);
}

function displayOverallFrom20(value) {
  return clamp(Math.round(value * 11 + 10), 20, 200);
}

function weightsFor(position, role) {
  if (role === "pitcher") return OVR_WEIGHTS.P;
  const normalized = normalizePosition(position, role);
  if (normalized === "C") return OVR_WEIGHTS.C;
  if (["IF", "1B", "2B", "3B", "SS"].includes(normalized)) return OVR_WEIGHTS.IF;
  if (["OF", "LF", "CF", "RF"].includes(normalized)) return OVR_WEIGHTS.OF;
  if (normalized === "DH") return OVR_WEIGHTS.DH;
  return OVR_WEIGHTS.UT;
}

function sampleReliability(sample, target) {
  if (!Number.isFinite(sample) || sample <= 0) return 0;
  return clamp(sample / (sample + target), 0.08, 0.93);
}

function confidenceFromReliability(reliability) {
  if (reliability >= 0.68) return "high";
  if (reliability >= 0.38) return "medium";
  return "low";
}

function sourceConfidenceFromReliability(reliability) {
  if (reliability >= 0.45) return "high";
  if (reliability >= 0.18) return "medium";
  return "low";
}

function fallbackSourceConfidence(seedPlayer) {
  if (seedPlayer?.source && seedPlayer?.playerId) return "medium";
  if (seedPlayer?.source) return "low";
  return "low";
}

function shrinkRating(value, baseline, reliability) {
  if (!Number.isFinite(value)) return clamp(baseline, 1, 20);
  return clamp(value * reliability + baseline * (1 - reliability), 1, 20);
}

function scaleToRating(value, low, high) {
  if (!Number.isFinite(value)) return null;
  const ratio = (value - low) / (high - low);
  return clamp(1 + ratio * 19, 1, 20);
}

function weightedAverage(entries) {
  const valid = entries.filter(([value, weight]) => Number.isFinite(value) && Number.isFinite(weight) && weight > 0);
  const weightTotal = valid.reduce((total, [, weight]) => total + weight, 0);
  if (weightTotal <= 0) return 0;
  return valid.reduce((total, [value, weight]) => total + value * weight, 0) / weightTotal;
}

function weightedSum(entries, field) {
  return round(entries.reduce((total, entry) => total + safeNumber(entry.stats[field]) * entry.weight, 0), 3);
}

function weightedRate(entries, field) {
  const valid = entries.filter((entry) => Number.isFinite(Number(entry.stats[field])));
  if (valid.length === 0) return null;
  return weightedAverage(valid.map((entry) => [Number(entry.stats[field]), entry.sample * entry.weight]));
}

function plateAppearances(stats) {
  const pa = safeNumber(stats?.plateAppearances, 0);
  if (pa > 0) return pa;
  return safeNumber(stats?.atBats) + safeNumber(stats?.walks) + safeNumber(stats?.hitByPitch) + safeNumber(stats?.sacrificeFlies) + safeNumber(stats?.sacrificeBunts);
}

function positionDefaults(position) {
  const normalized = normalizePosition(position, "hitter");
  if (normalized === "C") return POSITION_DEFAULTS.C;
  if (["IF", "1B", "2B", "3B", "SS"].includes(normalized)) return POSITION_DEFAULTS.IF;
  if (["OF", "LF", "CF", "RF"].includes(normalized)) return POSITION_DEFAULTS.OF;
  if (normalized === "DH") return POSITION_DEFAULTS.DH;
  return POSITION_DEFAULTS.UT;
}

function hitterPlatoonAdjust(bats) {
  if (bats === "L") return { contactL: -0.8, contactR: 0.55, powerL: -0.5, powerR: 0.4, vsLHP: -0.55, vsRHP: 0.45 };
  if (bats === "S") return { contactL: 0.25, contactR: 0.25, powerL: 0.05, powerR: 0.05, vsLHP: 0.2, vsRHP: 0.2 };
  return { contactL: 0.45, contactR: -0.1, powerL: 0.35, powerR: -0.05, vsLHP: 0.35, vsRHP: -0.05 };
}

function pitcherPlatoonAdjust(throws) {
  if (throws === "L") return { vsLHB: 0.55, vsRHB: -0.35 };
  return { vsLHB: -0.2, vsRHB: 0.35 };
}

function fieldingBaseline(seedPlayer, teamIndex, index) {
  const handText = String(seedPlayer?.handedness ?? "");
  const sideArmPenalty = handText.includes("언") ? -0.4 : 0;
  return clamp(8.5 + seededNoise(index, 181, teamIndex) * 5 + sideArmPenalty, 1, 20);
}

function attrFromOverall(ovr20, noise, spread) {
  return clamp(ovr20 * 0.72 + 2.8 + (noise - 0.5) * spread * 8, 1, 20);
}

function parseHeight(body) {
  const match = String(body ?? "").match(/(\d{3})\s*cm/i);
  return match ? Number(match[1]) : null;
}

function hasForeignNameHint(name) {
  const text = String(name ?? "");
  return text.length > 0 && text.length <= 4 && /[가-힣]/.test(text) && !/^[김이박최정강조윤장임한오서신권황안송전홍유고문양손배조백허남심노하곽성차주우구민류나진지엄원채천방공현함변염여추도소석선설마길위연명기반왕금옥육인맹제모탁국어은편용예경봉사부가복태목형계피두동탁]/.test(text);
}

function normalizePosition(value, role) {
  const position = String(value ?? "").trim().toUpperCase();
  if (!position || position === "투수") return role === "pitcher" ? "P" : "UT";
  if (position === "포수") return "C";
  if (position === "내야수") return "IF";
  if (position === "외야수") return "OF";
  return position;
}

function normalizeHand(value) {
  const hand = String(value ?? "").trim().toUpperCase();
  return ["L", "R", "S"].includes(hand) ? hand : "R";
}

function roundAttributes(attributes) {
  return Object.fromEntries(Object.entries(attributes).map(([key, value]) => [key, clamp(Math.round(value), 1, 20)]));
}

function seededNoise(a, b, c) {
  const value = Math.sin(a * 92821 + b * 68917 + c * 31337) * 10000;
  return value - Math.floor(value);
}

function formatStat(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "") : "-";
}

function formatInnings(value) {
  if (!Number.isFinite(value)) return "-";
  const whole = Math.floor(value);
  const outs = Math.round((value - whole) * 3);
  return outs > 0 ? `${whole} ${outs}/3` : String(whole);
}

function unique(values) {
  return [...new Set(values)];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(safeNumber(value) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
