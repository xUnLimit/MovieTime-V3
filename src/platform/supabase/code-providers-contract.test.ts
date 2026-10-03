import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertCodeAccess } from '@/modules/code-providers';
import { getServicioTableUpdates } from '@/application/use-cases/servicios/servicios-shared';
import { mapReadRow } from './read-models';
import { ENTITIES } from './entities';
import { vi } from 'vitest';
vi.mock('./client', () => ({ supabase: {} }));
const sql = readFileSync('supabase/migrations/20261003045000_code_providers.sql', 'utf8').replaceAll('\r\n', '\n');
describe('code provider DB contracts', () => {
  it('maps and persists the flag without treating it as a payment-period property', () => {
    expect(mapReadRow(ENTITIES.SERVICIOS, { acceso_por_codigo: true })).toMatchObject({ accesoPorCodigo: true });
    expect(mapReadRow(ENTITIES.SERVICIOS, {})).toMatchObject({ accesoPorCodigo: false });
    expect(mapReadRow(ENTITIES.VENTAS, { acceso_por_codigo: true, servicio_contrasena: 'never-deliver' })).toMatchObject({ accesoPorCodigo: true, servicioContrasena: '' });
    expect(getServicioTableUpdates({ accesoPorCodigo: false, costoServicio: 10 })).toEqual({ accesoPorCodigo: false });
    expect(() => assertCodeAccess(true, null)).toThrow();
  });
  it('is expand only with RLS, scoped backfill and service-role writes', () => {
    expect(sql).toContain('ADD COLUMN acceso_por_codigo boolean NOT NULL DEFAULT false');
    expect(sql).toContain("WHERE nombre ILIKE '%netflix%'");
    expect(sql).toContain('PRIMARY KEY (provider, mail_key)');
    expect(sql).toContain('ALTER TABLE public.code_claims ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FOR SELECT TO authenticated');
    expect(sql).toContain("private.auth_role()) = 'admin'");
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.code_claims TO service_role');
    expect(sql).toContain("SELECT 'netflix', mail_key, wa_id, created_at FROM public.netflix_code_claims");
    expect(sql).not.toMatch(/(?:DROP|ALTER|UPDATE|DELETE FROM) (?:TABLE )?public\.netflix_code_claims/i);
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN|FUNCTION)/i);
  });
  it('guards both sides of the category invariant and reuses the payment transaction', () => {
    expect(sql).toContain('FOR SHARE');
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF categoria_id, acceso_por_codigo');
    expect(sql).toContain('BEFORE UPDATE OF code_provider');
    expect(sql).toContain('NEW.code_provider IS NULL AND EXISTS');
    expect(sql.match(/SECURITY DEFINER SET search_path = pg_catalog, public/g)).toHaveLength(2);
    expect(sql).toContain('v_id := public.create_servicio_with_initial_payment(');
    expect(sql).toContain('IF v_id IS NOT NULL THEN RETURN v_id; END IF;');
    expect(sql).toContain('SET acceso_por_codigo = COALESCE(p_acceso_por_codigo, false)');
  });
  it('appends the view columns without expanding newly added table columns in place', () => {
    expect(sql).toContain('vp_last.plan_id AS ultimo_plan_id,\n  s.acceso_por_codigo\nFROM public.ventas v');
    expect(sql).toContain('AS perfiles_libres,\n  s.acceso_por_codigo\nFROM servicios s');
    expect(sql).not.toMatch(/SELECT\s+[vs]\.\*,/);
    expect(sql).toContain('WITH (security_invoker = true)');
    expect(sql).toContain('LEFT JOIN public.terceros u ON u.id = v.cliente_id');
  });
});
