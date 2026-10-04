// Catalogo de textos de la conversacion de compras. Cada texto tiene su valor original, los marcadores
// {{dato}} que admite y los que no pueden faltar. Un texto editado que no cumple vuelve al original.

export type CopyStepId =
  | 'inicio' | 'plataformas' | 'planes' | 'agotados' | 'renovar' | 'carrito' | 'reserva' | 'pago' | 'servicios' | 'ayuda';
type CopyKind = 'message' | 'button' | 'label';

export type CopyVariable = { label: string; example: string };
export const COPY_VARIABLES = {
  servicio: { label: 'Servicio elegido', example: 'Netflix Mensual' },
  plan: { label: 'Servicio sin cupo', example: 'Netflix Mensual' },
  plataforma: { label: 'Plataforma', example: 'Disney+' },
  monto: { label: 'Monto del pedido', example: 'USD 10.00' },
  total: { label: 'Total del pedido', example: 'USD 10.00' },
  pedido: { label: 'Número de pedido', example: '8faf2421' },
  plazo: { label: 'Hasta cuándo se reserva', example: 'hoy a las 10:42 p. m.' },
  moneda: { label: 'Moneda del servicio', example: 'EUR' },
  instrucciones: { label: 'Datos de pago configurados', example: 'Yappy al 6769-4145 (Allan Ordoñez).' },
  recibido: { label: 'Monto recibido', example: 'USD 4.00' },
  faltante: { label: 'Monto que falta', example: 'USD 6.00' },
  exceso: { label: 'Monto pagado de más', example: 'USD 2.00' },
  entrega: { label: 'Estado de la entrega', example: 'Tu acceso ya fue enviado.' },
} as const satisfies Record<string, CopyVariable>;
type CopyVariableName = keyof typeof COPY_VARIABLES;

export type CopySpec = {
  label: string; step: CopyStepId; kind: CopyKind; when: string; defaultText: string;
  variables: readonly CopyVariableName[]; required: readonly CopyVariableName[]; maxLength: number;
};

const message = (step: CopyStepId, label: string, when: string, defaultText: string,
  variables: readonly CopyVariableName[] = [], required: readonly CopyVariableName[] = []): CopySpec =>
  ({ label, step, kind: 'message', when, defaultText, variables, required, maxLength: 900 });
// Botones y filas de lista: una sola linea y con el limite de WhatsApp.
const short = (step: CopyStepId, label: string, when: string, defaultText: string, maxLength: number, kind: CopyKind = 'button'): CopySpec =>
  ({ label, step, kind, when, defaultText, variables: [], required: [], maxLength });

