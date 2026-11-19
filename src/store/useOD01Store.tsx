import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SEED_ORDERS, SEED_PRODUCTS } from '../data/seedCatalog';
import {
  CartItem,
  CodAnalytics,
  CodOrder,
  Model3DStatus,
  OrderStatus,
  Product,
  buildWhatsAppOrderMessage,
} from '../types/od01';

const STORAGE_KEYS = {
  CART: 'od01_unified_cart_v2',
  PRODUCTS: 'od01_catalog_products_v5',
  LEGACY_PRODUCTS_V4: 'od01_catalog_products_v4',
  LEGACY_PRODUCTS_V3: 'od01_catalog_products_v3',
  LEGACY_PRODUCTS_V2: 'od01_catalog_products_v2',
  LEGACY_PRODUCTS_V1: 'od01_catalog_products_v1',
  ORDERS: 'od01_cod_orders_v2',
} as const;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeProduct(raw: Product): Product {
  const derivedImages: string[] =
    Array.isArray(raw.images) && raw.images.length > 0
      ? raw.images.filter((u): u is string => typeof u === 'string' && u.length > 0).slice(0, 4)
      : raw.custom3D?.views360 && raw.custom3D.views360.length > 0
        ? raw.custom3D.views360.slice(0, 4)
        : raw.custom3D?.imageDataUrl
          ? [raw.custom3D.imageDataUrl]
          : [];

  return {
    ...raw,
    images: derivedImages,
    model3dUrl: raw.model3dUrl ?? null,
    model3dStatus: raw.model3dStatus ?? 'none',
    model3dJobId: raw.model3dJobId ?? null,
    model3dEndpoint: raw.model3dEndpoint ?? null,
    model3dError: raw.model3dError ?? null,
  };
}

function loadInitialProducts(): Product[] {
  const existingV5 = readStorage<Product[] | null>(STORAGE_KEYS.PRODUCTS, null);
  if (existingV5 && existingV5.length > 0) {
    return existingV5.map(normalizeProduct);
  }
  // Preserve any custom photo-to-3D articles added earlier while upgrading flagship SKUs to 8-angle 360° continuous studio sets
  const legacyV4 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V4, []);
  const legacyV3 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V3, []);
  const legacyV2 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V2, []);
  const legacyV1 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V1, []);
  const legacySource =
    legacyV4.length > 0
      ? legacyV4
      : legacyV3.length > 0
        ? legacyV3
        : legacyV2.length > 0
          ? legacyV2
          : legacyV1;
  const customOnly = legacySource.filter((p) => p.isCustom);
  return [...customOnly, ...SEED_PRODUCTS].map(normalizeProduct);
}

function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors cleanly without crashing UX
  }
}

export interface PlaceOrderInput {
  customerName: string;
  whatsapp: string;
  commune: string;
  landmark: string;
}

export type Product3DPatch = Partial<
  Pick<
    Product,
    'images' | 'model3dUrl' | 'model3dStatus' | 'model3dJobId' | 'model3dEndpoint' | 'model3dError'
  >
>;

interface OD01StoreValue {
  // Catalog
  products: Product[];
  activeProducts: Product[];
  addProduct: (product: Product) => void;
  updateProductPrice: (productId: string, priceFcfa: number) => void;
  updateVariantStock: (productId: string, sizeLabel: string, stock: number) => void;
  toggleProductActive: (productId: string) => void;
  deleteCustomProduct: (productId: string) => void;

  // 3D (.glb) Turntable Pipeline
  updateProduct3DState: (productId: string, patch: Product3DPatch) => void;
  triggerProduct3DGeneration: (productId: string, overrideImages?: string[]) => Promise<void>;
  pollProduct3DStatus: (productId: string) => Promise<void>;

  // Unified Cross-Universe Cart
  cart: CartItem[];
  totalCartItems: number;
  totalCartFcfa: number;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  updateCartQuantity: (productId: string, sizeLabel: string, delta: number) => void;
  updateCartItemSize: (
    productId: string,
    currentSizeLabel: string,
    nextSizeLabel: string,
    nextSizeCm: string
  ) => void;
  removeFromCart: (productId: string, sizeLabel: string) => void;
  clearCart: () => void;

  // COD Orders & Analytics
  orders: CodOrder[];
  analytics: CodAnalytics;
  placeCodOrder: (input: PlaceOrderInput) => CodOrder;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
}

const OD01StoreContext = createContext<OD01StoreValue | null>(null);

