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

WHEN THE ANSWER IS NOT AN ANSWER

Everything above holds only while the window CONTAINS the block with
ground showing on all four sides. Put the window inside the block, or
over a photograph, and the ink runs to the window's own boundary; the
box that comes back is then the box that went in, edge for edge. That
is not a measurement, it is an echo, and it looks exactly like a
measurement because the numbers are printed to three decimals either
way.

So every edge is now checked for clearance — clear ground between the
ink and that side of the window — and an edge with none of it is printed
as `clip` and left as whatever was guessed. A box is only `MEASURED`
when all four edges cleared. `CLIPPED` means widen the window on the
named sides and run it again. Nothing that says CLIPPED may be written
into layouts.js as measured.

USE

    python3 tools/tighten.py h013 0.05 0.10 0.50 0.15
    python3 tools/tighten.py h013 --many '[[0.05,0.10,0.50,0.15],[0.5,0.3,0.4,0.1]]'

Boxes in and out are [x, y, w, h], normalised 0..1 on the frame, which is
what layouts.js stores.

    --pad 0.01   grow the window before looking, for a box read short
    --dark       ink is darker than the ground (default: either)
    --light      ink is lighter
    --cut 0.16   how far off the window's ground counts as ink
    --white      ink is white type on a photograph
    --floor 0.03 how much of a row must be inked for the row to count
    --panel      ink is a translucent panel: found by its edges, not its fill
    --near 20,20,20 --cut 0.10
                 ink is this colour, within this distance. The one to
                 reach for when the window has several grounds in it and
                 no median describes any of them: black pills lying
                 across a red flood, a hand and a fork.

`--white` exists because the window's own border stops being a usable
ground the moment the window is over a photograph: a nostril and a lit
lip are further apart than the type is from either, so a median of the
border describes nothing and the answer comes back as noise or as
nothing at all. White type is not "brighter than its surroundings", it
is bright AND colourless, and a warm photograph has nothing else that
is both. Say which of the two the ink is and the sheet stops mattering.
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
            floor: float = 0.012, cut: float = 0.16, near=None):
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

    if polarity == "white":
        sat = (win.max(axis=2) - win.min(axis=2)) / 255
        ink = (lum > 0.78) & (sat < 0.14)
        return _bbox(ink, x0, y0, W, H, floor)

    if polarity == "panel":
        # A translucent panel has no colour of its own: it darkens
        # whatever it is laid over, so over red it is lighter than the
        # ground and over a white plate it is darker, and no threshold
        # finds both. Its EDGE is the invariant — a step, in the same
        # direction on both sides of it, all the way along. So the panel
        # is measured by its four strongest steps rather than by its fill.
        prof_x = np.median(lum[int(lum.shape[0] * 0.35):int(lum.shape[0] * 0.65)], axis=0)
        prof_y = np.median(lum[:, int(lum.shape[1] * 0.35):int(lum.shape[1] * 0.65)], axis=1)
        l, r = _step(prof_x)
        t, b = _step(prof_y)
        if None in (l, r, t, b):
            return None
        ink = np.zeros(lum.shape, dtype=bool)
        ink[t:b + 1, l:r + 1] = True
        return _bbox(ink, x0, y0, W, H, floor)

    if near is not None:
        # Distance in RGB, scaled so 1.0 is black to white. Absolute, not
        # relative to anything in the window: that is the whole point when
        # the window has three different grounds in it.
        d = np.sqrt(((win - np.array(near, dtype=np.float32)) ** 2).sum(axis=2)) / 441.7
        return _bbox(d < cut, x0, y0, W, H, floor)

    # The ground is this window's own, taken from its border. Inside one
    # block that border is paper (or panel), which is exactly the
    # assumption a whole-sheet detector cannot make.
    edge = np.concatenate([lum[:2].ravel(), lum[-2:].ravel(),
                           lum[:, :2].ravel(), lum[:, -2:].ravel()])
    base = float(np.median(edge))
    delta = lum - base
    if polarity == "dark":
        ink = delta < -cut
    elif polarity == "light":
        ink = delta > cut
    else:
        ink = np.abs(delta) > cut

    # colour counts as ink too: an accent rule can sit at the paper's own
    # lightness and still be the loudest thing on the sheet
    rgb_edge = np.concatenate([win[:2].reshape(-1, 3), win[-2:].reshape(-1, 3),
                               win[:, :2].reshape(-1, 3), win[:, -2:].reshape(-1, 3)])
    gbase = np.median(rgb_edge, axis=0)
    ink |= np.sqrt(((win - gbase) ** 2).sum(axis=2)) / 441.7 > 0.22

    return _bbox(ink, x0, y0, W, H, floor)


