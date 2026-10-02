import { z } from '@/platform/validation/zod';

const isProduction = process.env.NODE_ENV === 'production';

// Durante `next build` no deben exigirse variables de runtime: el build no se
// conecta a Supabase ni envia push, solo compila. Validar estricto aqui rompia
// el build en CI y en Vercel Preview cuando faltaba alguna var. La validacion
// estricta se mantiene en runtime real (servidor levantado), donde si importa.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

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
  // WhatsApp Cloud API: opcionales hasta activar la integracion; el webhook
  // rechaza solicitudes mientras falten.
  WHATSAPP_VERIFY_TOKEN: z.string().trim().min(16).optional(),
  WHATSAPP_APP_SECRET: z.string().trim().min(16).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().trim().min(20).optional(),
  WHATSAPP_WABA_ID: z.string().trim().regex(/^\d{1,32}$/).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().trim().regex(/^\d{1,32}$/).optional(),
  YAPPY_IMAP_USER: z.email().optional(),
  YAPPY_IMAP_PASSWORD: z.string().min(1).optional(),
  NETFLIX_IMAP_USER: z.email().optional(),
  NETFLIX_IMAP_PASSWORD: z.string().min(1).optional(),
  YAPPY_SYNC_SECRET: z.string().trim().min(16).optional(),
  WHATSAPP_AUTO_NOTICES_SECRET: z.string().trim().min(16).optional(),
  WHATSAPP_BOT_ENABLED: z.enum(['true', 'false']).optional(),
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

    // En fase de build no abortamos: solo advertimos. El build no necesita
    // credenciales de runtime; la validacion estricta corre cuando el server arranca.
    if (isBuildPhase) {
      console.warn(`[env] Skipping strict ${label} validation during build: ${details}`);
      return (values ?? {}) as z.infer<T>;
    }

    throw new Error(`Invalid ${label} environment: ${details}`);
  }
  return result.data;
}

const publicEnvValues = {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ENABLE_SW_DEV: process.env.NEXT_PUBLIC_ENABLE_SW_DEV,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const publicEnv = parseEnv(publicEnvSchema, publicEnvValues, 'public');
const serverEnv = typeof window === 'undefined'
  ? parseEnv(serverEnvSchema, process.env, 'server')
  : {};

export function validateEnvironment() {
  parseEnv(publicEnvSchema, publicEnvValues, 'public');
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
  whatsappVerifyToken: 'WHATSAPP_VERIFY_TOKEN' in serverEnv && typeof serverEnv.WHATSAPP_VERIFY_TOKEN === 'string'
    ? serverEnv.WHATSAPP_VERIFY_TOKEN
    : '',
  whatsappAppSecret: 'WHATSAPP_APP_SECRET' in serverEnv && typeof serverEnv.WHATSAPP_APP_SECRET === 'string'
    ? serverEnv.WHATSAPP_APP_SECRET
    : '',
  whatsappAccessToken: 'WHATSAPP_ACCESS_TOKEN' in serverEnv && typeof serverEnv.WHATSAPP_ACCESS_TOKEN === 'string'
    ? serverEnv.WHATSAPP_ACCESS_TOKEN
    : '',
  whatsappWabaId: 'WHATSAPP_WABA_ID' in serverEnv && typeof serverEnv.WHATSAPP_WABA_ID === 'string'
    ? serverEnv.WHATSAPP_WABA_ID
    : '',
  yappyImapUser: 'YAPPY_IMAP_USER' in serverEnv && typeof serverEnv.YAPPY_IMAP_USER === 'string' ? serverEnv.YAPPY_IMAP_USER : '',
  yappyImapPassword: 'YAPPY_IMAP_PASSWORD' in serverEnv && typeof serverEnv.YAPPY_IMAP_PASSWORD === 'string' ? serverEnv.YAPPY_IMAP_PASSWORD : '',
  netflixImapUser: 'NETFLIX_IMAP_USER' in serverEnv && typeof serverEnv.NETFLIX_IMAP_USER === 'string' ? serverEnv.NETFLIX_IMAP_USER : '',
  netflixImapPassword: 'NETFLIX_IMAP_PASSWORD' in serverEnv && typeof serverEnv.NETFLIX_IMAP_PASSWORD === 'string' ? serverEnv.NETFLIX_IMAP_PASSWORD : '',
  yappySyncSecret: 'YAPPY_SYNC_SECRET' in serverEnv && typeof serverEnv.YAPPY_SYNC_SECRET === 'string' ? serverEnv.YAPPY_SYNC_SECRET : '',
  whatsappAutoNoticesSecret: 'WHATSAPP_AUTO_NOTICES_SECRET' in serverEnv
    && typeof serverEnv.WHATSAPP_AUTO_NOTICES_SECRET === 'string' ? serverEnv.WHATSAPP_AUTO_NOTICES_SECRET : '',
  // El bot de menus responde mensajes libres; nace apagado hasta activarlo a proposito.
  whatsappBotEnabled: 'WHATSAPP_BOT_ENABLED' in serverEnv && serverEnv.WHATSAPP_BOT_ENABLED === 'true',
  // Identificador publico del numero +507 6533-1751 en la Cloud API (no es un
  // secreto); la variable de entorno permite cambiar de numero sin desplegar.
  whatsappPhoneNumberId: 'WHATSAPP_PHONE_NUMBER_ID' in serverEnv && typeof serverEnv.WHATSAPP_PHONE_NUMBER_ID === 'string'
    ? serverEnv.WHATSAPP_PHONE_NUMBER_ID
    : '1324513647414207',

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction,
  isTest: process.env.NODE_ENV === 'test',
} as const;
