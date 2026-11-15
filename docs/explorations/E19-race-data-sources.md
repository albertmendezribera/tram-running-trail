# E19 · D'on surten les curses del calendari

**Estat:** explorada i importada a l'entorn de proves · **Data:** 2026-11-15 · **Decisió del titular:** posar-les totes, citant la font i enllaçant-hi; a producció només hi entren les de llicència oberta mentre les altres fonts no donin permís

## Pregunta

La Fase 2 demana un calendari indexable amb 300 curses o més. D'on poden sortir, amb quines dades i amb quin permís?

## Què s'ha mirat

Consultat el 15 de novembre de 2026. Les xifres són comptades a la font, no estimades, tret d'on es diu.

| Font | Què té | Quantes | Dades de cada cursa | Com es llegeix | Es pot fer servir? |
|---|---|---|---|---|---|
| **Federació Catalana d'Atletisme** (`fcatletisme.cat`) | Calendari oficial de ruta, trail, cros i marxa | 2026: **88 de ruta i 28 de trail**. 2025: 79 i 35. 2027, encara a mitges: 0 i 21 | Nom, data, municipi, organitzador i el seu web (45 de 50). La distància només dins del nom (46 de 50). **Sense desnivell, coordenades ni track** | Interfície pública de dades del web (el connector d'esdeveniments de WordPress), en JSON | **Només amb permís.** L'avís legal reserva tots els drets i només permet l'ús personal |
| **FEEC** (`feec.cat`) | Curses per muntanya (tres copes catalanes i campionats) i «Caminades de Catalunya» | Caminades 2025: **unes 180**. Curses: no comptades (el calendari és en PDF i en pàgines d'agenda) | Caminades: dia, nom, quilòmetres, entitat i correu. Sense desnivell, municipi ni web | PDF i pàgines; cap interfície de dades | Només amb permís |
| **Ajuntament de Barcelona**, dades obertes | Agenda d'activitats esportives de la ciutat | 127 actes, **12 dels quals són curses** (Marató, Mitja, Jean Bouin, Cursa dels Nassos…) | Nom, dates, adreça, **coordenades**, entitat. Sense distància ni desnivell | CSV i JSON, actualitzat cada dia | **Sí: CC BY 4.0** |
| **Generalitat**, dades obertes | Cap conjunt d'esdeveniments esportius. L'agenda cultural en té alguna cursa barrejada | 203 actes amb la paraula «cursa», la majoria no ho són | — | API oberta | Sí, però no serveix |
| **gotrail.run** (agregador) | Calendari de trail | 156 de trail a Catalunya per a 2026-27 | Data, lloc, tipus, distàncies | Web | **No**: tots els drets reservats |
| **ahotu** (agregador mundial) | Calendari comercial amb API | No verificat | — | API de pagament, per acord | Per contracte |

**No s'ha mirat:** les empreses de cronometratge (ChampionChip i altres), Runedia (el seu certificat estava caducat), les diputacions i consells comarcals, ni UTMB i ITRA.

## Què en surt

1. **No hi ha cap font oberta amb 300 curses de Catalunya.** L'única amb llicència oberta en té 12.
2. **Les federacions en tenen prou per arribar-hi, però cal demanar-ho.** Atletisme en porta unes 115 l'any entre ruta i trail (algunes de ruta són fora de Catalunya: València, Múrcia, Eivissa); amb dues temporades i les curses de la FEEC se superen les 300 edicions. La de la FCA ja es pot llegir amb una sola petició: és una qüestió de permís, no de tècnica.
3. **Cap font porta el que fa diferent TRAM.** Ni el track ni el desnivell. El calendari es pot omplir amb data, lloc i distància, però el vol 3D i el perfil només es poden fer on l'organitzador doni el seu GPX.
4. **«L'any com a perfil» (M4) depèn d'una dada que falta.** Dibuixa cada cursa amb l'alçada del seu desnivell positiu. Si la majoria no en tenen, i el projecte no n'estima cap, la franja quedaria gairebé plana i buida. S'ha de repensar abans de construir-lo: o només amb les curses que tenen desnivell, o amb una altra dada a l'alçada.
5. **La Marxa de les Tines no és a cap d'aquests calendaris.** Ni al de la FCA ni al de caminades de la FEEC de 2025.

## Opcions per omplir el calendari

| | Curses | Què costa | Risc |
|---|---|---|---|
| A · Dades obertes de Barcelona | 12 | Res: es pot fer avui | Molt poques, i només la ciutat |
| B · Acord amb la FCA | Unes 115 l'any | Un correu i esperar resposta. Ells hi guanyen visibilitat i enllaços | Que diguin que no, o que triguin |
| C · Acord amb la FEEC | Desenes de curses i unes 180 caminades | Igual que B, però sense interfície de dades: cal llegir PDF | Igual |
| D · Cada organitzador, des del seu propi web | Les que es vulguin, a poc a poc | Feina a mà o un lector per web: cada un és diferent | Lent; les dades d'un organitzador sobre la seva cursa són fets, i s'enllaça la font |
| E · Formulari perquè l'organitzador hi posi la cursa i el track | Les que arribin | Construir-lo, i que algú el conegui | Sense trànsit no arriba ningú |
| F · Agregador comercial | Milers | Diners i un contracte | Dependència, i tampoc porta track |

Copiar el calendari d'un agregador o d'una federació sense permís no és cap opció (`docs/revisio-legal.md`, punt 11).

## Recomanació

1. **Ara:** construir el calendari amb les 12 curses de Barcelona (opció A), que són reals i de llicència oberta. Són prou per fer les pàgines per faceta, els filtres i la llista, i per veure què passa amb el M4.
2. **Alhora:** escriure a la FCA (opció B). És la que canvia l'escala. A sota hi ha un esborrany del correu; l'ha d'enviar el titular del projecte, no pas jo.
3. **Després:** la FEEC (C), i el track cursa a cursa amb cada organitzador (D), començant per les que tinguin el GPX publicat.
4. **El llindar de 300** no es compleix amb el que es pot fer avui sense permís de ningú. Convé decidir si la fase s'espera a la resposta de la FCA o si el criteri es revisa.

## Esborrany de correu a la FCA

> **Assumpte:** Permís per mostrar el calendari de curses de la FCA a TRAM
>
> Bon dia,
>
> Estem construint TRAM, un web de running d'asfalt i de muntanya que comença a Catalunya. Mostra cada cursa amb el seu recorregut en 3D sobre el terreny real, el perfil i les xifres.
>
> Voldríem incloure al nostre calendari les curses de ruta i de trail del calendari de la Federació: nom, data, municipi, organitzador i l'enllaç al web de cada cursa. Cada fitxa diria que la dada és del calendari oficial de la FCA i hi enllaçaria. No copiaríem textos, imatges ni classificacions.
>
> Us volem demanar permís per fer-ho, i saber si hi ha alguna condició que hàgim de complir. Si us va bé, us ensenyem una versió de proves abans de publicar res.
>
> Gràcies,
> [nom i contacte]

## Què s'ha fet després (15 de novembre de 2026)

El titular del projecte va decidir posar totes les curses, citant les fonts i enllaçant-hi, i afegir-hi Runnea i curses.cat.

- `apps/web/scripts/import-calendar.mjs` llegeix quatre calendaris i n'escriu `apps/web/src/content/calendar.json`: **136 curses** de l'1 de gener de 2026 al 31 de desembre de 2027.

| Font | Curses | Notes |
|---|---|---|
| Federació Catalana d'Atletisme | 102 | Ruta i trail. Se'n deixen fora 30: campionats d'Espanya i internacionals que es fan fora de Catalunya |
| Curses.cat | 23 | Calendari d'una empresa de cronometratge de Girona, amb municipi, distàncies i web. Se'n deixen fora BTT, caminades, marxes i una cursa virtual |
| Ajuntament de Barcelona | 12 | Les úniques amb llicència oberta (CC BY 4.0). 115 actes de l'agenda no són curses a peu |
| Runnea | 7 | Només diu la província. Es llegeix el que publica per als cercadors (schema.org) |

- **Una cursa que surt a dos calendaris és una sola entrada** amb les dues fonts (mateix dia, mateix municipi i noms que s'assemblen). N'hi ha 6 que surten a més d'una font.
- **De cada cursa només fets:** nom, data, municipi, distàncies, organitzador i web. Cap text, cap imatge. La distància es llegeix del nom quan hi és («5 i 10 Km», «Mitja Marató»); 91 de 136 en tenen. **Cap té desnivell ni track.**
- **El municipi i la comarca** surten de les dades obertes de la Generalitat («Municipis Catalunya Geo»); 128 de 136 hi casen.
- **Cada fitxa diu d'on surt** cada cursa, amb enllaç a la pàgina de la font, la data de consulta i les condicions de cada font.
- **A producció només hi entren les que té una font de llicència oberta** (les de Barcelona). La resta es veuen a l'entorn de proves, amb `noindex` i un avís, fins que la seva font doni permís. És la mateixa regla que ja tenen les sabatilles.

**No s'ha importat:** la FEEC (l'agenda de competicions es carrega amb JavaScript i el calendari de caminades és un PDF de 2025), ni cap altra font de les no mirades.

**Riscos que queden oberts** (`docs/revisio-legal.md`): l'avís legal de la FCA reserva tots els drets; ni Runnea ni curses.cat han estat avisats. Citar i enllaçar és de bona pràctica, però no és un permís.

## Què no s'ha verificat, i límits

- **Les curses de la FEEC no s'han comptat**: només les caminades, i d'un PDF de 2025.
- **Quantes de les 88 curses de ruta de la FCA són fora de Catalunya** no s'ha comptat; en una mostra de 12 n'hi havia 3.
- **El total de curses populars que es fan a Catalunya en un any** no se sap. Les federacions només porten les que s'hi inscriuen; la majoria de curses de poble no hi són.
- **Les condicions d'ús** de la FCA s'han llegit al seu avís legal; les de la FEEC, no.
- **Les dates poden canviar**: el calendari és una fotografia del dia de la consulta. No hi ha cap actualització automàtica; cal tornar a córrer l'importador.
- **Cap cursa s'ha comprovat contra el web del seu organitzador.**
- **Les curses de Runnea no tenen municipi**, només província, i tres no s'han pogut casar amb cap altra font.
