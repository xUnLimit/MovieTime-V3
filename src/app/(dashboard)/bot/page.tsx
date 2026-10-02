'use client';

import { BotView } from '@/components/bot/BotView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useAuthStore } from '@/store/authStore';
import { useBotAdmin } from '@/hooks/use-bot-admin';

function AdminBotContent() {
  const api = useBotAdmin();
  return <BotView api={api} />;
}

function BotPageContent() {
  const user = useAuthStore(state => state.user);
  if (user?.role !== 'admin') return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <AdminBotContent />;
}

export default function BotPage() {
  return <ModuleErrorBoundary moduleName="Bot"><BotPageContent /></ModuleErrorBoundary>;
}
