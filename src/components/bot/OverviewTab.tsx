'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MetricCard } from '@/components/shared/MetricCard';
import { MetricGrid } from '@/components/shared/MetricGrid';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { BotAdminApi, BotMailboxCheck } from '@/types/bot';
import { BotState } from './BotState';

export function OverviewTab({ api }: { api: BotAdminApi }) {
  const [confirm, setConfirm] = useState(false);
  const [check, setCheck] = useState<BotMailboxCheck | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = api.status?.enabled ?? false;
  async function toggle() {
    setBusy(true);
    try { await api.setEnabled(!enabled); setConfirm(false); setActionError(null); }
    catch { setActionError('No se pudo cambiar el estado del bot. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  async function testMailbox() {
    setBusy(true);
    try { setCheck(await api.testMailbox()); setActionError(null); }
    catch { setActionError('No se pudo comprobar el buzón. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <BotState api={api} empty={!api.status}><div className="space-y-4">
    <Panel title="Estado del bot" actions={<div className="flex items-center gap-3"><span className="text-sm font-medium">{enabled ? 'Apagar bot' : 'Encender bot'}</span><Switch className="scale-150" aria-label={enabled ? 'Apagar bot' : 'Encender bot'} checked={enabled} disabled={busy} onCheckedChange={() => setConfirm(true)} /></div>}>
      <div className="flex flex-wrap items-center gap-3"><StatusBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Encendido' : 'Apagado'}</StatusBadge><span className="text-sm text-muted-foreground">Versión publicada: {api.status?.publishedVersion ?? 'Ninguna'}</span></div>
    </Panel>
    <MetricGrid><MetricCard title="Eventos en 24 h" value={api.health?.eventsLast24h ?? 0} /><MetricCard title="Códigos en 24 h" value={api.health?.codesLast24h ?? 0} /></MetricGrid>
    <Panel title="Comprobaciones" actions={<Button variant="outline" disabled={busy} onClick={() => void testMailbox()}>Probar buzón</Button>}><ul className="space-y-3 text-sm"><li><StatusBadge tone={api.health?.whatsappConfigured ? 'success' : 'warning'}>{api.health?.whatsappConfigured ? 'WhatsApp configurado' : 'WhatsApp sin configurar'}</StatusBadge></li><li><StatusBadge tone={api.health?.mailboxConfigured ? 'success' : 'warning'}>{api.health?.mailboxConfigured ? 'Buzón configurado' : 'Buzón sin configurar'}</StatusBadge></li><li>Última actividad: {api.health?.lastActivityAt ? new Date(api.health.lastActivityAt).toLocaleString('es-PA') : 'Sin actividad'}</li></ul>{check ? <p role="status" className="mt-3 text-sm">{check.message}{check.recentNetflixMails !== null ? ` · ${check.recentNetflixMails} correos recientes de Netflix` : ''}</p> : null}{actionError ? <p role="alert" className="mt-3 text-sm text-danger">{actionError}</p> : null}</Panel>
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>{enabled ? 'Apagar bot' : 'Encender bot'}</DialogTitle><DialogDescription>{enabled ? 'El bot dejará de responder de inmediato.' : 'El bot comenzará a responder con la versión publicada.'}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant={enabled ? 'destructive' : 'default'} disabled={busy} onClick={() => void toggle()}>Confirmar</Button></DialogFooter></DialogContent></Dialog>
  </div></BotState>;
}
