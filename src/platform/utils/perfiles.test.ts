import { describe, expect, it } from 'vitest';

import {
  getProfileIndicatorStates,
  getProfileNumbersForPage,
  getProfilePageCount,
  getProfilePageForNumber,
  getProfilePageLabel,
  getProfilePreviewSample,
} from './perfiles';

describe('profile pagination', () => {
  it('counts pages and locates profile numbers safely', () => {
    expect(getProfilePageCount(21)).toBe(3);
    expect(getProfilePageCount(-2)).toBe(1);
    expect(getProfilePageCount(10, 0)).toBe(0);
    expect(getProfilePageForNumber(11)).toBe(1);
    expect(getProfilePageForNumber(Number.NaN)).toBe(0);
    expect(getProfilePageForNumber(0)).toBe(0);
    expect(getProfilePageForNumber(2, 0)).toBe(0);
  });

  it('returns bounded page numbers and labels', () => {
    expect(getProfileNumbersForPage(0, 0)).toEqual([]);
    expect(getProfileNumbersForPage(10, 0, 0)).toEqual([]);
    expect(getProfileNumbersForPage(25, -4)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(getProfileNumbersForPage(25, 99)).toEqual([21, 22, 23, 24, 25]);
    expect(getProfilePageLabel(0, 0)).toBe('Sin perfiles');
    expect(getProfilePageLabel(25, 2)).toBe('21-25');
    expect(getProfilePreviewSample(-1)).toEqual([]);
    expect(getProfilePreviewSample(20, 3)).toEqual([1, 2, 3]);
  });
});

describe('profile indicators', () => {
  it('covers empty, inactive and non-truncated states', () => {
    expect(getProfileIndicatorStates(0, 0, true)).toEqual([]);
    expect(getProfileIndicatorStates(2, 0, true, 0)).toEqual([]);
    expect(getProfileIndicatorStates(3, 2, false)).toEqual(['inactive', 'inactive', 'inactive']);
    expect(getProfileIndicatorStates(4, 2, true)).toEqual(['occupied', 'occupied', 'available', 'available']);
    expect(getProfileIndicatorStates(3, -5, true)).toEqual(['available', 'available', 'available']);
  });

  it('represents large sets proportionally while preserving edge states', () => {
    expect(getProfileIndicatorStates(20, 0, true)).toEqual(Array(10).fill('available'));
    expect(getProfileIndicatorStates(20, 20, true)).toEqual(Array(10).fill('occupied'));
    expect(getProfileIndicatorStates(100, 1, true)).toEqual([
      'occupied', 'available', 'available', 'available', 'available',
      'available', 'available', 'available', 'available', 'available',
    ]);
    expect(getProfileIndicatorStates(100, 99, true)).toEqual([
      'occupied', 'occupied', 'occupied', 'occupied', 'occupied',
      'occupied', 'occupied', 'occupied', 'occupied', 'available',
    ]);
  });
});
