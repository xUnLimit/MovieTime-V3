import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  templates: vi.fn(),
  metaTemplates: vi.fn(),
  mutateAsync: vi.fn(),
  config: vi.fn(),
  offer: vi.fn(),
  enqueue: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@/hooks/use-templates', () => ({
  useTemplates: mocks.templates,
  useMetaTemplates: mocks.metaTemplates,
}));
vi.mock('@/hooks/use-config', () => ({ useConfig: mocks.config }));
vi.mock('@/hooks/use-whatsapp-notices', () => ({
  useSendNotices: () => ({ mutateAsync: mocks.mutateAsync, isPending: false }),
}));
vi.mock('@/components/shared/offer-api-access-notice', () => ({ offerApiAccessNotice: mocks.offer }));
vi.mock('@/store/whatsappToastStore', () => ({
  useWhatsAppToastStore: (selector: (state: { enqueueMany: typeof mocks.enqueue }) => unknown) => selector({ enqueueMany: mocks.enqueue }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, warning: mocks.toastWarning, error: mocks.toastError } }));

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
  clienteTelefono: '6000-0000',
  servicioNombre: 'Netflix',
  categoriaNombre: 'Streaming',
  estado: 'activo',
  fechaFin: new Date(2026, 7, 19),
} satisfies NotificacionVentaConId;

const template = (tipo: string, metaTemplateName: string | null = null) => ({
  id: tipo, tipo, activo: true, contenido: 'Hola {cliente}, tu {servicio} vence', metaTemplateName,
});
const approved = (name: string) => ({ name, status: 'APPROVED', retired: false });
const delivered = { noticeId: 'n1', clienteNombre: 'Ana Pérez', ventaIds: ['venta-1'], status: 'accepted', channel: 'template', waId: '507' };

function renderDialog(overrides: Partial<Parameters<typeof NotifyVentaDialog>[0]> = {}) {
  const props = { notification, open: true, onOpenChange: vi.fn(), ...overrides };
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(<QueryClientProvider client={client}><NotifyVentaDialog {...props} /></QueryClientProvider>);
  return { ...props, invalidate };
}

function setAuto(enabled: boolean | undefined) {
  mocks.config.mockReturnValue({ data: enabled === undefined ? undefined : { whatsapp: { autoEnabled: enabled } } });
}

