import { useState } from 'react';
import type { UseFormSetError } from 'react-hook-form';

import type { VentaEditFormData } from '@/components/ventas/form/venta-edit-form-schema';
import {
  validateVentaEditDatosStep,
  type VentaEditDatosStepField,
} from './venta-edit-controller-helpers';

type VentaEditTab = 'datos' | 'preview';

type UseVentaEditStepNavigationParams = {
  categoriaId: string | undefined;
  clienteId: string | undefined;
  fechaFin: Date;
  fechaInicio: Date;
  metodoPagoId: string | undefined;
  perfilNumero: string | undefined;
  planId: string | undefined;
  servicioId: string | undefined;
  setError: UseFormSetError<VentaEditFormData>;
};

export function useVentaEditStepNavigation({
  categoriaId,
  clienteId,
  fechaFin,
  fechaInicio,
  metodoPagoId,
  perfilNumero,
  planId,
  servicioId,
  setError,
}: UseVentaEditStepNavigationParams) {
  const [activeTab, setActiveTab] = useState<VentaEditTab>('datos');
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);

  const handleNext = async () => {
    const stepErrors = validateVentaEditDatosStep({
      categoriaId: categoriaId ?? '',
      clienteId: clienteId ?? '',
      fechaFin,
      fechaInicio,
      metodoPagoId: metodoPagoId ?? '',
      perfilNumero: perfilNumero ?? '',
      planId: planId ?? '',
      servicioId: servicioId ?? '',
    });
    if (Object.keys(stepErrors).length > 0) {
      Object.entries(stepErrors).forEach(([field, message]) => {
        setError(field as VentaEditDatosStepField, {
          type: 'manual',
          message,
        });
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
    setActiveTab(value as VentaEditTab);
  };

  return {
    activeTab,
    handleNext,
    handleTabChange,
    isDatosTabComplete,
    setActiveTab,
  };
}
