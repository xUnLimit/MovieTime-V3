const LAST_UPDATED = '27 de septiembre de 2026';
const CONTACT_WHATSAPP = '+507 6533-1751';

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

const SECTIONS: Section[] = [
  {
    title: 'Quiénes somos',
    paragraphs: [
      'MovieTime PTY es un negocio en Panamá que vende y administra suscripciones de servicios de streaming. Esta política explica qué datos personales tratamos cuando nos contactas o contratas un servicio, incluido el canal de WhatsApp.',
    ],
  },
  {
    title: 'Datos que recopilamos',
    items: [
      'Tu nombre y número de teléfono de WhatsApp.',
      'Los mensajes que nos envías y el estado de entrega de los mensajes que te enviamos.',
      'Los servicios que contratas, sus fechas de inicio y vencimiento, y los montos pagados.',
      'Los datos de confirmación de pago necesarios para verificar una transferencia (monto, fecha y número de transacción).',
    ],
  },
  {
    title: 'Para qué usamos tus datos',
    items: [
      'Atender tus consultas y procesar tus compras o renovaciones.',
      'Verificar que un pago fue recibido antes de activar un servicio.',
      'Enviarte recordatorios de vencimiento y avisos sobre tus servicios contratados.',
      'Llevar registros contables y prevenir fraude.',
    ],
    paragraphs: [
      'No vendemos tus datos ni los usamos para publicidad de terceros.',
    ],
  },
  {
    title: 'Con quién compartimos datos',
    paragraphs: [
      'Solo con los proveedores que necesitamos para operar: Meta Platforms (WhatsApp Business Platform) para la mensajería, y nuestros proveedores de alojamiento y base de datos. Cada uno trata los datos bajo sus propias obligaciones de seguridad y únicamente para prestar su servicio.',
    ],
  },
  {
    title: 'Mensajes automatizados',
    paragraphs: [
      'Parte de la atención por WhatsApp puede ser respondida por un asistente automatizado. Siempre puedes pedir hablar con una persona.',
    ],
  },
  {
    title: 'Conservación y seguridad',
    paragraphs: [
      'Conservamos los datos mientras mantengas servicios activos y durante el tiempo que exijan nuestras obligaciones contables. El acceso está restringido a personal autorizado y la información se transmite cifrada.',
    ],
  },
  {
    title: 'Tus derechos',
    paragraphs: [
      'Puedes solicitar acceso, corrección o eliminación de tus datos, y pedir que dejemos de enviarte recordatorios en cualquier momento. Para dejar de recibir recordatorios basta con responder "STOP" por WhatsApp.',
    ],
  },
  {
    title: 'Contacto',
    paragraphs: [
      `Para cualquier solicitud sobre tus datos escríbenos por WhatsApp al ${CONTACT_WHATSAPP}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-10 text-foreground sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última actualización: {LAST_UPDATED}</p>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          {section.items ? (
            <ul className="mt-3 list-disc space-y-1 pl-6 leading-relaxed">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="mt-3 leading-relaxed">{paragraph}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
