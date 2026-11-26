// A shoe like one that is not in the catalogue: its figures are written by hand, and the shoes most like
// it are found here, in the browser, with the rule of the pages (`similar-keys`) over the rows the page
// already holds. Nothing is sent anywhere; what is written is kept in the address, so the answer can be linked to.
import { comparable, type Ground, type Likeness, similarTo, type Support, type Use, usualOf } from '../content/similar-keys';
import { noteOf } from '../content/similar-words';

/** How many shoes are offered. */
const MOST = 8;
/** What can be written, the name of each field and the figures a shoe may have: outside them it is taken for a slip. */
const FIGURES = [
  { name: 'drop', key: 'dropMm', least: 0, most: 16, said: 'El drop' },
  { name: 'pes', key: 'weightG', least: 100, most: 500, said: 'El pes' },
  { name: 'talo', key: 'stackHeelMm', least: 8, most: 60, said: 'L’alçada al taló' },
  { name: 'avantpeu', key: 'stackForefootMm', least: 5, most: 55, said: 'L’alçada a l’avantpeu' },
] as const;
const KEPT = ['terreny', 'drop', 'pes', 'talo', 'avantpeu', 'trepitjada', 'per'] as const;
const OF: Record<Ground, string> = { road: 'd’asfalt', trail: 'de muntanya' };

const number = (raw: string | undefined): number | null => (raw === undefined || raw === '' ? null : Number(raw));

for (const root of document.querySelectorAll<HTMLElement>('[data-alike-hand]')) {
  const form = root.querySelector<HTMLFormElement>('[data-hand-form]')!;
  const status = root.querySelector<HTMLElement>('[data-hand-status]')!;
  const found = root.querySelector<HTMLElement>('[data-hand-found]')!;
  const ranked = root.querySelector<HTMLElement>('[data-ranked]')!;
  const grouped = root.querySelector<HTMLElement>('[data-grouped]')!;
  const rows = [...root.querySelectorAll<HTMLElement>('[data-shoe]')];
  type Entry = Likeness & { row: HTMLElement };
  const entries: Entry[] = rows.map((row) => ({
    row,
    terrain: row.dataset['terrain'] as Ground,
    weightG: number(row.dataset['weight']),
    stackHeelMm: number(row.dataset['heel']),
    stackForefootMm: number(row.dataset['forefoot']),
    dropMm: number(row.dataset['drop']),
    lugDepthMm: number(row.dataset['lugs']),
    plate: row.dataset['plate'] ?? null,
    support: (row.dataset['support'] as Support | undefined) ?? null,
    use: (row.dataset['use']?.split(' ') ?? []) as Use[],
  }));
  const usual = usualOf(entries);
  // Every row waits in the one list, out of sight, until it is one of the answer.
  ranked.append(...rows);
  for (const row of rows) row.hidden = true;
  ranked.hidden = false;
  grouped.hidden = true;

  const field = (name: string): { value: string } => form.elements.namedItem(name) as unknown as { value: string };

  const answer = (): void => {
    const slips: string[] = [];
    const figures = Object.fromEntries(
      FIGURES.map(({ name, key, least, most, said }) => {
        const written = field(name).value.trim().replace(',', '.');
        const value = written === '' ? null : Number(written);
        if (value !== null && !(value >= least && value <= most)) {
          slips.push(`${said} ha de ser entre ${least} i ${most}.`);
          return [key, null];
        }
        return [key, value];
      }),
    ) as Record<(typeof FIGURES)[number]['key'], number | null>;
    const mine: Likeness = { terrain: field('terreny').value as Ground, ...figures, lugDepthMm: null, plate: null, support: (field('trepitjada').value || null) as Support | null, use: [] };
    const ground = field('per').value as Ground;
    for (const row of rows) row.hidden = true;
    found.hidden = true;
    if (slips.length > 0) {
      status.textContent = slips.join(' ');
      return;
    }
    if (!comparable(mine)) {
      status.textContent = 'Posa’n dues xifres com a mínim: el drop i el pes, per exemple.';
      return;
    }
    const matches = similarTo(mine, entries, ground, usual, MOST);
    matches.forEach((match, index) => {
      const { row } = match.shoe;
      const note = row.querySelector<HTMLElement>('[data-row-note]');
      if (note) note.textContent = noteOf(match, ground !== mine.terrain, match.shoe.support);
      const rank = row.querySelector<HTMLElement>('[data-rank]');
      if (rank) {
        rank.textContent = String(index + 1);
        rank.hidden = false;
      }
      row.hidden = false;
    });
    ranked.append(...matches.map((match) => match.shoe.row));
    found.hidden = matches.length === 0;
    status.textContent = matches.length === 0 ? `Cap model ${OF[ground]} del catàleg s’hi assembla prou per dir-ne semblant.` : matches.length === 1 ? `El model ${OF[ground]} que més s’hi assembla.` : `Els ${matches.length} models ${OF[ground]} que més s’hi assemblen, el més semblant primer.`;
    form.dataset['shown'] = String(matches.length);
    const params = new URLSearchParams();
    for (const name of KEPT) if (field(name).value.trim()) params.set(name, field(name).value.trim());
    history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`);
  };

  // An address may carry a shoe already written: a link to an answer.
  const linked = new URLSearchParams(location.search);
  for (const name of KEPT) {
    const value = linked.get(name);
    if (value === null) continue;
    const radios = form.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`);
    if (radios.length) for (const radio of radios) radio.checked = radio.value === value;
    else if ([...FIGURES.map((figure) => figure.name), 'trepitjada'].includes(name)) field(name).value = value.slice(0, 12);
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    answer();
  });
  // Once there is an answer, changing what was asked gives the new one at once.
  form.addEventListener('change', () => {
    if (form.dataset['shown'] !== undefined) answer();
  });
  root.dataset['ready'] = '';
  if (FIGURES.some(({ name }) => linked.has(name))) answer();
}
