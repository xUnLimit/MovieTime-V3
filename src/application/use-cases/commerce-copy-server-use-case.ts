import { createCommerceCopyStore } from '@/modules/commerce-copy/store';

export type CommerceCopyState = { overrides: Record<string, string>; updatedAt: Record<string, string> };

/** Textos de compras guardados fuera del recorrido (solo lectura): el lienzo los muestra como el texto vigente. */
export async function readCommerceCopyUseCase(): Promise<CommerceCopyState> {
  const store = createCommerceCopyStore();
  const [overrides, updatedAt] = await Promise.all([store.overrides(), store.updatedAt()]);
  return { overrides: overrides as Record<string, string>, updatedAt };
}
