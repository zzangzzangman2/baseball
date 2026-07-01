from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import html
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


BASE_URL = "https://www.koreabaseball.com"
SEARCH_PAGE_URL = f"{BASE_URL}/Player/Search.aspx"
SEARCH_ENTRY_URL = f"{SEARCH_PAGE_URL}?searchWord="
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

TEAM_TEXT_TO_ID = {
    "LG": "lg",
    "두산": "doosan",
    "OB": "doosan",
    "KIA": "kia",
    "해태": "kia",
    "HT": "kia",
    "삼성": "samsung",
    "SS": "samsung",
    "롯데": "lotte",
    "LT": "lotte",
    "한화": "hanwha",
    "HH": "hanwha",
    "SSG": "ssg",
    "SK": "ssg",
    "KT": "kt",
    "NC": "nc",
    "키움": "kiwoom",
    "넥센": "kiwoom",
    "히어로즈": "kiwoom",
    "WO": "kiwoom",
}

POSITION_FILTERS = {
    "1": {"label": "투수", "position": "P"},
    "2": {"label": "포수", "position": "C"},
    "3,4,5,6": {"label": "내야수", "position": "IF"},
    "7,8,9": {"label": "외야수", "position": "OF"},
}

POSITION_TEXT_TO_POSITION = {
    "투수": "P",
    "포수": "C",
    "내야수": "IF",
    "외야수": "OF",
}

