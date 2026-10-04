'use client';

import { AutomationNavigation } from '@/components/bot/AutomationNavigation';
import { InterestsView } from '@/components/terceros/InterestsView';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuthStore } from '@/store/authStore';

export default function InteresadosPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <div className="space-y-4"><PageHeader title="Interesados" description="Consulta la demanda y gestiona avisos cuando vuelve la disponibilidad." /><AutomationNavigation /><InterestsView /></div>;
}
