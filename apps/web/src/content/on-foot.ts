// The poster of a route's «a peu» page: a capture taken inside the game, made by `scripts/world-poster.mjs`
// into a wide cut and a tall one for phones, each in AVIF and in WebP. Their sizes are read from the files.
import type { ImageMetadata } from 'astro';
import type { Poster } from '@tram/design-system/interactive/GameStage.astro';

const images = import.meta.glob<ImageMetadata>('./routes/*/on-foot-*.{avif,webp}', { eager: true, import: 'default' });

export interface OnFootPoster {
  /** 16:9, for a screen wider than a phone. */
  wide: { avif: ImageMetadata; webp: ImageMetadata };
  /** 3:4, for a phone held upright. */
  tall: { avif: ImageMetadata; webp: ImageMetadata };
}

/** The poster of a route, or nothing when its files are not there. */
export function onFootPoster(slug: string): OnFootPoster | undefined {
  const at = (cut: string, format: string): ImageMetadata | undefined => images[`./routes/${slug}/on-foot-${cut}.${format}`];
  const [wideAvif, wideWebp, tallAvif, tallWebp] = [at('wide', 'avif'), at('wide', 'webp'), at('tall', 'avif'), at('tall', 'webp')];
  if (!wideAvif || !wideWebp || !tallAvif || !tallWebp) return undefined;
  return { wide: { avif: wideAvif, webp: wideWebp }, tall: { avif: tallAvif, webp: tallWebp } };
}

/**
 * The poster as the stage of the design system takes it: the lightest format first, WebP for whoever
 * cannot read it. `eager` where the page opens on it, and it is what the page paints first.
 */
export function stagePoster(poster: OnFootPoster, alt: string, eager = false): Poster {
  const cut = ({ avif, webp }: OnFootPoster['wide']) => ({ src: webp.src, width: webp.width, height: webp.height, formats: [{ src: avif.src, type: 'image/avif' }] });
  return { alt, wide: cut(poster.wide), tall: cut(poster.tall), eager };
}
