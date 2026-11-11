# TRAM | Running & Trail — CLAUDE.md

> Document d'arrencada per a Claude Code. Llegeix-lo sencer abans d'escriure codi.
> Les seccions marcades amb **[DECIDIT]** són fixes. Les marcades amb **[EXPLORACIÓ]** són obertes: avalua-les, prototipa i deixa una recomanació argumentada a `docs/explorations/` abans d'implementar-les.
>
> **Regla número u: el design system va primer.** Cap pàgina, cap pilar i cap moment firma no es construeix fins que el design system de la secció 6 no té els fonaments en marxa. És el que fa que la web sigui modular i que qualsevol canvi futur costi poc.

---

## 0. Com treballar en aquest repo

- **Idioma:** codi, noms de fitxers, variables i commits en anglès. Documentació interna i contingut de la UI en català (idioma per defecte), després castellà i anglès.
- **Ordre de treball per a qualsevol peça visual:**
  0. **Busca-la al design system** (secció 6). Si el component existeix, fes-lo servir. Si no existeix, primer el crees al design system amb la seva fitxa al catàleg i, només després, el fas servir a la pàgina. Mai no es crea un component "d'un sol ús" dins d'una pàgina.
  1. Llegeix la secció 7 (Direcció visual) i la llista d'anti-patrons (7.8).
  2. Fes un esbós ràpid i desa'n captures amb Playwright a 390 px (mòbil) i 1440 px (escriptori), en mode clar i mode nit.
  3. Revisa les captures contra els anti-patrons. Si s'hi assembla, refés-ho abans de continuar.
  4. Només llavors poleix i connecta-ho a dades reals.
- **Dependències:** no n'afegeixis cap sense indicar-ne el pes (gzip) i el motiu. Tot el que arribi al client compta contra el pressupost de rendiment (secció 10).
- **Honestedat de dades:** mai inventis especificacions de sabatilles, desnivells o dates de curses. Si falta una dada, mostra-la com a absent ("—"), no l'estimis. Els placeholders de desenvolupament han d'estar marcats com a tals (`isPlaceholder: true`) i mai arribar a producció.
- **Exploracions:** cada línia d'exploració de la secció 13 acaba amb un fitxer `docs/explorations/EXX-nom.md` que inclogui context, opcions provades, mesures, captures i recomanació. Una exploració sense mesures no està acabada.

### Definició de fet (per a qualsevol peça visible)
- [ ] Construïda només amb components i tokens del design system. Cap color, mida o espai escrit a mà (el lint ho bloqueja: vegeu 6.6).
- [ ] Si ha calgut un component nou: és al design system, té fitxa al catàleg i captures de regressió visual.
- [ ] Captures a 390 px i 1440 px, clar i nit, adjuntades a la PR.
- [ ] Funciona amb `prefers-reduced-motion: reduce`.
- [ ] Tot el contingut que mostra el 3D o un gràfic també existeix en HTML indexable.
- [ ] Dins del pressupost de rendiment (Lighthouse CI en verd).
- [ ] Passa la checklist d'anti-patrons (7.8).
- [ ] Textos en català revisats (vegeu 7.9 i el glossari).

---

## 1. Producte

TRAM és una plataforma de **running d'asfalt i trail running**, a parts iguals. Comença a Catalunya i està pensada per escalar a nivell global.

Un "tram" és la unitat de qualsevol corredor: un tram ràpid d'asfalt o un tram tècnic de muntanya.

**Tres pilars:**
1. **Visor 3D de rutes i tracks:** recreació immersiva del recorregut, amb relleu, punts d'interès, perfil interactiu i velocitat d'animació ajustable.
2. **Comparador tècnic de sabatilles:** drop, pes, stack, compostos, placa, rocker, amortiment, tacs i durabilitat, per a asfalt i muntanya.
3. **Calendari de curses:** filtrable per distància, terreny, desnivell positiu i ubicació, i construït per al posicionament SEO.

**Objectiu d'experiència:** que la gent vulgui veure les curses, les sabatilles i els tracks a TRAM i no en cap altre lloc. La web ha de ser visualment innovadora i ha de semblar feta a mà per gent que corre. Cap pantalla ha de semblar una plantilla ni un disseny generat per IA.

---

## 2. Principis no negociables [DECIDIT]

1. **Equilibri asfalt/trail.** Cap pantalla, component, color o text no pot inclinar-se cap a un sol món. Si un component funciona molt bé per a trail, cal que tingui un "mode de lectura" igual de bo per a asfalt, i al revés.
2. **L'HTML primer, el 3D després.** El contingut es serveix com a HTML estàtic. El 3D i els gràfics interactius són una millora progressiva i mai no bloquegen el LCP ni la indexació.
3. **Cada forma és una dada.** Les visualitzacions es generen a partir de dades reals. No es fan servir decoracions que imitin dades.
4. **Res per defecte.** Cap tipografia, paleta, tema de gràfics ni component s'utilitza amb la configuració de fàbrica.
5. **Mòbil com a pantalla principal.** Moltes visites arribaran des del mòbil i amb mala cobertura. Primer es dissenya i es mesura a 390 px.
6. **Design system abans que pàgines.** Tota la UI surt d'un sistema de tokens i components modulars. Les pàgines només composen components; no tenen estils propis. Un canvi de color, de tipografia o d'espaiat es fa en un sol lloc i arriba a tota la web, als gràfics, al 3D i a les imatges per compartir.

---

## 3. Arquitectura [DECIDIT]

