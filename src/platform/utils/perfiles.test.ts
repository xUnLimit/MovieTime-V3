import { describe, expect, it } from 'vitest';

import { getProfileIndicatorStates, getProfilePreviewSample } from './perfiles';

describe('profile pagination', () => {

  it('returns bounded page numbers and labels', () => {
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
