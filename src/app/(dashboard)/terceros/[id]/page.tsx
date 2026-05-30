'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { TerceroDetails } from '@/components/terceros/TerceroDetails';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Button } from '@/components/ui/button';
import { useTerceroDetail } from '@/hooks/use-entity-detail';
import { deleteTerceroMutation } from '@/application/client-domain-mutations';
import { isUuid } from '@/platform/utils/safety';

function TerceroDetallesPageContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { data: usuario = null, isLoading } = useTerceroDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tercero no encontrado</h1>
        <p className="text-sm text-muted-foreground">El ID del tercero no es valido.</p>
        <Link prefetch={false} href="/terceros" className="text-primary hover:underline">
          Volver a Terceros
        </Link>
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tercero no encontrado</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>{' '}
            /{' '}
            <Link prefetch={false} href="/terceros" className="hover:text-foreground transition-colors">
              Terceros
            </Link>{' '}
            / <span className="text-foreground">Detalles</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-muted-foreground">
            No se encontró el tercero con el ID proporcionado.
          </p>
          <Link prefetch={false}
            href="/terceros"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Volver a Terceros
          </Link>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteTerceroMutation(usuario!.id, undefined, usuario!);
      toast.success(`${usuario?.tipo === 'revendedor' ? 'Revendedor' : 'Cliente'} eliminado`, { description: 'El tercero ha sido eliminado correctamente del sistema.' });
      router.push('/terceros');
    } catch (error) {
      toast.error('Error al eliminar tercero', { description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link prefetch={false} href="/terceros">
              <Button variant="outline" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{usuario.nombre} {usuario.apellido}</h1>
              <p className="text-sm text-muted-foreground">
                <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
                {' / '}
                <Link prefetch={false} href="/terceros" className="hover:text-foreground transition-colors">Terceros</Link>
                {' / '}
                <span className="text-foreground">{usuario.nombre} {usuario.apellido}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link prefetch={false} href={`/terceros/editar/${usuario.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Link>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Eliminar
            </Button>
          </div>
        </div>

        <TerceroDetails usuario={usuario} />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title={`Eliminar ${usuario.tipo === 'revendedor' ? 'Revendedor' : 'Cliente'}`}
        description={`¿Estás seguro de que quieres eliminar a "${usuario.nombre} ${usuario.apellido}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </>
  );
}

export default function TerceroDetallesPage() {
  return (
    <ModuleErrorBoundary moduleName="Detalles de Tercero">
      <TerceroDetallesPageContent />
    </ModuleErrorBoundary>
  );
}


