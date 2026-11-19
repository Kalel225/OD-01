import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { Product, UNIVERSE_LABELS, UniverseId, formatFcfa } from '../../types/od01';
import { ProductThumbnail } from './ProductThumbnail';

interface CatalogModalProps {
  open: boolean;
  universe: UniverseId;
  products: Product[];
  activeProductId: string;
  onSelectProduct: (product: Product) => void;
  onClose: () => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  open,
  universe,
  products,
  activeProductId,
  onSelectProduct,
  onClose,
}) => {
  const universeProducts = useMemo(
    () => products.filter((p) => p.universe === universe),
    [products, universe]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-5 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Inventaire ${UNIVERSE_LABELS[universe]}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-3xl flex-col border border-black bg-white lg:max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header scoped strictly to the active universe */}
        <div className="flex shrink-0 items-center justify-between border-b border-black px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.12em] sm:gap-3 sm:text-[12px]">
            <span>INVENTAIRE · {UNIVERSE_LABELS[universe]}</span>
            <span className="text-[#7A7A7A] tabular-nums">({universeProducts.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'inventaire"
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-transparent text-black hover:border-black"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        {/* Scoped Product Grid */}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-px overflow-y-auto bg-[#E5E5E5] sm:grid-cols-3">
          {universeProducts.map((item) => {
            const isCurrent = item.id === activeProductId;
            const totalStock = item.sizes.reduce((sum, s) => sum + s.stock, 0);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectProduct(item)}
                className={`group flex flex-col justify-between bg-white p-3 text-left transition-colors hover:bg-[#F7F7F7] sm:p-4 ${
                  isCurrent ? 'outline outline-2 -outline-offset-2 outline-black' : ''
                }`}
              >
                <div className="w-full">
                  <div className="mb-2 flex items-center justify-between gap-1 text-[9px] text-[#7A7A7A] sm:text-[10px]">
                    <span className="truncate tabular-nums">{item.sku}</span>
                    <span className="shrink-0">{totalStock > 0 ? (isCurrent ? 'ACTIF' : 'VOIR 3D') : 'ÉPUISÉ'}</span>
                  </div>
                  <ProductThumbnail product={item} className="h-28 w-full sm:h-32 md:h-36" />
                </div>

                <div className="mt-2.5 w-full pt-2 sm:mt-3 sm:pt-2.5">
                  <div className="truncate text-[10px] font-bold text-black sm:text-[11px]">{item.name}</div>
                  <div className="mt-1 text-[10px] text-black tabular-nums sm:text-[11px]">
                    {formatFcfa(item.priceFcfa)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-[#E5E5E5] px-4 py-2.5 text-[9px] text-[#7A7A7A] sm:px-5 sm:text-[10px]">
          SÉLECTIONNER UN ARTICLE {UNIVERSE_LABELS[universe]} POUR LE CHARGER EN 3D
        </div>
      </div>
    </div>
  );
};
