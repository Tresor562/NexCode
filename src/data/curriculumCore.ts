export type CourseCategory = 'Démarrage' | 'Web' | 'Programmation' | 'Données' | 'Outils' | 'Backend' | 'Bots';
export type LearningLevel = 'Débutant' | 'Intermédiaire';
export type ActivityKind = 'learn' | 'practice' | 'lab' | 'review' | 'checkpoint' | 'project' | 'boss';
export type MasteryBand = 'new' | 'learning' | 'practicing' | 'mastered';
export type ExerciseKind = 'mcq' | 'predict-output' | 'fill-code' | 'debug' | 'write-code' | 'explain' | 'refactor' | 'order-steps';

export type LabMission = {
  id: string;
  title: string;
  instructions: string;
  language: 'HTML/CSS' | 'JavaScript' | 'Python' | 'SQL' | 'Git' | 'Node/API' | 'Bots';
  starterCode?: string;
  starterFiles?: Record<string, string>;
  successCriteria: string[];
};

export type ExerciseSpec = {
  id: string;
  kind: ExerciseKind;
  prompt: string;
  skillIds: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  hints: string[];
  errorTags: string[];
};

export type Lesson = {
  id: string;
  module: string;
  title: string;
  durationMin: number;
  concept: string;
  example: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  skillIds?: string[];
  prerequisiteSkillIds?: string[];
  activityKind?: ActivityKind;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  labMission?: LabMission;
  exercises?: ExerciseSpec[];
  retrievalPrompt?: string;
  transferPrompt?: string;
};

export type LearningUnit = {
  id: string;
  title: string;
  lessonIds: string[];
  skillIds: string[];
  activityKinds: ActivityKind[];
  masteryGate: number;
};

export type Chapter = {
  id: string;
  title: string;
  units: LearningUnit[];
  lessonIds: string[];
  skillIds: string[];
  prerequisiteSkillIds: string[];
  estimatedMinutes: number;
  checkpointLessonIds: string[];
  labLessonIds: string[];
};

export type CourseStage = {
  id: string;
  title: string;
  order: number;
  chapterIds: string[];
  masteryGate: number;
  purpose: 'foundation' | 'guided-practice' | 'independent-practice' | 'transfer';
};

export type Course = {
  id: string;
  title: string;
  language: string;
  category: CourseCategory;
  level: LearningLevel;
  lessons: number;
  offlineSizeMb: number;
  estimatedHours: number;
  description: string;
  color: string;
  icon: string;
  starterLessons: Lesson[];
  chapters: Chapter[];
  stages: CourseStage[];
  skillIds: string[];
  curriculumVersion: number;
};

export type CourseDraft = Omit<Course, 'lessons' | 'chapters' | 'stages' | 'skillIds' | 'curriculumVersion'> & {
  curriculumVersion?: number;
};

export type GuidedProject = {
  id: string;
  title: string;
  tech: string;
  track: CourseCategory;
  description: string;
  difficulty: 'Facile' | 'Moyen';
  estimatedMinutes: number;
  skills: string[];
  steps: string[];
};

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function skillIdForModule(courseId: string, module: string) {
  return `${courseId}.${slug(module)}`;
}

const activityCycle: ActivityKind[] = ['learn', 'practice', 'practice', 'lab', 'review', 'practice', 'checkpoint', 'practice', 'boss'];

function defaultActivityKind(indexInModule: number, moduleSize: number): ActivityKind {
  if (moduleSize <= 2) return indexInModule === 0 ? 'learn' : 'checkpoint';
  if (indexInModule === moduleSize - 1) return moduleSize >= 7 ? 'boss' : 'checkpoint';
  return activityCycle[Math.min(indexInModule, activityCycle.length - 1)] ?? 'practice';
}

function defaultDifficulty(kind: ActivityKind, indexInModule: number): 1 | 2 | 3 | 4 | 5 {
  if (kind === 'learn') return 1;
  if (kind === 'boss') return 5;
  if (kind === 'checkpoint') return 4;
  if (kind === 'lab') return 3;
  return Math.min(4, Math.max(2, 2 + Math.floor(indexInModule / 4))) as 2 | 3 | 4;
}

