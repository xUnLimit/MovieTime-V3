import { describe, expect, it } from 'vitest';

import {
  buildMessageData,
  groupNoticeVentas,
  isNoticeEligible,
  metaParamsFromMap,
  noticeDedupeKey,
  normalizePanamaWaId,
  renderFreeText,
  type NoticeVenta,
} from './message-data';

const day = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

function venta(overrides: Partial<NoticeVenta> = {}): NoticeVenta {
  return {
    ventaId: 'v1',
    clienteId: 'c1',
    clienteNombre: 'Maria Lopez',
    telefono: '6533-1751',
    categoriaNombre: 'Netflix',
    servicioNombre: 'Netflix Premium',
    perfilNombre: 'Perfil 1',
    correo: 'a@b.com',
    contrasena: 'secreta',
    codigo: '1234',
    fechaVencimiento: day(2026, 10, 5),
    monto: 5,
    moneda: 'USD',
    activa: true,
    reembolsada: false,
    enReposo: false,
    promesaPagoHasta: null,
    respuestaCliente: null,
    ...overrides,
  };
}

describe('normalizePanamaWaId', () => {
  it.each([
    ['6533-1751', '50765331751'],
    ['+507 6533 1751', '50765331751'],
    ['50765331751', '50765331751'],
    ['(507) 6533-1751', '50765331751'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizePanamaWaId(input)).toBe(expected);
  });

  it.each(['', '123', '5076533175', '9995076533175', 'abc', '12345678901'])('rechaza %s', (input) => {
    expect(normalizePanamaWaId(input)).toBeNull();
  });
});

describe('isNoticeEligible', () => {
  const today = day(2026, 10, 1, 9);
  it('acepta una venta activa normal', () => {
    expect(isNoticeEligible(venta(), today)).toBe(true);
  });
  it.each([
    ['inactiva', { activa: false }],
    ['reembolsada', { reembolsada: true }],
    ['en reposo', { enReposo: true }],
    ['no continuar', { respuestaCliente: 'no_continuar' as const }],
    ['promesa vigente hoy', { promesaPagoHasta: day(2026, 10, 1, 0) }],
    ['promesa futura', { promesaPagoHasta: day(2026, 10, 3) }],
  ])('excluye %s', (_name, overrides) => {
    expect(isNoticeEligible(venta(overrides), today)).toBe(false);
  });
  it('acepta con promesa vencida', () => {
    expect(isNoticeEligible(venta({ promesaPagoHasta: day(2026, 9, 30) }), today)).toBe(true);
  });
});

describe('groupNoticeVentas', () => {
  it('agrupa por cliente, dia de vencimiento y moneda', () => {
    const groups = groupNoticeVentas([
      venta({ ventaId: 'v2', categoriaNombre: 'Disney+', fechaVencimiento: day(2026, 10, 5, 18) }),
      venta({ ventaId: 'v1' }),
      venta({ ventaId: 'v3', fechaVencimiento: day(2026, 10, 6) }),
      venta({ ventaId: 'v4', moneda: 'EUR' }),
      venta({ ventaId: 'v5', clienteId: 'c2' }),
    ]);
    expect(groups.map((g) => g.ventas.map((v) => v.ventaId))).toEqual([
      ['v4'],
      ['v2', 'v1'],
      ['v5'],
      ['v3'],
    ]);
  });

  it('es deterministico sin importar el orden de entrada', () => {
    const a = venta({ ventaId: 'v1' });
    const b = venta({ ventaId: 'v2', clienteId: 'c0' });
    expect(groupNoticeVentas([a, b])).toEqual(groupNoticeVentas([b, a]));
  });
});

describe('buildMessageData', () => {
  const group = (ventas: NoticeVenta[]) => groupNoticeVentas(ventas)[0];
  const now = day(2026, 10, 1, 9);

  it('arma los datos de una venta', () => {
    const data = buildMessageData(group([venta()]), { saludo: 'Buenos días', now });
    expect(data.saludo_nombre).toBe('Buenos días, Maria');
    expect(data.nombre_cliente).toBe('Maria');
    expect(data.servicios).toBe('Netflix');
    expect(data.vencimiento).toBe('5 de octubre de 2026');
    expect(data.monto_total).toBe('$5.00');
    expect(data.perfil).toBe('Perfil 1');
    expect(data.correo).toBe('a@b.com');
    expect(data.contrasena).toBe('secreta');
    expect(data.codigo).toBe('1234');
    expect(data.items).toBe('*Netflix*');
  });

  it('une servicios y suma montos', () => {
    const two = buildMessageData(group([venta(), venta({ ventaId: 'v2', categoriaNombre: 'Disney+', monto: 3.5 })]), {
      saludo: 'Hola',
      now,
    });
    expect(two.servicios).toBe('Disney+ y Netflix');
    expect(two.monto_total).toBe('$8.50');
    expect(two.items).toBe('*Disney+*\n*Netflix*');

    const three = buildMessageData(
      group([
        venta(),
        venta({ ventaId: 'v2', categoriaNombre: 'Disney+' }),
        venta({ ventaId: 'v3', categoriaNombre: 'HBO' }),
      ]),
      { saludo: 'Hola', now },
    );
    expect(three.servicios).toBe('Disney+, HBO y Netflix');
  });

  it('trunca servicios de mas de 256 caracteres', () => {
    const ventas = Array.from({ length: 30 }, (_, i) =>
      venta({ ventaId: `v${String(i).padStart(2, '0')}`, categoriaNombre: `Servicio largo numero ${String(i).padStart(2, '0')}` }),
    );
    const data = buildMessageData(group(ventas), { saludo: 'Hola', now });
    expect(data.servicios.length).toBeLessThanOrEqual(256);
    expect(data.servicios).toMatch(/ y \d+ más$/);
  });

  it('usa el saludo del reloj cuando no se indica', () => {
    // 01:00 UTC del 2 de octubre = 20:00 en Panamá
    expect(buildMessageData(group([venta()]), { now: new Date(Date.UTC(2026, 9, 2, 1)) }).saludo_nombre).toBe('Buenas noches, Maria');
  });
});

