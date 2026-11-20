# Fase 3 · Catàleg de sabatilles: on som

**Data:** 2026-11-20 · **Encàrrec:** «100 vambes al web: marques top, top models» (Altra, Nike, Adidas, On, La Sportiva, NNormal, Brooks, Asics, New Balance, Decathlon, Puma i d'altres).

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Catàleg | `/ca/sabatilles/`, «El catàleg, marca a marca» | **121 models de 13 marques**, a més de les dues sabatilles de la Fase 1 mesurades en laboratori |
| Fitxa d'un model del catàleg | `/ca/sabatilles/<marca>/<model>/` | Feta: les xifres que declara la marca, la radiografia quan declara les dues alçades, la nota quan la pàgina es contradiu, i l'enllaç a la pàgina del model |
| Dades | `apps/web/src/content/shoe-catalog.json` | Un registre per model, amb l'adreça d'on s'ha llegit cada xifra i el dia de la consulta (`accessed`) |

| Marca | Models | Què declara a la fitxa |
|---|---|---|
| On | 18 | Pes i drop. Cap alçada, ni la talla pesada |
| Nike | 14 | Pes aproximat (talla UK 9) i drop. Cap alçada |
| Topo Athletic | 13 | Pes (en unces), alçades i drop |
| Puma | 12 | Pes (talla 42), alçades i drop a gairebé totes |
| Mizuno | 11 | Pes sense talla; drop i alçada només en alguns, i sovint sense dir on es mesura |
| Merrell | 10 | Pes de mitja parella, alçades, drop i tacs |
| Altra | 8 | Pes (unces i grams), alçada i drop |
| Adidas | 8 | Pes amb talla, alçades i drop a la majoria; dos models sense cap xifra han quedat fora |
| La Sportiva | 6 | Alçades, drop i tacs; el pes, només en un |
| Asics | 6 | Pes i drop. Cap alçada |
| Brooks | 5 | Pes (unces i grams) i drop. Cap alçada |
| Decathlon (Kiprun) | 5 | Pes, alçades i drop als d'asfalt; als de muntanya, només els tacs |
| NNormal | 5 | Pes, alçades, drop i tacs, tret de la Kboix |

## La regla de les dades

La que ja fixava `docs/revisio-legal.md` (punt 4): **el catàleg es fa només amb el que declara cada fabricant al seu web.** Cap mesura de laboratori de tercers, cap xifra d'un comparador, cap xifra de memòria.

- El que una marca no diu queda sense dada.
- La radiografia es dibuixa només si la marca declara l'alçada al taló i a l'avantpeu (52 dels 121). Sense elles, la fitxa diu que no es pot dibuixar.
- Un pes declarat en unces es mostra en grams, amb la xifra original al costat.
- Cada marca mesura l'alçada a la seva manera: la fitxa diu que no es poden comparar al mil·límetre entre marques.
- **Quan la pàgina es contradiu, no es tria.** Si les dues alçades i el drop no quadren (Puma Deviate Nitro Elite 4, Merrell Agility Trail, La Sportiva Mutant), es posen com hi són i la fitxa ho diu. Si hi ha dos drops (Puma Fast-Trac Nitro 4), no se'n posa cap.
- **Una alçada sense lloc no es posa enlloc.** «Stack Height: 38mm», sense dir si és al taló, va a la nota de la fitxa, no al camp del taló. L'única excepció és Altra amb drop 0, on una sola alçada val per als dos punts, i la fitxa ho diu.
- **Mizuno:** el camp «Weight(g)» de les seves pàgines és de vegades d'una sabatilla i de vegades del parell (640 g), sense dir-ho. Els models on no es pot saber han quedat fora (Wave Horizon 9, Ultima 17, Skyrise 7, Rebellion Flash 3, Daichi 9, Mujin 11, Neo Lumina). El camp «Stack (mm)» hi sembla el drop; no s'ha posat com a cap de les dues coses, i surt a la nota.

## Com s'han llegit

- **Amb peticions simples**, sense disfressar-les de navegador i amb cinc segons entre pàgines: NNormal, Topo Athletic, On, Merrell, Mizuno, Puma i Nike. La llista de models surt del mapa del web (sitemap) de cada marca.
- **Amb el navegador, pàgina a pàgina:** Altra, Adidas, La Sportiva, Asics, Brooks i Decathlon, que rebutgen o limiten les peticions simples (403, 406 o 429). Cap ha mostrat una comprovació antirobots.
- Cap de les marques mirades prohibeix els agents al seu `robots.txt`.

## Què no hi és, i per què

- **New Balance:** la fitxa que s'ha mirat (FuelCell Rebel v5, web d'Espanya) no declara ni pes, ni drop, ni alçades. No s'hi ha posat cap model.
- **Saucony:** les xifres no són a la pàgina que respon a una petició simple; cal llegir-la amb navegador. Pendent.
- **Scarpa:** va respondre 429 a la primera fitxa. Pendent, amb navegador.
- **Hoka, Salomon, Inov8:** rebutgen les peticions simples. Pendents, amb navegador.
- **Triar els models:** «top models» és un criteri del titular. S'ha agafat la gamma vigent de running de cada marca, sense versions impermeables, amples ni col·laboracions; no és una tria.
- **Mitjasola de Topo:** les pàgines l'anomenen, però no de manera que es pugui llegir sense interpretar; s'ha deixat sense dada.

## Què no s'ha fet

- **Mapa del catàleg** (dispersió pes × alçada, CLAUDE.md 3) i filtres per marca i terreny. Amb 121 models ja calen: la llista és llarga.
- **Comparador:** només compara les dues sabatilles de laboratori. Comparar models del catàleg entre marques demana decidir què es fa amb alçades que no es mesuren igual.
- **Producció:** el catàleg només és a staging. Els noms de marca continuen pendents de revisió legal, com a la Fase 1.
- **Cap xifra s'ha contrastat** amb una segona font ni amb una segona lectura: és el que deia la pàgina de la marca el dia de la consulta, llegit una vegada.
