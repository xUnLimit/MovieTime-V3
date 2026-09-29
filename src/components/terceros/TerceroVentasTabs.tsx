"use client";

import { TableCard } from "@/components/shared/TableCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { TerceroVentasActiveTable } from "./TerceroVentasActiveTable";
import { TerceroVentasHistorialTable } from "./TerceroVentasHistorialTable";
import type { TerceroDetailsRow } from "./useTerceroDetailsController";

interface TerceroVentasTabsProps {
  activeRows: TerceroDetailsRow[];
  inactiveRows: TerceroDetailsRow[];
  onCopy: (value: string, label?: string) => void;
  onOpenEstadoDialog: (modo: "activar" | "inactivar", row: TerceroDetailsRow) => void;
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <p>{children}</p>
    </div>
  );
}

function TabCount({ count, tone }: { count: number; tone: "active" | "muted" }) {
  if (count === 0) return null;

  return (
    <span
      className={
        tone === "active"
          ? "ml-2 rounded-full bg-success-subtle px-1.5 py-0.5 text-xs font-medium text-success"
          : "ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {count}
    </span>
  );
}

export function TerceroVentasTabs({
  activeRows,
  inactiveRows,
  onCopy,
  onOpenEstadoDialog,
}: TerceroVentasTabsProps) {
  return (
    <Tabs defaultValue="activos" className="gap-4">
      <TabsList>
        <TabsTrigger value="activos">
          Servicios Activos
          <TabCount count={activeRows.length} tone="active" />
        </TabsTrigger>
        <TabsTrigger value="historial">
          Historial de Ventas
          <TabCount count={inactiveRows.length} tone="muted" />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="activos">
        <TableCard title="Servicios Activos" description="Servicios que este usuario tiene actualmente.">
          {activeRows.length === 0 ? (
            <EmptyState>No hay servicios activos.</EmptyState>
          ) : (
            <TerceroVentasActiveTable
              rows={activeRows}
              onCopy={onCopy}
              onOpenEstadoDialog={onOpenEstadoDialog}
            />
          )}
        </TableCard>
      </TabsContent>

      <TabsContent value="historial">
        <TableCard title="Historial de Ventas" description="Ventas inactivas o cortadas de este usuario.">
          {inactiveRows.length === 0 ? (
            <EmptyState>No hay ventas en el historial.</EmptyState>
          ) : (
            <TerceroVentasHistorialTable rows={inactiveRows} />
          )}
        </TableCard>
      </TabsContent>
    </Tabs>
  );
}
