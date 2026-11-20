import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useCartStore, useOD01Store } from '../../store/useOD01Store';
import { Product, UNIVERSE_ORDER, UniverseId } from '../../types/od01';
import { UniverseStage3D } from '../three/UniverseStage3D';
import { CartModal } from './CartModal';
import { CatalogModal } from './CatalogModal';
import { ContactModal } from './ContactModal';
import { DescriptionModal } from './DescriptionModal';
import { StorefrontHeader } from './StorefrontHeader';

const LazyProductTurntable3D = lazy(() => import('../ProductTurntable3D'));

interface UniverseSliderProps {
  initialFocusProductId?: string | null;
  onClearFocusProduct?: () => void;
  onNavigateAdmin: () => void;
  hideLogoDuringIntro?: boolean;
}

const CALLOUT_TEXT = 'CLIQUER POUR AUTRES MODÈLES';

function formatAbidjanGmtTime(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Abidjan',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `ABIDJAN, ${formatter.format(date)} GMT`;
  } catch {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `ABIDJAN, ${hh}:${mm} GMT`;
  }
}

export const UniverseSlider: React.FC<UniverseSliderProps> = ({
  initialFocusProductId,
  onClearFocusProduct,
  onNavigateAdmin,
  hideLogoDuringIntro = false,
}) => {
  const { activeProducts } = useOD01Store();
  const { totalItems, addToCart } = useCartStore();

  // Default universe is Index 1 = CHAUSSURES (HABITS left Index 0, ACCESSOIRES right Index 2)
  const [universeIndex, setUniverseIndex] = useState<number>(1);

  // Real-time Abidjan GMT clock
  const [abidjanTime, setAbidjanTime] = useState<string>(() =>
    formatAbidjanGmtTime(new Date())
  );

  // Track active product ID per universe
  const [selectedByUniverse, setSelectedByUniverse] = useState<
    Partial<Record<UniverseId, string>>
  >({});

  // Replay key for the animated technical branch + text callout
  const [calloutRunId, setCalloutRunId] = useState<number>(0);

  // Modals
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Brief confirmation text on add-to-cart button
  const [justAdded, setJustAdded] = useState(false);
  const addedTimerRef = useRef<number | null>(null);

  const replayCallout = useCallback(() => {
    setCalloutRunId((prev) => prev + 1);
  }, []);

  // Update Abidjan real-time clock every second
  useEffect(() => {
    const updateClock = () => setAbidjanTime(formatAbidjanGmtTime(new Date()));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  // Resolve the active representative product for each of the 3 universe slots [HABITS, CHAUSSURES, ACCESSOIRES]
  const slotProducts = useMemo<readonly [Product | null, Product | null, Product | null]>(() => {
    const resolveFor = (univ: UniverseId): Product | null => {
      const list = productsByUniverse[univ];
      if (list.length === 0) return null;
      const chosenId = selectedByUniverse[univ];
      return list.find((p) => p.id === chosenId) ?? list[0];
    };
    return [resolveFor('HABITS'), resolveFor('CHAUSSURES'), resolveFor('ACCESSOIRES')];
  }, [productsByUniverse, selectedByUniverse]);

  const currentProduct: Product | null = slotProducts[universeIndex] ?? activeProducts[0] ?? null;

  const currentProductInStock = useMemo(() => {
    if (!currentProduct) return false;
    return currentProduct.sizes.some((s) => s.stock > 0);
  }, [currentProduct]);

  // Replay branch + text callout whenever intro finishes, universe slides, or active article changes
  useEffect(() => {
    if (hideLogoDuringIntro) return;
    replayCallout();
  }, [hideLogoDuringIntro, universeIndex, currentProduct?.id, replayCallout]);

  const handleSetUniverseIndex = useCallback((nextIndex: number) => {
    const clamped = Math.max(0, Math.min(UNIVERSE_ORDER.length - 1, nextIndex));
    setUniverseIndex(clamped);
  }, []);

  // Keyboard navigation strictly left <-> right when no modal is open
  useEffect(() => {
    const anyModalOpen = catalogOpen || descriptionOpen || cartOpen || contactOpen;
    if (anyModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setUniverseIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight') {
        setUniverseIndex((prev) => Math.min(UNIVERSE_ORDER.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [catalogOpen, descriptionOpen, cartOpen, contactOpen]);

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
    if (!currentProduct || !currentProductInStock) return;

    // Single-size articles (e.g. UNIQUE) are auto-assigned; multi-size articles are chosen during cart validation
    const singleSize =
      currentProduct.sizes.length === 1 ? currentProduct.sizes[0] : null;

    addToCart({
      productId: currentProduct.id,
      sku: currentProduct.sku,
      name: currentProduct.name,
      universe: currentProduct.universe,
      sizeLabel: singleSize ? singleSize.label : '',
      sizeCm: singleSize ? singleSize.cm : '',
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
    setUniverseIndex(1); // Return to CHAUSSURES center
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-black">
      {/* Fixed 48px Borderless Navbar */}
      <StorefrontHeader
        onGoHome={handleGoHome}
        onOpenCatalog={() => setCatalogOpen(true)}
        onOpenContact={() => setContactOpen(true)}
        onGoAdmin={onNavigateAdmin}
        hideLogoDuringIntro={hideLogoDuringIntro}
      />

      {/* Seamless 100dvh Borderless Gallery Stage */}
      <main className="relative flex min-h-0 flex-1 flex-col pt-12">
        {/* Real-time Abidjan GMT Clock (Top-Right of Content Area) */}
        <div
          aria-live="off"
          className="pointer-events-none absolute top-13 right-4 z-20 text-[9px] tracking-[0.12em] text-[#7A7A7A] tabular-nums sm:top-14 sm:right-6 sm:text-[10px] md:right-8"
        >
          {abidjanTime}
        </div>

        {/* Central 3D Spatial 3-Universe Stage (HABITS left · CHAUSSURES center · ACCESSOIRES right) */}
        <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white">
          {currentProduct?.model3dStatus === 'ready' && currentProduct.model3dUrl ? (
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center bg-white text-[10px] tracking-[0.12em] text-[#7A7A7A]">
                  CHARGEMENT 3D...
                </div>
              }
            >
              <LazyProductTurntable3D
                model3dUrl={currentProduct.model3dUrl}
                model3dStatus={currentProduct.model3dStatus}
                images={
                  currentProduct.images && currentProduct.images.length > 0
                    ? currentProduct.images
                    : currentProduct.custom3D?.imageDataUrl
                      ? [currentProduct.custom3D.imageDataUrl]
                      : []
                }
                alt={currentProduct.name}
                className="h-full w-full"
              />
            </Suspense>
          ) : (
            <UniverseStage3D
              slots={slotProducts}
              activeIndex={universeIndex}
              onChangeIndex={handleSetUniverseIndex}
              onActiveProductClick={() => setCatalogOpen(true)}
              onArticleMove={replayCallout}
            />
          )}

          {/* Non-button technical leader branch + animated text above & slightly right of the foreground article */}
          {!hideLogoDuringIntro && currentProduct && (
            <div
              key={calloutRunId}
              aria-hidden="true"
              className="pointer-events-none absolute top-[13%] left-1/2 z-10 flex max-w-[46vw] translate-x-[4%] items-start select-none sm:top-[15%] sm:max-w-[44vw] sm:translate-x-[10%] md:top-[16%] md:max-w-[42vw] md:translate-x-[14%] lg:top-[17%] lg:translate-x-[16%]"
            >
              {/* Animated hairline branch connecting the upper-right edge of the article to the label */}
              <svg
                viewBox="0 0 64 42"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-9 shrink-0 overflow-visible sm:h-9 sm:w-12 md:h-[42px] md:w-16"
              >
                <motion.rect
                  x="0.5"
                  y="36.5"
                  width="3"
                  height="3"
                  fill="#000000"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
                <motion.path
                  d="M 2 38 L 28 8 L 64 8"
                  stroke="#000000"
                  strokeWidth="1"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    delay: 0.12,
                    duration: 0.52,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              </svg>

              {/* Small animated text attached to the branch tip (not a button) */}
              <div className="ml-1.5 mt-[1px] flex flex-wrap items-center text-[8px] leading-[1.35] tracking-[0.1em] text-[#7A7A7A] sm:ml-2 sm:mt-[2px] sm:flex-nowrap sm:text-[9px] sm:leading-none sm:whitespace-nowrap">
                {Array.from(CALLOUT_TEXT).map((ch, idx) => (
                  <motion.span
                    key={`${calloutRunId}-${idx}`}
                    initial={{ opacity: 0, x: -3 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.44 + idx * 0.018,
                      duration: 0.22,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="inline-block"
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </motion.span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Borderless Minimal Bottom Dock (SKU + Actions + @ OD-01 only) */}
        {currentProduct && (
          <section className="shrink-0 bg-white px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 md:px-8">
            <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2.5 md:max-w-xl md:gap-3">
              {/* SKU Code Only */}
              <div className="text-[10px] font-bold tracking-[0.14em] text-black tabular-nums sm:text-[11px]">
                {currentProduct.sku}
              </div>

              {/* Action Row: DESCRIPTION · AJOUTER AU PANIER · Conditional PANIER (N) */}
              <div className="flex w-full items-stretch gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setDescriptionOpen(true)}
                  className="min-h-[42px] shrink-0 bg-white px-2.5 text-[10px] font-bold tracking-[0.08em] text-black transition-colors hover:bg-[#F7F7F7] whitespace-nowrap sm:px-3.5 sm:text-[11px] sm:tracking-[0.1em]"
                >
                  DESCRIPTION
                </button>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!currentProductInStock}
                  className="min-h-[42px] min-w-0 flex-1 bg-black px-3 text-[10px] font-bold tracking-[0.08em] text-white transition-colors hover:bg-[#1A1A1A] disabled:bg-[#7A7A7A] whitespace-nowrap sm:px-4 sm:text-[11px] sm:tracking-[0.1em]"
                >
                  {!currentProductInStock
                    ? 'RUPTURE DE STOCK'
                    : justAdded
                      ? 'AJOUTÉ AU PANIER'
                      : 'AJOUTER AU PANIER'}
                </button>

                {totalItems > 0 && (
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="min-h-[42px] shrink-0 bg-white px-2.5 text-[10px] font-bold tracking-[0.08em] text-black transition-colors hover:bg-[#F7F7F7] tabular-nums whitespace-nowrap sm:px-3.5 sm:text-[11px] sm:tracking-[0.1em]"
                  >
                    PANIER ({totalItems})
                  </button>
                )}
              </div>
            </div>

            {/* Minimal Legal Signature */}
            <div className="mt-2.5 text-center text-[10px] tracking-[0.14em] text-[#7A7A7A] sm:mt-3">
              @ OD-01
            </div>
          </section>
        )}
      </main>

      {/* Modals — Catalog strictly scoped to active universe */}
      <CatalogModal
        open={catalogOpen}
        universe={currentUniverse}
        products={activeProducts}
        activeProductId={currentProduct?.id ?? ''}
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