| Capa | Tecnologia | Notes |
|---|---|---|
| Framework | **Astro 6** | Prerender per defecte, *server islands* per a dades vives, renderitzat sota demanda només on calgui |
| Hosting | **Cloudflare** (Workers + R2) | R2 per als assets 3D (terrenys, splats, pòsters) |
| Dades | **Supabase (Postgres + PostGIS)** | Consultes geogràfiques del calendari. Content Layer d'Astro amb loaders propis |
| 3D | **Three.js** "vanilla" dins d'illes | `WebGPURenderer` amb fallback automàtic a WebGL 2; shaders en **TSL** |
| Visor de rutes realista | **MapLibre GL JS** | Ortofoto i relleu de l'ICGC sobre terreny 3D; mode per defecte del visor, amb commutador al cartogràfic (E02) |
| Gràfics 2D | **Apache ECharts 6**, importació modular i renderitzat SVG al servidor | Vegeu la secció 9 |
| UI interactiva | Illes lleugeres (framework pendent: vegeu E10) | Sense React, llevat que E10 en demostri la necessitat |
| Design system | Paquet propi `packages/design-system`: tokens en format DTCG (JSON) → CSS custom properties, tema ECharts, constants per a Three.js i estils de les imatges OG | Única font de veritat visual. Vegeu la secció 6 |
| Estils | CSS natiu amb custom properties generades pel design system i *cascade layers* | Si es fa servir Tailwind v4, només amb un `@theme` generat a partir dels tokens i la paleta per defecte desactivada |
| Tipografia | Autoallotjada amb l'API de fonts d'Astro, amb subconjunt de glifs | Vegeu 7.2 i E8 |
| Cerca | Pendent (vegeu E13) | |

### Mode de renderitzat per pàgina

