#!/usr/bin/env python3
"""
hook_sheets.py — the reference beside what we made from it.

The point is triage. Ashley has to be able to look at one page, see the
sheet he saved next to our version of it, and say keep or kill. Anything
that makes him open two folders and compare by memory is a page he will
not go through.

Each pair carries the id, the technique the hook uses, and what the
template still needs from him, because "this one is good" and "this one
needs a photograph I have not taken" are different answers.

    python3 tools/hook_sheets.py
"""

from __future__ import annotations

import json
import pathlib
import re
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
REFS = ROOT / ".refs/hooks"
OUT = ROOT / ".refs/comp"
SHEETS = ROOT / ".refs/triage"

CELL_W = 520
CELL_H = 650
GAP = 16
HEAD = 74
PER_PAGE = 3          # three pairs a page, so each is big enough to judge


def catalogue() -> list[dict]:
    """Read the catalogue out of the JS rather than keeping a second copy."""
    got = subprocess.run(
        ["node", "-e",
         "import('./lib/hooks/catalogue.js').then(m => "
         "console.log(JSON.stringify(m.HOOKS)))"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    return json.loads(got.stdout)


def font(size: int, bold: bool = False):
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf" % ("-Bold" if bold else ""),
        "/usr/share/fonts/truetype/liberation/LiberationSans%s.ttf" % ("-Bold" if bold else ""),
    ):
        if pathlib.Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default()


def fit(im: Image.Image, w: int, h: int) -> Image.Image:
    out = im.copy()
    out.thumbnail((w, h), Image.LANCZOS)
    return out


def main() -> int:
    SHEETS.mkdir(parents=True, exist_ok=True)
    for old in SHEETS.glob("*.jpg"):
        old.unlink()

    hooks = catalogue()
    f_id = font(30, True)
    f_move = font(23)
    f_note = font(19)
    f_small = font(17)

    pages = 0
    for start in range(0, len(hooks), PER_PAGE):
        batch = hooks[start:start + PER_PAGE]
        W = CELL_W * 2 + GAP * 3
        H = (CELL_H + HEAD) * len(batch) + GAP * (len(batch) + 1)
        sheet = Image.new("RGB", (W, H), "#131313")
        d = ImageDraw.Draw(sheet)

        for row, h in enumerate(batch):
            y = GAP + row * (CELL_H + HEAD + GAP)

            # the header: what it is, what move it makes, what it needs
            needs = ", ".join(h.get("needs") or []) or "type only"
            blocked = h.get("blocked")
            d.text((GAP, y), h["id"], font=f_id, fill="#ffcc00")
            d.text((GAP + 90, y + 4), h["move"], font=f_move, fill="#f0eee8")
            d.text((GAP + 90, y + 34), f"{h['family']}  ·  needs: {needs}",
                   font=f_note, fill="#8d8880")
            if blocked:
                d.text((W - GAP - 320, y + 4), "BLOCKED: real person's face",
                       font=f_note, fill="#ff6b5a")
            d.text((W - GAP - 320, y + 34), re.sub(r"\s+", " ", h["note"])[:64],
                   font=f_small, fill="#6f6a63")

            top = y + HEAD
            d.text((GAP, top - 6), "reference", font=f_small, fill="#5e5a54")
            d.text((GAP * 2 + CELL_W, top - 6), "ours", font=f_small, fill="#5e5a54")

            ref = REFS / f"{h['id']}.jpg"
            ours = OUT / f"{h['id']}.jpg"
            if ref.exists():
                im = fit(Image.open(ref).convert("RGB"), CELL_W, CELL_H)
                sheet.paste(im, (GAP, top))
            if ours.exists():
                im = fit(Image.open(ours).convert("RGB"), CELL_W, CELL_H)
                sheet.paste(im, (GAP * 2 + CELL_W, top))
            else:
                d.rectangle([GAP * 2 + CELL_W, top,
                             GAP * 2 + CELL_W * 2, top + CELL_H], outline="#3a3a3a")
                d.text((GAP * 2 + CELL_W + 20, top + 20), "not rendered",
                       font=f_note, fill="#6f6a63")

        path = SHEETS / f"t{pages:02d}.jpg"
        sheet.save(path, quality=88)
        pages += 1

    print(f"{pages} triage sheets in {SHEETS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
