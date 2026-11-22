type State = 'poster' | 'loading' | 'running' | 'ready' | 'error' | 'absent';

type FullscreenHost = HTMLElement & { webkitRequestFullscreen?: () => void };
type FullscreenDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };

const page = document as FullscreenDocument;
const canFullscreen = (): boolean => Boolean(page.fullscreenEnabled ?? page.webkitFullscreenEnabled);
const fullscreenElement = (): Element | null => page.fullscreenElement ?? page.webkitFullscreenElement ?? null;

/**
 * A program of its own (a game, a simulator) that lives at an address of the site and is heavy: nothing
 * of it is asked for until the visitor presses one of the buttons. Then it runs in a frame over the
 * poster, and «Tanca» takes the frame away, which gives its memory back.
 *
 * The program may tell the page how it is doing: `parent.postMessage({ source, state, detail })`, with
 * `state` `'ready'` or `'error'` and `source` the name given in `data-channel`.
 */
export class TramGameStage extends HTMLElement {
  #frame: HTMLIFrameElement | undefined;
  /** The button that started what is running: where the focus goes back to. */
  #starter: HTMLButtonElement | undefined;
  /** Every start and every close is a new attempt: an answer that arrives for an old one is dropped. */
  #attempt = 0;
  #escapes = false;

  connectedCallback(): void {
    this.addEventListener('click', this.#onClick);
    window.addEventListener('message', this.#onMessage);
    document.addEventListener('fullscreenchange', this.#onFullscreen);
    document.addEventListener('webkitfullscreenchange', this.#onFullscreen);
    if (!canFullscreen()) this.#part('fullscreen').hidden = true;
    this.#prefer();
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#onClick);
    window.removeEventListener('message', this.#onMessage);
    document.removeEventListener('fullscreenchange', this.#onFullscreen);
    document.removeEventListener('webkitfullscreenchange', this.#onFullscreen);
    this.#stop();
  }

  #part(name: string): HTMLElement {
    return this.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
  }

  #button(part: string): HTMLButtonElement | null {
    return this.#part(part).querySelector('button');
  }

  #modes(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[data-mode]')];
  }

  /** The list of what is chosen before starting, where the stage has one. */
  #choice(): HTMLSelectElement | null {
    return this.querySelector<HTMLSelectElement>('[data-part="choice"] select');
  }

  #show(state: State, message: string): void {
    this.dataset['state'] = state;
    this.#part('status').textContent = message;
  }

  /**
   * A link may name a mode (`?mode=ruta`). Nothing starts by itself: a browser gives sound and the
   * pointer only to a page that has been pressed, and the download is heavy. The button of that mode
   * becomes the main one and takes the focus, which also brings it into view. Where a page has several
   * stages, the first one takes it. The link may also name one of the choices of the list (`?lloc=far`),
   * which is then the one selected.
   */
  #prefer(): void {
    const asked = new URLSearchParams(location.search);
    const choice = this.#choice();
    const named = asked.get(this.dataset['choiceParam'] ?? '');
    if (choice && named !== null && [...choice.options].some((option) => option.value === named)) choice.value = named;
    const wanted = asked.get(this.dataset['param'] ?? 'mode');
    const modes = this.#modes();
    const chosen = modes.find((mode) => mode.dataset['mode'] === wanted);
    if (!chosen) return;
    for (const mode of modes) mode.querySelector('button')?.setAttribute('data-variant', mode === chosen ? 'primary' : 'secondary');
    if (!document.activeElement || document.activeElement === document.body) chosen.querySelector('button')?.focus();
  }

  #onClick = (event: MouseEvent): void => {
    const target = event.target as Element;
    const mode = target.closest<HTMLElement>('[data-mode]');
    if (mode && target.closest('button')) void this.#start(mode);
    else if (target.closest('[data-part="close"] button')) this.#close();
    else if (target.closest('[data-part="fullscreen"] button')) this.#toggleFullscreen();
  };

  async #start(mode: HTMLElement): Promise<void> {
    if (this.dataset['state'] !== 'poster') return;
    const attempt = ++this.#attempt;
    const starter = mode.querySelector('button') ?? undefined;
    this.#starter = starter;
    // The bar keeps the height it has now: what is under it does not jump when its buttons change.
    this.style.setProperty('--held', `${this.#part('bar').getBoundingClientRect().height}px`);
    starter?.setAttribute('aria-busy', 'true');
    this.#show('loading', this.dataset['textLoading'] ?? '');

