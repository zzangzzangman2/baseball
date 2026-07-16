#!/usr/bin/env python3
"""Verify player colors against checked-in field surfaces and render QA crops."""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path
from typing import Iterable, Mapping, Sequence, Tuple

from PIL import Image, ImageDraw

from build_gamecast_sprites import (
    BAT,
    BAT_HIGHLIGHT,
    BAT_SHADOW,
    CENTER_X,
    GLOVE,
    GLOVE_HIGHLIGHT,
    JERSEY_AWAY,
    JERSEY_AWAY_HIGHLIGHT,
    JERSEY_AWAY_SHADOW,
    MIN_FIELD_SURFACE_RGB_DISTANCE,
    OUTLINE,
    OUTLINE_SOFT,
    SEL_OUTLINE_COLORS,
    SKIN,
    SKIN_HIGHLIGHT,
    SKIN_SHADOW,
    BASELINE_Y,
)


ROOT = Path(__file__).resolve().parents[1]
FIELD_DIR = ROOT / "assets" / "gamecast2"
ATLAS_DIR = ROOT / "assets" / "gamecast"
FIELD_NAMES = ("field-jamsil-day",)
ANCHOR_NAMES = ("home", "first", "second", "third", "mound", "P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF")
POSES = (
    ("FIELD", "field", "1B"),
    ("RUN", "run_03", "first"),
    ("CATCH", "catch_05", "second"),
    ("THROW", "throw_05", "3B"),
)

# Pre-change values are retained only to make an optional before/after audit
# reproducible. The strict contract always evaluates CURRENT_PALETTE.
BEFORE_PALETTE = {
    "selout": (65, 61, 72),
    "skin-shadow": (207, 154, 106),
    "skin": (242, 199, 154),
    "skin-highlight": (255, 224, 181),
    "away-jersey-shadow": (99, 97, 91),
    "away-jersey": (141, 138, 130),
    "away-jersey-highlight": (185, 182, 173),
    "equipment-shadow": (95, 63, 39),
    "equipment": (138, 95, 57),
    "equipment-highlight": (187, 135, 80),
    "glove": (112, 75, 45),
    "glove-highlight": (165, 114, 67),
}

CURRENT_PALETTE = {
    "outline": OUTLINE[:3],
    "selout": OUTLINE_SOFT[:3],
    "skin-shadow": SKIN_SHADOW[:3],
    "skin": SKIN[:3],
    "skin-highlight": SKIN_HIGHLIGHT[:3],
    "away-jersey-shadow": JERSEY_AWAY_SHADOW[:3],
    "away-jersey": JERSEY_AWAY[:3],
    "away-jersey-highlight": JERSEY_AWAY_HIGHLIGHT[:3],
    "equipment-shadow": BAT_SHADOW[:3],
    "equipment": BAT[:3],
    "equipment-highlight": BAT_HIGHLIGHT[:3],
    "glove": GLOVE[:3],
    "glove-highlight": GLOVE_HIGHLIGHT[:3],
}


def rgb_distance(first: Sequence[int], second: Sequence[int]) -> float:
    return math.sqrt(sum((int(first[index]) - int(second[index])) ** 2 for index in range(3)))


def relative_luminance(color: Sequence[int]) -> float:
    channels = []
    for value in color[:3]:
        channel = int(value) / 255
        channels.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast_ratio(first: Sequence[int], second: Sequence[int]) -> float:
    first_luma = relative_luminance(first)
    second_luma = relative_luminance(second)
    return (max(first_luma, second_luma) + 0.05) / (min(first_luma, second_luma) + 0.05)


