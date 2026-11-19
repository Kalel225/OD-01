import React from 'react';
import { Product } from '../../types/od01';

interface ProductThumbnailProps {
  product: Product;
  className?: string;
}

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({
  product,
  className = 'h-28 w-full',
}) => {
  if (product.custom3D?.imageDataUrl) {
    return (
      <div className={`flex items-center justify-center bg-[#F7F7F7] p-3 ${className}`}>
        <img
          src={product.custom3D.imageDataUrl}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-[#F7F7F7] p-4 ${className}`}>
      <svg
        viewBox="0 0 160 120"
        className="h-full w-full max-w-[140px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {product.modelPreset === 'SN' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M22 86 H138 L142 74 L112 68 L84 38 L62 42 L50 56 L26 52 L22 86 Z" fill="#141414" />
            <rect x="20" y="76" width="122" height="12" fill="#FFFFFF" />
            <line x1="78" y1="45" x2="94" y2="51" stroke="#FFFFFF" />
            <line x1="86" y1="53" x2="102" y2="59" stroke="#FFFFFF" />
            <line x1="94" y1="61" x2="110" y2="67" stroke="#FFFFFF" />
            <line x1="34" y1="88" x2="34" y2="93" />
            <line x1="60" y1="88" x2="60" y2="93" />
            <line x1="86" y1="88" x2="86" y2="93" />
            <line x1="112" y1="88" x2="112" y2="93" />
          </g>
        )}

        {product.modelPreset === 'SL' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M22 76 Q80 68 138 74 L142 88 H20 Z" fill="#141414" />
            <path d="M58 72 Q84 36 116 72 Z" fill="#2A2A2A" />
            <line x1="76" y1="52" x2="76" y2="68" stroke="#FFFFFF" />
            <line x1="88" y1="50" x2="88" y2="68" stroke="#FFFFFF" />
            <line x1="100" y1="53" x2="100" y2="68" stroke="#FFFFFF" />
          </g>
        )}

        {product.modelPreset === 'BT' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M36 22 H74 L84 62 L134 74 L138 92 H34 Z" fill="#141414" />
            <rect x="34" y="84" width="104" height="10" fill="#FFFFFF" />
            <line x1="72" y1="34" x2="80" y2="34" stroke="#FFFFFF" />
            <line x1="74" y1="46" x2="82" y2="46" stroke="#FFFFFF" />
            <line x1="76" y1="58" x2="84" y2="58" stroke="#FFFFFF" />
            <rect x="30" y="24" width="6" height="16" fill="#000000" />
          </g>
        )}

        {product.modelPreset === 'TS' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M48 22 L66 22 Q80 34 94 22 L112 22 L138 46 L122 62 L110 52 V100 H50 V52 L38 62 L22 46 Z" fill="#141414" />
            <rect x="86" y="84" width="16" height="7" fill="#FFFFFF" stroke="none" />
          </g>
        )}

        {product.modelPreset === 'HD' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M62 16 Q80 8 98 16 L104 30 L124 38 L138 88 L120 92 L110 56 V100 H50 V56 L40 92 L22 88 L36 38 L56 30 Z" fill="#141414" />
            <rect x="60" y="70" width="40" height="18" fill="#2A2A2A" stroke="#FFFFFF" strokeWidth="1.5" />
            <line x1="74" y1="32" x2="74" y2="54" stroke="#FFFFFF" />
            <line x1="86" y1="32" x2="86" y2="54" stroke="#FFFFFF" />
          </g>
        )}

        {product.modelPreset === 'PT' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M52 18 H108 L114 104 H86 L80 54 L74 104 H46 Z" fill="#141414" />
            <rect x="42" y="48" width="12" height="22" fill="#2A2A2A" stroke="#FFFFFF" strokeWidth="1.5" />
            <rect x="106" y="48" width="12" height="22" fill="#2A2A2A" stroke="#FFFFFF" strokeWidth="1.5" />
            <line x1="52" y1="28" x2="108" y2="28" stroke="#FFFFFF" strokeWidth="1.5" />
          </g>
        )}

        {product.modelPreset === 'WB' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M66 16 H94 L98 28 L122 36 L136 86 L118 90 L108 54 V100 H52 V54 L42 90 L24 86 L38 36 L62 28 Z" fill="#141414" />
            <line x1="80" y1="18" x2="80" y2="100" stroke="#FFFFFF" strokeWidth="2" />
            <rect x="88" y="44" width="14" height="20" fill="#2A2A2A" stroke="#FFFFFF" strokeWidth="1.5" />
          </g>
        )}

        {product.modelPreset === 'SP' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M54 18 H106 L108 104 H86 L80 54 L74 104 H52 Z" fill="#141414" />
            <line x1="56" y1="24" x2="54" y2="100" stroke="#FFFFFF" strokeWidth="2" />
            <line x1="104" y1="24" x2="106" y2="100" stroke="#FFFFFF" strokeWidth="2" />
          </g>
        )}

        {product.modelPreset === 'BG' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M44 46 C44 16 116 16 116 46" stroke="#000000" strokeWidth="4" fill="none" />
            <rect x="34" y="46" width="92" height="58" fill="#141414" />
            <rect x="34" y="46" width="92" height="28" fill="#2A2A2A" stroke="#FFFFFF" strokeWidth="1.5" />
            <rect x="70" y="66" width="20" height="14" fill="#FFFFFF" />
            <rect x="75" y="71" width="10" height="4" fill="#000000" stroke="none" />
          </g>
        )}

        {product.modelPreset === 'CP' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M36 74 C36 36 108 36 108 74 Z" fill="#141414" />
            <path d="M88 74 L138 78 L134 86 H34 V74 Z" fill="#2A2A2A" />
            <rect x="68" y="34" width="8" height="4" fill="#000000" />
            <line x1="72" y1="38" x2="72" y2="74" stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
        )}

        {product.modelPreset === 'SK' && (
          <g stroke="#000000" strokeWidth="2">
            <path d="M54 20 H74 V72 L106 84 V98 H56 Q48 98 48 88 V20 Z" fill="#FFFFFF" />
            <rect x="54" y="28" width="20" height="5" fill="#000000" />
            <rect x="54" y="37" width="20" height="5" fill="#000000" />
            <path d="M90 78 L106 84 V98 H90 Z" fill="#141414" />
          </g>
        )}

        {product.modelPreset === 'BL' && (
          <g stroke="#000000" strokeWidth="2">
            <ellipse cx="80" cy="60" rx="50" ry="26" fill="none" stroke="#141414" strokeWidth="12" />
            <rect x="62" y="72" width="36" height="20" fill="#FFFFFF" stroke="#000000" strokeWidth="2" />
            <rect x="71" y="77" width="18" height="10" fill="#141414" />
          </g>
        )}
      </svg>
    </div>
  );
};
