import { describe, expect, it } from 'vitest';
import type { Categoria } from '@/types';
import {
  categoriaSchema,
  getAsociadoLabel,
  getCicloPagoLabel,
  getCreatePlanesValidationError,
  getTipoCategoriaLabel,
  hasCategoriaChanges,
} from './categoria-form-helpers';

const categoria: Categoria = {
  id: 'categoria-1',
  nombre: 'Netflix',
  tipo: 'cliente',
  tipoCategoria: 'plataforma_streaming',
  notas: 'Nota guardada',
  tiposPlanes: [{ id: 'tipo-1', nombre: 'Individual' }],
  planes: [{
    id: 'plan-1',
    nombre: 'Mensual',
    precio: 5,
    cicloPago: 'mensual',
    tipoPlan: 'tipo-1',
  }],
  activo: true,
  totalServicios: 0,
  serviciosActivos: 0,
  perfilesDisponiblesTotal: 0,
  ventasTotales: 0,
  ingresosTotales: 0,
  gastosTotal: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('categoria form helpers', () => {
  it('labels categories associated with clients', () => {
    expect(getAsociadoLabel('cliente')).toBe('Cliente');
  });

  it('detects no changes when notes and plans match the saved category', () => {
    expect(
      hasCategoriaChanges({
        categoria,
        mode: 'edit',
        nombreValue: categoria.nombre,
        notasValue: categoria.notas,
        planes: categoria.planes ?? [],
        tipoCategoriaValue: categoria.tipoCategoria,
        tipoValue: categoria.tipo,
        tiposPlanes: categoria.tiposPlanes ?? [],
      })
    ).toBe(false);
  });

  it('detects note changes', () => {
    expect(
      hasCategoriaChanges({
        categoria,
        mode: 'edit',
        nombreValue: categoria.nombre,
        notasValue: 'Nota actualizada',
        planes: categoria.planes ?? [],
        tipoCategoriaValue: categoria.tipoCategoria,
        tipoValue: categoria.tipo,
        tiposPlanes: categoria.tiposPlanes ?? [],
      })
    ).toBe(true);
  });

  it.each([
    ['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'],
    ['anual', 'Anual'], ['otro', 'Seleccionar período'],
  ])('labels cycle %s', (cycle, label) => expect(getCicloPagoLabel(cycle)).toBe(label));

  it.each([
    ['cliente', 'Cliente'], ['revendedor', 'Revendedor'], ['otro', 'Seleccionar'],
  ])('labels association %s', (type, label) => expect(getAsociadoLabel(type)).toBe(label));

  it.each([
    ['plataforma_streaming', 'Plataforma de Streaming'], ['otros', 'Otros'], ['x', 'Seleccionar tipo'],
  ])('labels category type %s', (type, label) => expect(getTipoCategoriaLabel(type)).toBe(label));

  it('validates required plan types, plans and names', () => {
    expect(getCreatePlanesValidationError([], [])).toContain('tipo de plan');
    expect(getCreatePlanesValidationError([{ id: 't1', nombre: 'Tipo' }], [])).toContain('al menos un plan');
    expect(getCreatePlanesValidationError(
      [{ id: 't1', nombre: 'Tipo' }],
      [{ id: 'p1', nombre: ' ', precio: 1, cicloPago: 'mensual', tipoPlan: 't1' }],
    )).toContain('nombre');
    expect(getCreatePlanesValidationError(
      [{ id: 't1', nombre: 'Tipo' }],
      [{ id: 'p1', nombre: 'Plan', precio: 1, cicloPago: 'mensual', tipoPlan: 't1' }],
    )).toBe('');
  });

  function changes(overrides: Record<string, unknown> = {}) {
    return hasCategoriaChanges({
      categoria, mode: 'edit', nombreValue: categoria.nombre, notasValue: categoria.notas,
      planes: categoria.planes ?? [], tipoCategoriaValue: categoria.tipoCategoria,
      tipoValue: categoria.tipo, tiposPlanes: categoria.tiposPlanes ?? [], ...overrides,
    });
  }

  it('treats create/missing category and every scalar or length change as modified', () => {
    expect(changes({ mode: 'create' })).toBe(true);
    expect(changes({ categoria: undefined })).toBe(true);
    expect(changes({ nombreValue: 'Otra' })).toBe(true);
    expect(changes({ tipoValue: 'revendedor' })).toBe(true);
    expect(changes({ tipoCategoriaValue: 'otros' })).toBe(true);
    expect(changes({ notasValue: '' })).toBe(true);
    expect(changes({ tiposPlanes: [] })).toBe(true);
    expect(changes({ planes: [] })).toBe(true);
  });

  it('detects every plan type and plan field mutation', () => {
    expect(changes({ tiposPlanes: [{ id: 'other', nombre: 'Individual' }] })).toBe(true);
    expect(changes({ tiposPlanes: [{ id: 'tipo-1', nombre: 'Otro' }] })).toBe(true);
    expect(changes({
      planes: [{ ...categoria.planes![0], id: 'other' }],
    })).toBe(true);
    expect(changes({ planes: [{ ...categoria.planes![0], nombre: 'Otro' }] })).toBe(true);
    expect(changes({ planes: [{ ...categoria.planes![0], precio: 6 }] })).toBe(true);
    expect(changes({ planes: [{ ...categoria.planes![0], cicloPago: 'anual' }] })).toBe(true);
    expect(changes({ planes: [{ ...categoria.planes![0], tipoPlan: 'other' }] })).toBe(true);
    expect(changes({ categoria: { ...categoria, planes: undefined, tiposPlanes: undefined }, planes: [], tiposPlanes: [] })).toBe(false);
  });
});

it('validates nullable registered category providers', () => {
  const base = { nombre: 'Cuenta', tipo: 'cliente', tipoCategoria: 'plataforma_streaming' };
  for (const codeProvider of [null, undefined, 'netflix']) {
    expect(categoriaSchema.safeParse({ ...base, codeProvider }).success).toBe(true);
  }
  expect(categoriaSchema.safeParse({ ...base, codeProvider: 'fake' }).success).toBe(false);
});
