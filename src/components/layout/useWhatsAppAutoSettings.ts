'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { listAutoNoticeRunsUseCase, updateWhatsAppAutoUseCase, type WhatsAppAutoUpdate } from '@/application/use-cases/config-use-cases';
import { useConfig } from '@/hooks/use-config';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { queryKeys } from '@/platform/query-keys';

export const AUTO_CAP_MIN = 1;
export const AUTO_CAP_MAX = 1000;

// Ajustes del envio automatico "Dia de pago" por WhatsApp (interruptor, hora de Panama y tope diario).
export function useWhatsAppAutoSettings(open: boolean) {
  const { data: config, refetch: refetchConfig } = useConfig();
  const auto = config?.whatsapp;
  const runsQuery = useQuery({
    queryKey: queryKeys.whatsapp.autoRuns(),
    queryFn: listAutoNoticeRunsUseCase,
    enabled: open,
  });
  const [draftCap, setDraftCap] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (auto) setDraftCap(String(auto.autoDailyCap));
  }, [auto]);

  const save = async (updates: WhatsAppAutoUpdate, okMessage: string) => {
    setIsSaving(true);
    try {
      await updateWhatsAppAutoUseCase(updates);
      await refetchConfig();
      toast.success(okMessage);
    } catch (error) {
      if (auto) setDraftCap(String(auto.autoDailyCap));
      toast.error(getPublicErrorMessage(error, 'No se pudo guardar el envío automático.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (enabled: boolean) =>
    save({ enabled }, enabled ? 'Envío automático activado.' : 'Envío automático desactivado.');

  const handleHourChange = async (hour: number) => {
    if (!auto || hour === auto.autoSendHour) return;
    await save({ horaEnvio: hour }, 'Hora de envío actualizada.');
  };

  const handleCapCommit = async () => {
    if (!auto) return;
    const value = Number(draftCap);
    if (!Number.isInteger(value) || value < AUTO_CAP_MIN || value > AUTO_CAP_MAX) {
      setDraftCap(String(auto.autoDailyCap));
      toast.error(`El tope diario debe estar entre ${AUTO_CAP_MIN} y ${AUTO_CAP_MAX}.`);
      return;
    }
    if (value === auto.autoDailyCap) return;
    await save({ dailyCap: value }, 'Tope diario actualizado.');
  };

  return {
    autoConfig: auto ?? null,
    runs: runsQuery.data ?? [],
    runsLoading: runsQuery.isLoading,
    draftCap,
    setDraftCap,
    isSaving,
    handleToggle,
    handleHourChange,
    handleCapCommit,
  };
}
