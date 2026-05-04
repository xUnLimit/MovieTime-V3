'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CrearServicioPageContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/servicios';

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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nuevo Servicio</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <Link href="/servicios" className="hover:text-foreground transition-colors">Servicios</Link> / <span className="text-foreground">Crear</span>
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <ServicioForm returnTo={from} />
      </div>
    </div>
  );
}

export default function CrearServicioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
      <CrearServicioPageContent />
    </Suspense>
  );
}
