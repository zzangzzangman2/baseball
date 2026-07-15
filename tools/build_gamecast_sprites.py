#!/usr/bin/env python3
"""Build crisp 64px Gamecast sprite atlases from an imagegen source sheet."""

from __future__ import annotations

import argparse
import json
import shutil
from collections import deque
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Tuple

from PIL import Image, ImageDraw


FRAME = 64
BASELINE_Y = 60
CENTER_X = 32
SOURCE_CELL = 256
SOURCE_DOWNSCALE = SOURCE_CELL // FRAME
MAX_SPRITE_WIDTH = 58
MAX_SPRITE_HEIGHT = 56
REGISTERED_SPRITE_WIDTH = 54
REGISTERED_SPRITE_HEIGHT = 54
MAX_OPAQUE_RGB_COLORS = 32
LEGACY_COLS = 5
LEGACY_ROWS = 4
V2_COLS = 8
V2_ROWS = 6
DEFAULT_SOURCE = Path("assets/gamecast/source/player-sheet-64-imagegen.png")
LEGACY_REFERENCE_SOURCE = Path("assets/gamecast/source/player-sheet-imagegen.png")

OUTLINE = (32, 32, 42, 255)
OUTLINE_SOFT = (65, 61, 72, 255)
SKIN = (242, 199, 154, 255)
SKIN_SHADOW = (207, 154, 106, 255)
SKIN_HIGHLIGHT = (255, 224, 181, 255)
CAP = (210, 59, 59, 255)
CAP_SHADOW = (178, 58, 72, 255)
CAP_HIGHLIGHT = (237, 106, 95, 255)
SOCK = CAP_SHADOW
JERSEY_HOME = (247, 247, 242, 255)
JERSEY_HOME_SHADOW = (220, 218, 210, 255)
JERSEY_HOME_HIGHLIGHT = (255, 254, 251, 255)
JERSEY_AWAY = (141, 138, 130, 255)
JERSEY_AWAY_SHADOW = (99, 97, 91, 255)
JERSEY_AWAY_HIGHLIGHT = (185, 182, 173, 255)
PANTS = (58, 53, 80, 255)
PANTS_SHADOW = (36, 34, 53, 255)
PANTS_HIGHLIGHT = (90, 83, 116, 255)
BAT = (138, 95, 57, 255)
BAT_SHADOW = (95, 63, 39, 255)
BAT_HIGHLIGHT = (187, 135, 80, 255)
GLOVE = (112, 75, 45, 255)
GLOVE_HIGHLIGHT = (165, 114, 67, 255)
HIGHLIGHT = (255, 240, 168, 255)
RIMLIGHT_NIGHT = (157, 215, 255, 255)
WHITE = JERSEY_HOME_HIGHLIGHT

SEL_OUTLINE_COLORS = frozenset({OUTLINE[:3], OUTLINE_SOFT[:3]})
RESERVED_RGB = {
    "outline": OUTLINE[:3],
    "selout": OUTLINE_SOFT[:3],
    "team_primary": CAP[:3],
    "team_shadow": CAP_SHADOW[:3],
    "night_rimlight": RIMLIGHT_NIGHT[:3],
}

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

V2_GRID = {
    "stance": (0, 0),
    "load": (1, 0),
    "stride": (2, 0),
    "swing1": (3, 0),
    "contact": (4, 0),
    "swing2": (5, 0),
    "follow1": (6, 0),
    "follow2": (7, 0),
    "pitch_set": (0, 1),
    "pitch_kick": (1, 1),
    "pitch_stride": (2, 1),
    "pitch_cock": (3, 1),
    "pitch_release": (4, 1),
    "pitch_follow1": (5, 1),
    "pitch_follow2": (6, 1),
    "idle": (7, 1),
    "run1": (0, 2),
    "run2": (1, 2),
    "run3": (2, 2),
    "run4": (3, 2),
    "walk1": (4, 2),
    "walk2": (5, 2),
    "throw_plant": (6, 2),
    "throw_release": (7, 2),
    "throw_follow": (0, 3),
    "field": (1, 3),
    "catch_track": (2, 3),
    "catch_reach": (3, 3),
    "catch_squeeze": (4, 3),
    "dive_launch": (5, 3),
    "dive_slide": (6, 3),
    "dive_getup": (7, 3),
    "slide_in": (0, 4),
    "slide_hold": (1, 4),
    "catcher_frame": (2, 4),
    "catcher_block": (3, 4),
    "miss": (4, 4),
    "take": (5, 4),
    "lookUp": (6, 4),
    "reserved_a": (7, 4),
    "stance_open": (0, 5),
    "load_open": (1, 5),
    "stance_crouch": (2, 5),
    "load_crouch": (3, 5),
    "pitch_alt_set": (4, 5),
    "pitch_alt_release": (5, 5),
    "reserved_b": (6, 5),
    "reserved_c": (7, 5),
}

