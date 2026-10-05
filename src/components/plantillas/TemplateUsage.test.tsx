import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { NoticeActivityApi } from '@/hooks/use-template-notices';
import { TemplateUsage } from './TemplateUsage';

function makeActivity(overrides: Partial<NoticeActivityApi> = {}): NoticeActivityApi {
  return {
    loading: false, failed: false, retry: vi.fn(),
    byTipo: { dia_pago: { sent: 5, failed: 1, skipped: 2, lastSentAt: '2026-10-01T15:30:00Z' }, despedida: { sent: 1, failed: 0, skipped: 1, lastSentAt: '2026-10-02T09:00:00Z' } },
    ...overrides,
  };
}

describe('TemplateUsage', () => {
  it('explica quién dispara el mensaje, qué hace y su actividad de 30 días', () => {
    render(<TemplateUsage tipo="dia_pago" activity={makeActivity()} onShowNotices={vi.fn()} />);
    const section = screen.getByRole('region', { name: 'Uso de este mensaje' });
    expect(section.textContent).toContain('Lo dispara: Automático (a la hora diaria) · Manual (botón Notificar)');
    expect(within(section).getByText(/Sale solo el día de pago a la hora configurada/)).toBeTruthy();
    expect(within(section).getByText(/Últimos 30 días: 5 enviados · 1 fallido · 2 omitidos · último envío .*2026/)).toBeTruthy();
  });

  it('usa singular para uno y marca un mensaje sin envíos', () => {
    const { rerender } = render(<TemplateUsage tipo="despedida" activity={makeActivity()} onShowNotices={vi.fn()} />);
    expect(screen.getByText(/1 enviado · 0 fallidos · 1 omitido · último envío/)).toBeTruthy();
    const region = () => screen.getByRole('region', { name: 'Uso de este mensaje' }).textContent;
    expect(region()).toContain('Lo dispara: Cuando el cliente toca un botón');
    rerender(<TemplateUsage tipo="renovacion" activity={makeActivity()} onShowNotices={vi.fn()} />);
    expect(screen.getByText('Últimos 30 días: 0 enviados · 0 fallidos · 0 omitidos · sin envíos')).toBeTruthy();
    expect(region()).toContain('Lo dispara: Por un evento del sistema');
  });

  it('abre el historial filtrado por el mensaje elegido', async () => {
    const onShowNotices = vi.fn();
    render(<TemplateUsage tipo="dia_pago" activity={makeActivity()} onShowNotices={onShowNotices} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver envíos de Aviso de vencimiento' }));
    expect(onShowNotices).toHaveBeenCalledWith('dia_pago');
  });

  it('muestra la carga sin conteos inventados y el error con reintento', async () => {
    const { rerender } = render(<TemplateUsage tipo="dia_pago" activity={makeActivity({ loading: true, byTipo: {} })} onShowNotices={vi.fn()} />);
    expect(screen.getByText('Cargando la actividad de los últimos 30 días')).toBeTruthy();
    expect(screen.queryByText(/Últimos 30 días/)).toBeNull();
    const activity = makeActivity({ failed: true, byTipo: {} });
    rerender(<TemplateUsage tipo="dia_pago" activity={activity} onShowNotices={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No se pudo cargar la actividad de los últimos 30 días.');
    expect(screen.queryByRole('button', { name: /Ver envíos/ })).toBeNull();
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Reintentar' }));
    expect(activity.retry).toHaveBeenCalled();
    // Quién lo dispara no depende de la consulta.
    expect(screen.getByText(/Lo dispara:/)).toBeTruthy();
  });
});
