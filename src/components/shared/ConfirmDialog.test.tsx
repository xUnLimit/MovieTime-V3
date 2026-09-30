import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';
import { ConfirmDeleteVentaDialog } from './ConfirmDeleteVentaDialog';
import { LogDeleteConfirmDialog } from '@/components/log-actividad/LogDeleteConfirmDialog';

function Harness(props: Partial<React.ComponentProps<typeof ConfirmDialog>>) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
      <ConfirmDialog open={open} onOpenChange={setOpen} onConfirm={vi.fn()} title="Eliminar pago" description="Sin vuelta atrás" {...props} />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('confirms and closes by default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} confirmText="Eliminar" />);

    expect(screen.getByText('Sin vuelta atrás')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('closed'));
  });

  it('stays open after confirming when the caller controls the closing', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} keepOpenOnConfirm description={<span>Se borrarán 3 registros</span>} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Se borrarán 3 registros')).toBeTruthy();
    expect(screen.getByTestId('state').textContent).toBe('open');
  });

  it('blocks confirming while disabled and ignores closing while loading', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const view = render(<Harness onConfirm={onConfirm} confirmDisabled />);

    expect((screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement).disabled).toBe(true);

    view.rerender(<Harness onConfirm={onConfirm} loading loadingText="Eliminando..." />);
    expect(screen.getByRole('button', { name: 'Eliminando...' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('state').textContent).toBe('open');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes with Cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('closed'));
  });
});

describe('ConfirmDeleteVentaDialog', () => {
  it('asks to delete payments only when the box is checked and resets it afterwards', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<ConfirmDeleteVentaDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} ventaNombre='la venta de "Mary"' />);

    expect(screen.getByText(/eliminar la venta de "Mary"/)).toBeTruthy();
    await user.click(screen.getByRole('checkbox', { name: /historial de pagos/ }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onConfirm).toHaveBeenCalledWith(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the payment history by default', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDeleteVentaDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('clears the checkbox when cancelled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const view = render(<ConfirmDeleteVentaDialog open onOpenChange={onOpenChange} onConfirm={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: /historial de pagos/ }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    view.rerender(<ConfirmDeleteVentaDialog open onOpenChange={onOpenChange} onConfirm={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /historial de pagos/ }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('LogDeleteConfirmDialog', () => {
  const base = { confirmCount: 12, confirmDays: 30, confirmDeleteAll: false, isDeleting: false, isLoadingCount: false, onClose: vi.fn(), onConfirm: vi.fn(), open: true };

  it('shows the scope, confirms without closing and closes with Cancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<LogDeleteConfirmDialog {...base} onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByText(/30 días/)).toBeTruthy();
    expect(screen.getByText('12 registros')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sí, limpiar logs' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('words the delete-all case and counts a single record in singular', () => {
    render(<LogDeleteConfirmDialog {...base} confirmDeleteAll confirmCount={1} />);

    expect(screen.getByText('¿Estás seguro de eliminar todos los logs?')).toBeTruthy();
    expect(screen.getByText('1 registro')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sí, eliminar todos' })).toBeTruthy();
  });

  it('blocks the action while counting, when nothing matches and while deleting', () => {
    const view = render(<LogDeleteConfirmDialog {...base} confirmCount={null} isLoadingCount />);
    expect(screen.getByText('Calculando registros...')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Sí, limpiar logs' }) as HTMLButtonElement).disabled).toBe(true);

    view.rerender(<LogDeleteConfirmDialog {...base} confirmCount={0} />);
    expect((screen.getByRole('button', { name: 'Sí, limpiar logs' }) as HTMLButtonElement).disabled).toBe(true);

    view.rerender(<LogDeleteConfirmDialog {...base} isDeleting />);
    expect(screen.getByRole('button', { name: 'Eliminando...' })).toBeTruthy();
  });
});
