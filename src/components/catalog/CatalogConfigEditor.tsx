import { useState } from 'react';
import type { CatalogAdminSnapshot, CatalogConfig } from '@/modules/catalog/admin-contracts';
import { catalogConfigSchema } from '@/modules/catalog/admin-contracts';
import { Panel } from '@/components/shared/Panel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function CatalogConfigEditor({ value, snapshot, saving, onSave }: {
  value: CatalogConfig; snapshot: CatalogAdminSnapshot; saving: boolean; onSave: (value: CatalogConfig) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const patch = (value: Partial<CatalogConfig>) => setDraft(current => ({ ...current, ...value }));
  return <Panel title="Configuración por plataforma / plan"><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
    event.preventDefault(); const result = catalogConfigSchema.safeParse(draft);
    if (!result.success) { setError('Revisa los valores de configuración.'); return; }
    setError(''); onSave(result.data);
  }}>
    <p className="text-sm sm:col-span-2">{snapshot.categories.find(row => row.id === value.categoria_id)?.nombre} · {snapshot.plans.find(row => row.id === value.plan_id)?.nombre ?? 'Todos los planes'}</p>
    <div className="flex items-center gap-2"><Checkbox id="catalog-visible" checked={draft.visible_en_bot} onCheckedChange={checked => patch({ visible_en_bot: checked === true })} /><Label htmlFor="catalog-visible">Visible en el bot</Label></div>
    <div><Label htmlFor="catalog-order">Orden</Label><Input id="catalog-order" type="number" value={draft.orden} onChange={event => patch({ orden: Number(event.target.value) })} /></div>
    <div><Label htmlFor="catalog-threshold">Umbral de stock bajo</Label><Input id="catalog-threshold" type="number" min={0} value={draft.umbral_stock_bajo} onChange={event => patch({ umbral_stock_bajo: Number(event.target.value) })} /></div>
    <div><Label htmlFor="catalog-alternative">Plataforma alternativa</Label><select id="catalog-alternative" className="h-8 w-full rounded-md border border-input bg-background text-sm pointer-coarse:h-10 pointer-coarse:text-base" value={draft.alternativa_categoria_id ?? ''} onChange={event => patch({ alternativa_categoria_id: event.target.value || null, alternativa_plan_id: null })}><option value="">Sin alternativa</option>{snapshot.categories.map(row => <option key={row.id} value={row.id}>{row.nombre}</option>)}</select></div>
    <div><Label htmlFor="catalog-alternative-plan">Plan alternativo</Label><select id="catalog-alternative-plan" className="h-8 w-full rounded-md border border-input bg-background text-sm pointer-coarse:h-10 pointer-coarse:text-base" disabled={!draft.alternativa_categoria_id} value={draft.alternativa_plan_id ?? ''} onChange={event => patch({ alternativa_plan_id: event.target.value || null })}><option value="">Cualquier plan</option>{snapshot.plans.filter(row => row.categoria_id === draft.alternativa_categoria_id).map(row => <option key={row.id} value={row.id}>{row.nombre}</option>)}</select></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button type="submit" variant="outline" disabled={saving}>{saving ? 'Guardando...' : 'Guardar configuración'}</Button>
  </form></Panel>;
}
