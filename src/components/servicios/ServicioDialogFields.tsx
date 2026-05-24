import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Categoria } from "@/types";
import type { ServicioDialogFormData } from "./servicio-dialog-helpers";

interface ServicioDialogFieldsProps {
  categorias: Categoria[];
  categoriaIdValue: string;
  tipoValue: string;
  renovacionAutomaticaValue: boolean;
  costoTotal: number;
  tiposPlanesDinamicos: NonNullable<Categoria["tiposPlanes"]>;
  errors: FieldErrors<ServicioDialogFormData>;
  register: UseFormRegister<ServicioDialogFormData>;
  setValue: UseFormSetValue<ServicioDialogFormData>;
}

export function ServicioDialogFields({
  categorias,
  categoriaIdValue,
  tipoValue,
  renovacionAutomaticaValue,
  costoTotal,
  tiposPlanesDinamicos,
  errors,
  register,
  setValue,
}: ServicioDialogFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="categoriaId">Categoria</Label>
          <Select
            value={categoriaIdValue}
            onValueChange={(value) => {
              setValue("categoriaId", value);
              setValue("tipo", "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No hay categorias
                </div>
              ) : (
                categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors.categoriaId && (
            <p className="text-sm text-red-500">{errors.categoriaId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre del Servicio</Label>
          <Input id="nombre" {...register("nombre")} placeholder="Ej: Netflix Premium" />
          {errors.nombre && (
            <p className="text-sm text-red-500">{errors.nombre.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tipo">Tipo</Label>
        <Select value={tipoValue} onValueChange={(value) => setValue("tipo", value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tiposPlanesDinamicos.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Selecciona una categoria con tipos de plan
              </div>
            ) : (
              tiposPlanesDinamicos.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          id="correo"
          label="Correo Electronico"
          placeholder="cuenta@servicio.com"
          error={errors.correo?.message}
          inputProps={register("correo")}
          type="email"
        />
        <TextField
          id="contrasena"
          label="Contrasena"
          placeholder="Contrasena de la cuenta"
          error={errors.contrasena?.message}
          inputProps={register("contrasena")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          id="perfilesDisponibles"
          label="Perfiles Disponibles"
          error={errors.perfilesDisponibles?.message}
          inputProps={register("perfilesDisponibles", { valueAsNumber: true })}
          type="number"
          min="1"
        />
        <TextField
          id="costoServicio"
          label="Costo del Servicio"
          placeholder="0.00"
          error={errors.costoServicio?.message}
          inputProps={register("costoServicio", { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
        />
      </div>

      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Costo Total Mensual:</span>
          <span className="text-2xl font-bold">${costoTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label htmlFor="renovacionAutomatica">Renovacion Automatica</Label>
          <p className="text-sm text-muted-foreground">
            El servicio se renovara automaticamente
          </p>
        </div>
        <Switch
          id="renovacionAutomatica"
          checked={Boolean(renovacionAutomaticaValue)}
          onCheckedChange={(checked) => setValue("renovacionAutomatica", checked)}
        />
      </div>

      {renovacionAutomaticaValue && (
        <div className="space-y-2">
          <Label htmlFor="fechaRenovacion">Fecha de Renovacion</Label>
          <Input
            id="fechaRenovacion"
            type="date"
            {...register("fechaRenovacion", { valueAsDate: true })}
          />
        </div>
      )}
    </>
  );
}

function TextField({
  id,
  label,
  inputProps,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  inputProps: ReturnType<UseFormRegister<ServicioDialogFormData>>;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} {...inputProps} />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
