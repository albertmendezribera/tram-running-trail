// The filters of the catalogue of shoes and the choice of its map. The list and both maps are already in
// the page: the filters hide the rows and the points the choices leave out, and the choice of map shows
// one map at a time. Nothing is fetched. What is chosen is kept in the address, so it can be linked to.
const CHOICES = ['marca', 'terreny'] as const;
const MAP = 'mapa';

/** Writes a choice in the address, or takes it out when it is the one a page opens with. */
const remember = (name: string, value: string): void => {
  const params = new URLSearchParams(location.search);
  if (value) params.set(name, value);
  else params.delete(name);
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
};

for (const form of document.querySelectorAll<HTMLFormElement>('[data-catalog-filter]')) {
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const total = Number(form.dataset['total']);
  const rows = [...document.querySelectorAll<HTMLElement>('[data-shoe]')];
  // A select and a group of radios both tell what is chosen by `value`.
  const field = (name: string): { value: string } => form.elements.namedItem(name) as unknown as { value: string };
  // Choosing is not alike: a group of radios does not take an empty value, so its radio is checked itself.
  const choose = (name: string, value: string): void => {
    const radios = form.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${name}"]`);
    if (radios.length) for (const radio of radios) radio.checked = radio.value === value;
    else field(name).value = value;
  };

  const apply = (): void => {
    const [brand, ground] = CHOICES.map((name) => field(name).value);
    const kept = new Set<string>();
    for (const row of rows) {
      const keep = (!brand || row.dataset['brand'] === brand) && (!ground || row.dataset['terrain'] === ground);
      row.hidden = !keep;
      if (keep) kept.add(row.dataset['shoe']!);
    }
    // A maker with no model left goes too, title and all.
    for (const maker of document.querySelectorAll<HTMLElement>('[data-maker]')) maker.hidden = !maker.querySelector('[data-shoe]:not([hidden])');
    // And on each map, the points of what is left out; the map says how many it still places.
    for (const point of document.querySelectorAll<HTMLElement>('[data-point]')) point.hidden = !kept.has(point.dataset['point']!);
    for (const view of document.querySelectorAll<HTMLElement>('[data-map-view]')) {
      const count = view.querySelector<HTMLElement>('[data-map-count]');
      if (count) count.textContent = String(view.querySelectorAll('[data-point]:not([hidden])').length);
    }
    status.textContent = !(brand || ground) ? `${total} models.` : kept.size ? `${kept.size} de ${total} models.` : 'Cap model amb aquests filtres.';
    form.dataset['shown'] = String(kept.size);
    for (const name of CHOICES) remember(name, field(name).value);
  };

  // The address may already carry choices: a link to a filtered catalogue. A choice the page does not offer is left out.
  const linked = new URLSearchParams(location.search);
  for (const name of CHOICES) {
    const value = linked.get(name);
    if (value && form.querySelector(`[name="${name}"] option[value="${CSS.escape(value)}"], input[name="${name}"][value="${CSS.escape(value)}"]`)) choose(name, value);
  }
  form.addEventListener('change', apply);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.querySelector('[data-reset]')?.closest('button')?.addEventListener('click', () => {
    for (const name of CHOICES) choose(name, '');
    apply();
  });
  form.dataset['ready'] = '';
  apply();
}

for (const maps of document.querySelectorAll<HTMLElement>('[data-catalog-maps]')) {
  const views = [...maps.querySelectorAll<HTMLElement>('[data-map-view]')];
  const radios = [...maps.querySelectorAll<HTMLInputElement>(`input[name="${MAP}"]`)];
  const first = views[0]?.dataset['mapView'] ?? '';
  const show = (key: string): void => {
    for (const view of views) view.hidden = view.dataset['mapView'] !== key;
    for (const radio of radios) radio.checked = radio.value === key;
  };
  const linked = new URLSearchParams(location.search).get(MAP);
  show(views.some((view) => view.dataset['mapView'] === linked) ? linked! : first);
  for (const radio of radios)
    radio.addEventListener('change', () => {
      show(radio.value);
      remember(MAP, radio.value === first ? '' : radio.value);
    });
  maps.dataset['ready'] = '';
}
