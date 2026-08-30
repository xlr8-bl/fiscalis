#!/usr/bin/env python3
"""
build_journal.py — turn content/articles/*.md into the journal.

Reads Markdown with a YAML-ish front matter block, writes one HTML page per
article plus an index, and regenerates sitemap.xml and feed.xml so every new
article is discoverable the moment it ships.

    python3 tools/build_journal.py

No dependencies: the Markdown subset here is the one the articles actually
use, and a full parser would be a dependency to install, pin and audit for
no gain.
"""

from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTICLES = ROOT / "content" / "articles"
OUT = ROOT / "journal"
SITE = "https://web3ashley.com"
AUTHOR = "Ashley"
SITE_NAME = "Web3Ashley"


# ---------------------------------------------------------------- front matter
def parse_front_matter(text: str) -> tuple[dict, str]:
    """Split `---` delimited front matter off the top of a document."""
    if not text.startswith("---"):
        raise ValueError("missing front matter")
    end = text.index("\n---", 3)
    raw, body = text[3:end], text[end + 4 :]
    meta: dict = {}
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, _, value = line.partition(":")
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            meta[key.strip()] = [
                v.strip().strip("\"'") for v in inner.split(",") if v.strip()
            ]
        else:
            meta[key.strip()] = value.strip("\"'")
    return meta, body.lstrip("\n")


