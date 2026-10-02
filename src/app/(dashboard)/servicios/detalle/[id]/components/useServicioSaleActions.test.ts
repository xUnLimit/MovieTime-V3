import { act, renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { Servicio, VentaDoc } from '@/types';

const mocks = vi.hoisted(() => ({ announce: vi.fn(), transfer: vi.fn(), fetch: vi.fn(), success: vi.fn() }));
vi.mock('@/components/shared/announce-notice', () => ({ announceNotice: mocks.announce }));
vi.mock('@/platform/activity/activity-log-adapter', () => ({ getActivityLogOptions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: vi.fn() } }));
vi.mock('@/application/use-cases/servicios/servicio-detail-use-cases', () => ({
  fetchVentaForServicioActionUseCase: mocks.fetch,
  transferVentaFromServicioDetalleWorkflow: mocks.transfer,
  cutVentaFromServicioDetalleWorkflow: vi.fn(),
}));
vi.mock('../servicio-detalle-helpers', () => ({
  buildTransferVentaForMessage: vi.fn(),
  buildTransferWhatsAppToast: () => ({ phone: '60000001', message: 'Nuevos datos', title: 'Transferencia', description: 'D' }),
}));
import { useServicioSaleActions } from './useServicioSaleActions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({ id: 'venta-1', clienteNombre: 'Ana' });
  mocks.transfer.mockResolvedValue({ type: 'servicioVentaTransferred', ventaId: 'venta-1' });
});

it.each([true, false])('uses the automatic notice rule without requiring a Meta link (checkbox: %s)', async (notificarWhatsApp) => {
  mocks.announce.mockResolvedValue('sent');
  const enqueue = vi.fn();
  const { result } = renderHook(() => useServicioSaleActions({
    enqueueWhatsAppMessages: enqueue, fetchServicios: vi.fn(), deleteNotificacionesPorVenta: vi.fn(),
    refetchServicios: vi.fn(), refetchTemplates: vi.fn(), getTemplateByTipo: () => undefined,
    queryClient: new QueryClient(), updatePerfilOcupado: vi.fn(), setVentasServicio: vi.fn(),
  }));
  await act(() => result.current.handleOpenTransferVenta('venta-1'));
  await act(() => result.current.handleConfirmTransferVenta({
    servicio: { id: 'servicio-2', nombre: 'Nuevo servicio' } as Servicio,
    codigo: '', perfilNombre: 'Perfil 1', perfilNumero: 1, notificarWhatsApp,
  }));
  expect(mocks.announce).toHaveBeenCalledWith(expect.objectContaining({
    tipo: 'transferencia_servicio',
    items: [{ ventaId: 'venta-1', message: expect.objectContaining({ message: 'Nuevos datos' }) }],
  }));
  expect(enqueue).not.toHaveBeenCalled();
  expect(result.current.selectedActionVenta).toBeNull();
  expect(result.current.transferVentaDialogOpen).toBe(false);
});

it('preserves the unchecked checkbox with automatic sending off', async () => {
  mocks.announce.mockImplementation(async (input) => { await input.onAutoDisabled(); });
  const { result } = renderHook(() => useServicioSaleActions({
    enqueueWhatsAppMessages: vi.fn(), fetchServicios: vi.fn(), deleteNotificacionesPorVenta: vi.fn(),
    refetchServicios: vi.fn(), refetchTemplates: vi.fn(), getTemplateByTipo: () => undefined,
    queryClient: new QueryClient(), updatePerfilOcupado: vi.fn(), setVentasServicio: vi.fn(),
  }));
  await act(() => result.current.setSelectedActionVenta({ id: 'venta-1', clienteNombre: 'Ana' } as VentaDoc));
  await act(() => result.current.handleConfirmTransferVenta({
    servicio: { id: 'servicio-2', nombre: 'Nuevo servicio' } as Servicio,
    codigo: '', perfilNombre: '', perfilNumero: 1, notificarWhatsApp: false,
  }));
  expect(mocks.success).toHaveBeenCalledWith('Venta transferida');
});
