# NexCode V1.5 — Dependency Security Posture

Date de vérification : 18 août 2026.

## État vérifié

La CI exécute désormais :

- `npx expo install --check` ;
- `npm audit --omit=dev --audit-level=critical` ;
- tous les audits pédagogiques/produit ;
- TypeScript strict ;
- export Android Expo.

`expo install --check` confirme que les dépendances directes sont cohérentes avec Expo SDK 57 : Expo `~57.0.9`, React `19.2.3`, React Native `0.86.2`, TypeScript `~6.0.3`.

## Vulnérabilités npm restantes

`npm audit --omit=dev` remonte actuellement 18 vulnérabilités transitives : 11 high et 7 moderate.

Les chaînes principales observées dans l'audit sont :

1. `image-size` via Metro / `@expo/metro` / `@expo/metro-config` / Expo CLI. Les avis signalent des boucles infinies possibles sur certains formats d'image spécialement forgés (ICNS, JXL, HEIF), donc un risque de déni de service du processus Node qui analyse ces images.
2. `uuid < 11.1.1` via `xcode` puis `@expo/config-plugins`. L'avis concerne les variantes UUID v3/v5/v6 lorsqu'un buffer externe de taille/offset invalide est fourni.

## Pourquoi aucun `npm audit fix --force`

npm propose actuellement `npm audit fix --force`, mais la résolution calculée ferait installer Expo `53.0.27`. C'est une régression majeure et incompatible avec l'architecture actuelle SDK 57 / React Native 0.86. NexCode ne doit pas sacrifier la compatibilité du framework pour faire disparaître artificiellement le compteur d'audit.

Aucun override transitif risqué n'est appliqué sans preuve de compatibilité avec Metro/Expo SDK 57.

## Impact produit

Ces dépendances se trouvent principalement dans la chaîne Node de bundling/configuration Expo/Metro. Elles ne constituent pas une preuve que le bundle JavaScript exécuté dans l'application Android expose directement ces parseurs Node aux utilisateurs finaux. Elles restent néanmoins un risque supply-chain/build à suivre et à corriger dès qu'une version Expo/Metro compatible intègre les correctifs nécessaires.

## Politique de release

- Les vulnérabilités `critical` de production bloquent désormais la CI.
- Les `high/moderate` transitives connues sont rendues visibles dans les logs et documentées ici tant qu'il n'existe pas de mise à jour compatible validée.
- Avant chaque release publique, relancer `npm audit --omit=dev` et `npx expo install --check`.
- Dès qu'Expo publie une version SDK 57 compatible corrigeant ces chaînes, mettre à jour via `npx expo install`, puis refaire tous les audits, TypeScript et export Android.
- Ne jamais utiliser `npm audit fix --force` sans examiner le plan de changement et revalider l'ensemble du framework.
