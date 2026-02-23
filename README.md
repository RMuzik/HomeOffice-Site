# 🏠 HomeOfficeSetup.pro — Site Astro

Site affilié automatisé pour le niche **Home Office Setup & Productivité Remote**.  
Généré et mis à jour chaque semaine par les agents de [`homeoffice-affiliate`](../homeoffice-affiliate).

## Stack

- **Framework**: [Astro](https://astro.build) 4.x — Static Site Generation
- **CSS**: Tailwind CSS 3 — thème "Warm Oak" personnalisé
- **Hébergement**: [Vercel](https://vercel.com) — déploiement automatique
- **Domaine**: homeofficesetup.pro

## Structure

```
src/
├── layouts/
│   ├── Base.astro          # Layout principal (nav + footer)
│   └── BestOf.astro        # Layout pages comparatifs (avec sidebar TOC)
├── components/
│   ├── ProductCard.astro   # Carte produit affilié Amazon
│   └── TableOfContents.astro
├── pages/
│   ├── index.astro                    # Homepage
│   ├── best-standing-desks.astro      # ✍️ Page manuelle
│   ├── best-ergonomic-chairs.astro    # ✍️ Page manuelle
│   ├── budget-home-office-setup.astro # ✍️ Page manuelle
│   ├── [slug].astro                   # 🤖 Pages auto-générées par BUILDER
│   └── ...
└── styles/
    └── global.css
```

## Développement local

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de dev
npm run dev          # → http://localhost:4321

# Build de production
npm run build

# Preview du build
npm run preview
```

## Variables d'environnement

```env
# .env.local (non versionné)
AFFILIATE_TAG=homeofficepr-21        # Amazon Associates tag
PUBLIC_SITE_URL=https://homeofficesetup.pro
```

## Pipeline automatisé

Le site est mis à jour chaque semaine par les agents de `homeoffice-affiliate` :

```
Lundi 00h  → SCOUT  : Analyse keywords + produits Amazon
Lundi 02h  → CREATOR: Génère textes + images Pinterest
Lundi 04h  → BUILDER: Génère/met à jour les pages Astro ← ce repo
       ↓
  Commit auto → Vercel rebuild → Site en ligne
Vendredi 18h → TRACKER: Rapport analytics + Discord
```

## Ajouter une page manuelle

1. Créer `src/pages/ma-page.astro`
2. Utiliser le layout `BestOf` ou `Base`
3. Ne PAS ajouter `// ⚠️ Page générée automatiquement` — sinon le BUILDER l'écrase

## Déploiement

Vercel déploie automatiquement à chaque push sur `main`.  
Déclenché aussi manuellement par le BUILDER via webhook.

---

*Partie du système APEX — Automatisation affiliate home office*
