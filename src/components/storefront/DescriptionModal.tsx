import React from 'react';
import { X } from 'lucide-react';
import { Product, formatFcfa } from '../../types/od01';

interface DescriptionModalProps {
  open: boolean;
  product: Product;
  onClose: () => void;
}

export const DescriptionModal: React.FC<DescriptionModalProps> = ({
  open,
  product,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Spécifications ${product.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-black bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black px-5 py-3.5">
          <div>
            <div className="text-[10px] text-[#7A7A7A] tabular-nums">{product.sku}</div>
            <h2 className="mt-0.5 text-[12px] font-bold text-black">{product.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fiche technique"
            className="flex h-10 w-10 items-center justify-center border border-transparent text-black hover:border-black"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        <div className="max-h-[72dvh] space-y-5 overflow-y-auto p-5 text-[11px] leading-relaxed">
          <p className="text-black">{product.description}</p>

          <div className="divide-y divide-[#E5E5E5] border-t border-b border-[#E5E5E5]">
            <div className="grid grid-cols-3 gap-2 py-2.5">
              <span className="text-[#7A7A7A]">UNIVERS</span>
              <span className="col-span-2 text-black">{product.universe}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2.5">
              <span className="text-[#7A7A7A]">COMPOSITION</span>
              <span className="col-span-2 text-black">{product.composition}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2.5">
              <span className="text-[#7A7A7A]">COTES</span>
              <span className="col-span-2 text-black">{product.dimensions}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2.5">
              <span className="text-[#7A7A7A]">POIDS</span>
              <span className="col-span-2 text-black">{product.weight}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 py-2.5">
              <span className="text-[#7A7A7A]">PRIX NET</span>
              <span className="col-span-2 font-bold text-black tabular-nums">
                {formatFcfa(product.priceFcfa)} · PAIEMENT À LA LIVRAISON
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-bold text-black">
              CORRESPONDANCE TAILLES / CENTIMÈTRES (CM)
            </div>
            <div className="grid grid-cols-2 gap-px border border-[#E5E5E5] bg-[#E5E5E5] sm:grid-cols-3">
              {product.sizes.map((s) => (
                <div key={s.label} className="bg-white p-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${s.stock === 0 ? 'line-through text-[#7A7A7A]' : 'text-black'}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-[#7A7A7A] tabular-nums">
                      {s.stock > 0 ? `${s.stock} DISP.` : 'RUPTURE'}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-[#7A7A7A] tabular-nums">{s.cm}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-[#E5E5E5] p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] w-full bg-black text-[11px] font-bold tracking-[0.12em] text-white hover:bg-[#1A1A1A]"
          >
            FERMER LA FICHE
          </button>
        </div>
      </div>
    </div>
  );
};
