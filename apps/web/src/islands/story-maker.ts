// The story maker: a visitor chooses a GPX of their own and the story of that outing is drawn here, in
// their browser. This half only listens; the half that reads the file and draws is asked for when a file
// is chosen (`story-maker/make.ts`). The file is sent nowhere.
import type { Drawn, Prepared } from './story-maker/make';

/** A GPX of a day out weighs a megabyte or two; this is far over any, and keeps a wrong file from being read whole. */
const MOST_BYTES = 40_000_000;

const canShareFiles = (): boolean => {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([], 'tram.png', { type: 'image/png' })] }));
  } catch {
    return false;
  }
};

for (const root of document.querySelectorAll<HTMLElement>('[data-story-maker]')) {
  const form = root.querySelector<HTMLFormElement>('[data-maker-form]')!;
  const status = root.querySelector<HTMLElement>('[data-maker-status]')!;
  const shareStatus = root.querySelector<HTMLElement>('[data-maker-share-status]')!;
  const results = root.querySelector<HTMLElement>('[data-maker-results]')!;
  const empty = root.querySelector<HTMLElement>('[data-maker-empty]')!;
  const file = form.elements.namedItem('gpx') as HTMLInputElement;
  const title = form.elements.namedItem('titol') as HTMLInputElement;
  const place = form.elements.namedItem('lloc') as HTMLInputElement;
  const timed = [...form.querySelectorAll<HTMLInputElement>('input[name="temps"]')];
  const sharing = canShareFiles();

  let prepared: Prepared | undefined;
  let shown: Array<{ address: string; file: File }> = [];
  /** Every choice of file and every change of words is a new attempt: what arrives for an old one is dropped. */
  let attempt = 0;
  const say = (text: string, state: 'idle' | 'busy' | 'ready' | 'error'): void => {
    status.textContent = text;
    root.dataset['state'] = state;
  };
  const wantsTime = (): boolean => timed.some((radio) => radio.checked && radio.value === 'si');

  const show = (drawn: Drawn[], name: string): void => {
    for (const old of shown) URL.revokeObjectURL(old.address);
    shown = drawn.map((story) => {
      const picture = new File([story.blob], `tram-story-${name}${story.suffix}.png`, { type: 'image/png' });
      return { address: URL.createObjectURL(picture), file: picture };
    });
    drawn.forEach((story, i) => {
      const item = results.querySelector<HTMLElement>(`[data-story="${story.theme}"]`);
      if (!item) return;
      const { address, file: picture } = shown[i]!;
      const image = item.querySelector('img')!;
      image.src = address;
      image.alt = story.alt;
      item.querySelector<HTMLAnchorElement>('[data-maker-open]')!.href = address;
      const save = item.querySelector<HTMLAnchorElement>('[data-maker-save] a')!;
      save.href = address;
      save.download = picture.name;
    });
    results.hidden = false;
    empty.hidden = true;
  };

  const render = async (): Promise<void> => {
    if (!prepared) return;
    const mine = ++attempt;
    const { draw } = await import('./story-maker/make');
    const { fileSlug } = await import('../story-maker/card');
    const name = title.value.trim() || 'La meva ruta';
    try {
      const drawn = await draw(prepared, { title: name, place: place.value.trim(), time: wantsTime() });
      if (mine !== attempt) return;
      show(drawn, fileSlug(name));
      const bare = prepared.bare === 'unanswered' ? ' El relleu de l’ICGC no ha arribat: surt sense corbes de nivell.' : prepared.bare === 'outside' ? ' Fora de Catalunya no tenim relleu: surt el traç sense corbes de nivell.' : '';
      say(`A punt: baixa la que vulguis.${bare}`, 'ready');
    } catch (error) {
      // Said in the console too, for whoever looks into why.
      console.error(error);
      if (mine === attempt) say('No s’ha pogut dibuixar la imatge en aquest navegador.', 'error');
    }
  };

  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    const mine = ++attempt;
    prepared = undefined;
    if (chosen.size > MOST_BYTES) return say('Aquest fitxer és massa gros per ser el GPX d’una sortida.', 'error');
    say('Llegint el fitxer…', 'busy');
    try {
      const { prepare } = await import('./story-maker/make');
      const made = await prepare(await chosen.text(), () => mine === attempt && say('Demanant el relleu a l’ICGC…', 'busy'));
      if (mine !== attempt) return;
      prepared = made;
      // The name the file gives the outing, unless one was already written.
      if (!title.value.trim() && made.name) title.value = made.name.slice(0, title.maxLength > 0 ? title.maxLength : 40);
      // A file with no times has no time to tell.
      for (const radio of timed) radio.disabled = made.seconds === null;
      if (made.seconds === null) for (const radio of timed) radio.checked = radio.value === 'no';
      say('Dibuixant…', 'busy');
      await render();
    } catch (error) {
      if (mine !== attempt) return;
      const name = (error as Error).name;
      say(
        name === 'TrackError'
          ? 'Aquest fitxer no és un GPX amb un traç.'
          : name === 'NoHeightsError'
            ? 'El traç no porta alçades i el relleu de l’ICGC no hi arriba: sense alçades no hi ha perfil.'
            : 'No s’ha pogut llegir el fitxer.',
        'error',
      );
    }
  });

  // The words and the choice of telling the time are drawn again as they change, without reading the file again.
  let waiting: ReturnType<typeof setTimeout> | undefined;
  const again = (): void => {
    clearTimeout(waiting);
    waiting = setTimeout(() => void render(), 250);
  };
  title.addEventListener('input', again);
  place.addEventListener('input', again);
  for (const radio of timed) radio.addEventListener('change', again);
  form.addEventListener('submit', (event) => event.preventDefault());

  // Where the browser can hand a picture to another app (a phone, mostly), «Comparteix» opens its share sheet.
  results.querySelectorAll<HTMLElement>('[data-story]').forEach((item, i) => {
    const holder = item.querySelector<HTMLElement>('[data-maker-share]')!;
    if (!sharing) return;
    holder.hidden = false;
    holder.querySelector('button')?.addEventListener('click', async () => {
      const picture = shown[i]?.file;
      if (!picture) return;
      shareStatus.textContent = '';
      try {
        await navigator.share({ files: [picture], title: title.value.trim() });
      } catch (error) {
        // Closing the sheet without choosing is not an error.
        if ((error as Error).name !== 'AbortError') shareStatus.textContent = 'No s’ha pogut obrir el menú de compartir. Baixa la imatge i puja-la des de la galeria.';
      }
    });
  });
  root.dataset['state'] = 'idle';
}
