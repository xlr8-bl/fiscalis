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

## What is still third-party

Being straight about this, because it matters if you ship it:

- **`assets/css/site.css`** — derived from the original design's stylesheet. Dead rules
  were pruned, generated ids renamed, fonts and asset URLs swapped, and it was expanded
  to readable form — but it was **not** re-authored from scratch. It is the design.
- **`assets/js/webflow.js`** — Webflow's runtime. **Cannot be removed.** Tested: without
  it the hero never becomes visible (`visibility:hidden` is never released) and the hero
  canvas never sizes, because `app.js` depends on it.
- **`assets/js/app.js`** — the original site's custom animation bundle (hero shader,
  scroll behaviour, transitions).
- GSAP `SplitText` and `CustomEase` are paid Club GreenSock plugins.

Treat this as a study/reference build. Removing the three items above means rebuilding
the design and its motion, not deleting files.

## Originally authored here

- `assets/css/statement.css` + `assets/js/statement.js` — the statement section, written
  from scratch and namespaced `.ash-*`. No dependency on the animation bundle: one clock
  drives a rotating headline word, an active index row and a cross-fading image panel.
  Hover and focus take over, `IntersectionObserver` pauses it off-screen, and
  `prefers-reduced-motion` is honoured.

## Known noise

The sound toggle requests `assets/sound/*.mp3`, which are not shipped. The requests
404 and the feature degrades silently; delete the toggle or add the files.
