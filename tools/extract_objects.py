#!/usr/bin/env python3
"""
Cut objects out of a sheet and key them onto transparency.

This is the asset step the carousel pipeline needs: point it at a
folder of photographs and get back one cleanly-keyed PNG per object,
trimmed to its own ink, plus a score saying how well it keyed so bad
crops can be thrown away before they reach a design.

How it works, since none of it is machine learning:

  1. the background colour is the median of the border ring
  2. every pixel within `tolerance` of that colour is background-like
  3. only the background-like regions actually touching the border are
     truly background — this is what stops a white shirt in the middle of
     the frame from being deleted along with a white wall
  4. what is left is closed, to fill the pinholes that a JPEG leaves
  5. the remainder is labelled, and each blob over `min-area` comes out
     as its own file, cropped to its bounding box
  6. alpha is a soft ramp on colour distance, not a hard threshold, so
     edges are not stair-stepped

`keyability` is the number worth trusting. It is the share of the
object's outline that came out fully opaque; an object shot against a
plain wall scores near 1, an object whose edges dissolve into a busy
or same-coloured background scores low and should be rejected rather
than fixed.

    python3 tools/extract_objects.py IN_DIR -o OUT_DIR
    python3 tools/extract_objects.py IN_DIR -o OUT_DIR --min-keyability 0.7

NOTE ON WHAT YOU POINT IT AT. The tool does not care about the source,
but you should: an object cut out of somebody else's finished poster
is still their photograph, and publishing it commercially is copying.
Run it over your own shots and properly-licensed stock for anything
that ships; over a reference set it is a study aid, and the manifest
records the source file so provenance never gets lost.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

# Work no larger than this on the long edge. Big enough to keep an
# object usable at panel size, small enough to stay quick.
MAX_EDGE = 1600
# Border ring sampled for the background colour, as a share of the edge.
BORDER = 0.02


def load(path: pathlib.Path) -> Image.Image:
    im = Image.open(path).convert("RGB")
    scale = MAX_EDGE / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)),
                       Image.LANCZOS)
    return im


def background_mask(a: np.ndarray, tolerance: float) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns (is_background, distance) where distance is 0..1 colour
    distance from the sheet's background colour.
    """
    h, w, _ = a.shape
    ring = max(2, round(min(h, w) * BORDER))
    border = np.concatenate([
        a[:ring].reshape(-1, 3), a[-ring:].reshape(-1, 3),
        a[:, :ring].reshape(-1, 3), a[:, -ring:].reshape(-1, 3),
    ])
    bg = np.median(border, axis=0)

    dist = np.sqrt(((a - bg) ** 2).sum(axis=2)) / (255 * np.sqrt(3))
    near = dist < tolerance

    # only the background-like regions that reach the border are really
    # the background; an interior patch of the same colour is part of
    # the object and deleting it punches a hole through the middle
    lab, n = ndimage.label(near)
    if n == 0:
        return np.zeros((h, w), bool), dist
    touching = set(lab[0].tolist()) | set(lab[-1].tolist()) \
        | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    touching.discard(0)
    is_bg = np.isin(lab, list(touching)) if touching else np.zeros((h, w), bool)
    return is_bg, dist


def clean(fg: np.ndarray, radius: int = 3) -> np.ndarray:
    """Close pinholes, then drop specks, then fill enclosed holes."""
    st = np.ones((radius, radius), bool)
    fg = ndimage.binary_closing(fg, structure=st)
    fg = ndimage.binary_opening(fg, structure=np.ones((2, 2), bool))
    return ndimage.binary_fill_holes(fg)


def alpha_from(dist: np.ndarray, mask: np.ndarray,
               tolerance: float, feather: float) -> np.ndarray:
    """
    A soft ramp rather than a threshold: fully transparent at the
    background colour, fully opaque by tolerance*(1+feather), linear in
    between. A hard cut is what makes a cut-out look like a sticker.
    """
    lo, hi = tolerance, tolerance * (1.0 + feather)
    ramp = np.clip((dist - lo) / max(hi - lo, 1e-6), 0, 1)
    return (ramp * mask).astype(np.float32)


