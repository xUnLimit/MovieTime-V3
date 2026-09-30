import type { MetaTemplateButton, MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { postSyncMetaTemplates } from '@/platform/api/whatsapp-templates-client';
import { getCurrentSession } from '@/platform/supabase/auth';
import { listMetaTemplateRows, type MetaTemplateRow } from '@/platform/supabase/whatsapp-meta-templates-repository';

function parseButtons(value: MetaTemplateRow['buttons']): MetaTemplateButton[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const { type, text } = item;
    return typeof type === 'string' && typeof text === 'string' ? [{ type, text }] : [];
  });
}

function toMetaTemplateInfo(row: MetaTemplateRow): MetaTemplateInfo {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    status: row.status,
    category: row.category,
    body: row.body,
    header: row.header,
    footer: row.footer,
    buttons: parseButtons(row.buttons),
    paramCount: row.param_count,
    retired: row.retired,
    syncedAt: row.synced_at,
  };
}

export async function listMetaTemplatesUseCase(): Promise<MetaTemplateInfo[]> {
  return (await listMetaTemplateRows()).map(toMetaTemplateInfo);
}

export async function syncMetaTemplatesUseCase(): Promise<{ count: number }> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('No hay una sesión activa para sincronizar con Meta.');
  return postSyncMetaTemplates(session.access_token);
}
