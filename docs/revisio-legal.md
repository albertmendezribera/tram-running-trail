# Revisió legal · estat a 15 de novembre de 2026

**Què és això:** una revisió feta des de dins del projecte, mirant què es publica, d'on surt i què diuen les llicències. **No és assessorament jurídic**: qui l'ha fet no és advocat, i dos dels textos de llicència (Cadastre i condicions d'ús dels comparadors de sabatilles) no s'han pogut llegir sencers. Serveix per saber què es pot donar per bo, què s'ha d'arreglar i què ha de mirar un professional abans de producció.

## Resum

| | Què | Estat |
|---|---|---|
| 1 | Fotos oficials de les marques sobre les sabatilles en 3D, a staging | **Risc real avui**: staging és públic |
| 2 | Nom «TRAM» | **Sense comprovar**: cal una cerca de marques |
| 3 | Noms de marca i de model de sabatilles | Defensable com a ús descriptiu; cal confirmar-ho |
| 4 | Mesures de laboratori i puntuacions de tercers | Defensable amb dues sabatilles; no escala sense permís |
| 5 | Dades del Cadastre | Reutilitzable amb citació; faltava la data de consulta (afegida) |
| 6 | Dades d'OpenStreetMap | Reutilitzable; el fitxer que les conté ha de dir que són ODbL (afegit) |
| 7 | Dades de l'ICGC | Correcte |
| 8 | Street View i fotos de Wikimedia | Correcte: només s'han mirat |
| 9 | Tracks GPX | Correcte per als tres actuals; la pujada d'usuaris demanarà molt més |
| 10 | Avís legal, privacitat i galetes | **No existeixen**: obligatoris abans de producció |
| 11 | Curses reals (Fase 2) | Importades de quatre calendaris per decisió del titular, citant i enllaçant. Només les de llicència oberta poden anar a producció |
| 12 | Codi i tipografia | Correcte |

## 1 · Fotos de les marques a staging

Les sabatilles en 3D de staging porten a sobre les fotos oficials de Nike i Hoka. Aquestes fotos tenen drets d'autor de les marques i el `CLAUDE.md` (7.6) les prohibeix. Es va acordar fer-ne una excepció «només a staging», i no són al repositori.

El problema és que **staging és una adreça pública**: qualsevol que la tingui veu les fotos, i publicar-les en una web oberta ja és comunicació pública, es digui staging o producció. Que les pàgines portin `noindex` evita els cercadors, no l'accés.

**Què faria:** posar staging darrere d'un control d'accés (Cloudflare Access amb el teu correu és gratuït i són cinc minuts) o treure'n les fotos. Mentre no es faci, és el punt més feble de tot el projecte.

## 2 · El nom «TRAM»

No s'ha fet cap cerca de marques. «TRAM» és la marca del tramvia de Barcelona i del d'Alacant, molt coneguda a Catalunya. Són serveis de transport, un sector diferent, i això juga a favor; però una marca coneguda té més protecció que una de normal, i poden existir altres registres en roba esportiva, esdeveniments o programari.

**Què cal:** una cerca a l'OEPM i a l'EUIPO (TMview és gratuït) per «TRAM» i «TRAMRUN» a les classes 9, 25, 35, 41 i 42, abans de gastar res en marca o domini. Això sí que és feina d'un agent de la propietat industrial.

## 3 · Noms de marca i de model

Les pàgines de sabatilles diuen «Nike Vaporfly 4» i «Hoka Speedgoat 6» com a text, sense logotips. Fer servir una marca per dir de quin producte es parla és un ús descriptiu que el dret de marques de la UE permet, sempre que no faci creure que hi ha un vincle amb la marca i que no se'n faci servir més del necessari.

- **A favor:** només text, cap logotip, cap disseny que imiti el de les marques, i les fonts de cada xifra enllaçades.
- **Vigilar:** que cap pàgina sembli oficial o patrocinada, i que el nom de la marca no surti més gros que el de TRAM. Si un dia hi ha enllaços d'afiliació, s'ha de dir.

Avui aquestes pàgines no són indexables ni entren a producció (`legalReview`). Amb aquesta revisió no n'hi ha prou per canviar-ho: és el punt on una consulta curta a un advocat surt més a compte.

## 4 · Mesures i puntuacions de tercers

Les fitxes citen mesures de laboratori (RunRepeat) i puntuacions (OutdoorGearLab, Running Shoes Guru), amb la font, l'enllaç i la data de consulta, sense reproduir text de les ressenyes ni fer-ne mitjana.

- **Una xifra no té drets d'autor**, però una base de dades feta amb una inversió important té un dret propi a la UE, que prohibeix treure'n una part substancial. Unes quantes xifres de dues sabatilles no ho són. Un catàleg de centenars de models fet amb les mesures d'un sol laboratori sí que ho podria ser.
- **Les condicions d'ús d'aquests webs no s'han llegit.** Molts prohibeixen la còpia sistemàtica.

**Conseqüència per al full de ruta:** la Fase 3 (catàleg complet) no es pot fer copiant mesures d'un laboratori. O hi ha un acord amb ell, o les mesures són pròpies, o el catàleg es limita al que declara cada fabricant.

## 5 · Cadastre

Les cases de la vista «A peu» surten del servei INSPIRE d'edificis de la Dirección General del Catastro. No s'ha pogut llegir el text de la llicència a la seva seu (les dues adreces provades donen error); el que se'n sap és per fonts secundàries:

- El Cadastre publica una **llicència pròpia** per als serveis INSPIRE; la fitxa de la Infraestructura de Dades Espacials d'Espanya les marca com a **CC BY 4.0**.
- Demana **citar la font** («© Dirección General del Catastro») i **la data en què s'hi va accedir**.
- No es publica cap dada de titulars: només geometria, plantes, ús i any.

**Fet ara:** la nota de sota la vista diu la font i la data de consulta. **Pendent:** que algú llegeixi el PDF de la llicència (`catastro.hacienda.gob.es/webinspire/documentos/Licencia.pdf`) i confirmi que n'hi ha prou.

## 6 · OpenStreetMap

Els noms de bars, comerços i escultures de la vista «A peu» surten d'OpenStreetMap (ODbL).

- **Citació:** «© col·laboradors d'OpenStreetMap» a la mateixa pantalla. Hi és. La recomanació és que enllaci a `openstreetmap.org/copyright`; avui és text sense enllaç.
- **Compartir igual:** el que es fa amb les dades (l'escena 3D) pot tenir les condicions que es vulgui, però **el fitxer de dades que en deriva i es publica ha de continuar sent ODbL**. Són les entrades marcades `o` de `world.json`, en un repositori públic.
- **Barrejar-les amb altres dades** en un mateix fitxer no estén l'ODbL a les altres, si es poden destriar. Es poden: porten la marca.

**Fet ara:** `apps/web/src/content/routes/LLICENCIES.md` diu quina llicència té cada part de cada fitxer. **Millora pendent:** una pàgina de crèdits al web amb els enllaços.

## 7 · ICGC

Relleu, ortofoto, edificis, topònims, arbrat i cobertes del sòl són de l'ICGC, CC BY 4.0. Només demana citació, i hi és a cada vista i a cada fitxer. Res a fer.

## 8 · Street View i Wikimedia

- **Google Street View** s'ha obert per mirar com són els carrers de Palamós. No se n'ha copiat cap imatge ni se n'ha tret cap dada: les façanes de la vista no en surten. Les condicions de Google no permeten fer-ne textures ni dades derivades, i no s'ha fet.
- **Les tres fotos de Wikimedia Commons** del far de Palamós s'han fet servir de referència per modelar-lo a mà. No es reprodueixen. Un edifici de 1865 no té drets vigents, i a Espanya les obres situades a la via pública es poden reproduir lliurement.

## 9 · Tracks GPX i dades personals

Els tres recorreguts són sortides teves, publicades amb el teu permís. No es publiquen pulsacions, cadència, velocitat ni hores; els GPX originals no són al repositori.

- **Vigilar:** un recorregut que comença i acaba al mateix punt pot dir on viu algú. Per als teus ho has decidit tu.
- **Si un dia hi ha pujada de rutes d'usuaris**, tot canvia: consentiment, base legal, retallar inicis i finals per defecte, dret d'esborrat, i un encarregat del tractament (Supabase, Cloudflare). No s'ha de construir sense haver-ho resolt abans.

## 10 · El que falta abans de producció

Avui no hi ha res publicat a producció, i no s'hi pot publicar sense això:

- **Avís legal** amb la identitat del titular (obligatori per la llei de serveis de la societat de la informació).
- **Política de privacitat.** El web no té analítica ni galetes de tercers, però: desa dues preferències al navegador (tema i vista del visor), i la vista «Realista» fa que el navegador del visitant demani imatges directament als servidors de l'ICGC, que en veuen l'adreça IP. S'ha de dir.
- **Galetes:** les dues preferències són tècniques i no demanen consentiment; s'han d'explicar igualment.
- **Llicència del repositori:** no n'hi ha cap fitxer. Sense llicència, el codi és «tots els drets reservats», cosa que pot ser el que vols; convé decidir-ho i escriure-ho.

## 11 · Curses reals (Fase 2)

El calendari necessita centenars de curses. La data i el lloc d'una cursa són fets, però els calendaris de federacions i agregadors són bases de dades protegides, i els logotips i cartells tenen drets. Les opcions netes són: que cada organitzador doni les seves dades, un acord amb una federació, o dades obertes on n'hi hagi. Copiar el calendari d'un altre web no n'és una.

La Marxa de les Tines surt ara amb el seu nom real. La pàgina diu que la data i el dorsal són de mostra, i no entra a producció. Per publicar-la com a cursa real caldrien la data, l'organitzador i, per cortesia, que ho sàpiga.

### Actualització del 15 de novembre de 2026: el calendari

El titular va decidir importar les curses de quatre calendaris citant la font i enllaçant-hi (E19): la Federació Catalana d'Atletisme, l'Ajuntament de Barcelona, Curses.cat i Runnea. Són 136 curses.

- **Què s'hi ha fet per reduir el risc:** només fets (nom, data, municipi, distàncies, organitzador, web), cap text ni imatge; cada fitxa enllaça la pàgina de la font i en diu les condicions; les que no venen d'una font oberta porten `noindex` i **no entren a producció**.
- **Què continua sent un risc:** l'avís legal de la FCA reserva tots els drets i només permet l'ús personal, i un calendari és una base de dades amb protecció pròpia. Citar i enllaçar no és un permís. Cap de les tres fonts no obertes ha estat avisada.
- **Què cal per treure'l:** el correu a la FCA (l'esborrany és a E19) i un avís a Curses.cat i Runnea. Fins llavors, que es quedin a l'entorn de proves.

## 12 · Codi i tipografia

- Sofia Sans: SIL OFL 1.1, amb la llicència al repositori. Permet l'ús i la redistribució.
- Three.js i Astro (MIT), MapLibre GL JS (BSD de 3 clàusules), ECharts (Apache 2.0), fontkit i sharp (MIT i Apache 2.0): totes permeten l'ús comercial amb la nota de llicència, que els paquets ja porten.

## Fonts consultades

- Llicència i preguntes freqüents d'OpenStreetMap: <https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ>
- Serveis INSPIRE del Cadastre: <https://www.catastro.hacienda.gob.es/webinspire/index.html>
- Fitxa de les parcel·les cadastrals a la IDEE (CC BY 4.0): <https://idee.es/csw-codsi-idee/srv/api/records/ES_SDGC_CP>
- Resum de les condicions del Cadastre que fa el paquet CatastRo: <https://ftp.fau.de/cran/web/packages/CatastRo/COPYRIGHTS>
