# RPC Type Drift Audit - 2026-05-22

## Resumen

El runtime usa RPCs Supabase desde tres rutas principales:

- llamadas directas tipadas por `database.types.ts`;
- llamadas mediante el helper generico `rpc()` en `src/lib/supabase/queries.ts`;
- llamadas mediante `rpcClient = supabase as unknown as { rpc(...) }` en repositories criticos.

El drift real esta concentrado en `ventas-repository.ts`, `servicios-repository.ts` y `payments-repository.ts`: esas rutas castear Supabase a `unknown` porque varias RPCs operativas existen en migraciones SQL pero no aparecen en `src/lib/supabase/database.types.ts`.

## RPCs Runtime

| RPC | Runtime caller | En `database.types.ts` | Estado | Accion |
|---|---|---:|---|---|
| `get_dashboard_stats_live` | `src/lib/dashboard-read-models` | Si | Typed | Mantener llamada directa. |
| `get_dashboard_churn_stats` | `src/lib/dashboard-read-models` | Si | Typed | Mantener llamada directa. |
| `get_dashboard_home` | `src/lib/dashboard-read-models` | Si | Typed | Mantener llamada directa. |
| `get_categorias_full` | `categorias-repository.ts` | Si | Typed | Mantener llamada directa. |
| `get_categorias_counts` | `categorias-repository.ts` | Si | Typed | Mantener llamada directa. |
| `delete_categoria` | `categorias-repository.ts` | Si | Typed | Mantener llamada directa. |
| `delete_venta_with_payments` | `ventas-repository.ts` | Si | Casted | Mover a adapter tipado y eliminar cast local. |
| `create_venta_refund` | `ventas-repository.ts` | Si | Casted | Mover a adapter tipado y eliminar cast local. |
| `delete_servicio_with_payments` | `servicios-repository.ts` | Si | Casted | Mover a adapter tipado y eliminar cast local. |
| `delete_venta_payment_and_empty_period` | `ventas-repository.ts` | Si | Casted | Mover a adapter tipado y eliminar cast local. |
| `delete_servicio_payment_and_empty_period` | `servicios-repository.ts` | Si | Casted | Mover a adapter tipado y eliminar cast local. |
| `create_venta_with_initial_payment` | `ventas-repository.ts` | No | Missing generated type | PR 6: crear adapter manual tipado primero; luego regenerar types si el remoto contiene la firma correcta. |
| `create_servicio_with_initial_payment` | `servicios-repository.ts` | No | Missing generated type | Crear adapter manual tipado despues de ventas iniciales. |
| `create_venta_payment` | `payments-repository.ts` | No | Missing generated type | Crear adapter manual tipado para renovaciones de venta. |
| `create_servicio_payment` | `payments-repository.ts` | No | Missing generated type | Crear adapter manual tipado para pagos de servicio. |
| `update_venta_payment_and_period` | `ventas-repository.ts` | No | Missing generated type | Crear adapter manual tipado antes de descomponer payment use-cases. |
| `update_servicio_payment_and_period` | `servicios-repository.ts` | No | Missing generated type | Crear adapter manual tipado antes de descomponer payment use-cases. |

## Evidencia

- `src/lib/supabase/ventas-repository.ts`, `src/lib/supabase/servicios-repository.ts` y `src/lib/supabase/payments-repository.ts` declaran `rpcClient = supabase as unknown as { rpc(...) }`.
- Las RPCs faltantes en generated types existen en migraciones:
  - `20260505200500_atomic_initial_sales_services.sql`
  - `20260505203000_atomic_payment_operations.sql`
  - `20260511000100_fix_plan_snapshot_in_create_venta_with_initial_payment.sql`
- `database.types.ts` si contiene varias RPCs relacionadas, pero no las de creacion/renovacion listadas como missing.

## Decision Para PR 6

No regenerar tipos como primer paso. Primero crear un adapter tipado para `create_venta_with_initial_payment`, porque:

- es una vertical slice critica;
- reduce el cast `unknown` sin depender del estado del remoto;
- permite testear payload, respuesta y error mapping antes de repetir el patron;
- deja una interface estable para agregar `idempotency_key` despues.

## Orden Recomendado De Adapters

1. `create_venta_with_initial_payment`
2. `create_venta_refund`
3. `create_venta_payment`
4. `update_venta_payment_and_period`
5. `delete_venta_with_payments` y `delete_venta_payment_and_empty_period`
6. Repetir el patron para servicios.

## Validacion Usada

```bash
rg -n "\\.rpc\\(|rpcClient\\.rpc|supabase\\.rpc" src -g "*.ts" -g "*.tsx"
rg -n "create_venta_with_initial_payment|create_venta_payment|create_servicio_with_initial_payment|create_servicio_payment|update_venta_payment_and_period|update_servicio_payment_and_period" src/lib/supabase/database.types.ts
rg -n "rpcClient" src/lib/supabase
```