SUPPLEMENTAL_NAME_TOKENS = [
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
]


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Collect additional KBO player candidates without writing src/rosters/*.js. "
            "The primary pass follows KBO player-search pagination that the older collector missed. "
            "The supplemental pass uses official KBO name search and marks those rows as review candidates."
        )
    )
    parser.add_argument("--roster-dir", default="src/rosters")
    parser.add_argument("--output-dir", default="src/rosters_candidates")
    parser.add_argument("--output-file", default="kbo-additional-candidates.json")
    parser.add_argument("--teams", nargs="*", choices=sorted(TEAM_CODES), default=list(TEAM_CODES))
    parser.add_argument("--target-total", type=int, default=1000)
    parser.add_argument("--supplemental-limit", type=int, default=80, help="Maximum KBO name-search supplemental candidates. Use 0 to disable.")
    parser.add_argument("--name-tokens", nargs="*", default=SUPPLEMENTAL_NAME_TOKENS)
    parser.add_argument("--name-token-pages", type=int, default=1)
    parser.add_argument("--max-workers", type=int, default=8)
    parser.add_argument("--timeout", type=int, default=20)
    args = parser.parse_args()

    base_form = fetch_base_form(args.timeout)
    existing = load_existing_rosters(Path(args.roster_dir))

    paged_result = collect_current_team_paged_rows(base_form, args.teams, args.max_workers, args.timeout)
    pool = CandidatePool(existing["playerIds"], existing["identityKeys"])
    pool.add_rows(paged_result["rows"])

    supplemental_result = {"rows": [], "queries": [], "skipped": []}
    projected_after_paged = existing["count"] + pool.size
    if args.supplemental_limit > 0:
        supplemental_result = collect_name_search_rows(
            base_form,
            args.name_tokens,
            args.name_token_pages,
            max(args.supplemental_limit + 40, max(0, args.target_total - projected_after_paged) + 40),
            args.timeout,
        )
        pool.add_rows(supplemental_result["rows"], limit=args.supplemental_limit)

    candidates, rejected = validate_candidate_rows(pool.rows, args.max_workers, args.timeout)
    candidates.sort(
        key=lambda player: (
            0 if player["candidateType"] == "kbo-current-team-paged" else 1,
            list(TEAM_CODES).index(player["teamId"]),
            position_rank(player["position"]),
            player["name"],
            player["playerId"],
        )
    )

    candidate_counts = count_by(candidates, "candidateType")
    payload = {
        "metadata": {
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "sources": [
                {
                    "name": "KBO 공식 선수조회",
                    "url": SEARCH_PAGE_URL,
                    "use": "팀+포지션 페이징 누락분 회수와 이름검색 보조 후보 수집",
                },
                {
                    "name": "KBO 선수 상세",
                    "urlPattern": f"{BASE_URL}/Record/Player/*Detail*/Basic.aspx?playerId={{playerId}}",
                    "use": "이름, 생년월일, 포지션, 투타 확인",
                },
                {
                    "name": "KBO 퓨처스 선수 상세",
                    "urlPattern": f"{BASE_URL}/Futures/Player/*Detail.aspx?playerId={{playerId}}",
                    "use": "퓨처스 상세 후보 확인",
                },
            ],
            "baseRosterCount": existing["count"],
            "targetTotal": args.target_total,
            "candidateCount": len(candidates),
            "projectedTotalIfMerged": existing["count"] + len(candidates),
            "candidateCounts": candidate_counts,
            "rejectedCount": len(rejected),
            "currentTeamPaged": {
                "declaredPositionSearchRows": paged_result["declaredCount"],
                "discoveredRows": len(paged_result["rows"]),
                "queries": paged_result["queries"],
            },
            "supplementalNameSearch": {
                "enabled": bool(supplemental_result["rows"] or supplemental_result["queries"]),
                "tokens": args.name_tokens,
                "maxPagesPerToken": args.name_token_pages,
                "rawRows": len(supplemental_result["rows"]),
                "queries": supplemental_result["queries"],
                "skipped": supplemental_result["skipped"],
                "note": (
                    "이름검색 보조 후보는 KBO 공식 선수조회에 존재하지만 현재 등록/보류/은퇴 상태가 섞일 수 있어 "
                    "최종 병합 전 별도 검토가 필요합니다."
                ),
            },
            "notes": [
                "기존 src/rosters/*.js는 읽기만 했고 수정하지 않았습니다.",
                "중복 제거는 playerId 우선, 없으면 teamId+name+birthday 조합으로 처리했습니다.",
                "광범위 포지션(P,C,IF,OF)이 확인되지 않는 경우 position을 unknown으로 남깁니다.",
                "candidateType=kbo-current-team-paged는 팀+포지션 검색의 누락 페이지에서 온 후보입니다.",
                "candidateType=kbo-name-search-supplemental은 KBO 이름검색 기반 보조 후보이며 현재 소속 상태 검토가 필요합니다.",
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
                "candidateCount": len(candidates),
                "candidateCounts": candidate_counts,
                "projectedTotalIfMerged": existing["count"] + len(candidates),
                "rejectedCount": len(rejected),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


class CandidatePool:
    def __init__(self, existing_player_ids: set[str], existing_identity_keys: set[tuple[str, str, str]]) -> None:
        self.existing_player_ids = existing_player_ids
        self.existing_identity_keys = existing_identity_keys
        self.rows: list[dict] = []
        self.seen_player_ids: set[str] = set()
        self.seen_identity_keys: set[tuple[str, str, str]] = set()

    @property
    def size(self) -> int:
        return len(self.rows)

    def add_rows(self, rows: list[dict], limit: int | None = None) -> None:
        added = 0
        for row in rows:
            player_id = str(row.get("playerId") or "")
            identity_key = (row.get("teamId", ""), row.get("name", ""), normalize_birthday(row.get("birthday", "")))
            if player_id and (player_id in self.existing_player_ids or player_id in self.seen_player_ids):
                continue
            if identity_key in self.existing_identity_keys or identity_key in self.seen_identity_keys:
                continue
            self.rows.append(row)
            if player_id:
                self.seen_player_ids.add(player_id)
            self.seen_identity_keys.add(identity_key)
            added += 1
            if limit is not None and added >= limit:
                break


def collect_current_team_paged_rows(
    base_form: dict[str, str],
    teams: list[str],
    max_workers: int,
    timeout: int,
) -> dict:
    tasks = [(team_id, TEAM_CODES[team_id], position_code, "") for team_id in teams for position_code in POSITION_FILTERS]
    results = run_query_tasks(tasks, base_form, max_workers, timeout)

    rows_by_player_id: dict[str, dict] = {}
    queries = []
    declared_count = 0
    for result in results:
        declared_count += result["declaredCount"]
        queries.append(
            {
                "teamId": result["teamId"],
                "teamCode": result["teamCode"],
                "positionCode": result["positionCode"],
                "positionLabel": POSITION_FILTERS[result["positionCode"]]["label"],
                "searchWord": "",
                "declaredCount": result["declaredCount"],
                "visibleCount": result["visibleCount"],
                "pagesFetched": result["pagesFetched"],
                "sourceUrl": SEARCH_PAGE_URL,
            }
        )
        for row in result["rows"]:
            row["candidateType"] = "kbo-current-team-paged"
            row["source"] = "KBO 선수조회 팀+포지션 페이징"
            merge_row(rows_by_player_id, row)

    return {"rows": list(rows_by_player_id.values()), "queries": queries, "declaredCount": declared_count}


def collect_name_search_rows(
    base_form: dict[str, str],
    tokens: list[str],
    max_pages_per_token: int,
    raw_limit: int,
    timeout: int,
) -> dict:
    rows_by_player_id: dict[str, dict] = {}
    queries: list[dict] = []
    skipped: list[dict] = []

    for token in tokens:
        if raw_limit and len(rows_by_player_id) >= raw_limit:
            break

        result = fetch_query_pages(
            base_form=base_form,
            team_id="",
            team_code="",
            position_code="",
            search_word=token,
            timeout=timeout,
            max_pages=max_pages_per_token,
        )
        queries.append(
            {
                "searchWord": token,
                "declaredCount": result["declaredCount"],
                "visibleCount": result["visibleCount"],
                "pagesFetched": result["pagesFetched"],
                "sourceUrl": SEARCH_PAGE_URL,
            }
        )

        for row in result["rows"]:
            team_id = TEAM_TEXT_TO_ID.get(row["sourceTeamText"], "")
            if not team_id:
                skipped.append(
                    {
                        "playerId": row.get("playerId", ""),
                        "name": row.get("name", ""),
                        "sourceTeamText": row.get("sourceTeamText", ""),
                        "reason": "unmapped team text",
                    }
                )
                continue
            row["teamId"] = team_id
            row["teamCode"] = TEAM_CODES[team_id]
            row["teamName"] = TEAM_NAMES[team_id]
            row["candidateType"] = "kbo-name-search-supplemental"
            row["source"] = "KBO 선수조회 이름검색"
            row["reviewNote"] = "KBO 공식 선수조회 이름검색 후보입니다. 현재 등록/보류/은퇴 상태는 최종 병합 전 별도 확인이 필요합니다."
            merge_row(rows_by_player_id, row)
            if raw_limit and len(rows_by_player_id) >= raw_limit:
                break

    return {"rows": list(rows_by_player_id.values()), "queries": queries, "skipped": skipped}


def run_query_tasks(
    tasks: list[tuple[str, str, str, str]],
    base_form: dict[str, str],
    max_workers: int,
    timeout: int,
) -> list[dict]:
    workers = max(1, min(max_workers, len(tasks) or 1))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [
            executor.submit(
                fetch_query_pages,
                base_form,
                team_id,
                team_code,
                position_code,
                search_word,
                timeout,
                None,
            )
            for team_id, team_code, position_code, search_word in tasks
        ]
        return [future.result() for future in concurrent.futures.as_completed(futures)]


def fetch_query_pages(
    base_form: dict[str, str],
    team_id: str,
    team_code: str,
    position_code: str,
    search_word: str,
    timeout: int,
    max_pages: int | None,
) -> dict:
    first_page = fetch_first_page(base_form, team_code, position_code, search_word, timeout)
    declared_count = parse_result_count(first_page)
    natural_page_count = max(1, math.ceil(declared_count / 20)) if declared_count else 1
    page_count = min(natural_page_count, max_pages) if max_pages else natural_page_count
    rows = parse_search_rows(first_page, team_id, team_code, position_code, search_word, declared_count)
    current_page = first_page

    for page_number in range(2, page_count + 1):
        current_page = fetch_pager_page(current_page, team_code, position_code, search_word, page_number, timeout)
        rows.extend(parse_search_rows(current_page, team_id, team_code, position_code, search_word, declared_count))

    return {
        "teamId": team_id,
        "teamCode": team_code,
        "positionCode": position_code,
        "searchWord": search_word,
        "declaredCount": declared_count,
        "visibleCount": len(rows),
        "pagesFetched": page_count,
        "rows": rows,
    }


def fetch_first_page(
    base_form: dict[str, str],
    team_code: str,
    position_code: str,
    search_word: str,
    timeout: int,
) -> str:
    form = dict(base_form)
    form[PREFIX + "ddlTeam"] = team_code
    form[PREFIX + "ddlPosition"] = position_code
    form[PREFIX + "txtSearchPlayerName"] = search_word
    form["__EVENTTARGET"] = ""
    form["__EVENTARGUMENT"] = ""
    form[PREFIX + "btnSearch"] = "검색"
    return request_html(SEARCH_ENTRY_URL, form, timeout=timeout)


def fetch_pager_page(
    previous_page_html: str,
    team_code: str,
    position_code: str,
    search_word: str,
    page_number: int,
    timeout: int,
) -> str:
    form = parse_input_values(previous_page_html)
    form[PREFIX + "ddlTeam"] = team_code
    form[PREFIX + "ddlPosition"] = position_code
    form[PREFIX + "txtSearchPlayerName"] = search_word
    form["__EVENTTARGET"] = PREFIX + f"ucPager$btnNo{page_number}"
    form["__EVENTARGUMENT"] = ""
    form.pop(PREFIX + "btnSearch", None)
    return request_html(SEARCH_ENTRY_URL, form, timeout=timeout)


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

        source_team_text = clean_text(cells[2])
        source_position_text = clean_text(cells[3])
        mapped_position = map_position_text(source_position_text)
        if position_code in POSITION_FILTERS:
            mapped_position = POSITION_FILTERS[position_code]["position"]

        row_team_id = team_id or TEAM_TEXT_TO_ID.get(source_team_text, "")
        detail_path = html.unescape(href_match.group(1))
        row = {
            "playerId": href_match.group(2),
            "name": clean_text(cells[1]),
            "teamId": row_team_id,
            "teamCode": team_code or (TEAM_CODES[row_team_id] if row_team_id in TEAM_CODES else ""),
            "teamName": TEAM_NAMES.get(row_team_id, ""),
            "sourceTeamText": source_team_text,
            "sourcePositionText": source_position_text,
            "position": mapped_position,
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
                    "positionLabel": POSITION_FILTERS.get(position_code, {}).get("label", ""),
                    "searchWord": search_word,
                    "declaredCount": declared_count,
                }
            ],
        }
        rows.append(row)
    return rows


