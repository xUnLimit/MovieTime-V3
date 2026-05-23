# MovieTime PTY - Hoja de Ruta hacia Arquitectura Enterprise
# Version 1.1 - Mayo 2026

---

## RESUMEN EJECUTIVO

MovieTime PTY es un sistema de gestion de suscripciones de streaming para el mercado panameno. El proyecto ya tiene una base tecnica madura: Supabase/Postgres es la fuente de verdad, las operaciones criticas usan RPCs atomicas, existe trazabilidad mediante activity log, hay separacion de responsabilidades por carpetas, y `CONTEXT.md` documenta reglas importantes del dominio.

El diagnostico original era correcto en direccion, pero varias cifras y algunos hallazgos estaban desactualizados. Esta version corrige el estado real del repositorio al 22 de mayo de 2026 y ajusta la ruta enterprise para no contradecir decisiones ya tomadas, especialmente la decision de que metricas derivadas deben venir de SQL views/RPCs/triggers o servicios dedicados, no de APIs falsas de mutacion en el cliente.

Las principales categorias de deuda tecnica son:

1. **Use-cases de alta concentracion**: `ventas-use-cases.ts` y `servicios-use-cases.ts` siguen siendo los modulos de mayor riesgo en negocio. No son solo "largos"; concentran pagos, pronostico, logging, sincronizacion de terceros, actualizacion de perfiles y side-effects.
2. **Data fetching sin infraestructura unificada**: existen 13 hooks custom, pero el problema real esta en 9 hooks que usan `useState + useEffect` para carga asincrona. No hay deduplicacion de requests, invalidacion centralizada ni background refetch.
3. **Cobertura insuficiente para refactor enterprise**: hay 36 archivos de test y 105 tests, pero la cobertura real es 36.32% statements / 39.63% lines. Ya existen tests React y Testing Library esta configurado; faltan tests de formularios criticos, flujos completos y RPCs.
4. **Comunicacion entre modulos fragmentada**: stores, hooks y servicios combinan `dynamic import`, `window.dispatchEvent`, `localStorage.setItem`, acoplamiento directo entre stores y helpers de cache.
5. **Interfaces criticas sin type safety completa**: varios repositorios llaman RPCs mediante casts `supabase as unknown as { rpc: ... }` porque los tipos generados no reflejan todas las funciones usadas por la app.
6. **Modulos poco profundos o duplicados**: pagos, notificaciones, pronostico financiero, conversion de moneda y pass-through use-cases tienen interfaces que no concentran suficiente comportamiento.

Este documento propone una ruta en cinco fases: primero corregir falsos silenciosos y type drift; luego ampliar cobertura; despues descomponer use-cases; finalmente introducir React Query, event bus, modulos profundos e idempotencia.

Para iniciar implementacion, usar este roadmap como vision y el plan operativo en `docs/plans/2026-05-22-enterprise-architecture-implementation-plan.md` como secuencia de PRs. Las decisiones base quedan registradas en `docs/adr/`.

---

## METRICAS ACTUALES DEL PROYECTO

Metricas verificadas localmente sobre el repositorio:

| Metrica | Valor actual | Contexto |
|---|---:|---|
| Archivos TS/TSX | 397 | En `src` y `tests`, excluyendo `src/lib/supabase/database.types.ts` |
| Lineas TS/TSX estimadas | 53,815 | Excluyendo generated types |
| `database.types.ts` | 3,581 lineas | Tipos generados de Supabase |
| Stores Zustand | 16 | Archivos de store reales, excluyendo tests |
| Use-case files | 7 | `ventas-use-cases.ts`: 742 lineas; `servicios-use-cases.ts`: 551 lineas |
| Servicios de negocio | 11 | En `src/lib/services/`, excluyendo tests |
| Repositorios | 12 | Archivos `*-repository.ts`; la capa Supabase tambien tiene infraestructura (`record-core`, `read-models`, `pagination`, `write-utils`) |
| Hooks custom | 13 | 9 usan `useState/useEffect` para carga asincrona |
| Archivos de test | 36 | 105 tests pasando en la ultima medicion |
| Cobertura real | 36.32% statements / 39.63% lines | `npm run test:coverage -- --run` |
| Migraciones SQL | 78 | En `supabase/migrations` |
| Componentes React | 145 `.tsx` | En `src/components` |
| Archivos >400 lineas | 23 | Excluyendo `database.types.ts` |
| Archivos mas grandes | `VentasForm.tsx` 1026L; `VentasEditForm.tsx` 864L; `ventas-use-cases.ts` 742L; `reposo/page.tsx` 644L; `ServicioForm.tsx` 624L; `servicios-use-cases.ts` 551L | Valores por conteo local |

Nota: el documento anterior reportaba 25-30% de cobertura y cero tests React. Eso ya no describe el repo actual. La brecha real no es ausencia total de testing, sino falta de cobertura en flujos de negocio, formularios principales, repositorios/RPCs y contratos de integracion.

---

## MAPA DE ARQUITECTURA ACTUAL

El diseno pretendido sigue siendo `UI -> Store/Query Hook -> Use-Case -> Service -> Repository -> DB`, pero el grafo real tiene accesos directos desde UI/hooks hacia use-cases, services y helpers de Supabase. Esta diferencia importa porque las interfaces publicas que deben estabilizarse no son solo las de stores.

