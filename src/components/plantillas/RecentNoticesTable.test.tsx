import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecentNoticesApi } from '@/hooks/use-template-notices';
import type { RecentNotice } from '@/types/automation';
import { RecentNoticesTable } from './RecentNoticesTable';

const notice = (overrides: Partial<RecentNotice> = {}): RecentNotice => ({
  id: 'n1', tipo: 'dia_pago', status: 'accepted', origin: 'auto', createdAt: '2026-10-01T15:30:00Z', waId: '50760000001',
  clienteNombre: 'María Pérez', skipReason: null, ...overrides,
});

function makeNotices(overrides: Partial<RecentNoticesApi> = {}): RecentNoticesApi {
  return {
    loading: false, error: null, filters: {}, data: { notices: [notice()], total: 25, page: 1, pageSize: 10 },
    setFilters: vi.fn(), setPage: vi.fn(), retry: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  // Radix necesita estas APIs de puntero que jsdom no implementa.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});

describe('RecentNoticesTable', () => {
  it('lista el aviso con tipo, origen, cliente, estado, fecha y enlace al chat', () => {
    render(<RecentNoticesTable notices={makeNotices()} />);
    expect(screen.getByText('Historial de envíos')).toBeTruthy();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Aviso de vencimiento')).toBeTruthy();
    expect(within(table).getByText('Automático')).toBeTruthy();
    expect(within(table).getByText('María Pérez')).toBeTruthy();
    expect(within(table).getByText('50760000001')).toBeTruthy();
    expect(within(table).getByText('Enviado')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir chat de María Pérez' }).getAttribute('href')).toBe('/chats?wa=50760000001');
    expect(screen.getByText(/el texto enviado no se muestra/)).toBeTruthy();
  });

  it('muestra el motivo de un aviso omitido, el telefono sin nombre y el origen manual', () => {
    const data = { notices: [notice({ id: 'a', status: 'skipped', skipReason: 'en_reposo', clienteNombre: null, origin: 'manual' }), notice({ id: 'b', status: 'failed', tipo: 'despedida' })], total: 2, page: 1, pageSize: 10 };
    render(<RecentNoticesTable notices={makeNotices({ data })} />);
    expect(screen.getByText('Servicio en reposo')).toBeTruthy();
    expect(screen.getByText('Omitido')).toBeTruthy();
    expect(screen.getByText('Fallido')).toBeTruthy();
    expect(screen.getByText('Manual')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir chat de 50760000001' })).toBeTruthy();
  });

  it('filtra por mensaje y por estado', async () => {
    const notices = makeNotices();
    render(<RecentNoticesTable notices={notices} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filtrar por mensaje' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Despedida' }));
    expect(notices.setFilters).toHaveBeenCalledWith({ tipo: 'despedida' });
    await user.click(screen.getByRole('button', { name: 'Filtrar por estado' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Fallido' }));
    expect(notices.setFilters).toHaveBeenCalledWith({ status: 'failed' });
  });

  it('quita un filtro al elegir Todos', async () => {
    const notices = makeNotices({ filters: { tipo: 'despedida', status: 'failed' }, data: { notices: [], total: 0, page: 1, pageSize: 10 } });
    render(<RecentNoticesTable notices={notices} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Filtrar por mensaje' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Todos los mensajes' }));
    expect(notices.setFilters).toHaveBeenCalledWith({ tipo: undefined, status: 'failed' });
    await user.click(screen.getByRole('button', { name: 'Filtrar por estado' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Todos los estados' }));
    expect(notices.setFilters).toHaveBeenCalledWith({ tipo: 'despedida', status: undefined });
    expect(screen.getByText('No hay envíos con estos filtros')).toBeTruthy();
  });

  it('pagina de a diez y bloquea los extremos', async () => {
    const notices = makeNotices({ data: { notices: [notice()], total: 25, page: 2, pageSize: 10 } });
    render(<RecentNoticesTable notices={notices} />);
    expect(screen.getByText('Página 2 de 3')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(notices.setPage).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(notices.setPage).toHaveBeenCalledWith(1);
  });

  it('muestra vacio, carga y error con reintento', async () => {
    const empty = { data: { notices: [], total: 0, page: 1, pageSize: 10 } };
    const { rerender } = render(<RecentNoticesTable notices={makeNotices(empty)} />);
    expect(screen.getByText('Todavía no hay envíos de WhatsApp')).toBeTruthy();
    rerender(<RecentNoticesTable notices={makeNotices({ loading: true, data: null })} />);
    expect(screen.getByText('Cargando datos…')).toBeTruthy();
    const notices = makeNotices({ error: 'No se pudo cargar el historial de envíos. Inténtalo de nuevo.', data: null });
    rerender(<RecentNoticesTable notices={notices} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar el historial de envíos. Inténtalo de nuevo.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(notices.retry).toHaveBeenCalled();
  });
});
