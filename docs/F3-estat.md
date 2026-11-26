# Fase 3 · Catàleg de sabatilles: on som

**Data:** 2026-11-20 (vista 3D: 2026-11-22) · **Encàrrec:** «100 vambes al web: marques top, top models» (Altra, Nike, Adidas, On, La Sportiva, NNormal, Brooks, Asics, New Balance, Decathlon, Puma i d'altres).

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Catàleg | `/ca/sabatilles/`, «El catàleg» | **169 models de 17 marques** (161 fins al 26 de novembre, que s'hi van afegir 8 de muntanya d'Asics), a més de les dues sabatilles de la Fase 1 mesurades en laboratori |
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

## La vista 3D: 131 dels 161 models, de fotos de la marca

Decisió del titular (2026-11-20): la vista 3D del catàleg es fa amb **fotos oficials de la marca**, i no amb un model genèric de mesures (que hauria demanat una amplada que cap marca declara). És el mateix mètode de les dues sabatilles de la Fase 1 (`apps/web/scripts/photo-model.py`): la silueta es llegeix de la foto lateral i de la de dalt, se li dona volum i s'hi posen les fotos a sobre. El 2026-11-20 se'n van fer sis. El 2026-11-22 el titular va demanar-les totes («les bambes haurien d'estar totes en 3D no?»): al matí se'n van fer 90 més amb peticions simples (96 de 161), i a la tarda, amb el seu permís per llegir amb el navegador les pàgines de les marques que les rebutgen, **35 més: 131 de 161**.

| Marca | Amb vista 3D | Fotos que hi ha | Notes |
|---|---|---|---|
| On | 18 de 18 | lateral, medial, dalt, taló, sola | PNG transparents |
| Hoka | 15 de 15 | lateral, medial, dalt, taló, sola | PNG transparents. Codi de color llegit amb el navegador |
| Nike | 13 de 14 | lateral, medial, dalt, taló, sola | Falta l'Alphafly 4. La Pegasus 42 (feta el dia 20) no té sola |
| Topo Athletic | 13 de 13 | lateral, medial, dalt; sola en 6 | Sense foto de taló. En 7 models la foto de la sola és obliqua i no s'ha fet servir |
| Puma | 12 de 12 | lateral, medial, dalt, sola | Sense foto de taló. La sola és de l'altre peu, emmirallada (vegeu més avall) |
| Saucony | 11 de 11 | lateral, medial, dalt, taló, sola | |
| Mizuno | 10 de 11 | lateral, medial, dalt, taló, sola | Falta la Wave Rebellion Pro 3. La Neo Vista 3 no té foto de sola |
| Merrell | 10 de 10 | lateral, medial, dalt, taló, sola | |
| Altra | 8 de 8 | lateral, medial, dalt, sola | PNG transparents. Cinc amb el codi de color llegit amb el navegador |
| Scarpa | 8 de 8 | lateral, medial, dalt, sola | Fons blanc. Sense taló: la foto de darrere és de biaix. La Spin Planet surt de la coloració fosca |
| Asics | 6 de 6 | lateral, medial, dalt, taló, sola | PNG transparents |
| Salomon | 6 de 6 | lateral, medial, dalt, taló, sola | PNG transparents. La foto de dalt és de l'altre peu, emmirallada. La Speedcross 6, sense taló |
| Decathlon | 1 de 5 | lateral, medial, dalt, sola | Només la Kipstorm Elite |
| Adidas, La Sportiva, Brooks, NNormal | 0 de 24 | — | Vegeu «Les que no en tenen» |

### Les que no en tenen (30), i per què

La regla, fixada pel titular: les fotos surten **només del web o del servidor d'imatges de cada marca, amb peticions simples** (sense fer-se passar per un navegador, respectant `robots.txt` i amb segons entre petició i petició). Des de la tarda del 2026-11-22, **la pàgina d'una marca que rebutja les peticions simples es pot llegir amb el navegador** per saber-ne les adreces de les fotos; les fotos es continuen demanant amb peticions simples. **Davant d'una comprovació antirobots, també al navegador, s'atura** i la marca queda sense fer.

| Què | Quantes | Per què |
|---|---|---|
| Adidas (totes) | 8 | La pàgina es llegeix amb el navegador i el servidor d'imatges respon. Però quatre models (Evo SL, Boston 13, Prime X3 Strung, SL 2) només tenen, en la coloració del catàleg, fotos de carrer; i les fotos d'estudi dels altres quatre porten una ombra projectada dura i una vista de dalt presa de biaix: l'eina hi llegeix siluetes falses (amplades de 230 mm). Cap no s'ha publicat. Demanaria un retall de debò de la sabatilla, que no s'ha fet |
| La Sportiva (totes) | 6 | 403 a les peticions simples, i al navegador una pàgina de comprovació («SECURITY PAGE») |
| Brooks (totes) | 5 | La pàgina es llegeix amb el navegador, però el camí de les imatges respon 403 a les peticions simples, i la imatge oberta sola al navegador tampoc es dona |
| NNormal (totes) | 5 | Respon bé, però **no publica cap vista medial**: només lateral, parella de dalt, sola i un detall. Sense les dues bandes no hi ha model, i no se n'inventa cap |
| Decathlon: Kipride Max, Kipride, Kipsummit Race, Kipsummit Max | 4 | La Kipride no té cap foto de dalt. A les altres tres, la sola blanca sobre fons blanc i les sabatilles fotografiades de biaix donen una silueta esquinçada o una amplada falsa: construïdes, mirades i no publicades |
| Nike Alphafly 4 | 1 | L'adreça del catàleg ja no porta al model (404 a les peticions simples; al navegador, la portada de la botiga). Les xifres del catàleg es van llegir d'aquella pàgina el dia 20 |
| Mizuno Wave Rebellion Pro 3 | 1 | La pàgina barreja un lateral renderitzat (verd apagat, sola blanca) amb fotos de l'altra banda, de dalt i de darrere d'un altre to (menta i blau, sola crema): les dues bandes no lligarien. L'altra coloració no té lateral |

### Què s'ha triat en fer-les

- **La coloració no és sempre la de l'adreça del catàleg.** S'ha agafat una coloració amb color quan la pàgina en dona, perquè una sabatilla tota negra o tota blanca dona poc detall i, sobre fons blanc, no es retalla bé. La Mizuno Wave Inspire 22 surt d'una altra coloració perquè la del catàleg no té foto de dalt, i la Scarpa Spin Planet de la fosca perquè la blanca es perdia contra el fons. La coloració i l'adreça de cada foto són al `config.json` de cada model.
- **Textures més petites que les del dia 20:** 1024 px de llarg als costats (abans 1280), qualitat 82. Un model pesa uns 357 KB de mitjana (abans uns 600 KB); el més pesant, 651 KB, és la Salomon Genesis 2. La silueta es desa en proporcions, de manera que no canvia.
- **Les fotos transparents es retallen pel seu canal alfa** (On, Hoka, Mizuno, Asics, Altra, Salomon): la sabatilla és el que és opac, i l'ombra de terra, mig transparent, es descarta. Abans es posaven sobre gris i l'ombra entrava a la silueta.
- **Una sola fotografiada de l'altre peu s'emmiralla** (12 models: els 11 de Puma, on la foto ensenya l'esquerra de dalt i la dreta girada, i l'Altra Lone Peak 9). El dibuix de la sola és el del peu que toca, però **les lletres hi surten del revés**. L'alternativa era deixar la sola sense foto. És al `config.json` (`"mirror": true`).
- **A Salomon s'emmiralla la foto de dalt** (els 6 models): la marca fotografia de costat la sabatilla dreta i de dalt l'esquerra. Les lletres petites de la llengüeta i de la plantilla hi surten del revés; l'alternativa era emmirallar les dues bandes, amb el nom de la marca del revés.
- **Quin peu és cada foto, cap on apunta i cap on mira la sola** ho dedueix l'eina de les fotos mateixes (la punta s'inclina cap al dit gros; l'avantpeu és la part ampla), i avisa quan alguna cosa no quadra.
- **El fons ja no es cola a les vores** (models de la tarda del 22: Hoka, Scarpa, Salomon, Decathlon i cinc Altra). La silueta tanca per sobre dels racons de fons, i abans aquell gris o blanc tenyia el taló i la punta. Ara `photo-model.py` no en pren el color (`"halo"`, i `"rim"` per a la vora desenfocada). **Els 96 models anteriors no s'han refet** i conserven aquell defecte, petit; refer-los és un quart d'hora de màquina i tornar-los a mirar tots.
- **Els sis models del dia 20 no s'han tocat**: continuen amb les textures grans i sense `config.json`.

### On surt, i com es carrega

- **On surt:** a la fitxa de cada un («En 3D») i al comparador («Cara a cara en 3D»), quan els dos models de la parella en tenen. El comparador diu quants en tenen i quins no.
- **La silueta es demana amb la vista, no va escrita a la pàgina.** Al comparador cada sabatilla hi és dues vegades; amb les siluetes escrites, la pàgina hauria passat de 2 MB. Ara cada visor porta l'adreça de la seva silueta (4 KB) i la demana quan arrenca. `/ca/comparar/` fa 1,51 MB (83 KB comprimida; amb sis models feia 1,0 MB i 69 KB). La fitxa d'una sabatilla amb vista 3D fa uns 35 KB.
- **La compilació** no ho nota: 606 pàgines en 8 segons, igual que abans. El `dist` de staging passa de 94 MB a 141 MB. El pressupost (`pnpm --filter @tram/web budget`) passa: només compta JavaScript, i no n'hi ha de nou.
- **La mida és nominal.** Cap marca declara l'amplada, i el model es fa sobre una llargada de 300 mm: no se'n pot llegir cap mesura, i la fitxa ho diu. Al comparador cada sabatilla omple el seu marc.
- **No són escanejos**, i cada vista ho diu: fidels de costat i de dalt; de darrere, només on hi ha foto de taló (a Puma, Topo, Altra i Scarpa el darrere és una barreja dels dos costats); aproximades de front.
- **Les fotos són de les marques i no són al repositori** (`apps/web/src/content/shoes-local/`, exclòs). Hi ha, per a cada model, les textures, la configuració i les fotos originals baixades, a més de les eines que els han fet (`shoes-local/README.md`). Només són a staging, publicades des de la màquina que les té. Una compilació sense elles, com la de CI, no té cap vista 3D del catàleg, i una compilació de producció no les agafa encara que hi siguin; les proves cobreixen els dos casos.
- **Risc:** ara són fotos de tretze marques, de 131 models, a un staging públic. La revisió legal ja ho assenyalava com el punt més feble amb vuit models.

### Què s'ha mirat i què no

- **Mirat:** cada un dels 125 models nous, dibuixat fora del navegador amb la mateixa geometria i la mateixa barreja de fotos que el visor (de costat per les dues bandes, de dalt, de sota, de darrere, de front i en dos tres quarts), al costat de les fotos d'origen. Al visor de debò: la Nike Vomero 18 en local i, a staging, la Saucony Peregrine 16, la Topo Athletic MTN Racer 4, l'Altra Lone Peak 9, la Hoka Mafate 5, la Scarpa Spin ST, la Salomon Genesis 2 i dos cara a cara (On Cloudsurfer Max / Asics Megablast, Hoka Speedgoat 7 / Salomon Speedcross 6).
- **No mirat:** els altres models un per un al visor de debò, ni cap en un mòbil. De la bateria de proves de navegador només s'han passat, al matí, les dues del catàleg en 3D, en un sol format (escriptori, clar); a la tarda, cap. A GitHub, el CI dels canvis del matí sortia vermell en dues feines que no toquen les sabatilles (`visual` i `engines`, per captures i proves del visor de rutes); amb les línies base regenerades, el CI del commit següent (`d111f2b`) passa sencer.

## «Què busques?»: el catàleg per necessitat (22 de novembre de 2026)

Pregunta del titular: un company busca sabatilles amples; ho tindria fàcil? No ho tenia: el catàleg només es podia filtrar per marca i per terreny, i no hi havia cap dada d'amplada. Ara s'hi pot entrar pel que es necessita.

- **On:** `/ca/sabatilles/`, bloc «Què busques?», i una pàgina per necessitat: `/ca/sabatilles/amples/`, `lleugeres/`, `molt-amortiment/`, `drop-baix/`, `amb-placa/` i `tacs-profunds/`. Són pàgines fetes, amb adreça pròpia i sense script; els filtres de marca i terreny hi funcionen a sobre («amples i de muntanya»).
- **Cada pàgina diu** quants models hi ha, la regla que els hi fa entrar, què no pot dir (els models que la regla no ha pogut jutjar) i, a cada fila, per què hi és. Una necessitat amb menys de dos models no té pàgina. Cada fitxa de sabatilla enllaça a les llistes on surt.
- **Les regles** són a `apps/web/src/content/need-keys.ts`, amb proves (`scripts/need-keys.test.mjs`). **Els llindars són nostres**, i cada pàgina ho diu: lleugera, 230 g o menys d'asfalt i 270 g o menys de muntanya; molt amortiment, 40 mm o més al taló d'asfalt i 35 mm de muntanya; drop baix, 4 mm o menys; tacs profunds, 5 mm o més. Amb placa: la que la marca declara (un «sense placa» declarat no hi entra).

### L'amplada: què s'ha llegit

Cap marca declara l'amplada en mil·límetres. El que sí que diuen, i s'ha llegit model per model al web de cada marca el 22 de novembre (`apps/web/src/content/shoe-fit/<marca>.json`):

- **Si el model es ven també en una versió més ampla**, amb el nom que li dona la marca («Wide», «Ancho (2E)», «X-Ancho»): 38 models. Compta un selector o una pestanya d'amplada a la pàgina del model, una versió ampla amb pàgina pròpia al mateix web (Nike, On, Asics, Salomon: la fitxa hi enllaça) o la llista de models amples de la marca.
- **Si la marca descriu la puntera com a ampla o eixamplada**, amb les seves paraules, citades curtes: 15 models (11 dels quals sense versió ampla). «Peu ample» en llista 49 de 10 marques.
- **Sense resposta, 3 models:** Nike Alphafly 4 (l'adreça ja no hi és), Brooks Adrenaline GTS 26 (anunciada, sense talles) i Puma Deviate Nitro 4 (la descripció en diu «Wide» i la resta de la pàgina no: no es tria). No compten com a estretes: la pàgina ho diu.
- **Com s'han llegit:** amb peticions simples, Nike, NNormal, Puma, Merrell i Mizuno; amb el navegador, la resta. Cap comprovació antirobots aquesta vegada, tampoc a La Sportiva.

**Decisions meves, a revisar:**

- **Altra:** la pàgina dona a cada model una forma («Original», «Standard» o «Racing FootShape™ Fit»). Només l'«Original», que la pàgina anomena la puntera més ampla de la marca, compta com a puntera ampla; les altres dues surten com a nota a la fitxa.
- **Afirmacions relatives** («We widened the toe box», «una punta més ampla»): hi entren, citades tal com són, sota «La marca en destaca l'espai a la puntera».
- **Els noms de les amplades** es deixen com els escriu la pàgina consultada, en la seva llengua («Ancho», «Wide»).
- **Una amplada que surt al selector però no es pot triar** en la coloració de la pàgina (Hoka), o que hi surt esgotada (Brooks), compta com a oferta; la fitxa ho diu.

**Què no s'ha comprovat:**

- A Mizuno, NNormal, Scarpa i Adidas no s'ha buscat si venen versions amples com a producte a part: «una de sola» vol dir «a la pàgina consultada». A La Sportiva la cerca del web no va respondre.
- L'oferta d'amplades canvia per país: és la del web de cada marca que ja feia servir el catàleg (Espanya, Regne Unit o Europa, segons la marca).
- Cap dada s'ha llegit dues vegades ni l'ha repassada una persona.
- No hi ha cap necessitat que el catàleg no pugui respondre amb dades: estabilitat o pronació, impermeable, o «per a principiants» no hi són.
- El comparador no diu res de l'amplada.

## Els escàners (E06): el camí, provat amb una mostra (25 de novembre de 2026)

Des del 26 de novembre la fase no en depèn (vegeu «Sense escàner», a sota). La part de la fase que no s'havia començat. El camí de les fotos al navegador funciona amb eines lliures en aquest Mac: COLMAP troba les càmeres, Brush entrena els splats, es comprimeixen a SPZ (632 KB) i la web els dibuixa amb el renderer de splats de three.js, dins del pressupost. S'ha provat amb un model de llicència oberta, no amb una sabatilla nostra: falta la captura real i la transició a la radiografia. Detall a `docs/explorations/E06-splats.md`; prototip a `/ds/explorations/e06-splat/`.

## Sense escàner: semblants i rànquings (26 de novembre de 2026)

La fase ja no depèn d'escanejar cap sabatilla: els models de fotos i la radiografia fan la part visual, i E06 queda com a camí provat i opcional. El que s'hi ha posat al lloc és el que algú ve a buscar de debò: **«tinc aquesta i em va bé, quina s'hi assembla?»** i **«quina és la més lleugera, la de més sola, la de menys drop?»**.

### Semblants

- **A cada fitxa**, una banda «Semblants» (`#semblants`): les cinc que més s'hi assemblen del seu terreny i les cinc de l'altre, cadascuna amb el perquè en una línia («Molt semblant: mateix drop · 2 mm més de taló · 12 g menys · també neutra»). Es veu una llista cada vegada i l'adreça diu quina (`?per=road`); sense JavaScript hi són totes dues.
- **Des del catàleg i des de la portada**, «Ja en tens una que et va bé?»: tries la teva i el terreny per al qual en busques una, i et porta a la fitxa, a la llista que toca.
- **Si la teva no és al catàleg** (un model d'una altra temporada: Asics ja ven la Trabuco 14 i no la 13), `/ca/sabatilles/semblants/` deixa escriure'n les xifres: drop, pes, alçades i trepitjada. El càlcul es fa al navegador amb la mateixa regla i no s'envia res; el que s'escriu queda a l'adreça, per poder-ho enllaçar.

**La regla** (`src/content/similar-keys.ts`, amb proves): només es compara el que les dues marques declaren. El drop es compara tal com és; el pes i les alçades, d'un terreny a l'altre, pel lloc que cada sabatilla té entre les del seu (grams i mil·límetres per sobre o per sota de la mediana del catàleg en aquell terreny), perquè una sabatilla de muntanya pesa més i porta menys escuma. Hi compten també, quan les dues marques ho diuen, el suport, l'ús i si hi ha placa per córrer; els tacs, només entre dues de muntanya. Una diferència clara és 4 mm de drop, 5 mm d'alçada, 30 g o 1,5 mm de tac. Cal un mínim de dues xifres en comú, i «molt semblant» en demana tres i cap diferència clara. Els pesos de cada part i els llindars són nostres, i la pàgina ho diu. No hi ha cap percentatge de semblança: s'ensenya l'ordre i el perquè.

### Rànquings

El catàleg i cada llista de «Què busques?» es poden **ordenar per una xifra** («Ordena per»: pes, alçada al taló, drop, tacs): la llista deixa els grups i queda numerada, amb els empats compartint lloc. Els models que no declaren la xifra no hi surten, i la pàgina diu quants són. L'ordre es combina amb els filtres i queda a l'adreça (`?ordre=pes&terreny=trail`); sota «Què busques?» hi ha l'entrada directa a cada rànquing. Amb un ordre triat, els mapes s'aparten perquè el primer de la llista quedi sota el filtre.

### Trepitjada i ús: què s'ha llegit

De la pàgina de cada model, al web de la marca, i amb les paraules de la marca al costat (`src/content/shoe-traits/<marca>.json`): si diu que és neutra o d'estabilitat, i per a què diu que és (competició, ritme, dia a dia, tirada llarga, ultra). D'aquí surten dos filtres nous, sis llistes («Competir», «Fer ritme», «El dia a dia», «Tirades llargues», «Ultres», «Amb suport») i dues línies a la fitxa. No és cap valoració nostra ni cap consell: la pàgina «Amb suport» diu que no sap si en necessites.

Llegides les 17 marques (7 amb peticions simples, 10 amb el navegador, el 26 de novembre): dels 169 models, **90 diuen el suport** (76 neutres, 14 d'estabilitat), **126 diuen per a què són** i 57 anomenen una distància. Salomon, Scarpa i La Sportiva no diuen mai el suport; quan parlen d'«estabilitat» és del terreny, i no s'ha comptat.

També s'han afegit al catàleg els **8 models de muntanya d'Asics** de la gamma actual, llegits al seu web.

Peces del sistema de disseny tocades: `SegmentedControl` (`labelled`), `ShoeRow` (nota que un script omple) i `TextField` (`inputmode`); vegeu el CHANGELOG.

### Què no s'ha mirat

- **Una sola lectura** de la trepitjada i l'ús, feta per agents; les lectures dubtoses són anotades a cada fitxer (`note`), i les més febles són les que surten d'un camp genèric de la marca (a Asics, «Objetivo: Correr más lejos» s'ha llegit com a tirada llarga). No s'ha forçat cap lectura: a Brooks, «Soporte equilibrado» no s'ha pres per «neutra»; a Adidas, l'etiqueta «Lo mejor para: Competición», que porten tots els models, només compta on la descripció també ho diu; i l'Asics Gel-Kayano 33, que es contradiu, queda sense suport.
- **La Trabuco 13 ja no és al web d'Asics** (ni a la llista de trail ni al cercador): s'hi ha posat la 14, i la 13 entra per la pàgina de xifres a mà.
- **La regla de semblança no l'ha jutjada cap corredor.** Amb dues xifres en comú (drop i pes), que és el que declaren moltes marques, la llista és honesta però poc fina: per això no passa de «Semblant».
- **Safari, Firefox i un mòbil real**: provat només amb Chromium, a mida d'escriptori i de mòbil.

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
