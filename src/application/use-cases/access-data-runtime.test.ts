import { beforeEach, describe, expect, it, vi } from 'vitest';

const stores = vi.hoisted(() => ({
  access: { eligibleSales: vi.fn() },
  notices: { loadVentas: vi.fn(), loadTemplate: vi.fn() },
}));
vi.mock('@/modules/messaging/access-data-store', () => ({ createAccessDataStore: () => stores.access }));
vi.mock('@/modules/messaging/notice-store', () => ({ createNoticeStore: () => stores.notices }));

import type { NoticeVenta } from '@/modules/messaging/message-data';
import { createAccessData } from './access-data-runtime';

const now = new Date('2026-10-06T15:00:00.000Z');
const waId = '50765331751';
const sale = { saleId: 'v1', service: 'Disney+ Premium', profile: 'Ana', codeOnly: false };
const venta = (overrides: Partial<NoticeVenta> = {}): NoticeVenta => ({
  ventaId: 'v1', clienteId: 'c1', clienteNombre: 'Ana Pérez', telefono: '+507 6533-1751', categoriaNombre: 'Disney+', servicioNombre: 'Disney+ Premium',
  perfilNombre: 'Ana', correo: 'ana@movietimepty.top', contrasena: 'clave-secreta', codigo: '1234', fechaVencimiento: new Date('2026-11-05T12:00:00'),
  monto: 8, moneda: 'USD', activa: true, reembolsada: false, enReposo: false, promesaPagoHasta: null, respuestaCliente: null, ...overrides,
});
const template = { contenido: 'Hola {nombre_cliente}\nCorreo: {correo}\nContraseña: {contrasena}\nPerfil: {perfil}', metaTemplateName: null, metaParamMap: [], metaButtonActions: [] };

beforeEach(() => {
  stores.access.eligibleSales.mockReset().mockResolvedValue({ clienteId: 'c1', sales: [sale] });
  stores.notices.loadVentas.mockReset().mockResolvedValue([venta()]);
  stores.notices.loadTemplate.mockReset().mockResolvedValue(template);
});

describe('createAccessData.eligible', () => {
  it('ofrece las ventas del número sin ningún dato secreto', async () => {
    await expect(createAccessData(() => now).eligible(waId)).resolves.toEqual([{ saleId: 'v1', service: 'Disney+ Premium', profile: 'Ana' }]);
    expect(stores.access.eligibleSales).toHaveBeenCalledWith(waId);
  });
});

describe('createAccessData.compose', () => {
  it('arma los datos con su plantilla independiente y guarda en el chat la versión sin contraseña', async () => {
    const composed = await createAccessData(() => now).compose(waId, 'v1');
    expect(stores.notices.loadTemplate).toHaveBeenCalledWith('datos_acceso');
    expect(stores.notices.loadTemplate).not.toHaveBeenCalledWith('suscripcion');
    expect(stores.notices.loadVentas).toHaveBeenCalledWith(['v1']);
    expect(composed?.text).toContain('Correo: ana@movietimepty.top');
    expect(composed?.text).toContain('clave-secreta');
    expect(composed?.stored).toContain('Correo: ana@movietimepty.top');
    expect(composed?.stored).not.toContain('clave-secreta');
    expect(composed?.withheld).toBe(false);
  });

  it('marca como retenido un servicio que entra con código', async () => {
    stores.access.eligibleSales.mockResolvedValue({ clienteId: 'c1', sales: [{ ...sale, codeOnly: true }] });
    stores.notices.loadVentas.mockResolvedValue([venta({ contrasena: '', codigo: '' })]);
    const composed = await createAccessData(() => now).compose(waId, 'v1');
    expect(composed?.withheld).toBe(true);
    expect(composed?.text).not.toContain('clave-secreta');
  });

  it('no devuelve nada de una venta que no es de ese número', async () => {
    expect(await createAccessData(() => now).compose(waId, 'otra')).toBeNull();
    stores.access.eligibleSales.mockResolvedValue({ clienteId: null, sales: [] });
    expect(await createAccessData(() => now).compose(waId, 'v1')).toBeNull();
    expect(stores.notices.loadVentas).not.toHaveBeenCalled();
  });

  it('no devuelve datos si la venta cambió de dueño o dejó de estar vigente', async () => {
    for (const changed of [{ clienteId: 'otro' }, { activa: false }, { reembolsada: true }, { enReposo: true }]) {
      stores.notices.loadVentas.mockResolvedValue([venta(changed)]);
      expect(await createAccessData(() => now).compose(waId, 'v1')).toBeNull();
    }
    stores.notices.loadVentas.mockResolvedValue([]);
    expect(await createAccessData(() => now).compose(waId, 'v1')).toBeNull();
  });

  it('sin plantilla de datos activa, o con un texto inválido, no reutiliza la suscripción', async () => {
    stores.notices.loadTemplate.mockResolvedValue(null);
    expect(await createAccessData(() => now).compose(waId, 'v1')).toBeNull();
    stores.notices.loadTemplate.mockResolvedValue({ ...template, contenido: 'x'.repeat(5000) });
    expect(await createAccessData(() => now).compose(waId, 'v1')).toBeNull();
  });

  it('crea sus dependencias al primer uso y las reutiliza', async () => {
    const access = createAccessData(() => now);
    await access.eligible(waId);
    await access.compose(waId, 'v1');
    expect(stores.access.eligibleSales).toHaveBeenCalledTimes(2);
  });
});
