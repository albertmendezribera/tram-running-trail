# E21 · Palamós a peu: el poble sencer com a joc, amb dades obertes

**Estat:** construït i publicat a l'entorn de proves, a `/ca/rutes/palamos/a-peu/`; fora de producció · **Data:** 2026-11-21 · **Veredicte:** des de dalt i des del carrer es reconeix la platja, el passeig i el front marítim; les façanes són decoració i de molt a prop el terra és tou

## Pregunta

Després d'aparcar el vol i la vista «A peu» del visor (E18, E20), el titular va obrir un subprojecte a part, fora d'aquest repositori (`palamos-open-world`): un Palamós en 3D fet amb Godot 4, només amb eines i dades obertes, on un corredor fa la ruta gravada. Fetes les quatre fases del seu document, va demanar d'iterar-lo, publicar-lo, afegir-lo a la ruta de Palamós i posar-hi una entrada al menú.

Aquest document diu què hi ha, què s'ha mesurat i què no.

## Què és

Un programa a part (una exportació web de Godot 4.7, WebGL 2) que la pàgina obre dins d'un marc quan es prem un botó. Dos modes: el corredor fa la ruta tot sol (10,2 km, a 5 min/km), o el visitant passeja pel seu compte des del Passeig del Mar.

| De debò | Font |
|---|---|
| El relleu (5 m) i la vora del mar | ICGC |
| L'alçada de 5.441 cases, sobre la planta d'OpenStreetMap | LiDAR de l'ICGC, 2021-2023 |
| 11.917 arbres: on són, l'alçada i el color | El mateix LiDAR i l'ortofoto |
| El color del terra, del mar i de cada teulada | Ortofoto de l'ICGC, 1 m per píxel |
| Carrers, plantes dels edificis i 380 noms de carrer | OpenStreetMap |
| El traçat de la ruta | El GPS d'una sortida del titular: només la posició dels punts |

Decoració, perquè cap dada oberta ho diu: les façanes (finestres, porticons, balcons, portes, el color de la paret), les voreres i les ratlles dels carrers, la forma de les copes i el corredor, que és un maniquí. Res no és una imatge generada per IA: tot el que no és l'ortofoto és càlcul.

## Mesures

| | |
|---|---|
| El que baixa qui hi entra | 52 MB (10 MB de motor, 42 MB de món), només en prémer un botó |
| JavaScript de la pàgina abans de prémer res | 2 KB |
| La ruta sencera, sense finestra | 10,5 km correguts en 53 min 16 s de joc, cap encallament, 9 cases vorejades; la meitat del temps a menys de 0,8 m del traç gravat |
| Fotogrames per segon, Mac M2, en finestra, amb el mateix motor de pintar que el navegador | entre 128 i 180 a 1600 × 900 |
| Al navegador (Chromium, Mac M2) | es baixa, es munta i arrenca en els dos modes; els fotogrames per segon, amb l'aspecte d'ara, no s'han pogut mesurar (amb l'anterior, 60) |

Cloudflare no accepta fitxers de més de 25 MiB: el motor es desa comprimit i el món, partit en trossos de 20 MB, i la pàgina del programa els torna a muntar.

## Com entra a la web

- Els 52 MB **no són al repositori**. `scripts/sync-palamos-world.sh` els copia a `public/mon/palamos/` des d'on es construeixen, i `deploy-staging.sh` el crida. Una construcció sense el programa (la de CI) dona la mateixa pàgina, que diu que no el porta quan es prem el botó.
- Un component nou del design system, `GameStage`: un pòster, els botons dels modes i el pes dit abans de baixar res; en prémer, el marc, «Pantalla completa» i «Tanca».
- La pàgina, l'entrada al menú i el bloc de la ruta de Palamós només surten on es prova la web (desenvolupament i entorn de proves), com les dades de mostra.

## Què no s'ha comprovat

- Cap telèfon de debò, ni Safari, ni Firefox, ni la memòria que gasta en un mòbil. Els controls tàctils s'han provat amb dits simulats.
- La pantalla completa, només en Chromium sense finestra.

## Rètols i llocs singulars (22 de novembre de 2026)

El titular ho va demanar: «Afegeix botigues, rètols i edificis emblemàtics d'OpenStreetMap».

- **Què s'ha baixat:** 362 llocs amb nom (148 bars i restaurants, 109 botigues, 18 hotels i càmpings, 11 farmàcies, 6 bancs, serveis, esglésies, fars, museus, escultures i miradors). Els despatxos i les consultes no hi entren: sovint porten el nom d'una persona. Per la mateixa raó, el rètol d'una farmàcia diu només «Farmàcia».
- **Rètols:** 329, dels quals 318 pengen d'una façana i 11 van de peu (guinguetes, càmpings, mercats a l'aire lliure). 19 són plaques d'edificis amb nom propi. El nom i el punt són d'OpenStreetMap; la paret es dedueix (la més propera al punt que doni a fora i a un carrer); la mida, el color i la lletra són decoració. 13 no hi han cabut i 9 eren repetits.
- **Llocs singulars:** 41 amb el nom surant a sobre, que es veu de lluny (el far, des de 1.400 m; una escultura, des de 300 m) i no es trepitgen entre ells. A prop, el text de dalt de la pantalla diu «A prop: …».
- **Esglésies, capelles i far:** sis edificis que ja no es pinten com una casa de pisos: paret de carreus o blanca, finestres altes i un portal. Decoració també, però sense balcons ni tendals.
- **Pes:** el mateix, 52 MB (el fitxer dels rètols fa 21 KB). **Ritme:** entre 147 i 187 fotogrames per segon al Mac M2 a 1600 × 900, amb el motor de pintar del navegador.
- **Comprovat:** la ruta sencera torna a passar igual (10,5 km, cap encallament); una prova nova (`tools/check_places.gd`) compta els rètols, mira que les lletres es fan en acostar-s'hi i es desfan en allunyar-se'n, i que el text de dalt diu el lloc proper; al navegador (Chromium, Mac) les lletres dels rètols i el «A prop» es veuen.
- **No comprovat:** cap mòbil; ningú ha passejat carrer per carrer mirant si cada rètol és a la casa que toca.
- **Què no hi és:** la Torre Valentina i altres elements que a OpenStreetMap no són un edifici tenen nom però no volum. Cap logotip: només el nom, en lletra de pal.

## Què li falta per assemblar-se més a Palamós

Les façanes de debò no són a cap dada oberta (E20). El que sí que hi és i encara no s'ha fet servir: les plantes i l'any de cada casa del Cadastre (E18), i el tipus d'arbre del mapa de cobertes. No s'ha fet una altra ronda sense que el titular digui, mirant-ho, què hi troba a faltar.

## Recomanació

Deixar-ho a l'entorn de proves fins que el titular ho hagi vist en el seu telèfon. Abans de producció: la revisió legal de les atribucions (ICGC, OpenStreetMap) i decidir si 52 MB són acceptables en mòbil o cal una versió més lleugera.
