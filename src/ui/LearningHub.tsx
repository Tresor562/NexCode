import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Course, Lesson } from '../data/curriculumCore';
import { buildSkillGraph } from '../learning/skillGraph';
import { buildAdaptivePool, planPracticeSession, PracticeMode, recommendedSessionMessage } from '../learning/adaptivePractice';
import { courseNavigationSummary } from '../learning/learningNavigator';
import { OfflinePackKind } from '../learning/offlineEngine';
import { learningCompletionReward } from '../learning/sessionEngine';
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

const SESSION_OPTIONS = [5, 10, 20] as const;
type SessionMinutes = typeof SESSION_OPTIONS[number];

const modeLabels: Record<PracticeMode, string> = {
  learn: 'Nouvelle notion',
  repair: 'Réparation ciblée',
  review: 'Révision espacée',
  interleave: 'Consolidation',
  lab: 'Passage au Lab',
  checkpoint: 'Checkpoint',
};

function modeTone(mode: PracticeMode): 'primary' | 'success' | 'warning' | undefined {
  if (mode === 'repair') return 'warning';
  if (mode === 'review' || mode === 'interleave') return 'success';
  return 'primary';
}

function lessonExperienceLabels(lesson: Lesson) {
  const labels: string[] = [];
  if (lesson.retrievalPrompt) labels.push('Rappel actif');
  if (lesson.transferPrompt) labels.push('Transfert');
  if (lesson.labMission) labels.push('Lab guidé');
  const exerciseCount = lesson.exercises?.length ?? 0;
  if (exerciseCount > 1) labels.push(`${exerciseCount} défis`);
  return labels.slice(0, 3);
}

function DailyMomentumCard({ state }: { state: LocalState }) {
  const goal = Math.max(1, state.dailyGoal);
  const completed = Math.max(0, Math.min(goal, state.dailyCompleted));
  const progress = Math.round((completed / goal) * 100);
  const remaining = Math.max(0, goal - completed);
  const goalReached = completed >= goal;

  return (
    <GlassCard style={styles.momentumCard}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.momentumKicker}>ÉLAN DU JOUR</Text>
          <Text style={styles.momentumTitle}>{goalReached ? 'Objectif atteint. Garde le rythme.' : `${remaining} min pour ton objectif.`}</Text>
        </View>
        <View style={styles.streakBadge} accessibilityLabel={`Série actuelle : ${state.streak} jours`}>
          <Text style={styles.streakIcon}>◆</Text>
          <Text style={styles.streakValue}>{state.streak}</Text>
          <Text style={styles.streakUnit}>j</Text>
        </View>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Progression de l'objectif quotidien"
        accessibilityValue={{ min: 0, max: goal, now: completed, text: `${completed} minutes sur ${goal}` }}
        style={styles.momentumProgress}
      >
        <View style={styles.momentumProgressHeader}>
          <Text style={styles.momentumProgressLabel}>{completed} / {goal} min</Text>
          <Text style={styles.momentumProgressValue}>{progress}%</Text>
        </View>
        <ProgressBar value={progress} />
      </View>

      <View style={styles.momentumStats}>
        <View style={styles.momentumStat}>
          <Text style={styles.momentumStatValue}>{state.xp}</Text>
          <Text style={styles.momentumStatLabel}>XP</Text>
        </View>
        <View style={styles.momentumStatDivider} />
        <View style={styles.momentumStat}>
          <Text style={styles.momentumStatValue}>{state.nexCoins}</Text>
          <Text style={styles.momentumStatLabel}>NexCoins</Text>
        </View>
        <View style={styles.momentumStatDivider} />
        <View style={styles.momentumStat}>
          <Text style={styles.momentumStatValue}>{state.bestStreak}</Text>
          <Text style={styles.momentumStatLabel}>record série</Text>
        </View>
        <View style={styles.momentumStatDivider} />
        <View style={styles.momentumStat}>
          <Text style={styles.momentumStatValue}>{state.totalLearningMinutes}</Text>
          <Text style={styles.momentumStatLabel}>min apprises</Text>
        </View>
      </View>

      {goalReached ? (
        <View style={styles.goalRewardRow} accessibilityLabel="Bonus quotidien obtenu : 40 XP et 20 NexCoins">
          <Pill label="Bonus obtenu" tone="success" />
          <Text style={styles.goalRewardText}>+40 XP · +20 NexCoins</Text>
        </View>
      ) : (
        <Text style={styles.momentumHint}>Termine ton objectif pour débloquer +40 XP et +20 NexCoins aujourd’hui.</Text>
      )}
    </GlassCard>
  );
}

