import type { TemplateMensaje } from '@/types';
import { AUTOMATION_CATALOG, TRIGGER_LABELS } from './automation-catalog';
import { emptyActivity, type TipoActivity } from './automation-activity';
import { BUTTON_ACTIONS, resizeButtonActions } from './button-actions';
import { metaStatusLabel, type MetaTemplateInfo } from './meta-template-mapping';
import { TEMPLATE_GROUPS, tipoCuando, tipoLabel, type EditableTipoKey } from './template-tipos';

type ChannelLevel = 'success' | 'warning' | 'danger';

/** text = texto libre (solo dentro de las 24 h); template = plantilla de Meta vinculada. */
type CardChannel =
  | { kind: 'text' }
  | { kind: 'template'; name: string; statusLabel: string; level: ChannelLevel };

type CardButton = { text: string; actionLabel: string };

export type AutomationCard = {
  tipo: EditableTipoKey;
  label: string;
  cuando: string;
  detail: string;
  triggers: string[];
  channel: CardChannel;
  buttons: CardButton[];
  contenido: string;
  activity: TipoActivity;
};

export type AutomationGroup = { id: string; label: string; cards: AutomationCard[] };

type TemplateInput = Pick<TemplateMensaje, 'tipo' | 'contenido' | 'metaTemplateName' | 'metaButtonActions'>;

function sentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}

function levelOf(status: string): ChannelLevel {
  const value = status.toUpperCase();
  if (value === 'APPROVED') return 'success';
  if (value === 'REJECTED') return 'danger';
  return 'warning';
}

function actionLabel(action: string): string {
  return BUTTON_ACTIONS.find((item) => item.value === action)?.label ?? BUTTON_ACTIONS[BUTTON_ACTIONS.length - 1].label;
}

function channelOf(linked: string | null | undefined, meta: MetaTemplateInfo | null): CardChannel {
  if (!linked) return { kind: 'text' };
  if (!meta) return { kind: 'template', name: linked, statusLabel: 'No encontrada en Meta', level: 'danger' };
  return { kind: 'template', name: linked, statusLabel: sentenceCase(metaStatusLabel(meta.status)), level: levelOf(meta.status) };
}

function buttonsOf(meta: MetaTemplateInfo | null, actions: readonly string[] | undefined): CardButton[] {
  if (!meta) return [];
  const resolved = resizeButtonActions(actions ?? [], meta.buttons.length);
  return meta.buttons.map((button, index) => ({ text: button.text, actionLabel: actionLabel(resolved[index]) }));
}

function buildCard(
  tipo: EditableTipoKey, template: TemplateInput | undefined, metas: readonly MetaTemplateInfo[],
  activity: Record<string, TipoActivity>,
): AutomationCard {
  const linked = template?.metaTemplateName?.trim() || null;
  const meta = linked ? metas.find((item) => item.name === linked && !item.retired) ?? null : null;
  const info = AUTOMATION_CATALOG[tipo];
  return {
    tipo, label: tipoLabel(tipo), cuando: tipoCuando(tipo), detail: info.detail,
    triggers: info.triggers.map((trigger) => TRIGGER_LABELS[trigger]),
    channel: channelOf(linked, meta),
    buttons: buttonsOf(meta, template?.metaButtonActions),
    contenido: template?.contenido ?? '',
    activity: activity[tipo] ?? emptyActivity(),
  };
}

/** Une plantillas, estado de Meta y actividad en el catalogo agrupado como el Editor de mensajes. */
export function buildAutomationGroups(
  templates: readonly TemplateInput[], metas: readonly MetaTemplateInfo[], activity: Record<string, TipoActivity>,
): AutomationGroup[] {
  return TEMPLATE_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    cards: group.tipos.map((tipo) => buildCard(tipo, templates.find((item) => item.tipo === tipo), metas, activity)),
  }));
}