def merge_row(rows_by_player_id: dict[str, dict], row: dict) -> None:
    player_id = row.get("playerId", "")
    if not player_id:
        return
    existing = rows_by_player_id.get(player_id)
    if existing is None:
        rows_by_player_id[player_id] = row
        return

    seen_queries = {
        (query.get("teamCode", ""), query.get("positionCode", ""), query.get("searchWord", ""))
        for query in existing.get("sourceQueries", [])
    }
    for query in row.get("sourceQueries", []):
        key = (query.get("teamCode", ""), query.get("positionCode", ""), query.get("searchWord", ""))
        if key not in seen_queries:
            existing.setdefault("sourceQueries", []).append(query)
            seen_queries.add(key)


def validate_candidate_rows(rows: list[dict], max_workers: int, timeout: int) -> tuple[list[dict], list[dict]]:
    candidates: list[dict] = []
    rejected: list[dict] = []
    workers = max(1, min(max_workers, len(rows) or 1))

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(validate_candidate_row, row, timeout) for row in rows]
        for future in concurrent.futures.as_completed(futures):
            candidate, rejection = future.result()
            if candidate:
                candidates.append(candidate)
            elif rejection:
                rejected.append(rejection)

    rejected.sort(key=lambda item: (item.get("teamId", ""), item.get("name", ""), item.get("reason", "")))
    return candidates, rejected


