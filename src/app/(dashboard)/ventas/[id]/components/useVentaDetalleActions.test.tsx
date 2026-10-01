import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deletePayment: vi.fn(),
  deleteVenta: vi.fn(),
  getLog: vi.fn(() => ({ logContext: {}, recordActivityLog: vi.fn() })),
  notifyCommitted: vi.fn(),
  refund: vi.fn(),
  renew: vi.fn(),
  reportError: vi.fn(),
  showWhatsApp: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  updatePayment: vi.fn(),
}));

vi.mock('@/application/use-cases/ventas/venta-detail-use-cases', () => ({
  deleteVentaDetalleWorkflow: mocks.deleteVenta,
  deleteVentaPagoDetalleWorkflow: mocks.deletePayment,
  refundVentaDetalleWorkflow: mocks.refund,
  renewVentaDetalleWorkflow: mocks.renew,
  updateVentaPagoDetalleWorkflow: mocks.updatePayment,
}));
vi.mock('@/platform/activity/activity-log-adapter', () => ({
  getActivityLogOptions: mocks.getLog,
}));
vi.mock('@/platform/observability/logger', () => ({ reportError: mocks.reportError }));
vi.mock('@/components/shared/notify-committed-mutation', () => ({
  notifyCommittedMutation: mocks.notifyCommitted,
}));
vi.mock('./venta-detalle-whatsapp', () => ({
  showVentaRenovadaWhatsAppToast: mocks.showWhatsApp,
}));
vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
  },
}));

import { useVentaDetalleActions } from './useVentaDetalleActions';

const venta = { id: 'venta-1', servicioId: 'servicio-1' } as never;

function renderActions(overrides: Record<string, unknown> = {}) {
  const params = {
    deleteNotificacionesPorVenta: vi.fn(),
    deleteVenta: vi.fn(),
    ensureDialogDependencies: vi.fn().mockResolvedValue({ status: 'ready' }),
    getTemplateByTipo: vi.fn().mockReturnValue({ id: 'template-1' }),
    id: 'venta-1',
    inactivateServicio: vi.fn(),
    metodosPago: [],
    onDeleted: vi.fn(),
    queryClient: { invalidateQueries: vi.fn() },
    refreshPagos: vi.fn(),
    servicioContrasena: 'secret',
    setVentaData: vi.fn(),
    updatePerfilOcupado: vi.fn(),
    venta,
    ...overrides,
  };
  return { params, ...renderHook(() => useVentaDetalleActions(params as never)) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.renew.mockResolvedValue({
    type: 'ventaRenewed',
    monto: 15,
    syncPaymentMethodFailed: false,
    ventaActualizada: { id: 'venta-1', estado: 'activo' },
    whatsappRequested: true,
  });
  mocks.deleteVenta.mockResolvedValue({ type: 'ventaDeleted', deletedPayments: true });
  mocks.refund.mockResolvedValue({
    type: 'ventaRefunded', serviceInactivated: true, cut: true, ventaActualizada: { id: 'venta-1' },
  });
  mocks.updatePayment.mockResolvedValue({
    type: 'ventaPaymentUpdated', syncPaymentMethodFailed: true, ventaActualizada: { id: 'venta-1' },
  });
  mocks.deletePayment.mockResolvedValue({
    type: 'ventaPaymentDeleted', ventaActualizada: { id: 'venta-1' },
  });
  mocks.notifyCommitted.mockReturnValue(false);
});

