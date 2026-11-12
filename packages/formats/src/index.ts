export type Locale = 'ca' | 'es' | 'en';

export type Unit = 'km' | 'm' | 'm-gain' | 'pace' | 'duration' | 'vertical-speed' | 'km-effort' | 'g' | 'mm';

/** Shown in place of a value that is missing. A missing value is never estimated. */
export const ABSENT = '—';

const NBSP = ' ';

const ABSENT_LABEL: Record<Locale, string> = { ca: 'Sense dada', es: 'Sin dato', en: 'No data' };
const KM_EFFORT: Record<Locale, string> = { ca: 'km-esforç', es: 'km-esfuerzo', en: 'km-effort' };

export const absentLabel = (locale: Locale): string => ABSENT_LABEL[locale];

const number = (value: number, locale: Locale, maxDecimals: number, minDecimals = 0): string =>
  new Intl.NumberFormat(locale, { useGrouping: 'always', maximumFractionDigits: maxDecimals, minimumFractionDigits: minDecimals }).format(value);

/** A bare figure for axes and legends, where the unit is stated once. */
export const formatNumber = (value: number, locale: Locale, maxDecimals = 1, minDecimals = 0): string =>
  number(value, locale, maxDecimals, Math.min(minDecimals, maxDecimals));

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

/**
 * A difference with its sign, e.g. "+1,7 mm" or "−2 mm" (a true minus, not a hyphen).
 * Zero is "0 mm": no sign. Absent when either side of the difference is unknown.
 */
export function formatDelta(delta: number | null | undefined, unit: Unit, locale: Locale): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return ABSENT;
  const magnitude = formatMeasure(Math.abs(delta), unit, locale);
  // Rounded to nothing, a difference has no direction.
  if (magnitude === formatMeasure(0, unit, locale)) return magnitude;
  return `${delta > 0 ? '+' : '−'}${magnitude}`;
}

/**
 * A calendar date in words, e.g. "14 de març del 2027". Takes an ISO date
 * (`2027-03-14`) and reads it as that day everywhere: no time zone can move it.
 */
export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ABSENT;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}
