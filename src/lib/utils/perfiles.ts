export const PROFILE_PAGE_SIZE = 10;
export const PROFILE_ICON_LIMIT = 10;
export const PROFILE_PREVIEW_FULL_RENDER_LIMIT = 20;
export const PROFILE_PREVIEW_SAMPLE_LIMIT = 12;

export type ProfileIndicatorState = 'occupied' | 'available' | 'inactive';

export function getProfilePageCount(total: number, pageSize = PROFILE_PAGE_SIZE): number {
  if (pageSize <= 0) return 0;
  return Math.max(Math.ceil(Math.max(total, 0) / pageSize), 1);
}

export function getProfilePageForNumber(profileNumber: number, pageSize = PROFILE_PAGE_SIZE): number {
  if (!Number.isFinite(profileNumber) || profileNumber <= 0 || pageSize <= 0) return 0;
  return Math.floor((profileNumber - 1) / pageSize);
}

export function getProfileNumbersForPage(
  total: number,
  pageIndex: number,
  pageSize = PROFILE_PAGE_SIZE
): number[] {
  if (total <= 0 || pageSize <= 0) return [];

  const maxPageIndex = Math.max(getProfilePageCount(total, pageSize) - 1, 0);
  const safePageIndex = Math.min(Math.max(pageIndex, 0), maxPageIndex);
  const start = safePageIndex * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function getProfilePageLabel(
  total: number,
  pageIndex: number,
  pageSize = PROFILE_PAGE_SIZE
): string {
  const numbers = getProfileNumbersForPage(total, pageIndex, pageSize);
  if (numbers.length === 0) return 'Sin perfiles';
  return `${numbers[0]}-${numbers[numbers.length - 1]}`;
}

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