describe('metaParamsFromMap', () => {
  const data = buildMessageData(groupNoticeVentas([venta()])[0], { saludo: 'Hola', now: day(2026, 10, 1, 9) });

  it('resuelve las claves en orden', () => {
    expect(metaParamsFromMap(['saludo_nombre', 'servicios', 'vencimiento', 'monto_total'], data)).toEqual([
      'Hola, Maria',
      'Netflix',
      '5 de octubre de 2026',
      '$5.00',
    ]);
  });

  it('limpia saltos, tabs y espacios repetidos y acota a 256', () => {
    const dirty = { ...data, servicios: `A\n\tB   C ${'x'.repeat(300)}` };
    const [value] = metaParamsFromMap(['servicios'], dirty);
    expect(value).not.toMatch(/[\n\t]/);
    expect(value).not.toMatch(/ {2}/);
    expect(value.length).toBeLessThanOrEqual(256);
    expect(value.startsWith('A B C')).toBe(true);
  });

  it('falla con clave desconocida o valor vacio', () => {
    expect(() => metaParamsFromMap(['nope'], data)).toThrow(/nope/);
    expect(() => metaParamsFromMap(['perfil'], { ...data, perfil: '  \n ' })).toThrow(/perfil/);
  });
});

describe('renderFreeText', () => {
  const now = day(2026, 10, 1, 9);
  const single = buildMessageData(groupNoticeVentas([venta()])[0], { saludo: 'Hola', now });
  const multi = buildMessageData(
    groupNoticeVentas([venta(), venta({ ventaId: 'v2', categoriaNombre: 'Disney+', correo: 'd@b.com', monto: 4 })])[0],
    { saludo: 'Hola', now },
  );

  it('rellena marcadores simples', () => {
    expect(renderFreeText('{saludo} {nombre_cliente}: {servicio} vence {vencimiento} ({monto})', single)).toBe(
      'Hola Maria: Netflix Premium vence 5 de octubre de 2026 ($5.00)',
    );
  });

  it('repite el bloque de items por venta', () => {
    const text = renderFreeText('Hola\n{{#items}}\n*{categoria}* - {correo} - {monto}\n{{/items}}\nTotal {monto}', multi);
    expect(text).toBe('Hola\n*Disney+* - d@b.com - $4.00\n*Netflix* - a@b.com - $5.00\nTotal $9.00');
  });

  it('un grupo de una venta renderiza el bloque una vez', () => {
    expect(renderFreeText('{{#items}}\n{correo}\n{{/items}}', single)).toBe('a@b.com');
  });
});

describe('noticeDedupeKey', () => {
  const fecha = day(2026, 10, 5);
  it('es estable frente al orden de ventaIds', () => {
    expect(noticeDedupeKey('aviso_vencimiento', 'c1', fecha, ['b', 'a'])).toBe(
      noticeDedupeKey('aviso_vencimiento', 'c1', fecha, ['a', 'b']),
    );
  });
  it('tiene el formato tipo:cliente:fecha:hash y cambia con las ventas', () => {
    const key = noticeDedupeKey('aviso_vencimiento', 'c1', fecha, ['a']);
    expect(key).toMatch(/^aviso_vencimiento:c1:2026-10-05:[0-9a-f]{16}$/);
    expect(noticeDedupeKey('aviso_vencimiento', 'c1', fecha, ['a', 'b'])).not.toBe(key);
  });
  it('acepta fecha nula', () => {
    expect(noticeDedupeKey('x', 'c1', null, ['a'])).toMatch(/^x:c1:sin-fecha:/);
  });
  it('separa cada evento con su eventId y conserva la llave de siempre sin él', () => {
    const base = noticeDedupeKey('actualizacion_credenciales', 'c1', fecha, ['a']);
    const first = noticeDedupeKey('actualizacion_credenciales', 'c1', fecha, ['a'], 'evento-1');
    expect(first).not.toBe(base);
    expect(first).not.toBe(noticeDedupeKey('actualizacion_credenciales', 'c1', fecha, ['a'], 'evento-2'));
    expect(first).toBe(noticeDedupeKey('actualizacion_credenciales', 'c1', fecha, ['a'], 'evento-1'));
    expect(first).toMatch(/^actualizacion_credenciales:c1:2026-10-05:[0-9a-f]{16}$/);
    expect(noticeDedupeKey('actualizacion_credenciales', 'c1', fecha, ['a'], undefined)).toBe(base);
  });
});
