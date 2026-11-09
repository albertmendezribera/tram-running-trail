# Changelog · @tram/design-system

Tot canvi de token o de component s'hi registra, amb captures abans/després (CLAUDE.md 6.8).

## Sense publicar

Tipografia (E08).

- Tipus nous a la pipeline: `fontFamily`, `fontWeight` i `number`. Les dimensions admeten `$extensions["com.tramrun"].fluidMin` per a mides fluides.
- Tokens `ref`: `font-*`, `weight-*`, `leading-*`, `tracking-*` i `size-*` (de `2xs` a `4xl`), fluids entre 390 i 1440 px.
- Rols `sys`: `font-display`, `font-text`, `font-data` i `type-*`: `display-xl`, `display-lg`, `display-md`, `display-sm`, `text-lg`, `text-md`, `text-sm`, `text-xs`, `data-lg`, `data-md` i `data-sm`.
- `tokens.css` afegeix la capa `tram.type`: `[data-type="<rol>"]` aplica un rol sencer. Els rols `data-*` porten xifres tabulars i els `display-*`, proporcionals. `data-numeric="tabular"` força les tabulars.
- Destins: el tema ECharts fixa la tipografia de dades i `og.ts` exporta `tramOgType`.
- Fonts autoallotjades a `fonts/`: Sofia Sans (400–700) i Sofia Sans Extra Condensed (700–900), 51,6 KB en total.
- Captures: `docs/explorations/E08/roles-*.png`. No hi ha "abans": és el primer cop que hi ha tipografia.

## 0.1.0 · 2026-11-09

Primera versió del pipeline (E16).

- Tokens `ref` de color: la paleta de 7.3 i el mode nit, més 7 colors derivats per contrast, marcats `hypothesis` (E09): `ink-muted`, `paper-shade`, `paper-rule`, `signal-ink`, `carbon`, `night-rule` i `night-text-muted`.
- Tokens `ref` d'espai: `space-0` … `space-12`, sobre una base de 4 px.
- Rols `sys`: `surface`, `surface-alt`, `text`, `text-muted`, `rule`, `rule-strong`, `accent`, `accent-text`, `on-accent`, `focus`, `data-road`, `data-trail`, `data-primary`, `data-active`, `map-contour`, `map-vegetation`, `map-water`, `space-*`, `space-cell-y` i `space-cell-x`.
- Modes `theme` (light/night), `terrain` (mixed/road/trail) i `density` (comfortable/compact).
- Destins: `tokens.css`, `echarts-theme.ts`, `three.ts` i `og.ts`.
- Captures: `docs/explorations/E16/`.
- Problema obert: `--signal` sobre `--paper` fa 2,64:1, per sota del 3:1 que es demana per a elements gràfics. La build en mostra un avís fins que E09 ho resolgui.