export const OD01StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => loadInitialProducts());
  const [cart, setCart] = useState<CartItem[]>(() =>
    readStorage<CartItem[]>(STORAGE_KEYS.CART, [])
  );
  const [orders, setOrders] = useState<CodOrder[]>(() =>
    readStorage<CodOrder[]>(STORAGE_KEYS.ORDERS, SEED_ORDERS)
  );

  useEffect(() => {
    writeStorage(STORAGE_KEYS.PRODUCTS, products);
  }, [products]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.CART, cart);
  }, [cart]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.ORDERS, orders);
  }, [orders]);

  const productsRef = useRef<Product[]>(products);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Cross-tab synchronization so Admin PWA changes reflect instantly on Storefront tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PRODUCTS && e.newValue) {
        try {
          setProducts((JSON.parse(e.newValue) as Product[]).map(normalizeProduct));
        } catch {
          // ignore malformed external writes
        }
      } else if (e.key === STORAGE_KEYS.CART && e.newValue) {
        try {
          setCart(JSON.parse(e.newValue) as CartItem[]);
        } catch {
          // ignore
        }
      } else if (e.key === STORAGE_KEYS.ORDERS && e.newValue) {
        try {
          setOrders(JSON.parse(e.newValue) as CodOrder[]);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Hydrate persisted server-side 3D `.glb` states on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/products/3d-states')
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          payload: {
            states?: Record<
              string,
              {
                model3dUrl: string | null;
                model3dStatus: Model3DStatus;
                model3dJobId: string | null;
                model3dEndpoint: string | null;
                model3dError: string | null;
              }
            >;
          } | null
        ) => {
          if (cancelled || !payload?.states) return;
          const states = payload.states;
          setProducts((prev) =>
            prev.map((prod) => {
              const remote = states[prod.id];
              if (!remote) return prod;
              return {
                ...prod,
                model3dUrl: remote.model3dUrl ?? prod.model3dUrl,
                model3dStatus: remote.model3dStatus ?? prod.model3dStatus,
                model3dJobId: remote.model3dJobId ?? prod.model3dJobId,
                model3dEndpoint: remote.model3dEndpoint ?? prod.model3dEndpoint,
                model3dError: remote.model3dError ?? prod.model3dError,
              };
            })
          );
        }
      )
      .catch(() => {
        // Server might be starting; local state stays intact
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeProducts = useMemo(
    () => products.filter((p) => p.active),
    [products]
  );

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [normalizeProduct(product), ...prev]);
  }, []);

  const updateProduct3DState = useCallback((productId: string, patch: Product3DPatch) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...patch } : p))
    );
  }, []);

  const triggerProduct3DGeneration = useCallback(
    async (productId: string, overrideImages?: string[]) => {
      const target = productsRef.current.find((p) => p.id === productId);
      const images =
        overrideImages && overrideImages.length > 0
          ? overrideImages
          : target?.images && target.images.length > 0
            ? target.images
            : target?.custom3D?.imageDataUrl
              ? [target.custom3D.imageDataUrl]
              : [];

      if (images.length === 0) {
        updateProduct3DState(productId, {
          model3dStatus: 'failed',
          model3dError: 'Aucune photo produit disponible pour la reconstruction 3D.',
        });
        return;
      }

      updateProduct3DState(productId, {
        images: images.slice(0, 4),
        model3dStatus: 'pending',
        model3dError: null,
      });

      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(productId)}/generate-3d`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: images.slice(0, 4) }),
          }
        );

        const data = (await response.json().catch(() => ({}))) as {
          status?: Model3DStatus;
          jobId?: string | null;
          endpoint?: string | null;
          error?: string;
        };

        if (!response.ok || data.status === 'failed') {
          updateProduct3DState(productId, {
            model3dStatus: 'failed',
            model3dError:
              data.error ||
              `Échec du lancement de la reconstruction 3D (HTTP ${response.status}).`,
          });
          return;
        }

        updateProduct3DState(productId, {
          model3dStatus: data.status ?? 'processing',
          model3dJobId: data.jobId ?? null,
          model3dEndpoint: data.endpoint ?? null,
          model3dError: null,
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur réseau lors du lancement de la reconstruction 3D.';
        updateProduct3DState(productId, {
          model3dStatus: 'failed',
          model3dError: message,
        });
      }
    },
    [updateProduct3DState]
  );

  const pollProduct3DStatus = useCallback(
    async (productId: string) => {
      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(productId)}/generate-3d/status`
        );
        if (!response.ok && response.status === 404) return;

        const data = (await response.json().catch(() => null)) as {
          status?: Model3DStatus;
          model3dUrl?: string | null;
          jobId?: string | null;
          endpoint?: string | null;
          error?: string | null;
        } | null;

        if (!data || !data.status) return;

        updateProduct3DState(productId, {
          model3dStatus: data.status,
          model3dUrl: data.model3dUrl ?? undefined,
          model3dJobId: data.jobId ?? undefined,
          model3dEndpoint: data.endpoint ?? undefined,
          model3dError: data.error ?? null,
        });
      } catch {
        // Keep current processing status and retry on next 4s tick
      }
    },
    [updateProduct3DState]
  );

  // Automatic 4-second polling loop whenever any product is pending or processing
  const pollingKey = useMemo(
    () =>
      products
        .filter((p) => p.model3dStatus === 'pending' || p.model3dStatus === 'processing')
        .map((p) => p.id)
        .join(','),
    [products]
  );

  useEffect(() => {
    if (!pollingKey) return;
    const ids = pollingKey.split(',').filter(Boolean);
    const interval = window.setInterval(() => {
      for (const id of ids) {
        void pollProduct3DStatus(id);
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [pollingKey, pollProduct3DStatus]);

  const updateProductPrice = useCallback((productId: string, priceFcfa: number) => {
    const safePrice = Math.max(0, Math.round(priceFcfa));
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, priceFcfa: safePrice } : p))
    );
  }, []);

  const updateVariantStock = useCallback(
    (productId: string, sizeLabel: string, stock: number) => {
      const safeStock = Math.max(0, Math.round(stock));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                sizes: p.sizes.map((s) =>
                  s.label === sizeLabel ? { ...s, stock: safeStock } : s
                ),
              }
            : p
        )
      );
    },
    []
  );

  const toggleProductActive = useCallback((productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, active: !p.active } : p))
    );
  }, []);

  const deleteCustomProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((c) => c.productId !== productId));
  }, []);

  const addToCart = useCallback((incoming: Omit<CartItem, 'quantity'>) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (item) =>
          item.productId === incoming.productId &&
          item.sizeLabel === incoming.sizeLabel
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { ...incoming, quantity: 1 }];
    });
  }, []);

  const updateCartQuantity = useCallback(
    (productId: string, sizeLabel: string, delta: number) => {
      setCart((prev) =>
        prev
          .map((item) =>
            item.productId === productId && item.sizeLabel === sizeLabel
              ? { ...item, quantity: item.quantity + delta }
              : item
          )
          .filter((item) => item.quantity > 0)
      );
    },
    []
  );

  const updateCartItemSize = useCallback(
    (
      productId: string,
      currentSizeLabel: string,
      nextSizeLabel: string,
      nextSizeCm: string
    ) => {
      if (currentSizeLabel === nextSizeLabel) return;
      setCart((prev) => {
        const sourceIdx = prev.findIndex(
          (item) =>
            item.productId === productId && item.sizeLabel === currentSizeLabel
        );
        if (sourceIdx < 0) return prev;

        const targetIdx = prev.findIndex(
          (item) =>
            item.productId === productId && item.sizeLabel === nextSizeLabel
        );

        const next = [...prev];
        if (targetIdx >= 0 && targetIdx !== sourceIdx) {
          next[targetIdx] = {
            ...next[targetIdx],
            sizeCm: nextSizeCm,
            quantity: next[targetIdx].quantity + next[sourceIdx].quantity,
          };
          next.splice(sourceIdx, 1);
          return next;
        }

        next[sourceIdx] = {
          ...next[sourceIdx],
          sizeLabel: nextSizeLabel,
          sizeCm: nextSizeCm,
        };
        return next;
      });
    },
    []
  );

  const removeFromCart = useCallback((productId: string, sizeLabel: string) => {
    setCart((prev) =>
      prev.filter(
        (item) => !(item.productId === productId && item.sizeLabel === sizeLabel)
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const totalCartFcfa = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPriceFcfa * item.quantity, 0),
    [cart]
  );

  const placeCodOrder = useCallback(
    (input: PlaceOrderInput): CodOrder => {
      const orderNum = 1046 + orders.length;
      const reference = `CMD-OD01-${orderNum}`;
      const snapshotItems = cart.map((item) => ({ ...item }));
      const totalFcfa = snapshotItems.reduce(
        (sum, item) => sum + item.unitPriceFcfa * item.quantity,
        0
      );

      const whatsappMessage = buildWhatsAppOrderMessage({
        reference,
        customerName: input.customerName.trim(),
        whatsapp: input.whatsapp.trim(),
        commune: input.commune.trim(),
        landmark: input.landmark.trim(),
        items: snapshotItems,
        totalFcfa,
      });

      const newOrder: CodOrder = {
        id: `ord-${Date.now()}`,
        reference,
        createdAt: new Date().toISOString(),
        customerName: input.customerName.trim().toUpperCase(),
        whatsapp: input.whatsapp.trim(),
        commune: input.commune.trim().toUpperCase(),
        landmark: input.landmark.trim().toUpperCase(),
        items: snapshotItems,
        totalFcfa,
        status: 'EN_ATTENTE',
        whatsappMessage,
      };

      // Decrement ordered stock cleanly
      setProducts((prev) =>
        prev.map((prod) => {
          const matchingLines = snapshotItems.filter((i) => i.productId === prod.id);
          if (matchingLines.length === 0) return prod;
          return {
            ...prod,
            sizes: prod.sizes.map((variant) => {
              const line = matchingLines.find((l) => l.sizeLabel === variant.label);
              if (!line) return variant;
              return { ...variant, stock: Math.max(0, variant.stock - line.quantity) };
            }),
          };
        })
      );

      setOrders((prev) => [newOrder, ...prev]);
      setCart([]);
      return newOrder;
    },
    [cart, orders.length]
  );

  const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status } : order))
    );
  }, []);

  const analytics = useMemo<CodAnalytics>(() => {
    const totalOrders = orders.length;
    if (totalOrders === 0) {
      return {
        totalOrders: 0,
        caEngageFcfa: 0,
        caEncaisseFcfa: 0,
        confirmationRate: 0,
        ndrRate: 0,
        pendingCount: 0,
        deliveredCount: 0,
        refusedCount: 0,
      };
    }

    let caEngageFcfa = 0;
    let caEncaisseFcfa = 0;
    let confirmedOrMore = 0;
    let deliveredCount = 0;
    let refusedCount = 0;
    let pendingCount = 0;

    for (const order of orders) {
      if (order.status !== 'REFUSEE_NDR') {
        caEngageFcfa += order.totalFcfa;
      }
      if (order.status === 'LIVREE') {
        caEncaisseFcfa += order.totalFcfa;
        deliveredCount += 1;
        confirmedOrMore += 1;
      } else if (order.status === 'CONFIRMEE' || order.status === 'EN_LIVRAISON') {
        confirmedOrMore += 1;
      } else if (order.status === 'REFUSEE_NDR') {
        refusedCount += 1;
      } else {
        pendingCount += 1;
      }
    }

    return {
      totalOrders,
      caEngageFcfa,
      caEncaisseFcfa,
      confirmationRate: Math.round((confirmedOrMore / totalOrders) * 100),
      ndrRate: Math.round((refusedCount / totalOrders) * 100),
      pendingCount,
      deliveredCount,
      refusedCount,
    };
  }, [orders]);

  const value = useMemo<OD01StoreValue>(
    () => ({
      products,
      activeProducts,
      addProduct,
      updateProductPrice,
      updateVariantStock,
      toggleProductActive,
      deleteCustomProduct,
      updateProduct3DState,
      triggerProduct3DGeneration,
      pollProduct3DStatus,
      cart,
      totalCartItems,
      totalCartFcfa,
      addToCart,
      updateCartQuantity,
      updateCartItemSize,
      removeFromCart,
      clearCart,
      orders,
      analytics,
      placeCodOrder,
      updateOrderStatus,
    }),
    [
      products,
      activeProducts,
      addProduct,
      updateProductPrice,
      updateVariantStock,
      toggleProductActive,
      deleteCustomProduct,
      updateProduct3DState,
      triggerProduct3DGeneration,
      pollProduct3DStatus,
      cart,
      totalCartItems,
      totalCartFcfa,
      addToCart,
      updateCartQuantity,
      updateCartItemSize,
      removeFromCart,
      clearCart,
      orders,
      analytics,
      placeCodOrder,
      updateOrderStatus,
    ]
  );

  return (
    <OD01StoreContext.Provider value={value}>{children}</OD01StoreContext.Provider>
  );
};

export function useOD01Store(): OD01StoreValue {
  const ctx = useContext(OD01StoreContext);
  if (!ctx) {
    throw new Error('useOD01Store must be used inside OD01StoreProvider');
  }
  return ctx;
}

/** Alias preserving the specification naming for cart operations */
export function useCartStore() {
  const store = useOD01Store();
  return {
    items: store.cart,
    totalItems: store.totalCartItems,
    totalFcfa: store.totalCartFcfa,
    addToCart: store.addToCart,
    updateQuantity: store.updateCartQuantity,
    updateItemSize: store.updateCartItemSize,
    removeItem: store.removeFromCart,
    clearCart: store.clearCart,
    placeCodOrder: store.placeCodOrder,
  };
}
