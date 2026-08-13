# WEB3ASHLEY — offline site build

A fully self-contained, offline website build, assembled from a Webflow export with **every resource localized** — CSS, JavaScript, images,
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

## Hero fix

The site loads its own JS bundle by building the URL in JavaScript
(`base + "/" + env + "/3pc9/bundle.js"`) rather than a literal `src`, so URL rewriting
missed it and the bundle silently failed offline. That bundle is what flips
`[data-animate]` from `visibility:hidden; opacity:0` to visible and sizes the hero
WebGL canvas — without it the page stayed black. The loader now points at the local
copy, so the hero, shader background and intro animation render correctly.

## Branding

The original studio branding was removed: logotypes replaced with fitted `WEB3ASHLEY`
wordmarks, JSON-LD (founder identity, awards, named reviews) dropped, page metadata and
favicons neutralized, the Webflow partner badge removed, client/testimonial names
replaced with placeholders, and outbound personal links pointed at `#`. Layout, styling
and animation are untouched.
