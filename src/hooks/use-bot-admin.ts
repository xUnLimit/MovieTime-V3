"use client";

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  listBotEventsUseCase, loadBotAdminSnapshot, loadBotHealthUseCase, publishBotUseCase, restoreBotVersionUseCase,
  setBotEnabledUseCase, testBotMailboxUseCase,
} from '@/application/use-cases/bot-admin-use-cases';
import { defaultDefinition, hasBlockingIssues, validateDefinition } from '@/modules/bot-config';
import { getActivityLogOptions } from '@/platform/activity/activity-log-adapter';
import type { BotAdminApi, BotDefinition, BotEventFilters, BotEventPage } from '@/types/bot';

const LOAD_ERROR = 'No se pudo cargar el bot. Intenta de nuevo.';
const SNAPSHOT_KEY = ['bot-admin', 'snapshot'] as const;

export function useBotAdmin(): BotAdminApi {
  const snapshot = useQuery({ queryKey: SNAPSHOT_KEY, queryFn: loadBotAdminSnapshot, retry: false });
  // Health and activity are secondary: their failure must not block editing the flow.
  const healthQuery = useQuery({ queryKey: ['bot-admin', 'health'], queryFn: loadBotHealthUseCase, retry: false });
  const eventsQuery = useQuery({ queryKey: ['bot-admin', 'events'], queryFn: () => listBotEventsUseCase(1, {}), retry: false });
  const [draftEdit, setDraftEdit] = useState<BotDefinition | null>(null);
  const [eventsEdit, setEventsEdit] = useState<BotEventPage | null>(null);
  const [saving, setSaving] = useState(false);

  const status = snapshot.data?.status ?? null;
  const published = snapshot.data?.published ?? null;
  // The draft is the user's edit, or else the published definition (or the defaults when nothing valid is published).
  const base = snapshot.data ? published ?? defaultDefinition() : null;
  const draft = draftEdit ?? base;

  const dirty = useMemo(
    () => draft !== null && (published === null || JSON.stringify(draft) !== JSON.stringify(published)),
    [draft, published],
  );
  // Fail closed: mientras la bandera no se haya leido, los bloques de compra cuentan como desactivados.
  const purchaseBlocksEnabled = healthQuery.data?.purchaseBlocksEnabled === true;
  const flowExtensionsEnabled = healthQuery.data?.flowExtensionsEnabled === true;
  const issues = useMemo(() => (draft ? validateDefinition(draft, { purchaseBlocksEnabled, flowExtensionsEnabled }) : []), [draft, purchaseBlocksEnabled, flowExtensionsEnabled]);
  const hasErrors = useMemo(() => hasBlockingIssues(issues), [issues]);

  const updateDraft = useCallback((updater: (current: BotDefinition) => BotDefinition) => {
    if (base) setDraftEdit((current) => updater(current ?? base));
  }, [base]);
  const discardDraft = useCallback(() => setDraftEdit(null), []);
  const resetToDefaults = useCallback(() => setDraftEdit(defaultDefinition()), []);

  const { refetch: refetchSnapshot } = snapshot;
  const { refetch: refetchHealth } = healthQuery;
  const { refetch: refetchEvents } = eventsQuery;

  const refresh = useCallback(async () => {
    setEventsEdit(null);
    await Promise.all([refetchSnapshot(), refetchHealth(), refetchEvents()]);
  }, [refetchSnapshot, refetchHealth, refetchEvents]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    setSaving(true);
    try {
      await setBotEnabledUseCase(enabled, getActivityLogOptions());
      await refetchSnapshot();
    } finally {
      setSaving(false);
    }
  }, [refetchSnapshot]);

  const publish = useCallback(async (note: string) => {
    if (!draft) return;
    setSaving(true);
    try {
      await publishBotUseCase(draft, note, getActivityLogOptions(), published, purchaseBlocksEnabled, flowExtensionsEnabled);
      await Promise.all([refetchSnapshot(), refetchEvents()]);
      setDraftEdit(null);
      setEventsEdit(null);
    } finally {
      setSaving(false);
    }
  }, [draft, published, purchaseBlocksEnabled, flowExtensionsEnabled, refetchSnapshot, refetchEvents]);

  const loadVersionIntoDraft = useCallback(async (version: number) => {
    setDraftEdit(await restoreBotVersionUseCase(version, getActivityLogOptions()));
  }, []);

  const loadEvents = useCallback(async (page: number, filters: BotEventFilters) => {
    setEventsEdit(await listBotEventsUseCase(page, filters));
  }, []);

  const testMailbox = useCallback(() => testBotMailboxUseCase(), []);

  return {
    loading: snapshot.isFetching,
    error: snapshot.isError ? LOAD_ERROR : null,
    status, published, draft, dirty, issues, hasErrors, purchaseBlocksEnabled, flowExtensionsEnabled,
    versions: snapshot.data?.versions ?? [],
    events: eventsEdit ?? eventsQuery.data ?? null,
    health: healthQuery.data ?? null,
    saving, setEnabled, updateDraft, discardDraft, resetToDefaults, publish, loadVersionIntoDraft, loadEvents, testMailbox, refresh,
  };
}
