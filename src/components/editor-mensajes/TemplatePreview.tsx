'use client';

import { WhatsAppText } from '@/components/chats/WhatsAppText';
import { renderFreeText } from '@/modules/messaging/message-data';
import { paramsFromData, renderMetaBody, type MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { cn } from '@/platform/utils';
import type { SendMode } from './MethodSwitch';
import { PanelFooter, PanelHeader } from './PanelFrame';
import { PhoneMockup } from './PhoneMockup';
import { SAMPLE_MESSAGE_DATA } from './sample-data';

const BUBBLE = 'whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-chat-bubble-in px-2.5 py-1.5 text-sm leading-snug shadow-xs';
const SENT_AT = '3:00 p. m.';

type TemplatePreviewProps = {
  contenido: string;
  meta: MetaTemplateInfo | null;
  paramMap: string[];
  /** Lo decide el selector Manual / Automatico del editor: el celular siempre muestra lo mismo que el panel. */
  mode: SendMode;
};

function Timestamp() {
  return <span className="mt-0.5 block text-right text-xs text-muted-foreground tabular-nums">{SENT_AT}</span>;
}

// El celular del cliente: recibe el mensaje de MovieTime PTY con datos de ejemplo, con o sin botones de respuesta.
export function TemplatePreview({ contenido, meta, paramMap, mode }: TemplatePreviewProps) {
  const free = contenido.trim() ? renderFreeText(contenido, SAMPLE_MESSAGE_DATA) : '';
  const metaText = meta ? renderMetaBody(meta.body, paramsFromData(paramMap, SAMPLE_MESSAGE_DATA)) : '';

  const conversation = () => {
    if (mode === 'api') {
      if (!meta) return <p className="text-center text-xs text-muted-foreground">Vincula una plantilla para ver cómo llega el envío automático.</p>;
      return (
        <div className="max-w-[92%] space-y-1">
          <div className={BUBBLE}>
            {meta.header ? <p className="font-semibold">{meta.header}</p> : null}
            <WhatsAppText text={metaText} />
            {meta.footer ? <p className="mt-1 text-xs text-muted-foreground">{meta.footer}</p> : null}
            <Timestamp />
          </div>
          {meta.buttons.map((button, index) => (
            <p key={`${button.type}-${index}`} className="rounded-lg bg-chat-bubble-in px-3 py-2 text-center text-sm font-medium text-primary shadow-xs">{button.text}</p>
          ))}
        </div>
      );
    }
    if (!free) return <p className="text-center text-xs text-muted-foreground">Escribe el mensaje para ver cómo le llega al cliente.</p>;
    return (
      <div className={cn(BUBBLE, 'max-w-[92%]')}>
        <WhatsAppText text={free} />
        <Timestamp />
      </div>
    );
  };

  return (
    <section aria-label="Vista previa" className="flex h-full min-w-0 flex-col bg-muted/40">
      <PanelHeader
        tone="strong"
        title="Así lo ve el cliente"
        description="Con datos de ejemplo"
        actions={<span className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium">{mode === 'api' ? 'Automático' : 'Manual'}</span>}
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <PhoneMockup contactName="MovieTime PTY" contactStatus="Cuenta de empresa" mode={mode}>
          {conversation()}
        </PhoneMockup>
      </div>

      <PanelFooter tone="strong" className="justify-center">
        <p className="truncate text-xs text-muted-foreground">
          {mode === 'api' ? 'Automático: plantilla de Meta enviada por la API.' : 'Manual: lo envías tú desde wa.me o el chat.'}
        </p>
      </PanelFooter>
    </section>
  );
}
