# Fase 3 · Catàleg de sabatilles: on som

**Data:** 2026-11-20 · **Encàrrec:** «100 vambes al web: marques top, top models» (Altra, Nike, Adidas, On, La Sportiva, NNormal, Brooks, Asics, New Balance, Decathlon, Puma i d'altres).

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Catàleg | `/ca/sabatilles/`, «El catàleg» | **161 models de 17 marques**, a més de les dues sabatilles de la Fase 1 mesurades en laboratori |
| Fitxa d'un model del catàleg | `/ca/sabatilles/<marca>/<model>/` | Feta: les xifres que declara la marca, la radiografia quan declara les dues alçades, la nota quan la pàgina es contradiu, i l'enllaç a la pàgina del model |
| Mapa del catàleg | `/ca/sabatilles/`, sobre la llista | Fet: dos mapes, «pes i alçada al taló» (67 models) i «pes i drop» (132), amb una forma per terreny. Cada punt és un enllaç a la fitxa; les xifres, també en una taula |
| Filtres | `/ca/sabatilles/` | Fets: per marca i per terreny. Amaguen files de la llista i punts dels mapes alhora, i queden a l'adreça (`?marca=puma&terreny=trail`) |
| Comparador del catàleg | `/ca/comparar/?a=<marca>/<model>&b=<marca>/<model>` | Fet: dos models qualssevol, xifra a xifra amb la diferència, les soles superposades quan les dues marques declaren les alçades, i una targeta per model. S'hi arriba triant dos punts al mapa, des de cada fitxa o amb els dos desplegables |
| Dades | `apps/web/src/content/shoe-catalog.json` | Un registre per model, amb l'adreça d'on s'ha llegit cada xifra i el dia de la consulta (`accessed`) |

| Marca | Models | Què declara a la fitxa |
|---|---|---|
| On | 18 | Pes i drop. Cap alçada, ni la talla pesada |
| Nike | 14 | Pes aproximat (talla UK 9) i drop. Cap alçada |
| Hoka | 15 | Lectura a mitges (vegeu més avall): pes i drop als d'asfalt; als de muntanya, drop i tacs, sense pes |
| Topo Athletic | 13 | Pes (en unces), alçades i drop |
| Puma | 12 | Pes (talla 42), alçades i drop a gairebé totes |
| Mizuno | 11 | Pes sense talla; drop i alçada només en alguns, i sovint sense dir on es mesura |
| Saucony | 11 | Pes (unces i grams), alçades i drop a totes |
| Merrell | 10 | Pes de mitja parella, alçades, drop i tacs |
| Altra | 8 | Pes (unces i grams), alçada i drop |
| Adidas | 8 | Pes amb talla, alçades i drop a la majoria; dos models sense cap xifra han quedat fora |
| Scarpa | 8 | Pes (talla 42), alçades i drop a totes |
| La Sportiva | 6 | Alçades, drop i tacs; el pes, només en un |
| Salomon | 6 | Pes per unitat, drop i tacs. Cap alçada |
| Asics | 6 | Pes i drop. Cap alçada |
| Brooks | 5 | Pes (unces i grams) i drop. Cap alçada |
| Decathlon (Kiprun) | 5 | Pes, alçades i drop als d'asfalt; als de muntanya, només els tacs |
| NNormal | 5 | Pes, alçades, drop i tacs, tret de la Kboix |

## La regla de les dades

La que ja fixava `docs/revisio-legal.md` (punt 4): **el catàleg es fa només amb el que declara cada fabricant al seu web.** Cap mesura de laboratori de tercers, cap xifra d'un comparador, cap xifra de memòria.

- El que una marca no diu queda sense dada.
- La radiografia es dibuixa només si la marca declara l'alçada al taló i a l'avantpeu (72 dels 161). Sense elles, la fitxa diu que no es pot dibuixar.
- Un pes declarat en unces es mostra en grams, amb la xifra original al costat.
- Cada marca mesura l'alçada a la seva manera: la fitxa diu que no es poden comparar al mil·límetre entre marques.
- **Quan la pàgina es contradiu, no es tria.** Si les dues alçades i el drop no quadren (Puma Deviate Nitro Elite 4, Merrell Agility Trail, La Sportiva Mutant), es posen com hi són i la fitxa ho diu. Si hi ha dos drops (Puma Fast-Trac Nitro 4), no se'n posa cap.
- **Una alçada sense lloc no es posa enlloc.** «Stack Height: 38mm», sense dir si és al taló, va a la nota de la fitxa, no al camp del taló. L'única excepció és Altra amb drop 0, on una sola alçada val per als dos punts, i la fitxa ho diu.
- **Mizuno:** el camp «Weight(g)» de les seves pàgines és de vegades d'una sabatilla i de vegades del parell (640 g), sense dir-ho. Els models on no es pot saber han quedat fora (Wave Horizon 9, Ultima 17, Skyrise 7, Rebellion Flash 3, Daichi 9, Mujin 11, Neo Lumina). El camp «Stack (mm)» hi sembla el drop; no s'ha posat com a cap de les dues coses, i surt a la nota.

## Com s'han llegit

- **Amb peticions simples**, sense disfressar-les de navegador i amb cinc segons entre pàgines: NNormal, Topo Athletic, On, Merrell, Mizuno, Puma i Nike. La llista de models surt del mapa del web (sitemap) de cada marca.
- **Amb el navegador, pàgina a pàgina:** Altra, Adidas, La Sportiva, Asics, Brooks, Decathlon, Saucony, Scarpa, Salomon i Hoka, que rebutgen o limiten les peticions simples (403, 406 o 429) o no porten les xifres a la pàgina que hi responen. Cap ha mostrat una comprovació antirobots.
- **Hoka va deixar de respondre** (pàgines buides) després d'una quinzena de fitxes, i s'hi va parar. El que hi ha és una lectura a mitges, i cada fitxa ho diu: als models d'asfalt, el pes surt del quadre comparatiu de la mateixa pàgina i falten les alçades (tret de la Clifton 11, llegida sencera); als de muntanya falta el pes. Dos models no es van arribar a llegir (Mafate X i Rocket X Trail).
- Cap de les marques mirades prohibeix els agents al seu `robots.txt`.

## Què no hi és, i per què

- **New Balance:** la fitxa que s'ha mirat (FuelCell Rebel v5, web d'Espanya) no declara ni pes, ni drop, ni alçades. No s'hi ha posat cap model.
- **Hoka:** acabar-ne la lectura un altre dia, a poc a poc (alçades dels d'asfalt, pes dels de muntanya, i els dos models que falten).
- **Salomon d'asfalt** i **Inov8:** no s'han mirat.
- **Triar els models:** «top models» és un criteri del titular. S'ha agafat la gamma vigent de running de cada marca, sense versions impermeables, amples ni col·laboracions; no és una tria.
- **Mitjasola de Topo:** les pàgines l'anomenen, però no de manera que es pugui llegir sense interpretar; s'ha deixat sense dada.

## El mapa: per què no és ECharts

CLAUDE.md 9 i l'exploració E15 fixen ECharts per a tots els gràfics tret del perfil altimètric. **El mapa del catàleg se'n surt, per decisió del titular (2026-11-20).** És un dibuix propi (`CatalogMap` al sistema de disseny), com el perfil i «l'any com a perfil», per les mateixes raons que E15 va mesurar:

- **Un sol dibuix** serveix per a clar i nit i per a mòbil i escriptori, perquè pren els colors de les variables CSS i els punts no s'estiren. ECharts vol colors literals i una mida fixa: en caldrien vuit (dos temes, dues mides, dos mapes).
- **Cada punt és un enllaç** a la fitxa sense JavaScript, s'hi arriba amb el teclat i diu el nom i les dues xifres. Amb ECharts generat al servidor, el punt només porta a la fitxa amb script.
- **Els filtres** amaguen punts amb el mateix atribut que amaguen files.

El tema d'ECharts que genera el sistema continua sense cap gràfic que el faci servir. La resta de gràfics de 9.3 (parcials i ritmes, comparativa) segueixen sent d'ECharts mentre no es decideixi una altra cosa.

**Què situa el mapa i què no:** un model hi surt només si la seva marca declara les dues mesures. El pes és el de la talla que pesa cada marca i l'alçada es mesura diferent a cada casa: el mapa situa, no compara al mil·límetre, i ho diu.

## La vista 3D: sis models, de fotos de la marca

Decisió del titular (2026-11-20): la vista 3D del catàleg es fa amb **fotos oficials de la marca**, per a uns quants models, i no amb un model genèric de mesures (que hauria demanat una amplada que cap marca declara). És el mateix mètode de les dues sabatilles de la Fase 1 (`apps/web/scripts/photo-model.py`): la silueta es llegeix de la foto lateral i de la de dalt, se li dona volum i s'hi posen les fotos a sobre.

| Model | Fotos | Terreny |
|---|---|---|
| Nike Pegasus 42 | lateral, medial, dalt, taló | Asfalt |
| Puma Deviate Nitro 4 | lateral, medial, dalt, sola | Asfalt |
| On Cloudmonster 3 | lateral, medial, dalt, taló, sola | Asfalt |
| Mizuno Wave Rider 30 | lateral, medial, dalt, taló, sola | Asfalt |
| Asics Superblast 3 | lateral, medial, dalt, taló, sola | Asfalt |
| Merrell Agility Peak 6 | lateral, medial, dalt, taló, sola | Muntanya |

- **On surt:** a la fitxa de cada un («En 3D») i al comparador («Cara a cara en 3D»), només quan els dos models de la parella en tenen. El comparador diu quins en tenen.
- **La mida és nominal.** Cap marca declara l'amplada, i el model es fa sobre una llargada de 300 mm: no se'n pot llegir cap mesura, i la fitxa ho diu. Al comparador cada sabatilla omple el seu marc.
- **No són escanejos**, i cada vista ho diu: fidels de costat, de dalt i de darrere; aproximades de front.
- **Les fotos són de les marques i no són al repositori** (`apps/web/src/content/shoes-local/`, exclòs). Només són a staging, publicades des de la màquina que les té. Una compilació sense elles, com la de CI, no té cap vista 3D del catàleg; les proves cobreixen els dos casos.
- **Risc:** cada model nou posa més fotos de marca a un staging públic. La revisió legal ja ho assenyala com el punt més feble; són sis models més a sumar als dos que hi havia.
- **El script** ha guanyat quatre opcions per a fotos que no són com les de Nike i Hoka: una sabatilla sola en lloc de la parella (`single`), una sabatilla estirada (`toes: left/right`), una mida nominal (`lengthMm`) i una regla d'ombra per a soles blanques, grises o negres (`shadow: faint`).

## El comparador: una pàgina per a totes les parelles

CLAUDE.md 3 preveu `/ca/comparar/[a]-vs-[b]/`, amb les parelles populars generades i la resta sota demanda. **El lloc encara és estàtic** (l'adaptador de Cloudflare no hi és), i 161 models són 12.880 parelles: massa pàgines per generar-les totes, i sense dades per saber quines són les populars. Decisió presa en fer-lo (2026-11-20), a revisar quan hi hagi servidor:

- **Una sola pàgina, `/ca/comparar/`**, amb la parella a l'adreça (`?a=puma/deviate-nitro-4&b=scarpa/spin-race`). Porta la taula dibuixada una vegada, totes les soles i una targeta per model; una illa mostra els dos triats i omple la taula. No es demana res a cap servidor.
- **Què s'hi perd:** sense JavaScript no hi ha comparació (la pàgina ho diu), i la taula d'una parella no és a l'HTML de cap adreça, cosa que CLAUDE.md 8.2 demana per al SEO. El catàleg és només a staging i fora dels cercadors, de manera que avui no costa res; **abans de producció, les comparacions han de passar a `a-vs-b` sota demanda.**
- **Les dues sabatilles de laboratori** conserven la seva pàgina pròpia, amb el 3D i la radiografia amb cotes. No entren en aquest comparador: les seves mesures són d'una altra mena.

**Què compara i com ho diu:**

- Només el que declara cada marca. On una no diu una xifra, no es pren cap diferència («no es pot comparar»).
- **Pesos de talles diferents:** la diferència es dona, amb un avís que diu de quina talla és cada pes.
- **Alçades de marques diferents:** la diferència es dona, amb l'avís que cada marca mesura l'alçada a la seva manera.
- **Soles superposades** només si les dues marques declaren les dues alçades; si no, la pàgina diu quina no ho fa i no en dibuixa cap d'estimada. Són contorns (contínua la primera, de traços la segona), a la mateixa escala i alineades al taló i a terra.

Peces noves al sistema de disseny: `SoleStack` i `SpecDiff` amb `fillable` (vegeu el CHANGELOG).

## Què no s'ha fet

- **Triar models des de la llista** per comparar-los: es pot des del mapa, des de cada fitxa i al comparador mateix, però les files de la llista no tenen cap casella.
- **Tres models alhora** (CLAUDE.md 8.2 en preveu «dues o tres»): el comparador en compara dos.
- **Producció:** el catàleg només és a staging. Els noms de marca continuen pendents de revisió legal, com a la Fase 1.
- **Cap xifra s'ha contrastat** amb una segona font ni amb una segona lectura: és el que deia la pàgina de la marca el dia de la consulta, llegit una vegada.
