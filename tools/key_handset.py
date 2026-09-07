"""
key_handset.py — pull the hanging handset out of the reference.

Keeps only the blob the cord belongs to, which is what separates the
object from the type and the address set on the same sheet. Everything
else on that reference is somebody's wording and none of it is wanted.
"""
from collections import deque

import numpy as np
from PIL import Image

SRC = '/root/.claude/uploads/46160189-3019-506a-9f5e-ee97ab68a213/cda343d0-image.jpg'
OUT = 'assets/stock/objects/handset.png'

a = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
H, W, _ = a.shape
lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

# soft: the object is near-black on a 241 sheet, so anything under half
# is object and the rim between them becomes the alpha ramp
solid = lum < 96
edge = (lum >= 96) & (lum < 200)

lab = np.full((H, W), -1, int)
sizes = []
for y, x in zip(*np.nonzero(solid)):
    if lab[y, x] >= 0:
        continue
    q, n, i = deque([(y, x)]), 0, len(sizes)
    lab[y, x] = i
    while q:
        cy, cx = q.popleft()
        n += 1
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < H and 0 <= nx < W and solid[ny, nx] and lab[ny, nx] < 0:
                lab[ny, nx] = i
                q.append((ny, nx))
    sizes.append(n)

# the cord runs off the top of the frame, so the object is whatever the
# top row belongs to. Falls back to the biggest blob if the crop changes.
top = [lab[0, x] for x in range(W) if lab[0, x] >= 0]
keep = max(set(top), key=top.count) if top else int(np.argmax(sizes))
mask = lab == keep

# grow once through the soft rim, so the edge is not a stairstep
for _ in range(2):
    g = mask.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        g |= np.roll(mask, (dy, dx), (0, 1)) & edge
    mask = g

alpha = np.zeros((H, W))
alpha[mask] = np.clip((200 - lum[mask]) / 90, 0, 1)

ys, xs = np.nonzero(alpha > 0.05)
y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
out[:, :, :3] = np.clip(a[y0:y1, x0:x1], 0, 255).astype(np.uint8)
out[:, :, 3] = (alpha[y0:y1, x0:x1] * 255).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(OUT)
print(f'{OUT}  {x1 - x0}x{y1 - y0}  from y {y0 / H:.2f}..{y1 / H:.2f}, x {x0 / W:.2f}..{x1 / W:.2f}')
print(f'{sizes[keep]} px kept of {len(sizes)} blobs; the rest was type')
