# NexCode

NexCode by Nexus Tech — plateforme mobile-first et offline-first pour apprendre, pratiquer et construire avec le code.

## V1.5 — polished offline learning core

Cette branche privilégie une première application légère, cohérente et réellement utile plutôt qu’un grand nombre de fonctions superficielles.

### Expérience produit

- Expo / React Native / TypeScript ;
- onboarding personnalisé ;
- navigation Accueil / Cours / Lab / Projets / Profil ;
- dashboard quotidien avec XP, série et objectif ;
- design system NexCode ;
- progression stockée sur l’appareil ;
- centre de packs offline ;
- pratique locale sans IA obligatoire ;
- icône officielle NexCode ;
- profils Android APK de test et AAB de production.

## Curriculum réel

La quantité affichée dans l’app est calculée à partir du contenu réellement présent. Le validateur CI refuse une régression vers des compteurs fictifs.

### 12 parcours

1. Web & Internet Foundations
2. HTML — de zéro à une vraie page
3. CSS — design responsive
4. JavaScript — logique et interactions
5. Python — programmer avec méthode
6. SQL — comprendre et interroger les données
7. Git & GitHub — versionner comme un développeur
8. Node.js & REST API — créer un backend
9. Bot Development Foundations
10. Créer un bot Telegram
11. Créer un bot Discord
12. Créer un bot WhatsApp

### 167 leçons interactives écrites

Chaque leçon possède :

- un module ;
- une notion à comprendre ;
- un exemple concret ;
- une question de vérification ;
- plusieurs choix ;
- une réponse correcte ;
- une explication pédagogique ;
- une durée estimée ;
- une progression locale et des XP.

Le flux pédagogique reste :

**Comprendre → Voir un exemple → Vérifier → Corriger → Valider → Réutiliser dans un projet.**

## 18 projets guidés

Le Build Mode contient notamment :

- portfolio personnel ;
- landing page responsive ;
- quiz Web interactif ;
- ToDo App ;
- gestionnaire de dépenses ;
- quiz console Python ;
- gestionnaire de notes Python ;
- base Bibliothèque SQL ;
- suivi de notes scolaires SQL ;
- simulation de workflow Git/GitHub ;
- API REST de tâches ;
- API de catalogue de cours ;
- moteur de commandes multi-bot ;
- bot Telegram de révision ;
- assistant Telegram de groupe ;
- bot Discord de communauté ;
- bot WhatsApp utilitaire ;
- dashboard de santé pour bots.

## NexCode Lab

La V1.5 garde un Lab léger et local pour :

- HTML/CSS ;
- JavaScript ;
- Python ;
- SQL.

Python et SQL commencent par des validateurs pédagogiques déterministes afin de garder l’application légère. Les runtimes complets pourront être ajoutés progressivement sans rendre l’apprentissage dépendant du Cloud.

## Offline-first

Les cours sont conçus comme des packs locaux. La progression, les leçons terminées, les téléchargements et les projets restent disponibles sans compte Cloud obligatoire.

## Développement

```bash
npm install
npm run start
npm run validate:content
npm run typecheck
```

Expo SDK 57 nécessite Node.js 22.13.x ou plus récent dans cette configuration.

## Validation CI

La CI vérifie notamment :

- les 12 parcours obligatoires ;
- au moins 160 leçons interactives réellement écrites ;
- l’unicité des identifiants de leçon ;
- au moins 18 projets guidés ;
- la présence de projets Telegram, Discord et WhatsApp ;
- le typecheck TypeScript strict ;
- l’export Android Expo/Metro.

## Android

APK de test :

```bash
eas build --platform android --profile preview
```

Bundle Google Play :

```bash
eas build --platform android --profile production
```

Le packaging natif nécessite un compte Expo/EAS authentifié et le secret `EXPO_TOKEN` dans GitHub Actions.
