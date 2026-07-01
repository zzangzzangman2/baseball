from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import html
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path


BASE_URL = "https://www.koreabaseball.com"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

TEAM_NAMES = {
    "lg": "LG 트윈스",
    "doosan": "두산 베어스",
    "kia": "KIA 타이거즈",
    "samsung": "삼성 라이온즈",
    "lotte": "롯데 자이언츠",
    "hanwha": "한화 이글스",
    "ssg": "SSG 랜더스",
    "kt": "KT 위즈",
    "nc": "NC 다이노스",
    "kiwoom": "키움 히어로즈",
}

STAT_KEY_MAP = {
    "팀명": "team",
    "AVG": "avg",
    "ERA": "era",
    "G": "games",
    "PA": "plateAppearances",
    "AB": "atBats",
    "R": "runs",
    "H": "hits",
    "2B": "doubles",
    "3B": "triples",
    "HR": "homeRuns",
    "TB": "totalBases",
    "RBI": "rbi",
    "SB": "stolenBases",
    "CS": "caughtStealing",
    "SAC": "sacrificeBunts",
    "SF": "sacrificeFlies",
    "BB": "walks",
    "IBB": "intentionalWalks",
    "HBP": "hitByPitch",
    "SO": "strikeouts",
    "GDP": "groundedDoublePlays",
    "SLG": "slugging",
    "OBP": "onBasePercentage",
    "E": "errors",
    "SB%": "stolenBasePercentage",
    "MH": "multiHitGames",
    "OPS": "ops",
    "RISP": "rispAverage",
    "PH-BA": "pinchHitAverage",
    "W": "wins",
    "L": "losses",
    "SV": "saves",
    "HLD": "holds",
    "WPCT": "winningPercentage",
    "CG": "completeGames",
    "SHO": "shutouts",
    "TBF": "battersFaced",
    "NP": "pitches",
    "IP": "inningsPitched",
    "ER": "earnedRuns",
    "BSV": "blownSaves",
    "WHIP": "whip",
    "QS": "qualityStarts",
    "WP": "wildPitches",
    "BK": "balks",
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collect official KBO season stats for the current local roster."
    )
    parser.add_argument("--season", default="2026")
    parser.add_argument("--roster-dir", default="src/rosters")
    parser.add_argument("--output-dir", default="src/ratings_sources")
    parser.add_argument("--output-file", default=None)
    parser.add_argument("--sample-output-file", default=None)
    parser.add_argument("--sample-size", type=int, default=24)
    parser.add_argument("--limit", type=int, default=0, help="Limit players for smoke tests. 0 means all players.")
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--skip-futures", action="store_true")
    parser.add_argument("--no-sample", action="store_true")
    args = parser.parse_args()

    season = str(args.season)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = args.output_file or f"kbo-stats-{season}.json"
    sample_output_file = args.sample_output_file or f"kbo-stats-{season}-sample.json"

    roster = load_rosters(Path(args.roster_dir))
    if args.limit:
        roster = roster[: args.limit]

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = [
            executor.submit(collect_player_stats, player, season, args.timeout, args.skip_futures)
            for player in roster
        ]
        players = [future.result() for future in concurrent.futures.as_completed(futures)]

    players.sort(key=lambda player: (team_sort_key(player["teamId"]), player["role"], player["name"], player["playerId"]))
    summary = summarize(players)
    payload = {
        "metadata": {
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "season": season,
            "source": "KBO 공식 정규시즌/퓨처스 선수 상세 기본기록",
            "sourceUrlPatterns": {
                "regularHitter": f"{BASE_URL}/Record/Player/HitterDetail/Basic.aspx?playerId={{playerId}}",
                "regularPitcher": f"{BASE_URL}/Record/Player/PitcherDetail/Basic.aspx?playerId={{playerId}}",
                "futuresHitter": f"{BASE_URL}/Futures/Player/HitterDetail.aspx?playerId={{playerId}}",
                "futuresPitcher": f"{BASE_URL}/Futures/Player/PitcherDetail.aspx?playerId={{playerId}}",
            },
            "rosterCount": len(roster),
            "elapsedSeconds": round(time.perf_counter() - started, 2),
            "summary": summary,
            "notes": [
                "선수명, playerId, role, teamId/teamName은 로컬 current roster에서 읽고 기록값은 KBO 공식 상세 페이지 표에서만 가져옵니다.",
                "정규시즌과 퓨처스 기록을 모두 시도하며, 둘 다 없으면 stats는 빈 객체로 남기고 reason을 기록합니다.",
                "official 필드는 KBO 표의 표시값을 보존하고, normalized 필드는 산정 로직에서 쓰기 쉬운 키/숫자로 변환한 값입니다.",
            ],
        },
        "players": players,
    }

    out_path = output_dir / output_file
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    sample_path = None
    if not args.no_sample:
        sample_payload = {
            "metadata": {
                **payload["metadata"],
                "sampleOf": str(out_path),
                "sampleSize": min(args.sample_size, len(players)),
            },
            "players": choose_sample(players, args.sample_size),
        }
        sample_path = output_dir / sample_output_file
        sample_path.write_text(json.dumps(sample_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "output": str(out_path),
                "sampleOutput": str(sample_path) if sample_path else None,
                "rosterCount": len(roster),
                **summary,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def load_rosters(roster_dir: Path) -> list[dict]:
    players: list[dict] = []
    for path in sorted(roster_dir.glob("*.js")):
        if path.name == "index.js":
            continue
        team_id = path.stem
        content = path.read_text(encoding="utf-8")
        match = re.search(r"export\s+default\s+(\[.*\])\s*;\s*$", content, flags=re.DOTALL)
        if not match:
            raise ValueError(f"Cannot parse roster module: {path}")
        team_players = json.loads(match.group(1))
        for player in team_players:
            if not player.get("name"):
                continue
            if player.get("status") == "candidate":
                continue
            players.append(
                {
                    "playerId": str(player.get("playerId") or ""),
                    "name": player.get("name") or "",
                    "teamId": team_id,
                    "teamName": TEAM_NAMES.get(team_id, team_id),
                    "role": "pitcher" if player.get("role") == "pitcher" else "hitter",
                    "position": player.get("position") or "",
                    "status": player.get("status") or "",
                }
            )
    return players


def collect_player_stats(player: dict, season: str, timeout: int, skip_futures: bool) -> dict:
    player_id = player["playerId"]
    source_urls = build_source_urls(player_id, player["role"])
    result = {
        "playerId": player_id,
        "name": player["name"],
        "teamId": player["teamId"],
        "teamName": player["teamName"],
        "role": player["role"],
        "position": player["position"],
        "season": season,
        "sourceUrls": source_urls,
        "stats": {},
    }

    if not player_id:
        result["reason"] = "current roster에 KBO playerId가 없어 공식 기록 페이지와 조인할 수 없습니다."
        return result

    regular = fetch_and_parse(source_urls["regular"], player["role"], "regular", season, timeout)
    if regular.get("available"):
        result["stats"]["regular"] = regular
    elif regular.get("error"):
        result.setdefault("errors", []).append({"source": "regular", **regular["error"]})

    if not skip_futures:
        futures = fetch_and_parse(source_urls["futures"], player["role"], "futures", season, timeout)
        if futures.get("available"):
            result["stats"]["futures"] = futures
        elif futures.get("error"):
            result.setdefault("errors", []).append({"source": "futures", **futures["error"]})

    if not result["stats"]:
        if result.get("errors"):
            result["reason"] = "KBO 공식 상세 페이지 요청 또는 파싱 중 오류가 있어 기록을 확인하지 못했습니다."
        else:
            result["reason"] = "KBO 정규시즌/퓨처스 상세 기본기록에 해당 시즌 기록이 없습니다."
    return result


def build_source_urls(player_id: str, role: str) -> dict[str, str]:
    if role == "pitcher":
        return {
            "regular": f"{BASE_URL}/Record/Player/PitcherDetail/Basic.aspx?playerId={player_id}",
            "futures": f"{BASE_URL}/Futures/Player/PitcherDetail.aspx?playerId={player_id}",
        }
    return {
        "regular": f"{BASE_URL}/Record/Player/HitterDetail/Basic.aspx?playerId={player_id}",
        "futures": f"{BASE_URL}/Futures/Player/HitterDetail.aspx?playerId={player_id}",
    }


def fetch_and_parse(url: str, role: str, league: str, season: str, timeout: int) -> dict:
    try:
        page_html = request_html(url, timeout)
    except Exception as exc:  # noqa: BLE001 - preserve exact network failure for the report.
        return {
            "available": False,
            "error": {
                "url": url,
                "message": str(exc),
                "type": exc.__class__.__name__,
            },
        }

    parsed = parse_season_stats(page_html, role, league, season, url)
    if not parsed.get("available") and "기록이 없습니다" not in page_html:
        parsed["reason"] = parsed.get("reason") or "season stat table not found"
    return parsed


def request_html(url: str, timeout: int) -> str:
    context = ssl.create_default_context()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(CookieJar()),
        urllib.request.HTTPSHandler(context=context),
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": BASE_URL + "/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.4",
        },
    )
    with opener.open(request, timeout=timeout) as response:
        raw = response.read()
    return raw.decode("utf-8", errors="replace")


