# ADR-0006: Modelo RLS single-tenant administrativo

**Status:** Accepted  
**Date:** 2026-05-25

## Context

MovieTime PTY usa Supabase/Postgres como fuente de verdad. Muchas politicas RLS historicas permiten acceso a usuarios autenticados, con controles adicionales en rutas server-side para operaciones administrativas como push ejecutiva.

El backlog de seguridad marco este punto como riesgo si el producto se opera como multiusuario con permisos diferenciados por tenant o rol granular.

## Decision

El modelo actual se declara como **single-tenant administrativo**: los usuarios autenticados y activos operan sobre el mismo espacio de datos de MovieTime PTY, y las rutas sensibles server-side deben exigir rol `admin` cuando alcancen datos privilegiados o usen service role.

No se implementara separacion multi-tenant ni ownership por entidad en este corte.

## Consequences

- Las politicas RLS basadas en usuario autenticado son aceptables solo bajo este modelo.
- Las rutas API con service role deben validar identidad y rol antes de consultar o mutar datos.
- Si el producto necesita roles operativos finos o multi-tenant, esta ADR debe reabrirse antes de cambiar RLS.
- Los scripts de validacion siguen exigiendo que RPCs sensibles no sean ejecutables por `anon`.

## Alternatives Considered

- **Migrar ahora a multi-tenant/roles granulares:** rechazado por alcance. Requiere modelado de permisos, migraciones y pruebas de autorizacion por entidad.
- **No documentar el modelo:** rechazado porque futuras auditorias seguirian marcando como falla una decision de producto no registrada.

