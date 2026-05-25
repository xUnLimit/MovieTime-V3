# Backlog detallado de deuda, riesgos y oportunidades

**Fecha:** 2026-05-25  
**Proyecto:** MovieTime PTY / MovieTime-Supabase  
**Alcance:** arquitectura, seguridad, Supabase/Postgres, estado cliente, UI, PWA, tests, operaciones y documentacion.  
**Objetivo:** listar con detalle lo que esta mal, incompleto, riesgoso o mejorable, separando bugs/riesgos de oportunidades.

**Estado de ejecucion:** Fase 0, Fase 1 y Fase 2 implementadas. Fase 3 implementada para Notificacion, pagos, adapters de pagos y seams de detalle Venta/Servicio. Fase 4 implementada para PWA/offline facade, push ejecutiva API/settings/delivery, DataTable helper tipado, clasificacion de `src/lib/services`, naming nuevo hacia Tercero y documentacion activa. Los cambios que requieren ADR nueva siguen marcados como no tocar.

## Lectura rapida

Este documento no significa que el proyecto este mal. Significa que el proyecto ya tiene una arquitectura suficiente para que las deudas reales sean visibles.

## Evidencia de cierre 2026-05-25

- Seguridad/RPC/RLS: cerrado con tests de push pending, payloads cliente sin `p_created_by`, idempotencia por usuario confirmada y ADR-0006.
- Tests/operacion: suite Vitest estable, lint y build verdes; env/reset/secrets validados en fases previas.
- Cliente/cache: cache/store reactions centralizadas y comandos desacoplados de stores donde correspondia.
- Notificaciones: use-cases sin imports directos a stores; workflows de store aislados en `src/lib/store-reactions`.
- Pagos: interfaz `financialPayments` orientada a dominio; ventas/servicios ya no llaman factories posicionales directamente para renovaciones criticas.
- Supabase adapters: payloads fisicos de pagos confinados en `payments-repository`/RPC adapters; `record-core` conserva casts solo como frontera generica interna.
- Detalle Venta/Servicio: acciones de pantalla movidas a use-cases/reactions/fachadas de dependencias; stores internos ya no se importan desde los handlers criticos de Venta ni sale-actions de Servicio.
- PWA/offline: `offline-facade` expone preparar copia, estado, lecturas, paginacion y guard de mutaciones.
- Push ejecutiva: rutas API usan `executive-push-api`; settings y delivery quedan separados.
- DataTable/services/docs: helper tipado `defineDataTableColumns`, README de `src/lib/services` y este backlog actualizado como documento activo.
- No tocar sin ADR: multiusuario RLS, quitar `force-dynamic`, cambiar offline mutations y mover metricas fuera de Postgres quedan explicitamente fuera del cierre.

La regla de lectura es:

- **Critico:** puede exponer datos, romper auditoria financiera o permitir abuso.
- **Alto:** funciona, pero el costo de cambio o el riesgo de regresion es alto.
- **Medio:** deuda de mantenimiento, testing, claridad o evolucion.
- **Bajo:** limpieza, ergonomia, naming o documentacion.
- **No tocar sin ADR:** decisiones ya aceptadas que solo deben reabrirse con evidencia fuerte.

## Orden ejecutivo recomendado

1. Cerrar seguridad de push/RPC/RLS.
2. Poner la suite de tests verde y estable.
3. Adelgazar stores legacy.
4. Profundizar Notificacion renewal/actions.
5. Centralizar cache reactions.
6. Profundizar pagos como Module financiero.
7. Reducir casts estructurales en Supabase con Adapters profundos.
8. Consolidar detalle de Venta y Servicio.
9. Ordenar PWA/offline y push ejecutiva.
10. Limpiar docs, rutas legacy y convenciones.

## Hallazgos criticos

### C-01. Endpoint de push pending puede exponer resumen operativo

**Files**

- `src/app/api/push/pending/route.ts`
- `src/lib/executive-push/executive-push-delivery.ts`
- `public/sw.js`

**Tipo:** riesgo de seguridad/datos.  
**Severidad:** Critico.

**Problema**

El flujo de push pending acepta informacion de suscripcion desde entrada publica y puede llegar a datos operativos privilegiados. Si el endpoint no prueba identidad del usuario o posesion fuerte de la suscripcion, un endpoint capturado podria consultar resumen operativo.

**Por que importa**

Push ejecutiva contiene metricas, vencimientos o resumen de operacion. Eso no debe depender solo de que el caller conozca un endpoint de Web Push.