```text
UI: src/components, src/app
  - 145 componentes React
  - Formularios grandes: VentasForm 1026L, VentasEditForm 864L
  - Algunos componentes llaman use-cases/services directamente

  -> Zustand stores: src/store
       - 16 stores
       - cache TTL y optimistic writes
       - getLogContext duplicado
       - dynamic imports entre stores

  -> Hooks: src/hooks
       - 13 hooks custom
       - 9 con fetching manual
       - algunos importan services/helpers Supabase

Stores/hooks/componentes
  -> Use-cases: src/lib/use-cases
       - 7 files
       - ventas 742L, servicios 551L
       - pass-through: catalogos, notificaciones
       - mezcla safeAsyncSideEffect con .catch(console.error)

Use-cases
  -> Services: src/lib/services
       - 11 files
       - dashboardStatsService tiene APIs no-op
       - currencyService es fuente real de conversion
       - notificationSyncService concentra 525L

Services/use-cases/hooks
  -> Repositories / Supabase adapters: src/lib/supabase
       - 12 repository files + infraestructura comun
       - offline read support
       - assertOnlineMutation en escrituras
       - riesgo: RPCs criticas llamadas con casts unknown

Repositories
  -> Supabase / Postgres
       - RPCs atomicas
       - RLS
       - views/read models
       - dashboard live via get_dashboard_stats_live/get_dashboard_home
```

---

## FORTALEZAS - BASE SOLIDA A PRESERVAR

### 1. Supabase/Postgres como fuente de verdad

El dominio principal esta correctamente anclado en Postgres. Ventas, servicios, periodos, pagos, notificaciones y activity log no dependen de estado cliente para la verdad operacional.

### 2. RPCs atomicas para operaciones criticas

Operaciones como `create_venta_with_initial_payment`, `create_servicio_with_initial_payment`, `create_venta_payment`, `create_servicio_payment`, deletes con pagos y reembolsos se resuelven transaccionalmente en Postgres. Esta es una decision correcta y debe preservarse.

### 3. Activity logging robusto

El patron `detectarCambios() + metadata estructurada + detalles legibles` provee trazabilidad clara. Los campos trackeables por entidad hacen que la auditoria sea extensible y testeable.

### 4. Offline PWA separado de mutaciones

`shouldUseOfflineRead()` y `assertOnlineMutation()` estan en seams razonables: lectura offline en repositorios/read helpers, mutaciones protegidas por guard. Esta separacion debe mantenerse.

### 5. Helpers puros y testeables

`safety.ts`, `activityLogHelpers.ts`, `payments.ts` y partes de `calculations.ts` son modulos con implementaciones pequenas y testables. La ruta enterprise debe aumentar su profundidad sin dispersar reglas de negocio.

### 6. Documentacion de contexto

`CONTEXT.md` define lenguaje del dominio y una regla clave: metricas derivadas deben mantenerse por SQL views, RPCs, triggers o servicios dedicados. Los cambios de dashboard deben respetar esa decision.

---

## HALLAZGOS DETALLADOS POR CATEGORIA

---

### CATEGORIA A - CRITICOS

---

#### A-1: Use-cases de ventas y servicios concentran demasiada responsabilidad

**Severidad:** Critica  
**Archivos afectados:** `src/lib/use-cases/ventas-use-cases.ts` (742 lineas, 18 funciones exportadas), `src/lib/use-cases/servicios-use-cases.ts` (551 lineas, 11 funciones exportadas)  
**Impacto:** Cambios en pagos, renovaciones, reembolsos, pronostico o perfiles requieren entender muchas reglas colaterales en el mismo archivo.

**Evidencia:**

`renewVentaUseCase` coordina, como minimo:

1. Normalizacion de input de pago.
2. Creacion de pago de renovacion.
3. Actualizacion de notas.
4. Sincronizacion del metodo de pago del tercero.
5. Calculo de pronostico local.
6. Invalidacion/ajuste de dashboard.
7. Notificaciones.
8. Activity log opcional.

El problema no es solo cantidad de lineas. La interface del modulo obliga al mantenedor a conocer demasiadas invariantes: que side-effects son criticos, cuales son best-effort, cuando se actualiza perfil, cuando se corta venta y como se registra el log.

**Solucion propuesta:**

Crear modulos de use-cases por capacidad y mantener un barrel de compatibilidad:

```text
src/lib/use-cases/ventas/
  queries.ts          (get/fetch/count)
  writes.ts           (create/update/delete venta)
  payments.ts         (renew/update/delete payment/refund)
  side-effects.ts     (sync metodo pago, notificaciones, cache)
  index.ts            (exports publicos)

src/lib/use-cases/servicios/
  queries.ts
  writes.ts
  payments.ts
  side-effects.ts
  index.ts
```

La interface publica debe seguir siendo estable mientras se migran imports. El objetivo no es mover lineas por estetica; es crear locality: cambios de pagos viven en el modulo de pagos, cambios de escritura de venta viven en writes, y side-effects tienen politica explicita.

---

#### A-2: RPC type drift en repositorios criticos

**Severidad:** Critica  
**Archivos afectados:** `src/lib/supabase/ventas-repository.ts`, `src/lib/supabase/servicios-repository.ts`, `src/lib/supabase/payments-repository.ts`, `src/lib/supabase/database.types.ts`  
**Impacto:** Las operaciones mas criticas pierden type safety justo donde mas se necesita: pagos, ventas iniciales, renovaciones, deletes atomicos y reembolsos.

**Evidencia:**

Los repositorios crean un cliente manual:

```typescript
const rpcClient = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};
```

Esto permite llamar RPCs que no aparecen en `database.types.ts` o cuyo payload no esta expresado como contrato TypeScript. Si cambia una firma de Postgres, TypeScript no lo detecta.

**Solucion propuesta:**

- Regenerar `database.types.ts` despues de reconciliar migraciones y confirmar que todas las RPCs usadas por runtime aparecen en `Functions`.
- Crear un adapter tipado de RPCs criticas con payloads explicitamente nombrados si Supabase generated types no cubre alguna firma.
- Agregar una validacion de CI que falle si `supabase.rpc('...')` usa una funcion no presente en los tipos generados o en la allowlist tipada.
- Mantener `assertRpcStringId` y helpers de validacion, pero no usarlos como sustituto de firmas tipadas.

---

#### A-3: Data fetching asincrono sin infraestructura unificada

