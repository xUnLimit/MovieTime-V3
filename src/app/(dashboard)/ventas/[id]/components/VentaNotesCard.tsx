import { Card } from '@/components/ui/card';
import { getCurrencySymbol } from '@/platform/constants';
import { formatearFecha } from '@/platform/utils/calculations';
import type { VentaPago } from '@/types';

interface VentaNotesCardProps {
  notas?: string;
  motivoCorte?: string | null;
  reembolsos?: VentaPago[];
}

export function VentaNotesCard({ notas, motivoCorte, reembolsos = [] }: VentaNotesCardProps) {
  const hasMotivoCorte = !!motivoCorte?.trim();
  const reembolsosConDetalle = reembolsos.filter(
    (reembolso) => reembolso.notas?.trim() || reembolso.destinoReembolso?.trim()
  );
  const hasReembolsos = reembolsosConDetalle.length > 0;

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">Notas</h2>
        <div className="rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-line">
          {notas?.trim() ? notas : 'Sin notas'}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Corte y reembolsos</h2>
          <p className="text-sm text-muted-foreground">
            Motivos y notas operativas de esta venta.
          </p>
        </div>

        {hasMotivoCorte ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20">
            <p className="text-xs font-medium uppercase tracking-wide text-orange-700 dark:text-orange-300">
              Motivo de corte
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">{motivoCorte}</p>
          </div>
        ) : null}

        {hasReembolsos ? (
          <div className="space-y-3">
            {reembolsosConDetalle.map((reembolso, index) => {
              const currencySymbol = getCurrencySymbol(reembolso.moneda || 'USD');
              const fecha = reembolso.fecha ? formatearFecha(new Date(reembolso.fecha)) : 'Sin fecha';
              const destino = reembolso.destinoReembolso?.trim() ?? '';
              const nota = reembolso.notas?.trim() ?? '';
              const cuentaLine = destino ? `Cuenta destino del cliente: ${destino}` : '';
              const notaIncluyeCuenta = cuentaLine ? nota.toLowerCase().includes(cuentaLine.toLowerCase()) : false;
              const notaVisible = [cuentaLine && !notaIncluyeCuenta ? cuentaLine : '', nota]
                .filter((line) => line.length > 0)
                .join('\n\n');

              return (
                <div
                  key={reembolso.id || `${reembolso.fecha?.toISOString() ?? 'reembolso'}-${index}`}
                  className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
                      Nota de reembolso
                    </p>
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">
                      -{currencySymbol} {reembolso.total.toFixed(2)} - {fecha}
                    </span>
                  </div>
                  {notaVisible ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-foreground">{notaVisible}</p>
                  ) : null}
                  {reembolso.metodoPagoNombre ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Metodo: {reembolso.metodoPagoNombre}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {!hasMotivoCorte && !hasReembolsos ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            Sin motivos de corte ni notas de reembolso.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
