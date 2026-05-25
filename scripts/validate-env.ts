import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ quiet: true });

Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV || 'production' });

async function main() {
  const { validateEnvironment } = await import('../src/config/env');

  validateEnvironment();
  console.log('Environment validation passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
