import { describe, expect, it, vi } from "vitest";

import type { ServicioFormData } from "@/features/servicios/servicio-form-schema";
import type { Categoria, MetodoPago, Servicio, Tercero, VentaDoc } from "@/types";

import {
  buildCredentialUpdateWhatsAppMessages,
  buildServicioFormPayload,
  getBillingCycleMonths,
  getCicloLabel,
  getEstadoLabel,
  getPerfilCapacityError,
  getSimboloMoneda,
  getTipoPlanLabel,
  handleDecimalInputKeyDown,
  handleIntegerInputKeyDown,
} from "./servicio-form-helpers";

const fechaInicio = new Date("2026-05-01T00:00:00.000Z");
const fechaVencimiento = new Date("2026-06-01T00:00:00.000Z");

function buildServicioFormData(
  overrides: Partial<ServicioFormData> = {},
): ServicioFormData {
  return {
    nombre: "Netflix Principal",
    categoriaId: "cat-1",
    tipoPlan: "premium",
    correo: "servicio@example.com",
    contrasena: "secret",
    metodoPagoId: "mp-1",
    costoServicio: "12.50",
    perfilesDisponibles: "5",
    cicloPago: "mensual",
    fechaInicio,
    fechaVencimiento,
    estado: "activo",
    renovacionAutomatica: true,
    diasReposo: "28",
    notas: "nota",
    ...overrides,
  };
}

