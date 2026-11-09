export type Locale = 'ca' | 'es' | 'en';

export type Unit = 'km' | 'm' | 'm-gain' | 'pace' | 'duration' | 'vertical-speed' | 'km-effort' | 'g' | 'mm';

/** Shown in place of a value that is missing. A missing value is never estimated. */
export const ABSENT = '—';

const NBSP = ' ';

const ABSENT_LABEL: Record<Locale, string> = { ca: 'Sense dada', es: 'Sin dato', en: 'No data' };
const KM_EFFORT: Record<Locale, string> = { ca: 'km-esforç', es: 'km-esfuerzo', en: 'km-effort' };

export const absentLabel = (locale: Locale): string => ABSENT_LABEL[locale];

const number = (value: number, locale: Locale, maxDecimals: number): string =>
  new Intl.NumberFormat(locale, { useGrouping: 'always', maximumFractionDigits: maxDecimals }).format(value);

/** A bare figure for axes and legends, where the unit is stated once. */
export const formatNumber = (value: number, locale: Locale, maxDecimals = 1): string => number(value, locale, maxDecimals);

const pad = (n: number): string => String(n).padStart(2, '0');

function clock(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

function pace(secondsPerKm: number): string {
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${pad(s % 60)}${NBSP}/km`;
}

/**
 * Formats a measure for display. `pace` takes seconds per km and `duration` seconds;
 * every other unit takes the value in that unit.
 */
export function formatMeasure(value: number | null | undefined, unit: Unit, locale: Locale): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ABSENT;
  switch (unit) {
    case 'km':
      return `${number(value, locale, 3)}${NBSP}km`;
    case 'm':
      return `${number(value, locale, 0)}${NBSP}m`;
    case 'm-gain':
      return `${number(value, locale, 0)}${NBSP}m${NBSP}D+`;
    case 'pace':
      return pace(value);
    case 'duration':
      return clock(value);
    case 'vertical-speed':
      return `${number(value, locale, 0)}${NBSP}m/h`;
    case 'km-effort':
      return `${number(value, locale, 1)}${NBSP}${KM_EFFORT[locale]}`;
    case 'g':
      return `${number(value, locale, 0)}${NBSP}g`;
    case 'mm':
      return `${number(value, locale, 1)}${NBSP}mm`;
  }
}
