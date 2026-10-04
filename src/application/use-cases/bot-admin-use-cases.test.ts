import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getBotStatus: vi.fn(), getBotVersion: vi.fn(), listBotVersions: vi.fn(), publishBotVersion: vi.fn(),
  setBotEnabled: vi.fn(), listBotEvents: vi.fn(), getBotMetrics: vi.fn(),
  fetchBotConfigHealth: vi.fn(), requestBotMailboxCheck: vi.fn(), getCurrentSession: vi.fn(),
}));
vi.mock('@/platform/supabase/bot-config-repository', () => ({
  getBotStatus: mocks.getBotStatus, getBotVersion: mocks.getBotVersion, listBotVersions: mocks.listBotVersions,
  publishBotVersion: mocks.publishBotVersion, setBotEnabled: mocks.setBotEnabled, listBotEvents: mocks.listBotEvents,
  getBotMetrics: mocks.getBotMetrics,
}));
vi.mock('@/platform/supabase/bot-api-client', () => ({
  fetchBotConfigHealth: mocks.fetchBotConfigHealth, requestBotMailboxCheck: mocks.requestBotMailboxCheck,
}));
vi.mock('@/platform/supabase/auth', () => ({ getCurrentSession: mocks.getCurrentSession }));

import { addConditionNode, addNode, addOption, addPurchaseFlow, defaultDefinition, setMessage, updateOption } from '@/modules/bot-config';
import {
  BotAdminError, loadBotAdminSnapshot, loadBotHealthUseCase, listBotEventsUseCase, publishBotUseCase,
  compareBotVersionsUseCase, restoreBotVersionUseCase, setBotEnabledUseCase, testBotMailboxUseCase,
} from './bot-admin-use-cases';

const record = vi.fn();
const context = () => ({ logContext: { usuarioId: 'u1', usuarioEmail: 'admin@example.test' }, recordActivityLog: record });

beforeEach(() => {
  vi.clearAllMocks();
  record.mockResolvedValue(undefined);
});

describe('loadBotAdminSnapshot', () => {
  it('loads status, versions and the parsed published definition', async () => {
    mocks.getBotStatus.mockResolvedValue({ enabled: true, publishedVersion: 1, updatedAt: 't' });
    mocks.listBotVersions.mockResolvedValue([{ version: 1 }]);
    mocks.getBotVersion.mockResolvedValue({ version: 1, definition: defaultDefinition() });
    const snapshot = await loadBotAdminSnapshot();
    expect(snapshot.published).toEqual(defaultDefinition());
    expect(snapshot.versions).toEqual([{ version: 1 }]);
    expect(mocks.listBotVersions).toHaveBeenCalledWith(1);
  });

  it('returns no published definition when nothing is published or it no longer validates', async () => {
    mocks.getBotStatus.mockResolvedValue({ enabled: false, publishedVersion: null, updatedAt: null });
    mocks.listBotVersions.mockResolvedValue([]);
    await expect(loadBotAdminSnapshot()).resolves.toMatchObject({ published: null });
    expect(mocks.getBotVersion).not.toHaveBeenCalled();

    mocks.getBotStatus.mockResolvedValue({ enabled: true, publishedVersion: 2, updatedAt: 't' });
    mocks.getBotVersion.mockResolvedValue({ version: 2, definition: { broken: true } });
    await expect(loadBotAdminSnapshot()).resolves.toMatchObject({ published: null });
    mocks.getBotVersion.mockResolvedValue(null);
    await expect(loadBotAdminSnapshot()).resolves.toMatchObject({ published: null });
  });
});

