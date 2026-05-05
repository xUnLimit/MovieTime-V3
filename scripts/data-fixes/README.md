# Data fixes (MovieTime production dataset)

These SQL scripts contain one-shot UPDATEs against records identified by their
specific Firebase IDs. They are **not** part of the schema and must NOT live in
`supabase/migrations/` — running the migrations on a fresh environment (staging,
new tenant, CI clone) would silently match zero rows.

Each fix here is the historical correction needed to align the Supabase
production database with the Firebase data that was migrated on 2026-05-04.

## How to apply

Run a fix once against the target Supabase project, after the schema migrations
have been applied and the Firebase data import has finished:

```bash
psql "$SUPABASE_DB_URL" -f scripts/data-fixes/2026-05-05_pagos_servicio_categoria_snapshot.sql
psql "$SUPABASE_DB_URL" -f scripts/data-fixes/2026-05-05_prime_video_forecast_snapshot.sql
```

## Fixes

| File | Records | Reason |
|------|---------|--------|
| `2026-05-05_pagos_servicio_categoria_snapshot.sql` | 2 `pagos_servicio` rows (`MAObIlYwfCRFQ6cLhg9q`, `MozoU8AS0LkDlX1TsI9r`) | Crunchyroll expenses registered before the services were moved to Spotify; snapshot must reflect Spotify's category id (`fY4CJAblcOMS4eBx46de`). |
| `2026-05-05_prime_video_forecast_snapshot.sql` | 1 `venta_periodos` row (linked to `pagos_venta` `OUJrzjK0zVKignHI2Uey`) | Firebase forecast price was 2.00 pre-discount; the migrated `precio_original` came over as 1.80 (matched the discounted payment). Restores forecast parity. |
