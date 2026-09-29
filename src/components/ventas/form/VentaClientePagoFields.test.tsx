import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tercero } from '@/types/clientes';
import { VentaClientePagoFields } from './VentaClientePagoFields';

const tercero: Tercero = {
  id: 'tercero-1', nombre: 'Ana', apellido: 'Perez', tipo: 'cliente', telefono: '6000-0000',
  metodoPagoId: 'mp-1', metodoPagoNombre: 'Yappy', active: true,
  createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), createdBy: 'admin',
};

function setPointer(fine: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: fine, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

function renderFields() {
  return render(
    <VentaClientePagoFields
      tercerosFiltrados={[tercero]}
      searchCliente=""
      metodosPago={[]}
      onSearchClienteChange={vi.fn()}
      onSelectTercero={vi.fn()}
      onSelectMetodoPago={vi.fn()}
    />,
  );
}

afterEach(() => setPointer(false));

describe('VentaClientePagoFields client search focus', () => {
  it('focuses the client search when the device has a mouse or trackpad', async () => {
    setPointer(true);
    renderFields();
    await userEvent.click(screen.getByRole('button', { name: /Seleccionar tercero/ }));
    expect(document.activeElement).toBe(await screen.findByPlaceholderText('Buscar tercero...'));
  });

  it('does not steal focus on touch devices so the virtual keyboard stays closed', async () => {
    setPointer(false);
    renderFields();
    await userEvent.click(screen.getByRole('button', { name: /Seleccionar tercero/ }));
    expect(document.activeElement).not.toBe(await screen.findByPlaceholderText('Buscar tercero...'));
  });
});
