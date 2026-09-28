import { groupNoticeVentas, isNoticeEligible, normalizePanamaWaId } from '@/modules/messaging/message-data';
import type { AutoNoticeCounts, AutoNoticeRunDetails, AutoNoticeStore } from '@/modules/messaging/auto-notice-store';
import type { NoticeStore } from '@/modules/messaging/notice-store';
import type { SendNoticeDeps } from './send-notice-use-case';
import { sendNotice } from './send-notice-use-case';
import { createLogger } from '@/platform/observability/logger';

const log = createLogger('AutoNotices');
const clock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});

export type AutoNoticesDeps = {
  runs: AutoNoticeStore;
  notices: SendNoticeDeps;
  syncTemplates: () => Promise<unknown>;
  notifyAdmins: (body: string) => Promise<void>;
  now: () => Date;
};

export function panamaDateHour(now: Date): { date: string; hour: number } {
  const parts = clock.formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}

async function loadDueGroups(ids: string[], notices: NoticeStore, date: string) {
  const ventas = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    ventas.push(...await notices.loadVentas(ids.slice(offset, offset + 200)));
  }
  const today = new Date(`${date}T12:00:00`);
  return groupNoticeVentas(ventas.filter((venta) =>
    venta.fechaVencimiento !== null
    && `${venta.fechaVencimiento.getFullYear()}-${String(venta.fechaVencimiento.getMonth() + 1).padStart(2, '0')}-${String(venta.fechaVencimiento.getDate()).padStart(2, '0')}` === date
    && isNoticeEligible(venta, today)));
}

export async function runAutoNotices(deps: AutoNoticesDeps): Promise<
  { skipped: 'not_scheduled' | 'already_ran' } | ({ status: 'done' | 'failed' } & AutoNoticeCounts)
> {
  const now = deps.now();
  const { date, hour } = panamaDateHour(now);
  const config = await deps.runs.config();
  if (!config.enabled || hour !== config.sendHour) return { skipped: 'not_scheduled' };
  const runId = await deps.runs.claim(date);
  if (!runId) return { skipped: 'already_ran' };

  const counts: AutoNoticeCounts = { sent: 0, failed: 0, skipped: 0, already_sent: 0 };
  const reasons: Record<string, number> = {};
  const omitted: AutoNoticeRunDetails['omitted'] = [];
  let templateSyncFailed = false;
  let status: 'done' | 'failed' = 'done';
  try {
    try { await deps.syncTemplates(); }
    catch (error) {
      templateSyncFailed = true;
      log.warn('Meta template sync failed; using cached templates', { error });
    }
    const ids = await deps.runs.ventaIdsDue(date);
    const groups = await loadDueGroups(ids, deps.notices.store, date);
    const accepted = await deps.runs.acceptedWaIds(new Date(now.getTime() - 86_400_000).toISOString());
    for (let index = 0; index < groups.length;) {
      if (accepted.size >= config.dailyCap) {
        for (const group of groups.slice(index)) {
          counts.skipped += 1;
          reasons.limite_diario = (reasons.limite_diario ?? 0) + 1;
          omitted.push({ reason: 'limite_diario', venta_ids: group.ventas.map((venta) => venta.ventaId),
            wa_id_suffix: normalizePanamaWaId(group.telefono)?.slice(-4) ?? null });
        }
        break;
      }
      const batch = groups.slice(index, index + Math.min(5, config.dailyCap - accepted.size));
      index += batch.length;
      const outcomes = await Promise.all(batch.map(async (group) => {
        try {
          const result = await sendNotice({
            tipo: 'dia_pago', ventaIds: group.ventas.map((venta) => venta.ventaId),
            origin: 'auto', sentBy: null, now,
          }, deps.notices);
          return { group, result, error: null };
        } catch (error) {
          return { group, result: [], error };
        }
      }));
      for (const { group, result, error } of outcomes) {
        if (error) {
          counts.failed += 1;
          reasons.error_envio = (reasons.error_envio ?? 0) + 1;
          log.warn('Auto notice group failed', { error });
          continue;
        }
        for (const item of result) {
          if (item.status === 'accepted') {
            counts.sent += 1;
            const waId = normalizePanamaWaId(group.telefono);
            if (waId) accepted.add(waId);
          } else if (item.status === 'already_sent') counts.already_sent += 1;
          else if (item.status === 'skipped' || item.status === 'wa_me') {
            counts.skipped += 1;
            const reason = item.error ?? 'plantilla_no_aprobada';
            reasons[reason] = (reasons[reason] ?? 0) + 1;
            omitted.push({ reason, venta_ids: item.ventaIds, wa_id_suffix: item.waId?.slice(-4) ?? null });
          } else {
            counts.failed += 1;
            const reason = item.error ?? 'envio_fallido';
            reasons[reason] = (reasons[reason] ?? 0) + 1;
          }
        }
      }
    }
  } catch (error) {
    status = 'failed';
    counts.failed += 1;
    reasons.error_corrida = (reasons.error_corrida ?? 0) + 1;
    log.error('Auto notice run failed', { error });
  }
  await deps.runs.finish(runId, status, counts, { reasons, templateSyncFailed, omitted });
  if (counts.failed + counts.skipped > 0) {
    try {
      await deps.notifyAdmins(`Avisos automáticos: ${counts.sent} enviados, ${counts.failed} fallidos, ${counts.skipped} omitidos — revisa /notificaciones`);
    } catch (error) {
      log.warn('Auto notice summary push failed', { error });
    }
  }
  return { status, ...counts };
}
