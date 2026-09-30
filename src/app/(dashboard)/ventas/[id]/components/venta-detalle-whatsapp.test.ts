import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ announce: vi.fn(), generate: vi.fn() }));
vi.mock('@/components/shared/renewal-whatsapp-notice', () => ({ announceRenewal: mocks.announce }));
vi.mock('@/platform/utils/whatsapp', () => ({ generarMensajeVenta: mocks.generate }));

import { showVentaRenovadaWhatsAppToast } from './venta-detalle-whatsapp';

const venta = { id: 'v1', clienteNombre: 'Ana Pérez', clienteTelefono: '6000-0000', servicioNombre: 'Netflix A', categoriaNombre: 'Netflix' } as never;
const base = { data: { fechaVencimiento: new Date('2026-10-28T12:00:00') }, monto: 12, servicioContrasena: 'secret', venta };
const template = { contenido: 'Renovado {categoria}' } as never;

describe('showVentaRenovadaWhatsAppToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReturnValue('Renovado Netflix');
  });

  it('prepares the wa.me message when the dialog asked to notify the customer', () => {
    const enqueue = vi.fn();
    showVentaRenovadaWhatsAppToast({ ...base, enqueueWhatsAppMessages: enqueue, notificarCliente: true, templateRenovacion: template });
    expect(mocks.announce).toHaveBeenCalledWith({
      ventaId: 'v1', clienteNombre: 'Ana Pérez', enqueueWhatsAppMessages: enqueue,
      waMessage: { phone: '6000-0000', message: 'Renovado Netflix' },
    });
  });

  it.each([
    ['the dialog did not ask to notify', { notificarCliente: false, templateRenovacion: template }],
    ['there is no renewal template', { notificarCliente: true, templateRenovacion: undefined }],
  ])('announces without a wa.me message when %s', (_name, extra) => {
    showVentaRenovadaWhatsAppToast({ ...base, enqueueWhatsAppMessages: vi.fn(), ...extra });
    expect(mocks.announce).toHaveBeenCalledWith(expect.objectContaining({ ventaId: 'v1', waMessage: null }));
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it('announces without a wa.me message when the text cannot be rendered', () => {
    mocks.generate.mockImplementation(() => { throw new Error('bad template'); });
    showVentaRenovadaWhatsAppToast({ ...base, enqueueWhatsAppMessages: vi.fn(), notificarCliente: true, templateRenovacion: template });
    expect(mocks.announce).toHaveBeenCalledWith(expect.objectContaining({ waMessage: null }));
  });
});
