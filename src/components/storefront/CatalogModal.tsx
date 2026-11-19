import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Product, UNIVERSE_ORDER, UniverseId, formatFcfa } from '../../types/od01';
import { ProductThumbnail } from './ProductThumbnail';

interface CatalogModalProps {
  open: boolean;
  products: Product[];
  activeProductId: string;
  initialFilter?: UniverseId | 'TOUS';
  onSelectProduct: (product: Product) => void;
  onClose: () => void;
}

export const CatalogModal: React.FC<CatalogModalProps> = ({
  open,
  products,
  activeProductId,
  initialFilter = 'TOUS',
  onSelectProduct,
  onClose,
}) => {
  const [filter, setFilter] = useState<UniverseId | 'TOUS'>(initialFilter);

  const filteredProducts = useMemo(() => {
    if (filter === 'TOUS') return products;
    return products.filter((p) => p.universe === filter);
  }, [products, filter]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Catalogue OD-01"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-4xl flex-col border border-black bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-black px-5 py-3.5">
          <div className="flex items-center gap-3 text-[12px] font-bold tracking-[0.12em]">
            <span>CATALOGUE ARCHIVE</span>
            <span className="text-[#7A7A7A] tabular-nums">({filteredProducts.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le catalogue"
            className="flex h-10 w-10 items-center justify-center border border-transparent text-black hover:border-black"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        {/* Universe Filter Bar */}
        <div className="flex flex-wrap items-center gap-1 border-b border-[#E5E5E5] px-5 py-2.5">
          {(['TOUS', ...UNIVERSE_ORDER] as const).map((tab) => {
            const isSelected = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`min-h-[36px] px-3.5 text-[11px] tracking-[0.1em] transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-black text-white'
                    : 'bg-white text-[#7A7A7A] hover:text-black'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Product Grid */}
        <div className="grid flex-1 grid-cols-2 gap-px overflow-y-auto bg-[#E5E5E5] sm:grid-cols-3">
          {filteredProducts.map((item) => {
            const isCurrent = item.id === activeProductId;
            const totalStock = item.sizes.reduce((sum, s) => sum + s.stock, 0);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectProduct(item)}
                className={`group flex flex-col justify-between bg-white p-4 text-left transition-colors hover:bg-[#F7F7F7] ${
                  isCurrent ? 'outline outline-2 -outline-offset-2 outline-black' : ''
                }`}
              >
                <div className="w-full">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-[#7A7A7A]">
                    <span className="tabular-nums">{item.sku}</span>
                    <span>{item.universe}</span>
                  </div>
                  <ProductThumbnail product={item} className="h-28 w-full md:h-32" />
                </div>

                <div className="mt-3 w-full border-t border-[#E5E5E5] pt-2.5">
                  <div className="truncate text-[11px] font-bold text-black">{item.name}</div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="tabular-nums text-black">{formatFcfa(item.priceFcfa)}</span>
                    <span className="text-[10px] text-[#7A7A7A]">
                      {totalStock > 0 ? (isCurrent ? 'ACTIF' : 'VOIR 3D') : 'ÉPUISÉ'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Subtle instruction strip */}
        <div className="border-t border-[#E5E5E5] px-5 py-2.5 text-[10px] text-[#7A7A7A]">
          SÉLECTIONNER UN ARTICLE POUR LE CHARGER EN 3D AU CENTRE DE LA SCÈNE
        </div>
      </div>
    </div>
  );
};
