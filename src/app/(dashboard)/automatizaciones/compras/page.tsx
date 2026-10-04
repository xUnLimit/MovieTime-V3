'use client';

import Link from 'next/link';
import { AutomationNavigation } from '@/components/bot/AutomationNavigation';
import { CommerceFlowEditor } from '@/components/compras/CommerceFlowEditor';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Panel } from '@/components/shared/Panel';
import { usePurchaseFlowInCanvas } from '@/hooks/use-purchase-flow-in-canvas';
import { useAuthStore } from '@/store/authStore';

export default function ComprasFlowPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const inCanvas = usePurchaseFlowInCanvas(admin);
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return (
    <ModuleErrorBoundary moduleName="Flujo de compras">
      <div className="min-w-0 space-y-4">
        <PageHeader title="Flujo de compras" description="Mira cómo conversa el bot cuando un cliente compra o renueva, y cambia lo que dice en cada paso." />
        <AutomationNavigation />
        {inCanvas ? (
          <Panel title="Los textos de compras se editan en el lienzo" description="Catálogo, resumen, reserva y pago son bloques cerrados del recorrido.">
            <p className="text-sm text-muted-foreground">
              Abre <Link className="font-medium text-primary underline" href="/automatizaciones">Recorridos</Link>, elige un bloque de compra y cambia sus textos. Las reservas, los pagos y las entregas no se editan.
            </p>
          </Panel>
        ) : <CommerceFlowEditor />}
      </div>
    </ModuleErrorBoundary>
  );
}