def parse_season_stats(page_html: str, role: str, league: str, season: str, url: str) -> dict:
    segment = extract_season_segment(page_html, league, season)
    if not segment:
        return {
            "available": False,
            "season": season,
            "sourceUrl": url,
            "reason": f"{season} season block not found",
        }

    raw_tables = [table for table in parse_tables(segment) if table["headers"]]
    stat_tables = [table for table in raw_tables if table_has_stat_row(table)]
    if not stat_tables:
        return {
            "available": False,
            "season": season,
            "sourceUrl": url,
            "reason": "record table says no stats",
        }

    primary = build_primary_stats(stat_tables)
    return {
        "available": True,
        "league": "KBO 정규시즌" if league == "regular" else "KBO 퓨처스리그",
        "season": season,
        "role": role,
        "sourceUrl": url,
        "official": primary,
        "normalized": normalize_stats(primary),
        "tables": stat_tables,
    }


def extract_season_segment(page_html: str, league: str, season: str) -> str:
    if league == "futures":
        heading_pattern = rf"<h6[^>]*>\s*{re.escape(season)}\s*시즌\s*퓨처스\s*성적\s*</h6>"
        end_pattern = rf"<h6[^>]*>\s*{re.escape(season)}\s*최근\s*10경기\s*</h6>"
    else:
        heading_pattern = rf"<h6[^>]*>\s*{re.escape(season)}\s*성적\s*</h6>"
        end_pattern = r"<h6[^>]*>\s*최근\s*10경기\s*</h6>"

    heading = re.search(heading_pattern, page_html, flags=re.IGNORECASE)
    if not heading:
        return ""
    end = re.search(end_pattern, page_html[heading.end() :], flags=re.IGNORECASE)
    end_index = heading.end() + end.start() if end else len(page_html)
    return page_html[heading.end() : end_index]


