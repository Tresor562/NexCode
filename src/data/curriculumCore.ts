export type CourseCategory = 'Démarrage' | 'Web' | 'Programmation' | 'Données' | 'Outils' | 'Backend' | 'Bots';

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
};

export type Course = {
  id: string;
  title: string;
  language: string;
  category: CourseCategory;
  level: 'Débutant' | 'Intermédiaire';
  lessons: number;
  offlineSizeMb: number;
  estimatedHours: number;
  description: string;
  color: string;
  icon: string;
  starterLessons: Lesson[];
};

export type CourseDraft = Omit<Course, 'lessons'>;

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

export function makeCourse(draft: CourseDraft): Course {
  return { ...draft, lessons: draft.starterLessons.length };
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
