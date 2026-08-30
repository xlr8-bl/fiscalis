#!/usr/bin/env python3
"""
draft_article.py — draft the next journal article with the Gemini API.

    export GEMINI_API_KEY=...
    python3 tools/draft_article.py            # draft the next queued topic
    python3 tools/draft_article.py "topic"    # draft a specific topic

Drafts are POSTed to the studio API, where they land with status `review` —
visible in /studio, not on the site. Nothing reaches a reader until a person
opens it and presses Publish. That gate is deliberate.

Set STUDIO_URL and AGENT_TOKEN to post; without them the draft is written to
content/drafts/ instead, so the script still works with no deployment.

Google's spam policy on "scaled content abuse" (March 2024) targets exactly the
pattern of publishing generated pages at volume without human oversight, and
enforcement is site-wide rather than per-page — one automated run can take down
the rankings of the pages you wrote yourself. The review step is what keeps this
a writing tool instead of that.

The agent token cannot publish, delete, or edit anything already live — the
API refuses, so this is enforced on the server rather than by this script.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOPICS = ROOT / "content" / "topics.md"
DRAFTS = ROOT / "content" / "drafts"
ARTICLES = ROOT / "content" / "articles"

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{MODEL}:generateContent"
)

# The house style, stated as constraints rather than adjectives. Vague style
# notes ("be engaging") produce exactly the filler this is meant to avoid.
SYSTEM = """You write for web3ashley, a one-person web design and development
studio. The audience is a small business owner — a restaurant, a trade, a
clinic, a shop. They are not technical and they are not stupid. They are busy.

Voice, non-negotiable:
- Short declarative sentences. Plain words. No marketing register.
- Second person. Address the reader as "you"; refer to the studio as "I".
- Concrete over abstract. Name the actual failure, the actual number, the
  actual tool. "Eleven seconds on a phone" not "suboptimal performance".
- Never open with "In today's digital landscape" or any variant. Open with the
  reader's situation, in one specific sentence.
- No hype, no exclamation marks, no rhetorical questions as headings.
- Say when the answer is "you don't need this". Genuine advice against your own
  interest is the whole reason anyone trusts the article.
- British spelling.

Structure:
- 700-1000 words.
- 4 to 6 `##` headings. Sentence case. Each heading is a real section, not a
  keyword.
- Bulleted or numbered lists where the content is genuinely a list.
- Exactly one `>` blockquote: the single sentence a reader would repeat to
  somebody else. Not a summary — the sharpest line in the piece.
- End with something the reader can do, or an honest statement of when not to
  bother.

Hard rules:
- Do not invent statistics, prices, or study results. If you reference a number
  it must be one that is widely published and stable. When in doubt, describe
  the effect without a figure.
- Do not claim specific client work, case studies, or results.
- No FAQ section. No "conclusion" heading. No em-dash-heavy prose.
- Do not mention AI, or that this was generated.

Output format — return ONLY this, no code fences, no preamble:

---
title: <specific, under 70 characters, not a keyword phrase>
description: <one sentence, under 160 characters, states the actual payoff>
date: <YYYY-MM-DD, supplied below>
tags: [<two or three lowercase tags>]
---

<the article body in Markdown, starting with a paragraph, not a heading>
"""


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:70]


def next_topic() -> tuple[str, int] | tuple[None, None]:
    """First queue line not already marked. Returns (topic, line_index)."""
    if not TOPICS.exists():
        return None, None
    lines = TOPICS.read_text(encoding="utf-8").splitlines()
    for i, line in enumerate(lines):
        s = line.strip()
        if not s.startswith("- "):
            continue
        if "[done]" in s or "[drafting]" in s:
            continue
        return s[2:].strip(), i
    return None, None


def mark_topic(index: int, marker: str) -> None:
    lines = TOPICS.read_text(encoding="utf-8").splitlines()
    lines[index] = lines[index].rstrip() + f"  {marker}"
    TOPICS.write_text("\n".join(lines) + "\n", encoding="utf-8")


def existing_titles() -> list[str]:
    """So the model can be told what already exists and avoid repeating it."""
    out = []
    for d in (ARTICLES, DRAFTS):
        for p in sorted(d.glob("*.md")) if d.exists() else []:
            m = re.search(r"^title:\s*(.+)$", p.read_text(encoding="utf-8"), re.M)
            if m:
                out.append(m.group(1).strip())
    return out


def call_gemini(topic: str, api_key: str) -> str:
    covered = existing_titles()
    covered_note = ""
    if covered:
        covered_note = (
            "\n\nThese articles already exist. Do not repeat their ground; if the "
            "topic overlaps, take a genuinely different angle:\n- "
            + "\n- ".join(covered)
        )

    prompt = (
        f"{SYSTEM}\n\nToday's date is {date.today().isoformat()}; use it as the "
        f"date field.{covered_note}\n\nWrite the article on this topic:\n\n{topic}"
    )

    body = json.dumps(
        {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.85,
                "topP": 0.95,
                "maxOutputTokens": 4096,
            },
        }
    ).encode()

    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:600]
        raise SystemExit(f"Gemini API returned {e.code}:\n{detail}")
    except urllib.error.URLError as e:
        raise SystemExit(f"Could not reach the Gemini API: {e.reason}")

    candidates = payload.get("candidates") or []
    if not candidates:
        raise SystemExit(
            "Gemini returned no candidates — usually a safety block.\n"
            + json.dumps(payload)[:600]
        )
    parts = candidates[0].get("content", {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        finish = candidates[0].get("finishReason", "unknown")
        raise SystemExit(f"Gemini returned empty text (finishReason: {finish})")
    return text


def clean(text: str) -> str:
    """Strip code fences the model sometimes wraps the whole document in."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n", "", text)
        text = re.sub(r"\n```$", "", text)
    return text.strip()


