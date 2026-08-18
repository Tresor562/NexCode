# NexCode V1.5 — Release Readiness

Ce document sépare ce qui est réellement terminé dans le dépôt de ce qui exige encore une action externe ou un appareil physique.

## Terminé dans le dépôt

- 12 parcours câblés au catalogue.
- Skill Graph, Mastery, Practice Engine, révisions espacées et sessions adaptatives.
- Exercices variés, checkpoints, boss challenges et évaluations.
- Flux leçon → exercice → Lab → validation → retour cours.
- Lab multi-fichiers avec sauvegarde/reprise, preview Web, feedback, tests comportementaux, indices et détection de secrets.
- Recherche, filtres, progression, reprise, maîtrise et navigation chapitres dans l'UX mobile.
- Offline Lite / Standard / Full par chapitre avec versioning et détection des packs obsolètes.
- Project Engine, rubrics et preuves de portfolio.
- Audits curriculum, mastery, bots, qualité et produit.
- TypeScript strict.
- Export Android Expo/Metro.
- Vérification de compatibilité Expo SDK 57.
- Audit de dépendances de production intégré à la CI.

## Métriques à ne pas confondre

- **167 leçons de base individuellement rédigées** dans les fichiers historiques de cours.
- Des milliers d'**activités pédagogiques runtime structurées** dérivées de concepts explicitement écrits et développées en phases de maîtrise/pratique.

La V1.5 ne doit jamais présenter les activités runtime comme « 6000 leçons individuellement rédigées ».

## Blocage EAS actuel

`app.json` contient bien :

- package Android `com.nexustech.nexcode` ;
- `versionCode: 15` ;
- bundle identifier iOS ;
- icône/adaptive icon.

Mais `expo.extra.eas.projectId` n'est pas encore présent. Pour un build EAS non interactif en CI, le projet doit être initialisé ou relié une fois à un projet Expo/EAS.

Le workflow Android vérifie désormais explicitement :

1. que `EXPO_TOKEN` existe dans les secrets GitHub ;
2. que `expo.extra.eas.projectId` existe ;
3. que tous les audits et TypeScript/export Android passent avant d'appeler EAS.

Ne jamais coller `EXPO_TOKEN` dans un commit, un fichier ou un chat public. Le token doit rester dans les secrets GitHub/Expo.

## Étapes externes restantes

1. Initialiser/relier NexCode au projet Expo/EAS afin d'obtenir/configurer `extra.eas.projectId`.
2. Ajouter/valider `EXPO_TOKEN` dans les secrets GitHub si ce n'est pas déjà fait.
3. Déclencher `NexCode Android Build` avec le profil `preview` pour produire l'APK.
4. Installer l'APK sur un téléphone Android réel.
5. Tester au minimum : onboarding, navigation, petits écrans, clavier, reprise après fermeture, offline, téléchargements de packs, leçon→Lab→retour, sauvegarde Lab, projets, profil/mastery et performances.
6. Corriger toute anomalie révélée uniquement sur appareil réel.
7. Déclencher le profil `production` pour produire l'AAB final.
8. Effectuer les contrôles Google Play avant publication.

## Critère de « véritable fin »

La V1.5 peut être considérée terminée côté logiciel lorsque la CI est verte sur le head final et qu'aucun travail réalisable dans le dépôt ne reste connu. Elle ne peut être déclarée testée/production-ready tant que l'APK n'a pas été installé et testé sur appareil réel et que l'AAB n'a pas été généré/validé.
