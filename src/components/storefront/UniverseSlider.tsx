import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCartStore, useOD01Store } from '../../store/useOD01Store';
import {
  Product,
  UNIVERSE_LABELS,
  UNIVERSE_ORDER,
  UniverseId,
  formatFcfa,
} from '../../types/od01';
import { ProductStage3D } from '../three/ProductStage3D';
import { CartModal } from './CartModal';
import { CatalogModal } from './CatalogModal';
import { ContactModal } from './ContactModal';
import { DescriptionModal } from './DescriptionModal';
import { StorefrontHeader } from './StorefrontHeader';

interface UniverseSliderProps {
  initialFocusProductId?: string | null;
  onClearFocusProduct?: () => void;
  onNavigateAdmin: () => void;
}

export const UniverseSlider: React.FC<UniverseSliderProps> = ({
  initialFocusProductId,
  onClearFocusProduct,
  onNavigateAdmin,
}) => {
  const { activeProducts } = useOD01Store();
  const { totalItems, addToCart } = useCartStore();

  // Default universe is Index 1 = CHAUSSURES (HABITS left, ACCESSOIRES right)
  const [universeIndex, setUniverseIndex] = useState<number>(1);

  // Track active product ID per universe
  const [selectedByUniverse, setSelectedByUniverse] = useState<
    Partial<Record<UniverseId, string>>
  >({});

  // Track active size label per product ID
  const [selectedSizeByProduct, setSelectedSizeByProduct] = useState<Record<string, string>>({});

  // Modals
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Brief confirmation text on add-to-cart button
  const [justAdded, setJustAdded] = useState(false);
  const addedTimerRef = useRef<number | null>(null);

  // Horizontal swipe gesture support on universe rail
  const railTouchStartX = useRef<number | null>(null);

  const currentUniverse: UniverseId = UNIVERSE_ORDER[universeIndex] ?? 'CHAUSSURES';

  const productsByUniverse = useMemo(() => {
    const map: Record<UniverseId, Product[]> = {
      HABITS: [],
      CHAUSSURES: [],
      ACCESSOIRES: [],
    };
    for (const prod of activeProducts) {
      map[prod.universe].push(prod);
    }
    return map;
  }, [activeProducts]);

  const currentUniverseProducts = productsByUniverse[currentUniverse];

  // Handle deep-focus from Admin PWA "VOIR EN 3D SUR LA BOUTIQUE"
  useEffect(() => {
    if (!initialFocusProductId) return;
    const found = activeProducts.find((p) => p.id === initialFocusProductId);
    if (found) {
      const targetIdx = UNIVERSE_ORDER.indexOf(found.universe);
      if (targetIdx >= 0) setUniverseIndex(targetIdx);
      setSelectedByUniverse((prev) => ({ ...prev, [found.universe]: found.id }));
    }
    onClearFocusProduct?.();
  }, [initialFocusProductId, activeProducts, onClearFocusProduct]);

  const currentProduct: Product | null = useMemo(() => {
    if (currentUniverseProducts.length === 0) return activeProducts[0] ?? null;
    const chosenId = selectedByUniverse[currentUniverse];
    const match = currentUniverseProducts.find((p) => p.id === chosenId);
    return match ?? currentUniverseProducts[0];
  }, [currentUniverseProducts, selectedByUniverse, currentUniverse, activeProducts]);

  const currentItemIndex = useMemo(() => {
    if (!currentProduct) return 0;
    const idx = currentUniverseProducts.findIndex((p) => p.id === currentProduct.id);
    return idx >= 0 ? idx : 0;
  }, [currentUniverseProducts, currentProduct]);

  // Resolve selected size for current product (default to first in-stock variant)
  const activeSize = useMemo(() => {
    if (!currentProduct || currentProduct.sizes.length === 0) return null;
    const storedLabel = selectedSizeByProduct[currentProduct.id];
    const storedMatch = currentProduct.sizes.find(
      (s) => s.label === storedLabel && s.stock > 0
    );
    if (storedMatch) return storedMatch;
    return currentProduct.sizes.find((s) => s.stock > 0) ?? currentProduct.sizes[0];
  }, [currentProduct, selectedSizeByProduct]);

  const shiftUniverse = useCallback((delta: number) => {
    setUniverseIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next > UNIVERSE_ORDER.length - 1) return UNIVERSE_ORDER.length - 1;
      return next;
    });
  }, []);

  const cycleProductInUniverse = useCallback(
    (delta: number) => {
      if (currentUniverseProducts.length <= 1) return;
      const nextIdx =
        (currentItemIndex + delta + currentUniverseProducts.length) %
        currentUniverseProducts.length;
      const nextProd = currentUniverseProducts[nextIdx];
      if (nextProd) {
        setSelectedByUniverse((prev) => ({
          ...prev,
          [currentUniverse]: nextProd.id,
        }));
      }
    },
    [currentUniverseProducts, currentItemIndex, currentUniverse]
  );

  // Keyboard navigation when no modal is open
  useEffect(() => {
    const anyModalOpen = catalogOpen || descriptionOpen || cartOpen || contactOpen;
    if (anyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        shiftUniverse(-1);
      } else if (e.key === 'ArrowRight') {
        shiftUniverse(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [catalogOpen, descriptionOpen, cartOpen, contactOpen, shiftUniverse]);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current !== null) {
        window.clearTimeout(addedTimerRef.current);
      }
    };
  }, []);

  const handleSelectFromCatalog = useCallback((product: Product) => {
    const targetIdx = UNIVERSE_ORDER.indexOf(product.universe);
    if (targetIdx >= 0) {
      setUniverseIndex(targetIdx);
    }
    setSelectedByUniverse((prev) => ({
      ...prev,
      [product.universe]: product.id,
    }));
    setCatalogOpen(false);
  }, []);

  const handleAddToCart = () => {
    if (!currentProduct || !activeSize || activeSize.stock <= 0) return;

    addToCart({
      productId: currentProduct.id,
      sku: currentProduct.sku,
      name: currentProduct.name,
      universe: currentProduct.universe,
      sizeLabel: activeSize.label,
      sizeCm: activeSize.cm,
      unitPriceFcfa: currentProduct.priceFcfa,
    });

    setJustAdded(true);
    if (addedTimerRef.current !== null) {
      window.clearTimeout(addedTimerRef.current);
    }
    addedTimerRef.current = window.setTimeout(() => {
      setJustAdded(false);
    }, 950);
  };

  const handleGoHome = () => {
    setCatalogOpen(false);
    setDescriptionOpen(false);
    setCartOpen(false);
    setContactOpen(false);
    setUniverseIndex(1); // Back to CHAUSSURES center
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-black">
      {/* Fixed 48px Brutalist Navbar */}
      <StorefrontHeader
        onGoHome={handleGoHome}
        onOpenCatalog={() => setCatalogOpen(true)}
        onOpenContact={() => setContactOpen(true)}
        onGoAdmin={onNavigateAdmin}
      />

      {/* Main 100dvh No-Scroll Gallery Frame */}
      <main className="flex min-h-0 flex-1 flex-col pt-12">
        {/* Horizontal 3-Universe Slider Rail */}
        <section
          aria-label="Univers produits"
          onTouchStart={(e) => {
            railTouchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (railTouchStartX.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? railTouchStartX.current;
            const dx = endX - railTouchStartX.current;
            railTouchStartX.current = null;
            if (Math.abs(dx) > 40) {
              shiftUniverse(dx < 0 ? 1 : -1);
            }
          }}
          className="border-b border-[#E5E5E5] bg-white px-4 md:px-8"
        >
          <div className="mx-auto flex h-11 max-w-2xl items-center justify-between">
            <button
              type="button"
              onClick={() => shiftUniverse(-1)}
              disabled={universeIndex === 0}
              aria-label="Univers précédent"
              className="flex h-10 w-10 items-center justify-center text-black transition-opacity hover:opacity-60 disabled:opacity-20"
            >
              <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
            </button>

            <div className="relative grid flex-1 grid-cols-3 items-center">
              {UNIVERSE_ORDER.map((univ, idx) => {
                const isActive = idx === universeIndex;
                return (
                  <button
                    key={univ}
                    type="button"
                    onClick={() => setUniverseIndex(idx)}
                    aria-pressed={isActive}
                    className={`flex h-11 items-center justify-center text-[11px] tracking-[0.12em] transition-colors whitespace-nowrap ${
                      isActive ? 'font-bold text-black' : 'text-[#7A7A7A] hover:text-black'
                    }`}
                  >
                    {UNIVERSE_LABELS[univ]}
                  </button>
                );
              })}
              {/* Sliding 2px bottom indicator strictly compositor-animated */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-1/3 bg-black transition-transform duration-200 ease-out"
                style={{ transform: `translateX(${universeIndex * 100}%)` }}
              />
            </div>

            <button
              type="button"
              onClick={() => shiftUniverse(1)}
              disabled={universeIndex === UNIVERSE_ORDER.length - 1}
              aria-label="Univers suivant"
              className="flex h-10 w-10 items-center justify-center text-black transition-opacity hover:opacity-60 disabled:opacity-20"
            >
              <ChevronRight className="h-4 w-4 stroke-[1.5]" />
            </button>
          </div>
        </section>

        {/* Central Unobstructed Interactive 3D Stage */}
        <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-white">
          {currentProduct ? (
            <>
              <div className="relative h-full w-full max-w-4xl">
                <ProductStage3D
                  product={currentProduct}
                  onObjectClick={() => setCatalogOpen(true)}
                  interactiveCatalogClick
                />

                {/* Discreet Previous / Next Product Switcher within current universe */}
                {currentUniverseProducts.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => cycleProductInUniverse(-1)}
                      aria-label="Article précédent dans cet univers"
                      className="absolute top-1/2 left-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-[#E5E5E5] bg-white text-black transition-colors hover:border-black md:left-6"
                    >
                      <ChevronLeft className="h-4 w-4 stroke-[1.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cycleProductInUniverse(1)}
                      aria-label="Article suivant dans cet univers"
                      className="absolute top-1/2 right-3 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-[#E5E5E5] bg-white text-black transition-colors hover:border-black md:right-6"
                    >
                      <ChevronRight className="h-4 w-4 stroke-[1.5]" />
                    </button>
                  </>
                )}

                {/* Quiet micro-cue below 3D object */}
                <div className="pointer-events-none absolute right-0 bottom-2 left-0 flex items-center justify-center gap-3 text-[10px] tracking-[0.1em] text-[#7A7A7A]">
                  <span>GLISSER 360°</span>
                  <span aria-hidden="true">·</span>
                  <span>CLIQUER POUR CATALOGUE</span>
                  {currentUniverseProducts.length > 1 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {String(currentItemIndex + 1).padStart(2, '0')} /{' '}
                        {String(currentUniverseProducts.length).padStart(2, '0')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-[11px] text-[#7A7A7A]">AUCUN ARTICLE ACTIF DANS CET UNIVERS</div>
          )}
        </section>

        {/* Bottom Compact Product Control Dock */}
        {currentProduct && (
          <section className="shrink-0 border-t border-[#E5E5E5] bg-white px-4 pt-3 pb-2 md:px-8">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5">
              {/* Row 1: SKU · Name · Net FCFA Price */}
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2.5">
                  <span className="text-[10px] text-[#7A7A7A] tabular-nums whitespace-nowrap">
                    {currentProduct.sku}
                  </span>
                  <h1 className="truncate text-[12px] font-bold tracking-[0.08em] text-black">
                    {currentProduct.name}
                  </h1>
                </div>
                <div className="text-[12px] font-bold text-black tabular-nums whitespace-nowrap">
                  {formatFcfa(currentProduct.priceFcfa)}
                </div>
              </div>

              {/* Row 2: Size / Pointure Selector with Live CM Equivalence */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Sélection de taille">
                  {currentProduct.sizes.map((variant) => {
                    const isOut = variant.stock <= 0;
                    const isSelected = activeSize?.label === variant.label;
                    return (
                      <button
                        key={variant.label}
                        type="button"
                        disabled={isOut}
                        onClick={() =>
                          setSelectedSizeByProduct((prev) => ({
                            ...prev,
                            [currentProduct.id]: variant.label,
                          }))
                        }
                        aria-checked={isSelected}
                        role="radio"
                        className={`min-h-[36px] min-w-[38px] border px-2.5 text-[11px] tabular-nums transition-colors whitespace-nowrap ${
                          isOut
                            ? 'cursor-not-allowed border-[#E5E5E5] text-[#7A7A7A] line-through'
                            : isSelected
                              ? 'border-black bg-black font-bold text-white'
                              : 'border-[#E5E5E5] bg-white text-black hover:border-black'
                        }`}
                      >
                        {variant.label}
                      </button>
                    );
                  })}
                </div>

                {activeSize && (
                  <div className="text-[10px] text-[#7A7A7A] tabular-nums whitespace-nowrap">
                    ÉQUIV. {activeSize.cm}
                  </div>
                )}
              </div>

              {/* Row 3: DESCRIPTION · AJOUTER AU PANIER · Conditional PANIER (N) right next to it */}
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setDescriptionOpen(true)}
                  className="min-h-[42px] border border-black bg-white px-3.5 text-[11px] font-bold tracking-[0.1em] text-black transition-colors hover:bg-[#F7F7F7] whitespace-nowrap shrink-0"
                >
                  DESCRIPTION
                </button>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!activeSize || activeSize.stock <= 0}
                  className="min-h-[42px] flex-1 bg-black px-4 text-[11px] font-bold tracking-[0.1em] text-white transition-colors hover:bg-[#1A1A1A] disabled:bg-[#7A7A7A] whitespace-nowrap"
                >
                  {!activeSize || activeSize.stock <= 0
                    ? 'RUPTURE DE STOCK'
                    : justAdded
                      ? 'AJOUTÉ AU PANIER'
                      : 'AJOUTER AU PANIER'}
                </button>

                {totalItems > 0 && (
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="min-h-[42px] border border-black bg-white px-3.5 text-[11px] font-bold tracking-[0.1em] text-black transition-colors hover:bg-black hover:text-white tabular-nums whitespace-nowrap shrink-0"
                  >
                    PANIER ({totalItems})
                  </button>
                )}
              </div>
            </div>

            {/* Minimal Legal Signature — Zero Commercial Footer */}
            <div className="mt-2.5 text-center text-[10px] tracking-[0.14em] text-[#7A7A7A]">
              @ OD-01
            </div>
          </section>
        )}
      </main>

      {/* Modals */}
      <CatalogModal
        open={catalogOpen}
        products={activeProducts}
        activeProductId={currentProduct?.id ?? ''}
        initialFilter="TOUS"
        onSelectProduct={handleSelectFromCatalog}
        onClose={() => setCatalogOpen(false)}
      />

      {currentProduct && (
        <DescriptionModal
          open={descriptionOpen}
          product={currentProduct}
          onClose={() => setDescriptionOpen(false)}
        />
      )}

      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
};
