# Documentacion del proyecto

Indice de la documentacion viva. Las auditorias y planes historicos se eliminaron
del repo (el historial sigue en git); aqui solo queda lo vigente.

## Mapa de la documentacion

Cada tema tiene **un solo lugar** (sin duplicar reglas entre documentos):

- **Reglas de arquitectura e imports por capa** → [`CLAUDE.md`](../CLAUDE.md) (raiz). Fuente unica; toda IA la lee al iniciar.
- **Vocabulario de dominio** → [`CONTEXT.md`](../CONTEXT.md) (raiz).
- **Decisiones arquitecturales (el "por que")** → [ADR index](adr/README.md).
- **Como desarrollar (paso a paso)** → [Developer guide](DEVELOPER_GUIDE.md).
- **UI: reglas y convenciones** → [Design system](DESIGN_SYSTEM.md).
- **Performance y error boundaries** → [Performance optimizations](PERFORMANCE_OPTIMIZATIONS.md).
- **Estado/auditoria del proyecto** → [Auditoria arquitectonica profunda verificada (2026-05-30)](2026-05-30-auditoria-arquitectonica-profunda-verificada.md).
- **Criterios obligatorios de release** → [Estandar de produccion](PRODUCTION_STANDARD.md).

## Decisiones protegidas por ADR

No cambiar sin reabrir o crear ADR:

- Dashboard como read model de Postgres/Supabase.
- React Query para lecturas remotas y Zustand para estado UI.
- RPCs criticas con Adapters tipados e idempotencia.
- Eventos cliente tipados en lugar de DOM/localStorage para negocio.
- Monolito modular con modulos profundos.
- Modelo RLS single-tenant administrativo.