**Severidad:** Critica  
**Archivos afectados:** `src/hooks/`  
**Impacto:** Requests duplicados, invalidacion manual, refetch no centralizado y estado de loading/error repetido.

**Estado real:**

Hay 13 hooks custom. De esos, 9 usan `useState/useEffect` para carga asincrona. No todos los hooks son data fetching; `useClientPagination`, `use-sidebar`, `useVentasMetrics` y algunos wrappers derivados no deben contarse como problema principal.

**Ejemplos afectados:**

- `use-pagos-venta.ts`
- `use-pagos-servicio.ts`
- `use-ventas-por-terceros.ts`
- `use-ventas-tercero.ts`
- `useServerPagination.ts`
- `use-pronostico-financiero.ts`
- `use-notificaciones-montos.ts`
- `use-monto-sin-consumir-total.ts`
- `use-ventas-por-categorias.ts`

**Solucion propuesta:**

Adoptar TanStack Query v5 para lecturas servidor/cacheadas:

```typescript
const { data: pagos = [], isLoading } = useQuery({
  queryKey: queryKeys.pagosVenta.byVenta(ventaId),
  queryFn: () => fetchPagosVentaByVentaUseCase(ventaId),
  enabled: Boolean(ventaId),
});
```

Zustand debe conservar estado UI, modales, filtros locales y escrituras optimistas donde aporten valor. React Query debe asumir lecturas remotas, deduplicacion, invalidacion, retry y background refetch.

---

#### A-4: Cobertura insuficiente para refactor enterprise

**Severidad:** Critica  
**Estado real:** 36 test files, 105 tests, cobertura 36.32% statements / 39.63% lines  
**Impacto:** La cobertura existe, pero no protege todavia los flujos de mayor riesgo.

**Brechas reales:**

- Hay `.test.tsx` y Testing Library esta configurado, pero no hay tests de `VentasForm`, `VentasEditForm`, `ServicioForm` ni `TerceroDetails`.
- No hay tests de flujo completo `crear venta -> renovar -> reembolsar`.
- No hay tests de integracion de RPCs criticas con Supabase local.
- `lib/supabase` tiene cobertura muy baja (15.17% statements en la ultima medicion).
- `dashboardStatsService.ts` aparece con 0% porque mezcla RPC live con APIs no-op.
- Use-cases principales tienen cobertura parcial; `ventas-use-cases.ts` ronda 47% statements y 37% branches.

**Solucion propuesta:**

Antes de descomponer use-cases, subir cobertura enfocada en contratos:

- Use-cases criticos de ventas/servicios.
- Repositorios/RPC adapters.
- Formularios principales.
- Flujos completos con mocks de Supabase.
- RPCs en Supabase local para atomicidad.

La meta de Fase 1 debe ser 60% global y cobertura alta en los modulos que se van a refactorizar, no cobertura superficial de archivos faciles.

---

#### A-5: Dashboard no-op contradice la arquitectura actual de read models

**Severidad:** Critica  
**Archivo afectado:** `src/lib/services/dashboardStatsService.ts`  
**Impacto:** El codigo llama `adjustIngresosStats`, `adjustGastosStats`, `upsertVentaPronostico` y `upsertServicioPronostico` como si persistieran cambios, pero son no-ops. Eso crea una interface falsa.

**Evidencia:**

```typescript
export async function adjustIngresosStats(_params: { ... }): Promise<void> {
  void _params;
}

export async function upsertVentaPronostico(
  _venta: VentaPronostico | null,
  _ventaId: string
): Promise<void> {
  void _venta;
  void _ventaId;
}
```

**Solucion propuesta:**

No implementar mutaciones de metricas en cliente. `CONTEXT.md` ya establece que las metricas derivadas deben venir de SQL views, RPCs, triggers o servicios dedicados.

La correccion enterprise es:

- Eliminar llamadas a `adjust*` y `upsert*` que prometen mutacion y no hacen nada.
- Reemplazarlas por `invalidateDashboardCache()` o invalidacion de React Query.
- Mantener `get_dashboard_stats_live`, `get_dashboard_home` y `get_dashboard_churn_stats` como read models principales.
- Si algun dia se requiere cache materializado, implementarlo en Postgres/service-role job, no como delta mutable desde stores.

---

### CATEGORIA B - ALTOS

---

#### B-1: Pass-through use-cases con poca profundidad

**Severidad:** Alta  
**Archivos afectados:** `src/lib/use-cases/notificaciones-use-cases.ts`, `src/lib/use-cases/catalogos-use-cases.ts`, parcialmente `activity-log-use-cases.ts`  
**Impacto:** Aumentan la navegacion sin agregar invariantes, validacion, errores de dominio ni comportamiento.

**Evidencia:**

```typescript
export function fetchNotificacionesByFiltersUseCase<T = Notificacion>(
  filters: QueryFilter[] = []
) {
  return queryNotificaciones<T>(filters);
}
```

**Solucion propuesta:**

Aplicar deletion test:

- Si al borrar el modulo la complejidad desaparece, eliminarlo y permitir imports desde el repositorio/query layer.
- Si el modulo debe existir, profundizar su interface: validacion, errores de dominio, logging, politica de filtros o transformaciones reales.

`categorias-use-cases.ts` es el patron a preservar porque orquesta planes, build de categorias y activity log.

---

#### B-2: Side-effects asincronos con manejo inconsistente

**Severidad:** Alta  
**Archivos afectados:** use-cases y stores  
**Impacto:** Algunos errores quedan con contexto estructurado y otros solo llegan a `console.error` o se silencian.

**Evidencia:**

En `ventas-use-cases.ts` y `servicios-use-cases.ts` conviven:

- `safeAsyncSideEffect(...)`
- `.catch((err) => console.error(...))`
- `try/catch` para efectos best-effort
- `catch {}` silencioso en cleanup de notificaciones desde stores

