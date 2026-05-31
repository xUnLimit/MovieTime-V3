import { describe, expect, it } from 'vitest';

import { PENDING_TERCERO_PAYMENT_ID } from '@/platform/utils/terceroMetodoPago';

import {
  buildPagoDialogSubmitPayload,
  getPagoDialogPaymentMethods,
  getPagoDialogSelectedPlan,
} from './pago-dialog-model';

describe('pago dialog model', () => {
  const metodosPago = [
    { id: 'servicio-card', nombre: 'Servicio Card', activo: true, asociadoA: 'servicio', moneda: 'USD' },
    { id: 'tercero-zelle', nombre: 'Zelle', activo: true, asociadoA: 'tercero', moneda: 'USD' },
    { id: 'tercero-ach', nombre: 'ACH', activo: true, asociadoA: 'tercero', moneda: 'USD' },
    { id: 'tercero-off', nombre: 'Inactivo', activo: false, asociadoA: 'tercero', moneda: 'USD' },
  ] as never;

  it('keeps venta create methods behind a single ordering rule', () => {
    const result = getPagoDialogPaymentMethods({
      context: 'venta',
      mode: 'edit',
      metodosPago,
    });

    expect(result.map((metodo) => metodo.id)).toEqual([
      PENDING_TERCERO_PAYMENT_ID,
      'tercero-ach',
      'tercero-zelle',
    ]);
  });

  it('does not offer pending tercero method during venta renew', () => {
    const result = getPagoDialogPaymentMethods({
      context: 'venta',
      mode: 'renew',
      metodosPago,
    });

    expect(result.map((metodo) => metodo.id)).toEqual(['tercero-ach', 'tercero-zelle']);
  });

  it('enriches submitted payment data with selected plan and rounded amounts', () => {
    const selectedPlan = getPagoDialogSelectedPlan({
      periodoValue: 'mensual',
      categoriaPlanes: [
        { id: 'plan-1', nombre: 'Basico', cicloPago: 'mensual', tipoPlan: 'pantalla', precio: 9.99 },
      ] as never,
      tipoPlan: 'pantalla' as never,
    });

    expect(buildPagoDialogSubmitPayload({
      data: {
        periodoRenovacion: 'mensual',
        metodoPagoId: 'tercero-ach',
        costo: 10.555,
        descuento: 1.234,
        fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
        fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
        notas: '  nota  ',
        notificarWhatsApp: true,
      },
      metodosPago,
      selectedPlan,
      venta: { planId: 'old-plan', planNombre: 'Old', planTipoNombre: 'Pantalla' } as never,
      previewMessage: 'Mensaje',
    })).toEqual(expect.objectContaining({
      costo: 10.56,
      descuento: 1.23,
      notas: 'nota',
      metodoPagoNombre: 'ACH',
      moneda: 'USD',
      planId: 'plan-1',
      planNombre: 'Basico',
      planTipoNombre: 'Pantalla',
      mensajeWhatsApp: 'Mensaje',
    }));
  });
});
