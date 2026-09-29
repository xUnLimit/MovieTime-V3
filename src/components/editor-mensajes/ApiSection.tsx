'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/platform/utils';
import type { ChannelStatus } from '@/modules/messaging/meta-template-mapping';

const SUMMARY: Record<ChannelStatus, string> = {
  api: 'Se envía sola por la API de WhatsApp.',
  pending: 'Vinculada; Meta aún no la aprueba.',
  wame: 'Sin vincular: el mensaje se envía a mano.',
};

type ApiSectionProps = {
  status: ChannelStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

/** Paso opcional: vincular una plantilla aprobada por Meta para que el mensaje salga automático. Plegado hasta que se necesita. */
export function ApiSection({ status, open, onOpenChange, children }: ApiSectionProps) {
  return (
    <section aria-labelledby="api-section-title" className="rounded-lg border">
      <button
        type="button"
        id="api-section-title"
        aria-expanded={open}
        aria-controls="api-section-body"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">Envío automático por WhatsApp API <span className="font-normal text-muted-foreground">(opcional)</span></span>
          <span className="block text-xs text-muted-foreground">{SUMMARY[status]}</span>
        </span>
        <ChevronDown aria-hidden className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id="api-section-body" className="border-t p-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
