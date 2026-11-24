# Llicències de les dades d'aquesta carpeta

Cada carpeta és una ruta. El codi del repositori no està cobert per aquest fitxer; les dades, sí.

| Fitxer | Què conté | D'on surt | Llicència |
|---|---|---|---|
| `route.json` | El traçat, en metres | GPX d'una sortida real, publicat amb permís de qui la va fer | Del titular del track |
| `timeS`, a `../index.ts` | Segons que la sortida va durar amb el rellotge en marxa | El mateix GPX (`scripts/gpx-time.mjs`), publicat amb permís de qui la va fer. Del GPX no se'n treu cap altra dada de temps | Del titular del track |
| `more`, a `../index.ts` | Una altra sortida pel mateix recorregut: el seu perfil (distància i alçada, a `../profiles.ts`) i els segons que va durar | El GPX d'aquella sortida, publicat amb permís de qui la va fer. El seu traçat no es desa: la pàgina dibuixa la ruta una sola vegada | Del titular del track |
| `terrain.webp`, `terrain.json`, `plate.json` | Relleu i corbes de nivell | Model d'elevacions de l'ICGC | CC BY 4.0 · © Institut Cartogràfic i Geològic de Catalunya |
| `ortho.webp` | Ortofoto | ICGC | CC BY 4.0 · © ICGC |
| `land.png` | Tipus de terra | Mapa de cobertes del sòl 2024 i mapa base de l'ICGC | CC BY 4.0 · © ICGC |
| `world.json` · `trees`, `paved`, `walked` | Arbres i ferm | LiDAR, cobertes del sòl, ortofoto i mapa base de l'ICGC | CC BY 4.0 · © ICGC |
| `world.json` · `buildings` sense `f` | Edificis del mapa base | ICGC | CC BY 4.0 · © ICGC |
| `world.json` · `buildings` amb `f` | Cases amb plantes, ús i any | Servei INSPIRE d'edificis del Cadastre, consultat el 14 de novembre de 2026 | Llicència dels serveis INSPIRE del Cadastre · © Dirección General del Catastro |
| `world.json` · `places` sense `o` | Topònims | Mapa base de l'ICGC | CC BY 4.0 · © ICGC |
| `world.json` · `places` amb `o` | Bars, comerços, escultures | OpenStreetMap | **ODbL 1.0** · © col·laboradors d'OpenStreetMap (<https://www.openstreetmap.org/copyright>). Aquesta part continua sent ODbL per a qui la torni a fer servir |
| `on-foot-wide.*`, `on-foot-tall.*` | El pòster de «Palamós a peu»: una captura feta dins del joc (`scripts/world-poster.mjs`), no una imatge generada | El joc es fa amb el relleu, el LiDAR i l'ortofoto de l'ICGC i amb els carrers i les plantes dels edificis d'OpenStreetMap | CC BY 4.0 · © ICGC, i **ODbL 1.0** · © col·laboradors d'OpenStreetMap |

`../hero-plan.json` (el plànol de la portada): illes de cases i model d'elevacions de l'ICGC, CC BY 4.0.
