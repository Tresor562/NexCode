export type CourseCategory = 'Démarrage' | 'Web' | 'Programmation' | 'Données' | 'Outils' | 'Backend' | 'Bots';
export type LearningLevel = 'Débutant' | 'Intermédiaire';
export type ActivityKind = 'learn' | 'practice' | 'lab' | 'review' | 'checkpoint' | 'project' | 'boss';
export type MasteryBand = 'new' | 'learning' | 'practicing' | 'mastered';

export type LabMission = {
  id: string;
  title: string;
  instructions: string;
  language: 'HTML/CSS' | 'JavaScript' | 'Python' | 'SQL' | 'Git' | 'Node/API' | 'Bots';
  starterCode?: string;
  successCriteria: string[];
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
};

export type LearningUnit = {
  id: string;
  title: string;
  lessonIds: string[];
  skillIds: string[];
};

export type Chapter = {
  id: string;
  title: string;
  units: LearningUnit[];
  lessonIds: string[];
  estimatedMinutes: number;
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
  skillIds: string[];
  curriculumVersion: number;
};

export type CourseDraft = Omit<Course, 'lessons' | 'chapters' | 'skillIds' | 'curriculumVersion'> & {
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

function normalizeLesson(courseId: string, value: Lesson): Lesson {
  const fallbackSkill = `${courseId}.${slug(value.module)}.${slug(value.title)}`;
  return {
    ...value,
    skillIds: value.skillIds?.length ? value.skillIds : [fallbackSkill],
    prerequisiteSkillIds: value.prerequisiteSkillIds ?? [],
    activityKind: value.activityKind ?? 'learn',
    difficulty: value.difficulty ?? 1,
  };
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
    for (let start = 0; start < moduleLessons.length; start += unitSize) {
      const slice = moduleLessons.slice(start, start + unitSize);
      units.push({
        id: `${courseId}.${slug(module)}.u${Math.floor(start / unitSize) + 1}`,
        title: slice.length === 1 ? slice[0]!.title : `Unité ${Math.floor(start / unitSize) + 1}`,
        lessonIds: slice.map((item) => item.id),
        skillIds: [...new Set(slice.flatMap((item) => item.skillIds ?? []))],
      });
    }
    return {
      id: `${courseId}.chapter-${chapterIndex + 1}-${slug(module)}`,
      title: module,
      units,
      lessonIds: moduleLessons.map((item) => item.id),
      estimatedMinutes: moduleLessons.reduce((total, item) => total + item.durationMin, 0),
    };
  });
}

export function makeCourse(draft: CourseDraft): Course {
  const normalizedLessons = draft.starterLessons.map((item) => normalizeLesson(draft.id, item));
  return {
    ...draft,
    starterLessons: normalizedLessons,
    lessons: normalizedLessons.length,
    chapters: buildChapters(draft.id, normalizedLessons),
    skillIds: [...new Set(normalizedLessons.flatMap((item) => item.skillIds ?? []))],
    curriculumVersion: draft.curriculumVersion ?? 1,
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
  return {
    id,
    module,
    title,
    durationMin,
    concept,
    example,
    question,
    choices,
    correctIndex,
    explanation,
  };
}
