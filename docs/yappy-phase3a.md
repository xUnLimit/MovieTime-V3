# Detección de pagos Yappy (fase 3a)

La fase lee exclusivamente avisos de Yappy enviados al Gmail personal del dueño por IMAP y muestra en `/pagos-yappy` solo pagos relacionados con clientes activos que tengan ventas activas. **No renueva ventas ni crea `pagos_venta`**. Un administrador usa el flujo existente de renovación y luego concilia o descarta el aviso.

## Configuración pendiente del operador

1. Configurar en Vercel `YAPPY_IMAP_USER`, `YAPPY_IMAP_PASSWORD` (contraseña de aplicación de Google) y `YAPPY_SYNC_SECRET` (al menos 16 caracteres). Nunca usar `NEXT_PUBLIC_`.
2. Revisar y aplicar la migración `20260927221000_yappy_payment_detection.sql` mediante el proceso de despliegue. No ejecutar reset remoto.
3. Crear en Supabase Vault los secretos `yappy_sync_secret` (mismo valor que `YAPPY_SYNC_SECRET`) y `yappy_sync_url` (`https://system.movietimepty.top/api/yappy/sync`). El cron los lee del Vault, igual que el push ejecutivo.
4. Entrar como administrador a `/pagos-yappy` y usar **Sincronizar ahora** para comprobar la configuración. El cron consulta cada diez minutos. Ante `auth_failed`, corregir la contraseña de aplicación en Vercel y volver a sincronizar manualmente; el cron evita intentos repetidos.

La conexión usa `imap.gmail.com:993`, TLS con certificado verificado e INBOX en modo solo lectura. La primera consulta y cada cambio de UIDVALIDITY se limitan a siete días; luego se usan UID crecientes. Cada corrida procesa como máximo 50 mensajes. Los pagos personales sin teléfono de un cliente activo con venta activa no dejan filas de correo ni pago. Los avisos de formato inválido dejan solo UID, fecha y código técnico de fallo para detectar cambios de formato.
