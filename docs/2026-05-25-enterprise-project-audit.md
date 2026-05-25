# Auditoría enterprise del proyecto MovieTime PTY

**Fecha:** 2026-05-25  
**Repositorio:** `MovieTime-Supabase`  
**Alcance:** arquitectura, dominio, seguridad, Supabase/Postgres, frontend, estado cliente, testing, operaciones, PWA y mantenibilidad.

## Resumen ejecutivo

MovieTime PTY ya tiene una base arquitectónica muy superior a la de un proyecto CRUD común: monolito modular documentado, ADRs vigentes, Supabase/Postgres como fuente de verdad, RPCs críticas, idempotencia, read models de dashboard, CSP, headers de seguridad, PWA offline read support, tests unitarios y scripts de validación.

El riesgo enterprise principal no está en falta de estructura, sino en tres frentes:

1. **Seguridad/autorización:** hay endpoints y RPCs que deben cerrarse antes de operar como sistema multiusuario enterprise.
2. **Módulos shallow en zonas financieras y operativas:** `payments`, `notifications`, `forecasting` y algunos use-cases exponen demasiados detalles o mezclan dominio con UI/cache.
3. **Confiabilidad de testing:** build/lint/migraciones pasan, pero la suite Vitest completa tiene 3 timeouts.

**Postura recomendada:** no reescribir. Continuar la ruta ya decidida en ADR-0005: monolito modular con Modules profundos, Interfaces pequeñas, Adapters tipados y tests por contrato.

## Evidencia revisada

- `CONTEXT.md`
- `docs/adr/0001-dashboard-read-models-postgres.md`
- `docs/adr/0002-react-query-zustand-ownership.md`
- `docs/adr/0003-typed-rpc-adapters-and-idempotency.md`
- `docs/adr/0004-typed-client-events.md`
- `docs/adr/0005-modular-monolith-deep-modules.md`
- `src/app`, `src/components`, `src/hooks`, `src/store`
- `src/lib/use-cases`, `src/lib/supabase`, `src/lib/payments`, `src/lib/notifications`, `src/lib/dashboard-read-models`, `src/lib/forecasting`
- `supabase/migrations`
- `scripts`
- `proxy.ts`, `next.config.ts`, `vitest.config.ts`, `package.json`

## Inventario rápido

- Modules fuente en `src`: 528 archivos `.ts/.tsx` no test.
- Tests en `src`: 61 archivos `.test.ts/.test.tsx`.
- Migraciones Supabase: 81 archivos.
- Stack principal: Next.js 16, React 19, Supabase, TanStack Query, Zustand, Vitest, Tailwind 4.

## Estado de validaciones

| Comando | Resultado | Observación |
| --- | --- | --- |
| `npm run lint` | Pasa | Sin errores ESLint. |
| `npm run build` | Pasa | Next.js compila correctamente con Turbopack. |
| `npm run secrets:scan` | Pasa | Sin hallazgos, pero el script solo revisa staged diff. |
| `npm run migrate:validate` | Pasa | Sin bloqueos; `ventas_archivadas_activas: 7` aparece como reporte aceptable. |
| `npm test -- --run` | Falla | 3 tests por timeout de 5000 ms. |

Tests con timeout:

- `src/lib/notifications/notification-sync-behavior.test.ts`: `denormaliza renovacionAutomatica al crear una notificacion de servicio`
- `tests/unit/store/tercerosStore.test.ts`: `espera la sincronizacion de ventas y notificaciones cuando cambia el telefono`
- `src/app/(dashboard)/dashboard/page.test.tsx`: `no muestra el control manual de sincronizacion del sistema`

## Fortalezas enterprise

### 1. Dirección arquitectónica documentada

El proyecto tiene una brújula clara:

- Dashboard como read model de Postgres/Supabase.
- React Query para lecturas remotas.
- Zustand para estado UI y flujos optimistas.
- RPCs críticas con Adapters tipados e idempotencia.
- Eventos cliente tipados en `StoreEventBus`.
- Monolito modular con Modules profundos.

Esto reduce ambigüedad de ownership y evita discusiones repetidas.

