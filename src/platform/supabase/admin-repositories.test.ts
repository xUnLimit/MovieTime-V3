import { beforeEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('./client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
import { catalogAdminRepository } from './catalog-admin-repository';
import { conversationControlRepository } from './conversation-control-repository';
class QueryBuilder {
  select = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  eq = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  in = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  order = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  range = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  update = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  insert = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  single = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  maybeSingle = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  abortSignal = vi.fn<(...args: unknown[]) => QueryBuilder>(() => this);
  constructor(private readonly responses: unknown[], private readonly error: unknown) {}
  then(resolve: (result: { data: unknown; error: unknown }) => unknown) {
    return Promise.resolve({ data: this.responses.length > 1 ? this.responses.shift() : this.responses[0], error: this.error }).then(resolve);
  }
}
function query(data: unknown = [], error: unknown = null, additionalPages: unknown[] = []) {
  return new QueryBuilder([data, ...additionalPages], error);
}
beforeEach(() => { vi.clearAllMocks(); });
it('reads all sources with bounded requests and surfaces public errors', async () => {
  const builder = query(); mocks.from.mockReturnValue(builder); mocks.rpc.mockReturnValue(builder);
  expect(await catalogAdminRepository.load()).toMatchObject({ interests: [], availability: [] });
  expect(mocks.from).toHaveBeenCalledWith('v_demanda_sin_stock');
  expect(builder.range).toHaveBeenCalledWith(0, 499);
  const failed = query(null, { message: 'private SQL detail' }); mocks.from.mockReturnValueOnce(failed);
  await expect(catalogAdminRepository.load()).rejects.toThrow('No se pudo cargar');
});
it('paginates rather than silently clipping the queue at the API limit', async () => {
  const builder = query(); mocks.from.mockReturnValue(builder); mocks.rpc.mockReturnValue(builder);
  const page = query(Array.from({ length: 500 }, (_, id) => ({ id })), null, [[]]);
  mocks.from.mockImplementation(table => table === 'intereses' ? page : builder);
  expect((await catalogAdminRepository.load()).interests).toHaveLength(500);
  expect(page.range).toHaveBeenLastCalledWith(500, 999);
});
it('writes existing/new configs and limits queue updates to actionable states', async () => {
  const builder = query({ id: 'row' }); mocks.from.mockReturnValue(builder);
  await catalogAdminRepository.saveSettings({ reserva_ttl_minutos: 45 });
  await catalogAdminRepository.saveConfig({ categoria_id: 'category' });
  expect(builder.insert).toHaveBeenCalledWith({ categoria_id: 'category' });
  await catalogAdminRepository.saveConfig({ id: 'config', categoria_id: 'category' });
  expect(builder.eq).toHaveBeenCalledWith('id', 'config');
  await catalogAdminRepository.closeInterest('interest', 'descartado');
  expect(builder.in).toHaveBeenCalledWith('estado', ['esperando', 'avisado']);
  expect(builder.update).toHaveBeenLastCalledWith({ estado: 'descartado' });
  mocks.from.mockReturnValueOnce(query(null));
  await expect(catalogAdminRepository.saveSettings({})).rejects.toThrow();
});
it('validates ownership reads, missing states and both RPC results without accepting false', async () => {
  mocks.from.mockReturnValueOnce(query({ owner: 'bot' })).mockReturnValueOnce(query(null)).mockReturnValueOnce(query({ owner: 'invalid' })).mockReturnValueOnce(query(null, { message: 'internal' }));
  expect(await conversationControlRepository.owner('50760000001')).toBe('bot');
  expect(await conversationControlRepository.owner('50760000001')).toBeNull();
  await expect(conversationControlRepository.owner('50760000001')).rejects.toThrow();
  await expect(conversationControlRepository.owner('50760000001')).rejects.toThrow('No se pudo consultar');
  await expect(conversationControlRepository.owner('bad')).rejects.toThrow();
  mocks.rpc.mockReturnValue(query(true));
  await conversationControlRepository.change('50760000001', 'humano');
  expect(mocks.rpc).toHaveBeenCalledWith('take_over_conversation', { p_wa_id: '50760000001' });
  await conversationControlRepository.change('50760000001', 'bot');
  expect(mocks.rpc).toHaveBeenLastCalledWith('hand_back_conversation', { p_wa_id: '50760000001' });
  mocks.rpc.mockReturnValueOnce(query(false)).mockReturnValueOnce(query(null, { message: 'secret' }));
  await expect(conversationControlRepository.change('50760000001', 'bot')).rejects.toThrow('No se pudo cambiar');
  await expect(conversationControlRepository.change('50760000001', 'humano')).rejects.toThrow('No se pudo cambiar');
});
it('migration grants only the state column with admin checks on both sides', () => {
  const sql = readFileSync('supabase/migrations/20261004050000_admin_interest_updates.sql', 'utf8');
  expect(sql).toContain('GRANT UPDATE (estado)');
  expect(sql).toContain("USING ((SELECT private.auth_role()) = 'admin')");
  expect(sql).toContain("WITH CHECK ((SELECT private.auth_role()) = 'admin')");
});
