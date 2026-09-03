# Pre-keyed cut-outs

Produced by `tools/extract_objects.py` from `assets/stock/src`, and
committed rather than regenerated, so a panel loads a transparent PNG
instead of keying a JPEG in the browser on every render.

That replaces `cutOut()` in `assets/js/flow.js`, which sampled four
corner pixels at a fixed tolerance. The offline keyer takes the median
of the whole border ring, keeps only the background regions that
actually touch the edge, closes pinholes and fills holes, and ramps the
alpha rather than thresholding it. The difference is not academic:
`figure-crouch` keys at 0.78 here, and it is the file I had earlier
called unkeyable on the strength of the browser keyer failing on it.

`manifest.json` records, per object, the source file, the crop box, how
much of the sheet it covered, its keyability, and whether it reads as
photographic. Anything below about 0.7 keyability wants checking by eye
before it goes in a design.
