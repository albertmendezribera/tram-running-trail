# E11 · Transicions entre pàgines

**Estat:** decidida i en ús · **Data:** 2026-11-15 · **Decisió:** View Transitions natives entre documents, només amb CSS; el `ClientRouter` d'Astro, no

## Pregunta

Com es fa l'element compartit del perfil, de la llista a la fitxa (M6), sense penalitzar el rendiment?

## Opcions

| | View Transitions natives (`@view-transition`) | `ClientRouter` d'Astro |
|---|---|---|
| JavaScript | Cap | Un encaminador al client a cada pàgina |
| Què passa amb les illes (3D, scroller) | Res: cada pàgina és un document nou | S'han de tornar a engegar a mà en cada canvi de pàgina |
| On funciona | Chrome i Edge 126+, Safari 18.2+. Firefox encara no | A tot arreu, amb JavaScript |
| Sense suport | La pàgina canvia com sempre | — |

## Decisió

Les natives. La web és HTML estàtic amb illes (principi 2), i un encaminador al client és JavaScript a totes les pàgines per a un efecte que és una millora. On el navegador no les té, no es perd res.

## Com està fet

- `base.css` del sistema de disseny demana la transició (`@view-transition { navigation: auto }`) només si no hi ha moviment reduït.
- **La pàgina no fa cap fosa**: el canvi de document és immediat (`::view-transition-old(root)` i `-new(root)` sense animació). Només es mou el que les dues pàgines comparteixen per nom, en 320 ms (`motion-slow`). El `CLAUDE.md` (7.5) no vol foses genèriques.
- `RaceRow` té la propietat `transition`, que dona nom a la seva silueta; `RouteScroller` (i `RouteSilhouette`) tenen la mateixa propietat per a la silueta gran de la fitxa. Les llistes del web hi posen `profile-race-<slug>` o `profile-route-<slug>` i la fitxa hi posa el mateix.
- La silueta petita de la fila creix fins a la silueta de la fitxa, que és el pòster del visor 3D: quan el 3D carrega, ja és al seu lloc.

## Què no s'ha verificat, i límits

- **Vist només a Chromium.** A Safari 18.2+ hauria de funcionar igual; no s'ha obert. A Firefox no hi ha transició.
- **Les dues siluetes no tenen la mateixa proporció** (240 × 60 la de la fila, la de la fitxa ocupa la vista): el navegador estira una imatge cap a l'altra, no redibuixa la corba.
- **El calendari (F2) encara no existeix**: avui la transició surt de les llistes de curses i de rutes i de la portada. El M6 del document parla del calendari; quan hi sigui, les seves files han de portar el mateix nom.
- Dues files d'una mateixa pàgina no poden compartir nom: si una cursa i una ruta sortissin amb el mateix, el navegador abandonaria la transició. Per això el nom porta `race` o `route`.
