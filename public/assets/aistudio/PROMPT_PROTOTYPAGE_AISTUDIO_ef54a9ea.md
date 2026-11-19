# PROMPT D'AMORÇAGE — GOOGLE AI STUDIO (PROTOTYPAGE COMPLET `OD-01`)

Tous les documents de référence du projet **OD-01** (`SPEC.md`, `design-tokens.json`, `BRAND-BOOK-OD01.md`, `01-PRD` à `07-CONVENTIONS-CODE`, et les maquettes HTML/3D) sont chargés dans ton contexte.

En t'appuyant strictement sur ces spécifications :
1. **Vérifie la cohérence croisée** entre le modèle de données PostgreSQL/Supabase (`05-SCHEMA-BACKEND-OD01.md`), les design tokens W3C (`design-tokens.json`) et les 8 écrans du blueprint (`wireframes-od01.html`).
2. **Génère l'architecture complète et fonctionnelle du prototype Next.js 15 + React Three Fiber + Tailwind CSS + Admin PWA** comprenant :
   - Le moteur 3D interactif (`ProductStage3D.tsx`) avec arbitrage strict entre rotation 360° (*drag*) et ouverture de la popup catalogue (*click*).
   - Le slider horizontal fluide (`UniverseSlider.tsx`) démarrant sur `CHAUSSURES` au centre, avec `HABITS` à gauche et `ACCESSOIRES` à droite.
   - Le store de panier unifié (`useCartStore.ts`) avec apparition conditionnelle du bouton `PANIER (N)` à côté de `AJOUTER AU PANIER`, la popup récapitulative avec total en bas, la validation COD et la génération du message de commande WhatsApp.
   - Le module Admin PWA (`/admin`) avec tableau de bord analytique COD et le convertisseur **Image 2D → Objet 3D + génération automatique de code SKU (`OD-01 / XX-NN`)**.
3. Fournis chaque fichier avec son chemin exact, prêt à être déployé sans aucune dépendance manquante ni erreur TypeScript.
