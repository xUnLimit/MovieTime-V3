import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import type { VentaTerceroDoc } from '@/hooks/use-ventas-tercero';
import { ChatHeader } from './ChatHeader';
import { CustomerPanel, sortVentasForChat } from './CustomerPanel';
import type { TemplateOption } from './chat-templates';
import { TemplateSendDialog } from './TemplateSendDialog';

vi.mock('./ConversationControl', () => ({ ConversationControl: () => <span>Control de atención</span> }));

const NOW = new Date(2026, 8, 27, 15, 30);

const conversation: WhatsAppConversation = {
  waId: '50760000000', contactName: 'Mary', terceroId: 't1', terceroNombre: 'María Pérez',
  lastDirection: 'inbound', lastPreview: 'Hola', lastMessageAt: NOW.toISOString(),
  lastInboundAt: new Date(2026, 8, 27, 14, 0).toISOString(), unreadCount: 0, nextExpiry: '2026-09-27',
  activeCategories: [], pinnedAt: null, archived: false,
};

function venta(id: string, fechaFin: Date | null, overrides: Partial<VentaTerceroDoc> = {}): VentaTerceroDoc {
  return {
    id, clienteId: 't1', categoriaId: 'c', categoriaNombre: `Servicio ${id}`, servicioId: 's', servicioNombre: 'Cuenta 01',
    servicioCorreo: 'x', perfilNumero: 2, cicloPago: 'mensual', fechaInicio: null, fechaFin, precio: 4.5, precioFinal: 4.5,
    estado: 'activo', moneda: 'USD', ...overrides,
  };
}

