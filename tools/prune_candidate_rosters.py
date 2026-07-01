from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROSTER_DIR = ROOT / "src" / "rosters"
TEAM_ORDER = ["lg", "doosan", "kia", "samsung", "lotte", "hanwha", "ssg", "kt", "nc", "kiwoom"]


def main() -> int:
    summary = {}

    for team_id in TEAM_ORDER:
        roster_path = ROSTER_DIR / f"{team_id}.js"
        roster = read_roster(roster_path)
        playable = [player for player in roster if player.get("status") != "candidate"]
        roster_path.write_text(
            "export default " + json.dumps(playable, ensure_ascii=False, indent=2) + ";\n",
            encoding="utf-8",
        )
        summary[team_id] = {
            "before": len(roster),
            "removedCandidates": len(roster) - len(playable),
            "after": len(playable),
        }

    print(json.dumps(summary, ensure_ascii=False, indent=2))
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


if __name__ == "__main__":
    raise SystemExit(main())
