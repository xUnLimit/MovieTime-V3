-- Produccion conserva una PK historica (idempotency_key, rpc_name), mientras
-- las cinco RPC criticas restauradas infieren (created_by, rpc_name,
-- idempotency_key) en ON CONFLICT. La migracion original usaba CREATE TABLE
-- IF NOT EXISTS, que no corrige una tabla existente con otra clave primaria.
-- Agregar este indice conserva la PK y compatibilidad con ambas versiones,
-- sin modificar funciones, permisos, claves previas ni datos financieros.
CREATE UNIQUE INDEX IF NOT EXISTS rpc_idempotency_keys_actor_rpc_key_uidx
  ON public.rpc_idempotency_keys (created_by, rpc_name, idempotency_key);
