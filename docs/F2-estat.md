# Fase 2 · Estat

**Data:** 2026-11-15 · **Encàrrec (CLAUDE.md 14):** «Facetes SEO, filtres, M4, cerca, imatges OG. Criteri de sortida: indexació correcta i pressupost complert amb 300+ curses.»

La fase es va començar amb la Fase 1 sense tancar (hi falta una cursa d'asfalt amb recorregut), per decisió del titular.

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Exploració de fonts (E19) | `docs/explorations/E19-race-data-sources.md` | Feta |
| Importador de curses | `apps/web/scripts/import-calendar.mjs` (`pnpm --filter @tram/web import-calendar`) | Fet per a sis fonts, més les proves llegides a mà al web del seu organitzador. Es corre a mà |
| Calendari | `/ca/curses/` | **326 curses i marxes** de 2026 i 2027 (223 de properes), mes a mes, amb salts per mes |
| Filtres | `/ca/curses/` | Fets: per tipus (asfalt, muntanya, cros, marxes), per distància i per comarca. Una illa petita sobre un índex que ja ve amb la pàgina; la tria queda a l'adreça i es pot enllaçar. **Sense filtre per desnivell**: cap font el dona |
| Cerca per nom | `/ca/curses/` | Feta dins del calendari: un camp que cerca al nom i a la població de cada prova, sense mirar accents ni majúscules, lletra a lletra, i que es combina amb els filtres. Queda a l'adreça (`?cerca=`). No és la cerca de tot el web (E13) |
| Fitxa d'una cursa del calendari | `/ca/curses/<slug>/` | Feta: fets, estat, web de la cursa i fonts. Sense recorregut ni desnivell |
| Properes curses a la portada | `/ca/` | Fet: les sis següents |
| Fila compacta per a llistes llargues | `RaceRow` amb `compact` | Feta al sistema de disseny |
| Imatges per compartir (M5) | `/og/…` | Fetes a la Fase 1 per a curses amb recorregut; les del calendari no en tenen |

## Què falta de l'encàrrec

- **300 curses:** n'hi ha 326, però només 13 poden anar a producció. La resta depèn del permís de les seves fonts.
- **Pàgines per faceta** (terreny × territori, distància × any), generades només si tenen contingut.
- **M4, «l'any com a perfil»:** s'ha de repensar, perquè cap font dona el desnivell (E19).
- **Cerca de tot el web** (E13): la del calendari hi és, per nom i població; cercar sabatilles, rutes o «a prop de» no.
- **Base de dades:** les curses viuen en un fitxer. El projecte de Supabase l'ha de crear el titular.
- **Tracks:** cap cursa del calendari en té.

## Què no s'ha verificat

- **Cap cursa s'ha comprovat contra el web del seu organitzador**, i les dates són les del dia de la consulta.
- **Permisos:** només les 12 curses de Barcelona i la marxa llegida al web del seu organitzador poden anar a producció. La resta no hi entra (`docs/revisio-legal.md`).
- **El terreny de 137 proves no se sap**, i 53 no tenen comarca reconeguda (noms de barri, o en castellà, a la font).
- **Rendiment de la llista** en un mòbil real: són 326 files en una sola pàgina.
- **La cerca** només mira el nom i la població: no troba una prova per la comarca (té el seu filtre), per l'organitzador ni per la data, i no perdona errors d'escriptura.
- **Els filtres** s'han provat a Chromium, a mida d'escriptori i de mòbil. Sense JavaScript no es mostren i la llista queda sencera.
- **Les opcions sense dada**: 109 proves no diuen el terreny i 78 no diuen la distància. Tenen la seva opció al filtre, però no surten sota «Asfalt» o «Muntanya» encara que ho siguin.
