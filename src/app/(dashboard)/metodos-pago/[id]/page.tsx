'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { useMetodoPagoDetail } from '@/hooks/use-entity-detail';
import { deleteMetodoPagoMutation } from '@/lib/client-domain-mutations';
import { isUuid } from '@/platform/utils/safety';
import {
  MetodoPagoAdditionalInfo,
  MetodoPagoBasicInfo,
  MetodoPagoDetailHeader,
  MetodoPagoLoadingState,
  MetodoPagoNotFoundState,
} from './components/MetodoPagoDetailSections';

function VerMetodoPagoPageContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const { data: metodo = null, isLoading } = useMetodoPagoDetail(id);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);

  const handleDelete = async () => {
    if (metodo) {
      try {
        await deleteMetodoPagoMutation(metodo.id, metodo);
        toast.success('Método de pago eliminado', { description: 'El método de pago ha sido eliminado correctamente.' });
        router.push('/metodos-pago');
      } catch (error) {
        toast.error('Error al eliminar método de pago', { description: error instanceof Error ? error.message : undefined });
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`, { description: `${label} copiado al portapapeles exitosamente.` });
  };

  if (isLoading) {
    return <MetodoPagoLoadingState />;
  }

  if (!metodo) {
    return <MetodoPagoNotFoundState />;
  }

  const isTercero = metodo.asociadoA === 'tercero';

  return (
    <div className="space-y-5">
      <MetodoPagoDetailHeader metodo={metodo} onDelete={() => setDeleteDialogOpen(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MetodoPagoBasicInfo metodo={metodo} isTercero={isTercero} />
        <MetodoPagoAdditionalInfo
          metodo={metodo}
          isTercero={isTercero}
          showPassword={showPassword}
          showCardNumber={showCardNumber}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onToggleCardNumber={() => setShowCardNumber(!showCardNumber)}
          onCopy={copyToClipboard}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Eliminar Método de Pago"
        description={`¿Estás seguro de que quieres eliminar el método "${metodo.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}

export default function VerMetodoPagoPage() {
  return (
    <ModuleErrorBoundary moduleName="Ver Método de Pago">
      <VerMetodoPagoPageContent />
    </ModuleErrorBoundary>
  );
}