def validate(text: str) -> list[str]:
    """Cheap structural checks. Not a substitute for reading it."""
    problems = []
    if not text.startswith("---"):
        problems.append("no front matter block")
        return problems
    try:
        end = text.index("\n---", 3)
    except ValueError:
        problems.append("front matter is not closed")
        return problems

    head, body = text[3:end], text[end + 4 :]
    for field in ("title", "description", "date"):
        if not re.search(rf"^{field}:", head, re.M):
            problems.append(f"front matter missing {field}")

    m = re.search(r"^description:\s*(.+)$", head, re.M)
    if m and len(m.group(1).strip().strip("\"'")) > 165:
        problems.append("description over 165 characters")

    words = len(re.findall(r"\b[\w'-]+\b", body))
    if words < 550:
        problems.append(f"body is short ({words} words)")
    if words > 1400:
        problems.append(f"body is long ({words} words)")

    headings = re.findall(r"^##\s+(.+)$", body, re.M)
    if len(headings) < 3:
        problems.append(f"only {len(headings)} section headings")

    if body.count("\n> ") == 0:
        problems.append("no pull quote")

    for banned in ("In today's", "in today's digital", "As an AI", "delve into",
                   "In conclusion", "Frequently Asked"):
        if banned.lower() in body.lower():
            problems.append(f"contains banned phrase: {banned!r}")
    return problems


def parse_generated(text: str) -> tuple[dict, str]:
    """Split the front matter the model was asked to emit from the body."""
    if not text.startswith("---"):
        return {}, text
    try:
        end = text.index("\n---", 3)
    except ValueError:
        return {}, text
    meta = {}
    for line in text[3:end].strip().splitlines():
        key, _, value = line.partition(":")
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            value = ", ".join(v.strip().strip("\"'") for v in value[1:-1].split(",") if v.strip())
        meta[key.strip()] = value.strip("\"'")
    return meta, text[end + 4:].lstrip("\n")


def main(argv: list[str]) -> int:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(
            "GEMINI_API_KEY is not set.\n\n"
            "  Get a key at https://aistudio.google.com/apikey\n"
            "  Locally:  export GEMINI_API_KEY=...\n"
            "  In CI:    add it as the repository secret GEMINI_API_KEY\n",
            file=sys.stderr,
        )
        return 1

    topic_index = None
    if len(argv) > 1:
        topic = " ".join(argv[1:])
    else:
        topic, topic_index = next_topic()
        if not topic:
            print("Topic queue is empty — add lines to content/topics.md")
            return 0

    print(f"Topic: {topic}")
    print(f"Model: {MODEL}")

    text = clean(call_gemini(topic, api_key))
    problems = validate(text)

    m = re.search(r"^title:\s*(.+)$", text, re.M)
    title = m.group(1).strip().strip("\"'") if m else topic
    slug = slugify(title)

    meta, body = parse_generated(text)
    studio = os.environ.get("STUDIO_URL", "").rstrip("/")
    agent_token = os.environ.get("AGENT_TOKEN")

    if studio and agent_token:
        payload = json.dumps({
            "title": meta.get("title", topic),
            "description": meta.get("description", ""),
            "tags": meta.get("tags", ""),
            "body": body,
            "slug": slug,
        }).encode()
        req = urllib.request.Request(
            f"{studio}/api/studio/articles",
            data=payload,
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {agent_token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                created = json.load(resp)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"Studio API returned {e.code}: {e.read().decode(errors='replace')[:400]}")
        except urllib.error.URLError as e:
            raise SystemExit(f"Could not reach {studio}: {e.reason}")

        where = f"{studio}/studio.html"
        print(f"\nPosted as \"{created['slug']}\" with status {created['status']}.")
        print(f"Review and publish it at {where}")
    else:
        DRAFTS.mkdir(parents=True, exist_ok=True)
        dest = DRAFTS / f"{slug}.md"
        dest.write_text(text + "\n", encoding="utf-8")
        print(f"\nWrote {dest.relative_to(ROOT)}")
        print("Set STUDIO_URL and AGENT_TOKEN to post straight into the studio instead.")

    if topic_index is not None:
        mark_topic(topic_index, "[drafting]")

    if problems:
        print("\nNeeds attention before publishing:")
        for p in problems:
            print(f"  - {p}")
    else:
        print("Structural checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
