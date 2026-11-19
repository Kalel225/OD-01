import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import { useOD01Store } from '../../store/useOD01Store';
import { UNIVERSE_ORDER, UniverseId, formatFcfa } from '../../types/od01';
import { ProductThumbnail } from '../storefront/ProductThumbnail';

interface CatalogManagerPanelProps {
  onViewProductInStore: (productId: string) => void;
}

export const CatalogManagerPanel: React.FC<CatalogManagerPanelProps> = ({
  onViewProductInStore,
}) => {
  const {
    products,
    updateProductPrice,
    updateVariantStock,
    toggleProductActive,
    deleteCustomProduct,
  } = useOD01Store();

  const [filter, setFilter] = useState<UniverseId | 'TOUS'>('TOUS');

  const filtered = useMemo(() => {
    if (filter === 'TOUS') return products;
    return products.filter((p) => p.universe === filter);
  }, [products, filter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3">
        <div className="text-[11px] font-bold tracking-[0.12em]">
          INVENTAIRE ARCHIVE ({filtered.length})
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(['TOUS', ...UNIVERSE_ORDER] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`min-h-[34px] border px-3 text-[10px] ${
                filter === tab
                  ? 'border-black bg-black text-white'
                  : 'border-[#E5E5E5] bg-white text-[#7A7A7A] hover:border-black hover:text-black'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5]">
        {filtered.map((product) => (
          <div
            key={product.id}
            className={`grid grid-cols-1 gap-4 bg-white p-4 md:grid-cols-12 md:items-center ${
              !product.active ? 'opacity-50' : ''
            }`}
          >
            <div className="md:col-span-2">
              <ProductThumbnail product={product} className="h-20 w-full" />
            </div>

            <div className="md:col-span-4">
              <div className="text-[10px] text-[#7A7A7A] tabular-nums">
                {product.sku} · {product.universe}
                {product.isCustom ? ' · 2D→3D' : ''}
              </div>
              <div className="mt-1 text-[12px] font-bold text-black">{product.name}</div>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] text-[#7A7A7A]">PRIX FCFA</label>
                <input
                  type="number"
                  step={500}
                  min={0}
                  value={product.priceFcfa}
                  onChange={(e) =>
                    updateProductPrice(product.id, parseInt(e.target.value, 10) || 0)
                  }
                  className="h-8 w-28 border border-black px-2 text-[11px] font-bold tabular-nums"
                />
                <span className="text-[10px] text-[#7A7A7A] tabular-nums">
                  ({formatFcfa(product.priceFcfa)})
                </span>
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="mb-1.5 text-[10px] text-[#7A7A7A]">STOCKS PAR TAILLE</div>
              <div className="flex flex-wrap gap-1.5">
                {product.sizes.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-1 border border-[#E5E5E5] px-2 py-1 text-[10px]"
                  >
                    <span className="font-bold">{s.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      aria-label={`Stock ${product.sku} taille ${s.label}`}
                      value={s.stock}
                      onChange={(e) =>
                        updateVariantStock(
                          product.id,
                          s.label,
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      className="h-6 w-12 border border-[#E5E5E5] px-1 text-right font-bold tabular-nums focus:border-black"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1.5 md:col-span-2">
              <button
                type="button"
                onClick={() => toggleProductActive(product.id)}
                className={`min-h-[36px] border px-2.5 text-[10px] font-bold ${
                  product.active
                    ? 'border-black bg-white text-black hover:bg-[#F7F7F7]'
                    : 'border-black bg-black text-white'
                }`}
              >
                {product.active ? 'ACTIF' : 'MASQUÉ'}
              </button>

              {product.active && (
                <button
                  type="button"
                  onClick={() => onViewProductInStore(product.id)}
                  aria-label="Voir en 3D sur la boutique"
                  className="flex h-9 w-9 items-center justify-center border border-[#E5E5E5] text-black hover:border-black"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}

              {product.isCustom && (
                <button
                  type="button"
                  onClick={() => deleteCustomProduct(product.id)}
                  aria-label="Supprimer l'article personnalisé"
                  className="flex h-9 w-9 items-center justify-center border border-[#E5E5E5] text-[#7A7A7A] hover:border-black hover:text-black"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
