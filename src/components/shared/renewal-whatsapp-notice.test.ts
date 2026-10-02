import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(), offer: vi.fn(), reportError: vi.fn(), openWhatsApp: vi.fn(),
  loading: vi.fn().mockReturnValue('t1'), success: vi.fn(), warning: vi.fn(), dismiss: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { loading: mocks.loading, success: mocks.success, warning: mocks.warning, dismiss: mocks.dismiss } }));
vi.mock('@/platform/observability/logger', () => ({ reportError: mocks.reportError }));
vi.mock('@/platform/utils/whatsapp', () => ({ openWhatsApp: mocks.openWhatsApp }));
vi.mock('@/application/use-cases/whatsapp-notices-use-cases', () => ({ notifyCustomerUseCase: mocks.send }));
vi.mock('@/components/shared/offer-api-access-notice', () => ({ offerApiAccessNotice: mocks.offer }));
const outcome = (status: 'sent' | 'auto_disabled' | 'not_sent') => ({ status, deliveredVentaIds: status === 'sent' ? ['v1'] : [] });

import { announceRenewal } from './renewal-whatsapp-notice';

const wa = { phone: '60000000', message: 'Renovado' };
const params = (waMessage: typeof wa | null, enqueue = vi.fn()) => ({ ventaId: 'v1', clienteNombre: 'Ana Pérez', waMessage, enqueueWhatsAppMessages: enqueue });

describe('announceRenewal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loading.mockReturnValue('t1');
  });

  it('with the automatic switch on, everything goes by the API without asking', async () => {
    mocks.send.mockResolvedValue(outcome('sent'));
    await announceRenewal(params(wa));
    expect(mocks.send).toHaveBeenCalledWith({ tipo: 'renovacion', ventaIds: ['v1'], eventId: expect.any(String) });
    expect(mocks.success).toHaveBeenCalledWith('Venta renovada y cliente avisado por WhatsApp', { id: 't1' });
    expect(mocks.offer).not.toHaveBeenCalled();
  });

  it('with the switch on, confirms by the API even when no message was prepared', async () => {
    mocks.send.mockResolvedValue(outcome('sent'));
    await announceRenewal(params(null));
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith('Venta renovada y cliente avisado por WhatsApp', { id: 't1' });
  });

  it('with the switch off, offers the API and WhatsApp when the dialog asked to notify', async () => {
    mocks.send.mockResolvedValue(outcome('auto_disabled'));
    const enqueue = vi.fn();
    await announceRenewal(params(wa, enqueue));
    expect(mocks.dismiss).toHaveBeenCalledWith('t1');
    expect(mocks.offer).toHaveBeenCalledWith(expect.objectContaining({
      tipo: 'renovacion', kind: 'success', enqueueWhatsAppMessages: enqueue,
      title: 'Venta renovada exitosamente', description: '¿Cómo quieres avisar a Ana Pérez?',
      items: [{ ventaId: 'v1', message: expect.objectContaining({ phone: '60000000', message: 'Renovado', title: 'Venta renovada' }) }],
    }));
  });

  it('with the switch off and no notification requested, only confirms the renewal', async () => {
    mocks.send.mockResolvedValue(outcome('auto_disabled'));
    await announceRenewal(params(null));
    expect(mocks.success).toHaveBeenCalledWith('Venta renovada exitosamente');
    expect(mocks.offer).not.toHaveBeenCalled();
  });

  it.each(['not_sent', 'error'])('when the API could not send (%s), warns and offers WhatsApp', async (kind) => {
    if (kind === 'error') mocks.send.mockRejectedValue(new Error('down')); else mocks.send.mockResolvedValue(outcome('not_sent'));
    const enqueue = vi.fn();
    await announceRenewal(params(wa, enqueue));
    const options = mocks.warning.mock.calls.at(-1)?.[1];
    expect(mocks.warning).toHaveBeenCalledWith('Venta renovada, pero no se pudo avisar por la API', expect.objectContaining({
      id: 't1', description: 'Puedes enviar la confirmación abriendo WhatsApp.',
    }));
    options.action.onClick();
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('60000000', 'Renovado');
    expect(enqueue).not.toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledTimes(kind === 'error' ? 1 : 0);
  });

  it('when the API could not send and there is no message, points to the chat', async () => {
    mocks.send.mockResolvedValue(outcome('not_sent'));
    await announceRenewal(params(null));
    const options = mocks.warning.mock.calls.at(-1)?.[1];
    expect(options.description).toBe('Escríbele desde el chat.');
    expect(options.action).toBeUndefined();
  });
});
