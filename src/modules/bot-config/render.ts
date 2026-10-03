import type { BotParams } from '@/types/bot';
export { renderTemplate, templateVariables } from '@/platform/text/template';

// Entradas de texto del cliente de hasta ~4 KB; se recorta antes de procesar.
const TEXT_SCAN_MAX = 4096;
const HOUR_MS = 60 * 60 * 1000;
/** Minusculas, sin acentos y con espacios colapsados. */
export function normalizeText(text: string): string {
  return text.slice(0, TEXT_SCAN_MAX)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toWords(text: string): string {
  return normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean).join(' ');
}

/** Coincidencia por palabra completa (o frase completa) sin importar acentos ni mayusculas. */
export function matchesKeyword(text: string | null, keywords: readonly string[]): boolean {
  if (text === null) return false;
  const haystack = ` ${toWords(text)} `;
  return keywords.some((keyword) => {
    const needle = toWords(keyword);
    return needle !== '' && haystack.includes(` ${needle} `);
  });
}

// El menu se ofrece con una palabra clave o tras inactividad, y nunca mientras
// una persona atiende al cliente.
export function shouldOfferMenu(input: {
  text: string | null; lastActivityAt: string | null; operatorRepliedRecently: boolean;
  now: Date; params: BotParams; keywords: readonly string[];
}): boolean {
  if (input.operatorRepliedRecently) return false;
  if (matchesKeyword(input.text, input.keywords)) return true;
  if (!input.lastActivityAt) return true;
  const idle = input.now.getTime() - Date.parse(input.lastActivityAt);
  return !Number.isFinite(idle) || idle >= input.params.menuIdleHours * HOUR_MS;
}