# ---------------------------------------------------------------- markdown
def inline(text: str) -> str:
    """Inline spans. Escapes first, so article text can contain < and &."""
    text = html.escape(text, quote=False)
    # code before everything else, so its contents are not further transformed
    codes: list[str] = []

    def stash_code(m):
        codes.append(m.group(1))
        return f"\x00CODE{len(codes) - 1}\x00"

    text = re.sub(r"`([^`]+)`", stash_code, text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", text)
    text = text.replace(" -- ", " — ")

    for i, code in enumerate(codes):
        text = text.replace(f"\x00CODE{i}\x00", f"<code>{code}</code>")
    return text


def render_markdown(body: str) -> dict:
    """Split the body into an intro and one entry per `##` heading.

    The article template lays each section out as a row — heading in
    the left column, prose in the right — the way the process section
    on the home page does, so the parser has to hand back the
    sections rather than one stream of HTML.
    """
    intro: list[str] = []
    sections: list[dict] = []
    out = intro                      # blocks land here until the first `##`
    lines = body.split("\n")
    i = 0
    seen_slugs: set[str] = set()

    def slugify(s: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "section"
        slug, n = base, 2
        while slug in seen_slugs:
            slug, n = f"{base}-{n}", n + 1
        seen_slugs.add(slug)
        return slug

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # headings
        m = re.match(r"^(#{2,4})\s+(.*)$", stripped)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            slug = slugify(text)
            if level == 2:
                sections.append({"id": slug, "title": text, "blocks": []})
                out = sections[-1]["blocks"]
            else:
                # h3/h4 stay inside the prose column
                out.append(f'<h{level} id="{slug}">{inline(text)}</h{level}>')
            i += 1
            continue

        # blockquote / pull quote
        if stripped.startswith("> "):
            chunk = []
            while i < len(lines) and lines[i].strip().startswith("> "):
                chunk.append(lines[i].strip()[2:])
                i += 1
            out.append(f"<blockquote><p>{inline(' '.join(chunk))}</p></blockquote>")
            continue

        # lists. A wrapped item continues on the following lines, so those
        # have to be folded into the item — parsing line by line splits an
        # emphasis span across two items and leaves the asterisks visible.
        for marker, tag in ((r"^[-*]\s+", "ul"), (r"^\d+\.\s+", "ol")):
            if not re.match(marker, stripped):
                continue
            items: list[str] = []
            while i < len(lines):
                cur = lines[i].strip()
                if re.match(marker, cur):
                    items.append(re.sub(marker, "", cur))
                    i += 1
                elif cur and items and not re.match(
                    r"^(#{2,4}\s|>\s|[-*]\s|\d+\.\s|---+$)", cur
                ):
                    items[-1] += " " + cur        # continuation of the item above
                    i += 1
                else:
                    break
            out.append(
                f"<{tag}>" + "".join(f"<li>{inline(it)}</li>" for it in items) + f"</{tag}>"
            )
            break
        else:
            # paragraph: consume until a blank line
            chunk = []
            while i < len(lines) and lines[i].strip() and not re.match(
                r"^(#{2,4}\s|>\s|[-*]\s|\d+\.\s|---+$)", lines[i].strip()
            ):
                chunk.append(lines[i].strip())
                i += 1
            out.append(f"<p>{inline(' '.join(chunk))}</p>")
        continue

    return {
        "intro": "\n".join(intro),
        "sections": [
            {"id": sec["id"], "title": sec["title"], "html": "\n".join(sec["blocks"])}
            for sec in sections
        ],
    }


# ---------------------------------------------------------------- helpers
def read_articles() -> list[dict]:
    articles = []
    for path in sorted(ARTICLES.glob("*.md")):
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        missing = [k for k in ("title", "description", "date") if k not in meta]
        if missing:
            raise SystemExit(f"{path.name}: front matter missing {', '.join(missing)}")
        slug = meta.get("slug") or path.stem
        parsed = render_markdown(body)
        all_html = parsed["intro"] + "".join(s["html"] for s in parsed["sections"])
        words = len(re.findall(r"\b[\w'-]+\b", re.sub(r"<[^>]+>", " ", all_html)))
        articles.append(
            {
                **meta,
                "slug": slug,
                "intro": parsed["intro"],
                "sections": parsed["sections"],
                "words": words,
                "minutes": max(1, round(words / 220)),
                "source": path.name,
            }
        )
    articles.sort(key=lambda a: a["date"], reverse=True)
    return articles


def nav_html(active: str = "") -> str:
    """The site navbar, trimmed to links that make sense from a journal page."""
    def link(href, label):
        return (
            f'<li class="navbar_links_li"><a href="{href}" data-link-hover=""'
            f' class="navbar_link w-inline-block"><div class="footer_nav_span'
            f' u-text-style-main">{label}</div></a></li>'
        )

    arrow = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 12 12"'
        ' fill="none" class="g_btn_svg"><path d="M8.90954 9.09046L9 3L2.90954'
        ' 3.09046L2.90213 4.32367L6.86437 4.25391L2.55914 8.55914L3.44086'
        ' 9.44086L7.74609 5.13563L7.68708 9.10862L8.90954 9.09046Z"'
        ' fill="currentColor"></path></svg>'
    )
    arrow_abs = arrow.replace('class="g_btn_svg"', 'class="g_btn_svg is-absolute"')

    return (
        '<header class="navbar_wrap"><div class="navbar_contain u-grid-custom">'
        '<div id="layout-11" class="navbar_left_contain">'
        '<a href="/" aria-label="Return to home" id="layout-12"'
        ' class="navbar_home w-inline-block">'
        '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 609 100"'
        ' fill="none" class="navbar_home_svg"><text x="304.5" y="54"'
        ' text-anchor="middle" dominant-baseline="central" fill="currentColor"'
        ' font-family="PixelDisplay, monospace" font-size="72" textLength="595"'
        ' lengthAdjust="spacingAndGlyphs">WEB3ASHLEY</text></svg></a></div>'
        '<nav id="layout-13" class="navbar_links u-text-style-small u-text-trim-off">'
        '<ul class="navbar_links_ul u-gap-small u-hflex-left-center">'
        + link("/#work", "Work")
        + link("/#services", "Services")
        + link("/#process", "Process")
        + link("/journal/", "Journal")
        + '</ul></nav>'
        '<div id="layout-14" class="navbar_cta_wrap u-text-style-small u-text-trim-off">'
        '<div class="navbar_cta_contain">'
        '<a data-btn-default="" href="/book" class="g_btn_main w-inline-block">'
        '<div class="g_btn_text_contain"><div class="g_btn_text u-text-style-small'
        ' u-text-trim-off">Start a project</div></div>'
        '<div class="g_btn_aside_wrap"><div class="g_btn_aside_bg"></div>'
        + arrow + arrow_abs +
        '</div></a></div></div></div></header>'
    )


HEAD_WIPE = (
    '<script>try{if(sessionStorage.getItem("rt-wipe"))'
    'document.documentElement.classList.add("rt-arriving")}catch(e){}</script>'
)
PANEL = (
    '<div class="rt_wipe" data-route-wipe aria-hidden="true">'
    '<span class="rt_wipe__label" data-route-wipe-label></span></div>'
)
FONT_PRELOADS = "".join(
    f'<link rel="preload" href="/assets/fonts/{f}" as="font" type="font/woff2" crossorigin/>'
    for f in ("bricolage.woff2", "inter-500.woff2", "pixel.woff2")
)
# The scroll-highlight on the standfirst is the one bundle effect these pages
# borrow. GSAP plus two plugins is a fraction of app.js, which would drag in
# Barba and the hero shader for a page that exists to be read.
SCRIPTS = (
    '<script src="/assets/js/gsap.min.js" defer></script>'
    '<script src="/assets/js/ScrollTrigger.min.js" defer></script>'
    '<script src="/assets/js/SplitText.min.js" defer></script>'
    '<script src="/assets/js/journal.js" defer></script>'
    '<script src="/assets/js/site.js" defer></script>'
    '<script src="/assets/js/transition.js" defer></script>'
)


def page_shell(title: str, description: str, canonical: str, body: str,
               ld: str = "", extra_head: str = "") -> str:
    return (
        "<!DOCTYPE html>\n"
        '<html lang="en"><head><meta charset="utf-8"/>'
        f"<title>{html.escape(title)}</title>"
        '<meta content="width=device-width, initial-scale=1" name="viewport"/>'
        f'<meta name="description" content="{html.escape(description, quote=True)}"/>'
        '<meta name="color-scheme" content="dark"/>'
        f'<link rel="canonical" href="{canonical}"/>'
        f"{FONT_PRELOADS}"
        '<link href="/assets/css/site.css" rel="stylesheet" type="text/css"/>'
        '<link href="/assets/css/statement.css" rel="stylesheet" type="text/css"/>'
        '<link href="/assets/css/journal.css" rel="stylesheet" type="text/css"/>'
        '<link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"/>'
        '<link rel="alternate" type="application/rss+xml" title="Web3Ashley journal"'
        ' href="/feed.xml"/>'
        f"{extra_head}{ld}{HEAD_WIPE}</head>"
        f'<body data-theme-section="dark" class="body jr-body">{PANEL}'
        f"{nav_html()}{body}{SCRIPTS}</body></html>"
    )


def fmt_date(iso: str) -> str:
    return datetime.strptime(iso, "%Y-%m-%d").strftime("%d %b %Y").upper()


def rfc822(iso: str) -> str:
    d = datetime.strptime(iso, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return d.strftime("%a, %d %b %Y %H:%M:%S +0000")


# ---------------------------------------------------------------- renderers
ARROW = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 12 12"'
    ' fill="none" class="g_btn_svg{extra}"><path d="M8.90954 9.09046L9 3L2.90954'
    ' 3.09046L2.90213 4.32367L6.86437 4.25391L2.55914 8.55914L3.44086 9.44086L7.74609'
    ' 5.13563L7.68708 9.10862L8.90954 9.09046Z" fill="currentColor"></path></svg>'
)


def button(href: str, label: str) -> str:
    """The site's one button component, unchanged."""
    return (
        f'<a data-btn-default="" href="{href}" class="g_btn_main w-inline-block">'
        '<div class="g_btn_text_contain"><div class="g_btn_text u-text-style-small'
        f' u-text-trim-off">{html.escape(label)}</div></div>'
        '<div class="g_btn_aside_wrap"><div class="g_btn_aside_bg"></div>'
        + ARROW.format(extra="") + ARROW.format(extra=" is-absolute") +
        '</div></a>'
    )


def render_article(a: dict, articles: list[dict]) -> str:
    url = f"{SITE}/journal/{a['slug']}"
    ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": a["title"],
            "description": a["description"],
            "datePublished": a["date"],
            "dateModified": a.get("updated", a["date"]),
            "author": {"@type": "Person", "name": AUTHOR, "url": SITE},
            "publisher": {"@type": "Organization", "name": SITE_NAME, "url": SITE},
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "wordCount": a["words"],
            "inLanguage": "en",
        },
        separators=(",", ":"),
    )
    breadcrumb = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE},
                {"@type": "ListItem", "position": 2, "name": "Journal",
                 "item": f"{SITE}/journal/"},
                {"@type": "ListItem", "position": 3, "name": a["title"], "item": url},
            ],
        },
        separators=(",", ":"),
    )
    ld_tag = (
        f'<script type="application/ld+json">{ld}</script>'
        f'<script type="application/ld+json">{breadcrumb}</script>'
    )

    # The intro sits in the prose column of its own headless row, so the
    # measure never changes between the opening and the first section.
    intro_row = ""
    if a["intro"]:
        intro_row = (
            '<div class="jr_content-item">'
            '<div class="jr_content-left"></div>'
            f'<div class="jr_prose">{a["intro"]}</div>'
            "</div>"
        )

    rows = "".join(
        '<section class="jr_content-item">'
        '<div class="jr_content-left">'
        f'<h2 id="{sec["id"]}" class="jr_content_heading u-text-style-h5">'
        f'{html.escape(sec["title"])}</h2></div>'
        f'<div class="jr_prose">{sec["html"]}</div>'
        "</section>"
        for sec in a["sections"]
    )

    # related: shared tags first, then most recent
    tags = set(a.get("tags", []) or [])
    # newest first, then stable-sort so shared tags win — a tuple key cannot
    # express "descending date" alongside "descending overlap" on a string
    others = sorted((o for o in articles if o["slug"] != a["slug"]),
                    key=lambda o: o["date"], reverse=True)
    others.sort(key=lambda o: len(tags & set(o.get("tags", []) or [])), reverse=True)
    related = others[:3]
    next_block = ""
    if related:
        items = "".join(
            f'<li><a href="/journal/{r["slug"]}">'
            f'<span class="jr_next_date u-text-style-main">{fmt_date(r["date"])}</span>'
            f'<span class="u-text-style-h6">{html.escape(r["title"])}</span>'
            "</a></li>"
            for r in related
        )
        next_block = (
            '<div class="jr_next">'
            '<h2 class="jr_next_heading u-text-style-h5">Read next</h2>'
            f'<ul class="jr_next_list">{items}</ul></div>'
        )

    body = f"""<main class="jr_wrap">
<article>
  <header class="jr_header">
    <p class="jr_kicker u-text-style-main">{fmt_date(a['date'])} &nbsp;·&nbsp; {a['minutes']} min read</p>
    <h1 class="jr_title u-text-style-h2">{html.escape(a['title'])}</h1>
    <p class="jr_lede u-text-style-h4" data-highlight-text>{html.escape(a['description'])}</p>
  </header>
  <div class="jr_content-list">{intro_row}{rows}</div>
  <div class="jr_end">
    <h2 class="u-text-style-h5 jr_end_text">Think this is happening on your site?</h2>
    <div class="jr_end_aside">
      <p class="u-text-style-main">One hour on your business and your customers. No pitch.
        We work out where the business is losing customers online, and whether I am
        the right person to fix it.</p>
      {button('/book', 'Book an intro call')}
    </div>
  </div>
  {next_block}
</article>
</main>"""
    return page_shell(
        f"{a['title']} — {SITE_NAME}", a["description"], url, body, ld_tag
    )


