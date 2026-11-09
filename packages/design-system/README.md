# @tram/design-system

Única font de veritat visual de TRAM (CLAUDE.md, secció 6). Els tokens DTCG de `tokens/` generen tots els destins de `dist/`.

```
tokens/
  ref/           valors crus (paleta 7.3, escala d'espai de 4 px). Només els fan servir els tokens sys
  sys/           rols (surface, text, accent, data-road, space-3...). Els fan servir els components
  modes/         sobreescriptures per mode: theme/night, terrain/road|trail, density/compact
  modes.json     manifest: fitxers base, modificadors i regles de contrast
build/           generador (TypeScript, Node ≥ 22.18, sense dependències)
dist/            GENERAT i versionat. No s'edita a mà
  tokens.css         custom properties i modes (@layer tram.tokens)
  echarts-theme.ts   temes "tram-light" i "tram-night"
  three.ts           colors en sRGB i lineal per a Three.js/TSL, per tema × terreny
  og.ts              colors (hex) i espai (px) per a les imatges OG
```

## Ús

```css
@import '@tram/design-system/tokens.css';
.row { padding: var(--tram-sys-space-cell-y) var(--tram-sys-space-cell-x); color: var(--tram-sys-text); }
```

```html
<section data-theme="night" data-terrain="trail" data-density="compact">…</section>
```

- `data-theme`: `light` | `night`. Sense atribut, es fa servir la preferència del sistema operatiu. Es pot niar.
- `data-terrain`: `mixed` (per defecte) | `road` | `trail`. Canvia `--tram-sys-data-primary`.
- `data-density`: `comfortable` (per defecte) | `compact`. Canvia `--tram-sys-space-cell-*`.

Fora d'aquest paquet, només es poden fer servir `--tram-sys-*` i `--tram-comp-*`, mai `--tram-ref-*`.

## Ordres

| Ordre | Què fa |
|---|---|
| `pnpm tokens:build` | Valida i regenera `dist/` |
| `pnpm tokens:check` | Falla si `dist/` no coincideix amb `tokens/` (CI) |
| `pnpm test` | Tests del generador (fixtures d'errors + tokens reals) |
| `pnpm test:browser` | Modes niats resolts a Chromium |
| `pnpm tokens:proof` | Captures de la làmina de prova a `docs/explorations/E16/` |

## Validacions de la build

La build falla, i no toca `dist/`, quan:
- un àlies no existeix (amb suggeriment del nom més proper) o és circular;
- un `ref` és un àlies, o un `sys`/`comp` té un valor cru;
- un `comp` apunta directament a un `ref`;
- el `hex` d'un color no coincideix amb els seus `components`;
- un mode sobreescriu un token inexistent, el tema canvia un valor que no és color, o un token depèn de dos modificadors d'atribut;
- un parell de `modes.json → contrast` no arriba al mínim en alguna combinació de modes (amb `"level": "warn"` només en mostra un avís).

Per què el CSS es genera així (amb `light-dark()` i redeclaració per context): vegeu `docs/explorations/E16-token-pipeline.md`.
