'use client';

import { WhatsAppText } from '@/components/chats/WhatsAppText';
import { renderFreeText } from '@/modules/messaging/message-data';
import { paramsFromData, renderMetaBody, type MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { SAMPLE_MESSAGE_DATA } from './sample-data';

const BUBBLE = 'whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-card px-3 py-2 text-sm leading-snug shadow-sm';

type TemplatePreviewProps = {
  contenido: string;
  meta: MetaTemplateInfo | null;
  paramMap: string[];
};

// Las dos caras del tipo con datos de ejemplo: texto libre y plantilla de Meta.
export function TemplatePreview({ contenido, meta, paramMap }: TemplatePreviewProps) {
  const free = contenido.trim() ? renderFreeText(contenido, SAMPLE_MESSAGE_DATA) : '';
  const metaText = meta ? renderMetaBody(meta.body, paramsFromData(paramMap, SAMPLE_MESSAGE_DATA)) : '';

  return (
    <div className="space-y-3" aria-label="Vista previa">
      <h3 className="text-sm font-semibold">Vista previa con datos de ejemplo</h3>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Texto libre (wa.me y ventana abierta)</p>
        <div className="rounded-xl bg-muted/40 p-3" data-testid="preview-free">
          {free ? (
            <p className={BUBBLE}><WhatsAppText text={free} /></p>
          ) : (
            <p className="text-xs text-muted-foreground">Escribe el mensaje para ver la vista previa.</p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Plantilla de Meta (API)</p>
        <div className="space-y-2 rounded-xl bg-muted/40 p-3" data-testid="preview-meta">
          {meta ? (
            <>
              <div className={BUBBLE}>
                {meta.header ? <p className="font-semibold">{meta.header}</p> : null}
                <WhatsAppText text={metaText} />
                {meta.footer ? <p className="mt-1 text-xs text-muted-foreground">{meta.footer}</p> : null}
              </div>
              {meta.buttons.map((button) => (
                <p key={`${button.type}-${button.text}`} className="rounded-2xl bg-card px-3 py-2 text-center text-sm font-medium text-primary shadow-sm">{button.text}</p>
              ))}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Este tipo no tiene plantilla de Meta vinculada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
