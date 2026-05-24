"use client";

import { Card } from "@/components/ui/card";
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
    <div className="text-center py-8 text-muted-foreground">
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
          ? "ml-2 rounded-full bg-green-500/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 text-xs font-medium"
          : "ml-2 rounded-full bg-muted text-muted-foreground px-1.5 py-0.5 text-xs font-medium"
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
    <Tabs defaultValue="activos">
      <TabsList className="bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border justify-start">
        <TabsTrigger
          value="activos"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
        >
          Servicios Activos
          <TabCount count={activeRows.length} tone="active" />
        </TabsTrigger>
        <TabsTrigger
          value="historial"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
        >
          Historial de Ventas
          <TabCount count={inactiveRows.length} tone="muted" />
        </TabsTrigger>
      </TabsList>

      <Card className="p-6 mt-4">
        <TabsContent value="activos">
          <div className="space-y-1 mb-4">
            <h3 className="text-xl font-semibold leading-none">Servicios Activos</h3>
            <p className="text-sm text-muted-foreground">Servicios que este usuario tiene actualmente.</p>
          </div>
          {activeRows.length === 0 ? (
            <EmptyState>No hay servicios activos.</EmptyState>
          ) : (
            <TerceroVentasActiveTable
              rows={activeRows}
              onCopy={onCopy}
              onOpenEstadoDialog={onOpenEstadoDialog}
            />
          )}
        </TabsContent>

        <TabsContent value="historial">
          <div className="space-y-1 mb-4">
            <h3 className="text-xl font-semibold leading-none">Historial de Ventas</h3>
            <p className="text-sm text-muted-foreground">Ventas inactivas o cortadas de este usuario.</p>
          </div>
          {inactiveRows.length === 0 ? (
            <EmptyState>No hay ventas en el historial.</EmptyState>
          ) : (
            <TerceroVentasHistorialTable rows={inactiveRows} />
          )}
        </TabsContent>
      </Card>
    </Tabs>
  );
}
