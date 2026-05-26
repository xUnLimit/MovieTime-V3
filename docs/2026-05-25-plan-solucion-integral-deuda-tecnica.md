# Plan integral para eliminar deuda tecnica residual

**Fecha:** 2026-05-25  
**Proyecto:** MovieTime PTY / MovieTime-Supabase  
**Tipo:** plan de refactor estructural, no parche puntual  
**Base:** cierre de Fases 0-7 en `docs/2026-05-25-auditoria-arquitectura-actual-improve-codebase.md` y deuda residual aceptada en `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`.

## Objetivo

Eliminar la deuda tecnica residual de forma estructural, dejando el proyecto con Modules profundos, contratos tipados, baja duplicacion de cache, menos casts genericos y cobertura suficientemente alta para refactors futuros.

Este plan no busca "tocar donde aparece un warning". Busca cambiar las Interfaces que obligan a UI, stores o use-cases a conocer detalles fisicos, genericos o legacy.

## Principios de solucion

1. React Query es la fuente de lecturas remotas.
2. Zustand queda solo para estado UI, seleccion, filtros, dialogs, colas y optimismo estrictamente local.
3. Los use-cases no importan stores.
4. UI no importa repositorios Supabase.
5. Los payloads fisicos viven en Adapters, no en pantallas ni workflows.
6. `Record<string, unknown>` solo existe en fronteras genericas deliberadas o desaparece.
7. Cada refactor debe cerrar una Interface shallow, no solo mover codigo.
8. Cada fase debe pasar lint, tests, coverage, build y las validaciones que apliquen.

## Estado actual resumido

El sistema esta estable:

- Seguridad push/RPC/RLS cerrada.
- Idempotencia por usuario validada.
- Workflows de detalle Venta/Servicio profundizados.
- Payments profundizado con `financialPayments`.
- Notificaciones/Reposo separan dominio de UI/browser/cache.
- Coverage corre con thresholds progresivos.
- Validaciones completas pasan.

La deuda pendiente real esta en cinco frentes:

1. Stores Zustand de dominio como frontera legacy.
2. Adapters faltantes para Terceros y lectura legacy de Venta.
3. `Record<string, unknown>` en render generico, charts y metadata.
4. `eslint-disable` puntuales en hooks React.
5. Coverage global bajo por UI/stores legacy.

## Arquitectura objetivo

```txt
UI / Pages / Components
  -> View controllers por feature
  -> React Query hooks para lecturas remotas
  -> UI stores Zustand pequenos para filtros/dialogs/seleccion
  -> Use-cases de dominio para workflows
  -> Domain Adapters
  -> Supabase RPC/read/write Adapters
  -> Postgres/RLS/RPC/triggers
```

### Lo que debe desaparecer

- Stores con `fetch*` remoto general.
- Stores que sean cache principal de entidades.
- UI importando repositories Supabase.
- Use-cases importando Zustand.
- Pantallas construyendo payloads fisicos.
- Casts estructurales en UI/use-cases salvo excepcion documentada.
- Tests de comportamiento de dominio que dependan de DOM cuando no hace falta.

### Lo que debe quedar

- React Query hooks por dominio:
  - `useVentas`
  - `useVentaDetalle`
  - `useServicios`
  - `useServicioDetalle`
  - `useTerceros`
  - `useCategorias`
  - `useMetodosPago`
  - `useGastos`
  - `useTemplates`
  - `useNotificaciones`
- Stores UI pequenos:
  - filtros activos;
  - pagina actual si no vive en URL;
  - dialogs abiertos;
  - seleccion temporal;
  - colas UI como WhatsApp toast.
- Adapters profundos por dominio:
  - `ventas-read-adapter`
  - `ventas-write-adapter`
  - `terceros-read-adapter`
  - `terceros-write-adapter`
  - table/chart adapters tipados.

## Fase A: ADR de migracion final de stores

### Objetivo

Registrar la decision de terminar la migracion de stores legacy a React Query + UI stores.

### Acciones

1. Crear ADR nueva: `docs/adr/0007-react-query-final-store-migration.md`.
2. Definir que Zustand no puede ser cache remota general.
3. Definir excepciones permitidas:
   - UI local;
   - optimismo temporal;
   - colas visuales;
   - compatibility adapter mientras se migra un slice.
