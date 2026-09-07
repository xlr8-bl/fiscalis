"""
retouch_sky_arms.py — take the cigar out of sky-arms.jpg.

Kept as a script rather than done by hand once, because the source
photograph is in the repository and anybody re-exporting it needs to be
able to redo this and get the same frame back.

The cigar is two problems, not one, and they are filled separately or
the sky bleeds into his lip:

  over the sky   x 462..500, y 763..782 -- fill with sky
  over the lip   behind it, hidden      -- fill with lip

The lip's real edge is BEHIND the cigar, so it cannot be measured, only
continued. Measured above the cigar it sits at x 462 (y 765) and below
it at x 461 (y 776); the reconstruction runs a curve between those two
with a 4px bulge, which is a mouth. That bulge is the only invented
number here and it is small on purpose.
"""
import numpy as np
from PIL import Image

SRC = 'assets/stock/own/sky-arms.jpg'
Y0, Y1 = 762, 784          # rows the cigar touches, plus a margin
XMAX = 502                 # past the ash tip
BULGE = 4.0                # px the lips carry past the chin line

a = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
H, W, _ = a.shape

# sky where nothing is in front of it, per row, so the gradient is kept
sky = a[:, 560:600].mean(axis=1)
is_sky = np.sqrt(((a - sky[:, None, :]) ** 2).sum(2)) < 42


def face_edge(y):
    """Rightmost pixel of him on row y, scanning out from inside."""
    x = 380
    while x < W - 1 and not is_sky[y, x + 1]:
        x += 1
    return x


# measured clear of the cigar, then continued across it
above, below = face_edge(Y0 - 3), face_edge(Y1 + 3)
edge = np.zeros(H)
for y in range(H):
    if Y0 <= y <= Y1:
        t = (y - Y0) / (Y1 - Y0)
        edge[y] = above + (below - above) * t + BULGE * np.sin(np.pi * t)
    else:
        edge[y] = face_edge(y)

# the mask: anything that is not sky and not him, in the rows he holds it
mask = np.zeros((H, W), bool)
lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]
for y in range(Y0, Y1 + 1):
    for x in range(430, XMAX):
        if x > edge[y]:
            mask[y, x] = not is_sky[y, x]      # cigar against the sky
        elif lum[y, x] > 125:
            mask[y, x] = True                  # cigar against the lip


def components(m):
    """Blobs, so the specular specks on his lip can be dropped."""
    from collections import deque
    lab = np.full(m.shape, -1, int)
    out = []
    for y, x in zip(*np.nonzero(m)):
        if lab[y, x] >= 0:
            continue
        q, n, i = deque([(y, x)]), 0, len(out)
        lab[y, x] = i
        while q:
            cy, cx = q.popleft()
            n += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] \
                        and m[ny, nx] and lab[ny, nx] < 0:
                    lab[ny, nx] = i
                    q.append((ny, nx))
        out.append(n)
    return lab, out


lab, sizes = components(mask)
for i, n in enumerate(sizes):
    if n < 12:
        mask[lab == i] = False        # a highlight on his lip, not the cigar

# grow it: a colour key stops at the anti-aliased rim, and a brown fringe
# left round a removed cigar looks worse than the cigar
grown = mask.copy()
for _ in range(2):
    g = grown.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        g |= np.roll(grown, (dy, dx), (0, 1))
    grown = g
mask = grown


def fill(region, keep):
    """Laplace on the hole, boundary values from `keep` only.

    Diffusion rather than a clone: the sky is a gradient and a flat patch
    of it shows. Run over the two sides separately, so the sky's boundary
    is sky and the lip's is lip and the silhouette between them stays a
    hard edge.
    """
    out = a.copy()
    ys, xs = np.nonzero(region)
    if not len(ys):
        return out
    for _ in range(600):
        acc = np.zeros((len(ys), 3))
        n = np.zeros((len(ys), 1))
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = ys + dy, xs + dx
            ok = keep[yy, xx] | region[yy, xx]
            acc[ok] += out[yy[ok], xx[ok]]
            n[ok, 0] += 1
        out[ys, xs] = acc / np.maximum(n, 1)
    return out


sky_side = mask & (np.arange(W)[None, :] > edge[:, None])
lip_side = mask & ~sky_side

# sky first: its boundary is sky, and the lip is not allowed to leak in
a = fill(sky_side, is_sky & ~mask)
# then the lip, whose boundary is him
him = (~is_sky) & ~mask
a = fill(lip_side, him)

# one pixel of feather on the rebuilt silhouette: everywhere else in the
# photograph that edge is anti-aliased, and a hard one reads as a cut-out
for y in range(Y0, Y1 + 1):
    x = int(edge[y])
    a[y, x] = (a[y, x - 1] + a[y, x + 1]) / 2

Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(SRC, quality=94, optimize=True)
print(f'filled {mask.sum()} px: {sky_side.sum()} against the sky, {lip_side.sum()} on the lip')
