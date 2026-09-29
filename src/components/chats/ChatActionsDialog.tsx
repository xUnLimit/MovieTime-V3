'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ShoppingCart, UserPlus } from 'lucide-react';

import { sendWhatsAppMessageUseCase, type WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TerceroForm } from '@/components/terceros/TerceroForm';
import { VentasForm } from '@/components/ventas/VentasForm';
import { useMetodosPagoTerceros } from '@/hooks/use-metodos-pago-terceros';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { formatWaId, getServiceWindow } from './chat-format';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WhatsAppConversation;
};

type Step = 'menu' | 'cliente' | 'venta';

const ACTION_ITEM = 'flex w-full items-center gap-3 rounded-md border border-chat-line px-4 py-3 text-left transition-colors hover:bg-chat-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45';

export function ChatActionsDialog({ open, onOpenChange, conversation }: Props) {
  const [step, setStep] = useState<Step>('menu');
  const { data: metodosPago = [], isLoading: metodosPagoLoading } = useMetodosPagoTerceros({ enabled: open && step !== 'menu' });
  const hasCliente = Boolean(conversation.terceroId);

  const close = () => onOpenChange(false);
  // El paso vuelve al menu la proxima vez que se abra, sin importar donde se quedo.
  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStep('menu');
  };

  // Al generar la venta desde este mismo chat, "notificar al cliente" manda
  // el mensaje directo por la Cloud API (como cualquier otro mensaje del
  // chat) en vez de abrir WhatsApp Web en una pestana aparte. Si la ventana
  // de 24h esta cerrada, WhatsApp solo permite plantillas: se rechaza aqui
  // para que el formulario caiga de vuelta al flujo por defecto.
  const sendDirectMessage = async (message: string): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!getServiceWindow(conversation.lastInboundAt, new Date()).open) {
      return { ok: false, reason: 'La ventana de 24 h con este cliente está cerrada; copia el mensaje o ábrelo con el botón de abajo.' };
    }
    try {
      const result = await sendWhatsAppMessageUseCase({ to: conversation.waId, message: { kind: 'text', text: message } });
      if (result.sendStatus === 'failed') {
        return { ok: false, reason: `WhatsApp rechazó el mensaje: ${result.errorTitle ?? 'error desconocido'}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: getPublicErrorMessage(error, 'No se pudo enviar el mensaje.') };
    }
  };

  // TerceroForm/VentasForm usan las variables de diseno genericas de la app
  // (--background, --border, etc.), y sus menus se renderizan en un portal
  // hermano de este dialogo, fuera del alcance de una clase local. Se remapean
  // esas variables al tema del chat en <body> mientras el formulario esta
  // visible, igual que hace next-themes con la clase ".dark".
  const embedded = open && step !== 'menu';
  useEffect(() => {
    if (!embedded) return;
    document.body.classList.add('chat-embedded-form');
    return () => document.body.classList.remove('chat-embedded-form');
  }, [embedded]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="chats-surface max-h-[min(90dvh,720px)] overflow-y-auto border-chat-line bg-chat-surface text-chat-ink sm:max-w-[640px]">
        {step === 'menu' ? (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Acciones</DialogTitle>
              <DialogDescription className="text-sm text-chat-muted">Registra al cliente o genera una venta sin salir de la conversación.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <button type="button" className={ACTION_ITEM} onClick={() => setStep('cliente')} disabled={hasCliente} aria-describedby={hasCliente ? 'accion-cliente-hint' : undefined}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chat-accent-soft text-chat-accent-strong"><UserPlus className="h-[18px] w-[18px]" aria-hidden /></span>
                <span>
                  <span className="block text-sm font-semibold text-chat-ink">Registrar cliente</span>
                  <span id="accion-cliente-hint" className="block text-xs text-chat-muted">{hasCliente ? 'Este número ya está registrado como cliente.' : 'Crea el tercero con el teléfono de este chat.'}</span>
                </span>
              </button>
              <button type="button" className={ACTION_ITEM} onClick={() => setStep('venta')} disabled={!hasCliente} aria-describedby={!hasCliente ? 'accion-venta-hint' : undefined}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-chat-accent-soft text-chat-accent-strong"><ShoppingCart className="h-[18px] w-[18px]" aria-hidden /></span>
                <span>
                  <span className="block text-sm font-semibold text-chat-ink">Generar venta</span>
                  <span id="accion-venta-hint" className="block text-xs text-chat-muted">
                    {hasCliente ? 'Se preselecciona a este cliente.' : 'Primero registra al cliente para poder generar una venta.'}
                  </span>
                </span>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader className="text-left">
              <button type="button" onClick={() => setStep('menu')} className="mb-1 flex items-center gap-1 text-xs font-semibold text-chat-accent-strong hover:underline">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Volver a acciones
              </button>
              <DialogTitle>{step === 'cliente' ? 'Registrar cliente' : 'Generar venta'}</DialogTitle>
            </DialogHeader>
            {metodosPagoLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-chat-muted">Cargando...</div>
            ) : step === 'cliente' ? (
              <TerceroForm
                tipoInicial="cliente"
                metodosPago={metodosPago}
                onSuccess={close}
                onCancel={() => setStep('menu')}
                valoresIniciales={{
                  telefono: formatWaId(conversation.waId),
                  ...(conversation.contactName ? { nombre: conversation.contactName } : {}),
                }}
              />
            ) : (
              <VentasForm clienteIdInicial={conversation.terceroId ?? undefined} onSaved={close} onCancel={() => setStep('menu')} sendDirectMessage={sendDirectMessage} />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
