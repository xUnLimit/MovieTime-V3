# Documentacion del proyecto

Indice de la documentacion viva. Las auditorias y planes historicos se eliminaron
del repo (el historial sigue en git); aqui solo queda lo vigente.

## Documentos activos

- [Auditoria arquitectonica profunda verificada (2026-05-30)](2026-05-30-auditoria-arquitectonica-profunda-verificada.md): auditoria mas reciente verificada en codigo, con estado de remediacion, arquitectura objetivo y deuda priorizada.
- [Architecture roadmap](../ARCHITECTURE_ROADMAP.md): resumen de arquitectura vigente.
- [Developer guide](DEVELOPER_GUIDE.md): guia operativa para desarrollo.
- [Design system](DESIGN_SYSTEM.md): reglas y convenciones UI.
- [Performance optimizations](PERFORMANCE_OPTIMIZATIONS.md): notas de performance vigentes.
- [ADR index](adr/README.md): decisiones arquitecturales aceptadas.

## Decisiones protegidas por ADR

No cambiar sin reabrir o crear ADR:

- Dashboard como read model de Postgres/Supabase.
- React Query para lecturas remotas y Zustand para estado UI.
- RPCs criticas con Adapters tipados e idempotencia.
- Eventos cliente tipados en lugar de DOM/localStorage para negocio.
- Monolito modular con modulos profundos.
- Modelo RLS single-tenant administrativo.
