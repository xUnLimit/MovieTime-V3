export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizePhoneSearch(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}
