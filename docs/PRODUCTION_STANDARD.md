# Estandar de produccion

## Gate obligatorio

Un release es elegible solo cuando `npm run release:check` y todos los jobs de GitHub Actions pasan. No se aceptan resultados parciales, controles omitidos ni fallos atribuidos al entorno: si un control no puede ejecutarse, el release queda bloqueado.

| Area | Criterio bloqueante |
|---|---|
| Dependencias | Cero advisories en produccion; cero findings sin excepcion valida en tooling |
| Codigo | ESLint/SAST sin errores ni warnings, TypeScript estricto, boundaries validos |
| Pruebas | Unit/integration verdes y cobertura global sin regresion |
| Cambio | 80% lineas/funciones y 70% ramas; codigo critico 90%/90%/80% |
| Navegador | Smoke, rutas protegidas, axe y headers de seguridad verdes |
| Rendimiento | Lighthouse: performance 85, accessibility 95, best-practices 90 |
| Datos | Migraciones desde cero, historial sincronizado, RLS/RPC e invariantes verdes |
| Operacion | Variables validadas, health check verde, SBOM generado y rollback disponible |

## Migraciones

- Todo cambio de esquema vive en `supabase/migrations`; no se modifica produccion desde el dashboard.
- Usar expand/contract: primero agregar estructuras compatibles, luego desplegar codigo y solo en un release posterior retirar lo antiguo.
- Prohibidos seeds, `db reset --linked`, borrados masivos y cambios destructivos automaticos en produccion.
- CI ejecuta las migraciones desde cero. CD compara historial, muestra el dry-run, aplica pendientes una sola vez y ejecuta `migrate:validate`.
- Antes de migraciones de riesgo debe confirmarse que los backups administrados por Supabase estan activos y que existe una restauracion probada.

## Despliegue y rollback

1. Los gates corren sobre el SHA de `main`.
2. Se aplican y validan migraciones compatibles.
3. Vercel crea un deployment productivo staged con `--skip-domain`.
4. Playwright y Lighthouse validan el staged deployment.
5. Vercel promueve exactamente esa URL.
6. Se verifica `PRODUCTION_URL`. Si falla, se ejecuta `vercel rollback` y el workflow termina en rojo.

En Vercel debe desactivarse la asignacion automatica del dominio productivo. Los secrets requeridos en el environment `production` de GitHub son `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_CRON_SECRET` y `SUPABASE_SERVICE_ROLE_KEY`. `PRODUCTION_URL` se configura como variable del environment. El workflow obtiene temporalmente desde Vercel el bypass de automatizacion, lo enmascara y lo envia solo como header desde los controles de CI; no lo persiste en GitHub ni lo incluye en URLs, logs o artefactos.

## Operacion

- Revisar fallos 5xx y logs redactados inmediatamente despues de cada promocion.
- Mantener alertas para indisponibilidad de `/api/health`, incremento de 5xx y fallos de cron/push.
- Probar trimestralmente restauracion de backup y rollback de Vercel.
- Renovar dependencias y acciones semanalmente mediante Dependabot.
- Conservar el SBOM de cada release como artefacto asociado al workflow.
