import {
  diffDefinitions, hasBlockingIssues, parseDefinition, validateDefinition,
} from '@/modules/bot-config';
import { logAsyncSideEffectError } from '@/platform/utils/safety';
import { getCurrentSession } from '@/platform/supabase/auth';
import { fetchBotConfigHealth, requestBotMailboxCheck } from '@/platform/supabase/bot-api-client';
import {
  getBotMetrics, getBotStatus, getBotVersion, listBotEvents, listBotVersions, publishBotVersion, setBotEnabled,
} from '@/platform/supabase/bot-config-repository';
import type { ActivityLog } from '@/types';
import type {
  BotDefinition, BotEventFilters, BotEventPage, BotHealth, BotMailboxCheck, BotStatus, BotVersionSummary,
} from '@/types/bot';

const BOT_NOTE_MAX_LENGTH = 200;

type RecordActivityLog = (log: Omit<ActivityLog, 'id' | 'timestamp'>) => Promise<void>;
type LogContext = Pick<ActivityLog, 'usuarioId' | 'usuarioEmail'>;
/** La identidad y el registro llegan inyectados desde el composition root; el caso de uso no lee stores. */
export type BotAdminContext = { logContext: LogContext; recordActivityLog: RecordActivityLog };

/** Error con un mensaje apto para mostrar al administrador. */
export class BotAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BotAdminError';
  }
}

export type BotAdminSnapshot = {
  status: BotStatus;
  /** null si no hay version publicada o ya no valida con el esquema. */
  published: BotDefinition | null;
  versions: BotVersionSummary[];
};

const MAX_LOGGED_CHANGES = 20;

// Un fallo al registrar la auditoria no debe deshacer un cambio ya aplicado en la base de datos.
async function audit(context: BotAdminContext, entry: {
  detalles: string; metadata: Record<string, unknown>; entidadNombre?: string;
}): Promise<void> {
  try {
    await context.recordActivityLog({
      ...context.logContext,
      accion: 'actualizacion',
      entidad: 'bot',
      entidadId: 'global',
      entidadNombre: entry.entidadNombre ?? 'Bot de WhatsApp',
      detalles: entry.detalles,
      metadata: entry.metadata,
    });
  } catch (error) {
    logAsyncSideEffectError(error, { operation: 'bot-admin-audit', entity: 'bot', entityId: 'global' });
  }
}

function readDefinition(raw: unknown, what: string): BotDefinition {
  const parsed = parseDefinition(raw);
  if (!parsed.success) throw new BotAdminError(`${what} no es valida y no se puede usar.`);
  return parsed.definition;
}

export async function loadBotAdminSnapshot(): Promise<BotAdminSnapshot> {
  const status = await getBotStatus();
  const [versions, record] = await Promise.all([
    listBotVersions(status.publishedVersion),
    status.publishedVersion === null ? Promise.resolve(null) : getBotVersion(status.publishedVersion),
  ]);
  const parsed = record ? parseDefinition(record.definition) : null;
  return { status, published: parsed?.success ? parsed.definition : null, versions };
}

export async function publishBotUseCase(
  definition: BotDefinition,
  note: string,
  context: BotAdminContext,
  previous: BotDefinition | null = null,
): Promise<number> {
  const cleanNote = note.trim();
  if (!cleanNote) throw new BotAdminError('Escribe una nota que describa el cambio.');
  if (cleanNote.length > BOT_NOTE_MAX_LENGTH) {
    throw new BotAdminError(`La nota admite como maximo ${BOT_NOTE_MAX_LENGTH} caracteres.`);
  }
  const parsed = parseDefinition(definition);
  if (!parsed.success) throw new BotAdminError('La definicion del bot no es valida.');
  const issues = validateDefinition(parsed.definition);
  if (hasBlockingIssues(issues)) {
    const count = issues.filter((issue) => issue.severity === 'error').length;
    throw new BotAdminError(`Corrige ${count === 1 ? 'el error' : `los ${count} errores`} antes de publicar.`);
  }

  const version = await publishBotVersion(parsed.definition, cleanNote);
  const changes = previous ? diffDefinitions(previous, parsed.definition).slice(0, MAX_LOGGED_CHANGES) : [];
  await audit(context, {
    detalles: `Version ${version} del bot publicada: "${cleanNote}"`,
    metadata: { operacion: 'publicar', version, nota: cleanNote, cambios: changes },
  });
  return version;
}

/** Carga una version anterior para dejarla como borrador; publicarla es una accion aparte. */
export async function restoreBotVersionUseCase(version: number, context: BotAdminContext): Promise<BotDefinition> {
  const record = await getBotVersion(version);
  if (!record) throw new BotAdminError(`La version ${version} no existe.`);
  const definition = readDefinition(record.definition, `La version ${version}`);
  await audit(context, {
    detalles: `Version ${version} del bot cargada en el borrador`,
    metadata: { operacion: 'restaurar', version },
  });
  return definition;
}

export async function setBotEnabledUseCase(enabled: boolean, context: BotAdminContext): Promise<boolean> {
  const result = await setBotEnabled(enabled);
  await audit(context, {
    detalles: result ? 'Bot de WhatsApp encendido' : 'Bot de WhatsApp apagado',
    metadata: { operacion: 'interruptor', enabled: result },
  });
  return result;
}

export function listBotEventsUseCase(page: number, filters: BotEventFilters): Promise<BotEventPage> {
  return listBotEvents(page, filters);
}

async function requireAccessToken(): Promise<string> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new BotAdminError('La sesion expiro. Inicia sesion de nuevo.');
  return session.access_token;
}

/** Une la configuracion del servidor con las metricas de 24 h leidas con la sesion del administrador. */
export async function loadBotHealthUseCase(): Promise<BotHealth> {
  const token = await requireAccessToken();
  const [server, metrics] = await Promise.all([fetchBotConfigHealth(token), getBotMetrics()]);
  return { ...server, ...metrics };
}

export async function testBotMailboxUseCase(): Promise<BotMailboxCheck> {
  return requestBotMailboxCheck(await requireAccessToken());
}
