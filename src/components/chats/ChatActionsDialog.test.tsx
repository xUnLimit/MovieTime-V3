import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';

const state = vi.hoisted(() => ({
  terceroFormProps: null as null | Record<string, unknown>,
  ventasFormProps: null as null | Record<string, unknown>,
  metodosPagoLoading: false,
}));
const sendWhatsAppMessageUseCase = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-metodos-pago-terceros', () => ({
  useMetodosPagoTerceros: () => ({ data: [{ id: 'm1', nombre: 'Yappy' }], isLoading: state.metodosPagoLoading }),
}));
vi.mock('@/application/use-cases/whatsapp-chat-use-cases', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/application/use-cases/whatsapp-chat-use-cases')>()),
  sendWhatsAppMessageUseCase,
}));
vi.mock('@/components/terceros/TerceroForm', () => ({
  TerceroForm: (props: Record<string, unknown> & { onSuccess: () => void; onCancel: () => void }) => {
    state.terceroFormProps = props;
    return (
      <div>
        <button type="button" onClick={props.onSuccess}>Crear Tercero</button>
        <button type="button" onClick={props.onCancel}>Cancelar tercero</button>
      </div>
    );
  },
}));
vi.mock('@/components/ventas/VentasForm', () => ({
  VentasForm: (props: Record<string, unknown> & { onSaved?: () => void; onCancel?: () => void }) => {
    state.ventasFormProps = props;
    return (
      <div>
        <button type="button" onClick={props.onSaved}>Guardar venta</button>
        <button type="button" onClick={props.onCancel}>Cancelar venta</button>
      </div>
    );
  },
}));

import { ChatActionsDialog } from './ChatActionsDialog';

const conversation: WhatsAppConversation = {
  waId: '50760000000', contactName: 'Mary', terceroId: null, terceroNombre: null,
  lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: '2026-09-27T12:00:00Z',
  lastInboundAt: '2026-09-27T12:00:00Z', unreadCount: 0, nextExpiry: null, activeCategories: [], pinnedAt: null, archived: false,
};

beforeEach(() => {
  state.terceroFormProps = null;
  state.ventasFormProps = null;
  state.metodosPagoLoading = false;
  sendWhatsAppMessageUseCase.mockReset();
});

