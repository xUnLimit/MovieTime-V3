'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { GastosMetrics } from '@/components/gastos/GastosMetrics';
import { GastosTable } from '@/components/gastos/GastosTable';
import { GastoForm } from '@/components/gastos/GastoForm';
import { TipoGastoDialog } from '@/components/gastos/TipoGastoDialog';
import { TiposGastoTable } from '@/components/gastos/TiposGastoTable';
import { useGastos } from '@/hooks/use-gastos';
import { useTiposGasto } from '@/hooks/use-tipos-gasto';
import {
  deleteGastoMutation,
  deleteTipoGastoMutation,
  toggleTipoGastoActivoMutation,
} from '@/application/client-domain-mutations';
import { Gasto, TipoGasto } from '@/types';

function GastosPageContent() {
  const { data: gastos = [], refetch: refetchGastos } = useGastos();
  const { data: tiposGasto = [], refetch: refetchTiposGasto } = useTiposGasto();
  const [activeTab, setActiveTab] = useState('gastos');
  const [gastoDialogOpen, setGastoDialogOpen] = useState(false);
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [gastoToEdit, setGastoToEdit] = useState<Gasto | null>(null);
  const [tipoToEdit, setTipoToEdit] = useState<TipoGasto | null>(null);

  const tiposActivos = tiposGasto.filter((tipo) => tipo.activo);
  const refetchGastosModule = async () => {
    await Promise.all([refetchGastos(), refetchTiposGasto()]);
  };

  const handleCreateGasto = () => {
    setGastoToEdit(null);
    setGastoDialogOpen(true);
  };

  const handleEditGasto = (gasto: Gasto) => {
    setGastoToEdit(gasto);
    setGastoDialogOpen(true);
  };

  const handleCreateTipo = () => {
    setTipoToEdit(null);
    setTipoDialogOpen(true);
  };

  const handleEditTipo = (tipoGasto: TipoGasto) => {
    setTipoToEdit(tipoGasto);
    setTipoDialogOpen(true);
  };

  const handleToggleTipoActivo = async (tipoGasto: TipoGasto) => {
    await toggleTipoGastoActivoMutation(tipoGasto.id);
    await refetchTiposGasto();
  };

  const handleDeleteTipo = async (tipoGasto: TipoGasto) => {
    await deleteTipoGastoMutation(tipoGasto.id);
    await refetchTiposGasto();
  };

  const handleDeleteGasto = async (id: string) => {
    await deleteGastoMutation(id);
    await refetchGastos();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="transition-colors hover:text-foreground">Dashboard</Link> / <span className="text-foreground">Gastos</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-row flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCreateTipo}
            className="whitespace-nowrap"
          >
            <Tags className="mr-2 h-4 w-4" />
            Nuevo tipo
          </Button>
          <Button
            onClick={handleCreateGasto}
            disabled={tiposActivos.length === 0}
            className="whitespace-nowrap"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo gasto
          </Button>
        </div>
      </div>

      <GastosMetrics gastos={gastos} tiposGasto={tiposGasto} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-auto rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="gastos"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-sm data-[state=active]:border-primary"
          >
            Gastos
          </TabsTrigger>
          <TabsTrigger
            value="tipos"
            className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2 text-sm data-[state=active]:border-primary"
          >
            Tipos de gasto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos" className="space-y-4">
          <GastosTable
            gastos={gastos}
            tiposGasto={tiposGasto}
            onEdit={handleEditGasto}
            onDelete={handleDeleteGasto}
          />
        </TabsContent>

        <TabsContent value="tipos" className="space-y-4">
          <TiposGastoTable
            tiposGasto={tiposGasto}
            onEdit={handleEditTipo}
            onToggleActivo={handleToggleTipoActivo}
            onDelete={handleDeleteTipo}
          />
        </TabsContent>
      </Tabs>

      <GastoForm
        open={gastoDialogOpen}
        onOpenChange={setGastoDialogOpen}
        gasto={gastoToEdit}
        tiposGasto={tiposGasto}
        onSaved={refetchGastosModule}
      />

      <TipoGastoDialog
        open={tipoDialogOpen}
        onOpenChange={setTipoDialogOpen}
        tipoGasto={tipoToEdit}
        onSaved={refetchGastosModule}
      />
    </div>
  );
}

export default function GastosPage() {
  return (
    <ModuleErrorBoundary moduleName="Gastos">
      <GastosPageContent />
    </ModuleErrorBoundary>
  );
}
