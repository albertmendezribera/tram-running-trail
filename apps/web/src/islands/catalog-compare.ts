// The comparator of the catalogue: any two shoes, chosen in two fields or brought in the address. The
// page already holds the table, every sole and a card to each shoe; this shows the two chosen and fills
// the table with their figures. Nothing is fetched and nothing is drawn here.
import { fillSpecDiff } from '@tram/design-system/patterns/spec-diff.ts';

interface Entry {
  name: string;
  maker: string;
  weight: number | null;
  size: string | null;
  heel: number | null;
  forefoot: number | null;
  drop: number | null;
  lugs: number | null;
  drawn: boolean;
}
const SIDES = ['a', 'b'] as const;

for (const root of document.querySelectorAll<HTMLElement>('[data-catalog-compare]')) {
  const index = JSON.parse(root.querySelector('script[type="application/json"]')!.textContent!) as Record<string, Entry>;
  const form = root.querySelector<HTMLFormElement>('[data-compare-choice]')!;
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const field = (side: (typeof SIDES)[number]): HTMLSelectElement => form.elements.namedItem(side) as HTMLSelectElement;
  const one = <T extends Element = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
  const [result, prompt] = [one('[data-compare-result]'), one('[data-compare-prompt]')];
  const title = document.title;

  const apply = (): void => {
    const [a, b] = SIDES.map((side) => field(side).value);
    const params = new URLSearchParams(location.search);
    for (const side of SIDES) {
      if (field(side).value) params.set(side, field(side).value);
      else params.delete(side);
    }
    // The pair is written as it reads, with its slashes: a link to a comparison is meant to be read.
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${decodeURIComponent(params.toString())}` : ''}`);
    const [first, second] = [index[a ?? ''], index[b ?? '']];
    const ready = Boolean(first && second && a !== b);
    result.hidden = !ready;
    prompt.hidden = ready;
    form.dataset['chosen'] = ready ? `${a} ${b}` : '';
    document.title = ready ? `${first!.name} vs ${second!.name} · ${title}` : title;
    if (!first || !second || a === b) {
      status.textContent = first && second ? 'Tria dos models diferents.' : first || second ? 'Tria l’altre model.' : 'Tria dos models.';
      return;
    }
    status.textContent = `${first.name} i ${second.name}.`;
    one('[data-pair]').textContent = `${first.name} vs ${second.name}`;
    fillSpecDiff(
      one('[data-spec-diff]'),
      { a: first.name, b: second.name, caption: `El que declaren les marques de ${first.name} i de ${second.name}`, hint: `La diferència és ${second.name} menys ${first.name}.` },
      Object.fromEntries((['weight', 'heel', 'forefoot', 'drop', 'lugs'] as const).map((key) => [key, { a: first[key], b: second[key] }])),
    );
    // Each of the two soles is told which it is; the others stay as they were, not drawn.
    for (const sole of document.querySelectorAll('[data-sole]')) {
      const side = sole.getAttribute('data-sole') === a ? 'a' : sole.getAttribute('data-sole') === b ? 'b' : null;
      sole.toggleAttribute('hidden', !side);
      if (side) sole.setAttribute('data-shoe', side);
      else sole.removeAttribute('data-shoe');
    }
    const undrawn = [first, second].filter((entry) => !entry.drawn).map((entry) => entry.name);
    one('[data-soles]').hidden = undrawn.length > 0;
    one('[data-soles-none]').hidden = undrawn.length === 0;
    one('[data-soles-why]').textContent = undrawn.length === 2 ? `Cap de les dues marques declara les dues alçades (${undrawn.join(' i ')}).` : undrawn.length ? `La marca de ${undrawn[0]} no en declara les dues alçades.` : '';
    for (const card of document.querySelectorAll<HTMLElement>('[data-card]')) {
      const side = card.dataset['card'] === a ? 'a' : card.dataset['card'] === b ? 'b' : null;
      card.hidden = !side;
      if (side) card.dataset['side'] = side;
      else delete card.dataset['side'];
    }
    // Where the two figures were not taken alike, the page says so next to the difference.
    const sizes = first.weight !== null && second.weight !== null && first.size !== second.size;
    one('[data-caveat="weight"]').hidden = !sizes;
    one('[data-caveat-text]').textContent = sizes ? `Els dos pesos no es van prendre igual. ${first.name}: ${first.size}. ${second.name}: ${second.size}. La diferència de pes ho arrossega.` : '';
    const heights = first.maker !== second.maker && ((first.heel !== null && second.heel !== null) || (first.forefoot !== null && second.forefoot !== null));
    one('[data-caveat="height"]').hidden = !heights;
  };

  // The address may bring the pair: a link to a comparison, or one model sent from its page or from the map.
  const linked = new URLSearchParams(location.search);
  for (const side of SIDES) if (index[linked.get(side) ?? '']) field(side).value = linked.get(side)!;
  form.addEventListener('change', apply);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.querySelector('[data-swap]')?.closest('button')?.addEventListener('click', () => {
    [field('a').value, field('b').value] = [field('b').value, field('a').value];
    apply();
  });
  form.dataset['ready'] = '';
  apply();
}