describe('ChatHeader', () => {
  it('shows the contact, the service window and the chat actions', async () => {
    const user = userEvent.setup();
    const handlers = { onBack: vi.fn(), onTogglePanel: vi.fn(), onMarkUnread: vi.fn(), onTogglePin: vi.fn(), onToggleArchive: vi.fn() };
    render(<ChatHeader conversation={conversation} serviceWindow={{ open: true, hoursLeft: 23 }} panelOpen {...handlers} />);

    expect(screen.getByText('Ventana abierta · 23 h')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Ver ficha de María Pérez' }));
    expect(handlers.onTogglePanel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Volver a la lista' }));
    expect(handlers.onBack).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Ocultar ficha del cliente' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Abrir cliente/ }).getAttribute('href')).toBe('/terceros/t1');
    await user.click(screen.getByRole('menuitem', { name: /Marcar como no leído/ }));
    expect(handlers.onMarkUnread).toHaveBeenCalled();
  });

  it('pins and archives from the menu and flips the labels when already set', async () => {
    const user = userEvent.setup();
    const handlers = { onBack: vi.fn(), onTogglePanel: vi.fn(), onMarkUnread: vi.fn(), onTogglePin: vi.fn(), onToggleArchive: vi.fn() };
    const view = render(<ChatHeader conversation={conversation} serviceWindow={{ open: true, hoursLeft: 23 }} panelOpen {...handlers} />);

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Fijar conversación' }));
    expect(handlers.onTogglePin).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Archivar conversación' }));
    expect(handlers.onToggleArchive).toHaveBeenCalledTimes(1);

    view.rerender(<ChatHeader conversation={{ ...conversation, pinnedAt: '2026-09-30T10:00:00Z', archived: true }} serviceWindow={{ open: true, hoursLeft: 23 }} panelOpen {...handlers} />);
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Desfijar conversación' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Desarchivar conversación' })).toBeTruthy();
  });

  it('toggles the customer panel from the overflow menu, with its own label per state', async () => {
    const user = userEvent.setup();
    const handlers = { onBack: vi.fn(), onTogglePanel: vi.fn(), onMarkUnread: vi.fn(), onTogglePin: vi.fn(), onToggleArchive: vi.fn() };
    const { rerender } = render(<ChatHeader conversation={conversation} serviceWindow={{ open: true, hoursLeft: 23 }} panelOpen={false} {...handlers} />);

    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mostrar ficha del cliente' }));
    expect(handlers.onTogglePanel).toHaveBeenCalledTimes(1);

    rerender(<ChatHeader conversation={conversation} serviceWindow={{ open: true, hoursLeft: 23 }} panelOpen {...handlers} />);
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.getByRole('menuitem', { name: 'Ocultar ficha del cliente' })).toBeTruthy();
  });

  it('shows the active services of the client next to the number, capped to three', () => {
    const handlers = { onBack: vi.fn(), onTogglePanel: vi.fn(), onMarkUnread: vi.fn(), onTogglePin: vi.fn(), onToggleArchive: vi.fn() };
    render(<ChatHeader conversation={{ ...conversation, activeCategories: ['Canva', 'Crunchyroll', 'Disney+', 'Netflix'] }} serviceWindow={{ open: true, hoursLeft: 20 }} panelOpen={false} {...handlers} />);

    expect(screen.getByRole('group', { name: 'Servicios activos: Canva, Crunchyroll, Disney+, Netflix' })).toBeTruthy();
    expect(screen.getByText('Disney+')).toBeTruthy();
    expect(screen.getByText('+1').getAttribute('title')).toBe('Netflix');
  });

  it('shows a closed window and hides client links for unregistered numbers', async () => {
    const user = userEvent.setup();
    render(
      <ChatHeader
        conversation={{ ...conversation, terceroId: null, terceroNombre: null, lastInboundAt: null }}
        serviceWindow={{ open: false }}
        panelOpen={false}
        onBack={vi.fn()}
        onTogglePanel={vi.fn()}
        onMarkUnread={vi.fn()} onTogglePin={vi.fn()} onToggleArchive={vi.fn()}
      />
    );

    expect(screen.getByText('Ventana cerrada')).toBeTruthy();
    expect(screen.getByText(/No registrado/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Más opciones' }));
    expect(screen.queryByRole('menuitem', { name: /Abrir cliente/ })).toBeNull();
  });

  it('keeps conversation search visible and reports its open state', async () => {
    const user = userEvent.setup();
    const onToggleSearch = vi.fn();
    const view = render(<ChatHeader conversation={conversation} serviceWindow={{ open: true, hoursLeft: 20 }} panelOpen={false} searchOpen={false} onBack={vi.fn()} onTogglePanel={vi.fn()} onMarkUnread={vi.fn()} onTogglePin={vi.fn()} onToggleArchive={vi.fn()} onToggleSearch={onToggleSearch} />);

    await user.click(screen.getByRole('button', { name: 'Buscar en la conversación' }));
    expect(onToggleSearch).toHaveBeenCalledOnce();
    view.rerender(<ChatHeader conversation={conversation} serviceWindow={{ open: true, hoursLeft: 20 }} panelOpen={false} searchOpen onBack={vi.fn()} onTogglePanel={vi.fn()} onMarkUnread={vi.fn()} onTogglePin={vi.fn()} onToggleArchive={vi.fn()} onToggleSearch={onToggleSearch} />);
    expect(screen.getByRole('button', { name: 'Cerrar búsqueda en la conversación' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('CustomerPanel', () => {
  function renderPanel(overrides: Partial<Parameters<typeof CustomerPanel>[0]> = {}) {
    const props = {
      conversation,
      serviceWindow: { open: true as const, hoursLeft: 20 },
      activas: [venta('a', new Date(2026, 8, 27)), venta('b', new Date(2026, 9, 20), { perfilNumero: null })],
      ventasLoading: false,
      selectedVentaId: 'a',
      now: NOW,
      onSelectVenta: vi.fn(),
      onOpenTemplate: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    render(<CustomerPanel {...props} />);
    return props;
  }

  it('lists active sales with urgency and lets the team choose one for Meta templates', async () => {
    const user = userEvent.setup();
    const props = renderPanel();

    expect(screen.getByText('Vence hoy')).toBeTruthy();
    expect(screen.getByText('Vence en 23 días')).toBeTruthy();
    // Cada servicio es una tarjeta de dos líneas: nombre, y debajo la fecha con los días restantes.
    expect(screen.getByText('27 sep 2026')).toBeTruthy();
    expect(screen.getByText('20 oct 2026')).toBeTruthy();
    expect(screen.queryByText(/Perfil \d/)).toBeNull();
    expect(screen.queryByText('Monto')).toBeNull();
    expect(screen.queryByText(/\$\d/)).toBeNull();
    expect(screen.getByRole('radio', { name: /Servicio a/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('link', { name: 'Ver venta' }).getAttribute('href')).toBe('/ventas/a');

    await user.click(screen.getByRole('radio', { name: /Servicio b/ }));
    expect(props.onSelectVenta).toHaveBeenCalledWith('b');

    expect(screen.queryByRole('button', { name: 'Datos de acceso' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Cerrar ficha' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('suggests the matching Meta template when the window is closed', async () => {
    const user = userEvent.setup();
    const props = renderPanel({ serviceWindow: { open: false } });

    await user.click(screen.getByRole('button', { name: /Plantilla: Aviso de vencimiento/ }));
    expect(props.onOpenTemplate).toHaveBeenCalledWith('dia_pago');
  });

  it('describes overdue, undated and missing sales', () => {
    const { unmount } = render(
      <CustomerPanel
        conversation={conversation}
        serviceWindow={{ open: true, hoursLeft: 1 }}
        activas={[venta('late', new Date(2026, 8, 25)), venta('soon', new Date(2026, 8, 28)), venta('none', null)]}
        ventasLoading={false}
        selectedVentaId={null}
        now={NOW}
        onSelectVenta={vi.fn()}
        onOpenTemplate={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Venció hace 2 días')).toBeTruthy();
    expect(screen.getByText('Vence en 1 día')).toBeTruthy();
    expect(screen.getByText('Sin vencimiento')).toBeTruthy();
    unmount();

    renderPanel({ activas: [], selectedVentaId: null });
    expect(screen.getByText('No tiene servicios activos.')).toBeTruthy();
  });

  it('offers to register unknown numbers with the phone and name pre-filled', () => {
    renderPanel({ conversation: { ...conversation, terceroId: null, terceroNombre: null }, activas: [], selectedVentaId: null });

    const link = screen.getByRole('link', { name: /Registrar cliente/ });
    const url = new URL(link.getAttribute('href') ?? '', 'https://example.com');
    expect(url.pathname).toBe('/terceros/crear');
    expect(url.searchParams.get('telefono')).toBe('+507 6000-0000');
    expect(url.searchParams.get('nombre')).toBe('Mary');
    expect(url.searchParams.get('volver')).toBe('/chats?wa=50760000000');
  });

  it('shows placeholders while sales load', () => {
    renderPanel({ ventasLoading: true, activas: [] });
    expect(screen.queryByText('No tiene servicios activos.')).toBeNull();
  });

  it('orders active sales by nearest expiry and drops inactive ones', () => {
    const sorted = sortVentasForChat([
      venta('late', new Date(2026, 9, 1)),
      venta('off', new Date(2026, 8, 1), { estado: 'inactivo' }),
      venta('none', null),
      venta('soon', new Date(2026, 8, 28)),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['soon', 'late', 'none']);
  });
});

function option(tipoKey: string, name: string, body: string, map: string[], buttons: Array<{ type: string; text: string }> = []): TemplateOption {
  return {
    tipo: {
      id: tipoKey, nombre: tipoKey, tipo: tipoKey as TemplateOption['tipo']['tipo'], contenido: '', placeholders: [], activo: true,
      metaTemplateName: name, metaParamMap: map, createdAt: NOW, updatedAt: NOW,
    },
    meta: {
      id: name, name, language: 'es', status: 'APPROVED', category: 'UTILITY', body, header: null, footer: 'MovieTime PTY',
      buttons, paramCount: map.length, retired: false, syncedAt: NOW.toISOString(),
    },
  };
}

const OPTIONS = [
  option('notificacion_regular', 'aviso_vencimiento', 'Hola {{1}}, vence {{2}} por {{3}}', ['saludo_nombre', 'vencimiento', 'monto_total']),
  option('dia_pago', 'aviso_vence_hoy', 'Vence hoy *{{1}}* por {{2}}', ['servicios', 'monto_total'], [{ type: 'QUICK_REPLY', text: 'Quiero renovar' }]),
];

describe('TemplateSendDialog', () => {
  const baseProps = { open: true, options: OPTIONS, contextLabel: null, isSending: false, onOpenChange: vi.fn() };

  it('opens with the suggested tipo filled and previews the cached body', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    const paramsFor = vi.fn((item: TemplateOption) => (item.meta.name === 'aviso_vence_hoy' ? ['Netflix', '$4.50'] : ['Hola, María', '30/09', '$4.50']));
    render(<TemplateSendDialog {...baseProps} contextLabel="Netflix" initialTipo="dia_pago" paramsFor={paramsFor} onSend={onSend} />);

    expect(screen.getByText(/Datos tomados de Netflix/)).toBeTruthy();
    expect(screen.getAllByText(/aviso_vence_hoy/).length).toBeGreaterThan(0);
    expect(screen.getByText('Netflix', { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText('Quiero renovar')).toBeTruthy();
    expect(screen.getByText('MovieTime PTY')).toBeTruthy();
    await user.clear(screen.getByLabelText('Monto total'));
    await user.type(screen.getByLabelText('Monto total'), '$5.00');
    await user.click(screen.getByRole('button', { name: 'Enviar plantilla' }));

    expect(onSend).toHaveBeenCalledWith('aviso_vence_hoy', ['Netflix', '$5.00']);
  });

  it('blocks sending until every value is filled and can be cancelled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<TemplateSendDialog {...baseProps} onOpenChange={onOpenChange} initialTipo="notificacion_regular" paramsFor={() => ['Hola', '', '']} onSend={vi.fn()} />);

    expect(screen.getByText(/Si eliges una venta/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar plantilla' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('falls back to the first option when the suggested tipo has no approved template', () => {
    render(<TemplateSendDialog {...baseProps} initialTipo="cancelacion" paramsFor={() => ['a', 'b', 'c']} onSend={vi.fn()} />);
    expect(screen.getAllByText(/aviso_vencimiento/).length).toBeGreaterThan(0);
  });

  it('explains how to link templates when none is approved', () => {
    render(<TemplateSendDialog {...baseProps} options={[]} initialTipo="dia_pago" paramsFor={() => []} onSend={vi.fn()} />);
    expect(screen.getByText(/No hay plantillas de Meta aprobadas/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enviar plantilla' })).toBeNull();
  });

  it('shows progress while sending', () => {
    render(<TemplateSendDialog {...baseProps} isSending initialTipo="dia_pago" paramsFor={() => ['a', 'b']} onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeTruthy();
  });
});
