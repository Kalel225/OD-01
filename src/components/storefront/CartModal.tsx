import React, { useState } from 'react';
import { Check, Copy, Minus, Plus, Trash2, X } from 'lucide-react';
import { useCartStore } from '../../store/useOD01Store';
import { CodOrder, formatFcfa } from '../../types/od01';

interface CartModalProps {
  open: boolean;
  onClose: () => void;
}

type CheckoutStep = 'CART' | 'COD_FORM' | 'CONFIRMED';

const WHATSAPP_MERCHANT_NUMBER = '2250700000101';

export const CartModal: React.FC<CartModalProps> = ({ open, onClose }) => {
  const { items, totalItems, totalFcfa, updateQuantity, removeItem, placeCodOrder } =
    useCartStore();

  const [step, setStep] = useState<CheckoutStep>('CART');
  const [customerName, setCustomerName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [commune, setCommune] = useState('');
  const [landmark, setLandmark] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<CodOrder | null>(null);
  const [copied, setCopied] = useState(false);

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
    if (!customerName.trim() || !whatsapp.trim() || !commune.trim() || !landmark.trim()) {
      setFormError('VEUILLEZ RENSEIGNER TOUS LES CHAMPS DE LIVRAISON.');
      return;
    }
    if (items.length === 0) {
      setFormError('VOTRE PANIER EST VIDE.');
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
      // Fallback for restricted clipboard environments
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
        className="flex max-h-[88dvh] w-full max-w-xl flex-col border border-black bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black px-5 py-3.5">
          <div className="text-[12px] font-bold tracking-[0.12em]">
            {step === 'CART' && `PANIER UNIFIÉ (${totalItems})`}
            {step === 'COD_FORM' && 'VALIDATION · PAIEMENT À LA LIVRAISON'}
            {step === 'CONFIRMED' && `COMMANDE ENREGISTRÉE · ${confirmedOrder?.reference ?? ''}`}
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer le panier"
            className="flex h-10 w-10 items-center justify-center border border-transparent text-black hover:border-black"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        {/* STEP 1: CART LIST */}
        {step === 'CART' && (
          <>
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <div className="py-12 text-center text-[11px] text-[#7A7A7A]">
                  AUCUN ARTICLE SÉLECTIONNÉ POUR LE MOMENT.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E5E5] border-t border-b border-[#E5E5E5]">
                  {items.map((item) => (
                    <div
                      key={`${item.productId}-${item.sizeLabel}`}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-[#7A7A7A] tabular-nums">
                          {item.sku} · {item.universe}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] font-bold text-black">
                          {item.name}
                        </div>
                        <div className="mt-1 text-[10px] text-[#7A7A7A] tabular-nums">
                          TAILLE {item.sizeLabel} ({item.sizeCm}) · {formatFcfa(item.unitPriceFcfa)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="flex items-center border border-black">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.sizeLabel, -1)}
                            aria-label="Diminuer la quantité"
                            className="flex h-9 w-9 items-center justify-center text-black hover:bg-[#F7F7F7]"
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
                            className="flex h-9 w-9 items-center justify-center text-black hover:bg-[#F7F7F7]"
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

            {/* Net Total Footer */}
            <div className="border-t border-black bg-white p-5">
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
                  className="min-h-[44px] flex-1 border border-black bg-white text-[11px] font-bold tracking-[0.12em] text-black hover:bg-[#F7F7F7]"
                >
                  CONTINUER
                </button>
                <button
                  type="button"
                  disabled={items.length === 0}
                  onClick={() => setStep('COD_FORM')}
                  className="min-h-[44px] flex-1 bg-black text-[11px] font-bold tracking-[0.12em] text-white hover:bg-[#1A1A1A] disabled:bg-[#7A7A7A]"
                >
                  VALIDER
                </button>
              </div>
            </div>
          </>
        )}

        {/* STEP 2: EXPRESS COD FORM */}
        {step === 'COD_FORM' && (
          <form onSubmit={handleSubmitCod} className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1 space-y-4 p-5">
              <div className="border border-[#E5E5E5] bg-[#F7F7F7] p-3 text-[10px] text-black">
                AUCUN PAIEMENT EN LIGNE REQUIS. VOUS RÉGLEZ EN ESPÈCES OU MOBILE MONEY À LA RÉCEPTION.
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
                  className="h-11 w-full border border-black bg-white px-3 text-[11px] text-black placeholder:text-[#7A7A7A]"
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
                  className="h-11 w-full border border-black bg-white px-3 text-[11px] text-black placeholder:text-[#7A7A7A]"
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
                    className="h-11 w-full border border-black bg-white px-3 text-[11px] text-black placeholder:text-[#7A7A7A]"
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
                    className="h-11 w-full border border-black bg-white px-3 text-[11px] text-black placeholder:text-[#7A7A7A]"
                  />
                </div>
              </div>

              {formError && (
                <div className="border border-black bg-black px-3 py-2 text-[10px] text-white">
                  {formError}
                </div>
              )}
            </div>

            <div className="border-t border-black p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[11px] text-[#7A7A7A]">TOTAL NET À RÉGLER</span>
                <span className="text-[14px] font-bold text-black tabular-nums">
                  {formatFcfa(totalFcfa)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('CART')}
                  className="min-h-[44px] flex-1 border border-black bg-white text-[11px] font-bold text-black hover:bg-[#F7F7F7]"
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
          <div className="flex flex-1 flex-col overflow-y-auto p-5">
            <div className="border border-black bg-[#F7F7F7] p-3 text-[11px] font-bold text-black">
              COMMANDE COD ENREGISTRÉE — PRÊTE POUR EXPÉDITION WHATSAPP
            </div>

            <div className="mt-4">
              <div className="mb-1.5 text-[10px] text-[#7A7A7A]">
                MESSAGE RÉCAPITULATIF GÉNÉRÉ
              </div>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap border border-black bg-white p-3.5 text-[10px] leading-relaxed text-black tabular-nums">
                {confirmedOrder.whatsappMessage}
              </pre>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 border border-black bg-white px-4 text-[11px] font-bold text-black hover:bg-[#F7F7F7]"
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
