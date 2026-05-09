import { describe, expect, it } from 'vitest';

import { buildExecutivePushSummaryPayload } from './push-helpers';

describe('buildExecutivePushSummaryPayload', () => {
  it('uses the first block as the primary deep link target', () => {
    const payload = buildExecutivePushSummaryPayload([
      {
        key: 'servicios_por_pagar_hoy',
        label: 'Servicios por pagar hoy',
        count: 3,
        destination: '/notificaciones',
        tab: 'servicios',
      },
      {
        key: 'monto_a_fondear',
        label: 'Monto a fondear',
        amount: 120,
        currency: 'USD',
        destination: '/dashboard',
      },
    ]);

    expect(payload.destination).toBe('/notificaciones');
    expect(payload.tab).toBe('servicios');
    expect(payload.body).toContain('Servicios por pagar hoy: 3');
    expect(payload.body).toContain('Monto a fondear: 120.00 USD');
  });
});
