import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServiceRoleClient = vi.hoisted(() => vi.fn());
vi.mock('@/platform/server/supabase-server', () => ({ createServiceRoleClient }));
import { createNoticeStore } from './notice-store';

const ID = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';
const notice = { id: ID2, status: 'pending', idempotency_key: ID };
const responses = new Map<string, { data: unknown; error: { code: string } | null }>();
const calls: { table: string; operation: string; args: unknown[] }[] = [];
function query(table: string) {
  let operation = 'select';
  const builder = {
    select(...args: unknown[]) { calls.push({ table, operation, args }); return builder; },
    in(...args: unknown[]) { calls.push({ table, operation: 'in', args }); return builder; },
    eq(...args: unknown[]) { calls.push({ table, operation: 'eq', args }); return builder; },
    not(...args: unknown[]) { calls.push({ table, operation: 'not', args }); return builder; },
    order(...args: unknown[]) { calls.push({ table, operation: 'order', args }); return builder; },
    limit(...args: unknown[]) { calls.push({ table, operation: 'limit', args }); return builder; },
    maybeSingle() { return Promise.resolve(responses.get(table) ?? { data: null, error: null }); },
    update(...args: unknown[]) { operation = 'update'; calls.push({ table, operation, args }); return builder; },
    then(resolve: (value: { data: unknown; error: { code: string } | null }) => unknown) {
      return Promise.resolve(resolve(responses.get(table) ?? { data: null, error: null }));
    },
  };
  return builder;
}
beforeEach(() => {
  calls.length = 0; responses.clear();
  createServiceRoleClient.mockReturnValue({ from: (table: string) => query(table),
    rpc: vi.fn(async () => ({ data: notice, error: null })) });
});

