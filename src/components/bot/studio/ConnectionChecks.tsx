'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import type { BotAdminApi, BotMailboxCheck } from '@/types/bot';

function Row({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0 leading-tight"><p className="text-sm font-medium">{title}</p>{detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}</div>
    <div className="flex items-center gap-2">{children}</div>
  </li>;
}

/** Conexiones que el bot necesita para responder, como filas con su estado; la prueba del buzón muestra su resultado junto a la fila. */
export function ConnectionChecks({ api }: { api: BotAdminApi }) {
  const [check, setCheck] = useState<BotMailboxCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const health = api.health;
  async function testMailbox() {
    setBusy(true);
    try { setCheck(await api.testMailbox()); setError(null); }
    catch { setCheck(null); setError('No se pudo comprobar el buzón. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  const mailbox = check
    ? <p role="status" className={check.ok ? 'text-xs text-muted-foreground' : 'text-xs text-danger'}>{check.message}{check.recentNetflixMails !== null ? ` · ${check.recentNetflixMails} correos recientes de Netflix` : ''}</p>
    : error ? <p role="alert" className="text-xs text-danger">{error}</p> : null;
  return <ul aria-label="Conexiones del bot" className="divide-y">
    <Row title="WhatsApp" detail="Envía y recibe los mensajes de los clientes.">
      <StatusBadge tone={health?.whatsappConfigured ? 'success' : 'warning'}>{health?.whatsappConfigured ? 'Configurado' : 'Sin configurar'}</StatusBadge>
    </Row>
    <Row title="Buzón de Netflix" detail="De aquí salen los códigos de inicio de sesión y de viaje.">
      <StatusBadge tone={health?.mailboxConfigured ? 'success' : 'warning'}>{health?.mailboxConfigured ? 'Configurado' : 'Sin configurar'}</StatusBadge>
      <Button variant="outline" disabled={busy || !health?.mailboxConfigured} onClick={() => void testMailbox()}>{busy ? 'Probando…' : 'Probar buzón'}</Button>
    </Row>
    {mailbox ? <li className="py-3">{mailbox}</li> : null}
    <Row title="Última actividad" detail="Último evento que registró el bot.">
      <span className="text-sm tabular-nums">{health?.lastActivityAt ? new Date(health.lastActivityAt).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sin actividad'}</span>
    </Row>
  </ul>;
}
