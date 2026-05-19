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
    label: 'Terceros',
    href: '/terceros',
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
    label: 'Categorías',
    href: '/categorias',
    icon: 'Folder'
  },
  {
    label: 'Métodos de Pago',
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
  { value: 'USD', label: 'USD - Dólar', symbol: '$' },
  { value: 'PAB', label: 'PAB - Balboa', symbol: 'B/.' },
  { value: 'EUR', label: 'EUR - Euro', symbol: '€' },
  { value: 'NGN', label: 'NGN - Naira', symbol: '₦' }
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
  { value: 'telefono', label: 'Teléfono' }
] as const;

// ===========================
// TEMPLATE TYPES
// ===========================

export const TIPOS_TEMPLATE = [
  { value: 'notificacion_regular', label: 'Notificación Regular' },
  { value: 'dia_pago', label: 'Día de Pago' },
  { value: 'renovacion', label: 'Renovación' },
  { value: 'suscripcion', label: 'Nueva Venta' },
  { value: 'cancelacion', label: 'Cancelación' },
  { value: 'actualizacion_credenciales', label: 'Actualización de Credenciales' },
  { value: 'transferencia_servicio', label: 'Transferencia de Servicio' }
] as const;

// ===========================
// PLACEHOLDERS WHATSAPP
// ===========================

export const PLACEHOLDERS_DISPONIBLES = [
  { placeholder: '{saludo}', descripcion: 'Saludo según hora del día' },
  { placeholder: '{cliente}', descripcion: 'Nombre del cliente' },
  { placeholder: '{nombre_cliente}', descripcion: 'Primer nombre del cliente' },
  { placeholder: '{servicio}', descripcion: 'Nombre del servicio' },
  { placeholder: '{categoria}', descripcion: 'Categoría del servicio' },
  { placeholder: '{perfil_nombre}', descripcion: 'Nombre del perfil' },
  { placeholder: '{correo}', descripcion: 'Correo de acceso' },
  { placeholder: '{contrasena}', descripcion: 'Contraseña de acceso' },
  { placeholder: '{codigo}', descripcion: 'Código de la venta' },
  { placeholder: '{credenciales_cambiadas}', descripcion: 'Resumen de credenciales cambiadas' },
  { placeholder: '{cambio_correo}', descripcion: 'Línea de cambio de correo' },
  { placeholder: '{cambio_contrasena}', descripcion: 'Línea de cambio de contraseña' },
  { placeholder: '{vencimiento}', descripcion: 'Fecha de vencimiento' },
  { placeholder: '{monto}', descripcion: 'Monto a pagar' },
  { placeholder: '{diasRetraso}', descripcion: 'Días de retraso (si aplica)' }
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
  { value: 'revendedor', label: 'Solo Revendedores' }
] as const;

// ===========================
// PAGINATION
// ===========================

export const ITEMS_PER_PAGE = 10;
export const DEFAULT_PAGE_SIZE = 10;

// ===========================
// CACHE
// ===========================

export const CACHE_TTL_MS = 5 * 60 * 1000;

// ===========================
// REPOSO
// ===========================

export const REPOSO_MIN_DAYS = 28;
export const REPOSO_MAX_DAYS = 31;
export const REPOSO_DAY_OPTIONS = [7, 28, 29, 30, 31] as const;

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
  { value: 'critica', label: 'Crítica', color: 'red' }
] as const;

// ===========================
// CURRENCY SYMBOLS MAP
// ===========================

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  PAB: 'B/.',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  NGN: '₦',
  BRL: 'R$',
  MXN: '$',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'Fr',
  ARS: '$',
  CLP: '$',
  COP: '$',
  PEN: 'S/',
  CRC: '₡',
  VES: 'Bs.',
  TRY: '₺',
  EGP: 'E£',
  BTC: '₿',
  ETH: 'Ξ',
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
