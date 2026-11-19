// The tall image a route is shared with in a story (M5): built with the site, one file to a route and a theme.
import type { APIRoute, GetStaticPaths } from 'astro';
import { toPng } from '../../og/render';
import { stories, type Story } from '../../og/stories';
import { storyCard } from '../../og/story';

export const getStaticPaths = (() => stories().map((story) => ({ params: { path: story.path }, props: { story } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { card, theme } = (props as { story: Story }).story;
  return new Response(new Uint8Array(await toPng(storyCard(card, theme))), { headers: { 'Content-Type': 'image/png' } });
};