describe('NotifyVentaDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.templates.mockReturnValue({ data: [template('dia_pago', 'aviso_pago'), template('cancelacion', 'servicio_suspendido')] });
    mocks.metaTemplates.mockReturnValue({ data: [approved('aviso_pago'), approved('servicio_suspendido')] });
    mocks.mutateAsync.mockResolvedValue([delivered]);
    setAuto(false);
  });

  it('shows both message options, the preview and only Volver and Enviar', () => {
    renderDialog();
    expect(screen.getByText('Aviso de pago')).toBeTruthy();
    expect(screen.getByText('Cancelación')).toBeTruthy();
    expect(screen.getByText(/Hola Ana Pérez, tu Netflix vence/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Abrir en WhatsApp' })).toBeNull();
  });

  it('shows no preview when the notice type has no active template', () => {
    mocks.templates.mockReturnValue({ data: [] });
    renderDialog();
    expect(screen.queryByText(/Hola Ana Pérez/)).toBeNull();
  });

  it('closes with Volver without sending anything', async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
    expect(mocks.offer).not.toHaveBeenCalled();
  });

  it.each([
    ['off', false, 'Al enviar, elige entre la API o WhatsApp', true],
    ['loading', undefined, 'Al enviar, elige entre la API o WhatsApp', true],
    ['on with an approved template', true, 'Se enviará por WhatsApp API (plantilla con botones)', true],
    ['on without an approved template', true, 'no tiene una plantilla aprobada para la API', false],
  ])('explains the channel when the automatic switch is %s', (_name, enabled, text, withMeta) => {
    setAuto(enabled);
    if (!withMeta) mocks.metaTemplates.mockReturnValue({ data: [] });
    renderDialog();
    expect(screen.getByTestId('notice-channel').textContent).toContain(text);
  });

  describe('with the automatic switch on', () => {
    beforeEach(() => setAuto(true));

    it('sends the notice by the API with the rule tipo, confirms and closes', async () => {
      const user = userEvent.setup();
      const props = renderDialog();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(props.onOpenChange).toHaveBeenCalledWith(false));
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ tipo: 'dia_pago', ventaIds: ['venta-1'] });
      expect(mocks.toastSuccess).toHaveBeenCalledWith('Aviso enviado por WhatsApp API', expect.objectContaining({ description: 'Se notificó a Ana Pérez.' }));
      expect(mocks.offer).not.toHaveBeenCalled();
    });

    it('sends the cancellation notice when Cancelación is chosen', async () => {
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByLabelText('Cancelación'));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith({ tipo: 'cancelacion', ventaIds: ['venta-1'] }));
    });

    it('warns and offers WhatsApp when the API could not deliver', async () => {
      mocks.mutateAsync.mockResolvedValue([{ ...delivered, status: 'wa_me', channel: 'wa_me' }]);
      const user = userEvent.setup();
      const props = renderDialog();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled());
      const [title, options] = mocks.toastWarning.mock.calls.at(-1)!;
      expect(title).toBe('El aviso no se pudo enviar por la API');
      options.action.onClick();
      expect(mocks.enqueue).toHaveBeenCalledWith([expect.objectContaining({ phone: '6000-0000', message: expect.stringContaining('Hola Ana Pérez') })]);
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('warns with the same fallback when the API call throws', async () => {
      mocks.mutateAsync.mockRejectedValue(new Error('boom'));
      const user = userEvent.setup();
      const props = renderDialog();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled());
      expect(mocks.toastWarning.mock.calls.at(-1)![1].action.label).toBe('Abrir en WhatsApp');
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('points to the chat when there is no message to open in WhatsApp', async () => {
      mocks.templates.mockReturnValue({ data: [] });
      mocks.mutateAsync.mockResolvedValue([{ ...delivered, status: 'skipped' }]);
      const user = userEvent.setup();
      renderDialog();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalled());
      const options = mocks.toastWarning.mock.calls.at(-1)![1];
      expect(options.description).toBe('Escríbele desde el chat.');
      expect(options.action).toBeUndefined();
    });
  });

  describe('with the automatic switch off', () => {
    it('closes and offers the API and WhatsApp in a toast instead of sending', async () => {
      const user = userEvent.setup();
      const props = renderDialog();
      await user.click(screen.getByLabelText('Cancelación'));
      await user.click(screen.getByRole('button', { name: 'Enviar' }));

      expect(mocks.mutateAsync).not.toHaveBeenCalled();
      expect(props.onOpenChange).toHaveBeenCalledWith(false);
      expect(mocks.offer).toHaveBeenCalledWith(expect.objectContaining({
        tipo: 'cancelacion',
        title: 'Aviso de corte listo',
        description: '¿Cómo quieres avisar a Ana Pérez?',
        enqueueWhatsAppMessages: mocks.enqueue,
        items: [{ ventaId: 'venta-1', message: expect.objectContaining({ phone: '6000-0000', message: expect.stringContaining('Hola Ana Pérez'), title: 'Aviso de corte' }) }],
      }));
    });

    it('refreshes the notice status once the API attempt finishes', async () => {
      const user = userEvent.setup();
      const props = renderDialog();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(mocks.offer).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'dia_pago', title: 'Aviso de pago listo' }));
      mocks.offer.mock.calls[0]![0].onApiSettled();
      expect(props.invalidate).toHaveBeenCalledWith({ queryKey: expect.arrayContaining(['whatsapp']) });
    });

    it('stays open and explains when there is no message configured', async () => {
      mocks.templates.mockReturnValue({ data: [] });
      const user = userEvent.setup();
      const props = renderDialog();
      await user.click(screen.getByRole('button', { name: 'Enviar' }));
      expect(mocks.toastError).toHaveBeenCalledWith('No hay un mensaje configurado para este aviso.', expect.any(Object));
      expect(mocks.offer).not.toHaveBeenCalled();
      expect(props.onOpenChange).not.toHaveBeenCalled();
    });
  });
});
