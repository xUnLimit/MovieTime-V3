import { catalogAdminRepository } from '@/platform/supabase/catalog-admin-repository';
import { catalogAdminSnapshotSchema, catalogConfigSchema, catalogSettingsSchema } from '@/modules/catalog/admin-contracts';
import { assertUuid } from '@/platform/utils/safety';
import { assertOnlineMutation } from '@/platform/supabase/online-mutation';

export function createCatalogAdminUseCases(repository = catalogAdminRepository) {
  function admin(role: string | undefined) { if (role !== 'admin') throw new Error('Solo administradores.'); }
  return {
    async load(role: string | undefined) { admin(role); return catalogAdminSnapshotSchema.parse(await repository.load()); },
    async saveSettings(role: string | undefined, input: unknown) {
      admin(role); assertOnlineMutation(); await repository.saveSettings(catalogSettingsSchema.parse(input));
    },
    async saveConfig(role: string | undefined, input: unknown) {
      admin(role); assertOnlineMutation(); const value = catalogConfigSchema.parse(input);
      const snapshot = catalogAdminSnapshotSchema.parse(await repository.load());
      if (value.plan_id && !snapshot.plans.some(plan => plan.id === value.plan_id && plan.categoria_id === value.categoria_id)) throw new Error('Plan incompatible.');
      if (value.alternativa_plan_id && !snapshot.plans.some(plan => plan.id === value.alternativa_plan_id && plan.categoria_id === value.alternativa_categoria_id)) throw new Error('Alternativa incompatible.');
      await repository.saveConfig(value);
    },
    async closeInterest(role: string | undefined, id: string, state: 'convertido' | 'descartado') {
      admin(role); assertOnlineMutation();
      if (state !== 'convertido' && state !== 'descartado') throw new Error('Estado inválido.');
      await repository.closeInterest(assertUuid(id, 'Interés'), state);
    },
  };
}
export const catalogAdminUseCases = createCatalogAdminUseCases();