| Pàgina | Ruta (ca) | Renderitzat | 3D / gràfics |
|---|---|---|---|
| Inici | `/ca/` | Prerender | Hero 3D amb pòster SVG (moment firma M1) |
| Calendari | `/ca/curses/` | Prerender | Visualització "l'any com a perfil" (E7) + llista |
| Calendari per faceta | `/ca/curses/trail/girona/`, `/ca/curses/marato/2027/` | Prerender, generades a partir de les facetes amb contingut | Llista + mapa estàtic |
| Fitxa de cursa | `/ca/curses/[slug]/` | Prerender + *server island* (inscripcions, meteo) | Visor 3D + perfil i parcials (ECharts SSR) |
| Edició anterior | `/ca/curses/[slug]/[any]/` | Prerender | Resultats i perfil |
| Track / ruta | `/ca/rutes/[slug]/` | Prerender | Visor 3D |
| Catàleg de sabatilles | `/ca/sabatilles/` | Prerender | Mapa del catàleg (gràfic de dispersió pes/stack) |
| Fitxa de sabatilla | `/ca/sabatilles/[marca]/[model]/` | Prerender | Radiografia paramètrica (+ splat si n'hi ha) |
| Comparador | `/ca/comparar/[a]-vs-[b]/` | Prerender per a parelles populars, sota demanda amb cache per a la resta | Radiografia superposada (M3) |

- **Slugs localitzats:** `/es/carreras/`, `/es/zapatillas/`, `/en/races/`, `/en/shoes/`, etc.
- **URL canònica del comparador:** els models sempre en ordre alfabètic (`a-vs-b`). L'ordre invers fa una redirecció 301 per evitar contingut duplicat.

---

## 4. Estructura del repo

```
tram/
├─ apps/web/                      # Astro 6
│  ├─ src/
│  │  ├─ pages/[lang]/...         # rutes localitzades
│  │  ├─ content/                 # loaders del Content Layer (Supabase)
│  │  ├─ sections/                # composicions de pàgina fetes NOMÉS amb components del DS
│  │  ├─ islands/                 # muntatge de components interactius del DS
│  │  ├─ three/
│  │  │  ├─ core/                 # renderer, loop, gestió de visibilitat, mesura de rendiment
│  │  │  ├─ route-viewer/         # visor de rutes
│  │  │  └─ shoe-xray/            # radiografia paramètrica i splats
│  │  ├─ charts/
│  │  │  ├─ ssr.ts                # renderToSVGString en build
│  │  │  └─ specs/                # una funció per tipus de gràfic (perfil, parcials...)
│  │  ├─ pages/ds/                # catàleg viu del design system (noindex, fora de producció)
│  │  └─ i18n/
├─ packages/
│  ├─ design-system/              # ← ES CONSTRUEIX PRIMER (secció 6)
│  │  ├─ tokens/                  # font de veritat en DTCG JSON: ref → sys → comp
│  │  ├─ build/                   # generadors: CSS, tema ECharts, constants Three.js, OG
│  │  ├─ dist/                    # sortida generada (no s'edita a mà)
│  │  ├─ styles/                  # reset, cascade layers, tipografia base
│  │  ├─ primitives/              # components bàsics .astro (zero JS)
│  │  ├─ patterns/                # components de domini (dorsal, perfil, taula de parcials...)
│  │  ├─ interactive/             # components amb JS (filtres, lliscadors, Viewer3DShell)
│  │  ├─ icons/                   # pictogrames propis en SVG
│  │  └─ CHANGELOG.md
│  ├─ terrain-pipeline/           # GPX → model d'elevacions → glTF + pòster
│  ├─ shoe-geometry/              # geometria paramètrica de sabatilles (TS pur, amb tests)
│  └─ formats/                    # formatació de ritmes, distàncies i desnivells (Intl, ca/es/en)
├─ supabase/migrations/
└─ docs/explorations/             # resultats de les exploracions E01–E17
```

---

## 5. Model de dades (esbós inicial)

Esquema orientatiu: ajusta'l, però mantén-ne els principis (font de cada dada, i18n i geometria nativa).

```sql
-- Curses
create type terrain as enum ('road', 'trail', 'mixed');

create table races (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  terrain terrain not null,
  country_code char(2) not null,
  region text,
  location geography(Point, 4326),
  organizer text
);

create table race_editions (
  id uuid primary key default gen_random_uuid(),
  race_id uuid references races on delete cascade,
  year int not null,
  start_date date not null,
  status text not null,              -- scheduled | cancelled | postponed | finished
  registration_url text
);

create table race_courses (            -- una edició pot tenir diverses distàncies
  id uuid primary key default gen_random_uuid(),
  edition_id uuid references race_editions on delete cascade,
  name text not null,
  distance_m int not null,
  elevation_gain_m int,
  elevation_loss_m int,
  time_limit interval,
  route_id uuid references routes
);

-- Rutes i tracks
create table routes (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  geom geography(LineStringZ, 4326) not null,
  terrain_asset_url text,            -- glTF a R2 generat pel pipeline
  poster_url text,                   -- imatge estàtica per al LCP
  stats jsonb                        -- pendents per tram, punt més alt, etc.
);

create table route_pois (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references routes on delete cascade,
  km numeric(6,3) not null,
  kind text not null,                -- aid_station | summit | checkpoint | km_marker | landmark
  geom geography(Point, 4326)
);

-- Sabatilles
create table shoes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands,
  slug text unique not null,
  model text not null,
  version text,
  terrain terrain not null,
  category text not null,            -- daily | tempo | race | technical | ultra ...
  release_date date
);

create table shoe_specs (
  shoe_id uuid primary key references shoes on delete cascade,
  size_ref text not null,            -- talla de referència de la mesura (p. ex. EU 42)
  weight_g int,
  stack_heel_mm numeric(4,1),
  stack_forefoot_mm numeric(4,1),
  drop_mm numeric(4,1) generated always as (stack_heel_mm - stack_forefoot_mm) stored,
  plate text,                        -- none | carbon | nylon | pebax | rock_plate ...
  rocker_apex_pct numeric(4,1),      -- posició de l'àpex del rocker (% de la longitud)
  toe_spring_deg numeric(4,1),
  heel_bevel_deg numeric(4,1),
  width_forefoot_mm numeric(4,1),
  width_heel_mm numeric(4,1),
  midsole_layers jsonb,              -- [{compound, thickness_mm, position}]
  outsole_compound text,
  lug_depth_mm numeric(3,1),         -- null en asfalt
  source text not null,              -- lab | manufacturer | mixed
  measured_at date
);
```

- **i18n:** noms i descripcions en taules `*_translations (entity_id, locale, field, value)` o columnes `jsonb` per idioma. Tria-ho a E12.
- **Geometria de la sabatilla:** els camps de `shoe_specs` són el mínim que necessita `packages/shoe-geometry` per generar la silueta paramètrica. Si E05 en necessita més, afegeix-los aquí i documenta'ls.

---

## 6. Design system [DECIDIT · ES FA PRIMER]

### 6.1 Per què primer i per què és imperatiu

TRAM té tres pilars visualment molt diferents (visor 3D, comparador i calendari), dos mons (asfalt i trail), dos temes (clar i nit), tres idiomes i, a més del web, gràfics, escenes 3D i imatges per compartir. Sense un sistema comú, cada peça acabaria amb els seus colors, les seves mides i els seus botons, i cada canvi s'hauria de fer a desenes de llocs.

El design system existeix perquè:
- **Qualsevol canvi futur costi poc.** Canviar l'accent, la tipografia o l'espaiat és editar un token i regenerar. Arriba automàticament a la web, als gràfics ECharts, als materials del 3D i a les imatges OG.
- **La web sigui modular.** Les pàgines són composicions de components reutilitzables. Un component nou serveix per a tots els pilars.
- **L'estil propi no es degradi.** Les regles anti "look IA" (7.8) queden incorporades als components i als tokens, no a la memòria de qui programa.
- **Claude Code treballi més bé.** Amb un inventari de components i un contracte clar, cada pàgina nova és composició, no improvisació.

**Regla:** cap pàgina de producte es comença fins que la Fase 0 (secció 14) no està tancada. Si durant una fase posterior falta un component, s'atura la pàgina, es crea el component al design system i després es continua.

### 6.2 Arquitectura de tokens en tres nivells

Els tokens es defineixen en **format DTCG (JSON)** a `packages/design-system/tokens/` i es generen cap a tots els destins. Mai no s'editen els fitxers generats.

| Nivell | Prefix CSS | Què conté | Qui el pot fer servir |
|---|---|---|---|
| **Referència (ref)** | `--tram-ref-*` | Valors crus: la paleta de 7.3, la família tipogràfica, l'escala numèrica | Només els tokens de sistema |
| **Sistema (sys)** | `--tram-sys-*` | Rols: `surface`, `text`, `text-muted`, `rule`, `accent`, `data-road`, `data-trail`, `space-3`, `type-display-xl`... | Components |
| **Component (comp)** | `--tram-comp-*` | Decisions d'un component concret: `--tram-comp-bib-number-size`, `--tram-comp-profile-band-steep` | Només el seu component |

**Modes** (canvien els tokens de sistema, no els components):
- `data-theme="light" | "night"`: tema clar i "nit de cursa".
- `data-terrain="road" | "trail" | "mixed"`: canvia patrons, trames i accents de dades. Un mateix component es veu i es llegeix bé en tots dos mons, que és com es garanteix el principi d'equilibri.
- `data-density="comfortable" | "compact"`: per a taules i vistes denses (fulls de resultats, comparador).

Les pàgines i els components **mai no fan servir tokens `ref` directament**. Si un color no té rol de sistema, primer se li dona un rol.

### 6.3 Fonaments

Tots són tokens i tots tenen una fitxa al catàleg:

- **Tipografia:** escala fluida amb `clamp()` per a cada rol (display, text, dades), alçades de línia, tracking per a les condensades i `font-variant-numeric` per defecte en dades.
- **Espai:** escala basada en 4 px (`space-1` = 4 px ... `space-12`). Res de valors fora de l'escala.
- **Graella:** columnes, gutters i marges per breakpoint (7.4).
- **Línies:** gruixos amb nom (`rule-hairline` 1 px, `rule-contour`, `rule-route`), perquè una corba de nivell, un filet de taula i un traçat siguin coherents.
- **Radis:** només `0` i `2px`.
- **Moviment:** durades i corbes d'easing amb nom (`motion-quick`, `motion-route`...), i la versió reduïda de cada una.
- **Capes (z-index), breakpoints i mides d'icona.**

### 6.4 Inventari de components

**Primitives** (`primitives/`, .astro, zero JS):
- `Text`, `Heading`, `Link`, `Button`, `Rule`, `Icon`, `Figure`, `VisuallyHidden`.
- Composició: `Stack`, `Cluster`, `Grid`, `Split`, `Bleed`.
- **`Measure`**: qualsevol xifra amb unitat (distància, D+, ritme, pes, mm). Formata amb `packages/formats` segons l'idioma i mostra "—" si falta la dada. **Cap xifra de la web es pinta sense passar per `Measure`.**
- `DataTable`: taula amb estil de full de resultats, alineació numèrica, capçalera enganxosa i mode compacte.

**Components de domini** (`patterns/`):
- `Bib` (dorsal), `StatBlock` (bloc de xifres principals d'una cursa o d'una sabatilla), `TerrainTag`.
- `ElevationProfile` (SVG estàtic generat en build) i `SplitsTable`.
- `RaceRow` (fila de calendari, no una targeta de graella), `CalendarStrip` (M4).
- `ShoeSpecSheet` (fitxa tècnica amb cotes), `SpecDiff` (diferències entre models amb unitats i signe).
- `Legend`, `PoiPictogram`, `MapPoster`.

**Components interactius** (`interactive/`):
- `FilterBar`, `RangeSlider`, `SegmentedControl`, `Toggle`.
- **`Viewer3DShell`**: closca comuna a tota escena 3D. Gestiona el pòster, la càrrega diferida, el control per teclat, `prefers-reduced-motion`, l'equivalent textual i els errors. El visor de rutes i la radiografia de sabatilles hi viuen a dins, de manera que tot el 3D es comporta igual.

L'inventari creix, però sempre dins del paquet i amb fitxa al catàleg.

### 6.5 Contracte de cada component

Cada component s'entrega amb:
- **API tipada** (props en TypeScript) i variants expressades amb atributs `data-*`, no amb llistes de classes.
- **Tots els estats:** per defecte, hover, focus visible, actiu, desactivat, carregant, buit, error i **dada absent**.
- **Totes les combinacions de mode:** clar/nit, asfalt/trail, 390 px/1440 px i, si escau, compacte.
- **Accessibilitat:** rol, nom accessible, ordre de focus i contrast verificat.
- **Fitxa al catàleg** amb exemples amb dades reals i notes d'ús (quan s'ha de fer servir i quan no).
- **Captures de regressió visual** de cada combinació.

