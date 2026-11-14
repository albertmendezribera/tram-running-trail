# E18 · El recorregut a peu de ruta

**Estat:** construït com a tercera vista del visor de rutes («A peu»), publicat a l'entorn de proves · **Data:** 2026-11-14 · **Decisió:** escena pròpia en three.js sobre el terreny i l'ortofoto de l'ICGC, amb el que hi ha al llarg de la ruta segons les seves dades, sol amb ombres i una càmera de tercera persona

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

`packages/terrain-pipeline` (`world-cli`) ho baixa un cop per ruta: `world.json` (arbres i edificis), `ortho.webp` (l'ortofoto de tot el terreny, a 2 m per píxel, uns 600 KB) i `land.png` (el tipus de terra a 4 m per píxel). Calonge té 7.831 arbres (3.541 pins, 2.954 alzines, 81 caducifolis, 1.255 oliveres) i 309 edificis; Sils, 1.942 arbres i 128 edificis. Tot plegat només es carrega quan es tria la vista «A peu».

Les capes LiDAR arriben com a imatges de grisos que el servei estira de manera diferent a cada petició. El generador pregunta al servei el valor real de dotze píxels, ajusta la recta de gris a valor i falla si no encaixa (0,6 m en alçada, 2,5 punts en recobriment).

## Com es dibuixa

Primer es va provar dins de MapLibre, amb els arbres en una capa pròpia. Funcionava, però MapLibre no deixa fer ombres ni tocar el terra, i es va refer com a escena de three.js (`three/walk-viewer`), amb el mateix `WebGPURenderer` de la vista cartogràfica.

- **Textures**: totes es pinten en un llenç quan arrenca la vista (`textures.ts`): herba, herba seca, fullaraca, terra batuda, asfalt, escorça, teula, un pany de paret amb finestra i porticons, i el fullatge de cada tipus d'arbre. No es baixa cap imatge ni n'hi ha cap de generada per IA.
- **Terra**: la malla del model d'elevacions. De prop cada tipus de terra del mapa de cobertes ensenya la seva textura (herba al prat, fullaraca al bosc, herba seca i terra al matollar), i l'ortofoto hi posa la claror i una mica del to de cada lloc. De lluny és només l'ortofoto.
- **Camí i carretera**: el mapa base de l'ICGC diu quins vials són pavimentats. On ho són (un 3 % de Calonge i un 4 % de Sils), asfalt amb les línies blanques; a la resta, terra batuda que es desfà a les vores. Al mig, la línia de la ruta: el que falta, del color del seu pendent; el que s'ha fet, clar.
- **Arbres**: un cos fosc (tronc amb escorça i el cor de la copa) i, a sobre, làmines de fullatge repartides per la copa, il·luminades com el volum on són. De prop, més làmines i ombra projectada; de lluny, menys. Les fulles que quedarien a tocar de la càmera es deixen de dibuixar.
- **Matolls i herba**: de decoració. Es posen segons el tipus de terra, prop del camí i mai sobre l'asfalt; no surten de cap mesura.
- **Edificis**: murs amb un pany de finestra cada tres metres i un per planta, del color de cada casa; teulada a quatre aigües amb ràfec a les cases i coberta plana de xapa a les naus grans.
- **Llum**: un sol de tarda que fa ombres al voltant del corredor, cel amb núvols, boirina amb la distància i una gradació final (més color, to càlid, cantonades més fosques).
- **Càmera**: de tercera persona, 19 m darrere del corredor **seguint el camí** (no en línia recta, que travessaria troncs) i a 5,6 m del terra. En un marc vertical (mòbil) l'angle és més obert. A la sortida i a l'arribada s'enlaira i ensenya tota la ruta.
- **Corredor**: una figura que mou cames i braços segons els metres recorreguts, sobre un anell del color de senyal.
- El que creix es talla en trams de ruta i només es dibuixen els propers a la càmera. Dibuixa només quan canvia la posició.

![Sortida, pineda, poble i ruta plana](E18/walk.jpg)

## Què no s'ha verificat, i límits

- **No és un GTA d'avui, ni el vídeo de referència.** El vídeo «GTA: San Madrid» que es va posar com a objectiu és una animació generada amb IA, no un joc: cada fotograma l'ha pintat un model de vídeo, i això no es pot fer en temps real en un navegador ni sense inventar-se el lloc. El que hi ha s'assembla a un joc de l'època de Vice City: geometria senzilla amb textures a tot arreu. No hi ha cotxes, gent, aigua, roques, tanques ni rètols.
- **El corredor** mou cames i braços, però és una figura de càpsules, no un personatge.
- **Cap mòbil real.** S'ha mirat amb la GPU d'aquest Mac (WebGPU) i a mida de mòbil al mateix ordinador. No se sap com va en un telèfon. Per això la vista per defecte continua sent «Realista».
- **Les proves automàtiques** fan servir un renderitzador per programari: comproven que la vista arrenca i quants arbres hi ha, no com es veu ni a quina velocitat.
- **El LiDAR és del 2016-2017 i la fotografia és posterior**: on s'ha plantat o talat des de llavors, arbres i foto no coincideixen (es veu a les plantacions de Sils).
- **Les capes d'arbrat només cobreixen el bosc**: jardins, arbres de carrer i fruiters no hi surten. Les vinyes es deixen sense ceps.
- **Segons el mapa de l'ICGC, la ruta de Sils només és pavimentada en un 4 %**: la cursa de mostra que hi passa porta l'etiqueta «Asfalt» perquè és inventada, i no s'hi adiu.
- **El corredor** de dades és de 110 m a banda i banda per als arbres i de 260 m per als edificis; l'herba, a 11 m del camí. Més enllà el paisatge és la fotografia sobre el relleu.
- La vista «Cartogràfic» i la «Realista» no tenen arbres ni edificis.
