import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeTerrainRgb, encodeTerrainRgb } from './terrain-rgb.ts';
import { parseGpx } from './gpx.ts';
import { planTiles } from './icgc.ts';
import { toLngLat, toUtm } from './utm.ts';

describe('toUtm', () => {
  it('puts the central meridian of zone 31 at x = 500,000 m', () => {
    assert.ok(Math.abs(toUtm(41.9, 3)[0] - 500000) < 1e-6);
  });

  it('keeps distances: 0.01° of latitude is about 1.11 km', () => {
    const d = toUtm(41.91, 3.05)[1] - toUtm(41.9, 3.05)[1];
    assert.ok(Math.abs(d - 1111) < 5, String(d));
  });

  it('places Calonge east of the central meridian', () => {
    const [x, y] = toUtm(41.86, 3.08);
    assert.ok(x > 500000 && x < 520000 && y > 4630000 && y < 4640000, `${x} ${y}`);
  });
});

describe('toLngLat', () => {
  it('undoes toUtm to a fraction of a millimetre across Catalonia', () => {
    for (const [lat, lon] of [[41.86, 3.08], [40.6, 0.5], [42.8, 1.2], [41.4, 2.17]] as const) {
      const [lng2, lat2] = toLngLat(...toUtm(lat, lon));
      assert.ok(Math.abs(lat2 - lat) < 1e-8 && Math.abs(lng2 - lon) < 1e-8, `${lat},${lon} → ${lat2},${lng2}`);
    }
  });
});

describe('terrain-RGB', () => {
  it('round-trips elevations to 0.1 m, below sea level included', () => {
    const heights = [-12.3, 0, 7.75, 357.21, 3404.9];
    const decoded = decodeTerrainRgb(encodeTerrainRgb(heights), 3);
    heights.forEach((h, i) => assert.ok(Math.abs(decoded[i]! - h) <= 0.05 + 1e-6, `${h} → ${decoded[i]}`));
  });
});

describe('parseGpx', () => {
  it('reads every track point in order', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="41.1" lon="3.1"><ele>10</ele></trkpt><trkpt lat="41.2" lon="3.2"><ele>12.5</ele></trkpt></trkseg></trk></gpx>';
    assert.deepEqual(parseGpx(gpx), [{ lat: 41.1, lon: 3.1, ele: 10 }, { lat: 41.2, lon: 3.2, ele: 12.5 }]);
  });

  it('rejects points without elevation', () => {
    assert.throws(() => parseGpx('<trkpt lat="1" lon="2"></trkpt><trkpt lat="1" lon="2"><ele>1</ele></trkpt>'), /elevation/);
  });
});

describe('planTiles', () => {
  it('covers the grid exactly, within the request limit', () => {
    const tiles = planTiles(564, 713);
    assert.equal(tiles.reduce((s, t) => s + t.cols * t.rows, 0), 564 * 713);
    assert.ok(tiles.every((t) => t.cols * t.rows <= 35800));
  });
});

it('plate: a cone gives closed contours around its summit and the track with its kilometre marks', async () => {
  const { buildPlate, contourLines, simplify } = await import('./plate.ts');
  const cols = 60;
  const rows = 40;
  const heights = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heights[r * cols + c] = Math.max(0, 100 - Math.hypot(c - 30, r - 20) * 5);
  const ring = contourLines(heights, cols, rows, 50);
  assert.equal(ring.length, 1);
  assert.deepEqual(ring[0]![0], ring[0]!.at(-1));
  for (const [x, y] of ring[0]!) assert.ok(Math.abs(Math.hypot(x - 30, y - 20) - 10) < 0.5);
  const lean = simplify(ring[0]!, 0.4);
  assert.ok(lean.length < ring[0]!.length && lean.length >= 8);
  for (const [x, y] of lean) assert.ok(Math.abs(Math.hypot(x - 30, y - 20) - 10) < 0.5);

  // A straight track of 3 km, west to east, 100 m above the south edge.
  const plate = buildPlate({ heights, cols, rows, cell: 100, route: [[500, 100], [3500, 100]], distanceKm: 3 });
  assert.equal(plate.intervalM, 10);
  assert.ok(plate.contours.length >= 8);
  assert.ok(plate.contours.some((c) => c.major && c.elevation === 50));
  assert.deepEqual(plate.start, [5, 39]);
  assert.deepEqual(plate.finish, [35, 39]);
  assert.deepEqual(plate.marks, [{ km: 1, x: 15, y: 39 }, { km: 2, x: 25, y: 39 }]);
});

