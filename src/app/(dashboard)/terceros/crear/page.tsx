'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { TerceroForm } from '@/components/terceros/TerceroForm';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryKeys } from '@/lib/query-keys';

function CrearTerceroPageContent() {
  const router = useRouter();
  const fetchMetodosPagoTerceros = useMetodosPagoStore((state) => state.fetchMetodosPagoTerceros);
  const { data: metodosPago = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.metodosPago.terceros(),
    queryFn: fetchMetodosPagoTerceros,
  });

  const handleSuccess = () => {
    router.push('/terceros');
  };

  const handleCancel = () => {
    router.push('/terceros');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link prefetch={false} href="/terceros">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nuevo Tercero</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10 sm:ml-10">
            <Link prefetch={false} href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link> / <Link prefetch={false} href="/terceros" className="hover:text-foreground transition-colors">Clientes</Link> / <span className="text-foreground">Crear</span>
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Cargando...</div>
          </div>
        ) : (
          <TerceroForm
            tipoInicial="cliente"
            metodosPago={metodosPago}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            isPage={true}
          />
        )}
      </div>
    </div>
  );
}

export default function CrearTerceroPage() {
  return (
    <ModuleErrorBoundary moduleName="Crear Tercero">
      <CrearTerceroPageContent />
    </ModuleErrorBoundary>
  );
}
