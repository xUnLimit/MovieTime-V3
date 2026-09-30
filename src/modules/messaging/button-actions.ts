export type ButtonAction = 'RENOVAR' | 'NO_CONTINUAR' | 'DATOS' | 'NINGUNA';

export const BUTTON_ACTIONS: readonly { value: ButtonAction; label: string }[] = [
  { value: 'RENOVAR', label: 'Enviar datos de pago' },
  { value: 'NO_CONTINUAR', label: 'Marcar que no desea continuar' },
  { value: 'DATOS', label: 'Enviar datos de acceso' },
  { value: 'NINGUNA', label: 'Nada (lo atiendes en el chat)' },
];

function isAction(value: string): value is ButtonAction {
  return BUTTON_ACTIONS.some((item) => item.value === value);
}

/** Alinea las acciones con los botones de la plantilla; lo desconocido queda en NINGUNA. */
export function resizeButtonActions(actions: readonly string[], buttonCount: number): ButtonAction[] {
  return Array.from({ length: buttonCount }, (_, index) => {
    const value = actions[index] ?? '';
    return isAction(value) ? value : 'NINGUNA';
  });
}

/** Sugerencia inicial segun el texto del boton. */
function suggestButtonAction(text: string): ButtonAction {
  const label = text.toLowerCase();
  if (/\bno\b.{0,12}continuar/.test(label)) return 'NO_CONTINUAR';
  if (/renov|continuar|pagar/.test(label)) return 'RENOVAR';
  if (/datos|credencial|acceso/.test(label)) return 'DATOS';
  return 'NINGUNA';
}

export function suggestButtonActions(buttons: readonly { text: string }[]): ButtonAction[] {
  return buttons.map((button) => suggestButtonAction(button.text));
}
