import type { KeyboardEvent } from "react";

const INPUT_CONTROL_KEYS = [
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
];

function shouldAllowControlKey(event: KeyboardEvent<HTMLInputElement>) {
  return (
    INPUT_CONTROL_KEYS.includes(event.key) ||
    event.ctrlKey ||
    event.metaKey
  );
}

export function handleDecimalKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  const char = event.key;
  const currentValue = event.currentTarget.value;

  if (shouldAllowControlKey(event)) return;
  if (!/[0-9.]/.test(char)) {
    event.preventDefault();
  }
  if (char === "." && currentValue.includes(".")) {
    event.preventDefault();
  }
}

export function handleIntegerKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  const char = event.key;

  if (shouldAllowControlKey(event)) return;
  if (!/[0-9]/.test(char)) {
    event.preventDefault();
  }
}
