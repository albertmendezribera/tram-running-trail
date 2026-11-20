// What SpecDiff shows of two figures, and how a table of it already in a page is filled with another
// pair: a page that compares any two of many models draws the table once, and a script of its own
// calls `fillSpecDiff` when two are chosen. The reckoning is one and the same for both.
import { formatDelta, formatMeasureParts, type Locale, type Unit } from '@tram/formats';

export interface Diff {
  /** The second figure less the first. Null when either is not known: a difference is never taken against a guess. */
  delta: number | null;
  /** The difference with its sign and its unit. */
  text: string;
  /** How far the bar reaches, as a share of the larger of the two figures. */
  share: number;
  sign: 'none' | 'more' | 'less' | 'same';
}

export function diffOf(a: number | null | undefined, b: number | null | undefined, unit: Unit, locale: Locale): Diff {
  const delta = a == null || b == null ? null : Number((b - a).toFixed(1));
  const scale = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0), 1);
  return {
    delta,
    text: formatDelta(delta, unit, locale),
    share: delta === null ? 0 : Number(Math.min(1, Math.abs(delta) / scale).toFixed(3)),
    sign: delta === null ? 'none' : delta > 0 ? 'more' : delta < 0 ? 'less' : 'same',
  };
}

export interface FillRow {
  a: number | null;
  b: number | null;
}

/**
 * Fills a SpecDiff drawn with `fillable`: the names of the two models and, row by row, their figures
 * and the difference. Rows are found by their `key`; one that is not given is shown as not known.
 */
export function fillSpecDiff(root: Element, names: { a: string; b: string; caption: string; hint: string }, rows: Readonly<Record<string, FillRow>>, locale: Locale = 'ca'): void {
  for (const side of ['a', 'b'] as const) for (const name of root.querySelectorAll(`[data-name="${side}"]`)) name.textContent = names[side];
  for (const caption of root.querySelectorAll('[data-caption]')) caption.textContent = names.caption;
  for (const hint of root.querySelectorAll('[data-hint]')) hint.textContent = names.hint;
  for (const row of root.querySelectorAll<HTMLElement>('[data-row]')) {
    const unit = row.dataset['unit'] as Unit;
    const values = rows[row.dataset['row']!] ?? { a: null, b: null };
    for (const side of ['a', 'b'] as const) {
      const cell = row.querySelector(`[data-cell="${side}"]`)!;
      const parts = formatMeasureParts(values[side], unit, locale);
      cell.querySelector<HTMLElement>('[data-known]')!.hidden = parts === null;
      cell.querySelector<HTMLElement>('[data-unknown]')!.hidden = parts !== null;
      if (parts === null) continue;
      const data = cell.querySelector('[data-known] data')!;
      data.setAttribute('value', String(values[side]));
      data.querySelector('.value')!.textContent = parts.value;
    }
    const diff = diffOf(values.a, values.b, unit, locale);
    const cell = row.querySelector<HTMLElement>('[data-cell="delta"]')!;
    cell.dataset['sign'] = diff.sign;
    cell.querySelector<HTMLElement>('[data-known]')!.hidden = diff.delta === null;
    cell.querySelector<HTMLElement>('[data-unknown]')!.hidden = diff.delta !== null;
    const figure = cell.querySelector('[data-known] data')!;
    figure.setAttribute('value', String(diff.delta ?? ''));
    figure.textContent = diff.text;
    cell.querySelector<HTMLElement>('[data-known] i')!.style.inlineSize = `${diff.share * 50}%`;
  }
}
