'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { TerceroDetails } from '@/components/terceros/TerceroDetails';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useTerceroDetail } from '@/hooks/use-entity-detail';
import { deleteTerceroMutation } from '@/application/client-domain-mutations';
import { isUuid } from '@/platform/utils/safety';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';

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
        <PageHeader title="Tercero no encontrado" />
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
        <PageHeader title="Tercero no encontrado" trail={[{ label: 'Detalles' }]} />
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
      toast.error('Error al eliminar tercero', { description: getPublicErrorMessage(error, 'No se pudo eliminar el tercero.') });
    }
  };

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          title={`${usuario.nombre} ${usuario.apellido}`}
          trail={[{ label: `${usuario.nombre} ${usuario.apellido}` }]}
          actions={
            <>
              <Button asChild variant="outline">
                <Link prefetch={false} href={`/terceros/editar/${usuario.id}`}>
                  <Pencil />
                  Editar
                </Link>
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 />
                Eliminar
              </Button>
            </>
          }
        />

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


