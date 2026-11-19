import React from 'react';
import { X } from 'lucide-react';

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contact OD-01"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-black bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black px-5 py-3.5">
          <span className="text-[12px] font-bold tracking-[0.14em]">CONTACT · OUEST DYNAMICS</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-10 w-10 items-center justify-center border border-transparent text-black hover:border-black"
          >
            <X className="h-4 w-4 stroke-[1.5]" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-[11px] leading-relaxed">
          <div className="divide-y divide-[#E5E5E5] border-t border-b border-[#E5E5E5]">
            <div className="py-3">
              <div className="text-[10px] text-[#7A7A7A]">BUREAU COMMANDES WHATSAPP</div>
              <div className="mt-1 font-bold text-black tabular-nums">+225 07 00 00 01 01</div>
            </div>
            <div className="py-3">
              <div className="text-[10px] text-[#7A7A7A]">ARCHIVE & SHOWROOM</div>
              <div className="mt-1 text-black">ABIDJAN · COCODY / ZONE 4 · SUR RENDEZ-VOUS</div>
            </div>
            <div className="py-3">
              <div className="text-[10px] text-[#7A7A7A]">LIVRAISON COD</div>
              <div className="mt-1 text-black">
                EXPÉDITION 24H SUR ABIDJAN · PAIEMENT INTÉGRAL À LA RÉCEPTION APRÈS VÉRIFICATION
              </div>
            </div>
            <div className="py-3">
              <div className="text-[10px] text-[#7A7A7A]">EMAIL ARCHIVE</div>
              <div className="mt-1 text-black">ARCHIVE@OUESTDYNAMICS.COM</div>
            </div>
          </div>

          <a
            href="https://wa.me/2250700000101?text=BONJOUR%20OD-01%20%E2%80%94%20DEMANDE%20D%E2%80%99INFORMATION"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] w-full items-center justify-center bg-black text-[11px] font-bold tracking-[0.12em] text-white hover:bg-[#1A1A1A]"
          >
            ÉCRIRE SUR WHATSAPP
          </a>
        </div>
      </div>
    </div>
  );
};
