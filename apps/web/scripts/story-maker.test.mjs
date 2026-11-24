import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameOf, heightAt, inCatalonia, project, routeIn, settle, zoneOf } from '../src/story-maker/ground.ts';
import { profileOf, readGpx, recordedSeconds, TrackError } from '../src/story-maker/track.ts';

// A made-up track: a straight line east, a point every second, climbing a metre a point.
const point = (i, extra = '') => `<trkpt lat="41.8" lon="${(2.7 + i * 0.0001).toFixed(4)}"><ele>${100 + i}</ele><time>2020-01-01T00:00:${String(i).padStart(2, '0')}Z</time>${extra}</trkpt>`;
const gpx = (points, name = 'Volta de prova') => `<?xml version="1.0"?><gpx><trk><name>${name}</name><trkseg>${points.join('')}</trkseg></trk></gpx>`;
const line = Array.from({ length: 30 }, (_, i) => point(i));

test('a GPX gives its name and its points; heart rate and the rest are not read', () => {
  const track = readGpx(gpx([point(0, '<extensions><gpxdata:hr>150</gpxdata:hr></extensions>'), point(1)], 'A &amp; B'));
  assert.equal(track.name, 'A & B');
  assert.deepEqual(Object.keys(track.points[0]), ['lat', 'lon', 'ele', 'timeMs']);
  assert.equal(track.points[1].ele, 101);
});

test('what is not a GPX with a track is refused', () => {
  assert.throws(() => readGpx('<html></html>'), TrackError);
  assert.throws(() => readGpx('<gpx><trk><trkseg></trkseg></trk></gpx>'), TrackError);
  assert.throws(() => readGpx(gpx([point(0)])), TrackError);
});

test('a planned route, with no recording, is read from its route points, and has no heights or times', () => {
  const track = readGpx('<gpx><rte><rtept lat="41.8" lon="2.7"/><rtept lat="41.81" lon="2.7"/></rte></gpx>');
  assert.equal(track.points.length, 2);
  assert.equal(track.points[0].ele, null);
  assert.equal(recordedSeconds(track.points), null);
});

test('the profile is kilometre and elevation every twenty metres, the last point included', () => {
  const { points } = readGpx(gpx(line));
  const profile = profileOf(points, points.map((p) => p.ele));
  assert.deepEqual(profile[0], [0, 100]);
  // 29 steps of 0.0001° of longitude at 41.8° north: some 241 metres.
  assert.ok(Math.abs(profile.at(-1)[0] - 0.241) < 0.002, String(profile.at(-1)[0]));
  assert.equal(profile.at(-1)[1], 129);
  assert.ok(profile.length > 10 && profile.length < 15);
});

test('the time recorded leaves the pauses out', () => {
  const { points } = readGpx(gpx(line));
  assert.equal(recordedSeconds(points), 29);
  const paused = points.map((p, i) => (i >= 15 ? { ...p, timeMs: p.timeMs + 600_000 } : p));
  assert.equal(recordedSeconds(paused), 28);
});

test('a track in Catalonia is framed in the metres of the ICGC, in cells that keep the frame light', () => {
  const { points } = readGpx(gpx(line));
  assert.equal(inCatalonia(points), true);
  const { zone, xy } = project(points);
  assert.equal(zone, 31);
  const frame = frameOf(xy, zone);
  assert.equal(frame.cell, 10);
  assert.equal(frame.x0 % 10, 0);
  assert.ok(frame.cols <= 200 && frame.rows <= 200);
  // 400 m of ground around the track.
  assert.ok(Math.abs(frame.cols * frame.cell - (241 + 800)) < 30);
  const route = routeIn(frame, xy);
  assert.ok(route[0][0] >= 400 && route[0][0] < 410);
  // A long outing takes larger cells, in steps of five metres.
  const long = frameOf([[400000, 4600000], [430000, 4610000]], 31);
  assert.equal(long.cell % 5, 0);
  assert.ok(long.cols <= 200);
});

test('a track elsewhere is put in the metres of its own zone', () => {
  assert.equal(zoneOf(-3.7), 30);
  assert.equal(inCatalonia([{ lat: 40.4, lon: -3.7 }]), false);
  assert.equal(project([{ lat: 40.4, lon: -3.7 }, { lat: 40.41, lon: -3.7 }]).zone, 30);
});

test('cells with no elevation are the sea next to land at sea level, and no relief at all otherwise', () => {
  assert.deepEqual([...settle(Float32Array.from([1, 2, -9999, 3]))], [1, 2, -2, 3]);
  assert.equal(settle(Float32Array.from([300, 310, -9999, 320])), null);
  assert.equal(settle(Float32Array.from([-9999, -9999])), null);
  const whole = Float32Array.from([10, 20]);
  assert.equal(settle(whole), whole);
});

test('the ground under a point is read between the cells around it', () => {
  const frame = { zone: 31, x0: 0, y0: 0, cell: 10, cols: 2, rows: 2 };
  // Row 0 is the north edge.
  const heights = Float32Array.from([0, 10, 20, 30]);
  assert.equal(heightAt(frame, heights, [5, 15]), 0);
  assert.ok(Math.abs(heightAt(frame, heights, [15, 5]) - 30) < 0.05);
  assert.ok(Math.abs(heightAt(frame, heights, [10, 10]) - 15) < 1e-6);
});