**Solucion propuesta:**

- Definir politica de side-effects: critico, compensable o best-effort.
- Usar `safeAsyncSideEffect` para todo fire-and-forget best-effort.
- Prohibir `.catch(console.error)` en use-cases con una regla lint o una busqueda de CI.
- No usar `catch {}` sin al menos registrar contexto.

---

#### B-3: Conversion de moneda dispersa

**Severidad:** Alta  
**Impacto:** La fuente real es `currencyService`, pero hay wrappers y helpers con responsabilidades mezcladas.

**Evidencia:**

```text
metricsService.calculateVentasMetrics()
  -> calculations.sumInUSD(...)
    -> currencyService.convertToUSD(...)

servicios-use-cases.ts
  -> currencyService.convertToUSD(...) directo

payments.sumPaymentsInUSD(payments, convertToUSD)
  -> callback externo hacia currencyService
```

**Solucion propuesta:**

Crear un modulo profundo de pagos/moneda con una interface unica para:

- conversion asincrona a USD;
- calculo de montos/descuentos;
- suma de pagos en USD;
- snapshots de moneda/tasa.

`currencyService.convertToUSD()` puede seguir siendo el adapter concreto, pero los callers de negocio no deben elegir entre tres wrappers.

---

#### B-4: Declaration merging accidental en tipos de ventas

**Severidad:** Alta  
**Archivo:** `src/types/ventas.ts`  
**Impacto:** TypeScript une interfaces con el mismo nombre. El resultado compila, pero oculta duplicacion accidental y dificulta razonar sobre el contrato.

**Evidencia:**

El archivo declara `VentaPago` dos veces y `PagoVenta` dos veces. Eso no debe ser un mecanismo intencional para modelar pagos.

**Solucion propuesta:**

- Consolidar `VentaPago` en una sola interface.
- Consolidar `PagoVenta` en una sola interface.
- Verificar que `estado`, `motivoAnulacion` y `destinoReembolso` queden en el tipo correcto.
- Agregar chequeo lint contra redeclaraciones accidentales si la configuracion lo permite.

---

#### B-5: Estado derivado duplicado en stores

**Severidad:** Alta  
**Archivo principal:** `src/store/serviciosStore.ts`  
**Impacto:** `totalCategoriasActivas` vive en un store de servicios, aunque conceptualmente pertenece a categorias/dashboard/read model.

**Evidencia:**

```typescript
totalServicios: number;
serviciosActivos: number;
totalCategoriasActivas: number;
```

**Solucion propuesta:**

Definir ownership:

- `serviciosStore`: estado UI y cache de servicios.
- `categoriasStore` o read model SQL: metricas de categorias.
- `dashboardStore`/React Query: lectura de counts agregados.

El componente que necesite varias metricas debe componer selectors/hooks, no duplicar fuente de verdad.

---

#### B-6: Cascadas de notificaciones fuera de transaccion

**Severidad:** Alta  
**Archivos afectados:** `serviciosStore.ts`, `ventasStore.ts`, RPCs de delete/archive  
**Impacto:** El delete/archive principal puede completarse y el cleanup de notificaciones fallar silenciosamente.

**Evidencia:**

```typescript
try {
  const { useNotificacionesStore } = await import('./notificacionesStore');
  await useNotificacionesStore.getState().deleteNotificacionesPorServicio(id);
} catch {
  // Notifications cleanup is best-effort.
}
```

**Solucion propuesta:**

Primero decidir la regla de negocio:

- Si al archivar venta/servicio deben eliminarse notificaciones, mover esa limpieza a RPC o a un handler transaccional controlado.
- Si es best-effort, emitir evento tipado y registrar errores con `safeAsyncSideEffect`.

No debe quedar como `catch {}` silencioso.

---

#### B-7: La UI salta seams de arquitectura

**Severidad:** Alta  
**Archivos afectados:** `src/components`, `src/app`, `src/hooks`  
**Impacto:** El flujo real no es estrictamente `UI -> Store -> Use-Case`. Hay componentes y hooks importando use-cases, services y helpers Supabase directamente.

**Ejemplos verificados:**

- `VentasForm.tsx` importa use-cases y services directamente.
- `useServerPagination.ts` importa helpers Supabase.
- paginas de detalle importan services de sync/read model.
- notificaciones llaman use-cases directamente.

**Solucion propuesta:**

No forzar todo a Zustand. La arquitectura objetivo debe aceptar dos caminos explicitos:

1. UI -> React Query hook -> use-case/query module -> repository.
2. UI -> Store action -> use-case/command module -> repository/RPC.

Lo que debe eliminarse es el acceso ad hoc. Cada ruta debe tener una interface clara y testeable.

---

### CATEGORIA C - MEDIOS

---

#### C-1: Sin Event Bus centralizado para cambios de negocio

**Severidad:** Media  
**Impacto:** Los eventos de negocio se comunican mediante dynamic imports, DOM events, localStorage y acoplamiento directo.

**Estado real:**

Hay multiples usos de:

- `window.dispatchEvent(...)`
- `window.localStorage.setItem(...)`
- dynamic imports de stores desde otros stores
- `client-cache.ts` importando stores de forma dinamica

**Solucion propuesta:**

Crear `StoreEventBus` tipado:

```typescript
type StoreEvent =
  | { type: 'VENTA_DELETED'; ventaId: string }
  | { type: 'SERVICIO_ARCHIVED'; servicioId: string }
  | { type: 'DASHBOARD_INVALIDATED'; source: string }
  | { type: 'NOTIFICACIONES_INVALIDATED'; reason: string };
```

Los stores se suscriben a eventos. Los use-cases o stores emiten eventos despues de confirmar mutaciones. React Query puede invalidar queries desde handlers.

---

#### C-2: Documentacion legacy de dashboard entra en conflicto con Supabase actual

