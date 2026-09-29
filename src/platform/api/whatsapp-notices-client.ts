import { readApiResponse } from './client';

export type NoticeTipo =
  | 'notificacion_regular' | 'dia_pago' | 'renovacion' | 'suscripcion' | 'cancelacion'
  | 'actualizacion_credenciales' | 'transferencia_servicio' | 'datos_pago' | 'despedida';

export type NoticeResultStatus = 'accepted' | 'already_sent' | 'failed' | 'skipped' | 'uncertain' | 'wa_me';

export type NoticeResult = {
  noticeId: string | null;
  clienteNombre: string;
  ventaIds: string[];
  status: NoticeResultStatus;
  channel: 'template' | 'text' | 'wa_me' | null;
  waId: string | null;
  waMeText?: string;
  error?: string;
};

// Pide al servidor enviar avisos por la API de WhatsApp (solo admin).
export async function postWhatsAppNotices(
  accessToken: string,
  body: { tipo: NoticeTipo; ventaIds: string[]; eventId?: string },
): Promise<{ results: NoticeResult[] }> {
  const response = await fetch('/api/whatsapp/notices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  return readApiResponse<{ results: NoticeResult[] }>(response);
}
