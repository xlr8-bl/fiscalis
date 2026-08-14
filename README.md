# WEB3ASHLEY — offline site build

A fully self-contained, offline website build, assembled from a Webflow export with **every resource localized** — CSS, JavaScript, images,
**all fonts**, and **all videos**. Opening the page shows the exact same website with
no internet connection required.

## View the site

Open the main page:

```
site/index.html
```

You can double-click that file to open it in a browser (all asset paths are relative),
or serve the folder for the most faithful result:

```bash
# from the repo root
python3 -m http.server 8080
# then visit http://127.0.0.1:8080/site/index.html
```

> The homepage opens on a dark, scroll-driven intro (by design). Scroll down to reveal
> the hero, case studies, service list, testimonials and footer.

## Folder layout

Assets are mirrored under their original host folders so the relative links resolve:

| Folder | Contents |
| --- | --- |
| `site/` | `index.html` (the site) |
| `cdn.prod.website-files.com/` | Webflow CSS, JS, **fonts** (`.woff2`), images (`.avif/.svg/.png`) |
| `assets/stock/` | Stock photos, placeholder logo marks and generated video loops |
| `cdn.jsdelivr.net/`, `cdn.odyn.dev/`, `d3e54v103j8qbb.cloudfront.net/` | GSAP, Barba, Lenis, Three.js, Howler, jQuery, WebGL bundle |

## Fonts (open-licensed substitutes)

The original commercial faces were replaced with the closest freely-licensed equivalents:

| Role | Original | Substitute (SIL OFL) |
| --- | --- | --- |
| Primary / UI | KH Teka Medium | Inter 500 |
| Display | Animo | Archivo 600 |
| Mono | Suisse Int'l Mono | IBM Plex Mono 400 |

## Layout

```
site/index.html      the page
assets/css/site.css  stylesheet
assets/fonts/        open-licensed woff2
assets/js/           gsap, barba, lenis, three, howler, jquery, webflow runtime, app bundle
assets/img/          textures and icons
assets/stock/        stock photos, placeholder marks, generated video loops, hero visual
```

## Known third-party code still present

- `assets/js/webflow.js` — Webflow's runtime. **Cannot be removed**: the app bundle
  depends on it, and without it the hero never becomes visible.
- `assets/js/app.js` — the original site's custom animation bundle.
- `assets/css/site.css` — the original stylesheet, with font families and asset URLs
  rewritten. It has **not** been re-authored from scratch.
