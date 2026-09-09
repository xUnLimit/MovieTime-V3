'use client';

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/platform/query-keys';
import {
  buildFinancialForecastFromReadModel,
  buildPronosticoSignature,
  type MesPronostico,
} from '@/modules/forecasting';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import type { ServicioPronostico, VentaPronostico } from '@/types/dashboard';

export type { MesPronostico } from '@/modules/forecasting';

interface UsePronosticoFinancieroOptions {
  monthsCount?: number;
  endAtCurrentYear?: boolean;
}

interface UsePronosticoFinancieroResult {
  meses: MesPronostico[];
  isLoading: boolean;
  error: unknown;
  retry: () => void;
}

const EMPTY_VENTAS_PRONOSTICO: VentaPronostico[] = [];
const EMPTY_SERVICIOS_PRONOSTICO: ServicioPronostico[] = [];

export function usePronosticoFinanciero(
  options: UsePronosticoFinancieroOptions = {}
): UsePronosticoFinancieroResult {
  const { monthsCount = 4, endAtCurrentYear = false } = options;
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const ventas = stats?.ventasPronostico ?? EMPTY_VENTAS_PRONOSTICO;
  const servicios = stats?.serviciosPronostico ?? EMPTY_SERVICIOS_PRONOSTICO;
  const signature = buildPronosticoSignature({ ventas, servicios });

  const { data: meses = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard.pronostico(signature, monthsCount, endAtCurrentYear),
    queryFn: async () => {
      if (ventas.length === 0 && servicios.length === 0) {
        return [];
      }

      return buildFinancialForecastFromReadModel({
        ventas,
        servicios,
        monthsCount,
        endAtCurrentYear,
      });
    },
    enabled: Boolean(stats),
    retry: false,
  });

  return {
    meses,
    isLoading: statsLoading || isLoading || isFetching,
    error,
    retry: () => { void refetch(); },
  };
}
