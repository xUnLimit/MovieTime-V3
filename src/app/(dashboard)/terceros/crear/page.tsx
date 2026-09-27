'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { TerceroForm } from '@/components/terceros/TerceroForm';
import { useMetodosPagoTerceros } from '@/hooks/use-metodos-pago-terceros';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Solo se permite volver a rutas internas del chat: evita redirecciones abiertas.
function safeReturnPath(value: string | null) {
  if (value === '/chats') return value;
  const prefix = '/chats?wa=';
  return value?.startsWith(prefix) && /^\d{8,15}$/.test(value.slice(prefix.length)) ? value : '/terceros';
}

function splitName(fullName: string) {
  const [nombre = '', ...rest] = fullName.trim().split(/\s+/);
  return { nombre, apellido: rest.join(' ') };
}

function CrearTerceroPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: metodosPago = [], isLoading: loading } = useMetodosPagoTerceros();
  const returnPath = safeReturnPath(searchParams.get('volver'));
  const telefono = searchParams.get('telefono');
  const nombre = searchParams.get('nombre');

  const valoresIniciales = useMemo(() => {
    if (!telefono && !nombre) return undefined;
    return {
      ...splitName((nombre ?? '').slice(0, 120)),
      telefono: (telefono ?? '').replace(/[^\d+\s-]/g, '').slice(0, 20),
    };
  }, [nombre, telefono]);

  const goBack = () => {
    router.push(returnPath);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <Link prefetch={false} href={returnPath} aria-label="Volver">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
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
            onSuccess={goBack}
            onCancel={goBack}
            isPage={true}
            valoresIniciales={valoresIniciales}
          />
        )}
      </div>
    </div>
  );
}

export default function CrearTerceroPage() {
  return (
    <ModuleErrorBoundary moduleName="Crear Tercero">
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando...</div>}>
        <CrearTerceroPageContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
