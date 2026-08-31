#!/usr/bin/env python3
"""
service_icons.py — the marks in the services grid.

    python3 tools/service_icons.py        # write them into index.html

Abstract geometric marks in the Italian modernist line — Olivetti, Munari,
the Milanese studios, with the Memphis habit of putting a form somewhere it
does not belong. Solid shapes, not outlines. Circles, bars, wedges and
arcs, and the negative space between them doing as much work as the ink.

The rules that hold the set together:

  Solid.       Filled forms at one heavy weight, to sit with a display
               face set at 800. Thin strokes read as an icon library.
  Two or three parts. Never more. A mark that needs four is a diagram.
  Off-balance. Something is always offset, bitten into, or interrupted.
               Symmetry is what makes a geometric mark look corporate.
  Optical.     Overlaps knock out rather than stack, so the eye reads a
               shape that is not drawn.

Not pictograms. A mark here is an association, not a picture of the thing
— which is why they can be this reduced and still not collide with each
other.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

MARKS: dict[str, str] = {
    # a field with a half-disc taken out of its edge, and a disc sitting in
    # the hole, too high
    'Web design':
        '<path fill-rule="evenodd" d="M3 3h26v26H3z m26 0a13 13 0 0 0 0 26z"/>'
        '<circle cx="24" cy="12" r="4.5"/>',

    # two slabs leaning, at different heights — the tension is the point
    'Development':
        '<path d="M11 3h8l-5 26h-8z"/>'
        '<path d="M22 11h6.5l-3.6 18h-6.5z"/>',

    # a standing form, and a corner of something else that got away
    'Mobile apps':
        '<rect x="4" y="3" width="12" height="26" rx="6"/>'
        '<path d="M18 29a11 11 0 0 1 11-11v11z"/>',

    # two slabs crossing off-centre, and the crossing knocked out
    'Internal tools':
        '<path fill-rule="evenodd" d="M3 14h26v7H3z m6-11h7v26H9z"/>',

    # a climb, and then the one that is not a bar
    'Analytics':
        '<rect x="3" y="20" width="6" height="9"/>'
        '<rect x="11" y="15" width="6" height="14"/>'
        '<path d="M19 29V16a5 5 0 0 1 10 0v13z"/>',

    # a disc with a wedge taken out of it, and the wedge nowhere near
    'Search':
        '<path d="M14 17V6a11 11 0 1 0 7.78 3.22z"/>'
        '<circle cx="26" cy="6.5" r="3.5"/>',

    # two of them, and the part they share knocked out
    'Integrations':
        '<path fill-rule="evenodd" d="M12 6a10 10 0 1 0 0 20 10 10 0 1 0 0-20z'
        'm8 0a10 10 0 1 0 0 20 10 10 0 1 0 0-20z"/>',

    # one disc, cut in half, and the halves refusing to line up
    'Support':
        '<path d="M15 4a12 12 0 0 0 0 24z"/>'
        '<path d="M20 10a9 9 0 0 1 0 18z"/>',
}

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
        body = MARKS.get(name)
        if not body:
            missing.append(name)
            return m.group(0)
        done.append(name)
        return SHELL.format(body=body) + m.group('label')

    html, n = ITEM.subn(swap, html)
    if missing:
        print('no mark drawn for: ' + ', '.join(missing))
        return 1
    if not n:
        print('nothing matched — has the markup changed?')
        return 1

    path.write_text(html, encoding='utf-8')
    print(f'{n} marks inlined: ' + ', '.join(done))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
