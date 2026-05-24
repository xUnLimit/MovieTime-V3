import { describe, expect, it } from 'vitest';

import {
  buildBalanceData,
  buildChurnData,
  buildTercerosGrowthData,
} from './crecimiento-terceros-helpers';

describe('crecimiento terceros helpers', () => {
  it('builds current month daily growth and leaves future days empty', () => {
    const data = buildTercerosGrowthData({
      currentDate: new Date('2026-05-03T12:00:00'),
      selectedPeriod: 'actual',
      tercerosPorDia: [
        { dia: '2026-05-01', clientes: 2, revendedores: 1 },
        { dia: '2026-05-04', clientes: 9, revendedores: 9 },
      ],
      tercerosPorMes: [],
    });

    expect(data.slice(0, 4)).toMatchObject([
      { dia: '1', clientes: 2, revendedores: 1 },
      { dia: '2', clientes: 0, revendedores: 0 },
      { dia: '3', clientes: 0, revendedores: 0 },
      { dia: '4', clientes: 0, revendedores: 0 },
    ]);
  });

  it('builds monthly growth for period ranges', () => {
    const data = buildTercerosGrowthData({
      currentDate: new Date('2026-05-15T12:00:00'),
      selectedPeriod: '3meses',
      tercerosPorDia: [],
      tercerosPorMes: [
        { mes: '2026-03', clientes: 2, revendedores: 1 },
        { mes: '2026-05', clientes: 3, revendedores: 4 },
      ],
    });

    expect(data).toMatchObject([
      { clientes: 2, revendedores: 1 },
      { clientes: 0, revendedores: 0 },
      { clientes: 3, revendedores: 4 },
    ]);
  });

  it('maps churn and balance read models for charts', () => {
    const churn = buildChurnData([
      { mes: '2026-05', perdidos: 2, activosInicio: 20, churnPct: 10 },
    ]);
    const balance = buildBalanceData({
      tercerosPorMes: [{ mes: '2026-05', clientes: 3, revendedores: 1 }],
      churnPorMes: [{ mes: '2026-05', perdidos: 2, activosInicio: 20, churnPct: 10 }],
    });

    expect(churn).toMatchObject([{ perdidos: 2, activosInicio: 20, churnPct: 10 }]);
    expect(balance).toMatchObject([{ ganados: 4, perdidos: 2 }]);
  });
});
