import { COPY_CATALOG, COPY_VARIABLES, type CopyKey } from './catalog';

const MARKER = /\{\{([a-zA-Z]+)\}\}/g;
export type CopyValues = Partial<Record<string, string>>;
export type CopyOverrides = Partial<Record<string, string>>;

export function copyMarkers(text: string): string[] {
  return [...new Set([...text.matchAll(MARKER)].map(match => match[1]))];
}

/** Motivo por el que un texto no sirve para ese mensaje, o null si es valido. */
export function copyProblem(key: CopyKey, text: string): string | null {
  const spec = COPY_CATALOG[key];
  const value = text.trim();
  if (!value) return 'El texto no puede estar vacío.';
  if (value.length > spec.maxLength) return `Máximo ${spec.maxLength} caracteres.`;
  if (spec.kind !== 'message' && /[\r\n]/.test(value)) return 'Debe ir en una sola línea.';
  if (/[<>]/.test(value)) return 'No uses los símbolos < ni >.';
  const markers = copyMarkers(value);
  const unknown = markers.find(name => !(spec.variables as readonly string[]).includes(name));
  if (unknown) return `El dato {{${unknown}}} no se puede usar en este mensaje.`;
  const missing = spec.required.find(name => !markers.includes(name));
  if (missing) return `Falta el dato {{${missing}}}, que este mensaje necesita.`;
  return null;
}

export function renderCopyText(text: string, values: CopyValues = {}): string {
  return text.replace(MARKER, (_, name: string) => values[name] ?? '');
}

/** Valores de ejemplo para la vista previa del editor. */
export function sampleValues(key: CopyKey): Record<string, string> {
  return Object.fromEntries(COPY_CATALOG[key].variables.map(name => [name, COPY_VARIABLES[name].example]));
}

/**
 * Devuelve el traductor de textos del flujo: usa el texto editado si es valido y, si no (o si falta),
 * el original. Nunca lanza: un texto danado jamas deja al cliente sin respuesta.
 */
export function createCopy(overrides: CopyOverrides = {}) {
  return (key: CopyKey, values: CopyValues = {}): string => {
    const custom = overrides[key];
    const text = typeof custom === 'string' && copyProblem(key, custom) === null ? custom.trim() : COPY_CATALOG[key].defaultText;
    return renderCopyText(text, values);
  };
}
