'use client';

import Link from 'next/link';
import { useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useServiciosStore } from '@/store/serviciosStore';

function EditarServicioPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/servicios';
  const { servicios, fetchServicios } = useServiciosStore();

  useEffect(() => {
    fetchServicios();
  }, [fetchServicios]);

  const servicio = useMemo(() =>
    servicios.find(s => s.id === params.id),
    [servicios, params.id]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={from}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar Servicio</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/servicios" className="hover:text-foreground transition-colors">
              Servicios
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
      </div>

      {servicio && (
        <div className="bg-card border rounded-lg p-6">
          <ServicioForm servicio={servicio} returnTo={from} />
        </div>
      )}
    </div>
  );
}

export default function EditarServicioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
      <EditarServicioPageContent />
    </Suspense>
  );
}
