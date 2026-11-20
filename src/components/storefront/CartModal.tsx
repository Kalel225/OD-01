import React, { useMemo, useState } from 'react';
import { Check, Copy, Minus, Plus, Trash2, X } from 'lucide-react';
import { useCartStore, useOD01Store } from '../../store/useOD01Store';
import { CodOrder, Product, formatFcfa } from '../../types/od01';

interface CartModalProps {
  open: boolean;
  onClose: () => void;
}

type CheckoutStep = 'CART' | 'COD_FORM' | 'CONFIRMED';

const WHATSAPP_MERCHANT_NUMBER = '2250700000101';

export const CartModal: React.FC<CartModalProps> = ({ open, onClose }) => {
  const { products } = useOD01Store();
  const {
    items,
    totalItems,
    totalFcfa,
    updateQuantity,
    updateItemSize,
    removeItem,
    placeCodOrder,
  } = useCartStore();

  const [step, setStep] = useState<CheckoutStep>('CART');
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [commune, setCommune] = useState('');
  const [landmark, setLandmark] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<CodOrder | null>(null);
  const [copied, setCopied] = useState(false);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  if (!open) return null;

  const handleClose = () => {
    setFormError(null);
    if (step === 'CONFIRMED') {
      setStep('CART');
      setConfirmedOrder(null);
    }
    onClose();
  };

  const handleSubmitCod = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      setFormError('VOTRE PANIER EST VIDE.');
      return;
    }

    const missingSizeItem = items.find((item) => !item.sizeLabel.trim());
    if (missingSizeItem) {
      setFormError(`VEUILLEZ SÉLECTIONNER UNE TAILLE POUR ${missingSizeItem.sku}.`);
      return;
    }

    if (!customerName.trim() || !whatsapp.trim() || !commune.trim() || !landmark.trim()) {
      setFormError('VEUILLEZ RENSEIGNER TOUS LES CHAMPS DE LIVRAISON.');
      return;
    }

    setFormError(null);
    const created = placeCodOrder({
      customerName,
      whatsapp,
      commune,
      landmark,
    });
    setConfirmedOrder(created);
    setStep('CONFIRMED');
    setCustomerName('');
    setWhatsapp('');
    setCommune('');
    setLandmark('');
  };

  const handleCopySummary = async () => {
    if (!confirmedOrder) return;
    try {
      await navigator.clipboard.writeText(confirmedOrder.whatsappMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const whatsappHref = confirmedOrder
    ? `https://wa.me/${WHATSAPP_MERCHANT_NUMBER}?text=${encodeURIComponent(
        confirmedOrder.whatsappMessage
      )}`
    : '#';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Panier unifié OD-01"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-xl flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Borderless */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div className="min-w-0 truncate text-[11px] font-bold tracking-[0.12em] sm:text-[12px]">
            {step === 'CART' && `PANIER UNIFIÉ (${totalItems})`}
            {step === 'COD_FORM' && 'VALIDATION DU PANIER · TAILLES & LIVRAISON'}
            {step === 'CONFIRMED' && `COMMANDE ENREGISTRÉE · ${confirmedOrder?.reference ?? ''}`}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer le panier"
            className="flex h-10 w-10 shrink-0 items-center justify-center text-black transition-opacity hover:opacity-50"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        {/* STEP 1: CART LIST */}
        {step === 'CART' && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
              {items.length === 0 ? (
                <div className="py-12 text-center text-[11px] text-[#7A7A7A]">
                  AUCUN ARTICLE SÉLECTIONNÉ POUR LE MOMENT.
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={`${item.productId}-${item.sizeLabel || 'PENDING'}`}
                      className="flex flex-col gap-3 bg-[#F7F7F7] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-[#7A7A7A] tabular-nums">
                          {item.sku} · {item.universe}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] font-bold text-black">
                          {item.name}
                        </div>
                        <div className="mt-1 text-[10px] text-[#7A7A7A] tabular-nums">
                          {item.sizeLabel
                            ? `TAILLE ${item.sizeLabel} (${item.sizeCm}) · ${formatFcfa(item.unitPriceFcfa)}`
                            : `TAILLE À CHOISIR À LA VALIDATION · ${formatFcfa(item.unitPriceFcfa)}`}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="flex items-center bg-white">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.sizeLabel, -1)}
                            aria-label="Diminuer la quantité"
                            className="flex h-9 w-9 items-center justify-center text-black hover:bg-[#EAEAEA]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[32px] text-center text-[11px] font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.sizeLabel, 1)}
                            aria-label="Augmenter la quantité"
                            className="flex h-9 w-9 items-center justify-center text-black hover:bg-[#EAEAEA]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="min-w-[96px] text-right text-[11px] font-bold tabular-nums">
                          {formatFcfa(item.unitPriceFcfa * item.quantity)}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.sizeLabel)}
                          aria-label="Supprimer l'article"
                          className="flex h-9 w-9 items-center justify-center text-[#7A7A7A] hover:text-black"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Net Total Footer — Borderless */}
            <div className="bg-white px-6 pt-4 pb-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-[#7A7A7A]">
                  TOTAL NET (PAIEMENT À LA LIVRAISON)
                </span>
                <span className="text-[15px] font-bold text-black tabular-nums">
                  {formatFcfa(totalFcfa)}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-[44px] flex-1 bg-[#F7F7F7] text-[11px] font-bold tracking-[0.12em] text-black hover:bg-[#EAEAEA]"
                >
                  CONTINUER
                </button>
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => {
                    setFormError(null);
                    setStep('COD_FORM');
                  }}
                  className="min-h-[44px] flex-1 bg-black text-[11px] font-bold tracking-[0.12em] text-white hover:bg-[#1A1A1A] disabled:bg-[#7A7A7A]"
                >
                  VALIDER
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: CART VALIDATION — SIZE SELECTION + EXPRESS COD FORM */}
        {step === 'COD_FORM' && (
          <form onSubmit={handleSubmitCod} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-3">
              {/* Dedicated Size / Pointure Selection for each article in the cart */}
              <div className="space-y-3">
                <div className="text-[10px] font-bold tracking-[0.12em] text-black">
                  1. SÉLECTION DES TAILLES / POINTURES *
                </div>

                <div className="space-y-2.5">
                  {items.map((item) => {
                    const product = productById.get(item.productId);
                    const availableSizes = product?.sizes ?? [];

                    return (
                      <div
                        key={`${item.productId}-${item.sizeLabel || 'PENDING'}`}
                        className="space-y-2.5 bg-[#F7F7F7] p-4"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="text-[11px] font-bold text-black">
                            <span className="tabular-nums">{item.sku}</span>
                            <span className="mx-1.5 text-[#7A7A7A]">·</span>
                            <span>{item.name}</span>
                            <span className="ml-1.5 text-[10px] text-[#7A7A7A] tabular-nums">
                              ×{item.quantity}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#7A7A7A] tabular-nums">
                            {item.sizeCm ? `ÉQUIV. ${item.sizeCm}` : 'CHOISIR UNE TAILLE'}
                          </div>
                        </div>

                        <div
                          className="flex flex-wrap items-center gap-1.5"
                          role="radiogroup"
                          aria-label={`Taille pour ${item.name}`}
                        >
                          {availableSizes.map((variant) => {
                            const isOut = variant.stock <= 0;
                            const isSelected = item.sizeLabel === variant.label;
                            return (
                              <button
                                key={variant.label}
                                type="button"
                                disabled={isOut}
                                onClick={() => {
                                  setFormError(null);
                                  updateItemSize(
                                    item.productId,
                                    item.sizeLabel,
                                    variant.label,
                                    variant.cm
                                  );
                                }}
                                aria-checked={isSelected}
                                role="radio"
                                className={`min-h-[34px] min-w-[38px] px-2.5 text-[10px] tabular-nums transition-colors whitespace-nowrap ${
                                  isOut
                                    ? 'cursor-not-allowed bg-white/60 text-[#7A7A7A] line-through'
                                    : isSelected
                                      ? 'bg-black font-bold text-white'
                                      : 'bg-white text-black hover:bg-[#EAEAEA]'
                                }`}
                              >
                                {variant.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Delivery Details */}
              <div className="space-y-4">
                <div className="text-[10px] font-bold tracking-[0.12em] text-black">
                  2. LIVRAISON · PAIEMENT À LA RÉCEPTION (COD)
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold text-black">
                    NOM COMPLET *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="EX: KONAN MARC-OLIVIER"
                    className="h-11 w-full bg-[#F7F7F7] px-3.5 text-[11px] text-black placeholder:text-[#7A7A7A]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold text-black">
                    NUMÉRO WHATSAPP *
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="EX: +225 07 00 00 00 00"
                    className="h-11 w-full bg-[#F7F7F7] px-3.5 text-[11px] text-black placeholder:text-[#7A7A7A]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold text-black">
                      COMMUNE / QUARTIER *
                    </label>
                    <input
                      type="text"
                      required
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      placeholder="EX: COCODY RIVIERA 2"
                      className="h-11 w-full bg-[#F7F7F7] px-3.5 text-[11px] text-black placeholder:text-[#7A7A7A]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold text-black">
                      REPÈRE DE LIVRAISON *
                    </label>
                    <input
                      type="text"
                      required
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="EX: PHARMACIE SAINT-VIATEUR"
                      className="h-11 w-full bg-[#F7F7F7] px-3.5 text-[11px] text-black placeholder:text-[#7A7A7A]"
                    />
                  </div>
                </div>
              </div>

              {formError && (
                <div className="bg-black px-3.5 py-2.5 text-[10px] text-white">
                  {formError}
                </div>
              )}
            </div>

            <div className="shrink-0 bg-white px-6 pt-4 pb-5">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[11px] text-[#7A7A7A]">TOTAL NET À RÉGLER</span>
                <span className="text-[14px] font-bold text-black tabular-nums">
                  {formatFcfa(totalFcfa)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormError(null);
                    setStep('CART');
                  }}
                  className="min-h-[44px] flex-1 bg-[#F7F7F7] text-[11px] font-bold text-black hover:bg-[#EAEAEA]"
                >
                  RETOUR
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] flex-1 bg-black text-[11px] font-bold text-white hover:bg-[#1A1A1A]"
                >
                  CONFIRMER LA COMMANDE
                </button>
              </div>
            </div>
          </form>
        )}

        {/* STEP 3: GENERATED WHATSAPP SUMMARY */}
        {step === 'CONFIRMED' && confirmedOrder && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-2 pb-5">
            <div className="bg-[#F7F7F7] p-3.5 text-[11px] font-bold text-black">
              COMMANDE COD ENREGISTRÉE — PRÊTE POUR EXPÉDITION WHATSAPP
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-[10px] text-[#7A7A7A]">
                MESSAGE RÉCAPITULATIF GÉNÉRÉ
              </div>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap bg-[#F7F7F7] p-4 text-[10px] leading-relaxed text-black tabular-nums">
                {confirmedOrder.whatsappMessage}
              </pre>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 bg-[#F7F7F7] px-4 text-[11px] font-bold text-black hover:bg-[#EAEAEA]"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'COPIÉ' : 'COPIER LE MESSAGE'}</span>
              </button>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] flex-1 items-center justify-center bg-black px-4 text-center text-[11px] font-bold text-white hover:bg-[#1A1A1A]"
              >
                ENVOYER SUR WHATSAPP
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
