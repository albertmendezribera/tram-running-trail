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

Catàleg i primers components (E17).

- Tokens de forma: `line-hairline`, `line-strong`, `radius-none` i `radius-soft`.
- Components: `Measure`, `DataTable`, `Bib`, `StatBlock`, `ElevationProfile`, `ClimbList`, `SegmentedControl` i `Viewer3DShell`, amb fitxa a `/ds/`.
- Captures de regressió: `apps/web/tests/__screenshots__/`.

Color (E09).

- `ref.signal-ink`: de `#c52e00` a `#bc2300`, perquè `sys.accent.text` arribi a 4,5:1 també sobre `surface.alt`.
- Rol nou `sys.data.active.outline`: contorn obligatori del punt actiu, que resol el 2,64:1 de `--signal` sobre paper. El cursor d'ECharts el fa servir.
- Regles de contrast noves: `accent.text` sobre `surface.alt` i el contorn del punt actiu. La build ja no mostra cap avís.
- Els 6 colors derivats d'E16 queden validats.
- Captures: `docs/explorations/E09/`.

Passada visual.

- `Measure` separa la xifra de la unitat (`formatMeasureParts`). En els rols `display-*`, la unitat va més petita, com en un marcador de resultats.
- `Bib` redissenyat com un dorsal real: el número omple el full, té anelles de reforç i una línia de trencat que marca el terreny.
- `ElevationProfile` anota el punt més alt i la pujada més dura, calculats de les dades (`annotate`).
- `DataTable` admet columnes amb barra divergent (`diverging`), com els parcials per quilòmetre.
- Nou patró `ClimbList`: pujades detectades del perfil (`detectClimbs`), totes a la mateixa escala.
- Portada del catàleg composta amb una sortida real.
- Captures: `docs/explorations/visual-pass/`.

Moment firma M2, "Recórrer el tram" (prototip al catàleg).

- `RouteScroller` (interactiu): el recorregut es fa amb el scroll. Té un marcador en directe (km, altitud, desnivell acumulat i pendent), una silueta que s'omple amb el punt del corredor, capítols per pujada i un perfil enganxat a sota. Clicar el perfil salta a aquell punt. Sense JavaScript queda com un full estàtic.
- `ElevationProfile` admet `cursor`. El controla `elevation-cursor.ts`, que emet `tram:km` per sincronitzar-lo, per exemple amb el 3D. El perfil continua sense JavaScript si no es fa servir.
- Funcions noves: `elevationAt`, `gradeAt`, `cumulativeGain` i `gainAt`. `formatNumber` accepta un mínim de decimals.
- El vol 3D (Three.js i terreny) arriba a la Fase 1: E01, E02 i E04.

Vol 3D a M2 (E01 i E02).

