# Tests Directory

This directory contains all test files for the MovieTime PTY application.

## Structure

```
tests/
├── unit/           # Unit tests for individual functions/components
│   ├── lib/        # Tests for utility functions
│   └── store/      # Tests for Zustand stores
├── integration/    # Integration tests for features
└── e2e/            # End-to-end tests with Playwright
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test path/to/test.spec.ts
```

## Writing Tests

Tests use:
- **Vitest** as test runner
- **@testing-library/react** for component testing
- **Playwright** for E2E tests (when configured)

Example unit test:
```typescript
import { describe, it, expect } from 'vitest';
import { calcularConsumo } from '@/lib/utils/calculations';

describe('calcularConsumo', () => {
  it('should calculate consumption percentage', () => {
    const result = calcularConsumo(new Date(), addMonths(new Date(), 1));
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
```

## Test Coverage Goals

- Utilities: 100%
- Stores: 80%
- Components: 70%
- Pages: 60%
