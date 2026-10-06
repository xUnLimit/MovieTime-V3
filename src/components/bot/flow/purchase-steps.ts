import { COPY_CATALOG, blockOfStep, editableCopyKeysOfBlock } from '@/modules/commerce-copy';
import type { CopyStepId } from '@/modules/commerce-copy/catalog';
import { stepDescription, stepTitle } from '@/modules/commerce-copy/flow';
import { renderCopyText, sampleValues } from '@/modules/commerce-copy/render';
import type { BotDefinition, BotNode } from '@/types/bot';
import type { PurchaseStepData } from './PurchaseStepNode';

export const blockFor = (def: BotDefinition, step: CopyStepId): BotNode | undefined => def.nodes.find((node) => node.block?.type === blockOfStep(step));

/** Por paso: su mensaje principal tal como lo vería el cliente, cuántos textos tiene y cuántos difieren del original. */
export function stepData(def: BotDefinition, steps: readonly CopyStepId[], inherited: Readonly<Partial<Record<string, string>>>): Map<CopyStepId, PurchaseStepData> {
  return new Map(steps.map((step) => {
    const block = blockFor(def, step)?.block;
    const keys = block ? editableCopyKeysOfBlock(block.type).filter((key) => COPY_CATALOG[key].step === step) : [];
    const textOf = (key: (typeof keys)[number]) => block?.copy[key] ?? inherited[key] ?? COPY_CATALOG[key].defaultText;
    const main = keys.find((key) => COPY_CATALOG[key].kind === 'message') ?? keys[0];
    const edited = keys.filter((key) => textOf(key).trim() !== COPY_CATALOG[key].defaultText.trim()).length;
    return [step, { title: stepTitle(step), description: stepDescription(step), preview: main ? renderCopyText(textOf(main), sampleValues(main)) : '', total: keys.length, edited }];
  }));
}