V2_ALIASES = {
    "swing": "contact",
    "follow": "follow1",
    "windup": "pitch_set",
    "pitch": "pitch_release",
    "run": "run1",
    "walk": "walk1",
    "catch": "catch_squeeze",
    "dive": "dive_slide",
    "slide": "slide_hold",
    "catcher": "catcher_frame",
    "coach": "idle",
    "umpire": "idle",
}

LEGACY_ALIASES = {
    "load": "stance",
    "walk": "walk1",
    "walk2": "run1",
    "run": "run1",
    "coach": "idle",
    "umpire": "idle",
}

V2_ANIMATIONS = {
    "swing": {"frames": ["stance", "load", "stride", "swing1", "contact", "swing2", "follow1", "follow2"], "durations": [90, 70, 70, 45, 90, 45, 70, 100]},
    "pitch": {"frames": ["pitch_set", "pitch_kick", "pitch_stride", "pitch_cock", "pitch_release", "pitch_follow1", "pitch_follow2"], "durations": [100, 90, 70, 60, 45, 70, 100]},
    "run": {"frames": ["run1", "run2", "run3", "run4"], "durations": [70, 70, 70, 70]},
    "walk": {"frames": ["walk1", "walk2"], "durations": [120, 120]},
    "throw": {"frames": ["throw_plant", "throw_release", "throw_follow"], "durations": [80, 50, 90]},
    "catch": {"frames": ["catch_track", "catch_reach", "catch_squeeze"], "durations": [90, 60, 100]},
    "dive": {"frames": ["dive_launch", "dive_slide", "dive_getup"], "durations": [70, 90, 120]},
    "slide": {"frames": ["slide_in", "slide_hold"], "durations": [80, 140]},
    "catcher": {"frames": ["catcher_frame", "catcher_block"], "durations": [120, 120]},
}

LEGACY_ANIMATIONS = {
    "swing": {"frames": ["stance", "swing", "follow"], "durations": [120, 90, 140]},
    "pitch": {"frames": ["windup", "pitch"], "durations": [140, 120]},
    "run": {"frames": ["run1", "run2"], "durations": [90, 90]},
    "walk": {"frames": ["walk1", "walk2"], "durations": [140, 140]},
    "catch": {"frames": ["field", "catch"], "durations": [120, 140]},
    "dive": {"frames": ["field", "dive"], "durations": [120, 160]},
    "slide": {"frames": ["run1", "slide"], "durations": [90, 160]},
    "catcher": {"frames": ["catcher"], "durations": [160]},
}

AIRBORNE_OR_LOW_POSES = {
    "pitch",
    "pitch_stride",
    "pitch_release",
    "pitch_follow1",
    "pitch_follow2",
    "pitch_alt_release",
    "throw_release",
    "dive",
    "dive_slide",
    "slide",
    "slide_in",
    "slide_hold",
    "catcher",
    "catcher_frame",
    "catcher_block",
}

LEGACY_TO_V2_BASE = {
    "stance": "stance",
    "load": "stance",
    "stride": "stance",
    "swing1": "swing",
    "contact": "swing",
    "swing2": "follow",
    "follow1": "follow",
    "follow2": "follow",
    "pitch_set": "windup",
    "pitch_kick": "windup",
    "pitch_stride": "pitch",
    "pitch_cock": "windup",
    "pitch_release": "pitch",
    "pitch_follow1": "pitch",
    "pitch_follow2": "pitch",
    "idle": "idle",
    "run1": "run1",
    "run2": "run2",
    "run3": "run1",
    "run4": "run2",
    "walk1": "walk1",
    "walk2": "idle",
    "throw_plant": "field",
    "throw_release": "pitch",
    "throw_follow": "follow",
    "field": "field",
    "catch_track": "field",
    "catch_reach": "catch",
    "catch_squeeze": "catch",
    "dive_launch": "field",
    "dive_slide": "dive",
    "dive_getup": "field",
    "slide_in": "slide",
    "slide_hold": "slide",
    "catcher_frame": "catcher",
    "catcher_block": "catcher",
    "miss": "miss",
    "take": "take",
    "lookUp": "lookUp",
    "stance_open": "stance",
    "load_open": "stance",
    "stance_crouch": "stance",
    "load_crouch": "stance",
    "pitch_alt_set": "windup",
    "pitch_alt_release": "pitch",
}

LEGACY_TO_V2_SHIFT = {
    "load": (-1, 0),
    "stride": (1, 0),
    "swing1": (-1, 0),
    "swing2": (1, 0),
    "follow2": (2, 0),
    "pitch_kick": (0, -1),
    "pitch_stride": (1, 0),
    "pitch_follow1": (1, 0),
    "pitch_follow2": (2, 1),
    "run3": (0, -1),
    "run4": (0, 1),
    "walk2": (1, 0),
    "throw_release": (2, 0),
    "throw_follow": (1, 0),
    "catch_track": (-1, 0),
    "catch_reach": (1, -1),
    "dive_launch": (2, -1),
    "dive_getup": (-1, 1),
    "slide_hold": (1, 0),
    "catcher_block": (0, 1),
    "stance_open": (1, 0),
    "load_open": (0, -1),
    "stance_crouch": (0, 1),
    "load_crouch": (-1, 1),
    "pitch_alt_set": (-1, 0),
    "pitch_alt_release": (1, 0),
}


