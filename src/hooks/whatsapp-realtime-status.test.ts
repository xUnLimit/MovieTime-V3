import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWhatsAppRealtimeStatus,
  isWhatsAppRealtimeLive,
  pollingInterval,
  setWhatsAppRealtimeStatus,
  subscribeWhatsAppRealtimeStatus,
} from './whatsapp-realtime-status';

beforeEach(() => setWhatsAppRealtimeStatus('offline'));

describe('estado de WhatsApp Realtime', () => {
  it('usa sondeo rapido sin conexion y lento en vivo', () => {
    expect(pollingInterval(5_000, 30_000)).toBe(5_000);
    setWhatsAppRealtimeStatus('connecting');
    expect(pollingInterval(5_000, 30_000)).toBe(5_000);
    setWhatsAppRealtimeStatus('live');
    expect(isWhatsAppRealtimeLive()).toBe(true);
    expect(pollingInterval(5_000, 30_000)).toBe(30_000);
    setWhatsAppRealtimeStatus('offline');
    expect(isWhatsAppRealtimeLive()).toBe(false);
  });

  it('notifica cambios, permite cancelar y expone el estado actual', () => {
    const listener = vi.fn();
    const cancel = subscribeWhatsAppRealtimeStatus(listener);
    setWhatsAppRealtimeStatus('live');
    setWhatsAppRealtimeStatus('live');
    expect(listener).toHaveBeenCalledOnce();
    expect(getWhatsAppRealtimeStatus()).toBe('live');
    cancel();
    setWhatsAppRealtimeStatus('offline');
    expect(listener).toHaveBeenCalledOnce();
  });
});
