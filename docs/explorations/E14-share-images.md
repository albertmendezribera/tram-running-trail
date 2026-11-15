# E14 · Imatges per compartir

**Estat:** decidida i en ús per a curses, rutes i comparacions · **Data:** 2026-11-15 · **Decisió:** un SVG escrit a mà amb el text convertit a traços, passat a PNG amb `sharp`; Satori, no

## Pregunta

Com es genera en build una imatge per compartir (M5) amb el perfil real i tipografia de dorsal?

## Opcions

| | SVG propi → PNG (`fontkit` + `sharp`) | Satori + resvg |
|---|---|---|
| Què es dibuixa | Qualsevol SVG: els mateixos camins que el perfil i la radiografia de la pàgina | HTML amb flexbox; un perfil s'hi ha d'incrustar igualment com a SVG |
| Tipografia | El text es converteix a traços amb els fitxers `woff2` del sistema de disseny | No llegeix `woff2`: caldria afegir les fonts en un altre format |
| Dependències noves | `fontkit` i `sharp`, només en build | `satori`, `@resvg/resvg-js` i les fonts duplicades |

## Decisió

L'SVG propi. La imatge és gairebé tota dibuix (perfil, traçat, siluetes), que ja es genera com a camins per a la pàgina, i el text són tres línies.

## Com està fet

- `apps/web/src/og/render.ts` compon la imatge de 1200 × 630: «TRAM» i la barra d'accent a dalt, el nom a mida de dorsal (s'encongeix fins que hi cap), el lloc, dues xifres com en un full de resultats i, a baix, el perfil real de banda a banda. A la dreta, el traçat vist des de dalt.
- `apps/web/src/og/cards.ts` treu el nom i les xifres del mateix contingut que la pàgina, amb els mateixos formats.
- `apps/web/src/pages/og/[...path].png.ts` en fa un fitxer per pàgina en la build: `/og/curses/<slug>.png`, `/og/rutes/<slug>.png` i `/og/comparar/<parella>.png`. Pesen entre 8 i 23 KB.
- `Site.astro` hi afegeix `og:image` (amb mides i text alternatiu), `og:title`, `og:description`, `og:url` i `twitter:card`.
- **Colors** dels tokens (`@tram/design-system/og`): el perfil d'una cursa de muntanya en el color de trail, el d'asfalt en el d'asfalt. Una ruta no diu res del terra i va en el color neutre.
- **Una ruta plana es dibuixa plana**: la caixa del perfil val 100 m com a mínim, igual que a la pàgina.
- **La comparació** porta les dues sabatilles de perfil, una sobre l'altra i taló amb taló, com la radiografia, i pes i drop de totes dues.

![Les imatges de la Marxa de les Tines, la ruta de Sils, la ruta de Palamós i la comparació](E14/og.png)

## Què no s'ha verificat, i límits

- **No s'han provat a cap xarxa**: no s'ha enganxat cap enllaç a WhatsApp, X ni Instagram per veure com la mostren. Les adreces de les imatges apunten a `tramrun.com`, que encara no existeix: a staging la imatge es genera, però l'enllaç compartit no l'ensenyarà.
- **El pes de la lletra no és el de la pàgina.** Els fitxers de font són variables, i la llibreria només en sap dibuixar el pes per defecte: 700 per a la lletra de dorsal (la pàgina fa servir 800) i 400 per al text. La de dorsal s'engruixeix amb un traç del mateix color perquè s'hi acosti. Per tenir el pes exacte caldria afegir una font estàtica.
- **Només mode clar.** No hi ha versió de nit.
- **La portada, les llistes i les fitxes de sabatilla no tenen imatge pròpia.**
- **La cursa de mostra també en té**, amb el seu nom. No entra a producció.
