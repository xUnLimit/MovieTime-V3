'use client';

import { useState } from 'react';
import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { conversationTitle, formatWaId } from './chat-format';

type ForwardDialogProps = {
  open: boolean;
  conversations: WhatsAppConversation[];
  onOpenChange: (open: boolean) => void;
  onForward: (waId: string) => void;
};

export function ForwardDialog({ open, conversations, onOpenChange, onForward }: ForwardDialogProps) {
  const [query, setQuery] = useState('');
  const term = query.trim().toLocaleLowerCase();
  const visible = conversations.filter((item) => conversationTitle(item).toLocaleLowerCase().includes(term) || item.waId.includes(term));
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Reenviar archivo</DialogTitle></DialogHeader>
      <Input aria-label="Buscar destino" placeholder="Buscar conversación" value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="max-h-64 overflow-y-auto" role="list" aria-label="Destinos">
        {visible.length ? visible.map((item) => <button key={item.waId} type="button" className="block w-full rounded px-3 py-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onForward(item.waId)}><span className="block font-medium">{conversationTitle(item)}</span><span className="text-xs text-muted-foreground">{formatWaId(item.waId)}</span></button>) : <p className="p-3 text-sm text-muted-foreground">No se encontraron conversaciones.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
