#!/usr/bin/env python3
"""
service_icons.py — the marks in the services grid.

    python3 tools/service_icons.py        # write them into index.html

The eight that came with the export were a circle, a plus, a diamond and
so on: primitives that said nothing about the work. They were also
invisible. Each file carried `fill="currentColor"` and was loaded through
an <img>, where the SVG is a document of its own — currentColor resolves
against *its* colour, which is black, against a background that is very
nearly black.

So these are inlined instead, which is what lets them take the page's ink,
dim with their neighbours, and light up under a finger.

They are drawn as one family: a 32-unit square, a single stroke weight, and
a dot motif that picks up the braille figure in the about panel and the
pixel wordmark. Each is a small diagram of the thing rather than a
pictogram of it — a radar rather than a magnifying glass, a device with a
signal leaving it rather than a phone.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DOT = 1.15  # the shared dot, sized once


def dot(x: float, y: float, r: float = DOT) -> str:
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="currentColor" stroke="none"/>'


# Keyed by the label already in the markup, so an icon cannot drift onto
# the wrong service.
ICONS: dict[str, str] = {
    # a frame, a block placed in it, and the grid it was placed on
    'Web design':
        '<rect x="5" y="5" width="22" height="22" rx="2"/>'
        '<rect x="9" y="9" width="8.5" height="8.5" rx="1" fill="currentColor" stroke="none"/>'
        + dot(20.5, 20.5) + dot(24, 20.5) + dot(20.5, 24),

    # angle brackets, opened out from the axis they enclose
    'Development':
        '<path d="M11.5 9.5 5.5 16l6 6.5"/>'
        '<path d="M20.5 9.5 26.5 16l-6 6.5"/>'
        + dot(16, 11) + dot(16, 16) + dot(16, 21),

    # a device, and the signal leaving it
    'Mobile apps':
        '<rect x="5" y="5" width="13" height="22" rx="2.5"/>'
        '<path d="M22 12.5a5 5 0 0 1 0 7"/>'
        '<path d="M25.5 9a9.5 9.5 0 0 1 0 14"/>'
        + dot(11.5, 23),

    # two modules, keyed together
    'Internal tools':
        '<rect x="4" y="7" width="14" height="10.5" rx="1.5"/>'
        '<rect x="14" y="14.5" width="14" height="10.5" rx="1.5"/>'
        + dot(16, 16, 1.4),

    # four readings, and the line they make
    'Analytics':
        '<path d="M7 25v-4M13 25v-8.5M19 25v-13M25 25v-16"/>'
        '<path d="m7 21 6-4.5 6-4.5 6-3" opacity=".5"/>'
        + dot(25, 9, 1.6),

    # a reticle with something found in it, rather than a magnifying glass.
    # The first attempt was a ring, an inner ring and a radial line, which
    # is a speedometer.
    'Search':
        '<circle cx="16" cy="16" r="10"/>'
        '<path d="M16 3.2v3.2M16 25.6v3.2M3.2 16h3.2M25.6 16h3.2"/>'
        + dot(19.4, 12.6, 2.5),

    # two systems, and the part they share
    'Integrations':
        '<circle cx="12" cy="16" r="8"/>'
        '<circle cx="20" cy="16" r="8"/>'
        '<path d="M16 9.07a8 8 0 0 0 0 13.86 8 8 0 0 0 0-13.86z"'
        ' fill="currentColor" stroke="none" opacity=".85"/>',

    # someone answers, and the answer has a pulse
    'Support':
        '<path d="M27 15.4c0 5.2-4.9 9.4-11 9.4-1.2 0-2.4-.2-3.5-.5L6 26.5l1.8-4.6'
        'C6.1 20.2 5 17.9 5 15.4 5 10.2 9.9 6 16 6s11 4.2 11 9.4z"/>'
        '<path d="M10.5 15.6h2.4l1.5-3.4 2.6 6.4 1.5-3h3"/>',
}

SHELL = (
    '<svg class="problems_home_image" viewBox="0 0 32 32" fill="none"'
    ' stroke="currentColor" stroke-width="1.4" stroke-linecap="round"'
    ' stroke-linejoin="round" aria-hidden="true" focusable="false">{body}</svg>'
)

# The mark, however it is currently written, followed by its label. Matches
# both the <img> that was there originally and an <svg> from a previous run,
# so this is re-runnable while the drawings are being worked on.
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
        body = ICONS.get(name)
        if not body:
            missing.append(name)
            return m.group(0)
        done.append(name)
        return SHELL.format(body=body) + m.group('label')

    html, n = ITEM.subn(swap, html)
    if missing:
        print('no icon drawn for: ' + ', '.join(missing))
        return 1
    if not n:
        print('nothing matched — has the markup changed?')
        return 1

    path.write_text(html, encoding='utf-8')
    print(f'{n} marks inlined: ' + ', '.join(done))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
