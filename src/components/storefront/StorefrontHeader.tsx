import React, { useState } from 'react';
import { X } from 'lucide-react';

interface StorefrontHeaderProps {
  onGoHome: () => void;
  onOpenCatalog: () => void;
  onOpenContact: () => void;
  onGoAdmin: () => void;
}

export const StorefrontHeader: React.FC<StorefrontHeaderProps> = ({
  onGoHome,
  onOpenCatalog,
  onOpenContact,
  onGoAdmin,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = (cb: () => void) => {
    setMenuOpen(false);
    cb();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 flex h-12 items-center justify-between border-b border-[#E5E5E5] bg-white px-5 md:px-8">
        <button
          type="button"
          onClick={onGoHome}
          className="flex h-10 items-center text-[13px] font-bold tracking-[0.16em] text-black transition-opacity hover:opacity-70 whitespace-nowrap shrink-0"
          aria-label="OD-01 Accueil"
        >
          OD-01
        </button>

        {/* Minimalist 2-bar burger button — ONLY control on the right */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-center text-black transition-opacity hover:opacity-60 shrink-0"
        >
          {menuOpen ? (
            <X className="h-5 w-5 stroke-[1.5]" />
          ) : (
            <span className="flex w-6 flex-col gap-[6px]" aria-hidden="true">
              <span className="block h-[1.5px] w-full bg-black" />
              <span className="block h-[1.5px] w-full bg-black" />
            </span>
          )}
        </button>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-white"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation OD-01"
        >
          <div className="flex h-12 items-center justify-between border-b border-[#E5E5E5] px-5 md:px-8">
            <span className="text-[13px] font-bold tracking-[0.16em] text-black">OD-01</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fermer le menu"
              className="flex h-10 w-10 items-center justify-center text-black hover:opacity-60"
            >
              <X className="h-5 w-5 stroke-[1.5]" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
            <button
              type="button"
              onClick={() => handleAction(onGoHome)}
              className="min-h-[44px] px-6 text-[16px] font-bold tracking-[0.16em] text-black transition-opacity hover:opacity-50"
            >
              ACCUEIL
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenCatalog)}
              className="min-h-[44px] px-6 text-[16px] font-bold tracking-[0.16em] text-black transition-opacity hover:opacity-50"
            >
              ARTICLES
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenContact)}
              className="min-h-[44px] px-6 text-[16px] font-bold tracking-[0.16em] text-black transition-opacity hover:opacity-50"
            >
              CONTACT
            </button>

            <div className="mt-8 border-t border-[#E5E5E5] pt-8">
              <button
                type="button"
                onClick={() => handleAction(onGoAdmin)}
                className="min-h-[40px] border border-[#E5E5E5] px-5 text-[11px] tracking-[0.12em] text-[#7A7A7A] transition-colors hover:border-black hover:text-black"
              >
                ADMIN PWA
              </button>
            </div>
          </nav>

          <div className="py-4 text-center text-[10px] tracking-[0.14em] text-[#7A7A7A]">
            @ OD-01
          </div>
        </div>
      )}
    </>
  );
};
