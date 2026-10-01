import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MetodoPago, Tercero } from '@/types';
import { submitTerceroForm } from './tercero-form-submit';
import type { TerceroFormData } from './tercero-form-values';

const mutations = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/application/client-domain-mutations', () => ({ createTerceroMutation: mutations.create, updateTerceroMutation: mutations.update }));
vi.mock('sonner', () => ({ toast }));

const data: TerceroFormData = {
  nombre: 'Ana', apellido: 'Pérez', tipoTercero: 'cliente', telefono: '61234567', metodoPagoId: 'pending', notas: ' nota ',
};
const existing: Tercero = {
  id: 'tercero-1', nombre: 'Ana', apellido: 'Pérez', tipo: 'revendedor', telefono: '61234567',
  metodoPagoId: 'pending', metodoPagoNombre: 'Pendiente', active: true,
  createdAt: new Date(0), updatedAt: new Date(0), createdBy: 'test',
};

describe('envio del formulario de terceros', () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient();
    mutations.create.mockResolvedValue(undefined);
    mutations.update.mockResolvedValue(undefined);
  });

  it('crea un tercero, formatea telefono e invalida su consulta', async () => {
    const success = vi.fn();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    await submitTerceroForm(data, null, [], queryClient, success);
    expect(mutations.create).toHaveBeenCalledWith(expect.objectContaining({ telefono: '+507 6123-4567', notas: 'nota' }));
    expect(invalidate).toHaveBeenCalled();
    expect(success).toHaveBeenCalledOnce();
  });

  it('actualiza un tercero y comunica el cambio de tipo', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    await submitTerceroForm(data, existing, [], queryClient);
    expect(mutations.update).toHaveBeenCalledWith(existing.id, expect.objectContaining({ tipo: 'cliente' }), existing);
    expect(toast.success).toHaveBeenCalledWith('Tipo de tercero actualizado', expect.any(Object));
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('usa el metodo de pago seleccionado y muestra un error publico cuando falla', async () => {
    const method = { id: 'method-1', nombre: 'Banco', moneda: 'USD' } as MetodoPago;
    mutations.create.mockRejectedValue(new Error('Fallo'));
    await submitTerceroForm({ ...data, metodoPagoId: 'method-1', telefono: '+50761234567' }, null, [method], queryClient);
    expect(mutations.create).toHaveBeenCalledWith(expect.objectContaining({ metodoPagoNombre: 'Banco', telefono: '+507 6123-4567' }));
    expect(toast.error).toHaveBeenCalledWith('Error al guardar tercero', expect.any(Object));
  });

  it('conserva telefonos internacionales cortos y telefonos locales no estandar', async () => {
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    await submitTerceroForm({ ...data, telefono: '+12345678' }, null, [], queryClient);
    expect(mutations.create).toHaveBeenLastCalledWith(expect.objectContaining({ telefono: '+12345678' }));
    await submitTerceroForm({ ...data, telefono: '1234567' }, null, [], queryClient);
    expect(mutations.create).toHaveBeenLastCalledWith(expect.objectContaining({ telefono: '1234567' }));
  });

  it('actualiza sin cambio de tipo y comunica fallos de invalidacion', async () => {
    vi.spyOn(queryClient, 'invalidateQueries').mockRejectedValue(new Error('Sin conexión'));
    await submitTerceroForm({ ...data, tipoTercero: 'revendedor' }, existing, [], queryClient);
    expect(toast.success).toHaveBeenCalledWith('Revendedor actualizado', expect.any(Object));
    expect(toast.error).toHaveBeenCalledWith('Error al guardar tercero', expect.any(Object));
  });
});
