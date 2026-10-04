# Scripts

Gates de calidad y scripts operativos. Se ejecutan con los comandos de `package.json`.

## Gates de calidad

| Script | Comando | Que hace |
|--------|---------|----------|
| `scan-secrets.mjs` | `secrets:scan`, `secrets:scan:all` | Busca secretos en los archivos cambiados o, con `--all`, en todos los archivos versionados |
| `check-design-tokens.mjs` | `design:check` | Falla ante colores, tamanos o pesos de fuente fuera de `DESIGN.md` |
| `security-audit.mjs` | `security:audit:prod`, `security:audit:all` | Audita dependencias contra `security-audit-exceptions.json` |
| `validate-migration-safety.mjs` | `migrate:lint` | Bloquea migraciones destructivas o no compatibles hacia atras |
| `check-diff-coverage.mjs` | `coverage:diff` | Exige la cobertura minima sobre las lineas cambiadas |
| `build-verification.mjs` | `build:verify` | Build productivo con valores de relleno para las variables que faltan (sirve en CI sin secretos) |
| `run-browser-gate.mjs` | `test:e2e`, `test:a11y`, `test:performance` | Levanta la app y corre Playwright por etiqueta |
| `run-lighthouse-gate.mjs` | `test:lighthouse` | Corre Lighthouse con los presupuestos de `lighthouserc.json` |
| `validate-env.ts` | `env:validate` | Valida las variables de entorno con el mismo esquema de la app |

## Operacion y despliegue

El desmontaje de fixtures comerciales E2E elimina primero sus relaciones de pedido mediante Docker y PostgreSQL local, sin ampliar grants. Fuera de CI exige `supabase_db_MovieTime-Automation-Verification`; CI usa `supabase_db_MovieTime-V3`. `E2E_DATABASE_CONTAINER` permite indicar el contenedor local de CI. La URL debe ser loopback y cada operación valida los UUID del tercero y servicio sembrados.

| Script | Comando | Que hace |
|--------|---------|----------|
| `validate-supabase-migration.ts` | `migrate:validate` | Cuenta tablas y ejecuta `run_all_validations()` en Supabase |
| `verify-notification-integrity.ts` | `notifications:verify` | Compara las notificaciones guardadas en Supabase con las que deberian existir |
| `reset-supabase-staging.ts` | `supabase:reset:dry`, `supabase:reset` | Limpia una base de staging; exige confirmacion explicita y nunca corre contra produccion |
| `vercel-production-alias.mjs` | usado por CI | Consulta, promueve y revierte el deployment productivo en Vercel |
| `lighthouse-vercel-auth.cjs` | usado por CI | Autentica Lighthouse contra el deployment staged |
| `supabase-admin.ts` | modulo interno | Cliente admin de Supabase compartido por los scripts |
