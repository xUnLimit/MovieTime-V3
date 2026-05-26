# ADR-0007: Migracion final de stores remotos a React Query

**Estado:** Aceptada  
**Fecha:** 2026-05-25

## Contexto

MovieTime ya usa React Query para muchas lecturas remotas, pero quedan stores Zustand legacy que aun exponen acciones remotas o actuan como capa de compatibilidad para mutaciones. Eso duplica responsabilidades: React Query conoce cache remota, los stores conocen invalidacion y algunos callers todavia esperan una API historica.

La Interface de esos stores es shallow: para usarlos correctamente el caller necesita conocer datos remotos, invalidaciones, activity log, errores de red y estado local. El resultado es baja locality cuando cambia un dominio.

## Decision

React Query sera la fuente canonica para lecturas remotas de dominio. Zustand queda limitado a estado local de UI:

- filtros, pagina y seleccion temporal;
- dialogs abiertos;
- colas visuales o toasts;
- optimismo estrictamente local;
- adapters de compatibilidad temporales durante una migracion de slice.

Los stores no deben importar repositorios Supabase. Las mutaciones remotas viven en use-cases o adapters de dominio, y las invalidaciones quedan en `src/lib/store-reactions/*` o hooks React Query.

## Criterio de salida por store

Un store se considera migrado cuando:

1. no expone `fetch*` remoto como carga primaria de entidades;
2. no importa repositorios Supabase;
3. no registra activity log directamente;
4. no calcula counts remotos;
5. si conserva mutaciones legacy, estan documentadas como compatibilidad y delegan a use-cases;
6. sus tests cubren estado UI o contrato de compatibilidad, no detalles de persistencia.

## Consecuencias

Las pantallas deben consumir hooks como `useVentas`, `useServicios`, `useTerceros`, `useCategoriasFull`, `useMetodosPago*`, `useGastos`, `useTiposGasto`, `useTemplates` y `useNotificaciones`.

La migracion puede ser incremental, pero cada slice debe reducir la Interface publica del store. No se agregan nuevas lecturas remotas a Zustand.

## Validacion

```bash
rg -n "from ['\"]@/lib/supabase" src/store
rg -n "from ['\"]@/store" src/lib/use-cases
rg -n "fetch[A-Z]|count|query|repository|supabase" src/store
npm run lint
npm test -- --run
```
