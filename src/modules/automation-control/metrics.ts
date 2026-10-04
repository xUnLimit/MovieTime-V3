import { z } from '@/platform/validation/zod';
export const automationMetricsSchema = z.object({
  pendingMessages: z.number().int().nonnegative(), reviewMessages: z.number().int().nonnegative(),
  oldestPendingAt: z.string().nullable(), retryAttempts: z.number().int().nonnegative(),
  averageResolutionSeconds: z.number().nonnegative(), pendingDeliveries: z.number().int().nonnegative(),
  reviewDeliveries: z.number().int().nonnegative(), ordersToday: z.number().int().nonnegative(),
  completedToday: z.number().int().nonnegative(), aiCallsToday: z.number().int().nonnegative(),
  aiReservedTokensToday: z.number().int().nonnegative(),
  pendingInterests: z.number().int().nonnegative().optional(), reviewInterests: z.number().int().nonnegative().optional(),
}).strict();
