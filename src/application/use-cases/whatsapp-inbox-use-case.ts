import type { AutomationClaim, AutomationInboxStore, AutomationOutcome } from '@/modules/whatsapp/automation-inbox-store';

export class AutomationLeaseLostError extends Error {}
export class AutomationDeliveryUncertainError extends Error {}

export async function processWhatsAppInbox(deps: {
  store: AutomationInboxStore;
  handle: (claim: AutomationClaim, assertCurrent: () => Promise<void>) => Promise<AutomationOutcome>;
  onFailure: (context: { id: number; attempts: number }) => void;
}, limit = 10) {
  let processed = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(Math.max(limit, 0), 20); index++) {
    const claim = await deps.store.claim();
    if (!claim) break;
    const assertCurrent = async () => {
      if (!await deps.store.isCurrent(claim)) throw new AutomationLeaseLostError();
    };
    try {
      await assertCurrent();
      const result = await deps.handle(claim, assertCurrent);
      if (await deps.store.finish(claim, result)) processed++;
    } catch (error) {
      if (error instanceof AutomationLeaseLostError) continue;
      failed++;
      deps.onFailure({ id: claim.id, attempts: claim.attempts });
      await deps.store.finish(claim, { outcome: error instanceof AutomationDeliveryUncertainError ? 'review' : 'retry' });
    }
  }
  return { processed, failed };
}
