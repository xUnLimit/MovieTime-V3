import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { ServicioDatosBasicosSection } from './ServicioDatosBasicosSection';
import type { ServicioFormData } from './servicio-form-schema';
import type { Categoria } from '@/types';

function Form({ provider }: { provider: string | null }) {
  const form = useForm<ServicioFormData>({ defaultValues: { accesoPorCodigo: true } });
  const category: Categoria = { id: 'cat-1', nombre: 'Cuenta sin nombre de plataforma', tipo: 'cliente',
    codeProvider: provider, activo: true, totalServicios: 0, serviciosActivos: 0, perfilesDisponiblesTotal: 0,
    ventasTotales: 0, ingresosTotales: 0, gastosTotal: 0, createdAt: new Date(), updatedAt: new Date() };
  return <>
    <ServicioDatosBasicosSection categoriaNombre="Seleccionar" categoriasActivas={[category]}
      register={form.register} setValue={form.setValue} errors={form.formState.errors} />
    <output>{String(form.watch('accesoPorCodigo'))}</output>
  </>;
}

describe('service category selection code-access policy', () => {
  it.each([[null, 'false'], ['netflix', 'true']] as const)
  ('resets code access only when the new category has no provider (%s)', async (provider, expected) => {
    render(<Form provider={provider} />);
    const trigger = screen.getByRole('button', { name: 'Seleccionar' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const item = await screen.findByRole('menuitem', { name: 'Cuenta sin nombre de plataforma' });
    fireEvent.click(item);
    expect(screen.getByRole('status').textContent).toBe(expected);
  });
});