4. Definir criterio de salida por store:
   - no `fetch*` remoto;
   - no repositorios Supabase;
   - no activity log;
   - no counts remotos;
   - tests de hooks/use-cases cubren comportamiento movido.

### Validaciones

```bash
rg -n "from ['\"]@/lib/supabase" src/store
rg -n "fetch[A-Z]|count|query|repository|supabase" src/store
npm run lint
npm test -- --run
```

### Criterio de cierre

ADR aceptada y checklist de migracion por store agregado al backlog.

## Fase B: eliminar stores de dominio como cache remota

### Objetivo

Convertir stores legacy en UI stores pequenos o eliminarlos.

### Orden recomendado

1. `notificacionesStore`
2. `categoriasStore`
3. `metodosPagoStore`
4. `gastosStore`
5. `tiposGastoStore`
6. `templatesStore`
7. `tercerosStore`
8. `serviciosStore`
9. `ventasStore`

El orden empieza por stores menos acoplados y termina con los mas sensibles.

### Estrategia por store

Para cada store:

1. Inventariar callers.
2. Separar estado UI de datos remotos.
3. Crear o completar hooks React Query.
4. Mover mutaciones a use-cases existentes o nuevos.
5. Mover invalidaciones a `src/lib/store-reactions`.
6. Reemplazar callers gradualmente.
7. Borrar acciones remotas del store.
8. Reducir tests del store a UI state.
9. Agregar tests de hooks/use-cases.

### Ejemplo de destino

Antes:

```txt
useVentasStore
  - ventas
  - loading
  - fetchVentas
  - deleteVenta
  - updateVenta
  - counts
```

Despues:

```txt
useVentas()
useVentaCounts()
deleteVentaWorkflow()
useVentasUiStore()
  - selectedVentaId
  - filters
  - dialog state
```

### Validaciones

```bash
rg -n "from ['\"]@/lib/supabase" src/store
rg -n "from ['\"]@/store" src/lib/use-cases
rg -n "use[A-Z].*Store" src/app src/components src/hooks
npm run lint
npm test -- --run
npm run test:coverage
npm run build
```

### Criterio de cierre

- Ningun store de dominio importa repositorios Supabase.
- Ningun use-case importa stores.
- Lecturas remotas principales vienen de React Query.
- Stores restantes tienen nombres UI explicitos o documentacion clara.

## Fase C: Adapters dedicados para Terceros y Venta legacy

### Objetivo

Eliminar las excepciones `getTerceroSqlPayload` y `ventaBaseFromRecord` como conocimiento fisico en use-cases.

### Nuevos Modules

```txt
src/lib/terceros/terceros-write-adapter.ts
src/lib/terceros/terceros-read-adapter.ts
src/lib/ventas/ventas-read-adapter.ts
```

### Terceros Write Adapter

Interface objetivo:

```ts
type TercerosWriteAdapter = {
  create(input: CreateTerceroInput): Promise<Tercero>;
  update(id: string, updates: UpdateTerceroInput): Promise<Tercero>;
  remove(id: string): Promise<void>;
  updateMetodoPago(id: string, metodoPagoId: string | null): Promise<void>;
};
```

El Adapter conoce:

- nombres fisicos;
- payload SQL/Supabase;
- normalizacion de metodo de pago pendiente;
- defaults fisicos.

Los use-cases conocen:

- `Tercero`;
- `CreateTerceroInput`;
- `UpdateTerceroInput`;
- outcomes de dominio.

### Ventas Read Adapter

Interface objetivo:

```ts
type VentasReadAdapter = {
  getDetalle(id: string): Promise<VentaDoc | null>;
  getConPagoActual(id: string): Promise<VentaDoc | null>;
  listByServicio(servicioId: string): Promise<VentaDoc[]>;
};
```

El Adapter absorbe:

- `Record<string, unknown>`;
- mapeo de fechas;
- defaults de cliente/servicio;
- compatibilidad con records historicos.

### Validaciones

```bash
rg -n "getTerceroSqlPayload|ventaBaseFromRecord|Record<string, unknown>" src/lib/use-cases
npm test -- --run src/lib/use-cases/terceros-use-cases.test.ts src/lib/use-cases/ventas-query-use-cases.test.ts
npm run lint
npm run build
```

### Criterio de cierre

