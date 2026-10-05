// Contrato compartido del bot de WhatsApp administrable. Lo consumen el modulo
// `bot-config` (logica pura), el runtime del webhook, los repositorios y la UI.
// Cambiar un tipo aqui exige actualizar `docs/whatsapp-bot-admin.md`.

export type BotActionKey = 'netflix_login_code' | 'netflix_travel_code' | 'handoff' | 'purchase' | 'renewal' | 'my_services';
export type BotNodeKind = 'buttons' | 'list' | 'text' | 'action';

/** Condiciones cerradas que el servidor resuelve con datos existentes; el nodo sigue siendo `buttons` (si / no). */
export type BotConditionType = 'customer_has_services' | 'catalog_has_stock';

/** Bloques cerrados del flujo de compras: solo se editan sus textos; sus reglas viven en el servidor y en SQL. */
export type PurchaseBlockType = 'catalogo' | 'resumen' | 'reserva' | 'pago';
type BotNodeBlock = {
  type: PurchaseBlockType;
  /** Textos editados por clave de `commerce-copy`; lo que falta usa el texto original. */
  copy: Record<string, string>;
};

export type BotOption = {
  /** Slug estable (^[a-z][a-z0-9_]{0,31}$), unico dentro del nodo. Viaja en el id del boton. */
  id: string;
  /** buttons: max 20 caracteres; list: max 24. */
  title: string;
  /** Solo list, max 72. */
  description?: string;
  /** Id del nodo al que lleva. */
  next: string;
};

export type BotNode = {
  /** Slug estable (^[a-z][a-z0-9_]{1,31}$), unico en el flujo. */
  id: string;
  /** Nombre interno para el administrador. */
  name: string;
  kind: BotNodeKind;
  /** Texto que ve el cliente (max 1024). Vacio en nodos action. */
  body: string;
  /** Solo list (max 20). */
  listButtonLabel?: string;
  /** buttons: 1-3 · list: 1-10 · text/action: []. */
  options: BotOption[];
  /** Solo en nodos action. */
  action?: BotActionKey;
  /** Bloque de compra con identidad fija (ver `bot-config/purchase-blocks`). */
  block?: BotNodeBlock;
  /** Nodo de condicion (solo con la bandera de extensiones): dos botones `si` / `no` que el servidor elige solo. */
  condition?: { type: BotConditionType };
};

export type BotParams = {
  /** Horas sin actividad para volver a ofrecer el menu (1-72). */
  menuIdleHours: number;
  /** Minutos de silencio del bot tras responder una persona (0-1440). */
  operatorQuietMinutes: number;
  /** Vigencia del correo de codigo de inicio (1-15). */
  loginWindowMinutes: number;
  /** Vigencia del correo de viaje (1-15). */
  travelWindowMinutes: number;
  /** Pulsaciones de menu permitidas en la ventana (1-30). */
  maxTaps: number;
  /** Ventana de conteo de pulsaciones en minutos (1-120). */
  tapWindowMinutes: number;
};

export type BotMessageKey =
  | 'login_code_sent' | 'travel_code_sent' | 'travel_link_sent'
  | 'login_not_found' | 'travel_not_found' | 'already_sent'
  | 'profile_missing' | 'no_netflix_account' | 'rate_limited'
  | 'mailbox_unavailable' | 'handoff_ack' | 'option_unavailable'
  | 'account_picker_body' | 'account_picker_button';

export type BotDefinition = {
  schemaVersion: 1;
  entryNodeId: string;
  nodes: BotNode[];
  messages: Record<BotMessageKey, string>;
  params: BotParams;
  /** Palabras (sin acentos, minusculas) que fuerzan el menu. */
  keywords: string[];
};

export type BotIssue = {
  /** Ruta legible: "nodes[menu].options[0].title". */
  path: string;
  message: string;
  severity: 'error' | 'warning';
};

export type BotEventType =
  | 'menu_shown' | 'option_selected' | 'code_sent' | 'link_sent' | 'not_found'
  | 'already_sent' | 'profile_blocked' | 'rate_limited' | 'mailbox_unavailable'
  | 'handoff' | 'option_unavailable' | 'error';

/** Nunca contiene codigos, enlaces con token ni contrasenas. */
export type BotEventDetail = Record<string, string | number | boolean | null>;

export type BotEvent = {
  id: string;
  createdAt: string;
  waId: string;
  clienteId: string | null;
  clienteNombre: string | null;
  type: BotEventType;
  nodeId: string | null;
  optionId: string | null;
  detail: BotEventDetail;
};

export type BotEventFilters = {
  type?: BotEventType;
  waId?: string;
  from?: string;
  to?: string;
};

export type BotEventPage = {
  events: BotEvent[];
  total: number;
  page: number;
  pageSize: number;
};

export type BotStatus = {
  enabled: boolean;
  publishedVersion: number | null;
  updatedAt: string | null;
};

export type BotVersionSummary = {
  version: number;
  note: string;
  createdAt: string;
  createdBy: string | null;
  isPublished: boolean;
};

export type BotMailboxCheck = {
  ok: boolean;
  /** Mensaje seguro para mostrar; nunca incluye credenciales. */
  message: string;
  recentNetflixMails: number | null;
};

export type BotHealth = {
  whatsappConfigured: boolean;
  mailboxConfigured: boolean;
  lastActivityAt: string | null;
  eventsLast24h: number;
  codesLast24h: number;
  /** Bandera del servidor: permite publicar condiciones y datos del pedido en los textos. */
  flowExtensionsEnabled: boolean;
};

/** Lo que la UI consume. Lo implementa `useBotAdmin` (src/hooks/use-bot-admin.ts). */
export type BotAdminApi = {
  loading: boolean;
  error: string | null;
  status: BotStatus | null;
  published: BotDefinition | null;
  draft: BotDefinition | null;
  dirty: boolean;
  issues: BotIssue[];
  hasErrors: boolean;
  /** Bandera del servidor: permite publicar condiciones y datos del pedido en los textos. */
  flowExtensionsEnabled: boolean;
  versions: BotVersionSummary[];
  events: BotEventPage | null;
  health: BotHealth | null;
  saving: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  updateDraft: (updater: (current: BotDefinition) => BotDefinition) => void;
  discardDraft: () => void;
  resetToDefaults: () => void;
  publish: (note: string) => Promise<void>;
  loadVersionIntoDraft: (version: number) => Promise<void>;
  loadEvents: (page: number, filters: BotEventFilters) => Promise<void>;
  testMailbox: () => Promise<BotMailboxCheck>;
  refresh: () => Promise<void>;
};
