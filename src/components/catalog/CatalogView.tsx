import { catalogStock } from '@/modules/catalog/admin-contracts';
import { useState } from 'react';
import { useCatalogAdmin } from '@/hooks/use-catalog-admin';
import type { CatalogConfig } from '@/modules/catalog/admin-contracts';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, type Column } from '@/components/shared/DataTable';
import { TableCard } from '@/components/shared/TableCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogConfigEditor } from './CatalogConfigEditor';
import { CatalogSettingsEditor } from './CatalogSettingsEditor';

type Row = CatalogConfig & { name: string; planName: string; stock: number | null; availability: string };
export function CatalogView() { return <CatalogScreen api={useCatalogAdmin()} />; }

export function CatalogScreen({ api }: { api: ReturnType<typeof useCatalogAdmin> }) {
  const { snapshot, settings, config } = api;
  const [selected, setSelected] = useState<string | null>(null);
  const data = snapshot.data;
  const rows: Row[] = data?.categories.flatMap(category => [null, ...data.plans.filter(plan => plan.categoria_id === category.id)].map(plan => {
    const own = data.configs.find(row => row.categoria_id === category.id && row.plan_id === (plan?.id ?? null));
    const base = own ?? data.configs.find(row => row.categoria_id === category.id && row.plan_id === null);
    const live = data.availability.filter(row => row.categoria_id === category.id && (!plan || row.plan_id === plan.id));
    const stock = live.length ? catalogStock(live) : null;
    const threshold = base?.umbral_stock_bajo ?? 2;
    return { ...base, id: own?.id, categoria_id: category.id, plan_id: plan?.id ?? null,
      visible_en_bot: base?.visible_en_bot ?? true, orden: base?.orden ?? 0, umbral_stock_bajo: threshold,
      alternativa_categoria_id: base?.alternativa_categoria_id ?? null, alternativa_plan_id: base?.alternativa_plan_id ?? null,
      name: category.nombre, planName: plan?.nombre ?? 'Todos los planes', stock,
      availability: stock === null ? 'Fuera del catálogo' : stock === 0 ? 'Agotado' : stock <= threshold ? 'Últimos perfiles' : 'Disponible' };
  })) ?? [];
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Plataforma / plan', render: row => <div className="leading-tight"><div className="truncate font-medium">{row.name}</div><div className="truncate text-xs text-muted-foreground">{row.planName}</div></div> },
    { key: 'visible_en_bot', header: 'Bot', render: row => <StatusBadge>{row.visible_en_bot ? 'Visible' : 'Oculto'}</StatusBadge> },
    { key: 'orden', header: 'Orden' },
    { key: 'stock', header: 'Disponibilidad', render: row => <div className="leading-tight"><StatusBadge tone={row.stock === 0 ? 'danger' : row.stock !== null && row.stock <= row.umbral_stock_bajo ? 'warning' : 'neutral'}>{row.availability}</StatusBadge><div className="text-xs text-muted-foreground">{row.stock ?? '—'} perfiles · umbral {row.umbral_stock_bajo}</div></div> },
  ];
  const active = rows.find(row => `${row.categoria_id}:${row.plan_id}` === selected);
  return <div className="flex flex-col gap-3"><PageHeader title="Catálogo" description="Configura plataformas, planes y reservas del bot" />
    {snapshot.isLoading && <Skeleton className="h-40 w-full" />}
    {snapshot.isError && <p role="alert" className="text-sm text-danger">No se pudo cargar el catálogo. <Button variant="outline" onClick={() => snapshot.refetch()}>Reintentar</Button></p>}
    {(settings.isError || config.isError) && <p role="alert" className="text-sm text-danger">No se pudo guardar. Revisa los valores y reintenta.</p>}
    {data && <CatalogSettingsEditor snapshot={data} saving={settings.isPending} onSave={value => settings.mutate(value)} />}
    <TableCard title="Disponibilidad en vivo y configuración"><DataTable bare fixedLayout pagination itemsPerPageOptions={[10]} rowHeight={49} loading={snapshot.isLoading} data={rows} columns={columns} emptyMessage="No hay plataformas configuradas" actions={row => <Button variant="ghost" onClick={() => setSelected(`${row.categoria_id}:${row.plan_id}`)}>Editar</Button>} /></TableCard>
    {active && data && <CatalogConfigEditor key={selected} value={active} snapshot={data} saving={config.isPending} onSave={value => config.mutate(value)} />}
  </div>;
}
