import type { CopyKey, CopyStepId } from './catalog';
import { COPY_CATALOG, COPY_KEYS } from './catalog';
import { copyProblem } from './render';

/** Bloques cerrados del flujo de compras en el lienzo: cada uno agrupa pasos enteros de la conversacion. */
export type CopyBlockType = 'catalogo' | 'resumen' | 'reserva' | 'pago';
export const COPY_BLOCK_TYPES: readonly CopyBlockType[] = ['catalogo', 'resumen', 'reserva', 'pago'];

const BLOCK_OF_STEP: Record<CopyStepId, CopyBlockType> = {
  inicio: 'catalogo', plataformas: 'catalogo', planes: 'catalogo', agotados: 'catalogo', renovar: 'catalogo', servicios: 'catalogo',
  carrito: 'resumen', reserva: 'reserva', pago: 'pago', ayuda: 'pago',
};

export const blockOfCopyKey = (key: CopyKey): CopyBlockType => BLOCK_OF_STEP[COPY_CATALOG[key].step];
export const copyKeysOfBlock = (type: CopyBlockType): CopyKey[] => COPY_KEYS.filter(key => blockOfCopyKey(key) === type);

/** Motivo por el que el texto no sirve en ese bloque (clave ajena, o reglas del mensaje); null si es valido. */
export function blockCopyProblem(type: CopyBlockType, key: string, text: string): string | null {
  const known = (COPY_KEYS as readonly string[]).includes(key);
  if (!known || blockOfCopyKey(key as CopyKey) !== type) return `El texto «${key}» no pertenece a este bloque.`;
  return copyProblem(key as CopyKey, text);
}
