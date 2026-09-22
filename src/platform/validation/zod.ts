import { z } from 'zod';

// Production uses a strict CSP without `unsafe-eval`. Configure Zod before any
// schema is created so it never probes or enables its Function-based JIT path.
z.config({ jitless: true });

export { z };
export type { ZodType } from 'zod';