export const COPY_CATALOG = {
  greeting: message('inicio', 'Saludo y menú', 'El cliente escribe "hola" o abre el menú', 'Hola, soy el asistente de MovieTime PTY. ¿Qué necesitas?'),
  btnBuy: short('inicio', 'Botón: comprar', 'Menú principal', 'Adquirir servicio', 20),
  btnRenew: short('inicio', 'Botón: renovar', 'Menú principal', 'Renovar', 20),
  btnServices: short('inicio', 'Botón: mis servicios', 'Menú principal', 'Mis servicios', 20),
  btnHelp: short('inicio', 'Botón: hablar con alguien', 'Menú sin compras nuevas y selección guardada', 'Hablar con alguien', 20),
  platformsPrompt: message('plataformas', 'Elegir plataforma', 'Lista de plataformas con cupo', '¿Qué plataforma te interesa? Elige una de la lista. Cuando termines, toca Revisar carrito.'),
  noPlatforms: message('plataformas', 'Sin plataformas con cupo', 'No hay ninguna plataforma disponible', 'Por ahora no tenemos plataformas con cupo. Si quieres, deja tu interés y te aviso apenas haya.'),
  listButtonPlatforms: short('plataformas', 'Botón de la lista', 'Abre la lista de plataformas', 'Elegir plataforma', 20, 'label'),
  sectionPlatforms: short('plataformas', 'Título de la sección', 'Sección con las plataformas', 'Plataformas disponibles', 24, 'label'),
  rowSoldOut: short('plataformas', 'Fila: consultar agotados', 'Última sección de la lista', 'Consultar agotados', 24, 'label'),
  rowSoldOutDesc: short('plataformas', 'Descripción de esa fila', 'Última sección de la lista', 'Deja tu interés y te avisamos', 72, 'label'),
  rowMore: short('plataformas', 'Fila: más opciones', 'Cuando hay más de una página', 'Más opciones', 24, 'label'),
  rowMoreDesc: short('plataformas', 'Descripción de esa fila', 'Cuando hay más de una página', 'Ver siguiente página', 72, 'label'),
  sectionMore: short('plataformas', 'Título de la sección de navegación', 'Sección con "más opciones" y atajos', 'Más', 24, 'label'),
  plansPrompt: message('planes', 'Elegir plan', 'El cliente eligió una plataforma', 'Estos son los planes de {{plataforma}}. ¿Cuál prefieres?', ['plataforma']),
  listButtonPlans: short('planes', 'Botón de la lista', 'Abre la lista de planes', 'Elegir plan', 20, 'label'),
  sectionPlans: short('planes', 'Título de la sección', 'Sección con los planes', 'Planes disponibles', 24, 'label'),
  rowBackPlatforms: short('planes', 'Fila: volver a plataformas', 'Última sección de la lista de planes', 'Otras plataformas', 24, 'label'),
  rowBackDesc: short('planes', 'Descripción de esa fila', 'Volver a lo disponible', 'Volver a lo disponible', 72, 'label'),
  addedNotice: message('planes', 'Servicio agregado', 'Al agregar un plan al carrito', 'Listo, agregué {{servicio}} a tu selección.', ['servicio'], ['servicio']),
  otherCurrency: message('planes', 'Otra moneda', 'El plan elegido se cobra en otra moneda que el carrito', 'Ese servicio se cobra en otra moneda, así que va en un pedido aparte. Termina primero tu selección actual y después lo agregas.'),
  soldOutPrompt: message('agotados', 'Lista de agotados', 'El cliente toca "consultar agotados"', 'Estas opciones están sin cupo por ahora. Elige la que te interese y te aviso cuando vuelva.'),
  listButtonSoldOut: short('agotados', 'Botón de la lista', 'Abre la lista de agotados', 'Elegir opción', 20, 'label'),
  sectionSoldOut: short('agotados', 'Título de la sección', 'Sección con lo agotado', 'Sin cupo por ahora', 24, 'label'),
  rowBackSoldOut: short('agotados', 'Fila: ver plataformas', 'Última sección de la lista de agotados', 'Ver plataformas', 24, 'label'),
  soldOutAsk: message('agotados', 'Ofrecer aviso', 'El cliente elige algo sin cupo', 'Por ahora no tenemos cupo en {{plan}}. ¿Quieres que te avisemos cuando haya? Si prefieres, dejo anotado tu interés sin enviarte avisos.', ['plan'], ['plan']),
  btnInterestYes: short('agotados', 'Botón: avisarme', 'Pregunta de aviso', 'Sí, avisarme', 20),
  btnInterestNo: short('agotados', 'Botón: solo interés', 'Pregunta de aviso', 'Solo mi interés', 20),
  interestYes: message('agotados', 'Interés con avisos', 'El cliente acepta que le avisemos', '¡Anotado! Te escribo apenas haya cupo. Mientras tanto, mira lo que sí está disponible.'),
  interestNo: message('agotados', 'Interés sin avisos', 'El cliente no quiere avisos', 'Anotado: dejé tu interés sin avisos, así que no te voy a escribir por esto. Si cambias de idea, me dices.'),
  renewPrompt: message('renovar', 'Elegir qué renovar', 'El cliente toca renovar', '¿Cuáles servicios quieres renovar? Elígelos de la lista. Cuando termines, toca Revisar carrito.'),
  listButtonServices: short('renovar', 'Botón de la lista', 'Abre la lista de servicios del cliente', 'Elegir servicios', 20, 'label'),
  sectionServices: short('renovar', 'Título de la sección', 'Sección con sus servicios', 'Tus servicios', 24, 'label'),
  summaryTitle: message('carrito', 'Encabezado del resumen', 'Antes de la lista de lo elegido', 'Esto es lo que llevas:'),
  confirmNote: message('carrito', 'Pregunta de confirmación', 'Después del total', '¿Lo reservo? Si el precio o la disponibilidad cambian, te aviso antes de cobrarte.'),
  btnConfirm: short('carrito', 'Botón: confirmar', 'Resumen del carrito', 'Confirmar selección', 20),
  btnCancel: short('carrito', 'Botón: cancelar', 'Resumen, reserva y atajos', 'Cancelar', 20),
  btnReview: short('carrito', 'Botón y fila: revisar carrito', 'Listas y selección guardada', 'Revisar carrito', 20),
  sectionCart: short('carrito', 'Título de la sección del carrito', 'Última sección de las listas', 'Tu carrito', 24, 'label'),
  emptyCart: message('carrito', 'Carrito vacío', 'Pide revisar sin haber elegido nada', 'Tu carrito está vacío todavía. ¿Por dónde empezamos?'),
  usdOnly: message('reserva', 'Solo se cobra en USD', 'El servicio no está en dólares', 'Este servicio se cobra en {{moneda}} y Yappy solo recibe USD, así que una persona del equipo te va a ayudar a coordinar el pago.', ['moneda']),
  reservation: message('reserva', 'Reserva hecha', 'El cliente confirma su selección',
    '¡Listo! Reservé {{servicio}} por {{monto}} (pedido #{{pedido}}). Lo tengo apartado hasta {{plazo}}.\nCuando quieras pagar, toca "Cómo pagar". Antes de pagar, confirma el monto final que te muestro ahí.',
    ['servicio', 'monto', 'pedido', 'plazo'], ['servicio', 'monto']),
  btnPay: short('reserva', 'Botón: cómo pagar', 'Mensaje de reserva', 'Cómo pagar', 20),
  openOrder: message('reserva', 'Ya hay un pedido', 'Intenta empezar otro con un pedido en proceso', 'Ya tienes un pedido en proceso. Si quieres empezar otro, primero escribe "cancelar" o espera a que terminemos con ese.'),
  orderCancelled: message('reserva', 'Pedido cancelado', 'El cliente cancela con un pedido reservado', 'Listo, cancelé tu pedido y liberé la reserva. ¿Qué necesitas ahora?'),
  paymentInstructions: message('pago', 'Datos de pago', 'El cliente toca "Cómo pagar"',
    '{{instrucciones}}\n\nCuando pagues, mándame la palabra "pago" y el código de la transacción (por ejemplo: pago 123456). Si paga otra persona no hay problema: reviso la referencia antes de entregarte el acceso.',
    ['instrucciones'], ['instrucciones']),
  payHint: message('pago', 'Recordatorio de pago', 'Consulta con un pedido sin pagar', 'Si ya pagaste, mándame la palabra "pago" y el código de la transacción (por ejemplo: pago 123456). Si todavía no, toca "Cómo pagar".'),
  payNoInstructions: message('pago', 'Sin datos de pago', 'Piden cómo pagar y no hay datos configurados', 'Todavía no tengo los datos de pago a la mano. Ya le avisé a una persona del equipo para que te los envíe enseguida. Si ya pagaste, mándame la palabra "pago" y el código de la transacción.'),
  orderHint: message('pago', 'Pista al revisar el pedido', 'Después del estado del pedido', 'Si ya pagaste, mándame la palabra "pago" y el código de la transacción. Si necesitas algo más, escribe "ayuda".'),
  statusHead: message('pago', 'Estado: encabezado', 'Primera línea del estado', 'Tu pedido #{{pedido}} es de {{total}}.', ['pedido', 'total'], ['pedido', 'total']),
  statusNoPayment: message('pago', 'Estado: sin pago', 'Aún no hay pago', 'Todavía no veo tu pago.'),
  statusPartial: message('pago', 'Estado: pago parcial', 'Pagó menos del total', 'Hasta ahora recibimos {{recibido}} y faltan {{faltante}}.', ['recibido', 'faltante'], ['recibido', 'faltante']),
  statusPaid: message('pago', 'Estado: pagado', 'Pago completo', 'Ya recibimos tu pago. {{entrega}}', ['entrega'], ['entrega']),
  statusRefunded: message('pago', 'Estado: reembolsado', 'Hay un reembolso', 'Registramos un reembolso en este pedido. {{entrega}} Una persona del equipo revisará tu caso; por favor no vuelvas a pagar.', ['entrega'], ['entrega']),
  statusExcess: message('pago', 'Estado: pagó de más', 'Pagó más del total', 'Pagaste {{exceso}} de más; una persona del equipo te va a escribir para resolverlo.', ['exceso'], ['exceso']),
  deliverySent: message('pago', 'Entrega: acceso enviado', 'Acceso ya enviado', 'Tu acceso ya fue enviado.'),
  deliveryPartial: message('pago', 'Entrega: parcial', 'Solo una parte está lista', 'Una parte de tu pedido ya está lista y una persona del equipo está revisando el resto.'),
  deliveryPending: message('pago', 'Entrega: asignando', 'Aún no se asigna', 'Estamos asignando tus servicios; no hace falta que pagues otra vez.'),
  deliveryAssigned: message('pago', 'Entrega: asignado', 'Asignado, falta enviar el acceso', 'Tus servicios ya están asignados y en un momento te envío el acceso.'),
  servicesTitle: message('servicios', 'Encabezado de mis servicios', 'El cliente toca "Mis servicios"', 'Estos son tus servicios activos:'),
  servicesHint: message('servicios', 'Pista al final de mis servicios', 'Después de la lista', 'Si quieres renovar alguno, toca "Renovar".'),
  noServices: message('servicios', 'Sin servicios activos', 'El número no tiene servicios', 'No encuentro servicios activos con este número. ¿Qué necesitas?'),
  help: message('ayuda', 'Pasar con una persona', 'El cliente pide ayuda', '¡Claro! Ya avisé a una persona del equipo para que te escriba por aquí en unos minutos.'),
  cancelled: message('ayuda', 'Selección cancelada', 'El cliente cancela sin pedido', 'Listo, cancelé tu selección. ¿Qué necesitas ahora?'),
  purchasesPaused: message('ayuda', 'Compras nuevas apagadas', 'Intenta comprar con las compras nuevas apagadas', 'Por ahora no estamos tomando compras nuevas por aquí. Puedes renovar tus servicios, revisar el estado de tu pedido o escribir "ayuda" para hablar con una persona.'),
  noOrders: message('ayuda', 'Sin pedidos en proceso', 'Pregunta el estado sin pedido ni carrito', 'No tienes pedidos en proceso. ¿Qué necesitas?'),
  cartSaved: message('ayuda', 'Selección guardada', 'Pregunta el estado con carrito y sin pedido', 'Todavía no tienes un pedido, pero tu selección está guardada. ¿La revisamos?'),
  fallback: message('ayuda', 'No entendí', 'Escribe algo que el flujo no reconoce', 'Aquí sigo contigo. Tu selección está guardada: ¿quieres revisarla o prefieres hablar con alguien?'),
  noOptions: message('ayuda', 'Sin opciones', 'No hay nada que mostrar', 'Por ahora no tengo opciones para ti por aquí. Escribe "ayuda" y una persona te atiende.'),
} as const satisfies Record<string, CopySpec>;

export type CopyKey = keyof typeof COPY_CATALOG;
export const COPY_KEYS = Object.keys(COPY_CATALOG) as [CopyKey, ...CopyKey[]];
export const isCopyKey = (value: unknown): value is CopyKey => typeof value === 'string' && Object.hasOwn(COPY_CATALOG, value);
