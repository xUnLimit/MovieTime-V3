import { MessageCircle } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AutoNoticeRun } from '@/types';
import { AUTO_CAP_MAX, AUTO_CAP_MIN, type useWhatsAppAutoSettings } from './useWhatsAppAutoSettings';

type AutoSettings = ReturnType<typeof useWhatsAppAutoSettings>;

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const STATUS_LABEL: Record<AutoNoticeRun['status'], string> = { running: 'En curso', done: 'Listo', failed: 'Falló' };

export function formatRunDate(runDate: string): string {
  const [year, month, day] = runDate.split('-').map(Number);
  if (!year || !month || !day) return runDate;
  return new Date(year, month - 1, day).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function WhatsAppAutoSection({ settings }: { settings: AutoSettings }) {
  const { autoConfig, runs, runsLoading, draftCap, setDraftCap, isSaving, handleToggle, handleHourChange, handleCapCommit } = settings;
  const disabled = !autoConfig || isSaving;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="whatsapp-auto-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="whatsapp-auto-title" className="flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="h-4 w-4" aria-hidden />WhatsApp automático
          </h3>
          <p className="text-xs text-muted-foreground">
            Envía el aviso &apos;Día de pago&apos; por WhatsApp a las ventas que vencen hoy
          </p>
        </div>
        <Switch
          aria-label="Activar envío automático por WhatsApp"
          checked={autoConfig?.autoEnabled ?? false}
          disabled={disabled}
          onCheckedChange={(checked) => { void handleToggle(checked); }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-auto-hour">Hora de envío (hora de Panamá)</Label>
          <Select
            value={autoConfig ? String(autoConfig.autoSendHour) : undefined}
            disabled={disabled}
            onValueChange={(value) => { void handleHourChange(Number(value)); }}
          >
            <SelectTrigger id="whatsapp-auto-hour" aria-label="Hora de envío">
              <SelectValue placeholder="Selecciona la hora" />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hour) => (
                <SelectItem key={hour} value={String(hour)}>{`${String(hour).padStart(2, '0')}:00`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp-auto-cap">Tope diario de envíos</Label>
          <Input
            id="whatsapp-auto-cap"
            type="number"
            inputMode="numeric"
            min={AUTO_CAP_MIN}
            max={AUTO_CAP_MAX}
            value={draftCap}
            disabled={disabled}
            onChange={(event) => setDraftCap(event.target.value)}
            onBlur={() => { void handleCapCommit(); }}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground">Últimas corridas</h4>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{runsLoading ? 'Cargando...' : 'Aún no hay corridas.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Fecha</th>
                  <th className="px-2 py-1 text-right font-medium">Enviados</th>
                  <th className="px-2 py-1 text-right font-medium">Fallidos</th>
                  <th className="px-2 py-1 text-right font-medium">Omitidos</th>
                  <th className="py-1 pl-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t">
                    <td className="py-1 pr-2">{formatRunDate(run.runDate)}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{run.sent}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{run.failed}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{run.skipped}</td>
                    <td className="py-1 pl-2">{STATUS_LABEL[run.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
