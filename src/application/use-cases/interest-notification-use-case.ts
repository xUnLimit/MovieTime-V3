import { z } from '@/platform/validation/zod';
import { assertUuid } from '@/platform/utils/safety';
import type { NewOutboundMessage, OutboundResult } from '@/modules/whatsapp/outbound-messages';
import { drainInterestDeliveries } from './interest-delivery-runtime';

const inviteSchema = z.object({ id: z.string().uuid(), contact: z.string().regex(/^[0-9]{8,32}$/), name: z.string().min(1).max(200) });
type Invite = z.infer<typeof inviteSchema>;
type Dependencies = { claim(id: string): Promise<unknown>; finish(id: string): Promise<void>;
  send(message: NewOutboundMessage): Promise<OutboundResult>; templateName?: string };

function inviteMessage(invite: Invite, templateName?: string): NewOutboundMessage {
  return { idempotencyKey: invite.id, toWaId: invite.contact, sentBy: null,
    payload: templateName ? { kind: 'template', templateName, params: [invite.name] }
      : { kind: 'text', text: `Ya tenemos disponibilidad de ${invite.name}. Responde para revisar las opciones. La disponibilidad se confirma al reservar.` } };
}
export async function notifyInterestUseCase(id: string, deps?: Dependencies): Promise<string> {
  assertUuid(id, 'Interesado');
  if (!deps) {
    const result=await drainInterestDeliveries(id);
    if(!result.processed) throw new Error('Revisa consentimiento, pausa, disponibilidad y el historial del aviso antes de reintentarlo.');
    return id;
  }
  const dependenciesForRun = deps;
  const invite = inviteSchema.parse(await dependenciesForRun.claim(id));
  const result = await dependenciesForRun.send(inviteMessage(invite, dependenciesForRun.templateName));
  if (result.sendStatus !== 'accepted') throw new Error('El aviso está pendiente. Reintenta sin duplicarlo o revisa el envío en Chats.');
  await dependenciesForRun.finish(id);
  return id;
}
