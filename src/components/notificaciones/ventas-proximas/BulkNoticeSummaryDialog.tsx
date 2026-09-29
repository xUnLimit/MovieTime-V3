'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { NoticeResult } from '@/platform/api/whatsapp-notices-client';

import { NoticeResultList } from './NoticeResultList';
import { needsWaMeFallback, summarizeNoticeResults } from './notice-helpers';

interface BulkNoticeSummaryDialogProps {
  results: NoticeResult[] | null;
  onOpenWhatsApp: (result: NoticeResult) => void;
  onClose: () => void;
}

export function BulkNoticeSummaryDialog({ results, onOpenWhatsApp, onClose }: BulkNoticeSummaryDialogProps) {
  const summary = summarizeNoticeResults(results ?? []);
  const counters = [
    ['Enviados', summary.sent.length],
    ['Ya enviados', summary.alreadySent.length],
    ['Omitidos', summary.skipped.length],
    ['Fallidos', summary.failed.length + summary.waMe.length],
    ['Inciertos', summary.uncertain.length],
  ] as const;
  const pending = (results ?? []).filter((result) => needsWaMeFallback(result.status) || result.status === 'uncertain');

  return (
    <Dialog open={results !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Resumen de avisos</DialogTitle>
          <DialogDescription>
            Los omitidos y fallidos se pueden completar abriendo WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-5 gap-2 text-center">
          {counters.map(([label, count]) => (
            <div key={label} className="rounded-md border p-2">
              <dd className="text-base font-semibold tabular-nums">{count}</dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
        {pending.length > 0 ? (
          <NoticeResultList results={pending} onOpenWhatsApp={onOpenWhatsApp} />
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
