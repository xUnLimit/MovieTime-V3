import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import type { Categoria, MetodoPago, PagoServicio, Servicio } from '@/types';
import type { ServicioFormData } from '@/components/servicios/form/servicio-form-schema';

const submitMocks = vi.hoisted(() => ({
  updateServicioPagoUseCase: vi.fn(),
  getVentasActivasParaCredenciales: vi.fn(),
  announce: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/application/use-cases/servicios/servicios-payment-use-cases', () => ({
  updateServicioPagoUseCase: submitMocks.updateServicioPagoUseCase,
}));

vi.mock('@/application/use-cases/servicios/servicio-credential-notification-use-case', () => ({
  getVentasActivasParaCredenciales: submitMocks.getVentasActivasParaCredenciales,
}));

vi.mock('sonner', () => ({
  toast: {
    success: submitMocks.toastSuccess,
    info: submitMocks.toastInfo,
    error: submitMocks.toastError,
  },
}));

vi.mock('@/platform/observability/logger', () => ({
  reportError: vi.fn(),
}));

vi.mock('@/components/shared/announce-notice', () => ({ announceNotice: submitMocks.announce }));

import { useServicioFormSubmit } from './useServicioFormSubmit';

const categoria: Categoria = {
  id: 'categoria-1',
  nombre: 'Spotify',
  tipo: 'cliente',
  tipoCategoria: 'plataforma_streaming',
  activo: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  tiposPlanes: [
    {
      id: 'plan-1',
      nombre: 'Individual',
    },
  ],
  totalServicios: 1,
  serviciosActivos: 1,
  perfilesDisponiblesTotal: 0,
  ventasTotales: 0,
  ingresosTotales: 0,
  gastosTotal: 10,
};

