export type WhatsAppConversationControl = {
  waId: string;
  mode: 'bot' | 'human';
  version: number;
  operatorId: string | null;
  activeProcess: string | null;
  orderId: string | null;
  handoffReason: string | null;
};
