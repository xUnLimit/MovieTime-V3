'use client';

import { useState } from 'react';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAutomationControlActions } from '@/hooks/use-automation-control';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import type { AutomationControl, AutomationSettings } from '@/types/automation-control';
import { useUnsavedNavigation } from '@/hooks/use-unsaved-navigation';

const intents = { catalogue: 'Consultar catálogo', services: 'Consultar sus servicios', payment: 'Consultar un pago', handoff: 'Atención humana', clarify: 'Pedir aclaración' };

export function AutomationSettingsForm({ control }: { control: AutomationControl }) {
  const [draft, setDraft] = useState<AutomationSettings>(control.settings);
  const [example, setExample] = useState('');
  const { save, simulate } = useAutomationControlActions();
  const patch = (value: Partial<AutomationSettings>) => setDraft(current => ({ ...current, ...value }));
  useUnsavedNavigation(JSON.stringify(draft) !== JSON.stringify(control.settings));
  const valid = [draft.dailyCalls, draft.dailyTokens, draft.reservationMinutes, draft.maxReservations].every(value => Number.isInteger(value) && value > 0) && (draft.aiMode === 'off' || draft.model.trim().length > 0);
  return <div className="min-w-0 space-y-4">
    <form onSubmit={event => { event.preventDefault(); if (valid) save.mutate(draft); }} className="space-y-4">
      <Panel title="Inteligencia artificial" description="Empieza por sugerencias; las consultas automáticas usan únicamente las capacidades autorizadas." actions={<StatusBadge tone={control.health.aiConfigured ? 'success' : 'warning'}>{control.health.aiConfigured ? 'Conectada' : 'Conexión pendiente'}</StatusBadge>}>
        <div className="space-y-3">
          {!control.health.aiConfigured ? <p className="text-sm text-muted-foreground">Falta configurar la clave de IA en el servidor. Puedes preparar y guardar los límites antes de activar la conexión.</p> : null}
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="ai-mode">Modo de atención</Label><select id="ai-mode" className="h-8 w-full rounded-md border bg-background px-2 text-sm" value={draft.aiMode} onChange={event => { const value = event.target.value; if (value === 'off' || value === 'suggestions' || value === 'queries') patch({ aiMode: value }); }}><option value="off">Apagada</option><option value="suggestions">Sugerencias para el operador</option><option value="queries">Consultas automáticas</option></select></div><div className="space-y-1.5"><Label htmlFor="ai-model">Modelo configurado</Label><Input id="ai-model" value={draft.model} maxLength={100} onChange={event => patch({ model: event.target.value })} placeholder="Identificador del modelo autorizado" /></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><NumberField id="daily-calls" label="Llamadas máximas por día" value={draft.dailyCalls} onChange={dailyCalls => patch({ dailyCalls })} /><NumberField id="daily-tokens" label="Tokens máximos por día" value={draft.dailyTokens} onChange={dailyTokens => patch({ dailyTokens })} /></div>
        </div>
      </Panel>
      <Panel title="Reservas de compras" description="El vencimiento libera el stock; un pago recibido sigue registrado aunque la reserva expire."><div className="space-y-3"><div className="flex items-center justify-between gap-3"><Label htmlFor="purchases-enabled">Permitir nuevas compras por WhatsApp</Label><Switch id="purchases-enabled" checked={Boolean(draft.purchasesEnabled)} onCheckedChange={purchasesEnabled => patch({ purchasesEnabled })} /></div><p className="text-sm text-muted-foreground">Pausar las compras conserva la atención y la entrega de pedidos ya pagados. Activa este permiso cuando quieras recibir nuevas compras.</p><div className="grid gap-3 sm:grid-cols-2"><NumberField id="reservation-minutes" label="Minutos para reservar" value={draft.reservationMinutes} onChange={reservationMinutes => patch({ reservationMinutes })} /><NumberField id="max-reservations" label="Reservas máximas por contacto" value={draft.maxReservations} onChange={maxReservations => patch({ maxReservations })} /></div></div></Panel>
      <Panel title="Integraciones externas" description="Las herramientas externas reciben eventos permitidos. Puedes pausarlas sin detener la atención ni las operaciones del negocio." actions={<StatusBadge tone={control.health.integrationConfigured ? 'success' : 'warning'}>{control.health.integrationConfigured ? 'Conexión preparada' : 'Conexión pendiente'}</StatusBadge>}><div className="flex items-center justify-between gap-3"><Label htmlFor="integrations-enabled">Permitir integraciones</Label><Switch id="integrations-enabled" checked={draft.integrationsEnabled} disabled={!control.health.integrationConfigured} onCheckedChange={integrationsEnabled => patch({ integrationsEnabled })} /></div>{!control.health.integrationConfigured ? <p className="mt-3 text-sm text-muted-foreground">Configura la conexión y sus permisos en el servidor antes de activarla.</p> : null}</Panel>
      {!valid ? <p role="alert" className="text-sm text-danger">Completa el modelo para activar IA y usa límites enteros mayores que cero.</p> : null}
      {save.isError ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(save.error, 'No se pudo guardar. Revisa los valores e inténtalo de nuevo.')}</p> : null}
      {save.isSuccess ? <p role="status" className="text-sm text-success">Configuración guardada.</p> : null}
      <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar configuración'}</Button>
    </form>
    <Panel title="Probar una consulta" description="Usa ejemplos sin contraseñas ni datos personales. La prueba interpreta la consulta sin ejecutar una compra o un pago."><div className="space-y-3"><Label htmlFor="ai-example">Mensaje de ejemplo</Label><Textarea id="ai-example" value={example} maxLength={1000} onChange={event => { setExample(event.target.value); simulate.reset(); }} placeholder="Quiero consultar mis servicios" /><Button variant="outline" disabled={!example.trim() || simulate.isPending || !control.health.aiConfigured} onClick={() => simulate.mutate(example)}>{simulate.isPending ? 'Probando…' : 'Probar interpretación'}</Button>{simulate.isError ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(simulate.error, 'No se pudo completar la prueba. Reintenta.')}</p> : null}{simulate.isSuccess ? <p role="status" className="text-sm">{simulate.data ? `Resultado: ${intents[simulate.data.intent]}. Confianza: ${Math.round(simulate.data.confidence * 100)}%.` : 'Sin interpretación disponible. El recorrido guiado continúa disponible.'}</p> : null}</div></Panel>
    <Panel title="Proveedores de acceso" description="Solo se ofrecen capacidades verificadas."><ul className="divide-y">{control.providers.filter(provider => provider.verified).map(provider => <li key={provider.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{provider.name}</p><p className="text-xs text-muted-foreground">{[provider.loginCode ? 'Código de inicio' : null, provider.travelCode ? 'Código de viaje' : null].filter(Boolean).join(' · ') || 'Sin códigos disponibles'}</p></div><StatusBadge tone="success">Verificado</StatusBadge></li>)}</ul></Panel>
  </div>;
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} type="number" min={1} step={1} required value={value} onChange={event => onChange(Number(event.target.value))} /></div>;
}
