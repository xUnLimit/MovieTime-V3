import { readApiResponse } from './client';

export type WhatsAppSendMessage =
  | { kind: 'text'; text: string }
  | { kind: 'template'; templateName: string; params: string[] };

export type WhatsAppSendResult = {
  id: string;
  sendStatus: 'pending' | 'accepted' | 'failed';
  waMessageId: string | null;
  errorTitle: string | null;
  replayed: boolean;
};

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
