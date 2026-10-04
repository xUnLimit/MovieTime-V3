import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { addPurchaseFlow, defaultDefinition } from '@/modules/bot-config';
import { BlockOptionRow } from './BlockOptionRow';
import type { FlowActions } from './flow-actions';

const actions = { connect: vi.fn() } as unknown as FlowActions;
const def = addPurchaseFlow(defaultDefinition());
const resumen = def.nodes.find((node) => node.id === 'compra_resumen')!;
const targets = def.nodes.map((node) => ({ id: node.id, name: node.name, exit: node.block === undefined }));
const exits = targets.filter((target) => target.exit);

describe('BlockOptionRow', () => {
  it('muestra la conexión fija con el id si el destino ya no existe', () => {
    const confirm = resumen.options.find((option) => option.id === 'confirm')!;
    render(<ul><BlockOptionRow node={resumen} option={{ ...confirm, next: 'borrado' }} exits={exits} targets={targets} actions={actions} /></ul>);
    expect(screen.getByText('Continúa en borrado (fijo)')).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('pide elegir un destino cuando «cancelar» apunta a un nodo que no es del recorrido', () => {
    const cancel = resumen.options.find((option) => option.id === 'cancel')!;
    render(<ul><BlockOptionRow node={resumen} option={{ ...cancel, next: 'compra_pago' }} exits={exits} targets={targets} actions={actions} /></ul>);
    expect(screen.getByRole('option', { name: 'Elige un destino' })).toBeTruthy();
  });
});
