// Gives every shoe viewer of the page its scene. Three.js loads only when a viewer asks for it.
import type { SceneLoader } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import type { SolidSpecs } from '@tram/shoe-geometry/solid';
import type { PhotoShoe } from '../three/shoe-viewer/photo.ts';

void customElements.whenDefined('tram-viewer-3d').then(() => {
  for (const host of document.querySelectorAll<HTMLElement>('[data-shoe-viewer]')) {
    const viewer = host.querySelector<HTMLElement & { loader: SceneLoader }>('tram-viewer-3d');
    const data = host.querySelector('script[type="application/json"]')?.textContent;
    if (!viewer || !data) continue;
    const { specs, turned, photo } = JSON.parse(data) as { specs: SolidSpecs; turned: string; photo?: PhotoShoe };
    viewer.loader = (context) => import('../three/shoe-viewer/scene.ts').then((m) => m.mountShoeViewer(context, { specs, photo, announce: (degrees) => turned.replace('{degrees}', String(degrees)) }));
  }
});
