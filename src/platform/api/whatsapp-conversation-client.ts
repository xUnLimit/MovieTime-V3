import { z } from '@/platform/validation/zod';
import type { WhatsAppConversationControl } from '@/types/whatsapp-conversation';
import { readApiResponse } from './client';

const controlSchema = z.object({
  waId: z.string().regex(/^\d{5,20}$/), mode: z.enum(['bot', 'human']), version: z.number().int().nonnegative(),
  operatorId: z.string().uuid().nullable(), activeProcess: z.string().nullable(),
  orderId: z.string().uuid().nullable(), handoffReason: z.string().nullable(),
});
export async function fetchConversationControl(accessToken: string, waId: string): Promise<WhatsAppConversationControl> {
  const response = await fetch(`/api/whatsapp/conversation?${new URLSearchParams({ waId })}`, {
    headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000),
  });
  return controlSchema.parse(await readApiResponse<unknown>(response));
}
export async function postConversationControl(accessToken: string, input: { waId: string; mode: 'bot' | 'human'; version: number }): Promise<WhatsAppConversationControl> {
  const response = await fetch('/api/whatsapp/conversation', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(15000),
  });
  return controlSchema.parse(await readApiResponse<unknown>(response));
}
export async function postConversationReview(accessToken: string, input: { waId: string; version: number }): Promise<WhatsAppConversationControl> {
  const response = await fetch('/api/whatsapp/inbox/resolve', {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(15000),
  });
  return controlSchema.parse(await readApiResponse<unknown>(response));
}
