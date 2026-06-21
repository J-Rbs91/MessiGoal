# Données — buts de Lionel Messi

Chaque but est stocké dans **son propre fichier JSON** dans le dossier
[`goals/`](goals/). Une contribution = un fichier = une Pull Request, avec un
diff propre et sans conflit de fusion.

## Nommage des fichiers

```
data/goals/AAAA-MM-JJ-adversaire.json
```

Exemple : `2009-05-27-manchester-united.json`. En cas de plusieurs buts dans le
même match, suffixez : `...-manchester-united-2.json`.

## Format d'un but

```json
{
  "date": "2009-05-27",
  "team": "FC Barcelone",
  "opponent": "Manchester United",
  "competition": "Ligue des champions",
  "city": "Rome",
  "stadium": "Stadio Olimpico",
  "minute": 70,
  "bodyPart": "Tête",
  "goalType": "En jeu",
  "position": "Dans la surface",
  "placement": "Petit filet gauche",
  "assist": "Xavi",
  "goalkeeper": "Edwin van der Sar",
  "videoUrl": "",
  "contributor": "votre-pseudo"
}
```

| Champ | Type | Obligatoire | Valeurs |
|---|---|---|---|
| `date` | chaîne `AAAA-MM-JJ` | ✅ | — |
| `opponent` | chaîne | ✅ | équipe adverse |
| `goalNumber` | entier 1–2000 ou `null` | — | numéro du but en carrière (1 = premier but) |
| `team` | chaîne | — | équipe de Messi : FC Barcelone, Paris Saint-Germain, Inter Miami, Argentine… |
| `competition` | chaîne | — | Liga, Ligue des champions, Copa del Rey… |
| `city` | chaîne | — | ville du match |
| `stadium` | chaîne | — | nom du stade |
| `minute` | entier 0–130 ou `null` | — | minute du but |
| `bodyPart` | chaîne | — | `Pied gauche`, `Pied droit`, `Tête`, `Autre` |
| `goalType` | chaîne | — | `En jeu`, `Pénalty`, `Coup franc`, `Contre son camp` |
| `position` | chaîne | — | `Dans la surface`, `Entrée de la surface`, `Hors de la surface`, `Loin du but (+30 m)` |
| `placement` | chaîne | — | `Petit filet gauche/droit`, `Lucarne gauche/droite`, `Sous la barre`, `Ras de terre`, `Poteau rentrant`, `Plein centre`, `Panenka` |
| `assist` | chaîne | — | passeur décisif |
| `goalkeeper` | chaîne | — | gardien adverse |
| `videoUrl` | URL `http(s)` ou `""` | — | lien vidéo de l'action |
| `contributor` | chaîne | — | votre pseudo (facultatif) |

> Le champ `id` est facultatif : par défaut il vaut le nom du fichier sans
> l'extension `.json`.

## Validation

Avant chaque fusion, la CI exécute :

```bash
npm run build:check
```

qui vérifie le format de tous les fichiers. Vous pouvez le lancer en local.
Le schéma JSON est disponible dans [`schema.json`](schema.json).
