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
      <div className={`flex items-center justify-center bg-white p-2.5 ${className}`}>
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
        {/* SN-01: Nike Air Force 1 '07 Triple Black */}
        {product.modelPreset === 'SN' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M20 88 H140 L142 74 Q126 66 108 66 L84 40 L64 42 Q50 56 34 50 L22 60 Z" fill="#141414" />
            <rect x="20" y="76" width="122" height="14" fill="#1E1E1E" />
            <line x1="20" y1="79" x2="142" y2="79" stroke="#7A7A7A" strokeWidth="1" />
            <path d="M52 63 Q46 72 64 70 L102 58 Q74 64 58 64 Z" fill="#FFFFFF" stroke="none" />
            <line x1="80" y1="46" x2="94" y2="52" stroke="#7A7A7A" />
            <line x1="88" y1="53" x2="102" y2="59" stroke="#7A7A7A" />
            <line x1="96" y1="60" x2="110" y2="66" stroke="#7A7A7A" />
          </g>
        )}

        {/* SL-01: Adidas Yeezy Slide Onyx */}
        {product.modelPreset === 'SL' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M18 76 Q80 68 140 74 L144 86 L132 94 L122 86 L112 94 L102 86 L92 94 L82 86 L72 94 L62 86 L52 94 L42 86 L30 94 L18 86 Z" fill="#181818" />
            <path d="M54 73 Q88 30 118 73 Z" fill="#222222" />
            <path d="M68 72 Q88 46 106 72" stroke="#000000" strokeWidth="2" fill="#F7F7F7" />
          </g>
        )}

        {/* BT-01: Timberland 6-Inch Premium Boot Black */}
        {product.modelPreset === 'BT' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M36 22 H74 L84 62 L134 72 L138 86 H34 Z" fill="#161616" />
            <rect x="34" y="20" width="42" height="12" rx="4" fill="#262626" />
            <path d="M34 86 H72 V96 H34 Z M84 86 H138 V94 H84 Z" fill="#0D0D0D" />
            <circle cx="76" cy="39" r="2" fill="#BDBDBD" stroke="none" />
            <circle cx="78" cy="48" r="2" fill="#BDBDBD" stroke="none" />
            <circle cx="80" cy="57" r="2" fill="#BDBDBD" stroke="none" />
            <circle cx="84" cy="65" r="2" fill="#BDBDBD" stroke="none" />
          </g>
        )}

        {/* TS-01: Fear of God Essentials Tee */}
        {product.modelPreset === 'TS' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M44 20 L64 20 Q80 32 96 20 L116 20 L144 48 L126 66 L114 54 V102 H46 V54 L34 66 L16 48 Z" fill="#141414" />
            <line x1="62" y1="52" x2="98" y2="52" stroke="#7A7A7A" strokeWidth="2" />
            <line x1="70" y1="58" x2="90" y2="58" stroke="#525252" strokeWidth="1.2" />
          </g>
        )}

        {/* HD-01: Carhartt WIP Chase Hoodie */}
        {product.modelPreset === 'HD' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M62 16 Q80 8 98 16 L104 30 L124 38 L138 88 L120 92 L110 56 V100 H50 V56 L40 92 L22 88 L36 38 L56 30 Z" fill="#141414" />
            <path d="M60 72 L66 66 H94 L100 72 V88 H60 Z" fill="#222222" stroke="#525252" strokeWidth="1.2" />
            <line x1="74" y1="32" x2="74" y2="54" stroke="#B5B5B5" />
            <line x1="86" y1="32" x2="86" y2="54" stroke="#B5B5B5" />
            <circle cx="128" cy="84" r="2.2" fill="#E5E5E5" stroke="none" />
          </g>
        )}

        {/* PT-01: Stone Island Cargo Pants */}
        {product.modelPreset === 'PT' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M52 18 H108 L112 104 H88 L80 54 L72 104 H48 Z" fill="#141414" />
            <rect x="42" y="48" width="12" height="22" fill="#222222" stroke="#525252" strokeWidth="1.2" />
            <rect x="106" y="48" width="12" height="22" fill="#222222" stroke="#525252" strokeWidth="1.2" />
            {/* Iconic Stone Island left pocket badge */}
            <rect x="108" y="56" width="8" height="5" fill="#000000" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="112" cy="58.5" r="1.4" fill="#FFFFFF" stroke="none" />
          </g>
        )}

        {/* WB-01: Arc'teryx Beta LT Jacket */}
        {product.modelPreset === 'WB' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M64 14 H96 L100 28 L124 36 L138 86 L120 90 L108 54 V100 Q80 104 52 100 V54 L40 90 L22 86 L36 36 L60 28 Z" fill="#121212" />
            <line x1="80" y1="16" x2="80" y2="101" stroke="#E5E5E5" strokeWidth="1.6" />
            <line x1="65" y1="56" x2="61" y2="82" stroke="#7A7A7A" strokeWidth="1.6" />
            <line x1="95" y1="56" x2="99" y2="82" stroke="#7A7A7A" strokeWidth="1.6" />
            <line x1="90" y1="42" x2="100" y2="42" stroke="#D4D4D4" strokeWidth="1.5" />
          </g>
        )}

        {/* SP-01: Nike Tech Fleece Joggers */}
        {product.modelPreset === 'SP' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M54 18 H106 L104 104 H86 L80 54 L74 104 H56 Z" fill="#141414" />
            {/* Iconic long bonded vertical tech pocket */}
            <rect x="54" y="40" width="5" height="32" fill="#000000" stroke="#A3A3A3" strokeWidth="1.2" />
            <line x1="76" y1="22" x2="74" y2="34" stroke="#FFFFFF" strokeWidth="1.2" />
            <line x1="84" y1="22" x2="86" y2="34" stroke="#FFFFFF" strokeWidth="1.2" />
          </g>
        )}

        {/* BG-01: Prada Re-Nylon Messenger Bag */}
        {product.modelPreset === 'BG' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M44 46 C44 16 116 16 116 46" stroke="#141414" strokeWidth="4" fill="none" />
            <rect x="34" y="46" width="92" height="58" fill="#111111" />
            <rect x="34" y="46" width="92" height="32" fill="#1C1C1C" stroke="#404040" strokeWidth="1.2" />
            {/* Twin metallic buckles */}
            <rect x="50" y="70" width="10" height="14" fill="#D4D4D4" />
            <rect x="100" y="70" width="10" height="14" fill="#D4D4D4" />
            {/* Iconic Prada inverted triangle plaque */}
            <polygon points="71,56 89,56 80,68" fill="#000000" stroke="#E5E5E5" strokeWidth="1.5" />
          </g>
        )}

        {/* CP-01: New Era 59FIFTY NY Yankees */}
        {product.modelPreset === 'CP' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M36 74 C36 32 108 32 108 74 Z" fill="#141414" />
            <path d="M88 74 L140 76 L138 84 H34 V74 Z" fill="#202020" />
            <rect x="68" y="32" width="8" height="4" fill="#000000" />
            <circle cx="118" cy="76" r="4" fill="#D4D4D4" stroke="none" />
            <text x="74" y="61" fill="#E5E5E5" fontSize="14" fontFamily="serif" fontWeight="bold" textAnchor="middle" stroke="none">
              NY
            </text>
          </g>
        )}

        {/* SK-01: Nike Everyday Plus Crew Socks */}
        {product.modelPreset === 'SK' && (
          <g stroke="#000000" strokeWidth="1.8">
            <path d="M54 20 H74 V72 L106 84 V98 H56 Q48 98 48 88 V20 Z" fill="#FFFFFF" />
            <path d="M58 34 Q56 40 64 38 L72 34 Q64 36 60 36 Z" fill="#000000" stroke="none" />
            <rect x="68" y="80" width="14" height="18" fill="#D4D4D4" stroke="none" />
            <path d="M90 78 L106 84 V98 H90 Z" fill="#262626" />
          </g>
        )}

        {/* BL-01: 1017 ALYX 9SM Rollercoaster Belt */}
        {product.modelPreset === 'BL' && (
          <g stroke="#000000" strokeWidth="1.8">
            <ellipse cx="80" cy="58" rx="50" ry="26" fill="none" stroke="#141414" strokeWidth="12" />
            <rect x="58" y="70" width="44" height="22" fill="#303030" stroke="#000000" strokeWidth="1.8" />
            <rect x="64" y="66" width="8" height="4" fill="#D4D4D4" stroke="none" />
            <rect x="88" y="66" width="8" height="4" fill="#D4D4D4" stroke="none" />
            <line x1="66" y1="81" x2="94" y2="81" stroke="#E5E5E5" strokeWidth="1.6" />
          </g>
        )}
      </svg>
    </div>
  );
};
