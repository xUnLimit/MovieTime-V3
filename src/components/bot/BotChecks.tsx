'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { BotAdminApi, BotMailboxCheck } from '@/types/bot';

/** Comprobaciones de la conexión del bot: WhatsApp, buzón de Netflix y última actividad, con prueba del buzón. */
export function BotChecks({ api }: { api: BotAdminApi }) {
  const [check, setCheck] = useState<BotMailboxCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function testMailbox() {
    setBusy(true);
    try { setCheck(await api.testMailbox()); setError(null); }
    catch { setError('No se pudo comprobar el buzón. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <Panel title="Comprobaciones" description="Conexiones que necesita el bot para responder y entregar códigos." actions={<Button variant="outline" disabled={busy} onClick={() => void testMailbox()}>Probar buzón</Button>}>
    <ul className="space-y-3 text-sm">
      <li><StatusBadge tone={api.health?.whatsappConfigured ? 'success' : 'warning'}>{api.health?.whatsappConfigured ? 'WhatsApp configurado' : 'WhatsApp sin configurar'}</StatusBadge></li>
      <li><StatusBadge tone={api.health?.mailboxConfigured ? 'success' : 'warning'}>{api.health?.mailboxConfigured ? 'Buzón configurado' : 'Buzón sin configurar'}</StatusBadge></li>
      <li>Última actividad: {api.health?.lastActivityAt ? new Date(api.health.lastActivityAt).toLocaleString('es-PA') : 'Sin actividad'}</li>
    </ul>
    {check ? <p role="status" className="mt-3 text-sm">{check.message}{check.recentNetflixMails !== null ? ` · ${check.recentNetflixMails} correos recientes de Netflix` : ''}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
  </Panel>;
}
