import { describe, expect, it, vi } from 'vitest';

import {
  getCicloPagoMonths,
  getDefaultCosto,
  getDefaultMetodoPagoId,
  getPagoDialogPresentation,
  getPagoDialogResetValues,
  hasServicioPagoChanges,
  buildVentaPreviewMessage,
} from './helpers';

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
    } as never;

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
    } as never;

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
});
