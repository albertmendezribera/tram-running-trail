# E07 · Calendari «l'any com a perfil» (M4)

**Estat:** construït i publicat a staging el 16-11-2026. **No validat amb corredors** (el lliurable de CLAUDE.md demana proves amb 3–5).

## El que demanava el pla

CLAUDE.md 7.7: «L'any dibuixat com una franja horitzontal. Cada cursa és una marca: l'alçada correspon al D+ i el gruix a la distància. Asfalt a dalt i trail a baix d'una línia central.»

## Per què no es pot fer tal com està escrit

Cap de les set fonts del calendari diu el desnivell de cap cursa (E19), i el projecte no n'estima cap. Amb el D+ a l'alçada, la franja seria una línia plana.

## El que s'ha fet

Es manté tot el que no depèn del desnivell, i l'alçada passa a ser una altra cosa que sí que se sap:

| Del pla | Ara |
|---|---|
| Franja horitzontal d'un any | Igual: una franja per any natural, de setmanes de dilluns a diumenge |
| Cada cursa és una marca | Igual: un rectangle per prova |
| Asfalt a dalt, trail a baix | Igual, segons el terreny que diu la font |
| Gruix = distància | Igual, en quatre passos: fins a 10 km, fins a la mitja, fins a la marató, més. Una prova sense distància a la font és una marca estreta |
| Alçada = D+ | **Canviat:** les marques d'una setmana s'apilen. L'alçada del perfil és quant es corre aquella setmana, no el desnivell de cap cursa. La pàgina ho diu |

Dues coses que el pla no preveia:

- **Les proves sense costat.** De 326 proves, 154 no són ni d'asfalt ni de muntanya segons la seva font: cros, i sobretot proves de les quals cap font diu el terreny. Van en una franja pròpia a sota, dibuixades buides (només el contorn). Amagar-les faria semblar el calendari més petit i més equilibrat del que és.
- **Les ja disputades** es queden a la franja, en clar: la forma de l'any és la de l'any sencer.

## Decisions

- **SVG estàtic, sense script.** El dibuix s'estira a l'amplada que té (`preserveAspectRatio="none"`): per això no porta text ni cap forma que l'estirament espatlli. Els noms dels mesos i la llegenda són HTML.
- **Els mesos són les portes.** Cada mes amb proves és un enllaç a la seva part de la llista, i diu en paraules què hi ha («Novembre 2026: 9 d'asfalt, 14 de muntanya…»). El dibuix és decoratiu per a un lector de pantalla; la llista accessible és la de sempre (CLAUDE.md 8.3).
- **Al mòbil** el nom del mes és la seva inicial i cada porta fa uns 28 px d'ample.
- **Les dues franges comparteixen escala**, perquè es puguin comparar.

## El que queda obert

- **La prova amb corredors** que demana aquesta exploració: si s'entén sense llegir la llegenda, i si algú hi troba el que busca abans que a la llista.
- **La franja no segueix els filtres ni la cerca:** dibuixa sempre tot el calendari.
- **Una marca no és un enllaç a la seva cursa.** Al mòbil farien 6 px d'ample; per això l'entrada és el mes.
- **Si mai hi ha desnivell** (dels tracks dels organitzadors), es pot tornar a l'alçada del pla per a les curses que en tinguin.
- La «Distribució del calendari» de CLAUDE.md 9.3 (barres per mes) no s'ha fet: aquesta franja ja ho diu.
