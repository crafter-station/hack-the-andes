export const CHUNK_RELOAD_GUARD_KEY = "hta:chunk-reload-attempted";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type StorageProvider = () => StorageLike;

type ClerkUiComponent = "SignIn" | "SignUp";

export function clerkUiComponentForPath(
  pathname: string,
): ClerkUiComponent | null {
  if (pathname === "/sign-in" || pathname.startsWith("/sign-in/")) {
    return "SignIn";
  }
  if (pathname === "/sign-up" || pathname.startsWith("/sign-up/")) {
    return "SignUp";
  }
  return null;
}

export function shouldAutoReloadChunk(): boolean {
  // Clerk JS and shared framework chunks load on every route through the root
  // layout, so a failed load can blank any page, not only the auth routes.
  // A single guarded reload is the recovery everywhere.
  return true;
}

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorLike = error as {
    readonly name?: unknown;
    readonly message?: unknown;
  };
  if (errorLike.name === "ChunkLoadError") {
    return true;
  }

  if (typeof errorLike.message !== "string") {
    return false;
  }
  const message = errorLike.message;
  return (
    /loading (?:css )?chunk [^\s]+ failed/i.test(message) ||
    /failed to load chunk\b/i.test(message) ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    // Clerk throws this when its browser bundle fails to load, so the provider
    // never initializes and the page stays blank. Clerk states the code, not a
    // webpack chunk name, so the checks above do not catch it.
    /failed to load clerk js/i.test(message) ||
    /failed_to_load_clerk_js/i.test(message)
  );
}

export function claimChunkReload(getStorage: StorageProvider): boolean {
  try {
    const storage = getStorage();
    if (storage.getItem(CHUNK_RELOAD_GUARD_KEY) === "true") {
      return false;
    }
    storage.setItem(CHUNK_RELOAD_GUARD_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

export function clearChunkReloadGuard(getStorage: StorageProvider): void {
  try {
    const storage = getStorage();
    storage.removeItem(CHUNK_RELOAD_GUARD_KEY);
  } catch {
    // Storage is best-effort. A blocked store must not break the application.
  }
}

/**
 * Runs the single guarded reload for a recoverable load failure. Global event
 * listeners and React error boundaries share this policy so every failure
 * counts against the same one-reload-per-session limit.
 */
export function recoverFromChunkError(
  error: unknown,
  getStorage: StorageProvider,
  reload: () => void,
): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }
  if (!shouldAutoReloadChunk()) {
    return false;
  }
  if (!claimChunkReload(getStorage)) {
    return false;
  }
  reload();
  return true;
}
