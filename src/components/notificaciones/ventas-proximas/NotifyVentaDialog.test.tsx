import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  templates: vi.fn(),
  metaTemplates: vi.fn(),
  mutateAsync: vi.fn(),
}));
vi.mock('@/hooks/use-templates', () => ({
  useTemplates: mocks.templates,
  useMetaTemplates: mocks.metaTemplates,
}));
vi.mock('@/hooks/use-whatsapp-notices', () => ({
  useSendNotices: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));

const wa = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('@/platform/utils/whatsapp', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/platform/utils/whatsapp')>()), openWhatsApp: wa.open }));

import { NotifyVentaDialog } from './NotifyVentaDialog';
import type { NotificacionVentaConId } from './types';

const notification = {
  id: 'notif-1',
  entidad: 'venta',
  tipo: 'sistema',
  prioridad: 'alta',
  titulo: 'Venta vencida',
  leida: false,
  resaltada: false,
  diasRestantes: -4,
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
  ventaId: 'venta-1',
  clienteId: 'cliente-1',
  servicioId: 'servicio-1',
  clienteNombre: 'Ana Pérez',
  servicioNombre: 'Netflix',
  categoriaNombre: 'Streaming',
  estado: 'activo',
  fechaFin: new Date(2026, 7, 19),
} satisfies NotificacionVentaConId;

const template = (tipo: string, metaTemplateName: string | null = null) => ({
  id: tipo, tipo, activo: true, contenido: 'Hola {cliente}, tu {servicio} vence', metaTemplateName,
});
const approved = (name: string) => ({ name, status: 'APPROVED', retired: false });

function renderDialog(overrides: Partial<Parameters<typeof NotifyVentaDialog>[0]> = {}) {
  const props = {
    notification,
    open: true,
    onOpenChange: vi.fn(),
    onNotify: vi.fn().mockReturnValue(true),
    onCancelMessage: vi.fn().mockReturnValue(true),
    ...overrides,
  };
  render(<NotifyVentaDialog {...props} />);
  return props;
}

describe('NotifyVentaDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.templates.mockReturnValue({ data: [template('dia_pago'), template('cancelacion')] });
    mocks.metaTemplates.mockReturnValue({ data: [] });
  });

  it('keeps both options and shows the free-text preview', () => {
    renderDialog();
    expect(screen.getByText('Aviso de pago')).toBeTruthy();
    expect(screen.getByText('Cancelación')).toBeTruthy();
    expect(screen.getByText(/Hola Ana Pérez, tu Netflix vence/)).toBeTruthy();
  });

  it('announces WhatsApp when there is no approved linked template', () => {
    renderDialog();
    expect(screen.getByTestId('notice-channel').textContent).toBe('Se abrirá WhatsApp');
  });

  it('announces the API channel when the linked Meta template is approved', () => {
    mocks.templates.mockReturnValue({ data: [template('dia_pago', 'aviso_vence_hoy')] });
    mocks.metaTemplates.mockReturnValue({ data: [approved('aviso_vence_hoy')] });
    renderDialog();
    expect(screen.getByTestId('notice-channel').textContent).toBe('Se enviará por WhatsApp API (plantilla con botones)');
  });

  it('does not announce the API when the linked template is not approved', () => {
    mocks.templates.mockReturnValue({ data: [template('dia_pago', 'aviso_vence_hoy')] });
    mocks.metaTemplates.mockReturnValue({ data: [{ name: 'aviso_vence_hoy', status: 'PENDING', retired: false }] });
    renderDialog();
    expect(screen.getByTestId('notice-channel').textContent).toBe('Se abrirá WhatsApp');
  });

  it('sends the payment notice with the rule tipo through the API', async () => {
    mocks.mutateAsync.mockResolvedValue([
      { noticeId: 'n1', clienteNombre: 'Ana Pérez', ventaIds: ['venta-1'], status: 'accepted', channel: 'template', waId: '507' },
    ]);
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ tipo: 'dia_pago', ventaIds: ['venta-1'] });
    expect(await screen.findByText('Enviado por WhatsApp API')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: 'Abrir en WhatsApp' })).toHaveLength(1);
  });

  it('opens wa.me with the server text of the result instead of only the first venta', async () => {
    mocks.mutateAsync.mockResolvedValue([
      { noticeId: null, clienteNombre: 'Ana Pérez', ventaIds: ['venta-1', 'venta-2'], status: 'failed', channel: null, waId: null, waMeText: 'Texto agrupado' },
    ]);
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    const buttons = await screen.findAllByRole('button', { name: 'Abrir en WhatsApp' });
    await user.click(buttons[0]!);
    expect(wa.open).toHaveBeenCalledWith('', 'Texto agrupado');
    expect(props.onNotify).not.toHaveBeenCalled();
  });

  it('uses notificacion_regular before the due date and cancelacion for cancellation', async () => {
    mocks.mutateAsync.mockResolvedValue([]);
    const user = userEvent.setup();
    renderDialog({ notification: { ...notification, diasRestantes: 3 } });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith({ tipo: 'notificacion_regular', ventaIds: ['venta-1'] });
    await user.click(screen.getByLabelText('Cancelación'));
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith({ tipo: 'cancelacion', ventaIds: ['venta-1'] });
  });

  it.each(['wa_me', 'failed', 'skipped'] as const)('offers the wa.me fallback for %s results', async (status) => {
    mocks.mutateAsync.mockResolvedValue([
      { noticeId: null, clienteNombre: 'Ana Pérez', ventaIds: ['venta-1'], status, channel: null, waId: null, error: 'telefono_invalido' },
    ]);
    const onNotify = vi.fn().mockReturnValue(true);
    const user = userEvent.setup();
    renderDialog({ onNotify });
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await screen.findByRole('list', { name: 'Resultado del envío' });
    const buttons = screen.getAllByRole('button', { name: 'Abrir en WhatsApp' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]!);
    expect(onNotify).toHaveBeenCalledWith(notification);
  });

  it('always keeps the secondary Abrir en WhatsApp button and closes on success', async () => {
    const onCancelMessage = vi.fn().mockReturnValue(true);
    const onNotify = vi.fn().mockReturnValue(true);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onCancelMessage, onNotify, onOpenChange });

    await user.click(screen.getByLabelText('Cancelación'));
    await user.click(screen.getByRole('button', { name: 'Abrir en WhatsApp' }));

    expect(onCancelMessage).toHaveBeenCalledWith(notification);
    expect(onNotify).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('stays open when the selected message cannot be generated', async () => {
    const onNotify = vi.fn().mockReturnValue(false);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ onNotify, onOpenChange });

    await user.click(screen.getByRole('button', { name: 'Abrir en WhatsApp' }));

    expect(onNotify).toHaveBeenCalledWith(notification);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('keeps the dialog usable when the API call throws', async () => {
    mocks.mutateAsync.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalled());
    expect(screen.queryByRole('list', { name: 'Resultado del envío' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir en WhatsApp' })).toBeTruthy();
  });
});
