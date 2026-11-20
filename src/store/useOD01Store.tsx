import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SEED_ORDERS, SEED_PRODUCTS } from '../data/seedCatalog';
import {
  CartItem,
  CodAnalytics,
  CodOrder,
  OrderStatus,
  Product,
  buildWhatsAppOrderMessage,
} from '../types/od01';

const STORAGE_KEYS = {
  CART: 'od01_unified_cart_v2',
  PRODUCTS: 'od01_catalog_products_v4',
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

function normalizeProduct(p: Product): Product {
  const fallbackImages =
    p.images && p.images.length > 0
      ? p.images
      : p.custom3D?.views360 && p.custom3D.views360.length > 0
        ? p.custom3D.views360
        : p.custom3D?.imageDataUrl
          ? [p.custom3D.imageDataUrl]
          : [];

  return {
    ...p,
    images: fallbackImages,
    model3dUrl: p.model3dUrl ?? null,
    model3dStatus: p.model3dStatus ?? 'none',
    model3dJobId: p.model3dJobId ?? null,
    model3dError: p.model3dError ?? null,
  };
}

function loadInitialProducts(): Product[] {
  const existingV4 = readStorage<Product[] | null>(STORAGE_KEYS.PRODUCTS, null);
  if (existingV4 && existingV4.length > 0) {
    return existingV4.map(normalizeProduct);
  }
  // Preserve any custom photo-to-3D articles added earlier while upgrading flagship SKUs to 4-view 360° studio sets
  const legacyV3 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V3, []);
  const legacyV2 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V2, []);
  const legacyV1 = readStorage<Product[]>(STORAGE_KEYS.LEGACY_PRODUCTS_V1, []);
  const legacySource = legacyV3.length > 0 ? legacyV3 : legacyV2.length > 0 ? legacyV2 : legacyV1;
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

export type Product3DStatePatch = Partial<
  Pick<Product, 'images' | 'model3dUrl' | 'model3dStatus' | 'model3dJobId' | 'model3dError'>
>;

interface OD01StoreValue {
  // Catalog
  products: Product[];
  activeProducts: Product[];
  addProduct: (product: Product) => void;
  updateProduct3DState: (productId: string, patch: Product3DStatePatch) => void;
  updateProductPrice: (productId: string, priceFcfa: number) => void;
  updateVariantStock: (productId: string, sizeLabel: string, stock: number) => void;
  toggleProductActive: (productId: string) => void;
  deleteCustomProduct: (productId: string) => void;

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

  // Cross-tab synchronization so Admin PWA changes reflect instantly on Storefront tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.PRODUCTS && e.newValue) {
        try {
          setProducts(JSON.parse(e.newValue) as Product[]);
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

  const activeProducts = useMemo(
    () => products.filter((p) => p.active),
    [products]
  );

  const addProduct = useCallback((product: Product) => {
    setProducts((prev) => [normalizeProduct(product), ...prev]);
  }, []);

  const updateProduct3DState = useCallback((productId: string, patch: Product3DStatePatch) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? normalizeProduct({ ...p, ...patch }) : p))
    );
  }, []);

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
      updateProduct3DState,
      updateProductPrice,
      updateVariantStock,
      toggleProductActive,
      deleteCustomProduct,
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
      updateProduct3DState,
      updateProductPrice,
      updateVariantStock,
      toggleProductActive,
      deleteCustomProduct,
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
