import { describe, expect, it } from 'vitest';

import { toCloudApiBody } from './outbound-payload';

type ListBody = { interactive: { action: { button: string; sections: { title: string; rows: Record<string, unknown>[] }[] } } };

describe('toCloudApiBody list', () => {
  it('agrupa las filas por sección conservando el orden y sin enviar el campo section', () => {
    const body = toCloudApiBody('50760000000', {
      kind: 'list', body: 'Elige', buttonLabel: 'Elegir',
      rows: [
        { id: 'a', title: 'Netflix', section: 'Plataformas' },
        { id: 'b', title: 'Disney+', description: 'USD 4.00', section: 'Plataformas' },
        { id: 'c', title: 'Revisar carrito', section: 'Tu carrito' },
      ],
    }) as unknown as ListBody;
    const { sections } = body.interactive.action;
    expect(sections.map(section => section.title)).toEqual(['Plataformas', 'Tu carrito']);
    expect(sections[0].rows).toEqual([{ id: 'a', title: 'Netflix' }, { id: 'b', title: 'Disney+', description: 'USD 4.00' }]);
    expect(JSON.stringify(sections)).not.toContain('section');
  });

  it('usa una sola sección "Opciones" cuando las filas no declaran sección', () => {
    const body = toCloudApiBody('50760000000', { kind: 'list', body: 'Elige', buttonLabel: 'Elegir', rows: [{ id: 'a', title: 'Uno' }, { id: 'b', title: 'Dos' }] }) as unknown as ListBody;
    expect(body.interactive.action.sections).toEqual([{ title: 'Opciones', rows: [{ id: 'a', title: 'Uno' }, { id: 'b', title: 'Dos' }] }]);
  });
});
