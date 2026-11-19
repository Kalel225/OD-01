import React, { Suspense, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Box, Layers, RefreshCw, RotateCw, Upload, X } from 'lucide-react';
import { useOD01Store } from '../../store/useOD01Store';
import {
  CustomFinish,
  CustomVolumeMode,
  Product,
  SizeVariant,
  UNIVERSE_ORDER,
  UniverseId,
  generateNextSku,
} from '../../types/od01';
import { ProductStage3D } from '../three/ProductStage3D';
import { generateSample360Views } from '../three/imageTo3D';

const ProductTurntable3D = React.lazy(() => import('../ProductTurntable3D'));

interface AddProduct3DFormProps {
  onViewProductInStore: (productId: string) => void;
}

type SideSlotKey = 'front' | 'left' | 'right' | 'back';

interface SideSlotMeta {
  key: SideSlotKey;
  label: string;
  subtitle: string;
  angleDeg: number;
  required?: boolean;
}

const SIDE_SLOTS: SideSlotMeta[] = [
  {
    key: 'front',
    label: 'VUE PRINCIPALE *',
    subtitle: 'FACE / 3/4 AVANT',
    angleDeg: 0,
    required: true,
  },
  {
    key: 'left',
    label: 'PROFIL GAUCHE',
    subtitle: 'OPTIONNEL · VUE 2',
    angleDeg: 270,
  },
  {
    key: 'right',
    label: 'PROFIL DROIT',
    subtitle: 'OPTIONNEL · VUE 3',
    angleDeg: 90,
  },
  {
    key: 'back',
    label: 'TALON / ARRIÈRE',
    subtitle: 'OPTIONNEL · VUE 4',
    angleDeg: 180,
  },
];

const EMPTY_SIDES: Record<SideSlotKey, string> = {
  front: '',
  left: '',
  right: '',
  back: '',
};

const PREFIX_OPTIONS_BY_UNIVERSE: Record<UniverseId, { code: string; label: string }[]> = {
  CHAUSSURES: [
    { code: 'SN', label: 'SN — SNEAKER' },
    { code: 'SL', label: 'SL — MULE / SLIDE' },
    { code: 'BT', label: 'BT — BOTTE' },
  ],
  HABITS: [
    { code: 'TS', label: 'TS — T-SHIRT' },
    { code: 'HD', label: 'HD — HOODIE' },
    { code: 'PT', label: 'PT — PANTALON' },
    { code: 'WB', label: 'WB — VESTE / SHELL' },
    { code: 'SP', label: 'SP — SURVÊTEMENT' },
  ],
  ACCESSOIRES: [
    { code: 'BG', label: 'BG — SAC' },
    { code: 'CP', label: 'CP — CASQUETTE' },
    { code: 'SK', label: 'SK — CHAUSSETTES' },
    { code: 'BL', label: 'BL — CEINTURE' },
  ],
};

function defaultSizesForUniverse(universe: UniverseId): SizeVariant[] {
  if (universe === 'CHAUSSURES') {
    return [
      { label: '40', cm: '25.3 CM', stock: 4 },
      { label: '41', cm: '26.0 CM', stock: 5 },
      { label: '42', cm: '26.7 CM', stock: 6 },
      { label: '43', cm: '27.3 CM', stock: 5 },
      { label: '44', cm: '28.0 CM', stock: 3 },
    ];
  }
  if (universe === 'HABITS') {
    return [
      { label: 'S', cm: 'L.68 × P.56 CM', stock: 4 },
      { label: 'M', cm: 'L.71 × P.59 CM', stock: 6 },
      { label: 'L', cm: 'L.74 × P.62 CM', stock: 6 },
      { label: 'XL', cm: 'L.77 × P.65 CM', stock: 3 },
    ];
  }
  return [{ label: 'UNIQUE', cm: '36 × 24 × 10 CM', stock: 10 }];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file data'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.readAsDataURL(file);
  });
}

