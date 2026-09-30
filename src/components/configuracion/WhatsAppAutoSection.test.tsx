import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WhatsAppAutoSection, formatRunDate } from './WhatsAppAutoSection';
import type { useWhatsAppAutoSettings } from './useWhatsAppAutoSettings';

type Settings = ReturnType<typeof useWhatsAppAutoSettings>;

function settings(over: Partial<Settings> = {}): Settings {
  return {
    autoConfig: { prefijoTelefono: '507', autoEnabled: false, autoDailyCap: 200, autoSendHour: 9 },
    runs: [],
    runsLoading: false,
    draftCap: '200',
    setDraftCap: vi.fn(),
    isSaving: false,
    handleToggle: vi.fn().mockResolvedValue(undefined),
    handleHourChange: vi.fn().mockResolvedValue(undefined),
    handleCapCommit: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('WhatsAppAutoSection', () => {
  it('is off by default, explains itself and toggles through the handler', async () => {
    const s = settings();
    render(<WhatsAppAutoSection settings={s} />);
    expect(screen.getByText(/Todo sale por la API de WhatsApp: el aviso de día de pago a la hora indicada/)).toBeTruthy();
    expect(screen.getByText('Apagado, tú eliges cómo avisar: por la API o abriendo WhatsApp.')).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'Activar envío automático por WhatsApp' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await userEvent.setup().click(toggle);
    expect(s.handleToggle).toHaveBeenCalledWith(true);
  });

  it('shows the Panama hour and commits the cap on blur', async () => {
    const s = settings();
    render(<WhatsAppAutoSection settings={s} />);
    expect(screen.getByText('Hora de envío (hora de Panamá)')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Hora de envío' }).textContent).toContain('09:00');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Tope diario de envíos'));
    await user.tab();
    expect(s.handleCapCommit).toHaveBeenCalled();
  });

  it('disables the controls until the config is loaded', () => {
    render(<WhatsAppAutoSection settings={settings({ autoConfig: null })} />);
    expect(screen.getByRole('switch').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Tope diario de envíos').hasAttribute('disabled')).toBe(true);
  });

  it('keeps the hour select controlled while the config loads', () => {
    // Radix avisa del cambio controlado/no controlado con console.warn.
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const view = render(<WhatsAppAutoSection settings={settings({ autoConfig: null })} />);
    expect(screen.getByRole('combobox', { name: 'Hora de envío' }).textContent).toContain('Selecciona la hora');
    view.rerender(<WhatsAppAutoSection settings={settings()} />);
    expect(screen.getByRole('combobox', { name: 'Hora de envío' }).textContent).toContain('09:00');
    expect(consoleWarn.mock.calls.flat().join(' ')).not.toMatch(/uncontrolled to controlled/);
    consoleWarn.mockRestore();
  });

  it('lists the last runs with sent, failed and skipped counts', () => {
    render(<WhatsAppAutoSection settings={settings({
      runs: [{ id: 'r1', runDate: '2026-09-27', status: 'done', sent: 12, failed: 2, skipped: 3, alreadySent: 0 }],
    })} />);
    const row = screen.getByText(formatRunDate('2026-09-27')).closest('tr') as HTMLElement;
    expect(within(row).getByText('12')).toBeTruthy();
    expect(within(row).getByText('2')).toBeTruthy();
    expect(within(row).getByText('3')).toBeTruthy();
    expect(within(row).getByText('Listo')).toBeTruthy();
  });

  it('shows an empty state without runs', () => {
    render(<WhatsAppAutoSection settings={settings()} />);
    expect(screen.getByText('Aún no hay corridas.')).toBeTruthy();
  });
});
