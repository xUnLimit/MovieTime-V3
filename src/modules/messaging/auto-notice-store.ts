import { createServiceRoleClient } from '@/platform/server/supabase-server';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
export type AutoNoticeConfig = { enabled: boolean; sendHour: number; dailyCap: number };
export type AutoNoticeCounts = { sent: number; failed: number; skipped: number; already_sent: number };
export type AutoNoticeRunDetails = {
  reasons: Record<string, number>;
  templateSyncFailed: boolean;
  omitted: { reason: string; venta_ids: string[]; wa_id_suffix: string | null }[];
};

export type AutoNoticeStore = {
  config(): Promise<AutoNoticeConfig>;
  claim(date: string): Promise<string | null>;
  ventaIdsDue(date: string): Promise<string[]>;
  acceptedWaIds(since: string): Promise<Set<string>>;
  finish(id: string, status: 'done' | 'failed', counts: AutoNoticeCounts,
    details: AutoNoticeRunDetails): Promise<void>;
};

function check(error: { code?: string } | null, action: string): void {
  if (error) throw new Error(`Auto notice ${action} failed: ${error.code ?? 'unknown'}`);
}

export function createAutoNoticeStore(client: ServiceClient = createServiceRoleClient()): AutoNoticeStore {
  return {
    async config() {
      const { data, error } = await client.from('config')
        .select('whatsapp_auto_enabled,whatsapp_auto_daily_cap,hora_envio').eq('id', 'global').single();
      check(error, 'config lookup');
      if (!data) throw new Error('Auto notice config is missing');
      return { enabled: data.whatsapp_auto_enabled, dailyCap: data.whatsapp_auto_daily_cap, sendHour: data.hora_envio };
    },
    async claim(date) {
      const { data, error } = await client.from('auto_notice_runs')
        .upsert({ run_date: date }, { onConflict: 'run_date', ignoreDuplicates: true })
        .select('id').maybeSingle();
      check(error, 'claim');
      return data?.id ?? null;
    },
    async ventaIdsDue(date) {
      const ids: string[] = [];
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from('v_ventas_full').select('id')
          .eq('ultima_fecha_fin', date).eq('estado', 'activo').order('id').range(from, from + 499);
        check(error, 'due sales lookup');
        ids.push(...(data ?? []).flatMap((row) => row.id ? [row.id] : []));
        if (!data || data.length < 500) return ids;
      }
    },
    async acceptedWaIds(since) {
      const ids = new Set<string>();
      for (let from = 0; ; from += 500) {
        const { data, error } = await client.from('whatsapp_notices').select('wa_id')
          .in('origin', ['auto', 'manual']).eq('status', 'accepted')
          .gte('created_at', since).order('created_at', { ascending: false })
          .order('id', { ascending: true }).range(from, from + 499);
        check(error, 'accepted recipient lookup');
        for (const row of data ?? []) ids.add(row.wa_id);
        if (!data || data.length < 500) return ids;
      }
    },
    async finish(id, status, counts, details) {
      const { error } = await client.from('auto_notice_runs').update({
        ...counts, status, details, finished_at: new Date().toISOString(),
      }).eq('id', id).eq('status', 'running');
      check(error, 'finish');
    },
  };
}
