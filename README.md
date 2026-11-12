# TRAM · Running & Trail

Plataforma de running d'asfalt i trail running. Abans d'escriure codi, llegiu [`CLAUDE.md`](CLAUDE.md).

## Estat

**Fase 0 (design system) tancada el 12-11-2026:** [`docs/F0-tancament.md`](docs/F0-tancament.md) diu què hi ha, com s'ha comprovat i què queda sense comprovar. Encara no hi ha cap pàgina de producte; la Fase 1 és la següent.

| Peça | Estat |
|---|---|
| E16 · Pipeline de tokens | Fet: [`docs/explorations/E16-token-pipeline.md`](docs/explorations/E16-token-pipeline.md) |
| E17 · Catàleg `/ds/` i regressió visual | Fet i en marxa a la CI: [`docs/explorations/E17-catalog-visual-regression.md`](docs/explorations/E17-catalog-visual-regression.md) |
| E08 · Tipografia | Decidida (Sofia Sans), pendent de la prova amb dades reals: [`docs/explorations/E08-typography.md`](docs/explorations/E08-typography.md) |
| Tokens de tipografia | Fet: rols `[data-type]` i fonts a `packages/design-system/fonts/` |
| E15 · Perfil altimètric | Decidida (SVG artesanal) i provada amb dos GPX reals: [`docs/explorations/E15-elevation-profile.md`](docs/explorations/E15-elevation-profile.md) |
| E09 · Color i mode nit | Paleta validada, pendent de la prova a l'exterior: [`docs/explorations/E09-color-and-night.md`](docs/explorations/E09-color-and-night.md) |
| E01 · Format del terreny | Decidit (heightmap de 10 m en WebP) per a muntanya a Catalunya: [`docs/explorations/E01-terrain-format.md`](docs/explorations/E01-terrain-format.md) |
| E02 · Llenguatge visual del terreny | Decidit (cartogràfic amb color): [`docs/explorations/E02-terrain-look.md`](docs/explorations/E02-terrain-look.md) |
| M2 · Recórrer el tram | Prototip al catàleg (`/ds/moments/recorrer-el-tram/`), amb scroll, dades reals i vol 3D pel relleu, en dos modes: realista (ortofoto de l'ICGC amb MapLibre) i cartogràfic (Three.js). Vist bé en un Galaxy S25 amb Chrome; falten les mesures en els dispositius de referència (E04) i Safari |
| Segona passada visual | Aplicada després de les crítiques de llegibilitat; pendent que la torni a jutjar la mateixa gent: [`docs/explorations/visual-pass-2.md`](docs/explorations/visual-pass-2.md) |
| Fonaments i primitives | Fets tots els de les seccions 6.3 i 6.4: `/ds/fonaments/` i les fitxes de primitives |
| Esquema de Supabase | Al repositori i provat a la CI; cap projecte creat: [`supabase/README.md`](supabase/README.md) |
| Pressupost de rendiment | Imposat a la CI: `pnpm --filter @tram/web budget` i `tests/perf.spec.ts` |
| Lint (Stylelint, ESLint) | Fet: `pnpm lint`, regles de la secció 6.6 de `CLAUDE.md` |

## Requisits

Node ≥ 22.18 (executa TypeScript de manera nativa) i pnpm 10.

```sh
pnpm install
pnpm tokens:build
pnpm test
```

## Estructura

```
apps/web/                  Astro 6 (encara sense pàgines)
packages/design-system/    tokens DTCG → CSS, ECharts, Three.js, OG, i components
packages/formats/          formatació de xifres per idioma
packages/terrain-pipeline/ GPX → model d'elevacions de l'ICGC → terreny i traçat per al 3D
docs/explorations/         resultats de les exploracions E01–E17
```