def validate_candidate_row(row: dict, timeout: int) -> tuple[dict | None, dict | None]:
    try:
        detail_html = request_html(row["detailUrl"], timeout=timeout)
    except Exception as exc:  # noqa: BLE001 - keep the row and reason for manual review.
        detail_html = ""
        detail_error = str(exc)
    else:
        detail_error = ""

    detail_name = span_text(detail_html, "lblName") if detail_html else ""
    detail_birthday = normalize_birthday(span_text(detail_html, "lblBirthday")) if detail_html else ""
    detail_position_text = span_text(detail_html, "lblPosition") if detail_html else ""
    detail_body = normalize_body(span_text(detail_html, "lblHeightWeight")) if detail_html else ""

    if detail_name and detail_name != row["name"]:
        return None, rejection(row, "detail name mismatch")

    row_birthday = normalize_birthday(row.get("birthday", ""))
    if detail_birthday and row_birthday and detail_birthday != row_birthday:
        return None, rejection(row, "birthday mismatch")

    team_id = row.get("teamId", "")
    if team_id not in TEAM_NAMES:
        return None, rejection(row, "missing or unmapped team")

    position_group, handedness_text = parse_position_detail(detail_position_text)
    position = map_position_text(position_group) or row.get("position") or "unknown"
    if position not in {"P", "C", "IF", "OF"}:
        position = "unknown"

    birthday = detail_birthday or row_birthday
    handedness = handedness_text
    throws, bats = parse_handedness(handedness_text)
    role = "pitcher" if position == "P" else "hitter" if position in {"C", "IF", "OF"} else "unknown"

    if not row.get("name") or not row.get("playerId") or not row.get("detailUrl"):
        return None, rejection(row, "missing name/playerId/detailUrl")

    source_urls = unique_strings([SEARCH_PAGE_URL, row["detailUrl"]])
    candidate = {
        "name": row["name"],
        "teamId": team_id,
        "teamName": TEAM_NAMES[team_id],
        "role": role,
        "position": position,
        "positionGroup": position_group or row.get("sourcePositionText", "") or "unknown",
        "bats": bats,
        "throws": throws,
        "age": age_from_birthday(birthday),
        "jerseyNumber": row.get("jerseyNumber", ""),
        "status": "candidate",
        "source": row.get("source", "KBO 선수조회"),
        "candidateType": row.get("candidateType", "unknown"),
        "playerId": row["playerId"],
        "birthday": birthday,
        "body": detail_body or row.get("body", ""),
        "handedness": handedness,
        "school": row.get("school", ""),
        "sourceTeamText": row.get("sourceTeamText", ""),
        "sourcePositionText": row.get("sourcePositionText", ""),
        "sourceUrls": source_urls,
        "sourceQueries": row.get("sourceQueries", []),
    }
    if row.get("reviewNote"):
        candidate["reviewNote"] = row["reviewNote"]
    if detail_error:
        candidate["reviewNote"] = (candidate.get("reviewNote", "") + f" 상세 페이지 요청 실패: {detail_error}").strip()
    if position == "unknown":
        candidate["reviewNote"] = (candidate.get("reviewNote", "") + " 광범위 포지션은 수동 확인 필요.").strip()
    return candidate, None


