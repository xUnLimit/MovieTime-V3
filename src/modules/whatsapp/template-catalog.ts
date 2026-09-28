import { createServiceRoleClient } from '@/platform/server/supabase-server';
import { z } from '@/platform/validation/zod';

export const WHATSAPP_TEMPLATE_LANGUAGE = 'es';

export type ApprovedTemplate = {
  paramCount: number;
  buttons: { type: string; text: string }[];
};

export type TemplateCatalog = {
  getApproved(name: string, language: string): Promise<ApprovedTemplate | null>;
};

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
const cachedButtonsSchema = z.array(z.object({ type: z.string(), text: z.string() }));

export function createTemplateCatalog(client: ServiceClient = createServiceRoleClient()): TemplateCatalog {
  return {
    async getApproved(name, language) {
      const { data, error } = await client.from('whatsapp_meta_templates')
        .select('param_count,buttons')
        .eq('name', name)
        .eq('language', language)
        .eq('status', 'APPROVED')
        .eq('retired', false)
        .maybeSingle();
      if (error) throw new Error(`WhatsApp template catalog lookup failed: ${error.code ?? 'unknown'}`);
      if (!data) return null;
      return { paramCount: data.param_count, buttons: cachedButtonsSchema.parse(data.buttons) };
    },
  };
}
