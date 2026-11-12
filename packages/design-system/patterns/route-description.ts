import { formatMeasure, formatNumber, type Locale } from '@tram/formats';
import { detectClimbs, type ProfilePoint, summarize } from './elevation.ts';

const COPY = {
  ca: {
    total: (d: string, g: string) => `${d} amb ${g}.`,
    flat: 'El recorregut és gairebé pla: no hi ha cap pujada destacada.',
    climb: (n: string, len: string, grade: string, from: string, to: string, gain: string) => `${n} fa ${len} al ${grade} % de mitjana, del km ${from} al ${to}, i hi guanyes ${gain}.`,
    main: 'La pujada principal',
    another: 'Una altra pujada',
    top: (h: string, km: string) => `El punt més alt és a ${h}, al km ${km}.`,
  },
  es: {
    total: (d: string, g: string) => `${d} con ${g}.`,
    flat: 'El recorrido es casi llano: no hay ninguna subida destacada.',
    climb: (n: string, len: string, grade: string, from: string, to: string, gain: string) => `${n} tiene ${len} al ${grade} % de media, del km ${from} al ${to}, y ganas ${gain}.`,
    main: 'La subida principal',
    another: 'Otra subida',
    top: (h: string, km: string) => `El punto más alto está a ${h}, en el km ${km}.`,
  },
  en: {
    total: (d: string, g: string) => `${d} with ${g}.`,
    flat: 'The route is almost flat: there is no climb worth naming.',
    climb: (n: string, len: string, grade: string, from: string, to: string, gain: string) => `${n} is ${len} at ${grade} % on average, from km ${from} to ${to}, and gains ${gain}.`,
    main: 'The main climb',
    another: 'Another climb',
    top: (h: string, km: string) => `The highest point is at ${h}, at km ${km}.`,
  },
};

/**
 * The route in sentences, written from the same figures the charts draw
 * (CLAUDE.md 11): what the 3D shows is also there to be read and indexed.
 * Nothing is said that the data does not say.
 */
export function describeRoute(points: readonly ProfilePoint[], locale: Locale = 'ca'): string[] {
  const copy = COPY[locale];
  const summary = summarize(points);
  const n = (value: number, digits: number): string => formatNumber(value, locale, digits);
  const out = [copy.total(formatMeasure(Number(summary.distanceKm.toFixed(2)), 'km', locale), formatMeasure(Math.round(summary.gainM), 'm-gain', locale))];
  const climbs = [...detectClimbs(points)].sort((a, b) => b.gainM - a.gainM);
  if (climbs.length === 0) out.push(copy.flat);
  climbs.slice(0, 2).forEach((c, i) => {
    out.push(copy.climb(i === 0 ? copy.main : copy.another, formatMeasure(Number((c.to - c.from).toFixed(1)), 'km', locale), n(Math.round(c.grade), 0), n(c.from, 1), n(c.to, 1), formatMeasure(Math.round(c.gainM), 'm', locale)));
  });
  out.push(copy.top(formatMeasure(Math.round(summary.highest[1]), 'm', locale), n(summary.highest[0], 1)));
  return out;
}
