import type { RegisteredActionKey } from '@/modules/bot-config/action-registry';
import type { createConversationStateStore } from '@/modules/messaging/conversation-state-store';
import type { ContactStore, WhatsAppContact } from '@/modules/messaging/contact-store';
import type { BotService } from '@/modules/messaging/bot-store';
import type { CatalogItem } from '@/platform/supabase/catalog-contracts';
import type { ConversationState } from '@/platform/validation/conversation-state';
import type { OutboundPayload } from '@/modules/whatsapp/cloud-api-client';
import type { BotRun, BotDeps } from '../bot-reply';

export type V2Deps = BotDeps & {
  version: number;
  states: ReturnType<typeof createConversationStateStore>;
  contacts: ContactStore;
  replied(waMessageId: string): Promise<boolean>;
  catalog: {
    list(): Promise<CatalogItem[]>;
    registerInterest(contactId: string, categoriaId: string, planId?: string | null): Promise<string>;
  };
  identity: {
    context(waId: string): Promise<{ activeCategories: string[]; pendingOrder: boolean }>;
    codeSale(waId: string, ventaId: string): Promise<BotService | null>;
    requestsSince(waId: string, since: string): Promise<number>;
  };
};
export type ActionContext = {
  run: BotRun & { deps: V2Deps };
  state: ConversationState;
  contact: WhatsAppContact;
  params: Record<string, string>;
};
export type ActionResult = {
  state: ConversationState;
  message?: OutboundPayload;
  execute?: () => Promise<ConversationState | void>;
  event?: 'catalog_shown' | 'interest_registered' | 'handoff';
};
export type ActionHandler = (context: ActionContext) => Promise<ActionResult | null>;
export type ActionBindings = Partial<Record<RegisteredActionKey, ActionHandler>>;
