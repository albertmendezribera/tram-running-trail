// The search and the filters of the calendar: they hide the races the choices leave out. The list is
// already in the page, and so is the index they work over; nothing is fetched. The choices are kept in
// the address, so a filtered calendar can be linked to.
import { found } from '../content/search-text';

type Entry = [type: string, bands: string[], comarca: string, text: string];
const SEARCH = 'cerca';
const CHOICES = ['tipus', 'distancia', 'comarca'] as const;
const FIELDS = [SEARCH, ...CHOICES] as const;
/** How long the address waits for the typing to stop: a browser allows only so many changes of it a minute. */
const ADDRESS_WAIT_MS = 200;

/**
 * The parts of the list that can be shut (`Fold`). While a filter or a search is on, every part with
 * something left in it is opened: what was asked for is not left behind a shut door. With nothing asked,
 * each part goes back to how the page set it.
 */
const folds = [...document.querySelectorAll<HTMLElement>('[data-fold]')].map((fold) => ({ fold, set: fold.dataset['folded'] }));
let unfolded = false;
const unfold = (asking: boolean): void => {
  if (asking === unfolded) return;
  unfolded = asking;
  for (const { fold, set } of folds) {
    if (asking || set === undefined) delete fold.dataset['folded'];
    else fold.dataset['folded'] = set;
  }
};

for (const form of document.querySelectorAll<HTMLFormElement>('[data-calendar-filter]')) {
  const index = JSON.parse(form.querySelector('script[type="application/json"]')!.textContent!) as Record<string, Entry>;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const total = Number(form.dataset['total']);
  const rows = [...document.querySelectorAll<HTMLElement>('[data-race]')];
  const field = (name: string): HTMLSelectElement | HTMLInputElement => form.elements.namedItem(name) as HTMLSelectElement | HTMLInputElement;

  let waiting: ReturnType<typeof setTimeout> | undefined;
  const remember = (): void => {
    const params = new URLSearchParams(location.search);
    for (const name of FIELDS) {
      const value = field(name).value.trim();
      if (value) params.set(name, value);
      else params.delete(name);
    }
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  };

  const apply = (): void => {
    const asked = field(SEARCH).value;
    const [type, band, comarca] = CHOICES.map((name) => field(name).value);
    const shown = new Set<string>();
    for (const row of rows) {
      const entry = index[row.dataset['race']!];
      const keep = Boolean(entry) && (!type || entry![0] === type) && (!band || entry![1].includes(band)) && (!comarca || entry![2] === comarca) && found(entry![3], asked);
      row.hidden = !keep;
      if (keep) shown.add(row.dataset['race']!);
    }
    // A month with nothing left in it goes too, and so does its link.
    for (const month of document.querySelectorAll<HTMLElement>('[data-month]')) {
      month.hidden = !month.querySelector('[data-race]:not([hidden])');
      for (const link of document.querySelectorAll<HTMLElement>(`a[href="#${month.id}"]`)) link.hidden = month.hidden;
    }
    // And a part of the calendar with nothing left, title and all: «Properes», or «Ja disputades».
    for (const list of document.querySelectorAll<HTMLElement>('[data-calendar-list]')) list.hidden = !list.querySelector('[data-race]:not([hidden])');
    const [searched, chosen] = [Boolean(asked.trim()), Boolean(type || band || comarca)];
    unfold(searched || chosen);
    const none = searched && chosen ? 'Cap prova amb aquesta cerca i aquests filtres.' : searched ? 'Cap prova amb aquesta cerca.' : 'Cap prova amb aquests filtres.';
    status.textContent = !(searched || chosen) ? `${total} proves.` : shown.size ? `${shown.size} de ${total} proves.` : none;
    form.dataset['shown'] = String(shown.size);
    clearTimeout(waiting);
    waiting = setTimeout(remember, ADDRESS_WAIT_MS);
  };

  // The address may already carry choices: a link to a filtered calendar.
  const linked = new URLSearchParams(location.search);
  for (const name of CHOICES) {
    const value = linked.get(name);
    const select = field(name) as HTMLSelectElement;
    if (value && [...select.options].some((option) => option.value === value)) select.value = value;
  }
  field(SEARCH).value = linked.get(SEARCH) ?? '';
  // A choice is made at once; what is typed is searched letter by letter. Emptying the field with the browser's own cross is an `input` too.
  form.addEventListener('change', apply);
  field(SEARCH).addEventListener('input', apply);
  // The «search» key of a phone's keyboard has nothing left to do but put the keyboard away.
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    field(SEARCH).blur();
  });
  form.querySelector('[data-reset]')?.closest('button')?.addEventListener('click', () => {
    for (const name of FIELDS) field(name).value = '';
    apply();
  });
  form.dataset['ready'] = '';
  apply();
}
