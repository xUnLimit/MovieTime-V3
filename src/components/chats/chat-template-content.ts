import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';

export type TemplateContent = { body: string; footer: string | null; buttons: string[] };

/**
 * Texto con el que se ve una plantilla enviada por la API: el cuerpo aprobado en Meta con sus
 * {{1}}, {{2}}... reemplazados por los valores enviados, y los textos de sus botones.
 * Devuelve null si la plantilla ya no esta en el catalogo (el chat cae al nombre de la plantilla).
 */
export function buildTemplateContent(
  name: string | null,
  params: readonly string[] | undefined,
  templates: readonly MetaTemplateInfo[],
): TemplateContent | null {
  if (!name) return null;
  const matches = templates.filter((template) => template.name === name);
  const template = matches.find((item) => !item.retired && item.status === 'APPROVED') ?? matches[0];
  if (!template?.body) return null;
  const values = params ?? [];
  return {
    body: template.body.replace(/\{\{(\d+)\}\}/g, (_match, index: string) => values[Number(index) - 1] ?? ''),
    footer: template.footer || null,
    buttons: template.buttons.map((button) => button.text).filter(Boolean),
  };
}

/** Version de una linea para citas y barras de respuesta: sin marcas de formato ni saltos de linea. */
export function templatePreview(content: TemplateContent): string {
  return content.body.replace(/[*_~]/g, '').replace(/\s*\n+\s*/g, ' ').trim();
}
