export type ConnectionStatus = 'checking' | 'online' | 'offline';

interface ConnectionOptions {
  browserOnline: () => boolean;
  probe: (signal: AbortSignal) => Promise<boolean>;
  listen?: (networkChanged: () => void, wake: () => void) => () => void;
  pollMs?: number;
  timeoutMs?: number;
}

/** One probe/poll loop shared by all connection indicators. */
export function createConnectionStore(options: ConnectionOptions) {
  let status: ConnectionStatus = 'checking';
  const listeners = new Set<() => void>();
  let generation = 0;
  let pending: Promise<ConnectionStatus> | null = null;
  let controller: AbortController | null = null;
  let poll: ReturnType<typeof setInterval> | undefined;
  let stopListening: (() => void) | undefined;
  const publish = (next: ConnectionStatus) => {
    if (status === next) return;
    status = next;
    for (const notify of listeners) notify();
  };
  const invalidate = () => {
    generation++;
    controller?.abort();
    controller = null;
    pending = null;
  };
  const getSnapshot = (): ConnectionStatus => options.browserOnline() ? status : 'offline';
  const check = (): Promise<ConnectionStatus> => {
    if (!options.browserOnline()) {
      invalidate();
      publish('offline');
      return Promise.resolve('offline');
    }
    if (pending) return pending;
    const id = generation;
    const requestController = new AbortController();
    controller = requestController;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<boolean>(resolve => {
      timer = setTimeout(() => {
        resolve(false);
        requestController.abort();
      }, options.timeoutMs ?? 4000);
      requestController.signal.addEventListener('abort', () => resolve(false), { once: true });
    });
    const probe = Promise.resolve().then(() => options.probe(requestController.signal)).catch(() => false);
    const request = Promise.race([probe, timeout]).then(reachable => {
      if (id === generation) publish(reachable && options.browserOnline() ? 'online' : 'offline');
      return getSnapshot();
    }).finally(() => {
      clearTimeout(timer);
      if (pending === request) { pending = null; controller = null; }
    });
    pending = request;
    return request;
  };
  const networkChanged = () => {
    invalidate();
    publish(options.browserOnline() ? 'checking' : 'offline');
    void check();
  };
  const subscribe = (notify: () => void) => {
    listeners.add(notify);
    if (listeners.size === 1) {
      publish(options.browserOnline() ? 'checking' : 'offline');
      stopListening = options.listen?.(networkChanged, () => { void check(); });
      poll = setInterval(() => { void check(); }, options.pollMs ?? 15000);
      void check();
    }
    return () => {
      listeners.delete(notify);
      if (listeners.size === 0) {
        clearInterval(poll);
        stopListening?.();
        stopListening = undefined;
        invalidate();
      }
    };
  };
  return { subscribe, getSnapshot, check, networkChanged };
}

export function connectionLabel(status: ConnectionStatus) {
  return status === 'online' ? 'Sync server connected' : status === 'checking' ? 'Checking connection...' : 'Offline mode';
}

/** A captive portal, cached HTML, 500 or auth error is not a healthy sync API. */
export async function probeSyncServer(url: string, signal: AbortSignal): Promise<boolean> {
  const response = await fetch(url, { method: 'GET', cache: 'no-store', credentials: 'omit', signal });
  if (!response.ok) return false;
  const body = await response.json().catch(() => null);
  return body?.success === true && typeof body.data?.serverTime === 'string' &&
    Number.isFinite(Date.parse(body.data.serverTime));
}