function normalizeLessons(courseId: string, lessons: Lesson[]): Lesson[] {
  const moduleOrder = [...new Set(lessons.map((item) => item.module))];
  const previousSkillByModule = new Map<string, string | undefined>();
  const moduleSizes = new Map<string, number>();
  const modulePositions = new Map<string, number>();

  for (const item of lessons) moduleSizes.set(item.module, (moduleSizes.get(item.module) ?? 0) + 1);
  moduleOrder.forEach((module, index) => {
    const previousModule = moduleOrder[index - 1];
    previousSkillByModule.set(module, previousModule ? skillIdForModule(courseId, previousModule) : undefined);
  });

  return lessons.map((value) => {
    const fallbackSkill = skillIdForModule(courseId, value.module);
    const previousSkill = previousSkillByModule.get(value.module);
    const indexInModule = modulePositions.get(value.module) ?? 0;
    modulePositions.set(value.module, indexInModule + 1);
    const activityKind = value.activityKind ?? defaultActivityKind(indexInModule, moduleSizes.get(value.module) ?? 1);
    const skillIds = value.skillIds?.length ? value.skillIds : [fallbackSkill];
    return {
      ...value,
      skillIds,
      prerequisiteSkillIds:
        value.prerequisiteSkillIds?.length
          ? value.prerequisiteSkillIds
          : previousSkill
            ? [previousSkill]
            : [],
      activityKind,
      difficulty: value.difficulty ?? defaultDifficulty(activityKind, indexInModule),
      retrievalPrompt: value.retrievalPrompt ?? `Sans regarder l’exemple, explique avec tes mots : ${value.title}.`,
      transferPrompt: value.transferPrompt ?? `Dans quel autre problème pourrais-tu réutiliser « ${value.title} » ?`,
      exercises: value.exercises ?? [
        {
          id: `${value.id}.check`,
          kind: 'mcq',
          prompt: value.question,
          skillIds,
          difficulty: value.difficulty ?? defaultDifficulty(activityKind, indexInModule),
          hints: [`Relis le modèle mental de « ${value.title} » avant de répondre.`],
          errorTags: [`${fallbackSkill}.misconception`],
        },
      ],
    };
  });
}

export function buildChapters(courseId: string, lessons: Lesson[]): Chapter[] {
  const grouped = new Map<string, Lesson[]>();
  for (const item of lessons) {
    const bucket = grouped.get(item.module) ?? [];
    bucket.push(item);
    grouped.set(item.module, bucket);
  }

  return [...grouped.entries()].map(([module, moduleLessons], chapterIndex) => {
    const unitSize = 5;
    const units: LearningUnit[] = [];
    const skillIds = [...new Set(moduleLessons.flatMap((item) => item.skillIds ?? []))];
    const prerequisiteSkillIds = [...new Set(moduleLessons.flatMap((item) => item.prerequisiteSkillIds ?? []))];
    for (let start = 0; start < moduleLessons.length; start += unitSize) {
      const slice = moduleLessons.slice(start, start + unitSize);
      const activityKinds = [...new Set(slice.map((item) => item.activityKind ?? 'learn'))];
      units.push({
        id: `${courseId}.${slug(module)}.u${Math.floor(start / unitSize) + 1}`,
        title: slice.length === 1 ? slice[0]!.title : `Unité ${Math.floor(start / unitSize) + 1}`,
        lessonIds: slice.map((item) => item.id),
        skillIds: [...new Set(slice.flatMap((item) => item.skillIds ?? []))],
        activityKinds,
        masteryGate: activityKinds.includes('checkpoint') || activityKinds.includes('boss') ? 75 : 55,
      });
    }
    return {
      id: `${courseId}.chapter-${chapterIndex + 1}-${slug(module)}`,
      title: module,
      units,
      lessonIds: moduleLessons.map((item) => item.id),
      skillIds,
      prerequisiteSkillIds,
      estimatedMinutes: moduleLessons.reduce((total, item) => total + item.durationMin, 0),
      checkpointLessonIds: moduleLessons.filter((item) => ['checkpoint', 'boss'].includes(item.activityKind ?? '')).map((item) => item.id),
      labLessonIds: moduleLessons.filter((item) => item.activityKind === 'lab').map((item) => item.id),
    };
  });
}

export function buildStages(courseId: string, chapters: Chapter[]): CourseStage[] {
  if (chapters.length === 0) return [];
  const stageCount = Math.min(4, chapters.length);
  const perStage = Math.ceil(chapters.length / stageCount);
  const definitions: Array<Pick<CourseStage, 'title' | 'masteryGate' | 'purpose'>> = [
    { title: 'Fondations', masteryGate: 55, purpose: 'foundation' },
    { title: 'Pratique guidée', masteryGate: 65, purpose: 'guided-practice' },
    { title: 'Pratique autonome', masteryGate: 75, purpose: 'independent-practice' },
    { title: 'Transfert & maîtrise', masteryGate: 85, purpose: 'transfer' },
  ];
  return Array.from({ length: stageCount }, (_, index) => ({
    id: `${courseId}.stage-${index + 1}`,
    title: definitions[index]!.title,
    order: index + 1,
    chapterIds: chapters.slice(index * perStage, (index + 1) * perStage).map((chapter) => chapter.id),
    masteryGate: definitions[index]!.masteryGate,
    purpose: definitions[index]!.purpose,
  }));
}

export function makeCourse(draft: CourseDraft): Course {
  const normalizedLessons = normalizeLessons(draft.id, draft.starterLessons);
  const chapters = buildChapters(draft.id, normalizedLessons);
  return {
    ...draft,
    starterLessons: normalizedLessons,
    lessons: normalizedLessons.length,
    chapters,
    stages: buildStages(draft.id, chapters),
    skillIds: [...new Set(normalizedLessons.flatMap((item) => item.skillIds ?? []))],
    curriculumVersion: draft.curriculumVersion ?? 2,
  };
}

export function lesson(
  id: string,
  module: string,
  title: string,
  durationMin: number,
  concept: string,
  example: string,
  question: string,
  choices: string[],
  correctIndex: number,
  explanation: string,
): Lesson {
  return { id, module, title, durationMin, concept, example, question, choices, correctIndex, explanation };
}