### 6.6 Regles i control automàtic

Les regles del sistema no depenen de la bona voluntat; les fa complir l'eina:
- **Stylelint** prohibeix colors hexadecimals, `rgb()`, mides en px i `z-index` numèrics fora de `packages/design-system`. Fora del paquet només es poden fer servir `var(--tram-sys-*)` i `var(--tram-comp-*)`.
- **ESLint** prohibeix importar tokens `ref` des de l'app i obliga a passar les xifres per `Measure` (regla pròpia per a literals numèrics amb unitats a les plantilles).
- **Regressió visual amb Playwright** (`toHaveScreenshot`) sobre les pàgines del catàleg, a cada PR. Un canvi de token mostra immediatament tots els components afectats.
- **CI:** si els fitxers generats (`dist/`) no coincideixen amb els tokens, la PR falla.

### 6.7 Catàleg viu

- Ruta interna `/ds/` dins de l'app Astro, amb els components reals (no còpies). `noindex` i exclosa del build de producció.
- Seccions: fonaments, primitives, components de domini, components interactius, i una pàgina per mode (clar/nit, asfalt/trail).
- Cada fitxa mostra el component amb dades reals, totes les variants i el codi d'ús.
- Si es valora Storybook o una altra eina, és a E17.

### 6.8 Canvis i versions

- Tot canvi de token o de component queda al `CHANGELOG.md` del paquet, amb captures abans/després.
- **Cap component no s'esborra ni canvia d'API sense deprecació:** es marca com a obsolet, s'indica el substitut i es migra tot l'ús abans d'eliminar-lo.
- Els canvis que afecten la identitat (paleta, tipografia, gruixos de línia) requereixen una revisió visual de les pàgines firma (M1–M6), no només del catàleg.

### 6.9 Un sol sistema per a web, gràfics, 3D i imatges

El generador de `build/` produeix, a partir dels mateixos tokens:
- `dist/tokens.css`: custom properties per a la web, amb els modes.
- `dist/echarts-theme.ts`: el tema "tram" d'ECharts (9.4).
- `dist/three.ts`: colors, gruixos i durades com a constants per a Three.js i uniforms de TSL, amb la gestió de l'espai de color correcta.
- `dist/og.ts`: estils per a les imatges Open Graph (E14).

Així, canviar l'accent o el gris del mode nit actualitza la web, el perfil altimètric, el traçat 3D i les imatges per compartir alhora.

---

## 7. Direcció visual

### 7.1 Concepte: "Cartografia de cursa" [DECIDIT com a punt de partida]

El llenguatge visual de TRAM neix de **tres objectes impresos reals de la cultura del córrer**, i cap d'ells és exclusiu d'asfalt ni de muntanya:

| Objecte | Què n'agafem | Món |
|---|---|---|
| **El mapa topogràfic** | Corbes de nivell, retícula, cotes, hipsometria, llegendes | Trail (però també ciutat: plànols urbans) |
| **El dorsal** | Números enormes i condensats, perforacions, imperdibles, xip de cronometratge | Tots dos |
| **El full de resultats / roadbook** | Taules denses, figures tabulars, parcials, ritmes, jerarquia per pes i no per color | Tots dos |

La signatura visual és el pas **de la quadrícula urbana a la corba de nivell**: la mateixa línia fina que dibuixa un carrer dibuixa una cota. Aquest és el punt d'unió entre asfalt i trail.

### 7.2 Tipografia

Tres rols:
- **Display:** grotesca condensada per a xifres grans (distància, desnivell, ritme), inspirada en el dorsal.
- **Text:** grotesca llegible per a cos de text i interfície.
- **Dades:** figures tabulars obligatòries (monoespaiada o grotesca amb `font-variant-numeric: tabular-nums`).

Requisits obligatoris per a qualsevol candidata:
- Figures tabulars i *lining*.
- Suport correcte del **punt volat català (l·l)**, amb un espaiat que no trenqui la paraula. Prova "col·lecció", "paral·lel" i "il·luminació" en tots els pesos.
- Font variable o, com a màxim, tres pesos per família.
- Subconjunt de glifs i autoallotjament.

Prohibides com a tipografia de marca: Inter, Roboto, Poppins, Montserrat, Open Sans, Space Grotesk, Geist i `system-ui`. Són les que fan que tot sembli una plantilla. La selecció final es fa a **E8**.

### 7.3 Color (hipòtesi inicial, a validar a E9)