def read_json(path: Path) -> Mapping[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def sampled_field_colors() -> Tuple[Tuple[int, int, int], ...]:
    colors = []
    for field_name in FIELD_NAMES:
        anchors = read_json(FIELD_DIR / f"{field_name}.anchors.json")["anchors"]
        field = Image.open(FIELD_DIR / f"{field_name}.png").convert("RGB")
        samples: Counter[Tuple[int, int, int]] = Counter()
        for name in ANCHOR_NAMES:
            anchor = anchors[name]
            x = round(float(anchor["x"]))
            y = round(float(anchor["y"]))
            samples.update(field.crop((x - 20, y - 20, x + 21, y + 21)).get_flattened_data())
        colors.extend(color for color, _count in samples.most_common(12))
    return tuple(dict.fromkeys(colors))


def palette_metrics(
    palette: Mapping[str, Tuple[int, int, int]],
    surfaces: Iterable[Tuple[int, int, int]],
) -> Mapping[str, Tuple[float, float, Tuple[int, int, int]]]:
    surfaces = tuple(surfaces)
    result = {}
    for name, color in palette.items():
        nearest = min(surfaces, key=lambda surface: rgb_distance(color, surface))
        result[name] = (
            rgb_distance(color, nearest),
            min(contrast_ratio(color, surface) for surface in surfaces),
            nearest,
        )
    return result


def frame_image(atlas: Image.Image, metadata: Mapping[str, object], name: str) -> Image.Image:
    frame = metadata["frames"][name]["frame"]
    return atlas.crop((
        int(frame["x"]),
        int(frame["y"]),
        int(frame["x"]) + int(frame["w"]),
        int(frame["y"]) + int(frame["h"]),
    ))


def boundary_coverage(frame: Image.Image) -> float:
    image = frame.convert("RGBA")
    pixels = image.load()
    boundary = []
    for y in range(image.height):
        for x in range(image.width):
            pixel = pixels[x, y]
            if pixel[3] == 0:
                continue
            if any(
                nx < 0
                or ny < 0
                or nx >= image.width
                or ny >= image.height
                or pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            ):
                boundary.append(pixel[:3])
    if not boundary:
        return 0.0
    return sum(color in SEL_OUTLINE_COLORS for color in boundary) / len(boundary)


def render_crop(
    field: Image.Image,
    anchors: Mapping[str, object],
    atlas: Image.Image,
    metadata: Mapping[str, object],
    frame_name: str,
    anchor_name: str,
) -> Image.Image:
    background = field.copy().convert("RGBA")
    anchor = anchors[anchor_name]
    x = round(float(anchor["x"]))
    y = round(float(anchor["y"]))
    sprite = frame_image(atlas, metadata, frame_name)
    background.alpha_composite(sprite, (x - CENTER_X, y - BASELINE_Y))
    crop = background.crop((x - 75, y - 110, x + 75, y + 40))
    return crop.resize((300, 300), Image.Resampling.NEAREST)


def load_atlas(png_path: Path, json_path: Path) -> Tuple[Image.Image, Mapping[str, object]]:
    return Image.open(png_path).convert("RGBA"), read_json(json_path)


def render_contact_sheet(args: argparse.Namespace) -> None:
    field = Image.open(FIELD_DIR / "field-jamsil-day.png").convert("RGBA")
    anchors = read_json(FIELD_DIR / "field-jamsil-day.anchors.json")["anchors"]
    rows = []
    if args.before_home and args.before_home_json and args.before_away and args.before_away_json:
        rows.extend((
            ("BEFORE / HOME", args.before_home, args.before_home_json),
            ("BEFORE / AWAY", args.before_away, args.before_away_json),
        ))
    rows.extend((
        ("AFTER / HOME", ATLAS_DIR / "player-home.png", ATLAS_DIR / "player-home.json"),
        ("AFTER / AWAY", ATLAS_DIR / "player-away.png", ATLAS_DIR / "player-away.json"),
    ))

    header = 34
    cell = 304
    canvas = Image.new("RGB", (cell * len(POSES), (300 + header) * len(rows)), (20, 24, 34))
    draw = ImageDraw.Draw(canvas)
    for row_index, (row_label, png_path, json_path) in enumerate(rows):
        atlas, metadata = load_atlas(png_path, json_path)
        top = row_index * (300 + header)
        for col_index, (pose_label, frame_name, anchor_name) in enumerate(POSES):
            left = col_index * cell
            draw.rectangle((left, top, left + 300, top + header - 1), fill=(28, 35, 54))
            draw.text((left + 8, top + 10), f"{row_label} / {pose_label}", fill=(255, 255, 252))
            crop = render_crop(field, anchors, atlas, metadata, frame_name, anchor_name).convert("RGB")
            canvas.paste(crop, (left, top + header))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output)
    print(f"palette QA contact sheet: {args.output} ({canvas.width}x{canvas.height})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--before-home", type=Path)
    parser.add_argument("--before-home-json", type=Path)
    parser.add_argument("--before-away", type=Path)
    parser.add_argument("--before-away-json", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    surfaces = sampled_field_colors()
    current_metrics = palette_metrics(CURRENT_PALETTE, surfaces)
    previous_metrics = palette_metrics(BEFORE_PALETTE, surfaces)
    print("field palette contrast (active Jamsil day field):")
    for name in CURRENT_PALETTE:
        distance, contrast, nearest = current_metrics[name]
        old_distance, old_contrast, _old_nearest = previous_metrics.get(name, (0.0, 0.0, (0, 0, 0)))
        print(
            f"  {name:22s} RGB {old_distance:5.1f}->{distance:5.1f}  "
            f"contrast {old_contrast:4.2f}->{contrast:4.2f}  nearest #{nearest[0]:02x}{nearest[1]:02x}{nearest[2]:02x}"
        )

    critical = (
        "skin-shadow",
        "skin",
        "skin-highlight",
        "away-jersey-shadow",
        "away-jersey",
        "away-jersey-highlight",
        "equipment-shadow",
        "equipment",
        "equipment-highlight",
        "glove",
        "glove-highlight",
    )
    failures = [
        f"{name} field distance {current_metrics[name][0]:.1f} < {MIN_FIELD_SURFACE_RGB_DISTANCE:.0f}"
        for name in critical
        if current_metrics[name][0] < MIN_FIELD_SURFACE_RGB_DISTANCE
    ]

    for uniform in ("home", "away"):
        atlas, metadata = load_atlas(ATLAS_DIR / f"player-{uniform}.png", ATLAS_DIR / f"player-{uniform}.json")
        coverages = [boundary_coverage(frame_image(atlas, metadata, name)) for _label, name, _anchor in POSES]
        minimum = min(coverages)
        print(f"  {uniform:22s} selected-pose selout {minimum:.1%}")
        if minimum < 0.95:
            failures.append(f"{uniform} selected-pose selout {minimum:.1%} < 95%")

    if args.output:
        render_contact_sheet(args)

    if failures:
        for failure in failures:
            print(f"ERROR {failure}")
        if args.strict:
            raise SystemExit("palette contrast verification failed")
    else:
        print("palette contrast verification: ok")


if __name__ == "__main__":
    main()
