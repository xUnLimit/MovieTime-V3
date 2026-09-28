import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock('@/hooks/use-whatsapp-notices', () => ({
  useSendNotices: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
const wa = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/platform/utils/whatsapp', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/platform/utils/whatsapp')>()), openWhatsApp: wa.open }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { BulkNoticeSummaryDialog } from './BulkNoticeSummaryDialog';
import { useBulkNotice } from './useBulkNotice';
import type { NotificacionVentaConId } from './types';

const notif = (id: string, ventaId: string, diasRestantes: number) => ({
  id, ventaId, clienteNombre: `Cliente ${id}`, diasRestantes,
} as NotificacionVentaConId);
const all = [notif('1', 'a', 0), notif('2', 'b', 4), notif('3', 'c', -2)];

function setup(onOpenWhatsApp = vi.fn().mockReturnValue(true)) {
  return { onOpenWhatsApp, ...renderHook(() => useBulkNotice({ notificaciones: all, pageNotificaciones: all.slice(0, 2), onOpenWhatsApp })) };
}

describe('useBulkNotice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selects single rows and the visible page', () => {
    const { result } = setup();
    act(() => result.current.toggleSelected('3', true));
    act(() => result.current.toggleAllOnPage(true));
    expect(result.current.selectedCount).toBe(3);
    act(() => result.current.toggleAllOnPage(false));
    expect([...result.current.selectedIds]).toEqual(['3']);
  });

  it('calls the API once per rule tipo and collects every result', async () => {
    mocks.mutateAsync.mockImplementation(async ({ ventaIds }: { ventaIds: string[] }) => ventaIds.map((id) => ({
      noticeId: id, clienteNombre: id, ventaIds: [id], status: 'accepted', channel: 'template', waId: '507',
    })));
    const { result } = setup();
    act(() => result.current.toggleAllOnPage(true));
    act(() => result.current.toggleSelected('3', true));
    await act(async () => { await result.current.notifySelected(); });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ tipo: 'dia_pago', ventaIds: ['a', 'c'] });
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ tipo: 'notificacion_regular', ventaIds: ['b'] });
    expect(result.current.results).toHaveLength(3);
    expect(result.current.selectedCount).toBe(0);
  });

  it('turns a failed request into failed results with wa.me fallback', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('down'));
    const { result, onOpenWhatsApp } = setup();
    act(() => result.current.toggleSelected('2', true));
    await act(async () => { await result.current.notifySelected(); });
    expect(result.current.results).toEqual([expect.objectContaining({ status: 'failed', ventaIds: ['b'] })]);
    await act(async () => { await result.current.openResultWhatsApp(result.current.results![0]!); });
    expect(onOpenWhatsApp).toHaveBeenCalledWith(all[1]);
  });

  it('opens wa.me once with the grouped text of every venta of a grouped result', async () => {
    const grouped = [
      { ...notif('1', 'a', 0), clienteTelefono: '60001111', categoriaNombre: 'Netflix', servicioNombre: 'Netflix', fechaFin: new Date(2026, 9, 1) },
      { ...notif('2', 'b', 0), clienteTelefono: '60001111', categoriaNombre: 'Disney+', servicioNombre: 'Disney+', fechaFin: new Date(2026, 9, 1) },
    ] as NotificacionVentaConId[];
    const onOpenWhatsApp = vi.fn();
    const { result } = renderHook(() => useBulkNotice({
      notificaciones: grouped, pageNotificaciones: grouped, onOpenWhatsApp,
      getContenido: () => ['{{#items}}- {servicio}', '{{/items}}'].join('\n'),
    }));
    await act(async () => {
      await result.current.openResultWhatsApp({ noticeId: null, clienteNombre: 'X', ventaIds: ['a', 'b'], status: 'failed', channel: null, waId: null });
    });
    expect(onOpenWhatsApp).not.toHaveBeenCalled();
    expect(wa.open).toHaveBeenCalledTimes(1);
    expect(wa.open.mock.calls[0]![1]).toContain('Netflix');
    expect(wa.open.mock.calls[0]![1]).toContain('Disney+');
  });

  it('does nothing without a selection', async () => {
    const { result } = setup();
    await act(async () => { await result.current.notifySelected(); });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(result.current.results).toBeNull();
  });
});

describe('BulkNoticeSummaryDialog', () => {
  const base = { noticeId: null, channel: null, waId: null } as const;
  it('shows the summary counts and wa.me fallback only for failed or skipped', async () => {
    const onOpenWhatsApp = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkNoticeSummaryDialog
        onClose={vi.fn()}
        onOpenWhatsApp={onOpenWhatsApp}
        results={[
          { ...base, clienteNombre: 'Ok', ventaIds: ['1'], status: 'accepted' },
          { ...base, clienteNombre: 'Repetido', ventaIds: ['2'], status: 'already_sent' },
          { ...base, clienteNombre: 'Omitido', ventaIds: ['3'], status: 'skipped', error: 'telefono_ambiguo' },
          { ...base, clienteNombre: 'Fallido', ventaIds: ['4'], status: 'failed', error: 'rechazado' },
        ]}
      />,
    );
    expect(screen.getByText('Enviados').previousSibling?.textContent).toBe('1');
    expect(screen.getByText('Ya enviados').previousSibling?.textContent).toBe('1');
    expect(screen.getByText('Omitidos').previousSibling?.textContent).toBe('1');
    expect(screen.getByText('Fallidos').previousSibling?.textContent).toBe('1');
    expect(screen.getByText(/El teléfono pertenece a más de un cliente/)).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Abrir en WhatsApp' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);
    expect(onOpenWhatsApp).toHaveBeenCalledWith(expect.objectContaining({ clienteNombre: 'Fallido' }));
  });
});
