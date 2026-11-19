#!/usr/bin/env python3
"""
sync_od01_aistudio.py — Compilateur de contexte & orchestrateur Google AI Studio pour OD-01 (Ouest Dynamics)

Ce script :
1. Scanne automatiquement tous les dossiers et fichiers du projet OD-01
   (OD-01-Project-Kickoff-Pack, CDC-COMPLET-OD01, wireframes, prototypes HTML/TSX, tokens JSON).
2. Déduplique les contenus redondants et assemble un fichier maître structuré en balises XML
   (`OD01_AI_STUDIO_MASTER_BUNDLE.md`) directement importable dans Google AI Studio Web / Build.
3. Optionnellement (--generate), interroge l'API Gemini (`gemini-2.5-pro`) via le SDK officiel
   `google-genai` avec Structured Outputs pour générer les fichiers du prototype Next.js/Three.js.

Usage :
  python sync_od01_aistudio.py --root . --bundle-only
  python sync_od01_aistudio.py --root . --generate --out ./od01-prototype-app
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Dict

# Extensions autorisées pour l'ingestion documentaire et technique
ALLOWED_EXTENSIONS = {".md", ".json", ".sql", ".html", ".ts", ".tsx", ".css", ".txt"}

# Dossiers ignorés lors du scan
IGNORED_DIRS = {"node_modules", ".git", ".next", "__pycache__", "od01-prototype-app"}

# Fichier compilé redondant à ignorer si les 7 fichiers individuels du CDC sont présents
REDUNDANT_FILES = {"CDC-COMPLET-OD01.md"}

SYSTEM_INSTRUCTION = """Tu es l'ingénieur principal (Google Staff Engineer) et Directeur Artistique technique d'Ouest Dynamics pour le projet OD-01.
Tu dois respecter à la lettre l'ensemble des spécifications fournies dans les balises <project_documents> :
- Esthétique : Brutalisme Utilitaire & Archive Industrielle (#FFFFFF, #000000, #7A7A7A uniquement, border-radius: 0px partout, box-shadow: none, police Space Mono en capitales).
- Espace Client (/) : Navbar fixe avec logo OD-01 à gauche et bouton burger (2 traits) à droite. Page principale 100dvh sans scroll ni footer (uniquement @ OD-01 en bas). Un seul article modélisé en 3D au centre (rotation 360° au glissement, ouverture popup catalogue complet au clic, remplacement de l'article central à la sélection). Slider horizontal entre HABITS (gauche), CHAUSSURES (centre par défaut) et ACCESSOIRES (droite) partageant le même panier. Bouton PANIER (N) apparaissant à côté de AJOUTER AU PANIER dès le 1er ajout. Tunnel paiement à la livraison (COD) générant un message récapitulatif détaillé.
- Espace Admin PWA (/admin) : Installable en PWA, analytics COD temps réel, formulaire d'ajout d'article qui attribue automatiquement le code SKU (OD-01 / XX-NN), convertit l'image 2D fournie en objet 3D interactif et publie prix et description sur le site.
- Code : TypeScript strict sans 'any', zéro placeholder, nettoyage mémoire WebGL (.dispose())."""


def classify_document(rel_path: str) -> str:
    lower = rel_path.lower()
    if "design-tokens" in lower or "brand-book" in lower or "wireframes" in lower or "04-design" in lower:
        return "DESIGN_SYSTEM_AND_UX"
    if "01-prd" in lower or "03-app-flow" in lower or "spec.md" in lower:
        return "PRODUCT_AND_FLOW_SPECS"
    if "02-trd" in lower or "05-schema" in lower or "07-conventions" in lower:
        return "TECHNICAL_ARCHITECTURE_AND_DB"
    if "contrat" in lower or "06-plan" in lower or "antigravity" in lower or "mcp_config" in lower:
        return "GOVERNANCE_LEGAL_AND_DELIVERY"
    if lower.endswith(".html") or lower.endswith(".tsx") or lower.endswith(".ts"):
        return "PROTOTYPE_SOURCE_CODE"
    return "PROJECT_REFERENCE"


def collect_project_files(root_dir: Path) -> List[Dict[str, str]]:
    collected: List[Dict[str, str]] = []
    all_filenames = {p.name for p in root_dir.rglob("*") if p.is_file()}
    has_split_cdc = "01-PRD-OD01.md" in all_filenames

    for path in sorted(root_dir.rglob("*")):
        if not path.is_file():
            continue
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            continue
        if path.name.startswith("OD01_AI_STUDIO_"):
            continue
        if has_split_cdc and path.name in REDUNDANT_FILES:
            continue

        rel_path = path.relative_to(root_dir).as_posix()
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        collected.append({
            "path": rel_path,
            "category": classify_document(rel_path),
            "content": content.strip(),
        })
    return collected


def build_xml_bundle(files: List[Dict[str, str]]) -> str:
    lines = [
        "# CONTEXTE PROJET COMPLET : OD-01 (OUEST DYNAMICS)",
        "Ce bundle contient l'intégralité des spécifications, tokens W3C, schémas SQL, wireframes et prototypes du projet OD-01.",
        "",
        "<project_documents>",
    ]
    for item in files:
        lines.append(f'  <document path="{item["path"]}" category="{item["category"]}">')
        lines.append(item["content"])
        lines.append("  </document>")
    lines.append("</project_documents>")
    return "
".join(lines)


def generate_prototype_via_gemini(bundle_text: str, output_dir: Path, model_name: str) -> None:
    try:
        from google import genai
        from google.genai import types
        from pydantic import BaseModel, Field
    except ImportError:
        print("[ERREUR] Installez les dépendances : pip install google-genai pydantic", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[ERREUR] Variable d'environnement GEMINI_API_KEY manquante.", file=sys.stderr)
        sys.exit(1)

    class GeneratedFile(BaseModel):
        file_path: str = Field(description="Chemin relatif du fichier dans le projet Next.js (ex: src/app/page.tsx)")
        code: str = Field(description="Contenu complet, typé et exécutable du fichier")

    class PrototypeBuildOutput(BaseModel):
        architecture_notes: str = Field(description="Synthèse des choix techniques appliqués")
        files: List[GeneratedFile] = Field(description="Liste complète des fichiers générés pour le prototype OD-01")

    client = genai.Client(api_key=api_key)

    user_prompt = (
        f"{bundle_text}

"
        "MISSION : Génère l'architecture multi-fichiers complète du prototype Next.js 15 + React Three Fiber + "
        "Tailwind CSS + Supabase + Admin PWA pour OD-01, incluant :
"
        "1. `src/store/useCartStore.ts` (panier unifié cross-univers avec persistance localStorage)
"
        "2. `src/components/three/ProductStage3D.tsx` (scène 3D interactive 360° + clic catalogue + rendu textures 2D->3D)
"
        "3. `src/components/storefront/UniverseSlider.tsx` (slider horizontal HABITS | CHAUSSURES | ACCESSOIRES)
"
        "4. `src/components/storefront/CartModal.tsx` (popup panier unifié + formulaire COD + génération message WhatsApp)
"
        "5. `src/components/admin/AddProduct3DForm.tsx` (formulaire Admin PWA avec auto-SKU OD-01/XX-NN et conversion 2D->3D)
"
        "6. `src/app/page.tsx` et `src/app/admin/page.tsx`."
    )

    print(f"[INFO] Appel à Google AI Studio / Gemini ({model_name}) en cours...")
    response = client.models.generate_content(
        model=model_name,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=0.1,
            response_mime_type="application/json",
            response_schema=PrototypeBuildOutput,
        ),
    )

    result = json.loads(response.text)
    output_dir.mkdir(parents=True, exist_ok=True)

    for f_entry in result.get("files", []):
        target_path = (output_dir / f_entry["file_path"]).resolve()
        if not str(target_path).startswith(str(output_dir.resolve())):
            raise ValueError(f"Chemin de fichier non autorisé : {f_entry['file_path']}")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(f_entry["code"], encoding="utf-8")
        print(f"  [+] Écrit : {f_entry['file_path']}")

    print(f"
[SUCCÈS] Prototype généré dans : {output_dir.resolve()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bridge Projet OD-01 -> Google AI Studio")
    parser.add_argument("--root", type=str, default=".", help="Dossier racine contenant les dossiers OD-01")
    parser.add_argument("--bundle-out", type=str, default="OD01_AI_STUDIO_MASTER_BUNDLE.md", help="Fichier bundle XML de sortie")
    parser.add_argument("--bundle-only", action="store_true", help="Génère uniquement le fichier contexte à uploader dans Google AI Studio Web")
    parser.add_argument("--generate", action="store_true", help="Exécute la génération de code via l'API Gemini")
    parser.add_argument("--out", type=str, default="./od01-prototype-app", help="Dossier cible du code généré")
    parser.add_argument("--model", type=str, default="gemini-2.5-pro", help="Modèle Gemini cible (ex: gemini-2.5-pro, gemini-2.5-flash)")
    args = parser.parse_args()

    root_path = Path(args.root).resolve()
    files = collect_project_files(root_path)

    if not files:
        print(f"[AVERTISSEMENT] Aucun document OD-01 trouvé dans {root_path}", file=sys.stderr)
        sys.exit(1)

    print(f"[INFO] {len(files)} fichiers indexés depuis {root_path} :")
    for f in files:
        print(f"  - [{f['category']}] {f['path']}")

    bundle_content = build_xml_bundle(files)
    bundle_file = root_path / args.bundle_out
    bundle_file.write_text(bundle_content, encoding="utf-8")
    print(f"
[OK] Bundle unifié généré : {bundle_file} ({len(bundle_content):,} caractères)")

    if args.generate and not args.bundle_only:
        generate_prototype_via_gemini(bundle_content, Path(args.out), args.model)


if __name__ == "__main__":
    main()
