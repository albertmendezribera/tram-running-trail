// The filters of the catalogue of shoes, the choice of its map and the picking of two points to compare. The list and both maps are already in
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
    unfold(Boolean(brand || ground));
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

  // What a point does when it is touched: it leads to its shoe, or it is picked, one of the two to compare.
  // Picked, a point is a button that is pressed, on both maps at once; a third pick takes the place of the first.
  const picks: string[] = [];
  const panel = maps.querySelector<HTMLElement>('[data-pick]');
  const note = maps.querySelector<HTMLElement>('[data-pick-status]');
  const go = maps.querySelector<HTMLElement>('[data-pick-go]');
  const modes = [...maps.querySelectorAll<HTMLInputElement>('input[name="punt"]')];
  const picking = (): boolean => modes.some((mode) => mode.checked && mode.value === 'pick');
  const nameOf = (id: string): string => maps.querySelector<HTMLElement>(`[data-point="${CSS.escape(id)}"]`)?.dataset['label'] ?? id;
  const tell = (): void => {
    for (const point of maps.querySelectorAll<HTMLElement>('[data-point]')) {
      const picked = picks.includes(point.dataset['point']!);
      point.toggleAttribute('data-picked', picked);
      const mark = point.querySelector('a');
      if (!mark) continue;
      if (picking()) {
        mark.setAttribute('role', 'button');
        mark.setAttribute('aria-pressed', String(picked));
      } else {
        mark.removeAttribute('role');
        mark.removeAttribute('aria-pressed');
      }
    }
    if (panel) panel.hidden = !picking();
    if (note) note.textContent = picks.length === 2 ? `${nameOf(picks[0]!)} i ${nameOf(picks[1]!)}.` : picks.length === 1 ? `${nameOf(picks[0]!)}. Toca’n un altre.` : 'Toca dos punts del mapa.';
    if (go) {
      go.hidden = picks.length < 2;
      go.querySelector('a')?.setAttribute('href', `/ca/comparar/?a=${picks[0] ?? ''}&b=${picks[1] ?? ''}`);
    }
  };
  for (const mode of modes)
    mode.addEventListener('change', () => {
      if (!picking()) picks.length = 0;
      tell();
    });
  maps.addEventListener('click', (event) => {
    const point = (event.target as Element).closest<HTMLElement>('[data-point]');
    if (!point || !picking() || !(event.target as Element).closest('a')) return;
    event.preventDefault();
    const id = point.dataset['point']!;
    if (picks.includes(id)) picks.splice(picks.indexOf(id), 1);
    else {
      if (picks.length === 2) picks.shift();
      picks.push(id);
    }
    tell();
  });
  tell();
  maps.dataset['ready'] = '';
}
