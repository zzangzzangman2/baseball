#!/usr/bin/env python3
"""Build a dense Gamecast v3 motion atlas from the vetted source sheet."""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path
from typing import Dict, Iterable, Mapping, Sequence, Tuple

from PIL import Image

from build_gamecast_sprites import (
    FRAME,
    BASELINE_Y,
    CENTER_X,
    DEFAULT_SOURCE,
    LEGACY_REFERENCE_SOURCE,
    LEGACY_TO_V2_BASE,
    LEGACY_TO_V2_SHIFT,
    LEGACY_COLS,
    LEGACY_ROWS,
    MAX_SPRITE_HEIGHT,
    MAX_SPRITE_WIDTH,
    SOURCE_CELL,
    SOURCE_DOWNSCALE,
    V2_GRID,
    apply_night_rimlight,
    atlas_frame,
    build_legacy_normalized_frames,
    count_colors,
    shift_frame,
    validate_animation_metadata,
    validate_art_rules,
    validate_registration,
    validate_source_grid,
    write_props_atlas,
)


V3_COLS = 16
MOTION_MINIMUM_FRAMES = {
    "swing": 10,
    "pitch": 8,
    "run": 6,
    "throw": 3,
    "catch": 3,
    "dive": 3,
    "slide": 2,
    "catcher": 2,
}
V3_ANIMATIONS = {
    "swing": {
        "count": 24,
        "keys": [
            ("stance", -1, 0),
            ("load", -2, 0),
            ("stride", 0, 0),
            ("swing1", -2, 0),
            ("contact", 0, 0),
            ("swing2", 1, 0),
            ("follow1", 2, 0),
            ("follow2", 2, 1),
        ],
        "durations": [30, 30, 28, 28, 24, 22, 20, 18, 18, 18, 20, 22, 30, 34, 28, 26, 28, 30, 32, 34, 38, 42, 46, 54],
        "smear": True,
    },
    "pitch": {
        "count": 24,
        "keys": [
            ("pitch_set", -1, 0),
            ("pitch_kick", -1, -1),
            ("pitch_stride", 1, 0),
            ("pitch_cock", -1, 0),
            ("pitch_release", 2, 0),
            ("pitch_follow1", 1, 1),
            ("pitch_follow2", 1, 1),
        ],
        "durations": [36, 34, 32, 30, 30, 28, 26, 24, 22, 20, 18, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 40, 44, 50],
        "smear": True,
    },
    "run": {
        "count": 8,
        "keys": [("run1", 0, 0), ("run2", 1, 0), ("run3", 0, -1), ("run4", -1, 0), ("run1", 0, 0)],
        "durations": [55] * 8,
        "loop": True,
    },
    "walk": {
        "count": 6,
        "keys": [("walk1", 0, 0), ("walk2", 1, 0), ("idle", 0, 0), ("walk1", -1, 0)],
        "durations": [95] * 6,
        "loop": True,
    },
    "throw": {
        "count": 12,
        "keys": [("throw_plant", -1, 0), ("throw_release", 2, 0), ("throw_follow", 2, 1)],
        "durations": [42, 38, 34, 30, 24, 20, 20, 24, 28, 32, 38, 44],
        "smear": True,
    },
    "catch": {
        "count": 10,
        "keys": [("catch_track", -1, 0), ("catch_reach", 1, -1), ("catch_squeeze", 0, 0), ("field", 0, 0)],
        "durations": [48, 42, 36, 28, 28, 34, 42, 48, 56, 64],
    },
    "dive": {
        "count": 10,
        "keys": [("dive_launch", 1, -1), ("dive_slide", 2, 1), ("dive_getup", -1, 1), ("field", 0, 0)],
        "durations": [42, 38, 34, 32, 34, 42, 52, 62, 72, 82],
        "smear": True,
    },
    "slide": {
        "count": 8,
        "keys": [("run2", 0, 0), ("slide_in", 1, 1), ("slide_hold", 2, 1)],
        "durations": [42, 36, 32, 34, 44, 58, 72, 86],
    },
    "catcher": {
        "count": 8,
        "keys": [("catcher_frame", 0, 0), ("catcher_block", 0, 1), ("catcher_frame", 0, 0)],
        "durations": [64, 54, 44, 38, 42, 52, 62, 72],
    },
}

STATIC_POSES = ["idle", "field", "take", "miss", "lookUp"]
V3_ALIASES = {
    "stance": "swing_00",
    "load": "swing_04",
    "stride": "swing_07",
    "swing1": "swing_10",
    "contact": "swing_13",
    "swing2": "swing_15",
    "follow1": "swing_19",
    "follow2": "swing_23",
    "swing": "contact",
    "follow": "follow1",
    "pitch_set": "pitch_00",
    "pitch_kick": "pitch_04",
    "pitch_stride": "pitch_08",
    "pitch_cock": "pitch_11",
    "pitch_release": "pitch_14",
    "pitch_follow1": "pitch_18",
    "pitch_follow2": "pitch_23",
    "windup": "pitch_set",
    "pitch": "pitch_release",
    "run1": "run_00",
    "run2": "run_02",
    "run3": "run_04",
    "run4": "run_06",
    "run": "run1",
    "walk1": "walk_00",
    "walk2": "walk_03",
    "walk": "walk1",
    "throw_plant": "throw_00",
    "throw_release": "throw_06",
    "throw_follow": "throw_11",
    "throw": "throw_release",
    "catch_track": "catch_00",
    "catch_reach": "catch_04",
    "catch_squeeze": "catch_07",
    "catch": "catch_squeeze",
    "dive_launch": "dive_00",
    "dive_slide": "dive_04",
    "dive_getup": "dive_08",
    "dive": "dive_slide",
    "slide_in": "slide_03",
    "slide_hold": "slide_07",
    "slide": "slide_hold",
    "catcher_frame": "catcher_00",
    "catcher_block": "catcher_04",
    "catcher": "catcher_frame",
    "coach": "idle",
    "umpire": "idle",
}