**Solucion**

- Exigir JWT de Supabase o token HMAC por suscripcion.
- Validar que la suscripcion pertenece a `auth.uid()`.
- Evitar service role en rutas iniciadas por entrada publica sin validacion estricta.
- Agregar tests de acceso: sin auth, auth de otro usuario, auth correcta.

**Criterio de cierre**

- Requests anonimos fallan.
- Requests autenticados con suscripcion ajena fallan.
- El service worker sigue funcionando con el mecanismo elegido.

### C-02. RPCs criticas no deben aceptar identidad creada por el cliente

**Files**

- `supabase/migrations/20260523183000_rpc_idempotency_keys.sql`
- `src/lib/supabase/ventas-rpc-adapter.ts`
- `src/lib/supabase/servicios-rpc-adapter.ts`
- `src/lib/supabase/payments-rpc-adapter.ts`

**Tipo:** riesgo de auditoria/seguridad financiera.  
**Severidad:** Critico.

**Problema**

Las RPCs financieras no deben permitir que el cliente decida `created_by` o campos equivalentes. La DB debe derivar identidad desde `auth.uid()`.

**Por que importa**

Ventas, servicios, pagos y refunds son movimientos auditables. Si el caller puede suplantar el usuario creador, el activity log y trazabilidad pierden valor.

**Solucion**

- Eliminar `p_created_by` de RPCs publicas.
- O rechazar `p_created_by <> auth.uid()` durante compatibilidad.
- Regenerar `database.types.ts`.
- Ajustar Adapters tipados.
- Agregar tests SQL de suplantacion.

**Criterio de cierre**

- Ninguna RPC critica acepta identidad arbitraria.
- La auditoria siempre apunta al usuario autenticado real.

### C-03. Idempotencia debe estar aislada por usuario

**Files**

- `supabase/migrations/20260523183000_rpc_idempotency_keys.sql`
- `src/lib/supabase/idempotency.ts`

**Tipo:** riesgo financiero/concurrencia.  
**Severidad:** Critico/Alto.

**Problema**

La idempotencia de RPCs criticas debe identificar la operacion por usuario + RPC + key. Si la unicidad no incluye usuario, una colision o pre-siembra puede impedir reconocer correctamente un retry legitimo.

**Por que importa**

El objetivo de idempotencia es que retries de red no dupliquen ventas, servicios, pagos o refunds. Una key compartida o mal aislada puede romper esa garantia.

**Solucion**

- Confirmar constraint real en DB actual.
- Usar `PRIMARY KEY (created_by, rpc_name, idempotency_key)`.
- Bloquear conflictos donde `created_by` no coincida.
- Testear retry mismo usuario y misma key.
- Testear misma key por usuarios distintos.

**Criterio de cierre**

- Retry del mismo usuario devuelve el mismo resultado.
- Otro usuario con misma key no bloquea ni reutiliza resultado ajeno.

## Hallazgos altos

### H-01. RLS demasiado amplia para escenario multiusuario

**Files**

- `supabase/migrations/20260504231626_rls.sql`
- `supabase/migrations/20260505023500_v2_rls_policy_cleanup.sql`
- migraciones posteriores de grants/RPCs

**Tipo:** seguridad/autorizacion.  
**Severidad:** Alta.

**Problema**

Muchas politicas parecen basarse en `is_authenticated()` en vez de permisos por rol, ownership o tenant. Esto puede ser correcto para una app single-tenant administrativa, pero es riesgoso si hay mas de un usuario con distintos permisos.

**Solucion**

- Decidir explicitamente: single-tenant administrativo o multiusuario con roles.
- Si es single-tenant, registrar ADR.
- Si es multiusuario, agregar roles y policies por accion.
- Usar `WITH CHECK` donde se creen datos.
- Mover operaciones sensibles a RPCs con validacion explicita.

**Criterio de cierre**

- Existe ADR de modelo de permisos.
- Las tablas sensibles no dependen solo de "estar autenticado" salvo decision documentada.

### H-02. Stores de dominio siguen mezclando cache remota, UI y reglas

**Files**

- `src/store/tercerosStore.ts`
- `src/store/serviciosStore.ts`
- `src/store/ventasStore.ts`
- `src/store/notificacionesStore.ts`
- `src/store/metodosPagoStore.ts`
- `src/store/gastosStore.ts`
- `src/store/categoriasStore.ts`

