'use client';

import { ConfiguracionView } from '@/components/configuracion/ConfiguracionView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/store/authStore';

function ConfiguracionPageContent() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-w-0 space-y-4">
      <PageHeader title="Configuración" description="Vista del dashboard, notificaciones push y envíos automáticos por WhatsApp." />
      {user?.role === 'admin' ? (
        <ConfiguracionView />
      ) : (
        <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>
      )}
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <ModuleErrorBoundary moduleName="Configuración">
      <ConfiguracionPageContent />
    </ModuleErrorBoundary>
  );
}