def validate_motion_contract(specs: Mapping[str, Mapping[str, object]]) -> None:
    issues = []
    for name, minimum in MOTION_MINIMUM_FRAMES.items():
        spec = specs.get(name)
        if not spec:
            issues.append(f"missing required animation '{name}'")
            continue
        count = int(spec.get("count", 0))
        durations = list(spec.get("durations") or [])
        if count < minimum:
            issues.append(f"{name}: {count} frames is below the {minimum}-frame contract")
        if len(durations) != count:
            issues.append(f"{name}: {len(durations)} durations for {count} frames")

    pitch_keys = [str(key[0]) for key in V3_ANIMATIONS.get("pitch", {}).get("keys", [])]
    if "pitch_release" not in pitch_keys:
        issues.append("pitch: release key is missing")
    else:
        release_index = pitch_keys.index("pitch_release")
        follow_through = [name for name in pitch_keys[release_index + 1:] if name.startswith("pitch_follow")]
        if not follow_through:
            issues.append("pitch: at least one follow-through key must come after release")

    if issues:
        for issue in issues:
            print(f"motion contract: ERROR {issue}")
        raise SystemExit("motion contract validation failed")
    print(
        "motion contract validation: ok "
        f"(swing {V3_ANIMATIONS['swing']['count']}, pitch {V3_ANIMATIONS['pitch']['count']}, "
        f"run {V3_ANIMATIONS['run']['count']}; pitch follow-through present)"
    )


def with_alpha(image: Image.Image, alpha_scale: float) -> Image.Image:
    image = image.copy().convert("RGBA")
    if alpha_scale >= 0.995:
        return image
    channel = image.getchannel("A").point(lambda value: max(0, min(255, round(value * alpha_scale))))
    image.putalpha(channel)
    return image


def offset_frame(frame: Image.Image, dx: float = 0, dy: float = 0) -> Image.Image:
    return shift_frame(frame, round(dx), round(dy))


def tween_frame(
    first: Image.Image,
    second: Image.Image,
    t: float,
    first_shift: Tuple[float, float] = (0, 0),
    second_shift: Tuple[float, float] = (0, 0),
    smear: bool = False,
) -> Image.Image:
    t = max(0.0, min(1.0, t))
    dx = first_shift[0] + (second_shift[0] - first_shift[0]) * t
    dy = first_shift[1] + (second_shift[1] - first_shift[1]) * t
    main = first if t < 0.5 else second
    trail = second if t < 0.5 else first
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    if smear and 0.34 < t < 0.78:
        trail_dx = dx - (second_shift[0] - first_shift[0]) * 0.55
        trail_dy = dy - (second_shift[1] - first_shift[1]) * 0.55
        frame.alpha_composite(with_alpha(offset_frame(trail, trail_dx, trail_dy), 0.18))
    frame.alpha_composite(offset_frame(main, dx, dy))
    return frame


def build_v2_base_frames(source: Image.Image, uniform: str) -> Dict[str, Image.Image]:
    legacy_frames = build_legacy_normalized_frames(source, uniform)
    frames: Dict[str, Image.Image] = {}
    for pose in V2_GRID:
        base_name = LEGACY_TO_V2_BASE.get(pose)
        if base_name and base_name in legacy_frames:
            dx, dy = LEGACY_TO_V2_SHIFT.get(pose, (0, 0))
            frames[pose] = shift_frame(legacy_frames[base_name], dx, dy)
    return frames


def frame_for(base: Mapping[str, Image.Image], pose: str) -> Image.Image:
    if pose in base:
        return base[pose]
    return base.get("idle") or next(iter(base.values()))


def build_animation_frames(
    base: Mapping[str, Image.Image],
    prefix: str,
    spec: Mapping[str, object],
) -> Dict[str, Image.Image]:
    count = int(spec["count"])
    keys = list(spec["keys"])
    smear = bool(spec.get("smear", False))
    output: Dict[str, Image.Image] = {}
    if count <= 1 or len(keys) <= 1:
        output[f"{prefix}_00"] = frame_for(base, str(keys[0][0]))
        return output

    for index in range(count):
        normalized = index / (count - 1)
        segment_pos = normalized * (len(keys) - 1)
        left_index = min(len(keys) - 2, int(math.floor(segment_pos)))
        right_index = left_index + 1
        local_t = segment_pos - left_index
        left_name, left_dx, left_dy = keys[left_index]
        right_name, right_dx, right_dy = keys[right_index]
        frame = tween_frame(
            frame_for(base, str(left_name)),
            frame_for(base, str(right_name)),
            local_t,
            (float(left_dx), float(left_dy)),
            (float(right_dx), float(right_dy)),
            smear=smear,
        )
        output[f"{prefix}_{index:02d}"] = frame
    return output


