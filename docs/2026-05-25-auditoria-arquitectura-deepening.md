# Auditoría Arquitectural — Deepening Opportunities

**Fecha:** 2026-05-25
**Modelo:** Modular Monolith con Módulos Profundos (ADR-0005)
**Estado base:** 243 tests passing, 0 lint errors
**Skill:** `/improve-codebase-architecture`

> Esta auditoría busca **deepening opportunities**: lugares donde la Interface de un Module es casi tan compleja como su Implementation (shallow), donde existen pass-throughs, o donde Modules acoplados filtran a través de sus Seams. Vocabulario arquitectural: `Module`, `Interface`, `Seam`, `Adapter`, `Leverage`, `Locality`, `Deep`/`Shallow`. Vocabulario de dominio: `Tercero`, `Servicio`, `Venta`, `Pago`, `Notificacion`, `Categoria` (ver [CONTEXT.md](../CONTEXT.md)).

---

## Resumen ejecutivo

| Área | Severidad | Tipo de fricción |
|------|-----------|------------------|
| Stores Zustand con imports de repositorios | **Crítica** | Violación ADR-0007 |
| Componentes llamando repos directamente | **Alta** | Bypass de use-cases |
| Use-cases pass-through (shallow) | **Media** | Sin Leverage |
| `domain-read-adapters` mezcla shims y adapters reales | **Media** | Seam ambiguo |
| Archivos `>300` líneas en producción | **Baja-Media** | Cohesión vs umbral CLAUDE.md |

Hallazgos agrupados por área. **No se proponen Interfaces todavía** — el usuario debe elegir candidatos antes del grilling loop.

---

## 1. CRÍTICO — Violaciones ADR-0007: stores Zustand importan repositorios

### Files

- [src/store/activityLogStore.ts](../src/store/activityLogStore.ts) (87 líneas)
- [src/store/configStore.ts](../src/store/configStore.ts) (164 líneas)

### Problem

Ambos stores importan y llaman repositorios directamente:

- `activityLogStore` → `createActivityLog`, `getActivityLogs`, `removeActivityLog` desde `activity-log-repository`.
- `configStore` → `getConfig`, `updateNotificationLeadDays` desde `config-repository`.

ADR-0007 §22 dice explícitamente: *"Los stores no deben importar repositorios Supabase."*

La Interface de estos stores expone `fetchLogs()` / `fetchConfig()` que orquestan IO remoto. El caller necesita saber a la vez:

1. cómo invalidar React Query,
2. cómo invocar la acción del store,
3. cuándo confiar en el snapshot local del store vs. la caché de React Query.

### Deletion test

Si se eliminan `fetchLogs`/`fetchConfig` y se reemplazan por hooks React Query (`useActivityLogs`, `useConfig`), la complejidad **se concentra** en un solo lugar (la query) en vez de dispersarse entre store + caller. **Es shallow**, no deep.

### Severidad: **Critical**

---

## 2. ALTA — Componentes/hooks llamando repos directamente (bypass de use-cases)

### Files

- [src/components/servicios/form/useServicioFormSubmit.ts](../src/components/servicios/form/useServicioFormSubmit.ts) (184 líneas, línea ~139)
- [src/app/(dashboard)/reposo/reposo-helpers.ts](../src/app/(dashboard)/reposo/reposo-helpers.ts)

### Problem

`useServicioFormSubmit.ts` llama `queryVentas()` directamente para detectar cambios de credenciales y decidir si encolar mensajes de WhatsApp. Esta es una **decisión de dominio** (¿qué cambios de credenciales disparan notificación a qué Ventas activas?) escondida en un hook de formulario.

La regla se reparte en tres lugares:

1. **decisión** en `useServicioFormSubmit` (component hook),
2. **construcción de mensaje** en `servicio-form-helpers.ts`,
3. **encolado** vía store dependency injection.

`reposo-helpers.ts` hace algo análogo con `queryServicios()`.

### Locality impact

Alto. Si la política cambia (ej. *"no notificar si la Venta está suspendida"*), hay que tocar 3 archivos. La regla no pertenece al `Servicio` form module — pertenece a un use-case de `Servicio + Notificacion`.

### Severidad: **High**

---

## 3. MEDIA — Use-cases pass-through (Modules shallow)

### Files

- [src/lib/use-cases/activity-log-use-cases.ts](../src/lib/use-cases/activity-log-use-cases.ts) (18 líneas)
- [src/lib/use-cases/templates-use-cases.ts](../src/lib/use-cases/templates-use-cases.ts) (26 líneas)
- [src/lib/use-cases/metodos-pago-use-cases.ts](../src/lib/use-cases/metodos-pago-use-cases.ts) (38 líneas — varios getters shallow)
- [src/lib/use-cases/catalogos-use-cases.ts](../src/lib/use-cases/catalogos-use-cases.ts) (9 líneas)

### Problem

Ejemplo arquetípico:

```ts
// activity-log-use-cases.ts
export async function deleteActivityLogsUseCase(ids: string[]) {
  await Promise.all(ids.map((id) => removeActivityLog(id)));
}
```

No hay:

- política de retención,
- validación de quién puede borrar,
- activity log de la propia eliminación,
- invalidación de caché.

ADR-0005 dice que los use-cases deben **owner**: *"business orchestration, activity logs, side-effects policy, and cache invalidation."* Estos archivos no cumplen ese contrato.

### Deletion test

Eliminar `deleteActivityLogsUseCase` y dejar al caller llamar `removeActivityLog` directamente no concentra complejidad — sólo la mueve un nivel. Eso confirma que **no es deep**.

### Severidad: **Medium**

---

