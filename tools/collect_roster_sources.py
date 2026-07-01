from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


BASE_URL = "https://www.koreabaseball.com"
SEARCH_URL = f"{BASE_URL}/Player/Search.aspx?searchWord="
SEARCH_PAGE_URL = f"{BASE_URL}/Player/Search.aspx"
PREFIX = "ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

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

TEAM_LABELS = {
    "lg": "LG",
    "doosan": "두산",
    "kia": "KIA",
    "samsung": "삼성",
    "lotte": "롯데",
    "hanwha": "한화",
    "ssg": "SSG",
    "kt": "KT",
    "nc": "NC",
    "kiwoom": "키움",
}

POSITION_FILTERS = {
    "1": "투수",
    "2": "포수",
    "3,4,5,6": "내야수",
    "7,8,9": "외야수",
}

CORE_NAME_TOKENS = [
    "김",
    "이",
    "박",
    "최",
    "정",
    "강",
    "조",
    "윤",
    "장",
    "임",
    "한",
    "오",
    "서",
    "신",
    "권",
    "황",
    "안",
    "송",
    "류",
    "전",
    "홍",
    "고",
    "문",
    "양",
    "손",
    "배",
    "백",
    "허",
    "유",
    "남",
    "심",
    "노",
    "하",
    "곽",
    "성",
    "차",
    "주",
    "우",
    "구",
    "민",
]

BROAD_EXTRA_TOKENS = [
    "진",
    "나",
    "지",
    "엄",
    "원",
    "채",
    "천",
    "방",
    "공",
    "현",
    "함",
    "염",
    "변",
    "여",
    "도",
    "석",
    "데",
    "라",
    "로",
    "루",
    "레",
    "리",
    "맥",
    "폰",
    "푸",
    "제",
    "네",
    "윌",
    "와",
    "카",
    "케",
    "코",
    "쿠",
    "토",
    "파",
    "페",
    "벨",
    "알",
    "야",
    "디",
    "헤",
    "후",
]

