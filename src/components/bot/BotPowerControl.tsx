'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { BotAdminApi } from '@/types/bot';

/** Estado del bot en el encabezado: encendido o apagado, versión publicada e interruptor con confirmación. */
export function BotPowerControl({ api }: { api: BotAdminApi }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = api.status?.enabled ?? false;
  const label = enabled ? 'Apagar bot' : 'Encender bot';
  async function toggle() {
    setBusy(true);
    try { await api.setEnabled(!enabled); setConfirm(false); setError(null); }
    catch { setError('No se pudo cambiar el estado del bot. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <>
    <StatusBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Encendido' : 'Apagado'}</StatusBadge>
    <span className="text-sm text-muted-foreground">Versión publicada: {api.status?.publishedVersion ?? 'Ninguna'}</span>
    <Switch aria-label={label} checked={enabled} disabled={busy || !api.status} onCheckedChange={() => setConfirm(true)} />
    <Dialog open={confirm} onOpenChange={setConfirm}>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{enabled ? 'El bot dejará de responder de inmediato.' : 'El bot comenzará a responder con la versión publicada.'}</DialogDescription></DialogHeader>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant={enabled ? 'destructive' : 'default'} disabled={busy} onClick={() => void toggle()}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