Paleta de terreny i senyalització, no de tecnologia. Aquests són els tokens de **referència** (`--tram-ref-*`, vegeu 6.2); els components no els fan servir directament, sinó a través dels rols de sistema (`--tram-sys-accent`, `--tram-sys-surface`...).

| Token | Valor inicial | Ús |
|---|---|---|
| `--paper` | `#EFECE4` | Fons clar: paper de mapa, no blanc pur |
| `--ink` | `#141518` | Text i línies principals |
| `--graphite` | `#2B2D31` | Asfalt; superfícies fosques |
| `--road-line` | `#F2EEE3` | Marques vials; línies sobre fons fosc |
| `--signal` | `#FF5A1F` | **Únic accent**: color de balisa i senyalització. Només per a l'acció principal i per al punt actiu del recorregut |
| `--contour` | `#9C6237` | Corbes de nivell (només en mapes i dades) |
| `--moss` | `#5F6B3B` | Vegetació (només en mapes i dades) |
| `--water` | `#3E6D8A` | Aigua (només en mapes i dades) |

- **Mode nit ("nit de cursa"):** fons `#0E0F11`, gris carbó neutre i mai blau pissarra. Text `#E8E5DC`. L'accent de senyal es manté i fa de llum de frontal.
- **Asfalt i trail no es diferencien només per color:** cal combinar-hi patró (traç continu o discontinu, trama), etiqueta o forma. Res de blau per a asfalt i verd per a muntanya.

### 7.4 Graella i composició

- 12 columnes en escriptori i 4 en mòbil, amb una retícula de base de 4 px.
- **Composició editorial i asimètrica:** xifres que ocupen mitja pantalla, taules denses al costat de grans buits.
- **La profunditat s'expressa amb línies i superposicions, no amb ombres.** Filets d'1 px com a la retícula d'un mapa.
- Radis de cantonada de 0 a 2 px. Els elements que imiten un dorsal poden tenir perforacions, però no cantonades arrodonides grans.
- Les dades numèriques sempre s'alineen per la dreta i amb figures tabulars.

### 7.5 Moviment

- **El moviment ve del terreny i de les dades.** Les línies es dibuixen seguint el recorregut, les corbes de nivell apareixen per alçada i la càmera avança pel track. No es fan fades genèrics.
- Microinteraccions de 160 a 320 ms. Les transicions de càmera 3D són contínues i controlades per l'usuari (scroll o lliscador).
- Amb `prefers-reduced-motion`: pòster estàtic, cap càmera automàtica i control manual pas a pas.
- Línia oberta: corbes d'easing derivades de perfils altimètrics reals (vegeu E15).

### 7.6 Imatge i iconografia

- **Fotografia real** de curses i sabatilles: amb gra, llum natural i fang i asfalt mullat. **Cap imatge generada per IA**, ni com a placeholder visible.
- **Iconografia pròpia** dibuixada amb el mateix gruix de traç que les corbes de nivell. Es fan servir pictogrames de cartografia (avituallament, cim, control, quilòmetre), no icones genèriques de llibreria.
- **Les sabatilles** es mostren amb la radiografia paramètrica o amb splats escanejats per nosaltres. No es fan servir fotos de màrqueting de les marques.

### 7.7 Moments firma

Són les peces que han de fer que la gent comparteixi TRAM. Cada una s'ha de polir fins al nivell final abans d'escalar.

- **M1 · Inici, "De la quadrícula a la corba de nivell".** El hero és un terreny en línies que, en fer scroll, passa d'un plànol urbà (una marató real) al relleu d'una cursa de muntanya real. Primer es carrega un pòster en SVG inline del primer fotograma, i el 3D s'hidrata a sobre.
- **M2 · Fitxa de cursa, "Recórrer el tram".** Un vol pel recorregut controlat amb scroll, amb el perfil altimètric enganxat a la part inferior i les dades presentades com en un full de resultats.
- **M3 · Comparador, "Radiografia".** Dues siluetes paramètriques superposades i alineades al taló, amb cotes de plànol tècnic (mm) que apareixen sobre les diferències.
- **M4 · Calendari, "L'any com a perfil".** L'any dibuixat com una franja horitzontal. Cada cursa és una marca: l'alçada correspon al D+ i el gruix a la distància. Asfalt a dalt i trail a baix d'una línia central, de manera que l'equilibri entre tots dos es veu literalment (vegeu E7).
- **M5 · Imatges per compartir.** Cada cursa, ruta i comparació té una imatge Open Graph generada en build amb el seu perfil real i tipografia de dorsal (vegeu E14).
- **M6 · Transicions.** El perfil d'una cursa al calendari es transforma en el perfil de la fitxa quan s'hi navega, amb una transició d'element compartit (vegeu E11).

### 7.8 Anti-patrons: llista prohibida [DECIDIT]

Si una pantalla té qualsevol d'aquests elements, no està acabada:

- Degradats violeta, blau o rosa; text amb degradat; "blobs" d'aurora; glassmorphism; fons de soroll animat.
- Graelles de targetes idèntiques amb `border-radius: 16px` i ombra suau.
- Hero amb titular centrat, subtítol, dos botons i un mockup.
- Tipografies de la llista prohibida (7.2). Paleta per defecte de Tailwind (`slate`, `indigo`...). Mode fosc blau pissarra (`#0f172a`).
- Icones genèriques (Lucide, Heroicons...) com a decoració. Emojis a la UI.
- Animacions de "fade-up" a cada bloc en fer scroll. Comptadors animats sense motiu.
- Gràfics amb el tema per defecte de qualsevol llibreria.
- Gràfics de radar per comparar sabatilles: són el clixé del sector. Cal buscar alternatives (vegeu 9.3).
- Valoracions amb estrelles, insígnies "New" brillants o "AI-powered".
- Copy buit de màrqueting: "Descobreix", "Eleva la teva experiència", "Desbloqueja", "El futur del running".
- Imatges generades per IA.

### 7.9 Veu i formatació

