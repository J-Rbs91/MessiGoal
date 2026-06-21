# ⚽ MessiGoal

**Base de données participative recensant tous les buts de Lionel Messi.**

🌐 **Site : https://j-rbs91.github.io/MessiGoal/**
📲 **Installable en application mobile (PWA)** — « Ajouter à l'écran d'accueil ».

[![Validation des données](https://github.com/J-Rbs91/MessiGoal/actions/workflows/validate-data.yml/badge.svg)](https://github.com/J-Rbs91/MessiGoal/actions/workflows/validate-data.yml)
[![Déploiement GitHub Pages](https://github.com/J-Rbs91/MessiGoal/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/J-Rbs91/MessiGoal/actions/workflows/deploy-pages.yml)

Chacun peut **ajouter**, **corriger** et **compléter** les buts. Pour chaque but,
on recense :

- la **date** et l'**équipe de Messi** au moment du but (Barça, PSG, Inter Miami, Argentine…)
- le **lieu** (ville) et le **nom du stade**
- l'**équipe adverse** et le **gardien adverse**
- la **minute** du but
- la **position au tir** (dans la surface, hors de la surface…)
- la **partie du corps** (pied gauche, pied droit, tête, autre)
- le **type de but** : en jeu, pénalty, coup franc, contre son camp
- le **placement dans le but** (petit filet, lucarne, sous la barre, poteau rentrant…)
- la **passe décisive** (passeur)
- la **compétition**
- un **lien vidéo** vers l'action

## Architecture

100 % **statique**, **sans backend** — tout vit dans le dépôt et est servi par
GitHub Pages.

| Élément | Détail |
|---|---|
| Frontend | `index.html` + `styles.css` + `app.js` (racine), sans framework, thème sombre « data » |
| PWA | `manifest.webmanifest` + `sw.js` (hors-ligne, installable) |
| Données | **un fichier JSON par but** dans [`data/goals/`](data/goals/) |
| Build | `scripts/build-data.js` agrège + valide → `goals.json` |
| Déploiement | GitHub Pages depuis la branche `main` (racine) |

Chaque but est stocké dans son **propre fichier** : une contribution = un fichier
= une Pull Request, avec un diff propre et sans conflit. Le format est documenté
dans [`data/README.md`](data/README.md) (schéma : [`data/schema.json`](data/schema.json)).

## Développement

Aucune dépendance d'exécution (Node.js ≥ 18 uniquement pour les scripts).

```bash
npm run build        # agrège data/goals/*.json -> public/goals.json
npm run build:check  # valide les fichiers de buts (utilisé par la CI)
npm run dev          # build + aperçu statique sur http://localhost:8080
npm test             # tests unitaires
```

Pour régénérer les icônes de la PWA : `node scripts/make-icons.js`.

## Déploiement

Le site est servi par **GitHub Pages depuis la branche `main`** (dossier racine) —
réglage **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.

`goals.json` est versionné à la racine. À chaque ajout d'un fichier dans
`data/goals/`, le workflow [`build-data.yml`](.github/workflows/build-data.yml)
le régénère automatiquement et le recommite, afin que le site reste à jour.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). Trois façons : depuis le site (issue
pré-remplie), via une [issue](https://github.com/J-Rbs91/MessiGoal/issues/new/choose),
ou via une Pull Request ajoutant un fichier dans `data/goals/`.

Les données de départ ne couvrent qu'un échantillon de buts emblématiques
(Barça, PSG, Inter Miami, Argentine) : la communauté est invitée à compléter
l'intégralité de la carrière.

## Licence

[MIT](LICENSE).
