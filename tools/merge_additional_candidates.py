from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROSTER_DIR = ROOT / "src" / "rosters"
CANDIDATE_PATH = ROOT / "src" / "rosters_candidates" / "kbo-additional-candidates.json"
TEAM_ORDER = ["lg", "doosan", "kia", "samsung", "lotte", "hanwha", "ssg", "kt", "nc", "kiwoom"]


def main() -> int:
    payload = json.loads(CANDIDATE_PATH.read_text(encoding="utf-8"))
    candidates = payload.get("players", [])
    by_team: dict[str, list[dict]] = {team_id: [] for team_id in TEAM_ORDER}
    excluded = []

    for player in candidates:
        if not is_mergeable(player):
            excluded.append(
                {
                    "name": player.get("name", ""),
                    "teamId": player.get("teamId", ""),
                    "candidateType": player.get("candidateType", ""),
                    "reason": "retired-or-review-only",
                }
            )
            continue

        team_id = player.get("teamId")
        if team_id not in by_team:
            excluded.append(
                {
                    "name": player.get("name", ""),
                    "teamId": team_id,
                    "candidateType": player.get("candidateType", ""),
                    "reason": "unknown-team",
                }
            )
            continue

        by_team[team_id].append(normalize_candidate(player))

    summary = {}
    for team_id in TEAM_ORDER:
        roster_path = ROSTER_DIR / f"{team_id}.js"
        roster = read_roster(roster_path)
        merged = merge_roster(roster, by_team[team_id])
        roster_path.write_text(
            "export default " + json.dumps(merged, ensure_ascii=False, indent=2) + ";\n",
            encoding="utf-8",
        )
        summary[team_id] = {
            "base": len(roster),
            "added": len(merged) - len(roster),
            "total": len(merged),
        }

    print(json.dumps({"summary": summary, "excluded": excluded}, ensure_ascii=False, indent=2))
    return 0


def read_roster(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"\s*export\s+default\s+(.+);\s*\Z", text, flags=re.DOTALL)
    if not match:
        raise ValueError(f"cannot parse roster module: {path}")
    data = json.loads(match.group(1))
    if not isinstance(data, list):
        raise ValueError(f"roster module is not an array: {path}")
    return data


def merge_roster(roster: list[dict], candidates: list[dict]) -> list[dict]:
    seen_player_ids = {str(player.get("playerId")) for player in roster if player.get("playerId")}
    seen_identity = {
        (str(player.get("name", "")), str(player.get("birthday", "")))
        for player in roster
        if player.get("name") and player.get("birthday")
    }
    merged = list(roster)

    for player in candidates:
        player_id = str(player.get("playerId", ""))
        identity = (str(player.get("name", "")), str(player.get("birthday", "")))
        if player_id in seen_player_ids or identity in seen_identity:
            continue
        merged.append(player)
        if player_id:
            seen_player_ids.add(player_id)
        seen_identity.add(identity)

    return sorted(merged, key=sort_key)


def is_mergeable(player: dict) -> bool:
    if player.get("candidateType") != "kbo-current-team-paged":
        return False

    source_urls = [str(url) for url in player.get("sourceUrls", [])]
    if any("/Record/Retire/" in url for url in source_urls):
        return False

    required = ["teamId", "name", "role", "position", "playerId", "birthday"]
    return all(str(player.get(field, "")).strip() for field in required)


def normalize_candidate(player: dict) -> dict:
    return {
        "name": player["name"],
        "role": player["role"],
        "position": player["position"],
        "bats": player.get("bats", ""),
        "throws": player.get("throws", ""),
        "age": player["age"],
        "jerseyNumber": normalize_jersey(player.get("jerseyNumber", "")),
        "status": "candidate",
        "source": player.get("source", "KBO 선수조회 팀+포지션 페이징"),
        "candidateType": player.get("candidateType", ""),
        "playerId": player["playerId"],
        "birthday": player["birthday"],
        "body": player.get("body", ""),
        "handedness": player.get("handedness", ""),
        "school": player.get("school", ""),
        "sourceUrls": player.get("sourceUrls", []),
        "sourceQueries": player.get("sourceQueries", []),
    }


def normalize_jersey(value: object) -> str:
    jersey = str(value or "").strip()
    return "" if jersey == "#" else jersey


def sort_key(player: dict):
    status_rank = {"active": 0, "futures": 1, "candidate": 2}.get(player.get("status"), 3)
    role_rank = {"pitcher": 0, "hitter": 1}.get(player.get("role"), 2)
    position_rank = {"P": 0, "C": 1, "IF": 2, "OF": 3}.get(player.get("position"), 4)
    return (
        status_rank,
        role_rank,
        position_rank,
        str(player.get("name", "")),
        str(player.get("playerId", "")),
    )


if __name__ == "__main__":
    raise SystemExit(main())