**Severidad:** Media  
**Archivos afectados:** `docs/plans/2026-02-13-dashboard-implementation-design.md`, `docs/plans/2026-02-22-dashboard-metrics-optimization-design.md`, `dashboardStatsService.ts`  
**Impacto:** Documentos antiguos describen Firebase/incremental cache y ajustes por delta, mientras la app actual lee dashboard live desde RPCs Supabase.

**Solucion propuesta:**

- Marcar esos documentos como legacy o superados por Supabase live RPCs.
- Crear ADR o nota de arquitectura: "Dashboard read models se calculan en Postgres; el cliente solo invalida/refetchea".
- Alinear roadmap, `CONTEXT.md` y `CLAUDE.md` con esa decision.

---

#### C-3: Sin ADRs para decisiones enterprise

**Severidad:** Media  
**Estado actual:** `docs/adr/` ya existe con cinco ADRs iniciales; falta convertirlo en parte obligatoria del proceso de cambio.  
**Impacto:** Si los ADRs no se mantienen, las decisiones importantes volveran a quedar repartidas entre planes antiguos, `CONTEXT.md`, migraciones y convenciones tacitas.

**Solucion propuesta:**

Usar los ADRs existentes como baseline y exigir nuevos ADRs cuando una decision cambie contratos entre capas, modelo de datos, RPCs o ownership de estado. ADRs iniciales:

- `0001-dashboard-read-models-postgres.md`
- `0002-react-query-zustand-ownership.md`
- `0003-typed-rpc-adapters-and-idempotency.md`
- `0004-typed-client-events.md`
- `0005-modular-monolith-deep-modules.md`

---

#### C-4: Componentes y paginas gigantes

**Severidad:** Media  
**Archivos:** `VentasForm.tsx` (1026L), `VentasEditForm.tsx` (864L), `reposo/page.tsx` (644L), `ServicioForm.tsx` (624L), `ServicioDetalleClient.tsx` (600L), `TerceroDetails.tsx` (592L)  
**Impacto:** Los formularios principales mezclan presentacion, validacion, data loading, calculos, side-effects y submit.

**Solucion propuesta:**

Extraer por secciones funcionales y hooks especificos:

```text
src/components/ventas/form/create/
  VentaCreateForm.tsx
  VentaClienteSection.tsx
  VentaServicioSection.tsx
  VentaPeriodoSection.tsx
  VentaPagoSection.tsx
  useVentaCreateForm.ts
```

La meta debe ser testabilidad por interface, no solo bajar lineas. Un form shell puede seguir coordinando secciones si la interface es clara.

---

#### C-5: `getLogContext()` duplicado

**Severidad:** Media  
**Estado real:** duplicado en 7 stores (`categorias`, `gastos`, `metodosPago`, `servicios`, `templates`, `terceros`, `ventas`)  
**Impacto:** Cambios en fallback de usuario o metadata de log deben repetirse.

**Solucion propuesta:**

Crear helper compartido:

```typescript
export function getStoreLogContext() {
  const user = useAuthStore.getState().user;
  return {
    usuarioId: user?.id ?? 'sistema',
    usuarioEmail: user?.email ?? 'sistema',
  };
}
```

---

#### C-6: Sin errores de dominio tipados

**Severidad:** Media  
**Impacto:** La UI recibe `Error` generico y no puede distinguir validacion, conflicto, no encontrado, saldo insuficiente o problema transitorio.

**Solucion propuesta:**

Crear `src/lib/errors/domain-errors.ts`:

```typescript
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {}
export class NotFoundError extends DomainError {}
export class ConflictError extends DomainError {}
export class InsufficientFundsError extends DomainError {}
```

Los use-cases criticos deben lanzar errores de dominio. Los stores traducen esos errores a mensajes UI.

---

### CATEGORIA D - BAJOS / DEUDA TECNICA MENOR

---

#### D-1: Rollback inconsistente en stores

`gastosStore` tiene rollback mas completo que ventas/servicios. Las acciones optimistas deben seguir un patron uniforme: capturar estado previo, aplicar cambio, ejecutar comando, confirmar o revertir con error tipado.

#### D-2: Sin feature flags

No hay mecanismo para activar cambios de arquitectura gradualmente. Una solucion ligera es una tabla `feature_flags` o un read model de configuracion consumido por `configStore`/React Query.

#### D-3: Parametro realtime declarado pero no implementado

`useServerPagination` acepta `realtime?: boolean`, pero no lo usa. Debe eliminarse hasta implementar realtime real.

#### D-4: Reglas lint insuficientes para promesas flotantes

El proyecto permite `void`/`.catch` ad hoc en zonas criticas. Para avanzar a enterprise conviene agregar reglas que hagan explicita la decision: await, return, `safeAsyncSideEffect` o comentario intencional.

---

## OPORTUNIDADES DE PROFUNDIZACION

Estas oportunidades buscan crear modulos mas profundos: interfaces pequenas con implementaciones que concentran reglas, reducen acoplamiento y mejoran locality.

---

### Deepening 1: Modulo de Pagos y Moneda

**Problema:** La logica de pagos/conversion esta dispersa:

- `pagosVentaService.ts`
- `pagosServicioService.ts`
- `payments.ts`
- `calculations.ts`
- `currencyService.ts`
- `payments-repository.ts`
- use-cases de ventas/servicios

**Solucion propuesta:**

```text
src/lib/payments/
  index.ts
  currency.ts
  amounts.ts
  venta-payments.ts
  servicio-payments.ts
  payment-rpc-adapter.ts
```

**Interface esperada:**

- `calculateDiscountedAmount`
- `convertToUSD`
- `sumPaymentsInUSD`
- `createVentaPayment`
- `createServicioPayment`
- `createInitialVentaPayment`
- `createInitialServicioPayment`

**Beneficio:** Los callers no deben saber si la conversion viene de `currencyService`, si el pago usa RPC o si hay snapshot de tasa. La implementacion concentra reglas financieras.

