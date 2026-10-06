import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefinition, getCatalogMessage } from '@/modules/bot-config';
import type { BotDefinition } from '@/types/bot';
import { ServiceMessagesEditor } from './ServiceMessagesEditor';

const state = vi.hoisted(() => ({ data: undefined as unknown, isPending: false, isError: false, refetch: vi.fn() }));
vi.mock('@/hooks/use-categorias-full', () => ({ useCategoriasFull: () => state }));

const plan = (id: string, nombre: string, precio: number) => ({ id, nombre, precio, cicloPago: 'mensual', tipoPlan: 't' });
const netflix = { id: 'cat-netflix', nombre: 'Netflix', activo: true, planes: [plan('plan-basico', 'Básico', 4), plan('plan-premium', 'Premium', 8)] };
const disney = { id: 'cat-disney', nombre: 'Disney+', activo: true, planes: [plan('plan-disney', 'Anual', 20)] };
const hidden = { id: 'cat-off', nombre: 'Oculta', activo: false, planes: [] };

const seen: { def: BotDefinition } = { def: defaultDefinition() };
function Harness() {
  const [def, setDef] = useState(defaultDefinition());
  return <ServiceMessagesEditor def={def} update={(updater) => setDef((current) => { const next = updater(current); seen.def = next; return next; })} />;
}

beforeEach(() => { seen.def = defaultDefinition(); state.data = [netflix, disney, hidden]; state.isPending = false; state.isError = false; state.refetch.mockReset(); });

describe('ServiceMessagesEditor', () => {
  it('lista solo las plataformas activas y las busca por plataforma o plan', async () => {
    render(<Harness />);
    const list = within(screen.getByRole('list', { name: 'Servicios' }));
    expect(list.getAllByRole('button')).toHaveLength(2);
    expect(screen.queryByText('Oculta')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar un servicio' }), { target: { value: 'premium' } });
    expect(list.getAllByRole('button')).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar un servicio' }), { target: { value: 'zzzz' } });
    expect(screen.getByText('Ningún servicio coincide con la búsqueda.')).toBeTruthy();
  });

  it('guarda un mensaje propio de un plan, muestra su vista previa y vuelve al texto general al quitarlo', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Netflix/ }));
    const section = within(screen.getByRole('region', { name: 'Mensajes del plan Premium' }));
    fireEvent.change(section.getByLabelText('Al elegir el plan'), { target: { value: 'Premium: 4 pantallas en HD para {{servicio}}' } });
    expect(getCatalogMessage(seen.def, 'plan', 'plan-premium', 'added')).toBe('Premium: 4 pantallas en HD para {{servicio}}');
    expect(section.getByText('Premium: 4 pantallas en HD para Netflix Premium')).toBeTruthy();
    expect(screen.getByText('1 mensaje propio')).toBeTruthy();
    await user.click(section.getByRole('button', { name: 'Usar el texto general' }));
    expect(getCatalogMessage(seen.def, 'plan', 'plan-premium', 'added')).toBeUndefined();
    expect(seen.def.catalogMessages).toBeUndefined();
  });

  it('inserta datos en el cursor y avisa si un dato no se puede usar', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Disney\+/ }));
    const section = within(screen.getByRole('region', { name: 'Mensajes de la plataforma Disney+' }));
    await user.click(section.getAllByRole('button', { name: 'Plataforma' })[0]);
    expect(getCatalogMessage(seen.def, 'category', 'cat-disney', 'chosen')).toBe('{{plataforma}}');
    fireEvent.change(section.getByLabelText('Al elegir la plataforma'), { target: { value: 'Hola {{pedido}}' } });
    expect(section.getByRole('alert').textContent).toContain('{{pedido}}');
  });

  it('muestra carga, error con reintento y vacío', async () => {
    state.isPending = true; state.data = undefined;
    const { rerender } = render(<ServiceMessagesEditor def={defaultDefinition()} update={vi.fn()} />);
    expect(screen.getByText('Cargando tus servicios')).toBeTruthy();
    state.isPending = false; state.isError = true;
    rerender(<ServiceMessagesEditor def={defaultDefinition()} update={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(state.refetch).toHaveBeenCalled();
    state.isError = false; state.data = [];
    rerender(<ServiceMessagesEditor def={defaultDefinition()} update={vi.fn()} />);
    expect(screen.getByText(/Todavía no hay plataformas activas/)).toBeTruthy();
  });
});
