import { describe, expect, it, vi } from 'vitest';

vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient: vi.fn() }));

import { defaultDefinition } from '@/modules/bot-config';
import { createBotConfigStore } from './bot-config-store';

type Result = { data: unknown; error: { code: string } | null };

function fakeClient(results: Record<string, Result>) {
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => { filters.push({ table, column, value }); return builder; },
        maybeSingle: async () => results[table] ?? { data: null, error: null },
      };
      return builder;
    },
  };
  return { client: client as never, filters };
}

const config = (overrides: object = {}) => ({ data: { enabled: true, published_version: 3, ...overrides }, error: null });
const version = (definition: unknown) => ({ data: { version: 3, definition }, error: null });

describe('createBotConfigStore.load', () => {
  it('returns the validated published definition when the bot is on', async () => {
    const { client, filters } = fakeClient({
      whatsapp_bot_config: config(), whatsapp_bot_versions: version(defaultDefinition()),
    });
    const snapshot = await createBotConfigStore(client).load();
    expect(snapshot).toEqual({ ready: true, enabled: true, version: 3, definition: defaultDefinition() });
    expect(filters).toContainEqual({ table: 'whatsapp_bot_config', column: 'id', value: 'global' });
    expect(filters).toContainEqual({ table: 'whatsapp_bot_versions', column: 'version', value: 3 });
  });

  it('stays silent without a config row', async () => {
    const { client } = fakeClient({});
    await expect(createBotConfigStore(client).load())
      .resolves.toEqual({ ready: false, enabled: false, version: null, reason: 'missing_config' });
  });

  it('stays silent when switched off and does not read the version', async () => {
    const { client, filters } = fakeClient({ whatsapp_bot_config: config({ enabled: false }) });
    await expect(createBotConfigStore(client).load())
      .resolves.toEqual({ ready: false, enabled: false, version: 3, reason: 'disabled' });
    expect(filters.some((filter) => filter.table === 'whatsapp_bot_versions')).toBe(false);
  });

  it('stays silent when nothing is published or the version row is gone', async () => {
    const none = fakeClient({ whatsapp_bot_config: config({ published_version: null }) });
    await expect(createBotConfigStore(none.client).load())
      .resolves.toEqual({ ready: false, enabled: true, version: null, reason: 'no_published_version' });
    const gone = fakeClient({ whatsapp_bot_config: config() });
    await expect(createBotConfigStore(gone.client).load())
      .resolves.toEqual({ ready: false, enabled: true, version: 3, reason: 'no_published_version' });
  });

  it('stays silent when the stored definition no longer validates', async () => {
    const { client } = fakeClient({ whatsapp_bot_config: config(), whatsapp_bot_versions: version({ schemaVersion: 1 }) });
    await expect(createBotConfigStore(client).load())
      .resolves.toEqual({ ready: false, enabled: true, version: 3, reason: 'invalid_definition' });
  });

  it('stays silent when the stored definition parses but breaks a business rule', async () => {
    const broken = { ...defaultDefinition(), entryNodeId: 'inexistente' };
    const { client } = fakeClient({ whatsapp_bot_config: config(), whatsapp_bot_versions: version(broken) });
    await expect(createBotConfigStore(client).load())
      .resolves.toEqual({ ready: false, enabled: true, version: 3, reason: 'invalid_definition' });
  });

  it('throws only on database errors, with the code and nothing else', async () => {
    const configError = fakeClient({ whatsapp_bot_config: { data: null, error: { code: '42501' } } });
    await expect(createBotConfigStore(configError.client).load()).rejects.toThrow('Bot config store config lookup failed: 42501');
    const versionError = fakeClient({ whatsapp_bot_config: config(), whatsapp_bot_versions: { data: null, error: { code: 'XX000' } } });
    await expect(createBotConfigStore(versionError.client).load()).rejects.toThrow('version lookup failed: XX000');
  });
});
