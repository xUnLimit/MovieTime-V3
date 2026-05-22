# ADR-0003: RPCs Criticas Con Adapters Tipados e Idempotencia

**Status:** Accepted  
**Date:** 2026-05-22

## Context

Las operaciones criticas del dominio usan RPCs de Supabase/Postgres. Esto es correcto para atomicidad, pero algunos repositorios actualmente llaman RPCs mediante casts manuales como:

```typescript
const rpcClient = supabase as unknown as {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult>;
};
```

Ese patron evita errores de TypeScript, pero tambien elimina type safety en ventas, servicios, pagos y refunds. Ademas, las RPCs de creacion no tienen idempotency key; un retry despues de una respuesta perdida puede duplicar registros.

## Decision

Las RPCs criticas deben tener adapters tipados. Cada adapter debe definir:

- nombre de RPC;
- payload TypeScript;
- resultado esperado;
- conversion de fechas/monedas;
- validacion de respuesta;
- mapping de errores.

Las RPCs que crean registros o pagos deben recibir idempotency key de forma progresiva. La idempotencia se implementara en Postgres y se propagara desde el cliente.

## Consequences

- Los casts `unknown` en repositorios criticos deben desaparecer.
- `database.types.ts` debe regenerarse cuando cambien firmas de RPC.
- Si Supabase generated types no cubren una firma, el adapter manual sera la interface publica, no `Record<string, unknown>`.
- La idempotencia requiere migraciones SQL y tests de RPC local.

## Alternatives Considered

- **Confiar solo en `database.types.ts`:** aceptable cuando cubra todas las RPCs, insuficiente cuando haya drift.
- **Mantener casts `unknown`:** rechazado por riesgo en operaciones financieras.
- **Resolver idempotencia solo en UI deshabilitando botones:** rechazado porque no cubre retries de red ni reintentos automaticos.
