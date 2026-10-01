import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './client';
import type { WhatsAppRealtimeListener, WhatsAppRealtimeTable } from './whatsapp-realtime';

type Change = { new?: unknown; old?: unknown };
type FakeChannel = {
  changes: Map<WhatsAppRealtimeTable, (change: Change) => void>;
  emitStatus: (status: string) => void;
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
};

const fake = vi.hoisted(() => ({
  channels: [] as FakeChannel[],
  removeChannel: vi.fn(async () => 'ok'),
}));

vi.mock('./client', () => ({
  supabase: {
    channel: vi.fn(() => {
      const changes = new Map<WhatsAppRealtimeTable, (change: Change) => void>();
      let statusCallback: (status: string) => void = () => {};
      const next: FakeChannel = {
        changes,
        emitStatus: (status) => statusCallback(status),
        on: vi.fn((_kind: string, filter: { table: WhatsAppRealtimeTable }, callback: (change: Change) => void) => {
          changes.set(filter.table, callback);
          return next;
        }),
        subscribe: vi.fn((callback: (status: string) => void) => {
          statusCallback = callback;
          return next;
        }),
      };
      fake.channels.push(next);
      return next;
    }),
    removeChannel: fake.removeChannel,
  },
}));

import { subscribeToWhatsAppChanges } from './whatsapp-realtime';

const cancellations: Array<() => void> = [];

function listen(listener: WhatsAppRealtimeListener): () => void {
  const cancel = subscribeToWhatsAppChanges(listener);
  cancellations.push(cancel);
  return cancel;
}

function emit(table: WhatsAppRealtimeTable, change: Change): void {
  const callback = fake.channels.at(-1)?.changes.get(table);
  if (!callback) throw new Error(`Falta callback para ${table}`);
  callback(change);
}

beforeEach(() => {
  fake.channels.length = 0;
  fake.removeChannel.mockClear();
});

afterEach(() => {
  for (const cancel of cancellations) cancel();
  cancellations.length = 0;
  vi.restoreAllMocks();
});

