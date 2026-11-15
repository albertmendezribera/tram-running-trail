// The filters of the calendar: they hide the races the choices leave out. The list is already in the page,
// and so is the index they work over; nothing is fetched. The choices are kept in the address, so a
// filtered calendar can be linked to.
type Entry = [type: string, bands: string[], comarca: string];
const FIELDS = ['tipus', 'distancia', 'comarca'] as const;

for (const form of document.querySelectorAll<HTMLFormElement>('[data-calendar-filter]')) {
  const index = JSON.parse(form.querySelector('script[type="application/json"]')!.textContent!) as Record<string, Entry>;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const total = Number(form.dataset['total']);
  const rows = [...document.querySelectorAll<HTMLElement>('[data-race]')];
  const field = (name: string): HTMLSelectElement => form.elements.namedItem(name) as HTMLSelectElement;

  const apply = (): void => {
    const [type, band, comarca] = FIELDS.map((name) => field(name).value);
    const shown = new Set<string>();
    for (const row of rows) {
      const entry = index[row.dataset['race']!];
      const keep = Boolean(entry) && (!type || entry![0] === type) && (!band || entry![1].includes(band)) && (!comarca || entry![2] === comarca);
      row.hidden = !keep;
      if (keep) shown.add(row.dataset['race']!);
    }
    // A month with nothing left in it goes too, and so does its link.
    for (const month of document.querySelectorAll<HTMLElement>('[data-month]')) {
      month.hidden = !month.querySelector('[data-race]:not([hidden])');
      for (const link of document.querySelectorAll<HTMLElement>(`a[href="#${month.id}"]`)) link.hidden = month.hidden;
    }
    for (const list of document.querySelectorAll<HTMLElement>('[data-calendar-list]')) list.hidden = !list.querySelector('[data-race]:not([hidden])');
    const filtered = Boolean(type || band || comarca);
    status.textContent = !filtered ? `${total} proves.` : shown.size ? `${shown.size} de ${total} proves.` : 'Cap prova amb aquests filtres.';
    form.dataset['shown'] = String(shown.size);
    const params = new URLSearchParams(location.search);
    for (const name of FIELDS) field(name).value ? params.set(name, field(name).value) : params.delete(name);
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
  };

  // The address may already carry choices: a link to a filtered calendar.
  const asked = new URLSearchParams(location.search);
  for (const name of FIELDS) {
    const value = asked.get(name);
    if (value && [...field(name).options].some((option) => option.value === value)) field(name).value = value;
  }
  form.addEventListener('change', apply);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.querySelector('[data-reset]')?.closest('button')?.addEventListener('click', () => {
    for (const name of FIELDS) field(name).value = '';
    apply();
  });
  form.dataset['ready'] = '';
  apply();
}
