# Fase 3 · Catàleg de sabatilles: on som

**Data:** 2026-11-20 (vista 3D: 2026-11-22) · **Encàrrec:** «100 vambes al web: marques top, top models» (Altra, Nike, Adidas, On, La Sportiva, NNormal, Brooks, Asics, New Balance, Decathlon, Puma i d'altres).

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

## La vista 3D: 96 dels 161 models, de fotos de la marca

Decisió del titular (2026-11-20): la vista 3D del catàleg es fa amb **fotos oficials de la marca**, i no amb un model genèric de mesures (que hauria demanat una amplada que cap marca declara). És el mateix mètode de les dues sabatilles de la Fase 1 (`apps/web/scripts/photo-model.py`): la silueta es llegeix de la foto lateral i de la de dalt, se li dona volum i s'hi posen les fotos a sobre. El 2026-11-20 se'n van fer sis; el 2026-11-22 el titular va demanar-les totes («les bambes haurien d'estar totes en 3D no?») i se n'han fet **90 més: 96 de 161**.

| Marca | Amb vista 3D | Fotos que hi ha | Notes |
|---|---|---|---|
| On | 18 de 18 | lateral, medial, dalt, taló, sola | PNG transparents |
| Nike | 13 de 14 | lateral, medial, dalt, taló, sola | Falta l'Alphafly 4. La Pegasus 42 (feta el dia 20) no té sola |
| Topo Athletic | 13 de 13 | lateral, medial, dalt; sola en 6 | Sense foto de taló. En 7 models la foto de la sola és obliqua i no s'ha fet servir |
| Puma | 12 de 12 | lateral, medial, dalt, sola | Sense foto de taló. La sola és de l'altre peu, emmirallada (vegeu més avall) |
| Saucony | 11 de 11 | lateral, medial, dalt, taló, sola | |
| Mizuno | 10 de 11 | lateral, medial, dalt, taló, sola | Falta la Wave Rebellion Pro 3. La Neo Vista 3 no té foto de sola |
| Merrell | 10 de 10 | lateral, medial, dalt, taló, sola | |
| Asics | 6 de 6 | lateral, medial, dalt, taló, sola | PNG transparents |
| Altra | 3 de 8 | lateral, medial, dalt, sola | Lone Peak 9, Timp 6 i Experience Flow 3 |
| Hoka, Adidas, Scarpa, La Sportiva, Salomon, NNormal, Brooks, Decathlon | 0 de 58 | — | Vegeu «Les que no en tenen» |

### Les que no en tenen (65), i per què

La regla, fixada pel titular: les fotos surten **només del web o del servidor d'imatges de cada marca, amb peticions simples** (sense fer-se passar per un navegador, respectant `robots.txt` i amb segons entre petició i petició), i **davant d'una comprovació antirobots s'atura** i la marca queda sense fer.

| Què | Quantes | Per què |
|---|---|---|
| Hoka (totes) | 15 | hoka.com respon 406 a les peticions simples i una pàgina de comprovació («Please enable JS») al mapa del web. Les fotos sí que es poden demanar al servidor d'imatges (`dms.deckers.com`), però cal el codi de color de cada model, que només és a hoka.com |
| Adidas (totes) | 8 | adidas.es respon 403 (el seu tallafocs), fins i tot al `robots.txt` |
| Scarpa (totes) | 8 | La botiga (Shopify) respon 429 a totes les peticions simples, pàgina i fitxer de producte |
| La Sportiva (totes) | 6 | 403, també al `robots.txt` |
| Salomon (totes) | 6 | 403, «Access to this page has been denied» |
| NNormal (totes) | 5 | Respon bé, però **no publica cap vista medial**: només lateral, parella de dalt, sola i un detall. Sense les dues bandes no hi ha model, i no se n'inventa cap |
| Brooks (totes) | 5 | 403, també al `robots.txt` |
| Decathlon (totes) | 5 | Comprovació de Cloudflare («Just a moment…») |
| Altra: Olympus 7, Torin 9, Escalante 5, Vanish Carbon 3, Experience Wild 3 | 5 | El servidor d'imatges respon, però la botiga (Shopify) respon 429 a gairebé totes les pàgines, i sense la pàgina no se sap el codi de color de cada model. Els tres fets són els que es van poder llegir |
| Nike Alphafly 4 | 1 | La pàgina del model (l'adreça del catàleg) respon 404 el 2026-11-22. Les xifres del catàleg es van llegir d'aquella pàgina el dia 20 |
| Mizuno Wave Rebellion Pro 3 | 1 | La pàgina barreja un lateral renderitzat (verd apagat, sola blanca) amb fotos de l'altra banda, de dalt i de darrere d'un altre to (menta i blau, sola crema): les dues bandes no lligarien. L'altra coloració no té lateral |

Per a Hoka, Altra i Scarpa, les fotos mateixes es poden demanar amb peticions simples: el que falta és una dada de la pàgina (el codi de color). **Llegir aquestes pàgines amb el navegador, com es va fer per a les xifres del catàleg, és una decisió del titular**; no s'ha fet.

### Què s'ha triat en fer-les

- **La coloració no és sempre la de l'adreça del catàleg.** S'ha agafat una coloració amb color quan la pàgina en dona, perquè una sabatilla tota negra o tota blanca dona poc detall i, sobre fons blanc, no es retalla bé. La Mizuno Wave Inspire 22 surt d'una altra coloració perquè la del catàleg no té foto de dalt. La coloració i l'adreça de cada foto són al `config.json` de cada model.
- **Textures més petites que les del dia 20:** 1024 px de llarg als costats (abans 1280), qualitat 82. Un model pesa uns 335 KB de mitjana (abans uns 600 KB); el més pesant, 593 KB, és un dels sis antics. La silueta es desa en proporcions, de manera que no canvia.
- **Les fotos transparents es retallen pel seu canal alfa** (On, Mizuno, Asics, Altra): la sabatilla és el que és opac, i l'ombra de terra, mig transparent, es descarta. Abans es posaven sobre gris i l'ombra entrava a la silueta.
- **Una sola fotografiada de l'altre peu s'emmiralla** (12 models: els 11 de Puma, on la foto ensenya l'esquerra de dalt i la dreta girada, i l'Altra Lone Peak 9). El dibuix de la sola és el del peu que toca, però **les lletres hi surten del revés**. L'alternativa era deixar la sola sense foto. És al `config.json` (`"mirror": true`).
- **Quin peu és cada foto, cap on apunta i cap on mira la sola** ho dedueix l'eina de les fotos mateixes (la punta s'inclina cap al dit gros; l'avantpeu és la part ampla), i avisa quan alguna cosa no quadra.
- **Els sis models del dia 20 no s'han tocat**: continuen amb les textures grans i sense `config.json`.

### On surt, i com es carrega

- **On surt:** a la fitxa de cada un («En 3D») i al comparador («Cara a cara en 3D»), quan els dos models de la parella en tenen. El comparador diu quants en tenen i quins no.
- **La silueta es demana amb la vista, no va escrita a la pàgina.** Al comparador cada sabatilla hi és dues vegades; amb 96 siluetes escrites, la pàgina hauria fet 2,1 MB. Ara cada visor porta l'adreça de la seva silueta (4 KB) i la demana quan arrenca. `/ca/comparar/` fa 1,36 MB (76 KB comprimida; amb sis models feia 1,0 MB i 69 KB). La fitxa d'una sabatilla amb vista 3D fa uns 35 KB.
- **La compilació** no ho nota: 606 pàgines en 8 segons, igual que abans. El `dist` de staging passa de 94 MB a 126 MB. El pressupost (`pnpm --filter @tram/web budget`) passa: només compta JavaScript, i no n'hi ha de nou.
- **La mida és nominal.** Cap marca declara l'amplada, i el model es fa sobre una llargada de 300 mm: no se'n pot llegir cap mesura, i la fitxa ho diu. Al comparador cada sabatilla omple el seu marc.
- **No són escanejos**, i cada vista ho diu: fidels de costat i de dalt; de darrere, només on hi ha foto de taló (a Puma, Topo i Altra el darrere és una barreja dels dos costats); aproximades de front.
- **Les fotos són de les marques i no són al repositori** (`apps/web/src/content/shoes-local/`, exclòs). Hi ha, per a cada model, les textures, la configuració i les fotos originals baixades, a més de les eines que els han fet (`shoes-local/README.md`). Només són a staging, publicades des de la màquina que les té. Una compilació sense elles, com la de CI, no té cap vista 3D del catàleg, i una compilació de producció no les agafa encara que hi siguin; les proves cobreixen els dos casos.
- **Risc:** ara són fotos de nou marques, d'un centenar de models, a un staging públic. La revisió legal ja ho assenyalava com el punt més feble amb vuit models.

### Què s'ha mirat i què no

- **Mirat:** cada un dels 90 models nous, dibuixat fora del navegador amb la mateixa geometria i la mateixa barreja de fotos que el visor (de costat per les dues bandes, de dalt, de sota, de darrere, de front i en dos tres quarts), al costat de les fotos d'origen. Al visor de debò: la Nike Vomero 18 en local i, a staging, la Saucony Peregrine 16 i el cara a cara On Cloudsurfer Max / Asics Megablast.
- **No mirat:** els altres models un per un al visor de debò, ni cap en un mòbil. De la bateria de proves de navegador només s'han passat les dues del catàleg en 3D, en un sol format (escriptori, clar).

## El comparador: una pàgina per a totes les parelles

CLAUDE.md 3 preveu `/ca/comparar/[a]-vs-[b]/`, amb les parelles populars generades i la resta sota demanda. **El lloc encara és estàtic** (l'adaptador de Cloudflare no hi és), i 161 models són 12.880 parelles: massa pàgines per generar-les totes, i sense dades per saber quines són les populars. Decisió presa en fer-lo (2026-11-20), a revisar quan hi hagi servidor:

- **Una sola pàgina, `/ca/comparar/`**, amb la parella a l'adreça (`?a=puma/deviate-nitro-4&b=scarpa/spin-race`). Porta la taula dibuixada una vegada, totes les soles i una targeta per model; una illa mostra els dos triats i omple la taula. No es demana res a cap servidor, tret de la silueta i les fotos de la vista 3D dels dos models triats, que es demanen quan la vista arrenca.
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