---

### Deepening 2: Modulo de Dashboard Read Models y Pronostico

**Problema:** El pronostico financiero y dashboard viven entre no-ops, RPCs live, sync local y helpers de metricas.

**Solucion propuesta:**

```text
src/lib/dashboard-read-models/
  index.ts
  dashboard-query.ts
  forecast-mappers.ts
  dashboard-invalidation.ts
```

**Regla:** El cliente no muta metricas derivadas. Solo consulta read models e invalida caches. Cualquier materializacion futura debe ocurrir en Postgres o job service-role.

**Beneficio:** Se elimina la interface falsa de `adjustIngresosStats` y se vuelve explicito donde vive el read model.

---

### Deepening 3: Modulo de Notificaciones

**Problema:** Notificaciones combina sync, push, repositorio, store y pass-through use-case.

**Solucion propuesta:**

```text
src/lib/notifications/
  index.ts
  notification-calculator.ts
  venta-notification-sync.ts
  servicio-notification-sync.ts
  reposo-notification-sync.ts
  notification-delivery.ts
  notification-rpc-adapter.ts
```

**Beneficio:** La interface del modulo debe responder preguntas de negocio: sincronizar venta, sincronizar servicio, entregar push, limpiar notificaciones de entidad. El store queda como estado UI.

---

### Deepening 4: Eventos de Dominio y StoreEventBus

**Problema:** Side-effects estan pegados a cada use-case. Agregar un nuevo efecto exige editar multiples flujos.

**Solucion propuesta:**

Separar dos niveles:

- **Domain events:** eventos de negocio despues de comandos (`VENTA_CREATED`, `VENTA_RENEWED`, `SERVICIO_ARCHIVED`).
- **StoreEventBus:** transporte cliente para invalidar stores/queries y sincronizar UI.

```typescript
type VentaDomainEvent =
  | { type: 'VENTA_CREATED'; ventaId: string }
  | { type: 'VENTA_RENEWED'; ventaId: string; pagoId: string }
  | { type: 'VENTA_REFUNDED'; ventaId: string; pagoId: string };
```

**Beneficio:** Los use-cases publican hechos. Los handlers ejecutan side-effects con politica clara y testeable.

---

## HOJA DE RUTA POR FASES

La ejecucion concreta de estas fases esta desglosada en PRs pequenos en `docs/plans/2026-05-22-enterprise-architecture-implementation-plan.md`. Esa guia define archivos a tocar, criterios de aceptacion, validacion y gates antes de descomponer use-cases grandes.

---

### FASE 0: Correcciones factuales y deuda critica urgente (2 semanas)

**Objetivo:** Quitar falsos silenciosos y preparar el terreno para refactors seguros.

**Acciones:**

1. **Corregir tipos duplicados en ventas**
   - Consolidar `VentaPago`.
   - Consolidar `PagoVenta`.
   - Ejecutar `npm run build`.

2. **Auditar RPC type drift**
   - Identificar RPCs usadas por runtime que no estan en `database.types.ts`.
   - Regenerar tipos o crear adapters tipados.
   - Eliminar casts `supabase as unknown as { rpc: ... }` en repositorios criticos.

3. **Eliminar interfaces no-op del dashboard**
   - Sustituir `adjustIngresosStats`, `adjustGastosStats`, `upsertVentaPronostico`, `upsertServicioPronostico` por invalidacion/refetch.
   - Marcar docs legacy de dashboard como superados por RPCs live.

4. **Uniformizar side-effects**
   - Migrar `.catch(console.error)` fire-and-forget a `safeAsyncSideEffect`.
   - Eliminar `catch {}` silenciosos.
   - Documentar politica de side-effects.

5. **Extraer `getLogContext()`**
   - Crear helper compartido.
   - Reemplazar duplicados en 7 stores.

6. **Limpiar parametros muertos**
   - Eliminar `realtime?: boolean` de `useServerPagination` o implementar realtime real.

**Criterio de exito:**

- `npm run lint`, `npm test -- --run`, `npm run build` pasan.
- Cero `catch {}` silenciosos en flujos de negocio.
- Repositorios criticos no usan RPC casts sin contrato.
- Dashboard no expone APIs no-op como si mutaran datos.

---

### FASE 1: Testing y red de seguridad (4 semanas)

**Objetivo:** Subir cobertura desde 36% hacia 60% con foco en riesgo real.

**Acciones:**

1. **Use-cases criticos**
   - `createVentaUseCase` con/sin pago inicial.
   - `renewVentaUseCase` con fallo de sync de metodo de pago.
   - `createVentaRefundUseCase` con saldo insuficiente y corte.
   - `deleteVentaUseCase` con/sin pagos.
   - Equivalentes de servicios.

2. **Formularios principales**
   - Tests de render y submit para `VentasForm`.
   - Tests de validacion y edicion para `VentasEditForm`.
   - Tests de `ServicioForm` para pago inicial/renovacion.

3. **Repositorios y adapters**
   - Tests de payloads RPC.
   - Tests de error mapping.
   - Tests de `assertOnlineMutation`.

4. **Flujos completos con mocks**
   - Crear venta -> renovar -> reembolsar.
   - Crear servicio -> renovar -> archivar.

5. **RPCs con Supabase local**
   - `create_venta_with_initial_payment`.
   - `create_servicio_with_initial_payment`.
   - `create_venta_payment`.
   - `create_venta_refund`.
   - delete/archive con pagos.

**Criterio de exito:**

- Cobertura global >= 60%.
- Branch coverage de use-cases criticos significativamente superior al baseline.
- CI falla si la cobertura baja del umbral acordado.

---

### FASE 2: Descomposicion de use-cases (6 semanas)

**Objetivo:** Reducir el riesgo de ventas/servicios creando modulos por capacidad sin romper imports existentes.

