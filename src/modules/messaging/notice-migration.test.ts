import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260928130000_whatsapp_notices.sql'), 'utf8');

describe('WhatsApp notice migration access rules', () => {
  it('enables RLS and gives authenticated users read-only admin access', () => {
    for (const table of ['whatsapp_notices', 'whatsapp_notice_ventas']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY ${table}_admin_read`);
    }
    expect(sql).toContain("(SELECT private.auth_role()) = 'admin'");
    expect(sql).toContain('WHERE u.id = auth.uid() AND u.active');
    expect(sql).toContain('REVOKE ALL ON public.whatsapp_notices, public.whatsapp_notice_ventas FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT SELECT ON public.whatsapp_notices, public.whatsapp_notice_ventas TO authenticated');
    expect(sql).not.toMatch(/GRANT (?:INSERT|UPDATE|DELETE).*TO authenticated/);
  });
  it('restricts the atomic reservation function to the service role', () => {
    expect(sql).toContain("LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''");
    expect(sql).toContain('ON CONFLICT (dedupe_key) DO UPDATE');
    expect(sql).toContain("WHERE public.whatsapp_notices.status IN ('failed', 'skipped') AND p_origin = 'manual'");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.reserve_whatsapp_notice[\s\S]+FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reserve_whatsapp_notice[\s\S]+TO service_role/);
  });
});
