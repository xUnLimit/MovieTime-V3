import Link from 'next/link';
import { useState } from 'react';

import { WhatsAppText } from '@/components/chats/WhatsAppText';
import { SAMPLE_MESSAGE_DATA } from '@/components/editor-mensajes/sample-data';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import type { AutomationCard } from '@/modules/messaging/automation-cards';
import { renderFreeText } from '@/modules/messaging/message-data';
import { formatDateTime } from './automation-format';

function ChannelBadge({ channel }: { channel: AutomationCard['channel'] }) {
  if (channel.kind === 'text') return <StatusBadge tone="neutral">Texto libre</StatusBadge>;
  return <StatusBadge tone={channel.level}>{channel.statusLabel}</StatusBadge>;
}

function channelSummary(channel: AutomationCard['channel']): string {
  return channel.kind === 'text'
    ? 'Texto libre (dentro de las 24 h)'
    : `Plantilla de Meta ${channel.name}`;
}

export function AutomationCardItem({ card }: { card: AutomationCard }) {
  const [expanded, setExpanded] = useState(false);
  const { activity } = card;
  const preview = card.contenido.trim() ? renderFreeText(card.contenido, SAMPLE_MESSAGE_DATA) : '';
  return (
    <article className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{card.label}</h3><ChannelBadge channel={card.channel} /></div>
      <p className="text-xs text-muted-foreground">Cuándo se envía: {card.cuando}.</p>
      <p className="text-xs text-muted-foreground tabular-nums">Últimos 30 días: {activity.sent} enviados · {activity.failed} fallidos · {activity.lastSentAt ? `último envío ${formatDateTime(activity.lastSentAt)}` : 'sin envíos'}</p>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link href={`/automatizaciones?mensaje=${card.tipo}`} aria-label={`Editar mensaje ${card.label}`}>Editar mensaje</Link></Button><Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ocultar detalles' : 'Ver mensaje y condiciones'}</Button></div>
      {expanded ? <>
      <dl className="space-y-1 text-sm">
        <div><dt className="sr-only">Quién lo dispara</dt><dd className="font-medium">{card.triggers.join(' · ')}</dd></div>
        <div><dt className="sr-only">Detalle</dt><dd className="text-xs text-muted-foreground">{card.detail}</dd></div>
        <div><dt className="sr-only">Canal</dt><dd className="text-xs text-muted-foreground">{channelSummary(card.channel)}</dd></div>
      </dl>

      {card.buttons.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium">Botones de la plantilla</h3>
          <ul aria-label={`Botones de ${card.label}`} className="space-y-0.5 text-xs text-muted-foreground">
            {card.buttons.map((button, index) => (
              <li key={`${button.text}-${index}`}><span className="font-medium text-foreground">{button.text}</span> → {button.actionLabel}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-xs font-medium">Texto vigente (datos de ejemplo)</h3>
        {preview ? (
          <p className="line-clamp-6 whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 text-sm leading-snug"><WhatsAppText text={preview} /></p>
        ) : (
          <p className="text-xs text-muted-foreground">Todavía no hay texto guardado para este mensaje.</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground tabular-nums">
        30 días: {activity.sent} enviados · {activity.failed} fallidos · {activity.skipped} omitidos
        {' · '}{activity.lastSentAt ? `último envío ${formatDateTime(activity.lastSentAt)}` : 'sin envíos'}
      </p>
      </> : null}
    </article>
  );
}
