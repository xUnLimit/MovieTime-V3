import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ announce: vi.fn() }));
vi.mock('@/components/shared/renewal-whatsapp-notice', () => ({ announceRenewal: mocks.announce }));

import { showVentaRenewalOutcome } from './venta-renewal-outcome';

const notif = { ventaId: 'v1', clienteNombre: 'Ana Pérez' };

describe('showVentaRenewalOutcome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('announces without a wa.me message when the customer was not asked to be notified', () => {
    const enqueue = vi.fn();
    showVentaRenewalOutcome({}, notif, enqueue);
    expect(mocks.announce).toHaveBeenCalledWith({ ventaId: 'v1', clienteNombre: 'Ana Pérez', waMessage: null, enqueueWhatsAppMessages: enqueue });
  });

  it('keeps the message edited in the dialog as the wa.me option', () => {
    const enqueue = vi.fn();
    showVentaRenewalOutcome({ whatsappMessage: { phone: '60000000', message: 'Mensaje editado' } }, notif, enqueue);
    expect(mocks.announce).toHaveBeenCalledWith({
      ventaId: 'v1', clienteNombre: 'Ana Pérez', enqueueWhatsAppMessages: enqueue,
      waMessage: { phone: '60000000', message: 'Mensaje editado' },
    });
  });
});
