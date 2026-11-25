// Gives every splat viewer of the page its scene. Three.js and the splat loader come only when a viewer asks for them.
import type { SceneLoader } from '@tram/design-system/interactive/viewer-3d-shell.ts';

void customElements.whenDefined('tram-viewer-3d').then(() => {
  for (const host of document.querySelectorAll<HTMLElement>('[data-splat-viewer]')) {
    const viewer = host.querySelector<HTMLElement & { loader: SceneLoader }>('tram-viewer-3d');
    const url = host.dataset['splatViewer'];
    if (!viewer || !url) continue;
    const turned = host.dataset['turned'] ?? '';
    viewer.loader = async (context) => {
      const { mountSplatViewer } = await import('../three/splat-viewer/scene.ts');
      return mountSplatViewer(context, { url, announce: (degrees) => turned.replace('{degrees}', String(degrees)) });
    };
  }
});
