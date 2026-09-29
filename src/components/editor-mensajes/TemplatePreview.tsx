'use client';

import { WhatsAppText } from '@/components/chats/WhatsAppText';
import { renderFreeText } from '@/modules/messaging/message-data';
import { paramsFromData, renderMetaBody, type MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { cn } from '@/platform/utils';
import { PhoneMockup } from './PhoneMockup';
import { SAMPLE_MESSAGE_DATA } from './sample-data';

export type PreviewMode = 'api' | 'wame';

const BUBBLE = 'whitespace-pre-wrap break-words rounded-lg rounded-tl-none bg-chat-bubble-in px-2.5 py-1.5 text-sm leading-snug shadow-xs';
const SENT_AT = '3:00 p. m.';

type TemplatePreviewProps = {
  contenido: string;
  meta: MetaTemplateInfo | null;
  paramMap: string[];
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
};

function ModeToggle({ mode, canApi, onModeChange }: { mode: PreviewMode; canApi: boolean; onModeChange: (mode: PreviewMode) => void }) {
  const option = (value: PreviewMode, label: string, disabled = false) => (
    <button
      type="button"
      aria-pressed={mode === value}
      disabled={disabled}
      title={disabled ? 'Vincula una plantilla de Meta para ver el envío automático' : undefined}
      onClick={() => onModeChange(value)}
      className={cn(
        'rounded-md px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40',
        mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Forma de envío a previsualizar" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {option('wame', 'Manual')}
      {option('api', 'Automático', !canApi)}
    </div>
  );
}

function Timestamp() {
  return <span className="mt-0.5 block text-right text-xs text-muted-foreground tabular-nums">{SENT_AT}</span>;
}

// El celular del cliente: recibe el mensaje de MovieTime PTY con datos de ejemplo, con o sin botones de respuesta.
export function TemplatePreview({ contenido, meta, paramMap, mode, onModeChange }: TemplatePreviewProps) {
  const showApi = mode === 'api' && meta !== null;
  const free = contenido.trim() ? renderFreeText(contenido, SAMPLE_MESSAGE_DATA) : '';
  const metaText = meta ? renderMetaBody(meta.body, paramsFromData(paramMap, SAMPLE_MESSAGE_DATA)) : '';

  return (
    <section aria-label="Vista previa" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Así lo ve el cliente</h2>
        <ModeToggle mode={showApi ? 'api' : 'wame'} canApi={meta !== null} onModeChange={onModeChange} />
      </div>

      <PhoneMockup contactName="MovieTime PTY" contactStatus="Cuenta de empresa" mode={showApi ? 'api' : 'wame'}>
        {showApi && meta ? (
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
        ) : free ? (
          <div className={cn(BUBBLE, 'max-w-[92%]')}>
            <WhatsAppText text={free} />
            <Timestamp />
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">Escribe el mensaje para ver cómo le llega al cliente.</p>
        )}
      </PhoneMockup>

      <p className="min-h-8 text-center text-xs text-muted-foreground">
        {showApi ? 'Automático: plantilla de Meta enviada por la API.' : 'Manual: lo envías tú desde wa.me o el chat.'}
        {' '}Datos de ejemplo.
      </p>
    </section>
  );
}
