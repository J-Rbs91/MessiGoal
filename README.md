# ⚽ MessiGoal

**Base de données participative recensant tous les buts de Lionel Messi.**

Chacun peut **ajouter**, **corriger** et **compléter** les buts. Pour chaque but,
on recense :

- la **date** du match
- le **lieu** (ville) et le **nom du stade**
- l'**équipe adverse**
- la **minute** du but
- la **partie du corps** (pied gauche, pied droit, tête, autre)
- le **type de but** : en jeu, pénalty, coup franc, contre son camp
- la **compétition**
- le **gardien adverse**
- un **lien vidéo** vers l'action du but

## Démarrage

Aucune dépendance à installer — uniquement Node.js (≥ 18).

```bash
npm start
# puis ouvrir http://localhost:3000
```

Le port est configurable via la variable d'environnement `PORT`.

## Tests

```bash
npm test
```

## Architecture

| Élément | Détail |
|---|---|
| Backend | `server.js` — serveur HTTP natif Node.js, sans dépendance |
| Stockage | `data/goals.json` (écriture atomique) |
| Frontend | `public/` — HTML/CSS/JS sans framework |

### API REST

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/goals` | Liste des buts (filtres : `q`, `competition`, `bodyPart`, `goalType`, `hasVideo`, `sort`) |
| `GET` | `/api/goals/:id` | Détail d'un but |
| `POST` | `/api/goals` | Ajouter un but |
| `PUT` | `/api/goals/:id` | Modifier / corriger / compléter un but |
| `DELETE` | `/api/goals/:id` | Supprimer un but |
| `GET` | `/api/stats` | Statistiques agrégées |
| `GET` | `/api/meta` | Valeurs autorisées (parties du corps, types de but) |

## Déploiement (GitHub Pages)

Le site est déployé automatiquement sur **GitHub Pages** à chaque push sur
`main`, via le workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

➡️ **URL publique : https://j-rbs91.github.io/MessiGoal/**

> Première activation : dans **Settings → Pages**, choisir la source
> **« GitHub Actions »** (le workflow tente aussi de l'activer automatiquement).

### Mode adaptatif (statique / dynamique)

Le frontend détecte son environnement au démarrage :

- **Avec backend** (local, `npm start`) : lecture/écriture en direct via l'API.
- **Sans backend** (GitHub Pages) : lecture des buts depuis le fichier statique
  `goals.json`, statistiques et filtres calculés côté client.

Sur GitHub Pages, comme l'hébergement est statique, les **ajouts et corrections**
ne sont pas écrits directement : ils ouvrent une **issue GitHub pré-remplie**
(libellée `contribution`). La communauté valide la proposition, puis le but est
intégré à `data/goals.json` — les données restent ainsi **partagées et versionnées**.

## Contribuer

Le projet est volontairement minimaliste pour rester facile à faire évoluer.
Les données initiales (`data/goals.json`) ne contiennent que quelques buts
emblématiques en exemple : la communauté est invitée à compléter le reste.
