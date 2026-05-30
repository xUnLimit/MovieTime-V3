# Config Directory

Centralized configuration files for the application.

## Files

- **`env.ts`** - Environment variables and configuration
- **`site.ts`** - Site metadata and general configuration
- **`index.ts`** - Barrel export for all config files

## Usage

```typescript
import { env, siteConfig } from '@/config';

// Use environment variables
console.log(env.appUrl);

// Use site configuration
console.log(siteConfig.name);
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_APP_NAME=MovieTime PTY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_ENABLE_SW_DEV=false
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
PUSH_CRON_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STAGING_PROJECT_REFS=...
```

Run `npm run env:validate` in CI to fail fast when production-required values
are missing. `SUPABASE_STAGING_PROJECT_REFS` is a comma-separated allowlist used
by `npm run supabase:reset:*` before any destructive staging reset.

## Adding New Configuration

1. Add runtime constants to `src/lib/constants` or app config to this directory
2. Export from `index.ts`
3. Update TypeScript types as needed
