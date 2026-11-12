# Fase 0 · Tancament

**Data:** 2026-11-12 · **Criteri de CLAUDE.md:** "El catàleg sencer ja sembla TRAM i no una plantilla; un canvi de token es propaga a web, gràfics i 3D sense tocar cap pàgina."

Aquest document diu què demanava la Fase 0, què hi ha i com s'ha comprovat. El que no s'ha pogut comprovar és al final, sense maquillar.

## Què demanava i què hi ha

| Peça de la Fase 0 | Estat | On |
|---|---|---|
| Tokens i pipeline (E16) | Fet. 222 tokens en tres nivells, set tipus, cinc destins generats | `packages/design-system/tokens`, `build`, `dist` |
| Fonaments (6.3) | Fets tots: tipografia, espai, graella, línies, radis, moviment, capes, punts de tall i mides d'icona | `/ds/fonaments/`, generada dels tokens |
| Tipografia (E08) | Decidida i en ús: Sofia Sans, autoallotjada | `docs/explorations/E08-typography.md` |
| Color (E09) | Decidit, amb mode nit, escala de pendent i segona passada visual | `E09-color-and-night.md`, `visual-pass-2.md` |
| Primitives (6.4) | Fetes totes: `Text`, `Heading`, `Link`, `Button`, `Rule`, `Icon`, `Figure`, `VisuallyHidden`, `Stack`, `Cluster`, `Grid`, `Split`, `Bleed`, `Measure` i `DataTable`; a més, `Band` i `Panel` | `packages/design-system/primitives` |
| Primers components de domini | Fets els sis: `Measure`, `DataTable`, `Bib`, `StatBlock`, `ElevationProfile`, `Viewer3DShell`; a més, `ClimbList`, `SegmentedControl`, `ThemeToggle` i `RouteScroller` | `patterns`, `interactive` |
| Catàleg `/ds/` (E17) | Fet: 17 pàgines, amb fonaments, primitives, patrons, interactius, una pàgina de modes i el moment M2 | `apps/web/src/ds` |
| Regressió visual | Feta i a la CI: captures de cada pàgina a 390 i 1440 px, en clar i en nit | `apps/web/tests/__screenshots__` |
| Regles de lint (6.6) | Fetes: sense colors ni px a mà, sense tokens `ref` a l'app, xifres per `Measure` | `stylelint.config.mjs`, `eslint/` |
| Repositori, Astro 6 i Cloudflare | Fets: monorepo, build estàtic i entorn de proves | staging a Cloudflare Workers |
| Esquema de Supabase | Fet al repositori i provat a la CI contra un Postgres amb PostGIS. **Cap projecte de Supabase creat** | `supabase/` |

## El criteri, comprovat

