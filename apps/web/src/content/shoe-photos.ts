// The photo models of shoes of the catalogue: the outline of a shoe read off its maker's own product
// photos, with the photos to lay over it (apps/web/scripts/photo-model.py). The photos belong to the
// makers, so they and what is made of them are kept out of the repository: a model is there only on a
// machine that has its files, and a build without them has no 3D view of the catalogue at all.
import type { PhotoShoe } from '../three/shoe-viewer/photo.ts';
import type { CatalogShoe } from './shoe-catalog';

/**
 * A photo model as a page carries it: the photos and the outline, each by its address. The outline is
 * fetched when the view loads: written into the page, the outlines of a whole catalogue would weigh
 * more than the rest of the comparator, which holds every shoe twice.
 */
export type PhotoShoeRef = Omit<PhotoShoe, 'model'> & { model: string };

// `no-inline`: an outline is about 4 KB, and so small a file would otherwise be written into the page as a data address.
const models = import.meta.glob<string>('./shoes-local/catalog/*/*/model.json', { eager: true, import: 'default', query: '?url&no-inline' });
const images = import.meta.glob<string>('./shoes-local/catalog/*/*/*.webp', { eager: true, import: 'default', query: '?url' });

/** The photo model of a shoe, when its files are there. */
export function catalogPhoto(shoe: CatalogShoe): PhotoShoeRef | undefined {
  const folder = `./shoes-local/catalog/${shoe.brand.slug}/${shoe.slug}`;
  const model = models[`${folder}/model.json`];
  const [lateral, medial, top] = ['lateral', 'medial', 'top'].map((view) => images[`${folder}/${view}.webp`]);
  if (!model || !lateral || !medial || !top) return undefined;
  return { model, lateral, medial, top, heel: images[`${folder}/heel.webp`], sole: images[`${folder}/sole.webp`] };
}
