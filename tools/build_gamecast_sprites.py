#!/usr/bin/env python3
"""Build crisp 48px Gamecast sprite atlases from an imagegen source sheet."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Dict, Iterable, Tuple

from PIL import Image, ImageDraw


FRAME = 48
BASELINE_Y = 45
CENTER_X = 24
SHEET_COLS = 5
SHEET_ROWS = 4

OUTLINE = (32, 32, 42, 255)
OUTLINE_SOFT = (65, 61, 72, 255)
SKIN = (242, 199, 154, 255)
SKIN_SHADOW = (207, 154, 106, 255)
CAP = (210, 59, 59, 255)
SOCK = (178, 58, 72, 255)
JERSEY_HOME = (247, 247, 242, 255)
JERSEY_HOME_SHADOW = (220, 218, 210, 255)
JERSEY_AWAY = (141, 138, 130, 255)
JERSEY_AWAY_SHADOW = (99, 97, 91, 255)
PANTS = (58, 53, 80, 255)
PANTS_SHADOW = (36, 34, 53, 255)
BAT = (138, 95, 57, 255)
BAT_SHADOW = (95, 63, 39, 255)
GLOVE = (112, 75, 45, 255)
HIGHLIGHT = (255, 240, 168, 255)
WHITE = (255, 254, 251, 255)

POSE_GRID = {
    "stance": (0, 0),
    "swing": (1, 0),
    "follow": (2, 0),
    "miss": (3, 0),
    "take": (4, 0),
    "idle": (0, 1),
    "run1": (1, 1),
    "run2": (2, 1),
    "walk1": (3, 1),
    "slide": (4, 1),
    "windup": (0, 2),
    "pitch": (1, 2),
    "field": (0, 3),
    "catch": (1, 3),
    "dive": (2, 3),
    "catcher": (3, 3),
    "lookUp": (4, 3),
}

SOURCE_GRID = dict(POSE_GRID)
SOURCE_GRID["walk2"] = SOURCE_GRID["walk1"]


def is_key_color(pixel: Tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a < 8 or (r > 185 and b > 175 and g < 85 and abs(r - b) < 80)


def luminance(r: int, g: int, b: int) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


def classify_pixel(pixel: Tuple[int, int, int, int], uniform: str) -> Tuple[int, int, int, int]:
    r, g, b, a = pixel
    if is_key_color(pixel):
        return (0, 0, 0, 0)

    lum = luminance(r, g, b)
    chroma = max(r, g, b) - min(r, g, b)

    skin_like = (
        r > 115
        and g > 72
        and b > 54
        and r >= g + 18
        and g >= b - 18
        and lum > 0.28
    )
    if skin_like:
        return SKIN_SHADOW if lum < 0.58 else SKIN

    red_score = r - max(g, b)
    if r > 125 and red_score > 24 and g < 92 and b < 120:
        return SOCK if lum < 0.42 else CAP

    if r > 135 and g > 82 and b < 138 and r > b + 28:
        return SKIN_SHADOW if lum < 0.62 else SKIN

    if lum < 0.16:
        return OUTLINE
    if lum < 0.26 and chroma < 70:
        return OUTLINE_SOFT

    if b >= r + 8 and b >= g + 4 and lum < 0.48:
        return PANTS_SHADOW if lum < 0.24 else PANTS

    if r > 80 and g > 48 and b < 96 and r >= g + 12:
        return BAT_SHADOW if lum < 0.38 else BAT

    if abs(r - g) < 18 and abs(g - b) < 18 and lum < 0.62:
        return JERSEY_AWAY_SHADOW if uniform == "away" else JERSEY_HOME_SHADOW

    if r > 172 and g > 166 and b > 146:
        return JERSEY_AWAY if uniform == "away" else JERSEY_HOME

    if r > 210 and g > 178 and b < 128:
        return HIGHLIGHT

    if lum > 0.78:
        return JERSEY_AWAY if uniform == "away" else WHITE
    if lum > 0.56:
        return JERSEY_AWAY_SHADOW if uniform == "away" else JERSEY_HOME_SHADOW
    if lum > 0.38:
        return GLOVE
    return OUTLINE_SOFT


def crop_source_cell(source: Image.Image, col: int, row: int) -> Image.Image:
    width, height = source.size
    cell_w = width / SHEET_COLS
    cell_h = height / SHEET_ROWS
    left = round(col * cell_w)
    top = round(row * cell_h)
    right = round((col + 1) * cell_w)
    bottom = round((row + 1) * cell_h)
    return source.crop((left, top, right, bottom)).convert("RGBA")


def transparent_bbox(image: Image.Image) -> Tuple[int, int, int, int] | None:
    pixels = image.load()
    width, height = image.size
    xs = []
    ys = []
    for y in range(height):
        for x in range(width):
            if not is_key_color(pixels[x, y]):
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def normalize_frame(source_cell: Image.Image, uniform: str) -> Image.Image:
    bbox = transparent_bbox(source_cell)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    if bbox is None:
        return frame

    cropped = source_cell.crop(bbox).convert("RGBA")
    cropped_pixels = cropped.load()
    for y in range(cropped.height):
        for x in range(cropped.width):
            if is_key_color(cropped_pixels[x, y]):
                cropped_pixels[x, y] = (0, 0, 0, 0)

    max_w = 43
    max_h = 42
    scale = min(max_w / cropped.width, max_h / cropped.height)
    new_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(new_size, Image.Resampling.NEAREST)
    output = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    paste_x = round(CENTER_X - new_size[0] / 2)
    paste_y = BASELINE_Y - new_size[1]
    output.alpha_composite(resized, (paste_x, paste_y))

    pixels = output.load()
    for y in range(FRAME):
        for x in range(FRAME):
            pixels[x, y] = classify_pixel(pixels[x, y], uniform)
    return output


def atlas_frame(x: int, y: int) -> Dict[str, object]:
    return {
        "frame": {"x": x, "y": y, "w": FRAME, "h": FRAME},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME, "h": FRAME},
        "sourceSize": {"w": FRAME, "h": FRAME},
    }


def write_player_atlas(source: Image.Image, output_dir: Path, uniform: str) -> None:
    image_name = f"player-{uniform}.png"
    atlas = Image.new("RGBA", (SHEET_COLS * FRAME, SHEET_ROWS * FRAME), (0, 0, 0, 0))
    frames: Dict[str, object] = {}

    for pose, (col, row) in POSE_GRID.items():
        frame = normalize_frame(crop_source_cell(source, col, row), uniform)
        x = col * FRAME
        y = row * FRAME
        atlas.alpha_composite(frame, (x, y))
        frames[pose] = atlas_frame(x, y)

    frames["load"] = frames["stance"]
    frames["walk"] = frames["walk1"]
    frames["walk2"] = frames["run1"]
    frames["run"] = frames["run1"]
    frames["coach"] = frames["idle"]
    frames["umpire"] = frames["idle"]

    atlas.save(output_dir / image_name)
    write_json(output_dir / f"player-{uniform}.json", image_name, atlas.size, frames)


def write_props_atlas(output_dir: Path) -> None:
    image_name = "props.png"
    atlas = Image.new("RGBA", (FRAME * 3, FRAME), (0, 0, 0, 0))
    frames: Dict[str, object] = {}

    for index, seam_offset in enumerate((0, 1, -1)):
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        draw = ImageDraw.Draw(frame)
        cx = FRAME // 2
        cy = FRAME // 2
        draw.rectangle((cx - 4, cy - 4, cx + 4, cy + 4), fill=OUTLINE)
        draw.rectangle((cx - 3, cy - 3, cx + 3, cy + 3), fill=WHITE)
        draw.point((cx - 2, cy + seam_offset), fill=CAP)
        draw.point((cx + 2, cy - seam_offset), fill=CAP)
        draw.point((cx - 1, cy + 1 + seam_offset), fill=SOCK)
        draw.point((cx + 1, cy - 1 - seam_offset), fill=SOCK)
        x = index * FRAME
        atlas.alpha_composite(frame, (x, 0))
        frames[f"ball{index + 1}"] = atlas_frame(x, 0)

    atlas.save(output_dir / image_name)
    write_json(output_dir / "props.json", image_name, atlas.size, frames)


def write_json(path: Path, image_name: str, size: Tuple[int, int], frames: Dict[str, object]) -> None:
    payload = {
        "frames": frames,
        "meta": {
            "app": "Codex Gamecast Sprite Pipeline",
            "version": "1.0",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": size[0], "h": size[1]},
            "scale": "1",
        },
    }
    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def count_colors(paths: Iterable[Path]) -> Dict[str, int]:
    counts = {}
    for path in paths:
        image = Image.open(path).convert("RGBA")
        pixels = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        counts[path.name] = len({pixel for pixel in pixels if pixel[3] > 0})
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Imagegen source sprite sheet")
    parser.add_argument("--out", default=Path("assets/gamecast"), type=Path, help="Output asset directory")
    args = parser.parse_args()

    output_dir = args.out
    source_dir = output_dir / "source"
    output_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.source).convert("RGBA")
    source_copy = source_dir / "player-sheet-imagegen.png"
    if args.source.resolve() != source_copy.resolve():
        shutil.copyfile(args.source, source_copy)

    write_player_atlas(source, output_dir, "home")
    write_player_atlas(source, output_dir, "away")
    write_props_atlas(output_dir)

    counts = count_colors([
        output_dir / "player-home.png",
        output_dir / "player-away.png",
        output_dir / "props.png",
    ])
    for name, count in counts.items():
        print(f"{name}: {count} opaque colors")
    print(f"source copied: {source_copy}")


if __name__ == "__main__":
    main()
