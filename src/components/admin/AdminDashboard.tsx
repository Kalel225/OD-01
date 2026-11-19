import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AddProduct3DForm } from './AddProduct3DForm';
import { CatalogManagerPanel } from './CatalogManagerPanel';
import { CodAnalyticsPanel } from './CodAnalyticsPanel';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';

interface AdminDashboardProps {
  onNavigateStorefront: (focusProductId?: string) => void;
}

type AdminTab = 'ANALYTICS' | 'ADD_3D' | 'CATALOG';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateStorefront,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('ANALYTICS');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-black">
      {/* Fixed Monochrome Admin PWA Header */}
      <header className="sticky top-0 z-30 border-b border-black bg-white px-5 md:px-8">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-[13px] font-bold tracking-[0.16em] whitespace-nowrap">
              OD-01
            </span>
            <span className="hidden text-[10px] text-[#7A7A7A] sm:inline whitespace-nowrap">
              / ADMIN PWA
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              type="button"
              onClick={() => onNavigateStorefront()}
              className="flex min-h-[38px] items-center gap-1.5 border border-black bg-white px-3.5 text-[10px] font-bold tracking-[0.1em] text-black hover:bg-black hover:text-white whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>BOUTIQUE</span>
            </button>
          </div>
        </div>
      </header>

      {/* Primary Module Tabs */}
      <div className="border-b border-[#E5E5E5] bg-white px-5 md:px-8">
        <nav
          aria-label="Modules Administration"
          className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto"
        >
          {(
            [
              { id: 'ANALYTICS', label: 'ANALYTICS & COMMANDES COD' },
              { id: 'ADD_3D', label: 'AJOUT ARTICLE (2D → 3D)' },
              { id: 'CATALOG', label: 'CATALOGUE & STOCKS' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-h-[46px] text-[11px] tracking-[0.1em] transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'font-bold text-black' : 'text-[#7A7A7A] hover:text-black'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute right-0 bottom-0 left-0 h-[2px] bg-black"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Workspace Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 md:px-8 md:py-8">
        {activeTab === 'ANALYTICS' && <CodAnalyticsPanel />}
        {activeTab === 'ADD_3D' && (
          <AddProduct3DForm
            onViewProductInStore={(productId) => onNavigateStorefront(productId)}
          />
        )}
        {activeTab === 'CATALOG' && (
          <CatalogManagerPanel
            onViewProductInStore={(productId) => onNavigateStorefront(productId)}
          />
        )}
      </main>

      <footer className="border-t border-[#E5E5E5] py-4 text-center text-[10px] tracking-[0.14em] text-[#7A7A7A]">
        @ OD-01 · OUEST DYNAMICS ADMIN PWA
      </footer>

      <OfflineIndicator />
    </div>
  );
};