- **"Un canvi de token es propaga":** la build genera el CSS, el tema d'ECharts, les constants de Three.js, els estils OG i el catàleg de tokens a partir dels mateixos fitxers, i la CI falla si `dist/` no hi coincideix. La segona passada visual ho va posar a prova: set colors i l'escala de text van canviar als tokens, i web, perfil i 3D van canviar sense tocar cap component.
- **"No sembla una plantilla":** és un judici, no una mesura. El que es pot dir és que no hi ha cap dels anti-patrons de 7.8 (ni targetes arrodonides amb ombra, ni degradats, ni icones genèriques, ni animacions d'entrada) i que les crítiques de qui l'ha vist ("poc color, tot negre, costa de llegir") es van atendre amb mesures d'abans i després.

## Com es comprova

`pnpm check` ho executa tot menys les proves de navegador de l'app.

| Comprovació | Resultat |
|---|---|
| Tokens: `dist/` al dia | passa |
| Tipus (TypeScript estricte, Astro) | sense errors |
| Lint (ESLint i Stylelint) | sense errors |
| Proves unitàries | 85 (tokens 67, formats 10, terreny 8) |
| Proves de les regles de lint | 23 |
| Proves dels tokens al navegador | 20 |
| Proves de navegador de l'app, Chromium | 340 (clar i nit, mòbil i escriptori; 4 són de velocitat) |
| Les mateixes al motor de Safari i al de Firefox | 168, 3D inclòs, en un Mac. A la CI (Linux), el motor de Safari les passa totes; Firefox no hi té WebGL i les 7 que necessiten el 3D fallen: el visor es queda al pòster, com està previst |
| Esquema de la base de dades | a la CI s'aplica a un Postgres amb PostGIS i passa les seves proves |

### Pressupost de rendiment (secció 10)

| Mètrica | Pressupost | Mesura |
|---|---|---|
| JS carregat d'entrada per pàgina | < 30 KB gzip | de 0,4 a 4,1 KB |
| LCP, amb 4G lent i CPU 4 vegades més lenta | < 1,8 s | de 0,6 a 0,7 s |
| CLS | < 0,05 | 0,005 com a màxim en un Mac. A Linux va sortir 0,31 pel canvi de lletra; corregit amb lletres de reserva ajustades, i la CI ho confirma: passa per sota de 0,05 |
| Illa 3D cartogràfica | < 250 KB gzip | 225,9 KB |
| Illa 3D realista (excepció acceptada) | límit fixat a 470 KB | 454,8 KB |
| Terreny de la primera vista | < 1,5 MB | 64,5 KB (cartogràfic) |

Ho imposen `scripts/check-budget.mjs` i `tests/perf.spec.ts`, tots dos a la CI. Mesurar va trobar dos errors reals:

- El full d'estils de MapLibre (71 KB) s'enviava amb totes les pàgines. Ja no.
- La lletra de reserva només estava ajustada per a Arial, que ni Android ni Linux tenen: en arribar la tipografia, la pàgina saltava. Ara n'hi ha d'ajustades per a Roboto, Helvetica i Liberation (`fonts/fallbacks.css`), i el text espera la tipografia en lloc de canviar-hi.

## El que no es compleix o no s'ha pogut comprovar

- **Lighthouse CI.** CLAUDE.md el demana a cada PR. No s'ha pogut fer funcionar en aquest Mac (Chrome no hi pinta en mode sense finestra). Les mateixes mètriques es mesuren amb Playwright, però **INP no es mesura**.
- **Dispositius reals.** Només hi ha una prova a ull en un Galaxy S25 amb Chrome. Falten els dispositius de referència (un Android de gamma mitjana i un iPhone de fa 3 o 4 anys) i un Safari de veritat: el que s'ha provat és el seu motor en un Mac.
- **Prova de color a l'exterior** (E09): no es pot fer des d'aquí.
- **Un contrast que va empitjorar:** de nit, les corbes de nivell, la vegetació i l'aigua queden entre 2,5 i 2,9 sobre el fons alternatiu (el mínim és 3). Documentat a `visual-pass-2.md`.
- **Escala de pendent:** entre nivells veïns la distància de color és de 7,9 a 10,3, sovint per sota de 10. Per això el pendent també es diu amb gruix, trama i xifra.
- **Supabase:** l'esquema no s'ha aplicat a cap projecte real, i les traduccions (E12) no estan decidides.
- **El visor realista** depèn dels servidors de l'ICGC i baixa unes 14 MB per ruta. Les seves proves simulen les tessel·les.
- **La crítica de disseny** que va motivar la segona passada no l'ha tornat a jutjar la mateixa gent.
- **La branca per defecte** continua amb el nom provisional `ccr-675b03db-ncu0p6`.

## Inventari que queda per a les fases següents

L'inventari de 6.4 té més peces que les que demanava la Fase 0. Es fan quan una pàgina les necessiti, sempre primer al sistema: `TerrainTag`, `SplitsTable`, `RaceRow`, `CalendarStrip`, `ShoeSpecSheet`, `SpecDiff`, `Legend`, `PoiPictogram`, `MapPoster`, `FilterBar`, `RangeSlider` i `Toggle`.

## Què ve ara

La Fase 1, la demo "1 + 1 + 2". Ja n'hi ha una part feta com a prototip (el visor de rutes en dos modes, el perfil sincronitzat i una ruta de muntanya real). Falten la ruta d'asfalt (E03), les dues sabatilles amb radiografia i comparador (E05), i les primeres pàgines de producte.
