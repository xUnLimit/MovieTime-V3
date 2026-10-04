import { VentasNavigation } from '@/components/ventas/VentasNavigation';
import { YappyPaymentsView } from '@/components/yappy/YappyPaymentsView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

export default function CobrosPage() {
  return <ModuleErrorBoundary moduleName="Cobros"><div className="space-y-4"><VentasNavigation /><YappyPaymentsView /></div></ModuleErrorBoundary>;
}
