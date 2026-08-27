# Session Persistence Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make remembered sessions survive browser/PWA restarts, keep device sessions independent, and prevent transient profile failures from deleting valid Supabase sessions.

**Architecture:** Replace the browser-only SSR cookie client with the standard Supabase client and a focused remember-aware storage adapter. Migrate valid legacy cookie sessions once, classify terminal versus recoverable profile failures, and keep auth callbacks synchronous while profile work runs after Supabase releases its internal lock.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS 2.105, Zustand 5, Vitest 4, Testing Library.

---

## File map

- Create `src/platform/supabase/auth-storage.ts`: remember preference, local/session routing, legacy cookie migration and cleanup.
- Create `src/platform/supabase/auth-storage.test.ts`: real in-memory storage and cookie migration coverage.
- Modify `src/platform/supabase/client.ts`: use `createClient` and the new storage adapter.
- Modify `src/platform/supabase/auth.ts`: synchronous auth listener signature, explicit errors and local-only signout.
- Modify `src/application/use-cases/auth-use-cases.ts`: expose current session and terminal profile errors.
- Create `src/store/authStore.test.ts`: reproduce callback deadlock risk, transient signout and global logout regression.
- Modify `src/store/authStore.ts`: deferred profile loading, bounded retries and recoverable state.
- Create `src/components/auth/AuthRecoveryState.tsx`: shared retry UI.
- Modify `src/app/(dashboard)/layout.tsx`, `src/app/page.tsx`, and `src/app/(auth)/login/page.tsx`: do not redirect recoverable sessions to login.

### Task 1: Remember-aware browser storage and legacy migration

**Files:**
- Create: `src/platform/supabase/auth-storage.ts`
- Test: `src/platform/supabase/auth-storage.test.ts`
- Modify: `src/platform/supabase/client.ts`

- [ ] **Step 1: Write failing storage tests**

Cover a remembered write, a session-only write, removal from both stores, fallback reads, valid chunked `base64-` cookie migration, and invalid cookie preservation. Use injected `Storage` instances and a cookie document object so tests exercise real adapter logic rather than mocks.

```ts
const storage = createRememberAwareStorage({
  localStorage,
  sessionStorage,
  isRemembered: () => true,
});
storage.setItem(AUTH_KEY, SESSION_JSON);
expect(localStorage.getItem(AUTH_KEY)).toBe(SESSION_JSON);
expect(sessionStorage.getItem(AUTH_KEY)).toBeNull();
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/platform/supabase/auth-storage.test.ts`

Expected: FAIL because `auth-storage.ts` and its exports do not exist.

- [ ] **Step 3: Implement the adapter and migration**

Expose these stable interfaces:

```ts
export const AUTH_REMEMBER_KEY = 'auth-remember';
export function getSupabaseAuthStorageKey(supabaseUrl: string): string;
export function createRememberAwareStorage(input: RememberAwareStorageInput): SupportedStorage;
export function migrateLegacyAuthCookies(input: LegacyCookieMigrationInput): boolean;
export function clearLegacyAuthCookies(storageKey: string, cookieDocument?: CookieDocument): void;
```

The migration must only copy JSON containing string `access_token`, string `refresh_token`, and numeric `expires_at`. It must delete matching cookie chunks only after reading back the copied value.

- [ ] **Step 4: Replace the browser client construction**

