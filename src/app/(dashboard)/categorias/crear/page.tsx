'use client';

import { CategoriaForm } from '@/components/categorias/CategoriaForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';

function CrearCategoriaPageContent() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nueva Categoría" trail={[{ label: 'Crear' }]} />

      {/* Form Card */}
      <div className="bg-card border rounded-lg p-6">
        <CategoriaForm mode="create" />
      </div>
    </div>
  );
}

export default function CrearCategoriaPage() {
  return (
    <ModuleErrorBoundary moduleName="Nueva Categoría">
      <CrearCategoriaPageContent />
    </ModuleErrorBoundary>
  );
}
