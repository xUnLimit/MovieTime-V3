import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(join(process.cwd(), 'supabase/migrations', name), 'utf8');
const sql = read('20261004010000_pedido_payment_reconciliation.sql');
const audit = read('20261004011000_security_audit_pedido_payments.sql').replace(/^--.*$/gm, '');

describe('pedido payment reconciliation migration contract', () => {
  it('keeps the claim RPC service_role only with a safe search_path', () => {
    expect(sql).toMatch(/CREATE FUNCTION public\.reclamar_pago_yappy_para_pedido[\s\S]+SECURITY DEFINER SET search_path = pg_catalog, public/);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.reclamar_pago_yappy_para_pedido(uuid, text, uuid, text, boolean)\n  FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.reclamar_pago_yappy_para_pedido(uuid, text, uuid, text, boolean) TO service_role;");
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.reclamar_pago_yappy_para_pedido[^;]*authenticated/);
  });

  it('enables RLS on every new table and never grants writes to authenticated', () => {
    expect(sql).toContain('ALTER TABLE public.intentos_comprobante ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('ALTER TABLE public.pedido_pago_ajustes ENABLE ROW LEVEL SECURITY;');
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|DELETE)[^;]*intentos_comprobante[^;]*TO authenticated/);
  });

  it('emits events without phone numbers or codes', () => {
    const payloads = sql.match(/emit_domain_event\([\s\S]+?\)\);/g) ?? [];
    expect(payloads.length).toBeGreaterThanOrEqual(3);
    for (const call of payloads) expect(call).not.toMatch(/wa_id|p_wa|confirmation_code|v_code/);
  });

  it('registers the new tables in the consolidated security audit without new authenticated definers', () => {
    expect(audit).toContain("('pedido_pago_ajustes'), ('intentos_comprobante')");
    expect(audit).not.toContain('reclamar_pago_yappy_para_pedido');
    expect(audit).toContain("('crear_pedido'), ('confirmar_pedido'), ('cancelar_pedido'), ('expirar_pedidos')");
  });
});