describe('publishBotUseCase', () => {
  it('publishes a valid definition, trims the note and records the change in the activity log', async () => {
    mocks.publishBotVersion.mockResolvedValue(5);
    const previous = defaultDefinition();
    const next = setMessage(previous, 'handoff_ack', 'Te pasamos con una persona del equipo.');
    await expect(publishBotUseCase(next, '  Nuevo texto  ', context(), previous)).resolves.toBe(5);
    expect(mocks.publishBotVersion).toHaveBeenCalledWith(next, 'Nuevo texto');
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: 'u1', accion: 'actualizacion', entidad: 'bot', entidadId: 'global',
      detalles: 'Version 5 del bot publicada: "Nuevo texto"',
      metadata: { operacion: 'publicar', version: 5, nota: 'Nuevo texto', cambios: ['Mensaje «Pase a una persona» modificado'] },
    }));
  });

  it('logs no changes when there is no previous definition', async () => {
    mocks.publishBotVersion.mockResolvedValue(2);
    await publishBotUseCase(defaultDefinition(), 'Primera', context());
    expect(record.mock.calls[0][0].metadata.cambios).toEqual([]);
  });

  it('requires a note of at most 200 characters before touching the database', async () => {
    await expect(publishBotUseCase(defaultDefinition(), '   ', context())).rejects.toThrow('Escribe una nota');
    await expect(publishBotUseCase(defaultDefinition(), 'x'.repeat(201), context())).rejects.toThrow('200 caracteres');
    expect(mocks.publishBotVersion).not.toHaveBeenCalled();
  });

  it('rejects definitions that fail the schema or have blocking issues', async () => {
    await expect(publishBotUseCase({ schemaVersion: 1 } as never, 'Nota', context())).rejects.toThrow('no es valida');
    const broken = { ...defaultDefinition(), entryNodeId: 'no_existe' };
    await expect(publishBotUseCase(broken, 'Nota', context())).rejects.toBeInstanceOf(BotAdminError);
    await expect(publishBotUseCase(broken, 'Nota', context())).rejects.toThrow(/Corrige (el error|los \d+ errores) antes de publicar/);
    expect(mocks.publishBotVersion).not.toHaveBeenCalled();
  });

  it('only publishes purchase blocks when the server flag is on', async () => {
    mocks.publishBotVersion.mockResolvedValue(6);
    let flow = addOption(addPurchaseFlow(defaultDefinition()), 'menu');
    flow = updateOption(flow, 'menu', flow.nodes[0].options.at(-1)!.id, { title: 'Comprar', next: 'compra_catalogo' });
    await expect(publishBotUseCase(flow, 'Con bloques', context())).rejects.toThrow('Corrige los 4 errores antes de publicar');
    await expect(publishBotUseCase(flow, 'Con bloques', context(), null, false)).rejects.toBeInstanceOf(BotAdminError);
    expect(mocks.publishBotVersion).not.toHaveBeenCalled();
    await expect(publishBotUseCase(flow, 'Con bloques', context(), null, true)).resolves.toBe(6);
    expect(mocks.publishBotVersion).toHaveBeenCalledTimes(1);
  });

  it('pluralizes the blocking error count', async () => {
    const broken = addNode({ ...defaultDefinition(), entryNodeId: 'x' }, 'text', 'Otro');
    broken.messages.login_code_sent = 'sin marcador';
    broken.messages.travel_link_sent = 'sin enlace';
    await expect(publishBotUseCase(broken, 'Nota', context())).rejects.toThrow('los');
  });

  it('keeps the publication when the audit log fails', async () => {
    mocks.publishBotVersion.mockResolvedValue(3);
    record.mockRejectedValue(new Error('log down'));
    await expect(publishBotUseCase(defaultDefinition(), 'Nota', context())).resolves.toBe(3);
  });

  it('propagates repository failures without logging', async () => {
    mocks.publishBotVersion.mockRejectedValue(new Error('No se pudo publicar la version del bot.'));
    await expect(publishBotUseCase(defaultDefinition(), 'Nota', context())).rejects.toThrow('No se pudo publicar');
    expect(record).not.toHaveBeenCalled();
  });
});

describe('publishBotUseCase flow extensions', () => {
  it('refuses conditions without the server flag and publishes them with it', async () => {
    const withCondition = addConditionNode(defaultDefinition(), 'catalog_has_stock');
    const wired = {
      ...withCondition,
      nodes: withCondition.nodes.map((node) => (node.id === 'menu'
        ? { ...node, options: [...node.options, { id: 'cupo', title: 'Hay cupo', next: withCondition.nodes.at(-1)!.id }] } : node)),
    };
    await expect(publishBotUseCase(wired, 'Con condicion', context())).rejects.toThrow('Corrige');
    expect(mocks.publishBotVersion).not.toHaveBeenCalled();
    mocks.publishBotVersion.mockResolvedValue(6);
    await expect(publishBotUseCase(wired, 'Con condicion', context(), null, false, true)).resolves.toBe(6);
  });
});

