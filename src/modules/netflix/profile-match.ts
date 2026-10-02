// Case, accents and repeated spaces never decide whether two profile names match.
export function normalizeProfileName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function profileMatches(mailProfile: string | null, saleProfiles: readonly string[]): boolean {
  if (!mailProfile) return false;
  const wanted = normalizeProfileName(mailProfile);
  return wanted !== '' && saleProfiles.some((profile) => normalizeProfileName(profile) === wanted);
}
