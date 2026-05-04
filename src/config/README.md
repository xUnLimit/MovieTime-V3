# Config Directory

Centralized configuration files for the application.

## Files

- **`constants.ts`** - Re-exports from `@/lib/constants` for backward compatibility
- **`env.ts`** - Environment variables and configuration
- **`site.ts`** - Site metadata and general configuration
- **`index.ts`** - Barrel export for all config files

## Usage

```typescript
import { env, siteConfig, NAVIGATION_ITEMS } from '@/config';

// Use environment variables
console.log(env.apiUrl);

// Use site configuration
console.log(siteConfig.name);

// Use constants
console.log(NAVIGATION_ITEMS);
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_APP_NAME=MovieTime PTY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
```

## Adding New Configuration

1. Add constants to appropriate file in this directory
2. Export from `index.ts`
3. Update TypeScript types as needed
