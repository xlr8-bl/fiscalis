#!/usr/bin/env python3
"""
service_icons.py — the marks in the services grid.

    python3 tools/service_icons.py        # write them into index.html

Small objects, built out of cubes and drawn in isometric projection. Each
mark is a list of voxel coordinates; the geometry is worked out here rather
than drawn by eye, so the projection is exact and every mark sits on the
same grid, at the same angle, lit from the same side.

Three passes at this before it landed. The export shipped primitives — a
circle, a plus, a diamond — that said nothing. Replacing them with thin
rounded outline strokes only swapped one anonymity for another: that is
the house style of every free icon library. Bitmaps came next and had the
right idea, rhyming with the pixel wordmark, but flat.

Depth is what makes them read as designed rather than picked. A cube shows
three faces, and shading them apart — top brightest, then the left, then
the right, as though the light comes over your shoulder — carries the form
without introducing a single colour the site does not already use.

    top    the full ink
    left   58% of it
    right  30%

Silhouette does the identifying, so no two marks share one: flat and wide,
a diagonal rise, a standing slab, an angular L, four columns, a pin on a
plate, a pair with a span between them, a stack.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Isometric projection. The top of a cube is a rhombus twice as wide as it
# is tall, which is the ratio that reads as isometric rather than as a
# drawing mistake. RISE is the vertical travel of one cube of height.
HALF_W, HALF_H, RISE = 1.0, 0.5, 1.15


def project(x: float, y: float, z: float) -> tuple[float, float]:
    return ((x - y) * HALF_W, (x + y) * HALF_H - z * RISE)


# The three faces you can see, as offsets from a cube's origin, with the
# share of the ink each one takes.
FACES = (
    (((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)), 1.0),    # top
    (((0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)), 0.58),   # left
    (((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)), 0.30),   # right
)


def plate(w: int, d: int, z: int = 0) -> list[tuple[int, int, int]]:
    return [(x, y, z) for x in range(w) for y in range(d)]


def column(x: int, y: int, height: int) -> list[tuple[int, int, int]]:
    return [(x, y, z) for z in range(height)]


# Each mark, as the cubes it is made of.
MARKS: dict[str, list[tuple[int, int, int]]] = {
    # a board with things laid out on it — wide and flat
    'Web design': plate(3, 3) + [(0, 0, 1), (1, 0, 1), (2, 2, 1)],

    # a rise, two cubes wide, stepping up
    'Development': [
        (0, 0, 0), (0, 1, 0),
        (1, 0, 0), (1, 1, 0), (1, 0, 1), (1, 1, 1),
        (2, 0, 0), (2, 1, 0), (2, 0, 1), (2, 1, 1), (2, 0, 2), (2, 1, 2),
    ],

    # a slab stood on its end
    'Mobile apps': [(0, y, z) for y in range(2) for z in range(3)],

    # an angular fixture, raised at both ends
    'Internal tools': [
        (0, 0, 0), (1, 0, 0), (2, 0, 0), (0, 1, 0), (0, 2, 0),
        (0, 0, 1), (2, 0, 1), (0, 2, 1),
    ],

    # four readings. Standing them a cube apart reads as four things when
    # you blow the mark up and as scatter at the size it is actually shown,
    # so they stay shoulder to shoulder and climb.
    'Analytics': (column(0, 0, 1) + column(1, 0, 2) + column(2, 0, 3) + column(3, 0, 4)),

    # a plate, and the one thing standing up out of it
    'Search': plate(3, 3) + column(1, 1, 3)[1:],

    # two of them, and the span between
    'Integrations': [
        (0, 0, 0), (0, 0, 1), (0, 1, 0), (0, 1, 1),
        (1, 0, 0), (1, 1, 0),
        (2, 0, 0), (2, 0, 1), (2, 1, 0), (2, 1, 1),
    ],

    # stacked, and offset, so someone is on top of it
    'Support': plate(2, 2) + [(0, 0, 1), (0, 0, 2)],
}


def draw(voxels: list[tuple[int, int, int]], box: float = 32.0, pad: float = 2.0) -> str:
    """Polygons for one mark, back to front, fitted to the viewBox."""
    # Painter's order: further back first. Larger x+y is nearer the viewer,
    # and within a column the lower cube is drawn before the one on it.
    ordered = sorted(set(voxels), key=lambda v: (v[0] + v[1], v[2]))

    faces = []
    for (vx, vy, vz) in ordered:
        for corners, ink in FACES:
            pts = [project(vx + dx, vy + dy, vz + dz) for dx, dy, dz in corners]
            faces.append((pts, ink))

    xs = [p[0] for pts, _ in faces for p in pts]
    ys = [p[1] for pts, _ in faces for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys)) or 1.0
    scale = (box - pad * 2) / span
    # centre what is drawn inside the square
    ox = (box - (max(xs) - min(xs)) * scale) / 2 - min(xs) * scale
    oy = (box - (max(ys) - min(ys)) * scale) / 2 - min(ys) * scale

    out = []
    for pts, ink in faces:
        pairs = ' '.join(f'{x * scale + ox:.2f},{y * scale + oy:.2f}' for x, y in pts)
        opacity = '' if ink == 1.0 else f' opacity="{ink}"'
        out.append(f'<polygon points="{pairs}"{opacity}/>')
    return ''.join(out)


SHELL = (
    '<svg class="problems_home_image" viewBox="0 0 32 32" fill="currentColor"'
    ' aria-hidden="true" focusable="false">{body}</svg>'
)

# The mark, however it is currently written, followed by its label. Matches
# the export's <img> and an <svg> from a previous run, so this can be run
# again while the drawings are being worked on.
ITEM = re.compile(
    r'(?:<img[^>]*class="problems_home_image"[^>]*/?>'
    r'|<svg class="problems_home_image".*?</svg>)'
    r'(?P<label><div class="problems_home_label">(?P<name>[^<]+)</div>)',
    re.S,
)


def main() -> int:
    path = ROOT / 'index.html'
    html = path.read_text(encoding='utf-8')
    done: list[str] = []
    missing: list[str] = []

    def swap(m: re.Match) -> str:
        name = m.group('name').strip()
        voxels = MARKS.get(name)
        if not voxels:
            missing.append(name)
            return m.group(0)
        done.append(name)
        return SHELL.format(body=draw(voxels)) + m.group('label')

    html, n = ITEM.subn(swap, html)
    if missing:
        print('no mark drawn for: ' + ', '.join(missing))
        return 1
    if not n:
        print('nothing matched — has the markup changed?')
        return 1

    path.write_text(html, encoding='utf-8')
    print(f'{n} marks inlined')
    for name in done:
        print(f'  {name:16} {len(set(MARKS[name])):2} cubes')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
