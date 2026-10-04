'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PedidosView } from '@/components/ventas/PedidosView';
import { VentasNavigation } from '@/components/ventas/VentasNavigation';
import { useAuthStore } from '@/store/authStore';

export default function PedidosPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <ModuleErrorBoundary moduleName="Pedidos"><div className="space-y-4"><PageHeader title="Ventas" description="Revisa los pedidos y completa su cobro y entrega." /><VentasNavigation /><PedidosView /></div></ModuleErrorBoundary>;
}