describe('world', () => {
  it('knows what is inside a polygon with a hole', async () => {
    const { insideRings } = await import('./world.ts');
    const rings = [[[0, 0], [10, 0], [10, 10], [0, 10]], [[4, 4], [6, 4], [6, 6], [4, 6]]] as const;
    assert.equal(insideRings([2, 2], rings), true);
    assert.equal(insideRings([5, 5], rings), false);
    assert.equal(insideRings([12, 5], rings), false);
  });

  it('grows trees where the LiDAR found canopy: as many as its cover and as tall as its mean height', async () => {
    const { forestTrees, distanceToLine } = await import('./world.ts');
    const route = [[0, 100], [200, 100]] as const;
    // Two rows of ten cells of 20 m: the north row is closed pine wood of 12 m, the south one has no trees.
    const cover = new Uint8Array(20).fill(0);
    const heightM = new Uint8Array(20).fill(0);
    cover.fill(100, 0, 10);
    heightM.fill(12, 0, 10);
    cover[3] = 255; // no data
    const options = { route, canopy: { cellM: 20, cols: 10, rows: 2, x0: 0, y0: 100, cover, heightM }, kindAt: () => 'pine' as const, spacingM: 10, corridorM: 60, clearanceM: 4 };
    const trees = forestTrees(options);
    // Nine full cells of 400 m² at one tree per 100 m², less those too near the path.
    assert.ok(trees.length >= 26 && trees.length <= 36, String(trees.length));
    for (const [x, y, h, kind] of trees) {
      assert.ok(y >= 120 && y <= 140 && !(x >= 60 && x < 80));
      assert.ok(distanceToLine([x, y], route) >= 4);
      assert.ok(h >= 12 * 0.8 && h <= 12 * 1.25);
      assert.equal(kind, 'pine');
    }
    assert.deepEqual(forestTrees(options), trees);
  });

  it('plants a grove in rows where the land-cover map has the crop', async () => {
    const { groveTrees } = await import('./world.ts');
    const trees = groveTrees({ route: [[0, 0], [100, 0]], planted: ([, y]) => y > 20, kind: 'olive', spacingM: 7, heightM: 4, corridorM: 50 });
    assert.ok(trees.length > 30);
    for (const [, y, h, kind] of trees) {
      assert.ok(y > 20 && y <= 50);
      assert.ok(h >= 3.4 && h <= 4.6);
      assert.equal(kind, 'olive');
    }
  });

  it('tells outer rings from holes in a tile polygon', async () => {
    const { polygonsOf } = await import('./world.ts');
    // Tile coordinates, y down: the outer ring clockwise on screen, the hole the other way.
    const outer = [[0, 0], [10, 0], [10, 10], [0, 10]] as const;
    const hole = [[4, 4], [4, 6], [6, 6], [6, 4]] as const;
    const second = [[20, 0], [30, 0], [30, 10], [20, 10]] as const;
    const polygons = polygonsOf([outer, hole, second]);
    assert.equal(polygons.length, 2);
    assert.equal(polygons[0]!.length, 2);
    assert.equal(polygons[1]!.length, 1);
  });
});