def photographic(rgb: np.ndarray, alpha: np.ndarray) -> float:
    """
    Whether a blob is a photograph or a letterform, 0..1.

    Run over a poster, the highest-scoring cut-outs come back as type:
    a headline set in flat black on a flat ground keys perfectly,
    because that is exactly the condition the keyer is built for. The
    separator is colour. A photographed object carries hundreds of
    distinct values and real per-channel variance; a glyph carries one
    or two, whatever the antialiasing adds at its edge.

    Scored on the interior only, eroded away from the edge, so the
    antialiasing ramp does not read as photographic detail.
    """
    solid = alpha > 0.6
    inner = ndimage.binary_erosion(solid, np.ones((7, 7), bool))
    if inner.sum() < 200:
        inner = solid
    if inner.sum() < 40:
        return 0.0
    px = rgb[inner]
    # spread of values within the object, per channel, normalised
    spread = float(px.std(axis=0).mean()) / 64.0
    # how many distinct colours survive a coarse quantise
    q = (px // 24).astype(np.int16)
    distinct = len(np.unique(q[:, 0] * 121 + q[:, 1] * 11 + q[:, 2]))
    variety = min(1.0, distinct / 60.0)
    return round(float(min(1.0, 0.5 * min(1.0, spread) + 0.5 * variety)), 3)


def keyability(alpha: np.ndarray) -> float:
    """
    How clean the edge is: of the pixels on the object's outline, what
    share resolved to fully opaque or fully clear rather than sitting in
    the mushy middle. Low means the object and its background were too
    close in colour to separate.
    """
    solid = alpha > 0.02
    if solid.sum() == 0:
        return 0.0
    edge = solid ^ ndimage.binary_erosion(solid, np.ones((5, 5), bool))
    band = alpha[edge]
    if band.size == 0:
        return 0.0
    decided = ((band < 0.08) | (band > 0.92)).mean()
    return float(decided)


def from_alpha(path: pathlib.Path, out_dir: pathlib.Path) -> list[dict] | None:
    """A source that already carries alpha is trimmed, not keyed."""
    im = Image.open(path)
    if im.mode not in ("RGBA", "LA", "P") or "transparency" not in im.info \
            and im.mode != "RGBA":
        return None
    im = im.convert("RGBA")
    scale = MAX_EDGE / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)),
                       Image.LANCZOS)
    a = np.asarray(im)
    alpha = a[..., 3].astype(np.float32) / 255
    cover = float((alpha > 0.5).mean())
    if cover < 0.03 or cover > 0.92:
        return None                       # no alpha worth having, or none at all
    ys, xs = np.where(alpha > 0.02)
    if not ys.size:
        return None
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    sub = a[y0:y1, x0:x1]
    score = keyability(alpha[y0:y1, x0:x1])
    photo = photographic(sub[..., :3].astype(np.float32), alpha[y0:y1, x0:x1])
    name = f"{path.stem}-01.png"
    Image.fromarray(sub, "RGBA").save(out_dir / name)
    return [{
        "file": name, "source": path.name,
        "bbox": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
        "area_share": round(cover, 4),
        "keyability": round(score, 3), "photographic": photo,
        "aspect": round((x1 - x0) / (y1 - y0), 3),
        "had_alpha": True,
    }]


