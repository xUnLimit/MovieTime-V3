'use client';

import { useState } from 'react';
import { ChevronDown, Power } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { BotAdminApi } from '@/types/bot';

/**
 * Estado del bot en un solo control: «Encendido · v12». Apagarlo o encenderlo es una acción inmediata y en vivo, distinta de
 * publicar, así que vive en un menú con confirmación y no al lado del botón Publicar.
 */
export function BotStatusMenu({ api }: { api: BotAdminApi }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enabled = api.status?.enabled ?? false;
  const version = api.status?.publishedVersion;
  const label = enabled ? 'Apagar bot' : 'Encender bot';
  async function toggle() {
    setBusy(true);
    try { await api.setEnabled(!enabled); setConfirm(false); setError(null); }
    catch { setError('No se pudo cambiar el estado del bot. Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label={`Estado del bot: ${enabled ? 'encendido' : 'apagado'}`} disabled={!api.status}>
          <StatusBadge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'Encendido' : 'Apagado'}</StatusBadge>
          <span className="text-muted-foreground tabular-nums">{version ? `v${version}` : 'Sin publicar'}</span>
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setConfirm(true)}><Power />{label}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={confirm} onOpenChange={setConfirm}>
      <DialogContent>
        <DialogHeader><DialogTitle>{label}</DialogTitle><DialogDescription>{enabled ? 'El bot dejará de responder de inmediato.' : 'El bot comenzará a responder con la versión publicada.'}</DialogDescription></DialogHeader>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant={enabled ? 'destructive' : 'default'} disabled={busy} onClick={() => void toggle()}>Confirmar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