def parse_tables(segment_html: str) -> list[dict]:
    tables: list[dict] = []
    for table_match in re.finditer(r"<table\b[^>]*>(.*?)</table>", segment_html, flags=re.IGNORECASE | re.DOTALL):
        table_html = table_match.group(1)
        headers = parse_headers(table_html)
        body_rows = parse_body_rows(table_html)
        official_rows = [row_to_official(headers, row) for row in body_rows if len(row) >= len(headers) or len(headers) > 0]
        official_rows = [row for row in official_rows if row]
        tables.append(
            {
                "headers": headers,
                "rows": official_rows,
            }
        )
    return tables


def parse_headers(table_html: str) -> list[str]:
    thead_match = re.search(r"<thead\b[^>]*>(.*?)</thead>", table_html, flags=re.IGNORECASE | re.DOTALL)
    if not thead_match:
        return []
    header_html = thead_match.group(1)
    first_row = re.search(r"<tr\b[^>]*>(.*?)</tr>", header_html, flags=re.IGNORECASE | re.DOTALL)
    if first_row:
        header_html = first_row.group(1)
    return [clean_text(cell) for _, cell in re.findall(r"<th\b([^>]*)>(.*?)</th>", header_html, flags=re.IGNORECASE | re.DOTALL)]


def parse_body_rows(table_html: str) -> list[list[str]]:
    tbody_match = re.search(r"<tbody\b[^>]*>(.*?)</tbody>", table_html, flags=re.IGNORECASE | re.DOTALL)
    if not tbody_match:
        return []
    body_html = tbody_match.group(1)
    rows: list[list[str]] = []
    for row_html in re.findall(r"<tr\b[^>]*>(.*?)</tr>", body_html, flags=re.IGNORECASE | re.DOTALL):
        cells = [clean_text(cell) for _, cell in re.findall(r"<(?:td|th)\b([^>]*)>(.*?)</(?:td|th)>", row_html, flags=re.IGNORECASE | re.DOTALL)]
        if not cells:
            continue
        if len(cells) == 1 and "기록이 없습니다" in cells[0]:
            continue
        rows.append(cells)
    return rows


