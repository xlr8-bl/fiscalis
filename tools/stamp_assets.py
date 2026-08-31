#!/usr/bin/env python3
"""
stamp_assets.py — put each stylesheet and script's content hash in its URL.

    python3 tools/stamp_assets.py          # rewrite
    python3 tools/stamp_assets.py --check   # fail if any stamp is out of date

A browser caches by URL. When the URL never changes, a cached copy and a
changed file cannot both be true, and the browser believes the cache —
`Cache-Control: immutable` goes further and tells it not even to ask on a
reload, which is how a phone ends up holding a stylesheet from a month ago
against markup from a minute ago, with no way for the reader to break out
of it.

Adding the hash makes the URL change whenever the bytes do, so a new
version is simply a different file to fetch and an old cache entry is
never consulted again. It is also what makes a long cache lifetime safe,
should we want one back.

Run it after changing anything under assets/css or assets/js. The nav
check calls --check, so a forgotten run fails there rather than in
someone's browser.
"""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Where asset URLs are written. The journal's pages are generated, so its
# template counts as a source too.
#
# studio.js comes first because it imports three modules by URL, and
# stamping those changes its own bytes — so its hash has to be taken after
# that, not before.
SOURCES = [
    'assets/js/studio.js',
    'index.html',
    'book.html',
    'studio.html',
    'lib/templates.js',
]

# `href="assets/css/site.css"`, `src="/assets/js/app.js"`, stamped or not.
REF = re.compile(
    r'(?P<q>["\'])(?P<path>/?assets/(?:css|js)/[A-Za-z0-9._-]+\.(?:css|js))'
    r'(?:\?v=[0-9a-f]+)?(?P=q)'
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def rewrite(text: str, missing: list[str]) -> tuple[str, int]:
    stamped = 0

    def one(m: re.Match) -> str:
        nonlocal stamped
        path = m.group('path')
        target = ROOT / path.lstrip('/')
        if not target.is_file():
            missing.append(path)
            return m.group(0)
        stamped += 1
        return f'{m.group("q")}{path}?v={digest(target)}{m.group("q")}'

    return REF.sub(one, text), stamped


def main(argv: list[str]) -> int:
    check = '--check' in argv
    missing: list[str] = []
    stale: list[str] = []
    total = 0

    for name in SOURCES:
        path = ROOT / name
        if not path.is_file():
            continue
        before = path.read_text(encoding='utf-8')
        after, n = rewrite(before, missing)
        total += n
        if before != after:
            if check:
                stale.append(name)
            else:
                path.write_text(after, encoding='utf-8')
                print(f'{name}: {n} references stamped')
        elif not check:
            print(f'{name}: {n} references already current')

    if missing:
        print('referenced but not on disk: ' + ', '.join(sorted(set(missing))), file=sys.stderr)
        return 1
    if stale:
        print('out of date, run tools/stamp_assets.py: ' + ', '.join(stale), file=sys.stderr)
        return 1
    if check:
        print(f'all {total} asset references carry the current hash')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