## 4. MEDIA — `domain-read-adapters` mezcla naming shims con adapters reales

### Files

- [src/lib/supabase/domain-read-adapters.ts](../src/lib/supabase/domain-read-adapters.ts) (94 líneas)

### Problem

El archivo contiene dos tipos de funciones mezcladas:

**Naming shims (pass-through puro):**

- `queryNotificationsRead(filters)` → `queryNotifications(filters)`
- `getMetodoPagoRead(id)` → `getMetodoPagoById(id)`
- `queryMetodosPagoRead(filters)` → `queryMetodosPago(filters)`
- `getCategoriaRead(id)` → `getCategoriaById(id)`
- `getServicioRead(id)` → `getServicioById(id)`

**Adapter real (con transformación):**

- `getVentaDetalleRead(id)` — reconstruye un `VentaDoc` desde filas Supabase.

### Friction

Hay **tres caminos paralelos** para leer datos:

1. `domain-read-adapters` (a veces),
2. repos directos (otras veces),
3. hooks React Query (otras veces).

Evidencia concreta:

- `src/lib/use-cases/servicios/servicio-detail-use-cases.ts` importa **ambos**: `getServicioRead` (adapter) y `queryVentas` (repo).
- `useServicioFormSubmit.ts` usa `queryVentas` directo.

Cuando alguien cambia el shape de `Servicio`, no es obvio cuál camino actualizar.

### Severidad: **Medium** (Seam ambiguo, alto impacto en navegabilidad por IA y humanos)

---

## 5. BAJA-MEDIA — Archivos `>300` líneas en producción (CLAUDE.md threshold)

### Use-cases

- [src/lib/use-cases/servicios/servicio-detail-use-cases.ts](../src/lib/use-cases/servicios/servicio-detail-use-cases.ts) — **319 líneas**
- [src/lib/use-cases/ventas/venta-detail-use-cases.ts](../src/lib/use-cases/ventas/venta-detail-use-cases.ts) — **313 líneas**

Estos sí son **cohesivos** (orquestan flujos de la página de detalle: delete, transfer, cut, payment, renewal). El riesgo no es el tamaño actual sino que se vuelvan "demasiado fáciles de seguir engordando".

### Components (cerca del umbral, ninguno lo supera actualmente)

- [src/app/(dashboard)/servicios/detalle/[id]/ServicioDetalleClient.tsx](../src/app/(dashboard)/servicios/detalle/[id]/ServicioDetalleClient.tsx) — 275
- [src/components/layout/Sidebar.tsx](../src/components/layout/Sidebar.tsx) — 279
- [src/app/(dashboard)/servicios/detalle/[id]/components/ServicioTransferVentaDialog.tsx](../src/app/(dashboard)/servicios/detalle/[id]/components/ServicioTransferVentaDialog.tsx) — 283
- [src/components/terceros/useTerceroFormController.ts](../src/components/terceros/useTerceroFormController.ts) — 275
- [src/components/ventas/form/create/venta-create-controller-helpers.ts](../src/components/ventas/form/create/venta-create-controller-helpers.ts) — 266

### Severidad: **Low-Medium** (no bloqueante — vigilancia activa, todos entre 250-285 líneas)

---

## Top 7 Deepening Opportunities (priorizado)

| # | Oportunidad | Severidad | Beneficio principal |
|---|-------------|-----------|---------------------|
| 1 | Migrar `activityLogStore` + `configStore` a React Query (ADR-0007) | Critical | Locality + cumplir ADR |
| 2 | Extraer workflow de cambio de credenciales de `useServicioFormSubmit` a un use-case `Servicio + Notificacion` | High | Una sola política de notificación |
| 3 | Unificar caminos de lectura: deprecar shims de `domain-read-adapters` o profundizarlos | Medium | Un Seam claro para reads |
| 4 | Profundizar use-cases pass-through (`metodos-pago`, `templates`, `activity-log`) con reglas reales (validación, retención, audit) | Medium | Leverage + Locality |
| 5 | Mover `queryServicios()` de `reposo-helpers.ts` a un use-case de `Reposo` | High | Eliminar repo-call en helpers de página |
| 6 | Documentar criterio de split para `servicio-detail-use-cases.ts` y `venta-detail-use-cases.ts` (cuándo extraer) | Low-Medium | Evitar drift futuro |
| 7 | Auditar `useServicioFormSubmit.ts` (184 líneas) para detectar si su Interface oculta una transacción de dominio que merece su propio Module | Medium | Posible nuevo Module profundo |

---

## Tests y validación

- **243 tests** pasan, **0 lint errors**.
- Antes de tocar nada se recomienda añadir tests de contrato a:
  1. `useServicioFormSubmit` con cambio de credenciales (hoy sólo a nivel componente).
  2. `activityLogStore` / `configStore` (para verificar que post-migración el contrato React Query es equivalente).
  3. Pass-throughs que vayan a profundizarse (`metodos-pago`, `templates`).

Comandos validadores (CLAUDE.md):

```bash
npm run lint
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate
```

---

## Próximos pasos

Esta auditoría **no propone Interfaces** todavía. El siguiente paso del skill `/improve-codebase-architecture` es elegir uno o varios candidatos y entrar al **grilling loop** para:

1. Mapear constraints y dependencias.
2. Dibujar la forma del Module profundo.
3. Decidir qué queda detrás del Seam.
4. Confirmar qué tests sobreviven y cuáles se simplifican.

**¿Qué oportunidad querés explorar primero?** Recomendado: **#1** (crítica, alineada con ADR-0007 ya aceptada) o **#2** (alto Leverage, sin tocar ADRs vigentes).
