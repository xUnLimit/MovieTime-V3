import { Fragment } from 'react';

// Formato de WhatsApp: *negrita*, _cursiva_ y ~tachado~ dentro de una linea.
// Se construyen elementos React; nunca se interpreta HTML del mensaje.
const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

export function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((part, index) => {
        const inner = part.slice(1, -1);
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) return <strong key={index} className="font-semibold">{inner}</strong>;
        if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) return <em key={index}>{inner}</em>;
        if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) return <s key={index}>{inner}</s>;
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}
