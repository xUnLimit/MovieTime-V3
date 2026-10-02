"use client";
import { CatalogView } from '@/components/catalog/CatalogView';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useAuthStore } from '@/store/authStore';
export default function Page() {
  const user = useAuthStore(state => state.user);
  if (user?.role !== 'admin') return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <ModuleErrorBoundary moduleName="catalogo"><CatalogView /></ModuleErrorBoundary>;
}