def animation_metadata() -> Dict[str, Dict[str, Sequence[object]]]:
    return {
        name: {
            "frames": [f"{name}_{index:02d}" for index in range(int(spec["count"]))],
            "durations": list(spec["durations"]),
        }
        for name, spec in V3_ANIMATIONS.items()
    }


def write_v3_json(
    path: Path,
    image_name: str,
    size: Tuple[int, int],
    frames: Dict[str, object],
    animations: Mapping[str, object],
) -> None:
    validate_animation_metadata(frames, animations)
    payload = {
        "frames": frames,
        "animations": animations,
        "meta": {
            "app": "Codex Gamecast Sprite Pipeline",
            "version": "3.1",
            "image": image_name,
            "format": "RGBA8888",
            "size": {"w": size[0], "h": size[1]},
            "scale": "1",
            "frameSize": {"w": FRAME, "h": FRAME},
            "layout": "v3",
            "baselineY": BASELINE_Y,
            "centerX": CENTER_X,
            "sourceCellSize": {"w": SOURCE_CELL, "h": SOURCE_CELL},
            "integerDownscale": SOURCE_DOWNSCALE,
            "safeOpaqueSize": {"w": MAX_SPRITE_WIDTH, "h": MAX_SPRITE_HEIGHT},
            "minimumFrames": MOTION_MINIMUM_FRAMES,
            "artContract": "docs/gamecast-sprite-art-spec.md",
            "lighting": "night" if "-night." in image_name else "day",
        },
    }
    path.write_text(json.dumps(payload, ensure_ascii=True, indent=2) + "\n", encoding="utf-8")


def write_v3_atlas(
    source: Image.Image,
    output_dir: Path,
    uniform: str,
    strict_registration: bool,
    strict_art: bool,
    night: bool = False,
) -> None:
    variant = f"{uniform}-night" if night else uniform
    image_name = f"player-{variant}.png"
    base = build_v2_base_frames(source, uniform)
    dense_frames: Dict[str, Image.Image] = {}
    for name, spec in V3_ANIMATIONS.items():
        dense_frames.update(build_animation_frames(base, name, spec))
    for pose in STATIC_POSES:
        dense_frames[pose] = frame_for(base, pose)
    if night:
        dense_frames = {name: apply_night_rimlight(frame) for name, frame in dense_frames.items()}

    ordered_names = list(dense_frames.keys())
    rows = math.ceil(len(ordered_names) / V3_COLS)
    atlas = Image.new("RGBA", (V3_COLS * FRAME, rows * FRAME), (0, 0, 0, 0))
    frames: Dict[str, object] = {}
    validation_frames: Dict[str, Image.Image] = {}
    for index, name in enumerate(ordered_names):
        col = index % V3_COLS
        row = index // V3_COLS
        x = col * FRAME
        y = row * FRAME
        frame = dense_frames[name]
        atlas.alpha_composite(frame, (x, y))
        frames[name] = atlas_frame(x, y)
        validation_frames[name] = frame

    for alias, target in V3_ALIASES.items():
        if target in frames:
            frames[alias] = frames[target]

    validate_registration(validation_frames, strict_registration)
    validate_art_rules(validation_frames, uniform, strict_art, night)
    animations = animation_metadata()
    atlas.save(output_dir / image_name)
    write_v3_json(output_dir / f"player-{variant}.json", image_name, atlas.size, frames, animations)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=DEFAULT_SOURCE if DEFAULT_SOURCE.exists() else LEGACY_REFERENCE_SOURCE,
        type=Path,
    )
    parser.add_argument("--out", default=Path("assets/gamecast"), type=Path)
    parser.add_argument("--strict-registration", action="store_true")
    parser.add_argument("--strict-source-grid", action="store_true", help="Require an exact 5x4 sheet of 256px source cells")
    parser.add_argument("--strict-art", action="store_true", help="Fail 3-tone, selout, reserved-color, and palette checks")
    args = parser.parse_args()

    output_dir = args.out
    source_dir = output_dir / "source"
    output_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)

    source = Image.open(args.source).convert("RGBA")
    validate_source_grid(source, LEGACY_COLS, LEGACY_ROWS, args.strict_source_grid)
    validate_motion_contract(V3_ANIMATIONS)
    source_copy = source_dir / args.source.name
    if args.source.resolve() != source_copy.resolve():
        shutil.copyfile(args.source, source_copy)

    for uniform in ("home", "away"):
        for night in (False, True):
            write_v3_atlas(
                source,
                output_dir,
                uniform,
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
    print(f"layout: v3 ({V3_COLS} cols, dense motion)")
    print(f"source copied: {source_copy}")


if __name__ == "__main__":
    main()