- **To:** tècnic, precís, apassionat pel terreny i analític. Verbs concrets i xifres. Cap superlatiu sense dada que el sostingui.
- **Formatació de xifres:** sempre amb `Intl.NumberFormat` segons l'idioma (`packages/formats`). En català: `42,195 km`, `1.250 m D+`, `4:15 /km`.
- **Ritme en trail:** el ritme per quilòmetre enganya a la muntanya. Mostra també la velocitat vertical (m/h) i el **km-esforç** (km + D+/100).

---

## 8. Pilars en detall

### 8.1 Visor 3D de rutes

**Pipeline en build (`packages/terrain-pipeline`):**
1. GPX → simplificació → *bounding box* amb marge.
2. Model d'elevacions: **ICGC** (Catalunya, alta resolució) i **Copernicus GLO-30** (resta del món). Verifica les llicències i atribucions de cada font i documenta-les.
3. Malla o *heightmap* (format pendent: vegeu E01) + textura cartogràfica o ortofoto (vegeu E02).
4. Sortida: glTF amb compressió meshopt i textures KTX2, pujat a R2, més un **pòster estàtic** (AVIF + SVG del traçat) per al LCP.

**Runtime:**
- Primer es mostra el pòster. La illa s'hidrata quan és visible i el navegador està lliure.
- El traçat és un tub o una cinta amb shader TSL: progrés, color per pendent o per ritme, i el punt actiu en `--signal`.
- La càmera segueix una spline, controlada per scroll o per un lliscador de velocitat.
- El perfil altimètric 2D (ECharts) està sincronitzat en tots dos sentits: passar per sobre del perfil mou el punt al 3D, i al revés.
- Controls de teclat: les fletxes avancen i retrocedeixen per quilòmetre.
- **Mode asfalt:** vegeu E03. Un terreny pla en 3D és avorrit, i cal una solució específica.
- **Mode trail:** exageració vertical configurable (×1 a ×2,5), ombrejat del relleu i corbes de nivell.

### 8.2 Comparador de sabatilles (tres capes)

