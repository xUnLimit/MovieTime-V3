'use client';

import { Suspense } from 'react';
import { BotView } from '@/components/bot/BotView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useBotAdmin } from '@/hooks/use-bot-admin';
import { useAuthStore } from '@/store/authStore';

function AdminAutomationTool() {
  const api = useBotAdmin();
  return <BotView api={api} />;
}

/** Automatizaciones es una sola herramienta: el recorrido de WhatsApp. Solo administradores, y el bot no se consulta sin serlo. */
function AutomatizacionesContent() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <AdminAutomationTool />;
}

export default function AutomatizacionesPage() {
  return <ModuleErrorBoundary moduleName="Automatizaciones"><Suspense fallback={<Skeleton className="h-96 w-full" />}><AutomatizacionesContent /></Suspense></ModuleErrorBoundary>;
}
