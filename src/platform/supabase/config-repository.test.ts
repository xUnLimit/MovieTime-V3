import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));
vi.mock('./client', () => ({ supabase: { from: mocks.from } }));

import { getConfig, updateExecutivePushSettings, updateWhatsappAutoSettings } from './config-repository';

function readQuery(result: { data: unknown; error: { message: string } | null }) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.single.mockResolvedValue(result);
  return Object.assign(chain, Promise.resolve(result));
}

function writeQuery(error: { message: string } | null = null) {
  const final = Promise.resolve({ error });
  const chain = { update: vi.fn(), eq: vi.fn(), upsert: vi.fn() };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(final);
  chain.upsert.mockReturnValue(final);
  return chain;
}

const config = {
  updated_at: '2026-01-01T00:00:00Z', notificaciones_dias_anticipacion: 3, hora_envio: 8,
  whatsapp_auto_enabled: true, whatsapp_auto_daily_cap: 150,
  whatsapp_prefijo: '+507', executive_push_enabled: true, executive_push_send_time: '09:00',
  executive_push_window_start: '07:00', executive_push_window_end: '21:00',
  executive_push_interval_hours: 6, executive_push_timezone: 'America/Panama',
  executive_push_selected_blocks: ['ventas'], executive_push_block_order: ['ventas'],
  executive_push_updated_by: 'u1', executive_push_last_sent_at: '2026-01-02T00:00:00Z',
  executive_push_last_sent_date: '2026-01-02', executive_push_last_sent_slot: '09:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReset();
});

describe('config repository', () => {
  it('maps database config, rates and complete executive settings', async () => {
    mocks.from
      .mockReturnValueOnce(readQuery({ data: config, error: null }))
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({
        data: [
          { currency_pair: 'USD_EUR', rate: '2', last_updated: '2026-01-03T00:00:00Z' },
          { currency_pair: 'USD_MXN', rate: '20', last_updated: '2026-01-02T00:00:00Z' },
        ], error: null,
      }) });
    const result = await getConfig();
    expect(result).toEqual(expect.objectContaining({
      id: 'global', tasasCambio: expect.objectContaining({ USD_EUR: 2, USD_MXN: 20 }),
      notificaciones: { diasAntes: [3], horaEnvio: 8 },
      whatsapp: { prefijoTelefono: '+507', autoEnabled: true, autoDailyCap: 150, autoSendHour: 8 },
      executivePush: expect.objectContaining({ enabled: true, sendTime: '09:00', windowStart: '07:00', intervalHours: 6 }),
    }));
    expect(result.tasasCambio.ultimaActualizacion).toEqual(new Date('2026-01-03T00:00:00Z'));
  });

  it('uses executive defaults when settings are missing', async () => {
    const sparse = { ...config,
      executive_push_enabled: null, executive_push_send_time: null, executive_push_window_start: null,
      executive_push_window_end: null, executive_push_interval_hours: null, executive_push_timezone: null,
      executive_push_selected_blocks: null, executive_push_block_order: null, executive_push_updated_by: null,
      executive_push_last_sent_at: null, executive_push_last_sent_date: null, executive_push_last_sent_slot: null,
    };
    mocks.from
      .mockReturnValueOnce(readQuery({ data: sparse, error: null }))
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: null, error: null }) });
    expect((await getConfig()).executivePush).toEqual(expect.objectContaining({
      enabled: false, sendTime: '08:00', windowStart: '08:00', windowEnd: '22:00', intervalHours: 24,
      timezone: 'America/Bogota', selectedBlocks: [], blockOrder: [], updatedBy: undefined,
      lastSentAt: null, lastSentDate: null, lastSentSlot: null,
    }));
  });

  it('propagates config and rates read failures', async () => {
    mocks.from
      .mockReturnValueOnce(readQuery({ data: config, error: { message: 'config' } }))
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: [], error: null }) });
    await expect(getConfig()).rejects.toThrow('config');
    mocks.from
      .mockReturnValueOnce(readQuery({ data: config, error: null }))
      .mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: [], error: { message: 'rates' } }) });
    await expect(getConfig()).rejects.toThrow('rates');
  });

  it('updates the executive push settings', async () => {
    const executive = writeQuery();
    mocks.from.mockReturnValueOnce(executive);
    await updateExecutivePushSettings({ executive_push_enabled: false });
    expect(executive.update).toHaveBeenCalledWith({ executive_push_enabled: false });
  });

  it('writes the automatic WhatsApp settings using the existing integer send hour', async () => {
    const write = writeQuery();
    mocks.from.mockReturnValue(write);
    await updateWhatsappAutoSettings({ whatsapp_auto_enabled: true, whatsapp_auto_daily_cap: 200, hora_envio: 9 });
    expect(write.update).toHaveBeenCalledWith({ whatsapp_auto_enabled: true, whatsapp_auto_daily_cap: 200, hora_envio: 9 });
  });
});
