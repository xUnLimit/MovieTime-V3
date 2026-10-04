'use client';

import { AutomationNavigation } from '@/components/bot/AutomationNavigation';
import { CommerceFlowEditor } from '@/components/compras/CommerceFlowEditor';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/store/authStore';

export default function ComprasFlowPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return (
    <ModuleErrorBoundary moduleName="Flujo de compras">
      <div className="min-w-0 space-y-4">
        <PageHeader title="Flujo de compras" description="Mira cómo conversa el bot cuando un cliente compra o renueva, y cambia lo que dice en cada paso." />
        <AutomationNavigation />
        <CommerceFlowEditor />
      </div>
    </ModuleErrorBoundary>
  );
}
