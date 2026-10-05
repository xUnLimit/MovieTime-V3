'use client';

import { Suspense } from 'react';

import { PlantillasView } from '@/components/plantillas/PlantillasView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';

// La guarda va antes de la vista: un operador no ve ni consulta plantillas ni avisos.
function PlantillasMensajesContent() {
  const admin = useAuthStore((state) => state.user?.role === 'admin');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <PlantillasView />;
}

export default function PlantillasMensajesPage() {
  return (
    <ModuleErrorBoundary moduleName="Plantillas de mensajes">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PlantillasMensajesContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