def extract(path: pathlib.Path, out_dir: pathlib.Path, *,
            tolerance: float, min_area: float, feather: float,
            max_objects: int) -> list[dict]:
    got = from_alpha(path, out_dir)
    if got is not None:
        return got
    im = load(path)
    a = np.asarray(im, dtype=np.float32)
    h, w, _ = a.shape

    is_bg, dist = background_mask(a, tolerance)
    fg = clean(~is_bg)

    lab, n = ndimage.label(fg)
    if n == 0:
        return []

    areas = ndimage.sum(fg, lab, range(1, n + 1))
    floor = min_area * h * w
    keep = [i + 1 for i in np.argsort(areas)[::-1] if areas[i] >= floor]
    keep = keep[:max_objects]

    rows = []
    for rank, idx in enumerate(keep, 1):
        mask = lab == idx
        ys, xs = np.where(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        # a sliver spanning the whole sheet is a border artefact, not a thing
        if (x1 - x0) >= w - 2 and (y1 - y0) >= h - 2:
            continue

        sub_alpha = alpha_from(dist[y0:y1, x0:x1], mask[y0:y1, x0:x1],
                               tolerance, feather)
        sub_rgb = a[y0:y1, x0:x1]
        score = keyability(sub_alpha)
        photo = photographic(sub_rgb, sub_alpha)

        rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        rgba[..., :3] = a[y0:y1, x0:x1].astype(np.uint8)
        rgba[..., 3] = (sub_alpha * 255).astype(np.uint8)

        name = f"{path.stem}-{rank:02d}.png"
        Image.fromarray(rgba, "RGBA").save(out_dir / name)
        rows.append({
            "file": name,
            "source": path.name,
            "bbox": [int(x0), int(y0), int(x1 - x0), int(y1 - y0)],
            "area_share": round(float(mask.sum()) / (h * w), 4),
            "keyability": round(score, 3),
            "photographic": photo,
            "aspect": round((x1 - x0) / (y1 - y0), 3),
        })
    return rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("directory")
    ap.add_argument("-o", "--out", default="build/objects")
    ap.add_argument("--tolerance", type=float, default=0.10,
                    help="colour distance counted as background, 0..1")
    ap.add_argument("--min-area", type=float, default=0.012,
                    help="smallest object, as a share of the sheet")
    ap.add_argument("--feather", type=float, default=0.9,
                    help="width of the alpha ramp, as a multiple of tolerance")
    ap.add_argument("--max-objects", type=int, default=8)
    ap.add_argument("--min-keyability", type=float, default=0.0,
                    help="discard objects whose edge did not resolve")
    ap.add_argument("--min-photographic", type=float, default=0.0,
                    help="discard letterforms and flat vector shapes")
    args = ap.parse_args()

    root = pathlib.Path(args.directory)
    out = pathlib.Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    files = sorted(p for p in root.iterdir()
                   if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    if not files:
        print(f"no images in {root}", file=sys.stderr)
        return 1

    rows: list[dict] = []
    for p in files:
        try:
            rows.extend(extract(p, out, tolerance=args.tolerance,
                                min_area=args.min_area, feather=args.feather,
                                max_objects=args.max_objects))
        except Exception as exc:                      # noqa: BLE001
            print(f"  {p.name}: {exc}", file=sys.stderr)

    kept = [r for r in rows
            if r["keyability"] >= args.min_keyability
            and r["photographic"] >= args.min_photographic]
    for r in rows:
        if r not in kept:
            (out / r["file"]).unlink(missing_ok=True)

    (out / "manifest.json").write_text(json.dumps(kept, indent=2) + "\n")

    good = [r for r in kept
            if r["keyability"] >= 0.75 and r["photographic"] >= 0.55]
    print(f"{len(files)} sheets -> {len(kept)} objects in {out}")
    if kept:
        med = float(np.median([r["keyability"] for r in kept]))
        print(f"  median keyability {med:.2f}")
        print(f"  clean enough to use ({len(good)}):")
        for r in sorted(good, key=lambda r: -r["keyability"])[:12]:
            print(f"    {r['file']:26} key {r['keyability']:.2f}"
                  f"  photo {r['photographic']:.2f}"
                  f"  {r['bbox'][2]}x{r['bbox'][3]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