def rejection(row: dict, reason: str) -> dict:
    return {
        "playerId": row.get("playerId", ""),
        "name": row.get("name", ""),
        "teamId": row.get("teamId", ""),
        "sourceTeamText": row.get("sourceTeamText", ""),
        "birthday": row.get("birthday", ""),
        "detailUrl": row.get("detailUrl", ""),
        "candidateType": row.get("candidateType", ""),
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


def fetch_base_form(timeout: int) -> dict[str, str]:
    return parse_input_values(request_html(SEARCH_ENTRY_URL, timeout=timeout))


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


def span_text(page_html: str, id_suffix: str) -> str:
    pattern = rf"<span\b[^>]*id=\"[^\"]*{re.escape(id_suffix)}\"[^>]*>(.*?)</span>"
    match = re.search(pattern, page_html, flags=re.IGNORECASE | re.DOTALL)
    return clean_text(match.group(1)) if match else ""


def parse_position_detail(value: str) -> tuple[str, str]:
    match = re.match(r"\s*([^()]+?)\s*(?:\(([^)]*)\))?\s*$", value or "")
    if not match:
        return "", ""
    return match.group(1).strip(), (match.group(2) or "").strip()


def parse_handedness(value: str) -> tuple[str, str]:
    if "투" not in value or "타" not in value:
        return "", ""

    throws = "L" if value.startswith("좌") else "R"
    if "양타" in value:
        bats = "S"
    elif "좌타" in value:
        bats = "L"
    elif "우타" in value:
        bats = "R"
    else:
        bats = ""
    return throws, bats


def map_position_text(label: str) -> str:
    return POSITION_TEXT_TO_POSITION.get((label or "").strip(), "")


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
    match = re.match(r"(\d{4})-\d{2}-\d{2}", value or "")
    if not match:
        return 26
    return max(17, 2026 - int(match.group(1)))


def clean_text(fragment: str) -> str:
    no_tags = re.sub(r"<[^>]+>", "", fragment or "")
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


def unique_strings(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            result.append(value)
            seen.add(value)
    return result


def count_by(items: list[dict], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = item.get(key, "unknown")
        counts[value] = counts.get(value, 0) + 1
    return counts


def position_rank(position: str) -> int:
    return {"P": 0, "C": 1, "IF": 2, "OF": 3, "unknown": 4}.get(position, 5)


if __name__ == "__main__":
    sys.exit(main())
