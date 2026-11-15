// What the calendar import reads out of a name: the town without its article, the distances, and whether two
// names are of the same race. Kept apart from the import so it can be tested without asking any calendar.

export const plain = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&#8217;|[’`´]/g, "'")
    .replace(/\bst\.?\s/g, 'sant ')
    .replace(/\bsta\.?\s/g, 'santa ')
    .replace(/[^a-z0-9']+/g, ' ')
    .trim();
export const unescape = (text) => text.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** A town without its article, so "el Palau d'Anglesola" and "Palau d'Anglesola, el" are one. */
export const bare = (town) => plain(town).replace(/^(el|la|els|les|es|sa|ses)\s+|^l'\s*/, '').replace(/\s(el|la|els|les|l'|es|sa|ses)$/, '');

// ── What a name or a line of distances says the race measures, in metres. Nothing is estimated.
export function distancesOf(text, { trail = false } = {}) {
  const metres = new Set();
  const read = plain(text);
  // On a road a marathon and a half are exact distances; on a mountain they are only a name.
  if (!trail) {
    if (/mitja marato|media maraton|half marathon/.test(read)) metres.add(21097);
    if (/quart de marato/.test(read)) metres.add(10549);
    if (/\bmarato(n)?\b|\bmarathon\b/.test(read.replace(/mitja marato|media maraton|half marathon|quart de marato/g, ''))) metres.add(42195);
    if (/\bmilla\b/.test(read)) metres.add(1609);
  }
  // "5 i 10 km", "7km i 21km", "10 k", "6km, 13km, 22km i 46km".
  // "13.400 m.": metres written out.
  for (const [, thousands, rest] of text.matchAll(/\b(\d{1,2})\.(\d{3})\s*m\b/g)) metres.add(Number(thousands) * 1000 + Number(rest));
  for (const [, list] of read.matchAll(/((?:\d+(?:[.,]\d+)?\s*(?:k|km)?\s*(?:,|i|y|\+|\/)\s*)*\d+(?:[.,]\d+)?)\s*(?:km|kms|k)\b/g)) {
    for (const [number] of list.matchAll(/\d+(?:[.,]\d+)?/g)) {
      const km = Number(number.replace(',', '.'));
      if (km >= 0.4 && km <= 250) metres.add(Math.round(km * 1000));
    }
  }
  return [...metres].sort((a, b) => a - b);
}

// ── Whether two names are of the same race: what is left of each without numbers, editions and the words every race has.
const words = (name) => new Set(plain(name).replace(/\b(\d+[ae]?|[ivxlc]+|edicio|cursa|de|del|la|el|les|els|i|a|per|by|popular|trofeu|campionat|catalunya|absolut|master|rfea|km|k)\b/g, ' ').split(/\s+/).filter((w) => w.length > 2));
export const alike = (a, b) => {
  const [wa, wb] = [words(a), words(b)];
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared >= 1 && shared / Math.min(wa.size, wb.size) >= 0.5;
};
