interface RefreshStore {
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
    const promise = (async () => {
      try {
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
      } finally {
        if (typeof window !== 'undefined') {
          for (const event of events) window.removeEventListener(event, onSessionChange);
        }
      }
      return false;
    })();
    pending = { version, promise };
    try {
      return await promise;
    } finally {
      if (pending?.promise === promise) pending = null;
    }
  };
}
