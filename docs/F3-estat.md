# Fase 3 · Catàleg de sabatilles: on som

**Data:** 2026-11-19 · **Encàrrec:** «100 vambes al web: marques top, top models» (Altra, Nike, Adidas, On, La Sportiva, NNormal, Brooks, Asics, New Balance, Decathlon, Puma i d'altres).

## Què hi ha

| Peça | On | Estat |
|---|---|---|
| Catàleg | `/ca/sabatilles/`, «El catàleg, marca a marca» | **18 models de 2 marques** (NNormal 5, Topo Athletic 13), a més de les dues sabatilles de la Fase 1 mesurades en laboratori |
| Fitxa d'un model del catàleg | `/ca/sabatilles/<marca>/<model>/` | Feta: les xifres que declara la marca, la radiografia quan declara les dues alçades, i l'enllaç a la pàgina del model al web de la marca |
| Dades | `apps/web/src/content/shoe-catalog.json` | Un registre per model, amb l'adreça d'on s'ha llegit cada xifra i el dia de la consulta |

## La regla de les dades

La que ja fixava `docs/revisio-legal.md` (punt 4): **el catàleg es fa només amb el que declara cada fabricant al seu web.** Cap mesura de laboratori de tercers, cap xifra d'un comparador, cap xifra de memòria.

- El que una marca no diu queda sense dada. La Kboix de NNormal, per exemple, no porta cap xifra a la seva pàgina i surt així.
- La radiografia es dibuixa només si la marca declara l'alçada al taló i a l'avantpeu (14 dels 18). Sense elles, la fitxa diu que no es pot dibuixar.
- Un pes declarat en unces es mostra en grams, amb la xifra original al costat.
- Cada marca mesura l'alçada a la seva manera: la fitxa diu que no es poden comparar al mil·límetre entre marques.

## Com s'han llegit

Amb peticions simples a la pàgina de cada model, sense disfressar-les de navegador, respectant l'espera que demana cada `robots.txt` (5 segons a NNormal). La llista de models surt del mapa del web (sitemap) de cada marca; de cada línia s'ha pres la versió més nova que hi surt.

Cap de les vint marques mirades prohibeix els agents al seu `robots.txt`. Però:

| Responen a una petició simple | Rebutgen les peticions automàtiques (403/406) |
|---|---|
| Nike, On, NNormal, Puma, Altra, Saucony, Mizuno, Scarpa, Merrell, Topo Athletic, Decathlon | Adidas, La Sportiva, Brooks, Asics, New Balance, Hoka, Salomon, Inov8 |

Altra va respondre 429 (massa peticions) a la primera fitxa: s'hi ha de tornar més a poc a poc.

## Què falta per arribar a 100

- **82 models.** De les marques que es deixen llegir en poden sortir uns quants desenes (Altra sola té una quinzena de línies vigents). Cada marca escriu les xifres a la seva manera, i Nike sovint no declara les alçades.
- **Les marques que rebutgen peticions automàtiques** són justament moltes de les demanades (Adidas, La Sportiva, Brooks, Asics, New Balance, Hoka). S'han de llegir amb un navegador, pàgina a pàgina, i parar si en alguna surt una comprovació antirobots.
- **Triar els models:** «top models» és un criteri del titular. Fins ara s'ha agafat tota la gamma vigent de running de cada marca llegida, no una tria.
- **Mitjasola de Topo:** les pàgines l'anomenen, però no de manera que es pugui llegir sense interpretar; s'ha deixat sense dada.

## Què no s'ha fet

- **Mapa del catàleg** (dispersió pes × alçada, CLAUDE.md 3) i filtres per marca i terreny. Amb 18 models encara no calen; amb 100, sí.
- **Comparador:** només compara les dues sabatilles de laboratori. Comparar models del catàleg entre marques demana decidir què es fa amb alçades que no es mesuren igual.
- **Producció:** el catàleg només és a staging. Els noms de marca continuen pendents de revisió legal, com a la Fase 1.
- **Cap xifra s'ha contrastat** amb una segona font: és el que diu la pàgina de la marca el dia de la consulta.
