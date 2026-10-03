import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviciosRepository = vi.hoisted(() => ({
  createServicioWithInitialPayment: vi.fn(),
  getServicioById: vi.fn(),
  queryPagosServicio: vi.fn(),
  removeServicio: vi.fn(),
  removeServicioWithPayments: vi.fn(),
  updateLatestServicioPeriodo: vi.fn(),
  updateServicio: vi.fn(),
}));

const catalogos = vi.hoisted(() => ({
  getMetodoPagoById: vi.fn(),
}));

const payments = vi.hoisted(() => ({
  convertToUSD: vi.fn(async (amount: number) => amount),
  sumPaymentsInUSD: vi.fn(async () => 0),
}));

const dependencies = vi.hoisted(() => ({
  resyncServiciosDenormalizedData: vi.fn(),
  syncServicioDependencias: vi.fn(),
}));

const eventBus = vi.hoisted(() => ({
  storeEventBus: { emit: vi.fn() },
}));

vi.mock('@/platform/supabase/servicios-repository', () => serviciosRepository);
vi.mock('@/platform/supabase/catalogos-repository', () => catalogos);
vi.mock('@/modules/payments', () => payments);
vi.mock('@/application/use-cases/servicios/servicio-dependencies-use-cases', () => dependencies);
vi.mock('@/platform/events/store-event-bus', () => eventBus);

import { createServicioUseCase } from './servicios-write-use-cases';
import type { Servicio } from '@/types';

const servicioData = {
  categoriaId: 'categoria-1',
  tipo: 'pantalla',
  nombre: 'Netflix',
  correo: 'cuenta@example.com',
  contrasena: 'secret',
  perfilesDisponibles: 4,
  costoServicio: 20,
  cicloPago: 'mensual',
  metodoPagoId: 'metodo-1',
  fechaInicio: new Date('2026-05-01T00:00:00.000Z'),
  fechaVencimiento: new Date('2026-06-01T00:00:00.000Z'),
} as unknown as Omit<Servicio, 'id' | 'createdAt' | 'updatedAt' | 'perfilesOcupados'>;

beforeEach(() => {
  vi.clearAllMocks();
  serviciosRepository.createServicioWithInitialPayment.mockResolvedValue('servicio-1');
  catalogos.getMetodoPagoById.mockResolvedValue({ id: 'metodo-1', nombre: 'Tarjeta', moneda: 'USD' });
});

describe('createServicioUseCase', () => {
  it('creates a servicio with its initial payment through the RPC and resolves the payment method', async () => {
    const recordActivityLog = vi.fn().mockResolvedValue(undefined);

    const result = await createServicioUseCase(servicioData, {
      logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
      recordActivityLog,
    });

    // Resuelve el metodo de pago para snapshot de nombre/moneda.
    expect(catalogos.getMetodoPagoById).toHaveBeenCalledWith('metodo-1');
    // El RPC de creacion-con-pago-inicial recibe los montos y datos correctos.
    expect(serviciosRepository.createServicioWithInitialPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        p_categoria_id: 'categoria-1',
        p_nombre: 'Netflix',
        p_costo_original: 20,
        p_moneda_original: 'USD',
        p_metodo_pago_id: 'metodo-1',
        p_metodo_pago_nombre_snapshot: 'Tarjeta',
        p_ciclo_pago: 'mensual',
      }),
    );
    expect(result.servicio).toMatchObject({ id: 'servicio-1', metodoPagoNombre: 'Tarjeta' });
  });

  it('records the creation activity and emits SERVICIO_CREATED exactly once (single emitter)', async () => {
    const recordActivityLog = vi.fn().mockResolvedValue(undefined);

    await createServicioUseCase(servicioData, {
      logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
      recordActivityLog,
    });

    expect(recordActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'creacion', entidad: 'servicio', entidadId: 'servicio-1' }),
    );
    // El use-case es el unico emisor del evento de dominio (regla de la auditoria).
    expect(eventBus.storeEventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.storeEventBus.emit).toHaveBeenCalledWith({ type: 'SERVICIO_CREATED', servicioId: 'servicio-1' });
  });

  it('defaults currency to USD when the servicio has no payment method', async () => {
    const sinMetodo = { ...servicioData, metodoPagoId: undefined };

    await createServicioUseCase(sinMetodo, {
      logContext: { usuarioId: 'u1', usuarioEmail: 'u@test.com' },
    });

    expect(catalogos.getMetodoPagoById).not.toHaveBeenCalled();
    expect(serviciosRepository.createServicioWithInitialPayment).toHaveBeenCalledWith(
      expect.objectContaining({ p_moneda_original: 'USD', p_metodo_pago_id: null }),
    );
  });
});
