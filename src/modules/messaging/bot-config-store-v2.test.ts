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
it('does not dispatch any v2 definition through the current v1 webhook executor', async () => {
  definition.value = upgradeDefinition(defaultDefinition());
  await expect(createBotConfigStore().load()).resolves.toEqual({ ready: false, enabled: true, version: 7, reason: 'invalid_definition' });
});
