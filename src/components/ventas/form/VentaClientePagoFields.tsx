import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTerceroMetodoPagoNombre } from "@/platform/utils/terceroMetodoPago";
import type { Tercero } from "@/types/clientes";

interface MetodoPagoOption {
  id: string;
  nombre: string;
}

interface VentaClientePagoFieldsProps {
  clienteSeleccionado?: Tercero;
  tercerosFiltrados: Tercero[];
  searchCliente: string;
  metodoPagoId?: string;
  metodoPagoNombre?: string;
  metodosPago: MetodoPagoOption[];
  clienteError?: string;
  metodoPagoError?: string;
  onSearchClienteChange: (value: string) => void;
  onSelectTercero: (usuario: Tercero) => void;
  onSelectMetodoPago: (metodoId: string) => void;
}

export function VentaClientePagoFields({
  clienteSeleccionado,
  tercerosFiltrados,
  searchCliente,
  metodoPagoId,
  metodoPagoNombre,
  metodosPago,
  clienteError,
  metodoPagoError,
  onSearchClienteChange,
  onSelectTercero,
  onSelectMetodoPago,
}: VentaClientePagoFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Cliente / Revendedor</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between"
            >
              {clienteSeleccionado ? (
                <span>
                  {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                  {clienteSeleccionado.telefono ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {clienteSeleccionado.telefono}
                    </span>
                  ) : null}
                  <span className="ml-2 text-xs text-muted-foreground">
                    (
                    {clienteSeleccionado.tipo === "cliente"
                      ? "Cliente"
                      : "Revendedor"}
                    )
                  </span>
                </span>
              ) : (
                "Seleccionar tercero"
              )}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div
              className="border-b p-2"
              onKeyDown={(event) => event.stopPropagation()}
            >
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar tercero..."
                  value={searchCliente}
                  onChange={(event) => onSearchClienteChange(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="h-8 pl-8"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {tercerosFiltrados.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No se encontraron terceros
                </div>
              ) : (
                tercerosFiltrados.map((usuario) => (
                  <DropdownMenuItem
                    key={usuario.id}
                    onClick={() => onSelectTercero(usuario)}
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {usuario.nombre} {usuario.apellido}
                      </span>
                      {usuario.telefono ? (
                        <span className="text-xs">
                          <span className="text-foreground"> - </span>
                          <span className="text-green-400">
                            {usuario.telefono}
                          </span>
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        (
                        {usuario.tipo === "cliente"
                          ? "Cliente"
                          : "Revendedor"}
                        )
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        {clienteError ? (
          <p className="text-sm text-red-500">{clienteError}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>Método de pago</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              type="button"
              className="w-full justify-between"
            >
              {metodoPagoId
                ? getTerceroMetodoPagoNombre(metodoPagoId, metodoPagoNombre)
                : "Seleccionar método de pago"}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {metodosPago.map((metodo) => (
              <DropdownMenuItem
                key={metodo.id}
                onClick={() => onSelectMetodoPago(metodo.id)}
              >
                {metodo.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {metodoPagoError ? (
          <p className="text-sm text-red-500">{metodoPagoError}</p>
        ) : null}
      </div>
    </div>
  );
}
