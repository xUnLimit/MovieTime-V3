import { z } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_APP_URL: isProduction
    ? z.string().url()
    : z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_SW_DEV: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: isProduction
    ? z.string().trim().min(20)
    : z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: isProduction
    ? z.string().url()
    : z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: isProduction
    ? z.string().trim().min(20)
    : z.string().optional(),
});

const serverEnvSchema = z.object({
  PUSH_CRON_SECRET: isProduction
    ? z.string().trim().min(16).optional()
    : z.string().optional(),
  CRON_SECRET: z.string().optional(),
  VAPID_PRIVATE_KEY: isProduction
    ? z.string().trim().min(20)
    : z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: isProduction
    ? z.string().trim().min(20)
    : z.string().optional(),
}).superRefine((value, ctx) => {
  if (!isProduction) return;
  const cronSecret = value.PUSH_CRON_SECRET || value.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length < 16) {
    ctx.addIssue({
      code: 'custom',
      path: ['PUSH_CRON_SECRET'],
      message: 'PUSH_CRON_SECRET or CRON_SECRET is required in production.',
    });
  }
});

function parseEnv<T extends z.ZodTypeAny>(schema: T, values: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(values);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid ${label} environment: ${details}`);
  }
  return result.data;
}

const publicEnv = parseEnv(publicEnvSchema, process.env, 'public');
const serverEnv = typeof window === 'undefined'
  ? parseEnv(serverEnvSchema, process.env, 'server')
  : {};

export function validateEnvironment() {
  parseEnv(publicEnvSchema, process.env, 'public');
  if (typeof window === 'undefined') {
    parseEnv(serverEnvSchema, process.env, 'server');
  }
}

export const env = {
  // Application
  appName: publicEnv.NEXT_PUBLIC_APP_NAME || 'MovieTime PTY',
  appUrl: publicEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // Features
  enableDevServiceWorker: publicEnv.NEXT_PUBLIC_ENABLE_SW_DEV === 'true',
  vapidPublicKey: publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  vapidSubject: 'VAPID_SUBJECT' in serverEnv && typeof serverEnv.VAPID_SUBJECT === 'string'
    ? serverEnv.VAPID_SUBJECT
    : 'mailto:admin@example.com',
  pushCronSecret: 'PUSH_CRON_SECRET' in serverEnv && typeof serverEnv.PUSH_CRON_SECRET === 'string'
    ? serverEnv.PUSH_CRON_SECRET
    : 'CRON_SECRET' in serverEnv && typeof serverEnv.CRON_SECRET === 'string'
      ? serverEnv.CRON_SECRET
      : '',

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
} as const;

// Type-safe environment variable access
export type Env = typeof env;
