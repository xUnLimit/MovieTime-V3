'use client';

import { useEffect, useState } from 'react';
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
import { useGastosStore } from '@/store/gastosStore';
import { useTiposGastoStore } from '@/store/tiposGastoStore';
import { Gasto, TipoGasto } from '@/types';

function GastosPageContent() {
  const { gastos, fetchGastos, deleteGasto } = useGastosStore();
  const { tiposGasto, fetchTiposGasto, toggleActivo } = useTiposGastoStore();
  const [activeTab, setActiveTab] = useState('gastos');
  const [gastoDialogOpen, setGastoDialogOpen] = useState(false);
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [gastoToEdit, setGastoToEdit] = useState<Gasto | null>(null);
  const [tipoToEdit, setTipoToEdit] = useState<TipoGasto | null>(null);

  useEffect(() => {
    fetchGastos();
    fetchTiposGasto();
  }, [fetchGastos, fetchTiposGasto]);

  const tiposActivos = tiposGasto.filter((tipo) => tipo.activo);

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
    await toggleActivo(tipoGasto.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Gastos</h1>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">Dashboard</Link> / <span className="text-foreground">Gastos</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleCreateTipo}
            className="sm:self-auto"
          >
            <Tags className="mr-2 h-4 w-4" />
            Nuevo tipo
          </Button>
          <Button
            onClick={handleCreateGasto}
            disabled={tiposActivos.length === 0}
            className="sm:self-auto"
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
            onDelete={deleteGasto}
          />
        </TabsContent>

        <TabsContent value="tipos" className="space-y-4">
          <TiposGastoTable
            tiposGasto={tiposGasto}
            onEdit={handleEditTipo}
            onToggleActivo={handleToggleTipoActivo}
          />
        </TabsContent>
      </Tabs>

      <GastoForm
        open={gastoDialogOpen}
        onOpenChange={setGastoDialogOpen}
        gasto={gastoToEdit}
        tiposGasto={tiposGasto}
      />

      <TipoGastoDialog
        open={tipoDialogOpen}
        onOpenChange={setTipoDialogOpen}
        tipoGasto={tipoToEdit}
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