Use `createClient<Database>(url, key, { auth: { storageKey, storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })`. Run the cookie migration before constructing the singleton. Remove `createBrowserClient`, `cookieOptions`, and the ignored inline storage.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --run src/platform/supabase/auth-storage.test.ts`

Expected: all storage and migration tests PASS.

Commit: `fix(auth): persist remembered sessions in browser storage`

### Task 2: Local-only logout and explicit auth failures

**Files:**
- Modify: `src/platform/supabase/auth.ts`
- Modify: `src/application/use-cases/auth-use-cases.ts`
- Test: `src/application/use-cases/auth-use-cases.test.ts`

- [ ] **Step 1: Write failing adapter/use-case tests**

Assert that `signOutUseCase()` calls Supabase with `{ scope: 'local' }`, a missing/inactive profile throws `TerminalAuthError`, and a repository/auth network error remains recoverable.

```ts
await signOutUseCase();
expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/application/use-cases/auth-use-cases.test.ts`

Expected: FAIL because signout has global scope and terminal errors are not typed.

- [ ] **Step 3: Implement explicit error flow**

Change `signOut` to `supabase.auth.signOut({ scope: 'local' })`. Make `getCurrentSupabaseUser` and `getCurrentProfile` throw their Supabase errors instead of returning `null` for every failure. Add:

```ts
export class TerminalAuthError extends Error {}
```

`loadActiveProfileUseCase` converts only confirmed missing/inactive profiles to this class; query and connectivity errors remain recoverable errors.

- [ ] **Step 4: Make the auth subscription synchronous**

Expose `(event: AuthChangeEvent, session: Session | null) => void`, forward both values, and never return the consumer's promise to Supabase.

- [ ] **Step 5: Verify GREEN and commit**

Run: `npm test -- --run src/application/use-cases/auth-use-cases.test.ts`

Expected: PASS.

Commit: `fix(auth): isolate logout to the current device`

### Task 3: Resilient session initialization

**Files:**
- Create: `src/store/authStore.test.ts`
- Modify: `src/store/authStore.ts`

- [ ] **Step 1: Write failing store tests**

Capture the auth listener callback and assert it returns `undefined` immediately. Then advance fake timers and test these paths:

```ts
listener('INITIAL_SESSION', session);
expect(loadActiveProfileUseCase).not.toHaveBeenCalled();
await vi.runAllTimersAsync();
expect(useAuthStore.getState().isAuthenticated).toBe(true);
```

Also assert a recoverable profile error never calls `signOutUseCase`, a `TerminalAuthError` calls local signout, and `SIGNED_OUT` clears user state.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/store/authStore.test.ts`

Expected: FAIL because the current listener is async and signs out on all profile errors.

- [ ] **Step 3: Implement deferred, revision-safe loading**

Add `authRecoveryError: string | null` and `retryAuth(): void` to `AuthState`. The listener performs only state bookkeeping and `setTimeout(..., 0)`. A monotonically increasing revision prevents stale profile results from overwriting newer events. Recoverable failures retry twice with short delays, then preserve storage and expose the recovery error. `TerminalAuthError` signs out locally and clears state.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- --run src/store/authStore.test.ts`

Expected: PASS with no unhandled promises or timer warnings.

Commit: `fix(auth): preserve sessions across transient profile failures`

### Task 4: Recoverable authentication UI

**Files:**
- Create: `src/components/auth/AuthRecoveryState.tsx`
- Test: `src/components/auth/AuthRecoveryState.test.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Write the failing UI test**

Render `AuthRecoveryState` with a retry spy, click **Reintentar**, and assert the callback fires. Verify the copy says the saved session remains intact.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/components/auth/AuthRecoveryState.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement and connect the recovery state**

Render the shared state whenever `isHydrated && authRecoveryError` is true. Dashboard and root guards must not redirect to `/login` in that state. The login page must show recovery UI instead of accepting duplicate credentials until the user retries or explicitly logs out.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- --run src/components/auth/AuthRecoveryState.test.tsx src/store/authStore.test.ts`

Expected: PASS.

Commit: `fix(auth): show recoverable session restoration state`

### Task 5: Full verification

**Files:**
- Modify only if verification exposes a defect in the preceding tasks.

- [ ] **Step 1: Run focused auth tests**

Run: `npm test -- --run src/platform/supabase/auth-storage.test.ts src/application/use-cases/auth-use-cases.test.ts src/store/authStore.test.ts src/components/auth/AuthRecoveryState.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run the complete suite**

Run: `npm test -- --run`

Expected: all tests PASS.

- [ ] **Step 3: Run static and production checks**

Run: `npm run lint`

Expected: exit 0 without new warnings.

Run: `npm run build`

Expected: production build and TypeScript validation PASS.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors; only planned auth, UI, test and documentation files changed.

- [ ] **Step 5: Request code review and resolve findings**

Review the complete implementation against `docs/superpowers/specs/2026-08-27-persistencia-sesion-auth-design.md`. Fix every critical or important issue, rerun affected tests, and leave the worktree clean except for the intended commits.
