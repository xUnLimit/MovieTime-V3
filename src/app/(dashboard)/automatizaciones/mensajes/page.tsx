import { Suspense } from 'react';
import { AutomationWorkspace } from '@/components/bot/AutomationWorkspace';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

export default function MensajesAutomatizacionPage() {
  return <ModuleErrorBoundary moduleName="Mensajes"><Suspense fallback={<Skeleton className="h-96 w-full" />}><AutomationWorkspace view="mensajes" /></Suspense></ModuleErrorBoundary>;
}
