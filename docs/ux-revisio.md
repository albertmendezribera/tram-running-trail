# Revisió de UX · portada i jerarquia d'informació

**Data:** 2026-11-25 · **Encàrrec del titular:** «Revisa tota la UX de la web. Aplica criteris generals de UX per millorar la homepage i la jerarquia d'informació.»

Revisades la portada, les tres llistes (curses, rutes, sabatilles) i la pàgina d'stories, en escriptori (1440 px) i en mòbil (390 px), sobre la compilació de proves.

## Què s'hi ha trobat

| | Problema | Criteri |
|---|---|---|
| 1 | La portada no deia què és el web: un títol («Recórrer el tram») i una frase sobre el 3D | Proposta de valor a la primera pantalla |
| 2 | La portada només ensenyava curses i rutes. Les sabatilles (161 models, la secció més gran), les stories i «Palamós a peu» no hi eren | Tot el que hi ha s'ha de poder trobar des de la portada |
| 3 | A «Curses» de la portada, una cursa de mostra del març de 2027 sortia abans de les de la setmana, sense dir per què | L'ordre ha de ser el que s'espera; el que trenca l'ordre s'ha d'anomenar |
| 4 | Cap xifra deia la mida de res (quantes curses, quantes sabatilles) | Donar la mida abans de demanar el clic |
| 5 | El menú barrejava les tres seccions amb una pàgina («Palamós a peu») i una eina («Stories»), totes al mateix rang; en un mòbil es trencava en dues línies | El menú diu què és el web: seccions primer, la resta després |
| 6 | El peu no tenia cap enllaç: una pàgina llarga s'acabava en un carreró | El peu és el segon menú |
| 7 | Al calendari, el cercador i les «Properes» quedaven sota dos blocs (la cursa en 3D i l'any com a perfil) | La feina principal de la pàgina, a dalt |
| 8 | A «Sabatilles», dues files i un botó sense títol abans del catàleg: no es deia que eren les dues mesurades al laboratori | Cada grup, amb el seu nom |
| 9 | De «Rutes» no es podia anar a «Palamós a peu» ni al generador d'stories | Camins entre el que va junt |

## Què s'ha fet

- **Portada.** La frase de sota el títol diu les tres coses que hi ha i el que les uneix (cada xifra, amb la seva font). Dos botons: «Troba una cursa» (el principal) i «Recorre Calonge en 3D». A sota, un índex de cinc línies amb la xifra de cada part (`SectionRow`, nou): curses, rutes, sabatilles, stories i «Palamós a peu». Després, les properes curses amb enllaços per tipus, la cursa amb recorregut en 3D amb el seu títol, les rutes amb enllaços a les dues eines, i un bloc nou de sabatilles amb les dues de laboratori i «Què busques?».
- **Menú.** Tres seccions, i després d'un filet i en tinta apagada, «Palamós a peu» i «Stories» (`SiteHeader`, propietat `more`). Continuen al menú perquè el titular va demanar un accés a «Palamós a peu» des del menú. En un mòbil és una sola línia que es fa lliscar.
- **Peu.** El mapa del web: cada secció amb les seves pàgines principals (`SiteFooter`, propietat `sections`; `content/site-map.ts`). No s'hi escriu res a mà: surt del que la compilació porta, i producció ensenya el seu.
- **Calendari.** Sota el títol, enllaços a cada part de la pàgina (properes, cerca, per tipus, disputades). La cursa amb recorregut en 3D passa a sota de les llistes.
- **Sabatilles.** Les dues de laboratori, en una franja amb nom i una frase que diu què tenen de diferent.
- **Rutes.** Sota la llista, «Més enllà de la ruta»: «Palamós a peu» i les stories.

## Què no s'ha fet, i s'hauria de mirar

- **Les llistes són molt llargues en un mòbil:** el calendari fa uns 52.000 px d'alt i el catàleg uns 46.000. Calen mesos i marques que es pleguin, o paginar. És el problema de UX més gros que queda.
- **La cerca global** (E13): només es cerca dins del calendari.
- **El camí de la pàgina** («Inici») no ajuda a les pàgines de primer nivell.
- **Cap prova amb persones.** Tot això són criteris generals aplicats amb el meu judici; ningú no ha fet servir la portada nova.
- **A producció** la portada no tindria el bloc de sabatilles ni les dues eines, que només són a l'entorn de proves.
