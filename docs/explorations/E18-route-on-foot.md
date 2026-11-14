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

- **Textures**: totes es pinten en un llenç quan arrenca la vista (`textures.ts`): herba, herba seca, fullaraca, terra batuda, asfalt, escorça, teula, una massa de fulles per al cor de les copes, el fullatge de cada tipus d'arbre i una tira de sis panys de paret (finestra amb porticons, balcó, porticons tancats, paret nua, porta i portal de nau). No es baixa cap imatge ni n'hi ha cap de generada per IA.
- **Terra**: la malla del model d'elevacions. **El color és el de l'ortofoto**: un bosc es queda fosc i un rostoll clar. De prop, la textura de cada tipus de terra del mapa de cobertes hi posa el gra que a la fotografia li falta (més clar i més fosc que la seva pròpia mitjana) i una mica del seu color. De lluny és només l'ortofoto. Abans el color era el de la textura, i una màquia densa sortia com un turó d'herba groga.
- **Alçada del terra**: tot el que es posa a terra (camí, plantes, cases) pren l'alçada del mateix triangle de la malla que té a sota. Interpolant entre les quatre cel·les del voltant, el camí quedava un pam enterrat en uns llocs i un pam enlaire en uns altres.
- **Camí i carretera**: el mapa base de l'ICGC diu quins vials són pavimentats. On ho són (un 3 % de Calonge i un 4 % de Sils), asfalt amb les línies blanques; a la resta, terra batuda amb dues roderes i les vores desfetes. Al mig, la línia de la ruta: el que falta, del color del seu pendent; el que s'ha fet, clar.
- **Arbres**: tronc amb escorça, un cor de copa amb fulles i, a sobre, làmines de fullatge repartides per la copa, il·luminades com el volum on són. De prop, més làmines i ombra projectada; de lluny, menys. Les fulles que quedarien a tocar de la càmera es deixen de dibuixar. Una part del seu verd és el de l'ortofoto al lloc on són.
- **Catifa d'herba, matolls i pedres** (`carpet.ts`): de decoració, però posada on toca. Un nombre fix de mates acompanya el corredor, cel·la a cel·la, en lloc de tenir-ne a tota la ruta: així poden ser denses on es veuen (herba fins a 44 m, matolls i pedres fins a 120 m; menys en una pantalla estreta o sense WebGPU). Quantes n'hi ha depèn del tipus de terra del mapa de cobertes i de com de fosca i verda és l'ortofoto en aquell punt: el matollar dens en té moltes, un tros pelat gairebé cap. El que creix a cada cel·la depèn només de la cel·la: tornar a un lloc hi troba les mateixes mates. Prenen el color de l'ortofoto, deixen lliure el camí i no surten dins de cap edifici. A la vora de la catifa s'encongeixen fins a desaparèixer.
- **Edificis**: cada mur es talla en panys i plantes sencers, i cada pany de cada planta pren un dels dibuixos de la tira, de manera que cap finestra queda tallada per una cantonada. A peu de carrer, de tant en tant una porta. Les cases petites porten teulada a quatre aigües amb ràfec i una xemeneia; les plantes grans i altes són blocs de pisos amb finestres i coberta plana; les grans i baixes, naus de paret nua amb algun portal i coberta de xapa. Sota el nivell de planta, un sòcol de pedra.
- **Llum**: un sol de tarda que fa ombres al voltant del corredor (arbres, cases, matolls i pedres), cel amb núvols, boirina amb la distància i una gradació final (més color, to càlid, cantonades més fosques).
- **Càmera**: de tercera persona, 19 m darrere del corredor **seguint el camí** (no en línia recta, que travessaria troncs) i a 5,6 m del terra. En un marc vertical (mòbil) l'angle és més obert. A la sortida i a l'arribada s'enlaira i ensenya tota la ruta.
- **Corredor**: una figura amb samarreta del color de senyal, pantalons curts, sabatilles i cabells. Les cames es dobleguen pel genoll i els braços pel colze, al ritme dels metres recorreguts, sobre un anell del mateix color.
- Els arbres es tallen en trams de ruta i només es dibuixen els propers a la càmera. Dibuixa només quan canvia la posició.

![Pineda, màquia, poble i plantacions, a la tercera ronda](E18/walk-3.jpg)

La ronda anterior, per comparar:

![Sortida, pineda, poble i ruta plana](E18/walk.jpg)

## Què no s'ha verificat, i límits

- **No és un GTA d'avui, ni el vídeo de referència.** El vídeo «GTA: San Madrid» que es va posar com a objectiu és una animació generada amb IA, no un joc: cada fotograma l'ha pintat un model de vídeo, i això no es pot fer en temps real en un navegador ni sense inventar-se el lloc. El que hi ha s'assembla a un joc de món obert de fa unes quantes generacions: geometria senzilla, textures a tot arreu i vegetació densa a prop. No hi ha cotxes, gent, aigua, tanques, murs de pedra ni rètols.
- **Més enllà de la catifa el matollar és només la fotografia** sobre el relleu: un vessant a 200 m es veu llis i borrós (l'ortofoto és de 2 m per píxel).
- **On va cada matoll i cada pedra no és cap dada.** La densitat segueix el mapa de cobertes i la fotografia, però és una suposició: el mapa diu «matollar», no quants matolls.
- **El corredor** és una figura articulada de peces arrodonides: no té cara ni roba amb plecs.
- **Cap mòbil real.** S'ha mirat amb la GPU d'aquest Mac (WebGPU), a mida d'escriptori i de mòbil: 60 fotogrames per segon en tots dos casos. No se sap com va en un telèfon. Per això la vista per defecte continua sent «Realista».
- **Les proves automàtiques** fan servir un renderitzador per programari: comproven que la vista arrenca, quants arbres hi ha i que la catifa es pobla quan el corredor avança, no com es veu ni a quina velocitat.
- **El LiDAR és del 2016-2017 i la fotografia és posterior**: on s'ha plantat o talat des de llavors, arbres i foto no coincideixen (es veu a les plantacions de Sils).
- **Les capes d'arbrat només cobreixen el bosc**: jardins, arbres de carrer i fruiters no hi surten. Les vinyes es deixen sense ceps.
- **Segons el mapa de l'ICGC, la ruta de Sils només és pavimentada en un 4 %**: la cursa de mostra que hi passa porta l'etiqueta «Asfalt» perquè és inventada, i no s'hi adiu.
- **El corredor de dades** és de 110 m a banda i banda per als arbres i de 260 m per als edificis. Més enllà el paisatge és la fotografia sobre el relleu.
- La vista «Cartogràfic» i la «Realista» no tenen arbres ni edificis.
