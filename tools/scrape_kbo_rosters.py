from __future__ import annotations

import argparse
import html
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path


BASE_URL = "https://web1.koreabaseball.com"
TEAM_CODES = {
    "lg": "LG",
    "doosan": "OB",
    "kia": "HT",
    "samsung": "SS",
    "lotte": "LT",
    "hanwha": "HH",
    "ssg": "SK",
    "kt": "KT",
    "nc": "NC",
    "kiwoom": "WO",
}
POSITION_LABELS = {"투수", "포수", "내야수", "외야수"}
PREFIX = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Scrape Korean KBO roster seeds from official registration pages.")
    parser.add_argument("--teams", nargs="*", default=list(TEAM_CODES), choices=sorted(TEAM_CODES))
    parser.add_argument("--write", action="store_true", help="Write src/rosters/{team}.js files.")
    parser.add_argument("--output-dir", default="src/rosters")
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    opener = make_opener()
    all_counts = {}

    for team_id in args.teams:
        team_code = TEAM_CODES[team_id]
        active = fetch_register_page(opener, "/Player/Register.aspx", team_code, "active")
        futures = fetch_register_page(opener, "/Futures/Player/Register.aspx", team_code, "futures")
        players = merge_players(active + futures)
        all_counts[team_id] = len(players)

        if args.write:
            out_dir.mkdir(parents=True, exist_ok=True)
            write_roster_module(out_dir / f"{team_id}.js", players)
        else:
            print(f"{team_id}: {len(players)}")
            for player in players[:8]:
                print(" ", player["name"], player["position"], player.get("jerseyNumber", ""))

    print(json.dumps(all_counts, ensure_ascii=False, indent=2))
    return 0


def make_opener():
    context = ssl.create_default_context()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(CookieJar()),
        urllib.request.HTTPSHandler(context=context),
    )


def fetch_register_page(opener, path: str, team_code: str, status: str) -> list[dict]:
    first_html = request_html(opener, BASE_URL + path)
    form = parse_input_values(first_html)
    form["__EVENTTARGET"] = PREFIX + "btnCalendarSelect"
    form["__EVENTARGUMENT"] = ""
    form[PREFIX + "hfSearchTeam"] = team_code
    form.setdefault(PREFIX + "hfSearchDate", "20260629")

    page_html = request_html(opener, BASE_URL + path, form)
    return parse_register_tables(page_html, status)


def request_html(opener, url: str, form: dict[str, str] | None = None) -> str:
    data = None
    if form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": url,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST" if data else "GET",
    )
    with opener.open(request, timeout=20) as response:
        raw = response.read()
    return raw.decode("utf-8", errors="replace")


def parse_input_values(page_html: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for tag_match in re.finditer(r"<input\b[^>]*>", page_html, flags=re.IGNORECASE | re.DOTALL):
        attrs = parse_attrs(tag_match.group(0))
        name = attrs.get("name")
        if name:
            values[html.unescape(name)] = html.unescape(attrs.get("value", ""))
    return values


def parse_register_tables(page_html: str, status: str) -> list[dict]:
    players: list[dict] = []
    table_pattern = re.compile(r"<table\b[^>]*>(.*?)</table>", re.IGNORECASE | re.DOTALL)

    for table_match in table_pattern.finditer(page_html):
        table_html = table_match.group(1)
        headers = [clean_text(cell) for cell in re.findall(r"<th\b[^>]*>(.*?)</th>", table_html, re.IGNORECASE | re.DOTALL)]
        if len(headers) < 5 or headers[0] != "등번호" or headers[1] not in POSITION_LABELS or headers[2] != "투타유형":
            continue

        position_group = headers[1]
        role = "pitcher" if position_group == "투수" else "hitter"
        position = map_position_group(position_group)

        for row_html in re.findall(r"<tr\b[^>]*>(.*?)</tr>", table_html, re.IGNORECASE | re.DOTALL):
            cells = [cell for cell in re.findall(r"<td\b[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)]
            if len(cells) < 5:
                continue

            jersey_number = clean_text(cells[0])
            name = clean_text(cells[1])
            if not name or "없습니다" in name:
                continue

            handedness = clean_text(cells[2])
            birthday = clean_text(cells[3])
            body = clean_text(cells[4])
            player_id = parse_player_id(cells[1])
            throws, bats = parse_handedness(handedness)

            players.append(
                {
                    "name": name,
                    "role": role,
                    "position": position,
                    "bats": bats if role == "hitter" else "",
                    "throws": throws,
                    "age": age_from_birthday(birthday),
                    "jerseyNumber": jersey_number,
                    "status": status,
                    "source": "KBO 등록현황" if status == "active" else "KBO 퓨처스 등록현황",
                    "playerId": player_id,
                    "birthday": birthday,
                    "body": body,
                    "handedness": handedness,
                }
            )
    return players


def merge_players(players: list[dict]) -> list[dict]:
    seen: set[tuple[str, str | None]] = set()
    merged: list[dict] = []
    for player in players:
        key = (player["name"], player.get("playerId") or player.get("jerseyNumber"))
        if key in seen:
            continue
        seen.add(key)
        merged.append(player)
    return merged


def write_roster_module(path: Path, players: list[dict]) -> None:
    payload = json.dumps(players, ensure_ascii=False, indent=2)
    path.write_text(f"export default {payload};\n", encoding="utf-8")


def map_position_group(label: str) -> str:
    return {
        "투수": "P",
        "포수": "C",
        "내야수": "IF",
        "외야수": "OF",
    }.get(label, "UT")


def parse_player_id(cell_html: str) -> str:
    match = re.search(r"playerId=(\d+)", cell_html, flags=re.IGNORECASE)
    return match.group(1) if match else ""


def parse_handedness(value: str) -> tuple[str, str]:
    throws = "L" if value.startswith("좌") else "R"
    if "양타" in value:
        bats = "S"
    elif "좌타" in value:
        bats = "L"
    else:
        bats = "R"
    return throws, bats


def age_from_birthday(value: str) -> int:
    match = re.match(r"(\d{4})-\d{2}-\d{2}", value)
    if not match:
        return 26
    return max(17, 2026 - int(match.group(1)))


def parse_attrs(tag: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    attr_pattern = re.compile(r"([\w:-]+)\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))")
    for match in attr_pattern.finditer(tag):
        value = match.group(2) if match.group(2) is not None else match.group(3) if match.group(3) is not None else match.group(4)
        attrs[match.group(1).lower()] = value or ""
    return attrs


def clean_text(fragment: str) -> str:
    no_tags = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


if __name__ == "__main__":
    sys.exit(main())
