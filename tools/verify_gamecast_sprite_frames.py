#!/usr/bin/env python3
"""Audit every dense Gamecast sprite frame and render a labeled QA contact sheet."""

from __future__ import annotations

import argparse
import json
import math
from collections import deque
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFont

from build_gamecast_sprites import (
    FRAME,
    LEG_GAP_PROBES,
    LEGACY_TO_V2_BASE,
    JERSEY_AWAY,
    JERSEY_AWAY_HIGHLIGHT,
    JERSEY_AWAY_SHADOW,
    JERSEY_HOME,
    JERSEY_HOME_HIGHLIGHT,
    JERSEY_HOME_SHADOW,
    SKIN,
    SKIN_HIGHLIGHT,
    SKIN_SHADOW,
    apply_night_rimlight,
    alpha_intervals,
    opaque_bbox,
)
from build_gamecast_motion_v3 import (
    STATIC_POSES,
    V3_ANIMATIONS,
    build_animation_frames,
    build_v2_base_frames,
    make_native_display_frame,
    prepare_v3_base_frames,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "assets" / "gamecast" / "source" / "player-sheet-128-contract.png"
DEFAULT_ATLAS = ROOT / "assets" / "gamecast" / "player-home.png"
DEFAULT_JSON = ROOT / "assets" / "gamecast" / "player-home.json"
DEFAULT_CONTACT = ROOT / "reports" / "gamecast-v3-frame-qa-contact-sheet.png"
DEFAULT_CATCHER_CONTACT = ROOT / "reports" / "catcher-front-back-qa.png"
EXPECTED_DENSE_FRAMES = 115
SKIN_COLORS = frozenset({SKIN[:3], SKIN_SHADOW[:3], SKIN_HIGHLIGHT[:3]})
CAGE_LIGHT_COLORS = frozenset({
    JERSEY_HOME[:3],
    JERSEY_HOME_SHADOW[:3],
    JERSEY_HOME_HIGHLIGHT[:3],
    JERSEY_AWAY[:3],
    JERSEY_AWAY_SHADOW[:3],
    JERSEY_AWAY_HIGHLIGHT[:3],
})

# A dense frame is a translated copy of one of these vetted legacy poses. Keeping
# this allow-list semantic catches equipment leaks that palette counts cannot: a
# brown glove and a wooden bat intentionally share neighboring brown tones.
ALLOWED_LEGACY_POSES = {
    "swing": frozenset({"stance", "swing", "follow"}),
    "pitch": frozenset({"windup", "pitch"}),
    "run": frozenset({"run1", "run2"}),
    "walk": frozenset({"walk1", "idle"}),
    "throw": frozenset({"field", "pitch"}),
    "catch": frozenset({"field", "catch"}),
    "dive": frozenset({"field", "dive"}),
    "slide": frozenset({"run2", "slide"}),
    "catcher": frozenset({"catcher"}),
    "static": frozenset({"idle", "field", "take", "miss", "lookUp"}),
}


def crop_frame(atlas: Image.Image, payload: Mapping[str, object], name: str) -> Image.Image:
    entry = payload["frames"][name]["frame"]
    left = int(entry["x"])
    top = int(entry["y"])
    width = int(entry["w"])
    height = int(entry["h"])
    return atlas.crop((left, top, left + width, top + height)).convert("RGBA")


def dense_frame_records(payload: Mapping[str, object]) -> List[Tuple[str, str, str]]:
    records: List[Tuple[str, str, str]] = []
    seen: set[str] = set()
    for family, animation in payload.get("animations", {}).items():
        for index, name in enumerate(animation.get("frames", [])):
            if name in seen:
                raise AssertionError(f"duplicate dense frame name: {name}")
            seen.add(name)
            records.append((family, name, source_pose_for_animation(family, index)))
    for name in STATIC_POSES:
        if name in seen:
            raise AssertionError(f"static frame collides with animation frame: {name}")
        seen.add(name)
        records.append(("static", name, LEGACY_TO_V2_BASE.get(name, name)))
    return records


def source_pose_for_animation(family: str, index: int) -> str:
    spec = V3_ANIMATIONS[family]
    count = int(spec["count"])
    keys = list(spec["keys"])
    normalized = 0.0 if count <= 1 else index / (count - 1)
    segment_position = normalized * max(0, len(keys) - 1)
    left_index = min(len(keys) - 2, int(math.floor(segment_position)))
    local_t = segment_position - left_index
    selected_key = str(keys[left_index if local_t < 0.5 else left_index + 1][0])
    return LEGACY_TO_V2_BASE.get(selected_key, selected_key)


def expected_dense_frames(source: Image.Image, uniform: str, night: bool) -> Dict[str, Image.Image]:
    base = build_v2_base_frames(source, uniform, True)
    prepared = prepare_v3_base_frames(base)
    expected: Dict[str, Image.Image] = {}
    for family, spec in V3_ANIMATIONS.items():
        expected.update(build_animation_frames(prepared, family, spec))
    for pose in STATIC_POSES:
        expected[pose] = prepared[pose]
    native = {name: make_native_display_frame(frame) for name, frame in expected.items()}
    if night:
        native = {name: apply_night_rimlight(frame) for name, frame in native.items()}
    return native


def alpha_components(image: Image.Image) -> List[Tuple[int, Tuple[int, int, int, int]]]:
    alpha = image.getchannel("A")
    visited: set[Tuple[int, int]] = set()
    components: List[Tuple[int, Tuple[int, int, int, int]]] = []
    for seed_y in range(image.height):
        for seed_x in range(image.width):
            seed = (seed_x, seed_y)
            if seed in visited or alpha.getpixel(seed) == 0:
                continue
            queue: deque[Tuple[int, int]] = deque([seed])
            visited.add(seed)
            count = 0
            left = right = seed_x
            top = bottom = seed_y
            while queue:
                x, y = queue.popleft()
                count += 1
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
                for ny in range(max(0, y - 1), min(image.height, y + 2)):
                    for nx in range(max(0, x - 1), min(image.width, x + 2)):
                        point = (nx, ny)
                        if point not in visited and alpha.getpixel(point) > 0:
                            visited.add(point)
                            queue.append(point)
            components.append((count, (left, top, right + 1, bottom + 1)))
    return sorted(components, reverse=True)


def bottom_row_metrics(image: Image.Image) -> Tuple[int, int]:
    bbox = opaque_bbox(image)
    if bbox is None:
        return (0, 0)
    left, top, right, bottom = bbox
    minimum_strip_width = max(24, round((right - left) * 0.40))
    wide_rows = 0
    separated_rows = 0
    for y in range(max(top, bottom - 16), bottom):
        intervals = alpha_intervals(image, y)
        widest = max((end - start + 1 for start, end in intervals), default=0)
        if y >= bottom - 12:
            wide_rows += widest >= minimum_strip_width
        separated_rows += any(
            intervals[index + 1][0] - intervals[index][1] - 1 >= 2
            for index in range(len(intervals) - 1)
        )
    return wide_rows, separated_rows


def catcher_face_skin_count(image: Image.Image) -> int:
    bbox = opaque_bbox(image)
    if bbox is None:
        return 0
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    core_left = left + round(width * 0.28)
    core_right = left + round(width * 0.72)
    core_top = top + round(height * 0.05)
    core_bottom = min(image.height, top + round(height * 0.44))
    pixels = image.load()
    return sum(
        pixels[x, y][3] > 0 and pixels[x, y][:3] in SKIN_COLORS
        for y in range(core_top, core_bottom)
        for x in range(core_left, core_right)
    )


def catcher_front_cage_light_count(image: Image.Image) -> int:
    bbox = opaque_bbox(image)
    if bbox is None:
        return 0
    left, top, right, bottom = bbox
    width = right - left
    height = bottom - top
    core_left = left + round(width * 0.28)
    core_right = left + round(width * 0.72)
    core_top = top + round(height * 0.05)
    core_bottom = top + round(height * 0.30)
    pixels = image.load()
    return sum(
        pixels[x, y][3] > 0 and pixels[x, y][:3] in CAGE_LIGHT_COLORS
        for y in range(core_top, core_bottom)
        for x in range(core_left, core_right)
    )


def audit_frames(
    source: Image.Image,
    atlas: Image.Image,
    payload: Mapping[str, object],
) -> Tuple[List[str], List[Dict[str, object]]]:
    issues: List[str] = []
    records = dense_frame_records(payload)
    if len(records) != EXPECTED_DENSE_FRAMES:
        issues.append(f"dense frame count {len(records)} != {EXPECTED_DENSE_FRAMES}")
    meta = payload.get("meta", {})
    image_name = str(meta.get("image", ""))
    uniform = "away" if image_name.startswith("player-away") else "home"
    night = meta.get("lighting") == "night"
    expected = expected_dense_frames(source, uniform, night)
    if set(expected) != {name for _family, name, _pose in records}:
        issues.append("atlas dense frame names do not match builder output")

    alpha = atlas.getchannel("A")
    atlas_alpha = set(alpha.get_flattened_data() if hasattr(alpha, "get_flattened_data") else alpha.getdata())
    if not atlas_alpha.issubset({0, 255}):
        issues.append(f"atlas alpha is not binary: {sorted(atlas_alpha)[:8]}")
    if payload.get("meta", {}).get("catcherView") != "back-facing":
        issues.append("atlas meta.catcherView must be 'back-facing'")
    if payload.get("meta", {}).get("nativeRenderScale") != 1:
        issues.append("atlas meta.nativeRenderScale must be 1")

    diagnostics: List[Dict[str, object]] = []
    for family, name, source_pose in records:
        frame = crop_frame(atlas, payload, name)
        expected_frame = expected.get(name)
        if expected_frame is None or frame.tobytes() != expected_frame.tobytes():
            issues.append(f"{name}: atlas pixels differ from deterministic builder output")

        allowed = ALLOWED_LEGACY_POSES[family]
        if source_pose not in allowed:
            issues.append(
                f"{name}: {family} illegally derives from legacy '{source_pose}' "
                f"(allowed: {', '.join(sorted(allowed))})"
            )

        border_opaque = any(
            frame.getpixel((x, y))[3] > 0
            for x, y in (
                *((x, 0) for x in range(FRAME)),
                *((x, FRAME - 1) for x in range(FRAME)),
                *((0, y) for y in range(FRAME)),
                *((FRAME - 1, y) for y in range(FRAME)),
            )
        )
        if border_opaque:
            issues.append(f"{name}: opaque pixel touches the frame border")

        components = alpha_components(frame)
        detached = components[1][0] if len(components) > 1 else 0

        wide_rows, separated_rows = bottom_row_metrics(frame)
        requires_leg_gap = source_pose in LEG_GAP_PROBES
        if requires_leg_gap and source_pose != "catcher" and wide_rows >= 3:
            issues.append(f"{name}: {wide_rows} wide bottom rows look like a baked platform")
        if requires_leg_gap and separated_rows == 0:
            issues.append(f"{name}: no transparent separation between lower-body/foot intervals")

        face_skin = catcher_face_skin_count(frame) if family == "catcher" else 0
        front_cage = catcher_front_cage_light_count(frame) if family == "catcher" else 0
        if family == "catcher" and face_skin:
            issues.append(f"{name}: back-facing mask core still exposes {face_skin} skin pixels")
        if family == "catcher" and front_cage:
            issues.append(f"{name}: front-facing cage grid remains ({front_cage} light pixels)")

        diagnostics.append({
            "family": family,
            "name": name,
            "sourcePose": source_pose,
            "components": [size for size, _bbox in components[:4]],
            "detachedPixels": detached,
            "wideBottomRows": wide_rows,
            "separatedBottomRows": separated_rows,
            "catcherFaceSkin": face_skin,
            "catcherFrontCageLight": front_cage,
        })
    return issues, diagnostics


def load_font(size: int) -> ImageFont.ImageFont:
    candidates = (
        Path("C:/Windows/Fonts/consola.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    )
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def checker_tile(frame: Image.Image, scale: int) -> Image.Image:
    background = Image.new("RGB", frame.size, (224, 228, 234))
    draw = ImageDraw.Draw(background)
    checker = 8
    for y in range(0, frame.height, checker):
        for x in range(0, frame.width, checker):
            if (x // checker + y // checker) % 2:
                draw.rectangle((x, y, x + checker - 1, y + checker - 1), fill=(190, 197, 207))
    background.paste(frame, (0, 0), frame)
    return background.resize((frame.width * scale, frame.height * scale), Image.Resampling.NEAREST)


def write_contact_sheet(
    atlas: Image.Image,
    payload: Mapping[str, object],
    diagnostics: Sequence[Mapping[str, object]],
    path: Path,
) -> None:
    scale = 2
    columns = 8
    image_size = FRAME * scale
    label_height = 36
    rows = math.ceil(len(diagnostics) / columns)
    sheet = Image.new("RGB", (columns * image_size, rows * (image_size + label_height)), (29, 34, 42))
    draw = ImageDraw.Draw(sheet)
    font = load_font(13)
    for index, diagnostic in enumerate(diagnostics):
        name = str(diagnostic["name"])
        frame = crop_frame(atlas, payload, name)
        x = index % columns * image_size
        y = index // columns * (image_size + label_height)
        sheet.paste(checker_tile(frame, scale), (x, y))
        source_pose = str(diagnostic["sourcePose"])
        detached = int(diagnostic["detachedPixels"])
        label = f"{name} <- {source_pose}  d={detached}"
        draw.rectangle((x, y + image_size, x + image_size - 1, y + image_size + label_height - 1), fill=(29, 34, 42))
        draw.text((x + 5, y + image_size + 9), label, font=font, fill=(246, 248, 252))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def write_catcher_contact_sheet(
    source: Image.Image,
    atlas: Image.Image,
    payload: Mapping[str, object],
    path: Path,
) -> None:
    meta = payload.get("meta", {})
    image_name = str(meta.get("image", ""))
    uniform = "away" if image_name.startswith("player-away") else "home"
    front = make_native_display_frame(build_v2_base_frames(source, uniform, True)["catcher_frame"])
    if meta.get("lighting") == "night":
        front = apply_night_rimlight(front)
    back = crop_frame(atlas, payload, "catcher_00")
    scale = 4
    image_size = FRAME * scale
    label_height = 48
    sheet = Image.new("RGB", (image_size * 2, image_size + label_height), (29, 34, 42))
    draw = ImageDraw.Draw(sheet)
    font = load_font(20)
    for index, (label, frame) in enumerate((("SOURCE: FRONT", front), ("CONTRACT: REAR HELMET + HARNESS", back))):
        x = index * image_size
        sheet.paste(checker_tile(frame, scale), (x, 0))
        draw.rectangle((x, image_size, x + image_size - 1, image_size + label_height - 1), fill=(29, 34, 42))
        draw.text((x + 10, image_size + 12), label, font=font, fill=(246, 248, 252))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def write_json_report(diagnostics: Iterable[Mapping[str, object]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames = list(diagnostics)
    payload = {"frameCount": len(frames), "frames": frames}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--atlas", type=Path, default=DEFAULT_ATLAS)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--contact-sheet", type=Path, default=DEFAULT_CONTACT)
    parser.add_argument("--catcher-contact-sheet", type=Path, default=DEFAULT_CATCHER_CONTACT)
    parser.add_argument("--no-contact-sheets", action="store_true")
    parser.add_argument("--report-json", type=Path)
    args = parser.parse_args()

    source = Image.open(args.source).convert("RGBA")
    atlas = Image.open(args.atlas).convert("RGBA")
    payload = json.loads(args.json.read_text(encoding="utf-8"))
    issues, diagnostics = audit_frames(source, atlas, payload)
    if not args.no_contact_sheets:
        write_contact_sheet(atlas, payload, diagnostics, args.contact_sheet)
        write_catcher_contact_sheet(source, atlas, payload, args.catcher_contact_sheet)
    if args.report_json:
        write_json_report(diagnostics, args.report_json)

    if issues:
        print("sprite frame audit:")
        for issue in issues:
            print(f"  ERROR {issue}")
        raise SystemExit("sprite frame audit failed")
    print(
        f"sprite frame audit: ok ({len(diagnostics)} frames; "
        f"contact sheet: {args.contact_sheet})"
    )


if __name__ == "__main__":
    main()
