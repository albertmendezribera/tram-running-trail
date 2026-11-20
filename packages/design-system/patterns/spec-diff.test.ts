import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diffOf } from './spec-diff.ts';

describe('diffOf', () => {
  it('takes the second figure less the first, with its sign and its unit', () => {
    assert.deepEqual(diffOf(250, 190, 'g', 'ca'), { delta: -60, text: '−60 g', share: 0.24, sign: 'less' });
    assert.deepEqual(diffOf(30, 38.5, 'mm', 'ca'), { delta: 8.5, text: '+8,5 mm', share: 0.221, sign: 'more' });
  });

  it('says two equal figures are the same, with no sign', () => {
    assert.deepEqual(diffOf(8, 8, 'mm', 'ca'), { delta: 0, text: '0 mm', share: 0, sign: 'same' });
  });

  it('takes no difference against a figure that is not known', () => {
    for (const [a, b] of [[null, 8], [8, null], [undefined, undefined]] as const) assert.deepEqual(diffOf(a, b, 'mm', 'ca'), { delta: null, text: '—', share: 0, sign: 'none' });
  });

  it('reaches no further than the whole bar, and measures against the larger figure', () => {
    assert.equal(diffOf(0, 10, 'mm', 'ca').share, 1);
    assert.equal(diffOf(10, 5, 'mm', 'ca').share, 0.5);
    // Two figures under a unit are measured against a unit, so a difference of nothing much does not fill the bar.
    assert.equal(diffOf(0, 0.5, 'mm', 'ca').share, 0.5);
  });
});
