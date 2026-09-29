'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { safeInternalPath } from '@/platform/utils/safety';

function CrearServicioPageContent() {
  const searchParams = useSearchParams();
  const from = safeInternalPath(searchParams.get('from'), '/servicios');

  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Servicio" trail={[{ label: 'Crear' }]} backTo={from} />

      <div className="bg-card border rounded-lg p-6">
        <ServicioForm returnTo={from} />
      </div>
    </div>
  );
}

export default function CrearServicioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
      <CrearServicioPageContent />
    </Suspense>
  );
}
