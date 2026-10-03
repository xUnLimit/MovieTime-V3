import type { V2Deps } from '@/application/use-cases/bot-v2/contracts';
import { createBotPurchaseStore } from '@/modules/messaging/bot-purchase-store';

/**
 * Purchase collaborators for the v2 bot, built per delivery. Renewal (`renew`) is deliberately not wired:
 * creating renewal orders needs an operator identity the bot does not have, so `renew_services` stays closed
 * until that decision is made.
 */
export function createBotV2Extras(): Pick<V2Deps, 'purchase'> {
  return { purchase: createBotPurchaseStore() };
}
