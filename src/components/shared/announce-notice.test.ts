import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notify: vi.fn(), offer: vi.fn(), reportError: vi.fn(), openWhatsApp: vi.fn(),
  loading: vi.fn(), success: vi.fn(), warning: vi.fn(), dismiss: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { loading: mocks.loading, success: mocks.success, warning: mocks.warning, dismiss: mocks.dismiss } }));
vi.mock('@/platform/observability/logger', () => ({ reportError: mocks.reportError }));
vi.mock('@/platform/utils/whatsapp', () => ({ openWhatsApp: mocks.openWhatsApp }));
vi.mock('@/application/use-cases/whatsapp-notices-use-cases', () => ({ notifyCustomerUseCase: mocks.notify }));
vi.mock('@/components/shared/offer-api-access-notice', () => ({ offerApiAccessNotice: mocks.offer }));

import { announceNotice } from './announce-notice';

const message = (phone: string) => ({ phone, message: `Hola ${phone}`, title: 'Credenciales', description: 'D' });
const ana = message('60000001');
const beto = message('60000002');
const copy = {
  loading: 'Avisando...', sent: 'Clientes avisados', notSent: 'No se pudo avisar por la API',
  offerTitle: 'Notificar cambio', offerDescription: '2 clientes',
};
const items = [{ ventaId: 'v1', message: ana }, { ventaId: 'v2', message: beto }];

describe('announceNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loading.mockReturnValue('t1');
  });

  it.each(['actualizacion_credenciales', 'transferencia_servicio', 'suscripcion'] as const)('with automatic sending on, sends %s by the API without asking', async (tipo) => {
    mocks.notify.mockResolvedValue({ status: 'sent', deliveredVentaIds: ['v1', 'v2'] });
    const enqueue = vi.fn();
    await expect(announceNotice({ tipo, items, enqueueWhatsAppMessages: enqueue, copy, eventId: 'e1' }))
      .resolves.toBe('sent');
    expect(mocks.notify).toHaveBeenCalledWith({ tipo, ventaIds: ['v1', 'v2'], eventId: 'e1' });
    expect(mocks.success).toHaveBeenCalledWith('Clientes avisados', { id: 't1' });
    expect(mocks.offer).not.toHaveBeenCalled();
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('generates one event id per action when none is given', async () => {
    mocks.notify.mockResolvedValue({ status: 'sent', deliveredVentaIds: ['v1', 'v2'] });
    await announceNotice({ tipo: 'transferencia_servicio', items, enqueueWhatsAppMessages: vi.fn(), copy });
    await announceNotice({ tipo: 'transferencia_servicio', items, enqueueWhatsAppMessages: vi.fn(), copy });
    const [first, second] = mocks.notify.mock.calls.map(([input]) => input.eventId);
    expect(first).toEqual(expect.any(String));
    expect(first).not.toBe(second);
  });

  it('with the switch on and a partial delivery, warns and opens WhatsApp only for the pending customers', async () => {
    mocks.notify.mockResolvedValue({ status: 'not_sent', deliveredVentaIds: ['v1'] });
    const enqueue = vi.fn();
    await expect(announceNotice({ tipo: 'actualizacion_credenciales', items, enqueueWhatsAppMessages: enqueue, copy }))
      .resolves.toBe('not_sent');
    expect(mocks.warning).toHaveBeenCalledWith('No se pudo avisar por la API', expect.objectContaining({
      id: 't1', duration: Infinity, description: 'Puedes enviar el aviso abriendo WhatsApp.',
    }));
    mocks.warning.mock.calls[0]![1].action.onClick();
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('60000002', 'Hola 60000002');
    expect(mocks.offer).not.toHaveBeenCalled();
  });

  it.each(['actualizacion_credenciales', 'transferencia_servicio', 'suscripcion'] as const)('when the API fails for %s, warns and offers WhatsApp (first opens, rest queue)', async (tipo) => {
    mocks.notify.mockRejectedValue(new Error('down'));
    const enqueue = vi.fn();
    await expect(announceNotice({ tipo, items, enqueueWhatsAppMessages: enqueue, copy })).resolves.toBe('not_sent');
    expect(mocks.reportError).toHaveBeenCalledOnce();
    const options = mocks.warning.mock.calls[0]![1];
    expect(options.description).toBe('2 avisos se pueden enviar abriendo WhatsApp.');
    options.action.onClick();
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('60000001', 'Hola 60000001');
    expect(enqueue).toHaveBeenCalledWith([beto]);
  });

  it('shares one fallback message between ventas notified together', async () => {
    mocks.notify.mockResolvedValue({ status: 'not_sent', deliveredVentaIds: [] });
    await announceNotice({
      tipo: 'suscripcion', items: [{ ventaId: 'v1', message: ana }, { ventaId: 'v2', message: ana }],
      enqueueWhatsAppMessages: vi.fn(), copy: { ...copy, fallbackDescription: 'Abre WhatsApp.' },
    });
    expect(mocks.warning.mock.calls[0]![1].description).toBe('Abre WhatsApp.');
  });

  it('when nothing could be delivered and there is no message, points to the chat', async () => {
    mocks.notify.mockResolvedValue({ status: 'not_sent', deliveredVentaIds: [] });
    await announceNotice({ tipo: 'renovacion', items: [{ ventaId: 'v1', message: null }], enqueueWhatsAppMessages: vi.fn(), copy });
    const options = mocks.warning.mock.calls[0]![1];
    expect(options.description).toBe('Escríbele desde el chat.');
    expect(options.action).toBeUndefined();
  });

  it.each(['actualizacion_credenciales', 'transferencia_servicio', 'suscripcion'] as const)('with automatic sending off, offers both channels for %s', async (tipo) => {
    mocks.notify.mockResolvedValue({ status: 'auto_disabled', deliveredVentaIds: [] });
    const enqueue = vi.fn();
    await expect(announceNotice({
      tipo, items: [...items, { ventaId: 'v3', message: null }], enqueueWhatsAppMessages: enqueue, copy, kind: 'success',
    })).resolves.toBe('auto_disabled');
    expect(mocks.dismiss).toHaveBeenCalledWith('t1');
    expect(mocks.offer).toHaveBeenCalledWith({
      tipo, items, enqueueWhatsAppMessages: enqueue,
      title: 'Notificar cambio', description: '2 clientes', kind: 'success', eventId: expect.any(String),
    });
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('with the switch off and no prepared message, only confirms when asked to', async () => {
    mocks.notify.mockResolvedValue({ status: 'auto_disabled', deliveredVentaIds: [] });
    const noMessage = [{ ventaId: 'v1', message: null }];
    await announceNotice({ tipo: 'renovacion', items: noMessage, enqueueWhatsAppMessages: vi.fn(), copy });
    expect(mocks.success).not.toHaveBeenCalled();
    await announceNotice({ tipo: 'renovacion', items: noMessage, enqueueWhatsAppMessages: vi.fn(), copy: { ...copy, withoutMessage: 'Listo' } });
    expect(mocks.success).toHaveBeenCalledWith('Listo');
    expect(mocks.offer).not.toHaveBeenCalled();
  });

  it('with the switch off, lets the caller replace the two-channel offer', async () => {
    mocks.notify.mockResolvedValue({ status: 'auto_disabled', deliveredVentaIds: [] });
    const onAutoDisabled = vi.fn().mockResolvedValue(undefined);
    await announceNotice({ tipo: 'suscripcion', items, enqueueWhatsAppMessages: vi.fn(), copy, onAutoDisabled });
    expect(onAutoDisabled).toHaveBeenCalledOnce();
    expect(mocks.offer).not.toHaveBeenCalled();
  });
});
