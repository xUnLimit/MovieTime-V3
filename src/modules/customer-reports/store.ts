import { createServiceRoleClient, createUserRequestClient } from '@/platform/server/supabase-server';
import { assertUuid } from '@/platform/utils/safety';
import { reportPageSchema, reportUpdateSchema, type ReportQuery, type ReportUpdate } from '@/platform/validation/customer-reports';

export function createCustomerReportsStore(client = createServiceRoleClient()) {
  return {
    async create(input: { waId: string; messageId: string; description: string; token: string; fence: number }) {
      const { data, error } = await client.rpc('create_customer_report', {
        p_wa_id: input.waId, p_message_id: input.messageId, p_description: input.description,
        p_token: input.token, p_fence: input.fence,
      });
      if (error) throw new Error('Report creation failed');
      assertUuid(data, 'Reporte');
    },
    async list(input: ReportQuery) {
      let query = client.from('customer_reports').select('id,wa_id,source_message_id,description,status,version,created_at,updated_at', { count: 'exact' });
      if (input.status) query = query.eq('status', input.status);
      const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range((input.page - 1) * 10, input.page * 10 - 1);
      if (error) throw new Error('Reports lookup failed');
      return reportPageSchema.parse({ reports: data ?? [], total: count ?? 0 });
    },
  };
}

export async function updateCustomerReport(authorization: string, input: ReportUpdate) {
  const parsed = reportUpdateSchema.parse(input);
  assertUuid(parsed.id, 'Reporte');
  const { data, error } = await createUserRequestClient(authorization).rpc('update_customer_report', {
    p_id: parsed.id, p_status: parsed.status, p_version: parsed.version,
  });
  if (error) throw new Error('Report update failed');
  return data === true;
}
