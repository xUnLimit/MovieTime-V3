import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { defaultDefinition, parseDefinition } from '@/modules/bot-config';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261002060000_whatsapp_bot_admin.sql'), 'utf8');

function seededDefinition(): unknown {
  const match = /VALUES \(\$bot\$([\s\S]+?)\$bot\$::jsonb/.exec(sql);
  if (!match) throw new Error('No se encontro la definicion sembrada');
  return JSON.parse(match[1]);
}

describe('WhatsApp bot admin migration', () => {
  it('seeds version 1 with exactly the default definition so code and database cannot diverge', () => {
    const seeded = seededDefinition();
    expect(seeded).toEqual(defaultDefinition());
    expect(parseDefinition(seeded).success).toBe(true);
  });

  it('seeds the global config switched off and pointing at version 1', () => {
    expect(sql).toMatch(/INSERT INTO public\.whatsapp_bot_config \(id, enabled, published_version\)\s+SELECT 'global', false, version FROM public\.whatsapp_bot_versions WHERE version = 1/);
  });

  it('enables RLS on every table and only grants read access to admins and the webhook', () => {
    for (const table of ['whatsapp_bot_versions', 'whatsapp_bot_config', 'whatsapp_bot_events']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY ${table}_admin_read ON public.${table}`);
    }
    expect(sql.match(/FOR SELECT TO authenticated USING \(\(SELECT private\.auth_role\(\)\) = 'admin'\)/g)).toHaveLength(3);
    expect(sql).toContain('FROM PUBLIC, anon, authenticated, service_role');
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*ON TABLE/i);
  });

  it('defines hardened SECURITY DEFINER functions that require an administrator', () => {
    const definers = sql.match(/SECURITY DEFINER SET search_path = ''/g) ?? [];
    expect(definers).toHaveLength(3);
    expect(sql.match(/IS DISTINCT FROM 'admin'/g)).toHaveLength(2);
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.publish_whatsapp_bot_version(jsonb, text) TO authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.set_whatsapp_bot_enabled(boolean) TO authenticated');
    expect(sql).toContain('TO service_role;');
  });

  it('publishes atomically: the version insert and the pointer update live in one function', () => {
    const publish = sql.slice(sql.indexOf('CREATE FUNCTION public.publish_whatsapp_bot_version'), sql.indexOf('CREATE FUNCTION public.set_whatsapp_bot_enabled'));
    expect(publish).toContain('FOR UPDATE');
    expect(publish.indexOf('INSERT INTO public.whatsapp_bot_versions')).toBeLessThan(publish.indexOf('UPDATE public.whatsapp_bot_config'));
  });
});
