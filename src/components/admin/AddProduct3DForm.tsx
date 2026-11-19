import React, { useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Layers, Upload } from 'lucide-react';
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

export const AddProduct3DForm: React.FC<AddProduct3DFormProps> = ({
  onViewProductInStore,
}) => {
  const { products, addProduct } = useOD01Store();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Volumetric 2D Photo -> 3D Mesh Reconstruction State
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [removeBackground, setRemoveBackground] = useState<boolean>(true);
  const [bgTolerance, setBgTolerance] = useState<number>(48);
  const [volumeMode, setVolumeMode] = useState<CustomVolumeMode>('SCULPTED');
  const [depth, setDepth] = useState<number>(0.34);
  const [reliefStrength, setReliefStrength] = useState<number>(0.55);
  const [finish, setFinish] = useState<CustomFinish>('LEATHER');

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
      setErrorMsg('FORMAT NON SUPPORTÉ. IMPORTEZ UNE PHOTO PNG, JPG OU WEBP.');
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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    handleImageFile(file);
  };

  const handleGenerateTestPrototype = () => {
    setErrorMsg(null);
    const sampleUrl = generateSample2DPrototype(
      universe,
      `${autoSku.codePrefix}-${String(autoSku.codeNumber).padStart(2, '0')}`
    );
    setImageDataUrl(sampleUrl);
    if (!name.trim()) {
      setName(
        universe === 'CHAUSSURES'
          ? `NIKE AIR JORDAN 1 HIGH BLACK ${String(autoSku.codeNumber).padStart(2, '0')}`
          : universe === 'HABITS'
            ? `STONE ISLAND SHELL JACKET ${String(autoSku.codeNumber).padStart(2, '0')}`
            : `PRADA CROSSBODY ARCHIVE ${String(autoSku.codeNumber).padStart(2, '0')}`
      );
    }
    if (!description.trim()) {
      setDescription(
        'MODÈLE RECONSTRUIT EN 3D VOLUMÉTRIQUE SCULPTÉE DEPUIS UNE SIMPLE PHOTO 2D. MAILLAGE FERMÉ 360°, DÉTOURAGE ADAPTATIF ET CARTES PBR GÉNÉRÉES EN TEMPS RÉEL.'
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
      name: name.trim().toUpperCase() || 'APERÇU SCULPTURE 3D',
      universe,
      priceFcfa: parsedPrice,
      composition,
      dimensions,
      weight,
      description: description || 'RECONSTRUCTION VOLUMÉTRIQUE 3D DEPUIS PHOTO.',
      modelPreset: imageDataUrl ? 'CUSTOM_2D' : 'SN',
      custom3D: imageDataUrl
        ? {
            imageDataUrl,
            removeBackground,
            depth,
            finish,
            volumeMode,
            reliefStrength,
            bgTolerance,
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
    volumeMode,
    reliefStrength,
    bgTolerance,
    sizes,
  ]);

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrice = parseInt(priceInput.replace(/\D/g, ''), 10);

    if (!imageDataUrl) {
      setErrorMsg('IMPORTEZ UNE PHOTO D’ARTICLE (OU GÉNÉREZ UN PROTOTYPE) POUR LA MODÉLISATION 3D.');
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
        'ARTICLE RECONSTRUIT EN 3D VOLUMÉTRIQUE VIA LE STUDIO PHOTO→3D OD-01.',
      modelPreset: 'CUSTOM_2D',
      custom3D: {
        imageDataUrl,
        removeBackground,
        depth,
        finish,
        volumeMode,
        reliefStrength,
        bgTolerance,
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
      {/* LEFT: Live Photo -> Volumetric 3D Sculpting Engine */}
      <div className="flex flex-col border border-black bg-white lg:col-span-5">
        <div className="flex items-center justify-between border-b border-black px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-bold">
            <Layers className="h-4 w-4 stroke-[1.5]" />
            <span>STUDIO PHOTO → 3D VOLUMÉTRIQUE</span>
          </div>
          <span className="text-[10px] font-bold text-black tabular-nums">{autoSku.sku}</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={`relative h-[340px] w-full bg-white transition-colors lg:h-[400px] ${
            isDraggingFile ? 'bg-[#F7F7F7]' : 'bg-white'
          }`}
        >
          {imageDataUrl ? (
            <>
              <ProductStage3D
                product={previewProduct}
                interactiveCatalogClick={false}
              />
              <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] text-[#7A7A7A]">
                <span>GLISSER POUR INSPECTER 360°</span>
                <span>RENDU PHOTO 3D HD · 1024 PX</span>
              </div>
            </>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex h-full cursor-pointer flex-col items-center justify-center p-6 text-center"
            >
              <div
                className={`border border-dashed p-6 transition-colors ${
                  isDraggingFile ? 'border-black bg-white' : 'border-black'
                }`}
              >
                <Upload className="mx-auto h-6 w-6 stroke-[1.5] text-black" />
                <div className="mt-3 text-[11px] font-bold text-black">
                  GLISSEZ OU IMPORTEZ N’IMPORTE QUELLE PHOTO
                </div>
                <div className="mt-1.5 text-[10px] text-[#7A7A7A]">
                  DÉTOURAGE ADAPTATIF · SCULPTURE 3D FERMÉE · NORMALES & RUGOSITÉ PBR
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upload & Volumetric 3D Sculpting Parameters */}
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
              {imageDataUrl ? 'CHANGER LA PHOTO' : 'IMPORTER UNE PHOTO'}
            </button>
            <button
              type="button"
              onClick={handleGenerateTestPrototype}
              className="min-h-[42px] flex-1 border border-black bg-white px-3 text-[10px] font-bold text-black hover:bg-[#F7F7F7] whitespace-nowrap"
            >
              PROTOTYPE STUDIO TEST
            </button>
          </div>

          <div className="space-y-3.5 border-t border-[#E5E5E5] pt-3 text-[10px]">
            {/* 3D Volume Profile Mode */}
            <div>
              <div className="mb-1.5 font-bold">PROFIL DE SCULPTURE 3D</div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'SCULPTED', label: 'SCULPTÉ 3D' },
                    { id: 'PUFFER', label: 'VOLUME +' },
                    { id: 'RIGID', label: 'RIGIDE' },
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

            {/* Volumetric Depth */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold">VOLUME / ÉPAISSEUR 3D</span>
                <span className="tabular-nums text-[#7A7A7A]">{Math.round(depth * 100)} MM</span>
              </div>
              <input
                type="range"
                min={0.14}
                max={0.58}
                step={0.02}
                value={depth}
                onChange={(e) => setDepth(parseFloat(e.target.value))}
                className="w-full accent-black"
              />
            </div>

            {/* Photometric Micro-Relief */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold">RELIEF & TEXTURE PHOTO (PBR)</span>
                <span className="tabular-nums text-[#7A7A7A]">{Math.round(reliefStrength * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={reliefStrength}
                onChange={(e) => setReliefStrength(parseFloat(e.target.value))}
                className="w-full accent-black"
              />
            </div>

            {/* Adaptive Background Cutout + Tolerance */}
            <div className="space-y-2 border-t border-[#E5E5E5] pt-2.5">
              <label className="flex cursor-pointer items-center justify-between">
                <span className="font-bold">DÉTOURAGE AUTO DU FOND</span>
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

            {/* PBR Material Finish */}
            <div>
              <div className="mb-1.5 font-bold">FINITION MATÉRIAU PBR</div>
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
                OBJET 3D VOLUMÉTRIQUE DISPONIBLE IMMÉDIATEMENT SUR LA BOUTIQUE ({publishedProduct.universe})
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
