import { describe, expect, it } from 'vitest';

import type { MetaTemplateInfo } from '@/modules/messaging/meta-template-mapping';
import { buildTemplateContent, templatePreview } from './chat-template-content';

function template(overrides: Partial<MetaTemplateInfo> = {}): MetaTemplateInfo {
  return {
    id: 't1', name: 'acceso_actualizado', language: 'es', status: 'APPROVED', category: 'UTILITY',
    body: '{{1}}. Actualizamos los datos de tu servicio de *{{2}}*.', header: null, footer: null,
    buttons: [{ type: 'QUICK_REPLY', text: 'Recibir mis datos' }], paramCount: 2, retired: false, syncedAt: '2026-09-29T00:00:00Z',
    ...overrides,
  };
}

describe('buildTemplateContent', () => {
  it('fills the approved body with the params that were sent and lists the buttons', () => {
    expect(buildTemplateContent('acceso_actualizado', ['Buenas tardes, Allan', 'Crunchyroll'], [template()])).toEqual({
      body: 'Buenas tardes, Allan. Actualizamos los datos de tu servicio de *Crunchyroll*.',
      footer: null,
      buttons: ['Recibir mis datos'],
    });
  });

  it('leaves missing params empty instead of printing the placeholder', () => {
    expect(buildTemplateContent('acceso_actualizado', ['Hola'], [template()])?.body).toBe('Hola. Actualizamos los datos de tu servicio de **.');
    expect(buildTemplateContent('acceso_actualizado', undefined, [template()])?.body).toContain('Actualizamos');
  });

  it('prefers the active approved version over a retired one with the same name', () => {
    const old = template({ id: 'old', retired: true, body: 'Texto viejo' });
    expect(buildTemplateContent('acceso_actualizado', ['a', 'b'], [old, template()])?.body).toContain('Actualizamos');
    expect(buildTemplateContent('acceso_actualizado', [], [old])?.body).toBe('Texto viejo');
  });

  it('keeps the footer and returns null when the template is unknown or has no name', () => {
    expect(buildTemplateContent('acceso_actualizado', [], [template({ footer: '— MovieTime PTY' })])?.footer).toBe('— MovieTime PTY');
    expect(buildTemplateContent('otra', [], [template()])).toBeNull();
    expect(buildTemplateContent(null, [], [template()])).toBeNull();
  });
});

describe('templatePreview', () => {
  it('flattens the body to one clean line for quotes and the reply bar', () => {
    const body = ['🔐 *Acceso actualizado*', '', 'Hola, _Allan_.', '', '*— MovieTime PTY*'].join('\n');
    expect(templatePreview({ body, footer: null, buttons: [] })).toBe('🔐 Acceso actualizado Hola, Allan. — MovieTime PTY');
  });
});
