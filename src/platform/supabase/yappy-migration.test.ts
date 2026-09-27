import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260927221000_yappy_payment_detection.sql'), 'utf8');

describe('Yappy detection migration', () => {
  it('keeps singleton UID state inaccessible to authenticated users and exposes a limited view', () => {
    expect(sql).toContain('ALTER TABLE public.yappy_mail_sync_state ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON public.yappy_mail_sync_state FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT SELECT (mailbox, last_synced_at, last_error_code) ON public.yappy_mail_sync_state TO authenticated');
    expect(sql).not.toMatch(/GRANT SELECT ON public\.yappy_mail_sync_state TO authenticated/i);
    expect(sql).toMatch(/CREATE VIEW public\.v_yappy_mail_sync_status\s+WITH \(security_invoker = true\)/);
    expect(sql).toMatch(/CREATE VIEW public\.v_yappy_candidate_ventas\s+WITH \(security_invoker = true\)/);
    expect(sql).toContain('GRANT SELECT ON public.v_yappy_mail_sync_status TO authenticated');
    expect(sql).toContain('UNIQUE (uid_validity, imap_uid)');
    expect(sql).toContain('WHERE u.id = auth.uid() AND u.active');
  });
  it('filters personal payments before any insert and counts every active customer sale', () => {
    const ingest = sql.slice(sql.indexOf('CREATE FUNCTION public.ingest_yappy_payment'), sql.indexOf('CREATE FUNCTION public.record_invalid_yappy_mail'));
    expect(ingest.indexOf('IF NOT EXISTS (')).toBeLessThan(ingest.indexOf('INSERT INTO public.yappy_mail_messages'));
    expect(ingest).toContain("WHERE t.active AND v.estado = 'activo'");
    expect(ingest).toContain("right(regexp_replace(t.telefono, '[^0-9]', '', 'g'), 4) = p_payer_phone_last4");
    expect(ingest).toContain("RETURN QUERY SELECT 'ignorado'::text");
    expect(ingest).toContain('ON CONFLICT (confirmation_code) DO NOTHING');
    expect(ingest).toContain('v_status := public.match_yappy_payment(v_payment_id)');
  });
  it('matches the latest period and retains all ambiguous candidates', () => {
    expect(sql).toContain('ORDER BY vp.numero_periodo DESC LIMIT 1');
    expect(sql).toContain('array_agg(v.id ORDER BY v.id)');
    expect(sql).toContain("last_period.moneda_original = 'USD'");
    expect(sql).toContain('v_days_before constant integer := 15');
    expect(sql).toContain('v_days_after constant integer := 7');
  });
  it('keeps final states immutable and never invokes the renewal RPC', () => {
    expect(sql).toContain("IF v_payment.match_status IN ('registrado', 'descartado') THEN RAISE EXCEPTION 'payment already resolved'");
    expect(sql).not.toContain('create_venta_payment');
  });
});
