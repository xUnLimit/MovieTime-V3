import { supabase } from './client';
import { DomainError } from '@/platform/errors/domain-errors';
import type { Database } from './database.types';

type Config = Database['public']['Tables']['catalogo_config']['Insert'];
type Settings = Database['public']['Tables']['catalogo_ajustes']['Update'];
function checked<T>(result: { data: T; error: unknown }): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) throw new DomainError('No se pudo cargar el catálogo.', 'CATALOG_UNAVAILABLE');
  return result.data;
}
async function collect<T>(query: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const batch = checked(await query(offset)); rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}
export const catalogAdminRepository = {
  async load() {
    const [settings, configs, categories, plans, currencies, availability, interests, demand, contacts, customers] = await Promise.all([
      supabase.from('catalogo_ajustes').select('*').eq('id', 'global').abortSignal(AbortSignal.timeout(10000)).single(),
      collect(offset => supabase.from('catalogo_config').select('*').order('id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('categorias').select('id,nombre').order('id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('planes').select('id,nombre,categoria_id').order('id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('currencies').select('code').order('code').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.rpc('catalogo_disponible').order('plan_id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('intereses').select('*').order('created_at').order('id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('v_demanda_sin_stock').select('*').order('categoria_id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('whatsapp_contacts').select('wa_id,nombre_perfil,tercero_id').order('wa_id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
      collect(offset => supabase.from('terceros').select('id,nombre').order('id').range(offset, offset + 499).abortSignal(AbortSignal.timeout(10000))),
    ]);
    return { settings: checked(settings), configs, categories, plans,
      currencies, availability, interests, demand,
      contacts, customers };
  },
  async saveSettings(value: Settings) {
    checked(await supabase.from('catalogo_ajustes').update(value).eq('id', 'global').select('id').abortSignal(AbortSignal.timeout(10000)).single());
  },
  async saveConfig(value: Config) {
    const query = value.id ? supabase.from('catalogo_config').update(value).eq('id', value.id) : supabase.from('catalogo_config').insert(value);
    checked(await query.select('id').abortSignal(AbortSignal.timeout(10000)).single());
  },
  async closeInterest(id: string, estado: 'convertido' | 'descartado') {
    checked(await supabase.from('intereses').update({ estado }).eq('id', id).in('estado', ['esperando', 'avisado'])
      .select('id').abortSignal(AbortSignal.timeout(10000)).single());
  },
};
