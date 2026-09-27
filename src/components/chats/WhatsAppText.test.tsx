import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WhatsAppText } from './WhatsAppText';

describe('WhatsAppText', () => {
  it('renders WhatsApp bold, italic and strikethrough without interpreting HTML', () => {
    const { container } = render(<p><WhatsAppText text={'*Monto:* $4.50 _nota_ ~viejo~ <b>no</b> * suelto'} /></p>);

    expect(container.querySelector('strong')?.textContent).toBe('Monto:');
    expect(container.querySelector('em')?.textContent).toBe('nota');
    expect(container.querySelector('s')?.textContent).toBe('viejo');
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>no</b> * suelto');
  });
});
