export type UniverseId = 'HABITS' | 'CHAUSSURES' | 'ACCESSOIRES';

export const UNIVERSE_ORDER: readonly UniverseId[] = [
  'HABITS',
  'CHAUSSURES',
  'ACCESSOIRES',
] as const;

export const UNIVERSE_LABELS: Record<UniverseId, string> = {
  HABITS: 'HABITS',
  CHAUSSURES: 'CHAUSSURES',
  ACCESSOIRES: 'ACCESSOIRES',
};

export interface SizeVariant {
  label: string;
  cm: string;
  stock: number;
}

export type ModelPreset =
  | 'SN'
  | 'SL'
  | 'BT'
  | 'TS'
  | 'HD'
  | 'PT'
  | 'WB'
  | 'SP'
  | 'BG'
  | 'CP'
  | 'SK'
  | 'BL'
  | 'CUSTOM_2D';

export type CustomFinish = 'MATTE' | 'SATIN' | 'LEATHER' | 'METALLIC';

export type CustomVolumeMode = 'SCULPTED' | 'RIGID' | 'PUFFER';

export interface Custom3DConfig {
  /** Primary front / 0° studio photo */
  imageDataUrl: string;
  /**
   * Optional ordered multi-angle photos around the article (clockwise from front):
   * - 2 views: [0° Front/Side A, 180° Back/Side B]
   * - 4 views: [0° Front, 90° Right, 180° Back, 270° Left]
   * - Up to 12 views: evenly spaced 360° turntable sequence
   */
  views360?: string[];
  removeBackground: boolean;
  depth: number;
  finish: CustomFinish;
  volumeMode?: CustomVolumeMode;
  reliefStrength?: number;
  bgTolerance?: number;
}

export interface Product {
  id: string;
  sku: string;
  codePrefix: string;
  codeNumber: number;
  name: string;
  universe: UniverseId;
  /** Strictly integer price in FCFA */
  priceFcfa: number;
  composition: string;
  dimensions: string;
  weight: string;
  description: string;
  modelPreset: ModelPreset;
  custom3D?: Custom3DConfig;
  sizes: SizeVariant[];
  active: boolean;
  isCustom?: boolean;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  universe: UniverseId;
  sizeLabel: string;
  sizeCm: string;
  unitPriceFcfa: number;
  quantity: number;
}

export type OrderStatus =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'EN_LIVRAISON'
  | 'LIVREE'
  | 'REFUSEE_NDR';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  EN_ATTENTE: 'EN ATTENTE',
  CONFIRMEE: 'CONFIRMÉE',
  EN_LIVRAISON: 'EN LIVRAISON',
  LIVREE: 'LIVRÉE',
  REFUSEE_NDR: 'REFUSÉE (NDR)',
};

export interface CodOrder {
  id: string;
  reference: string;
  createdAt: string;
  customerName: string;
  whatsapp: string;
  commune: string;
  landmark: string;
  items: CartItem[];
  totalFcfa: number;
  status: OrderStatus;
  whatsappMessage: string;
}

export interface CodAnalytics {
  totalOrders: number;
  caEngageFcfa: number;
  caEncaisseFcfa: number;
  confirmationRate: number;
  ndrRate: number;
  pendingCount: number;
  deliveredCount: number;
  refusedCount: number;
}

export function formatFcfa(amount: number): string {
  const safeInt = Math.round(amount);
  const formatted = safeInt.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

export function generateNextSku(
  products: readonly Product[],
  rawPrefix: string
): { sku: string; codePrefix: string; codeNumber: number } {
  const cleanPrefix = rawPrefix
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
    .padEnd(2, 'X');

  let maxNum = 0;
  for (const product of products) {
    if (product.codePrefix === cleanPrefix && product.codeNumber > maxNum) {
      maxNum = product.codeNumber;
    }
  }
  const nextNumber = maxNum + 1;
  const padded = String(nextNumber).padStart(2, '0');
  return {
    sku: `OD-01 / ${cleanPrefix}-${padded}`,
    codePrefix: cleanPrefix,
    codeNumber: nextNumber,
  };
}

export function buildWhatsAppOrderMessage(params: {
  reference: string;
  customerName: string;
  whatsapp: string;
  commune: string;
  landmark: string;
  items: readonly CartItem[];
  totalFcfa: number;
}): string {
  const lines = [
    `OD-01 — COMMANDE COD [${params.reference}]`,
    `--------------------------------`,
    `CLIENT : ${params.customerName.toUpperCase()}`,
    `WHATSAPP : ${params.whatsapp}`,
    `COMMUNE : ${params.commune.toUpperCase()}`,
    `REPÈRE : ${params.landmark.toUpperCase()}`,
    `--------------------------------`,
    `ARTICLES :`,
  ];

  for (const item of params.items) {
    const lineTotal = item.unitPriceFcfa * item.quantity;
    lines.push(
      `• ${item.sku} | ${item.name} | T.${item.sizeLabel} (${item.sizeCm}) ×${item.quantity} — ${formatFcfa(lineTotal)}`
    );
  }

  lines.push(`--------------------------------`);
  lines.push(`TOTAL NET À LA LIVRAISON : ${formatFcfa(params.totalFcfa)}`);
  lines.push(`MODE : PAIEMENT À LA LIVRAISON (COD)`);
  lines.push(`@ OD-01 / OUEST DYNAMICS`);

  return lines.join('\n');
}
