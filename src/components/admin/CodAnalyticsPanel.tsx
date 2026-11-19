import React, { useMemo, useState } from 'react';
import { Check, Copy, Eye, X } from 'lucide-react';
import { useOD01Store } from '../../store/useOD01Store';
import {
  CodOrder,
  ORDER_STATUS_LABELS,
  OrderStatus,
  formatFcfa,
} from '../../types/od01';

const ALL_STATUSES: OrderStatus[] = [
  'EN_ATTENTE',
  'CONFIRMEE',
  'EN_LIVRAISON',
  'LIVREE',
  'REFUSEE_NDR',
];

export const CodAnalyticsPanel: React.FC = () => {
  const { orders, analytics, updateOrderStatus } = useOD01Store();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'TOUS'>('TOUS');
  const [inspectedOrder, setInspectedOrder] = useState<CodOrder | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'TOUS') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const handleCopy = async (order: CodOrder) => {
    try {
      await navigator.clipboard.writeText(order.whatsappMessage);
      setCopiedId(order.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* 4-Column COD Real-Time KPI Grid */}
      <div className="grid grid-cols-1 gap-px border border-black bg-black sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5">
          <div className="text-[10px] text-[#7A7A7A]">CA ENGAGÉ (ACTIF COD)</div>
          <div className="mt-2 text-[18px] font-bold text-black tabular-nums">
            {formatFcfa(analytics.caEngageFcfa)}
          </div>
          <div className="mt-2 text-[10px] text-[#7A7A7A] tabular-nums">
            {analytics.totalOrders - analytics.refusedCount} COMMANDES VALIDES
          </div>
        </div>

        <div className="bg-white p-5">
          <div className="text-[10px] text-[#7A7A7A]">CA ENCAISSÉ (LIVRÉES)</div>
          <div className="mt-2 text-[18px] font-bold text-black tabular-nums">
            {formatFcfa(analytics.caEncaisseFcfa)}
          </div>
          <div className="mt-2 text-[10px] text-[#7A7A7A] tabular-nums">
            {analytics.deliveredCount} LIVRAISONS ENCAISSÉES
          </div>
        </div>

        <div className="bg-white p-5">
          <div className="text-[10px] text-[#7A7A7A]">TAUX DE CONFIRMATION</div>
          <div className="mt-2 text-[18px] font-bold text-black tabular-nums">
            {analytics.confirmationRate}%
          </div>
          <div className="mt-2 text-[10px] text-[#7A7A7A] tabular-nums">
            {analytics.pendingCount} EN ATTENTE DE VALIDATION
          </div>
        </div>

        <div className="bg-white p-5">
          <div className="text-[10px] text-[#7A7A7A]">TAUX DE REFUS (NDR)</div>
          <div className="mt-2 text-[18px] font-bold text-black tabular-nums">
            {analytics.ndrRate}%
          </div>
          <div className="mt-2 text-[10px] text-[#7A7A7A] tabular-nums">
            {analytics.refusedCount} REFUS / NON-LIVRÉES
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3">
        <div className="text-[11px] font-bold tracking-[0.12em]">
          REGISTRE DES COMMANDES COD ({filteredOrders.length})
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(['TOUS', ...ALL_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`min-h-[34px] border px-3 text-[10px] transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'border-black bg-black text-white'
                  : 'border-[#E5E5E5] bg-white text-[#7A7A7A] hover:border-black hover:text-black'
              }`}
            >
              {status === 'TOUS' ? 'TOUTES' : ORDER_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto border border-[#E5E5E5]">
        <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-black bg-[#F7F7F7] text-[10px] text-[#7A7A7A]">
              <th className="px-4 py-3 font-bold">RÉFÉRENCE</th>
              <th className="px-4 py-3 font-bold">CLIENT / WHATSAPP</th>
              <th className="px-4 py-3 font-bold">LIVRAISON</th>
              <th className="px-4 py-3 font-bold">ARTICLES</th>
              <th className="px-4 py-3 font-bold text-right">TOTAL NET</th>
              <th className="px-4 py-3 font-bold">STATUT COD</th>
              <th className="px-4 py-3 font-bold text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E5E5]">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#7A7A7A]">
                  AUCUNE COMMANDE POUR CE FILTRE.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[#F7F7F7]">
                  <td className="px-4 py-3.5 font-bold tabular-nums whitespace-nowrap">
                    <div>{order.reference}</div>
                    <div className="mt-0.5 text-[10px] font-normal text-[#7A7A7A]">
                      {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="font-bold">{order.customerName}</div>
                    <div className="mt-0.5 text-[10px] text-[#7A7A7A] tabular-nums">
                      {order.whatsapp}
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div>{order.commune}</div>
                    <div className="mt-0.5 max-w-[200px] truncate text-[10px] text-[#7A7A7A]">
                      {order.landmark}
                    </div>
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="space-y-0.5 text-[10px]">
                      {order.items.map((item) => (
                        <div key={`${item.productId}-${item.sizeLabel}`} className="tabular-nums">
                          {item.sku} · T.{item.sizeLabel} ×{item.quantity}
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-right font-bold tabular-nums whitespace-nowrap">
                    {formatFcfa(order.totalFcfa)}
                  </td>

                  <td className="px-4 py-3.5">
                    <select
                      aria-label={`Statut de la commande ${order.reference}`}
                      value={order.status}
                      onChange={(e) =>
                        updateOrderStatus(order.id, e.target.value as OrderStatus)
                      }
                      className={`h-9 border px-2 text-[10px] font-bold ${
                        order.status === 'LIVREE'
                          ? 'border-black bg-black text-white'
                          : order.status === 'REFUSEE_NDR'
                            ? 'border-[#7A7A7A] bg-[#F7F7F7] text-[#7A7A7A]'
                            : 'border-black bg-white text-black'
                      }`}
                    >
                      {ALL_STATUSES.map((st) => (
                        <option key={st} value={st} className="bg-white text-black">
                          {ORDER_STATUS_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setInspectedOrder(order)}
                        aria-label="Voir le bon de commande"
                        className="flex h-9 w-9 items-center justify-center border border-[#E5E5E5] bg-white text-black hover:border-black"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy(order)}
                        aria-label="Copier le message WhatsApp"
                        className="flex h-9 w-9 items-center justify-center border border-[#E5E5E5] bg-white text-black hover:border-black"
                      >
                        {copiedId === order.id ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Order Inspection Modal */}
      {inspectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectedOrder(null)}
        >
          <div
            className="w-full max-w-lg border border-black bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black pb-3">
              <span className="text-[11px] font-bold">
                BON COD · {inspectedOrder.reference}
              </span>
              <button
                type="button"
                onClick={() => setInspectedOrder(null)}
                aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center text-black hover:border hover:border-black"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap border border-[#E5E5E5] bg-[#F7F7F7] p-3.5 text-[10px] leading-relaxed text-black tabular-nums">
              {inspectedOrder.whatsappMessage}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleCopy(inspectedOrder)}
                className="min-h-[42px] flex-1 border border-black bg-white text-[11px] font-bold text-black hover:bg-[#F7F7F7]"
              >
                {copiedId === inspectedOrder.id ? 'COPIÉ' : 'COPIER LE RÉCAPITULATIF'}
              </button>
              <button
                type="button"
                onClick={() => setInspectedOrder(null)}
                className="min-h-[42px] flex-1 bg-black text-[11px] font-bold text-white hover:bg-[#1A1A1A]"
              >
                FERMER
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
