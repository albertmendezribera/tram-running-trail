# Fase 1 · Estat

**Data:** 2026-11-12 · **Encàrrec:** «Una cursa d'asfalt i una de muntanya amb visor 3D i perfil; dues sabatilles (asfalt i trail) amb radiografia i comparador. Exploracions ★.»

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Portada | `/ca/` | Feta: plànol de Calonge, curses i rutes |
| Dues curses (muntanya i asfalt) amb visor 3D, perfil i full de resultats | `/ca/curses/cursa-de-mostra-calonge/`, `/ca/curses/cursa-de-mostra-sils/` | Fetes sobre les dues sortides reals. **Les curses són de mostra**: nom, data i dorsal inventats, marcades `isPlaceholder` |
| Dues rutes reals | `/ca/rutes/calonge/`, `/ca/rutes/sils/` | Fetes |
| Llistes | `/ca/curses/`, `/ca/rutes/`, `/ca/sabatilles/` | Fetes |
| Dues sabatilles reals amb radiografia, vista 3D, fitxa tècnica i puntuacions | `/ca/sabatilles/nike/vaporfly-4/`, `/ca/sabatilles/hoka/speedgoat-6/` | Fetes |
| Comparador (M3) | `/ca/comparar/hoka-speedgoat-6-vs-nike-vaporfly-4/` | Fet; l'ordre invers hi redirigeix |
| E03 · ruta plana | `docs/explorations/E03-flat-route.md` | Decidida |
| E05 · radiografia paramètrica | `docs/explorations/E05-shoe-xray.md` | Decidida |
| E04 · dispositius de referència | — | **No feta**: cal tenir els dispositius a la mà |

Les dades viuen en fitxers (`apps/web/src/content/`) amb la forma de l'esquema de la base de dades. Una construcció de producció no inclou cap cursa de mostra ni cap sabatilla pendent de revisió legal; l'entorn de proves, sí.

## Què s'ha afegit al sistema de disseny

Tretze patrons nous amb fitxa al catàleg (`/ds/`): el marc del web, `RaceRow`, `TerrainTag`, `Facts`, `RoutePlate`, `ShoeXray`, `ShoeSpecSheet`, `SpecDiff`, `ReviewScores`, `ShoeRow` i `ShoeSilhouette`. Dos paquets: `@tram/shoe-geometry` (nou) i el generador de plànols a `@tram/terrain-pipeline`.

## Com s'ha comprovat

Vegeu el final d'aquest document: els números són els de l'última execució abans de publicar.

## Què no s'ha verificat

- **Cap dispositiu real** en aquesta fase: ni la vista 3D de sabatilla ni les pàgines noves s'han obert en un mòbil. Les captures de mòbil són d'un Chromium a 390 px.
- **E04** (rendiment als dispositius de referència) no s'ha pogut fer des d'aquí.
- **Safari i Firefox**: les proves de les pàgines noves s'executen a CI en el treball informatiu `engines`; no s'han mirat a mà.
- **Les dades de les sabatilles** les hauria de repassar una persona contra les fonts enllaçades (detall a E05).
- **Revisió legal** dels noms de marca i de l'ús de mesures de laboratori de tercers: pendent. Per això les pàgines de sabatilles no són indexables ni entren a producció.
- **Una vista fotorealista de les sabatilles** (com la d'un escàner 3D) no existeix: cal escanejar les sabatilles (capa B, E06).
- **La cinta de ritme** d'E03 no s'ha fet: necessita permís per fer servir els temps del GPX.
- **INP i Lighthouse CI** continuen sense mesurar (com a la Fase 0).
- **Cap persona** ha jutjat encara si la demo fa dir «vull veure-ho tot aquí», que és el criteri de la fase.
- Les pàgines en castellà i anglès no existeixen: la Fase 1 és només en català.
- Les imatges per compartir (M5) i el calendari (M4) no formen part d'aquesta fase.
