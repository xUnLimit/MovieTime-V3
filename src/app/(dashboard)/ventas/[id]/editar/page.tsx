'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VentasEditForm, VentaEditData } from '@/components/ventas/VentasEditForm';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { COLLECTIONS, getById } from '@/lib/firebase/firestore';
import { getVentaConUltimoPago } from '@/lib/services/ventaSyncService';
import { VentaDoc } from '@/types';
import { toast } from 'sonner';

function EditarVentaPageContent() {
  const params = useParams();
  const id = params.id as string;
  const [venta, setVenta] = useState<VentaEditData | null>(null);

  useEffect(() => {
    const loadVenta = async () => {
      try {
        const doc = await getById<Record<string, unknown>>(COLLECTIONS.VENTAS, id);
        if (!doc) {
          setVenta(null);
          return;
        }
        // Crear VentaDoc base (sin datos de pago)
        const ventaBase: VentaDoc = {
          id: doc.id as string,
          clienteId: (doc.clienteId as string) || '',
          clienteNombre: (doc.clienteNombre as string) || 'Sin cliente',
          categoriaId: (doc.categoriaId as string) || '',
          servicioId: (doc.servicioId as string) || '',
          servicioNombre: (doc.servicioNombre as string) || 'Servicio',
          servicioCorreo: (doc.servicioCorreo as string) || '',
          perfilNumero: (doc.perfilNumero as number | null | undefined) ?? null,
          perfilNombre: (doc.perfilNombre as string) || '',
          codigo: (doc.codigo as string) || '',
          estado: (doc.estado as 'activo' | 'inactivo') || 'activo',
          notas: (doc.notas as string) || '',
          // Denormalized fields (required) - will be populated from PagoVenta
          fechaInicio: (doc.fechaInicio as Date) || new Date(),
          fechaFin: (doc.fechaFin as Date) || new Date(),
          cicloPago: (doc.cicloPago as 'mensual' | 'trimestral' | 'semestral' | 'anual') || 'mensual',
        };

        // Obtener datos actuales desde PagoVenta (fuente de verdad)
        const ventaConDatos = await getVentaConUltimoPago(ventaBase);

        // Convertir a VentaEditData
        setVenta({
          ...ventaConDatos,
          clienteId: ventaConDatos.clienteId || '',
          metodoPagoId: ventaConDatos.metodoPagoId || '',
          categoriaId: ventaConDatos.categoriaId || '',
          servicioId: ventaConDatos.servicioId || '',
          servicioCorreo: ventaConDatos.servicioCorreo || '',
          fechaInicio: ventaConDatos.fechaInicio || new Date(),
          fechaFin: ventaConDatos.fechaFin || new Date(),
        });
      } catch (error) {
        console.error('Error cargando venta:', error);
        toast.error('Error cargando venta', { description: error instanceof Error ? error.message : undefined });
        setVenta(null);
      }
    };

    if (id) {
      loadVenta();
    }
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/ventas/${id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Editar Venta</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link href="/ventas" className="hover:text-foreground transition-colors">
              Ventas
            </Link>{' '}
            /{' '}
            <Link href={`/ventas/${id}`} className="hover:text-foreground transition-colors">
              Detalle
            </Link>{' '}
            / <span className="text-foreground">Editar</span>
          </p>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        {venta ? (
          <VentasEditForm venta={venta} />
        ) : (
          <p className="text-sm text-muted-foreground">No se encontró la venta solicitada.</p>
        )}
      </div>
    </div>
  );
}

export default function EditarVentaPage() {
  return (
    <ModuleErrorBoundary moduleName="Editar Venta">
      <EditarVentaPageContent />
    </ModuleErrorBoundary>
  );
}
