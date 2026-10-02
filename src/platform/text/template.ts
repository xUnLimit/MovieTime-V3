const MARKER_PATTERN = /\{\{([^{}\n]{1,40})\}\}/g;

/** Bounded markers; values are never recursively interpreted. */
export function templateVariables(template: string): string[] {
  const found: string[] = [];
  for (const match of template.matchAll(MARKER_PATTERN)) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(MARKER_PATTERN, (whole, name: string) => (
    Object.hasOwn(values, name) ? values[name] : whole
  ));
}
