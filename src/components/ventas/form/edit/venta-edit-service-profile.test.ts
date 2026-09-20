import { describe, expect, it } from 'vitest';

import type { Servicio } from '@/types';
import {
  getDisponiblesColorClass, getPerfilesDropdownForEdit,
  getServicioRankingCandidateIds, getServiciosOrdenadosForEdit,
  getSlotsDisponiblesForEdit,
} from './venta-edit-service-profile';

const services = [
  { id: 'original', activo: false, enReposo: true, tipo: 'premium', perfilesDisponibles: 1 },
  { id: 'available', activo: true, enReposo: false, tipo: 'premium', perfilesDisponibles: 5, perfilesOcupados: 1, createdAt: new Date(2026, 0, 2) },
  { id: 'full', activo: true, enReposo: false, tipo: 'premium', perfilesDisponibles: 1, perfilesOcupados: 1 },
  { id: 'rest', activo: true, enReposo: true, tipo: 'premium', perfilesDisponibles: 5 },
  { id: 'inactive', activo: false, enReposo: false, tipo: 'premium', perfilesDisponibles: 5 },
  { id: 'other', activo: true, enReposo: false, tipo: 'basic', perfilesDisponibles: 5, createdAt: new Date(2026, 0, 1) },
] as Servicio[];

describe('sale edit service profiles', () => {
  it('selects ranking candidates while preserving the original service', () => {
    expect(getServicioRankingCandidateIds({
      servicios: services, tipoPlanRanking: 'premium', ventaServicioId: 'original',
    })).toEqual(['original', 'available', 'full']);
    expect(getServicioRankingCandidateIds({
      servicios: services, tipoPlanRanking: null, ventaServicioId: 'missing',
    })).toEqual(['available', 'full', 'other']);
  });

  it('filters unavailable services, ranks changes and appends the original', () => {
    const result = getServiciosOrdenadosForEdit({
      fechaInicio: new Date(2026, 0, 1), fechaFin: new Date(2026, 1, 1),
      perfilesOcupadosVenta: { full: new Set([1]) }, planCicloPago: 'mensual',
      servicios: services, tipoPlanRanking: 'premium', venta: { servicioId: 'original' },
      ventasActivasPorServicio: {},
    });
    expect(result.map((service) => service.id)).toEqual(['available', 'original']);
    const withoutOriginal = getServiciosOrdenadosForEdit({
      fechaInicio: new Date(2026, 0, 1), fechaFin: new Date(2026, 1, 1),
      perfilesOcupadosVenta: {}, planCicloPago: 'mensual', servicios: services,
      tipoPlanRanking: null, venta: { servicioId: 'missing' }, ventasActivasPorServicio: {},
    });
    expect(withoutOriginal.some((service) => service.id === 'original')).toBe(false);
  });

  it('calculates slots from real occupancy, stored occupancy and missing services', () => {
    expect(getSlotsDisponiblesForEdit({ perfilesOcupadosVenta: {}, servicioId: 'missing', servicios: services })).toBe(0);
    expect(getSlotsDisponiblesForEdit({
      perfilesOcupadosVenta: { available: new Set([1, 2]) }, servicioId: 'available', servicios: services,
    })).toBe(3);
    expect(getSlotsDisponiblesForEdit({ perfilesOcupadosVenta: {}, servicioId: 'available', servicios: services })).toBe(4);
    expect(getSlotsDisponiblesForEdit({
      perfilesOcupadosVenta: { full: new Set([1, 2]) }, servicioId: 'full', servicios: services,
    })).toBe(0);
  });

  it('builds small, paged and exhausted profile dropdowns', () => {
    expect(getPerfilesDropdownForEdit({ perfilesOcupadosVenta: {}, servicioId: '' })).toEqual([]);
    expect(getPerfilesDropdownForEdit({
      perfilesOcupadosVenta: {}, servicioId: 's1', servicioSeleccionado: { perfilesDisponibles: 0 } as Servicio,
    })).toEqual([]);
    expect(getPerfilesDropdownForEdit({
      perfilesOcupadosVenta: { s1: new Set([2]) }, servicioId: 's1',
      servicioSeleccionado: { perfilesDisponibles: 4 } as Servicio,
    })).toEqual([1, 3, 4]);
    expect(getPerfilesDropdownForEdit({
      perfilesOcupadosVenta: { s1: new Set([1, 2, 3, 4, 5, 7]) }, servicioId: 's1',
      servicioSeleccionado: { perfilesDisponibles: 12 } as Servicio,
    })).toEqual([6, 8, 9, 10]);
    expect(getPerfilesDropdownForEdit({
      perfilesOcupadosVenta: { s1: new Set(Array.from({ length: 12 }, (_, index) => index + 1)) }, servicioId: 's1',
      servicioSeleccionado: { perfilesDisponibles: 12 } as Servicio,
    })).toEqual([]);
  });

  it.each([
    [1, 0, 'text-muted-foreground'], [1, 10, 'text-[#ff1744]'],
    [5, 10, 'text-[#ffea00]'], [8, 10, 'text-[#00ff85]'],
  ])('colors %s/%s availability', (available, total, color) => {
    expect(getDisponiblesColorClass(available, total)).toBe(color);
  });
});
