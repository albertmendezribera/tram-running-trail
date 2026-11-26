// The two lists of shoes like one (its own ground, the other): one shown at a time, the one the address
// asks for (`?per=road`) or, with nothing asked, that of the shoe's own ground. Both are in the page.
const PARAM = 'per';

for (const root of document.querySelectorAll<HTMLElement>('[data-similar]')) {
  const pick = root.querySelector<HTMLElement>('[data-similar-pick]');
  const lists = [...root.querySelectorAll<HTMLElement>('[data-similar-list]')];
  const radios = [...root.querySelectorAll<HTMLInputElement>(`input[name="${PARAM}"]`)];
  if (!pick || lists.length < 2) continue;
  const first = radios.find((radio) => radio.defaultChecked)?.value ?? lists[0]!.dataset['similarList']!;
  const show = (ground: string): void => {
    for (const list of lists) list.hidden = list.dataset['similarList'] !== ground;
    for (const radio of radios) radio.checked = radio.value === ground;
  };
  const asked = new URLSearchParams(location.search).get(PARAM);
  show(lists.some((list) => list.dataset['similarList'] === asked) ? asked! : first);
  for (const radio of radios)
    radio.addEventListener('change', () => {
      show(radio.value);
      const params = new URLSearchParams(location.search);
      if (radio.value === first) params.delete(PARAM);
      else params.set(PARAM, radio.value);
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    });
  pick.dataset['ready'] = '';
}
