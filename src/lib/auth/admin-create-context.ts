import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Propagates the admin-create bypass flag through the async call chain.
 *
 * The registration kill switch in `databaseHooks.user.create.before` fires for
 * ALL user creation — including admin-initiated calls via `auth.api.createUser`.
 * This context signals the hook to skip the check when an authenticated admin
 * is the creator.
 *
 * Thread-safe: each request's async context is fully isolated by AsyncLocalStorage.
 * No global state is mutated; CF Workers concurrent requests never cross-contaminate.
 */
const adminCreateCtx = new AsyncLocalStorage<true>()

/** Returns `true` when the current async context is an admin user-creation call. */
export function isAdminCreate(): boolean {
	return adminCreateCtx.getStore() === true
}

/**
 * Runs `fn` with the admin-create bypass flag active.
 * Any `databaseHooks.user.create.before` that calls `isAdminCreate()`
 * will skip the registration kill switch for the duration of `fn`.
 */
export function runAsAdminCreate<T>(fn: () => Promise<T>): Promise<T> {
	return adminCreateCtx.run(true, fn)
}
