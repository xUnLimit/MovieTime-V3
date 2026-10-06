import type { BotNode, BotOption } from '@/types/bot';

/**
 * Cómo se nombra una salida en el lienzo y en las listas. Un texto que continúa solo no tiene botón («Continúa») y en uno que
 * espera al cliente la salida sin palabras es «cualquier otra respuesta».
 */
export function optionLabel(node: BotNode, option: BotOption): string {
  if (node.kind === 'text' && node.after?.mode === 'continue') return 'Continúa';
  if (node.kind === 'text' && node.after?.mode === 'wait') return option.any ? 'Cualquier otra respuesta' : option.title.trim() === '' ? 'Respuesta sin palabras' : option.title;
  return option.title;
}