describe("servicio-form-helpers", () => {
  it("builds the servicio payload with denormalized names and reposo dates", () => {
    const data = buildServicioFormData({ estado: "reposo" });
    const payload = buildServicioFormPayload({
      categoria: { id: "cat-1", nombre: "Streaming" } as Categoria,
      data,
      metodoPago: { id: "mp-1", nombre: "Yappy", moneda: "USD" } as MetodoPago,
      servicio: { gastosTotal: 25 } as Servicio,
      tipoPlan: { id: "premium", nombre: "Premium" },
    });

    expect(payload).toMatchObject({
      nombre: "Netflix Principal",
      categoriaNombre: "Streaming",
      tipo: "premium",
      tipoNombre: "Premium",
      costoServicio: 12.5,
      perfilesDisponibles: 5,
      metodoPagoNombre: "Yappy",
      moneda: "USD",
      activo: false,
      enReposo: true,
      diasReposo: 28,
      fechaInicioReposo: fechaInicio,
      renovacionAutomatica: true,
      gastosTotal: 25,
    });
    expect(payload.fechaFinReposo).toEqual(new Date("2026-05-29T00:00:00.000Z"));
  });

  it("returns a capacity error only when an active servicio would hide occupied profiles", () => {
    expect(
      getPerfilCapacityError({
        estado: "activo",
        perfilesDisponibles: 2,
        perfilesOcupados: 3,
      }),
    ).toContain("3 perfiles");

    expect(
      getPerfilCapacityError({
        estado: "reposo",
        perfilesDisponibles: 2,
        perfilesOcupados: 3,
      }),
    ).toBeNull();
  });

  it("builds credential update WhatsApp messages using venta phones first", () => {
    const ventas = [
      {
        id: "venta-1",
        clienteId: "tercero-1",
        clienteNombre: "Ana Perez",
        clienteTelefono: "+50760000000",
        servicioNombre: "Netflix",
        categoriaNombre: "Streaming",
        perfilNumero: 2,
        precioFinal: 9.99,
        codigo: "ABC",
      },
      {
        id: "venta-2",
        clienteId: "tercero-2",
        clienteNombre: "Luis Gomez",
        clienteTelefono: "",
        servicioNombre: "Netflix",
      },
    ] as VentaDoc[];
    const terceros = [
      { id: "tercero-2", telefono: "507 6111-2222" },
    ] as Tercero[];

    const messages = buildCredentialUpdateWhatsAppMessages({
      changes: { correo: true, contrasena: false },
      servicio: {
        nombre: "Netflix Nuevo",
        categoriaNombre: "Streaming",
        correo: "nuevo@example.com",
        contrasena: "secret",
      },
      terceros,
      ventas,
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      id: "venta-1",
      phone: "+50760000000",
      title: "Credenciales listas para enviar",
    });
    expect(messages[1]).toMatchObject({
      id: "venta-2",
      phone: "50761112222",
    });
    expect(messages[0].message).toContain("nuevo@example.com");
  });

  it.each([
    ['mensual', 1], ['trimestral', 3], ['semestral', 6], ['anual', 12], ['otro', 1],
  ])('maps billing cycle %s to months', (cycle, months) => {
    expect(getBillingCycleMonths(cycle as ServicioFormData['cicloPago'])).toBe(months);
  });

  it.each([
    ['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'],
    ['anual', 'Anual'], ['otro', 'Seleccionar período'],
  ])('labels cycle %s', (cycle, label) => expect(getCicloLabel(cycle)).toBe(label));

  it.each([
    ['activo', 'Activo'], ['inactivo', 'Inactivo'], ['reposo', 'Reposo'], ['otro', 'Seleccionar estado'],
  ])('labels state %s', (state, label) => expect(getEstadoLabel(state)).toBe(label));

  it('labels plan types and currency symbols with fallbacks', () => {
    const types = [{ id: 'basic', nombre: 'Básico' }];
    expect(getTipoPlanLabel('', types)).toBe('Seleccionar tipo');
    expect(getTipoPlanLabel('basic', types)).toBe('Básico');
    expect(getTipoPlanLabel('missing', types)).toBe('Seleccionar tipo');
    expect(getSimboloMoneda()).toBe('$');
    expect(getSimboloMoneda('usd')).toBe('$');
    expect(getSimboloMoneda('unknown', 'PA')).toBe('UNKNOWN');
    expect(getSimboloMoneda('EUR', 'ES')).toBe('€');
  });

  it('handles singular capacity errors and valid active capacity', () => {
    expect(getPerfilCapacityError({ estado: 'activo', perfilesDisponibles: 0, perfilesOcupados: 1 }))
      .toContain('1 perfil actualmente ocupado');
    expect(getPerfilCapacityError({ estado: 'activo', perfilesDisponibles: 2, perfilesOcupados: 2 })).toBeNull();
  });

  it('builds active payload defaults without resting dates', () => {
    const payload = buildServicioFormPayload({
      data: buildServicioFormData({ estado: 'activo', diasReposo: '', notas: '' }),
      tipoPlan: { id: 'premium', nombre: 'Premium' },
    });
    expect(payload).toEqual(expect.objectContaining({
      categoriaNombre: '', metodoPagoNombre: undefined, moneda: undefined,
      activo: true, enReposo: false, diasReposo: undefined,
      fechaInicioReposo: undefined, fechaFinReposo: undefined, gastosTotal: 0,
    }));
    const rest = buildServicioFormPayload({
      data: buildServicioFormData({ estado: 'reposo', diasReposo: '' }),
      tipoPlan: { id: 'premium', nombre: 'Premium' },
    });
    expect(rest.diasReposo).toBe(28);
  });

  it('builds credential messages with missing phones and client ids', () => {
    const messages = buildCredentialUpdateWhatsAppMessages({
      changes: { correo: false, contrasena: true },
      servicio: { nombre: 'Netflix', categoriaNombre: 'Streaming', correo: 'a@b.com', contrasena: 'new' },
      template: 'Hola {cliente}', terceros: [],
      ventas: [{ id: 'v1', clienteNombre: 'Ana', clienteId: '', clienteTelefono: '' }] as VentaDoc[],
    });
    expect(messages[0]).toEqual(expect.objectContaining({
      phone: '', title: 'Credenciales sin telefono',
    }));
    expect(messages[0]?.description).toContain('no tiene telefono');
  });

  function keyEvent(key: string, value = '', ctrlKey = false, metaKey = false) {
    return { key, ctrlKey, metaKey, currentTarget: { value }, preventDefault: vi.fn() };
  }

  it('permits controls and numeric decimal input while blocking invalid or duplicate separators', () => {
    const control = keyEvent('Backspace'); handleDecimalInputKeyDown(control); expect(control.preventDefault).not.toHaveBeenCalled();
    const ctrl = keyEvent('v', '', true); handleDecimalInputKeyDown(ctrl); expect(ctrl.preventDefault).not.toHaveBeenCalled();
    const digit = keyEvent('5'); handleDecimalInputKeyDown(digit); expect(digit.preventDefault).not.toHaveBeenCalled();
    const invalid = keyEvent('x'); handleDecimalInputKeyDown(invalid); expect(invalid.preventDefault).toHaveBeenCalledOnce();
    const duplicate = keyEvent('.', '1.2'); handleDecimalInputKeyDown(duplicate); expect(duplicate.preventDefault).toHaveBeenCalledOnce();
  });

  it('permits integer controls/modifiers and blocks non-digits', () => {
    const control = keyEvent('Tab'); handleIntegerInputKeyDown(control); expect(control.preventDefault).not.toHaveBeenCalled();
    const meta = keyEvent('v', '', false, true); handleIntegerInputKeyDown(meta); expect(meta.preventDefault).not.toHaveBeenCalled();
    const digit = keyEvent('3'); handleIntegerInputKeyDown(digit); expect(digit.preventDefault).not.toHaveBeenCalled();
    const invalid = keyEvent('.'); handleIntegerInputKeyDown(invalid); expect(invalid.preventDefault).toHaveBeenCalledOnce();
  });
});
