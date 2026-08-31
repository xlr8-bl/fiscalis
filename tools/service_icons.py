#!/usr/bin/env python3
"""
service_icons.py — the marks in the services grid.

    python3 tools/service_icons.py        # write them into index.html

Drawn on a 16-cell grid, one filled square at a time, because the wordmark
is a pixel face and that is the one thing on this site nobody else has.
The first attempt at replacing the export's primitives was a set of thin
rounded outline strokes, which is the house style of every free icon set
there is — correct, legible, and belonging to no one.

Bitmap marks belong here. They rhyme with WEB3ASHLEY across the top of
the page, they hold up at the size they are actually shown, and they are
built from the same square the braille figure in the about panel is.

Each is written as sixteen rows of sixteen characters. `#` is a filled
cell. That is the whole format: to change a mark, redraw it here and run
this. Runs of filled cells on a row are merged into one <rect>, so a mark
costs a handful of elements rather than 256.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

BITMAPS: dict[str, str] = {
    # a page with its blocks placed on it
    'Web design': """
................
.##############.
.#............#.
.#.####.####..#.
.#.####.####..#.
.#.####.####..#.
.#............#.
.#.##########.#.
.#............#.
.#.#######....#.
.#............#.
.##############.
................
................
................
................
""",

    # angle brackets, opened out around what they hold
    'Development': """
................
................
.....##...##....
....##.....##...
...##.......##..
..##.........##.
.##....##.....##
.##....##.....##
..##.........##.
...##.......##..
....##.....##...
.....##...##....
................
................
................
................
""",

    # a device, and the signal leaving it
    'Mobile apps': """
................
................
..#######.......
..#.....#.......
..#.....#...#...
..#.....#.#..#..
..#.....#..#..#.
..#.....#..#..#.
..#.....#..#..#.
..#.....#.#..#..
..#.....#...#...
..#.....#.......
..#.###.#.......
..#######.......
................
................
""",

    # a panel of controls, each set somewhere different. Two offset blocks
    # read as confident and meant nothing in particular.
    'Internal tools': """
................
................
....###.........
..############..
....###.........
................
........###.....
..############..
........###.....
................
.....###........
..############..
.....###........
................
................
................
""",

    # four readings, ascending
    'Analytics': """
................
................
................
............##..
............##..
.........##.##..
.........##.##..
......##.##.##..
......##.##.##..
..##..##.##.##..
..##..##.##.##..
..##..##.##.##..
..##..##.##.##..
................
................
................
""",

    # a reticle, with something in the middle of it
    'Search': """
................
................
..####....####..
..#..........#..
..#..........#..
..#..........#..
.......##.......
.......##.......
..#..........#..
..#..........#..
..#..........#..
..####....####..
................
................
................
................
""",

    # two systems, and the part they share. Squares of the same height read
    # as one box divided in three, so the second is dropped down the grid —
    # the overlap only shows when the outlines break.
    'Integrations': """
................
................
.#########......
.#.......#......
.#.......#......
.#.......#......
.#....#########.
.#....####....#.
.#....####....#.
.#########....#.
......#.......#.
......#.......#.
......#.......#.
......#########.
................
................
""",

    # someone is on the other end of it
    'Support': """
................
................
..############..
..#..........#..
..#.##.##.##.#..
..#.##.##.##.#..
..#..........#..
..############..
....###.........
....##..........
....#...........
................
................
................
................
................
""",
}


def rects(bitmap: str) -> str:
    """Merge each row's runs of filled cells into one <rect>."""
    rows = [r for r in bitmap.strip('\n').split('\n')]
    if len(rows) != 16 or any(len(r) != 16 for r in rows):
        raise ValueError(f'a mark is not 16x16: {len(rows)} rows, '
                         f'widths {sorted({len(r) for r in rows})}')
    out = []
    for y, row in enumerate(rows):
        x = 0
        while x < 16:
            if row[x] == '#':
                run = x
                while run < 16 and row[run] == '#':
                    run += 1
                out.append(f'<rect x="{x}" y="{y}" width="{run - x}" height="1"/>')
                x = run
            else:
                x += 1
    return ''.join(out)


SHELL = (
    '<svg class="problems_home_image" viewBox="0 0 16 16" fill="currentColor"'
    ' shape-rendering="crispEdges" aria-hidden="true" focusable="false">{body}</svg>'
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
        bitmap = BITMAPS.get(name)
        if not bitmap:
            missing.append(name)
            return m.group(0)
        done.append(name)
        return SHELL.format(body=rects(bitmap)) + m.group('label')

    html, n = ITEM.subn(swap, html)
    if missing:
        print('no mark drawn for: ' + ', '.join(missing))
        return 1
    if not n:
        print('nothing matched — has the markup changed?')
        return 1

    path.write_text(html, encoding='utf-8')
    cells = {k: sum(r.count('#') for r in v.split('\n')) for k, v in BITMAPS.items()}
    print(f'{n} marks inlined')
    for name in done:
        print(f'  {name:16} {cells[name]:3} cells')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
