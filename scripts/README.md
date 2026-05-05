# Scripts de Mantenimiento

Scripts operativos para Supabase.

| Script | Descripcion |
|--------|-------------|
| `validate-supabase-migration.ts` | Valida conteos actuales de Supabase y ejecuta `run_all_validations()` |
| `reset-supabase-staging.ts` | Limpia una base Supabase de staging con confirmacion explicita |

## Comandos

```bash
npm run migrate:validate
npm run supabase:reset:dry
npm run supabase:reset
```
