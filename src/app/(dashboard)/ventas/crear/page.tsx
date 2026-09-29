'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { VentasForm } from '@/components/ventas/VentasForm';

export default function CrearVentaPage() {
  return (
    <div className="flex min-h-full flex-col gap-4">
      <PageHeader title="Nueva Venta" trail={[{ label: 'Crear' }]} />

      <div className="flex flex-1 flex-col p-1 sm:rounded-lg sm:border sm:bg-card sm:p-4">
        <VentasForm />
      </div>
    </div>
  );
}
