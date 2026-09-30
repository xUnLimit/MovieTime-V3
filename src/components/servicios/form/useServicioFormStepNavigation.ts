import { useState } from 'react';
import type { UseFormTrigger } from 'react-hook-form';

import type { ServicioFormData } from '@/components/servicios/form/servicio-form-schema';

const SERVICIO_DATOS_FIELDS: Array<keyof ServicioFormData> = [
  'nombre',
  'categoriaId',
  'tipoPlan',
  'correo',
  'contrasena',
  'metodoPagoId',
  'costoServicio',
  'perfilesDisponibles',
  'cicloPago',
  'fechaInicio',
  'fechaVencimiento',
  'estado',
];

type UseServicioFormStepNavigationParams = {
  trigger: UseFormTrigger<ServicioFormData>;
};

export function useServicioFormStepNavigation({
  trigger,
}: UseServicioFormStepNavigationParams) {
  const [activeTab, setActiveTab] = useState('datos');
  const [isDatosTabComplete, setIsDatosTabComplete] = useState(false);

  const handleTabChange = async (value: string) => {
    if (value === 'perfil' && !isDatosTabComplete) {
      const isValid = await trigger(SERVICIO_DATOS_FIELDS);
      if (isValid) {
        setIsDatosTabComplete(true);
        setActiveTab(value);
      }
      return;
    }
    setActiveTab(value);
  };

  const handleNext = async () => {
    const isValid = await trigger(SERVICIO_DATOS_FIELDS);
    if (isValid) {
      setIsDatosTabComplete(true);
      setActiveTab('perfil');
    }
  };

  const handlePrevious = () => {
    setActiveTab('datos');
  };

  return {
    activeTab,
    handleNext,
    handlePrevious,
    handleTabChange,
    isDatosTabComplete,
  };
}