TOKEN_PROFILES = {
    "none": [],
    "core": CORE_NAME_TOKENS,
    "broad": CORE_NAME_TOKENS + BROAD_EXTRA_TOKENS,
}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Collect KBO official player-search candidates without touching existing roster modules."
    )
    parser.add_argument("--roster-dir", default="src/rosters")
    parser.add_argument("--output-dir", default="src/rosters_candidates")
    parser.add_argument("--output-file", default="kbo-player-search-candidates.json")
    parser.add_argument("--teams", nargs="*", choices=sorted(TEAM_CODES), default=list(TEAM_CODES))
    parser.add_argument("--token-profile", choices=sorted(TOKEN_PROFILES), default="none")
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=20)
    args = parser.parse_args()

    base_form = fetch_base_form(args.timeout)
    existing = load_existing_rosters(Path(args.roster_dir))
    search_result = collect_search_rows(base_form, args.teams, args.token_profile, args.max_workers, args.timeout)

    prefiltered = [
        row
        for row in search_result["rows"].values()
        if row["playerId"] not in existing["playerIds"]
        and (row["teamId"], row["name"], row["birthday"]) not in existing["identityKeys"]
    ]

    candidates, rejected = validate_candidates(prefiltered, args.max_workers, args.timeout)
    candidates.sort(key=lambda player: (list(TEAM_CODES).index(player["teamId"]), player["role"], player["name"]))

    payload = {
        "metadata": {
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "source": "KBO 공식 선수조회",
            "sourceUrl": SEARCH_PAGE_URL,
            "tokenProfile": args.token_profile,
            "baseRosterCount": existing["count"],
            "officialTeamSearchTotal": search_result["officialTeamSearchTotal"],
            "discoveredSearchRows": len(search_result["rows"]),
            "prefilteredNewRows": len(prefiltered),
            "candidateCount": len(candidates),
            "rejectedAfterDetailCheck": len(rejected),
            "truncatedSearches": search_result["truncatedSearches"],
            "notes": [
                "기존 src/rosters/*.js와 playerId 또는 팀+이름+생년월일이 겹치는 선수는 후보에서 제외했습니다.",
                "상세 페이지에서 이름, 생년월일, 포지션, 투타를 확인하지 못한 행은 후보에 넣지 않았습니다.",
                "tokenProfile=none은 빠른 1차 후보용입니다. core/broad는 페이징으로 잘리는 팀/포지션 조합을 이름 토큰으로 보강합니다.",
            ],
        },
        "players": candidates,
        "rejected": rejected,
    }

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / args.output_file
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "output": str(out_path),
                "baseRosterCount": existing["count"],
                "officialTeamSearchTotal": search_result["officialTeamSearchTotal"],
                "discoveredSearchRows": len(search_result["rows"]),
                "candidateCount": len(candidates),
                "truncatedSearches": len(search_result["truncatedSearches"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def fetch_base_form(timeout: int) -> dict[str, str]:
    return parse_input_values(request_html(SEARCH_URL, timeout=timeout))


def collect_search_rows(
    base_form: dict[str, str],
    team_ids: list[str],
    token_profile: str,
    max_workers: int,
    timeout: int,
) -> dict:
    rows_by_player_id: dict[str, dict] = {}
    truncated: list[dict] = []
    official_team_total = 0
    high_count_position_tasks: list[tuple[str, str, str, str]] = []

    team_tasks = [(team_id, TEAM_CODES[team_id], "", "") for team_id in team_ids]
    position_tasks = [
        (team_id, TEAM_CODES[team_id], position_code, "")
        for team_id in team_ids
        for position_code in POSITION_FILTERS
    ]

    for page in run_search_tasks(team_tasks + position_tasks, base_form, max_workers, timeout):
        merge_rows(rows_by_player_id, page["rows"])

        if page["positionCode"] == "":
            official_team_total += page["declaredCount"]
        elif page["declaredCount"] > page["visibleCount"]:
            high_count_position_tasks.append((page["teamId"], page["teamCode"], page["positionCode"], ""))
            truncated.append(make_truncation_entry(page))

    token_tasks = []
    for team_id, team_code, position_code, _search_word in high_count_position_tasks:
        for token in TOKEN_PROFILES[token_profile]:
            token_tasks.append((team_id, team_code, position_code, token))

    for page in run_search_tasks(token_tasks, base_form, max_workers, timeout):
        merge_rows(rows_by_player_id, page["rows"])
        if page["declaredCount"] > page["visibleCount"]:
            truncated.append(make_truncation_entry(page))

    return {
        "rows": rows_by_player_id,
        "officialTeamSearchTotal": official_team_total,
        "truncatedSearches": truncated,
    }


def run_search_tasks(
    tasks: list[tuple[str, str, str, str]],
    base_form: dict[str, str],
    max_workers: int,
    timeout: int,
) -> list[dict]:
    if not tasks:
        return []

    results: list[dict] = []
    workers = max(1, min(max_workers, len(tasks)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(fetch_search_page, base_form, team_id, team_code, position_code, search_word, timeout)
            for team_id, team_code, position_code, search_word in tasks
        ]
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())
    return results


def fetch_search_page(
    base_form: dict[str, str],
    team_id: str,
    team_code: str,
    position_code: str,
    search_word: str,
    timeout: int,
) -> dict:
    form = dict(base_form)
    form[PREFIX + "ddlTeam"] = team_code
    form[PREFIX + "ddlPosition"] = position_code
    form[PREFIX + "txtSearchPlayerName"] = search_word
    form["__EVENTTARGET"] = ""
    form["__EVENTARGUMENT"] = ""
    form[PREFIX + "btnSearch"] = "검색"

    page_html = request_html(SEARCH_URL, form, timeout=timeout)
    declared_count = parse_result_count(page_html)
    rows = parse_search_rows(page_html, team_id, team_code, position_code, search_word, declared_count)
    return {
        "teamId": team_id,
        "teamCode": team_code,
        "positionCode": position_code,
        "positionLabel": POSITION_FILTERS.get(position_code, ""),
        "searchWord": search_word,
        "declaredCount": declared_count,
        "visibleCount": len(rows),
        "rows": rows,
    }


def parse_search_rows(
    page_html: str,
    team_id: str,
    team_code: str,
    position_code: str,
    search_word: str,
    declared_count: int,
) -> list[dict]:
    rows: list[dict] = []
    for row_html in re.findall(r"<tr\b[^>]*>(.*?)</tr>", page_html, re.IGNORECASE | re.DOTALL):
        if "playerId=" not in row_html:
            continue

        cells = re.findall(r"<td\b[^>]*>(.*?)</td>", row_html, re.IGNORECASE | re.DOTALL)
        if len(cells) < 6:
            continue

        href_match = re.search(r"href=['\"]([^'\"]*playerId=(\d+)[^'\"]*)", cells[1], flags=re.IGNORECASE)
        if not href_match:
            continue

        detail_path = html.unescape(href_match.group(1))
        player_id = href_match.group(2)
        row = {
            "playerId": player_id,
            "name": clean_text(cells[1]),
            "teamId": team_id,
            "teamCode": team_code,
            "team": TEAM_LABELS[team_id],
            "sourceTeamText": clean_text(cells[2]),
            "sourcePositionText": clean_text(cells[3]),
            "birthday": normalize_birthday(clean_text(cells[4])),
            "body": normalize_body(clean_text(cells[5])),
            "school": clean_text(cells[6]) if len(cells) > 6 else "",
            "jerseyNumber": clean_text(cells[0]),
            "detailUrl": urllib.parse.urljoin(BASE_URL, detail_path),
            "sourceQueries": [
                {
                    "source": "KBO 선수조회",
                    "sourceUrl": SEARCH_PAGE_URL,
                    "teamCode": team_code,
                    "positionCode": position_code,
                    "positionLabel": POSITION_FILTERS.get(position_code, ""),
                    "searchWord": search_word,
                    "declaredCount": declared_count,
                }
            ],
        }
        rows.append(row)
    return rows


def merge_rows(rows_by_player_id: dict[str, dict], rows: list[dict]) -> None:
    for row in rows:
        existing = rows_by_player_id.get(row["playerId"])
        if existing is None:
            rows_by_player_id[row["playerId"]] = row
            continue

        seen_queries = {
            (
                query["teamCode"],
                query["positionCode"],
                query["searchWord"],
            )
            for query in existing["sourceQueries"]
        }
        for query in row["sourceQueries"]:
            key = (query["teamCode"], query["positionCode"], query["searchWord"])
            if key not in seen_queries:
                existing["sourceQueries"].append(query)
                seen_queries.add(key)


def validate_candidates(rows: list[dict], max_workers: int, timeout: int) -> tuple[list[dict], list[dict]]:
    candidates: list[dict] = []
    rejected: list[dict] = []

    workers = max(1, min(max_workers, len(rows) or 1))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(validate_candidate, row, timeout) for row in rows]
        for future in concurrent.futures.as_completed(futures):
            candidate, rejection = future.result()
            if candidate:
                candidates.append(candidate)
            elif rejection:
                rejected.append(rejection)

    rejected.sort(key=lambda item: (item.get("teamId", ""), item.get("name", ""), item.get("reason", "")))
    return candidates, rejected


def validate_candidate(row: dict, timeout: int) -> tuple[dict | None, dict | None]:
    try:
        detail_html = request_html(row["detailUrl"], timeout=timeout)
    except Exception as exc:  # noqa: BLE001 - preserve source row and reason in output.
        return None, rejection(row, f"detail request failed: {exc}")

    detail_name = span_text(detail_html, "lblName")
    detail_birthday = normalize_birthday(span_text(detail_html, "lblBirthday"))
    detail_position = span_text(detail_html, "lblPosition")
    detail_body = normalize_body(span_text(detail_html, "lblHeightWeight"))

    if detail_name and detail_name != row["name"]:
        return None, rejection(row, "detail name mismatch")

    if detail_birthday and row["birthday"] and detail_birthday != row["birthday"]:
        return None, rejection(row, "birthday mismatch")

    birthday = detail_birthday or row["birthday"]
    position_group, handedness = parse_position_detail(detail_position)
    handedness_parsed = parse_handedness(handedness)

    if not row["name"] or not row["teamId"] or not birthday or not position_group or not handedness_parsed:
        return None, rejection(row, "missing confirmed name/team/position/handedness/birthday")

    role = "pitcher" if position_group == "투수" else "hitter"
    position = map_position_group(position_group)
    throws, bats = handedness_parsed

    candidate = {
        "name": row["name"],
        "teamId": row["teamId"],
        "team": row["team"],
        "role": role,
        "position": position,
        "positionGroup": position_group,
        "bats": bats,
        "throws": throws,
        "age": age_from_birthday(birthday),
        "jerseyNumber": row["jerseyNumber"],
        "status": "candidate",
        "source": "KBO 선수조회",
        "playerId": row["playerId"],
        "birthday": birthday,
        "body": detail_body or row["body"],
        "handedness": handedness,
        "school": row["school"],
        "sourceUrls": [SEARCH_PAGE_URL, row["detailUrl"]],
        "sourceQueries": row["sourceQueries"],
    }
    return candidate, None


def rejection(row: dict, reason: str) -> dict:
    return {
        "playerId": row.get("playerId", ""),
        "name": row.get("name", ""),
        "teamId": row.get("teamId", ""),
        "birthday": row.get("birthday", ""),
        "detailUrl": row.get("detailUrl", ""),
        "reason": reason,
    }


def load_existing_rosters(roster_dir: Path) -> dict:
    player_ids: set[str] = set()
    identity_keys: set[tuple[str, str, str]] = set()
    count = 0

    for path in sorted(roster_dir.glob("*.js")):
        if path.name == "index.js":
            continue

        match = re.search(r"export\s+default\s+(\[.*\]);?\s*$", path.read_text(encoding="utf-8"), re.DOTALL)
        if not match:
            continue

        team_id = path.stem
        players = json.loads(match.group(1))
        count += len(players)

        for player in players:
            player_id = str(player.get("playerId") or "")
            if player_id:
                player_ids.add(player_id)
            identity_keys.add((team_id, player.get("name", ""), normalize_birthday(player.get("birthday", ""))))

    return {"playerIds": player_ids, "identityKeys": identity_keys, "count": count}


def request_html(url: str, form: dict[str, str] | None = None, timeout: int = 20) -> str:
    data = urllib.parse.urlencode(form).encode("utf-8") if form is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": SEARCH_PAGE_URL,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        charset = response.headers.get_content_charset() or "utf-8"
    return raw.decode(charset, errors="replace")


def parse_input_values(page_html: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for tag_match in re.finditer(r"<input\b[^>]*>", page_html, flags=re.IGNORECASE | re.DOTALL):
        attrs = parse_attrs(tag_match.group(0))
        name = attrs.get("name")
        if name:
            values[html.unescape(name)] = html.unescape(attrs.get("value", ""))
    return values


def parse_attrs(tag: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    attr_pattern = re.compile(r"([\w:-]+)\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))")
    for match in attr_pattern.finditer(tag):
        value = match.group(2) if match.group(2) is not None else match.group(3) if match.group(3) is not None else match.group(4)
        attrs[match.group(1).lower()] = value or ""
    return attrs


def parse_result_count(page_html: str) -> int:
    match = re.search(r"검색결과\s*:\s*<span[^>]*>([0-9,]+)</span>\s*건", page_html)
    if match:
        return int(match.group(1).replace(",", ""))
    return len(re.findall(r"playerId=\d+", page_html))


def make_truncation_entry(page: dict) -> dict:
    return {
        "teamId": page["teamId"],
        "teamCode": page["teamCode"],
        "positionCode": page["positionCode"],
        "positionLabel": page["positionLabel"],
        "searchWord": page["searchWord"],
        "declaredCount": page["declaredCount"],
        "visibleCount": page["visibleCount"],
        "sourceUrl": SEARCH_PAGE_URL,
    }


def span_text(page_html: str, id_suffix: str) -> str:
    pattern = rf"<span\b[^>]*id=\"[^\"]*{re.escape(id_suffix)}\"[^>]*>(.*?)</span>"
    match = re.search(pattern, page_html, flags=re.IGNORECASE | re.DOTALL)
    return clean_text(match.group(1)) if match else ""


def parse_position_detail(value: str) -> tuple[str, str]:
    match = re.match(r"\s*([^()]+?)\s*(?:\(([^)]*)\))?\s*$", value)
    if not match:
        return "", ""
    return match.group(1).strip(), (match.group(2) or "").strip()


def parse_handedness(value: str) -> tuple[str, str] | None:
    if "투" not in value or "타" not in value:
        return None

    throws = "L" if value.startswith("좌") else "R"
    if "양타" in value:
        bats = "S"
    elif "좌타" in value:
        bats = "L"
    elif "우타" in value:
        bats = "R"
    else:
        return None
    return throws, bats


def map_position_group(label: str) -> str:
    return {
        "투수": "P",
        "포수": "C",
        "내야수": "IF",
        "외야수": "OF",
    }.get(label, "UT")


def normalize_birthday(value: str) -> str:
    value = clean_text(value)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return value

    match = re.search(r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일", value)
    if match:
        year, month, day = match.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return ""


def normalize_body(value: str) -> str:
    value = clean_text(value)
    match = re.search(r"(\d+cm)\s*[/,]\s*(\d+kg)", value)
    if match:
        return f"{match.group(1)}, {match.group(2)}"
    return value


def age_from_birthday(value: str) -> int:
    match = re.match(r"(\d{4})-\d{2}-\d{2}", value)
    if not match:
        return 26
    return max(17, 2026 - int(match.group(1)))


def clean_text(fragment: str) -> str:
    no_tags = re.sub(r"<[^>]+>", "", fragment or "")
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


if __name__ == "__main__":
    sys.exit(main())
