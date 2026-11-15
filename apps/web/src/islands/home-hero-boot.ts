// Gives the hero of the home its scene, and drives it with the scroll. Three.js, the plan of the town and
// the terrain of the mountain load only when the hero asks for them.
import type { SceneLoader } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import type { TerrainMeta } from '../three/route-viewer/heights.ts';
import type { HeroScene } from '../three/hero/scene.ts';

const TERRAINS = import.meta.glob<TerrainMeta>('../content/routes/*/terrain.json', { import: 'default' });
const TRACKS = import.meta.glob<Array<[number, number]>>('../content/routes/*/route.json', { import: 'default' });
const IMAGES = import.meta.glob<string>('../content/routes/*/terrain.webp', { query: '?url', import: 'default' });

void customElements.whenDefined('tram-viewer-3d').then(() => {
  for (const host of document.querySelectorAll<HTMLElement>('[data-home-hero]')) {
    const viewer = host.querySelector<HTMLElement & { loader: SceneLoader }>('tram-viewer-3d');
    const pin = host.querySelector<HTMLElement>('.pin');
    const slug = host.dataset['mountain'];
    if (!viewer || !pin || !slug) continue;
    /** How much of the scroll the hero holds still for has gone by, 0–1. */
    const progress = (): number => {
      const room = host.offsetHeight - pin.offsetHeight;
      const gone = parseFloat(getComputedStyle(pin).top) - host.getBoundingClientRect().top;
      return room > 0 ? Math.min(1, Math.max(0, gone / room)) : 0;
    };
    viewer.loader = async (context) => {
      const at = (file: string): string => `../content/routes/${slug}/${file}`;
      const [{ mountHero }, { default: plan }, terrain, route, terrainUrl] = await Promise.all([import('../three/hero/scene.ts'), import('../content/hero-plan.json'), TERRAINS[at('terrain.json')]?.(), TRACKS[at('route.json')]?.(), IMAGES[at('terrain.webp')]?.()]);
      if (!terrain || !route || !terrainUrl) throw new Error(`no terrain for the route "${slug}"`);
      const scene: HeroScene = await mountHero(context, { plan, terrain, terrainUrl, route, progress: context.reducedMotion ? 0 : progress() });
      // Without motion the scroll moves nothing: the passage is stepped through with the keys.
      if (!context.reducedMotion) addEventListener('scroll', () => scene.setProgress(progress()), { passive: true, signal: context.signal });
      return scene;
    };
  }
});
