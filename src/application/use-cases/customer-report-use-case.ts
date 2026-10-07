import { createCustomerReportsStore } from '@/modules/customer-reports/store';
import { z } from '@/platform/validation/zod';

const reportInput = z.object({
  waId: z.string().regex(/^\d{5,20}$/), messageId: z.string().min(1).max(256),
  description: z.string().trim().min(1).max(65536), token: z.string().uuid(), fence: z.number().int().nonnegative(),
});

/** Only an explicit journey action creates a problem report. Message identity deduplicates retries in SQL. */
export async function createCustomerReportUseCase(input: z.infer<typeof reportInput>, store = createCustomerReportsStore()) {
  await store.create(reportInput.parse(input));
}