describe('notice store Supabase adapter', () => {
  it('maps latest sale data, service state, refunds, promises and customer reply', async () => {
    responses.set('v_ventas_full', { data: [{
      id: ID, cliente_id: ID2, cliente_nombre: 'Ana Perez', cliente_telefono: '6000-0000',
      categoria_nombre: 'Netflix', servicio_nombre: 'Netflix A', perfil_nombre: 'Ana',
      servicio_correo: 'private@example.com', servicio_contrasena: 'secret', codigo: '1234',
      ultima_fecha_fin: '2026-09-28', ultimo_total_original: 10, ultima_moneda: 'USD',
      estado: 'activo', servicio_id: 'service', ultimo_periodo_id: 'period',
    }], error: null });
    responses.set('servicios', { data: [{ id: 'service', en_reposo: true, activo: true }], error: null });
    responses.set('v_notificaciones_venta', { data: [
      { venta_id: ID, fecha_prometida_pago: '2026-09-29' },
      { venta_id: ID, fecha_prometida_pago: '2026-09-30' },
      { venta_id: ID, fecha_prometida_pago: '2026-09-28' },
    ], error: null });
    responses.set('pagos_venta', { data: [{ venta_periodo_id: 'period', estado: 'reembolsado' }], error: null });
    responses.set('ventas', { data: [{ id: ID, respuesta_cliente: 'no_continuar' }], error: null });
    const rows = await createNoticeStore().loadVentas([ID]);
    expect(rows).toMatchObject([{ ventaId: ID, clienteId: ID2, activa: true,
      reembolsada: true, enReposo: true, respuestaCliente: 'no_continuar',
      moneda: 'USD', contrasena: 'secret' }]);
    expect(rows[0].fechaVencimiento?.getFullYear()).toBe(2026);
    expect(rows[0].promesaPagoHasta?.getDate()).toBe(30);
    expect(calls).toContainEqual({ table: 'pagos_venta', operation: 'eq', args: ['estado', 'reembolsado'] });
  });
  it('handles absent sales, inactive service and absent period', async () => {
    responses.set('v_ventas_full', { data: [], error: null });
    expect(await createNoticeStore().loadVentas([ID])).toEqual([]);
    expect(calls.some((call) => call.table === 'servicios')).toBe(false);
  });
  it('uses safe defaults for sparse historical rows and skips sales without clients', async () => {
    responses.set('v_ventas_full', { data: [
      { id: null, cliente_id: ID },
      { id: ID2, cliente_id: null },
      { id: ID, cliente_id: ID2, cliente_nombre: null, cliente_telefono: null,
        categoria_nombre: null, servicio_nombre: null, perfil_nombre: null,
        servicio_correo: null, servicio_contrasena: null, codigo: null,
        ultima_fecha_fin: null, ultimo_total_original: null, ultima_moneda: null,
        estado: 'inactivo', servicio_id: null, ultimo_periodo_id: null },
    ], error: null });
    const rows = await createNoticeStore().loadVentas([ID, ID2]);
    expect(rows).toMatchObject([{ ventaId: ID, clienteNombre: '', telefono: '', monto: 0,
      moneda: '', activa: false, reembolsada: false, enReposo: false,
      fechaVencimiento: null, promesaPagoHasta: null, respuestaCliente: null }]);
    expect(calls.some((call) => call.table === 'pagos_venta')).toBe(false);
  });
  it('reads editor template actions and rejects malformed configuration', async () => {
    responses.set('templates', { data: { contenido: 'Hola', meta_template_name: 'aviso',
      meta_param_map: ['saludo_nombre'], meta_button_actions: ['RENOVAR', 'NINGUNA'] }, error: null });
    expect(await createNoticeStore().loadTemplate('dia_pago')).toEqual({ contenido: 'Hola',
      metaTemplateName: 'aviso', metaParamMap: ['saludo_nombre'], metaButtonActions: ['RENOVAR', 'NINGUNA'] });
    expect(calls).toContainEqual({ table: 'templates', operation: 'select',
      args: ['contenido,meta_template_name,meta_param_map,meta_button_actions'] });
    responses.set('templates', { data: { contenido: 'Hola', meta_template_name: 'aviso',
      meta_param_map: { bad: true }, meta_button_actions: [] }, error: null });
    await expect(createNoticeStore().loadTemplate('dia_pago')).rejects.toThrow();
    responses.set('templates', { data: { contenido: 'Hola', meta_template_name: 'aviso',
      meta_param_map: [], meta_button_actions: ['INVALID'] }, error: null });
    await expect(createNoticeStore().loadTemplate('dia_pago')).rejects.toThrow();
    responses.set('templates', { data: null, error: null });
    expect(await createNoticeStore().loadTemplate('dia_pago')).toBeNull();
  });
  it('detects ambiguity through the canonical terceros.wa_id column', async () => {
    responses.set('terceros', { data: [{ id: ID }, { id: ID2 }], error: null });
    expect(await createNoticeStore().isAmbiguousPhone('50760000000', ID)).toBe(true);
    expect(calls).toContainEqual({ table: 'terceros', operation: 'eq', args: ['wa_id', '50760000000'] });
    expect(calls).toContainEqual({ table: 'terceros', operation: 'eq', args: ['active', true] });
    expect(calls).toContainEqual({ table: 'terceros', operation: 'limit', args: [2] });
    responses.set('terceros', { data: [{ id: ID }], error: null });
    expect(await createNoticeStore().isAmbiguousPhone('50760000000', ID)).toBe(false);
    responses.set('terceros', { data: null, error: null });
    expect(await createNoticeStore().isAmbiguousPhone('50760000000', ID)).toBe(false);
  });
  it('reads last inbound, reserves and finishes a notice', async () => {
    responses.set('whatsapp_inbound_messages', { data: { sent_at: '2026-09-28T13:00:00Z' }, error: null });
    const store = createNoticeStore();
    expect(await store.lastInboundAt('50760000000')).toBe('2026-09-28T13:00:00Z');
    const saved = await store.reserve({ dedupeKey: 'key', tipo: 'dia_pago', terceroId: ID,
      waId: '50760000000', channel: 'template', metaTemplateName: 'aviso',
      fechaVencimiento: '2026-09-28', origin: 'manual', idempotencyKey: ID,
      createdBy: ID, ventaIds: [ID] });
    expect(saved.id).toBe(ID2);
    expect(createServiceRoleClient.mock.results.at(-1)?.value.rpc).toHaveBeenCalledWith('reserve_whatsapp_notice', expect.objectContaining({ p_venta_ids: [ID] }));
    await store.finish(ID2, 'accepted', ID, 'wamid.1');
    expect(calls).toContainEqual({ table: 'whatsapp_notices', operation: 'update', args: [{ status: 'accepted', outbound_message_id: ID, wa_message_id: 'wamid.1', skip_reason: null }] });
    responses.set('whatsapp_inbound_messages', { data: null, error: null });
    expect(await store.lastInboundAt('50760000000')).toBeNull();
  });
  it('rejects an empty reservation result', async () => {
    createServiceRoleClient.mockReturnValue({ from: (table: string) => query(table),
      rpc: vi.fn(async () => ({ data: null, error: null })) });
    await expect(createNoticeStore().reserve({ dedupeKey: 'key', tipo: 'dia_pago', terceroId: ID,
      waId: '50760000000', channel: 'text', metaTemplateName: null,
      fechaVencimiento: null, origin: 'manual', idempotencyKey: ID,
      createdBy: ID, ventaIds: [ID] })).rejects.toThrow('reservation returned no row');
  });
  it('fails closed on database errors', async () => {
    responses.set('terceros', { data: null, error: { code: 'DB_ERR' } });
    await expect(createNoticeStore().isAmbiguousPhone('50760000000', ID)).rejects.toThrow('check phone ambiguity failed');
  });
});

it('never exposes a code-access password in current notice credential data', async () => {
  responses.set('v_ventas_full', { data: [{ id: ID, cliente_id: ID2, acceso_por_codigo: true,
    servicio_contrasena: 'never-send-this', servicio_correo: 'a@example.test' }], error: null });
  const rows = await createNoticeStore().loadVentas([ID]);
  expect(rows[0]).toMatchObject({ accesoPorCodigo: true, contrasena: '', correo: 'a@example.test' });
});
