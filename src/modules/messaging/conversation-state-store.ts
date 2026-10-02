import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';
import { conversationStateSchema, type ConversationState } from '@/platform/validation/conversation-state';
import type { Database } from '@/platform/supabase/database.types';

type CasArgs = Database['public']['Functions']['set_conversation_state']['Args'];
type Result<T> = { data: T | null; error: { code?: string } | null };
// Narrow structural port lets tests supply a real contract without unsafe client casts.
type StateClient = {
  read(waId: string): PromiseLike<Result<unknown>>;
  cas(args: CasArgs): PromiseLike<Result<boolean>>;
};
function serviceClient(): StateClient {
  const client = createServiceRoleClient();
  return {
    read: waId => client.from('whatsapp_conversation_state')
      .select('flow_version,node_id,variables,awaiting,owner,revision,updated_at,expires_at').eq('wa_id', waId).maybeSingle(),
    cas: args => client.rpc('set_conversation_state', args),
  };
}
const waIdSchema = z.string().regex(/^[0-9]{7,15}$/);
const timestampSchema = z.iso.datetime({ offset: true });
const revisionSchema = z.number().int().min(1).max(2147483647);
const rowSchema = z.object({
  flow_version: z.number().int().positive(), node_id: z.string(), variables: z.unknown(), awaiting: z.unknown(),
  owner: z.string(), revision: revisionSchema, updated_at: timestampSchema, expires_at: timestampSchema,
});
type ConversationSnapshot = { state: ConversationState; revision: number; updatedAt: string; expiresAt: string };

export function createConversationStateStore(client: StateClient = serviceClient()) {
  return {
    async load(waId: string): Promise<ConversationSnapshot | null> {
      waIdSchema.parse(waId);
      const { data, error } = await client.read(waId);
      if (error) throw new Error('Conversation state lookup failed');
      if (data === null) return null;
      const row = rowSchema.safeParse(data);
      if (!row.success) throw new Error('Invalid conversation state');
      const state = conversationStateSchema.safeParse({
        flowVersion: row.data.flow_version, nodeId: row.data.node_id, variables: row.data.variables,
        awaiting: row.data.awaiting, owner: row.data.owner,
      });
      if (!state.success || (state.data.awaiting && Date.parse(state.data.awaiting.expiresAt) > Date.parse(row.data.expires_at))) throw new Error('Invalid conversation state');
      return { state: state.data, revision: row.data.revision, updatedAt: row.data.updated_at, expiresAt: row.data.expires_at };
    },
    async compareAndSet(waId: string, expectedRevision: number | null, state: ConversationState, expiresAt: string): Promise<boolean> {
      waIdSchema.parse(waId);
      const parsed = conversationStateSchema.parse(state);
      timestampSchema.parse(expiresAt);
      if (expectedRevision !== null) revisionSchema.parse(expectedRevision);
      if (parsed.awaiting && Date.parse(parsed.awaiting.expiresAt) > Date.parse(expiresAt)) throw new Error('Invalid bot state mutation');
      const { data, error } = await client.cas({
        p_wa_id: waId, p_expected_revision: expectedRevision, p_state: parsed, p_expires_at: expiresAt,
      });
      if (error) throw new Error('Conversation state mutation failed');
      if (typeof data !== 'boolean') throw new Error('Invalid conversation state result');
      return data;
    },
  };
}
