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

## Respuesta a incidentes

1. Contener: deshabilitar la ruta, integracion o credencial afectada y preservar evidencia sin datos sensibles.
2. Evaluar: determinar alcance, ventana temporal, usuarios y datos afectados.
3. Recuperar: rotar secretos, corregir, ejecutar todos los gates y desplegar mediante el pipeline protegido.
4. Verificar: revisar health checks, errores 5xx, auditoria Supabase y funciones criticas.
5. Documentar: registrar causa raiz, linea temporal, impacto y acciones preventivas.

Los incidentes de frontend se revierten con Vercel. Los cambios de base de datos se reparan con una nueva migracion forward-only; nunca se hace reset de produccion.
