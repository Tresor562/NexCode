# NexCode Learning Architecture — V1.5+

NexCode ne traite plus un cours comme une simple liste de pages. Le modèle cible est :

**Parcours → Chapitres → Unités → Activités → Compétences → Maîtrise → Révision → Lab → Projet.**

## Règles produit

- Le nombre affiché dérive toujours du contenu réel.
- Une activité doit introduire, pratiquer, réviser, combiner ou évaluer une compétence identifiable.
- XP, progression et maîtrise sont distincts.
- Les prérequis empêchent d’avancer artificiellement sur une base fragile.
- Une compétence faible revient dans le Practice Engine.
- Une compétence arrivée à échéance revient via répétition espacée.
- Les recommandations mélangent les thèmes pour favoriser le transfert et éviter la mémorisation mécanique.
- Le Lab est une partie du cursus : une leçon doit pouvoir ouvrir une mission contextualisée, sauvegarder le travail puis revenir au cours.
- Les téléchargements doivent évoluer vers des packs par chapitre afin que les très grands cours restent raisonnables sur mobile.

## Politique des cours profonds

L’objectif de 500+ activités par grand parcours ne signifie pas 500 pages de texte. Une notion importante suit plusieurs expositions : introduction, rappel immédiat, pratique guidée, variation, Lab, révision espacée, checkpoint puis réutilisation dans un problème plus ouvert.

Le découpage cible est de 20 à 35 chapitres, généralement 15 à 30 activités par chapitre. Cette cible est une politique de profondeur, pas un compteur à remplir artificiellement.

## Moteurs

- `src/data/curriculumCore.ts` : modèle structuré, chapitres/unités et version du curriculum.
- `src/learning/skillGraph.ts` : graphe de compétences, prérequis, score et historique d’erreurs.
- `src/learning/practiceEngine.ts` : révision espacée, compétences faibles, nouvelles notions prêtes et interleaving.
- `src/learning/labEngine.ts` : mission Lab liée à la leçon et workspace sauvegardable.
- `src/learning/catalog.ts` : recherche, filtres, progression/offline par chapitre et métriques.
- `src/learning/pedagogy.ts` : règles de profondeur pour les futurs parcours 500+.

## Critère de « prêt »

NexCode V1.5 n’est pas déclarée prête parce qu’elle compile. Il faut également vérifier la cohérence pédagogique, la navigation mobile réelle, les transitions cours↔Lab, le comportement offline, les performances sur téléphone et l’APK installé.
