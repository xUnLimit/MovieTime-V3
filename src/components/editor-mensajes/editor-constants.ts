import { Calendar, DollarSign, Lock, Mail, User, type LucideIcon } from 'lucide-react';

export { TEMPLATE_TIPOS } from '@/modules/messaging/template-tipos';

export const PLACEHOLDERS: { key: string; description: string; icon: LucideIcon }[] = [
  { key: '{saludo}', description: 'El saludo (Buenos días, tardes, etc.)', icon: User },
  { key: '{cliente}', description: 'El nombre completo del cliente', icon: User },
  { key: '{nombre_cliente}', description: 'El primer nombre del cliente', icon: User },
  { key: '{{#items}}\n...\n{{/items}}', description: 'Bloque repetible por item (escribe el contenido en el medio)', icon: Calendar },
  { key: '{items}', description: 'Lista de servicios en formato: *A*, *B* y *C*', icon: Calendar },
  { key: '{servicio}', description: 'El nombre del servicio', icon: Calendar },
  { key: '{categoria}', description: 'La categoría del servicio', icon: Calendar },
  { key: '{perfil_nombre}', description: 'El nombre del perfil', icon: User },
  { key: '{correo}', description: 'El correo electrónico del servicio', icon: Mail },
  { key: '{contrasena}', description: 'La contraseña del servicio', icon: Lock },
  { key: '{codigo}', description: 'El código de la venta', icon: Lock },
  { key: '{credenciales_cambiadas}', description: 'Resumen de los datos que cambiaron', icon: Lock },
  { key: '{cambio_correo}', description: 'Línea solo para cambio de correo', icon: Mail },
  { key: '{cambio_contrasena}', description: 'Línea solo para cambio de contraseña', icon: Lock },
  { key: '{vencimiento}', description: 'La fecha de vencimiento', icon: Calendar },
  { key: '{monto}', description: 'El monto a pagar', icon: DollarSign },
];
