import { createLogger } from '@/platform/observability/logger';
import { blockCopyOverrides } from '@/modules/bot-config';
import { createCopy, type CopyOverrides } from '@/modules/commerce-copy/render';
import { createCommerceCopyStore } from '@/modules/commerce-copy/store';
import { createBotConfigStore } from '@/modules/messaging/bot-config-store';

const log = createLogger('InterestCopy');

/**
 * Aviso de que volvió el cupo, con el texto que el administrador dejó en el recorrido publicado (si lo cambió) o, si no, el
 * guardado fuera del recorrido y, si tampoco hay, el original. Si no se pueden leer, se usa el original: el aviso sale igual.
 */
export async function interestAvailableText(name: string): Promise<string> {
  let overrides: CopyOverrides = {};
  try {
    overrides = await createCommerceCopyStore().overrides();
  } catch (error) {
    log.warn('No se pudieron leer los textos editados; se usa el original.', { error });
  }
  try {
    const snapshot = await createBotConfigStore().load(null);
    if (snapshot.ready) overrides = { ...overrides, ...blockCopyOverrides(snapshot.definition) };
  } catch (error) {
    log.warn('No se pudo leer el recorrido publicado; se usa el texto guardado.', { error });
  }
  return createCopy(overrides)('interestAvailable', { servicio: name });
}