### 2. Supabase/Postgres como fuente de verdad

`CONTEXT.md` establece que métricas derivadas viven en SQL views, RPCs, triggers o servicios dedicados. Esto está alineado con `src/lib/dashboard-read-models` y con las migraciones de dashboard.

### 3. Buen comienzo de Adapters tipados

Los Adapters de RPC en `src/lib/supabase/*-rpc-adapter.ts` concentran llamadas críticas para ventas, servicios y pagos. La decisión es correcta: las operaciones financieras no deben depender de llamadas `rpc` ad hoc desde UI o stores.

### 4. Seguridad HTTP razonable

`next.config.ts` define headers importantes:

- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`
- `Referrer-Policy`
- `Permissions-Policy`
- `poweredByHeader: false`

`proxy.ts` añade CSP con nonce, `frame-ancestors 'none'`, `object-src 'none'` y controles de `connect-src`.

### 5. PWA con lectura offline delimitada

La arquitectura reconoce `Copia offline` como fallback de lectura. Las mutaciones usan guards como `assertOnlineMutation`, que preservan la fuente de verdad en Supabase.

## Hallazgos críticos

### C-01. `/api/push/pending` expone resumen operativo sin autenticar usuario

**Severidad:** Crítica  
**Archivos:**

- `src/app/api/push/pending/route.ts`
- `src/lib/executive-push/executive-push-delivery.ts`
- `public/sw.js`

**Problema:** el endpoint acepta un `endpoint` de Web Push desde el request body y llama `getExecutivePushSummaryForEndpoint`. El service worker lo invoca sin `Authorization`.

**Riesgo:** si alguien obtiene o captura un endpoint de push, puede consultar resumen operativo. Como el flujo usa service role detrás del Module de executive push, una entrada pública termina alcanzando datos privilegiados.

**Recomendación:**

- Exigir JWT en `/api/push/pending`.
- Validar que el endpoint pertenece a `auth.uid()`.
- Alternativa: token firmado/HMAC por suscripción push.
- Evitar service role para lookups iniciados por entrada pública sin prueba de posesión.

### C-02. RPCs críticas permiten suplantar `created_by`

**Severidad:** Crítica  
**Archivos:**

- `supabase/migrations/20260523183000_rpc_idempotency_keys.sql`
- `src/lib/supabase/payments-rpc-adapter.ts`
- `src/lib/supabase/ventas-rpc-adapter.ts`
- `src/lib/supabase/servicios-rpc-adapter.ts`

**Problema:** varias RPCs aceptan `p_created_by UUID DEFAULT auth.uid()` y luego usan `COALESCE(p_created_by, auth.uid())`.

**Riesgo:** un caller autenticado puede atribuir pagos, ventas, servicios o refunds a otro usuario. En funciones `SECURITY DEFINER`, esto erosiona auditoría y trazabilidad.

**Recomendación:**

- Derivar siempre `created_by` desde `auth.uid()` dentro de la DB.
- Eliminar `p_created_by` de RPCs públicas.
- Si se mantiene por compatibilidad, rechazar explícitamente `p_created_by <> auth.uid()`.
- Añadir tests SQL para suplantación.

### C-03. Idempotencia no está aislada por usuario

**Severidad:** Alta  
**Archivo:** `supabase/migrations/20260523183000_rpc_idempotency_keys.sql`

**Problema:** la tabla `rpc_idempotency_keys` usa `PRIMARY KEY (idempotency_key, rpc_name)`, pero las lecturas filtran por `created_by`. Los inserts usan `ON CONFLICT DO NOTHING`.

**Riesgo:** una colisión o pre-siembra por otro usuario puede impedir persistir la clave del usuario legítimo. En el peor caso, un retry deja de reconocer su operación previa y puede duplicar registros financieros.

**Recomendación:**

- Cambiar unique key a `(created_by, rpc_name, idempotency_key)`.
- O validar propietario en conflicto y abortar si no coincide.
- Cubrir con tests de concurrencia/colisión por usuario.

## Hallazgos altos

### H-01. RLS demasiado permisivo para operación enterprise

**Severidad:** Alta  
**Archivos:**

- `supabase/migrations/20260504231626_rls.sql`
- `supabase/migrations/20260505023500_v2_rls_policy_cleanup.sql`

**Problema:** muchas tablas operativas usan políticas basadas solo en `public.is_authenticated()`.

**Riesgo:** cualquier usuario autenticado puede leer o modificar datos globales según la tabla/política. Puede ser aceptable para una app single-tenant de confianza, pero no para un sistema enterprise multiusuario o con roles internos.

**Recomendación:**

- Introducir roles de aplicación y permisos por acción.
- Usar `WITH CHECK created_by = auth.uid()` donde aplique.
- Mover operaciones sensibles a RPCs que validen autorización explícita.
- Documentar si el producto es single-tenant administrativo; si lo es, registrar ADR que lo justifique.

### H-02. `payments` es un Module shallow en una zona financiera

**Severidad:** Alta  
**Archivos:**

- `src/lib/payments/payment-factory.ts`
- `src/lib/payments/payment-calculator.ts`
- `src/lib/payments/currency-converter.ts`
- `src/lib/payments/payments-module.ts`
- `src/lib/supabase/payments-repository.ts`
- `src/lib/supabase/pagos-repository.ts`

**Problema:** la Interface pública expone factory, calculator, converter y repositorios. Además, `payment-factory` importa repositorios Supabase, mientras repositorios de pagos importan comportamiento desde `payments`. Eso reduce Depth y crea coupling circular conceptual.

**Deletion test:** si se elimina `payments`, bastante complejidad reaparece en ventas/servicios/repositorios; eso indica que el Module puede ganar Depth. Pero la Interface actual aún obliga a callers a conocer demasiados detalles.

**Recomendación:**

- Convertir `payments` en Module financiero profundo con Interface orientada a dominio:
  - registrar `Pago de venta`
  - registrar `Pago de servicio`
  - calcular total USD
  - crear snapshot monetario
  - normalizar refund como movimiento firmado
- Dejar Supabase como Adapter de persistencia, no como dependencia interna circular del dominio financiero.
- Añadir tests por contrato del Module.

### H-03. Use-cases de Notificacion mezclan dominio, UI, stores y cache

**Severidad:** Alta  
**Archivos:**

- `src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.ts`
- `src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.ts`
- `src/store/notificacionesStore.ts`

**Problema:** algunos use-cases importan UI feedback, stores, dynamic imports y acciones de navegador. Esto rompe Locality: una regla de renovación de Notificacion arrastra UI, cache y browser.

**Recomendación:**

- Los use-cases deben devolver outcomes: `renewed`, `warnings`, `cacheInvalidations`, `whatsappMessage`.
- La UI debe decidir toast, navegación, apertura de WhatsApp y refrescos visuales.
- Store/cache reactions deben colgar de `StoreEventBus`.

### H-04. `servicio-dependencies-use-cases` cruza demasiados seams

**Severidad:** Alta  
**Archivo:** `src/lib/use-cases/servicios/servicio-dependencies-use-cases.ts`

**Problema:** coordina ventas, Notificaciones, eventos y stores. El nombre sugiere sincronización de dependencias denormalizadas, pero la Implementation contiene orquestación de cache y efectos cliente.

**Recomendación:**

- Definir un Module `Servicio dependency sync` con Interface explícita.
- Mantener reglas de consistencia de Servicio ahí.
- Mover invalidaciones y refresh de stores a reactions.
- Cubrir con tests que crucen la Interface del Module, no internals.

## Hallazgos medios

### M-01. Grants a `anon` en vistas de Notificaciones

**Severidad:** Media  
**Archivos:**

- `supabase/migrations/20260510000100_notification_views_read_live_fk.sql`
- `supabase/migrations/20260519131309_expose_venta_notas_in_notifications.sql`

**Problema:** las vistas de Notificaciones conceden `SELECT` a `anon`.

**Riesgo:** aunque `security_invoker` + RLS probablemente protege hoy, un cambio futuro de RLS podría filtrar datos por una superficie pública innecesaria.

**Recomendación:** revocar `SELECT` a `anon`; mantener `authenticated` y `service_role`.

### M-02. Validación de entorno no es fail-fast

**Severidad:** Media  
**Archivos:**

- `src/config/env.ts`
- `src/lib/server/supabase-server.ts`
- `src/config/README.md`

**Problema:** valores como `PUSH_CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` o `NEXT_PUBLIC_APP_URL` pueden quedar vacíos/default hasta runtime.

**Recomendación:**

- Crear esquema Zod separado para client/server.
- Requerir secretos en producción.
- Fallar temprano en boot/build.
- Añadir comando CI `npm run env:validate`.

### M-03. Scanner de secretos limitado a staged diff

**Severidad:** Media  
**Archivo:** `scripts/scan-secrets.mjs`

**Problema:** usa `git diff --cached`; no cubre working tree completo, historia Git ni archivos no staged.

**Recomendación:**

- Mantener hook local.
- Añadir `gitleaks` o `trufflehog` en CI.
- Escanear historia en ramas protegidas.

### M-04. Script de reset puede apuntar al entorno equivocado

**Severidad:** Media-baja  
**Archivo:** `scripts/reset-supabase-staging.ts`

**Problema:** usa `.env.local` y service role. Si `.env.local` apunta a producción, el script puede borrar datos reales.

**Recomendación:**

- Allowlist de project ref/URL staging.
- Confirmación que incluya project ref, hostname y conteos.
- Service role separado por entorno.
- Bloqueo explícito si detecta URL productiva.

### M-05. `forecasting` no tiene una Interface de Pronostico financiero profunda

**Severidad:** Media  
**Archivos:**

- `src/lib/forecasting/financial-forecast.ts`
- `src/lib/forecasting/forecast-sync.ts`
- `src/hooks/use-pronostico-financiero.ts`

**Problema:** parte del cálculo vive en hooks, y `forecast-sync` invalida dashboard. El Module promete Pronostico financiero, pero su Interface no concentra todo el comportamiento.

**Recomendación:**

- Profundizar `forecasting` para que cargue read model, tasas y cálculo detrás de una Interface.
- O mover invalidación a `dashboard-read-models`/`client-cache` si no pertenece al dominio de forecasting.

### M-06. Persisten stores de dominio con cache propia

**Severidad:** Media  
**Archivos:**

- `src/store/ventasStore.ts`
- `src/store/serviciosStore.ts`
- `src/store/tercerosStore.ts`
- `src/hooks/*`

**Problema:** ADR-0002 indica React Query para lecturas remotas y Zustand para UI. El repo ya migró varios hooks a React Query, pero stores como `ventasStore` todavía mantienen cache remota, counts y mutaciones.

**Recomendación:**

- Migración incremental por feature.
- Mantener Zustand para UI/optimistic state.
- Mover lecturas remotas a React Query.
- Usar `StoreEventBus` para invalidaciones, no imports directos entre stores.

## Módulos evaluados con vocabulario de arquitectura

| Module | Evaluación | Depth | Riesgo | Recomendación |
| --- | --- | --- | --- | --- |
| `dashboard-read-models` | Interface pequeña sobre reads de dashboard | Deep | Bajo | Mantener patrón y usarlo como referencia. |
| `supabase/*-rpc-adapter` | Seam real para IO crítico | Deep parcial | Medio | Eliminar suplantación `created_by` y reforzar contrato. |
| `notifications` | Sync público bien encaminado, internals filtrados | Deep parcial | Alto | Cerrar Interface pública y separar UI/cache. |
| `payments` | Exposición de factory/calculator/converter/repos | Shallow | Alto | Deepen primero por impacto financiero. |
| `forecasting` | Cálculo e invalidación dispersos | Shallow | Medio | Rehacer Interface de Pronostico financiero. |
| `record-core` | Utilitario genérico con excepciones por entidad | Deep parcial | Medio | Evitar que crezca como God Module; mover excepciones a Modules de dominio. |
| `StoreEventBus` | Seam emergente para eventos cliente | Deep parcial | Medio | Usarlo más para invalidación y reducir imports directos. |

## Frontend, UX y performance

### Fortalezas

- Uso extendido de App Router.
- React Query con defaults centralizados en `src/lib/query-client.ts`.
- Query keys centralizadas en `src/lib/query-keys.ts`.
- Componentización significativa por dominio.
- Dynamic imports en dashboard para charts pesados.
- Diseño PWA y offline page.

### Riesgos

- `src/app/layout.tsx` fuerza `dynamic = 'force-dynamic'` globalmente; esto simplifica nonce/CSP y headers, pero reduce oportunidad de static rendering.
- Algunos archivos de UI superan 10 KB y combinan estado, rendering y acciones, por ejemplo `ServicioProfilesSection.tsx`, `VentaReembolsoDialog.tsx`, `Sidebar.tsx`, `NotificationBell.tsx`.
- Hay 274 ocurrencias de `useEffect`/`useState` en `src/hooks`, `src/components` y `src/app`; no es malo por sí mismo, pero en workflows complejos conviene revisar si hay estado derivado duplicado.
- Mutaciones siguen pasando por stores de dominio, mientras lecturas nuevas usan React Query. Es una transición razonable, pero debe cerrarse por vertical slice.

## Testing y calidad

### Lo bueno

- 61 archivos de test.
- Tests sobre RPC adapters, read models, payments, notifications, PWA, stores y UI.
- Vitest configurado con coverage V8.
- `npm run lint`, `npm run build` y `npm run migrate:validate` pasan.

### Riesgos

- La suite completa no está verde por 3 timeouts.
- Los timeouts están en zonas de sincronización de notificaciones/stores/dashboard, justo donde hay coupling de efectos.
- No se observó umbral de coverage obligatorio en `vitest.config.ts`.

### Recomendaciones

- Arreglar los 3 timeouts antes de cualquier refactor grande.
- Añadir `testTimeout` solo si el test realmente necesita más tiempo; si no, aislar timers/promises pendientes.
- Añadir coverage thresholds progresivos para Modules críticos: payments, RPC adapters, notifications, dashboard-read-models.
- Añadir tests SQL para seguridad de RPCs críticas.

## Roadmap recomendado

### Fase 0: Bloqueadores de seguridad

1. Cerrar `/api/push/pending` con JWT o token firmado por suscripción.
2. Eliminar suplantación de `created_by` en RPCs críticas.
3. Aislar idempotency keys por usuario.
4. Revocar grants `anon` innecesarios en vistas de Notificaciones.

### Fase 1: Confiabilidad operativa

1. Arreglar los 3 timeouts de Vitest.
2. Añadir validación fail-fast de entorno.
3. Endurecer `reset-supabase-staging`.
4. Ampliar secrets scan en CI.

### Fase 2: Deepening de Modules

1. Deepen `payments`.
2. Separar use-cases de Notificacion de UI/cache.
3. Convertir `servicio-dependencies-use-cases` en Module explícito.
4. Profundizar o reubicar `forecasting`.

### Fase 3: Estado cliente y performance

1. Migrar lecturas remotas restantes desde stores a React Query por feature.
2. Mantener Zustand para UI, selección, filtros, colas y optimismo.
3. Revisar `dynamic = 'force-dynamic'` global y decidir si se puede acotar.
4. Dividir archivos UI grandes por workflows, no por micro-fragmentos.

## Top recommendation

La primera acción debe ser **cerrar seguridad de RPCs y `/api/push/pending`**, porque son riesgos de datos y auditoría. Después, el primer deepening arquitectónico debe ser **`payments`**, porque concentra riesgo financiero y ofrece alto Leverage: ventas, servicios, refunds, forecasting y dashboard se benefician de una Interface financiera más profunda y con mayor Locality.

## Nota sobre exploradores

Esta auditoría integra hallazgos de exploradores especializados:

- Arquitectura de Modules/dominio.
- Supabase, seguridad, migraciones y operaciones.

El explorador de frontend/performance/testing no completó a tiempo; el frente frontend fue cubierto con inspección local y comandos de validación.
