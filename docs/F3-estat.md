# Fase 3 · Catàleg de sabatilles: on som

**Data:** 2026-11-20 · **Encàrrec:** «100 vambes al web: marques top, top models» (Altra, Nike, Adidas, On, La Sportiva, NNormal, Brooks, Asics, New Balance, Decathlon, Puma i d'altres).

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Catàleg | `/ca/sabatilles/`, «El catàleg» | **161 models de 17 marques**, a més de les dues sabatilles de la Fase 1 mesurades en laboratori |
| Fitxa d'un model del catàleg | `/ca/sabatilles/<marca>/<model>/` | Feta: les xifres que declara la marca, la radiografia quan declara les dues alçades, la nota quan la pàgina es contradiu, i l'enllaç a la pàgina del model |
| Mapa del catàleg | `/ca/sabatilles/`, sobre la llista | Fet: dos mapes, «pes i alçada al taló» (67 models) i «pes i drop» (132), amb una forma per terreny. Cada punt és un enllaç a la fitxa; les xifres, també en una taula |
| Filtres | `/ca/sabatilles/` | Fets: per marca i per terreny. Amaguen files de la llista i punts dels mapes alhora, i queden a l'adreça (`?marca=puma&terreny=trail`) |
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

## Què no s'ha fet

- **Triar dos punts del mapa i comparar-los** (CLAUDE.md 9.3): el mapa porta a la fitxa, però no compara. Depèn del comparador, que és el punt següent.
- **Comparador:** només compara les dues sabatilles de laboratori. Comparar models del catàleg entre marques demana decidir què es fa amb alçades que no es mesuren igual.
- **Producció:** el catàleg només és a staging. Els noms de marca continuen pendents de revisió legal, com a la Fase 1.
- **Cap xifra s'ha contrastat** amb una segona font ni amb una segona lectura: és el que deia la pàgina de la marca el dia de la consulta, llegit una vegada.
