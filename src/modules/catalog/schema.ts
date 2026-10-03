// Shared wire schemas live in platform so the repository never imports a module.
export { catalogEstadoSchema, catalogItemSchema } from '@/platform/supabase/catalog-contracts';
export type { CatalogItem } from '@/platform/supabase/catalog-contracts';
