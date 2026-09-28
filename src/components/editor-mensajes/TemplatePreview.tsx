'use client';

import { WhatsAppText } from '@/components/chats/WhatsAppText';
import { renderFreeText } from '@/modules/messaging/message-data';
import { paramsFromData, renderMetaBody, type MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { cn } from '@/platform/utils';
import { SAMPLE_MESSAGE_DATA } from './sample-data';

export type PreviewMode = 'api' | 'wame';

const BUBBLE = 'whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-card px-3 py-2 text-sm leading-snug shadow-sm';

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
      title={disabled ? 'Vincula una plantilla de Meta para ver esta vista' : undefined}
      onClick={() => onModeChange(value)}
      className={cn(
        'rounded-md px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40',
        mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
  return (
    <div role="group" aria-label="Tipo de envío a previsualizar" className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {option('api', 'API', !canApi)}
      {option('wame', 'wa.me')}
    </div>
  );
}

// Vista previa estilo WhatsApp con datos de ejemplo; incluye los botones de respuesta rápida.
export function TemplatePreview({ contenido, meta, paramMap, mode, onModeChange }: TemplatePreviewProps) {
  const showApi = mode === 'api' && meta !== null;
  const free = contenido.trim() ? renderFreeText(contenido, SAMPLE_MESSAGE_DATA) : '';
  const metaText = meta ? renderMetaBody(meta.body, paramsFromData(paramMap, SAMPLE_MESSAGE_DATA)) : '';

  return (
    <section aria-label="Vista previa" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Vista previa</h2>
        <ModeToggle mode={showApi ? 'api' : 'wame'} canApi={meta !== null} onModeChange={onModeChange} />
      </div>
      <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[28px] border-4 border-border bg-background shadow-sm">
        <div className="flex items-center gap-2 bg-muted/60 px-4 py-2.5">
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">M</span>
          <span className="text-sm font-medium">María Pérez</span>
        </div>
        <div className="min-h-[280px] space-y-2 bg-muted/20 p-3" data-testid="preview-bubble" data-mode={showApi ? 'api' : 'wame'}>
          {showApi && meta ? (
            <>
              <div className={BUBBLE}>
                {meta.header ? <p className="font-semibold">{meta.header}</p> : null}
                <WhatsAppText text={metaText} />
                {meta.footer ? <p className="mt-1 text-xs text-muted-foreground">{meta.footer}</p> : null}
              </div>
              {meta.buttons.map((button, index) => (
                <p key={`${button.type}-${index}`} className="rounded-2xl bg-card px-3 py-2 text-center text-sm font-medium text-primary shadow-sm">{button.text}</p>
              ))}
            </>
          ) : free ? (
            <p className={BUBBLE}><WhatsAppText text={free} /></p>
          ) : (
            <p className="text-xs text-muted-foreground">Escribe el mensaje para ver la vista previa.</p>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Con datos de ejemplo.</p>
    </section>
  );
}
