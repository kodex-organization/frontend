interface RefreshStore {
  lockName: string;
  getVersion: () => string | null;
  getToken: () => string | null;
  setToken: (token: string) => void;
  clear: () => void;
  changeEvents: string[];
}

interface RefreshResult {
  accessToken?: string;
  unauthorized?: boolean;
}

/** Refresh only the session that started the request. Login, logout and
 * branch switching change the version; routine token rotation does not. */
export function createSessionRefresh(
  store: RefreshStore,
  request: (signal: AbortSignal) => Promise<RefreshResult>,
) {
  let pending: { version: string | null; promise: Promise<boolean> } | null = null;
  return async (): Promise<boolean> => {
    const version = store.getVersion();
    if (pending?.version === version) return pending.promise;
    const token = store.getToken();
    const controller = new AbortController();
    const onSessionChange = () => {
      if (store.getVersion() !== version) controller.abort();
    };
    const events = [...store.changeEvents, 'storage'];
    if (typeof window !== 'undefined') {
      for (const event of events) window.addEventListener(event, onSessionChange);
    }
    const refresh = async () => {
      try {
        // A different tab may have refreshed or replaced this session while
        // this tab waited for the origin-wide lock. Recheck before sending cookies.
        if (store.getVersion() !== version) return false;
        if (store.getToken() !== token) return Boolean(store.getToken());
        const result = await request(controller.signal);
        if (store.getVersion() !== version) return false;
        // Another tab may have already refreshed this same session.
        if (store.getToken() !== token) return Boolean(store.getToken());
        if (result.accessToken) {
          store.setToken(result.accessToken);
          return true;
        }
        if (result.unauthorized) store.clear();
      } catch {
        // Network/server failures are not evidence that the user logged out.
      }
      return false;
    };
    // The in-memory promise only deduplicates one tab. Web Locks serialize
    // cookie rotation across tabs without accepting replayed refresh tokens.
    const promise = Promise.resolve(typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request(store.lockName, refresh)
      : refresh());
    pending = { version, promise };
    try {
      return await promise;
    } catch {
      // A denied/unavailable browser lock is not evidence of session expiry.
      return false;
    } finally {
      if (typeof window !== 'undefined') {
        for (const event of events) window.removeEventListener(event, onSessionChange);
      }
      if (pending?.promise === promise) pending = null;
    }
  };
}