- `RouteScroller` admet `viewer`: afegeix una vista 3D sobre la silueta, que queda de pòster. Emet `tram:progress` amb `{ share, km }` a cada canvi, i exposa `share` i `stepKm()`.
- La silueta passa a `RouteSilhouette`, una peça de `RouteScroller`.
- `Viewer3DShell` admet `fill`: ocupa el seu contenidor, sense marc, i només mostra l'ajuda de teclat a qui fa servir el teclat. Sense JavaScript ja no ensenya un botó que no faria res.
- `ElevationProfile` admet `compact`: en pantalles estretes, un perfil més baix i sense llegenda, per quan acompanya una altra vista.
- Amb el visor, el marcador de `RouteScroller` posa les tres xifres en una fila al mòbil.
- L'escena és a `apps/web/src/three/` i pren els colors de `dist/three.ts`. No hi ha cap token nou.
- Perfil i 3D assenyalen el mateix punt: `elevation-cursor.ts` emet `tram:km-leave` quan el punter surt del perfil, i `RouteScroller` emet `tram:preview` amb `{ share }` i exposa `preview()`, `goTo()` i `route`.
- **Tokens nous: escala de pendent** (E09). `ref.grade-1` a `ref.grade-4` i `ref.night-grade-1` a `ref.night-grade-4`, i el rol `sys.data.grade.1` a `.4`. La build exigeix 3:1 a cada nivell sobre `surface` i `surface.alt`. Captures: `docs/explorations/E09/pendent-*.png`; abans el traçat per recórrer anava en `text.muted`.
- **`ElevationProfile`: les bandes de pendent passen del marró de `map.contour` a l'escala lila**, la mateixa del traçat 3D, i conserven les trames. Abans: `docs/explorations/E15/profile-light-desktop.png`. Després: `docs/explorations/E09/perfil-lila-*.png`.
- `RouteScroller`: `viewer.grades` afegeix la llegenda de l'escala, que només es mostra en pantalles estretes (a les amples ja hi ha la del perfil). `GRADE_LABELS` (a `elevation.ts`) dona els noms dels nivells al perfil i a la llegenda.
- `RouteScroller`: enllaç "Salta el recorregut", sempre visible, que porta al final del component (`id` per a pàgines amb més d'un). En pantalles estretes l'ajuda es queda en una frase.
- `RouteScroller`: `viewer.modes` afegeix un commutador de maneres de veure el terreny a la cantonada de la vista; la pàgina n'escolta el `change`.
- `SegmentedControl` admet `compact`, per quan va sobre un altre contingut.
- `Viewer3DShell` dona estil a les fites que una escena afegeix sobre el llenç: elements `data-scene-label` (`km` o `place`) dins de `data-scene-labels`.
- Captures: `docs/explorations/E02/m2-*.png`.

Segona passada visual: llegibilitat, blocs i color (`docs/explorations/visual-pass-2.md`, amb captures abans/després).

- **Clar per defecte:** `:root` declara `color-scheme: light`; el tema nit només s'aplica amb `data-theme="night"`. Nou `ThemeToggle` (interactiu), que recorda la tria.
- **Tokens que canvien:** `ref.paper-shade` `#e2e0d8` → `#d6d3cd`, `ref.paper-rule` `#bebcb6` → `#9c9b97`, `ref.night` `#0e0f11` → `#17191c`, `ref.carbon` `#18191b` → `#282a2c`, `ref.night-rule` `#2e2f2f` → `#4a4b4b`, `ref.night-text-muted` `#93918d` → `#9e9d98`, `ref.signal-ink` `#bc2300` → `#b21400`.
- **Tokens nous:** `ref.paper-earth`, `ref.night-earth` i el rol `sys.surface.tint`, amb regles de contrast per al text.
- **Escala de text:** `ref.size.2xs` a `ref.size.base` pugen un píxel.
- **Primitives noves:** `Band` (part de pàgina de banda a banda, amb títol sobre barra de tinta) i `Panel` (bloc pla amb filet fort).
- `StatBlock`: `tone: 'grade'` dona a una xifra el color de l'escala de pendent.
- `RouteScroller`: el desnivell i el pendent prenen el lila del seu nivell, la pujada activa porta l'accent i les etiquetes deixen les majúscules.

Tancament de la Fase 0, primera part: fonaments i primitives.

- **Tipus nous a la pipeline:** `duration` i `cubicBezier`. Amb `prefers-reduced-motion`, la build posa totes les durades de sistema a 0.
- **Fonaments nous** (6.3): moviment (`sys.motion.quick`, `steady`, `slow`, `route` i tres corbes), graella (`sys.grid.columns`, `gutter`, `margin`, `measure`), punts de tall (`sys.breakpoint.sm` a `xl`), capes (`sys.layer.base` a `modal`), mides d'icona (`sys.icon.sm` a `lg`) i línies amb nom (`sys.line.contour`, `route`, `mark`).
- **Destí nou `dist/catalog.ts`:** tots els rols de sistema amb el valor resolt i la descripció. La pàgina de fonaments s'escriu d'aquí.
- **`dist/three.ts`** exporta també `tramThreeLines` i `tramThreeMotion`.
- **Primitives noves, sense JavaScript:** `Text`, `Heading`, `Link`, `Button`, `Rule`, `Icon` (amb 14 pictogrames propis a `icons.ts`), `Figure`, `VisuallyHidden`, `Stack`, `Cluster`, `Grid`, `Split` i `Bleed`.
- `Band` desfà el marge de pàgina amb `sys.grid.margin`, i el seu títol és una barra fosca en tots dos temes.
- `SegmentedControl` fa servir `sys.layer.raised` en lloc d'un `z-index` numèric.
- Catàleg: navegació agrupada, plantilla de fitxa amb "quan sí / quan no" i fitxes noves per a les primitives i per a `ThemeToggle`.

Tancament de la Fase 0, segona part.

- Catàleg: pàgina de modes (`/ds/modes/`), amb els mateixos components en les quatre combinacions de tema i terreny.
- El full d'estils de MapLibre ja no s'envia amb totes les pàgines: es carrega amb la seva escena.
- `fonts/fallbacks.css`: lletres de reserva amb les proporcions de les dues tipografies, per a Arial, Helvetica, Liberation, Arimo i Roboto. Les tipografies passen a `font-display: block`.
- Sense canvis de token.

## 0.1.0 · 2026-11-09

Primera versió del pipeline (E16).

- Tokens `ref` de color: la paleta de 7.3 i el mode nit, més 7 colors derivats per contrast, marcats `hypothesis` (E09): `ink-muted`, `paper-shade`, `paper-rule`, `signal-ink`, `carbon`, `night-rule` i `night-text-muted`.
- Tokens `ref` d'espai: `space-0` … `space-12`, sobre una base de 4 px.
- Rols `sys`: `surface`, `surface-alt`, `text`, `text-muted`, `rule`, `rule-strong`, `accent`, `accent-text`, `on-accent`, `focus`, `data-road`, `data-trail`, `data-primary`, `data-active`, `map-contour`, `map-vegetation`, `map-water`, `space-*`, `space-cell-y` i `space-cell-x`.
- Modes `theme` (light/night), `terrain` (mixed/road/trail) i `density` (comfortable/compact).
- Destins: `tokens.css`, `echarts-theme.ts`, `three.ts` i `og.ts`.
- Captures: `docs/explorations/E16/`.
- Problema obert: `--signal` sobre `--paper` fa 2,64:1, per sota del 3:1 que es demana per a elements gràfics. La build en mostra un avís fins que E09 ho resolgui.
