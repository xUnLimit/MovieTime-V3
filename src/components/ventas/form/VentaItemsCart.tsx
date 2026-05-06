import { Pencil, Trash2, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { VentaItem } from "@/features/ventas/ventas-form-shared";

interface CategoriaNombre {
  id: string;
  nombre: string;
}

interface VentaItemsCartProps {
  items: VentaItem[];
  categorias: CategoriaNombre[];
  simboloMoneda: string;
  subtotal: number;
  totalFinal: number;
  onEditItem: (item: VentaItem) => void;
  onRemoveItem: (id: string) => void;
}

export function VentaItemsCart({
  items,
  categorias,
  simboloMoneda,
  subtotal,
  totalFinal,
  onEditItem,
  onRemoveItem,
}: VentaItemsCartProps) {
  if (items.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="mb-2">
        <div className="text-sm font-medium">
          Items Agregados ({items.length})
        </div>
      </div>

      <div className="space-y-0.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/10 text-purple-600">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium">
                  {categorias.find((categoria) => categoria.id === item.categoriaId)
                    ?.nombre || item.servicioNombre}
                  {" - "}
                  {item.servicioCorreo || "Sin correo"}
                </p>
                {item.perfilNumero ? (
                  <span className="mt-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-600/10 dark:text-purple-300">
                    {item.perfilNombre
                      ? item.perfilNombre
                      : `Perfil ${item.perfilNumero}`}
                  </span>
                ) : null}
                {item.codigo ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Codigo: {item.codigo}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="mr-2 flex flex-col text-right">
                {item.descuento > 0 ? (
                  <span className="text-[10px] leading-none text-red-400 line-through">
                    {simboloMoneda} {item.precio.toFixed(2)}
                  </span>
                ) : null}
                <span className="font-medium leading-tight">
                  {simboloMoneda} {item.precioFinal.toFixed(2)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onEditItem(item)}
                className="h-8 w-8 text-blue-500 hover:bg-blue-500/10 hover:text-blue-600"
                aria-label="Editar item"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveItem(item.id)}
                className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                aria-label="Eliminar item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-1 border-t pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal original:</span>
          <span className="font-semibold">
            {simboloMoneda} {subtotal.toFixed(2)}
          </span>
        </div>
        {subtotal - totalFinal > 0 ? (
          <div className="flex items-center justify-between text-sm text-red-400">
            <span>Descuento aplicado:</span>
            <span className="font-semibold">
              -{simboloMoneda} {(subtotal - totalFinal).toFixed(2)}
            </span>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between border-t pt-1">
          <span className="text-sm font-medium text-muted-foreground">
            Total final:
          </span>
          <span className="text-sm font-bold text-green-500">
            {simboloMoneda} {totalFinal.toFixed(2)}
          </span>
        </div>
      </div>
    </Card>
  );
}
