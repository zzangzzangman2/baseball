#!/usr/bin/env python3
"""Render simple GIF previews from Gamecast atlas PNG/JSON files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence, Tuple

from PIL import Image, ImageDraw


DEFAULT_ANIMATIONS: Mapping[str, Mapping[str, Sequence[object]]] = {
    "swing": {"frames": ["stance", "swing", "follow"], "durations": [120, 90, 140]},
    "pitch": {"frames": ["windup", "pitch"], "durations": [140, 120]},
    "run": {"frames": ["run1", "run2"], "durations": [90, 90]},
    "walk": {"frames": ["walk1", "walk2"], "durations": [140, 140]},
    "catch": {"frames": ["field", "catch"], "durations": [120, 140]},
    "dive": {"frames": ["field", "dive"], "durations": [120, 160]},
    "slide": {"frames": ["run1", "slide"], "durations": [90, 160]},
    "catcher": {"frames": ["catcher"], "durations": [160]},
}


def load_atlas(json_path: Path, image_path: Path | None = None) -> Tuple[Image.Image, Dict[str, object], Mapping[str, object]]:
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    meta = payload.get("meta", {})
    atlas_image = image_path or json_path.with_name(str(meta.get("image", json_path.with_suffix(".png").name)))
    return Image.open(atlas_image).convert("RGBA"), payload["frames"], payload.get("animations") or DEFAULT_ANIMATIONS


def frame_box(frame_payload: Mapping[str, object]) -> Tuple[int, int, int, int]:
    frame = frame_payload["frame"]
    x = int(frame["x"])
    y = int(frame["y"])
    w = int(frame["w"])
    h = int(frame["h"])
    return (x, y, x + w, y + h)


def extract_frame(atlas: Image.Image, frames: Mapping[str, object], name: str, scale: int, pad: int) -> Image.Image:
    source_name = name
    if source_name not in frames:
        raise KeyError(source_name)
    cell = atlas.crop(frame_box(frames[source_name]))
    if scale != 1:
        cell = cell.resize((cell.width * scale, cell.height * scale), Image.Resampling.NEAREST)
    preview = Image.new("RGBA", (cell.width + pad * 2, cell.height + pad * 2), (32, 36, 42, 255))
    preview.alpha_composite(cell, (pad, pad))
    return preview.convert("P", palette=Image.Palette.ADAPTIVE, colors=64)


def available_sequence(frames: Mapping[str, object], names: Iterable[object]) -> List[str]:
    return [str(name) for name in names if str(name) in frames]


def save_gif(
    atlas: Image.Image,
    frames: Mapping[str, object],
    name: str,
    sequence: Sequence[str],
    durations: Sequence[object],
    output_dir: Path,
    scale: int,
) -> None:
    pad = max(2, scale * 2)
    images = [extract_frame(atlas, frames, frame_name, scale, pad) for frame_name in sequence]
    if not images:
        return
    normalized_durations = [int(durations[index]) if index < len(durations) else 120 for index in range(len(images))]
    images[0].save(
        output_dir / f"{name}.gif",
        save_all=True,
        append_images=images[1:],
        duration=normalized_durations,
        loop=0,
        disposal=2,
    )


def save_contact_sheet(
    atlas: Image.Image,
    frames: Mapping[str, object],
    sequences: Mapping[str, Sequence[str]],
    output_dir: Path,
    scale: int,
) -> None:
    rows = [(name, sequence) for name, sequence in sequences.items() if sequence]
    if not rows:
        return

    frame_size = 48 * scale
    label_h = 12
    gap = 4
    max_frames = max(len(sequence) for _, sequence in rows)
    width = max_frames * (frame_size + gap) + gap
    height = len(rows) * (frame_size + label_h + gap) + gap
    sheet = Image.new("RGBA", (width, height), (24, 27, 31, 255))
    draw = ImageDraw.Draw(sheet)

    for row_index, (name, sequence) in enumerate(rows):
        y = gap + row_index * (frame_size + label_h + gap)
        draw.text((gap, y), name, fill=(235, 238, 242, 255))
        for col_index, frame_name in enumerate(sequence):
            cell = atlas.crop(frame_box(frames[frame_name]))
            cell = cell.resize((frame_size, frame_size), Image.Resampling.NEAREST)
            x = gap + col_index * (frame_size + gap)
            sheet.alpha_composite(cell, (x, y + label_h))

    sheet.save(output_dir / "contact-sheet.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--atlas", default=Path("assets/gamecast/player-home.json"), type=Path, help="Atlas JSON path")
    parser.add_argument("--image", type=Path, help="Atlas PNG path; defaults to meta.image beside JSON")
    parser.add_argument("--out", default=Path("reports/motion-samples"), type=Path, help="Preview output directory")
    parser.add_argument("--scale", default=4, type=int, help="Nearest-neighbor preview scale")
    args = parser.parse_args()

    output_dir = args.out
    output_dir.mkdir(parents=True, exist_ok=True)

    atlas, frames, animations = load_atlas(args.atlas, args.image)
    rendered: Dict[str, Sequence[str]] = {}
    for anim_name, spec in animations.items():
        if not isinstance(spec, Mapping):
            continue
        sequence = available_sequence(frames, spec.get("frames", []))
        if not sequence:
            continue
        durations = spec.get("durations", [])
        save_gif(atlas, frames, str(anim_name), sequence, durations, output_dir, max(1, args.scale))
        rendered[str(anim_name)] = sequence

    save_contact_sheet(atlas, frames, rendered, output_dir, max(1, args.scale))
    print(f"wrote {len(rendered)} animation GIFs to {output_dir}")


if __name__ == "__main__":
    main()