- **A · Radiografia paramètrica (tot el catàleg).** La geometria es genera a partir de `shoe_specs`: stack, drop, rocker, toe spring, bisell del taló, capes d'escuma, placa i tacs. L'estètica és la d'un plànol tècnic amb cotes. Es poden superposar dues o tres sabatilles alineades al taló o a la punta. No necessita cap asset extern. Tècnica pendent: vegeu E05.
- **B · Escàner real (models destacats).** Splats gaussians de les unitats que comprem i escanegem nosaltres. L'efecte firma és una transició del splat real a la radiografia (vegeu E06). L'ús de logotips i noms de marca està pendent de revisió legal.
- **C · Dades de laboratori animades.** Compressió de la mitjasola en el moment del contacte, **només amb valors mesurats per nosaltres** (duròmetre, retorn d'energia, compressió). Sense mesures, aquesta capa no existeix.

**Interacció:** lliscador de mode radiografia, vista explosionada de capes, commutador superposat/costat a costat i mesures en mm sobre les diferències. En mòbil, la vista superposada és la predeterminada.

**SEO:** la taula completa d'especificacions és en HTML a cada URL de comparació. El 3D se suma a la taula; no la substitueix.

### 8.3 Calendari

- Les pàgines per faceta (terreny × territori, distància × any...) es generen **només si tenen contingut**, per no crear pàgines buides.
- Els filtres al client són una illa que treballa sobre un índex JSON precalculat.
- La visualització "l'any com a perfil" (M4) conviu sempre amb una llista accessible.

---

## 9. Gràfics 2D: ritmes, desnivell, parcials [DECIDIT, amb una exploració oberta]

### 9.1 Decisió: Apache ECharts 6, no Chart.js

**Motiu principal: el renderitzat al servidor.** ECharts pot generar el gràfic com a cadena SVG al servidor, sense cap dependència nativa i amb animació inicial inclosa. Des de la 5.5 hi ha a més un runtime lleuger de client que permet algunes interaccions sense carregar tota la llibreria. Encaixa perfectament amb Astro: el gràfic es genera en build, arriba com a SVG inline, no necessita JS i és indexable.

**Per què no Chart.js:** renderitza només a canvas, de manera que no aporta HTML indexable ni SSR natiu sense dependències com node-canvas. És més fàcil d'usar però menys personalitzable, i aquí la personalització és imprescindible.

**Atenció al pes:** ECharts sencer és gran. Només s'importa de manera modular (`echarts/core` + els gràfics i components necessaris), i la versió completa només es carrega a la illa quan l'usuari hi interactua.

### 9.2 Estratègia en tres nivells

| Nivell | Quan | Com | JS al client |
|---|---|---|---|
| **1 · Estàtic** | Per defecte (fitxes, llistes, imatges OG) | `renderToSVGString()` en build → SVG inline | 0 |
| **2 · Lleuger** | Ressaltats i tooltips simples | SVG del servidor + runtime lleuger d'ECharts | Mínim |
| **3 · Complet** | Zoom, selecció de tram, sincronia amb el 3D | ECharts modular carregat en interactuar (`client:visible` + intenció) | Complet, però diferit |

### 9.3 Catàleg de gràfics

| Gràfic | Tipus | Notes de disseny |
|---|---|---|
| **Perfil altimètric** | Àrea | Bandes de pendent **discretes** (no degradat continu), POIs com a pictogrames, quilòmetres sota l'eix |
| **Parcials i ritmes** | Barres per km + línia de ritme objectiu | En asfalt: ritme. En trail: ritme + velocitat vertical + km-esforç |
| **Comparativa de sabatilles** | Barres divergents o *slope chart* entre models | Mai gràfics de radar (7.8) |
| **Mapa del catàleg** | Dispersió pes × stack, forma per terreny | Clicar un punt obre la fitxa; selecciona dos punts i es comparen |
| **Distribució del calendari** | Barres per mes, asfalt amunt i trail avall | Coherent amb M4 |

### 9.4 Tema "tram"

- El tema d'ECharts el genera el design system (`packages/design-system/dist/echarts-theme.ts`, vegeu 6.9) **a partir dels mateixos tokens que la web**: hi ha una sola font de veritat, i el tema per defecte d'ECharts mai no s'utilitza.
- Cada tipus de gràfic de 9.3 és un component del design system amb fitxa al catàleg, no una configuració solta dins d'una pàgina.
- Eixos amb filets d'1 px, quadrícula com la d'un mapa, xifres tabulars, cap llegenda flotant si es pot etiquetar directament, i tooltips amb format de full de resultats.
- Accessibilitat: activa el mòdul `aria` d'ECharts i ofereix sempre una taula HTML equivalent.

---

## 10. Rendiment: pressupostos [DECIDIT]

Mesurats en un mòbil de gamma mitjana amb 4G:

| Mètrica | Objectiu |
|---|---|
| LCP | < 1,8 s |
| CLS | < 0,05 |
| INP | < 150 ms |
| JS inicial en pàgines sense 3D | < 30 KB gzip |
| Illa 3D (Three.js inclòs) | < 250 KB gzip, carregada en diferit. Excepció: el mode realista del visor de rutes (MapLibre GL JS), 452 KB, que només es carrega si es tria (E02, 11-11-2026) |
| Assets de terreny, primera vista | < 1,5 MB, amb nivells de detall progressius |
| Primer fotograma 3D després d'hidratar | < 2 s |

- El 3D no s'executa mai en la càrrega inicial: només quan és visible i el navegador està lliure, o quan l'usuari hi interactua.
- Lighthouse CI a cada PR. Una regressió del pressupost bloqueja el merge.
- Dispositius de prova de referència: un iPhone de fa 3–4 anys i un Android de gamma mitjana (vegeu E04).

---

## 11. SEO i dades estructurades

- **schema.org:** `SportsEvent` per a cada edició (lloc, data, estat, inscripció), `Product` per a les sabatilles (sense `AggregateRating` si no hi ha valoracions reals) i `BreadcrumbList` arreu.
- `hreflang` entre ca, es i en; sitemaps dividits per tipus.
- **Text descriptiu del recorregut generat a partir de les dades** (per exemple, "pujada de 3,2 km al 8 % de mitjana al km 14"). Així el contingut del 3D també és indexable.
- Estratègia de dominis (`tramrun.com`, `.cat`, `.app`, `.run`): vegeu E12.

---

## 12. Accessibilitat

- Cada canvas 3D té una descripció textual i un equivalent en HTML (taula de trams, perfil en SVG).
- Visor i comparador controlables amb teclat.
- Contrast AA com a mínim; l'accent `--signal` sobre `--paper` s'ha de verificar per a text petit.
- El color no és mai l'única manera de codificar informació (asfalt/trail, pendents, models).

---

## 13. Línies d'exploració obertes [EXPLORACIÓ]

Format de cada exploració: **pregunta → hipòtesi → opcions → criteris → lliurable**. Prioritza les marcades amb ★, perquè bloquegen la Fase 0 (E08, E09, E16, E17) o la Fase 1.

### ★ E01 · Format del terreny
- **Pregunta:** quin és el format més lleuger amb bona qualitat a les carenes?
- **Opcions:** (a) *heightmap* de 16 bits com a textura + desplaçament al vertex shader; (b) malla RTIN/Martini precalculada; (c) quantized-mesh.
- **Criteris:** pes per km², qualitat a carenes i barrancs, temps de build i facilitat per tenir nivells de detall.
- **Lliurable:** comparativa amb una ruta de muntanya amb molt relleu i una d'urbana.

### ★ E02 · Llenguatge visual del terreny
- **Pregunta:** realista, cartogràfic o híbrid?
- **Hipòtesi:** cartogràfic per defecte (corbes de nivell en shader, hipsometria pròpia, ombrejat suau): és més propi, més lleuger i s'allunya de l'aspecte "Google Earth". L'ortofoto quedaria com a capa opcional.
- **Lliurable:** tres versions de la mateixa ruta, amb captures i mesures de pes.

### ★ E03 · Com fer espectacular una ruta d'asfalt plana
- **Opcions:**
  - (a) Edificis d'OSM extruïts amb estètica de maqueta (blanc mat, oclusió ambiental) i carrers com a fils.
  - (b) **"Cinta de ritme":** en recorreguts plans, l'eix vertical representa el ritme o els parcials en lloc de l'altitud, amb un commutador explícit perquè no s'interpreti com a desnivell.
  - (c) Plànol urbà en línies (coherent amb M1) amb el traçat en relleu.
- **Criteri clau:** que una marató sigui tan atractiva de veure com una ultra, sense enganyar sobre el desnivell real.

### ★ E04 · Renderer i rendiment real
- `WebGPURenderer` vs WebGL 2 forçat, per illa.
- Cal mesurar fotogrames per segon, temps fins al primer fotograma, memòria i temperatura del dispositiu en els dispositius de referència.
- **Lliurable:** taula de resultats i decisió per a cada illa.

### ★ E05 · Tècnica de la radiografia paramètrica
- **Opcions:** (a) perfil lateral 2D a partir de les dades + extrusió i *loft*; (b) SDF amb raymarching en TSL; (c) malla plantilla deformada per paràmetres.
- **Criteris:** fidelitat a les dades, estètica de plànol tècnic, superposició neta de dues o tres sabatilles, pes i mòbil.
- **Lliurable:** prototip comparant una sabatilla d'asfalt amb placa i una de trail amb tacs. Documenta el **mínim de dades** que necessita cada sabatilla.

### E06 · Pipeline de splats gaussians (capa B)
- **Opcions de renderitzat:** Spark (madur, sobre WebGL 2, llicència MIT) vs el renderer de splats natiu de Three.js per a WebGPU (comprova en quina versió està disponible). Si conviuen renderers diferents, cada illa en té un de propi.
- **Pipeline de captura:** mòbil vs torn giratori, nombre de fotos, il·luminació i fons.
- **Objectiu:** < 8 MB per model amb nivells de detall.
- **Lliurable:** un model escanejat de principi a fi i la transició de splat a radiografia.

### E07 · Calendari "l'any com a perfil"
- Valida la usabilitat de M4 respecte d'una llista amb ~300 curses reals: densitat, mòbil i interacció tàctil.
- **Lliurable:** prototip i proves amb 3–5 corredors (com a mínim, la meitat d'asfalt).

### ★ E08 · Tipografia
- Tria tres parelles candidates (display condensada + text + dades). Considera tant foneries independents de pagament com opcions obertes amb caràcter.
- Prova-les amb dades reals: dorsals, taules de parcials, `l·l` i figures tabulars, a 390 px.
- **Lliurable:** làmina comparativa i recomanació amb el cost de llicència.

### E09 · Color i mode nit
- Valida la paleta de 7.3 sobre mapes, gràfics i fotografia real. Comprova el contrast i la llegibilitat de `--signal` al sol (pantalla al màxim de brillantor, a l'exterior).

### E10 · Framework de les illes
- Svelte 5 vs Preact vs Web Components purs. Mesura el pes i l'ergonomia per al filtre del calendari i el comparador.

### E11 · Transicions entre pàgines
- View Transitions natives entre documents (CSS) vs el `ClientRouter` d'Astro. Objectiu: l'element compartit del perfil del calendari a la fitxa (M6) sense penalitzar el rendiment.

### E12 · Dominis, idiomes i i18n de dades
- `tramrun.cat`: servir `/ca/` amb domini propi o fer una 301 a `tramrun.com/ca/`. Cal analitzar l'impacte en SEO, la marca i el manteniment.
- Paper de `tramrun.app` (eines) i de `tramrun.run`.
- Model de traduccions a la base de dades (secció 5).

### E13 · Cerca
- Pagefind (índex estàtic generat en build) vs cerca a Postgres amb PostGIS. Probablement una combinació: Pagefind per al text i PostGIS per a "a prop de".

### E14 · Imatges Open Graph generades
- Generació en build amb el perfil real i tipografia de dorsal (Satori o SVG → PNG). Han de cridar l'atenció en un timeline de xarxes socials.

### ★ E15 · El perfil altimètric firma: ECharts o SVG artesanal
- **Pregunta:** el perfil sincronitzat amb el 3D (M2) és la peça més vista de la web. ECharts amb tema propi n'hi ha prou per arribar a un acabat de nivell editorial, o cal un SVG artesanal amb `d3-shape` + `d3-scale` (molt més lleuger i amb control total)?
- **Criteris:** acabat visual, pes, sincronia amb el 3D a 60 fps, SSR i manteniment.
- **Hipòtesi:** ECharts per a la resta de gràfics; el perfil firma potser artesanal.
- **Extra:** prova easings derivats de perfils reals per a les transicions (7.5).

### ★ E16 · Eina de generació de tokens
- **Pregunta:** com es generen els destins (CSS, ECharts, Three.js, OG) a partir dels tokens DTCG?
- **Opcions:** (a) Style Dictionary; (b) un script propi en TypeScript; (c) una combinació (Style Dictionary per al CSS i transformadors propis per a ECharts i Three.js).
- **Criteris:** suport complet de DTCG i de modes (tema, terreny, densitat), facilitat per afegir destins nous, temps de build i errors clars quan un token falta.
- **Lliurable:** pipeline funcionant amb els tokens de color i espai, i els quatre destins generats.

### ★ E17 · Catàleg i regressió visual
- **Pregunta:** n'hi ha prou amb el catàleg intern `/ds/` dins d'Astro, o val la pena una eina com Storybook (comprova l'estat del suport per a components `.astro`)?
- **Criteris:** fidelitat (components reals, no còpies), cost de manteniment, velocitat de la regressió visual a CI i facilitat perquè dissenyadors no tècnics revisin els components.
- **Hipòtesi:** catàleg intern a Astro + Playwright per a la regressió visual.
- **Lliurable:** catàleg amb els fonaments i tres components complets (un de cada tipus) i la regressió funcionant a CI.

---

## 14. Full de ruta

| Fase | Abast | Criteri de sortida |
|---|---|---|
| **F0 · Design system i fonaments** | **Primer:** paquet `design-system` amb tokens (E16), fonaments, tipografia (E8), color (E9), primitives, primers components de domini (`Measure`, `DataTable`, `Bib`, `StatBlock`, `ElevationProfile`, `Viewer3DShell`), catàleg `/ds/` i regressió visual (E17), regles de lint. **Després:** repo, Astro 6, Cloudflare i esquema de Supabase | El catàleg sencer ja sembla TRAM i no una plantilla; un canvi de token es propaga a web, gràfics i 3D sense tocar cap pàgina. **Cap pàgina de producte abans de tancar F0** |
| **F1 · Vertical slice "1 + 1 + 2"** | **Una cursa d'asfalt i una de muntanya** amb visor 3D i perfil; **dues sabatilles** (asfalt i trail) amb radiografia i comparador. Exploracions ★ | Nivell visual final. És la demo que ha de fer dir "vull veure-ho tot aquí" |
| **F2 · Calendari** | Facetes SEO, filtres, M4, cerca, imatges OG | Indexació correcta i pressupost complert amb 300+ curses |
| **F3 · Catàleg i escàners** | Catàleg complet, mapa del catàleg, pipeline de splats (E06) | |
| **F4 · Escala internacional** | es/en, dominis, fonts de dades globals | |

**Regla:** no s'escala cap pilar fins que la seva peça a F1 no és al nivell visual final.

---

## 15. Glossari (ca)

| Terme | Ús correcte | Evitar |
|---|---|---|
| Sabatilla / calçat | "sabatilles de trail" | "zapatilla", "vamba" en textos formals |
| Amortiment / esmorteïment | "amortiment al taló" | "amortiguació" |
| Desnivell positiu | "1.250 m D+" | "desnivell acumulat" sense especificar el signe |
| Drop | diferència d'stack entre taló i avantpeu, en mm | |
| Stack | alçada de la sola, en mm, al taló o a l'avantpeu | |
| Rocker | curvatura longitudinal de la sola | "balancí" a la UI |
| Placa | placa de carboni, de niló, de Pebax o placa de protecció (rock plate) | |
| Tacs | relleu de la sola exterior en trail (mm) | "tacos" |
| Avituallament | punt d'avituallament de la cursa | "avituallament líquid" com a categoria única |
| Km-esforç | km + D+/100 | |
| Ritme | min/km ("4:15 /km") | "pace" a la UI en català |
| Parcial | temps d'un tram o d'un quilòmetre | "split" a la UI en català |
