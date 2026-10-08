import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCustomerReportsUseCase, updateCustomerReportUseCase } from '@/application/use-cases/customer-reports-use-cases';
import type { ReportQuery } from '@/platform/validation/customer-reports';

export function useCustomerReports(input: ReportQuery, enabled: boolean, refetchInterval: number | false = 30_000) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['customer-reports', input], queryFn: () => listCustomerReportsUseCase(input), enabled, staleTime: 30_000, refetchInterval });
  const change = useMutation({ mutationFn: updateCustomerReportUseCase, onSuccess: () => client.invalidateQueries({ queryKey: ['customer-reports'] }) });
  return { query, change };
}
