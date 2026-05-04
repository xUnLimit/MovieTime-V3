/**
 * Environment Configuration
 *
 * Centralized environment variables and configuration.
 * Add your environment-specific settings here.
 */

export const env = {
  // Application
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'MovieTime PTY',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // API (for future backend integration)
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  // Features
  enableMockAuth: process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === 'true', // Default false

  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
} as const;

// Type-safe environment variable access
export type Env = typeof env;
