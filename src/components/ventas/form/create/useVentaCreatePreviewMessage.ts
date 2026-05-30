import { useCallback, useEffect, useMemo } from "react";

import type { VentaItem } from "@/features/ventas/ventas-form-shared";
import { formatearFechaWhatsApp, getSaludo } from "@/platform/utils/whatsapp";
import type { Categoria, Servicio, Tercero } from "@/types";

interface UseVentaCreatePreviewMessageParams {
  categorias: Categoria[];
  categoriaSeleccionada?: Categoria;
  clienteSeleccionado?: Tercero;
  codigo?: string;
  fechaFin?: Date;
  items: VentaItem[];
  onMessageChange: (message: string) => void;
  precioFinal: number;
  servicioSeleccionado?: Servicio;
  serviciosCategoria: Servicio[];
  templateContenido?: string;
  totalFinal: number;
}

function formatItemsList(names: string[]) {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return "—";
  if (cleaned.length === 1) return `*${cleaned[0]}*`;
  if (cleaned.length === 2) return `*${cleaned[0]}* y *${cleaned[1]}*`;

  const first = cleaned
    .slice(0, -1)
    .map((name) => `*${name}*`)
    .join(", ");
  const last = `*${cleaned[cleaned.length - 1]}*`;
  return `${first} y ${last}`;
}

function replaceAllPlaceholders(text: string, values: Record<string, string>) {
  let next = text;
  Object.entries(values).forEach(([key, value]) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(escaped, "g"), value);
  });
  return next;
}

export function useVentaCreatePreviewMessage({
  categorias,
  categoriaSeleccionada,
  clienteSeleccionado,
  codigo,
  fechaFin,
  items,
  onMessageChange,
  precioFinal,
  servicioSeleccionado,
  serviciosCategoria,
  templateContenido,
  totalFinal,
}: UseVentaCreatePreviewMessageParams) {
  const previewItem = items[0];
  const previewServicio = previewItem
    ? serviciosCategoria.find((servicio) => servicio.id === previewItem.servicioId)
    : servicioSeleccionado;
  const previewCategoria = previewItem
    ? categorias.find((categoria) => categoria.id === previewItem.categoriaId)
    : categoriaSeleccionada;
  const previewClienteNombre = clienteSeleccionado
    ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}`
    : "Sin cliente";
  const previewNombreCliente =
    clienteSeleccionado?.nombre ||
    previewClienteNombre.split(" ")[0] ||
    "Cliente";
  const previewFechaVencimiento = previewItem?.fechaFin ?? fechaFin;
  const previewMonto = items.length > 0 ? totalFinal : precioFinal;
  const previewCodigo = previewItem?.codigo || codigo || "—";
  const previewPerfilNombre = previewItem?.perfilNombre?.trim() || "—";
  const previewCorreo =
    previewServicio?.correo || previewItem?.servicioCorreo || "—";
  const previewContrasena =
    previewServicio?.contrasena || previewItem?.servicioContrasena || "—";
  const previewCategoriaNombre =
    previewCategoria?.nombre || previewItem?.servicioNombre || "Servicio";
  const previewServicioNombre =
    previewItem?.servicioNombre || previewServicio?.nombre || "Servicio";
  const itemsList = formatItemsList(
    Array.from(
      new Set(
        items.map(
          (item) =>
            categorias.find((categoria) => categoria.id === item.categoriaId)
              ?.nombre ||
            item.servicioNombre ||
            "Servicio",
        ),
      ),
    ),
  );

  const renderTemplateWithItems = useCallback(
    (template: string, globals: Record<string, string>) => {
      const blockMatch = template.match(/{{#items}}([\s\S]*?){{\/items}}/);
      let content = template;

      if (blockMatch) {
        const block = blockMatch[1].replace(/^\s*\n/, "").replace(/\n\s*$/, "");
        const renderedItems = items
          .map((item) => {
            const servicio = serviciosCategoria.find(
              (currentServicio) => currentServicio.id === item.servicioId,
            );
            const categoria = categorias.find(
              (currentCategoria) => currentCategoria.id === item.categoriaId,
            );
            const itemValues: Record<string, string> = {
              "{servicio}":
                item.servicioNombre || servicio?.nombre || "Servicio",
              "{categoria}":
                categoria?.nombre || item.servicioNombre || "Servicio",
              "{correo}": servicio?.correo || item.servicioCorreo || "—",
              "{contrasena}":
                servicio?.contrasena || item.servicioContrasena || "—",
              "{perfil_nombre}": item.perfilNombre?.trim() || "—",
              "{codigo}": item.codigo || "—",
              "{vencimiento}": item.fechaFin
                ? formatearFechaWhatsApp(new Date(item.fechaFin))
                : "—",
              "{monto}": `$${item.precioFinal?.toFixed(2) || "0.00"}`,
            };
            return replaceAllPlaceholders(block, { ...globals, ...itemValues });
          })
          .join("\n\n");
        content = content.replace(blockMatch[0], renderedItems);
      }

      return replaceAllPlaceholders(content, globals);
    },
    [categorias, items, serviciosCategoria],
  );

  const previewMessage = useMemo(() => {
    const content =
      templateContenido ||
      "No hay plantilla de Notificación de Suscripción configurada.";
    const placeholders: Record<string, string> = {
      "{saludo}": getSaludo(),
      "{cliente}": previewClienteNombre,
      "{nombre_cliente}": previewNombreCliente,
      "{items}": itemsList,
      "{servicio}": previewServicioNombre,
      "{categoria}": previewCategoriaNombre,
      "{perfil_nombre}": previewPerfilNombre,
      "{correo}": previewCorreo,
      "{contrasena}": previewContrasena,
      "{vencimiento}": previewFechaVencimiento
        ? formatearFechaWhatsApp(new Date(previewFechaVencimiento))
        : "—",
      "{monto}": `$${previewMonto.toFixed(2)}`,
      "{codigo}": previewCodigo,
    };
    return renderTemplateWithItems(content, placeholders);
  }, [
    itemsList,
    previewCategoriaNombre,
    previewClienteNombre,
    previewCodigo,
    previewContrasena,
    previewCorreo,
    previewFechaVencimiento,
    previewMonto,
    previewNombreCliente,
    previewPerfilNombre,
    previewServicioNombre,
    renderTemplateWithItems,
    templateContenido,
  ]);

  useEffect(() => {
    onMessageChange(previewMessage);
  }, [onMessageChange, previewMessage]);
}
