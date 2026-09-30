export const PROFILE_PAGE_SIZE = 10;
export const PROFILE_ICON_LIMIT = 10;
export const PROFILE_PREVIEW_FULL_RENDER_LIMIT = 20;
const PROFILE_PREVIEW_SAMPLE_LIMIT = 12;

export type ProfileIndicatorState = 'occupied' | 'available' | 'inactive';

export function getProfilePreviewSample(
  total: number,
  limit = PROFILE_PREVIEW_SAMPLE_LIMIT
): number[] {
  const safeTotal = Math.max(total, 0);
  const visible = Math.min(safeTotal, limit);
  return Array.from({ length: visible }, (_, index) => index + 1);
}

export function getProfileIndicatorStates(
  total: number,
  occupied: number,
  active: boolean,
  limit = PROFILE_ICON_LIMIT
): ProfileIndicatorState[] {
  const safeTotal = Math.max(total, 0);
  if (safeTotal === 0 || limit <= 0) return [];

  const visibleDots = Math.min(safeTotal, limit);
  if (!active) {
    return Array.from({ length: visibleDots }, () => 'inactive');
  }

  const safeOccupied = Math.min(Math.max(occupied, 0), safeTotal);
  if (safeTotal <= limit) {
    return Array.from({ length: safeTotal }, (_, index) =>
      index < safeOccupied ? 'occupied' : 'available'
    );
  }

  if (safeOccupied === 0) {
    return Array.from({ length: visibleDots }, () => 'available');
  }

  if (safeOccupied === safeTotal) {
    return Array.from({ length: visibleDots }, () => 'occupied');
  }

  let occupiedDots = Math.round((safeOccupied / safeTotal) * visibleDots);
  occupiedDots = Math.max(1, Math.min(visibleDots - 1, occupiedDots));

  return [
    ...Array.from({ length: occupiedDots }, () => 'occupied' as const),
    ...Array.from({ length: visibleDots - occupiedDots }, () => 'available' as const),
  ];
}
