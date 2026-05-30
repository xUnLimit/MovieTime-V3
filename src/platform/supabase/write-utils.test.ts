import { describe, expect, it } from 'vitest';

import { ENTITIES } from './entities';
import { normalizeWritePayload } from './write-utils';

describe('normalizeWritePayload', () => {
  it('maps service tipo alias to plan_tipo_id without warning-only leftovers', () => {
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

  it('keeps explicit planTipoId over service tipo alias', () => {
    const payload = normalizeWritePayload(
      ENTITIES.SERVICIOS,
      {
        tipo: 'tipo-plan-anterior',
        planTipoId: 'plan-tipo-actual',
      },
      'update'
    );

    expect(payload).toEqual({ plan_tipo_id: 'plan-tipo-actual' });
  });

  it('drops columns the app must never write (DB/trigger-managed) while keeping valid ones', () => {
    const payload = normalizeWritePayload(
      ENTITIES.SERVICIOS,
      {
        nombre: 'Netflix',
        perfilesOcupados: 3, // managed by triggers; must be dropped
        id: 'should-not-write', // DB-managed
        createdAt: '2026-01-01', // DB-managed
        notas: 'hola',
      },
      'update'
    );

    expect(payload).toEqual({ nombre: 'Netflix', notas: 'hola' });
    expect(payload).not.toHaveProperty('perfiles_ocupados');
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('created_at');
  });

  it('drops created_by on update but keeps it on insert', () => {
    const insert = normalizeWritePayload(
      ENTITIES.TERCEROS,
      { nombre: 'Ana', createdBy: '11111111-1111-1111-1111-111111111111' },
      'insert'
    );
    expect(insert).toHaveProperty('created_by');

    const update = normalizeWritePayload(
      ENTITIES.TERCEROS,
      { nombre: 'Ana', createdBy: '11111111-1111-1111-1111-111111111111' },
      'update'
    );
    expect(update).not.toHaveProperty('created_by');
  });

  it('maps gasto monto alias to monto_original/monto_usd with default currency', () => {
    const payload = normalizeWritePayload(
      ENTITIES.GASTOS,
      { tipoGastoId: 'tg-1', fecha: '2026-05-01', monto: 50 },
      'insert'
    );

    expect(payload).toMatchObject({
      monto_original: 50,
      monto_usd: 50,
      moneda_original: 'USD',
    });
    expect(payload).not.toHaveProperty('monto');
  });
});
