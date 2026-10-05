import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { BotHandBack, BotOutcome, BotResult } from './bot-reply';
import type { CommerceConversationResult, CommerceTurnOptions } from './commerce-conversation-use-case';

/**
 * What one inbound message needs from the two engines. The published journey decides the conversation; the purchase flow
 * only answers when a button of its own, a purchase node of the journey or its in-progress stage asks for it.
 */
export type ConversationPorts = {
  commerce: (options?: CommerceTurnOptions) => Promise<CommerceConversationResult | null>;
  bot: (input?: { handBack?: BotHandBack }) => Promise<BotOutcome>;
  /** Persists the purchase flow's state before anything is sent. */
  checkpoint: (result: CommerceConversationResult) => Promise<void>;
  send: (payload: OutboundPayload) => Promise<void>;
};
export type ConversationTurn = { result: BotResult | 'commerce'; commerce: CommerceConversationResult | null };

// Exactly one reply per inbound message: either the purchase flow's own answer or, when it gives the turn back, the
// journey node with the flow's notice in front.
async function present(ports: ConversationPorts, answer: CommerceConversationResult): Promise<ConversationTurn> {
  await ports.checkpoint(answer);
  if (answer.handBack) {
    const outcome = await ports.bot({ handBack: answer.handBack });
    return { result: typeof outcome === 'string' ? outcome : 'ignored', commerce: answer };
  }
  if (answer.payload) await ports.send(answer.payload);
  return { result: 'commerce', commerce: answer };
}

export async function runConversationTurn(ports: ConversationPorts): Promise<ConversationTurn> {
  const own = await ports.commerce();
  if (own) return present(ports, own);
  const outcome = await ports.bot();
  if (typeof outcome === 'string') return { result: outcome, commerce: null };
  const delegated = await ports.commerce({ command: outcome.delegate, ...(outcome.prefix ? { prefix: outcome.prefix } : {}) });
  return delegated ? present(ports, delegated) : { result: 'ignored', commerce: null };
}
