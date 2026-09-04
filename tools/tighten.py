#!/usr/bin/env python3
"""
tighten.py — turn a box read off the grid into the box the ink is in.

WHY

layouts.js is only worth having if its numbers are true, and reading them
off a printed coordinate grid by eye is accurate to about half a
gridline. That is fine for a headline filling a third of the sheet and
useless for a four-line caption at 2% of the height, where being 0.025
out puts the block visibly in the wrong place.

Segmenting a whole sheet automatically was tried first and abandoned. The
corpus is 79 saves of other people's work: some are printed on a
photograph of crumpled paper, some are white on black, some are a picture
edge to edge. A detector tuned to find the type on one of them finds the
paper grain on the next, and every attempt to fix that traded one sheet's
correctness for another's.

Scoping the question fixes it. "Where is the ink on this sheet" is hard.
"Where is the ink inside THIS window, which I have already decided
contains one block" is easy, because a window that size has an even
ground and the block is the only thing in it. So the division of labour
is: a reading of the sheet says what is where and roughly, and this says
exactly.

USE

    python3 tools/tighten.py h013 0.05 0.10 0.50 0.15
    python3 tools/tighten.py h013 --many '[[0.05,0.10,0.50,0.15],[0.5,0.3,0.4,0.1]]'

Boxes in and out are [x, y, w, h], normalised 0..1 on the frame, which is
what layouts.js stores. It prints the tightened box, how far each edge
moved, and how much of it is inked — a coverage near 1.0 means the window
was inside a photograph rather than around a block of type, which is the
one failure worth knowing about.

    --pad 0.01   grow the window before looking, for a box read short
    --dark       ink is darker than the ground (default: either)
    --light      ink is lighter
"""

from __future__ import annotations

import json
import pathlib
import sys

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
REFS = ROOT / ".refs/hooks"


def tighten(a: np.ndarray, box, pad: float = 0.0, polarity: str = "either",
            floor: float = 0.012):
    """
    The bounding box of the ink inside `box`.

    `floor` is what counts as a row or column having anything in it. A
    single stray pixel from a JPEG ring should not stretch a box by 3% of
    the sheet, and a hairline rule should not be thrown away, so the test
    is a fraction of the window's own extent rather than an absolute
    count.
    """
    H, W = a.shape[:2]
    x, y, w, h = box
    x0 = max(0, int((x - pad) * W))
    y0 = max(0, int((y - pad) * H))
    x1 = min(W, int((x + w + pad) * W))
    y1 = min(H, int((y + h + pad) * H))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None

    win = a[y0:y1, x0:x1].astype(np.float32)
    lum = (0.2126 * win[..., 0] + 0.7152 * win[..., 1] + 0.0722 * win[..., 2]) / 255

    # The ground is this window's own, taken from its border. Inside one
    # block that border is paper (or panel), which is exactly the
    # assumption a whole-sheet detector cannot make.
    edge = np.concatenate([lum[:2].ravel(), lum[-2:].ravel(),
                           lum[:, :2].ravel(), lum[:, -2:].ravel()])
    base = float(np.median(edge))
    delta = lum - base
    if polarity == "dark":
        ink = delta < -0.16
    elif polarity == "light":
        ink = delta > 0.16
    else:
        ink = np.abs(delta) > 0.16

    # colour counts as ink too: an accent rule can sit at the paper's own
    # lightness and still be the loudest thing on the sheet
    rgb_edge = np.concatenate([win[:2].reshape(-1, 3), win[-2:].reshape(-1, 3),
                               win[:, :2].reshape(-1, 3), win[:, -2:].reshape(-1, 3)])
    gbase = np.median(rgb_edge, axis=0)
    ink |= np.sqrt(((win - gbase) ** 2).sum(axis=2)) / 441.7 > 0.22

    if not ink.any():
        return None

    rows = ink.mean(axis=1)
    cols = ink.mean(axis=0)
    ry = np.flatnonzero(rows > floor)
    rx = np.flatnonzero(cols > floor)
    if not ry.size or not rx.size:
        return None

    nx0 = (x0 + rx[0]) / W
    nx1 = (x0 + rx[-1] + 1) / W
    ny0 = (y0 + ry[0]) / H
    ny1 = (y0 + ry[-1] + 1) / H
    inside = ink[ry[0]:ry[-1] + 1, rx[0]:rx[-1] + 1]
    return {
        "box": [round(nx0, 4), round(ny0, 4), round(nx1 - nx0, 4), round(ny1 - ny0, 4)],
        "coverage": round(float(inside.mean()), 2),
    }


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 1
    hid = argv[0]
    path = REFS / f"{hid}.jpg"
    if not path.exists():
        print(f"{hid}: no reference in {REFS.relative_to(ROOT)}")
        return 1

    pad = 0.0
    if "--pad" in argv:
        pad = float(argv[argv.index("--pad") + 1])
    polarity = "dark" if "--dark" in argv else "light" if "--light" in argv else "either"

    if "--many" in argv:
        boxes = json.loads(argv[argv.index("--many") + 1])
    else:
        nums = [float(v) for v in argv[1:] if not v.startswith("-")
                and v.replace(".", "", 1).replace("-", "", 1).isdigit()]
        boxes = [nums[i:i + 4] for i in range(0, len(nums) - 3, 4)]
    if not boxes:
        print("no boxes given")
        return 1

    im = Image.open(path).convert("RGB")
    a = np.asarray(im)
    print(f"{hid}  {im.size[0]}x{im.size[1]}")
    for want in boxes:
        got = tighten(a, want, pad=pad, polarity=polarity)
        if not got:
            print(f"  {fmt(want)}  ->  nothing in it")
            continue
        moved = max(abs(g - w) for g, w in zip(got["box"], want))
        note = ""
        if got["coverage"] > 0.8:
            note = "   (nearly solid — a picture, not a block of type)"
        print(f"  {fmt(want)}  ->  {fmt(got['box'])}"
              f"  moved {moved:.3f}  ink {got['coverage']:.2f}{note}")
    return 0


def fmt(b):
    return "[" + ", ".join(f"{v:.3f}" for v in b) + "]"


if __name__ == "__main__":
    raise SystemExit(main())
