/**
 * A text as a search compares it: lower case, without accents, and with what is not a letter or a figure
 * turned into a space. «L'Escala» and «l escala» are the same, and so are «Col·legi» and «collegi».
 * The page builds its index with it and the island reads what is typed with it, so the two always agree.
 */
export const searchText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/·/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Whether every word asked for is somewhere in a text already made plain. Nothing asked for finds everything. */
export const found = (plainText: string, asked: string): boolean => {
  const words = searchText(asked).split(' ').filter(Boolean);
  return words.every((word) => plainText.includes(word));
};
