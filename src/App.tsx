import { useCallback, useEffect, useState } from 'react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { OfflineIndicator } from './components/admin/PWAInstallButton';
import { UniverseSlider } from './components/storefront/UniverseSlider';
import { OD01StoreProvider } from './store/useOD01Store';

type AppRoute = 'STOREFRONT' | 'ADMIN';

function readRouteFromLocation(): AppRoute {
  if (typeof window === 'undefined') return 'STOREFRONT';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path.startsWith('/admin') || hash.startsWith('#/admin')) {
    return 'ADMIN';
  }
  return 'STOREFRONT';
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() => readRouteFromLocation());
  const [focusProductId, setFocusProductId] = useState<string | null>(null);

  useEffect(() => {
    const syncRoute = () => setRoute(readRouteFromLocation());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const navigateToAdmin = useCallback(() => {
    if (window.location.pathname !== '/admin') {
      try {
        window.history.pushState({}, '', '/admin');
      } catch {
        window.location.hash = '#/admin';
      }
    }
    setRoute('ADMIN');
  }, []);

  const navigateToStorefront = useCallback((productId?: string) => {
    if (productId) {
      setFocusProductId(productId);
    }
    if (window.location.pathname !== '/') {
      try {
        window.history.pushState({}, '', '/');
      } catch {
        window.location.hash = '';
      }
    }
    setRoute('STOREFRONT');
  }, []);

  const clearFocusProduct = useCallback(() => {
    setFocusProductId(null);
  }, []);

  return (
    <OD01StoreProvider>
      {route === 'ADMIN' ? (
        <AdminDashboard onNavigateStorefront={navigateToStorefront} />
      ) : (
        <>
          <UniverseSlider
            initialFocusProductId={focusProductId}
            onClearFocusProduct={clearFocusProduct}
            onNavigateAdmin={navigateToAdmin}
          />
          <OfflineIndicator />
        </>
      )}
    </OD01StoreProvider>
  );
}
