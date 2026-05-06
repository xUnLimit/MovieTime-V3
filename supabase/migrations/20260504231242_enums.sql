-- ============================================================================
-- 001_enums.sql
-- Enums del dominio MovieTime PTY.
-- ============================================================================

CREATE TYPE ciclo_pago_enum AS ENUM ('mensual','trimestral','semestral','anual');
CREATE TYPE usuario_tipo_enum AS ENUM ('cliente','revendedor');
CREATE TYPE categoria_tipo_enum AS ENUM ('cliente','revendedor');
CREATE TYPE categoria_tipo_cat_enum AS ENUM ('plataforma_streaming','otros');
CREATE TYPE metodo_pago_tipo_enum AS ENUM ('banco','yappy','paypal','binance','efectivo');
CREATE TYPE tipo_cuenta_enum AS ENUM ('ahorro','corriente','wallet','telefono','email');
CREATE TYPE asociado_a_enum AS ENUM ('usuario','servicio');
CREATE TYPE venta_estado_enum AS ENUM ('activo','inactivo');
CREATE TYPE periodo_tipo_enum AS ENUM ('inicial','renovacion','ajuste');
CREATE TYPE pago_estado_enum AS ENUM ('registrado','anulado','reembolsado');
CREATE TYPE notificacion_prioridad_enum AS ENUM ('baja','media','alta','critica');
CREATE TYPE notificacion_entidad_enum AS ENUM ('venta','servicio','reposo');
CREATE TYPE accion_log_enum AS ENUM ('creacion','actualizacion','eliminacion','renovacion');
CREATE TYPE entidad_log_enum AS ENUM (
  'cliente','revendedor','servicio','usuario',
  'categoria','metodo_pago','gasto','venta','template'
);
CREATE TYPE tipo_template_enum AS ENUM (
  'notificacion_regular','dia_pago','renovacion','suscripcion','cancelacion'
);
