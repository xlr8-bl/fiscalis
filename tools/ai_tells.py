#!/usr/bin/env python3
"""
ai_tells.py — find the AI writing patterns in the site's own words.

The patterns and the words to watch come from the humanizer skill in
.claude/skills/humanizer, which is itself built from Wikipedia's "Signs
of AI writing" (WikiProject AI Cleanup).

This only finds candidates. It cannot tell a real tell from a false
positive — the skill's own list of what not to flag is half its length,
and a word is only evidence when it sits with others. So the output is a
reading list, not a verdict.

    python3 tools/ai_tells.py                 the articles
    python3 tools/ai_tells.py --all           the site copy too
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# §1 inflated importance, §3 shallow -ing analysis, §4 sales language,
# §5 vague sources, §7 stock words, §8 avoiding is/are, §27 deeper truth,
# §28 announcing, §32 formulaic sayings, §33 fake candour
PATTERNS = [
    ("inflated importance", r"\b(stands as|serves as|is a testament|a vital|crucial|pivotal|underscor\w+|highlight(?:s|ing) (?:its|the) (?:importance|significance)|evolving landscape|indelible mark|deeply rooted|marking a|represents a shift|key turning point)\b"),
    ("shallow -ing analysis", r",\s+(highlighting|underscoring|emphasi[sz]ing|ensuring|reflecting|symboli[sz]ing|contributing to|fostering|showcasing|encompassing)\b"),
    ("sales language", r"\b(boasts a|vibrant|profound|nestled|in the heart of|groundbreaking|renowned|breathtaking|must-visit|stunning|commitment to|exemplifies)\b"),
    ("vague source", r"\b(industry reports|observers have|experts (?:argue|believe|say)|some critics|several sources|studies show)\b"),
    ("stock AI word", r"\b(delve|intricate|intricacies|interplay|tapestry|testament|leverage|robust|seamless|holistic|myriad|plethora|garner|utilize|facilitate|paradigm|synerg\w+)\b"),
    ("avoiding is/are", r"\b(serves as a|stands as a|boasts|features a|offers a range)\b"),
    ("not X but Y", r"\b(not (?:just|only|merely) [^.,;]{2,40}(?:,|;| but)\s*(?:it|they|this)?'?s?\s*(?:also )?)\b"),
    ("deeper truth", r"\b(the real question is|at its core|in reality|what really matters|fundamentally,|the deeper issue|the heart of the matter)\b"),
    ("announcing the point", r"\b(let'?s (?:dive|explore|break this down|look at)|here'?s what you need to know|without further ado|quick note)\b"),
    ("formulaic saying", r"\b(is the (?:language|currency|architecture) of|becomes a trap)\b"),
    ("fake candour", r"(^|[.!?]\s+)(Honestly[?,]|Look,|Here'?s the thing|The thing is,|Let'?s be honest|Real talk)"),
    ("chatbot artifact", r"\b(I hope this helps|Of course!|Certainly!|You'?re absolutely right|let me know if|Would you like me to)\b"),
    ("knowledge-limit hedge", r"\b(as of my|up to my last|while specific details|based on available information|it is believed that|likely (?:grew up|studied|began))\b"),
    ("too many qualifiers", r"\b(could potentially|might arguably|it'?s also possible that|in some cases it may)\b"),
    ("generic positive ending", r"\b(the future looks bright|exciting times|a step in the right direction|journey toward)\b"),
    ("answering nobody", r"\b(don'?t get me wrong|to be clear,|this is not to say|I'?m not (?:saying|arguing)|some might say)\b"),
    ("fake alternative", r"\b(a tempting (?:option|approach)|one might be tempted|an obvious approach would be|it would be easy to just)\b"),
    ("em or en dash", r"[—–]"),
    ("curly quote", r"[“”‘’]"),
    ("emoji heading", r"^#{1,6}\s*[\U0001F300-\U0001FAFF]"),
    # §17: every main word capitalised. Written as "three or more
    # capitalised words in a row", which is what title case looks like and
    # what an ordinary sentence-case heading never does. The first attempt
    # at this had no word boundaries and matched every heading in the
    # journal, which is the reverse of useful.
    ("title case heading", r"^#{2,6}\s+\b[A-Z][a-z]+\b(?:\s+\b[A-Z][a-z]+\b){2,}\s*$"),
    ("bold mini-heading list", r"^\s*[-*]\s+\*\*[^*]+:\*\*"),
]

# Case matters for exactly two of these, and they are the two about
# capitalisation. Compiling the whole list with re.I made [A-Z] match
# lowercase, so the title-case rule matched every sentence-case heading
# in the journal — 40 of the 47 "candidates" in its first run.
CASE_SENSITIVE = {"title case heading", "fake candour"}

COMPILED = [
    (name, re.compile(rx, re.M if name in CASE_SENSITIVE else re.I | re.M))
    for name, rx in PATTERNS
]


def scan(path: Path) -> list[tuple[str, int, str]]:
    text = path.read_text(encoding="utf-8")
    # front matter is metadata, not prose
    text = re.sub(r"^---\n.*?\n---\n", "", text, flags=re.S)
    hits = []
    for name, rx in COMPILED:
        for m in rx.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            start = max(0, m.start() - 50)
            before = " ".join(text[start:m.start()].split())
            after = " ".join(text[m.end():m.end() + 50].split())
            got = " ".join(m.group(0).split())
            hits.append((name, line, f"…{before} «{got}» {after}…"))
    return sorted(hits, key=lambda h: h[1])


def site_copy() -> str:
    """Every string the site puts in front of a reader, out of the seed.

    The articles are files; the rest of the site's words are rows in D1,
    baked into lib/seed.js as INSERTs. Scanning the .js as text would
    flag the code around them, so the values are pulled out first.
    """
    src = (ROOT / "lib" / "seed.js").read_text(encoding="utf-8")
    # the seeds carry their strings as SQL literals inside JS strings
    parts = re.findall(r"'((?:[^'\\]|\\.|'')+)'", src)
    words = [p.replace("''", "'").replace("\\n", "\n") for p in parts]
    # anything with a space and a letter is prose; the rest is slugs,
    # column names and enum values
    return "\n\n".join(w for w in words if " " in w and re.search(r"[a-z]{4}", w))


def main() -> int:
    files = sorted((ROOT / "content" / "articles").glob("*.md"))
    extra: list[tuple[str, str]] = []
    if "--all" in sys.argv:
        files += [ROOT / "lib" / "legal.js", ROOT / "index.html", ROOT / "book.html"]
        extra.append(("lib/seed.js (the site's own copy)", site_copy()))

    total = 0
    for f in files:
        if not f.exists():
            continue
        hits = scan(f)
        if not hits:
            continue
        total += len(hits)
        print(f"\n{f.relative_to(ROOT)}  ({len(hits)})")
        for name, line, snippet in hits:
            print(f"  {line:>4}  {name:<24} {snippet}")

    for label, text in extra:
        hits = []
        for name, rx in COMPILED:
            for m in rx.finditer(text):
                got = " ".join(m.group(0).split())
                start = max(0, m.start() - 60)
                ctx = " ".join(text[start:m.end() + 60].split())
                hits.append((name, 0, f"«{got}» in …{ctx}…"))
        if not hits:
            continue
        total += len(hits)
        print(f"\n{label}  ({len(hits)})")
        for name, _, snippet in hits:
            print(f"        {name:<24} {snippet}")

    print(f"\n{total} candidates. Read each one; most words on these lists are")
    print("ordinary English, and the skill's own advice is that a single hit")
    print("proves nothing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