**Tipo:** arquitectura/mantenibilidad.  
**Severidad:** Alta.

**Problema**

ADR-0002 define React Query para lecturas remotas y Zustand para UI, seleccion, filtros y optimismo. Aun hay stores que tienen `fetch*`, TTL, counts, mutaciones, rollback, reacciones y Activity Log.

**Por que importa**

La Interface de los stores es shallow: para cambiar una mutacion hay que entender cache, counts, efectos laterales y datos remotos juntos.

**Solucion**

- Migrar lecturas remotas por feature a React Query.
- Mantener Zustand para estado UI y optimismo.
- Mover reacciones post-mutacion a `src/lib/store-reactions`.
- Mantener use-cases como punto de reglas de negocio.

**Criterio de cierre**

- Stores no hacen lecturas remotas generales salvo excepcion documentada.
- Mutaciones llaman use-cases y luego una reaccion pequena.
- Counts vienen de hooks/query keys, no de estado manual duplicado.

### H-03. Notificacion renewal/actions mezcla dominio con UI/cache/browser

**Files**

- `src/lib/use-cases/notificaciones/notificaciones-renewal-use-cases.ts`
- `src/lib/use-cases/notificaciones/notificaciones-actions-use-cases.ts`
- `src/components/notificaciones/**`

**Tipo:** arquitectura/testabilidad.  
**Severidad:** Alta.

**Problema**

El Module de acciones de Notificacion importa `toast`, stores, comandos de cache, dynamic imports y usa `window.open`. Esto reduce Locality: la regla de renovar una Venta desde Notificacion arrastra UI y browser.

**Solucion**

- Los use-cases devuelven outcomes.
- La UI decide toast y WhatsApp.
- Cache invalidation vive en reactions/EventBus.
- Los stores no se importan desde use-cases de dominio salvo Adapter explicito.

**Criterio de cierre**

- Tests del use-case corren sin DOM.
- La UI renderiza feedback a partir del outcome.
- No hay `toast` ni `window` dentro del use-case.

### H-04. Cache reactions no son todavia el seam unico

**Files**

- `src/lib/events/store-event-bus.ts`
- `src/lib/events/cache-reactions.ts`
- `src/lib/commands/client-cache.ts`
- hooks `use-ventas-*`
- paginas que invalidan queries manualmente

**Tipo:** arquitectura/coordinacion.  
**Severidad:** Alta.

**Problema**

Existe `StoreEventBus`, pero tambien existen comandos directos como `invalidateDashboardCache`, imports de stores desde cache commands e invalidaciones repartidas en hooks.

**Solucion**

- Definir un Module de reactions por dominio o read model.
- Los use-cases emiten eventos de negocio.
- Las reactions invalidan QueryClient/stores.
- `client-cache` no debe importar stores directamente salvo Adapter muy justificado.

**Criterio de cierre**

- Mapa evento -> cache afectada vive en un lugar.
- Agregar un evento nuevo no requiere editar varias pantallas.

### H-05. Payments sigue siendo shallow para una zona financiera

**Files**

- `src/lib/payments/*`
- `src/lib/supabase/payments-repository.ts`
- `src/lib/supabase/pagos-repository.ts`
- `src/lib/use-cases/ventas/ventas-payment-use-cases.ts`
- `src/lib/use-cases/servicios/servicios-payment-use-cases.ts`

**Tipo:** arquitectura financiera.  
**Severidad:** Alta.

**Problema**

Pagos expone factories, calculators, converter y repositorios con payloads genericos. La Interface obliga a callers a conocer demasiado de fechas, snapshots, moneda, RPC y defaults.

**Solucion**

Crear un Module financiero profundo con Interface de dominio:

- registrar Pago de venta;
- registrar Pago de servicio;
- registrar refund como movimiento firmado;
- crear snapshot monetario;
- convertir a USD;
- validar payload financiero antes de llegar al Adapter.

**Criterio de cierre**

- Callers no construyen payload RPC ni `Record<string, unknown>`.
- Tests cubren contratos de Pago de venta, Pago de servicio y refund.

### H-06. Repositories genericos filtran detalles fisicos de Supabase

**Files**

- `src/lib/supabase/record-core.ts`
- `src/lib/supabase/pagination.ts`
- `src/lib/supabase/read-models.ts`
- `src/lib/supabase/write-utils.ts`
- `src/lib/supabase/notifications-repository.ts`

**Tipo:** type safety/mantenibilidad.  
**Severidad:** Alta/Media.

