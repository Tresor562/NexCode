# NexCode Learning Architecture — V1.5+

NexCode ne traite plus un cours comme une simple liste de pages. Le modèle cible est :

**Parcours → Niveaux → Chapitres → Unités → Activités → Exercices → Lab → Révisions → Checkpoints → Projets → Maîtrise.**

## Principes non négociables

- Le nombre affiché dérive toujours du contenu réel.
- 500+ activités par parcours n’autorise aucun remplissage artificiel.
- Une activité doit introduire, pratiquer, réviser, combiner ou évaluer une compétence identifiable.
- XP, progression de contenu, confiance et maîtrise sont des métriques distinctes.
- Une bonne réponse unique ne suffit pas à déclarer une compétence maîtrisée.
- Les prérequis empêchent d’avancer artificiellement sur une base fragile.
- Une compétence faible ou associée à une erreur récurrente revient dans le Practice Engine.
- Une compétence arrivée à échéance revient via répétition espacée.
- Les recommandations mélangent les thèmes pour favoriser le transfert et éviter la mémorisation mécanique.
- Les compétences importantes doivent produire une preuve plus forte : Lab, checkpoint, boss challenge ou projet.
- Les projets ne sont pas des démos à cocher : ils doivent réutiliser des compétences identifiées et passer une revue.

## Séquence d’apprentissage d’une notion

Une notion importante doit normalement passer par plusieurs expositions :

1. **Learn** — modèle mental + exemple minimal ;
2. **Practice** — rappel immédiat sans recopier ;
3. **Practice variée** — même compétence dans un contexte différent ;
4. **Lab** — code manipulable et observable ;
5. **Review** — récupération de mémoire après délai ;
6. **Checkpoint** — vérification sans annoncer exactement la notion testée ;
7. **Boss** — combinaison de plusieurs compétences dans un problème plus ouvert ;
8. **Projet** — transfert vers un produit plus complet.

Le modèle assigne une difficulté croissante et organise les activités en unités, chapitres puis quatre étapes possibles : Fondations, Pratique guidée, Pratique autonome, Transfert & maîtrise.

## Skill Graph et Mastery

Une compétence conserve : score, confiance, essais, réussites, série de réussites, erreurs récurrentes, dernière pratique, prochaine révision et preuves récentes. Les prérequis sont portés par le graphe plutôt que par la simple position visuelle d’une leçon.

Une compétence à 85+ n’est réellement crédible que si l’utilisateur possède aussi des preuves de transfert issues du Lab, d’un checkpoint, d’un boss challenge ou d’un projet.

## Practice Engine

L’ordre de priorité est :

1. réparer une mauvaise conception récurrente ;
2. effectuer une révision espacée arrivée à échéance ;
3. renforcer une compétence faible ;
4. produire une preuve dans le Lab ;
5. passer un checkpoint/boss ;
6. apprendre une nouvelle notion dont les prérequis sont prêts.

Les sessions peuvent être composées pour 5, 10, 20 ou 45 minutes sans casser cette priorité.

## Lab

Le Lab est une partie du cursus, pas un bonus. Une leçon peut ouvrir directement une mission contextualisée. Le workspace peut contenir plusieurs fichiers, est sauvegardable localement et doit pouvoir revenir au cours sans perdre le contexte.

Workspaces prévus :
- Web : `index.html`, `styles.css`, `script.js` ;
- JavaScript : `main.js` ;
- Python : `main.py` ;
- SQL : `query.sql` ;
- Git : `commands.txt` ;
- Node/API : `server.js` + documentation ;
- Bots : `bot.js` + `.env.example` sans secret réel.

La validation locale vérifie au minimum que le travail est non vide, modifié par rapport au départ et qu’aucun token/secret évident n’est enregistré en clair. Des runtimes/tests plus complets pourront remplacer progressivement ces heuristiques.

## Projets

Chaque projet déclare les compétences mobilisées. Le Project Engine vérifie la préparation du développeur et fournit une revue pondérée : fonctionnement, compréhension, qualité du code, cas limites et livraison. La réussite exige au minimum fonctionnement + compréhension, pas uniquement 100 % d’étapes cochées.

## Offline et très grands parcours

Les téléchargements doivent se faire à terme par chapitre ou niveau. L’application expose déjà les primitives de progression et d’estimation de taille par chapitre/niveau afin qu’un parcours de 500+ activités ne devienne pas un pack obligatoire gigantesque.

## Moteurs

- `src/data/curriculumCore.ts` : schéma, étapes, chapitres, unités, exercices et séquençage des activités.
- `src/learning/skillGraph.ts` : graphe de compétences, prérequis et preuves de maîtrise.
- `src/learning/practiceEngine.ts` : répétition espacée, réparation, interleaving, Lab et sessions adaptatives.
- `src/learning/sessionEngine.ts` : orchestration d’une réponse, erreurs, maîtrise, XP et file adaptative.
- `src/learning/labEngine.ts` : missions multi-fichiers, autosave-compatible et validation locale.
- `src/learning/projectEngine.ts` : préparation, rubriques et revue des projets.
- `src/learning/catalog.ts` : recherche cours/activités, progression niveau/chapitre/unité et offline.
- `src/learning/pedagogy.ts` : politique de profondeur pour les futurs parcours 500+.

## État réel et stratégie d’expansion

Le curriculum actuel contient 12 parcours, 53 modules, 167 leçons interactives écrites et 18 projets guidés. Ce volume est encore très inférieur à la cible finale de 500+ activités par parcours. Il ne faut pas combler cet écart par génération superficielle : chaque grand parcours sera approfondi un par un, chapitre par chapitre, après stabilisation du moteur pédagogique.

## Critère de « prêt »

NexCode V1.5 n’est pas déclarée prête parce qu’elle compile. Il faut aussi vérifier : cohérence pédagogique, UX mobile, transitions cours↔Lab, persistance, téléchargements par chapitre, performances, erreurs/reprises, puis l’APK réellement installé sur téléphone.