export const AddProduct3DForm: React.FC<AddProduct3DFormProps> = ({
  onViewProductInStore,
}) => {
  const { products, addProduct, triggerProduct3DGeneration } = useOD01Store();
  const singleSlotInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const activeUploadSlotRef = useRef<SideSlotKey>('front');

  const [universe, setUniverse] = useState<UniverseId>('CHAUSSURES');
  const [prefix, setPrefix] = useState<string>('SN');
  const [name, setName] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('65000');
  const [composition, setComposition] = useState<string>(
    'CUIR PLEINE FLEUR / TEXTILE TECHNIQUE · FINITION STUDIO'
  );
  const [dimensions, setDimensions] = useState<string>('COTES STANDARD AUTHENTIQUES');
  const [weight, setWeight] = useState<string>('460 G');
  const [description, setDescription] = useState<string>('');
  const [sizes, setSizes] = useState<SizeVariant[]>(() => defaultSizesForUniverse('CHAUSSURES'));

  // Multi-Angle 360° Studio State (index 0 = mandatory primary view, indices 1..3 = optional secondary views)
  const [sideViews, setSideViews] = useState<Record<SideSlotKey, string>>(EMPTY_SIDES);
  const [batchSequence, setBatchSequence] = useState<string[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [removeBackground, setRemoveBackground] = useState<boolean>(true);
  const [bgTolerance, setBgTolerance] = useState<number>(42);
  const [volumeMode, setVolumeMode] = useState<CustomVolumeMode>('SCULPTED');
  const [depth] = useState<number>(0.36);
  const [reliefStrength] = useState<number>(0.55);
  const [finish, setFinish] = useState<CustomFinish>('LEATHER');

  // Toggle to trigger async `.glb` Turntable 3D reconstruction on save
  const [generateTurntable3D, setGenerateTurntable3D] = useState<boolean>(true);

  // Interactive 360° studio preview controls
  const [forcedYawRad, setForcedYawRad] = useState<number | null>(null);
  const [forcedYawNonce, setForcedYawNonce] = useState<number>(0);
  const [liveAngleDeg, setLiveAngleDeg] = useState<number>(0);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishedProductId, setPublishedProductId] = useState<string | null>(null);

  const publishedProduct = useMemo(
    () => (publishedProductId ? products.find((p) => p.id === publishedProductId) ?? null : null),
    [products, publishedProductId]
  );

  // Automatic sequential SKU computation (`OD-01 / XX-NN`)
  const autoSku = useMemo(() => generateNextSku(products, prefix), [products, prefix]);

  // Structured product.images array: [primary (face/3/4), left, right, back] (1 to 4 URLs)
  const structuredImages = useMemo<string[]>(() => {
    const ordered = [sideViews.front, sideViews.left, sideViews.right, sideViews.back].filter(
      (u) => Boolean(u)
    );
    if (ordered.length > 0) return ordered.slice(0, 4);
    return batchSequence.slice(0, 4);
  }, [sideViews, batchSequence]);

  // Clockwise ordered 360° sequence derived from either batch import (5–12 views) or the 4 cardinal side slots
  const orderedViews360 = useMemo<string[]>(() => {
    if (batchSequence.length >= 2) {
      return batchSequence;
    }
    return [sideViews.front, sideViews.right, sideViews.back, sideViews.left].filter((u) =>
      Boolean(u)
    );
  }, [batchSequence, sideViews]);

  const primaryImageUrl = structuredImages[0] ?? orderedViews360[0] ?? '';

  // Compute quick-angle inspection buttons dynamically matching the active views
  const quickAngleButtons = useMemo(() => {
    if (batchSequence.length >= 2) {
      return [
        { label: '0°', deg: 0 },
        { label: '90°', deg: 90 },
        { label: '180°', deg: 180 },
        { label: '270°', deg: 270 },
      ];
    }
    const activeNamed: { key: SideSlotKey; label: string }[] = [];
    if (sideViews.front) activeNamed.push({ key: 'front', label: 'FACE' });
    if (sideViews.right) activeNamed.push({ key: 'right', label: 'DROIT' });
    if (sideViews.back) activeNamed.push({ key: 'back', label: 'DOS' });
    if (sideViews.left) activeNamed.push({ key: 'left', label: 'GAUCHE' });

    if (activeNamed.length <= 1) {
      return [
        { label: '0° FACE', deg: 0 },
        { label: '180° OPPOSÉ', deg: 180 },
      ];
    }

    const step = 360 / activeNamed.length;
    return activeNamed.map((item, idx) => {
      const deg = Math.round(idx * step);
      return { label: `${deg}° ${item.label}`, deg };
    });
  }, [batchSequence.length, sideViews]);

  const jumpToAngle = (deg: number) => {
    setForcedYawRad((deg * Math.PI) / 180);
    setForcedYawNonce((n) => n + 1);
  };

  const handleUniverseChange = (nextUniverse: UniverseId) => {
    setUniverse(nextUniverse);
    const firstPrefix = PREFIX_OPTIONS_BY_UNIVERSE[nextUniverse][0]?.code ?? 'XX';
    setPrefix(firstPrefix);
    setSizes(defaultSizesForUniverse(nextUniverse));
  };

  const openSlotPicker = (slot: SideSlotKey) => {
    activeUploadSlotRef.current = slot;
    if (singleSlotInputRef.current) {
      singleSlotInputRef.current.value = '';
      singleSlotInputRef.current.click();
    }
  };

  const handleSingleSlotFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('FORMAT NON SUPPORTÉ. IMPORTEZ UNE PHOTO PNG, JPG OU WEBP.');
      return;
    }
    try {
      setErrorMsg(null);
      const dataUrl = await readFileAsDataUrl(file);
      const targetSlot = activeUploadSlotRef.current;
      setBatchSequence([]);
      setSideViews((prev) => {
        const next = { ...prev, [targetSlot]: dataUrl };
        // If user uploads an optional side first, also set it as primary front if empty
        if (!next.front && targetSlot !== 'front') {
          next.front = dataUrl;
        }
        return next;
      });
    } catch {
      setErrorMsg('ERREUR LORS DE LA LECTURE DE LA PHOTO.');
    }
  };

  const handleMultiFiles = async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 12);

    if (validFiles.length === 0) {
      setErrorMsg('IMPORTEZ DES PHOTOS AU FORMAT PNG, JPG OU WEBP.');
      return;
    }

    try {
      setErrorMsg(null);
      const urls = await Promise.all(validFiles.map(readFileAsDataUrl));
      if (urls.length === 1) {
        setBatchSequence([]);
        setSideViews((prev) => ({
          ...prev,
          front: prev.front ? prev.front : urls[0],
          back: prev.front && !prev.back ? urls[0] : prev.back,
        }));
      } else if (urls.length === 2) {
        // 2 images = Face 0° + Dos 180° (ideal 2-side 360° setup)
        setBatchSequence([]);
        setSideViews({ front: urls[0], right: '', back: urls[1], left: '' });
      } else if (urls.length === 3) {
        setBatchSequence([]);
        setSideViews({ front: urls[0], right: urls[1], back: urls[2], left: '' });
      } else if (urls.length === 4) {
        // 4 images = Face 0°, Droit 90°, Dos 180°, Gauche 270°
        setBatchSequence([]);
        setSideViews({ front: urls[0], right: urls[1], back: urls[2], left: urls[3] });
      } else {
        // 5 to 12 images = Full multi-frame turntable sequence
        setBatchSequence(urls);
        setSideViews({
          front: urls[0],
          right: urls[Math.floor(urls.length * 0.25)] ?? '',
          back: urls[Math.floor(urls.length * 0.5)] ?? '',
          left: urls[Math.floor(urls.length * 0.75)] ?? '',
        });
      }
      jumpToAngle(0);
    } catch {
      setErrorMsg('IMPOSSIBLE DE CHARGER CERTAINES PHOTOS.');
    }
  };

  const handleClearSlot = (slot: SideSlotKey) => {
    setBatchSequence([]);
    setSideViews((prev) => ({ ...prev, [slot]: '' }));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleMultiFiles(e.dataTransfer.files);
    }
  };

  const handleGenerateTestPrototype = () => {
    setErrorMsg(null);
    const views = generateSample360Views(universe);
    setBatchSequence([]);
    setSideViews({
      front: views[0] ?? '',
      right: views[1] ?? '',
      back: views[2] ?? '',
      left: views[3] ?? '',
    });
    jumpToAngle(0);

    if (!name.trim()) {
      setName(
        universe === 'CHAUSSURES'
          ? `NIKE AIR FORCE 1 TRIPLE BLACK ${String(autoSku.codeNumber).padStart(2, '0')}`
          : universe === 'HABITS'
            ? `FEAR OF GOD ESSENTIALS TEE ${String(autoSku.codeNumber).padStart(2, '0')}`
            : `PRADA RE-NYLON MESSENGER ${String(autoSku.codeNumber).padStart(2, '0')}`
      );
    }
    if (!description.trim()) {
      setDescription(
        'SCULPTURE 3D SOLIDE RECONSTRUITE PAR ENVELOPPE VISUELLE DEPUIS 4 VUES STUDIO ORTHOGONALES. ROTATION TEMPS RÉEL CONTINUE À 360° SANS PERTE DE TEXTURE.'
      );
    }
  };

  // Live 360° preview product object
  const previewProduct = useMemo<Product>(() => {
    const parsedPrice = Math.max(0, parseInt(priceInput.replace(/\D/g, ''), 10) || 0);
    return {
      id: 'admin-preview-3d',
      sku: autoSku.sku,
      codePrefix: autoSku.codePrefix,
      codeNumber: autoSku.codeNumber,
      name: name.trim().toUpperCase() || 'APERÇU STUDIO 360°',
      universe,
      priceFcfa: parsedPrice,
      composition,
      dimensions,
      weight,
      description: description || 'RENDU ORBITAL MULTI-VUES 360° SANS PERTE DE TEXTURE.',
      modelPreset: primaryImageUrl ? 'CUSTOM_2D' : 'SN',
      custom3D: primaryImageUrl
        ? {
            imageDataUrl: primaryImageUrl,
            views360: orderedViews360.length >= 2 ? orderedViews360 : undefined,
            removeBackground,
            depth,
            finish,
            volumeMode,
            reliefStrength,
            bgTolerance,
          }
        : undefined,
      sizes,
      images: structuredImages,
      model3dUrl: null,
      model3dStatus: 'none',
      model3dJobId: null,
      model3dError: null,
      active: true,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };
  }, [
    autoSku,
    name,
    universe,
    priceInput,
    composition,
    dimensions,
    weight,
    description,
    primaryImageUrl,
    structuredImages,
    orderedViews360,
    removeBackground,
    depth,
    finish,
    volumeMode,
    reliefStrength,
    bgTolerance,
    sizes,
  ]);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrice = parseInt(priceInput.replace(/\D/g, ''), 10);

    if (!primaryImageUrl) {
      setErrorMsg('IMPORTEZ AU MOINS LA PHOTO PRINCIPALE (FACE / 3/4 AVANT) OU UN PROTOTYPE 360°.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('RENSEIGNEZ LE NOM DE L’ARTICLE.');
      return;
    }
    if (!cleanPrice || cleanPrice <= 0) {
      setErrorMsg('INDIQUEZ UN PRIX NET ENTIER VALIDE EN FCFA.');
      return;
    }

    setErrorMsg(null);

    const newProductId = `prod-custom-${Date.now()}`;
    const imagesPayload = structuredImages.length > 0 ? structuredImages : [primaryImageUrl];

    const newProduct: Product = {
      id: newProductId,
      sku: autoSku.sku,
      codePrefix: autoSku.codePrefix,
      codeNumber: autoSku.codeNumber,
      name: name.trim().toUpperCase(),
      universe,
      priceFcfa: cleanPrice,
      composition: composition.trim().toUpperCase(),
      dimensions: dimensions.trim().toUpperCase(),
      weight: weight.trim().toUpperCase(),
      description:
        description.trim().toUpperCase() ||
        'ARTICLE PUBLIÉ VIA LE STUDIO MULTI-ANGLES 3D OD-01.',
      modelPreset: 'CUSTOM_2D',
      custom3D: {
        imageDataUrl: primaryImageUrl,
        views360: orderedViews360.length >= 2 ? orderedViews360 : undefined,
        removeBackground,
        depth,
        finish,
        volumeMode,
        reliefStrength,
        bgTolerance,
      },
      sizes,
      images: imagesPayload,
      model3dUrl: null,
      model3dStatus: generateTurntable3D ? 'pending' : 'none',
      model3dJobId: null,
      model3dError: null,
      active: true,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    addProduct(newProduct);
    setPublishedProductId(newProductId);

    if (generateTurntable3D) {
      void triggerProduct3DGeneration(newProductId, imagesPayload);
    }

    setName('');
    setDescription('');
    setSideViews(EMPTY_SIDES);
    setBatchSequence([]);
    setLiveAngleDeg(0);
    setForcedYawRad(null);
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 lg:gap-8">
      {/* LEFT: Live Multi-Angle 360° Studio Engine */}
      <div className="flex flex-col border border-black bg-white md:col-span-5">
        <div className="flex items-center justify-between gap-2 border-b border-black px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold sm:text-[11px]">
            <Layers className="h-4 w-4 shrink-0 stroke-[1.5]" />
            <span className="truncate">STUDIO MULTI-VUES 360° HD</span>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-black tabular-nums">{autoSku.sku}</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`relative h-[270px] w-full bg-white transition-colors sm:h-[310px] md:h-[340px] lg:h-[370px] ${
            isDraggingFile ? 'bg-[#F7F7F7]' : 'bg-white'
          }`}
        >
          {primaryImageUrl ? (
            <>
              <ProductStage3D
                product={previewProduct}
                interactiveCatalogClick={false}
                forcedYawRad={forcedYawRad}
                forcedYawNonce={forcedYawNonce}
                onYawChange={setLiveAngleDeg}
              />
              <div className="pointer-events-none absolute top-2.5 left-3 right-3 flex items-center justify-between text-[9px] text-[#7A7A7A] tabular-nums">
                <span className="bg-white/90 px-1.5 py-0.5 font-bold text-black">
                  {orderedViews360.length >= 2
                    ? `360° NATIF · ${orderedViews360.length} VUES`
                    : '1 VUE · MIROIR 360° AUTO'}
                </span>
                <span className="bg-white/90 px-1.5 py-0.5 font-bold text-black">
                  {String(liveAngleDeg).padStart(3, '0')}°
                </span>
              </div>
              <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] text-[#7A7A7A]">
                <span>GLISSER POUR TOURNER À 360°</span>
                <span>TEXTURE HD 1024 PX</span>
              </div>
            </>
          ) : (
            <div
              onClick={() => openSlotPicker('front')}
              className="flex h-full cursor-pointer flex-col items-center justify-center p-6 text-center"
            >
              <div
                className={`border border-dashed p-6 transition-colors ${
                  isDraggingFile ? 'border-black bg-white' : 'border-black'
                }`}
              >
                <Upload className="mx-auto h-6 w-6 stroke-[1.5] text-black" />
                <div className="mt-3 text-[11px] font-bold text-black">
                  GLISSEZ 1 À 12 PHOTOS DE L’ARTICLE
                </div>
                <div className="mt-1.5 text-[10px] text-[#7A7A7A]">
                  AJOUTEZ 2 CÔTÉS (FACE + DOS) OU 4 CÔTÉS (0° · 90° · 180° · 270°) POUR UN 360° SANS PERTE DE TEXTURE
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 1-Click Angle Inspection Strip when at least 1 photo is loaded */}
        {primaryImageUrl && (
          <div className="grid grid-cols-2 border-t border-black bg-[#F7F7F7] sm:grid-cols-4">
            {quickAngleButtons.map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => jumpToAngle(btn.deg)}
                className="flex min-h-[34px] items-center justify-center gap-1 border-r border-b border-[#E5E5E5] px-2 text-[9px] font-bold text-black last:border-r-0 hover:bg-black hover:text-white sm:border-b-0"
              >
                <RotateCw className="h-2.5 w-2.5 shrink-0 stroke-[1.75]" />
                <span className="truncate tabular-nums">{btn.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Multi-Side Upload Matrix & Studio Parameters */}
        <div className="space-y-4 border-t border-black p-4">
          <input
            ref={singleSlotInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void handleSingleSlotFile(e.target.files?.[0]);
            }}
          />
          <input
            ref={batchInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                void handleMultiFiles(e.target.files);
              }
            }}
          />

          {/* 4-Angle Dedicated Upload Slots: 1 Primary (mandatory) + 3 Secondary (optional) */}
          <div>
            <div className="mb-2 flex items-center justify-between text-[10px]">
              <span className="font-bold">PHOTOS MULTI-ANGLES (1 PRINCIPALE + 3 OPTIONNELLES)</span>
              {batchSequence.length >= 5 && (
                <button
                  type="button"
                  onClick={() => setBatchSequence([])}
                  className="text-[9px] text-[#7A7A7A] underline hover:text-black"
                >
                  LOT {batchSequence.length} VUES ×
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SIDE_SLOTS.map((slot) => {
                const imgUrl = sideViews[slot.key];
                return (
                  <div
                    key={slot.key}
                    className={`relative flex items-center gap-2 border p-2 transition-colors ${
                      imgUrl ? 'border-black bg-white' : 'border-[#E5E5E5] bg-[#F7F7F7]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openSlotPicker(slot.key)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#E5E5E5] bg-white">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={slot.label}
                            className="h-full w-full object-contain p-0.5"
                          />
                        ) : (
                          <Upload className="h-3.5 w-3.5 stroke-[1.5] text-[#7A7A7A]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[9px] font-bold text-black">{slot.label}</div>
                        <div className="truncate text-[9px] text-[#7A7A7A]">
                          {imgUrl ? 'CHARGÉE · MODIFIER' : slot.subtitle}
                        </div>
                      </div>
                    </button>

                    {imgUrl && !slot.required && (
                      <button
                        type="button"
                        onClick={() => handleClearSlot(slot.key)}
                        aria-label={`Retirer la vue ${slot.label}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center border border-[#E5E5E5] text-[#7A7A7A] hover:border-black hover:text-black"
                      >
                        <X className="h-3 w-3 stroke-[1.75]" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (batchInputRef.current) {
                  batchInputRef.current.value = '';
                  batchInputRef.current.click();
                }
              }}
              className="min-h-[42px] flex-1 bg-black px-3 text-[10px] font-bold text-white hover:bg-[#1A1A1A] whitespace-nowrap"
            >
              IMPORTER LOT (2–12 PHOTOS)
            </button>
            <button
              type="button"
              onClick={handleGenerateTestPrototype}
              className="min-h-[42px] flex-1 border border-black bg-white px-3 text-[10px] font-bold text-black hover:bg-[#F7F7F7] whitespace-nowrap"
            >
              PROTOTYPE 3D 360° (4 VUES)
            </button>
          </div>

          <div className="space-y-3.5 border-t border-[#E5E5E5] pt-3 text-[10px]">
            {/* 3D Optical Contour Profile */}
            <div>
              <div className="mb-1.5 font-bold">COURBURE OPTIQUE 3D</div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'SCULPTED', label: 'NATUREL' },
                    { id: 'PUFFER', label: 'GALBÉ +' },
                    { id: 'RIGID', label: 'PLAT HD' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setVolumeMode(mode.id)}
                    className={`min-h-[34px] border text-[10px] font-bold ${
                      volumeMode === mode.id
                        ? 'border-black bg-black text-white'
                        : 'border-[#E5E5E5] bg-white text-black hover:border-black'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Adaptive Background Cutout + Tolerance */}
            <div className="space-y-2 border-t border-[#E5E5E5] pt-2.5">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="font-bold">DÉTOURAGE AUTO DU FOND (TOUTES VUES)</span>
                <input
                  type="checkbox"
                  checked={removeBackground}
                  onChange={(e) => setRemoveBackground(e.target.checked)}
                  className="h-4 w-4 accent-black"
                />
              </label>

              {removeBackground && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[#7A7A7A]">SENSIBILITÉ DÉTOURAGE</span>
                    <span className="tabular-nums text-[#7A7A7A]">{bgTolerance}</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={95}
                    step={2}
                    value={bgTolerance}
                    onChange={(e) => setBgTolerance(parseInt(e.target.value, 10))}
                    className="w-full accent-black"
                  />
                </div>
              )}
            </div>

            {/* Studio Specular Finish */}
            <div>
              <div className="mb-1.5 font-bold">REFLET STUDIO MATIÈRE</div>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: 'MATTE', label: 'MAT' },
                    { id: 'SATIN', label: 'SATIN' },
                    { id: 'LEATHER', label: 'CUIR' },
                    { id: 'METALLIC', label: 'MÉTAL' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFinish(f.id)}
                    className={`min-h-[34px] border text-[10px] font-bold ${
                      finish === f.id
                        ? 'border-black bg-black text-white'
                        : 'border-[#E5E5E5] bg-white text-black hover:border-black'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Product Specification & Auto-SKU Publishing Form */}
      <form onSubmit={handlePublish} className="space-y-5 md:col-span-7">
        {/* Auto-SKU Header Block */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-black bg-[#F7F7F7] p-4">
          <div>
            <div className="text-[10px] text-[#7A7A7A]">CODE SKU ATTRIBUÉ AUTOMATIQUEMENT</div>
            <div className="mt-1 text-[16px] font-bold tracking-[0.12em] text-black tabular-nums">
              {autoSku.sku}
            </div>
          </div>
          <div className="text-right text-[10px] text-[#7A7A7A]">
            SÉQUENCE AUTO-INCRÉMENTÉE PAR PRÉFIXE
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold">UNIVERS CIBLE *</label>
            <select
              value={universe}
              onChange={(e) => handleUniverseChange(e.target.value as UniverseId)}
              className="h-11 w-full border border-black bg-white px-3 text-[11px] font-bold"
            >
              {UNIVERSE_ORDER.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold">PRÉFIXE SKU *</label>
            <select
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="h-11 w-full border border-black bg-white px-3 text-[11px] font-bold"
            >
              {PREFIX_OPTIONS_BY_UNIVERSE[universe].map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[10px] font-bold">NOM DE L’ARTICLE *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="EX: NIKE DUNK LOW BLACK / BALENCIAGA TRACK"
              className="h-11 w-full border border-black bg-white px-3 text-[11px] placeholder:text-[#7A7A7A]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold">PRIX NET (FCFA) *</label>
            <input
              type="number"
              min={1000}
              step={500}
              required
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              className="h-11 w-full border border-black bg-white px-3 text-[11px] font-bold tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold">COMPOSITION</label>
            <input
              type="text"
              value={composition}
              onChange={(e) => setComposition(e.target.value)}
              className="h-11 w-full border border-black bg-white px-3 text-[11px]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold">COTES / DIMENSIONS</label>
            <input
              type="text"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              className="h-11 w-full border border-black bg-white px-3 text-[11px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold">POIDS</label>
            <input
              type="text"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="h-11 w-full border border-black bg-white px-3 text-[11px]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[10px] font-bold">DESCRIPTION TECHNIQUE *</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="CARACTÉRISTIQUES MATÉRIELLES, COUPE ET FINITIONS..."
              className="w-full border border-black bg-white p-3 text-[11px] placeholder:text-[#7A7A7A]"
            />
          </div>
        </div>

        {/* Size & CM Stock Matrix */}
        <div>
          <div className="mb-2 text-[10px] font-bold">
            STOCK INITIAL & ÉQUIVALENCES EN CENTIMÈTRES (CM)
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sizes.map((variant, idx) => (
              <div key={variant.label} className="border border-[#E5E5E5] p-2.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold">{variant.label}</span>
                  <span className="text-[#7A7A7A] tabular-nums">{variant.cm}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#7A7A7A]">QTÉ</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={variant.stock}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setSizes((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, stock: val } : s))
                      );
                    }}
                    className="h-8 w-16 border border-black px-2 text-right text-[11px] font-bold tabular-nums"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Turntable 3D (.glb) Generation Toggle */}
        <div className="border border-black bg-[#F7F7F7] p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-bold text-black">
                <Box className="h-4 w-4 shrink-0 stroke-[1.5]" />
                <span>GÉNÉRER LA VUE 3D (TURNTABLE)</span>
              </div>
              <div className="mt-1 text-[10px] text-[#7A7A7A]">
                DÉTOURAGE BIREFNET + RECONSTRUCTION .GLB PBR ASYNCHRONE · ROTATION 360° EN 11S
              </div>
            </div>
            <input
              type="checkbox"
              checked={generateTurntable3D}
              onChange={(e) => setGenerateTurntable3D(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-black"
            />
          </label>
        </div>

        {errorMsg && (
          <div className="border border-black bg-black px-3.5 py-2.5 text-[10px] text-white">
            {errorMsg}
          </div>
        )}

        {publishedProduct && (
          <div className="space-y-3 border border-black bg-[#F7F7F7] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px]">
                <div className="font-bold">
                  ARTICLE PUBLIÉ : {publishedProduct.sku} — {publishedProduct.name}
                </div>
                <div className="mt-0.5 text-[10px] text-[#7A7A7A]">
                  UNIVERS {publishedProduct.universe} · {publishedProduct.images.length} PHOTO(S)
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewProductInStore(publishedProduct.id)}
                className="flex min-h-[38px] items-center gap-1.5 bg-black px-4 text-[10px] font-bold text-white hover:bg-[#1A1A1A]"
              >
                <span>VOIR SUR LA BOUTIQUE</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Live .glb 3D Generation Status & 4-Second Polling Readout */}
            <div className="border-t border-[#E5E5E5] pt-3">
              {(publishedProduct.model3dStatus === 'pending' ||
                publishedProduct.model3dStatus === 'processing') && (
                <div className="flex items-center justify-between gap-3 border border-black bg-white px-3 py-2.5 text-[10px]">
                  <div className="flex items-center gap-2 font-bold text-black">
                    <span className="inline-block h-2 w-2 animate-pulse bg-black" />
                    <span>RECONSTRUCTION 3D EN COURS...</span>
                  </div>
                  <span className="text-[#7A7A7A] tabular-nums">SUIVI AUTO · 4S</span>
                </div>
              )}

              {publishedProduct.model3dStatus === 'none' && (
                <div className="flex flex-wrap items-center justify-between gap-2 border border-[#E5E5E5] bg-white px-3 py-2.5 text-[10px]">
                  <span className="text-[#7A7A7A]">MODÈLE .GLB NON GÉNÉRÉ</span>
                  <button
                    type="button"
                    onClick={() => void triggerProduct3DGeneration(publishedProduct.id)}
                    className="min-h-[34px] bg-black px-3 text-[10px] font-bold text-white hover:bg-[#1A1A1A]"
                  >
                    GÉNÉRER LA VUE 3D (TURNTABLE)
                  </button>
                </div>
              )}

              {publishedProduct.model3dStatus === 'ready' && publishedProduct.model3dUrl && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="border border-black bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                      MODÈLE 3D .GLB PRÊT (TURNTABLE 360°)
                    </span>
                    <button
                      type="button"
                      onClick={() => void triggerProduct3DGeneration(publishedProduct.id)}
                      className="flex min-h-[34px] items-center gap-1.5 border border-black bg-white px-3 text-[10px] font-bold text-black hover:bg-black hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>RÉGÉNÉRER</span>
                    </button>
                  </div>
                  <div className="h-[260px] w-full border border-black bg-white">
                    <Suspense
                      fallback={
                        <div className="flex h-full items-center justify-center text-[10px] text-[#7A7A7A]">
                          CHARGEMENT DU MODÈLE 3D...
                        </div>
                      }
                    >
                      <ProductTurntable3D
                        images={publishedProduct.images}
                        model3dUrl={publishedProduct.model3dUrl}
                        model3dStatus={publishedProduct.model3dStatus}
                        alt={publishedProduct.name}
                      />
                    </Suspense>
                  </div>
                </div>
              )}

              {publishedProduct.model3dStatus === 'failed' && (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-black bg-white px-3 py-2.5 text-[10px]">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black">ÉCHEC DE RECONSTRUCTION 3D</div>
                    <div className="mt-0.5 text-[#7A7A7A]">
                      {publishedProduct.model3dError || 'Erreur inconnue lors de la génération .glb.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void triggerProduct3DGeneration(publishedProduct.id)}
                    className="flex min-h-[34px] shrink-0 items-center gap-1.5 bg-black px-3 text-[10px] font-bold text-white hover:bg-[#1A1A1A]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>RÉESSAYER</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="min-h-[46px] w-full bg-black text-[11px] font-bold tracking-[0.14em] text-white hover:bg-[#1A1A1A]"
        >
          PUBLIER L’ARTICLE SUR LE SITE ({autoSku.sku})
        </button>
      </form>
    </div>
  );
};
