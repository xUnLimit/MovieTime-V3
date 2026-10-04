import { timingSafeEqual } from 'node:crypto';
import { z } from '@/platform/validation/zod';
import { ForbiddenError, UnauthorizedError } from '@/platform/server/api-errors';

const tokenSchema = z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/);
export function authorizeIntegration(request: Request, configured = process.env.AUTOMATION_INTEGRATION_TOKEN): void {
  const expected = tokenSchema.safeParse(configured);
  if (!expected.success) throw new ForbiddenError();
  const authorization = request.headers.get('authorization');
  const actual = tokenSchema.safeParse(authorization?.startsWith('Bearer ') ? authorization.slice(7) : null);
  if (!actual.success) throw new UnauthorizedError();
  const left = Buffer.from(actual.data); const right = Buffer.from(expected.data);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedError();
}