const metodoPago: MetodoPago = {
  id: 'metodo-1',
  nombre: 'Banco',
  moneda: 'USD',
  pais: 'PA',
  titular: 'MovieTime',
  identificador: 'cuenta-1',
  activo: true,
  tipo: 'banco',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const servicio: Servicio = {
  id: 'servicio-1',
  categoriaId: 'categoria-1',
  categoriaNombre: 'Spotify',
  nombre: 'Spotify - Individual',
  tipo: 'plan-1',
  tipoNombre: 'Individual',
  correo: 'spotify@example.com',
  contrasena: 'secret123',
  perfilesDisponibles: 1,
  perfilesOcupados: 1,
  costoServicio: 10,
  gastosTotal: 10,
  metodoPagoId: 'metodo-1',
  metodoPagoNombre: 'Banco',
  moneda: 'USD',
  cicloPago: 'mensual',
  fechaInicio: new Date('2026-06-01T00:00:00Z'),
  fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
  activo: true,
  renovacionAutomatica: true,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-01T00:00:00Z'),
  createdBy: 'admin',
};

const ultimoPago: PagoServicio = {
  id: 'pago-1',
  servicioId: 'servicio-1',
  categoriaId: 'categoria-1',
  moneda: 'USD',
  isPagoInicial: false,
  fecha: new Date('2026-06-01T00:00:00Z'),
  descripcion: 'Renovacion #1',
  cicloPago: 'mensual',
  fechaInicio: new Date('2026-06-01T00:00:00Z'),
  fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
  monto: 10,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  updatedAt: new Date('2026-06-01T00:00:00Z'),
};

const formData: ServicioFormData = {
  nombre: 'Spotify - Individual',
  categoriaId: 'categoria-1',
  tipoPlan: 'plan-1',
  correo: 'spotify@example.com',
  contrasena: 'secret123',
  metodoPagoId: 'metodo-1',
  costoServicio: '10',
  perfilesDisponibles: '1',
  cicloPago: 'mensual',
  fechaInicio: new Date('2026-06-01T00:00:00Z'),
  fechaVencimiento: new Date('2026-07-01T00:00:00Z'),
  estado: 'activo',
  renovacionAutomatica: false,
  diasReposo: '28',
  notas: '',
};

describe('useServicioFormSubmit', () => {
  beforeEach(() => {
    submitMocks.updateServicioPagoUseCase.mockReset().mockResolvedValue({ servicioActualizado: null });
    submitMocks.getVentasActivasParaCredenciales.mockReset().mockResolvedValue([]);
    submitMocks.toastSuccess.mockReset();
    submitMocks.toastInfo.mockReset();
    submitMocks.toastError.mockReset();
  });

  it('passes the edited autorenew value to the current payment period update', async () => {
    const updateServicio = vi.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;
    const { result } = renderHook(() => useServicioFormSubmit({
      categorias: [categoria],
      createServicio: vi.fn(),
      enqueueWhatsAppMessages: vi.fn(),
      metodosPago: [metodoPago],
      onSaved: vi.fn(),
      perfilesOcupadosReal: 1,
      queryClient,
      refreshPagos: vi.fn(),
      servicio,
      setError: vi.fn(),
      terceros: [],
      ultimoPago,
      updateServicio,
    }));

    await act(() => result.current.onSubmit(formData));

    expect(updateServicio).toHaveBeenCalledWith(
      'servicio-1',
      expect.objectContaining({
        renovacionAutomatica: false,
      }),
    );
    expect(submitMocks.updateServicioPagoUseCase).toHaveBeenCalledWith(
      servicio,
      ultimoPago,
      expect.objectContaining({
        renovacionAutomatica: false,
      }),
      expect.any(Object),
    );
  });
});


it('routes every active sale through the automatic rule even without a linked Meta template', async () => {
  submitMocks.getVentasActivasParaCredenciales.mockResolvedValue([
    { id: 'venta-1', clienteNombre: 'Ana', clienteTelefono: '60000001' },
    { id: 'venta-2', clienteNombre: 'Beto', clienteTelefono: '60000002' },
  ]);
  const enqueue = vi.fn();
  const { result } = renderHook(() => useServicioFormSubmit({
    categorias: [categoria], createServicio: vi.fn(), enqueueWhatsAppMessages: enqueue,
    metodosPago: [metodoPago], onSaved: vi.fn(), perfilesOcupadosReal: 1,
    queryClient: new QueryClient(), refreshPagos: vi.fn(), servicio,
    setError: vi.fn(), terceros: [], updateServicio: vi.fn(),
  }));
  await act(() => result.current.onSubmit({ ...formData, contrasena: 'new-test-password' }));
  expect(submitMocks.announce).toHaveBeenCalledWith(expect.objectContaining({
    tipo: 'actualizacion_credenciales', eventId: expect.any(String),
    items: [
      { ventaId: 'venta-1', message: expect.objectContaining({ phone: '60000001' }) },
      { ventaId: 'venta-2', message: expect.objectContaining({ phone: '60000002' }) },
    ],
  }));
  expect(enqueue).not.toHaveBeenCalled();
});

it.each([true, false])('notifies code-access toggle only with dialog confirmation (%s)', async confirmed => {
  submitMocks.announce.mockClear();
  submitMocks.getVentasActivasParaCredenciales.mockResolvedValue([{ id: 'venta-1', clienteNombre: 'Ana', clienteTelefono: '60000001' }]);
  const { result } = renderHook(() => useServicioFormSubmit({
    categorias: [{ ...categoria, codeProvider: 'netflix' }], createServicio: vi.fn(), enqueueWhatsAppMessages: vi.fn(),
    metodosPago: [metodoPago], onSaved: vi.fn(), perfilesOcupadosReal: 1,
    queryClient: new QueryClient(), refreshPagos: vi.fn(), servicio,
    setError: vi.fn(), terceros: [], updateServicio: vi.fn(), codeAccessNoticeConfirmed: () => confirmed,
  }));
  await act(() => result.current.onSubmit({ ...formData, accesoPorCodigo: true, contrasena: 'new-test-password' }));
  if (!confirmed) { expect(submitMocks.announce).not.toHaveBeenCalled(); return; }
  expect(submitMocks.announce).toHaveBeenCalledTimes(1);
  const text = JSON.stringify(submitMocks.announce.mock.calls[0][0].items);
  expect(text).not.toContain('new-test-password'); expect(text).toContain('código');
});
it('offers credentials after disabling code access', async () => {
  submitMocks.announce.mockClear();
  submitMocks.getVentasActivasParaCredenciales.mockResolvedValue([{ id: 'venta-1', clienteNombre: 'Ana', clienteTelefono: '60000001' }]);
  const { result } = renderHook(() => useServicioFormSubmit({
    categorias: [categoria], createServicio: vi.fn(), enqueueWhatsAppMessages: vi.fn(),
    metodosPago: [metodoPago], onSaved: vi.fn(), perfilesOcupadosReal: 1,
    queryClient: new QueryClient(), refreshPagos: vi.fn(), servicio: { ...servicio, accesoPorCodigo: true },
    setError: vi.fn(), terceros: [], updateServicio: vi.fn(), codeAccessNoticeConfirmed: () => true,
  }));
  await act(() => result.current.onSubmit({ ...formData, accesoPorCodigo: false }));
  expect(submitMocks.announce).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'actualizacion_credenciales' }));
});