**Acciones:**

1. Crear directorios `src/lib/use-cases/ventas/` y `src/lib/use-cases/servicios/`.
2. Extraer query use-cases primero.
3. Extraer payment/refund use-cases.
4. Extraer write/archive use-cases.
5. Extraer helpers de side-effects.
6. Mantener barrels de compatibilidad.
7. Introducir errores de dominio en flujos criticos.

**Criterio de exito:**

- Ningun archivo de use-case supera 300 lineas, excepto barrels triviales si aplica.
- Tests de Fase 1 siguen pasando.
- Imports publicos se migran gradualmente sin big-bang.
- Errores de dominio cubren validacion, no encontrado, conflicto y saldo insuficiente.

---

### FASE 3: React Query y Event Bus (6 semanas)

**Objetivo:** Eliminar fetching manual y comunicacion ad hoc entre stores.

**Acciones:**

1. Instalar/configurar TanStack Query v5.
2. Crear `queryClient` y `queryKeys` tipadas.
3. Integrar provider en layout cliente.
4. Migrar hooks async uno por uno.
5. Reemplazar `refreshKey` manual por invalidacion de queries.
6. Crear `StoreEventBus` tipado.
7. Migrar `window.dispatchEvent` y `localStorage.setItem` de negocio.
8. Eliminar dynamic imports de stores en stores.

**Criterio de exito:**

- Cero hooks de data fetching con `useState + useEffect` manual.
- Cero eventos DOM/localStorage para comunicacion de negocio.
- Cero dynamic imports de stores desde otros stores.
- Background refetch e invalidacion funcionan en ventas, servicios, notificaciones y dashboard.

---

### FASE 4: Consolidacion enterprise (8 semanas)

**Objetivo:** Crear modulos profundos, estabilizar decisiones arquitecturales y llegar a >=80% de cobertura.

**Acciones:**

1. Implementar modulo de pagos/moneda.
2. Implementar modulo de dashboard read models/pronostico.
3. Dividir modulo de notificaciones.
4. Agregar idempotencia a RPCs criticas de creacion y pagos.
5. Mantener ADRs como contrato vivo de decisiones enterprise.
6. Implementar feature flags si hay rollout gradual.
7. Descomponer formularios y paginas gigantes.

**Criterio de exito:**

- Cobertura global >= 80%.
- RPCs criticas con idempotencia.
- Modulos de pagos, notificaciones y dashboard read models tienen interfaces publicas pequenas y tests.
- Ningun componente/formulario principal supera 300 lineas sin justificacion.
- ADRs registran decisiones enterprise.

---

## MAPA DE ARQUITECTURA OBJETIVO

```text
UI: src/components, src/app
  - componentes por feature
  - formularios seccionados y testeables

UI
  -> React Query hooks
       - lecturas remotas/cacheadas
       - query keys tipadas
       - invalidacion centralizada

  -> Zustand stores
       - estado UI
       - optimistic writes
       - sin ownership de metricas ajenas

React Query hooks / Zustand actions
  -> Use-cases por capacidad
       - ventas/queries
       - ventas/writes
       - ventas/payments
       - servicios/queries
       - servicios/writes
       - servicios/payments
       - DomainErrors y side-effects explicitos

Use-cases
  -> Modulos profundos de dominio
       - payments
       - notifications
       - dashboard-read-models
       - domain-events

Modulos de dominio
  -> Repositories / RPC adapters tipados
       - sin casts unknown para RPCs criticas
       - offline read support
       - mutation guards

Repositories
  -> Supabase / Postgres
       - RPCs atomicas
       - idempotencia
       - RLS
       - views/read models
       - dashboard calculado en SQL/RPC/job, no por mutacion cliente
```

---

## CRITERIOS DE EXITO MEDIBLES

| Criterio | Actual | Objetivo Fase 0 | Objetivo Fase 2 | Objetivo Final |
|---|---:|---:|---:|---:|
| Cobertura statements | 36.32% | >=36% | >=60% | >=80% |
| Cobertura lines | 39.63% | >=39% | >=60% | >=80% |
| Use-case mas grande | 742L | 742L | <=300L | <=300L |
| Componente/pagina mas grande | 1026L | 1026L | 1026L | <=300L en formularios principales |
| Hooks async manuales | 9 | 9 | 9 | 0 |
| Eventos DOM/localStorage de negocio | ~10 | Reducidos | <=3 | 0 |
| Dynamic imports de stores/modulos de cache | 10+ | Reducidos | <=3 | 0 |
| Duplicaciones de `getLogContext` | 7 | 1 | 1 | 1 |
| Archivos >400L | 23 | <=22 | <=12 | <=5 con justificacion |
| Repositorios con RPC casts unknown | 3 | 0 | 0 | 0 |
| ADRs de arquitectura | 5 iniciales | 5 | >=5 | >=8 si aparecen nuevas decisiones |
| RPCs criticas con idempotencia | 0 | 0 | 0 | >=4 |

---

## CHECKLIST DE IMPLEMENTACION

### Fase 0 - Quick Wins

- [x] Consolidar declaraciones duplicadas de `VentaPago` y `PagoVenta`.
- [x] Auditar RPCs usadas por runtime contra `database.types.ts`.
- [x] Regenerar tipos Supabase o crear adapters RPC tipados.
- [x] Eliminar casts `supabase as unknown as { rpc: ... }` en repositorios criticos.
- [x] Reemplazar APIs no-op de dashboard por invalidacion/refetch.
- [x] Marcar docs legacy de dashboard como superados por Supabase live RPCs.
- [x] Extraer `getLogContext()` a helper compartido.
- [x] Reemplazar `.catch(console.error)` fire-and-forget con `safeAsyncSideEffect`.
- [x] Eliminar `catch {}` silenciosos en flujos de negocio.
- [x] Eliminar `realtime?: boolean` de `useServerPagination` si no se implementa realtime.
- [x] Ejecutar `npm run lint`, `npm test -- --run`, `npm run build`.

