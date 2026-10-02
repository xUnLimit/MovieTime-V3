import type { BotParams } from '@/types/bot';

// Entradas de texto del cliente de hasta ~4 KB; se recorta antes de procesar.
const TEXT_SCAN_MAX = 4096;
const HOUR_MS = 60 * 60 * 1000;
// Clase de caracteres acotada y sin anidamiento: busqueda lineal.
const MARKER_PATTERN = /\{\{([^{}\n]{1,40})\}\}/g;

/** Nombres (tal como estan escritos, sin repetir) de los marcadores `{{x}}` de una plantilla. */
export function templateVariables(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(MARKER_PATTERN)) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/**
 * Reemplaza solo los marcadores conocidos en una sola pasada: el valor insertado
 * no se vuelve a interpretar, asi que no hay doble sustitucion ni inyeccion.
 */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(MARKER_PATTERN, (whole, name: string) => (
    Object.hasOwn(values, name) ? values[name] : whole
  ));
}

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
