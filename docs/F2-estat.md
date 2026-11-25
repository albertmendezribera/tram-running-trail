# Fase 2 · Estat

**Data:** 2026-11-15 · **Encàrrec (CLAUDE.md 14):** «Facetes SEO, filtres, M4, cerca, imatges OG. Criteri de sortida: indexació correcta i pressupost complert amb 300+ curses.»

La fase es va començar amb la Fase 1 sense tancar (hi falta una cursa d'asfalt amb recorregut), per decisió del titular.

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Exploració de fonts (E19) | `docs/explorations/E19-race-data-sources.md` | Feta |
| Importador de curses | `apps/web/scripts/import-calendar.mjs` (`pnpm --filter @tram/web import-calendar`) | Fet per a sis fonts, més les proves llegides a mà al web del seu organitzador. Es corre a mà |
| Calendari | `/ca/curses/` | **326 curses i marxes** de 2026 i 2027 (223 de properes), mes a mes, amb salts per mes |
| Filtres | `/ca/curses/` | Fets: per tipus (asfalt, muntanya, cros, marxes), per distància i per comarca. Una illa petita sobre un índex que ja ve amb la pàgina; la tria queda a l'adreça i es pot enllaçar. **Sense filtre per desnivell**: cap font el dona |
| Cerca per nom | `/ca/curses/` | Feta dins del calendari: un camp que cerca al nom i a la població de cada prova, sense mirar accents ni majúscules, lletra a lletra, i que es combina amb els filtres. Queda a l'adreça (`?cerca=`). No és la cerca de tot el web (E13) |
| Pàgines per faceta | `/ca/curses/trail/`, `/ca/curses/baix-emporda/`, `/ca/curses/trail/baix-emporda/`, `/ca/curses/marato/`, `/ca/curses/marato/2027/` | Fetes: per tipus (asfalt, trail, cros, marxes), per comarca, tipus × comarca, per distància (5 km, 10 km, mitja, marató, ultra) i distància × any. Només existeixen les que tenen dues proves o més (`FACET_MIN_RACES`). Cada una porta la llista, la regla que hi fa entrar una prova, un mapa estàtic en SVG i enllaços als talls veïns. S'hi arriba des del calendari i des de la fitxa de cada prova |
| Mapa de comarques | `LocatorMap` + `apps/web/scripts/import-comarques.mjs` | Fet: els límits de les 43 comarques són de l'ICGC (CC BY 4.0), aprimats a 600 m. Un punt per lloc amb proves; a les pàgines d'una comarca, el mapa s'hi acosta |
| Sitemaps i `robots.txt` | `apps/web/scripts/sitemap.mjs`, enganxat a la compilació | Fets: un sitemap per tipus de pàgina (curses, rutes, sabatilles, comparar, pàgines) i un índex, escrits a partir de les pàgines que la compilació ha fet. Hi surt tota pàgina que no porta `noindex`, amb la seva adreça canònica; res s'hi apunta a mà. `check-sitemap` ho comprova al CI. La compilació de staging no en té, i el seu `robots.txt` no anomena cap sitemap |
| Camí de la pàgina (`BreadcrumbList`) | `SiteTrail`, a `layouts/Site.astro` | Fet: totes les pàgines menys la portada mostren d'on pengen, i les que s'ofereixen als cercadors els ho diuen amb `BreadcrumbList` (CLAUDE.md 11). Una pàgina amb `noindex` mostra el camí i no en diu res als cercadors |
| «L'any com a perfil» (M4) | `/ca/curses/`, `CalendarStrip` | Fet, repensat (E07): una franja per any amb una marca per prova, asfalt amunt i muntanya avall, apilades per setmana, amb el gruix segons la distància. L'alçada no és el desnivell, que cap font dona. Cada mes porta a la seva part de la llista |
| Fitxa d'una cursa del calendari | `/ca/curses/<slug>/` | Feta: fets, estat, web de la cursa i fonts. Sense recorregut ni desnivell |
| Properes curses a la portada | `/ca/` | Fet: les sis següents |
| Fila compacta per a llistes llargues | `RaceRow` amb `compact` | Feta al sistema de disseny |
| Imatges per compartir (M5) | `/og/…` | Fetes a la Fase 1 per a curses amb recorregut; les del calendari no en tenen |

## Què falta de l'encàrrec

- **300 curses:** n'hi ha 324, i **103 poden anar a producció** (eren 13): les de dades obertes de Barcelona i les que el seu organitzador confirma al seu propi web (vegeu «El que diu cada organitzador», més avall). Les altres 221 segueixen esperant: el permís de la seva font, o que el web de l'organitzador en digui la data.
- **Facetes que no hi són:** per província o per municipi (les fonts donen municipi i comarca; la província només es podria deduir), per any sol i tipus × any. Les pàgines per faceta no tenen imatge per compartir.
- **`hreflang`:** el web només és en català; quan hi hagi castellà i anglès, cada pàgina i els sitemaps han de dir les seves germanes. Els sitemaps tampoc diuen `lastmod`: no hi ha una data fiable de l'últim canvi de cada pàgina.
- **M4 sense validar:** la franja està feta, però la prova amb 3–5 corredors que demana E07 no. No segueix els filtres ni la cerca.
- **Cerca de tot el web** (E13): la del calendari hi és, per nom i població; cercar sabatilles, rutes o «a prop de» no.
- **Base de dades:** les curses viuen en un fitxer. El projecte de Supabase l'ha de crear el titular.
- **Tracks:** cap cursa del calendari en té.

## Què no s'ha verificat

- **Cap cursa s'ha comprovat contra el web del seu organitzador**, i les dates són les del dia de la consulta.
- **Permisos:** només les 12 curses de Barcelona i la marxa llegida al web del seu organitzador poden anar a producció. La resta no hi entra (`docs/revisio-legal.md`).
- **El terreny de 137 proves no se sap**, i 53 no tenen comarca reconeguda (noms de barri, o en castellà, a la font).
- **Rendiment de la llista** en un mòbil real: són 326 files en una sola pàgina.
- **Les pàgines per faceta** s'han mirat a Chromium, a mida d'escriptori i de mòbil. A staging totes porten `noindex`, perquè totes llisten alguna prova d'una font sense permís: que una faceta només amb proves de font oberta surti indexable i amb `ItemList` no s'ha pogut veure en una pàgina real.
- **El mapa** situa cada prova al centre del seu municipi (o al punt que dona Barcelona per a les seves): no és on és la sortida. Les proves sense municipi reconegut no hi surten, i la pàgina diu quantes són.
- **La regla de les distàncies** és meva: 5 km i 10 km amb 100 m de marge, mitja de 21,0 a 21,2 km, marató de 42,0 a 42,4 km, ultra a partir d'aquí. Una cursa de muntanya de 42 km surt a «Maratons».
- **Els sitemaps** no els ha llegit cap cercador: el domini de producció no està publicat ni decidit (E12), i les adreces hi surten amb `https://tramrun.com`.
- **La cerca** només mira el nom i la població: no troba una prova per la comarca (té el seu filtre), per l'organitzador ni per la data, i no perdona errors d'escriptura.
- **Els filtres** s'han provat a Chromium, a mida d'escriptori i de mòbil. Sense JavaScript no es mostren i la llista queda sencera.
- **Les opcions sense dada**: 109 proves no diuen el terreny i 78 no diuen la distància. Tenen la seva opció al filtre, però no surten sota «Asfalt» o «Muntanya» encara que ho siguin.

## El que diu cada organitzador (25 de novembre de 2026)

Encàrrec del titular davant de «només 13 curses poden anar a producció»: «resol-ho tu», amb font pròpia. S'ha anat al web de qui organitza cada cursa i s'hi ha llegit el nom, la data, el lloc i les distàncies. Una cursa que el seu organitzador confirma guanya la font `own`, que és la que la deixa entrar a producció sense dependre del calendari on es va trobar.

- **Què s'ha mirat:** les 175 curses que vénen (se n'han arribat a mirar 108, per ordre de data; la resta, de febrer de 2027 endavant, s'està mirant en una segona tanda) i les 79 ja disputades que tenien el web apuntat. Les 59 ja disputades sense web no s'han mirat.
- **Què n'ha sortit:** 90 de confirmades i fetes servir. El calendari de producció passa de 13 a **103 curses** (63 per disputar i 40 de disputades), i la compilació de producció, de 7 pàgines a 159.
- **Regla:** compta la pàgina de qui organitza (el web de la cursa, del club, de l'ajuntament, del circuit, o la seva pàgina d'inscripció en una plataforma) quan hi diu la data d'aquella edició, amb el dia i l'any sense dubte. No compta cap calendari d'un tercer, cap mitjà ni cap xarxa social.
- **El que no s'ha fet servir, tot i haver-se llegit (14):** les pàgines d'inscripció de Curses.cat, perquè és la mateixa empresa d'un dels calendaris que no ha donat permís (11), i tres curses l'organitzador de les quals prohibeix la lectura als agents al seu web (Cursa del Tractor, Cursa del Bolet i El Tast de la Mitja): la data s'havia llegit en una altra pàgina, i no s'ha volgut anar contra aquella voluntat.
- **Webs que no s'han llegit** perquè el seu `robots.txt` ho prohibeix als agents d'Anthropic o a tots els robots: una quinzena, apuntats a `apps/web/scripts/own-read/`.
- **Correccions que n'han sortit:** dues curses que el calendari tenia dues vegades (se n'ha tret la còpia: per això són 324 i no 326), tres anul·lades pel seu organitzador (Cursa CEC Collserola, Pujada al Far de Llafranc i Cursa de la Tardor), sis pobles corregits (Pacs del Penedès, Porqueres, Santa Maria de Martorelles, Camós, Bigues i Riells del Fai i Cambrils) i distàncies diferents en 41 curses. La Mini-marató de Calella de Palafrugell fa 8,8 km, no 42,2.
- **Com es refà:** les lectures són a `apps/web/scripts/own-read/*.json`, amb el dia de la consulta; `node scripts/apply-own-read.mjs` les fusiona amb `calendar.json`.

**Què no s'ha comprovat:** cada dada s'ha llegit una sola vegada, per un agent, i jo n'he repassat els casos dubtosos i no cada pàgina. Cinc confirmacions venen de la pàgina d'un ajuntament i sis de la pàgina d'un circuit, no de la cursa mateixa. El terreny (asfalt o muntanya) continua sent el que deia el calendari d'origen: l'organitzador no s'ha fet servir per a això. No soc advocat: que una cursa confirmada pel seu organitzador ja no depengui del calendari on es va trobar és la meva lectura de `docs/revisio-legal.md`, no un dictamen.

