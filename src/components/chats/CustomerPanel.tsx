'use client';

import Link from 'next/link';
import { ExternalLink, FileText, UserPlus, X } from 'lucide-react';

import type { WhatsAppConversation } from '@/application/use-cases/whatsapp-chat-use-cases';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { VentaTerceroDoc } from '@/hooks/use-ventas-tercero';
import { cn } from '@/platform/utils/cn';
import { ChatAvatar } from './ChatAvatar';
import { CHAT_TEMPLATES, conversationTitle, formatWaId, type ChatTemplate, type ServiceWindow } from './chat-format';
import { suggestMetaTemplate } from './chat-templates';
import { daysUntil } from './conversation-filters';
import type { QuickReply } from './ChatComposer';

type CustomerPanelProps = {
  conversation: WhatsAppConversation;
  serviceWindow: ServiceWindow;
  activas: VentaTerceroDoc[];
  ventasLoading: boolean;
  selectedVentaId: string | null;
  quickReplies: QuickReply[];
  now: Date;
  onSelectVenta: (ventaId: string) => void;
  onQuickReply: (tipo: QuickReply['tipo']) => void;
  onOpenTemplate: (name: ChatTemplate['name']) => void;
  onClose: () => void;
};

// Acciones mas usadas primero; el resto queda en el menu del cuadro de texto.
const PANEL_ACTIONS: QuickReply['tipo'][] = ['notificacion_regular', 'dia_pago', 'suscripcion', 'renovacion'];

function dueText(fechaFin: Date | null, now: Date) {
  if (!fechaFin) return { text: 'Sin vencimiento', tone: 'text-muted-foreground' };
  const days = daysUntil(fechaFin, now);
  if (days < 0) return { text: `Venció hace ${-days} ${-days === 1 ? 'día' : 'días'}`, tone: 'text-destructive' };
  if (days === 0) return { text: 'Vence hoy', tone: 'text-amber-600 dark:text-amber-400' };
  if (days <= 3) return { text: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`, tone: 'text-amber-600 dark:text-amber-400' };
  return { text: `Vence en ${days} días`, tone: 'text-muted-foreground' };
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
    conversation, serviceWindow, activas, ventasLoading: isLoading, selectedVentaId, quickReplies, now,
    onSelectVenta, onQuickReply, onOpenTemplate, onClose,
  } = props;
  const selected = activas.find((venta) => venta.id === selectedVentaId) ?? null;
  const title = conversationTitle(conversation);
  const actions = quickReplies.filter((reply) => PANEL_ACTIONS.includes(reply.tipo));
  const suggested = suggestMetaTemplate(selected?.fechaFin ?? null, now);
  const suggestedLabel = CHAT_TEMPLATES.find((item) => item.name === suggested)?.label ?? suggested;

  return (
    <aside aria-label="Ficha del cliente" className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">Ficha del cliente</h2>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar ficha">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col items-center gap-2 border-b px-4 py-6 text-center">
          <ChatAvatar name={title} seed={conversation.waId} size="lg" />
          <p className="text-base font-semibold leading-tight">{title}</p>
          <p className="text-sm tabular-nums text-muted-foreground">{formatWaId(conversation.waId)}</p>
          {conversation.contactName && conversation.contactName !== title ? (
            <p className="text-xs text-muted-foreground">En WhatsApp: {conversation.contactName}</p>
          ) : null}
          {conversation.terceroId ? (
            <Link prefetch={false} href={`/terceros/${conversation.terceroId}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
              Abrir cliente <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-muted-foreground">Este número no está en tus clientes.</p>
              <Button asChild size="sm">
                <Link prefetch={false} href={registerHref(conversation)}>
                  <UserPlus className="mr-2 h-4 w-4" aria-hidden /> Registrar cliente
                </Link>
              </Button>
            </div>
          )}
        </section>

        {conversation.terceroId ? (
          <section className="px-4 py-4" aria-labelledby="chat-ventas-heading">
            <h3 id="chat-ventas-heading" className="mb-2 text-xs font-semibold text-muted-foreground">
              Servicios activos{activas.length > 0 ? ` (${activas.length})` : ''}
            </h3>
            {isLoading ? (
              <div className="space-y-2" aria-hidden>
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : activas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tiene servicios activos.</p>
            ) : (
              <ul className="space-y-2" role="radiogroup" aria-label="Venta para llenar mensajes">
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
                          'w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSelected ? 'border-primary bg-primary/10' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-medium">{venta.categoriaNombre}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">${venta.precioFinal.toFixed(2)}</span>
                        </span>
                        <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
                          <span className={due.tone}>{due.text}</span>
                          <span className="truncate text-muted-foreground">
                            {venta.perfilNumero ? `Perfil ${venta.perfilNumero}` : venta.servicioNombre}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {selected ? (
          <section className="border-t px-4 py-4" aria-labelledby="chat-acciones-heading">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 id="chat-acciones-heading" className="text-xs font-semibold text-muted-foreground">Enviar sobre {selected.categoriaNombre}</h3>
              <Link prefetch={false} href={`/ventas/${selected.id}`} className="text-xs text-primary underline-offset-4 hover:underline">Ver venta</Link>
            </div>
            {serviceWindow.open ? (
              <div className="grid gap-1.5">
                {actions.map((reply) => (
                  <Button key={reply.tipo} type="button" variant="secondary" className="justify-start" onClick={() => onQuickReply(reply.tipo)}>
                    {reply.label}
                  </Button>
                ))}
                <p className="pt-1 text-xs text-muted-foreground">El mensaje se llena con los datos de la venta y queda listo para revisar antes de enviar.</p>
              </div>
            ) : (
              <Button type="button" className="w-full justify-start" onClick={() => onOpenTemplate(suggested)}>
                <FileText className="mr-2 h-4 w-4" aria-hidden /> Plantilla: {suggestedLabel}
              </Button>
            )}
          </section>
        ) : null}
      </div>
    </aside>
  );
}
