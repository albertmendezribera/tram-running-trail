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
 * Pointing at a place, on the profile or on another view, emits `tram:preview`
 * with `{ share }` (null when it ends): every view marks the same point.
 *
 * The route can also be flown: `fly()` runs it from where it is to its end at a steady pace, as a
 * film of it would, by moving the scroll itself, so every view follows as it does a hand. Any scroll
 * by hand lands the flight. A button marked `data-fly` inside the element starts and lands it; `tram:flight`
 * tells `{ flying }`.
 */
export class TramRouteScroller extends HTMLElement {
  #data!: RouteData;
  #gains: number[] = [];
  #frame = 0;
  #chapter = '';
  /** Kilometre a key step is scrolling to, so that quick presses add up. */
  #goal: { km: number; until: number } | undefined;
  /** Share another view or the pointer is on: the profile cursor stays there while it lasts. */
  #pointed: number | null = null;
  /** The flight under way: where it took off, when, and how long the whole route takes. */
  #flight: { from: number; at: number; seconds: number } | undefined;
  #flightFrame = 0;

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
    window.addEventListener('keydown', this.#onKey);
    this.addEventListener('tram:km', this.#onProfileKm);
    this.addEventListener('tram:km-leave', this.#onProfileLeave);
    this.querySelector<HTMLButtonElement>('[data-fly]')?.addEventListener('click', this.#onFly);
    this.#update();
  }

  disconnectedCallback(): void {
    window.removeEventListener('scroll', this.#schedule);
    window.removeEventListener('resize', this.#schedule);
    window.removeEventListener('wheel', this.#release);
    window.removeEventListener('touchstart', this.#release);
    window.removeEventListener('keydown', this.#onKey);
    this.removeEventListener('tram:km', this.#onProfileKm);
    this.removeEventListener('tram:km-leave', this.#onProfileLeave);
    this.querySelector<HTMLButtonElement>('[data-fly]')?.removeEventListener('click', this.#onFly);
    cancelAnimationFrame(this.#frame);
    this.land();
  }

  get #track(): HTMLElement {
    return this.querySelector<HTMLElement>('[data-track]')!;
  }

  #out(name: string): HTMLElement {
    return this.querySelector<HTMLElement>(`[data-out="${name}"]`)!;
  }

  /** The reader scrolls by hand: the next key step starts from where they are, and a flight lands. */
  #release = (): void => {
    this.#goal = undefined;
    this.land();
  };

  /** A key that scrolls the page is a scroll by hand too. The key that presses the button of the flight is not. */
  #onKey = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) && !(event.target as Element | null)?.closest?.('[data-fly]')) this.#release();
  };

  /** Whether the route is being flown. */
  get flying(): boolean {
    return this.#flight !== undefined;
  }

  /**
   * Flies the route from where it is to its end; from its end, from the start again. `seconds` is how
   * long the whole route takes: what is left takes its share of it. Not with reduced motion.
   */
  fly(seconds = 55): void {
    if (this.#flight || matchMedia(REDUCED_MOTION).matches) return;
    const from = this.#progress() > 0.995 ? 0 : this.#progress();
    this.#goal = undefined;
    this.#flight = { from, at: performance.now(), seconds };
    this.#tellFlight();
    const frame = (now: number): void => {
      const flight = this.#flight;
      if (!flight) return;
      const share = Math.min(1, flight.from + (now - flight.at) / 1000 / flight.seconds);
      const box = this.#track.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + box.top + share * (box.height - window.innerHeight), behavior: 'instant' });
      if (share >= 1) this.land();
      else this.#flightFrame = requestAnimationFrame(frame);
    };
    this.#flightFrame = requestAnimationFrame(frame);
  }

  /** Ends the flight where it is. */
  land(): void {
    if (!this.#flight) return;
    this.#flight = undefined;
    cancelAnimationFrame(this.#flightFrame);
    this.#tellFlight();
  }

  #onFly = (): void => (this.flying ? this.land() : this.fly());

  #tellFlight(): void {
    this.toggleAttribute('data-flying', this.flying);
    this.querySelector('[data-fly]')?.setAttribute('aria-pressed', String(this.flying));
    this.dispatchEvent(new CustomEvent('tram:flight', { detail: { flying: this.flying } }));
  }

  #schedule = (): void => {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#update());
  };

  /** Share of the route run so far (0–1). */
  get share(): number {
    return this.#data ? this.#progress() : 0;
  }

  /** The route this scroller runs, for a view that draws it too. */
  get route(): Pick<RouteData, 'points' | 'start' | 'finish' | 'locale'> {
    return this.#data;
  }

  /**
   * Another view points at a share of the route (null: it stopped). The profile
   * cursor goes there and every view is told, without moving the scroll.
   */
  preview(share: number | null): void {
    this.#cursor()?.setKm(share === null ? this.#km() : this.#kmOf(share));
    this.#emitPreview(share);
  }

  /** Scrolls to a share of the route. */
  goTo(share: number): void {
    this.#goal = undefined;
    this.land();
    this.#scrollToKm(this.#kmOf(share));
  }

  #kmOf(share: number): number {
    const points = this.#data.points;
    const first = points[0]![0];
    return first + Math.min(1, Math.max(0, share)) * (points.at(-1)![0] - first);
  }

  #km(): number {
    return this.#kmOf(this.#progress());
  }

  #cursor(): ReturnType<typeof profileCursor> {
    const figure = this.querySelector<HTMLElement>('figure[data-cursor]');
    return figure ? profileCursor(figure) : undefined;
  }

  #emitPreview(share: number | null): void {
    this.#pointed = share;
    this.dispatchEvent(new CustomEvent('tram:preview', { detail: { share } }));
  }

  /** Scrolls to the next or the previous whole kilometre. Returns the text to announce. */
  stepKm(direction: -1 | 1): string {
    const { points, locale } = this.#data;
    const first = points[0]![0];
    const last = points.at(-1)![0];
    const now = performance.now();
    this.land();
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
    // The figure takes the colour of its level on the grade scale, uphill or down.
    const steep = Math.abs(grade);
    const level = this.querySelector<HTMLElement>('[data-out-level]');
    if (level) level.dataset['level'] = String(steep < 5 ? 1 : steep < 10 ? 2 : steep < 15 ? 3 : 4);

    const climb = climbs.find((c) => km >= c.from && km <= c.to);
    const chapter = progress <= 0.002 ? start : progress >= 0.998 ? finish : (climb?.text ?? '');
    if (chapter !== this.#chapter) {
      this.#chapter = chapter;
      this.#out('chapter').textContent = chapter;
    }

    this.#cursor()?.setKm(this.#pointed === null ? km : this.#kmOf(this.#pointed));
    this.dispatchEvent(new CustomEvent('tram:progress', { detail: { share: progress, km } }));
  }

  /** A click on the profile scrolls to that kilometre; hovering only previews it. */
  #onProfileKm = (event: Event): void => {
    const { km, commit } = (event as CustomEvent<{ km: number; commit: boolean }>).detail;
    if (commit) {
      this.#goal = undefined;
      this.land();
      this.#scrollToKm(km);
      return;
    }
    const points = this.#data.points;
    const first = points[0]![0];
    this.#emitPreview((km - first) / (points.at(-1)![0] - first));
  };

  /** The pointer left the profile: the cursor goes back to where the runner is. */
  #onProfileLeave = (): void => {
    this.#cursor()?.setKm(this.#km());
    this.#emitPreview(null);
  };
}

if (!customElements.get('tram-route-scroller')) customElements.define('tram-route-scroller', TramRouteScroller);
