#!/usr/bin/env python3
"""Build Gamecast v2 field images and anchor maps from marked image sources."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from PIL import Image


DESIGN_W = 960
DESIGN_H = 720
PALETTE_COLORS = 32

MARKERS: Dict[str, Tuple[int, int, int]] = {
    "home": (255, 0, 255),
    "first": (255, 0, 215),
    "second": (255, 0, 175),
    "third": (255, 0, 135),
    "mound": (255, 0, 95),
    "P": (215, 0, 255),
    "C": (175, 0, 255),
    "1B": (135, 0, 255),
    "2B": (95, 0, 255),
    "3B": (55, 0, 255),
    "SS": (255, 55, 215),
    "LF": (255, 95, 175),
    "CF": (255, 135, 135),
    "RF": (255, 175, 95),
    "leftPole": (255, 215, 55),
    "rightPole": (215, 255, 55),
    "scoreboardTl": (175, 255, 55),
}

FIELD_MARKERS: Dict[str, Dict[str, Tuple[int, int]]] = {
    "field-jamsil-day": {
        "home": (480, 617),
        "first": (758, 415),
        "second": (480, 321),
        "third": (202, 415),
        "mound": (480, 407),
        "P": (480, 414),
        "C": (480, 646),
        "1B": (724, 438),
        "2B": (592, 347),
        "3B": (236, 438),
        "SS": (368, 347),
        "LF": (245, 270),
        "CF": (480, 230),
        "RF": (715, 270),
        "leftPole": (42, 252),
        "rightPole": (918, 252),
        "scoreboardTl": (401, 64),
    },
    "field-jamsil-night": {
        "home": (480, 622),
        "first": (742, 414),
        "second": (480, 344),
        "third": (218, 414),
        "mound": (480, 441),
        "P": (480, 448),
        "C": (480, 650),
        "1B": (696, 430),
        "2B": (590, 361),
        "3B": (264, 430),
        "SS": (370, 361),
        "LF": (260, 280),
        "CF": (480, 240),
        "RF": (700, 280),
        "leftPole": (18, 254),
        "rightPole": (942, 254),
        "scoreboardTl": (394, 86),
    },
    "field-gocheok-dome": {
        "home": (480, 632),
        "first": (724, 445),
        "second": (480, 363),
        "third": (236, 445),
        "mound": (480, 460),
        "P": (480, 467),
        "C": (480, 660),
        "1B": (688, 430),
        "2B": (589, 388),
        "3B": (272, 430),
        "SS": (371, 388),
        "LF": (270, 295),
        "CF": (480, 260),
        "RF": (690, 295),
        "leftPole": (25, 247),
        "rightPole": (935, 247),
        "scoreboardTl": (404, 84),
    },
}

# Batter boxes are painted differently in each source field and are not part
# of the base-path marker set. Keep an explicit foot anchor inside the visible
# right-handed batter's box so rebuilding the field cannot reintroduce the
# old home-to-first geometric approximation.
FIELD_BATTER_ANCHORS: Dict[str, Tuple[int, int]] = {
    "field-jamsil-day": (516, 622),
    "field-jamsil-night": (513, 600),
    "field-gocheok-dome": (507, 614),
}

FIELD_NAMES = {
    "field-jamsil-day": "잠실 낮",
    "field-jamsil-night": "잠실 밤",
    "field-gocheok-dome": "고척 돔",
}


def center_crop_to_aspect(image: Image.Image, width: int, height: int) -> Image.Image:
    src_w, src_h = image.size
    target_aspect = width / height
    src_aspect = src_w / src_h
    if src_aspect > target_aspect:
        crop_w = round(src_h * target_aspect)
        left = (src_w - crop_w) // 2
        box = (left, 0, left + crop_w, src_h)
    else:
        crop_h = round(src_w / target_aspect)
        top = (src_h - crop_h) // 2
        box = (0, top, src_w, top + crop_h)
    return image.crop(box)


def quantize(image: Image.Image, colors: int = PALETTE_COLORS) -> Image.Image:
    rgba = image.convert("RGBA")
    opaque = Image.new("RGBA", rgba.size, (0, 0, 0, 255))
    opaque.alpha_composite(rgba)
    palette = opaque.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT)
    return palette.convert("RGBA")


def normalize_raw_image(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    cropped = center_crop_to_aspect(image, DESIGN_W, DESIGN_H)
    resized = cropped.resize((DESIGN_W, DESIGN_H), Image.Resampling.LANCZOS)
    return quantize(resized)


def stamp_markers(image: Image.Image, field_id: str) -> Image.Image:
    stamped = image.copy().convert("RGBA")
    pixels = stamped.load()
    for name, (x, y) in FIELD_MARKERS[field_id].items():
        color = (*MARKERS[name], 255)
        for yy in range(y - 1, y + 2):
            for xx in range(x - 1, x + 2):
                if 0 <= xx < DESIGN_W and 0 <= yy < DESIGN_H:
                    pixels[xx, yy] = color
    return stamped


def marker_rgb_set() -> set[Tuple[int, int, int]]:
    return set(MARKERS.values())


def find_marker_pixels(image: Image.Image) -> Tuple[Dict[str, List[Tuple[int, int]]], set[Tuple[int, int]]]:
    pixels = image.convert("RGBA").load()
    found: Dict[str, List[Tuple[int, int]]] = {name: [] for name in MARKERS}
    marker_to_name = {rgb: name for name, rgb in MARKERS.items()}
    all_marker_pixels: set[Tuple[int, int]] = set()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a <= 0:
                continue
            name = marker_to_name.get((r, g, b))
            if name:
                found[name].append((x, y))
                all_marker_pixels.add((x, y))
    return found, all_marker_pixels


def replace_marker_pixel(pixels, x: int, y: int, blocked: set[Tuple[int, int]]) -> Tuple[int, int, int, int]:
    for radius in range(1, 9):
        samples: List[Tuple[int, int, int, int]] = []
        for yy in range(y - radius, y + radius + 1):
            for xx in range(x - radius, x + radius + 1):
                if xx < 0 or yy < 0 or xx >= DESIGN_W or yy >= DESIGN_H or (xx, yy) in blocked:
                    continue
                if abs(xx - x) != radius and abs(yy - y) != radius:
                    continue
                r, g, b, a = pixels[xx, yy]
                if a > 0 and (r, g, b) not in marker_rgb_set():
                    samples.append((r, g, b, a))
        if samples:
            samples.sort()
            return samples[len(samples) // 2]
    return (0, 0, 0, 255)


def clean_markers(image: Image.Image, marker_pixels: set[Tuple[int, int]]) -> Image.Image:
    cleaned = image.copy().convert("RGBA")
    pixels = cleaned.load()
    for x, y in marker_pixels:
        pixels[x, y] = replace_marker_pixel(pixels, x, y, marker_pixels)
    return cleaned


def restamp_marked_sources(source_dir: Path) -> None:
    for field_id in FIELD_MARKERS:
        source_path = source_dir / f"{field_id}.marked.png"
        if not source_path.exists():
            raise SystemExit(f"missing marked source for restamp: {source_path}")
        source = Image.open(source_path).convert("RGBA")
        if source.size != (DESIGN_W, DESIGN_H):
            raise SystemExit(f"{source_path}: expected {DESIGN_W}x{DESIGN_H}, got {source.size[0]}x{source.size[1]}")
        _found, marker_pixels = find_marker_pixels(source)
        cleaned = clean_markers(source, marker_pixels)
        restamped = stamp_markers(cleaned, field_id)
        restamped.save(source_path)
        print(f"restamped {source_path}")


def depth_scale(y: float) -> float:
    return round(max(0.62, min(1.04, 0.56 + (y / DESIGN_H) * 0.52)), 2)


def build_anchor_payload(field_id: str, found: Dict[str, List[Tuple[int, int]]]) -> Dict[str, object]:
    anchors = {}
    missing = [name for name, pixels in found.items() if not pixels]
    if missing:
        raise SystemExit(f"{field_id}: missing anchor markers: {', '.join(missing)}")
    for name, pixels in found.items():
        x = sum(point[0] for point in pixels) / len(pixels)
        y = sum(point[1] for point in pixels) / len(pixels)
        anchors[name] = {
            "x": round(x, 2),
            "y": round(y, 2),
            "scale": depth_scale(y),
        }
    if field_id in FIELD_BATTER_ANCHORS:
        batter_x, batter_y = FIELD_BATTER_ANCHORS[field_id]
        anchors["batter"] = {
            "x": float(batter_x),
            "y": float(batter_y),
            "scale": depth_scale(batter_y),
        }
    return {
        "fieldId": field_id,
        "name": FIELD_NAMES.get(field_id, field_id),
        "image": f"{field_id}.png",
        "design": {"width": DESIGN_W, "height": DESIGN_H},
        "markerCount": sum(len(points) for points in found.values()),
        "anchors": anchors,
        "paths": {
            "bases": ["home", "first", "second", "third", "home"],
            "outfield": ["LF", "CF", "RF"],
            "poles": ["leftPole", "rightPole"],
        },
    }


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_prepare_args(entries: Iterable[str]) -> Dict[str, Path]:
    result: Dict[str, Path] = {}
    for entry in entries:
        if "=" not in entry:
            raise SystemExit(f"--prepare must be FIELD_ID=PNG_PATH, got {entry!r}")
        field_id, raw_path = entry.split("=", 1)
        if field_id not in FIELD_MARKERS:
            raise SystemExit(f"unknown field id for --prepare: {field_id}")
        result[field_id] = Path(raw_path)
    return result


def prepare_sources(source_dir: Path, raw_paths: Dict[str, Path]) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    for field_id, raw_path in raw_paths.items():
        normalized = normalize_raw_image(raw_path)
        marked = stamp_markers(normalized, field_id)
        out_path = source_dir / f"{field_id}.marked.png"
        marked.save(out_path)
        print(f"prepared {out_path}")


def build_fields(source_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for field_id in FIELD_MARKERS:
        source_path = source_dir / f"{field_id}.marked.png"
        if not source_path.exists():
            raise SystemExit(f"missing marked source: {source_path}")
        source = Image.open(source_path).convert("RGBA")
        if source.size != (DESIGN_W, DESIGN_H):
            raise SystemExit(f"{source_path}: expected {DESIGN_W}x{DESIGN_H}, got {source.size[0]}x{source.size[1]}")
        found, marker_pixels = find_marker_pixels(source)
        payload = build_anchor_payload(field_id, found)
        cleaned = quantize(clean_markers(source, marker_pixels), PALETTE_COLORS)
        cleaned.save(out_dir / f"{field_id}.png")
        write_json(out_dir / f"{field_id}.anchors.json", payload)
        manifest.append({
            "id": field_id,
            "name": FIELD_NAMES.get(field_id, field_id),
            "image": f"{field_id}.png",
            "anchors": f"{field_id}.anchors.json",
        })
        print(f"built {field_id}: {len(payload['anchors'])} anchors, {len(marker_pixels)} marker pixels removed")
    write_json(out_dir / "fields.json", {"version": 1, "design": {"width": DESIGN_W, "height": DESIGN_H}, "fields": manifest})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", default=Path("assets/gamecast2/source"), type=Path)
    parser.add_argument("--out", default=Path("assets/gamecast2"), type=Path)
    parser.add_argument("--prepare", action="append", default=[], metavar="FIELD_ID=PNG_PATH")
    parser.add_argument("--restamp-sources", action="store_true", help="remove existing marker pixels and stamp FIELD_MARKERS onto committed sources")
    args = parser.parse_args()

    raw_paths = parse_prepare_args(args.prepare)
    if raw_paths:
        prepare_sources(args.source_dir, raw_paths)
    if args.restamp_sources:
        restamp_marked_sources(args.source_dir)
    build_fields(args.source_dir, args.out)


if __name__ == "__main__":
    main()
