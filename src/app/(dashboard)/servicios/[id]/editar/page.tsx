'use client';

import Link from 'next/link';
import { useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { isUuid } from '@/lib/utils/safety';
import { useServiciosStore } from '@/store/serviciosStore';

function EditarServicioPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/servicios';
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const servicios = useServiciosStore((state) => state.servicios);
  const fetchServicios = useServiciosStore((state) => state.fetchServicios);

  useEffect(() => {
    if (!id) return;
    fetchServicios();
  }, [fetchServicios, id]);

  const servicio = useMemo(() =>
    id ? servicios.find(s => s.id === id) : undefined,
    [servicios, id]
  );

  if (!id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Servicio no encontrado</h1>
        <p className="text-sm text-muted-foreground">El ID del servicio no es valido.</p>
        <Link prefetch={false} href="/servicios" className="text-primary hover:underline">
          Volver a Servicios
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link prefetch={false} href={from}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar Servicio</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/servicios" className="hover:text-foreground transition-colors">
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