def _step(p):
    """The strongest inward step on each side of a profile's middle."""
    d = np.diff(p.astype(np.float32))
    if d.size < 6:
        return None, None
    mid = d.size // 2
    # Inward from each end, not the strongest step overall: the biggest
    # step in the window is usually the white number INSIDE the panel,
    # and taking that measures the number instead of the panel.
    lim = 0.45 * float(np.abs(d).max())
    a = np.flatnonzero(np.abs(d[:mid]) >= lim)
    z = np.flatnonzero(np.abs(d[mid:]) >= lim)
    if not a.size or not z.size:
        return None, None
    lo = int(a[0])
    hi = mid + int(z[-1])
    # the two steps have to face each other: into the panel, then out of it
    if np.sign(d[lo]) == np.sign(d[hi]):
        return None, None
    return lo + 1, hi


def _bbox(ink, x0, y0, W, H, floor: float = 0.012):
    """The ink's bounding box, and how much clear ground surrounds it."""
    if not ink.any():
        return None
    ry = np.flatnonzero(ink.mean(axis=1) > floor)
    rx = np.flatnonzero(ink.mean(axis=0) > floor)
    if not ry.size or not rx.size:
        return None

    nx0 = (x0 + rx[0]) / W
    nx1 = (x0 + rx[-1] + 1) / W
    ny0 = (y0 + ry[0]) / H
    ny1 = (y0 + ry[-1] + 1) / H
    inside = ink[ry[0]:ry[-1] + 1, rx[0]:rx[-1] + 1]

    # Clear ground between the ink and the side of the window. An edge
    # with none of it did not find the block's boundary — it found the
    # window's, which is the number that was already guessed. Three
    # pixels, because two are the strip the ground was taken from.
    need = 3
    clear = {
        "left": int(rx[0]), "right": int(ink.shape[1] - 1 - rx[-1]),
        "top": int(ry[0]), "bottom": int(ink.shape[0] - 1 - ry[-1]),
    }
    return {
        "box": [round(nx0, 4), round(ny0, 4), round(nx1 - nx0, 4), round(ny1 - ny0, 4)],
        "coverage": round(float(inside.mean()), 2),
        "clear": clear,
        "clipped": [k for k, v in clear.items() if v < need],
    }


def main() -> int:
    argv = sys.argv[1:]
    if not argv:
        print(__doc__)
        return 1
    hid = argv[0]
    # a path, for a reference that is not one of the 79 hook sheets
    path = pathlib.Path(hid) if ("/" in hid or hid.lower().endswith((".png", ".jpg")))\
        else REFS / f"{hid}.jpg"
    if not path.exists():
        print(f"{hid}: no reference in {REFS.relative_to(ROOT)}")
        return 1

    pad = 0.0
    if "--pad" in argv:
        pad = float(argv[argv.index("--pad") + 1])
    cut = float(argv[argv.index("--cut") + 1]) if "--cut" in argv else 0.16
    floor = float(argv[argv.index("--floor") + 1]) if "--floor" in argv else 0.012
    near = ([float(v) for v in argv[argv.index("--near") + 1].split(",")]
            if "--near" in argv else None)
    polarity = ("panel" if "--panel" in argv
                else "white" if "--white" in argv else "dark" if "--dark" in argv
                else "light" if "--light" in argv else "either")

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
    bad = 0
    for want in boxes:
        got = tighten(a, want, pad=pad, polarity=polarity, cut=cut, floor=floor,
                      near=near)
        if not got:
            bad += 1
            print(f"  {fmt(want)}  ->  NOTHING IN IT — no ink stood out from "
                  f"this window's own ground")
            continue
        moved = max(abs(g - w) for g, w in zip(got["box"], want))
        print(f"  {fmt(want)}  ->  {fmt(got['box'])}"
              f"  moved {moved:.3f}  ink {got['coverage']:.2f}")
        if got["clipped"]:
            bad += 1
            sides = ", ".join(got["clipped"])
            print(f"      CLIPPED on {sides}. Those edges are your window, not "
                  f"the block. Widen there and run it again.")
        else:
            print(f"      MEASURED. Clear ground {got['clear']['left']}/"
                  f"{got['clear']['right']}/{got['clear']['top']}/"
                  f"{got['clear']['bottom']} px (l/r/t/b).")
            # Solid is the right answer for a pill or a panel and the wrong
            # one for words, and only the caller knows which was asked for.
            # It is a measurement either way: the edges cleared.
            if got["coverage"] > 0.8:
                print("      Solid all through. Right for a filled shape, "
                      "wrong for a block of type.")
    if bad:
        print(f"\n  {bad} of {len(boxes)} did not measure. Do not write those "
              f"into layouts.js.")
    return 0


def fmt(b):
    return "[" + ", ".join(f"{v:.3f}" for v in b) + "]"


if __name__ == "__main__":
    raise SystemExit(main())