def is_key_color(pixel: Tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a < 8 or (r > 185 and b > 175 and g < 85 and abs(r - b) < 80)


def is_checker_background_candidate(pixel: Tuple[int, int, int, int], relaxed: bool = False) -> bool:
    r, g, b, a = pixel
    if is_key_color(pixel):
        return True
    floor = 174 if relaxed else 198
    chroma_limit = 42 if relaxed else 30
    return a > 0 and min(r, g, b) >= floor and max(r, g, b) - min(r, g, b) <= chroma_limit


def luminance(r: int, g: int, b: int) -> float:
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255


def jersey_tones(uniform: str) -> Tuple[Tuple[int, int, int, int], Tuple[int, int, int, int], Tuple[int, int, int, int]]:
    if uniform == "away":
        return (JERSEY_AWAY_SHADOW, JERSEY_AWAY, JERSEY_AWAY_HIGHLIGHT)
    return (JERSEY_HOME_SHADOW, JERSEY_HOME, JERSEY_HOME_HIGHLIGHT)


def classify_pixel(pixel: Tuple[int, int, int, int], uniform: str) -> Tuple[int, int, int, int]:
    r, g, b, a = pixel
    if is_key_color(pixel):
        return (0, 0, 0, 0)

    lum = luminance(r, g, b)
    chroma = max(r, g, b) - min(r, g, b)
    jersey_shadow, jersey_base, jersey_highlight = jersey_tones(uniform)

    skin_like = (
        r > 115
        and g > 72
        and b > 54
        and r >= g + 18
        and g >= b - 18
        and lum > 0.28
    )
    if skin_like:
        if lum < 0.52:
            return SKIN_SHADOW
        if lum > 0.78:
            return SKIN_HIGHLIGHT
        return SKIN

    red_score = r - max(g, b)
    if r > 125 and red_score > 24 and g < 92 and b < 120:
        if r < 172:
            return CAP_SHADOW
        if r > 226 and g > 68:
            return CAP_HIGHLIGHT
        return CAP

    if r > 135 and g > 82 and b < 138 and r > b + 28:
        if lum < 0.52:
            return SKIN_SHADOW
        if lum > 0.78:
            return SKIN_HIGHLIGHT
        return SKIN

    if lum < 0.16:
        return OUTLINE
    if lum < 0.26 and chroma < 70:
        return OUTLINE_SOFT

    if b >= r + 8 and b >= g + 4 and lum < 0.48:
        if lum < 0.20:
            return PANTS_SHADOW
        if lum > 0.34:
            return PANTS_HIGHLIGHT
        return PANTS

    if r > 80 and g > 48 and b < 96 and r >= g + 12:
        if lum < 0.34:
            return BAT_SHADOW
        if lum > 0.58:
            return BAT_HIGHLIGHT
        return BAT

    if abs(r - g) < 18 and abs(g - b) < 18 and lum < 0.62:
        return jersey_shadow

    if r > 172 and g > 166 and b > 146:
        return jersey_highlight if lum > 0.90 else jersey_base

    if r > 210 and g > 178 and b < 128:
        return HIGHLIGHT

    if lum > 0.78:
        return jersey_highlight
    if lum > 0.56:
        return jersey_base
    if lum > 0.38:
        return GLOVE_HIGHLIGHT if lum > 0.54 else GLOVE
    return OUTLINE_SOFT


def validate_source_grid(source: Image.Image, sheet_cols: int, sheet_rows: int, strict: bool = False) -> List[str]:
    expected = (sheet_cols * SOURCE_CELL, sheet_rows * SOURCE_CELL)
    if source.size == expected:
        print(f"source grid validation: ok ({sheet_cols}x{sheet_rows}, {SOURCE_CELL}px cells, {SOURCE_DOWNSCALE}x integer downscale)")
        return []

    cell_w = source.width / sheet_cols
    cell_h = source.height / sheet_rows
    issues = [
        f"source sheet {source.width}x{source.height} yields {cell_w:.2f}x{cell_h:.2f}px cells; "
        f"the 64px contract requires {expected[0]}x{expected[1]} ({SOURCE_CELL}px per cell)"
    ]
    print("source grid validation:")
    for issue in issues:
        print(f"  {'ERROR' if strict else 'WARN'} {issue}")
    if strict:
        raise SystemExit("source grid validation failed")
    return issues


def crop_source_cell(source: Image.Image, col: int, row: int, sheet_cols: int, sheet_rows: int) -> Image.Image:
    width, height = source.size
    cell_w = width / sheet_cols
    cell_h = height / sheet_rows
    left = round(col * cell_w)
    top = round(row * cell_h)
    right = round((col + 1) * cell_w)
    bottom = round((row + 1) * cell_h)
    cell = clear_source_background(source.crop((left, top, right, bottom)).convert("RGBA"))
    if cell.size != (SOURCE_CELL, SOURCE_CELL):
        cell = cell.resize((SOURCE_CELL, SOURCE_CELL), Image.Resampling.NEAREST)
    return cell


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


def opaque_bbox(image: Image.Image) -> Tuple[int, int, int, int] | None:
    pixels = image.load()
    xs: List[int] = []
    ys: List[int] = []
    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y][3] > 0:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def clear_source_background(image: Image.Image) -> Image.Image:
    image = image.copy().convert("RGBA")
    pixels = image.load()
    width, height = image.size
    background: set[Tuple[int, int]] = set()
    queue: deque[Tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        point = (x, y)
        if point in background or not is_checker_background_candidate(pixels[x, y]):
            return
        background.add(point)
        queue.append(point)

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    # Remove the bright neutral fringe immediately connected to the checker/key region.
    fringe = set(background)
    for x, y in tuple(background):
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and is_checker_background_candidate(pixels[nx, ny], relaxed=True):
                fringe.add((nx, ny))

    for x, y in fringe:
        pixels[x, y] = (0, 0, 0, 0)

    # Key colors may also occur in enclosed checker pockets after generation.
    for y in range(image.height):
        for x in range(image.width):
            if is_key_color(pixels[x, y]):
                pixels[x, y] = (0, 0, 0, 0)
    return image


def quantize_frame(image: Image.Image, uniform: str) -> Image.Image:
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            pixels[x, y] = classify_pixel(pixels[x, y], uniform)
    return image


def align_output_frame(frame: Image.Image) -> Image.Image:
    bbox = opaque_bbox(frame)
    if bbox is None:
        return frame
    left, _top, right, bottom = bbox
    center = (left + right) / 2
    dx = round(CENTER_X - center)
    dy = BASELINE_Y - bottom
    aligned = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    aligned.alpha_composite(frame, (dx, dy))
    return aligned


def apply_selout(frame: Image.Image) -> Image.Image:
    output = frame.copy().convert("RGBA")
    source = frame.convert("RGBA")
    source_pixels = source.load()
    output_pixels = output.load()
    for y in range(source.height):
        for x in range(source.width):
            if source_pixels[x, y][3] == 0:
                continue
            exposed = any(
                nx < 0
                or ny < 0
                or nx >= source.width
                or ny >= source.height
                or source_pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if exposed and source_pixels[x, y][:3] not in SEL_OUTLINE_COLORS:
                output_pixels[x, y] = OUTLINE_SOFT
    return output


def apply_night_rimlight(frame: Image.Image) -> Image.Image:
    output = frame.copy().convert("RGBA")
    source = frame.convert("RGBA")
    source_pixels = source.load()
    output_pixels = output.load()
    for y in range(min(source.height, round(BASELINE_Y * 0.65) + 1)):
        for x in range(source.width):
            if source_pixels[x, y][3] == 0:
                continue
            if y == 0 or source_pixels[x, y - 1][3] == 0:
                output_pixels[x, y] = RIMLIGHT_NIGHT
    return output


def register_source_cell(source_cell: Image.Image) -> Image.Image:
    cleaned = clear_source_background(source_cell)
    bbox = transparent_bbox(cleaned)
    registered = Image.new("RGBA", (SOURCE_CELL, SOURCE_CELL), (0, 0, 0, 0))
    if bbox is None:
        return registered

    cropped = cleaned.crop(bbox)
    max_w = REGISTERED_SPRITE_WIDTH * SOURCE_DOWNSCALE
    max_h = REGISTERED_SPRITE_HEIGHT * SOURCE_DOWNSCALE
    scale = min(max_w / cropped.width, max_h / cropped.height)
    scaled_w = max(SOURCE_DOWNSCALE, round(cropped.width * scale / SOURCE_DOWNSCALE) * SOURCE_DOWNSCALE)
    scaled_h = max(SOURCE_DOWNSCALE, round(cropped.height * scale / SOURCE_DOWNSCALE) * SOURCE_DOWNSCALE)
    resized = cropped.resize((scaled_w, scaled_h), Image.Resampling.NEAREST)
    paste_x = round((CENTER_X * SOURCE_DOWNSCALE - scaled_w / 2) / SOURCE_DOWNSCALE) * SOURCE_DOWNSCALE
    paste_y = BASELINE_Y * SOURCE_DOWNSCALE - scaled_h
    registered.alpha_composite(resized, (paste_x, paste_y))
    return registered


def normalize_frame(source_cell: Image.Image, uniform: str) -> Image.Image:
    if source_cell.size == (SOURCE_CELL, SOURCE_CELL):
        # Registration is normalized on the 256px cell, then preserved through a true 4x downscale.
        registered = register_source_cell(source_cell)
        resized = registered.resize((FRAME, FRAME), Image.Resampling.NEAREST)
        quantized = quantize_frame(resized, uniform)
        return apply_selout(align_output_frame(quantized))

    bbox = transparent_bbox(source_cell)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    if bbox is None:
        return frame

    # Compatibility path for the checked-in pre-contract source sheet. New sources should
    # always take the exact 256px path above; --strict-source-grid enforces that in CI.
    cropped = clear_source_background(source_cell.crop(bbox))

    scale = min(MAX_SPRITE_WIDTH / cropped.width, MAX_SPRITE_HEIGHT / cropped.height)
    new_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    resized = cropped.resize(new_size, Image.Resampling.NEAREST)
    output = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    paste_x = round(CENTER_X - new_size[0] / 2)
    paste_y = BASELINE_Y - new_size[1]
    output.alpha_composite(resized, (paste_x, paste_y))

    return apply_selout(align_output_frame(quantize_frame(output, uniform)))


def shift_frame(frame: Image.Image, dx: int = 0, dy: int = 0) -> Image.Image:
    shifted = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    shifted.alpha_composite(frame, (dx, dy))
    return shifted


def atlas_frame(x: int, y: int) -> Dict[str, object]:
    return {
        "frame": {"x": x, "y": y, "w": FRAME, "h": FRAME},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": FRAME, "h": FRAME},
        "sourceSize": {"w": FRAME, "h": FRAME},
    }


def detect_layout(source: Image.Image, requested: str) -> Tuple[str, int, int, Mapping[str, Tuple[int, int]], Mapping[str, str], Mapping[str, object]]:
    if requested == "legacy":
        return ("legacy", LEGACY_COLS, LEGACY_ROWS, POSE_GRID, LEGACY_ALIASES, LEGACY_ANIMATIONS)
    if requested == "v2":
        return ("v2", V2_COLS, V2_ROWS, V2_GRID, V2_ALIASES, V2_ANIMATIONS)

    width, height = source.size
    if source.size == (V2_COLS * SOURCE_CELL, V2_ROWS * SOURCE_CELL):
        return ("v2", V2_COLS, V2_ROWS, V2_GRID, V2_ALIASES, V2_ANIMATIONS)
    if source.size == (LEGACY_COLS * SOURCE_CELL, LEGACY_ROWS * SOURCE_CELL):
        return ("legacy", LEGACY_COLS, LEGACY_ROWS, POSE_GRID, LEGACY_ALIASES, LEGACY_ANIMATIONS)

    ratio = width / height
    if abs(ratio - LEGACY_COLS / LEGACY_ROWS) <= 0.04:
        return ("legacy", LEGACY_COLS, LEGACY_ROWS, POSE_GRID, LEGACY_ALIASES, LEGACY_ANIMATIONS)
    if abs(ratio - V2_COLS / V2_ROWS) <= 0.04:
        return ("v2", V2_COLS, V2_ROWS, V2_GRID, V2_ALIASES, V2_ANIMATIONS)

    v2_cell_w = width / V2_COLS
    v2_cell_h = height / V2_ROWS
    if abs(v2_cell_w - v2_cell_h) / max(v2_cell_w, v2_cell_h) <= 0.06:
        return ("v2", V2_COLS, V2_ROWS, V2_GRID, V2_ALIASES, V2_ANIMATIONS)
    return ("legacy", LEGACY_COLS, LEGACY_ROWS, POSE_GRID, LEGACY_ALIASES, LEGACY_ANIMATIONS)


def registration_baseline_exempt(pose: str) -> bool:
    if pose in AIRBORNE_OR_LOW_POSES:
        return True
    return pose.startswith(("pitch_", "throw_", "run_", "catch_", "dive_", "slide_", "catcher_"))


def validate_registration(frames: Mapping[str, Image.Image], strict: bool = False) -> List[str]:
    issues: List[str] = []
    for pose, frame in frames.items():
        bbox = opaque_bbox(frame)
        if bbox is None:
            issues.append(f"{pose}: empty frame")
            continue

        left, top, right, bottom = bbox
        width = right - left
        height = bottom - top
        center = (left + right) / 2
        baseline_delta = bottom - BASELINE_Y
        center_delta = center - CENTER_X

        if not registration_baseline_exempt(pose) and abs(baseline_delta) > 1:
            issues.append(f"{pose}: bbox bottom {bottom} is {baseline_delta:+.1f}px from baseline {BASELINE_Y}")
        elif abs(baseline_delta) > 7:
            issues.append(f"{pose}: bbox bottom {bottom} is far from baseline {BASELINE_Y}")

        if abs(center_delta) > 4.5:
            issues.append(f"{pose}: bbox center {center:.1f} is {center_delta:+.1f}px from center {CENTER_X}")
        if left <= 0 or right >= FRAME or top <= 0 or bottom >= FRAME:
            issues.append(f"{pose}: opaque bbox {bbox} touches frame edge")
        if width > MAX_SPRITE_WIDTH or height > MAX_SPRITE_HEIGHT:
            issues.append(
                f"{pose}: opaque bbox {width}x{height} exceeds recommended "
                f"{MAX_SPRITE_WIDTH}x{MAX_SPRITE_HEIGHT} safe area"
            )

    if issues:
        print("registration validation:")
        for issue in issues:
            print(f"  {'ERROR' if strict else 'WARN'} {issue}")
    else:
        print("registration validation: ok")

    if strict and issues:
        raise SystemExit("registration validation failed")
    return issues


def rgb_distance(first: Tuple[int, int, int], second: Tuple[int, int, int]) -> float:
    return sum((first[index] - second[index]) ** 2 for index in range(3)) ** 0.5


def art_palette(uniform: str) -> set[Tuple[int, int, int]]:
    jersey_shadow, jersey_base, jersey_highlight = jersey_tones(uniform)
    colors = {
        OUTLINE,
        OUTLINE_SOFT,
        SKIN_SHADOW,
        SKIN,
        SKIN_HIGHLIGHT,
        CAP_SHADOW,
        CAP,
        CAP_HIGHLIGHT,
        jersey_shadow,
        jersey_base,
        jersey_highlight,
        PANTS_SHADOW,
        PANTS,
        PANTS_HIGHLIGHT,
        BAT_SHADOW,
        BAT,
        BAT_HIGHLIGHT,
        GLOVE,
        GLOVE_HIGHLIGHT,
        HIGHLIGHT,
        RIMLIGHT_NIGHT,
    }
    return {color[:3] for color in colors}


def three_tone_families(uniform: str) -> Mapping[str, Tuple[Tuple[int, int, int], ...]]:
    jersey_shadow, jersey_base, jersey_highlight = jersey_tones(uniform)
    return {
        "skin": (SKIN_SHADOW[:3], SKIN[:3], SKIN_HIGHLIGHT[:3]),
        "cap": (CAP_SHADOW[:3], CAP[:3], CAP_HIGHLIGHT[:3]),
        "jersey": (jersey_shadow[:3], jersey_base[:3], jersey_highlight[:3]),
        "pants": (PANTS_SHADOW[:3], PANTS[:3], PANTS_HIGHLIGHT[:3]),
        "bat": (BAT_SHADOW[:3], BAT[:3], BAT_HIGHLIGHT[:3]),
        "glove": (BAT_SHADOW[:3], GLOVE[:3], GLOVE_HIGHLIGHT[:3]),
    }


def boundary_rgb(frame: Image.Image) -> List[Tuple[int, int, int]]:
    image = frame.convert("RGBA")
    pixels = image.load()
    result: List[Tuple[int, int, int]] = []
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
                result.append(pixel[:3])
    return result


def validate_night_rimlight(frames: Mapping[str, Image.Image], required: bool) -> List[str]:
    issues: List[str] = []
    rim = RIMLIGHT_NIGHT[:3]
    rim_count = 0
    invalid_count = 0
    for frame in frames.values():
        image = frame.convert("RGBA")
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                if pixels[x, y][3] == 0 or pixels[x, y][:3] != rim:
                    continue
                rim_count += 1
                above_is_opaque = y > 0 and pixels[x, y - 1][3] > 0
                if above_is_opaque or y > round(BASELINE_Y * 0.65):
                    invalid_count += 1
    if required and rim_count == 0:
        issues.append("night rimlight is required but no reserved rimlight pixels are present")
    if rim_count and invalid_count / rim_count > 0.15:
        issues.append(
            f"night rimlight must be a 1px top-facing edge: {invalid_count}/{rim_count} pixels violate the rule"
        )
    return issues


def validate_art_rules(
    frames: Mapping[str, Image.Image],
    uniform: str,
    strict: bool = False,
    require_night_rimlight: bool = False,
) -> List[str]:
    issues: List[str] = []
    used_rgb: set[Tuple[int, int, int]] = set()
    boundaries: List[Tuple[int, int, int]] = []
    for frame in frames.values():
        image = frame.convert("RGBA")
        pixels = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
        used_rgb.update(pixel[:3] for pixel in pixels if pixel[3] > 0)
        boundaries.extend(boundary_rgb(image))

    if len(used_rgb) > MAX_OPAQUE_RGB_COLORS:
        issues.append(f"palette has {len(used_rgb)} opaque RGB colors; maximum is {MAX_OPAQUE_RGB_COLORS}")

    unexpected = sorted(used_rgb - art_palette(uniform))
    if unexpected:
        preview = ", ".join("#%02x%02x%02x" % color for color in unexpected[:8])
        issues.append(f"palette contains {len(unexpected)} non-contract colors ({preview})")

    if (0, 0, 0) in used_rgb:
        issues.append("pure black is forbidden; use the reserved selout tones")

    for name, reserved in RESERVED_RGB.items():
        near_matches = [
            color for color in used_rgb
            if color != reserved and color not in art_palette(uniform) and rgb_distance(color, reserved) <= 18
        ]
        if near_matches:
            issues.append(f"reserved color '{name}' has non-exact near matches: {near_matches[:4]}")

    for required_name in ("outline", "selout", "team_primary", "team_shadow"):
        if RESERVED_RGB[required_name] not in used_rgb:
            issues.append(f"reserved color '{required_name}' is missing")

    complete_families = {
        name for name, tones in three_tone_families(uniform).items()
        if all(tone in used_rgb for tone in tones)
    }
    for required_family in ("skin", "jersey"):
        if required_family not in complete_families:
            issues.append(f"{required_family} is missing base/shade/highlight 3-tone coverage")
    if len(complete_families) < 3:
        issues.append(
            "fewer than three material families have complete base/shade/highlight coverage "
            f"({', '.join(sorted(complete_families)) or 'none'})"
        )

    if boundaries:
        selout_count = sum(color in SEL_OUTLINE_COLORS for color in boundaries)
        coverage = selout_count / len(boundaries)
        if coverage < 0.55:
            issues.append(f"selout covers only {coverage:.1%} of opaque boundary pixels; minimum is 55%")
    else:
        issues.append("no opaque boundary pixels found")

    issues.extend(validate_night_rimlight(frames, require_night_rimlight))

    if issues:
        print(f"art rule validation ({uniform}):")
        for issue in issues:
            print(f"  {'ERROR' if strict else 'WARN'} {issue}")
    else:
        family_text = ", ".join(sorted(complete_families))
        print(
            f"art rule validation ({uniform}): ok "
            f"({len(used_rgb)} colors; 3-tone: {family_text}; selout: {coverage:.1%})"
        )

    if strict and issues:
        raise SystemExit("art rule validation failed")
    return issues


def validate_animation_metadata(frames: Mapping[str, object], animations: Mapping[str, object] | None) -> List[str]:
    if not animations:
        return []

    issues: List[str] = []
    frame_names = set(frames.keys())
    for animation_name, spec in animations.items():
        if not isinstance(spec, Mapping):
            issues.append(f"{animation_name}: animation spec must be an object")
            continue
        sequence = list(spec.get("frames") or [])
        durations = list(spec.get("durations") or [])
        if not sequence:
            issues.append(f"{animation_name}: no frames")
        if len(sequence) != len(durations):
            issues.append(f"{animation_name}: frames/durations length mismatch ({len(sequence)} != {len(durations)})")
        for frame_name in sequence:
            if frame_name not in frame_names:
                issues.append(f"{animation_name}: missing frame '{frame_name}'")
        for index, duration in enumerate(durations):
            try:
                numeric_duration = float(duration)
            except (TypeError, ValueError):
                issues.append(f"{animation_name}: duration {index} is not numeric")
                continue
            if numeric_duration <= 0:
                issues.append(f"{animation_name}: duration {index} must be positive")

    if issues:
        print("animation metadata validation:")
        for issue in issues:
            print(f"  ERROR {issue}")
        raise SystemExit("animation metadata validation failed")
    print("animation metadata validation: ok")
    return issues


def write_player_atlas(
    source: Image.Image,
    output_dir: Path,
    uniform: str,
    sheet_cols: int,
    sheet_rows: int,
    pose_grid: Mapping[str, Tuple[int, int]],
    aliases: Mapping[str, str],
    animations: Mapping[str, object],
    layout_name: str,
    strict_registration: bool,
    strict_art: bool,
    night: bool = False,
) -> None:
    variant = f"{uniform}-night" if night else uniform
    image_name = f"player-{variant}.png"
    atlas = Image.new("RGBA", (sheet_cols * FRAME, sheet_rows * FRAME), (0, 0, 0, 0))
    frames: Dict[str, object] = {}
    validation_frames: Dict[str, Image.Image] = {}

    for pose, (col, row) in pose_grid.items():
        frame = normalize_frame(crop_source_cell(source, col, row, sheet_cols, sheet_rows), uniform)
        if night:
            frame = apply_night_rimlight(frame)
        x = col * FRAME
        y = row * FRAME
        atlas.alpha_composite(frame, (x, y))
        frames[pose] = atlas_frame(x, y)
        validation_frames[pose] = frame

    for alias, target in aliases.items():
        if target in frames:
            frames[alias] = frames[target]

    validate_registration(validation_frames, strict_registration)
    validate_art_rules(validation_frames, uniform, strict_art, night)

    atlas.save(output_dir / image_name)
    write_json(output_dir / f"player-{variant}.json", image_name, atlas.size, frames, layout_name, animations)


def build_legacy_normalized_frames(source: Image.Image, uniform: str) -> Dict[str, Image.Image]:
    frames: Dict[str, Image.Image] = {}
    for pose, (col, row) in POSE_GRID.items():
        frames[pose] = normalize_frame(crop_source_cell(source, col, row, LEGACY_COLS, LEGACY_ROWS), uniform)
    return frames


def write_synthesized_v2_atlas(
    source: Image.Image,
    output_dir: Path,
    uniform: str,
    strict_registration: bool,
    strict_art: bool,
    night: bool = False,
) -> None:
    variant = f"{uniform}-night" if night else uniform
    image_name = f"player-{variant}.png"
    legacy_frames = build_legacy_normalized_frames(source, uniform)
    atlas = Image.new("RGBA", (V2_COLS * FRAME, V2_ROWS * FRAME), (0, 0, 0, 0))
    frames: Dict[str, object] = {}
    validation_frames: Dict[str, Image.Image] = {}

    for pose, (col, row) in V2_GRID.items():
        x = col * FRAME
        y = row * FRAME
        base_name = LEGACY_TO_V2_BASE.get(pose)
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        if base_name and base_name in legacy_frames:
            dx, dy = LEGACY_TO_V2_SHIFT.get(pose, (0, 0))
            frame = shift_frame(legacy_frames[base_name], dx, dy)
            if night:
                frame = apply_night_rimlight(frame)
        atlas.alpha_composite(frame, (x, y))
        frames[pose] = atlas_frame(x, y)
        if base_name:
            validation_frames[pose] = frame

    for alias, target in V2_ALIASES.items():
        if target in frames:
            frames[alias] = frames[target]

    validate_registration(validation_frames, strict_registration)
    validate_art_rules(validation_frames, uniform, strict_art, night)

    atlas.save(output_dir / image_name)
    write_json(output_dir / f"player-{variant}.json", image_name, atlas.size, frames, "v2", V2_ANIMATIONS)


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


def write_json(
    path: Path,
    image_name: str,
    size: Tuple[int, int],
    frames: Dict[str, object],
    layout_name: str = "legacy",
    animations: Mapping[str, object] | None = None,
) -> None:
    payload = {
        "frames": frames,
        "meta": {
            "app": "Codex Gamecast Sprite Pipeline",
            "version": "2.1" if layout_name == "v2" else "1.2",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": size[0], "h": size[1]},
            "scale": "1",
            "frameSize": {"w": FRAME, "h": FRAME},
            "layout": layout_name,
            "baselineY": BASELINE_Y,
            "centerX": CENTER_X,
            "sourceCellSize": {"w": SOURCE_CELL, "h": SOURCE_CELL},
            "integerDownscale": SOURCE_DOWNSCALE,
            "safeOpaqueSize": {"w": MAX_SPRITE_WIDTH, "h": MAX_SPRITE_HEIGHT},
            "artContract": "docs/gamecast-sprite-art-spec.md",
            "lighting": "night" if "-night." in image_name else "day",
        },
    }
    if animations:
        validate_animation_metadata(frames, animations)
        payload["animations"] = animations
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
    parser.add_argument(
        "--source",
        default=DEFAULT_SOURCE if DEFAULT_SOURCE.exists() else LEGACY_REFERENCE_SOURCE,
        type=Path,
        help="Imagegen source sprite sheet",
    )
    parser.add_argument("--out", default=Path("assets/gamecast"), type=Path, help="Output asset directory")
    parser.add_argument("--layout", choices=("auto", "legacy", "v2"), default="auto", help="Source grid layout")
    parser.add_argument("--keep-legacy-output", action="store_true", help="When the source is legacy, emit the legacy atlas instead of synthesizing a v2 atlas")
    parser.add_argument("--strict-registration", action="store_true", help="Fail on registration warnings")
    parser.add_argument("--strict-source-grid", action="store_true", help="Require an exact 256px-per-cell source sheet")
    parser.add_argument("--strict-art", action="store_true", help="Fail 3-tone, selout, reserved-color, and palette checks")
    args = parser.parse_args()

    output_dir = args.out
    source_dir = output_dir / "source"
    output_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.source).convert("RGBA")
    layout_name, sheet_cols, sheet_rows, pose_grid, aliases, animations = detect_layout(source, args.layout)
    print(f"layout: {layout_name} ({sheet_cols}x{sheet_rows})")
    validate_source_grid(source, sheet_cols, sheet_rows, args.strict_source_grid)
    source_copy = source_dir / args.source.name
    if args.source.resolve() != source_copy.resolve():
        shutil.copyfile(args.source, source_copy)

    if layout_name == "legacy" and not args.keep_legacy_output:
        print("emitting: synthesized v2 atlas from legacy source")
        for uniform in ("home", "away"):
            for night in (False, True):
                write_synthesized_v2_atlas(
                    source,
                    output_dir,
                    uniform,
                    args.strict_registration,
                    args.strict_art,
                    night,
                )
    else:
        for uniform in ("home", "away"):
            for night in (False, True):
                write_player_atlas(
                    source,
                    output_dir,
                    uniform,
                    sheet_cols,
                    sheet_rows,
                    pose_grid,
                    aliases,
                    animations,
                    layout_name,
                    args.strict_registration,
                    args.strict_art,
                    night,
                )
    write_props_atlas(output_dir)

    counts = count_colors([
        output_dir / "player-home.png",
        output_dir / "player-home-night.png",
        output_dir / "player-away.png",
        output_dir / "player-away-night.png",
        output_dir / "props.png",
    ])
    for name, count in counts.items():
        print(f"{name}: {count} opaque colors")
    print(f"source copied: {source_copy}")


if __name__ == "__main__":
    main()
