import { Chapter, Course } from '../data/curriculumCore';

export type OfflinePackKind = 'lite' | 'standard' | 'full';

export type OfflinePack = {
  id: string;
  courseId: string;
  kind: OfflinePackKind;
  chapterIds: string[];
  estimatedMb: number;
  includes: Array<'content' | 'examples' | 'exercise-assets' | 'lab-starters' | 'media'>;
  curriculumVersion: number;
};

function chapterWeight(course: Course, chapter: Chapter) {
  const fraction = course.starterLessons.length ? chapter.lessonIds.length / course.starterLessons.length : 0;
  return Math.max(1, Math.round(course.offlineSizeMb * fraction));
}

export function buildChapterOfflinePack(course: Course, chapterId: string, kind: OfflinePackKind = 'standard'): OfflinePack | undefined {
  const chapter = course.chapters.find((item) => item.id === chapterId);
  if (!chapter) return undefined;
  const base = chapterWeight(course, chapter);
  const multiplier = kind === 'lite' ? 0.55 : kind === 'full' ? 1.35 : 1;
  const includes: OfflinePack['includes'] = kind === 'lite'
    ? ['content', 'examples']
    : kind === 'standard'
      ? ['content', 'examples', 'exercise-assets', 'lab-starters']
      : ['content', 'examples', 'exercise-assets', 'lab-starters', 'media'];
  return {
    id: `${course.id}:${chapter.id}:${kind}:v${course.curriculumVersion}`,
    courseId: course.id,
    kind,
    chapterIds: [chapter.id],
    estimatedMb: Math.max(1, Math.round(base * multiplier)),
    includes,
    curriculumVersion: course.curriculumVersion,
  };
}

export function buildStageOfflinePack(course: Course, stageId: string, kind: OfflinePackKind = 'standard'): OfflinePack | undefined {
  const stage = course.stages.find((item) => item.id === stageId);
  if (!stage) return undefined;
  const chapterPacks = stage.chapterIds
    .map((chapterId) => buildChapterOfflinePack(course, chapterId, kind))
    .filter((pack): pack is OfflinePack => Boolean(pack));
  const includes = [...new Set(chapterPacks.flatMap((pack) => pack.includes))];
  return {
    id: `${course.id}:${stage.id}:${kind}:v${course.curriculumVersion}`,
    courseId: course.id,
    kind,
    chapterIds: stage.chapterIds,
    estimatedMb: chapterPacks.reduce((sum, pack) => sum + pack.estimatedMb, 0),
    includes,
    curriculumVersion: course.curriculumVersion,
  };
}

export function offlineUpdatePlan(installed: OfflinePack[], courses: Course[]) {
  const byCourse = new Map(courses.map((course) => [course.id, course]));
  return installed.map((pack) => {
    const course = byCourse.get(pack.courseId);
    if (!course) return { packId: pack.id, action: 'remove' as const, reason: 'Parcours introuvable dans ce curriculum.' };
    if (pack.curriculumVersion < course.curriculumVersion) {
      return { packId: pack.id, action: 'update' as const, reason: `Curriculum v${pack.curriculumVersion} → v${course.curriculumVersion}.` };
    }
    return { packId: pack.id, action: 'keep' as const, reason: 'Pack à jour.' };
  });
}

export function estimateOfflineStorage(packs: OfflinePack[]) {
  const unique = new Map(packs.map((pack) => [pack.id, pack]));
  return [...unique.values()].reduce((sum, pack) => sum + pack.estimatedMb, 0);
}
