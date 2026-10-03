import { expect, it, vi } from 'vitest';
const definition = vi.hoisted(() => ({ value: {} }));
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: () => ({
  from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
    data: table === 'whatsapp_bot_config' ? { enabled: true, published_version: 7 } : { version: 7, definition: definition.value }, error: null,
  }) }) }) }),
}) }));
import { createBotConfigStore } from './bot-config-store';
import { upgradeDefinition } from '@/modules/bot-config/schema';
import { defaultDefinition } from '@/modules/bot-config/defaults';
it('loads a valid v2 definition so the webhook can route it to the v2 runtime', async () => {
  definition.value = upgradeDefinition(defaultDefinition());
  const snapshot = await createBotConfigStore().load();
  expect(snapshot).toMatchObject({ ready: true, enabled: true, version: 7 });
  expect(snapshot.ready && snapshot.definition.schemaVersion).toBe(2);
});
