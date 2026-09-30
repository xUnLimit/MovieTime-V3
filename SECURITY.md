# Politica de seguridad

## Reporte responsable

No publiques vulnerabilidades, credenciales ni datos de clientes en issues. Reportalos de forma privada al propietario del repositorio incluyendo impacto, reproduccion minima y mitigacion sugerida. No incluyas secretos reales.

## Versiones soportadas

Solo la revision actualmente desplegada desde `main` recibe correcciones. Las versiones anteriores deben actualizarse al ultimo deployment aprobado.

## Politica de vulnerabilidades

- Dependencias de produccion: cero advisories conocidos de cualquier severidad.
- Tooling: cero advisories sin excepcion. Una excepcion solo puede cubrir dependencias que no llegan al artefacto, debe vivir en `security-audit-exceptions.json` y vencer en 30 dias o menos.
- Una vulnerabilidad critica se contiene de inmediato; una alta se corrige antes del siguiente release. No se despliega mientras cualquiera permanezca abierta.
- Los secretos confirmados se revocan y rotan; eliminarlos del Git actual no reemplaza la rotacion ni la limpieza del historial.
- La CSP de produccion no admite `unsafe-eval`. Zod se consume mediante `@/platform/validation/zod` en modo `jitless`, y ESLint bloquea imports directos que omitan esa configuracion.

## Integraciones y secretos

- Webhook de WhatsApp: todo POST se valida con la firma `x-hub-signature-256` (HMAC con `WHATSAPP_APP_SECRET`) antes de procesarlo. La verificacion inicial exige `WHATSAPP_VERIFY_TOKEN`.
- Endpoints de cron (push ejecutivo, avisos automaticos de WhatsApp, sincronizacion Yappy): exigen `Authorization: Bearer` con su secreto propio y lo comparan en tiempo constante. Supabase lee el mismo valor desde Vault; nunca va en una migracion.
- Yappy lee Gmail por IMAP con TLS verificado, en modo solo lectura y con una contrasena de aplicacion revocable. Solo guarda los datos del pago de clientes activos con ventas activas.
- Todos los secretos viven en variables de entorno de Vercel o en Supabase Vault, sin prefijo `NEXT_PUBLIC_`. Si se filtra uno, se rota tanto en Vercel como en Meta, Google o Vault.
- El hook `.githooks/pre-commit` y CI ejecutan `secrets:scan`. Activalo localmente con `git config core.hooksPath .githooks`.

## Respuesta a incidentes

1. Contener: deshabilitar la ruta, integracion o credencial afectada y preservar evidencia sin datos sensibles.
2. Evaluar: determinar alcance, ventana temporal, usuarios y datos afectados.
3. Recuperar: rotar secretos, corregir, ejecutar todos los gates y desplegar mediante el pipeline protegido.
4. Verificar: revisar health checks, errores 5xx, auditoria Supabase y funciones criticas.
5. Documentar: registrar causa raiz, linea temporal, impacto y acciones preventivas.

Los incidentes de frontend se revierten con Vercel. Los cambios de base de datos se reparan con una nueva migracion forward-only; nunca se hace reset de produccion.
