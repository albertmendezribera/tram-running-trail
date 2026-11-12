"""Official product photos -> a profile and textures for the photo model of a shoe (prototype).
Needs numpy, scipy and Pillow. The photos belong to the brands: they and what this script
makes of them stay out of the repository (apps/web/src/content/shoes-local/ is not tracked).
Usage: python3 photo-model.py <photoDir> <outDir> <lateral> <medial> <top> <topSide:left|right> <forefootWidthMm> [<heel> <heelSide>]
The lateral photo has the toe at the left, the medial one at the right; the top photo
shows the pair with the toes down, and <topSide> says which of the two shoes to take."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out, lateral_name, medial_name, top_name, top_side, forefoot_mm = sys.argv[1:8]
# Optional: the photo of the pair from behind, and which of the two shoes to take.
heel_name, heel_side = (sys.argv[8], sys.argv[9]) if len(sys.argv) > 9 else (None, None)
STATIONS = 120

def load(name):
    return np.asarray(Image.open(f'{src}/{name}').convert('RGB')).astype(np.int16)

def mask_of(rgb):
    """The shoe apart from the studio backdrop: a smooth, neutral, light grey with a soft shadow.
    Only what reaches the edge of the photo through such pixels is backdrop: a pale, even
    patch of fabric inside the shoe is not."""
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    grey = rgb.mean(axis=2)
    rough = np.sqrt(np.maximum(0, ndimage.uniform_filter(grey ** 2, 7) - ndimage.uniform_filter(grey, 7) ** 2))
    # Down to a dark grey: the shadow under the sole is backdrop too, and it is as smooth.
    plain = (spread < 8) & (rgb.min(axis=2) > 70) & (rough < 2.2)
    regions, _ = ndimage.label(plain)
    border = np.unique(np.concatenate([regions[0], regions[-1], regions[:, 0], regions[:, -1]]))
    backdrop = np.isin(regions, border[border > 0])
    shoe = ndimage.binary_opening(~backdrop, iterations=3)
    labels, n = ndimage.label(shoe)
    return labels, n

def biggest(labels, n, count=1):
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    order = np.argsort(sizes)[::-1][:count]
    return [ndimage.binary_fill_holes(ndimage.binary_closing(labels == (i + 1), iterations=6)) for i in order]

def body(mask, rgb):
    """A side silhouette is one run of shoe in every column: the longest one. Under the
    sole lies its shadow on the floor, neutral and dark: the run is trimmed from below
    while it is colourless, by a twentieth of the photo at most (a black sole would
    otherwise go with it), and the lower edge is then smoothed."""
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    limit = mask.shape[0] // 20
    out = np.zeros_like(mask)
    lows = np.full(mask.shape[1], -1)
    tops = np.full(mask.shape[1], -1)
    for c in range(mask.shape[1]):
        col = np.concatenate([[False], mask[:, c], [False]])
        edges = np.flatnonzero(col[1:] != col[:-1])
        if not len(edges):
            continue
        runs = edges.reshape(-1, 2)
        a, b = runs[np.argmax(runs[:, 1] - runs[:, 0])]
        floor = b
        while b > a + 1 and floor - b < limit and spread[b - 1, c] < 14:
            b -= 1
        tops[c], lows[c] = a, b
    known = lows >= 0
    lows[known] = ndimage.median_filter(lows[known], 31)
    for c in np.flatnonzero(known):
        out[tops[c]:max(lows[c], tops[c] + 1), c] = True
    return out

def crop(rgb, mask):
    ys, xs = np.where(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]

def bleed(rgb, mask):
    """Carries the colours of the edge outwards, so a sample just off the shoe is not backdrop."""
    idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return rgb[idx[0], idx[1]]

def save(rgb, mask, name, width):
    image = Image.fromarray(bleed(rgb, mask).astype(np.uint8))
    height = round(image.height * width / image.width)
    image.resize((width, height), Image.LANCZOS).save(f'{out}/{name}.webp', quality=86)
    Image.fromarray((mask * 255).astype(np.uint8)).resize((width // 2, height // 2)).save(f'{out}/{name}-mask.png')

def spans(mask, axis_len):
    """For each station along the length, the first and last row (or column) of the shoe, as shares."""
    lo, hi = [], []
    cols = np.linspace(0, mask.shape[1] - 1, STATIONS + 1).round().astype(int)
    for c in cols:
        rows = np.where(mask[:, max(0, c - 2):c + 3].any(axis=1))[0]
        lo.append(float(rows.min()) / axis_len if len(rows) else None)
        hi.append(float(rows.max() + 1) / axis_len if len(rows) else None)
    return lo, hi

# Side views.
side = {}
for key, name in (('lateral', lateral_name), ('medial', medial_name)):
    rgb = load(name)
    mask = body(biggest(*mask_of(rgb))[0], rgb)
    rgb, mask = crop(rgb, mask)
    side[key] = (rgb, mask)
    save(rgb, mask, key, 1280)
lat_rgb, lat_mask = side['lateral']
# Heel to toe: the lateral photo has the toe at the left, so it is read right to left.
top_edge, bottom_edge = spans(lat_mask[:, ::-1], lat_mask.shape[0])
height_px, length_px = lat_mask.shape

# Top view: one shoe of the pair, heel up.
rgb = load(top_name)
pair = sorted(biggest(*mask_of(rgb), count=2), key=lambda m: np.where(m)[1].mean())
shoe = pair[0] if top_side == 'left' else pair[1]
top_rgb, top_mask = crop(rgb, shoe)
save(top_rgb, top_mask, 'top', 640)
# Rows run heel to toe; across, the left of the photo is one side of the shoe.
left_edge, right_edge = spans(top_mask.T, top_mask.shape[1])
width_px, top_length_px = top_mask.shape[1], top_mask.shape[0]

# Millimetres: the widest point of the photo from above is the measured forefoot width.
length_mm = float(forefoot_mm) * top_length_px / width_px
model = {
    'lengthMm': round(length_mm, 1),
    'heightMm': round(length_mm * height_px / length_px, 1),
    'widthMm': float(forefoot_mm),
    # Shares of the height, from the top of the photo, at each station from heel to toe.
    'top': [None if v is None else round(v, 4) for v in top_edge],
    'bottom': [None if v is None else round(v, 4) for v in bottom_edge],
    # Shares of the width, from the left of the photo from above.
    'left': [None if v is None else round(v, 4) for v in left_edge],
    'right': [None if v is None else round(v, 4) for v in right_edge],
    # The colour under the shoe: the photos used do not show the sole square on.
    'sole': [int(v) for v in np.median(lat_rgb[int(height_px * 0.93):][lat_mask[int(height_px * 0.93):]], axis=0)],
}
if heel_name:
    rgb = load(heel_name)
    pair = sorted(biggest(*mask_of(rgb), count=2), key=lambda m: np.where(m)[1].mean())
    shoe = body(pair[0] if heel_side == 'left' else pair[1], rgb)
    heel_rgb, heel_mask = crop(rgb, shoe)
    save(heel_rgb, heel_mask, 'heel', 512)
    model['heel'] = True
json.dump(model, open(f'{out}/model.json', 'w'))
print(model['lengthMm'], model['heightMm'], 'px', lat_mask.shape, top_mask.shape)
