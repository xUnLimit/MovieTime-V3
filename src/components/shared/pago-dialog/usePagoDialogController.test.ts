import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Servicio } from '@/types';
import type { PagoDialogProps } from './types';
vi.mock('@/hooks/use-templates', () => ({ useTemplates: () => ({ data: [] }) }));
import { usePagoDialogController } from './usePagoDialogController';
import { usePagoDialogResetModel } from './usePagoDialogResetModel';

const data = {
  periodoRenovacion: 'mensual', metodoPagoId: 'method', costo: 10,
  fechaInicio: new Date('2026-09-05'), fechaVencimiento: new Date('2026-10-05'),
};
const props = (onConfirm = vi.fn().mockResolvedValue(undefined)): PagoDialogProps => ({
  context: 'servicio', mode: 'renew', open: true, onConfirm, onOpenChange: vi.fn(), metodosPago: [],
  servicio: { id: 'service', nombre: 'Netflix', costoServicio: 10, cicloPago: 'mensual', fechaVencimiento: data.fechaInicio } as Servicio,
});

describe('payment dialog intent', () => {
  it('selects sale reset values for a renewal', () => {
    const sale = {
      context: 'venta', mode: 'renew', open: true, onConfirm: vi.fn(), onOpenChange: vi.fn(), metodosPago: [],
      venta: { clienteNombre: 'Cliente', precioFinal: 12, fechaFin: new Date('2026-09-30') },
    } as PagoDialogProps;
    const { result } = renderHook(() => usePagoDialogResetModel(sale));
    expect(result.current.resetValues?.costo).toBe(12);
    expect(result.current.dialogTargetKey).toContain('venta:renew');
  });

  it('retains the operation key when the parent handles an error without closing', async () => {
    const options = props();
    const { result } = renderHook(() => usePagoDialogController(options));
    await act(() => result.current.onSubmit(data));
    await act(() => result.current.onSubmit(data));
    const calls = vi.mocked(options.onConfirm).mock.calls;
    expect(calls[0][0].idempotencyKey).toBeTruthy();
    expect(calls[1][0].idempotencyKey).toBe(calls[0][0].idempotencyKey);
    expect(options.onOpenChange).not.toHaveBeenCalled();
  });

  it('does not call the parent twice during a double submit', async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { result } = renderHook(() => usePagoDialogController(props(onConfirm)));
    await act(async () => {
      const first = result.current.onSubmit(data);
      await result.current.onSubmit(data);
      result.current.handleCancel();
      result.current.handleOpenChange(false);
      expect(onConfirm).toHaveBeenCalledOnce();
      finish();
      await first;
    });
  });
});
