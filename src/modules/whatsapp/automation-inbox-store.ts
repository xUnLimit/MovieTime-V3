import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';
import type { Json } from '@/platform/supabase/database.types';
import type { InboundMessage } from './webhook-payload';

const nullableText = z.string().nullable();
const messageSchema = z.object({
  wa_message_id: z.string().min(1).max(256), from_wa_id: z.string().regex(/^\d{5,20}$/),
  phone_number_id: z.string(), contact_name: nullableText, message_type: z.string(), text_body: nullableText,
  sent_at: z.string(), media_id: nullableText, media_mime_type: nullableText, media_filename: nullableText,
  context_wa_message_id: nullableText, reaction_emoji: nullableText, payload: z.json(),
});
const claimSchema = z.object({
  id: z.number().int().positive(), attempts: z.number().int().positive(), token: z.string().uuid(), fence: z.number().int().nonnegative(),
  conversation: z.object({ wa_id: z.string(), flow_version: z.number().int().nullable(), context: z.record(z.string(), z.json()),
    active_process: nullableText, order_id: z.string().uuid().nullable() }),
  message: messageSchema,
});
export type AutomationClaim = {
  id: number; attempts: number; token: string; fence: number; message: InboundMessage;
  conversation: { waId: string; flowVersion: number | null; context: Json; activeProcess: string | null; orderId: string | null };
};
export type AutomationOutcome = { outcome: 'done' | 'retry' | 'review' | 'handoff'; context?: Json; process?: string; orderId?: string; flowVersion?: number };
export type AutomationInboxStore = {
  claim(): Promise<AutomationClaim | null>;
  isCurrent(claim: AutomationClaim): Promise<boolean>;
  checkpoint(claim: AutomationClaim, context: Json, process: string | null, orderId: string | null, flowVersion: number | null): Promise<boolean>;
  finish(claim: AutomationClaim, outcome: AutomationOutcome): Promise<boolean>;
};

export function createAutomationInboxStore(client = createServiceRoleClient()): AutomationInboxStore {
  return {
    async claim() {
      const { data, error } = await client.rpc('claim_whatsapp_automation', { p_lease_seconds: 90 });
      if (error) throw new Error('Automation inbox claim failed');
      if (data === null) return null;
      const row = claimSchema.parse(data);
      const m = row.message;
      return { id: row.id, attempts: row.attempts, token: row.token, fence: row.fence,
        conversation: { waId: row.conversation.wa_id, flowVersion: row.conversation.flow_version,
          context: row.conversation.context, activeProcess: row.conversation.active_process, orderId: row.conversation.order_id },
        message: { waMessageId: m.wa_message_id, fromWaId: m.from_wa_id, phoneNumberId: m.phone_number_id,
          contactName: m.contact_name, messageType: m.message_type, textBody: m.text_body, sentAt: m.sent_at,
          mediaId: m.media_id, mediaMimeType: m.media_mime_type, mediaFilename: m.media_filename,
          contextWaMessageId: m.context_wa_message_id, reactionEmoji: m.reaction_emoji, payload: m.payload },
      };
    },
    async isCurrent(claim) {
      const { data, error } = await client.rpc('check_whatsapp_automation_lease', {
        p_wa_id: claim.message.fromWaId, p_token: claim.token, p_fence: claim.fence,
      });
      if (error) throw new Error('Automation lease check failed');
      return data === true;
    },
    async checkpoint(claim, context, process, orderId, flowVersion) {
      const { data, error } = await client.rpc('checkpoint_whatsapp_automation', {
        p_wa_id: claim.message.fromWaId, p_token: claim.token, p_fence: claim.fence,
        p_context: context, p_process: process, p_order_id: orderId, p_flow_version: flowVersion,
      });
      if (error) throw new Error('Automation context checkpoint failed');
      return data === true;
    },
    async finish(claim, result) {
      const { data, error } = await client.rpc('finish_whatsapp_automation', {
        p_id: claim.id, p_token: claim.token, p_fence: claim.fence, p_outcome: result.outcome,
        p_context: result.context, p_process: result.process, p_order_id: result.orderId, p_flow_version: result.flowVersion,
      });
      if (error) throw new Error('Automation inbox completion failed');
      return data === true;
    },
  };
}
