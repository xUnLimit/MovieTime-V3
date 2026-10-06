import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { BotHandBack, BotOutcome, BotResult } from './bot-reply';
import type { CommerceConversationResult, CommerceTurnOptions } from './commerce-conversation-use-case';

/**
 * What one inbound message needs from the two engines. The published journey decides the conversation; the purchase flow
 * only answers when a button of its own, a purchase node of the journey or its in-progress stage asks for it.
 */
export type ConversationPorts = {
  waiting: () => Promise<BotOutcome>;
  pauseCommerce: () => Promise<CommerceConversationResult | null>;
  clearWaiting: () => Promise<void>;
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
  await ports.clearWaiting();
  if (answer.payload) await ports.send(answer.payload);
  return { result: 'commerce', commerce: answer };
}

async function journeyOutcome(ports: ConversationPorts, outcome: BotOutcome): Promise<ConversationTurn> {
  if (typeof outcome !== 'string') {
    const delegated = await ports.commerce({ command: outcome.delegate, ...(outcome.prefix ? { prefix: outcome.prefix } : {}) });
    if (delegated) {
      return present(ports, delegated);
    }
    return { result: 'ignored', commerce: null };
  }
  const paused = outcome === 'ignored' || outcome === 'retry' || outcome === 'send_failed' ? null : await ports.pauseCommerce();
  if (paused) await ports.checkpoint(paused);
  return { result: outcome, commerce: paused };
}

export async function runConversationTurn(ports: ConversationPorts): Promise<ConversationTurn> {
  const waiting = await ports.waiting();
  if (waiting !== 'ignored') return journeyOutcome(ports, waiting);
  const own = await ports.commerce();
  if (own) {
    return present(ports, own);
  }
  const outcome = await ports.bot();
  return journeyOutcome(ports, outcome);
}
