#!/usr/bin/env python3
"""
measure.py — put a coordinate grid over a reference so it can be read
off rather than guessed at.

The first pass at these templates kept each reference's idea and threw
away its geometry, which produced things that were "inspired by" the
sheet instead of being the sheet. The fix is not better taste, it is
numbers: where the headline actually starts, how wide it actually runs,
where the caption block actually sits.

Everything is normalised 0..1 on both axes, so a measurement taken from
a 736px Pinterest save renders correctly at 1080x1350.

    python3 tools/measure.py h001 h018 h037
    python3 tools/measure.py --all
"""

from __future__ import annotations

import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
REFS = ROOT / ".refs/hooks"
OUT = ROOT / ".refs/grid"

STEP = 0.05          # a line every 5%, labelled every 10%
SCALE = 1200         # tall enough to read the labels


def font(size: int):
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        if pathlib.Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def gridded(path: pathlib.Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    h = SCALE
    w = int(im.width * (h / im.height))
    im = im.resize((w, h), Image.LANCZOS)

    over = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    f = font(17)

    n = int(1 / STEP)
    for i in range(n + 1):
        t = i * STEP
        x = int(t * w)
        y = int(t * h)
        major = abs((t * 10) % 1) < 1e-6
        col = (255, 60, 40, 190) if major else (0, 200, 255, 90)
        d.line([(x, 0), (x, h)], fill=col, width=2 if major else 1)
        d.line([(0, y), (w, y)], fill=col, width=2 if major else 1)
        if major and i:
            # labelled on both axes, with a dark plate so the number is
            # readable over a light sheet and a dark one alike
            for pos in ((x + 4, 4), (4, y + 4)):
                d.rectangle([pos[0] - 2, pos[1] - 2, pos[0] + 34, pos[1] + 20],
                            fill=(0, 0, 0, 170))
            d.text((x + 4, 4), f"{t:.1f}", font=f, fill=(255, 255, 255, 255))
            d.text((4, y + 4), f"{t:.1f}", font=f, fill=(255, 255, 255, 255))

    return Image.alpha_composite(im.convert("RGBA"), over).convert("RGB")


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    ids = ([p.stem for p in sorted(REFS.glob("*.jpg"))]
           if "--all" in args else [a for a in args if a.startswith("h")])
    if not ids:
        print(__doc__)
        return 1
    for i in ids:
        src = REFS / f"{i}.jpg"
        if not src.exists():
            print(f"  {i}: no such reference")
            continue
        gridded(src).save(OUT / f"{i}.jpg", quality=93)
        print(f"  {OUT.relative_to(ROOT)}/{i}.jpg")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
