'use client';

import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listRecentNoticesUseCase, loadNoticeActivityUseCase } from '@/application/use-cases/automation-use-cases';
import { useConfig } from '@/hooks/use-config';
import { useMetaTemplates, useTemplates } from '@/hooks/use-templates';
import { buildAutomationGroups, type AutomationGroup } from '@/modules/messaging/automation-cards';
import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { queryKeys } from '@/platform/query-keys';
import type { TemplateMensaje } from '@/types';
import type { RecentNoticeFilters, RecentNoticePage } from '@/types/automation';

const LOAD_ERROR = 'No se pudieron cargar las automatizaciones. Intenta de nuevo.';
const NO_TEMPLATES: TemplateMensaje[] = [];
const NO_METAS: MetaTemplateInfo[] = [];

/** Configuracion vigente del envio automatico; se muestra en solo lectura. */
type AutoSendSummary = { enabled: boolean; hour: number; dailyCap: number; daysBefore: number | null };

export type AutomationsApi = {
  loading: boolean;
  error: string | null;
  groups: AutomationGroup[];
  /** La actividad de 30 dias es secundaria: si falla, el catalogo se muestra igual con ceros. */
  activityFailed: boolean;
  auto: { loading: boolean; failed: boolean; summary: AutoSendSummary | null };
  recent: { loading: boolean; error: string | null; data: RecentNoticePage | null; filters: RecentNoticeFilters };
  setFilters: (filters: RecentNoticeFilters) => void;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
};

export function useAutomations(): AutomationsApi {
  const templates = useTemplates();
  const metas = useMetaTemplates();
  const activity = useQuery({ queryKey: queryKeys.whatsapp.noticeActivity(), queryFn: () => loadNoticeActivityUseCase(), retry: false });
  const config = useConfig();
  const [page, setPageState] = useState(1);
  const [filters, setFiltersState] = useState<RecentNoticeFilters>({});
  const recent = useQuery({
    queryKey: queryKeys.whatsapp.recentNotices(page, filters.tipo ?? '', filters.status ?? ''),
    queryFn: () => listRecentNoticesUseCase(page, filters),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const templateData = templates.data ?? NO_TEMPLATES;
  const metaData = metas.data ?? NO_METAS;
  const activityData = activity.data;
  const groups = useMemo(
    () => buildAutomationGroups(templateData, metaData, activityData ?? {}),
    [templateData, metaData, activityData],
  );

  const whatsapp = config.data?.whatsapp;
  const days = config.data?.notificaciones.diasAntes[0];
  const summary: AutoSendSummary | null = whatsapp
    ? { enabled: whatsapp.autoEnabled, hour: whatsapp.autoSendHour, dailyCap: whatsapp.autoDailyCap, daysBefore: days ?? null }
    : null;

  const setFilters = useCallback((next: RecentNoticeFilters) => { setFiltersState(next); setPageState(1); }, []);
  const { refetch: refetchTemplates } = templates;
  const { refetch: refetchMetas } = metas;
  const { refetch: refetchActivity } = activity;
  const { refetch: refetchRecent } = recent;
  const { refetch: refetchConfig } = config;
  const refresh = useCallback(async () => {
    await Promise.all([refetchTemplates(), refetchMetas(), refetchActivity(), refetchRecent(), refetchConfig()]);
  }, [refetchTemplates, refetchMetas, refetchActivity, refetchRecent, refetchConfig]);

  return {
    loading: templates.isLoading || metas.isLoading,
    error: templates.isError || metas.isError ? LOAD_ERROR : null,
    groups,
    activityFailed: activity.isError,
    auto: { loading: config.isLoading, failed: config.isError, summary },
    recent: {
      loading: recent.isLoading,
      error: recent.isError ? 'No se pudo cargar el historial de envíos. Inténtalo de nuevo.' : null,
      data: recent.data ?? null,
      filters,
    },
    setFilters,
    setPage: setPageState,
    refresh,
  };
}
