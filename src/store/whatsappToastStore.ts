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
  hydrate: () => void;
  setPending: (pending: Omit<PendingWhatsAppToast, 'id'>) => void;
  clearPending: (id?: string) => void;
}

function readPending(): PendingWhatsAppToast | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingWhatsAppToast>;
    if (!parsed.id || !parsed.message) return null;
    return {
      id: parsed.id,
      phone: parsed.phone ?? '',
      message: parsed.message,
      title: parsed.title ?? 'WhatsApp pendiente',
      description: parsed.description ?? 'La venta fue guardada. Puedes enviar el mensaje cuando quieras.',
    };
  } catch {
    return null;
  }
}

function writePending(pending: PendingWhatsAppToast | null) {
  if (typeof window === 'undefined') return;
  if (!pending) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

function createPendingId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}`;
}

export const useWhatsAppToastStore = create<WhatsAppToastState>((set) => ({
  pending: null,

  hydrate: () => {
    set({ pending: readPending() });
  },

  setPending: (payload) => {
    const pending = {
      ...payload,
      id: createPendingId(),
    };
    writePending(pending);
    set({ pending });
  },

  clearPending: (id) => {
    if (id && useWhatsAppToastStore.getState().pending?.id !== id) return;
    writePending(null);
    set({ pending: null });
  },
}));
