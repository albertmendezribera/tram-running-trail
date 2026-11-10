# TRAM · Running & Trail

Plataforma de running d'asfalt i trail running. Abans d'escriure codi, llegiu [`CLAUDE.md`](CLAUDE.md).

## Estat

**Fase 0: design system.** Encara no hi ha cap pàgina de producte (CLAUDE.md 6.1).

| Peça | Estat |
|---|---|
| E16 · Pipeline de tokens | Fet: [`docs/explorations/E16-token-pipeline.md`](docs/explorations/E16-token-pipeline.md) |
| E17 · Catàleg `/ds/` i regressió visual | Fet, pendent de veure'l a la CI: [`docs/explorations/E17-catalog-visual-regression.md`](docs/explorations/E17-catalog-visual-regression.md) |
| E08 · Tipografia | Decidida (Sofia Sans), pendent de la prova amb dades reals: [`docs/explorations/E08-typography.md`](docs/explorations/E08-typography.md) |
| Tokens de tipografia | Fet: rols `[data-type]` i fonts a `packages/design-system/fonts/` |
| E15 · Perfil altimètric | Decidida (SVG artesanal), pendent de la prova amb un GPX real: [`docs/explorations/E15-elevation-profile.md`](docs/explorations/E15-elevation-profile.md) |
| E09 · Color i mode nit | Paleta validada, pendent de la prova a l'exterior: [`docs/explorations/E09-color-and-night.md`](docs/explorations/E09-color-and-night.md) |
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
docs/explorations/         resultats de les exploracions E01–E17
```
