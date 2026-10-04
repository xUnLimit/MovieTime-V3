import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { storedSettingsSchema, defaultAutomationSettings } from './contracts';
import { automationMetricsSchema } from './metrics';
import type { AutomationControl } from '@/types/automation-control';

type Client = ReturnType<typeof createServiceRoleClient>;
function check(error: unknown): void {
  if (error) throw new Error('No se pudo leer la configuración de automatizaciones.', { cause: error });
}
export function createAutomationControlStore(client: Client = createServiceRoleClient()) {
  return {
    async metrics() {
      const { data, error } = await client.rpc('mt_automation_metrics');
      check(error); return automationMetricsSchema.parse(data);
    },
    async settings() {
      const { data, error } = await client.from('mt_automation_settings').select('settings').eq('id', true).single();
      check(error);
      return storedSettingsSchema.parse(data?.settings ?? defaultAutomationSettings);
    },
    async access(): Promise<AutomationControl['access']> {
      const [policies, services, categories] = await Promise.all([
        client.from('mt_service_access').select('service_id,mode,provider,rotation_confirmed_at').order('service_id').limit(1000),
        client.from('servicios').select('id,categoria_id').eq('activo', true).limit(1000),
        client.from('categorias').select('id,nombre').eq('activo', true).limit(1000),
      ]);
      check(policies.error); check(services.error); check(categories.error);
      const netflix = new Set((categories.data ?? []).filter((c) => /netflix/i.test(c.nombre)).map((c) => c.id));
      const rows = new Map((policies.data ?? []).map((r) => [r.service_id, r]));
      return (services.data ?? []).filter((s) => netflix.has(s.categoria_id)).map((s) => ({ serviceId: s.id,
        mode: rows.get(s.id)?.mode === 'code' ? 'code' : 'password', provider: 'netflix',
        rotationConfirmedAt: rows.get(s.id)?.rotation_confirmed_at ?? null }));
    },
    async interests(): Promise<AutomationControl['interests']> {
      const [interests, categories, plans] = await Promise.all([
        client.from('intereses').select('id,contact_id,categoria_id,plan_id,estado,created_at,consent_at,paused_at')
          .in('estado', ['esperando', 'avisado']).order('created_at').limit(1000),
        client.from('categorias').select('id,nombre').limit(1000),
        client.from('planes').select('id,nombre').limit(1000),
      ]);
      check(interests.error); check(categories.error); check(plans.error);
      const names = new Map((categories.data ?? []).map((r) => [r.id, r.nombre]));
      const planNames = new Map((plans.data ?? []).map((r) => [r.id, r.nombre]));
      return (interests.data ?? []).map((row) => ({ id: row.id, contactSuffix: row.contact_id.slice(-4),
        category: names.get(row.categoria_id) ?? 'Servicio', plan: row.plan_id ? planNames.get(row.plan_id) ?? '' : '',
        consent: row.consent_at !== null, paused: row.paused_at !== null, state: row.estado, createdAt: row.created_at }));
    },
  };
}
