// Gives every route viewer of the page its scene. Three.js, MapLibre and the
// terrain load only when a viewer asks for it: nothing here weighs on the page.
import type { TramRouteScroller } from '@tram/design-system/interactive/route-scroller.ts';
import type { SceneLoader } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { isMode, MODE_FIELD, preferredMode, rememberMode } from './viewer-mode.ts';

void customElements.whenDefined('tram-viewer-3d').then(() => {
  for (const host of document.querySelectorAll<HTMLElement>('[data-route-viewer]')) {
    const slug = host.dataset['routeViewer']!;
    const scroller = host.querySelector<TramRouteScroller>('tram-route-scroller');
    const viewer = host.querySelector<HTMLElement & { loader: SceneLoader }>('tram-viewer-3d');
    if (!scroller || !viewer) continue;
    // The switch shows the view this reader last chose, and remembers a change at once.
    const chosen = scroller.querySelector<HTMLInputElement>(`input[name="${MODE_FIELD}"][value="${preferredMode()}"]`);
    if (chosen) chosen.checked = true;
    scroller.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.name === MODE_FIELD && isMode(input.value)) rememberMode(input.value);
    });
    viewer.loader = (context) => import('./route-viewer.ts').then((m) => m.mount(context, scroller, slug));
  }
});
