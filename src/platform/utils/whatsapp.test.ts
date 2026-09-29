import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateWhatsAppLink, getSaludo, isMobileWhatsAppDevice, openWhatsApp } from './whatsapp';

const desktop = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  platform: 'Win32',
  maxTouchPoints: 0,
};

const phone = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
  platform: 'iPhone',
  maxTouchPoints: 5,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSaludo', () => {
  // Panamá es UTC-5 todo el año (sin horario de verano): hora Panamá = hora UTC - 5.
  const at = (utcHour: number, utcMinute = 0) => getSaludo(new Date(Date.UTC(2026, 9, 1, utcHour, utcMinute)));

  it('greets by Panama time, not by the runtime time zone', () => {
    expect(at(14)).toBe('Buenos días'); // 09:00 Panamá, cuando corre el cron
    expect(at(22, 39)).toBe('Buenas tardes'); // 17:39 Panamá (en UTC ya serían las 22)
  });

  it('switches at 5:00 am, 12:00 pm and 7:00 pm Panama time', () => {
    expect(at(5)).toBe('Buenas'); // 12:00 am
    expect(at(9, 59)).toBe('Buenas'); // 4:59 am
    expect(at(10)).toBe('Buenos días'); // 5:00 am
    expect(at(16, 59)).toBe('Buenos días'); // 11:59 am
    expect(at(17)).toBe('Buenas tardes'); // 12:00 pm
    expect(at(23, 59)).toBe('Buenas tardes'); // 6:59 pm
    expect(at(0)).toBe('Buenas noches'); // 7:00 pm
    expect(at(4, 59)).toBe('Buenas noches'); // 11:59 pm
  });
});

describe('WhatsApp destination', () => {
  it('keeps WhatsApp Web on desktop, including touch-enabled computers', () => {
    expect(isMobileWhatsAppDevice()).toBe(false);
    expect(generateWhatsAppLink('+507 6000-1234', 'Hola, Ana', desktop))
      .toBe('https://web.whatsapp.com/send?phone=50760001234&text=Hola%2C%20Ana');
    expect(generateWhatsAppLink('50760001234', '', { ...desktop, maxTouchPoints: 5 }))
      .toBe('https://web.whatsapp.com/send?phone=50760001234');
  });

  it('uses the app-capable universal link on phones and Android tablets', () => {
    expect(generateWhatsAppLink('+507 (6000) 1234', 'Renovación lista', phone))
      .toBe('https://wa.me/50760001234?text=Renovaci%C3%B3n%20lista');
    expect(generateWhatsAppLink('50760001234', '', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X710)',
      platform: 'Linux armv8l',
      maxTouchPoints: 10,
    })).toBe('https://wa.me/50760001234');
  });

  it('recognizes iPads that identify themselves as Macs', () => {
    expect(isMobileWhatsAppDevice({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })).toBe(true);
    expect(isMobileWhatsAppDevice({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    })).toBe(false);
  });

  it('preserves a prepared message when the recipient has no phone number', () => {
    expect(generateWhatsAppLink('', 'Hola & adiós', phone))
      .toBe('https://wa.me/?text=Hola%20%26%20adi%C3%B3s');
    expect(generateWhatsAppLink('', 'Hola & adiós', desktop))
      .toBe('https://web.whatsapp.com/send?text=Hola%20%26%20adi%C3%B3s');
  });

  it('opens the correct link at click time with safe window features', () => {
    vi.stubGlobal('navigator', phone);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);

    openWhatsApp('+507 6000-1234', 'Venta lista');

    expect(open).toHaveBeenCalledWith(
      'https://wa.me/50760001234?text=Venta%20lista',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
