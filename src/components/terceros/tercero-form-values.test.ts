import { describe, expect, it } from 'vitest';
import type { Tercero } from '@/types';
import { getTerceroFormValues, usuarioSchema } from './tercero-form-values';

describe('valores del formulario de terceros', () => {
  it('aplica los valores sugeridos al crear un cliente', () => {
    expect(getTerceroFormValues(null, 'cliente', { nombre: 'Ana', telefono: '12345678' })).toMatchObject({
      nombre: 'Ana', apellido: '', tipoTercero: 'cliente', telefono: '12345678', notas: '',
    });
  });

  it('restaura los datos de un tercero y normaliza su metodo pendiente', () => {
    const tercero = {
      id: 'tercero-1', nombre: 'Ana', apellido: 'Pérez', tipo: 'revendedor',
      telefono: '12345678', metodoPagoId: '', metodoPagoNombre: '', notas: 'Nota',
      active: true, createdAt: new Date(0), updatedAt: new Date(0), createdBy: 'test',
    } satisfies Tercero;
    const values = getTerceroFormValues(tercero, 'cliente');
    expect(values).toMatchObject({ nombre: 'Ana', tipoTercero: 'revendedor', notas: 'Nota' });
    expect(usuarioSchema.safeParse(values).success).toBe(true);
  });

  it('valida los campos necesarios antes de avanzar', () => {
    expect(usuarioSchema.safeParse(getTerceroFormValues(null, 'cliente')).success).toBe(false);
  });
});
