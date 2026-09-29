import type { ReactNode } from 'react';
import { ArrowLeft, BatteryFull, Mic, Phone, Plus, Signal, Video, Wifi } from 'lucide-react';

type PhoneMockupProps = {
  contactName: string;
  contactStatus: string;
  /** Conversacion: burbujas ya armadas. Se desplaza dentro de la pantalla; el celular nunca cambia de tamano. */
  children: ReactNode;
  mode: string;
};

/**
 * Celular de tamano fijo (300 x 600) con barra de estado, cabecera de chat y caja de texto.
 * El contenido largo hace scroll adentro: el marco no crece ni se encoge con el mensaje.
 */
export function PhoneMockup({ contactName, contactStatus, children, mode }: PhoneMockupProps) {
  return (
    <div
      aria-label="Simulación del celular del cliente"
      className="relative mx-auto flex h-[600px] w-[300px] shrink-0 flex-col overflow-hidden rounded-[2.75rem] border-8 border-foreground/85 bg-background shadow-md"
    >
      <span aria-hidden className="absolute top-1.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-foreground/85" />

      <div aria-hidden className="flex h-10 shrink-0 items-end justify-between bg-card px-6 pb-1 text-xs font-medium">
        <span className="tabular-nums">9:41</span>
        <span className="flex items-center gap-1">
          <Signal className="size-3.5" />
          <Wifi className="size-3.5" />
          <BatteryFull className="size-3.5" />
        </span>
      </div>

      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3">
        <ArrowLeft aria-hidden className="size-4 text-muted-foreground" />
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">M</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{contactName}</p>
          <p className="truncate text-xs text-muted-foreground">{contactStatus}</p>
        </div>
        <Video aria-hidden className="size-4 text-muted-foreground" />
        <Phone aria-hidden className="size-4 text-muted-foreground" />
      </div>

      <div data-testid="preview-bubble" data-mode={mode} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-muted/40 p-3">
        <p className="mx-auto w-fit rounded-md bg-card px-2 py-0.5 text-xs text-muted-foreground shadow-xs">Hoy</p>
        {children}
      </div>

      <div aria-hidden className="flex h-14 shrink-0 items-center gap-2 border-t bg-card px-3">
        <Plus className="size-4 text-muted-foreground" />
        <span className="flex h-8 flex-1 items-center rounded-full border bg-background px-3 text-sm text-muted-foreground">Mensaje</span>
        <Mic className="size-4 text-muted-foreground" />
      </div>
    </div>
  );
}
