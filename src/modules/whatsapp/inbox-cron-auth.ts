import { createHash, timingSafeEqual } from 'node:crypto';

export function isAuthorizedInboxCron(request: Request, secret = process.env.WHATSAPP_INBOX_CRON_SECRET): boolean {
  if (!secret || secret.length < 32) return false;
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 2048) return false;
  return timingSafeEqual(createHash('sha256').update(authorization.slice(7)).digest(), createHash('sha256').update(secret).digest());
}
