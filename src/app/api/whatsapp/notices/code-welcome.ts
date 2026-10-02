import { createCodeWelcome } from '@/application/use-cases/bot-v2/code-welcome';
import { createBotConfigStore } from '@/modules/messaging/bot-config-store';
import { createConversationStateStore } from '@/modules/messaging/conversation-state-store';
import { createBotV2IdentityStore } from '@/modules/messaging/bot-v2-identity-store';
import { createLogger } from '@/platform/observability/logger';
import type { CodeWelcome } from '@/application/use-cases/bot-v2/code-welcome';

const log = createLogger('BotCodeWelcome');
// Lazy composition: a missing/off bot must never prevent the subscription notice.
export const codeWelcome: CodeWelcome = async (...args) => {
  try {
    const snapshot = await createBotConfigStore().load();
    if (!snapshot.ready || snapshot.definition.schemaVersion !== 2) return null;
    return await createCodeWelcome({ states: createConversationStateStore(), identity: createBotV2IdentityStore(),
      definition: snapshot.definition, version: snapshot.version })(...args);
  } catch {
    log.warn('Code welcome is unavailable');
    return null;
  }
};
