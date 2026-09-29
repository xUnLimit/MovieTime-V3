import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import type { MetodoPagoFormData } from './schema';
import { BasicInfoSection } from './BasicInfoSection';

function setPointer(fine: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: fine, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
}

const register: UseFormRegister<MetodoPagoFormData> = (name) => ({
  name, onChange: vi.fn(), onBlur: vi.fn(), ref: vi.fn(),
});
const errors: FieldErrors<MetodoPagoFormData> = {};
const setValue: UseFormSetValue<MetodoPagoFormData> = vi.fn();

function renderSection() {
  return render(
    <BasicInfoSection
      register={register}
      errors={errors}
      setValue={setValue}
      asociadoAValue={undefined}
      paisValue={undefined}
      monedaValue={undefined}
      paisSearch=""
      setPaisSearch={vi.fn()}
      onCancel={vi.fn()}
      onNext={vi.fn()}
    />,
  );
}

afterEach(() => setPointer(false));

describe('BasicInfoSection country search focus', () => {
  it('focuses the country search with a mouse or trackpad', async () => {
    setPointer(true);
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /Seleccionar país/ }));
    expect(document.activeElement).toBe(await screen.findByPlaceholderText('Buscar país...'));
  });

  it('leaves focus alone on touch devices', async () => {
    setPointer(false);
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /Seleccionar país/ }));
    expect(document.activeElement).not.toBe(await screen.findByPlaceholderText('Buscar país...'));
  });
});
