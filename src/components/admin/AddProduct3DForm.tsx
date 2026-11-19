import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Layers, Upload } from 'lucide-react';
import { useOD01Store } from '../../store/useOD01Store';
import {
  CustomFinish,
  Product,
  SizeVariant,
  UNIVERSE_ORDER,
  UniverseId,
  generateNextSku,
} from '../../types/od01';
import { ProductStage3D } from '../three/ProductStage3D';
import { generateSample2DPrototype } from '../three/imageTo3D';

interface AddProduct3DFormProps {
  onViewProductInStore: (productId: string) => void;
}

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
    { code: 'WB', label: 'WB — COUPE-VENT' },
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

export const AddProduct3DForm: React.FC<AddProduct3DFormProps> = ({
  onViewProductInStore,
}) => {
  const { products, addProduct } = useOD01Store();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [universe, setUniverse] = useState<UniverseId>('CHAUSSURES');
  const [prefix, setPrefix] = useState<string>('SN');
  const [name, setName] = useState<string>('');
  const [priceInput, setPriceInput] = useState<string>('48000');
  const [composition, setComposition] = useState<string>(
    'MATIÈRE TECHNIQUE ARCHIVE 100% · FINITION MAT INDUSTRIELLE'
  );
  const [dimensions, setDimensions] = useState<string>('EDITION LIMITÉE · COTES STANDARD OD-01');
  const [weight, setWeight] = useState<string>('450 G');
  const [description, setDescription] = useState<string>('');
  const [sizes, setSizes] = useState<SizeVariant[]>(() => defaultSizesForUniverse('CHAUSSURES'));

  // 2D -> 3D Conversion State
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [removeBackground, setRemoveBackground] = useState<boolean>(true);
  const [depth, setDepth] = useState<number>(0.24);
  const [finish, setFinish] = useState<CustomFinish>('MATTE');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishedProduct, setPublishedProduct] = useState<Product | null>(null);

  // Automatic sequential SKU computation (`OD-01 / XX-NN`)
  const autoSku = useMemo(() => generateNextSku(products, prefix), [products, prefix]);

  const handleUniverseChange = (nextUniverse: UniverseId) => {
    setUniverse(nextUniverse);
    const firstPrefix = PREFIX_OPTIONS_BY_UNIVERSE[nextUniverse][0]?.code ?? 'XX';
    setPrefix(firstPrefix);
    setSizes(defaultSizesForUniverse(nextUniverse));
  };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('FORMAT NON SUPPORTÉ. IMPORTEZ UNE IMAGE PNG, JPG OU WEBP.');
      return;
    }
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateTestPrototype = () => {
    setErrorMsg(null);
    const sampleUrl = generateSample2DPrototype(universe, `${autoSku.codePrefix}-${String(autoSku.codeNumber).padStart(2, '0')}`);
    setImageDataUrl(sampleUrl);
    if (!name.trim()) {
      setName(
        universe === 'CHAUSSURES'
          ? `RUNNER PROTOTYPE ${String(autoSku.codeNumber).padStart(2, '0')}`
          : universe === 'HABITS'
            ? `GILET TECHNIQUE ${String(autoSku.codeNumber).padStart(2, '0')}`
            : `POCHETTE MODULAIRE ${String(autoSku.codeNumber).padStart(2, '0')}`
      );
    }
    if (!description.trim()) {
      setDescription(
        'PIÈCE ARCHIVE CONVERTIE EN OBJET 3D VOLUMÉTRIQUE DEPUIS VISUEL 2D. CONSTRUCTION MONOCHROME HAUTE DENSITÉ CONÇUE POUR L’USAGE URBAIN.'
      );
    }
  };

  // Live 3D preview product object
  const previewProduct = useMemo<Product>(() => {
    const parsedPrice = Math.max(0, parseInt(priceInput.replace(/\D/g, ''), 10) || 0);
    return {
      id: 'admin-preview-3d',
      sku: autoSku.sku,
      codePrefix: autoSku.codePrefix,
      codeNumber: autoSku.codeNumber,
      name: name.trim().toUpperCase() || 'APERÇU PROTOTYPE 3D',
      universe,
      priceFcfa: parsedPrice,
      composition,
      dimensions,
      weight,
      description: description || 'APERÇU DE CONVERSION 2D VERS 3D.',
      modelPreset: imageDataUrl ? 'CUSTOM_2D' : 'SN',
      custom3D: imageDataUrl
        ? {
            imageDataUrl,
            removeBackground,
            depth,
            finish,
          }
        : undefined,
      sizes,
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
    imageDataUrl,
    removeBackground,
    depth,
    finish,
    sizes,
  ]);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrice = parseInt(priceInput.replace(/\D/g, ''), 10);

    if (!imageDataUrl) {
      setErrorMsg('IMPORTEZ UNE IMAGE 2D (OU GÉNÉREZ UN PROTOTYPE TEST) POUR LA CONVERSION 3D.');
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

    const newProduct: Product = {
      id: `prod-custom-${Date.now()}`,
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
        'ARTICLE ARCHIVE OD-01 PUBLIÉ VIA LE MODULE ADMIN PWA 2D→3D.',
      modelPreset: 'CUSTOM_2D',
      custom3D: {
        imageDataUrl,
        removeBackground,
        depth,
        finish,
      },
      sizes,
      active: true,
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    addProduct(newProduct);
    setPublishedProduct(newProduct);
    setName('');
    setDescription('');
    setImageDataUrl('');
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* LEFT: Live 2D -> 3D Conversion Viewport */}
      <div className="flex flex-col border border-black bg-white lg:col-span-5">
        <div className="flex items-center justify-between border-b border-black px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <Layers className="h-4 w-4 stroke-[1.5]" />
            <span>MOTEUR 2D → 3D TEMPS RÉEL</span>
          </div>
          <span className="text-[10px] font-bold text-black tabular-nums">{autoSku.sku}</span>
        </div>

        <div className="relative h-[340px] w-full bg-white lg:h-[400px]">
          {imageDataUrl ? (
            <ProductStage3D
              product={previewProduct}
              interactiveCatalogClick={false}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="border border-dashed border-black p-6">
                <Upload className="mx-auto h-6 w-6 stroke-[1.5] text-black" />
                <div className="mt-3 text-[11px] font-bold text-black">
                  IMPORTEZ UNE IMAGE 2D (PNG / JPG / WEBP)
                </div>
                <div className="mt-1.5 text-[10px] text-[#7A7A7A]">
                  DÉTOURAGE AUTO · CARTE DE NORMALES SOBEL · EXTRUSION 360°
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload & 3D Extrusion Parameters */}
        <div className="space-y-4 border-t border-black p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleImageFile(e.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[42px] flex-1 bg-black px-3 text-[10px] font-bold text-white hover:bg-[#1A1A1A] whitespace-nowrap"
            >
              IMPORTER IMAGE 2D
            </button>
            <button
              type="button"
              onClick={handleGenerateTestPrototype}
              className="min-h-[42px] flex-1 border border-black bg-white px-3 text-[10px] font-bold text-black hover:bg-[#F7F7F7] whitespace-nowrap"
            >
              GÉNÉRER PROTOTYPE TEST
            </button>
          </div>

          <div className="space-y-3 border-t border-[#E5E5E5] pt-3 text-[10px]">
            <label className="flex cursor-pointer items-center justify-between">
              <span className="font-bold">DÉTOURAGE AUTOMATIQUE DU FOND</span>
              <input
                type="checkbox"
                checked={removeBackground}
                onChange={(e) => setRemoveBackground(e.target.checked)}
                className="h-4 w-4 accent-black"
              />
            </label>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold">ÉPAISSEUR EXTRUSION 3D</span>
                <span className="tabular-nums text-[#7A7A7A]">{Math.round(depth * 100)} MM</span>
              </div>
              <input
                type="range"
                min={0.08}
                max={0.44}
                step={0.02}
                value={depth}
                onChange={(e) => setDepth(parseFloat(e.target.value))}
                className="w-full accent-black"
              />
            </div>

            <div>
              <div className="mb-1.5 font-bold">FINITION MATÉRIAU PBR</div>
              <div className="grid grid-cols-3 gap-1">
                {(['MATTE', 'SATIN', 'METALLIC'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFinish(f)}
                    className={`min-h-[34px] border text-[10px] font-bold ${
                      finish === f
                        ? 'border-black bg-black text-white'
                        : 'border-[#E5E5E5] bg-white text-black hover:border-black'
                    }`}
                  >
                    {f === 'MATTE' ? 'MAT' : f === 'SATIN' ? 'SATIN' : 'MÉTAL'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Product Specification & Auto-SKU Publishing Form */}
      <form onSubmit={handlePublish} className="space-y-5 lg:col-span-7">
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
              placeholder="EX: BASKET MONOLITHE 02"
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

        {errorMsg && (
          <div className="border border-black bg-black px-3.5 py-2.5 text-[10px] text-white">
            {errorMsg}
          </div>
        )}

        {publishedProduct && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-black bg-[#F7F7F7] p-4">
            <div className="text-[11px]">
              <div className="font-bold">
                ARTICLE PUBLIÉ : {publishedProduct.sku} — {publishedProduct.name}
              </div>
              <div className="mt-0.5 text-[10px] text-[#7A7A7A]">
                OBJET 3D DISPONIBLE IMMÉDIATEMENT SUR LA BOUTIQUE ({publishedProduct.universe})
              </div>
            </div>
            <button
              type="button"
              onClick={() => onViewProductInStore(publishedProduct.id)}
              className="flex min-h-[40px] items-center gap-1.5 bg-black px-4 text-[10px] font-bold text-white hover:bg-[#1A1A1A]"
            >
              <span>VOIR EN 3D SUR LA BOUTIQUE</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="submit"
          className="min-h-[46px] w-full bg-black text-[11px] font-bold tracking-[0.14em] text-white hover:bg-[#1A1A1A]"
        >
          PUBLIER L’ARTICLE 3D SUR LE SITE ({autoSku.sku})
        </button>
      </form>
    </div>
  );
};
