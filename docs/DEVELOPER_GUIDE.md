# Developer Guide — MovieTime PTY

Guía práctica de desarrollo. Las **reglas de arquitectura e imports por capa** viven en
[`CLAUDE.md`](../CLAUDE.md) (no se repiten aquí); el vocabulario de dominio en
[`CONTEXT.md`](../CONTEXT.md); las decisiones en [`docs/adr/`](adr/README.md).

---

## Capas (resumen)

```
app / components / hooks      UI: rutas, presentación, lecturas React Query
        │
        ▼
application/                  use-cases (negocio) + client-domain-mutations (composition root)
        │                     + store-reactions (efectos de caché) + activity
        ▼
modules/<context>/            dominios profundos: payments, notifications, dashboard, forecasting, pwa…
        ▼
platform/                     infra transversal: supabase, events, cache, observability, errors, utils…
        ▼
Supabase / Postgres           fuente de verdad (tablas, RPC, RLS)
```

Regla de oro: las flechas solo apuntan hacia abajo. La matriz exacta de qué puede importar
cada capa está en `CLAUDE.md` y la valida `src/platform/architecture-boundaries.test.ts`.

---

## Añadir una feature a una entidad existente

1. **Tipo** → `src/types/<entidad>.ts`.
2. **Persistencia** → la escritura va en el repositorio de `@/platform/supabase` (thin, sin
   decisiones de negocio). Si toca pagos/períodos, usar el `*-rpc-adapter` tipado.
3. **Negocio** → la orquestación va en `@/application/use-cases/<dominio>`. El use-case recibe
   `deps` con `{ logContext, recordActivityLog }` inyectados; NO lee el store.
4. **Composition root** → conectar use-case + invalidación + reacción en
   `@/application/client-domain-mutations/<dominio>-client-mutations.ts`. Aquí (y solo aquí) se
   llama `getActivityLogOptions()`.
5. **Lectura** → un hook React Query en `src/hooks` (`use-<entidad>.ts`). La UI consume el hook.
6. **UI** → componente en `src/components/<dominio>` o ruta en `src/app`. Llama al
   command/use-case, nunca al repositorio.

## Crear un módulo de dominio nuevo

`src/modules/<context>/` con lógica cohesiva detrás de una superficie pequeña. Importa de
`@/platform`, nunca del store ni de otros módulos por dentro. Expón lo público y mantén lo
interno privado.

## Mutaciones y eventos

- Una mutación pasa por: use-case (emite el evento de dominio una vez) → composition root
  (invalida caché) → React Query refresca las vistas suscritas.
- Un evento de dominio (`VENTA_CREATED`, etc.) tiene **un solo emisor**: el use-case. Las
  store-reactions reaccionan a efectos (caché/forecast); no re-emiten.

## Errores y side-effects

- Errores de negocio: subclases de `DomainError` (`@/platform/errors`) con `code` + `context`.
- Side-effects fire-and-forget: `safeAsyncSideEffect` (`@/platform/utils/safety`). Prohibido
  `.catch(() => {})`.
- Logging: `createLogger(scope)` de `@/platform/observability`. No usar `console.*` directo en
  módulos críticos.

## Antes de mergear

```bash
npm run lint
npm test -- --run
npm run test:coverage
npm run build
npm run migrate:validate   # si tocaste Supabase/schema
```

El CI (`.github/workflows/quality.yml`) corre estos gates en cada PR.
