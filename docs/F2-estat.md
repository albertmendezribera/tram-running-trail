# Fase 2 · Estat

**Data:** 2026-11-15 · **Encàrrec (CLAUDE.md 14):** «Facetes SEO, filtres, M4, cerca, imatges OG. Criteri de sortida: indexació correcta i pressupost complert amb 300+ curses.»

La fase es va començar amb la Fase 1 sense tancar (hi falta una cursa d'asfalt amb recorregut), per decisió del titular.

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Exploració de fonts (E19) | `docs/explorations/E19-race-data-sources.md` | Feta |
| Importador de curses | `apps/web/scripts/import-calendar.mjs` (`pnpm --filter @tram/web import-calendar`) | Fet per a quatre fonts. Es corre a mà |
| Calendari | `/ca/curses/` | **136 curses** de 2026 i 2027, mes a mes, amb salts per mes. Sense filtres encara |
| Fitxa d'una cursa del calendari | `/ca/curses/<slug>/` | Feta: fets, estat, web de la cursa i fonts. Sense recorregut ni desnivell |
| Properes curses a la portada | `/ca/` | Fet: les sis següents |
| Fila compacta per a llistes llargues | `RaceRow` amb `compact` | Feta al sistema de disseny |
| Imatges per compartir (M5) | `/og/…` | Fetes a la Fase 1 per a curses amb recorregut; les del calendari no en tenen |

## Què falta de l'encàrrec

- **300 curses:** n'hi ha 136. Falten la FEEC i el calendari de ruta de 2027 de la FCA, que encara no està publicat.
- **Filtres** per distància, terreny, desnivell i ubicació.
- **Pàgines per faceta** (terreny × territori, distància × any), generades només si tenen contingut.
- **M4, «l'any com a perfil»:** s'ha de repensar, perquè cap font dona el desnivell (E19).
- **Cerca** (E13).
- **Base de dades:** les curses viuen en un fitxer. El projecte de Supabase l'ha de crear el titular.
- **Tracks:** cap cursa del calendari en té.

## Què no s'ha verificat

- **Cap cursa s'ha comprovat contra el web del seu organitzador**, i les dates són les del dia de la consulta.
- **Permisos:** només les 12 curses de Barcelona venen d'una font de llicència oberta. La resta no entra a producció (`docs/revisio-legal.md`).
- **Rendiment de la llista** en un mòbil real: són 136 files en una sola pàgina.
