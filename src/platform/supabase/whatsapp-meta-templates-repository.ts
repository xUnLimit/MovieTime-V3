import { supabase } from './client';
import type { Database } from './database.types';

export type MetaTemplateRow = Database['public']['Tables']['whatsapp_meta_templates']['Row'];

// Cache de plantillas de Meta; solo lectura (la escribe la sincronizacion del servidor).
export async function listMetaTemplateRows(): Promise<MetaTemplateRow[]> {
  const { data, error } = await supabase.from('whatsapp_meta_templates').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}
