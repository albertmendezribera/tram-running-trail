# Fonts de TRAM

Fonts autoallotjades triades a [E08](../../../docs/explorations/E08-typography.md). Llicència: SIL OFL 1.1, vegeu [`OFL.txt`](OFL.txt).

| Fitxer | Família | Eix de pes | Origen |
|---|---|---|---|
| `sofia-sans-extra-condensed-latin-700-900.woff2` | Sofia Sans Extra Condensed | 700–900 | `@fontsource-variable/sofia-sans-extra-condensed` 5.3.0, `latin-wght-normal` |
| `sofia-sans-latin-400-700.woff2` | Sofia Sans | 400–700 | `@fontsource-variable/sofia-sans` 5.3.0, `latin-wght-normal` |

L'únic canvi respecte de l'origen és l'eix de pes reduït, amb [`scripts/narrow-fonts.py`](../scripts/narrow-fonts.py).

Els pesos dels tokens han de quedar dins d'aquests rangs. Si un rol en necessita un altre, cal regenerar el fitxer.
