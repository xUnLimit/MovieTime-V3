import { netflixProvider } from './netflix-provider';
import type { CodeProvider } from './types';
export type { CodeProvider, DatedCodeMail } from './types';

const providers: readonly CodeProvider[] = Object.freeze([netflixProvider]);
export function getCodeProvider(key: string | null | undefined): CodeProvider | null {
  return providers.find((provider) => provider.key === key) ?? null;
}
export function listCodeProviders(): readonly CodeProvider[] { return providers; }

/** Validate keys at the application boundary; the database deliberately stores data, not a closed enum. */
export function assertCodeProviderKey(key: unknown): asserts key is string | null | undefined {
  if (key !== null && key !== undefined && (typeof key !== 'string' || !getCodeProvider(key))) {
    throw new Error('El proveedor de códigos no está disponible.');
  }
}
export function assertCodeAccess(enabled: unknown, key: unknown): void {
  assertCodeProviderKey(key);
  if (enabled !== undefined && typeof enabled !== 'boolean') throw new Error('El acceso por código debe ser booleano.');
  if (enabled === true && !getCodeProvider(key)) throw new Error('La categoría no tiene proveedor de códigos.');
}
