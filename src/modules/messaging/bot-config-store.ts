import { hasBlockingIssues, parseDefinition, validateDefinition } from '@/modules/bot-config';
import { createServiceRoleClient } from '@/platform/server/supabase-server';
import type { BotDefinition } from '@/types/bot';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type BotConfigOffReason = 'missing_config' | 'disabled' | 'no_published_version' | 'invalid_definition';

/** Lo que el webhook necesita: si esta encendido y la definicion publicada; si no, el motivo por el que calla. */
type BotConfigSnapshot =
  | { ready: true; enabled: true; version: number; definition: BotDefinition }
  | { ready: false; enabled: boolean; version: number | null; reason: BotConfigOffReason };

export type BotConfigStore = { load(pinnedVersion?: number | null): Promise<BotConfigSnapshot> };

function check(error: { code?: string } | null, action: string): void {
  if (error) throw new Error(`Bot config store ${action} failed: ${error.code ?? 'unknown'}`);
}

// Fail closed: any missing or invalid piece leaves the bot silent. Only a database error throws.
export function createBotConfigStore(client: ServiceClient = createServiceRoleClient()): BotConfigStore {
  return {
    async load(pinnedVersion) {
      const { data: config, error } = await client.from('whatsapp_bot_config')
        .select('enabled,published_version').eq('id', 'global').maybeSingle();
      check(error, 'config lookup');
      if (!config) return { ready: false, enabled: false, version: null, reason: 'missing_config' };
      const version = pinnedVersion ?? config.published_version;
      if (!config.enabled) return { ready: false, enabled: false, version, reason: 'disabled' };
      if (version === null) return { ready: false, enabled: true, version: null, reason: 'no_published_version' };

      const { data: row, error: versionError } = await client.from('whatsapp_bot_versions')
        .select('version,definition').eq('version', version).maybeSingle();
      check(versionError, 'version lookup');
      if (!row) return { ready: false, enabled: true, version, reason: 'no_published_version' };
      const parsed = parseDefinition(row.definition);
      if (!parsed.success || hasBlockingIssues(validateDefinition(parsed.definition, { purchaseBlocksEnabled: true, flowExtensionsEnabled: true }))) return { ready: false, enabled: true, version, reason: 'invalid_definition' };
      return { ready: true, enabled: true, version, definition: parsed.definition };
    },
  };
}
