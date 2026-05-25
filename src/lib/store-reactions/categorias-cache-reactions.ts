import { useCategoriasStore } from '@/store/categoriasStore';

export async function refreshCategoriasStoreCache() {
  await useCategoriasStore.getState().fetchCategorias(true);
}
