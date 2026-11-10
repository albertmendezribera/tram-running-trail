## Contrast WCAG

| Rol | Mínim | Clar · surface | Clar · surface.alt | Nit · surface | Nit · surface.alt |
|---|---|---|---|---|---|
| `sys.text` | 4.5 | 15,47 | 13,81 | 15,22 | 13,97 |
| `sys.text.muted` | 4.5 | 6,12 | 5,47 | 6,10 | 5,59 |
| `sys.accent.text` | 4.5 | 5,26 | 4,70 | 6,15 | 5,64 |
| `sys.focus` | 3 | 15,47 | 13,81 | 15,22 | 13,97 |
| `sys.rule.strong` | 3 | 15,47 | 13,81 | 15,22 | 13,97 |
| `sys.data.road` | 3 | 11,68 | 10,44 | 16,54 | 15,17 |
| `sys.data.trail` | 3 | 4,22 | 3,77 | 3,85 | 3,53 |
| `sys.data.active` | 3 | **2,64** | **2,36** | 6,15 | 5,64 |
| `sys.data.active.outline` | 3 | 15,47 | 13,81 | 15,22 | 13,97 |
| `sys.map.contour` | 3 | 4,22 | 3,77 | 3,85 | 3,53 |
| `sys.map.vegetation` | 3 | 4,87 | 4,35 | 3,34 | 3,06 |
| `sys.map.water` | 3 | 4,73 | 4,23 | 3,43 | 3,15 |
| `sys.on-accent` sobre `sys.accent` | 4.5 | 5,85 | | 5,85 | |

## Contrast amb llum ambiental (model)

Reflex afegit, en fracció del blanc de la pantalla: interior 0,01, ombra 0,14, sol directe 1,43.

| Parella | Tema | Sense reflex | Interior | Ombra | Sol directe |
|---|---|---|---|---|---|
| `sys.text` / `sys.surface` | light | 15,47 | 13,86 | 5,14 | 1,56 |
| `sys.text` / `sys.surface` | night | 15,22 | 13,58 | 4,93 | 1,52 |
| `sys.text.muted` / `sys.surface` | light | 6,12 | 5,88 | 3,58 | 1,47 |
| `sys.text.muted` / `sys.surface` | night | 6,10 | 5,51 | 2,41 | 1,19 |
| `sys.accent.text` / `sys.surface` | light | 5,26 | 5,09 | 3,31 | 1,45 |
| `sys.accent.text` / `sys.surface` | night | 6,15 | 5,55 | 2,42 | 1,19 |
| `sys.data.active` / `sys.surface` | light | 2,64 | 2,61 | 2,15 | 1,31 |
| `sys.data.active` / `sys.surface` | night | 6,15 | 5,55 | 2,42 | 1,19 |
| `sys.data.trail` / `sys.surface` | light | 4,22 | 4,11 | 2,92 | 1,41 |
| `sys.data.trail` / `sys.surface` | night | 3,85 | 3,52 | 1,79 | 1,10 |
| `sys.on-accent` / `sys.accent` | light | 5,85 | 5,32 | 2,39 | 1,19 |
| `sys.on-accent` / `sys.accent` | night | 5,85 | 5,32 | 2,39 | 1,19 |

## Distància de color amb daltonisme (ΔE OKLab × 100)

Per sota de 10, la parella es confon fàcilment; per sota de 5, gairebé no es distingeix.

| Parella | Tema | normal | protanopia | deuteranopia | tritanopia |
|---|---|---|---|---|---|
| `sys.data.road` / `sys.data.trail` | light | 27,4 | 23,2 | 27,8 | 28,3 |
| `sys.data.road` / `sys.data.trail` | night | 40,7 | 43,6 | 39,7 | 40,7 |
| `sys.data.active` / `sys.data.trail` | light | 18,1 | **7,6** | 15,3 | 16,0 |
| `sys.data.active` / `sys.data.trail` | night | 18,1 | **7,6** | 15,3 | 16,0 |
| `sys.data.active` / `sys.map.vegetation` | light | 27,8 | **8,5** | 20,9 | 28,3 |
| `sys.data.active` / `sys.map.vegetation` | night | 27,8 | **8,5** | 20,9 | 28,3 |
| `sys.map.contour` / `sys.map.vegetation` | light | 10,2 | **0,9** | **5,6** | 12,4 |
| `sys.map.contour` / `sys.map.vegetation` | night | 10,2 | **0,9** | **5,6** | 12,4 |
| `sys.map.contour` / `sys.map.water` | light | 16,8 | 12,6 | 15,4 | 20,0 |
| `sys.map.contour` / `sys.map.water` | night | 16,8 | 12,6 | 15,4 | 20,0 |
| `sys.map.vegetation` / `sys.map.water` | light | 12,0 | 12,1 | 12,1 | **8,1** |
| `sys.map.vegetation` / `sys.map.water` | night | 12,0 | 12,1 | 12,1 | **8,1** |

## Neutralitat del mode nit (OKLCH)

| Color | OKLCH |
|---|---|
| `sys.surface` nit (#0e0f11) | L 0,17 · C 0,004 · h 264° |
| `sys.surface.alt` nit (#18191b) | L 0,21 · C 0,004 · h 264° |
| `sys.text` nit (#e8e5dc) | L 0,92 · C 0,012 · h 92° |
| Blau pissarra prohibit (#0f172a) | L 0,21 · C 0,040 · h 266° |
