'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { MetodoPagoForm } from '@/components/metodos-pago/MetodoPagoForm';
import { getById, COLLECTIONS } from '@/lib/firebase/firestore';
import type { MetodoPago } from '@/types';
import { toast } from 'sonner';

function EditarMetodoPagoPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/metodos-pago';
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetodoPago = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await getById<MetodoPago>(COLLECTIONS.METODOS_PAGO, id);
        setMetodoPago(data);
      } catch (error) {
        console.error('Error cargando método de pago:', error);
        toast.error('Error al cargar el método de pago', { description: 'No se pudieron obtener los datos. Intenta nuevamente.' });
        setMetodoPago(null);
      } finally {
        setLoading(false);
      }
    };
    loadMetodoPago();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!metodoPago) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Método de pago no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/metodos-pago" className="hover:text-foreground transition-colors">
              Métodos de Pago
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">
            No se encontró el método de pago con el ID proporcionado.
          </p>
          <Link
            href="/metodos-pago"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Volver a Métodos de Pago
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={from}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar Método de Pago</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/metodos-pago" className="hover:text-foreground transition-colors">
              Métodos de Pago
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-card border rounded-lg p-6">
        <MetodoPagoForm mode="edit" metodoPago={metodoPago} returnTo={from} />
      </div>
    </div>
  );
}

export default function EditarMetodoPagoPage() {
  return (
    <ModuleErrorBoundary moduleName="Editar Método de Pago">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
        <EditarMetodoPagoPageContent />
      </Suspense>
    </ModuleErrorBoundary>
  );
}