describe('useVentaDetalleActions', () => {
  it('hands the renewal to the notice flow with the customer choice from the payment dialog', async () => {
    const { params, result } = renderActions();

    await act(async () => {
      await result.current.handleConfirmRenovacion({ enviarWhatsApp: true } as never);
    });

    expect(params.setVentaData).toHaveBeenCalledWith(expect.objectContaining({ id: 'venta-1' }));
    expect(mocks.showWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      monto: 15,
      notificarCliente: true,
      servicioContrasena: 'secret',
      venta,
    }));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('still runs the notice flow when the dialog did not ask to notify, because the automatic switch decides', async () => {
    mocks.renew.mockResolvedValueOnce({
      type: 'ventaRenewed',
      monto: 15,
      syncPaymentMethodFailed: false,
      ventaActualizada: { id: 'venta-1' },
      whatsappRequested: false,
    });
    const { result } = renderActions();
    await act(async () => {
      await result.current.handleConfirmRenovacion({ enviarWhatsApp: false } as never);
    });
    expect(mocks.showWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ notificarCliente: false }));
  });

  it('opens dependencies and deletes a sale with its payment records', async () => {
    const { params, result } = renderActions();
    await act(async () => {
      await result.current.handleOpenRenovar();
      await result.current.handleOpenReembolso();
      await result.current.handleDelete(true);
    });
    expect(params.ensureDialogDependencies).toHaveBeenCalledTimes(2);
    expect(mocks.deleteVenta).toHaveBeenCalled();
    expect(params.onDeleted).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Venta eliminada', expect.objectContaining({
      description: expect.stringContaining('registros de pago'),
    }));
  });

  it.each([
    ['empty', 'No hay metodos de pago disponibles'],
    ['unavailable', 'No se pudieron cargar los metodos de pago'],
  ])('keeps payment dialogs closed when dependencies are %s', async (status, message) => {
    const { result } = renderActions({
      ensureDialogDependencies: vi.fn().mockResolvedValue({ status }),
    });

    await act(async () => {
      await result.current.handleOpenRenovar();
      await result.current.handleOpenReembolso();
      await result.current.handleEditarPago({ id: 'pago-1' } as never);
    });

    expect(result.current.renovarDialogOpen).toBe(false);
    expect(result.current.reembolsoDialogOpen).toBe(false);
    expect(result.current.editarPagoDialogOpen).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(message, expect.any(Object));
  });

  it('registers a refund and updates the current sale', async () => {
    const { params, result } = renderActions();
    await act(async () => {
      await result.current.handleConfirmReembolso({ monto: 10 } as never);
    });
    expect(mocks.refund).toHaveBeenCalled();
    expect(params.setVentaData).toHaveBeenCalledWith({ id: 'venta-1' });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Venta reembolsada, cortada y servicio inactivado');
  });

  it('invalidates notifications and reports a failed refund', async () => {
    mocks.refund.mockImplementationOnce(async (params: { deps: { invalidateNotifications: () => Promise<unknown> } }) => {
      await params.deps.invalidateNotifications();
      throw new Error('Refund failed');
    });
    const { params, result } = renderActions();
    await act(async () => {
      await result.current.handleConfirmReembolso({ monto: 10 } as never);
    });
    expect(params.queryClient.invalidateQueries).toHaveBeenCalled();
    expect(mocks.reportError).toHaveBeenCalledWith('VentaDetalleActions', 'Error registrando reembolso', expect.any(Error));
    expect(mocks.toastError).toHaveBeenCalledWith('Error al registrar reembolso', expect.any(Object));
  });

  it('closes the refund dialog when a committed mutation reports a follow-up error', async () => {
    mocks.refund.mockRejectedValueOnce(new Error('Follow-up failed'));
    mocks.notifyCommitted.mockReturnValueOnce(true);
    const { result } = renderActions();
    await act(async () => { await result.current.handleOpenReembolso(); });
    expect(result.current.reembolsoDialogOpen).toBe(true);
    await act(async () => { await result.current.handleConfirmReembolso({ monto: 10 } as never); });
    expect(result.current.reembolsoDialogOpen).toBe(false);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: 'ventaRefunded', cut: true, serviceInactivated: false }, 'Venta reembolsada y cortada'],
    [{ type: 'refundRecorded' }, 'Reembolso registrado'],
  ])('reports the refund outcome %s', async (outcome, message) => {
    mocks.refund.mockResolvedValueOnce(outcome);
    const { result } = renderActions();
    await act(async () => { await result.current.handleConfirmReembolso({ monto: 10 } as never); });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(message);
  });

  it('edits and deletes an existing payment', async () => {
    const pago = { id: 'pago-1' } as never;
    const { params, result } = renderActions();
    await act(async () => {
      await result.current.handleEditarPago(pago);
    });
    await act(async () => {
      await result.current.handleConfirmEditarPago({ monto: 20 } as never);
    });
    act(() => result.current.handleDeletePago(pago));
    await act(async () => {
      await result.current.handleConfirmDeletePago();
    });
    expect(mocks.updatePayment).toHaveBeenCalledWith(expect.objectContaining({ pagoId: 'pago-1' }));
    expect(mocks.deletePayment).toHaveBeenCalledWith({ id: 'venta-1', pagoId: 'pago-1' });
    expect(params.refreshPagos).toHaveBeenCalledTimes(2);
    expect(params.setVentaData).toHaveBeenCalledTimes(2);
    expect(mocks.toastWarning).toHaveBeenCalled();
  });

  it('returns safely when sale or payment data is missing', async () => {
    const { result } = renderActions({ venta: null });
    await act(async () => {
      await result.current.handleDelete(false);
      await result.current.handleConfirmRenovacion({} as never);
      await result.current.handleConfirmReembolso({} as never);
      await result.current.handleConfirmEditarPago({} as never);
      await result.current.handleConfirmDeletePago();
    });
    expect(mocks.reportError).toHaveBeenCalledTimes(2);
    expect(mocks.renew).not.toHaveBeenCalled();
  });
});
