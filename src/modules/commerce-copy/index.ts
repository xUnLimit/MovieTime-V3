// API publica de commerce-copy para otros modulos (p. ej. bot-config).
export { COPY_CATALOG, COPY_VARIABLES } from './catalog';
export { copyMarkers, renderCopyText } from './render';
export type { CopyKey } from './catalog';
export { COPY_BLOCK_TYPES, blockCopyProblem, blockOfCopyKey, blockOfStep, copyKeysOfBlock, editableCopyKeysOfBlock } from './blocks';
