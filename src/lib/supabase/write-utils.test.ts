import { describe, expect, it } from 'vitest';

import { ENTITIES } from './entities';
import { normalizeWritePayload } from './write-utils';

describe('normalizeWritePayload', () => {
  it('maps legacy service tipo to plan_tipo_id without warning-only leftovers', () => {
    const payload = normalizeWritePayload(
      ENTITIES.SERVICIOS,
      {
        nombre: 'Netflix',
        categoriaId: 'categoria-1',
        tipo: 'tipo-plan-1',
        correo: 'netflix@example.com',
        contrasena: 'secret',
        perfilesDisponibles: 4,
      },
      'insert'
    );

    expect(payload).toEqual(
      expect.objectContaining({
        plan_tipo_id: 'tipo-plan-1',
      })
    );
    expect(payload).not.toHaveProperty('tipo');
  });

  it('keeps explicit planTipoId over legacy service tipo', () => {
    const payload = normalizeWritePayload(
      ENTITIES.SERVICIOS,
      {
        tipo: 'legacy-tipo',
        planTipoId: 'plan-tipo-actual',
      },
      'update'
    );

    expect(payload).toEqual({ plan_tipo_id: 'plan-tipo-actual' });
  });
});
