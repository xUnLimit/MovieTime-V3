# Base verificada para automatizaciones

Revisión del 3 de octubre de 2026. El proyecto enlazado en `supabase/.temp/project-ref` coincide con `movietime-pty`. Se consultaron únicamente metadatos de migraciones, tablas, funciones y la auditoría de seguridad mediante el conector Supabase; no se consultaron clientes, credenciales, pagos ni contenidos de mensajes. No se aplicaron cambios remotos.

Producción registra hasta `20261006030000_repair_restored_rpc_idempotency_index`, incluyendo la reparación de cascada de avisos y la restauración previa. No contiene RPC `mt_*`. Sobreviven `pedidos`, `pedido_items`, `pedido_pagos`, `reservas_perfil`, `intereses`, `domain_events` y `whatsapp_conversation_state`; todas tienen RLS activa. La identidad `terceros.wa_id` existe. La conversación conserva el contrato histórico con `owner/revision/variables`; las nuevas migraciones lo expanden antes de usar `mode/version/context`.

`run_security_audit_validations()` devuelve cero para sus seis controles: RLS desactivada, SECURITY DEFINER sin search_path, acceso anónimo, funciones autenticadas no aprobadas, RPC requeridos sin permisos y RPC requeridos expuestos a anon. Esta comprobación describe el esquema previo al cambio, no autoriza activar las nuevas capacidades.

La base de verificación local se creó con proyecto aislado `MovieTime-Automation-Verification` y puertos 55321/55322, aplicando el historial completo desde cero. La instancia local existente `MovieTime-V3` conserva sus datos; durante la iteración se actualizaron definiciones SQL locales para pruebas, sin resetearla. Los gates finales usan exclusivamente la instancia aislada. Los RPC financieros restaurados y sus contratos se prueban junto a los nuevos, para comprobar compatibilidad con la aplicación anterior.

Antes de activar operación real siguen siendo necesarias las pruebas del canal WhatsApp, autenticidad del buzón Yappy, catálogo/precios/perfiles, rotación y buzón de códigos Netflix. Los adaptadores habilitados corresponden a capacidades verificadas; añadir otro proveedor requiere parsing, autorización y pruebas propias.
