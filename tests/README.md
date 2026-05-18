# Tests Directory

This directory contains shared test files for the MovieTime PTY application. Most feature tests are colocated next to the source files under `src/`.

## Structure

```txt
tests/
  unit/           # Shared unit tests
  integration/    # Shared integration tests, when needed

src/
  **/*.test.ts    # Colocated unit and use-case tests
  **/*.test.tsx   # Colocated component tests
```

## Running Tests

```bash
npm test
npm test -- --run
npm run test:watch
npm run test:coverage
```

## Writing Tests

Tests use Vitest as the runner and Testing Library for React components. E2E tests are not currently configured in this repo.

Focus coverage on critical use-cases, repositories, shared utilities, and user-visible UI behavior.
