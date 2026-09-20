import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  notifications: vi.fn(), metodoById: vi.fn(), metodos: vi.fn(), categoria: vi.fn(),
  servicios: vi.fn(), servicioById: vi.fn(), ventaById: vi.fn(), timestamp: vi.fn(),
}));
vi.mock('./notifications-repository', () => ({ queryNotifications: mocks.notifications }));
vi.mock('./catalogos-repository', () => ({ getMetodoPagoById: mocks.metodoById, queryMetodosPago: mocks.metodos }));
vi.mock('./categorias-repository', () => ({ getCategoriaById: mocks.categoria }));
vi.mock('./servicios-repository', () => ({ queryServicios: mocks.servicios, getServicioById: mocks.servicioById }));
vi.mock('./ventas-repository', () => ({ getVentaById: mocks.ventaById, timestampToDate: mocks.timestamp }));

import {
  fetchServiciosByIdsRead, getCategoriaPlanesRead, getCategoriaRead, getMetodoPagoRead,
  getServicioContrasenaRead, getServicioRead, getServicioTipoRead, getVentaDetalleRead,
  queryMetodosPagoRead, queryMetodosPagoServiciosRead, queryMetodosPagoTercerosRead,
  queryNotificationIdsRead, queryNotificationsRead,
} from './domain-read-adapters';

beforeEach(() => vi.clearAllMocks());

describe('domain read adapters', () => {
  it('delegates typed notification, payment, category and service reads', async () => {
    mocks.notifications.mockResolvedValue([]);
    mocks.metodoById.mockResolvedValue({ id: 'm1' });
    mocks.metodos.mockResolvedValue([]);
    mocks.categoria.mockResolvedValue({ id: 'c1' });
    mocks.servicios.mockResolvedValue([]);
    mocks.servicioById.mockResolvedValue({ id: 's1' });
    expect(await queryNotificationsRead()).toEqual([]);
    expect(await queryNotificationIdsRead([{ field: 'id', operator: '==', value: 'n1' }])).toEqual([]);
    expect(await getMetodoPagoRead('m1')).toEqual({ id: 'm1' });
    expect(await queryMetodosPagoRead()).toEqual([]);
    expect(await getCategoriaRead('c1')).toEqual({ id: 'c1' });
    expect(await getServicioRead('s1')).toEqual({ id: 's1' });
    expect(await fetchServiciosByIdsRead(['s1'])).toEqual([]);
    expect(mocks.servicios).toHaveBeenCalledWith([{ field: '__name__', operator: 'in', value: ['s1'] }]);
  });

  it('builds service and tercero payment-method filters with optional active status', async () => {
    mocks.metodos.mockResolvedValue([]);
    await queryMetodosPagoServiciosRead();
    await queryMetodosPagoServiciosRead({ soloActivos: true });
    await queryMetodosPagoTercerosRead();
    await queryMetodosPagoTercerosRead({ soloActivos: true });
    expect(mocks.metodos.mock.calls).toEqual([
      [[{ field: 'asociadoA', operator: '==', value: 'servicio' }]],
      [[{ field: 'asociadoA', operator: '==', value: 'servicio' }, { field: 'activo', operator: '==', value: true }]],
      [[{ field: 'asociadoA', operator: '==', value: 'tercero' }]],
      [[{ field: 'asociadoA', operator: '==', value: 'tercero' }, { field: 'activo', operator: '==', value: true }]],
    ]);
  });

  it('returns category plans, service type and password with safe fallbacks', async () => {
    mocks.categoria.mockResolvedValueOnce({ planes: [{ id: 'p1' }] }).mockResolvedValueOnce(null).mockResolvedValueOnce({ planes: 'bad' });
    expect(await getCategoriaPlanesRead('c1')).toEqual([{ id: 'p1' }]);
    expect(await getCategoriaPlanesRead('c2')).toEqual([]);
    expect(await getCategoriaPlanesRead('c3')).toEqual([]);
    mocks.servicioById.mockResolvedValueOnce({ tipo: 'premium', contrasena: 'secret' }).mockResolvedValueOnce(null).mockResolvedValueOnce({});
    expect(await getServicioTipoRead('s1')).toBe('premium');
    expect(await getServicioContrasenaRead('s2')).toBe('');
    expect(await getServicioTipoRead('s3')).toBeUndefined();
  });

  it('returns null for a missing sale and maps complete sale details', async () => {
    mocks.ventaById.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'v1', clienteId: 'c1', clienteNombre: 'Ana', categoriaId: 'cat', categoriaNombre: 'Streaming',
      servicioId: 's1', servicioNombre: 'Netflix', servicioCorreo: 'a@b.com', clienteTelefono: '6000',
      perfilNumero: 2, perfilNombre: 'P2', codigo: '123', notas: 'n', estado: 'cortada',
      cortadaAt: '2026-01-02', motivoCorte: 'm', createdAt: 'created',
      fechaInicio: new Date(2026, 0, 1), fechaFin: new Date(2026, 1, 1), cicloPago: 'mensual',
      planId: 'p1', planNombre: 'Plan', planTipoNombre: 'Premium',
    });
    mocks.timestamp.mockReturnValue(new Date(2026, 0, 1));
    expect(await getVentaDetalleRead('missing')).toBeNull();
    expect(await getVentaDetalleRead('v1')).toEqual(expect.objectContaining({
      id: 'v1', clienteNombre: 'Ana', servicioNombre: 'Netflix', perfilNumero: 2, motivoCorte: 'm', planId: 'p1',
    }));
  });

  it('applies every safe default for sparse sale details', async () => {
    mocks.ventaById.mockResolvedValue({ id: 'v2' });
    const result = await getVentaDetalleRead('v2');
    expect(result).toEqual(expect.objectContaining({
      clienteId: '', clienteNombre: 'Sin cliente', categoriaId: '', categoriaNombre: undefined,
      servicioId: '', servicioNombre: 'Servicio', servicioCorreo: '', clienteTelefono: undefined,
      perfilNumero: null, perfilNombre: '', codigo: '', notas: '', estado: 'activo',
      cortadaAt: null, motivoCorte: null, cicloPago: 'mensual', planId: undefined,
    }));
    expect(result?.fechaInicio).toBeInstanceOf(Date);
    expect(result?.fechaFin).toBeInstanceOf(Date);
  });
});
