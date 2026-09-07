# web3ashley

## Comments

Keep them short. Ashley has asked twice; the code was 37% comment and is
now 25%, which is still the ceiling rather than the target.

Write a comment only when it stops someone breaking the code:

- where a number came from (`caps 0.0816 of frame, measured off h035`)
- a constraint that is not visible locally (`TikTok takes JPEG, not PNG`)
- a trap already hit once (`wrap WITH tracking or every line is wrong`)

Do not write:

- what the code plainly does
- the story of what was tried first, unless the wrong thing is tempting
- a paragraph where a clause works
- section banners, or a docstring restating the function name

One line beats five. A file header of six lines beats thirty.

## Everything else

- No em dashes or en dashes anywhere in the site's writing.
- No prices, packages or tiers, anywhere public.
- First person singular. There is no team.
- Nothing fabricated: no invented statistic, date, name, quote or study.
- Look up docs rather than assume. Licences too, before installing a font.
- The agent credential must never approve, schedule, decide-to-post or
  delete. `AGENT_STATES` in lib/carousels.js is the ceiling.
- Everything must be doable from a phone.

## Where things are

- `assets/js/slides.js` — teaching carousels. Flow layout, blocks, cut-outs.
- `lib/slides/spec.js` — the copy budget. Must agree with the renderer.
- `lib/slides/guide.js` — what Spark reads. Figures come FROM the
  validator, never a second calculation of the same thing.
- `lib/slides/cutouts.js` — hardcoded photo placements.
- `assets/js/compose.js` + `lib/hooks/` — hook sheets, absolute boxes.
- `tools/check_*.mjs` — run these before committing.
- `tools/build_slides.mjs`, `build_carousel.mjs`, `build_ctas.mjs` — render.

## Measuring a reference

`tools/tighten.py`. A box is only measured when all four edges cleared;
`CLIPPED` means the window's edge was found, not the block's, and that
number is your own guess handed back. Never write a clipped result down
as measured.
