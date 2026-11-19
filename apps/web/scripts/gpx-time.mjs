// How long a GPX track was recorded for, in seconds: the time between its points, leaving out every
// pause. A watch that is recording writes a point every second or so; a step of more than ten seconds
// between two points is the watch stopped, and is not counted. Nothing else of the times is kept: not
// the day, not the hour, not the time of any one point.
// Usage: node scripts/gpx-time.mjs <track.gpx>
import { readFileSync } from 'node:fs';

const PAUSE_S = 10;
const [input] = process.argv.slice(2);
if (!input) throw new Error('usage: node scripts/gpx-time.mjs <track.gpx>');
const times = [...readFileSync(input, 'utf8').matchAll(/<trkpt\b[^>]*>[\s\S]*?<\/trkpt>/g)].map(([point]) => Date.parse(/<time>([^<]+)<\/time>/.exec(point)?.[1] ?? ''));
if (times.length < 2 || times.some(Number.isNaN)) throw new Error('the track needs at least two points, all with their time');
let [recorded, pauses] = [0, 0];
for (let i = 1; i < times.length; i++) {
  const step = (times[i] - times[i - 1]) / 1000;
  if (step > PAUSE_S) pauses += 1;
  else recorded += step;
}
console.log(`${Math.round(recorded)} seconds recorded, ${pauses} pauses left out`);
