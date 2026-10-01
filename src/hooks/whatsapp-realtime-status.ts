import type { WhatsAppRealtimeStatus } from '@/application/use-cases/whatsapp-chat-use-cases';

let status: WhatsAppRealtimeStatus = 'offline';
const listeners = new Set<() => void>();

export function setWhatsAppRealtimeStatus(next: WhatsAppRealtimeStatus): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

export function getWhatsAppRealtimeStatus(): WhatsAppRealtimeStatus {
  return status;
}

export function subscribeWhatsAppRealtimeStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isWhatsAppRealtimeLive(): boolean {
  return status === 'live';
}

export function pollingInterval(fastMs: number, slowMs: number): number {
  return isWhatsAppRealtimeLive() ? slowMs : fastMs;
}
