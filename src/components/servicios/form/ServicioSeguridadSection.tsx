import { ServicioCodeAccessCheckbox } from "./ServicioCodeAccessCheckbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ServicioFormBindings } from "./types";

export function ServicioSeguridadSection({
  accesoPorCodigoValue,
  codeProviderKey,
  setValue,
  errors,
  register,
}: ServicioFormBindings & { accesoPorCodigoValue: boolean; codeProviderKey?: string | null }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="correo">Email</Label>
        <Input
          id="correo"
          type="email"
          {...register("correo")}
          placeholder="correo@ejemplo.com"
        />
        {errors.correo && (
          <p className="text-sm text-danger">{errors.correo.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input
          id="contrasena"
          type="text"
          {...register("contrasena")}
          placeholder="Ingrese la contraseña"
        />
        {errors.contrasena && (
          <p className="text-sm text-danger">{errors.contrasena.message}</p>
        )}
      </div>
      <div className="md:col-span-2">
        <ServicioCodeAccessCheckbox checked={accesoPorCodigoValue} providerKey={codeProviderKey}
          onChange={(value) => setValue("accesoPorCodigo", value, { shouldDirty: true, shouldValidate: true })} />
      </div>
    </div>
  );
}
