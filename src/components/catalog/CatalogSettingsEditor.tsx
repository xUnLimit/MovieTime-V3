import { useState } from 'react';
import { catalogSettingsSchema, previewCatalog, type CatalogAdminSnapshot, type CatalogSettings } from '@/modules/catalog/admin-contracts';
import { Panel } from '@/components/shared/Panel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function CatalogSettingsEditor({ snapshot, saving, onSave }: { snapshot: CatalogAdminSnapshot; saving: boolean; onSave: (value: CatalogSettings) => void }) {
  const [draft, setDraft] = useState(snapshot.settings);
  const [error, setError] = useState('');
  return <Panel title="Ajustes generales"><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
    event.preventDefault(); const result = catalogSettingsSchema.safeParse(draft);
    if (!result.success) { setError('TTL: 1–1440 minutos; resumen: 1–4096 caracteres.'); return; }
    setError(''); onSave(result.data);
  }}>
    <div><Label htmlFor="catalog-ttl">TTL de reserva (minutos)</Label><Input id="catalog-ttl" type="number" min={1} max={1440} value={draft.reserva_ttl_minutos} onChange={event => setDraft({ ...draft, reserva_ttl_minutos: Number(event.target.value) })} /></div>
    <div><Label htmlFor="catalog-currency">Moneda</Label><select id="catalog-currency" className="h-8 w-full rounded-md border border-input bg-background text-sm pointer-coarse:h-10 pointer-coarse:text-base" value={draft.moneda} onChange={event => setDraft({ ...draft, moneda: event.target.value })}>{snapshot.currencies.map(row => <option key={row.code}>{row.code}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="catalog-summary">Resumen del bot</Label><Textarea id="catalog-summary" value={draft.resumen_template} onChange={event => setDraft({ ...draft, resumen_template: event.target.value })} />
      <div className="flex gap-2">{['{{disponibles}}', '{{agotados}}'].map(marker => <Button key={marker} type="button" variant="outline" onClick={() => setDraft({ ...draft, resumen_template: draft.resumen_template + marker })}>{marker}</Button>)}</div>
    </div>
    <div><p className="text-sm font-medium">Vista previa del resumen</p><pre className="h-40 overflow-auto whitespace-pre-wrap rounded-md border p-3 font-normal text-xs">{previewCatalog(draft.resumen_template, snapshot.availability)}</pre></div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar ajustes'}</Button>
  </form></Panel>;
}
