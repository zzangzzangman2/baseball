const SAVE_FORMAT = "kbo-gm-manager-save";
const SAVE_VERSION = 1;
const DEFAULT_SAVE_DATE = "2026-03-01";

export function exportGameState(state) {
  const validatedState = validateGameState(state);
  return JSON.stringify(
    {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      state: validatedState
    },
    null,
    2
  );
}

export function importGameState(jsonText) {
  if (typeof jsonText !== "string") {
    throw new TypeError("저장 파일 내용은 JSON 문자열이어야 합니다.");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new SyntaxError(`저장 파일 JSON을 파싱할 수 없습니다: ${error.message}`);
  }

  return validateGameState(readSavePayload(parsed));
}

export function makeSaveFileName(state) {
  const datePart = cleanFilePart(state?.currentDate ?? DEFAULT_SAVE_DATE, DEFAULT_SAVE_DATE);
  const teamPart = cleanFilePart(state?.selectedTeamId ?? "all-teams", "all-teams");
  const dayPart = Number.isFinite(Number(state?.day)) ? Math.max(1, Math.floor(Number(state.day))) : 1;
  return `kbo-gm-${datePart}-day${dayPart}-${teamPart}.json`;
}

export function validateGameState(candidate) {
  assertPlainObject(candidate, "저장 데이터");

  if (!Array.isArray(candidate.teams)) {
    throw new TypeError("저장 데이터의 teams 필드는 팀 배열이어야 합니다.");
  }

  if (candidate.teams.length === 0) {
    throw new TypeError("저장 데이터에는 최소 1개 이상의 팀이 필요합니다.");
  }

  const cloned = cloneJson(candidate, "저장 데이터");

  cloned.teams.forEach((team, teamIndex) => {
    validateTeam(team, teamIndex);
  });

  if (cloned.selectedTeamId != null) {
    const selectedTeamId = String(cloned.selectedTeamId);
    const hasSelectedTeam = cloned.teams.some((team) => String(team.id) === selectedTeamId);
    if (!hasSelectedTeam) {
      throw new TypeError(`selectedTeamId "${selectedTeamId}"와 일치하는 팀을 찾을 수 없습니다.`);
    }
  }

  return cloned;
}

function readSavePayload(parsed) {
  assertPlainObject(parsed, "저장 파일");

  if (parsed.format == null && parsed.version == null && parsed.state == null) {
    return parsed;
  }

  if (parsed.format !== SAVE_FORMAT) {
    throw new TypeError(`지원하지 않는 저장 파일 형식입니다: ${String(parsed.format ?? "없음")}`);
  }

  if (parsed.version !== SAVE_VERSION) {
    throw new TypeError(`지원하지 않는 저장 파일 버전입니다: ${String(parsed.version ?? "없음")}`);
  }

  if (!Object.hasOwn(parsed, "state")) {
    throw new TypeError("저장 파일에 state 필드가 없습니다.");
  }

  return parsed.state;
}

function validateTeam(team, teamIndex) {
  const teamLabel = `teams[${teamIndex}]`;
  assertPlainObject(team, teamLabel);

  if (!hasText(team.id)) {
    throw new TypeError(`${teamLabel}.id는 비어 있지 않은 문자열이어야 합니다.`);
  }

  if (!hasText(team.name) && !hasText(team.shortName)) {
    throw new TypeError(`${teamLabel}에는 name 또는 shortName이 필요합니다.`);
  }

  if (!Array.isArray(team.roster)) {
    throw new TypeError(`${teamLabel}.roster 필드는 선수 배열이어야 합니다.`);
  }

  team.roster.forEach((player, playerIndex) => {
    validatePlayer(player, `${teamLabel}.roster[${playerIndex}]`, team.id);
  });
}

function validatePlayer(player, playerLabel, teamId) {
  assertPlainObject(player, playerLabel);

  if (!hasText(player.id)) {
    throw new TypeError(`${playerLabel}.id는 비어 있지 않은 문자열이어야 합니다.`);
  }

  if (!hasText(player.name)) {
    throw new TypeError(`${playerLabel}.name은 비어 있지 않은 문자열이어야 합니다.`);
  }

  if (!["hitter", "pitcher"].includes(player.role)) {
    throw new TypeError(`${playerLabel}.role은 "hitter" 또는 "pitcher"여야 합니다.`);
  }

  if (!hasText(player.position)) {
    throw new TypeError(`${playerLabel}.position은 비어 있지 않은 문자열이어야 합니다.`);
  }

  if (player.teamId != null && String(player.teamId) !== String(teamId)) {
    throw new TypeError(`${playerLabel}.teamId가 소속 팀 id와 일치하지 않습니다.`);
  }
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label}는 객체여야 합니다.`);
  }
}

function cloneJson(value, label) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new TypeError(`${label}는 JSON으로 직렬화할 수 있어야 합니다: ${error.message}`);
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanFilePart(value, fallback) {
  const cleaned = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || fallback;
}
