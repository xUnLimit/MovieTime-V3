'use client';

import { MetodoPagoForm } from '@/components/metodos-pago/MetodoPagoForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';

function CrearMetodoPagoPageContent() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nuevo Método de Pago" trail={[{ label: 'Crear' }]} />

      {/* Form Card */}
      <div className="bg-card border rounded-lg p-6">
        <MetodoPagoForm mode="create" />
      </div>
    </div>
  );
}

export default function CrearMetodoPagoPage() {
  return (
    <ModuleErrorBoundary moduleName="Nuevo Método de Pago">
      <CrearMetodoPagoPageContent />
    </ModuleErrorBoundary>
  );
}
