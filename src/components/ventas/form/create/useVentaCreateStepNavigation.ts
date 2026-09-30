import { useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';

import type { VentaFormData } from '@/components/ventas/form/venta-form-schema';
import type { VentaItem } from '@/components/ventas/form/ventas-form-shared';
import {
  validateVentaCreateDatosStep,
  type VentaCreateDatosStepField,
} from './venta-create-controller-helpers';

type VentaCreateTab = 'datos' | 'preview';

type UseVentaCreateStepNavigationParams = {
  clienteId: string;
  fechaFin: Date;
  fechaInicio: Date;
  items: VentaItem[];
  metodoPagoId: string;
  setError: UseFormSetError<VentaFormData>;
};

export function useVentaCreateStepNavigation({
  clienteId,
  fechaFin,
  fechaInicio,
  items,
  metodoPagoId,
  setError,
}: UseVentaCreateStepNavigationParams) {
  const [activeTab, setActiveTab] = useState<VentaCreateTab>('datos');
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);

  const handleNext = async () => {
    const stepErrors = validateVentaCreateDatosStep({
      clienteId,
      fechaFin,
      fechaInicio,
      metodoPagoId,
    });

    if (Object.keys(stepErrors).length > 0) {
      Object.entries(stepErrors).forEach(([field, message]) => {
        setError(field as VentaCreateDatosStepField, {
          type: 'manual',
          message,
        });
      });
      return;
    }

    if (items.length === 0) {
      toast.error('Sin servicios', {
        description: 'Agrega al menos un servicio antes de continuar.',
      });
      return;
    }
    setIsDatosTabComplete(true);
    setActiveTab('preview');
  };

  const handleTabChange = async (value: string) => {
    if (value === 'preview' && !isDatosTabComplete) {
      await handleNext();
      return;
    }
    setActiveTab(value as VentaCreateTab);
  };

  return {
    activeTab,
    handleNext,
    handleTabChange,
    isDatosTabComplete,
    setActiveTab,
  };
}
