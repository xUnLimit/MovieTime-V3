import { create } from 'zustand';

const STORAGE_KEY = 'pending-whatsapp-toast';

export interface PendingWhatsAppToast {
  id: string;
  phone: string;
  message: string;
  title: string;
  description: string;
}

interface WhatsAppToastState {
  pending: PendingWhatsAppToast | null;
  queue: PendingWhatsAppToast[];
  hydrate: () => void;
  setPending: (pending: Omit<PendingWhatsAppToast, 'id'>) => void;
  enqueueMany: (pending: Array<Omit<PendingWhatsAppToast, 'id'>>) => void;
  clearPending: (id?: string) => void;
}

function normalizePending(rawValue: unknown): PendingWhatsAppToast | null {
  if (!rawValue || typeof rawValue !== 'object') return null;
  const parsed = rawValue as Partial<PendingWhatsAppToast>;
  if (!parsed.id || !parsed.message) return null;
  return {
    id: parsed.id,
    phone: parsed.phone ?? '',
    message: parsed.message,
    title: parsed.title ?? 'WhatsApp pendiente',
    description: parsed.description ?? 'Hay un mensaje pendiente para enviar.',
  };
}

function readQueue(): PendingWhatsAppToast[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => normalizePending(item))
        .filter((item): item is PendingWhatsAppToast => item !== null);
    }
    const pending = normalizePending(parsed);
    return pending ? [pending] : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingWhatsAppToast[]) {
  if (typeof window === 'undefined') return;
  if (queue.length === 0) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function createPendingId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}`;
}

export const useWhatsAppToastStore = create<WhatsAppToastState>((set) => ({
  pending: null,
  queue: [],

  hydrate: () => {
    const queue = readQueue();
    set({ queue, pending: queue[0] ?? null });
  },

  setPending: (payload) => {
    const pending = {
      ...payload,
      id: createPendingId(),
    };
    const queue = [...useWhatsAppToastStore.getState().queue, pending];
    writeQueue(queue);
    set({ queue, pending: queue[0] ?? null });
  },

  enqueueMany: (payloads) => {
    if (payloads.length === 0) return;
    const newItems = payloads.map((payload) => ({
      ...payload,
      id: createPendingId(),
    }));
    const queue = [...useWhatsAppToastStore.getState().queue, ...newItems];
    writeQueue(queue);
    set({ queue, pending: queue[0] ?? null });
  },

  clearPending: (id) => {
    const currentQueue = useWhatsAppToastStore.getState().queue;
    const queue = id
      ? currentQueue.filter((item) => item.id !== id)
      : currentQueue.slice(1);
    writeQueue(queue);
    set({ queue, pending: queue[0] ?? null });
  },
}));
