'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/shared/Panel';
import { useCommerceCopy, useSaveCommerceCopy } from '@/hooks/use-commerce-copy';
import { COPY_CATALOG, type CopyKey, type CopyStepId } from '@/modules/commerce-copy/catalog';
import { FLOW_STEPS, copyKeysOfStep } from '@/modules/commerce-copy/flow';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { CopyEditor } from './CopyEditor';
import { FlowStepCard } from './FlowStepCard';

/** Mapa de la conversacion de compras con sus textos editables. Cambia lo que dice el bot, no sus reglas. */
export function CommerceFlowEditor() {
  const copy = useCommerceCopy();
  const save = useSaveCommerceCopy();
  const [selected, setSelected] = useState<CopyKey | null>(null);
  const editor = useRef<HTMLDivElement>(null);

  if (copy.isLoading) return <Skeleton className="h-96 w-full" />;
  if (copy.isError || !copy.data) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-sm text-danger">No se pudieron cargar los mensajes del flujo.</p>
        <Button variant="outline" onClick={() => void copy.refetch()}>Reintentar</Button>
      </div>
    );
  }
  const { overrides } = copy.data;

  const choose = (key: CopyKey) => {
    setSelected(key);
    // En pantallas angostas el editor queda debajo del mapa: se lleva a la vista.
    requestAnimationFrame(() => editor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const jump = (id: CopyStepId) => document.getElementById(`paso-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const persist = (key: CopyKey) => (text: string | null) => save.mutate({ key, text }, {
    onSuccess: () => toast.success(text === null ? 'Texto original restaurado.' : 'Mensaje guardado. El bot lo usa desde ya.'),
    onError: error => toast.error(getPublicErrorMessage(error, 'No se pudo guardar el mensaje. Intenta de nuevo.')),
  });

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        {FLOW_STEPS.map((step, index) => (
          <FlowStepCard key={step.id} step={step} number={index + 1} keys={copyKeysOfStep(step.id)} overrides={overrides}
            selected={selected} onSelect={choose} onJump={jump} />
        ))}
      </div>
      <div ref={editor} className="min-w-0 scroll-mt-4 lg:sticky lg:top-0">
        {selected ? (
          <CopyEditor key={`${selected}:${overrides[selected] ?? ''}`} copyKey={selected} saved={overrides[selected]}
            saving={save.isPending} onSave={persist(selected)} />
        ) : (
          <Panel title="Edita un mensaje" description="Elige un texto del mapa para cambiarlo.">
            <p className="text-sm text-muted-foreground">
              Hay {Object.keys(COPY_CATALOG).length} textos repartidos en {FLOW_STEPS.length} pasos. Los cambios se aplican enseguida a las conversaciones nuevas.
              Los pasos, los pagos y las reservas no se editan desde aquí.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
