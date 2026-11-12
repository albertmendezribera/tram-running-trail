# Base de dades

Esquema de TRAM per a Supabase (Postgres amb PostGIS). Segueix l'esbós de la secció 5 de `CLAUDE.md`.

```
migrations/   canvis de l'esquema, en ordre
tests/        comprovacions que s'executen després de les migracions
```

## Principis

- **Cada dada diu d'on ve** (`source`), i cap xifra s'estima: el que no se sap és `null`.
- **La geometria és nativa:** rutes i punts són `geography` de PostGIS.
- **Els placeholders no poden arribar a producció:** les files amb `is_placeholder` no les pot llegir el rol públic. Ho imposa la base de dades (RLS), no el codi.
- **El web només llegeix.** Les escriptures passen pel rol de servei.

## Com es comprova

La CI aixeca un Postgres amb PostGIS, hi aplica les migracions i executa `tests/schema.sql` (job `database`). En local, amb un Postgres amb PostGIS a `DATABASE_URL`:

```bash
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -c "create role anon nologin; create role authenticated nologin;"
```

```bash
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$f"; done
```

```bash
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f supabase/tests/schema.sql
```

## Pendent

- **Cap projecte de Supabase creat.** L'esquema és al repositori; aplicar-lo a un projecte real és un pas que ha de fer qui tingui el compte.
- **Traduccions** de noms i descripcions (E12): les taules només porten el nom original.
- **Càrrega de dades reals** i el *loader* d'Astro que les llegeix.
