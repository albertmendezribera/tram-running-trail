/** A time as a runner writes it: `1:23:15`, or `58:53` under the hour. The page keeps the clock of a results sheet. */
export const clock = (seconds: number): string => {
  const s = Math.round(seconds);
  const tail = `${String(Math.floor(s / 60) % 60).padStart(s >= 3600 ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${tail}` : tail;
};