describe('compareBotVersionsUseCase', () => {
  it('returns the differences between two stored versions without logging or touching the draft', async () => {
    const before = defaultDefinition();
    const after = setMessage(before, 'handoff_ack', 'Te atendemos en breve.');
    mocks.getBotVersion.mockImplementation(async (version: number) => ({ version, definition: version === 1 ? before : after }));
    await expect(compareBotVersionsUseCase(1, 2)).resolves.toEqual(['Mensaje «Pase a una persona» modificado']);
    await expect(compareBotVersionsUseCase(2, 2)).resolves.toEqual([]);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects a missing or invalid version', async () => {
    mocks.getBotVersion.mockImplementation(async (version: number) => (version === 1 ? { version, definition: defaultDefinition() } : null));
    await expect(compareBotVersionsUseCase(1, 9)).rejects.toThrow('La version 9 no existe.');
    await expect(compareBotVersionsUseCase(8, 1)).rejects.toThrow('La version 8 no existe.');
    mocks.getBotVersion.mockResolvedValue({ version: 4, definition: { broken: true } });
    await expect(compareBotVersionsUseCase(4, 5)).rejects.toThrow('no es valida');
  });
});

describe('restoreBotVersionUseCase', () => {
  it('returns the stored definition and logs the restore', async () => {
    mocks.getBotVersion.mockResolvedValue({ version: 2, definition: defaultDefinition() });
    await expect(restoreBotVersionUseCase(2, context())).resolves.toEqual(defaultDefinition());
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      detalles: 'Version 2 del bot cargada en el borrador', metadata: { operacion: 'restaurar', version: 2 },
    }));
  });

  it('rejects unknown or invalid versions without logging', async () => {
    mocks.getBotVersion.mockResolvedValue(null);
    await expect(restoreBotVersionUseCase(9, context())).rejects.toThrow('La version 9 no existe.');
    mocks.getBotVersion.mockResolvedValue({ version: 3, definition: { broken: true } });
    await expect(restoreBotVersionUseCase(3, context())).rejects.toThrow('La version 3 no es valida');
    expect(record).not.toHaveBeenCalled();
  });
});

describe('setBotEnabledUseCase', () => {
  it('switches the bot and logs both directions', async () => {
    mocks.setBotEnabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(setBotEnabledUseCase(true, context())).resolves.toBe(true);
    await expect(setBotEnabledUseCase(false, context())).resolves.toBe(false);
    expect(record.mock.calls[0][0]).toMatchObject({ detalles: 'Bot de WhatsApp encendido', metadata: { operacion: 'interruptor', enabled: true } });
    expect(record.mock.calls[1][0]).toMatchObject({ detalles: 'Bot de WhatsApp apagado', metadata: { operacion: 'interruptor', enabled: false } });
  });
});

describe('events, health and mailbox', () => {
  it('delegates the paginated event list', async () => {
    mocks.listBotEvents.mockResolvedValue({ events: [], total: 0, page: 2, pageSize: 10 });
    await expect(listBotEventsUseCase(2, { type: 'error' })).resolves.toMatchObject({ page: 2 });
    expect(mocks.listBotEvents).toHaveBeenCalledWith(2, { type: 'error' });
  });

  it('merges server configuration with the 24 hour metrics', async () => {
    mocks.getCurrentSession.mockResolvedValue({ access_token: 'tok' });
    mocks.fetchBotConfigHealth.mockResolvedValue({ whatsappConfigured: true, mailboxConfigured: false });
    mocks.getBotMetrics.mockResolvedValue({ eventsLast24h: 4, codesLast24h: 1, lastActivityAt: 't' });
    await expect(loadBotHealthUseCase()).resolves.toEqual({
      whatsappConfigured: true, mailboxConfigured: false, eventsLast24h: 4, codesLast24h: 1, lastActivityAt: 't',
    });
    expect(mocks.fetchBotConfigHealth).toHaveBeenCalledWith('tok');
  });

  it('tests the mailbox with the session token and requires a session', async () => {
    mocks.getCurrentSession.mockResolvedValue({ access_token: 'tok' });
    mocks.requestBotMailboxCheck.mockResolvedValue({ ok: true, message: 'ok', recentNetflixMails: 1 });
    await expect(testBotMailboxUseCase()).resolves.toMatchObject({ ok: true });
    expect(mocks.requestBotMailboxCheck).toHaveBeenCalledWith('tok');

    mocks.getCurrentSession.mockResolvedValue(null);
    await expect(testBotMailboxUseCase()).rejects.toThrow('La sesion expiro');
    mocks.getCurrentSession.mockResolvedValue({});
    await expect(loadBotHealthUseCase()).rejects.toBeInstanceOf(BotAdminError);
  });
});
