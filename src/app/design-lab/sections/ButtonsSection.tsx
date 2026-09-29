import { Download, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { LabRow, LabSection } from './LabSection';

const VARIANTS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const SIZES = ['xs', 'sm', 'default', 'lg'] as const;

export function ButtonsSection() {
  return (
    <LabSection id="botones" title="Botones" description="Un botón primario por vista. El resto, outline o ghost.">
      <div className="space-y-5 rounded-xl border bg-card p-5">
        <LabRow label="Variantes">
          {VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </LabRow>
        <LabRow label="Tamaños (xs · sm · default · lg)">
          {SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </LabRow>
        <LabRow label="Con icono">
          <Button>
            <Plus /> Nueva venta
          </Button>
          <Button variant="outline">
            <Download /> Exportar
          </Button>
          <Button variant="destructive">
            <Trash2 /> Eliminar
          </Button>
        </LabRow>
        <LabRow label="Solo icono con tooltip (aria-label obligatorio)">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Agregar">
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Agregar</TooltipContent>
          </Tooltip>
          <Button size="icon-sm" variant="ghost" aria-label="Eliminar">
            <Trash2 />
          </Button>
          <Button size="icon-xs" variant="ghost" aria-label="Agregar">
            <Plus />
          </Button>
        </LabRow>
        <LabRow label="Estados">
          <Button disabled>Deshabilitado</Button>
          <Button variant="outline" disabled>
            Deshabilitado
          </Button>
        </LabRow>
      </div>
    </LabSection>
  );
}
