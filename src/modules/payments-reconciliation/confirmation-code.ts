// Codigo de confirmacion de Yappy: prefijo de letras, guion y digitos (ej. GZCSS-20613095), igual al del
// correo. El patron es cerrado y constante: nunca se construye una regex con texto del usuario.
const CODE_PATTERN = /\b[A-Z]{2,10}-[0-9]{6,12}\b/g;
const MAX_TEXT_LENGTH = 2000;

/**
 * Extrae el codigo de un texto de comprobante o de un codigo escrito por el cliente.
 * Devuelve null si no hay ninguno o si hay varios distintos (ambiguo: se pide al cliente que lo escriba).
 */
export function extractConfirmationCode(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  const normalized = text.slice(0, MAX_TEXT_LENGTH).toUpperCase();
  const found = new Set(normalized.match(CODE_PATTERN) ?? []);
  if (found.size !== 1) return null;
  return [...found][0] ?? null;
}
