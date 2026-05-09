import { describe, expect, it } from 'vitest';

import { buildExecutivePushSummaryPayload } from './push-helpers';

describe('buildExecutivePushSummaryPayload', () => {
  it('uses the first block as the primary deep link target', () => {
    const payload = buildExecutivePushSummaryPayload([
      {
        key: 'servicios_por_pagar',
        label: 'Servicios por pagar',
        count: 3,
        destination: '/notificaciones',
        tab: 'servicios',
      },
      {
        key: 'monto_a_fondear',
        label: 'Monto a fondear',
        amounts: { USD: 120 },
        destination: '/dashboard',
      },
    ]);

    expect(payload.destination).toBe('/notificaciones');
    expect(payload.tab).toBe('servicios');
    expect(payload.title).toBe('Recordatorio');
    expect(payload.body).toContain('Servicios por pagar: 3');
    expect(payload.body).toContain('Monto a fondear: 120.00 USD');
  });

  it('formats multi-currency amounts joined by commas, sorted by currency', () => {
    const payload = buildExecutivePushSummaryPayload([
      {
        key: 'monto_a_fondear',
        label: 'Monto a fondear',
        amounts: { USD: 50, NGN: 1500, EGP: 200 },
        destination: '/dashboard',
      },
    ]);

    expect(payload.body).toBe('Monto a fondear: 200.00 EGP, 1500.00 NGN, 50.00 USD');
  });

  it('renders 0 when no currencies have amounts', () => {
    const payload = buildExecutivePushSummaryPayload([
      {
        key: 'monto_a_fondear',
        label: 'Monto a fondear',
        amounts: {},
        destination: '/dashboard',
      },
    ]);

    expect(payload.body).toBe('Monto a fondear: 0');
  });
});
