// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cleanupOrderFixtures } from '../../e2e/authenticated/helpers/order-cleanup';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
const third = '11111111-1111-4111-8111-111111111111', service = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CI', ''); vi.stubEnv('E2E_SUPABASE_URL', 'http://127.0.0.1:55321'); vi.stubEnv('E2E_DATABASE_CONTAINER', 'supabase_db_MovieTime-Automation-Verification'); });
afterEach(() => vi.unstubAllEnvs());
it('tears down only known fixture ids in one transaction, child relations before parents', () => {
  cleanupOrderFixtures(third, service);
  expect(execFileSync).toHaveBeenCalledWith('docker', ['exec', '-i', 'supabase_db_MovieTime-Automation-Verification', 'psql', '-U', 'postgres', '-d', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], expect.any(Object));
  const sql = vi.mocked(execFileSync).mock.calls[0][2]?.input;
  expect(typeof sql).toBe('string');
  expect(sql).toContain(`WHERE p.tercero_id='${third}'`);
  expect(sql).toContain(`i.servicio_id<>'${service}'`);
  expect(String(sql).indexOf('DELETE FROM public.pedido_items')).toBeLessThan(String(sql).indexOf('DELETE FROM public.pedidos'));
  expect(sql).not.toContain('GRANT');
});
it('refuses untrusted ids, remote hosts and local containers outside the isolated project', () => {
  expect(() => cleanupOrderFixtures("';DELETE FROM ventas;", service)).toThrow('UUID');
  vi.stubEnv('E2E_SUPABASE_URL', 'https://example.supabase.co');
  expect(() => cleanupOrderFixtures(third, service)).toThrow('local');
  vi.stubEnv('E2E_SUPABASE_URL', 'http://localhost:55321');
  vi.stubEnv('E2E_DATABASE_CONTAINER', 'supabase_db_MovieTime-V3');
  expect(() => cleanupOrderFixtures(third, service)).toThrow('aislado');
  vi.stubEnv('E2E_DATABASE_CONTAINER', 'supabase_db_bad; command');
  expect(() => cleanupOrderFixtures(third, service)).toThrow('inválido');
  expect(execFileSync).not.toHaveBeenCalled();
});
it('supports the standard local CI container and suppresses database diagnostics in errors', () => {
  vi.stubEnv('CI', 'true'); vi.stubEnv('E2E_DATABASE_CONTAINER', '');
  // An explicit empty container is rejected rather than silently selecting another database.
  expect(() => cleanupOrderFixtures(third, service)).toThrow('inválido');
  vi.stubEnv('E2E_DATABASE_CONTAINER', 'supabase_db_MovieTime-V3');
  vi.mocked(execFileSync).mockImplementationOnce(() => { throw new Error('private database diagnostics'); });
  expect(() => cleanupOrderFixtures(third, service)).toThrow('No se pudieron limpiar');
});
