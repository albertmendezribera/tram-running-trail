"""Official product photos -> a profile and textures for the photo model of a shoe (prototype).
Needs numpy, scipy and Pillow. The photos belong to the brands: they and what this script
makes of them stay out of the repository (apps/web/src/content/shoes-local/ is not tracked).

Usage: python3 photo-model.py <config.json>, where the config says where the photos are and how
each one is taken:
  { "src": dir, "out": dir, "foot": "left"|"right", "forefootMm": measured width,
    "lateral": { "file", "toe": "left"|"right" }, "medial": { "file" },
    "top":  { "file", "pick": "left"|"right", "toes": "up"|"down" },
    "heel": { "file", "pick" } (optional), "sole": { "file", "pick", "toes" } (optional) }
`pick` is which shoe of a pair to take: it has to be the same foot as the side photos."""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

config = json.load(open(sys.argv[1]))
src, out = config['src'], config['out']
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
        # A column of nothing but grey is the shadow reaching past the toe or the heel: not shoe.
        if (spread[a:b, c] < 14).mean() > 0.8:
            continue
        tops[c], lows[c] = a, b
    # The shoe is one stretch of columns: the longest.
    cols = np.concatenate([[False], lows >= 0, [False]])
    edges = np.flatnonzero(cols[1:] != cols[:-1]).reshape(-1, 2)
    first, last = edges[np.argmax(edges[:, 1] - edges[:, 0])]
    lows[:first] = lows[last:] = -1
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

def one_of_pair(view):
    """One shoe of a photo of the pair, cut out, with the heel at the top."""
    rgb = load(view['file'])
    pair = sorted(biggest(*mask_of(rgb), count=2), key=lambda m: np.where(m)[1].mean())
    rgb, mask = crop(rgb, pair[0] if view['pick'] == 'left' else pair[1])
    if view.get('toes') == 'up':
        rgb, mask = rgb[::-1, ::-1], mask[::-1, ::-1]
    return rgb, mask

# Side views.
side = {}
for key in ('lateral', 'medial'):
    rgb = load(config[key]['file'])
    mask = body(biggest(*mask_of(rgb))[0], rgb)
    rgb, mask = crop(rgb, mask)
    side[key] = (rgb, mask)
    save(rgb, mask, key, 1280)
lat_rgb, lat_mask = side['lateral']
# Read from heel to toe, whichever way the lateral photo faces.
heel_first = lat_mask if config['lateral']['toe'] == 'right' else lat_mask[:, ::-1]
top_edge, bottom_edge = spans(heel_first, lat_mask.shape[0])
height_px, length_px = lat_mask.shape

# From above: rows run heel to toe; across, the left of the photo is one side of the shoe.
top_rgb, top_mask = one_of_pair(config['top'])
save(top_rgb, top_mask, 'top', 640)
left_edge, right_edge = spans(top_mask.T, top_mask.shape[1])
width_px, top_length_px = top_mask.shape[1], top_mask.shape[0]

# Millimetres: the widest point of the photo from above is the measured forefoot width.
forefoot_mm = float(config['forefootMm'])
length_mm = forefoot_mm * top_length_px / width_px
model = {
    'foot': config['foot'],
    'lengthMm': round(length_mm, 1),
    'heightMm': round(length_mm * height_px / length_px, 1),
    'widthMm': forefoot_mm,
    # Shares of the height, from the top of the photo, at each station from heel to toe.
    'top': [None if v is None else round(v, 4) for v in top_edge],
    'bottom': [None if v is None else round(v, 4) for v in bottom_edge],
    # Shares of the width, from the left of the photo from above.
    'left': [None if v is None else round(v, 4) for v in left_edge],
    'right': [None if v is None else round(v, 4) for v in right_edge],
    # The colour under the shoe, for when no photo shows the sole square on.
    'soleColour': [int(v) for v in np.median(lat_rgb[int(height_px * 0.93):][lat_mask[int(height_px * 0.93):]], axis=0)],
}
if config.get('heel'):
    rgb = load(config['heel']['file'])
    pair = sorted(biggest(*mask_of(rgb), count=2), key=lambda m: np.where(m)[1].mean())
    shoe = body(pair[0] if config['heel']['pick'] == 'left' else pair[1], rgb)
    save(*crop(rgb, shoe), 'heel', 512)
    model['heel'] = True
if config.get('sole'):
    save(*one_of_pair(config['sole']), 'sole', 640)
    model['sole'] = True
json.dump(model, open(f'{out}/model.json', 'w'))
print(model['foot'], model['lengthMm'], model['heightMm'], 'px', lat_mask.shape, top_mask.shape)
