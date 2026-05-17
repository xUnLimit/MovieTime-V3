-- Agrega tipo de plantilla para notificar cambios de correo y contrasena.

ALTER TYPE tipo_template_enum ADD VALUE IF NOT EXISTS 'actualizacion_credenciales';