- Use-cases no construyen payload fisico de Tercero.
- Use-cases no reciben `Record<string, unknown>` para Venta.
- Tests de Adapter cubren success, null/not found, fechas y defaults.

## Fase D: Table y chart adapters tipados

### Objetivo

Eliminar `Record<string, unknown>` en tablas/charts de UI sin romper `DataTable`.

### Problema real

`DataTable` y algunos row types usan `Record<string, unknown>` para soportar sorting/render generico. Eso es util, pero actualmente la genericidad se filtra a features.

### Solucion

Crear adapters por feature que entreguen rows cerradas:

```txt
src/components/ventas/ventas-table-adapter.ts
src/components/servicios/servicios-table-adapter.ts
src/components/terceros/terceros-table-adapter.ts
src/components/dashboard/dashboard-chart-adapters.ts
```

Cada adapter:

- recibe dominio;
- devuelve row tipada;
- define accessors ordenables;
- oculta `Record<string, unknown>` si aun lo necesita internamente.

### Posible cambio en DataTable

Cambiar columnas de:

```ts
key: string
```

a:

```ts
accessor: (row: T) => SortValue
```

Esto elimina la necesidad de indexar por string arbitrario.

### Validaciones

```bash
rg -n "extends Record<string, unknown>|as Record<string, unknown>|Array<Record<string, unknown>>" src/components
npm test -- --run src/components
npm run lint
npm run build
```

### Criterio de cierre

- `Record<string, unknown>` desaparece de callers de tablas/charts.
- Si queda dentro de `DataTable`, queda documentado como core generico.
- Sorting, pagination y render se conservan.

## Fase E: eliminar `eslint-disable` en hooks React

### Objetivo

Quitar suppressions de hooks mediante refactors reales de efectos.

### Archivos actuales

- `src/components/layout/Sidebar.tsx`
- `src/components/servicios/form/useServicioFormController.ts`
- `src/components/shared/pago-dialog/usePagoDialogController.ts`
- `src/app/(dashboard)/servicios/detalle/[id]/components/useServicioProfiles.ts`

### Estrategia

1. Clasificar cada suppression:
   - dependencia estable faltante;
   - efecto que deberia ser event handler;
   - derivacion que deberia ser `useMemo`;
   - reset de estado que deberia vivir en reducer;
   - comportamiento de paginacion/clamp.
2. Extraer reducers donde haya secuencias de estado relacionadas.
3. Usar callbacks estables solo cuando el efecto realmente dependa de ellos.
4. Agregar tests de comportamiento antes de quitar cada suppression.

### Validaciones

```bash
rg -n "eslint-disable" src
npm run lint
npm test -- --run
npm run build
```

### Criterio de cierre

- Cero `eslint-disable` en `src`.
- Comportamiento visual preservado por tests donde aplique.

## Fase F: subir coverage a nivel sostenible

### Objetivo

Pasar de thresholds de no-regresion a thresholds de confianza.

### Thresholds objetivo

Global:

- statements: 65
- branches: 55
- functions: 60
- lines: 65

Modules criticos:

- payments: 90/75/90/90
- dashboard-read-models: 90/75/100/90
- notifications: 70/60/65/70
- PWA: 70/55/70/70
- executive-push: 75/60/75/75
- RPC adapters: 85/70/85/85
- use-cases de ventas/servicios/notificaciones: 75/60/75/75

### Orden de tests

1. Stores que queden como UI stores.
2. Adapters de Terceros/Venta.
3. DataTable/table adapters.
4. Hooks de forms con reducers.
5. PWA offline facade/read paths.
6. Executive push edge cases.

### Validaciones

```bash
npm run test:coverage
npm run lint
npm run build
```

### Criterio de cierre

- Thresholds objetivo activos.
- Coverage pasa en local y CI.
- Tests nuevos cubren contratos, no detalles fragiles.

## Fase G: decidir ADRs de producto, no tocarlas por accidente

### Objetivo

Separar deuda tecnica real de decisiones de producto/arquitectura que requieren ADR.

### ADRs o revisiones necesarias

1. Multiusuario / multi-tenant RLS.
2. `force-dynamic` y estrategia de rendering/cache.
3. Offline mutations.
4. Metricas fuera de Postgres.
5. Eliminacion total de Zustand.

### Regla

