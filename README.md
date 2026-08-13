# MONOLOG (bymonolog.com) — offline site build

A fully self-contained, offline copy of the MONOLOG studio website, rebuilt from an
exported archive with **every resource localized** — CSS, JavaScript, images,
**all fonts**, and **all videos**. Opening the page shows the exact same website with
no internet connection required.

## View the site

Open the main page:

```
bymonolog.com/index.html
```

You can double-click that file to open it in a browser (all asset paths are relative),
or serve the folder for the most faithful result:

```bash
# from the repo root
python3 -m http.server 8080
# then visit http://127.0.0.1:8080/bymonolog.com/index.html
```

> The homepage opens on a dark, scroll-driven intro (by design). Scroll down to reveal
> the hero, case studies, service list, testimonials and footer.

## Folder layout

Assets are mirrored under their original host folders so the relative links resolve:

| Folder | Contents |
| --- | --- |
| `bymonolog.com/` | `index.html` (the site) |
| `cdn.prod.website-files.com/` | Webflow CSS, JS, **fonts** (`.woff2`), images (`.avif/.svg/.png`) |
| `byhuy.b-cdn.net/WebM/` | **All showreel/case-study videos** (`.webm` / `.mp4`) |
| `cdn.jsdelivr.net/`, `cdn.odyn.dev/`, `d3e54v103j8qbb.cloudfront.net/` | GSAP, Barba, Lenis, Three.js, Howler, jQuery, WebGL bundle |

## Fonts (localized)

| Family | File |
| --- | --- |
| Animo | `..._Animo-Normal_Regular.woff2` |
| Khteka | `..._KHTeka-Medium.woff2` |
| Suisse Mono | `..._SuisseIntlMono-Regular-WebXL.woff2` |

## Build notes

- Absolute CDN URLs in `index.html` and the Webflow CSS were rewritten to relative
  paths so everything loads locally.
- Empty/placeholder resources in the original export (the main stylesheet, the three
  fonts, and all videos) were re-fetched from their source URLs so nothing is missing.
- Subresource Integrity (`integrity`) / `crossorigin` attributes were removed from the
  localized CSS/JS `<link>`/`<script>` tags so the offline files are allowed to load.
- The footer copyright line was removed for distraction-free study; site content is
  otherwise unchanged.
