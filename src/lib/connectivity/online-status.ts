'use client';

import { useSyncExternalStore } from 'react';
import { env } from '@/config/env';
import { createConnectionStore, probeSyncServer } from './connection-store';
export { connectionLabel } from './connection-store';

const connection = createConnectionStore({
  browserOnline: () => typeof navigator !== 'undefined' && navigator.onLine,
  probe: async signal => {
    const configuredPath = new URL(env.NEXT_PUBLIC_API_URL).pathname.replace(/\/$/, '');
    const base = configuredPath && configuredPath !== '/' ? configuredPath : '/api/backend';
    return probeSyncServer(`${base}/sync/server-time?_connection=${Date.now()}`, signal);
  },
  listen: (networkChanged, wake) => {
    const onVisible = () => { if (document.visibilityState === 'visible') wake(); };
    window.addEventListener('online', networkChanged);
    window.addEventListener('offline', networkChanged);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', networkChanged);
      window.removeEventListener('offline', networkChanged);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', onVisible);
    };
  },
});

export const checkServerConnection = connection.check;
export const getConnectionStatus = connection.getSnapshot;

export function useConnectionStatus() {
  return useSyncExternalStore(connection.subscribe, connection.getSnapshot, () => 'checking' as const);
}

export function useOnlineStatus() {
  return useConnectionStatus() === 'online';
}
