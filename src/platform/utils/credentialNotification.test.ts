import { describe, expect, it } from 'vitest';

import {
  buildCredentialUpdateMessage,
  buildServiceTransferMessage,
  changedCredentialsCount,
  getCredentialChangeSummary,
  hasCredentialChanges,
} from './credentialNotification';
import type { Servicio, VentaDoc } from '@/types';

const servicio = {
  nombre: 'Netflix',
  categoriaNombre: 'Streaming',
  correo: 'nuevo@example.com',
  contrasena: 'clave-nueva',
} as Pick<Servicio, 'nombre' | 'categoriaNombre' | 'correo' | 'contrasena'>;

const venta = {
  id: 'venta-1',
  clienteNombre: 'Ana Perez',
  servicioId: 'servicio-1',
  servicioNombre: 'Netflix',
  categoriaId: 'categoria-1',
  categoriaNombre: 'Streaming',
  perfilNombre: 'Ana',
  codigo: '1234',
  precioFinal: 12,
  fechaFin: new Date('2026-06-01T00:00:00.000Z'),
} as VentaDoc;

describe('credential notification helpers', () => {
  it('detects changed credential fields', () => {
    const changes = hasCredentialChanges(
      { correo: 'viejo@example.com', contrasena: 'clave-vieja' },
      { correo: 'nuevo@example.com', contrasena: 'clave-vieja' },
    );

    expect(changes).toEqual({ correo: true, contrasena: false });
    expect(changedCredentialsCount(changes)).toBe(1);
  });

  it('describes both changed credentials', () => {
    expect(
      getCredentialChangeSummary({ correo: true, contrasena: true }),
    ).toBe('Se actualizaron el correo y la contrasena.');
  });

  it('renders the credential update template with service and sale data', () => {
    const message = buildCredentialUpdateMessage(
      'Hola {nombre_cliente}\n{credenciales_cambiadas}\n{servicio}\n{correo}\n{contrasena}\n{perfil_nombre}\n{codigo}',
      venta,
      servicio,
      { correo: true, contrasena: true },
    );

    expect(message).toContain('Hola Ana');
    expect(message).toContain('Se actualizaron el correo y la contrasena.');
    expect(message).toContain('Netflix');
    expect(message).toContain('nuevo@example.com');
    expect(message).toContain('clave-nueva');
    expect(message).toContain('Ana');
    expect(message).toContain('1234');
  });

  it('falls back to the profile number when the profile name is empty', () => {
    const message = buildCredentialUpdateMessage(
      'Perfil: {perfil_nombre}',
      {
        ...venta,
        perfilNombre: '',
        perfilNumero: 7,
      },
      servicio,
      { correo: true, contrasena: true },
    );

    expect(message).toContain('Perfil: Perfil 7');
  });

  it('renders the service transfer template with the target service and profile name', () => {
    const message = buildServiceTransferMessage(
      'Servicio: {servicio}\nCorreo: {correo}\nPerfil: {perfil_nombre}\nCodigo: {codigo}',
      venta,
      servicio,
    );

    expect(message).toContain('Servicio: Netflix');
    expect(message).toContain('Correo: nuevo@example.com');
    expect(message).toContain('Perfil: Ana');
    expect(message).toContain('Codigo: 1234');
  });
});

it('omits code-access passwords in credential changes and transfers, including custom placeholders', () => {
  const account = { ...servicio, accesoPorCodigo: true };
  const template = '{correo}|{contrasena}|{cambio_contrasena}|{credenciales_cambiadas}';
  for (const custom of [undefined, template]) {
    const update = buildCredentialUpdateMessage(custom, venta, account, { correo: true, contrasena: true });
    const transfer = buildServiceTransferMessage(custom, venta, account);
    expect(update).not.toContain(account.contrasena);
    expect(transfer).not.toContain(account.contrasena);
    expect(update).toContain(account.correo);
    expect(transfer).toContain(account.correo);
  }
});
