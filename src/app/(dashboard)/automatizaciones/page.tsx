import { Suspense } from 'react';
import { AutomationWorkspace } from '@/components/bot/AutomationWorkspace';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';

export default function AutomatizacionesPage() {
  return <ModuleErrorBoundary moduleName="Automatizaciones"><Suspense fallback={<Skeleton className="h-96 w-full" />}><AutomationWorkspace /></Suspense></ModuleErrorBoundary>;
}
