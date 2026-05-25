# Fase 0-1: seguridad y confiabilidad

**Fecha:** 2026-05-25  
**Estado:** Aprobado para implementacion  
**Fuente:** `docs/2026-05-25-backlog-detallado-deuda-riesgos.md`

## Alcance

Este corte implementa primero los riesgos de mayor impacto:

- cerrar acceso inseguro a push pending;
- impedir suplantacion de identidad en RPCs criticas;
- verificar/corregir idempotencia por usuario;
- dejar validaciones operativas mas estrictas;
- estabilizar tests que bloqueen el cambio.

No incluye deepening de stores, Notificacion, payments, DataTable, PWA ni pantallas de detalle salvo que sea necesario para seguridad o tests.

## Arquitectura

Las rutas API iniciadas por clientes deben validar identidad o prueba de posesion antes de alcanzar datos privilegiados. Las RPCs financieras deben derivar identidad desde `auth.uid()` dentro de Postgres; el cliente no decide `created_by`.

La idempotencia de operaciones criticas se evalua por usuario, RPC y key. Esto permite retries seguros sin compartir resultados ni conflictos entre usuarios.

## Data flow

1. Cliente/API solicita push pending con una credencial valida.
2. La ruta verifica usuario o token de suscripcion antes de consultar resumen.
3. Las operaciones financieras pasan por Adapters tipados.
4. La DB asigna identidad desde `auth.uid()`.
5. La tabla de idempotencia guarda resultado por usuario + RPC + key.

## Error handling

- Auth faltante: `401`.
- Suscripcion ajena o prueba invalida: `403`.
- Configuracion incompleta en produccion: fallo temprano.
- Reset staging con entorno no permitido: aborta antes de mutar datos.

## Testing

Validaciones esperadas:

```bash
npm run lint
npm test -- --run
npm run build
npm run migrate:validate
```

Los tests con timeout existentes se corregiran si siguen fallando durante este corte. No se aumentara timeout como primera solucion.

