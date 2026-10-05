import type { BotDefinition, BotIssue } from '@/types/bot';
import {
  KEYWORD_MAX_LENGTH, MESSAGE_CATALOG, MESSAGE_KEYS, NODE_LIMITS, PARAM_CATALOG, PARAM_KEYS,
} from './catalog';
import { normalizeText, templateVariables } from './render';
import { validateBlocks } from './validate-blocks';
import { validateExtensions } from './validate-extensions';
import { validateNodes, type Report } from './validate-nodes';

function validateMessages(def: BotDefinition, report: Report): void {
  for (const key of MESSAGE_KEYS) {
    const spec = MESSAGE_CATALOG[key];
    const path = `messages.${key}`;
    const text = def.messages[key];
    if (typeof text !== 'string' || text.trim() === '') {
      report(path, `El mensaje «${spec.label}» no puede estar vacío.`);
      continue;
    }
    if (text.length > spec.maxLength) report(path, `El mensaje «${spec.label}» supera ${spec.maxLength} caracteres.`);
    const used = templateVariables(text);
    for (const name of used) {
      if (!spec.variables.includes(name)) {
        const allowed = spec.variables.length > 0 ? spec.variables.map((v) => `{{${v}}}`).join(', ') : 'ninguno';
        report(path, `El marcador {{${name}}} no existe en este mensaje. Disponibles: ${allowed}.`);
      }
    }
    for (const name of spec.required) {
      if (!used.includes(name)) report(path, `Falta el marcador obligatorio {{${name}}}.`);
    }
  }
}

function validateParams(def: BotDefinition, report: Report): void {
  for (const key of PARAM_KEYS) {
    const spec = PARAM_CATALOG[key];
    const value = def.params[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < spec.min || value > spec.max) {
      report(`params.${key}`, `«${spec.label}» debe ser un número entero entre ${spec.min} y ${spec.max} ${spec.unit}.`);
    }
  }
}

function validateKeywords(def: BotDefinition, report: Report): void {
  if (def.keywords.length > NODE_LIMITS.keywordsMax) {
    report('keywords', `Máximo ${NODE_LIMITS.keywordsMax} palabras clave.`);
  }
  const seen = new Set<string>();
  def.keywords.forEach((keyword, index) => {
    const path = `keywords[${index}]`;
    const normal = normalizeText(keyword);
    if (normal === '') {
      report(path, 'La palabra clave no puede estar vacía.');
      return;
    }
    if (keyword.length > KEYWORD_MAX_LENGTH) report(path, `La palabra clave supera ${KEYWORD_MAX_LENGTH} caracteres.`);
    if (seen.has(normal)) report(path, `La palabra clave «${keyword}» está repetida.`);
    seen.add(normal);
    if (normal !== keyword) report(path, `Se usará «${normal}» (sin acentos ni mayúsculas).`, 'warning');
  });
}

/** Errores (bloquean publicar) y avisos de la definicion. Rutas legibles, mensajes en espanol. */
export function validateDefinition(def: BotDefinition, options: { flowExtensionsEnabled?: boolean } = {}): BotIssue[] {
  const issues: BotIssue[] = [];
  const report: Report = (path, message, severity = 'error') => { issues.push({ path, message, severity }); };
  validateNodes(def, report);
  validateBlocks(def, report);
  validateExtensions(def, report, options.flowExtensionsEnabled === true);
  validateMessages(def, report);
  validateParams(def, report);
  validateKeywords(def, report);
  return issues;
}

export function hasBlockingIssues(issues: readonly BotIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}
