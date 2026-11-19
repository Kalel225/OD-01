import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return (
      <span className="border border-[#E5E5E5] px-3 py-2 text-[10px] text-[#7A7A7A] whitespace-nowrap">
        PWA INSTALLÉE
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="flex min-h-[38px] items-center gap-2 border border-black bg-black px-3.5 text-[10px] font-bold tracking-[0.1em] text-white hover:bg-[#1A1A1A] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>INSTALLER PWA</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="flex min-h-[38px] items-center gap-2 border border-black bg-white px-3.5 text-[10px] font-bold tracking-[0.1em] text-black hover:bg-[#F7F7F7] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{isIOS ? 'INSTALLER IOS' : 'INSTALLER PWA'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Installation PWA OD-01"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md border border-black bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black pb-3">
              <span className="text-[11px] font-bold tracking-[0.12em]">
                INSTALLATION ADMIN PWA OD-01
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center text-black hover:border hover:border-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-[11px] leading-relaxed text-black">
              {isIOS ? (
                <>
                  <p>1. APPUYEZ SUR LE BOUTON PARTAGER DE SAFARI.</p>
                  <p>2. SÉLECTIONNEZ « SUR L’ÉCRAN D’ACCUEIL ».</p>
                  <p>3. CONFIRMEZ POUR LANCER OD-01 EN MODE APPLICATION AUTONOME.</p>
                </>
              ) : (
                <>
                  <p>
                    1. OUVREZ LE MENU DE VOTRE NAVIGATEUR OU L’ICÔNE D’INSTALLATION DANS LA BARRE D’ADRESSE.
                  </p>
                  <p>
                    2. CLIQUEZ SUR « INSTALLER OD-01 — OUEST DYNAMICS » POUR ACCÉDER AU TABLEAU ADMIN HORS-LIGNE.
                  </p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 min-h-[42px] w-full bg-black text-[11px] font-bold text-white hover:bg-[#1A1A1A]"
            >
              FERMER
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed right-4 bottom-4 z-50 border border-black bg-black px-3.5 py-2 text-[10px] font-bold tracking-[0.1em] text-white"
    >
      MODE HORS-LIGNE · DONNÉES LOCALES EN CACHE
    </div>
  );
};
