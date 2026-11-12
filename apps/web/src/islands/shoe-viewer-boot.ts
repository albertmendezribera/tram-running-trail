// Gives every shoe viewer of the page its scene. Three.js loads only when a viewer asks for it.
import type { SceneLoader } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import type { SolidSpecs } from '@tram/shoe-geometry/solid';
import type { PhotoShoe } from '../three/shoe-viewer/photo.ts';

interface Linked {
  setView(yaw: number, pitch: number): void;
}

// Viewers of the same group turn together: a comparison is read at the same angle.
const groups = new Map<string, { members: Set<Linked>; view?: [number, number] }>();

void customElements.whenDefined('tram-viewer-3d').then(() => {
  for (const host of document.querySelectorAll<HTMLElement>('[data-shoe-viewer]')) {
    const viewer = host.querySelector<HTMLElement & { loader: SceneLoader }>('tram-viewer-3d');
    const data = host.querySelector('script[type="application/json"]')?.textContent;
    if (!viewer || !data) continue;
    const { specs, turned, photo } = JSON.parse(data) as { specs: SolidSpecs; turned: string; photo?: PhotoShoe };
    const name = host.dataset['shoeGroup'];
    const group = name ? (groups.get(name) ?? groups.set(name, { members: new Set() }).get(name)!) : undefined;
    const mirror = host.dataset['shoeMirror'] === undefined ? undefined : host.dataset['shoeMirror'] === 'true';
    viewer.loader = async (context) => {
      const { mountShoeViewer } = await import('../three/shoe-viewer/scene.ts');
      const scene: Linked & Awaited<ReturnType<typeof mountShoeViewer>> = await mountShoeViewer(context, {
        specs,
        photo,
        mirror,
        announce: (degrees) => turned.replace('{degrees}', String(degrees)),
        onTurn(yaw, pitch) {
          if (!group) return;
          group.view = [yaw, pitch];
          for (const other of group.members) if (other !== scene) other.setView(yaw, pitch);
        },
      });
      if (group) {
        group.members.add(scene);
        // A shoe that arrives late takes the angle the others are already at.
        if (group.view) scene.setView(...group.view);
        context.signal.addEventListener('abort', () => group.members.delete(scene), { once: true });
      }
      return scene;
    };
  }
});
