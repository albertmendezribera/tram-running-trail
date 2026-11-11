# E01 · Format del terreny

**Estat:** decidida per a rutes de muntanya a Catalunya; falta la ruta urbana i la resta del món · **Data:** 2026-11-10 · **Decisió:** *heightmap* de 10 m codificat com a terrain-RGB en WebP sense pèrdua

## Pregunta

Quin és el format més lleuger amb bona qualitat a les carenes?

## Context

- **Ruta de prova:** una sortida real a Calonge (Baix Empordà), 12,41 km, de 8 a 357 m d'altitud. Terreny de 2,82 × 3,57 km (10,05 km²) amb 400 m de marge al voltant del traçat.
- **Font:** model d'elevacions de l'ICGC de 5 × 5 m, pel servei WCS (`icc:met`, EPSG:25831). Llicència CC BY 4.0.
- **Referència de l'error:** el mateix model de 5 m (564 × 713 cel·les). L'error de cada opció és la diferència vertical amb aquesta malla.
- **Opcions mesurades:** (a) *heightmap* com a imatge i (b) malla RTIN precalculada. L'opció (c), quantized-mesh, no s'ha mesurat: és un RTIN amb un contenidor diferent i necessita una llibreria de lectura més al client.

## Mesures

Dades completes a [`E01/measures.json`](E01/measures.json).

| Opció | Pes | Vèrtexs | Error RMS | Error màxim |
|---|---|---|---|---|
| Heightmap 5 m (564 × 713) | 171,1 KB WebP (476 KB PNG) | 402.132 | 0 | 0 |
| **Heightmap 10 m (282 × 357)** | **62,7 KB WebP** (136,1 KB PNG) · 6,2 KB/km² | 100.674 | 0,25 m | 7,97 m |
| Heightmap 20 m (141 × 179) | 22 KB WebP | 25.239 | 0,63 m | 8,57 m |
| Malla RTIN, tolerància 1 m | 430,7 KB gzip | 33.803 | 0,66 m | 7,24 m |
| Malla RTIN, tolerància 2 m | 177,2 KB gzip | 13.847 | 0,88 m | 7,24 m |
| Malla RTIN, tolerància 5 m | 47,1 KB gzip | 3.694 | 1,77 m | 8,09 m |

- **Temps de build:** baixar el terreny de l'ICGC són 16 peticions i uns 19 s (7 MB de text ArcGrid). Codificar-lo és menys d'un segon en totes les opcions.
- **Encaix amb el GPS:** la diferència entre l'altitud del GPX i la del model sota cada punt té una mediana de 3,2 m i un percentil 95 de 5,8 m.

## Decisió

**Heightmap de 10 m en terrain-RGB** (`altitud = −10000 + (R · 65536 + G · 256 + B) · 0,1 m`), desat com a WebP sense pèrdua.

- Amb un pes semblant (63 KB contra 47 KB), el *heightmap* de 10 m té set vegades menys error RMS que la malla RTIN de 5 m de tolerància.
- A igualtat d'error, la malla pesa molt més: la d'1 m de tolerància fa 431 KB.
- Els nivells de detall surten sols: la mateixa imatge reduïda a la meitat és el nivell següent (22 KB a 20 m).
- Al client no cal cap llibreria: el navegador descodifica el WebP.

El preu és el nombre de triangles: 200.072 per a aquesta ruta, contra 27.000 de la malla RTIN de 2 m. A Chromium amb renderitzat per programari el primer fotograma arriba en uns 85 ms; el rendiment en dispositius reals és la pregunta d'E04.

## On és

- [`packages/terrain-pipeline`](../../packages/terrain-pipeline): `node src/cli.ts <track.gpx> <carpeta> [mida de cel·la]` escriu `terrain.webp`, `terrain.json` i `route.json`. Proves de la projecció UTM, de la codificació i del tall en peticions, sense xarxa.
- Terreny de Calonge: [`apps/web/src/ds/terrain/calonge/`](../../apps/web/src/ds/terrain/calonge/) (62,9 KB).

## Pendent

- **Ruta urbana**, que demana el lliurable. Depèn d'E03 (com fer atractiva una ruta plana).
- **Resta del món:** Copernicus GLO-30. El pipeline només parla amb l'ICGC.
- **Sortida de la secció 8.1:** glTF amb meshopt i KTX2, pujat a R2, i pòster AVIF. Ara els fitxers són al repositori i el pòster és la silueta SVG.
- **Simplificació del GPX:** la ruta es desa amb un punt cada 10 m, sense simplificar (16 KB).
- **Vores de la malla:** l'error màxim (uns 8 m) és en un sol punt de relleu abrupte; no s'ha comprovat a les carenes una per una.
