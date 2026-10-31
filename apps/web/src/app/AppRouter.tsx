import { useSyncExternalStore } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';

export function AppRouter() {
  const navigating = useSyncExternalStore(router.subscribe,
    () => router.state.initialized && router.state.navigation.state !== 'idle', () => false);
  return <>
    {navigating && <div className="route-navigation-status" role="status" aria-live="polite">Đang tải trang…</div>}
    <RouterProvider router={router} />
  </>;
}
