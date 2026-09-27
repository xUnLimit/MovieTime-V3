// Borradores de chat guardados por conversacion. Un borrador puede llevar una
// plantilla de credenciales ya llena (contrasena de un servicio), asi que se
// borran todos al cerrar sesion para no dejarlos en el navegador compartido.
const DRAFT_PREFIX = 'chat-draft:';

function draftKey(waId: string): string {
  return `${DRAFT_PREFIX}${waId}`;
}

export function readChatDraft(waId: string): string {
  try {
    return window.localStorage.getItem(draftKey(waId)) ?? '';
  } catch {
    return '';
  }
}

export function writeChatDraft(waId: string, value: string): void {
  try {
    if (value) window.localStorage.setItem(draftKey(waId), value);
    else window.localStorage.removeItem(draftKey(waId));
  } catch {
    // El borrador se conserva en memoria cuando el almacenamiento falla.
  }
}

export function clearAllChatDrafts(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Sin almacenamiento disponible no hay nada que limpiar.
  }
}
