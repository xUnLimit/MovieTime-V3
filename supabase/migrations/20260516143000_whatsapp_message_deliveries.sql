-- WhatsApp Cloud API delivery audit.
-- Keeps scheduled sends idempotent and records Meta API responses for support.

CREATE TABLE IF NOT EXISTS whatsapp_message_deliveries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  delivery_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'scheduled_reminder',
  notificacion_id TEXT REFERENCES notificaciones(id) ON DELETE SET NULL,
  venta_id TEXT REFERENCES ventas(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL,
  delivery_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  whatsapp_message_id TEXT,
  error_code TEXT,
  error_message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_deliveries_status_date
  ON whatsapp_message_deliveries(status, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_deliveries_notificacion
  ON whatsapp_message_deliveries(notificacion_id);
ALTER TABLE whatsapp_message_deliveries ENABLE ROW LEVEL SECURITY;
