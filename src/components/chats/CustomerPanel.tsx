'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { ExternalLink, FileText, Send, UserPlus, X } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Skeleton } from '@/components/ui/skeleton';
import type { VentaTerceroDoc } from '@/hooks/use-ventas-tercero';
import { cn } from '@/platform/utils/cn';
import { ChatAvatar } from './ChatAvatar';
import { conversationTitle, formatWaId, type ServiceWindow } from './chat-format';
import { suggestTipoByDueDate } from './chat-templates';
import { tipoLabel } from '@/modules/messaging/template-tipos';
import type { TipoTemplate } from '@/types';
import { daysUntil } from './conversation-filters';

type CustomerPanelProps = {
  conversation: WhatsAppConversation;
  serviceWindow: ServiceWindow;
  activas: VentaTerceroDoc[];
  ventasLoading: boolean;
  selectedVentaId: string | null;
  now: Date;
  onSelectVenta: (ventaId: string) => void;
  onOpenTemplate: (tipo: TipoTemplate) => void;
  onClose: () => void;
};

const SECTION_HEADING = 'mb-[15px] text-xs font-semibold uppercase tracking-[0.15em] text-chat-quiet';
const DETAIL_NOTE = 'text-sm leading-[1.55] text-chat-muted';
const DETAIL_ACTION = 'flex min-h-[42px] w-full items-center justify-between gap-2 rounded-md border border-chat-accent-line bg-chat-accent-soft px-3 text-left text-xs text-chat-accent-strong transition-colors hover:bg-chat-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function dueDate(fechaFin: Date) {
  return format(fechaFin, 'd MMM yyyy', { locale: es });
}

function dueText(fechaFin: Date | null, now: Date) {
  if (!fechaFin) return { text: 'Sin vencimiento', tone: 'text-chat-muted' };
  const days = daysUntil(fechaFin, now);
  if (days < 0) return { text: `Venció hace ${-days} ${-days === 1 ? 'día' : 'días'}`, tone: 'text-chat-closed-ink' };
  if (days === 0) return { text: 'Vence hoy', tone: 'text-chat-accent-strong' };
  if (days <= 3) return { text: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'text-chat-accent-strong' };
  return { text: `Vence en ${days} días`, tone: 'text-chat-ink' };
}

export function sortVentasForChat(ventas: readonly VentaTerceroDoc[]) {
  return ventas
    .filter((venta) => venta.estado === 'activo')
    .sort((a, b) => (a.fechaFin?.getTime() ?? Infinity) - (b.fechaFin?.getTime() ?? Infinity));
}

function registerHref(conversation: WhatsAppConversation) {
  const params = new URLSearchParams({ telefono: formatWaId(conversation.waId), volver: `/chats?wa=${conversation.waId}` });
  if (conversation.contactName) params.set('nombre', conversation.contactName);
  return `/terceros/crear?${params.toString()}`;
}

export function CustomerPanel(props: CustomerPanelProps) {
  const {
    conversation, serviceWindow, activas, ventasLoading: isLoading, selectedVentaId, now,
    onSelectVenta, onOpenTemplate, onClose,
  } = props;
  const selected = activas.find((venta) => venta.id === selectedVentaId) ?? null;
  const title = conversationTitle(conversation);
  const suggested = suggestTipoByDueDate(selected?.fechaFin ?? null, now);
  const suggestedLabel = tipoLabel(suggested);

  return (
    <aside aria-label="Ficha del cliente" className="flex h-full min-h-0 flex-col bg-chat-surface text-chat-ink">
      <div className="flex h-[calc(68px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-chat-line-soft px-5 pt-[env(safe-area-inset-top)] md:h-[calc(78px+env(safe-area-inset-top))]">
        <h2 className="text-sm font-semibold">Ficha del cliente</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar ficha" className="grid h-10 w-10 place-items-center rounded-md text-chat-muted transition-colors hover:bg-chat-selected hover:text-chat-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-[19px] w-[19px]" strokeWidth={1.6} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-[22px]">
        <section className="border-b border-chat-line pb-[21px]">
          <div className="flex items-center gap-3">
            <ChatAvatar name={title} seed={conversation.waId} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{title}</p>
              <p className="mt-1 text-xs tabular-nums text-chat-muted">{formatWaId(conversation.waId)}</p>
              {conversation.contactName && conversation.contactName !== title ? (
                <p className="mt-0.5 truncate text-xs text-chat-quiet">En WhatsApp: {conversation.contactName}</p>
              ) : null}
            </div>
          </div>
          {conversation.terceroId ? (
            <Link prefetch={false} href={`/terceros/${conversation.terceroId}`} className="mt-4 inline-flex items-center gap-1 text-xs text-chat-accent underline-offset-4 hover:text-chat-accent-strong hover:underline">
              Abrir cliente <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </section>

        {conversation.terceroId ? (
          <section className="border-b border-chat-line py-[22px]" aria-labelledby="chat-ventas-heading">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="chat-ventas-heading" className={SECTION_HEADING}>
                Servicios activos{activas.length > 0 ? ` (${activas.length})` : ''}
              </h3>
              {selected ? <Link prefetch={false} href={`/ventas/${selected.id}`} className="text-xs text-chat-accent underline-offset-4 hover:text-chat-accent-strong hover:underline">Ver venta</Link> : null}
            </div>
            {isLoading ? (
              <div className="space-y-2" aria-hidden>
                <Skeleton className="h-[52px] w-full rounded-lg" />
                <Skeleton className="h-[52px] w-full rounded-lg" />
              </div>
            ) : activas.length === 0 ? (
              <p className={DETAIL_NOTE}>No tiene servicios activos.</p>
            ) : (
              <ul className="space-y-2" role="radiogroup" aria-label="Servicio para plantillas de Meta">
                {activas.map((venta) => {
                  const isSelected = venta.id === selected?.id;
                  const due = dueText(venta.fechaFin, now);
                  return (
                    <li key={venta.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onSelectVenta(venta.id)}
                        className={cn(
                          'w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected ? 'border-chat-selected-line bg-chat-selected' : 'border-chat-line hover:bg-chat-hover'
                        )}
                      >
                        <span className="block truncate text-sm font-semibold">{venta.categoriaNombre}</span>
                        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs">
                          {venta.fechaFin ? (
                            <>
                              <span className="tabular-nums text-chat-muted">{dueDate(venta.fechaFin)}</span>
                              <span aria-hidden className="text-chat-quiet">·</span>
                            </>
                          ) : null}
                          <span className={cn('font-medium', due.tone)}>{due.text}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : (
          <section className="border-b border-chat-line py-[22px]">
            <h3 className={SECTION_HEADING}>Contexto</h3>
            <p className={DETAIL_NOTE}>Este número no está en tus clientes. La ficha se completará cuando lo registres.</p>
            <Link prefetch={false} href={registerHref(conversation)} className={cn(DETAIL_ACTION, 'mt-4')}>
              <span className="inline-flex items-center gap-2"><UserPlus className="h-4 w-4" aria-hidden /> Registrar cliente</span>
            </Link>
          </section>
        )}

        {selected && !serviceWindow.open ? (
          <section className="border-b border-chat-line py-[22px]" aria-labelledby="chat-acciones-heading">
            <h3 id="chat-acciones-heading" className={cn(SECTION_HEADING, 'mb-[15px]')}>Enviar sobre {selected.categoriaNombre}</h3>
            <button type="button" className={DETAIL_ACTION} onClick={() => onOpenTemplate(suggested)}>
              <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" aria-hidden /> Plantilla: {suggestedLabel}</span>
              <Send className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
            </button>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
