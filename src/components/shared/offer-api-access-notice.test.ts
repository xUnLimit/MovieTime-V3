import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  info: vi.fn(),
  loading: vi.fn().mockReturnValue('t1'),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  openWhatsApp: vi.fn(),
}));
vi.mock('@/platform/utils/whatsapp', () => ({ openWhatsApp: mocks.openWhatsApp }));
vi.mock('sonner', () => ({
  toast: { info: mocks.info, loading: mocks.loading, success: mocks.success, warning: mocks.warning, error: mocks.error },
}));
vi.mock('@/platform/observability/logger', () => ({ reportError: vi.fn() }));
vi.mock('@/application/use-cases/whatsapp-notices-use-cases', () => ({
  sendWhatsAppNoticesUseCase: mocks.send,
  isNoticeDelivered: (status: string) => status === 'accepted' || status === 'already_sent',
}));

import { offerApiAccessNotice } from './offer-api-access-notice';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const message = (title: string) => ({ phone: '507', message: 'm', title, description: 'd' });
const items = [
  { ventaId: 'v1', message: message('uno') },
  { ventaId: 'v2', message: message('dos') },
];

function offer() {
  const enqueue = vi.fn();
  offerApiAccessNotice({ tipo: 'actualizacion_credenciales', items, enqueueWhatsAppMessages: enqueue, title: 'T', description: 'D' });
  const options = mocks.info.mock.calls.at(-1)?.[1];
  return { enqueue, options };
}

describe('offerApiAccessNotice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not send or enqueue until the user chooses', () => {
    const { enqueue } = offer();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('opens WhatsApp right away with the first message and queues the rest when the user prefers WhatsApp', () => {
    const { enqueue, options } = offer();
    options.cancel.onClick();
    expect(mocks.openWhatsApp).toHaveBeenCalledTimes(1);
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('507', 'm');
    expect(enqueue).toHaveBeenCalledWith([items[1]!.message]);
  });

  it('opens a single message without queuing anything', () => {
    const enqueue = vi.fn();
    offerApiAccessNotice({ tipo: 'dia_pago', items: [items[0]!], enqueueWhatsAppMessages: enqueue, title: 'T', description: 'D' });
    mocks.info.mock.calls.at(-1)?.[1].cancel.onClick();
    expect(mocks.openWhatsApp).toHaveBeenCalledWith('507', 'm');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('sends by API and enqueues only the ventas that were not accepted', async () => {
    mocks.send.mockResolvedValue([
      { status: 'accepted', ventaIds: ['v1'] },
      { status: 'failed', ventaIds: ['v2'] },
    ]);
    const { enqueue, options } = offer();
    await options.action.onClick();
    expect(mocks.send).toHaveBeenCalledWith({
      tipo: 'actualizacion_credenciales', ventaIds: ['v1', 'v2'], eventId: expect.stringMatching(UUID),
    });
    expect(enqueue).toHaveBeenCalledWith([items[1]!.message]);
    expect(mocks.warning).toHaveBeenCalled();
  });

  it('uses one event id per offer and a new one for every new change', async () => {
    mocks.send.mockResolvedValue([{ status: 'accepted', ventaIds: ['v1', 'v2'] }]);
    const first = offer();
    await first.options.action.onClick();
    await first.options.action.onClick();
    const second = offer();
    await second.options.action.onClick();
    const [a, b, c] = mocks.send.mock.calls.map(([payload]) => payload.eventId);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it('does not enqueue when everything was accepted or already sent', async () => {
    mocks.send.mockResolvedValue([{ status: 'accepted', ventaIds: ['v1'] }, { status: 'already_sent', ventaIds: ['v2'] }]);
    const { enqueue, options } = offer();
    await options.action.onClick();
    expect(enqueue).toHaveBeenCalledWith([]);
    expect(mocks.success).toHaveBeenCalled();
  });

  it('falls back to wa.me for every venta when the API call throws', async () => {
    mocks.send.mockRejectedValue(new Error('down'));
    const { enqueue, options } = offer();
    await options.action.onClick();
    expect(enqueue).toHaveBeenCalledWith(items.map((item) => item.message));
    expect(mocks.error).toHaveBeenCalled();
  });
});

describe('offerApiAccessNotice for renewals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a success-styled offer and sends the renewal through the API', async () => {
    mocks.send.mockResolvedValue([{ status: 'accepted', ventaIds: ['v1'] }]);
    const enqueue = vi.fn();
    offerApiAccessNotice({ tipo: 'renovacion', items: [items[0]!], enqueueWhatsAppMessages: enqueue, title: 'Venta renovada', description: 'D', kind: 'success' });
    expect(mocks.info).not.toHaveBeenCalled();
    const options = mocks.success.mock.calls.at(-1)?.[1];
    await options.action.onClick();
    expect(mocks.send).toHaveBeenCalledWith({ tipo: 'renovacion', ventaIds: ['v1'], eventId: expect.stringMatching(UUID) });
    expect(enqueue).toHaveBeenCalledWith([]);
  });
});

describe('offerApiAccessNotice onApiSettled', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['accepted', 'throws'])('runs the callback after the API attempt when it %s', async (kind) => {
    if (kind === 'throws') mocks.send.mockRejectedValue(new Error('down'));
    else mocks.send.mockResolvedValue([{ status: 'accepted', ventaIds: ['v1'] }]);
    const settled = vi.fn();
    offerApiAccessNotice({ tipo: 'dia_pago', items: [items[0]!], enqueueWhatsAppMessages: vi.fn(), title: 'T', description: 'D', onApiSettled: settled });
    expect(settled).not.toHaveBeenCalled();
    await mocks.info.mock.calls.at(-1)?.[1].action.onClick();
    expect(settled).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledWith({ tipo: 'dia_pago', ventaIds: ['v1'], eventId: expect.stringMatching(UUID) });
  });
});


it('preserves the action event id across automatic and manual attempts', async () => {
  mocks.send.mockResolvedValue([{ status: 'accepted', ventaIds: ['v1', 'v2'] }]);
  offerApiAccessNotice({
    tipo: 'actualizacion_credenciales', items, enqueueWhatsAppMessages: vi.fn(),
    title: 'T', description: 'D', eventId: 'action-event',
  });
  await mocks.info.mock.calls.at(-1)?.[1].action.onClick();
  expect(mocks.send).toHaveBeenLastCalledWith({
    tipo: 'actualizacion_credenciales', ventaIds: ['v1', 'v2'], eventId: 'action-event',
  });
});
