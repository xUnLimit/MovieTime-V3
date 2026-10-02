"use client";
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CatalogScreen } from '@/components/catalog/CatalogView';
import { InterestScreen } from '@/components/catalog/InterestView';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CatalogAdminSnapshot, CatalogConfig, CatalogSettings } from '@/modules/catalog/admin-contracts';
import { catalogSnapshot } from './demo-data';

const key = ['admin-preview'];
export function AdminPreview() {
  const [tab, setTab] = useState('interesados');
  const client = useQueryClient();
  const snapshot = useQuery({ queryKey: key, queryFn: async () => catalogSnapshot(), initialData: catalogSnapshot, staleTime: Infinity });
  const settings = useMutation({ mutationFn: async (value: CatalogSettings) => {
    client.setQueryData<CatalogAdminSnapshot>(key, current => current ? { ...current, settings: value } : current);
  } });
  const config = useMutation({ mutationFn: async (value: CatalogConfig) => {
    client.setQueryData<CatalogAdminSnapshot>(key, current => current ? { ...current, configs: [...current.configs.filter(row => row.categoria_id !== value.categoria_id || row.plan_id !== value.plan_id), value] } : current);
  } });
  const interest = useMutation({ mutationFn: async (value: { id: string; state: 'convertido' | 'descartado' }) => {
    client.setQueryData<CatalogAdminSnapshot>(key, current => current ? { ...current, interests: current.interests.map(row => row.id === value.id ? { ...row, estado: value.state } : row) } : current);
  } });
  const api = { snapshot, settings, config, interest };
  return <main className="mx-auto flex max-w-6xl flex-col gap-3 p-5"><p className="text-xs text-muted-foreground">Vista de desarrollo con datos sintéticos. Los cambios solo afectan esta vista.</p>
    <Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="interesados">Interesados</TabsTrigger><TabsTrigger value="catalogo">Catálogo</TabsTrigger></TabsList></Tabs>
    {tab === 'interesados' ? <InterestScreen api={api} /> : <CatalogScreen api={api} />}
  </main>;
}
