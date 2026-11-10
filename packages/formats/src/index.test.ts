import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ABSENT, absentLabel, formatMeasure, formatMeasureParts, formatNumber } from './index.ts';

const clean = (s: string): string => s.replaceAll(' ', ' ');

describe('formatMeasure', () => {
  it('matches the Catalan examples of CLAUDE.md 7.9', () => {
    assert.equal(clean(formatMeasure(42.195, 'km', 'ca')), '42,195 km');
    assert.equal(clean(formatMeasure(1250, 'm-gain', 'ca')), '1.250 m D+');
    assert.equal(clean(formatMeasure(255, 'pace', 'ca')), '4:15 /km');
  });

  it('groups thousands in every locale, four digits included', () => {
    assert.equal(clean(formatMeasure(1250, 'm', 'es')), '1.250 m');
    assert.equal(clean(formatMeasure(1250, 'm', 'en')), '1,250 m');
  });

  it('uses the decimal separator of the locale', () => {
    assert.equal(clean(formatMeasure(42.195, 'km', 'en')), '42.195 km');
  });

  it('keeps the value and its unit on one line', () => {
    assert.ok(formatMeasure(10, 'km', 'ca').includes(' '));
  });

  it('formats durations as hh:mm:ss and carries rounded seconds', () => {
    assert.equal(formatMeasure(12461, 'duration', 'ca'), '03:27:41');
    assert.equal(clean(formatMeasure(299.6, 'pace', 'ca')), '5:00 /km');
  });

  it('translates km-effort', () => {
    assert.equal(clean(formatMeasure(54.5, 'km-effort', 'ca')), '54,5 km-esforç');
    assert.equal(clean(formatMeasure(54.5, 'km-effort', 'en')), '54.5 km-effort');
  });

  it('shows a missing value as absent, and keeps a real zero', () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(formatMeasure(v, 'km', 'ca'), ABSENT);
    assert.equal(clean(formatMeasure(0, 'm-gain', 'ca')), '0 m D+');
  });

  it('gives the figure and its unit apart, for large displays', () => {
    assert.deepEqual(formatMeasureParts(42.195, 'km', 'ca'), { value: '42,195', unit: 'km' });
    assert.deepEqual(formatMeasureParts(255, 'pace', 'ca'), { value: '4:15', unit: '/km' });
    assert.deepEqual(formatMeasureParts(12461, 'duration', 'ca'), { value: '03:27:41', unit: '' });
    assert.equal(formatMeasureParts(null, 'km', 'ca'), null);
  });

  it('formats bare figures for axes', () => {
    assert.equal(formatNumber(1400, 'ca'), '1.400');
    assert.equal(formatNumber(1400, 'en'), '1,400');
    assert.equal(formatNumber(2.5, 'ca'), '2,5');
    assert.equal(formatNumber(4.2, 'ca', 2, 2), '4,20');
  });

  it('labels the absent value for screen readers', () => {
    assert.equal(absentLabel('ca'), 'Sense dada');
  });
});
