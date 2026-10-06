-- Expand: la versión anterior sigue usando suscripcion; no se modifica ni retira ese tipo.
-- El nuevo valor se confirma antes de inicializar la plantilla en la siguiente migración.
ALTER TYPE public.tipo_template_enum ADD VALUE IF NOT EXISTS 'datos_acceso';
