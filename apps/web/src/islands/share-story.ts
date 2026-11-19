// «Comparteix» for the stories of a route. Where the browser can hand a picture to another app (a phone,
// mostly), the button opens the system's own share sheet with the image as a file: Instagram and WhatsApp
// are in it when they are installed. Elsewhere the button is never shown, and «Baixa-la» is the way.
const canShareFiles = (): boolean => {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([], 'tram.png', { type: 'image/png' })] }));
  } catch {
    return false;
  }
};

if (canShareFiles()) {
  for (const block of document.querySelectorAll<HTMLElement>('[data-route-share]')) {
    const status = block.querySelector<HTMLElement>('[data-share-status]');
    const fetched = new Map<string, Promise<File>>();
    // The image is the one the page already shows: it comes from the browser's own store.
    const fileOf = (href: string, name: string): Promise<File> => {
      if (!fetched.has(href)) {
        fetched.set(
          href,
          fetch(href)
            .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
            .then((blob) => new File([blob], name, { type: 'image/png' })),
        );
      }
      return fetched.get(href)!;
    };
    for (const mark of block.querySelectorAll<HTMLElement>('[data-share-story]')) {
      const button = mark.closest('button');
      const holder = mark.closest<HTMLElement>('[data-share]');
      const [href, name] = [mark.dataset['shareStory']!, mark.dataset['file']!];
      if (!button || !holder) continue;
      holder.hidden = false;
      // A share sheet opens only right after a touch: the file is asked for as the finger lands, not when it lifts.
      const early = (): void => void fileOf(href, name).catch(() => fetched.delete(href));
      button.addEventListener('pointerdown', early);
      button.addEventListener('focus', early);
      button.addEventListener('click', async () => {
        if (status) status.textContent = '';
        try {
          await navigator.share({ files: [await fileOf(href, name)], title: block.dataset['title'] ?? '' });
        } catch (error) {
          // Closing the sheet without choosing is not an error.
          if ((error as Error).name === 'AbortError') return;
          fetched.delete(href);
          if (status) status.textContent = 'No s’ha pogut obrir el menú de compartir. Baixa la imatge i puja-la des de la galeria.';
        }
      });
    }
  }
}
