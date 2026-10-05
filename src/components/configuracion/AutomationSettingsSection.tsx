'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutomationControl } from '@/hooks/use-automation-control';
import { useAuthStore } from '@/store/authStore';
import { AutomationSettingsForm } from './AutomationSettingsForm';

/**
 * Compras por WhatsApp (permiso, reserva, límite), integraciones externas y proveedores de acceso. Antes vivían en
 * Automatizaciones → Conexiones; ahora son secciones de Configuración, solo para administradores.
 */
export function AutomationSettingsSection() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const control = useAutomationControl();
  if (!admin) return null;
  if (control.isLoading) return <Skeleton className="h-96 w-full" />;
  if (control.isError) return <div role="alert" className="space-y-2"><p className="text-sm text-danger">No se pudo cargar la configuración de compras e integraciones.</p><Button variant="outline" onClick={() => void control.refetch()}>Reintentar</Button></div>;
  return control.data ? <AutomationSettingsForm control={control.data} /> : null;
}