def render_index(articles: list[dict]) -> str:
    rows = "".join(
        f'<li><a href="/journal/{a["slug"]}" class="jr_item_link">'
        '<div class="jr_item_text">'
        f'<h2 class="u-text-style-h5">{html.escape(a["title"])}</h2>'
        f'<p class="u-text-style-main">{html.escape(a["description"])}</p>'
        "</div>"
        '<div class="jr_item_meta">'
        f'<span class="u-text-style-main">{fmt_date(a["date"])}</span>'
        f'<span class="u-text-style-main">{a["minutes"]} min</span>'
        "</div></a></li>"
        for a in articles
    )

    ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "Blog",
            "name": f"{SITE_NAME} journal",
            "url": f"{SITE}/journal/",
            "description": "Notes on what actually loses businesses customers online.",
            "blogPost": [
                {
                    "@type": "BlogPosting",
                    "headline": a["title"],
                    "url": f"{SITE}/journal/{a['slug']}",
                    "datePublished": a["date"],
                }
                for a in articles
            ],
        },
        separators=(",", ":"),
    )

    body = f"""<main class="jr_wrap">
  <h1 class="jr_display">Notes</h1>
  <p class="jr_index_lede u-text-style-h4" data-highlight-text>What actually loses
    businesses customers online, and what each leak costs.</p>
  <ul class="jr_list">{rows}</ul>
</main>"""
    return page_shell(
        f"Journal — {SITE_NAME}",
        "Notes on what actually loses businesses customers online: slow pages, "
        "broken enquiry forms, menus saved as images, and what each one costs.",
        f"{SITE}/journal/",
        body,
        f'<script type="application/ld+json">{ld}</script>',
    )