describe('WhatsApp Realtime', () => {
  it('comparte un canal y lo quita solo al cancelar la ultima suscripcion', () => {
    const first = { onEvent: vi.fn(), onStatus: vi.fn() };
    const second = { onEvent: vi.fn(), onStatus: vi.fn() };
    const cancelFirst = listen(first);
    const cancelSecond = listen(second);

    expect(fake.channels).toHaveLength(1);
    expect(fake.channels[0].on).toHaveBeenCalledTimes(5);
    expect(fake.channels[0].subscribe).toHaveBeenCalledTimes(1);
    emit('whatsapp_inbound_messages', { new: { from_wa_id: '50712345678', text_body: 'privado' } });
    expect(first.onEvent).toHaveBeenCalledWith({ table: 'whatsapp_inbound_messages', waId: '50712345678' });
    expect(second.onEvent).toHaveBeenCalledWith({ table: 'whatsapp_inbound_messages', waId: '50712345678' });
    expect(first.onEvent.mock.calls[0][0]).toEqual({ table: 'whatsapp_inbound_messages', waId: '50712345678' });

    cancelFirst();
    expect(fake.removeChannel).not.toHaveBeenCalled();
    cancelSecond();
    cancelSecond();
    expect(fake.removeChannel).toHaveBeenCalledExactlyOnceWith(fake.channels[0]);
  });

  it.each([
    ['whatsapp_inbound_messages', 'from_wa_id'],
    ['whatsapp_outbound_messages', 'to_wa_id'],
    ['whatsapp_message_statuses', 'recipient_wa_id'],
    ['whatsapp_conversation_reads', 'wa_id'],
    ['whatsapp_conversation_flags', 'wa_id'],
  ] as const)('mapea el identificador de %s', (table, column) => {
    const onEvent = vi.fn();
    listen({ onEvent, onStatus: vi.fn() });
    emit(table, { new: { [column]: '50799999999', text_body: 'secreto' } });
    emit(table, { new: {}, old: { [column]: '50788888888' } });
    emit(table, { new: { [column]: '  ' }, old: {} });
    emit(table, { new: { [column]: 123 }, old: {} });
    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { table, waId: '50799999999' },
      { table, waId: '50788888888' },
      { table, waId: null },
      { table, waId: null },
    ]);
  });

  it('notifica transiciones y entrega el estado actual a listeners tardios', () => {
    const first = vi.fn();
    const second = vi.fn();
    listen({ onEvent: vi.fn(), onStatus: first });
    expect(first).toHaveBeenCalledWith('connecting');
    fake.channels[0].emitStatus('SUBSCRIBED');
    fake.channels[0].emitStatus('SUBSCRIBED');
    listen({ onEvent: vi.fn(), onStatus: second });
    expect(second).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith('live');
    fake.channels[0].emitStatus('CHANNEL_ERROR');
    fake.channels[0].emitStatus('TIMED_OUT');
    fake.channels[0].emitStatus('CLOSED');
    fake.channels[0].emitStatus('SUBSCRIBED');
    expect(first.mock.calls.map(([value]) => value)).toEqual(['connecting', 'live', 'offline', 'live']);
    expect(second.mock.calls.map(([value]) => value)).toEqual(['live', 'offline', 'live']);
  });

  it('aisla listeners que lanzan en eventos y estados sin registrar datos privados', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const healthy = { onEvent: vi.fn(), onStatus: vi.fn() };
    listen({ onEvent: () => { throw new Error('contenido privado'); }, onStatus: () => { throw new Error('contenido privado'); } });
    listen(healthy);
    fake.channels[0].emitStatus('SUBSCRIBED');
    emit('whatsapp_outbound_messages', { new: { to_wa_id: '50712345678', text_body: 'contenido privado' } });
    expect(healthy.onStatus).toHaveBeenCalledWith('live');
    expect(healthy.onEvent).toHaveBeenCalledWith({ table: 'whatsapp_outbound_messages', waId: '50712345678' });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('contenido privado');
  });

  it('en SSR reporta offline y devuelve una cancelacion inocua', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
    try {
      const onStatus = vi.fn();
      const cancel = listen({ onEvent: vi.fn(), onStatus });
      expect(onStatus).toHaveBeenCalledExactlyOnceWith('offline');
      expect(fake.channels).toHaveLength(0);
      expect(() => { cancel(); cancel(); }).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    }
  });

  it('reporta offline si el cliente no puede crear el canal', () => {
    vi.spyOn(supabase, 'channel').mockImplementationOnce(() => {
      throw new Error('configuracion privada');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onStatus = vi.fn();
    expect(() => listen({ onEvent: vi.fn(), onStatus })).not.toThrow();
    expect(onStatus.mock.calls.map(([value]) => value)).toEqual(['connecting', 'offline']);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('configuracion privada');
  });

  it('crea otro canal despues de cancelar todo e ignora callbacks anteriores', () => {
    const first = { onEvent: vi.fn(), onStatus: vi.fn() };
    const cancel = listen(first);
    const oldChannel = fake.channels[0];
    cancel();
    const second = { onEvent: vi.fn(), onStatus: vi.fn() };
    listen(second);
    expect(fake.channels).toHaveLength(2);
    expect(second.onStatus).toHaveBeenCalledWith('connecting');
    oldChannel.emitStatus('SUBSCRIBED');
    oldChannel.changes.get('whatsapp_inbound_messages')?.({ new: { from_wa_id: 'old' } });
    expect(second.onStatus).toHaveBeenCalledTimes(1);
    expect(second.onEvent).not.toHaveBeenCalled();
    emit('whatsapp_inbound_messages', { new: { from_wa_id: 'new' } });
    expect(second.onEvent).toHaveBeenCalledWith({ table: 'whatsapp_inbound_messages', waId: 'new' });
  });

  it('usa un nombre de canal distinto en cada apertura', () => {
    listen({ onEvent: vi.fn(), onStatus: vi.fn() })();
    listen({ onEvent: vi.fn(), onStatus: vi.fn() });
    const names = vi.mocked(supabase.channel).mock.calls.map(([name]) => name).slice(-2);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });
});
