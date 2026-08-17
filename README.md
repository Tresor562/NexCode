# NexCode

NexCode by Nexus Tech — plateforme mobile-first et offline-first pour apprendre, pratiquer et construire avec le code.

## V1.5

Cette branche pose un noyau volontairement léger et sans IA :

- Expo / React Native / TypeScript ;
- dashboard quotidien ;
- parcours HTML, CSS, JavaScript, Python et SQL ;
- projets guidés ;
- pratique locale JavaScript/Python/SQL ;
- progression stockée sur l’appareil ;
- gestion de packs offline ;
- profils Android APK de test et AAB de production.

## Développement

```bash
npm install
npm run start
npm run validate:content
npm run typecheck
```

Expo SDK 57 nécessite Node.js 22.13.x ou plus récent dans cette configuration.

## Android

APK de test :

```bash
eas build --platform android --profile preview
```

Bundle Google Play :

```bash
eas build --platform android --profile production
```

## Architecture V1.5

La V1.5 privilégie les opérations locales afin de limiter les coûts serveur. Python et SQL démarrent avec des validateurs pédagogiques déterministes ; les runtimes complets seront ajoutés progressivement sans rendre le cœur de l’application dépendant du Cloud.