describe('houses of a block', () => {
  const block = { heightM: 14, polygon: [[[0, 0], [20, 0], [20, 10], [0, 10]] as Array<[number, number]>] };
  const route: Array<[number, number]> = [[-50, -10], [80, -10]];

  it('replaces a block near the route by the houses the cadastre has inside it, three metres a floor', async () => {
    const { housesOf } = await import('./world.ts');
    const parts = [
      { floors: 2, rings: [[[0, 0], [8, 0], [8, 10], [0, 10], [0, 0]] as Array<[number, number]>], use: 'residential', year: 1930 },
      { floors: 5, rings: [[[8, 0], [20, 0], [20, 10], [8, 10], [8, 0]] as Array<[number, number]>], use: 'retail', year: null },
      // A quay the cadastre calls a building and the map does not.
      { floors: 1, rings: [[[40, 0], [60, 0], [60, 10], [40, 10]] as Array<[number, number]>], use: null, year: null },
    ];
    const houses = housesOf({ blocks: [block], parts, route, detailM: 100 });
    assert.deepEqual(houses.map((h) => [h.heightM, h.floors, h.use, h.year, h.rings[0]!.length]), [[6, 2, 'residential', 1930, 4], [15, 5, 'retail', undefined, 4]]);
  });

  it('keeps the block as the map drew it where the cadastre has nothing, or far from the route', async () => {
    const { housesOf } = await import('./world.ts');
    const part = { floors: 3, rings: [[[0, 0], [20, 0], [20, 10], [0, 10]] as Array<[number, number]>], use: null, year: null };
    assert.deepEqual(housesOf({ blocks: [block], parts: [], route, detailM: 100 }).map((h) => [h.heightM, h.floors]), [[14, undefined]]);
    assert.deepEqual(housesOf({ blocks: [block], parts: [part], route, detailM: 5 }).map((h) => [h.heightM, h.floors]), [[14, undefined]]);
    // Something of no floors above ground, or too small to be a house, is not one.
    assert.equal(housesOf({ blocks: [block], parts: [{ ...part, floors: 0 }], route, detailM: 100 })[0]!.floors, undefined);
  });

  it('tidies an outline: no closing point, no point on the line between its neighbours', async () => {
    const { tidyRing } = await import('./world.ts');
    assert.deepEqual(tidyRing([[0, 0], [5, 0.02], [10, 0], [10, 10], [0, 10], [0, 0]]), [[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
});

describe('cadastre', () => {
  it('asks for the squares a route comes near, each once', async () => {
    const { tilesNear } = await import('./cadastre.ts');
    assert.deepEqual(tilesNear([[500950, 4630500], [501100, 4630500]], 100), [[500000, 4630000], [501000, 4630000]]);
  });

  it('reads the floors of a part and the use and year of its building', async () => {
    const { parseBuildings, parseParts } = await import('./cadastre.ts');
    const part = `<bu-ext2d:BuildingPart gml:id="ES.SDGC.BU.0531601EG1303S_part1"><base:localId>0531601EG1303S_part1</base:localId>
      <gml:PolygonPatch><gml:exterior><gml:LinearRing><gml:posList srsDimension="2" count="5">0 0 10 0 10 8 0 8 0 0</gml:posList></gml:LinearRing></gml:exterior></gml:PolygonPatch>
      <bu-ext2d:numberOfFloorsAboveGround>4</bu-ext2d:numberOfFloorsAboveGround></bu-ext2d:BuildingPart>`;
    assert.deepEqual(parseParts(part), [{ building: '0531601EG1303S', floors: 4, rings: [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]] }]);
    const building = (use: string, year: string): string =>
      `<bu-ext2d:Building gml:id="x"><bu-core2d:beginning>${year}-01-01T00:00:00</bu-core2d:beginning><base:localId>0531601EG1303S</base:localId><bu-ext2d:currentUse>${use}</bu-ext2d:currentUse></bu-ext2d:Building>`;
    assert.deepEqual(parseBuildings(building('4_2_retail', '1963')).get('0531601EG1303S'), { use: 'retail', year: 1963 });
    // The cadastre writes the year 1 where it does not know it.
    assert.deepEqual(parseBuildings(building('1_residential', '0001')).get('0531601EG1303S'), { use: 'residential', year: null });
  });
});

describe('OpenStreetMap', () => {
  it('keeps what a runner would know a place by, and nothing else', async () => {
    const { osmKind } = await import('./osm.ts');
    assert.equal(osmKind({ amenity: 'restaurant', name: 'x' }), 'restaurant');
    assert.equal(osmKind({ shop: 'clothes' }), 'shop');
    assert.equal(osmKind({ shop: 'bakery' }), 'bakery');
    assert.equal(osmKind({ tourism: 'information' }), null);
    assert.equal(osmKind({ office: 'estate_agent' }), null);
  });
});

describe('street trees', () => {
  it('takes a dark olive pixel for a crown, and not a lawn, a shadow, a tiled roof, tarmac or the sea', async () => {
    const { crownOf } = await import('./world.ts');
    assert.ok(crownOf(114, 107, 82) > 0.6);
    assert.ok(crownOf(60, 80, 50) > 0.9);
    for (const [r, g, b] of [[145, 138, 115], [70, 51, 42], [150, 90, 70], [90, 90, 85], [40, 80, 90]] as const) assert.ok(crownOf(r, g, b) < 0.3, `${r},${g},${b}`);
  });

  it('stands one tree to a crown, where it is allowed, clear of the route and within reach of it', async () => {
    const { townTrees } = await import('./world.ts');
    // 40 × 20 cells of 2 m: a crown of 3 × 3 cells north of the route, a lone dark pixel, and a crown too far away.
    const [cols, rows] = [40, 20];
    const values = new Float32Array(cols * rows);
    const crown = (col: number, row: number): void => {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) values[(row + dr) * cols + col + dc] = 0.9;
    };
    crown(10, 12);
    values[14 * cols + 25] = 0.9;
    crown(30, 2);
    const route: Array<[number, number]> = [[0, 4], [80, 4]];
    const trees = townTrees({ route, crowns: { cellM: 2, cols, rows, values }, allowed: () => true, corridorM: 20 });
    assert.equal(trees.length, 1);
    assert.ok(Math.abs(trees[0]![0] - 21) < 3 && Math.abs(trees[0]![1] - 15) < 3, String(trees[0]));
    assert.equal(trees[0]![3], 'deciduous');
    assert.equal(townTrees({ route, crowns: { cellM: 2, cols, rows, values }, allowed: () => false, corridorM: 20 }).length, 0);
  });
});
