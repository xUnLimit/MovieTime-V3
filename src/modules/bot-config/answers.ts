import type { BotNode, BotOption } from '@/types/bot';
import { normalizeText } from './render';

/** Las palabras o frases que identifican una respuesta: el título de la salida, separado por comas y sin acentos ni mayúsculas. */
export function answerWords(title: string): string[] {
  return title.split(',').map((word) => normalizeText(word).replace(/\s+/g, ' ').trim()).filter((word) => word !== '');
}

const tokens = (text: string): string[] => normalizeText(text).split(/[^a-z0-9ñ]+/).filter((token) => token !== '');

/**
 * La salida de un texto que espera al cliente que corresponde a lo que escribió. Una salida coincide si lo escrito incluye alguna de
 * sus palabras como palabra completa (o la frase completa, si tiene varias palabras). Gana la primera que coincide, en el orden del
 * editor; si ninguna coincide, la marcada como «cualquier otra respuesta»; y si tampoco hay, ninguna.
 */
export function matchTextAnswer(node: BotNode, text: string): BotOption | null {
  if (node.kind !== 'text' || node.after?.mode !== 'wait') return null;
  const written = tokens(text);
  if (written.length === 0) return null;
  const phrase = ` ${written.join(' ')} `;
  const matched = node.options.find((option) => !option.any && answerWords(option.title).some((word) => {
    const parts = tokens(word);
    return parts.length === 1 ? written.includes(parts[0]) : parts.length > 1 && phrase.includes(` ${parts.join(' ')} `);
  }));
  return matched ?? node.options.find((option) => option.any) ?? null;
}
