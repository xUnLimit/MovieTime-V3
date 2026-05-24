'use client';

import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { TercerosPageView } from './TercerosPageView';
import { useTercerosPageController } from './useTercerosPageController';

function TercerosPageContent() {
  const controller = useTercerosPageController();

  return <TercerosPageView {...controller} />;
}

export default function TercerosPage() {
  return (
    <ModuleErrorBoundary moduleName="Terceros">
      <TercerosPageContent />
    </ModuleErrorBoundary>
  );
}
