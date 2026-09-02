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

const VALID_PACK_KINDS: OfflinePackKind[] = ['lite', 'standard', 'full'];
const VALID_INCLUDES = new Set<OfflinePack['includes'][number]>(['content', 'examples', 'exercise-assets', 'lab-starters', 'media']);

function chapterWeight(course: Course, chapter: Chapter) {
  const fraction = course.starterLessons.length ? chapter.lessonIds.length / course.starterLessons.length : 0;
  return Math.max(1, Math.round(course.offlineSizeMb * fraction));
}

function packIncludes(kind: OfflinePackKind): OfflinePack['includes'] {
  return kind === 'lite'
    ? ['content', 'examples']
    : kind === 'standard'
      ? ['content', 'examples', 'exercise-assets', 'lab-starters']
      : ['content', 'examples', 'exercise-assets', 'lab-starters', 'media'];
}

export function buildChapterOfflinePack(course: Course, chapterId: string, kind: OfflinePackKind = 'standard'): OfflinePack | undefined {
  const chapter = course.chapters.find((item) => item.id === chapterId);
  if (!chapter) return undefined;
  const base = chapterWeight(course, chapter);
  const multiplier = kind === 'lite' ? 0.55 : kind === 'full' ? 1.35 : 1;
  return {
    id: `${course.id}:${chapter.id}:${kind}:v${course.curriculumVersion}`,
    courseId: course.id,
    kind,
    chapterIds: [chapter.id],
    estimatedMb: Math.max(1, Math.round(base * multiplier)),
    includes: packIncludes(kind),
    curriculumVersion: course.curriculumVersion,
  };
}

export function buildStageOfflinePack(course: Course, stageId: string, kind: OfflinePackKind = 'standard'): OfflinePack | undefined {
  const stage = course.stages.find((item) => item.id === stageId);
  if (!stage) return undefined;

  const chapterIds = [...new Set(stage.chapterIds)];
  if (!chapterIds.length) return undefined;

  const chapterPacks = chapterIds.map((chapterId) => buildChapterOfflinePack(course, chapterId, kind));
  if (chapterPacks.some((pack) => !pack)) return undefined;

  const validChapterPacks = chapterPacks.filter((pack): pack is OfflinePack => Boolean(pack));
  return {
    id: `${course.id}:${stage.id}:${kind}:v${course.curriculumVersion}`,
    courseId: course.id,
    kind,
    chapterIds,
    estimatedMb: validChapterPacks.reduce((sum, pack) => sum + pack.estimatedMb, 0),
    includes: packIncludes(kind),
    curriculumVersion: course.curriculumVersion,
  };
}

export function offlinePackIntegrityIssue(pack: OfflinePack): string | undefined {
  if (!pack.id || !pack.courseId) return 'Identité du pack invalide.';
  if (!VALID_PACK_KINDS.includes(pack.kind)) return 'Variante de pack inconnue.';
  if (!Number.isInteger(pack.curriculumVersion) || pack.curriculumVersion < 1) return 'Version de curriculum invalide.';
  if (!Number.isFinite(pack.estimatedMb) || pack.estimatedMb <= 0) return 'Taille du pack invalide.';
  if (!Array.isArray(pack.chapterIds) || !pack.chapterIds.length) return 'Pack sans chapitre.';
  if (pack.chapterIds.some((chapterId) => !chapterId || typeof chapterId !== 'string')) return 'Identifiant de chapitre invalide.';
  if (new Set(pack.chapterIds).size !== pack.chapterIds.length) return 'Pack avec chapitres dupliqués.';
  if (!Array.isArray(pack.includes) || !pack.includes.length) return 'Pack sans contenu exploitable.';
  if (pack.includes.some((entry) => !VALID_INCLUDES.has(entry))) return 'Type de contenu hors-ligne inconnu.';
  return undefined;
}

export function offlineUpdatePlan(installed: OfflinePack[], courses: Course[]) {
  const byCourse = new Map(courses.map((course) => [course.id, course]));
  return installed.map((pack) => {
    const integrityIssue = offlinePackIntegrityIssue(pack);
    if (integrityIssue) return { packId: pack.id, action: 'remove' as const, reason: integrityIssue };

    const course = byCourse.get(pack.courseId);
    if (!course) return { packId: pack.id, action: 'remove' as const, reason: 'Parcours introuvable dans ce curriculum.' };

    const knownChapterIds = new Set(course.chapters.map((chapter) => chapter.id));
    const hasUnknownChapter = pack.chapterIds.some((chapterId) => !knownChapterIds.has(chapterId));
    if (hasUnknownChapter) {
      return { packId: pack.id, action: 'update' as const, reason: 'Structure du parcours modifiée : reconstruction du pack requise.' };
    }

    if (pack.curriculumVersion !== course.curriculumVersion) {
      return {
        packId: pack.id,
        action: 'update' as const,
        reason: `Curriculum v${pack.curriculumVersion} → v${course.curriculumVersion}.`,
      };
    }

    return { packId: pack.id, action: 'keep' as const, reason: 'Pack à jour.' };
  });
}

export function estimateOfflineStorage(packs: OfflinePack[]) {
  const unique = new Map(packs.map((pack) => [pack.id, pack]));
  return [...unique.values()].reduce((sum, pack) => {
    if (offlinePackIntegrityIssue(pack)) return sum;
    return sum + pack.estimatedMb;
  }, 0);
}
