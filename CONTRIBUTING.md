# Contribuer à MessiGoal

Merci de votre intérêt ! 🙌 MessiGoal est un projet **participatif** : son but est
de recenser **tous les buts de Lionel Messi**, avec un maximum de détails et de
sources vidéo. Toute contribution — un nouveau but, une correction, une vidéo —
est la bienvenue.

Ce projet est **100 % statique** (aucun backend) : le site est servi par GitHub
Pages et **toutes les données vivent dans le dépôt**. Chaque but est un fichier
JSON dans [`data/goals/`](data/goals/).

## Trois façons de contribuer

### 1. Depuis le site (le plus simple)
Sur [le site](https://j-rbs91.github.io/MessiGoal/), cliquez sur **« + Ajouter un
but »** ou sur **« ✏️ Proposer »** en bout de ligne. Le formulaire ouvre une
**issue GitHub pré-remplie** : il ne vous reste qu'à la valider. Un mainteneur
transforme ensuite l'issue en fichier.

### 2. Via une issue
Ouvrez une [issue](https://github.com/J-Rbs91/MessiGoal/issues/new/choose) avec le
modèle « Ajout d'un but » ou « Correction d'un but ».

### 3. Via une Pull Request (pour les habitués de Git)
1. **Forkez** le dépôt et créez une branche.
2. Ajoutez un fichier dans `data/goals/` en suivant le format décrit dans
   [`data/README.md`](data/README.md). Nommage : `AAAA-MM-JJ-adversaire.json`.
3. Validez en local :
   ```bash
   npm run build:check   # vérifie le format de tous les buts
   npm test              # tests unitaires
   ```
4. Ouvrez la Pull Request. La CI (« Validation des données ») vérifie
   automatiquement vos fichiers.

## Format d'un but

Voir [`data/README.md`](data/README.md) pour le tableau complet des champs et
[`data/schema.json`](data/schema.json) pour le schéma JSON. Champs obligatoires :
`date` (format `AAAA-MM-JJ`) et `opponent`.

## Aperçu local

```bash
npm run dev    # construit les données puis sert le site sur http://localhost:8080
```

## Qualité des données

- **Vérifiez vos sources** (date, minute, gardien, partie du corps).
- Un **lien vidéo** est un vrai plus : ajoutez-le quand c'est possible.
- Un fichier = un but. Plusieurs buts dans un match → un fichier chacun
  (`...-adversaire-2.json`, `-3`, …).
- Restez factuel et neutre.

## Style de commits

Messages clairs et concis, à l'impératif :
`Ajoute le but vs Real Madrid (2017-04-23)`.

## Code de conduite

En participant, vous acceptez notre [Code de conduite](CODE_OF_CONDUCT.md).

Merci pour votre contribution ! ⚽
