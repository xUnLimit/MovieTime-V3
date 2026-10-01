# ADR-0011: Bandeja de chats en tiempo real con Supabase Realtime

**Status:** Accepted  
**Date:** 2026-09-30

## Context

La bandeja `/chats` actualizaba conversaciones (10 s), hilos (5 s) y el badge de no leidos (30 s) con sondeo
(`refetchInterval`). Eso retrasa los mensajes entrantes hasta 10 s, hace trabajo en cada ciclo aunque no haya
cambios y no escala a mas pantallas abiertas.

Las cinco tablas que alimentan la bandeja (`whatsapp_inbound_messages`, `whatsapp_outbound_messages`,
`whatsapp_message_statuses`, `whatsapp_conversation_reads`, `whatsapp_conversation_flags`) ya tienen RLS con
lectura solo para administradores activos, lo que permite usar `postgres_changes` sin abrir datos nuevos.

## Decision

- Una migracion publica esas tablas en `supabase_realtime` (idempotente, sin cambiar RLS).
- `src/platform/supabase/whatsapp-realtime.ts` mantiene UN canal por pestana con conteo de referencias y nombre unico
  por apertura; entrega solo `{ tabla, waId }` (nunca el contenido de los mensajes).
- `useWhatsAppRealtime` (hook) agrupa los eventos en ventanas de 250 ms e invalida consultas de React Query
  (conversaciones, hilo afectado, estado de avisos); al reconectar tras una caida invalida todo lo de WhatsApp.
- El sondeo queda como respaldo: se vuelve lento (60 s / 30 s / 120 s) mientras Realtime esta `live` y vuelve a los
  intervalos originales si el canal cae.
- Se monta en `/chats` y en el menu lateral de administradores para que el badge se actualice en todo el dashboard.

## Consequences

- Los mensajes aparecen sin esperar el sondeo y baja el trafico en reposo.
- Un usuario desactivado deja de recibir eventos porque la RLS evalua `active` (ADR de usuarios activos).
- Hay una dependencia nueva de la publicacion `supabase_realtime`: la validan las pruebas de integracion y el e2e
  autenticado (un mensaje insertado por service role aparece sin recargar).

## Alternatives Considered

- **Solo sondeo mas rapido:** mas carga y sigue sin ser instantaneo.
- **Webhooks propios + SSE:** infraestructura nueva para algo que Supabase ya ofrece con RLS.
- **Enviar el registro completo en el evento y parchear la cache:** acopla la UI al formato de las tablas y expone
  contenido privado en memoria; invalidar y releer mantiene una sola fuente de verdad.
