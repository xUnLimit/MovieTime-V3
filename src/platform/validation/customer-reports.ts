import { z } from './zod';

const reportStatusSchema = z.enum(['open', 'in_progress', 'resolved']);
const customerReportSchema = z.object({
  id: z.string().uuid(), wa_id: z.string().regex(/^\d{5,20}$/), source_message_id: z.string().min(1).max(256),
  description: z.string().min(1).max(65536), status: reportStatusSchema,
  version: z.number().int().nonnegative(), created_at: z.string().datetime({ offset: true }), updated_at: z.string().datetime({ offset: true }),
});
export const reportQuerySchema = z.object({
  status: reportStatusSchema.optional(), page: z.coerce.number().int().min(1).max(100000).default(1),
}).strict();
export const reportUpdateSchema = z.object({ id: z.string().uuid(), status: reportStatusSchema, version: z.number().int().nonnegative() }).strict();
export const reportPageSchema = z.object({ reports: z.array(customerReportSchema).max(50), total: z.number().int().nonnegative() });
export type CustomerReport = z.infer<typeof customerReportSchema>;
export type ReportUpdate = z.infer<typeof reportUpdateSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
