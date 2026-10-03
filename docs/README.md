# Documentacion del proyecto

Indice de la documentacion viva. Los planes, specs y auditorias historicas no se
guardan en el repo (el historial sigue en git); aqui solo queda lo vigente.

## Mapa de la documentacion

Cada tema tiene **un solo lugar** (sin duplicar reglas entre documentos):

| Tema | Documento |
|---|---|
| Reglas obligatorias de ingenieria, seguridad, arquitectura y pruebas | [`AGENTS.md`](../AGENTS.md) |
| Producto: usuarios, proposito, marca y principios | [`PRODUCT.md`](../PRODUCT.md) |
| Vocabulario de dominio | [`CONTEXT.md`](../CONTEXT.md) |
| Sistema visual: tokens, tipografia, componentes y tablas | [`DESIGN.md`](../DESIGN.md) |
| Politica de seguridad e incidentes | [`SECURITY.md`](../SECURITY.md) |
| Criterios obligatorios de release y rollback | [Estandar de produccion](PRODUCTION_STANDARD.md) |
| Como desarrollar paso a paso | [Developer guide](DEVELOPER_GUIDE.md) |
| Decisiones arquitecturales (el "por que") | [ADR index](adr/README.md) |
| Idempotencia de operaciones financieras | [Idempotencia](idempotencia.md) |
| Plantillas de WhatsApp aprobadas en Meta | [Plantillas Meta](whatsapp/plantillas-meta-v2.md) |
| Deteccion de pagos Yappy por correo | [Yappy](yappy-phase3a.md) |
| Scripts operativos | [`scripts/README.md`](../scripts/README.md) |

## Decisiones protegidas por ADR

No cambiar sin reabrir o crear ADR:

- Dashboard como read model de Postgres/Supabase, con snapshot calculado en servidor.
- React Query para lecturas remotas y Zustand para estado UI.
- RPCs criticas con Adapters tipados e idempotencia.
- Eventos cliente tipados en lugar de DOM/localStorage para negocio.
- Monolito modular con modulos profundos.
- Modelo RLS single-tenant administrativo.
