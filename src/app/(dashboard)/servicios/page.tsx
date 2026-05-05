'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { CategoriasTable } from '@/components/servicios/CategoriasTable';
import { ServiciosMetrics } from '@/components/servicios/ServiciosMetrics';
import { useCategoriasStore } from '@/store/categoriasStore';
import { useServiciosStore } from '@/store/serviciosStore';
import { useDashboardStore } from '@/store/dashboardStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

function ServiciosPageContent() {
  const { categorias, fetchCategorias } = useCategoriasStore();
  const { fetchServicios } = useServiciosStore();
  const { fetchDashboardStats } = useDashboardStore();

  // Cargar datos iniciales (siempre refresca para mostrar datos actualizados)
  useEffect(() => {
    fetchCategorias(true);
    fetchServicios(true);
    fetchDashboardStats();
  }, [fetchCategorias, fetchServicios, fetchDashboardStats]);

  // Refrescar cuando el usuario vuelve a la página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCategorias(true);
        fetchServicios(true);
        fetchDashboardStats(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCategorias, fetchServicios, fetchDashboardStats]);

  // Refrescar cuando se navega de vuelta a esta página desde otra ruta
  useEffect(() => {
    const handleFocus = () => {
      fetchCategorias(true);
      fetchServicios(true);
      fetchDashboardStats(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchCategorias, fetchServicios, fetchDashboardStats]);

  // Escuchar cuando se elimina un servicio desde otra página
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'servicio-deleted') {
        fetchCategorias(true);
        fetchServicios(true);
      }
    };

    const handleServicioDeleted = () => {
      fetchCategorias(true);
      fetchServicios(true);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('servicio-deleted', handleServicioDeleted);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('servicio-deleted', handleServicioDeleted);
    };
  }, [fetchCategorias, fetchServicios]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Servicios</span>
          </p>
        </div>
        <Link href="/servicios/crear" className="self-start sm:self-auto">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Servicio
          </Button>
        </Link>
      </div>

      <ServiciosMetrics />

      <CategoriasTable
        categorias={categorias}
        title="Todas las categorías"
      />
    </div>
  );
}

export default function ServiciosPage() {
  return (
    <ModuleErrorBoundary moduleName="Servicios">
      <ServiciosPageContent />
    </ModuleErrorBoundary>
  );
}