function SessionLengthPicker({ value, onChange }: { value: SessionMinutes; onChange: (minutes: SessionMinutes) => void }) {
  return (
    <View style={styles.sessionLengthCard} accessibilityRole="radiogroup" accessibilityLabel="Durée de la session recommandée">
      <View style={styles.flex}>
        <Text style={styles.sessionLengthKicker}>TEMPS DISPONIBLE</Text>
        <Text style={styles.sessionLengthHint}>Nex adapte la séance à ton temps réel.</Text>
      </View>
      <View style={styles.sessionLengthOptions}>
        {SESSION_OPTIONS.map((minutes) => {
          const selected = minutes === value;
          return (
            <Pressable
              key={minutes}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${minutes} minutes`}
              onPress={() => onChange(minutes)}
              hitSlop={6}
              style={({ pressed }) => [styles.sessionLengthOption, selected && styles.sessionLengthOptionSelected, pressed && styles.sessionLengthOptionPressed]}
            >
              <Text style={[styles.sessionLengthOptionText, selected && styles.sessionLengthOptionTextSelected]}>{minutes} min</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function LearningHub({ courses, state, onOpenLesson, onToggleChapterOffline }: LearningHubProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(state.recentCourseId ?? null);
  const [sessionMinutes, setSessionMinutes] = useState<SessionMinutes>(10);
  const graph = useMemo(() => buildSkillGraph(courses), [courses]);
  const pool = useMemo(() => buildAdaptivePool(courses, graph, state.mastery, state.completedLessons), [courses, graph, state.mastery, state.completedLessons]);
  const session = useMemo(() => planPracticeSession(pool, sessionMinutes), [pool, sessionMinutes]);
  const selected = courses.find((course) => course.id === selectedCourseId) ?? null;

  if (selected) {
    return (
      <CourseJourney
        course={selected}
        state={state}
        onBack={() => setSelectedCourseId(null)}
        onOpenLesson={(lesson) => onOpenLesson(selected, lesson)}
        onToggleChapterOffline={(chapterId, kind) => onToggleChapterOffline(selected.id, chapterId, kind)}
      />
    );
  }

  const recommended = session.activities[0];
  const recommendedCourse = recommended ? courses.find((course) => course.id === recommended.courseId) : undefined;
  const recommendedLesson = recommendedCourse?.starterLessons.find((lesson) => lesson.id === recommended?.lessonId);
  const recommendedReward = recommendedLesson ? learningCompletionReward(recommendedLesson) : null;
  const recommendedExperiences = recommendedLesson ? lessonExperienceLabels(recommendedLesson) : [];
  const sessionMessage = recommendedSessionMessage(session);
  const recentCourse = courses.find((course) => course.id === state.recentCourseId) ?? courses[0];

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

      <DailyMomentumCard state={state} />
      <SessionLengthPicker value={sessionMinutes} onChange={setSessionMinutes} />

      {recommendedCourse && recommendedLesson && recommended && recommendedReward ? (
        <Card tone="primary" style={styles.recommended}>
          <View style={styles.rowBetween}>
            <View style={styles.recommendationPills}>
              <Pill label="Prochaine étape" tone="primary" />
              <Pill label={modeLabels[recommended.mode]} tone={modeTone(recommended.mode)} />
            </View>
            <Text style={styles.mini}>{session.estimatedMinutes || sessionMinutes} min</Text>
          </View>
          <Text style={styles.recommendedTitle}>{recommendedLesson.title}</Text>
          <Text style={styles.meta}>{recommendedCourse.title} • +{recommendedReward.xp} XP • +{recommendedReward.nexCoins} NexCoins</Text>
          {recommendedExperiences.length > 0 ? (
            <View style={styles.recommendationPills} accessibilityLabel={`Expérience pédagogique : ${recommendedExperiences.join(', ')}`}>
              {recommendedExperiences.map((label) => <Pill key={label} label={label} tone="success" />)}
            </View>
          ) : null}
          <View style={styles.whyCard}>
            <Text style={styles.whyKicker}>POURQUOI NEX TE PROPOSE ÇA</Text>
            <Text style={styles.whyText}>{recommended.reason}</Text>
            <Text style={styles.sessionText}>{sessionMessage}</Text>
          </View>
          <View style={styles.sessionStats}>
            <View style={styles.sessionStat}>
              <Text style={styles.sessionStatValue}>{session.activities.length}</Text>
              <Text style={styles.sessionStatLabel}>activité{session.activities.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.sessionStatDivider} />
            <View style={styles.sessionStat}>
              <Text style={styles.sessionStatValue}>{session.skillCoverage.length}</Text>
              <Text style={styles.sessionStatLabel}>compétence{session.skillCoverage.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.sessionStatDivider} />
            <View style={styles.sessionStat}>
              <Text style={styles.sessionStatValue}>{session.courseCoverage.length}</Text>
              <Text style={styles.sessionStatLabel}>parcours</Text>
            </View>
          </View>
          <PrimaryButton icon="▶" label={recommended.mode === 'repair' ? 'Réparer cette notion' : recommended.mode === 'review' ? 'Faire la révision' : 'Continuer'} onPress={() => onOpenLesson(recommendedCourse, recommendedLesson)} />
        </Card>
      ) : (
        <Card style={styles.emptySessionCard}>
          <View style={styles.rowBetween}>
            <Pill label="Séance à ajuster" tone="warning" />
            <Text style={styles.mini}>{sessionMinutes} min</Text>
          </View>
          <Text style={styles.emptySessionTitle}>Ton créneau est trop court pour la prochaine étape.</Text>
          <Text style={styles.emptySessionText}>{sessionMessage}</Text>
          <Text style={styles.emptySessionHint}>Nex préfère te faire choisir un créneau réaliste plutôt que de cacher une réparation importante ou de te pousser une nouvelle notion trop tôt.</Text>
          <PrimaryButton
            icon="↗"
            label={sessionMinutes < 20 ? 'Passer à 20 min' : 'Voir le parcours'}
            onPress={() => sessionMinutes < 20 ? setSessionMinutes(20) : recentCourse && setSelectedCourseId(recentCourse.id)}
          />
        </Card>
      )}

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

function CourseJourney({ course, state, onBack, onOpenLesson, onToggleChapterOffline }: { course: Course; state: LocalState; onBack: () => void; onOpenLesson: (lesson: Lesson) => void; onToggleChapterOffline: (chapterId: string, kind: OfflinePackKind) => void }) {
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

      <SectionHeader title="Disponible hors ligne" action={`${state.downloadedChapters.filter((chapterId) => course.chapters.some((chapter) => chapter.id === chapterId)).length}/${course.chapters.length}`} />
      <View style={styles.offlineList}>
        {course.chapters.slice(0, 4).map((chapter) => {
          const installedPack = state.installedOfflinePacks.find((pack) => pack.courseId === course.id && pack.chapterIds.includes(chapter.id));
          const installed = Boolean(installedPack);
          const installedKind = installedPack?.kind;
          return (
            <Card key={chapter.id} style={styles.offlineCard}>
              <View style={styles.rowBetween}>
                <View style={styles.offlineCopy}>
                  <Text style={styles.offlineTitle} numberOfLines={1}>{chapter.title}</Text>
                  <Text style={styles.offlineMeta}>{chapter.estimatedMinutes} min · {chapter.lessonIds.length} étapes</Text>
                </View>
                <Pill label={installed ? (installedKind === 'light' ? 'Light' : 'Complet') : 'Cloud'} tone={installed ? 'success' : undefined} />
              </View>
              <View style={styles.offlineActions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Télécharger ${chapter.title} en pack léger`} onPress={() => onToggleChapterOffline(chapter.id, 'light')} style={({ pressed }) => [styles.offlineAction, pressed && styles.pressed]}>
                  <Text style={styles.offlineActionText}>{installedKind === 'light' ? 'Retirer Light' : 'Pack Light'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Télécharger ${chapter.title} en pack complet`} onPress={() => onToggleChapterOffline(chapter.id, 'full')} style={({ pressed }) => [styles.offlineAction, pressed && styles.pressed]}>
                  <Text style={styles.offlineActionText}>{installedKind === 'full' ? 'Retirer complet' : 'Pack complet'}</Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>

      <SectionHeader title="Chemin d’apprentissage" action={`${lessons.length} étapes`} />
      <View style={styles.pathWrap}>
        {lessons.map((lesson, index) => {
          const isCompleted = state.completedLessons.includes(lesson.id);
          const unlocked = index <= firstIncompleteIndex || isCompleted;
          const next = !isCompleted && index === firstIncompleteIndex;
          const nodeState: LearningPathNodeState = isCompleted ? 'completed' : next ? 'next' : unlocked ? 'available' : 'locked';
          return (
            <LearningPathNode
              key={lesson.id}
              lesson={lesson}
              index={index}
              state={nodeState}
              courseColor={course.color}
              onPress={() => unlocked && onOpenLesson(lesson)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.lg, marginBottom: theme.space.lg },
  eyebrow: { fontSize: theme.type.micro, fontWeight: '900', letterSpacing: 1.6, color: theme.colors.primary },
  title: { fontSize: theme.type.display, lineHeight: 38, fontWeight: '900', color: theme.colors.text, marginTop: 4 },
  lead: { fontSize: theme.type.body, lineHeight: 21, color: theme.colors.muted, marginTop: 8 },
  nexOrb: { width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  nexFace: { flexDirection: 'row', gap: 8, marginBottom: 5 },
  nexEye: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.primary },
  nexLabel: { fontSize: theme.type.micro, fontWeight: '900', letterSpacing: 1.2, color: theme.colors.primary },
  momentumCard: { marginBottom: theme.space.md },
  momentumKicker: { fontSize: theme.type.micro, fontWeight: '900', letterSpacing: 1.2, color: theme.colors.success },
  momentumTitle: { fontSize: theme.type.h3, lineHeight: 23, fontWeight: '900', color: theme.colors.text, marginTop: 4 },
  streakBadge: { flexDirection: 'row', alignItems: 'baseline', gap: 3, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  streakIcon: { fontSize: 12, color: theme.colors.warning },
  streakValue: { fontSize: theme.type.h3, fontWeight: '900', color: theme.colors.text },
  streakUnit: { fontSize: theme.type.caption, fontWeight: '800', color: theme.colors.muted },
  momentumProgress: { marginTop: theme.space.md },
  momentumProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  momentumProgressLabel: { fontSize: theme.type.caption, fontWeight: '800', color: theme.colors.text },
  momentumProgressValue: { fontSize: theme.type.caption, fontWeight: '900', color: theme.colors.success },
  momentumStats: { flexDirection: 'row', alignItems: 'stretch', marginTop: theme.space.md, paddingTop: theme.space.md, borderTopWidth: 1, borderTopColor: theme.colors.border },
  momentumStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  momentumStatValue: { fontSize: theme.type.h3, fontWeight: '900', color: theme.colors.text },
  momentumStatLabel: { fontSize: theme.type.micro, lineHeight: 14, fontWeight: '700', color: theme.colors.muted, marginTop: 3, textAlign: 'center' },
  momentumStatDivider: { width: 1, backgroundColor: theme.colors.border },
  goalRewardRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, marginTop: theme.space.md },
  goalRewardText: { fontSize: theme.type.caption, fontWeight: '900', color: theme.colors.success },
  momentumHint: { fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted, marginTop: theme.space.md },
  sessionLengthCard: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: theme.space.md, marginBottom: theme.space.md },
  sessionLengthKicker: { fontSize: theme.type.micro, fontWeight: '900', letterSpacing: 1.1, color: theme.colors.muted },
  sessionLengthHint: { fontSize: theme.type.caption, lineHeight: 17, color: theme.colors.muted, marginTop: 3 },
  sessionLengthOptions: { flexDirection: 'row', gap: 6 },
  sessionLengthOption: { minHeight: 44, minWidth: 54, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  sessionLengthOptionSelected: { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.primarySoft },
  sessionLengthOptionPressed: { opacity: 0.72 },
  sessionLengthOptionText: { fontSize: theme.type.caption, fontWeight: '900', color: theme.colors.muted },
  sessionLengthOptionTextSelected: { color: theme.colors.primary },
  recommended: { marginBottom: theme.space.lg },
  recommendationPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  recommendedTitle: { fontSize: theme.type.h2, lineHeight: 28, fontWeight: '900', color: theme.colors.text, marginTop: theme.space.md },
  meta: { fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 7, marginBottom: theme.space.sm },
  mini: { fontSize: theme.type.caption, fontWeight: '800', color: theme.colors.muted },
  whyCard: { borderRadius: theme.radius.md, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primaryBorder, padding: theme.space.md, marginVertical: theme.space.md },
  whyKicker: { fontSize: theme.type.micro, fontWeight: '900', letterSpacing: 1.1, color: theme.colors.primary },
  whyText: { fontSize: theme.type.body, lineHeight: 21, fontWeight: '700', color: theme.colors.text, marginTop: 5 },
  sessionText: { fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted, marginTop: 6 },
  sessionStats: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.space.md, marginBottom: theme.space.md },
  sessionStat: { flex: 1, alignItems: 'center' },
  sessionStatValue: { fontSize: theme.type.h3, fontWeight: '900', color: theme.colors.text },
  sessionStatLabel: { fontSize: theme.type.micro, color: theme.colors.muted, fontWeight: '700', marginTop: 2 },
  sessionStatDivider: { width: 1, backgroundColor: theme.colors.border },
  emptySessionCard: { marginBottom: theme.space.lg },
  emptySessionTitle: { fontSize: theme.type.h3, lineHeight: 23, fontWeight: '900', color: theme.colors.text, marginTop: theme.space.md },
  emptySessionText: { fontSize: theme.type.body, lineHeight: 21, color: theme.colors.text, marginTop: 8 },
  emptySessionHint: { fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.muted, marginTop: 8, marginBottom: theme.space.md },
  courseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  courseTile: { width: '48%', minHeight: 154, padding: theme.space.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, gap: 9 },
  courseBadge: { width: 40, height: 40, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  courseBadgeSmall: { width: 40, height: 40, borderRadius: theme.radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  courseBadgeText: { fontSize: 20, fontWeight: '900' },
  courseTitle: { fontSize: theme.type.body, lineHeight: 20, fontWeight: '900', color: theme.colors.text },
  courseMeta: { fontSize: theme.type.caption, color: theme.colors.muted },
  pressed: { opacity: 0.72 },
  journeyHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.space.md, marginBottom: theme.space.md },
  backButton: { width: 48, height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 30, lineHeight: 34, color: theme.colors.text },
  journeyKicker: { fontSize: theme.type.micro, letterSpacing: 1.1, fontWeight: '900', color: theme.colors.muted },
  journeyTitle: { fontSize: theme.type.h2, lineHeight: 28, fontWeight: '900', color: theme.colors.text, marginTop: 2 },
  progressLabel: { fontSize: theme.type.body, fontWeight: '900', color: theme.colors.text },
  progressHint: { fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 3, marginBottom: theme.space.md },
  progressValue: { fontSize: theme.type.h2, fontWeight: '900', color: theme.colors.primary },
  offlineList: { gap: theme.space.sm },
  offlineCard: { gap: theme.space.sm },
  offlineCopy: { flex: 1, paddingRight: theme.space.sm },
  offlineTitle: { fontSize: theme.type.body, fontWeight: '900', color: theme.colors.text },
  offlineMeta: { fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 3 },
  offlineActions: { flexDirection: 'row', gap: 8 },
  offlineAction: { flex: 1, minHeight: 44, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  offlineActionText: { fontSize: theme.type.caption, fontWeight: '800', color: theme.colors.text },
  pathWrap: { paddingVertical: theme.space.md, paddingHorizontal: 4 },
});
