// Why a shoe is like another, in a few words a row can carry: what is alike first, then what differs.
// The words are made from the gaps of `similar-keys`, so a page and a browser say the same of a pair.
import { formatMeasure } from '@tram/formats';
import type { Gap, Match, Support } from './similar-keys';

export const CLOSENESS: Record<Match<unknown>['closeness'], string> = { close: 'Molt semblant', near: 'Semblant', loose: 'Propera' };

/** Under this share of a clear difference, two figures are said to be the same. */
const SAME = 0.34;
const mm = (value: number): string => formatMeasure(Math.abs(value), 'mm', 'ca');
const g = (value: number): string => formatMeasure(Math.abs(value), 'g', 'ca');

interface Said {
  alike: boolean;
  text: string;
}

/**
 * What to say of one gap. Across grounds the weight and the height of the sole are places on their own
 * ground, not figures side by side, so they are said in words; the list they are in says how they were compared.
 */
function say(gap: Gap, across: boolean, support: Support | null): Said | null {
  const more = gap.by > 0;
  const alike = gap.steps < SAME;
  const little = gap.steps < 1 ? 'una mica ' : '';
  switch (gap.part) {
    case 'drop':
      return Math.abs(gap.by) < 0.5 ? { alike: true, text: 'mateix drop' } : { alike, text: `${mm(gap.by)} ${more ? 'més' : 'menys'} de drop` };
    case 'heel':
      if (across) return alike ? { alike, text: 'sola equivalent' } : { alike, text: `sola ${little}${more ? 'més alta' : 'més baixa'}` };
      return Math.abs(gap.by) < 0.5 ? { alike: true, text: 'mateixa alçada al taló' } : { alike, text: `${mm(gap.by)} ${more ? 'més' : 'menys'} de taló` };
    case 'weight':
      if (across) return alike ? { alike, text: 'pes equivalent' } : { alike, text: `${little}${more ? 'més pesant' : 'més lleugera'}` };
      return Math.abs(gap.by) < 5 ? { alike: true, text: 'mateix pes' } : { alike, text: `${g(gap.by)} ${more ? 'més' : 'menys'}` };
    case 'lugs':
      return Math.abs(gap.by) < 0.5 ? { alike: true, text: 'mateixos tacs' } : { alike, text: `tacs ${mm(gap.by)} ${more ? 'més profunds' : 'més curts'}` };
    case 'support':
      if (support === null) return null;
      return gap.steps === 0 ? { alike: true, text: support === 'neutral' ? 'també neutra' : 'també amb suport' } : { alike: false, text: support === 'neutral' ? 'però neutra' : 'però amb suport' };
    case 'use':
      return gap.steps === 0 ? { alike: true, text: 'per al mateix ús' } : gap.steps === 1 ? { alike: false, text: 'per a un altre ús' } : null;
    // The front height follows from the heel and the drop, and a plate is on the row's own page: neither adds to the line.
    default:
      return null;
  }
}

/** The line under the name of a shoe offered as like another. `support` is that of the shoe offered. */
export function noteOf(match: Pick<Match<unknown>, 'gaps' | 'closeness'>, across: boolean, support: Support | null): string {
  const said = match.gaps.flatMap((gap) => say(gap, across, support) ?? []);
  const parts = [...said.filter((part) => part.alike), ...said.filter((part) => !part.alike)].map((part) => part.text);
  return `${CLOSENESS[match.closeness]}: ${parts.join(' · ')}`;
}
