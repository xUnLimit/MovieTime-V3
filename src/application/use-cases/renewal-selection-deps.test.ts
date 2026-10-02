import { describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database.types';
import type { NoticeRecord } from '@/modules/messaging/notice-store';
const { snapshots, createOrder } = vi.hoisted(() => ({ snapshots: vi.fn(), createOrder: vi.fn() }));
vi.mock('@/platform/supabase/renewal-selection-repository', () => ({ createRenewalSelectionRepository: () => ({
  snapshots, settings: vi.fn(), ownsCustomer: vi.fn(), readOrder: vi.fn(),
}) }));
vi.mock('@/platform/supabase/renewal-selection-rpc-adapter', () => ({ createRenewalSelectionOrderRpc: createOrder }));
import { createRenewalSelectionDeps } from './renewal-selection-deps';
const id = '10000000-0000-4000-8000-000000000001';
const notice: NoticeRecord = { id, dedupe_key: 'test', tipo: 'dia_pago', tercero_id: id,
  wa_id: '50760000000', channel: 'text', meta_template_name: null, fecha_vencimiento: '2026-10-02',
  origin: 'manual', status: 'accepted', skip_reason: null, idempotency_key: id, outbound_message_id: null,
  wa_message_id: null, created_by: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z' };
function fixture() {
  const snapshot = {
    venta: { id, cliente_id: id, perfil_nombre: null, estado: 'activo', archivado_at: null, cortada_at: null, respuesta_cliente: null },
    period: { id, fecha_fin: '2026-10-02', ciclo_pago: 'mensual', precio_original: 5, moneda_original: 'USD' },
    service: { nombre: 'Servicio', activo: true, en_reposo: false, cortado_at: null, archivado_at: null },
  };
  snapshots.mockResolvedValue([snapshot]);
  const client = createClient<Database>('https://fixture.invalid', 'fixture', { auth: { persistSession: false } });
  const deps = createRenewalSelectionDeps(client, { replies: {
    findNotice: vi.fn(), ventaIds: vi.fn(), declineVentas: vi.fn(),
  }, exchangeRate: vi.fn(), notifyAdmins: vi.fn() });
  return { deps, snapshot };
}
describe('renewal composition and eligibility', () => {
  it('maps last-period prices and leaves eligibility decisions in the use-case layer', async () => {
    const { deps } = fixture();
    expect(await deps.loadItems(notice, [id])).toEqual([{ ventaId: id, clienteId: id, periodId: id,
      servicio: 'Servicio', perfil: '', vencimiento: '2026-10-02', ciclo: 'mensual', precio: 5, moneda: 'USD', reason: null }]);
    expect(deps.createOrder).toBe(createOrder);
    expect(deps.now()).toBeInstanceOf(Date);
  });
  it.each([
    [{ archivado_at: 'date' }, {}, {}, 'archived'], [{}, { archivado_at: 'date' }, {}, 'archived'],
    [{ cortada_at: 'date' }, {}, {}, 'cut'], [{}, { cortado_at: 'date' }, {}, 'cut'],
    [{}, { en_reposo: true }, {}, 'paused'], [{ respuesta_cliente: 'no_continuar' }, {}, {}, 'declined'],
    [{}, {}, { fecha_fin: '2026-11-02' }, 'renewed'], [{ estado: 'inactivo' }, {}, {}, 'unavailable'],
    [{}, { activo: false }, {}, 'unavailable'],
  ])('reports an exclusion for snapshot changes %j', async (sale, service, period, reason) => {
    const { deps, snapshot } = fixture();
    snapshots.mockResolvedValue([{ venta: { ...snapshot.venta, ...sale }, service: { ...snapshot.service, ...service }, period: { ...snapshot.period, ...period } }]);
    expect((await deps.loadItems(notice, [id]))[0].reason).toBe(reason);
  });
  it('does not invent prices for missing sale, period or service data', async () => {
    const { deps, snapshot } = fixture();
    for (const missing of [{ ...snapshot, period: undefined }, { ...snapshot, service: undefined },
      { ...snapshot, venta: { ...snapshot.venta, cliente_id: null } }]) {
      snapshots.mockResolvedValue([missing]);
      expect(await deps.loadItems(notice, [id])).toEqual([]);
    }
  });
});
