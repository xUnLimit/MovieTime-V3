'use client';

import { AutomationNavigation } from '@/components/bot/AutomationNavigation';
import { AutomationSettingsForm } from '@/components/configuracion/AutomationSettingsForm';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutomationControl } from '@/hooks/use-automation-control';
import { useAuthStore } from '@/store/authStore';

export default function AutomationConfigurationPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const control = useAutomationControl();
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <div className="min-w-0 space-y-4"><PageHeader title="Conexiones y automatización" description="Reservas, compras nuevas, accesos e integraciones." /><AutomationNavigation />{control.isLoading ? <Skeleton className="h-96 w-full" /> : control.isError ? <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudo cargar la configuración.</p><Button variant="outline" onClick={() => void control.refetch()}>Reintentar</Button></div> : control.data ? <AutomationSettingsForm control={control.data} /> : null}</div>;
}
