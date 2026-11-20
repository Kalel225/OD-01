import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Trash2 } from 'lucide-react';
import { useOD01Store } from '../../store/useOD01Store';
import { Model3dStatus, Product, UNIVERSE_ORDER, UniverseId, formatFcfa } from '../../types/od01';
import { ProductThumbnail } from '../storefront/ProductThumbnail';

interface CatalogManagerPanelProps {
  onViewProductInStore: (productId: string) => void;
}

export const CatalogManagerPanel: React.FC<CatalogManagerPanelProps> = ({
  onViewProductInStore,
}) => {
  const {
    products,
    updateProduct3DState,
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

  const processingIds = useMemo(
    () =>
      products
        .filter((p) => p.model3dStatus === 'pending' || p.model3dStatus === 'processing')
        .map((p) => p.id),
    [products]
  );

  // Poll status every 4s for any catalog product currently being reconstructed in 3D
  useEffect(() => {
    if (processingIds.length === 0) return;
    let cancelled = false;

    const pollAll = async () => {
      for (const id of processingIds) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/products/${encodeURIComponent(id)}/generate-3d/status`);
          const data = (await res.json()) as {
            status?: Model3dStatus;
            model3dUrl?: string | null;
            error?: string | null;
          };
          if (cancelled) return;
          if (data.status === 'ready' && data.model3dUrl) {
            updateProduct3DState(id, {
              model3dStatus: 'ready',
              model3dUrl: data.model3dUrl,
              model3dError: null,
            });
          } else if (data.status === 'failed') {
            updateProduct3DState(id, {
              model3dStatus: 'failed',
              model3dError: data.error || 'Échec de la reconstruction 3D.',
            });
          }
        } catch {
          // keep polling
        }
      }
    };

    const timer = window.setInterval(() => {
      void pollAll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [processingIds, updateProduct3DState]);

  const handleGenerate3DForProduct = useCallback(
    async (product: Product) => {
      const imgs =
        product.images && product.images.length > 0
          ? product.images
          : product.custom3D?.imageDataUrl
            ? [product.custom3D.imageDataUrl]
            : [];

      if (imgs.length === 0) return;

      updateProduct3DState(product.id, {
        images: imgs,
        model3dStatus: 'pending',
        model3dError: null,
      });

      try {
        const res = await fetch(`/api/products/${encodeURIComponent(product.id)}/generate-3d`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: imgs }),
        });
        const data = (await res.json()) as {
          status?: Model3dStatus;
          jobId?: string;
          error?: string;
        };
        if (!res.ok || data.error) {
          updateProduct3DState(product.id, {
            model3dStatus: 'failed',
            model3dError: data.error || `Erreur HTTP ${res.status}`,
          });
          return;
        }
        updateProduct3DState(product.id, {
          model3dStatus: data.status ?? 'processing',
          model3dJobId: data.jobId ?? null,
          model3dError: null,
        });
      } catch (err) {
        updateProduct3DState(product.id, {
          model3dStatus: 'failed',
          model3dError: err instanceof Error ? err.message : 'Erreur réseau',
        });
      }
    },
    [updateProduct3DState]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="text-[11px] font-bold tracking-[0.12em]">
          INVENTAIRE ARCHIVE ({filtered.length})
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(['TOUS', ...UNIVERSE_ORDER] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`min-h-[34px] px-3 text-[10px] transition-colors ${
                filter === tab
                  ? 'bg-black text-white'
                  : 'bg-[#F7F7F7] text-[#7A7A7A] hover:bg-[#EAEAEA] hover:text-black'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((product) => (
          <div
            key={product.id}
            className={`grid grid-cols-1 gap-4 bg-[#F7F7F7] p-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-center ${
              !product.active ? 'opacity-50' : ''
            }`}
          >
            <div className="sm:col-span-1 lg:col-span-2">
              <ProductThumbnail product={product} className="h-24 w-full bg-white lg:h-20" />
            </div>

            <div className="min-w-0 sm:col-span-1 lg:col-span-4">
              <div className="text-[10px] text-[#7A7A7A] tabular-nums">
                {product.sku} · {product.universe}
                {product.model3dStatus === 'ready'
                  ? ' · 3D .GLB PRÊT'
                  : product.model3dStatus === 'processing' || product.model3dStatus === 'pending'
                    ? ' · 3D EN COURS...'
                    : ''}
              </div>
              <div className="mt-1 truncate text-[12px] font-bold text-black">{product.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-[10px] text-[#7A7A7A]">PRIX FCFA</label>
                <input
                  type="number"
                  step={500}
                  min={0}
                  value={product.priceFcfa}
                  onChange={(e) =>
                    updateProductPrice(product.id, parseInt(e.target.value, 10) || 0)
                  }
                  className="h-8 w-28 bg-white px-2 text-[11px] font-bold tabular-nums"
                />
                <span className="text-[10px] text-[#7A7A7A] tabular-nums">
                  ({formatFcfa(product.priceFcfa)})
                </span>
              </div>
              {product.model3dStatus === 'failed' && product.model3dError && (
                <div className="mt-1.5 text-[9px] text-black">{product.model3dError}</div>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <div className="mb-1.5 text-[10px] text-[#7A7A7A]">STOCKS PAR TAILLE</div>
              <div className="flex flex-wrap gap-1.5">
                {product.sizes.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-1 bg-white px-2 py-1 text-[10px]"
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
                      className="h-6 w-12 bg-[#F7F7F7] px-1 text-right font-bold tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:col-span-2 lg:col-span-2">
              <button
                type="button"
                disabled={
                  product.model3dStatus === 'pending' || product.model3dStatus === 'processing'
                }
                onClick={() => void handleGenerate3DForProduct(product)}
                className="min-h-[36px] bg-white px-2.5 text-[9px] font-bold text-black hover:bg-black hover:text-white disabled:bg-[#EAEAEA] disabled:text-[#7A7A7A]"
              >
                {product.model3dStatus === 'pending' || product.model3dStatus === 'processing'
                  ? '3D...'
                  : product.model3dStatus === 'ready'
                    ? 'RÉGÉN. 3D'
                    : product.model3dStatus === 'failed'
                      ? 'RÉESSAYER 3D'
                      : 'GÉNÉRER 3D'}
              </button>

              <button
                type="button"
                onClick={() => toggleProductActive(product.id)}
                className={`min-h-[36px] px-2.5 text-[10px] font-bold ${
                  product.active
                    ? 'bg-white text-black hover:bg-[#EAEAEA]'
                    : 'bg-black text-white'
                }`}
              >
                {product.active ? 'ACTIF' : 'MASQUÉ'}
              </button>

              {product.active && (
                <button
                  type="button"
                  onClick={() => onViewProductInStore(product.id)}
                  aria-label="Voir en 3D sur la boutique"
                  className="flex h-9 w-9 items-center justify-center bg-white text-black hover:bg-black hover:text-white"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              )}

              {product.isCustom && (
                <button
                  type="button"
                  onClick={() => deleteCustomProduct(product.id)}
                  aria-label="Supprimer l'article personnalisé"
                  className="flex h-9 w-9 items-center justify-center bg-white text-[#7A7A7A] hover:bg-black hover:text-white"
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