### Fase 1 - Testing

- [ ] Threshold de cobertura inicial en Vitest.
- [ ] Tests de `createVentaUseCase`.
- [ ] Tests de `renewVentaUseCase`.
- [ ] Tests de `createVentaRefundUseCase`.
- [ ] Tests de `deleteVentaUseCase`.
- [ ] Tests equivalentes para servicios.
- [ ] Tests de payloads RPC en repositorios.
- [ ] Tests de `VentasForm` render/validacion/submit.
- [ ] Tests de `VentasEditForm`.
- [ ] Tests de `ServicioForm`.
- [ ] Flujo crear venta -> renovar -> reembolsar con mocks.
- [ ] Tests de RPCs criticas con Supabase local.
- [ ] Cobertura >=60%.

### Fase 2 - Use-cases

- [x] Crear `src/lib/errors/domain-errors.ts`.
- [x] Crear `src/lib/use-cases/ventas/`.
- [x] Extraer query use-cases de ventas.
- [x] Extraer payment/refund use-cases de ventas.
- [x] Extraer write/archive use-cases de ventas.
- [x] Crear barrel de compatibilidad.
- [x] Repetir estructura para servicios.
- [x] Evaluar pass-through use-cases con deletion test.
- [x] Migrar errores genericos a `DomainError` en flujos criticos.

### Fase 3 - Data Fetching y Events

- [x] Instalar `@tanstack/react-query`.
- [x] Crear `queryClient`.
- [x] Crear `queryKeys`.
- [x] Integrar provider.
- [x] Migrar `usePagosVenta`.
- [x] Migrar `usePagosServicio`.
- [x] Migrar `useVentasPorTerceros`.
- [x] Migrar `useVentasTercero`.
- [x] Migrar hooks async restantes.
- [x] Crear `StoreEventBus`.
- [x] Migrar eventos de ventas/servicios/categorias/terceros.
- [x] Eliminar dynamic imports de stores.
- [x] Integrar invalidacion de React Query con mutaciones.

### Fase 4 - Enterprise Consolidation

- [ ] Crear modulo `src/lib/payments/`.
- [ ] Crear modulo `src/lib/dashboard-read-models/`.
- [ ] Crear modulo `src/lib/notifications/`.
- [ ] Agregar idempotencia a RPCs criticas.
- [x] Crear `docs/adr/` con ADRs iniciales.
- [x] ADR: dashboard read models.
- [x] ADR: React Query vs Zustand.
- [x] ADR: RPCs atomicas e idempotencia.
- [x] ADR: StoreEventBus.
- [ ] Agregar ADRs nuevos solo cuando una decision cambie contratos relevantes.
- [ ] Implementar feature flags si se requiere rollout gradual.
- [ ] Descomponer `VentasForm`.
- [ ] Descomponer `VentasEditForm`.
- [ ] Descomponer `ServicioForm` y paginas de detalle grandes.
- [ ] Cobertura >=80%.

---

## DEPENDENCIAS ENTRE FASES

```text
Fase 0 (2 sem)
  -> Fase 1 (4 sem)
    -> Fase 2 (6 sem)
      -> Fase 3 (6 sem)
        -> Fase 4 (8 sem)

Estimado secuencial: 26 semanas con un desarrollador.
```

Paralelizacion posible despues de Fase 1:

```text
Fase 0 -> Fase 1 -> Fase 2 (use-cases)
                  -> Fase 3 (React Query/EventBus, en paralelo parcial)
                  -> Fase 4
```

La restriccion fuerte es que Fase 2 no debe iniciar sobre ventas/servicios sin tests de Fase 1 para los flujos que se van a tocar.

---

## NOTAS DE IMPLEMENTACION PARA EL EQUIPO

### Documentos de arranque

- `docs/adr/0001-dashboard-read-models-postgres.md`
- `docs/adr/0002-react-query-zustand-ownership.md`
- `docs/adr/0003-typed-rpc-adapters-and-idempotency.md`
- `docs/adr/0004-typed-client-events.md`
- `docs/adr/0005-modular-monolith-deep-modules.md`
- `docs/plans/2026-05-22-enterprise-architecture-implementation-plan.md`

### Lo que no debe cambiar sin ADR

- Supabase/Postgres sigue siendo fuente de verdad.
- RPCs atomicas siguen siendo el mecanismo para operaciones criticas.
- Repositorios deben seguir siendo adapters, no lugar de reglas de negocio.
- Dashboard/read models derivados no deben mutarse desde cliente como si fueran fuente de verdad.
- Activity log debe conservar `detectarCambios + metadata`.
- Offline read support y online mutation guard deben mantenerse separados.

### Principios de migracion segura

1. Refactor con tests primero en el flujo afectado.
2. Mantener barrels para compatibilidad temporal.
3. Migrar imports por feature, no en big-bang.
4. Cada PR de arquitectura debe mantener o subir cobertura.
5. Cualquier nuevo modulo debe tener interface pequena, tests por contrato y ownership claro.
6. Cualquier decision que cambie una regla del roadmap debe registrarse como ADR.

### Convenciones a documentar al completar fases

- Side-effects fire-and-forget usan `safeAsyncSideEffect`.
- Errores de negocio extienden `DomainError`.
- Lecturas remotas usan React Query salvo excepcion documentada.
- Comunicacion cliente entre modulos usa `StoreEventBus`.
- RPCs criticas tienen contratos tipados e idempotencia cuando crean registros.
- Dashboard se lee desde read models SQL/RPC; el cliente invalida/refetchea.
- Formularios principales deben estar divididos por secciones testeables.

---

*Documento actualizado tras verificacion del repositorio - Mayo 2026*  
*Proxima revision recomendada: al completar Fase 0 o antes de iniciar Fase 2*
