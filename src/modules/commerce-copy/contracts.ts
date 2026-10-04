import { z } from '@/platform/validation/zod';
import { COPY_KEYS } from './catalog';
import { copyProblem } from './render';

// `text: null` restaura el original.
export const copyCommandSchema = z.object({
  key: z.enum(COPY_KEYS),
  text: z.string().max(1000).nullable(),
}).strict().superRefine((value, context) => {
  const problem = value.text === null ? null : copyProblem(value.key, value.text);
  if (problem) context.addIssue({ code: 'custom', path: ['text'], message: problem });
});
export type CopyCommand = z.infer<typeof copyCommandSchema>;
