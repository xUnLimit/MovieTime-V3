// ===========================
// NAVIGATION CONSTANTS
// ===========================

export const NAVIGATION_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard'
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: 'Users'
  },
  {
    label: 'Servicios',
    href: '/servicios',
    icon: 'Server'
  },
  {
    label: 'Suscripciones',
    href: '/suscripciones',
    icon: 'ShoppingCart'
  },
  {
    label: 'Notificaciones',
    href: '/notificaciones',
    icon: 'Bell'
  },
  {
    label: 'Pagos de Servicios',
    href: '/pagos-servicios',
    icon: 'CreditCard'
  },
  {
    label: 'CategorÃ­as',
    href: '/categorias',
    icon: 'Folder'
  },
  {
    label: 'MÃ©todos de Pago',
    href: '/metodos-pago',
    icon: 'Wallet'
  },
  {
    label: 'Editor de Mensajes',
    href: '/editor-mensajes',
    icon: 'MessageSquare'
  },
  {
    label: 'Log de Actividad',
    href: '/log-actividad',
    icon: 'FileText'
  }
] as const;

// ===========================
// CYCLE PAYMENT OPTIONS
// ===========================

export const CICLOS_PAGO = [
  { value: 'mensual', label: 'Mensual', meses: 1 },
  { value: 'trimestral', label: 'Trimestral', meses: 3 },
  { value: 'semestral', label: 'Semestral', meses: 6 },
  { value: 'anual', label: 'Anual', meses: 12 }
] as const;

// ===========================
// CYCLE MONTHS MAPPING
// ===========================

export const CYCLE_MONTHS = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
} as const;

export type CicloPago = keyof typeof CYCLE_MONTHS;

// ===========================
// ESTADO OPTIONS
// ===========================

export const ESTADOS_SUSCRIPCION = [
  { value: 'activa', label: 'Activa', color: 'green' },
  { value: 'suspendida', label: 'Suspendida', color: 'yellow' },
  { value: 'inactiva', label: 'Inactiva', color: 'gray' },
  { value: 'vencida', label: 'Vencida', color: 'red' }
] as const;

// ===========================
// NOTIFICATION DAYS
// ===========================

export const DIAS_NOTIFICACION = [100, 11, 8, 7, 3, 2, 1] as const;

// ===========================
// CURRENCY OPTIONS
// ===========================

export const MONEDAS = [
  { value: 'USD', label: 'USD - DÃ³lar', symbol: '$' },
  { value: 'PAB', label: 'PAB - Balboa', symbol: 'B/.' },
  { value: 'EUR', label: 'EUR - Euro', symbol: 'â‚¬' },
  { value: 'NGN', label: 'NGN - Naira', symbol: 'â‚¦' }
] as const;

// ===========================
// METODO PAGO TYPES
// ===========================

export const TIPOS_METODO_PAGO = [
  { value: 'banco', label: 'Banco' },
  { value: 'yappy', label: 'Yappy' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'binance', label: 'Binance' },
  { value: 'efectivo', label: 'Efectivo' }
] as const;

export const TIPOS_CUENTA = [
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'corriente', label: 'Corriente' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'telefono', label: 'TelÃ©fono' }
] as const;

// ===========================
// TEMPLATE TYPES
// ===========================

export const TIPOS_TEMPLATE = [
  { value: 'notificacion_regular', label: 'NotificaciÃ³n Regular' },
  { value: 'dia_pago', label: 'DÃ­a de Pago' },
  { value: 'renovacion', label: 'RenovaciÃ³n' },
  { value: 'venta', label: 'Nueva Venta' },
  { value: 'cancelacion', label: 'CancelaciÃ³n' }
] as const;

// ===========================
// PLACEHOLDERS WHATSAPP
// ===========================

export const PLACEHOLDERS_DISPONIBLES = [
  { placeholder: '{saludo}', descripcion: 'Saludo segÃºn hora del dÃ­a' },
  { placeholder: '{cliente}', descripcion: 'Nombre del cliente' },
  { placeholder: '{categoria}', descripcion: 'CategorÃ­a del servicio' },
  { placeholder: '{correo}', descripcion: 'Correo de acceso' },
  { placeholder: '{contrasena}', descripcion: 'ContraseÃ±a de acceso' },
  { placeholder: '{vencimiento}', descripcion: 'Fecha de vencimiento' },
  { placeholder: '{monto}', descripcion: 'Monto a pagar' },
  { placeholder: '{diasRetraso}', descripcion: 'DÃ­as de retraso (si aplica)' }
] as const;

// ===========================
// TIPO SERVICIO
// ===========================

export const TIPOS_SERVICIO = [
  { value: 'individual', label: 'Individual' },
  { value: 'familiar', label: 'Familiar' }
] as const;

// ===========================
// TIPO CATEGORIA
// ===========================

export const TIPOS_CATEGORIA = [
  { value: 'cliente', label: 'Solo Clientes' },
  { value: 'revendedor', label: 'Solo Revendedores' },
  { value: 'ambos', label: 'Ambos' }
] as const;

// ===========================
// PAGINATION
// ===========================

export const ITEMS_PER_PAGE = 10;

// ===========================
// ROLES
// ===========================

export const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operador', label: 'Operador' }
] as const;

// ===========================
// PRIORIDADES NOTIFICACION
// ===========================

export const PRIORIDADES_NOTIFICACION = [
  { value: 'baja', label: 'Baja', color: 'gray' },
  { value: 'media', label: 'Media', color: 'blue' },
  { value: 'alta', label: 'Alta', color: 'orange' },
  { value: 'critica', label: 'CrÃ­tica', color: 'red' }
] as const;

// ===========================
// CURRENCY SYMBOLS MAP
// ===========================

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  PAB: 'B/.',
  EUR: 'â‚¬',
  GBP: 'Â£',
  JPY: 'Â¥',
  CNY: 'Â¥',
  INR: 'â‚¹',
  NGN: 'â‚¦',
  BRL: 'R$',
  MXN: '$',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'Fr',
  ARS: '$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  CRC: 'â‚¡',
  VES: 'Bs.',
  TRY: 'â‚º',
  EGP: 'EÂ£',
  BTC: 'â‚¿',
  ETH: 'Îž',
  USDT: '$',
  USDC: '$',
};

export const getCurrencySymbol = (moneda?: string): string => {
  if (!moneda) return '$';
  return CURRENCY_SYMBOLS[moneda.toUpperCase()] || '$';
};

// ===========================
// DEFAULT VALUES
// ===========================

export const DEFAULT_PREFIJO_TELEFONO = '+507';
export const DEFAULT_HORA_ENVIO_NOTIFICACIONES = 8;
