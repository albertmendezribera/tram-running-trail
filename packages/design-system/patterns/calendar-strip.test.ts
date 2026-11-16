import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layoutStrip, type Mark, sharedScale } from './calendar-strip.ts';

const mark = (date: string, side: Mark['side'], weight: Mark['weight'] = 1, past = false): Mark => ({ date, side, weight, past });

describe('layoutStrip', () => {
  it('puts each mark in its week, Monday to Sunday', () => {
    // 2026 starts on a Thursday: the first week of the strip has four of its days.
    const strip = layoutStrip(2026, [mark('2026-01-01', 'up'), mark('2026-01-04', 'up'), mark('2026-01-05', 'up'), mark('2026-12-31', 'down')]);
    assert.equal(strip.columns, 53);
    assert.deepEqual(strip.cells.map((cell) => cell.column), [0, 0, 1, 52]);
  });

  it('gives a year that starts on a Monday its first week whole, and a leap year its day more', () => {
    assert.deepEqual(layoutStrip(2024, [mark('2024-01-07', 'up'), mark('2024-01-08', 'up'), mark('2024-12-31', 'up')]).cells.map((cell) => cell.column), [0, 1, 52]);
    assert.equal(layoutStrip(2024, []).columns, 53);
    // 2012 was a leap year that started on a Sunday: 366 days and six days of lead make 54 weeks, the most there can be.
    assert.equal(layoutStrip(2012, []).columns, 54);
    assert.deepEqual(layoutStrip(2012, [mark('2012-01-01', 'up'), mark('2012-12-31', 'up')]).cells.map((cell) => cell.column), [0, 53]);
  });

  it('stacks the marks of a week and a side outwards, each as thick as its weight, the heaviest at the foot', () => {
    const strip = layoutStrip(2027, [mark('2027-03-13', 'down', 1), mark('2027-03-14', 'down', 4), mark('2027-03-14', 'down', 2), mark('2027-03-14', 'up', 3)]);
    const down = strip.cells.filter((cell) => cell.side === 'down');
    assert.deepEqual(down.map((cell) => [cell.from, cell.thick]), [[0, 4], [4, 2], [6, 1]]);
    assert.deepEqual(strip.cells.filter((cell) => cell.side === 'up').map((cell) => [cell.from, cell.thick]), [[0, 3]]);
    assert.deepEqual(strip.tallest, { up: 3, down: 7, aside: 0 });
  });

  it('draws a mark of unknown weight as the thinnest, and marks it narrow', () => {
    const [cell] = layoutStrip(2027, [mark('2027-05-02', 'aside', null)]).cells;
    assert.deepEqual([cell!.thick, cell!.narrow], [1, true]);
  });

  it('keeps what has been run under what is to come', () => {
    const strip = layoutStrip(2026, [mark('2026-11-14', 'up', 4), mark('2026-11-10', 'up', 1, true)]);
    assert.deepEqual(strip.cells.map((cell) => [cell.past, cell.from]), [[true, 0], [false, 1]]);
  });

  it('leaves out the marks of other years', () => {
    assert.equal(layoutStrip(2027, [mark('2026-12-31', 'up'), mark('2028-01-01', 'up')]).cells.length, 0);
  });

  it('says where each month lies along the strip and what falls in it', () => {
    const strip = layoutStrip(2026, [mark('2026-02-01', 'up'), mark('2026-02-28', 'down'), mark('2026-02-15', 'aside'), mark('2026-03-01', 'up')]);
    assert.equal(strip.months.length, 12);
    assert.deepEqual(strip.months[1]!.count, { up: 1, down: 1, aside: 1 });
    assert.deepEqual(strip.months[2]!.count, { up: 1, down: 0, aside: 0 });
    // Months follow one another without gaps, from the lead of the first week to the end of the year.
    strip.months.slice(1).forEach((month, i) => assert.equal(month.from, strip.months[i]!.to));
    assert.equal(strip.months[0]!.from, 3 / (53 * 7));
    assert.ok(strip.months[11]!.to <= 1);
  });
});

describe('sharedScale', () => {
  it('takes the tallest stack of each side over every strip', () => {
    const a = layoutStrip(2026, [mark('2026-05-10', 'up', 4), mark('2026-05-10', 'up', 4)]);
    const b = layoutStrip(2027, [mark('2027-05-09', 'down', 3), mark('2027-05-09', 'aside', 2)]);
    assert.deepEqual(sharedScale([a, b]), { up: 8, down: 3, aside: 2 });
    assert.deepEqual(sharedScale([layoutStrip(2026, [])]), { up: 1, down: 1, aside: 0 });
  });
});
