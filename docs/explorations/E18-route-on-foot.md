# E18 · El recorregut a peu de ruta

**Estat:** construït com a tercera vista del visor de rutes («A peu»), publicat a l'entorn de proves · **Data:** 2026-11-12 · **Decisió:** MapLibre amb el terreny i l'ortofoto de l'ICGC, edificis del mapa, arbres de malla dibuixats per instàncies a partir del LiDAR, i una càmera baixa

## Pregunta

El visor de rutes pot tenir aspecte de videojoc (arbres, edificis, cel) sense inventar-se el paisatge?

## D'on surt cada cosa

| Element | Font (ICGC, CC BY 4.0) | Què és dada | Què no ho és |
|---|---|---|---|
| Terreny i fotografia | Model d'elevacions de 5 m i ortofoto | Tot | — |
| Edificis | Tessel·les vectorials del mapa base (`building`, `render_height`) | La planta i l'alçada | El color de la paret i de la teulada |
| Arbres de bosc | Variables biofísiques de l'arbrat, LiDAR 2016-2017, cel·les de 20 m: recobriment arbori i alçada mitjana | Quants arbres hi ha a cada cel·la (segons el recobriment) i com són d'alts | On és cada arbre dins la cel·la; la forma de la copa |
| Tipus d'arbre | Mapa de cobertes del sòl 2024 | Si és bosc d'aciculifolis (pi), d'esclerofil·les (alzina, surera), de caducifolis o de ribera | L'espècie concreta |
| Oliverars | Mapa de cobertes del sòl 2024 | On hi ha oliverar | Les fileres (cada 7 m) i l'alçada (4 m): típiques del conreu |

`packages/terrain-pipeline` (`world-cli`) ho baixa un cop per ruta i ho desa a `world.json`: Calonge té 7.978 arbres (3.614 pins, 3.023 alzines, 86 caducifolis, 1.255 oliveres) i 309 edificis (79 KB comprimit); Sils, 1.958 arbres i 128 edificis (23 KB). El fitxer només es carrega quan es tria la vista «A peu».

Les capes LiDAR arriben com a imatges de grisos que el servei estira de manera diferent a cada petició. El generador pregunta al servei el valor real de dotze píxels, ajusta la recta de gris a valor i falla si no encaixa (0,6 m en alçada, 2,5 punts en recobriment).

## Com es dibuixa

- **Arbres**: una capa pròpia dins de MapLibre (`map/route-viewer/trees.ts`), en WebGL 2. Quatre malles (pi, alzina, caducifoli, olivera), cadascuna dibuixada una vegada per arbre en una sola crida (instàncies). Llum embolcallant, clapes de fullatge fetes al shader, una taca d'ombra a terra per arbre i boirina amb la distància.
- **Edificis**: prismes de MapLibre a l'alçada del mapa, amb una llosa de teula a sobre.
- **Càmera**: 88 m darrere del corredor i 34 m amunt, sense exagerar el relleu (a la vista «Realista» s'exagera ×1,3).
- Dibuixa només quan canvia la posició, com les altres dues vistes.

![Calonge i Sils a peu](E18/walk.jpg)

## Què no s'ha verificat, i límits

- **No és GTA ni Red Dead.** És un pas en aquesta direcció: arbres de malla senzilla, cases sense façana, cap ombra projectada de debò, i el terra és una fotografia aèria que de prop es veu borrosa.
- **Cap mòbil real.** S'ha mirat al Chromium d'aquest Mac amb la seva GPU. Calonge són prop d'un milió de triangles per fotograma; en un mòbil antic pot anar just. Per això la vista per defecte continua sent «Realista».
- **Les proves automàtiques** fan servir un renderitzador per programari: comproven que la vista arrenca i quants arbres hi ha, no com es veu ni a quina velocitat.
- **El LiDAR és del 2016-2017 i la fotografia és posterior**: on s'ha plantat o talat des de llavors, arbres i foto no coincideixen (es veu a les plantacions de Sils).
- **Les capes d'arbrat només cobreixen el bosc**: jardins, arbres de carrer i fruiters no hi surten. Les vinyes es deixen planes.
- **L'alçada del terra sota cada arbre** surt del nostre model de 5 m; MapLibre dibuixa el seu amb una malla més grollera, i en un pendent fort un arbre pot quedar mig metre enfonsat o enlaire.
- **El corredor** és de 110 m a banda i banda per als arbres i de 260 m per als edificis: més enllà el paisatge torna a ser només la fotografia.
- La vista «Cartogràfic» no té arbres ni edificis.
