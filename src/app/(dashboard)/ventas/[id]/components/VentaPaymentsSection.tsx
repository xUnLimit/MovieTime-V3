import { CreditCard } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { VentaPagosTable } from '@/components/ventas/VentaPagosTable';
import type { VentaDoc, VentaPago } from '@/types';

import type { VentaPagoAction } from './types';

interface VentaPaymentsSectionProps {
  paymentRows: VentaPago[];
  venta: VentaDoc;
  onDeletePago: VentaPagoAction;
  onEditarPago: VentaPagoAction;
}

export function VentaPaymentsSection({
  onDeletePago,
  onEditarPago,
  paymentRows,
  venta,
}: VentaPaymentsSectionProps) {
  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <h2 className="text-base font-semibold">Historial de Pagos</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Registro completo de todos los pagos realizados para esta venta.
        </p>
      </div>

      <VentaPagosTable
        pagos={paymentRows}
        moneda={venta.moneda || 'USD'}
        canManagePagos={true}
        onEdit={onEditarPago}
        onDelete={onDeletePago}
      />
    </Card>
  );
}
