'use client';

import { Suspense, useMemo, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { BotView } from '@/components/bot/BotView';
import { applyFlowTemplate, validateDefinition } from '@/modules/bot-config';
import { queryKeys } from '@/platform/query-keys';
import type { BotAdminApi, BotDefinition, BotEvent, BotEventFilters, BotEventType, BotVersionSummary } from '@/types/bot';

import { ShellPreview } from '../shell/ShellPreview';
import { demoControl } from './demo-operation-data';

const PAGE_SIZE = 10;
const TYPES: BotEventType[] = ['menu_shown', 'option_selected', 'code_sent', 'link_sent', 'not_found', 'rate_limited', 'handoff', 'error'];

const demoEvents: BotEvent[] = Array.from({ length: 37 }, (_, index) => ({
  id: `evento-${index}`, createdAt: new Date(Date.now() - index * 5_400_000).toISOString(), waId: `5076000${String(1000 + index)}`,
  clienteId: null, clienteNombre: index % 3 === 0 ? null : `Cliente ${index + 1}`, type: TYPES[index % TYPES.length], nodeId: null, optionId: null, detail: {},
}));

const demoVersions: BotVersionSummary[] = Array.from({ length: 12 }, (_, index) => ({
  version: 12 - index, note: index === 0 ? 'Flujo de compras y nuevos textos' : `Ajuste ${12 - index} del menú`,
  createdAt: new Date(Date.now() - index * 86_400_000).toISOString(), createdBy: 'Administrador', isPublished: index === 0,
}));

const demoCategories = ['Netflix', 'Disney+', 'Max'].map((nombre, index) => ({
  id: `categoria-${index}`, nombre, activo: true, tipo: 'cliente', totalServicios: 0,
  planes: [{ id: `plan-${index}-a`, nombre: 'Básico', precio: 4 + index, cicloPago: 'mensual', tipoPlan: 't' }, { id: `plan-${index}-b`, nombre: 'Premium', precio: 8 + index, cicloPago: 'mensual', tipoPlan: 't' }],
}));

function seed(queryClient: QueryClient) {
  queryClient.setQueryData(queryKeys.categorias.full(), demoCategories);
  queryClient.setQueryDefaults(queryKeys.categorias.full(), { staleTime: Infinity });
  queryClient.setQueryData(['automation-control'], demoControl);
  queryClient.setQueryDefaults(['automation-control'], { staleTime: Infinity, refetchInterval: false });
  queryClient.setQueryData(['commerce-copy'], { overrides: {} });
  queryClient.setQueryDefaults(['commerce-copy'], { staleTime: Infinity });
}

function matches(event: BotEvent, filters: BotEventFilters): boolean {
  return (!filters.type || event.type === filters.type) && (!filters.waId || event.waId.includes(filters.waId))
    && (!filters.from || event.createdAt >= filters.from) && (!filters.to || event.createdAt <= filters.to);
}

/** API en memoria del bot: el borrador, la publicación y los filtros se comportan como los reales, sin tocar Supabase. */
function useDemoApi(): BotAdminApi {
  const initial = useMemo(() => applyFlowTemplate('base_compras'), []);
  const [published, setPublished] = useState<BotDefinition>(initial);
  const [edit, setEdit] = useState<BotDefinition | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [page, setPage] = useState({ page: 1, filters: {} as BotEventFilters });
  const draft = edit ?? published;
  const issues = useMemo(() => validateDefinition(draft), [draft]);
  const rows = demoEvents.filter((event) => matches(event, page.filters));
  return {
    loading: false, error: null, status: { enabled, publishedVersion: 12, updatedAt: null }, published, draft,
    dirty: JSON.stringify(draft) !== JSON.stringify(published), issues, hasErrors: issues.some((issue) => issue.severity === 'error'),
    flowExtensionsEnabled: true, versions: demoVersions,
    events: { events: rows.slice((page.page - 1) * PAGE_SIZE, page.page * PAGE_SIZE), total: rows.length, page: page.page, pageSize: PAGE_SIZE },
    health: { whatsappConfigured: true, mailboxConfigured: true, lastActivityAt: null, eventsLast24h: 12, codesLast24h: 5, flowExtensionsEnabled: true },
    saving: false,
    setEnabled: async (next) => setEnabled(next),
    updateDraft: (updater) => setEdit((current) => updater(current ?? published)),
    discardDraft: () => setEdit(null),
    resetToDefaults: () => setEdit(applyFlowTemplate('base')),
    publish: async () => { setPublished(draft); setEdit(null); },
    loadVersionIntoDraft: async () => setEdit(applyFlowTemplate('base')),
    loadEvents: async (next, filters) => setPage({ page: next, filters }),
    testMailbox: async () => ({ ok: true, message: 'Buzón disponible', recentNetflixMails: 2 }),
    refresh: async () => {},
  };
}

function Demo() {
  const api = useDemoApi();
  return <BotView api={api} />;
}

/** `?tab=` elige la pestaña (recorrido, respuestas, ajustes, actividad, versiones). */
export function AutomatizacionesPreview() {
  return <ShellPreview seed={seed}><Suspense fallback={null}><Demo /></Suspense></ShellPreview>;
}
