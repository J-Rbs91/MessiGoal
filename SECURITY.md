# Politique de sécurité

## Versions prises en charge

MessiGoal est un site **statique** déployé en continu depuis la branche `main`.
Seule la version actuellement déployée est maintenue.

| Version | Prise en charge |
|---|---|
| `main` (déployée) | ✅ |
| Anciennes versions | ❌ |

## Signaler une vulnérabilité

La sécurité est importante, même pour un projet statique sans backend.

- **Ne créez pas d'issue publique** pour une faille de sécurité.
- Utilisez de préférence l'onglet **Security → Report a vulnerability**
  ([GitHub Private Vulnerability Reporting](https://github.com/J-Rbs91/MessiGoal/security/advisories/new)).
- À défaut, écrivez à **ribesjeremy@gmail.com**.

Merci d'inclure :
- une description de la vulnérabilité et de son impact ;
- les étapes de reproduction ;
- si possible, une suggestion de correctif.

## Délais

- **Accusé de réception** : sous 7 jours.
- **Évaluation et correctif** : selon la gravité, dès que possible.

Comme le site n'a pas de backend et ne collecte aucune donnée personnelle, la
surface d'attaque est limitée. Les points d'attention typiques concernent
l'injection de contenu (XSS) via les données affichées et la chaîne de
dépendances de développement.
