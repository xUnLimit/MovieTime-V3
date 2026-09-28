import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

const GRAPH_VERSION = 'v23.0';
const TIMEOUT_MS = 10_000;
const MAX_PAGES = 100;

const componentSchema = z.object({
  type: z.string(),
  format: z.string().optional(),
  text: z.string().optional(),
  buttons: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
});
const graphPageSchema = z.object({
  data: z.array(z.object({
    id: z.string(), name: z.string(), language: z.string(), status: z.string(),
    category: z.string(), components: z.array(componentSchema),
  })),
  paging: z.object({ next: z.url().optional() }).optional(),
});

export type MetaTemplate = {
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  header: string | null;
  footer: string | null;
  buttons: { type: string; text: string }[];
  param_count: number;
  meta_template_id: string;
};

export type MetaTemplateStore = {
  replaceSnapshot(templates: MetaTemplate[], syncedAt: string): Promise<void>;
};

function normalize(templates: z.infer<typeof graphPageSchema>['data']): MetaTemplate[] {
  return templates.map((template) => {
    const body = template.components.find((component) => component.type === 'BODY')?.text ?? '';
    const variables = new Set(Array.from(body.matchAll(/\{\{(\d+)\}\}/g), (match) => match[1]));
    return {
      name: template.name,
      language: template.language,
      status: template.status,
      category: template.category,
      body,
      header: template.components.find((component) => component.type === 'HEADER' && component.format === 'TEXT')?.text ?? null,
      footer: template.components.find((component) => component.type === 'FOOTER')?.text ?? null,
      buttons: template.components.filter((component) => component.type === 'BUTTONS')
        .flatMap((component) => component.buttons ?? [])
        .filter((button) => button.type === 'QUICK_REPLY' && button.text !== undefined)
        .map((button) => ({ type: button.type, text: button.text ?? '' })),
      param_count: variables.size,
      meta_template_id: template.id,
    };
  });
}

export async function fetchMetaTemplates(
  wabaId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<MetaTemplate[]> {
  const path = `/${GRAPH_VERSION}/${encodeURIComponent(wabaId)}/message_templates`;
  let url: string | undefined = `https://graph.facebook.com${path}?fields=name,language,status,category,components,id&limit=100`;
  const seen = new Set<string>();
  const records: MetaTemplate[] = [];
  while (url) {
    if (seen.has(url) || seen.size >= MAX_PAGES) throw new Error('WhatsApp template pagination is invalid.');
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'https://graph.facebook.com' || parsedUrl.pathname !== path
      || parsedUrl.username || parsedUrl.password) {
      throw new Error('WhatsApp template pagination URL is invalid.');
    }
    seen.add(url);
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new Error('WhatsApp template fetch failed.');
    }
    if (!response.ok) throw new Error(`WhatsApp template fetch failed: HTTP ${response.status}`);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('WhatsApp template response is invalid.');
    }
    const page = graphPageSchema.parse(payload);
    records.push(...normalize(page.data));
    url = page.paging?.next;
  }
  return records;
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export function createMetaTemplateStore(client: ServiceClient = createServiceRoleClient()): MetaTemplateStore {
  return {
    async replaceSnapshot(templates, syncedAt) {
      if (templates.length > 0) {
        const { error } = await client.from('whatsapp_meta_templates').upsert(
          templates.map((template) => ({ ...template, retired: false, synced_at: syncedAt })),
          { onConflict: 'name,language' }
        );
        if (error) throw new Error(`WhatsApp template cache update failed: ${error.code ?? 'unknown'}`);
      }
      const { error } = await client.from('whatsapp_meta_templates')
        .update({ retired: true }).lt('synced_at', syncedAt).eq('retired', false);
      if (error) throw new Error(`WhatsApp template retirement failed: ${error.code ?? 'unknown'}`);
    },
  };
}

export async function syncMetaTemplates(
  wabaId: string,
  accessToken: string,
  store: MetaTemplateStore,
  fetchImpl: typeof fetch = fetch
): Promise<number> {
  const templates = await fetchMetaTemplates(wabaId, accessToken, fetchImpl);
  await store.replaceSnapshot(templates, new Date().toISOString());
  return templates.length;
}
