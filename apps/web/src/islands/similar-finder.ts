// «Ja en tens una que et va bé?»: leads to the page of the shoe chosen, at its list of shoes like it,
// with the ground asked for in the address. Nothing is reckoned here: the lists are on that page.
for (const form of document.querySelectorAll<HTMLFormElement>('[data-alike-finder]')) {
  const mine = form.elements.namedItem('meva') as HTMLSelectElement;
  const status = form.querySelector<HTMLElement>('[data-alike-status]');
  mine.addEventListener('change', () => {
    if (status) status.textContent = '';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!mine.value) {
      if (status) status.textContent = 'Tria primer la teva sabatilla.';
      mine.focus();
      return;
    }
    const per = (form.elements.namedItem('per') as RadioNodeList).value;
    location.href = `/ca/sabatilles/${mine.value}/?per=${per}#semblants`;
  });
  form.dataset['ready'] = '';
}
