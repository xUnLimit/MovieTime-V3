import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogAdminUseCases } from '@/application/use-cases/catalog-admin-use-cases';
import type { CatalogConfig, CatalogSettings } from '@/modules/catalog/admin-contracts';
import { useAuthStore } from '@/store/authStore';

export function useCatalogAdmin() {
  const role = useAuthStore(state => state.user?.role);
  const client = useQueryClient();
  const key = ['catalog-admin', role];
  const snapshot = useQuery({ queryKey: key, queryFn: () => catalogAdminUseCases.load(role), enabled: role === 'admin', refetchInterval: 30000, retry: false });
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const settings = useMutation({ mutationFn: (value: CatalogSettings) => catalogAdminUseCases.saveSettings(role, value), onSuccess: refresh });
  const config = useMutation({ mutationFn: (value: CatalogConfig) => catalogAdminUseCases.saveConfig(role, value), onSuccess: refresh });
  const interest = useMutation({ mutationFn: (value: { id: string; state: 'convertido' | 'descartado' }) => catalogAdminUseCases.closeInterest(role, value.id, value.state), onSuccess: refresh });
  return { snapshot, settings, config, interest };
}
