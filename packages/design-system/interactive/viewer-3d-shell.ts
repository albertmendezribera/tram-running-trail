export interface SceneContext {
  /** Where the scene draws. It already has its final size. */
  container: HTMLElement;
  /** Aborted when the viewer leaves the page: stop loading and clean up. */
  signal: AbortSignal;
  /** No automatic camera: the scene moves only when asked (CLAUDE.md 7.5). */
  reducedMotion: boolean;
}

export interface Scene {
  dispose(): void;
  /** Moves one step along the route. Returns a text to announce, if any. */
  step?(direction: -1 | 1): string | void;
  /** False while the viewer is off screen: stop rendering. */
  setActive?(active: boolean): void;
}

export type SceneLoader = (context: SceneContext) => Promise<Scene>;

type State = 'poster' | 'loading' | 'ready' | 'error';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const whenIdle = (run: () => void): void => {
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 200);
};

const savesData = (): boolean => Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

const STEP_KEYS: Record<string, -1 | 1> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

/**
 * The 3D never runs on the initial load (CLAUDE.md 10): it starts when visible
 * and the browser is idle, or when asked for. Until then the poster stays.
 */
export class TramViewer3D extends HTMLElement {
  #loader: SceneLoader | undefined;
  #scene: Scene | undefined;
  #controller: AbortController | undefined;
  #observer: IntersectionObserver | undefined;
  #wanted = false;

  set loader(loader: SceneLoader) {
    this.#loader = loader;
    if (this.#wanted) void this.#start();
  }

  connectedCallback(): void {
    this.#part('start').addEventListener('click', this.#request);
    this.#part('retry').addEventListener('click', this.#request);
    this.#part('stage').addEventListener('keydown', this.#onKey);
    if (this.dataset['load'] === 'visible' && !matchMedia(REDUCED_MOTION).matches && !savesData()) this.#startWhenVisible();
  }

  disconnectedCallback(): void {
    this.#part('start').removeEventListener('click', this.#request);
    this.#part('retry').removeEventListener('click', this.#request);
    this.#part('stage').removeEventListener('keydown', this.#onKey);
    this.#observer?.disconnect();
    this.#controller?.abort();
    this.#scene?.dispose();
    this.#scene = undefined;
    this.#wanted = false;
    this.#show('poster', '');
  }

  #part(name: string): HTMLElement {
    return this.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
  }

  #show(state: State, message: string): void {
    this.dataset['state'] = state;
    this.#part('status').textContent = message;
  }

  #request = (): void => {
    this.#wanted = true;
    void this.#start();
  };

  #startWhenVisible(): void {
    this.#observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.#observer?.disconnect();
        whenIdle(() => {
          if (this.isConnected && this.dataset['state'] === 'poster') this.#request();
        });
      },
      { rootMargin: '200px' },
    );
    this.#observer.observe(this);
  }

  async #start(): Promise<void> {
    const state = this.dataset['state'];
    if (!this.#loader || state === 'loading' || state === 'ready') return;
    this.#observer?.disconnect();
    const controller = new AbortController();
    this.#controller = controller;
    this.#show('loading', this.dataset['textLoading'] ?? '');
    try {
      const scene = await this.#loader({
        container: this.#part('stage'),
        signal: controller.signal,
        reducedMotion: matchMedia(REDUCED_MOTION).matches,
      });
      if (controller.signal.aborted) {
        scene.dispose();
        return;
      }
      this.#scene = scene;
      this.#show('ready', this.dataset['textReady'] ?? '');
      this.#observeActivity();
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      this.#show('error', this.dataset['textError'] ?? '');
    }
  }

  #observeActivity(): void {
    if (!this.#scene?.setActive) return;
    this.#observer = new IntersectionObserver((entries) => {
      this.#scene?.setActive?.(entries.some((e) => e.isIntersecting));
    });
    this.#observer.observe(this);
  }

  #onKey = (event: KeyboardEvent): void => {
    const direction = STEP_KEYS[event.key];
    if (!direction || !this.#scene?.step) return;
    event.preventDefault();
    const message = this.#scene.step(direction);
    if (message) this.#part('status').textContent = message;
  };
}

if (!customElements.get('tram-viewer-3d')) customElements.define('tram-viewer-3d', TramViewer3D);
