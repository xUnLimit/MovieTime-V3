import { beforeEach, describe, expect, it, vi } from 'vitest';

const from = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ supabase: { from, rpc } }));
import { dismissYappyPayment, listYappyCandidateVentas, listYappyConnections, listYappyPayments, resolveYappyPayment, searchYappyCandidateVentas } from './yappy-repository';

const paymentId = '123e4567-e89b-12d3-a456-426614174002';
const ventaId = '123e4567-e89b-12d3-a456-426614174004';
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: 'registrado', error: null });
});

describe('Yappy Supabase repository', () => {
  it('maps recent payments without exposing mail bodies', async () => {
    from.mockReturnValue({ select: () => ({ order: () => ({ limit: async () => ({ data: [{
      id: paymentId, confirmation_code: 'GZCSS-20613095', amount: 2, payer_name_short: 'E. S.',
      payer_phone_last4: '0268', paid_at: '2026-09-27T18:07:00Z', match_status: 'match_unico',
      candidate_venta_ids: [ventaId], matched_venta_id: null,
    }], error: null }) }) }) });
    expect(await listYappyPayments()).toEqual([{ id: paymentId, confirmationCode: 'GZCSS-20613095', amount: 2,
      payerNameShort: 'E. S.', payerPhoneLast4: '0268', paidAt: '2026-09-27T18:07:00Z',
      matchStatus: 'match_unico', candidateVentaIds: [ventaId], matchedVentaId: null }]);
  });
  it('drops malformed view rows and maps safe sale labels', async () => {
    from.mockImplementation((table: string) => table === 'v_yappy_mail_sync_status' ? {
      select: async () => ({ data: [{ mailbox: null, status: null },
        { mailbox: 'owner@gmail.com', status: 'configurado', last_synced_at: null, last_error_code: null }], error: null }),
    } : { select: () => ({ order: () => ({ limit: async () => ({ data: [{ id: ventaId, cliente: 'Ana', servicio: 'Netflix',
      perfil_nombre: null, perfil_numero: 1, fecha_fin: '2026-10-01', total_original: 2 }], error: null }) }) }) });
    expect(await listYappyConnections()).toEqual([{ mailbox: 'owner@gmail.com', status: 'configurado', lastSyncedAt: null, lastErrorCode: null }]);
    expect(await listYappyCandidateVentas()).toEqual([{ id: ventaId, cliente: 'Ana', servicio: 'Netflix', perfil: 'Perfil 1', fechaFin: '2026-10-01', precio: 2 }]);
  });
  it('validates identifiers before calling admin RPCs', async () => {
    await expect(resolveYappyPayment('bad', ventaId)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    await resolveYappyPayment(paymentId, ventaId);
    await dismissYappyPayment(paymentId, 'Aviso duplicado');
    expect(rpc).toHaveBeenCalledWith('resolve_yappy_payment', { p_payment_id: paymentId, p_venta_id: ventaId });
    expect(rpc).toHaveBeenCalledWith('dismiss_yappy_payment', { p_payment_id: paymentId, p_note: 'Aviso duplicado' });
  });
  it('returns empty lists for no rows and propagates read failures', async () => {
    from.mockImplementation((table: string) => table === 'v_yappy_mail_sync_status' ?
      { select: async () => ({ data: null, error: null }) } : { select: () => ({ order: () => ({
        data: null, error: null, limit: async () => ({ data: null, error: null }),
      }) }) });
    expect(await listYappyPayments()).toEqual([]);
    expect(await listYappyConnections()).toEqual([]);
    expect(await listYappyCandidateVentas()).toEqual([]);
    from.mockImplementation((table: string) => table === 'v_yappy_mail_sync_status' ?
      { select: async () => ({ data: null, error: new Error('read failed') }) } : { select: () => ({ order: () => ({
        data: null, error: new Error('read failed'), limit: async () => ({ data: null, error: new Error('read failed') }),
      }) }) });
    await expect(listYappyPayments()).rejects.toThrow('read failed');
    await expect(listYappyConnections()).rejects.toThrow('read failed');
    await expect(listYappyCandidateVentas()).rejects.toThrow('read failed');
  });
  it('uses safe defaults for nullable sale labels and propagates write failures', async () => {
    from.mockReturnValue({ select: () => ({ order: () => ({ limit: async () => ({ data: [
      { id: null }, { id: ventaId, cliente: null, servicio: null, perfil_nombre: null,
        perfil_numero: null, fecha_fin: null, total_original: null },
    ], error: null }) }) }) });
    expect(await listYappyCandidateVentas()).toEqual([{ id: ventaId, cliente: '', servicio: '', perfil: '—', fechaFin: '', precio: 0 }]);
    rpc.mockResolvedValueOnce({ data: null, error: new Error('resolution failed') });
    await expect(resolveYappyPayment(paymentId, ventaId)).rejects.toThrow('resolution failed');
    rpc.mockResolvedValueOnce({ data: null, error: new Error('dismissal failed') });
    await expect(dismissYappyPayment(paymentId, 'reason')).rejects.toThrow('dismissal failed');
  });
  it('loads suggested sales even when they fall outside the manual search window', async () => {
    from.mockReturnValue({ select: () => ({
      order: () => ({ limit: async () => ({ data: [], error: null }) }),
      in: async (_field: string, ids: string[]) => ({ data: ids.map((id) => ({ id, cliente: 'Ana', servicio: 'Netflix',
        perfil_nombre: 'Principal', perfil_numero: null, fecha_fin: '2026-10-01', total_original: 2 })), error: null }),
    }) });
    const rows = await listYappyCandidateVentas([ventaId, ventaId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(ventaId);
  });
  it('searches all active sales by client, service or ID and deduplicates results', async () => {
    from.mockReturnValue({ select: () => ({
      ilike: () => ({ limit: async () => ({ data: [{ id: ventaId, cliente: 'Ana', servicio: 'Netflix',
        perfil_nombre: 'Principal', fecha_fin: '2026-10-01', total_original: 2 }], error: null }) }),
      eq: () => ({ limit: async () => ({ data: [{ id: ventaId, cliente: 'Ana', servicio: 'Netflix',
        perfil_nombre: 'Principal', fecha_fin: '2026-10-01', total_original: 2 }], error: null }) }),
    }) });
    expect(await searchYappyCandidateVentas('Ana')).toHaveLength(1);
    expect(await searchYappyCandidateVentas(ventaId)).toHaveLength(1);
    expect(await searchYappyCandidateVentas('%')).toEqual([]);
  });
});
