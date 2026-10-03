import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listCodeProviders } from '@/modules/code-providers';

export function CategoryCodeProviderSelect({ value, onChange }: {
  value?: string | null; onChange: (value: string | null) => void;
}) {
  return <div className="space-y-1.5">
    <Label htmlFor="category-code-provider">Proveedor de códigos</Label>
    <Select value={value || 'none'} onValueChange={(key) => onChange(key === 'none' ? null : key)}>
      <SelectTrigger id="category-code-provider"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin proveedor</SelectItem>
        {listCodeProviders().map((provider) => <SelectItem key={provider.key} value={provider.key}>
          {provider.label}
        </SelectItem>)}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">Habilita la entrega por código en las cuentas de esta categoría.</p>
  </div>;
}
