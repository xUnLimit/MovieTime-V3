import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listCustomerReportsUseCase, updateCustomerReportUseCase } from '@/application/use-cases/customer-reports-use-cases';
import type { ReportQuery } from '@/platform/validation/customer-reports';

export function useCustomerReports(input: ReportQuery, enabled: boolean) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['customer-reports', input], queryFn: () => listCustomerReportsUseCase(input), enabled, refetchInterval: 15000 });
  const change = useMutation({ mutationFn: updateCustomerReportUseCase, onSuccess: () => client.invalidateQueries({ queryKey: ['customer-reports'] }) });
  return { query, change };
}