    // A build of the site may come without the program (it is not kept with the code): asked first, with a request that brings nothing back.
    const probe = this.dataset['probe'];
    if (probe) {
      let there: boolean | undefined;
      try {
        there = (await fetch(probe, { method: 'HEAD' })).ok;
      } catch {
        there = undefined;
      }
      if (attempt !== this.#attempt) return;
      starter?.removeAttribute('aria-busy');
      if (there === undefined) {
        this.#show('poster', this.dataset['textOffline'] ?? '');
        return;
      }
      if (!there) {
        this.#show('absent', this.dataset['textAbsent'] ?? '');
        this.#part('status').focus();
        return;
      }
    }
    starter?.removeAttribute('aria-busy');

    const address = new URL(this.dataset['src'] ?? '', location.href);
    address.searchParams.set(this.dataset['param'] ?? 'mode', mode.dataset['mode'] ?? '');
    // What was chosen in the list is told to the program too, in the modes it means something in.
    const choice = this.#choice();
    if (choice && (this.dataset['choiceModes'] ?? '').split(' ').includes(mode.dataset['mode'] ?? '')) {
      const told = (JSON.parse(this.dataset['choices'] ?? '{}') as Record<string, Record<string, string>>)[choice.value] ?? {};
      for (const [name, value] of Object.entries(told)) address.searchParams.set(name, value);
    }
    const frame = document.createElement('iframe');
    frame.title = this.getAttribute('aria-label') ?? '';
    frame.allow = 'fullscreen';
    frame.addEventListener('load', () => this.#onLoad(frame));
    frame.src = address.href;
    this.#frame = frame;
    this.#escapes = false;
    this.#part('screen').append(frame);
    this.#show('running', this.dataset['textLoading'] ?? '');
    this.#button('close')?.focus();
  }

  #onLoad(frame: HTMLIFrameElement): void {
    if (frame !== this.#frame) return;
    // A program takes the keyboard, Tab included. Escape always brings the focus back to the page's own
    // buttons, so nobody is left inside without a way out. Only for a program of this same site.
    try {
      frame.contentWindow?.addEventListener('keydown', (event) => event.key === 'Escape' && this.#button('close')?.focus(), true);
      this.#escapes = true;
    } catch {
      // Another origin: its keys are its own.
    }
    // A program that says nothing of itself is taken as ready when its page has loaded; one that was quicker than this is told again, now with the way out.
    if (this.dataset['state'] === 'ready' || (!this.dataset['channel'] && this.dataset['state'] === 'running')) this.#ready();
  }

  #ready(): void {
    this.#show('ready', (this.#escapes ? this.dataset['textReadyKeys'] : this.dataset['textReady']) ?? '');
  }

  #onMessage = (event: MessageEvent): void => {
    if (!this.#frame || event.source !== this.#frame.contentWindow || event.origin !== location.origin) return;
    const data = event.data as { source?: unknown; state?: unknown; detail?: unknown } | null;
    if (!data || typeof data !== 'object' || data.source !== this.dataset['channel']) return;
    if (data.state === 'ready') this.#ready();
    // The program says what went wrong in its own words, inside its frame and here.
    else if (data.state === 'error') this.#show('error', typeof data.detail === 'string' && data.detail ? data.detail : (this.dataset['textError'] ?? ''));
  };

  #toggleFullscreen(): void {
    if (fullscreenElement() === this) {
      if (page.exitFullscreen) void page.exitFullscreen();
      else page.webkitExitFullscreen?.();
      return;
    }
    const host = this as FullscreenHost;
    if (host.requestFullscreen) void host.requestFullscreen().catch(() => undefined);
    else host.webkitRequestFullscreen?.();
  }

  #onFullscreen = (): void => {
    const full = fullscreenElement() === this;
    const label = this.#part('fullscreen').querySelector('[data-label]');
    if (label) label.textContent = (full ? this.dataset['textExit'] : this.dataset['textFullscreen']) ?? '';
  };

  #stop(): void {
    this.#attempt += 1;
    if (fullscreenElement() === this) {
      if (page.exitFullscreen) void page.exitFullscreen();
      else page.webkitExitFullscreen?.();
    }
    this.#frame?.remove();
    this.#frame = undefined;
    this.#starter?.removeAttribute('aria-busy');
    this.style.removeProperty('--held');
    this.#show('poster', '');
  }

  #close(): void {
    this.#stop();
    this.#starter?.focus();
  }
}

if (!customElements.get('tram-game-stage')) customElements.define('tram-game-stage', TramGameStage);
