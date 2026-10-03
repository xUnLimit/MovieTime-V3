import { describe, expect, it, vi } from 'vitest';
import { createBotPurchaseStore, PurchaseRejection } from './bot-purchase-store';

const WA = '50760000000';
const PLAN = '11111111-1111-4111-8111-111111111111';
const ORDER = '22222222-2222-4222-8222-222222222222';
const SALE = '33333333-3333-4333-8333-333333333333';
const KEY = '44444444-4444-4444-8444-444444444444';

function make(data: unknown, error: { message?: string } | null = null) {
  const rpc = vi.fn(async () => ({ data, error }));
  return { store: createBotPurchaseStore({ rpc } as unknown as Parameters<typeof createBotPurchaseStore>[0]), rpc };
}
const row = (patch: Record<string, unknown> = {}) => ({ venta_id: SALE, servicio_id: SALE, servicio: 'Netflix', categoria: 'Netflix',
  correo: 'a@example.test', perfil: 'Ana', pin: '1', acceso_por_codigo: false, proveedor_codigo: null, contrasena: 'pw', ...patch });

describe('bot purchase store', () => {
  it('loads settings merging valid message overrides and rejecting malformed settings', async () => {
    const ok = make({ max_servicios: 4, mensajes: { cancelled: 'Cancelado', cart: '{{nope}}' } });
    const settings = await ok.store.settings();
    expect(settings.maxItems).toBe(4);
    expect(settings.messages.cancelled).toBe('Cancelado');
    expect(settings.messages.cart).toContain('{{servicios}}');
    expect(ok.rpc).toHaveBeenCalledWith('obtener_ajustes_compra_bot', {});
    await expect(make({ max_servicios: 0, mensajes: {} }).store.settings()).rejects.toThrow();
    await expect(make(null).store.settings()).rejects.toThrow();
  });

  it('reserves a profile: returns the hold, null when none is free, and validates input and output', async () => {
    const hold = { id: PLAN, servicio: 'Netflix', perfil: 2, vence: '2026-10-05T00:00:00Z' };
    const ok = make([hold]);
    expect(await ok.store.reserve(WA, PLAN)).toEqual(hold);
    expect(ok.rpc).toHaveBeenCalledWith('reservar_perfil_para_plan', { p_wa_id: WA, p_plan_id: PLAN });
    expect(await make([]).store.reserve(WA, PLAN)).toBeNull();
    await expect(make([hold, hold]).store.reserve(WA, PLAN)).rejects.toThrow();
    await expect(make([{ ...hold, perfil: 0 }]).store.reserve(WA, PLAN)).rejects.toThrow();
    const untouched = make([]);
    await expect(untouched.store.reserve('abc', PLAN)).rejects.toThrow();
    await expect(untouched.store.reserve(WA, 'no-uuid')).rejects.toThrow();
    expect(untouched.rpc).not.toHaveBeenCalled();
  });

  it('creates an order with validated ids and key and requires a uuid back', async () => {
    const ok = make(ORDER);
    expect(await ok.store.createOrder(WA, [PLAN], KEY)).toBe(ORDER);
    expect(ok.rpc).toHaveBeenCalledWith('crear_pedido_compra_bot', { p_wa_id: WA, p_plan_ids: [PLAN], p_idempotency_key: KEY });
    await expect(make('no-uuid').store.createOrder(WA, [PLAN], KEY)).rejects.toThrow();
    await expect(ok.store.createOrder(WA, ['x'], KEY)).rejects.toThrow();
    await expect(ok.store.createOrder(WA, [PLAN], 'k')).rejects.toThrow();
  });

  it('releases with or without an order and validates the count', async () => {
    const ok = make(2);
    expect(await ok.store.release(WA)).toBe(2);
    expect(ok.rpc).toHaveBeenLastCalledWith('liberar_compra_bot', { p_wa_id: WA, p_pedido_id: null });
    await ok.store.release(WA, ORDER);
    expect(ok.rpc).toHaveBeenLastCalledWith('liberar_compra_bot', { p_wa_id: WA, p_pedido_id: ORDER });
    await expect(make(-1).store.release(WA)).rejects.toThrow();
    await expect(ok.store.release(WA, 'x')).rejects.toThrow();
  });

  it('lists the sales of an order and validates uuids', async () => {
    const ok = make([SALE]);
    expect(await ok.store.orderSales(WA, ORDER)).toEqual([SALE]);
    expect(ok.rpc).toHaveBeenCalledWith('ventas_pedido_bot', { p_wa_id: WA, p_pedido_id: ORDER });
    expect(await make([]).store.orderSales(WA, ORDER)).toEqual([]);
    await expect(make(['x']).store.orderSales(WA, ORDER)).rejects.toThrow();
    await expect(ok.store.orderSales('1', ORDER)).rejects.toThrow();
    await expect(ok.store.orderSales(WA, 'x')).rejects.toThrow();
  });

  it('maps credentials and returns the password for password accounts', async () => {
    const ok = make(row());
    expect(await ok.store.credentials(WA, SALE)).toEqual({ ventaId: SALE, servicioId: SALE, servicio: 'Netflix', categoria: 'Netflix',
      correo: 'a@example.test', perfil: 'Ana', pin: '1', codeAccess: false, provider: null, password: 'pw' });
    expect(ok.rpc).toHaveBeenCalledWith('credenciales_venta_bot', { p_wa_id: WA, p_venta_id: SALE });
  });

  it('withholds the password for code-access accounts even if the RPC returns it', async () => {
    const result = await make(row({ acceso_por_codigo: true, contrasena: 'LEAK' })).store.credentials(WA, SALE);
    expect(result?.codeAccess).toBe(true);
    expect(result?.password).toBeNull();
    expect(JSON.stringify(result)).not.toContain('LEAK');
  });

  it('returns null for a sale the contact does not own and rejects malformed rows or ids', async () => {
    expect(await make(null).store.credentials(WA, SALE)).toBeNull();
    await expect(make({ venta_id: SALE }).store.credentials(WA, SALE)).rejects.toThrow();
    await expect(make(null).store.credentials(WA, 'x')).rejects.toThrow();
    await expect(make(null).store.credentials('12', SALE)).rejects.toThrow();
  });

  it.each([
    ['purchase_unsupported_number', 'unsupported_number'], ['x purchase_currency_mismatch y', 'currency_mismatch'],
    ['purchase_hold_missing', 'hold_missing'], ['purchase_contact_invalid', 'contact_invalid'],
    ['boom', 'other'], [undefined, 'other'],
  ])('maps the SQL message %s to the rejection reason %s without leaking it', async (message, reason) => {
    const failing = make(null, { message });
    const error = await failing.store.reserve(WA, PLAN).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PurchaseRejection);
    expect((error as PurchaseRejection).reason).toBe(reason);
    expect((error as PurchaseRejection).message).toBe(`Bot purchase rejected: ${reason}`);
    expect((error as PurchaseRejection).name).toBe('PurchaseRejection');
  });

  it('wraps rpc errors on every operation', async () => {
    const failing = make(null, { message: 'purchase_hold_missing' });
    await expect(failing.store.settings()).rejects.toBeInstanceOf(PurchaseRejection);
    await expect(failing.store.createOrder(WA, [PLAN], KEY)).rejects.toBeInstanceOf(PurchaseRejection);
    await expect(failing.store.release(WA)).rejects.toBeInstanceOf(PurchaseRejection);
    await expect(failing.store.orderSales(WA, ORDER)).rejects.toBeInstanceOf(PurchaseRejection);
    await expect(failing.store.credentials(WA, SALE)).rejects.toBeInstanceOf(PurchaseRejection);
  });
});