**Problema**

`Record<string, unknown>`, `as never` y casts son aceptables dentro de Adapters, pero hoy el patron se filtra hacia repositorios publicos y algunos callers.

**Solucion**

- Mantener core generico interno.
- Crear Adapters profundos por dominio donde hay workflows importantes.
- Confinar casts en los Adapters.
- No exponer tabla/vista fisica al caller de dominio.

**Criterio de cierre**

- UI/use-cases no construyen payloads fisicos.
- Los casts quedan dentro de `src/lib/supabase/*-adapter.ts`.

### H-07. Detalle de Venta y Servicio tiene workflows repartidos

**Files**

- `src/app/(dashboard)/ventas/[id]/components/*`
- `src/app/(dashboard)/servicios/detalle/[id]/components/*`
- `src/lib/use-cases/ventas/venta-detail-use-cases.ts`
- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts`

**Tipo:** mantenibilidad/UI workflows.  
**Severidad:** Alta/Media.

**Problema**

Las pantallas de detalle coordinan lectura, pagos, perfiles, acciones de venta, WhatsApp, delete, refresh e invalidaciones desde muchos hooks.

**Solucion**

- Profundizar los Modules de detalle.
- Exponer una Interface orientada al workflow de pantalla.
- Mantener UI declarativa: renderiza estado y llama acciones.

**Criterio de cierre**

- La pantalla no importa repositories ni stores internos.
- Los tests cubren acciones de detalle desde el Module.

## Hallazgos medios

### M-01. Tests completos no deben quedar inestables

**Files**

- `src/lib/notifications/notification-sync-behavior.test.ts`
- `tests/unit/store/tercerosStore.test.ts`
- `src/app/(dashboard)/dashboard/page.test.tsx`
- `vitest.config.ts`

**Problema**

La auditoria previa registro timeouts. Aunque build/lint pasen, una suite inestable bloquea refactors grandes.

**Solucion**

- Aislar timers/promises pendientes.
- Evitar esperar side effects globales sin control.
- Usar fake timers cuando aplique.
- No subir timeout como primer recurso.

**Criterio de cierre**

- `npm test -- --run` pasa de forma repetible.

### M-02. Falta modelo de coverage por Module critico

**Files**

- `vitest.config.ts`
- `src/lib/payments/*`
- `src/lib/supabase/*-rpc-adapter.ts`
- `src/lib/notifications/*`

**Problema**

Hay tests, pero no parece haber umbral progresivo por Module critico.

**Solucion**

- Definir coverage minimo para payments, RPC adapters, notifications y dashboard-read-models.
- No exigir 100% global.
- Subir thresholds por fases.

**Criterio de cierre**

- CI falla si baja cobertura en Modules criticos.

### M-03. Validacion de entorno debe ser fail-fast

**Files**

- `src/config/env.ts`
- `scripts/validate-env.ts`
- `src/lib/server/supabase-server.ts`
- `src/config/README.md`

**Problema**

Secretos y URLs de produccion deben fallar temprano, no en runtime.

**Solucion**

- Separar schema client/server con Zod.
- Requerir secretos en produccion.
- Ejecutar `npm run env:validate` en CI/build.

**Criterio de cierre**

- Produccion no arranca con secretos vacios.

### M-04. Scanner de secretos local es limitado

**Files**

- `scripts/scan-secrets.mjs`
- `.githooks`

**Problema**

Un scanner basado solo en staged diff no cubre historia, working tree completo ni CI.

**Solucion**

- Mantener hook local.
- Agregar gitleaks/trufflehog en CI.
- Ejecutar contra historia en rama protegida.

**Criterio de cierre**

- Secret scan corre en PR y local.

### M-05. Reset de Supabase staging necesita guardrails fuertes

**Files**

- `scripts/reset-supabase-staging.ts`
- `.env.local`

**Problema**

Scripts con service role y `.env.local` pueden apuntar al entorno equivocado si no hay allowlist.

**Solucion**

- Allowlist por project ref/hostname.
- Confirmacion con project ref visible.
- Bloquear URLs productivas conocidas.

**Criterio de cierre**

- El script no corre si el proyecto no esta explicitamente permitido.

### M-06. PWA/offline tiene buena base pero Interface repartida

**Files**

- `src/lib/pwa/offline-copy.ts`
- `src/lib/pwa/offline-sync.ts`
- `src/lib/pwa/offline-db.ts`
- `src/store/pwaStore.ts`
- `src/components/pwa/PwaBootstrap.tsx`

**Problema**

Copia offline esta definida en `CONTEXT.md`, pero bootstrap, store, IndexedDB y guards todavia requieren conocimiento repartido.

**Solucion**

- Consolidar facade de Copia offline.
- Exponer preparar copia, leer dashboard, leer coleccion, bloquear mutacion y estado.

**Criterio de cierre**

- Callers no conocen IndexedDB ni detalles de sync.

### M-07. Push ejecutiva mezcla settings, delivery y rutas

**Files**

- `src/lib/executive-push/*`
- `src/app/api/push/daily/route.ts`
- `src/app/api/push/test/route.ts`
- `src/app/api/push/pending/route.ts`
- `src/components/layout/ConfiguracionDialogExecutiveSection.tsx`

**Problema**

Configuracion UI, delivery server-side, claim atomico y lectura de resumen necesitan seams mas claros.

**Solucion**

- `executive-push-settings` para UI/configuracion.
- `executive-push-delivery` para claim/envio/server.
- Rutas API como Adapters del Module server-side.

**Criterio de cierre**

- UI no conoce detalles de delivery.
- Delivery no depende de estado cliente.

### M-08. Table/DataTable filtra casts a callers

**Files**

- `src/components/shared/DataTable.tsx`
- tablas de categorias, metodos-pago, gastos, terceros, servicios

**Problema**

Varias tablas necesitan adaptar filas/columns al shape generico. Si eso produce casts repetidos, el DataTable tiene una Interface shallow para datos tipados.

**Solucion**

- Mejorar generics de DataTable.
- O crear Table Adapters por dominio.

**Criterio de cierre**

- Callers no hacen `as unknown as Record<string, unknown>[]` para renderizar.

### M-09. Activity Log aun no es dependencia de dominio completamente normalizada

**Files**

- `src/lib/activity/activity-log-writer.ts`
- `src/lib/utils/activityLogHelpers.ts`
- `src/lib/use-cases/**`
- `src/store/**`

**Problema**

Parte del activity log esta bien pasado como dependencia, pero algunos stores/reactions todavia construyen metadata y detalles.

**Solucion**

- Use-cases construyen metadata de dominio.
- Store/reaction solo pasa contexto del usuario.
- Activity writer concentra persistencia.

**Criterio de cierre**

- Cambiar formato de activity log no requiere tocar stores.

### M-10. `src/lib/services` debe quedar solo para servicios operacionales reales

**Files**

- `src/lib/services/*`
- `src/lib/executive-push/*`
- `src/lib/use-cases/**`

**Problema**

`services` puede volver a ser cajon mixto si contiene sync cliente, IO externo, dominio y cache juntos.

**Solucion**

- Clasificar cada archivo:
  - IO externo/server-side queda en services.
  - flujo de dominio va a use-cases.
  - reaccion cliente va a store-reactions/events.
  - read model va a su Module.

**Criterio de cierre**

- Cada archivo en `services` tiene razon operacional clara.

## Hallazgos bajos

### B-01. Documentacion historica y planes pueden contradecir estado actual

**Files**

- `ARCHITECTURE_ROADMAP.md`
- `docs/plans/*`
- `docs/2026-05-25-enterprise-project-audit.md`

**Problema**

Hay documentos que dicen "cerrado" y otros que listan pendientes. Eso confunde si no se diferencia estado historico, auditoria y backlog activo.

**Solucion**

- Mantener un unico backlog activo.
- Archivar planes superados.
- Linkear ADRs y decisiones vigentes.

**Criterio de cierre**

- Un maintainer nuevo sabe que documento seguir.

### B-02. Naming mixto entre usuario/tercero

**Files**

- `src/store/tercerosStore.ts`
- `src/types/clientes.ts`
- `src/types/ventas.ts`
- migraciones antiguas de rename

**Problema**

El dominio define `Tercero`, pero todavia aparecen nombres internos como `usuario` en varios sitios.

**Solucion**

- Cambiar gradualmente variables locales a `tercero`.
- No romper tablas historicas sin necesidad.

**Criterio de cierre**

- Nuevos Modules usan vocabulario de `CONTEXT.md`.

### B-03. Comentarios largos en stores pueden quedar obsoletos

**Files**

- `src/store/notificacionesStore.ts`
- otros stores con comentarios de arquitectura local

**Problema**

Los comentarios que describen arquitectura vieja generan confianza falsa.

**Solucion**

- Reemplazar comentarios amplios por links a ADR/CONTEXT.
- Mantener comentarios solo donde expliquen invariantes.

**Criterio de cierre**

- La documentacion arquitectonica vive en ADR/CONTEXT/backlog, no en comentarios stale.

## Areas que no son "malas" pero deben vigilarse

### A-01. `dynamic = force-dynamic` global

Puede estar justificado por CSP nonce y auth. No cambiar sin revisar seguridad, caching y rendering.

### A-02. Supabase/Postgres como fuente de verdad

Esta decision es correcta y respaldada por ADR. No mover metricas derivadas a cliente.

### A-03. Monolito modular

No reescribir a microservicios. El problema actual es Depth/Locality, no falta de separacion fisica.

### A-04. React Query + Zustand

La direccion es correcta. La deuda es terminar la migracion, no cambiar de herramienta.

## Backlog ejecutable por fases

### Fase 0: Seguridad y datos

**Estado:** Implementada en `docs/plans/2026-05-25-fase-0-1-seguridad-confiabilidad-design.md`.

1. Cerrar `/api/push/pending`.
2. Eliminar suplantacion de identidad en RPCs.
3. Confirmar/ajustar idempotencia por usuario.
4. Definir ADR de modelo de permisos/RLS.
5. Revocar grants anon innecesarios.

### Fase 1: Tests y operacion

**Estado:** Implementada en `docs/plans/2026-05-25-fase-0-1-seguridad-confiabilidad-design.md`.

1. Arreglar timeouts de Vitest.
2. Agregar env validation fail-fast.
3. Endurecer reset staging.
4. Agregar secret scan en CI.

### Fase 2: Arquitectura cliente

**Estado:** Implementada en `docs/plans/2026-05-25-fase-2-arquitectura-cliente-design.md`. Se centralizaron reactions de cache/store, se eliminaron imports directos de stores en use-cases donde correspondia y se dejaron los stores legacy como frontera de compatibilidad/UI hasta una migracion React Query completa con ADR propia.

1. Adelgazar `tercerosStore`.
2. Adelgazar `serviciosStore`.
3. Adelgazar stores de catalogos/gastos/metodos.
4. Centralizar cache reactions.
5. Eliminar imports directos de stores desde commands/use-cases donde no correspondan.

### Fase 3: Modules profundos

**Estado:** Implementada en `docs/plans/2026-05-25-fase-3-4-notificaciones-limpieza-design.md` y `docs/plans/2026-05-25-cierre-total-backlog-fase-3-4-design.md`. Se profundizaron acciones de Notificacion, pagos y detalles para que los flujos criticos pasen por seams de dominio/reactions.

1. Profundizar Notificacion actions/renewal.
2. Profundizar Payments.
3. Crear Adapters Supabase de dominio para lecturas importantes.
4. Consolidar detalle de Venta.
5. Consolidar detalle de Servicio.

### Fase 4: Limpieza y ergonomia

**Estado:** Implementada. Se agregaron ADRs/diseños, seams de reactions, facade PWA/offline, facade API de push ejecutiva, helper tipado de DataTable, clasificacion de `src/lib/services` y cierre documental. Renombres destructivos o cambios de modelo quedan fuera sin ADR nueva.

1. Ordenar `src/lib/services`.
2. Profundizar PWA/offline.
3. Separar push settings/delivery.
4. Mejorar DataTable/Table Adapters.
5. Normalizar naming `Tercero`.
6. Archivar docs superados.

## Candidatos que requieren ADR antes de cambiar

1. Cambiar modelo de RLS de single-tenant a multiusuario.
2. Quitar `force-dynamic` global si esta atado a CSP nonce.
3. Cambiar estrategia de offline mutations.
4. Mover metricas derivadas fuera de Postgres.
5. Reemplazar Zustand por React Query completamente.

## Definicion de "todo bien" para este proyecto

El proyecto puede considerarse sano cuando:

- No hay endpoints publicos que alcancen datos privilegiados sin prueba de identidad.
- RPCs financieras derivan identidad desde DB.
- Idempotencia esta probada por usuario y por retry.
- Tests pasan siempre.
- Stores no contienen cache remota general ni invariantes transaccionales.
- Use-cases de dominio no importan UI/browser.
- Cache reactions viven en un seam claro.
- Pagos tiene Interface de dominio, no payloads genericos.
- Casts estructurales quedan confinados a Adapters.
- Docs activas no contradicen el estado runtime.