def row_to_official(headers: list[str], cells: list[str]) -> dict[str, str]:
    row: dict[str, str] = {}
    for index, header in enumerate(headers):
        if index >= len(cells):
            break
        row[header] = cells[index]
    return row


def table_has_stat_row(table: dict) -> bool:
    return any(row for row in table.get("rows", []))


def build_primary_stats(tables: list[dict]) -> dict[str, str]:
    primary: dict[str, str] = {}
    for table in tables:
        rows = table.get("rows", [])
        if not rows:
            continue
        primary.update(rows[0])
    return primary


def normalize_stats(official: dict[str, str]) -> dict[str, object]:
    normalized: dict[str, object] = {}
    for official_key, value in official.items():
        key = STAT_KEY_MAP.get(official_key, make_key(official_key))
        normalized[key] = parse_value(value)
    return normalized


def clean_text(fragment: str) -> str:
    fragment = re.sub(r"<script\b[^>]*>.*?</script>", "", fragment, flags=re.IGNORECASE | re.DOTALL)
    fragment = re.sub(r"<style\b[^>]*>.*?</style>", "", fragment, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r"<[^>]+>", "", fragment)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def parse_value(value: str) -> object:
    value = value.strip()
    if value in {"", "-", "nbsp;"}:
        return None
    if re.fullmatch(r"-?\d+", value):
        return int(value)
    if re.fullmatch(r"-?\d+\.\d+", value):
        return float(value)
    if re.fullmatch(r"\d+\s+\d/\d", value):
        whole, fraction = value.split()
        numerator, denominator = fraction.split("/")
        return round(int(whole) + int(numerator) / int(denominator), 3)
    if re.fullmatch(r"\d/\d", value):
        numerator, denominator = value.split("/")
        return round(int(numerator) / int(denominator), 3)
    return value


def make_key(value: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9가-힣]+", "_", value).strip("_")
    return safe or value


def summarize(players: list[dict]) -> dict:
    regular_success = sum(1 for player in players if player["stats"].get("regular"))
    futures_success = sum(1 for player in players if player["stats"].get("futures"))
    any_success = sum(1 for player in players if player["stats"])
    missing = len(players) - any_success
    error_players = sum(1 for player in players if player.get("errors"))
    return {
        "regularStatsPlayers": regular_success,
        "futuresStatsPlayers": futures_success,
        "playersWithAnyStats": any_success,
        "playersWithoutStats": missing,
        "playersWithErrors": error_players,
    }


def choose_sample(players: list[dict], sample_size: int) -> list[dict]:
    if sample_size <= 0:
        return []
    with_regular = [player for player in players if player["stats"].get("regular")]
    with_futures_only = [player for player in players if player["stats"].get("futures") and not player["stats"].get("regular")]
    missing = [player for player in players if not player["stats"]]
    selected: list[dict] = []
    for bucket in (with_regular, with_futures_only, missing, players):
        for player in bucket:
            if player["playerId"] in {entry["playerId"] for entry in selected}:
                continue
            selected.append(player)
            if len(selected) >= sample_size:
                return selected
    return selected


def team_sort_key(team_id: str) -> int:
    team_order = list(TEAM_NAMES)
    try:
        return team_order.index(team_id)
    except ValueError:
        return len(team_order)


if __name__ == "__main__":
    sys.exit(main())
