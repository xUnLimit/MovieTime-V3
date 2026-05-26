# Documentacion del proyecto

Este indice separa documentos activos de documentos historicos para evitar decisiones basadas en auditorias superadas.

## Documentos activos

- [Auditoria actual de arquitectura y estado del proyecto](2026-05-25-auditoria-arquitectura-actual-improve-codebase.md): fuente activa para el estado arquitectonico actual y el plan de fases con compuertas estrictas.
- [Backlog detallado de deuda, riesgos y oportunidades](2026-05-25-backlog-detallado-deuda-riesgos.md): backlog activo de deuda y riesgos. Sus hallazgos criticos iniciales deben leerse junto con su seccion de evidencia de cierre.
- [Architecture roadmap](../ARCHITECTURE_ROADMAP.md): resumen de arquitectura enterprise vigente.
- [Developer guide](DEVELOPER_GUIDE.md): guia operativa para desarrollo.
- [Design system](DESIGN_SYSTEM.md): reglas y convenciones UI.
- [Performance optimizations](PERFORMANCE_OPTIMIZATIONS.md): notas de performance vigentes.
- [ADR index](adr/README.md): decisiones arquitecturales aceptadas.

## Documentos historicos

- [Auditoria enterprise del proyecto MovieTime PTY](2026-05-25-enterprise-project-audit.md): auditoria historica. Contiene hallazgos criticos que ya fueron cerrados en el estado actual, incluyendo `/api/push/pending`, idempotencia por usuario y estabilidad de tests.
- [RPC type drift audit](2026-05-22-rpc-type-drift-audit.md): auditoria puntual historica de drift RPC.
- `docs/plans/*`: planes de implementacion y disenos por fecha. Consultar como trazabilidad; no reemplazan las ADRs ni la auditoria actual.
- `docs/archive/*`: documentos archivados.

## Decisiones protegidas por ADR

No cambiar sin reabrir o crear ADR:

- Dashboard como read model de Postgres/Supabase.
- React Query para lecturas remotas y Zustand para estado UI.
- RPCs criticas con Adapters tipados e idempotencia.
- Eventos cliente tipados en lugar de DOM/localStorage para negocio.
- Monolito modular con Modules profundos.
- Modelo RLS single-tenant administrativo.

