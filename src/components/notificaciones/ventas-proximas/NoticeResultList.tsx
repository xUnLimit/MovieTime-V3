import { Button } from '@/components/ui/button';
import type { NoticeResult } from '@/platform/api/whatsapp-notices-client';

import { needsWaMeFallback, noticeReasonLabel } from './notice-helpers';

const STATUS_LABEL: Record<NoticeResult['status'], string> = {
  accepted: 'Enviado por WhatsApp API',
  already_sent: 'Ya se había enviado',
  failed: 'No se pudo enviar',
  skipped: 'Omitido',
  uncertain: 'Envío incierto, revisa antes de reenviar',
  wa_me: 'Requiere WhatsApp manual',
};

interface NoticeResultListProps {
  results: NoticeResult[];
  onOpenWhatsApp: (result: NoticeResult) => void;
}

export function NoticeResultList({ results, onOpenWhatsApp }: NoticeResultListProps) {
  return (
    <ul className="space-y-2" aria-label="Resultado del envío">
      {results.map((result, index) => (
        <li key={result.noticeId ?? `${result.clienteNombre}-${index}`} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-medium">{result.clienteNombre}</span>
            <span className="block text-xs text-muted-foreground">
              {STATUS_LABEL[result.status]}
              {result.error && result.status !== 'accepted' && result.status !== 'already_sent'
                ? `: ${noticeReasonLabel(result)}`
                : ''}
            </span>
          </span>
          {needsWaMeFallback(result.status) ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenWhatsApp(result)}>
              Abrir en WhatsApp
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
