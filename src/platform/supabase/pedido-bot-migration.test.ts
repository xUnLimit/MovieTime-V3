import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261005010000_pedido_payment_bot_settings.sql'), 'utf8');
const functions = ['obtener_ajustes_pago_bot()', 'obtener_pedido_para_bot(uuid)', 'reclamar_recordatorios_pedido(integer)',
  'cerrar_recordatorio_pedido(uuid, text, text)'];

describe('pedido bot settings migration contract', () => {
  it('keeps every new function service_role only with a safe search_path and a role guard', () => {
    expect((sql.match(/SECURITY DEFINER SET search_path = pg_catalog, public/g) ?? []).length).toBe(functions.length);
    expect((sql.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g) ?? []).length).toBe(functions.length);
    for (const signature of functions) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`);
    }
    expect(sql).not.toMatch(/GRANT[^;]*TO[^;]*(authenticated|anon)/);
  });

  it('is additive: no new tables, no drops, defaults on every new column', () => {
    expect(sql).not.toMatch(/CREATE TABLE|DROP |RENAME /i);
    expect(sql).toContain("DEFAULT '{}'::jsonb");
    expect(sql).toContain('recordatorio_horas integer NOT NULL DEFAULT 2');
  });

  it('claims reminders at most once and only from the pending state', () => {
    expect(sql).toContain("recordatorio_estado IS NULL");
    expect(sql).toContain("SET recordatorio_estado = 'pendiente'");
    expect(sql).toContain("recordatorio_estado = 'pendiente'");
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
  });
});
