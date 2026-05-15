import { describe, expect, it } from 'vitest';

describe('syncMetodoPagoDependencias', () => {
  it('es un no-op en Supabase V2 — los snapshots preservan el historial y no se propagan', async () => {
    const { syncMetodoPagoDependencias } = await import('@/lib/services/metodoPagoSyncService');

    await expect(
      syncMetodoPagoDependencias({
        id: 'metodo-1',
        nombre: 'Yappy 2.0',
        nombreAnterior: 'Yappy',
        moneda: 'PAB',
        monedaAnterior: 'USD',
      })
    ).resolves.toBeUndefined();
  });
});
