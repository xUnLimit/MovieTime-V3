import { createContext, useContext } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { useCodeAccessNotice } from '@/hooks/use-code-access-notice';

type Notice = ReturnType<typeof useCodeAccessNotice>;
export const CodeAccessNoticeContext = createContext<Notice | null>(null);
export function useCodeAccessNoticeContext() { return useContext(CodeAccessNoticeContext); }
export function CodeAccessNoticeDialog({ notice }: { notice: Notice }) {
  return <Dialog open={!!notice.pending} onOpenChange={open => { if (!open) notice.cancel(); }}><DialogContent>
    <DialogHeader><DialogTitle>{notice.pending?.enabled ? 'Activar acceso por código' : 'Compartir credenciales'}</DialogTitle>
      <DialogDescription>Esta cuenta tiene {notice.count} clientes activos. Al guardar puedes avisarles por WhatsApp.</DialogDescription></DialogHeader>
    <p className="text-sm">{notice.pending?.enabled ? 'El aviso omite la contraseña y ofrece Solicitar código. Recuerda cambiar la contraseña de la cuenta en la plataforma para revocar el acceso anterior.' : 'El aviso incluirá las credenciales vigentes después de guardar.'}</p>
    <DialogFooter><Button type="button" variant="ghost" onClick={notice.cancel}>Cancelar</Button><Button type="button" variant="outline" onClick={() => notice.confirm(false)}>Cambiar sin avisar</Button><Button type="button" onClick={() => notice.confirm(true)}>Cambiar y avisar al guardar</Button></DialogFooter>
  </DialogContent></Dialog>;
}
