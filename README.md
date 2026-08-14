# WEB3ASHLEY — portable static site

A self-contained static site. No build step, no package manager, no server-side
anything. Drop the folder into any project and it runs.

## Use it in another project

Copy `index.html` and `assets/` into the project (keeping them siblings), then open
`index.html` — every path is relative, so it works from a subfolder, a CDN, GitHub
Pages, or `file://`.

```
index.html          the page
assets/css/         site.css (main sheet), statement.css
assets/js/          libraries + app.js, statement.js, main behaviour
assets/fonts/       four woff2 faces
assets/img/         textures and icons
assets/stock/       photos, placeholder marks, video loops, hero visual
```

Serve it locally with anything:

```bash
python3 -m http.server 8080     # then open http://127.0.0.1:8080/
```

## Fonts

All four are open-licensed (SIL OFL), substituted for the commercial faces the
original design used:

| Role | Substitute |
| --- | --- |
| Primary / UI | Inter 500 |
| Display | Archivo 600 |
| Mono | IBM Plex Mono 400 |
| Wordmark | Syne 800 |

## What has been removed

- Google Analytics / Tag Manager — both script blocks, including the `G-…` measurement
  ID, are gone. The site makes no analytics or tag-manager requests.
- Webflow project identifiers (`data-wf-site`, `data-wf-page`) and all 21 generated
  `w-node-<uuid>` grid ids, renamed to `layout-01…21`.
- All original studio branding, copy, client names, awards, contact details and media.
  Photography is stock, logos are placeholder marks, video is generated loops.
- Dead CSS: 694 of 1044 selectors were unused framework rules.

## Authored for this project

- `assets/css/statement.css` + `assets/js/statement.js` — the statement section, written
  from scratch and namespaced `.ash-*`. No dependency on the animation bundle: one clock
  drives a rotating headline word, an active index row and a cross-fading image panel.
  Hover and focus take over, `IntersectionObserver` pauses it off-screen, and
  `prefers-reduced-motion` is honoured.
- All site content, naming, wordmark treatment and media selection.
- The asset pipeline: font substitution, stylesheet pruning and refactor, id renaming,
  path restructuring.

## Credits

Like any project, this one stands on code it did not write:

| Component | Origin |
| --- | --- |
| `assets/css/site.css` | Adapted from the reference design's stylesheet — pruned, renamed, retokenised and expanded, not re-authored |
| `assets/js/app.js` | The reference site's animation bundle (hero shader, scroll behaviour, transitions) |
| `assets/js/webflow.js` | Webflow runtime — required by `app.js`; removing it leaves the hero hidden and the hero canvas unsized |
| GSAP core, ScrollTrigger, Flip | GreenSock |
| GSAP SplitText, CustomEase | GreenSock Club plugins (commercial licence) |
| Lenis, Barba, Three.js, Howler, jQuery | MIT |

Licence the commercial pieces, or replace them, before using this publicly.

## Known noise

The sound toggle requests `assets/sound/*.mp3`, which are not shipped. The requests
404 and the feature degrades silently; delete the toggle or add the files.
