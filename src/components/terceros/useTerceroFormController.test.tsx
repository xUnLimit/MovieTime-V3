import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useTerceroFormController } from './useTerceroFormController';
import type { Tercero } from '@/types';

vi.mock('@/application/client-domain-mutations', () => ({ createTerceroMutation: vi.fn(), updateTerceroMutation: vi.fn() }));

const queryClient = new QueryClient();
const noMethods: [] = [];
const initialValues = { nombre: 'Ana' };
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('controlador del formulario de terceros', () => {
  it('restaura valores sugeridos y valida antes de mostrar pago', async () => {
    const { result } = renderHook(() => useTerceroFormController({
      tipoInicial: 'cliente', metodosPago: noMethods, valoresIniciales: initialValues,
    }), { wrapper });
    await waitFor(() => expect(result.current.tipoTerceroValue).toBe('cliente'));
    await act(async () => { await result.current.handleNext(); });
    expect(result.current.activeTab).toBe('personal');
    expect(result.current.errors.apellido).toBeDefined();
    await act(async () => { result.current.setValue('apellido', 'Pérez'); result.current.setValue('telefono', '61234567'); });
    await act(async () => { await result.current.handleNext(); });
    expect(result.current.activeTab).toBe('pago');
    expect(result.current.isPersonalTabComplete).toBe(true);
    act(() => { result.current.handlePrevious(); });
    expect(result.current.activeTab).toBe('personal');
  });

  it('ordena los metodos de terceros y permite volver a la pestaña personal', async () => {
    const { result } = renderHook(() => useTerceroFormController({ tipoInicial: 'revendedor', metodosPago: noMethods }), { wrapper });
    await waitFor(() => expect(result.current.tipoTerceroValue).toBe('revendedor'));
    expect(result.current.metodosPagoOrdenados).toHaveLength(1);
    expect(result.current.hasChanges).toBe(true);
    await act(async () => { await result.current.handleTabChange('personal'); });
    expect(result.current.activeTab).toBe('personal');
  });

  it('detecta cambios en edicion y permite abrir pago cuando los datos son validos', async () => {
    const usuario: Tercero = {
      id: 'tercero-1', nombre: 'Ana', apellido: 'Pérez', tipo: 'cliente', telefono: '61234567',
      metodoPagoId: '', metodoPagoNombre: 'Pendiente', active: true,
      createdAt: new Date(0), updatedAt: new Date(0), createdBy: 'test',
    };
    const { result } = renderHook(() => useTerceroFormController({
      usuario, tipoInicial: 'revendedor', metodosPago: noMethods,
    }), { wrapper });
    await waitFor(() => expect(result.current.tipoTerceroValue).toBe('cliente'));
    expect(result.current.hasChanges).toBe(false);
    await act(async () => { await result.current.handleTabChange('pago'); });
    expect(result.current.activeTab).toBe('pago');
    act(() => { result.current.setValue('nombre', 'Luisa'); });
    expect(result.current.hasChanges).toBe(true);
  });
});
