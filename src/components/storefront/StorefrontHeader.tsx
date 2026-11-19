import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface StorefrontHeaderProps {
  onGoHome: () => void;
  onOpenCatalog: () => void;
  onOpenContact: () => void;
  onGoAdmin: () => void;
  hideLogoDuringIntro?: boolean;
}

const NAV_LOGO_CHARS = ['O', 'D', '-', '0', '1'] as const;

export const StorefrontHeader: React.FC<StorefrontHeaderProps> = ({
  onGoHome,
  onOpenCatalog,
  onOpenContact,
  onGoAdmin,
  hideLogoDuringIntro = false,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleAction = (cb: () => void) => {
    setMenuOpen(false);
    cb();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex h-12 items-center justify-between bg-white px-5 md:px-8">
      <button
        type="button"
        onClick={() => handleAction(onGoHome)}
        className={`inline-flex h-10 items-center gap-[0.16em] text-[13px] font-bold leading-none tracking-normal text-black whitespace-nowrap shrink-0 ${
          hideLogoDuringIntro ? 'opacity-0' : 'opacity-100 hover:opacity-70'
        }`}
        aria-label="OD-01 Accueil"
      >
        {NAV_LOGO_CHARS.map((char, idx) => (
          <span
            key={`${char}-${idx}`}
            data-od01-nav-char={idx}
            className="inline-block leading-none tracking-normal"
          >
            {char}
          </span>
        ))}
      </button>

      {/* Minimalist 2-bar burger button + right-aligned compact menu */}
      <div ref={menuContainerRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          className="flex h-10 w-10 items-center justify-end text-black transition-opacity hover:opacity-60"
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

        {menuOpen && (
          <nav
            aria-label="Navigation OD-01"
            className="absolute top-11 right-0 z-40 flex min-w-[180px] flex-col items-end gap-1 bg-white py-3 pl-6 pr-0"
          >
            <button
              type="button"
              onClick={() => handleAction(onGoHome)}
              className="flex min-h-[40px] w-full items-center justify-end text-right text-[12px] font-bold tracking-[0.14em] text-black transition-opacity hover:opacity-50 whitespace-nowrap"
            >
              ACCUEIL
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenCatalog)}
              className="flex min-h-[40px] w-full items-center justify-end text-right text-[12px] font-bold tracking-[0.14em] text-black transition-opacity hover:opacity-50 whitespace-nowrap"
            >
              ARTICLES
            </button>
            <button
              type="button"
              onClick={() => handleAction(onOpenContact)}
              className="flex min-h-[40px] w-full items-center justify-end text-right text-[12px] font-bold tracking-[0.14em] text-black transition-opacity hover:opacity-50 whitespace-nowrap"
            >
              CONTACT
            </button>
            <button
              type="button"
              onClick={() => handleAction(onGoAdmin)}
              className="mt-2 flex min-h-[38px] w-full items-center justify-end text-right text-[10px] tracking-[0.12em] text-[#7A7A7A] transition-colors hover:text-black whitespace-nowrap"
            >
              ADMIN PWA
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
