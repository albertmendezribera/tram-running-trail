// The parts of a long list that open and shut (`Fold`). Whether a part is shut is written on the part
// itself (`data-folded`) and decided by the styles: `narrow` is shut only on a phone, `always` at every
// width, and without it the part is open. This script only changes that word when its heading is
// pressed, opens a part that is jumped to, and keeps the heading's `aria-expanded` saying what is so.

// The styles shut a part only where a script can open it again.
document.documentElement.dataset['js'] = '';

const bodyOf = (fold: Element): HTMLElement | null => fold.querySelector<HTMLElement>(':scope > [data-fold-body]');
const isOpen = (fold: Element): boolean => {
  const body = bodyOf(fold);
  return Boolean(body) && getComputedStyle(body!).display !== 'none';
};
const tell = (fold: Element): void => fold.querySelector('[data-fold-toggle]')?.setAttribute('aria-expanded', String(isOpen(fold)));
const tellAll = (): void => document.querySelectorAll('[data-fold]').forEach(tell);

document.addEventListener('click', (event) => {
  const fold = (event.target as Element).closest('[data-fold-toggle]')?.closest<HTMLElement>('[data-fold]');
  if (!fold) return;
  // Open: shut it at every width. Shut, whatever shut it: open it.
  if (isOpen(fold)) fold.dataset['folded'] = 'always';
  else delete fold.dataset['folded'];
});

// A link to a part, or to something inside one, opens it: nobody lands on a shut door.
const reveal = (): void => {
  let target: Element | null = null;
  try {
    target = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  } catch {
    target = null;
  }
  for (let fold = target?.closest<HTMLElement>('[data-fold]'); fold; fold = fold.parentElement?.closest<HTMLElement>('[data-fold]')) delete fold.dataset['folded'];
  if (target && !isOpen(target.closest('[data-fold]') ?? target)) return;
  target?.scrollIntoView();
};
addEventListener('hashchange', reveal);

// Whatever changes the word (a press, a filter of the page, a jump) or the width of the window, the heading follows.
new MutationObserver((changes) => changes.forEach((change) => tell(change.target as Element))).observe(document.body, { attributes: true, attributeFilter: ['data-folded'], subtree: true });
matchMedia('(width < 48rem)').addEventListener('change', tellAll);
tellAll();
if (location.hash.length > 1) reveal();
