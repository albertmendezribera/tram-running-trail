# Changelog · @tram/design-system

Tot canvi de token o de component s'hi registra, amb captures abans/després (CLAUDE.md 6.8).

## 0.1.0 · 2026-11-09

Primera versió del pipeline (E16).

- Tokens `ref` de color: la paleta de 7.3 i el mode nit, més 7 colors derivats per contrast, marcats `hypothesis` (E09): `ink-muted`, `paper-shade`, `paper-rule`, `signal-ink`, `carbon`, `night-rule` i `night-text-muted`.
- Tokens `ref` d'espai: `space-0` … `space-12`, sobre una base de 4 px.
- Rols `sys`: `surface`, `surface-alt`, `text`, `text-muted`, `rule`, `rule-strong`, `accent`, `accent-text`, `on-accent`, `focus`, `data-road`, `data-trail`, `data-primary`, `data-active`, `map-contour`, `map-vegetation`, `map-water`, `space-*`, `space-cell-y` i `space-cell-x`.
- Modes `theme` (light/night), `terrain` (mixed/road/trail) i `density` (comfortable/compact).
- Destins: `tokens.css`, `echarts-theme.ts`, `three.ts` i `og.ts`.
- Captures: `docs/explorations/E16/`.
- Problema obert: `--signal` sobre `--paper` fa 2,64:1, per sota del 3:1 que es demana per a elements gràfics. La build en mostra un avís fins que E09 ho resolgui.
