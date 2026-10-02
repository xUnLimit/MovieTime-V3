import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { getCodeProvider } from '@/modules/code-providers';

export function ServicioCodeAccessCheckbox({ checked, providerKey, onChange, readOnly = false }: {
  checked: boolean; providerKey?: string | null; onChange?: (checked: boolean) => void; readOnly?: boolean;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const available = !!getCodeProvider(providerKey);
  return <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={!available || readOnly}
        aria-describedby={!available ? helpId : undefined}
        onCheckedChange={(value) => onChange?.(value === true)} />
      <Label htmlFor={id}>Entregar acceso por código (no compartir la contraseña)</Label>
    </div>
    {!available && <p id={helpId} className="text-xs text-muted-foreground">
      La categoría no tiene un proveedor de códigos configurado.
    </p>}
  </div>;
}
