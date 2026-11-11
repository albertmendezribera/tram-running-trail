import { formatNumber, type Locale } from '@tram/formats';
import { profileCursor } from '../patterns/elevation-cursor.ts';
import { cumulativeGain, elevationAt, gainAt, gradeAt, type ProfilePoint } from '../patterns/elevation.ts';

interface ClimbChapter {
  from: number;
  to: number;
  text: string;
}

interface RouteData {
  points: ProfilePoint[];
  climbs: ClimbChapter[];
  start: string;
  finish: string;
  locale: Locale;
  /** Vertical range of the silhouette, to place the runner on it. */
  low: number;
  high: number;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * M2 · "Recórrer el tram" (CLAUDE.md 7.7). Scrolling runs the route: the readout
 * works like a results board, the silhouette fills behind the runner and the
 * profile cursor follows. Clicking the profile jumps to that kilometre. Without
 * JavaScript the route is a static sheet: the tall scroll track only exists here.
 *
 * Each change emits `tram:progress` with `{ share, km }`, for a 3D view to follow.
 */
export class TramRouteScroller extends HTMLElement {
  #data!: RouteData;
  #gains: number[] = [];
  #frame = 0;
  #chapter = '';
  /** Kilometre a key step is scrolling to, so that quick presses add up. */
  #goal: { km: number; until: number } | undefined;

  connectedCallback(): void {
    const json = this.querySelector<HTMLScriptElement>('script[data-route]');
    if (!json) return;
    this.#data = JSON.parse(json.textContent ?? '{}') as RouteData;
    this.#gains = cumulativeGain(this.#data.points);
    this.dataset['live'] = '';
    window.addEventListener('scroll', this.#schedule, { passive: true });
    window.addEventListener('resize', this.#schedule);
    window.addEventListener('wheel', this.#release, { passive: true });
    window.addEventListener('touchstart', this.#release, { passive: true });
    this.addEventListener('tram:km', this.#onProfileKm);
    this.#update();
  }

  disconnectedCallback(): void {
    window.removeEventListener('scroll', this.#schedule);
    window.removeEventListener('resize', this.#schedule);
    window.removeEventListener('wheel', this.#release);
    window.removeEventListener('touchstart', this.#release);
    this.removeEventListener('tram:km', this.#onProfileKm);
    cancelAnimationFrame(this.#frame);
  }

  get #track(): HTMLElement {
    return this.querySelector<HTMLElement>('[data-track]')!;
  }

  #out(name: string): HTMLElement {
    return this.querySelector<HTMLElement>(`[data-out="${name}"]`)!;
  }

  /** The reader scrolls by hand: the next key step starts from where they are. */
  #release = (): void => {
    this.#goal = undefined;
  };

  #schedule = (): void => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#update());
  };

  /** Share of the route run so far (0–1). */
  get share(): number {
    return this.#data ? this.#progress() : 0;
  }

  /** Scrolls to the next or the previous whole kilometre. Returns the text to announce. */
  stepKm(direction: -1 | 1): string {
    const { points, locale } = this.#data;
    const first = points[0]![0];
    const last = points.at(-1)![0];
    const now = performance.now();
    const from = this.#goal && this.#goal.until > now ? this.#goal.km : first + this.#progress() * (last - first);
    const km = Math.min(last, Math.max(first, direction > 0 ? Math.floor(from + 0.05) + 1 : Math.ceil(from - 0.05) - 1));
    // Kept until the scroll gets there, however long a slow machine takes.
    this.#goal = { km, until: now + 10_000 };
    this.#scrollToKm(km);
    return `Km ${formatNumber(km, locale, 2)}`;
  }

  #scrollToKm(km: number): void {
    const points = this.#data.points;
    const first = points[0]![0];
    const share = (km - first) / (points.at(-1)![0] - first);
    const box = this.#track.getBoundingClientRect();
    const top = window.scrollY + box.top + share * (box.height - window.innerHeight);
    window.scrollTo({ top, behavior: matchMedia(REDUCED_MOTION).matches ? 'auto' : 'smooth' });
  }

  /** Scroll offset inside the track, as a share of the route (0–1). */
  #progress(): number {
    const box = this.#track.getBoundingClientRect();
    const run = box.height - window.innerHeight;
    return run > 0 ? Math.min(1, Math.max(0, -box.top / run)) : 0;
  }

  #update(): void {
    const { points, climbs, start, finish, locale } = this.#data;
    const first = points[0]![0];
    const last = points.at(-1)![0];
    const progress = this.#progress();
    const km = first + progress * (last - first);
    const n = (v: number, digits: number): string => formatNumber(v, locale, digits, digits);

    this.style.setProperty('--progress', String(progress));
    const { low, high } = this.#data;
    this.style.setProperty('--runner-y', `${(1 - (elevationAt(points, km) - low) / (high - low)) * 100}%`);
    if (this.#goal && Math.abs(km - this.#goal.km) < 0.02) this.#goal = undefined;
    this.#out('km').textContent = n(km, 2);
    this.#out('elevation').textContent = n(elevationAt(points, km), 0);
    this.#out('gain').textContent = n(gainAt(points, this.#gains, km), 0);
    const grade = Math.round(gradeAt(points, km));
    this.#out('grade').textContent = n(grade === 0 ? 0 : grade, 0);

    const climb = climbs.find((c) => km >= c.from && km <= c.to);
    const chapter = progress <= 0.002 ? start : progress >= 0.998 ? finish : (climb?.text ?? '');
    if (chapter !== this.#chapter) {
      this.#chapter = chapter;
      this.#out('chapter').textContent = chapter;
    }

    const figure = this.querySelector<HTMLElement>('figure[data-cursor]');
    if (figure) profileCursor(figure)?.setKm(km);
    this.dispatchEvent(new CustomEvent('tram:progress', { detail: { share: progress, km } }));
  }

  /** A click on the profile scrolls to that kilometre; hovering only previews it. */
  #onProfileKm = (event: Event): void => {
    const { km, commit } = (event as CustomEvent<{ km: number; commit: boolean }>).detail;
    if (commit) this.#scrollToKm(km);
  };
}

if (!customElements.get('tram-route-scroller')) customElements.define('tram-route-scroller', TramRouteScroller);
