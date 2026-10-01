import { describe, expect, it, vi } from 'vitest';
import type { PagoDialogProps } from './types';

import {
  getCicloPagoMonths,
  getCicloPagoLabel,
  getCiclosDisponibles,
  getDefaultCosto,
  getDefaultMetodoPagoId,
  getPagoDialogPresentation,
  getPagoDialogResetValues,
  getPagoDialogTargetKey,
  getPagoDialogCopy,
  getPrecioPorCiclo,
  hasServicioPagoChanges,
} from './helpers';
import { buildVentaPreviewMessage } from './preview-helpers';

describe('pago dialog helpers', () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    metodosPago: [],
    onConfirm: vi.fn(),
  };

  it('resolves defaults for venta renew and edit modes', () => {
    const renewProps = {
      ...baseProps,
      context: 'venta',
      mode: 'renew',
      venta: {
        clienteNombre: 'Cliente',
        precioFinal: 10.555,
        fechaFin: new Date('2026-05-30T00:00:00.000Z'),
      },
    } as PagoDialogProps;

    expect(getDefaultMetodoPagoId(renewProps)).toBe('');
    expect(getDefaultCosto(renewProps)).toBe(10.56);

    const editProps = {
      ...renewProps,
      mode: 'edit',
      venta: {
        clienteNombre: 'Cliente',
        metodoPagoId: 'metodo-1',
        precioFinal: 10,
        fechaFin: new Date('2026-05-30T00:00:00.000Z'),
      },
    } as PagoDialogProps;

    expect(getDefaultMetodoPagoId(editProps)).toBe('metodo-1');
    expect(getDefaultCosto(editProps)).toBe(0);
  });

  it('builds venta reset values for renew mode', () => {
    const values = getPagoDialogResetValues({
      ...baseProps,
      context: 'venta',
      mode: 'renew',
      venta: {
        clienteNombre: 'Cliente',
        precioFinal: 9.994,
        fechaFin: new Date('2026-06-01T00:00:00.000Z'),
        notas: 'nota',
      },
    } as never);

    expect(values).toEqual(expect.objectContaining({
      periodoRenovacion: '',
      metodoPagoId: '',
      costo: 9.99,
      descuento: 0,
      notas: 'nota',
      renovacionAutomatica: false,
    }));
    expect(values?.fechaInicio).toEqual(new Date('2026-06-01T00:00:00.000Z'));
    expect(values?.fechaVencimiento).toEqual(new Date('2026-06-01T00:00:00.000Z'));
  });

  it('returns null for servicio edit reset without a pago', () => {
    const values = getPagoDialogResetValues({
      ...baseProps,
      context: 'servicio',
      mode: 'edit',
      servicio: {
        id: 'servicio-1',
        metodoPagoId: 'metodo-1',
        costoServicio: 12,
      },
      pago: null,
    } as never);

    expect(values).toBeNull();
  });

  it('keeps the servicio renew target key stable when mutable payment fields change', () => {
    const baseServicio = {
      id: 'servicio-1',
      nombre: 'Netflix',
      metodoPagoId: 'metodo-1',
      costoServicio: 12,
      fechaVencimiento: new Date('2026-05-01T00:00:00.000Z'),
    };

    const firstKey = getPagoDialogTargetKey({
      ...baseProps,
      context: 'servicio',
      mode: 'renew',
      servicio: baseServicio,
    } as never);

    const updatedKey = getPagoDialogTargetKey({
      ...baseProps,
      context: 'servicio',
      mode: 'renew',
      servicio: {
        ...baseServicio,
        costoServicio: 15,
        fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
      },
    } as never);

    expect(updatedKey).toBe(firstKey);
  });

  it('changes the servicio edit target key when editing a different payment', () => {
    const servicio = {
      id: 'servicio-1',
      nombre: 'Netflix',
      metodoPagoId: 'metodo-1',
      costoServicio: 12,
    };

    const firstKey = getPagoDialogTargetKey({
      ...baseProps,
      context: 'servicio',
      mode: 'edit',
      servicio,
      pago: { id: 'pago-1' },
    } as never);

    const secondKey = getPagoDialogTargetKey({
      ...baseProps,
      context: 'servicio',
      mode: 'edit',
      servicio,
      pago: { id: 'pago-2' },
    } as never);

    expect(secondKey).not.toBe(firstKey);
  });

  it('maps billing cycles to month increments', () => {
    expect(getCicloPagoMonths('mensual')).toBe(1);
    expect(getCicloPagoMonths('trimestral')).toBe(3);
    expect(getCicloPagoMonths('semestral')).toBe(6);
    expect(getCicloPagoMonths('anual')).toBe(12);
    expect(getCicloPagoMonths('otro')).toBe(12);
  });

  it('detects changes in servicio edit payment values', () => {
    const pago = {
      cicloPago: 'mensual',
      metodoPagoId: 'metodo-1',
      monto: 10,
      fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
      notas: 'original',
    } as never;

    expect(hasServicioPagoChanges({
      pago,
      periodoValue: 'mensual',
      metodoPagoIdValue: 'metodo-1',
      costoValue: 10,
      fechaInicioValue: new Date('2026-05-01T00:00:00.000Z'),
      fechaVencimientoValue: new Date('2026-06-01T00:00:00.000Z'),
      notasValue: 'original',
    })).toBe(false);

    expect(hasServicioPagoChanges({
      pago,
      periodoValue: 'trimestral',
      metodoPagoIdValue: 'metodo-1',
      costoValue: 10,
      fechaInicioValue: new Date('2026-05-01T00:00:00.000Z'),
      fechaVencimientoValue: new Date('2026-06-01T00:00:00.000Z'),
      notasValue: 'original',
    })).toBe(true);
  });

  it('builds venta preview messages only when WhatsApp notification applies', () => {
    expect(buildVentaPreviewMessage({
      isVenta: false,
      isEdit: false,
      notificarWhatsAppValue: true,
      costoValue: 10,
    })).toBe('');

    expect(buildVentaPreviewMessage({
      isVenta: true,
      isEdit: false,
      notificarWhatsAppValue: true,
      costoValue: 10,
    })).toBe('Template de renovación no encontrado');

    expect(buildVentaPreviewMessage({
      isVenta: true,
      isEdit: false,
      notificarWhatsAppValue: true,
      template: {
        tipo: 'renovacion',
        contenido: 'Hola {cliente}, {servicio} vence el {vencimiento} por {monto}.',
        activo: true,
      } as never,
      costoValue: 12,
      descuentoValue: 50,
      clienteNombre: 'Ana',
      servicioNombre: 'Netflix',
      fechaVencimientoValue: new Date('2026-06-01T00:00:00.000Z'),
    })).toContain('Ana');
  });

  it('returns presentation copy for venta and servicio contexts', () => {
    expect(getPagoDialogPresentation(true, false)).toEqual(expect.objectContaining({
      dialogContentClassName: 'sm:max-w-[600px]',
      notasLabel: 'Nota principal',
    }));
    expect(getPagoDialogPresentation(false, true)).toEqual(expect.objectContaining({
      dialogContentClassName: 'sm:max-w-[760px]',
      notasLabel: 'Nota del pago',
    }));
  });

  it.each([
    ['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'],
    ['anual', 'Anual'], [undefined, 'Seleccionar ciclo'], ['otro', 'Seleccionar ciclo'],
  ])('labels billing cycle %s', (cycle, label) => {
    expect(getCicloPagoLabel(cycle)).toBe(label);
  });

  it('filters available cycles and prices by plan type', () => {
    const plans = [
      { id: 'p1', cicloPago: 'mensual', tipoPlan: 'basic', precio: 10 },
      { id: 'p2', cicloPago: 'anual', tipoPlan: 'premium', precio: 100 },
      { id: 'p3', cicloPago: 'mensual', tipoPlan: 'premium', precio: 12 },
    ] as never[];
    expect(getCiclosDisponibles()).toEqual(['mensual', 'trimestral', 'semestral', 'anual']);
    expect(getCiclosDisponibles([], 'basic')).toEqual(['mensual', 'trimestral', 'semestral', 'anual']);
    expect(getCiclosDisponibles(plans, 'premium')).toEqual(['mensual', 'anual']);
    expect(getCiclosDisponibles(plans)).toEqual(['mensual', 'anual']);
    expect(getPrecioPorCiclo(undefined, plans)).toBeNull();
    expect(getPrecioPorCiclo('mensual')).toBeNull();
    expect(getPrecioPorCiclo('mensual', plans, 'premium')).toBe(12);
    expect(getPrecioPorCiclo('trimestral', plans)).toBeNull();
  });

  it('resolves service defaults for renew and edit modes', () => {
    const service = { id: 's1', nombre: 'Netflix', metodoPagoId: 'm1', costoServicio: 12.345 };
    expect(getDefaultMetodoPagoId({ ...baseProps, context: 'servicio', mode: 'renew', servicio: service } as never)).toBe('m1');
    expect(getDefaultCosto({ ...baseProps, context: 'servicio', mode: 'renew', servicio: service } as never)).toBe(12.35);
    expect(getDefaultCosto({ ...baseProps, context: 'servicio', mode: 'edit', servicio: service } as never)).toBe(0);
    expect(getDefaultMetodoPagoId({
      ...baseProps, context: 'servicio', mode: 'edit', servicio: service, pago: { metodoPagoId: 'm2' },
    } as never)).toBe('m2');
    expect(getDefaultMetodoPagoId({
      ...baseProps, context: 'servicio', mode: 'edit', servicio: service, pago: { metodoPagoId: '' },
    } as never)).toBe('');
  });

  it('builds fallback target keys for sales and services', () => {
    expect(getPagoDialogTargetKey({
      ...baseProps, context: 'venta', mode: 'edit', venta: {}, pago: null,
    } as never)).toBe('venta:edit:venta:nuevo-pago');
    expect(getPagoDialogTargetKey({
      ...baseProps, context: 'venta', mode: 'renew', venta: { clienteNombre: 'Ana' },
    } as never)).toBe('venta:renew:Ana:renovacion');
    expect(getPagoDialogTargetKey({
      ...baseProps, context: 'servicio', mode: 'edit', servicio: { nombre: 'Netflix' }, pago: null,
    } as never)).toBe('servicio:edit:Netflix:nuevo-pago');
    expect(getPagoDialogTargetKey({
      ...baseProps, context: 'servicio', mode: 'renew', servicio: {},
    } as never)).toBe('servicio:renew:servicio:renovacion');
  });

  it('builds sale edit reset values with and without a payment', () => {
    const venta = { metodoPagoId: '', precioFinal: 10 };
    expect(getPagoDialogResetValues({
      ...baseProps, context: 'venta', mode: 'edit', venta, pago: null,
    } as never)).toEqual(expect.objectContaining({ metodoPagoId: 'pendiente', costo: 0, descuento: 0, notas: '' }));
    const values = getPagoDialogResetValues({
      ...baseProps, context: 'venta', mode: 'edit', venta,
      pago: { cicloPago: '', metodoPagoId: '', precio: 10.555, descuento: undefined, notas: undefined },
    } as never);
    expect(values).toEqual(expect.objectContaining({
      periodoRenovacion: '', metodoPagoId: 'pendiente', costo: 10.56, descuento: 0, notas: '',
    }));
    expect(values?.fechaInicio).toBeInstanceOf(Date);
    expect(values?.fechaVencimiento).toBeInstanceOf(Date);
  });

  it('builds service edit and renew reset values with fallbacks', () => {
    const servicio = {
      id: 's1', nombre: 'Netflix', cicloPago: 'mensual', metodoPagoId: '', costoServicio: 8.555,
      fechaVencimiento: undefined, notas: 'servicio', renovacionAutomatica: undefined,
    };
    expect(getPagoDialogResetValues({
      ...baseProps, context: 'servicio', mode: 'edit', servicio,
      pago: { cicloPago: '', metodoPagoId: '', monto: 5.555, fechaInicio: '2026-01-01', fechaVencimiento: '2026-02-01' },
    } as never)).toEqual(expect.objectContaining({
      periodoRenovacion: 'mensual', metodoPagoId: '', costo: 5.56, notas: 'servicio', renovacionAutomatica: false,
    }));
    expect(getPagoDialogResetValues({
      ...baseProps, context: 'servicio', mode: 'renew', servicio,
    } as never)).toEqual(expect.objectContaining({
      metodoPagoId: '', costo: 8.56, notas: 'servicio', renovacionAutomatica: false,
    }));
  });

  it('detects every individual service payment change and missing payment', () => {
    const pago = {
      cicloPago: 'mensual', metodoPagoId: 'm1', monto: 10,
      fechaInicio: new Date('2026-01-01'), fechaVencimiento: new Date('2026-02-01'), notas: 'n',
    } as never;
    const base = {
      pago, periodoValue: 'mensual', metodoPagoIdValue: 'm1', costoValue: 10,
      fechaInicioValue: new Date('2026-01-01'), fechaVencimientoValue: new Date('2026-02-01'), notasValue: 'n',
    };
    expect(hasServicioPagoChanges({ ...base, pago: null })).toBe(false);
    expect(hasServicioPagoChanges({ ...base, metodoPagoIdValue: 'm2' })).toBe(true);
    expect(hasServicioPagoChanges({ ...base, costoValue: 11 })).toBe(true);
    expect(hasServicioPagoChanges({ ...base, fechaInicioValue: new Date('2026-01-02') })).toBe(true);
    expect(hasServicioPagoChanges({ ...base, fechaVencimientoValue: new Date('2026-02-02') })).toBe(true);
    expect(hasServicioPagoChanges({ ...base, notasValue: 'otra' })).toBe(true);
  });

  it('covers preview guards and message fallbacks', () => {
    const base = { isVenta: true, isEdit: false, notificarWhatsAppValue: true, costoValue: Number.NaN };
    expect(buildVentaPreviewMessage({ ...base, notificarWhatsAppValue: false })).toBe('');
    expect(buildVentaPreviewMessage({ ...base, isEdit: true })).toBe('');
    const message = buildVentaPreviewMessage({
      ...base,
      template: { contenido: '{cliente} {servicio} {categoria} {perfil} {correo} {contrasena} {codigo} {monto}', activo: true } as never,
      descuentoValue: Number.NaN,
    });
    expect(message).toContain('Cliente');
    expect(message).toContain('Servicio');
  });

  it.each([
    [true, true, 'Editar Pago'], [true, false, 'Renovar Venta: Ana'],
    [false, true, 'Editar pago del servicio: Netflix'], [false, false, 'Renovar Servicio: Netflix'],
  ])('builds dialog copy for venta=%s edit=%s', (isVenta, isEdit, title) => {
    expect(getPagoDialogCopy({
      isVenta, isEdit, ventaClienteNombre: 'Ana', servicioNombre: 'Netflix', pagoDescripcion: undefined,
    }).title).toBe(title);
  });
});
