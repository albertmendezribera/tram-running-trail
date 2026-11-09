# TRAM · Running & Trail

Plataforma de running d'asfalt i trail running. Abans d'escriure codi, llegiu [`CLAUDE.md`](CLAUDE.md).

## Estat

**Fase 0: design system.** Encara no hi ha cap pàgina de producte (CLAUDE.md 6.1).

| Peça | Estat |
|---|---|
| E16 · Pipeline de tokens | Fet: [`docs/explorations/E16-token-pipeline.md`](docs/explorations/E16-token-pipeline.md) |
| E17 · Catàleg `/ds/` i regressió visual | Pendent |
| E08 · Tipografia | Decidida (Sofia Sans), pendent de la prova amb dades reals: [`docs/explorations/E08-typography.md`](docs/explorations/E08-typography.md) |
| Tokens de tipografia | Fet: rols `[data-type]` i fonts a `packages/design-system/fonts/` |
| E09 · Color i mode nit | Pendent (hipòtesis i problemes oberts a E16) |
| Lint (Stylelint, ESLint) | Pendent |

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
packages/design-system/    tokens DTCG → CSS, ECharts, Three.js, OG
docs/explorations/         resultats de les exploracions E01–E17
```
