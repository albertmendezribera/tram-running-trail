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
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

export interface MeasureParts {
  value: string;
  /** Empty when the unit is implicit, as in a duration. */
  unit: string;
}

/** The figure and its unit apart, so that a display can set them at different sizes. Null when absent. */
export function formatMeasureParts(value: number | null | undefined, unit: Unit, locale: Locale): MeasureParts | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  switch (unit) {
    case 'km':
      return { value: number(value, locale, 3), unit: 'km' };
    case 'm':
      return { value: number(value, locale, 0), unit: 'm' };
    case 'm-gain':
      return { value: number(value, locale, 0), unit: `m${NBSP}D+` };
    case 'pace':
      return { value: pace(value), unit: '/km' };
    case 'duration':
      return { value: clock(value), unit: '' };
    case 'vertical-speed':
      return { value: number(value, locale, 0), unit: 'm/h' };
    case 'km-effort':
      return { value: number(value, locale, 1), unit: KM_EFFORT[locale] };
    case 'g':
      return { value: number(value, locale, 0), unit: 'g' };
    case 'mm':
      return { value: number(value, locale, 1), unit: 'mm' };
  }
}

/**
 * Formats a measure for display. `pace` takes seconds per km and `duration` seconds;
 * every other unit takes the value in that unit.
 */
export function formatMeasure(value: number | null | undefined, unit: Unit, locale: Locale): string {
  const parts = formatMeasureParts(value, unit, locale);
  if (!parts) return ABSENT;
  return parts.unit ? `${parts.value}${NBSP}${parts.unit}` : parts.value;
}
