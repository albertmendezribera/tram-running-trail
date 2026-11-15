// The image each race, route and comparison is shared with (M5): built with the site, one file each.
import type { APIRoute, GetStaticPaths } from 'astro';
import { ogCards, type OgCard } from '../../og/cards';
import { pairCard, routeCard, toPng } from '../../og/render';

export const getStaticPaths = (() => ogCards().map((card) => ({ params: { path: card.path }, props: { card } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const card = (props as { card: OgCard }).card;
  const png = await toPng(card.kind === 'pair' ? pairCard(card.card) : routeCard(card.card));
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