def write_sitemap(articles: list[dict]) -> None:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = [
        f"  <url><loc>{SITE}/</loc><priority>1.0</priority><lastmod>{today}</lastmod></url>",
        f"  <url><loc>{SITE}/book</loc><priority>0.8</priority></url>",
        f"  <url><loc>{SITE}/journal/</loc><priority>0.9</priority><lastmod>{today}</lastmod></url>",
    ]
    for a in articles:
        urls.append(
            f"  <url><loc>{SITE}/journal/{a['slug']}</loc>"
            f"<lastmod>{a.get('updated', a['date'])}</lastmod>"
            f"<priority>0.7</priority></url>"
        )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n",
        encoding="utf-8",
    )


def write_feed(articles: list[dict]) -> None:
    items = "".join(
        f"<item><title>{html.escape(a['title'])}</title>"
        f"<link>{SITE}/journal/{a['slug']}</link>"
        f"<guid isPermaLink=\"true\">{SITE}/journal/{a['slug']}</guid>"
        f"<pubDate>{rfc822(a['date'])}</pubDate>"
        f"<description>{html.escape(a['description'])}</description></item>"
        for a in articles[:20]
    )
    (ROOT / "feed.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0"><channel>'
        f"<title>{SITE_NAME} journal</title>"
        f"<link>{SITE}/journal/</link>"
        "<description>Notes on what actually loses businesses customers online.</description>"
        "<language>en</language>"
        f"{items}</channel></rss>\n",
        encoding="utf-8",
    )


def main() -> int:
    if not ARTICLES.exists():
        print("no content/articles directory", file=sys.stderr)
        return 1
    articles = read_articles()
    if not articles:
        print("no articles found", file=sys.stderr)
        return 1

    OUT.mkdir(exist_ok=True)
    # clear pages whose source is gone, so a deleted article stops being served
    keep = {f"{a['slug']}.html" for a in articles} | {"index.html"}
    for stale in OUT.glob("*.html"):
        if stale.name not in keep:
            stale.unlink()
            print(f"  removed {stale.name}")

    for a in articles:
        (OUT / f"{a['slug']}.html").write_text(render_article(a, articles), encoding="utf-8")
    (OUT / "index.html").write_text(render_index(articles), encoding="utf-8")
    write_sitemap(articles)
    write_feed(articles)

    total = sum(a["words"] for a in articles)
    print(f"built {len(articles)} articles, {total:,} words")
    for a in articles:
        print(f"  {a['date']}  {a['words']:>5}w  /journal/{a['slug']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
