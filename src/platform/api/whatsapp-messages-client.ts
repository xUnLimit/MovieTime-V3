import { readApiResponse } from './client';

export type WhatsAppSendMessage =
  | { kind: 'text'; text: string; replyTo?: string }
  | { kind: 'template'; templateName: string; params: string[] }
  | { kind: 'image' | 'document' | 'audio'; mediaId: string; mimeType: string; filename?: string; caption?: string; replyTo?: string }
  | { kind: 'reaction'; targetWaMessageId: string; emoji: string }
  | { kind: 'buttons'; body: string; buttons: Array<{ id: string; title: string }>; replyTo?: string }
  | { kind: 'list'; body: string; buttonLabel: string; rows: Array<{ id: string; title: string; description?: string }>; replyTo?: string }
  | { kind: 'location'; location: { latitude: number; longitude: number; name?: string; address?: string }; replyTo?: string }
  | { kind: 'contacts'; contacts: Array<{ name: string; phone: string }>; replyTo?: string };

export type WhatsAppSendResult = {
  id: string;
  sendStatus: 'pending' | 'accepted' | 'failed';
  waMessageId: string | null;
  errorTitle: string | null;
  replayed: boolean;
};

export type WhatsAppUploadResult = { mediaId: string; mimeType: string; filename: string };

// Descarga un adjunto por el proxy autenticado; los errores llegan como JSON publico.
export async function fetchWhatsAppMedia(accessToken: string, mediaId: string): Promise<Blob> {
  const response = await fetch(`/api/whatsapp/media/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) await readApiResponse<never>(response);
  return response.blob();
}

// Sube el archivo a Meta a traves del servidor (el navegador nunca ve el token
// de la Cloud API); devuelve el id de medio para usarlo al enviar el mensaje.
export async function uploadWhatsAppMedia(accessToken: string, file: Blob, filename: string): Promise<WhatsAppUploadResult> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('mimeType', file.type);
  const response = await fetch('/api/whatsapp/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return readApiResponse<WhatsAppUploadResult>(response);
}

export async function postWhatsAppMessage(
  accessToken: string,
  body: { idempotencyKey: string; to: string; message: WhatsAppSendMessage }
): Promise<WhatsAppSendResult> {
  const response = await fetch('/api/whatsapp/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
  return readApiResponse<WhatsAppSendResult>(response);
}

// Marca el chat como leido y, si aplica, avisa a Meta para mostrar los ✓✓ azules.
export async function postMarkConversationRead(accessToken: string, waId: string, readAt: string): Promise<void> {
  const response = await fetch('/api/whatsapp/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ waId, readAt }),
  });
  await readApiResponse<{ ok: true }>(response);
}