Nada de esto se cambia dentro del refactor de deuda tecnica. Si se decide cambiar, se abre ADR y fase propia.

## Plan de ejecucion recomendado

### Sprint 1: ADR y stores chicos

- Crear ADR-0007.
- Migrar `templatesStore`, `tiposGastoStore`, `gastosStore`.
- Agregar hooks React Query faltantes.
- Validar coverage.

### Sprint 2: catalogos y notificaciones

- Migrar `categoriasStore`, `metodosPagoStore`, `notificacionesStore`.
- Consolidar query reactions.
- Quitar store cache remota de Notificaciones.

### Sprint 3: Terceros

- Crear Terceros read/write adapters.
- Migrar `tercerosStore` a UI-only.
- Eliminar `getTerceroSqlPayload` de use-cases.

### Sprint 4: Servicios

- Migrar `serviciosStore` a UI-only.
- Asegurar hooks de detalle/lista/pagos.
- Cubrir workflows con tests de contrato.

### Sprint 5: Ventas

- Crear Ventas read adapter.
- Migrar `ventasStore` a UI-only.
- Eliminar `ventaBaseFromRecord` de use-cases.

### Sprint 6: UI generica y suppressions

- Refactor de DataTable/accessors.
- Table adapters por dominio.
- Chart adapters dashboard.
- Quitar `eslint-disable`.

### Sprint 7: coverage objetivo y cierre

- Subir thresholds.
- Correr validacion completa.
- Actualizar backlog y docs.

## Compuerta obligatoria por sprint

Cada sprint debe cerrar con:

```bash
npm run lint
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate
npm run secrets:scan
```

Si se toca Supabase, RPC, RLS, service role o migraciones:

```bash
npm run migrate:validate
```

es obligatorio antes de cerrar.

## Busquedas de no-regresion

```bash
rg -n "from ['\"]@/store" src/lib/use-cases
rg -n "from ['\"]@/lib/supabase" src/app src/components
rg -n "from ['\"]@/lib/supabase" src/store
rg -n "as unknown|as never|Record<string, unknown>" src/app src/components src/hooks src/store src/lib/use-cases
rg -n "eslint-disable|@ts-ignore|@ts-expect-error" src
rg -n "\\.rpc\\(" src
rg -n "createServiceRoleClient" src
```

Resultados esperados al final:

- Cero imports de stores desde use-cases.
- Cero imports Supabase desde UI.
- Cero imports Supabase desde stores.
- Cero `eslint-disable`.
- `.rpc()` solo en `src/lib/supabase/*-rpc-adapter.ts`.
- `createServiceRoleClient` solo en Modules server-side protegidos por admin/cron y tests.
- `Record<string, unknown>` solo en core generico documentado o eliminado.

## Criterio de cierre final

El plan se considera terminado cuando:

1. Stores de dominio son UI-only o fueron eliminados.
2. React Query cubre lecturas remotas.
3. Terceros y Venta legacy tienen Adapters dedicados.
4. UI no conoce repositorios Supabase ni payloads fisicos.
5. Use-cases no conocen stores.
6. Casts estructurales quedan confinados a Adapters/core generico.
7. No hay `eslint-disable` en `src`.
8. Coverage global alcanza thresholds objetivo.
9. Validacion completa pasa.
10. Backlog residual solo contiene decisiones protegidas por ADR.

## Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Migrar stores grandes rompe flujos existentes. | Migrar por store, con adapters de compatibilidad temporales y tests antes/despues. |
| Duplicar invalidaciones entre React Query y stores. | Un solo Module de reactions por dominio. |
| Subir coverage con tests fragiles. | Testear Interfaces y outcomes, no detalles internos. |
| DataTable refactor rompe sorting/pagination. | Mantener tests de tabla y migrar feature por feature. |
| Cambiar decisiones protegidas sin ADR. | Bloquear multiusuario/offline/force-dynamic/Zustand-total hasta ADR. |

## Resultado esperado

Despues de este plan, el codigo debe sentirse asi:

- agregar una mutacion toca un use-case y una reaction, no cinco pantallas;
- cambiar una tabla no obliga a castear rows;
- cambiar Supabase no filtra shapes fisicos a UI;
- stores ya no son caches paralelas;
- coverage protege Modules criticos y contratos de usuario;
- la deuda restante, si existe, es de producto/ADR y no de arquitectura accidental.
