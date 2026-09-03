#!/usr/bin/env python3
"""
Measure the reference set, and turn what is measurable into tokens.

The references are other people's finished designs. Their photographs,
illustrations and cut-out objects are theirs and none of that is lifted
here. What this reads instead is the part that is arithmetic rather than
authorship:

  palette         the colours actually used, by area, after quantising
  ink coverage    what fraction of the sheet is dark
  contrast        how the tones are distributed, as percentiles
  grain           high-frequency energy, so a procedural grain can be
                  matched to the print rather than guessed at
  halftone pitch  the dominant spacing of the dot screen, where there
                  is one, found on the autocorrelation of a row strip

The output is a JSON of numbers. Numbers are not copyrightable, and a
palette regenerated from them is our own file — which is the difference
between learning from a reference and taking from one.

    python3 tools/extract_refs.py <dir> -o build/refs.json
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter

import numpy as np
from PIL import Image

# Long edge to work at. Big enough that a halftone screen survives,
# small enough that 29 files is a couple of seconds.
WORK = 900
# Quantise to this many colours before counting, so near-identical
# scanner noise does not read as thirty separate greys.
QUANT = 12


def load(path: pathlib.Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    scale = WORK / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)),
                       Image.LANCZOS)
    return im


def palette(im: Image.Image, n: int = QUANT) -> list[dict]:
    """Colours by the area they cover, largest first."""
    q = im.quantize(colors=n, method=Image.MEDIANCUT)
    pal = q.getpalette()[: n * 3]
    counts = Counter(q.get_flattened_data())
    total = sum(counts.values())
    out = []
    for idx, count in counts.most_common():
        r, g, b = pal[idx * 3: idx * 3 + 3]
        out.append({
            "hex": f"#{r:02X}{g:02X}{b:02X}",
            "share": round(count / total, 4),
            # luminance decides whether a colour can carry text
            "lum": round((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, 3),
        })
    return out


def relative_luminance(hex_colour: str) -> float:
    """WCAG relative luminance, for the contrast pairs."""
    r, g, b = (int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast_ratio(a: str, b: str) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def grain(g: np.ndarray) -> dict:
    """
    High-frequency energy, as the standard deviation of the difference
    between the image and a 3x3 box blur of itself. A clean vector
    export lands near zero; a scanned or deliberately grained sheet
    does not. This is the number a procedural grain should match.
    """
    k = np.ones((3, 3), dtype=np.float32) / 9.0
    pad = np.pad(g, 1, mode="edge")
    blur = sum(
        pad[i:i + g.shape[0], j:j + g.shape[1]] * k[i, j]
        for i in range(3) for j in range(3)
    )
    hi = g - blur
    return {
        "sigma": round(float(hi.std()), 4),
        "peak": round(float(np.abs(hi).max()), 4),
    }


def halftone_pitch(g: np.ndarray) -> int | None:
    """
    Dominant repeat, in pixels, of whatever screen the sheet was printed
    through. Taken as the first strong peak of the autocorrelation of a
    horizontal strip through the middle. Returns None when nothing
    repeats strongly enough to call a screen.
    """
    strip = g[g.shape[0] // 2 - 20: g.shape[0] // 2 + 20].mean(axis=0)
    strip = strip - strip.mean()
    if strip.std() < 1e-4:
        return None
    ac = np.correlate(strip, strip, mode="full")[len(strip) - 1:]
    ac /= ac[0]
    # ignore lag 0..2, look for the first local max above a threshold
    for lag in range(3, min(40, len(ac) - 1)):
        if ac[lag] > 0.35 and ac[lag] > ac[lag - 1] and ac[lag] >= ac[lag + 1]:
            return lag
    return None


def measure(path: pathlib.Path) -> dict:
    im = load(path)
    a = np.asarray(im, dtype=np.float32) / 255.0
    g = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

    pal = palette(im)
    # the two colours most likely to be ground and mark
    ground = pal[0]["hex"]
    mark = max(pal[1:6], key=lambda c: contrast_ratio(ground, c["hex"]))["hex"]

    return {
        "file": path.name,
        "size": list(im.size),
        "palette": pal[:8],
        "ground": ground,
        "mark": mark,
        "ground_mark_contrast": round(contrast_ratio(ground, mark), 2),
        "ink_coverage": round(float((g < 0.35).mean()), 4),
        "blown_out": round(float((g > 0.95).mean()), 4),
        "contrast": {
            "p05": round(float(np.percentile(g, 5)), 3),
            "p50": round(float(np.percentile(g, 50)), 3),
            "p95": round(float(np.percentile(g, 95)), 3),
        },
        "grain": grain(g),
        "halftone_pitch": halftone_pitch(g),
        "saturation": round(float((a.max(-1) - a.min(-1)).mean()), 4),
    }


def summarise(rows: list[dict]) -> dict:
    """What the set agrees on, which is what is worth copying."""
    med = lambda key: round(float(np.median([r[key] for r in rows])), 4)
    pitches = [r["halftone_pitch"] for r in rows if r["halftone_pitch"]]
    return {
        "count": len(rows),
        "ink_coverage_median": med("ink_coverage"),
        "saturation_median": med("saturation"),
        "grain_sigma_median": round(
            float(np.median([r["grain"]["sigma"] for r in rows])), 4),
        "ground_mark_contrast_median": med("ground_mark_contrast"),
        "screened_share": round(len(pitches) / len(rows), 3),
        "halftone_pitch_median": int(np.median(pitches)) if pitches else None,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("directory")
    ap.add_argument("-o", "--out", default="build/refs.json")
    args = ap.parse_args()

    root = pathlib.Path(args.directory)
    files = sorted(
        p for p in root.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    )
    if not files:
        print(f"no images in {root}", file=sys.stderr)
        return 1

    rows = [measure(p) for p in files]
    doc = {"summary": summarise(rows), "references": rows}

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, indent=2) + "\n")

    s = doc["summary"]
    print(f"{s['count']} references -> {out}")
    print(f"  ink coverage      {s['ink_coverage_median']}")
    print(f"  saturation        {s['saturation_median']}")
    print(f"  grain sigma       {s['grain_sigma_median']}")
    print(f"  ground/mark ratio {s['ground_mark_contrast_median']}:1")
    print(f"  screened          {s['screened_share']:.0%}"
          f" (pitch {s['halftone_pitch_median']}px)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
