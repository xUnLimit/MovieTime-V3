'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { VentasForm } from '@/components/ventas/VentasForm';

export default function CrearVentaPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nueva Venta" trail={[{ label: 'Crear' }]} />

      <div className="bg-card border rounded-lg p-6">
        <VentasForm />
      </div>
    </div>
  );
}
