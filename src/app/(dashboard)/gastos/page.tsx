'use client';

import { useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
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
      <PageHeader
        title="Gastos"
        actions={
          <>
            <Button variant="outline" onClick={handleCreateTipo} className="whitespace-nowrap">
              <Tags />
              Nuevo tipo
            </Button>
            <Button onClick={handleCreateGasto} disabled={tiposActivos.length === 0} className="whitespace-nowrap">
              <Plus />
              Nuevo gasto
            </Button>
          </>
        }
      />

      <GastosMetrics gastos={gastos} tiposGasto={tiposGasto} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger
            value="gastos"
          >
            Gastos
          </TabsTrigger>
          <TabsTrigger
            value="tipos"
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