describe('ChatActionsDialog', () => {
  it('disables generating a sale until the client is registered', async () => {
    const user = userEvent.setup();
    render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={conversation} />);

    const ventaButton = screen.getByRole<HTMLButtonElement>('button', { name: /Generar venta/ });
    expect(ventaButton.disabled).toBe(true);
    expect(screen.getByText('Primero registra al cliente para poder generar una venta.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Registrar cliente/ }));
    expect(screen.getByRole('heading', { name: 'Registrar cliente' })).toBeTruthy();
  });

  it('pre-fills the client form with the chat phone number and name', async () => {
    const user = userEvent.setup();
    render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={conversation} />);
    await user.click(screen.getByRole('button', { name: /Registrar cliente/ }));

    expect(state.terceroFormProps?.valoresIniciales).toEqual({ telefono: '+507 6000-0000', nombre: 'Mary' });
  });

  it('closes the dialog when the client is created successfully', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ChatActionsDialog open onOpenChange={onOpenChange} conversation={conversation} />);
    await user.click(screen.getByRole('button', { name: /Registrar cliente/ }));
    await user.click(screen.getByRole('button', { name: 'Crear Tercero' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables registering a client whose number is already registered', () => {
    const registered = { ...conversation, terceroId: 't1', terceroNombre: 'Mary López' };
    render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={registered} />);

    const clienteButton = screen.getByRole<HTMLButtonElement>('button', { name: /Registrar cliente/ });
    expect(clienteButton.disabled).toBe(true);
    expect(screen.getByText('Este número ya está registrado como cliente.')).toBeTruthy();
  });

  it('enables generating a sale and preselects the client once the number is registered', async () => {
    const user = userEvent.setup();
    const registered = { ...conversation, terceroId: 't1', terceroNombre: 'Mary López' };
    const onOpenChange = vi.fn();
    render(<ChatActionsDialog open onOpenChange={onOpenChange} conversation={registered} />);

    const ventaButton = screen.getByRole<HTMLButtonElement>('button', { name: /Generar venta/ });
    expect(ventaButton.disabled).toBe(false);
    await user.click(ventaButton);

    expect(screen.getByRole('heading', { name: 'Generar venta' })).toBeTruthy();
    expect(state.ventasFormProps?.clienteIdInicial).toBe('t1');

    await user.click(screen.getByRole('button', { name: 'Guardar venta' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('returns to the menu instead of closing when a sub-form is cancelled', async () => {
    const user = userEvent.setup();
    const registered = { ...conversation, terceroId: 't1' };
    const onOpenChange = vi.fn();
    render(<ChatActionsDialog open onOpenChange={onOpenChange} conversation={registered} />);

    await user.click(screen.getByRole('button', { name: /Generar venta/ }));
    await user.click(screen.getByRole('button', { name: 'Cancelar venta' }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Acciones' })).toBeTruthy();
  });

  it('sends the sale notification directly through the Cloud API when the 24h window is open', async () => {
    sendWhatsAppMessageUseCase.mockResolvedValue({ sendStatus: 'accepted' });
    const registered = { ...conversation, terceroId: 't1', lastInboundAt: new Date().toISOString() };
    render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={registered} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Generar venta/ }));

    const sendDirectMessage = state.ventasFormProps?.sendDirectMessage as (message: string) => Promise<unknown>;
    await expect(sendDirectMessage('Hola, tu venta quedó activa')).resolves.toEqual({ ok: true });
    expect(sendWhatsAppMessageUseCase).toHaveBeenCalledWith({ to: registered.waId, message: { kind: 'text', text: 'Hola, tu venta quedó activa' } });
  });

  it('refuses the direct send when the 24h window is closed, so the form falls back to WhatsApp Web', async () => {
    const registered = { ...conversation, terceroId: 't1', lastInboundAt: null };
    render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={registered} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Generar venta/ }));

    const sendDirectMessage = state.ventasFormProps?.sendDirectMessage as (message: string) => Promise<{ ok: boolean; reason?: string }>;
    const result = await sendDirectMessage('Hola');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('24 h');
    expect(sendWhatsAppMessageUseCase).not.toHaveBeenCalled();
  });

  it('reports a Meta rejection as a failed direct send', async () => {
    sendWhatsAppMessageUseCase.mockResolvedValue({ sendStatus: 'failed', errorTitle: 'Número inválido' });
    const registered = { ...conversation, terceroId: 't1', lastInboundAt: new Date().toISOString() };
    render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={registered} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Generar venta/ }));

    const sendDirectMessage = state.ventasFormProps?.sendDirectMessage as (message: string) => Promise<{ ok: boolean; reason?: string }>;
    const result = await sendDirectMessage('Hola');
    expect(result).toEqual({ ok: false, reason: 'WhatsApp rechazó el mensaje: Número inválido' });
  });

  it('themes the embedded form to match the chat while a sub-form is open, and removes it afterwards', async () => {
    const user = userEvent.setup();
    expect(document.body.classList.contains('chat-embedded-form')).toBe(false);

    const { unmount } = render(<ChatActionsDialog open onOpenChange={vi.fn()} conversation={conversation} />);
    // El menu no muestra un formulario ajeno: no hace falta remapear el tema todavia.
    expect(document.body.classList.contains('chat-embedded-form')).toBe(false);

    await user.click(screen.getByRole('button', { name: /Registrar cliente/ }));
    expect(document.body.classList.contains('chat-embedded-form')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Cancelar tercero' }));
    expect(document.body.classList.contains('chat-embedded-form')).toBe(false);

    unmount();
    expect(document.body.classList.contains('chat-embedded-form')).toBe(false);
  });
});
