import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Course, Lesson } from '../data/curriculumCore';
import { buildSkillGraph } from '../learning/skillGraph';
import { buildAdaptivePool, planPracticeSession } from '../learning/adaptivePractice';
import { courseNavigationSummary } from '../learning/learningNavigator';
import { OfflinePackKind } from '../learning/offlineEngine';
import { LocalState } from '../lib/localState';
import { Card, GlassCard, Pill, PrimaryButton, ProgressBar, SectionHeader } from './components';
import { LearningPathNode, LearningPathNodeState } from './LearningPathNode';
import { theme } from './theme';

export type LearningHubProps = {
  courses: Course[];
  state: LocalState;
  onOpenLesson: (course: Course, lesson: Lesson) => void;
  onToggleChapterOffline: (courseId: string, chapterId: string, kind: OfflinePackKind) => void;
};

export function LearningHub({ courses, state, onOpenLesson }: LearningHubProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(state.recentCourseId ?? null);
  const graph = useMemo(() => buildSkillGraph(courses), [courses]);
  const pool = useMemo(() => buildAdaptivePool(courses, graph, state.mastery, state.completedLessons), [courses, graph, state.mastery, state.completedLessons]);
  const session = useMemo(() => planPracticeSession(pool, 10), [pool]);
  const selected = courses.find((course) => course.id === selectedCourseId) ?? null;

  if (selected) {
    return (
      <CourseJourney
        course={selected}
        state={state}
        onBack={() => setSelectedCourseId(null)}
        onOpenLesson={(lesson) => onOpenLesson(selected, lesson)}
      />
    );
  }

  const recommended = session.activities[0];
  const recommendedCourse = recommended ? courses.find((course) => course.id === recommended.courseId) : undefined;
  const recommendedLesson = recommendedCourse?.starterLessons.find((lesson) => lesson.id === recommended?.lessonId);

  return (
    <View>
      <View style={styles.heroRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>APPRENDRE</Text>
          <Text style={styles.title}>Continue ton chemin.</Text>
          <Text style={styles.lead}>Une étape courte, du vrai code, puis un projet qui prouve ce que tu sais faire.</Text>
        </View>
        <View style={styles.nexOrb} accessibilityLabel="Nex, mentor NexCode">
          <View style={styles.nexFace}>
            <View style={styles.nexEye} />
            <View style={styles.nexEye} />
          </View>
          <Text style={styles.nexLabel}>NEX</Text>
        </View>
      </View>

      {recommendedCourse && recommendedLesson ? (
        <Card tone="primary" style={styles.recommended}>
          <View style={styles.rowBetween}>
            <Pill label="Prochaine étape" tone="primary" />
            <Text style={styles.mini}>{session.estimatedMinutes || 10} min</Text>
          </View>
          <Text style={styles.recommendedTitle}>{recommendedLesson.title}</Text>
          <Text style={styles.meta}>{recommendedCourse.title} • +12 XP</Text>
          <PrimaryButton icon="▶" label="Continuer" onPress={() => onOpenLesson(recommendedCourse, recommendedLesson)} />
        </Card>
      ) : null}

      <SectionHeader title="Parcours" action={`${courses.length}`} />
      <View style={styles.courseGrid}>
        {courses.map((course) => {
          const summary = courseNavigationSummary(course, state.completedLessons, state.mastery);
          return (
            <Pressable
              key={course.id}
              accessibilityRole="button"
              accessibilityLabel={`Ouvrir ${course.title}`}
              onPress={() => setSelectedCourseId(course.id)}
              style={({ pressed }) => [styles.courseTile, pressed && styles.pressed]}
            >
              <View style={[styles.courseBadge, { borderColor: `${course.color}66`, backgroundColor: `${course.color}12` }]}>
                <Text style={[styles.courseBadgeText, { color: course.color }]}>{course.icon}</Text>
              </View>
              <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
              <Text style={styles.courseMeta}>{summary.progress}% terminé</Text>
              <ProgressBar value={summary.progress} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CourseJourney({ course, state, onBack, onOpenLesson }: { course: Course; state: LocalState; onBack: () => void; onOpenLesson: (lesson: Lesson) => void }) {
  const summary = courseNavigationSummary(course, state.completedLessons, state.mastery);
  const ordered = course.chapters.flatMap((chapter) => chapter.lessonIds.map((id) => course.starterLessons.find((lesson) => lesson.id === id)).filter((lesson): lesson is Lesson => Boolean(lesson)));
  const fallback = course.starterLessons.filter((lesson) => !ordered.some((item) => item.id === lesson.id));
  const lessons = [...ordered, ...fallback];
  const rawIncompleteIndex = lessons.findIndex((lesson) => !state.completedLessons.includes(lesson.id));
  const firstIncompleteIndex = rawIncompleteIndex === -1 ? Math.max(0, lessons.length - 1) : rawIncompleteIndex;

  return (
    <View>
      <View style={styles.journeyHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour aux parcours" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.journeyKicker}>{course.category.toUpperCase()}</Text>
          <Text style={styles.journeyTitle}>{course.title}</Text>
        </View>
        <View style={[styles.courseBadgeSmall, { borderColor: `${course.color}66` }]}>
          <Text style={[styles.courseBadgeText, { color: course.color }]}>{course.icon}</Text>
        </View>
      </View>

      <GlassCard>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.progressLabel}>Progression du parcours</Text>
            <Text style={styles.progressHint}>{state.completedLessons.filter((id) => lessons.some((lesson) => lesson.id === id)).length} étapes terminées</Text>
          </View>
          <Text style={styles.progressValue}>{summary.progress}%</Text>
        </View>
        <ProgressBar value={summary.progress} />
      </GlassCard>

      <View style={styles.pathIntro}>
        <View style={styles.pathIntroLine} />
        <Text style={styles.pathHint}>AVANCE ÉTAPE PAR ÉTAPE</Text>
        <View style={styles.pathIntroLine} />
      </View>

      <View style={styles.path}>
        {lessons.slice(0, 28).map((lesson, index) => {
          const done = state.completedLessons.includes(lesson.id);
          const current = index === firstIncompleteIndex && !done;
          const locked = index > firstIncompleteIndex + 2;
          const offset = index % 6 === 1 ? 32 : index % 6 === 2 ? 72 : index % 6 === 3 ? 92 : index % 6 === 4 ? 58 : index % 6 === 5 ? 18 : 0;
          const kindIcon = lesson.activityKind === 'lab' ? '</>' : lesson.activityKind === 'checkpoint' ? '★' : lesson.exercises?.some((exercise) => exercise.kind === 'debug') ? '!' : '›';
          const nodeState: LearningPathNodeState = done ? 'done' : current ? 'current' : locked ? 'locked' : 'available';

          return (
            <LearningPathNode
              key={lesson.id}
              title={lesson.title}
              meta={`${lesson.durationMin ?? 5} min • ${lesson.activityKind ?? 'leçon'}`}
              icon={kindIcon}
              state={nodeState}
              offset={offset}
              showConnector={index < Math.min(lessons.length, 28) - 1}
              onPress={() => onOpenLesson(lesson)}
            />
          );
        })}
      </View>

      {lessons.length > 28 ? (
        <Card style={styles.moreCard}>
          <Text style={styles.moreTitle}>+ {lessons.length - 28} étapes dans ce parcours</Text>
          <Text style={styles.meta}>Elles apparaîtront au fur et à mesure de ta progression.</Text>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: 8 },
  eyebrow: { color: '#98A5FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 8 },
  title: { color: theme.colors.text, fontSize: 30, fontWeight: '900', lineHeight: 35, letterSpacing: -.7 },
  lead: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  nexOrb: { width: 72, height: 72, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(109,124,255,.14)', borderWidth: 1, borderColor: 'rgba(177,187,255,.26)' },
  nexFace: { width: 38, height: 26, borderRadius: 12, borderWidth: 2, borderColor: '#BAC3FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(9,14,25,.86)' },
  nexEye: { width: 5, height: 7, borderRadius: 99, backgroundColor: '#7FE5FF' },
  nexLabel: { color: '#B9C1FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 5 },
  recommended: { marginTop: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  mini: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800' },
  recommendedTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900', lineHeight: 25, marginTop: 15 },
  meta: { color: theme.colors.textMuted, fontSize: 10.5, lineHeight: 16, marginTop: 4, marginBottom: 13 },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  courseTile: { width: '48.4%', minHeight: 156, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,.07)', padding: 13 },
  courseBadge: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  courseBadgeSmall: { width: 43, height: 43, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.035)' },
  courseBadgeText: { fontSize: 13, fontWeight: '900' },
  courseTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '900', lineHeight: 18, marginTop: 13, minHeight: 36 },
  courseMeta: { color: theme.colors.textMuted, fontSize: 9.5, fontWeight: '700', marginBottom: 8 },
  pressed: { opacity: .76, transform: [{ scale: .985 }] },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8, marginBottom: 14 },
  backButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,.08)' },
  backIcon: { color: theme.colors.text, fontSize: 26, fontWeight: '700', marginTop: -2 },
  journeyKicker: { color: '#98A5FF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  journeyTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '900', lineHeight: 27, marginTop: 2 },
  progressLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 3 },
  progressHint: { color: theme.colors.textMuted, fontSize: 9.5, fontWeight: '700', marginBottom: 10 },
  progressValue: { color: '#B7C0FF', fontSize: 18, fontWeight: '900', marginBottom: 9 },
  pathIntro: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 18 },
  pathIntroLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,.07)' },
  pathHint: { color: theme.colors.textMuted, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.2 },
  path: { paddingBottom: 16, paddingHorizontal: 8, overflow: 'hidden' },
  moreCard: { marginTop: 4 },
  moreTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '900' },
});
