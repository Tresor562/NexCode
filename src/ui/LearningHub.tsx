import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Course, Lesson } from '../data/curriculumCore';
import { buildSkillGraph } from '../learning/skillGraph';
import { buildAdaptivePool, planPracticeSession } from '../learning/adaptivePractice';
import { courseNavigationSummary } from '../learning/learningNavigator';
import { OfflinePackKind } from '../learning/offlineEngine';
import { LocalState } from '../lib/localState';
import { Card, GlassCard, Pill, PrimaryButton, ProgressBar, SectionHeader } from './components';
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

  if (selected) return <CourseJourney course={selected} state={state} onBack={() => setSelectedCourseId(null)} onOpenLesson={(lesson) => onOpenLesson(selected, lesson)} />;

  const recommended = session.activities[0];
  const recommendedCourse = recommended ? courses.find((course) => course.id === recommended.courseId) : undefined;
  const recommendedLesson = recommendedCourse?.starterLessons.find((lesson) => lesson.id === recommended?.lessonId);

  return (
    <View>
      <Text style={styles.eyebrow}>APPRENDRE</Text>
      <Text style={styles.title}>Choisis ton chemin.</Text>
      <Text style={styles.lead}>Des petites étapes, du code à chaque niveau, un vrai projet à la fin.</Text>

      {recommendedCourse && recommendedLesson ? (
        <Card tone="primary" style={styles.recommended}>
          <View style={styles.rowBetween}><Pill label="Pour toi" tone="primary" /><Text style={styles.mini}>{session.estimatedMinutes || 10} min</Text></View>
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
            <Pressable key={course.id} onPress={() => setSelectedCourseId(course.id)} style={({ pressed }) => [styles.courseTile, pressed && styles.pressed]}>
              <View style={[styles.courseBadge, { borderColor: `${course.color}66`, backgroundColor: `${course.color}12` }]}><Text style={[styles.courseBadgeText, { color: course.color }]}>{course.icon}</Text></View>
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
  const firstIncompleteIndex = Math.max(0, lessons.findIndex((lesson) => !state.completedLessons.includes(lesson.id)));

  return (
    <View>
      <View style={styles.journeyHeader}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backIcon}>‹</Text></Pressable>
        <View style={styles.flex}><Text style={styles.journeyKicker}>{course.category.toUpperCase()}</Text><Text style={styles.journeyTitle}>{course.title}</Text></View>
        <View style={[styles.courseBadgeSmall, { borderColor: `${course.color}66` }]}><Text style={[styles.courseBadgeText, { color: course.color }]}>{course.icon}</Text></View>
      </View>
      <GlassCard>
        <View style={styles.rowBetween}><Text style={styles.progressLabel}>Progression</Text><Text style={styles.progressValue}>{summary.progress}%</Text></View>
        <ProgressBar value={summary.progress} />
      </GlassCard>

      <Text style={styles.pathHint}>Chaque étape prend quelques minutes.</Text>
      <View style={styles.path}>
        {lessons.slice(0, 28).map((lesson, index) => {
          const done = state.completedLessons.includes(lesson.id);
          const current = index === firstIncompleteIndex;
          const locked = index > firstIncompleteIndex + 2;
          const offset = index % 4 === 1 ? 38 : index % 4 === 2 ? 70 : index % 4 === 3 ? 34 : 0;
          const kindIcon = lesson.activityKind === 'lab' ? '</>' : lesson.activityKind === 'checkpoint' ? '★' : lesson.exercises?.some((exercise) => exercise.kind === 'debug') ? '!' : '›';
          return (
            <View key={lesson.id} style={[styles.nodeRow, { transform: [{ translateX: offset }] }]}>
              {index < lessons.length - 1 ? <View style={[styles.pathLine, done && styles.pathLineDone]} /> : null}
              <Pressable disabled={locked} onPress={() => onOpenLesson(lesson)} style={({ pressed }) => [styles.node, done && styles.nodeDone, current && styles.nodeCurrent, locked && styles.nodeLocked, pressed && !locked && styles.pressed]}>
                <Text style={[styles.nodeIcon, done && styles.nodeIconDone, locked && styles.nodeIconLocked]}>{done ? '✓' : locked ? '·' : kindIcon}</Text>
              </Pressable>
              <View style={styles.nodeCopy}>
                <View style={styles.nodeLabelRow}>{current ? <Pill label="À faire" tone="primary" /> : done ? <Pill label="Terminé" tone="success" /> : null}</View>
                <Text style={[styles.nodeTitle, locked && styles.nodeTitleLocked]} numberOfLines={2}>{lesson.title}</Text>
                {!locked ? <Text style={styles.nodeMeta}>{lesson.durationMin ?? 5} min • {lesson.activityKind ?? 'leçon'}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
      {lessons.length > 28 ? <Card style={styles.moreCard}><Text style={styles.moreTitle}>+ {lessons.length - 28} étapes dans ce parcours</Text><Text style={styles.meta}>Continue pour les débloquer.</Text></Card> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1},eyebrow:{color:'#98A5FF',fontSize:10,fontWeight:'900',letterSpacing:1.4,marginTop:12,marginBottom:8},title:{color:theme.colors.text,fontSize:30,fontWeight:'900',lineHeight:35,letterSpacing:-.7},lead:{color:theme.colors.textSecondary,fontSize:13,lineHeight:19,marginTop:6,marginBottom:14},recommended:{marginTop:4},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},mini:{color:theme.colors.textMuted,fontSize:10,fontWeight:'800'},recommendedTitle:{color:theme.colors.text,fontSize:20,fontWeight:'900',lineHeight:25,marginTop:15},meta:{color:theme.colors.textMuted,fontSize:10.5,lineHeight:16,marginTop:4,marginBottom:13},courseGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},courseTile:{width:'48.4%',minHeight:156,borderRadius:22,backgroundColor:'rgba(255,255,255,.04)',borderWidth:1,borderColor:'rgba(255,255,255,.07)',padding:13},courseBadge:{width:44,height:44,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center'},courseBadgeSmall:{width:43,height:43,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.035)'},courseBadgeText:{fontSize:13,fontWeight:'900'},courseTitle:{color:theme.colors.text,fontSize:14,fontWeight:'900',lineHeight:18,marginTop:13,minHeight:36},courseMeta:{color:theme.colors.textMuted,fontSize:9.5,fontWeight:'700',marginBottom:8},pressed:{opacity:.76,transform:[{scale:.985}]},journeyHeader:{flexDirection:'row',alignItems:'center',gap:11,marginTop:8,marginBottom:14},backButton:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.045)',borderWidth:1,borderColor:'rgba(255,255,255,.08)'},backIcon:{color:theme.colors.text,fontSize:26,fontWeight:'700',marginTop:-2},journeyKicker:{color:'#98A5FF',fontSize:9,fontWeight:'900',letterSpacing:1.1},journeyTitle:{color:theme.colors.text,fontSize:22,fontWeight:'900',lineHeight:27,marginTop:2},progressLabel:{color:theme.colors.textSecondary,fontSize:11,fontWeight:'700',marginBottom:9},progressValue:{color:'#B7C0FF',fontSize:12,fontWeight:'900',marginBottom:9},pathHint:{color:theme.colors.textMuted,fontSize:11,textAlign:'center',marginTop:22,marginBottom:18},path:{paddingBottom:16,paddingHorizontal:8},nodeRow:{minHeight:112,flexDirection:'row',alignItems:'flex-start',position:'relative',maxWidth:'80%'},pathLine:{position:'absolute',left:29,top:60,width:3,height:58,borderRadius:2,backgroundColor:'rgba(255,255,255,.07)'},pathLineDone:{backgroundColor:'rgba(98,208,147,.28)'},node:{width:60,height:60,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(114,129,255,.14)',borderWidth:2,borderColor:'rgba(133,147,255,.32)',shadowColor:'#6F7DFF',shadowOpacity:.18,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:3},nodeCurrent:{backgroundColor:'#6271E8',borderColor:'#A8B1FF',shadowOpacity:.42,elevation:6},nodeDone:{backgroundColor:'rgba(55,159,105,.15)',borderColor:'rgba(72,200,132,.35)'},nodeLocked:{backgroundColor:'rgba(255,255,255,.025)',borderColor:'rgba(255,255,255,.07)',shadowOpacity:0,elevation:0},nodeIcon:{color:'#C8CEFF',fontSize:17,fontWeight:'900'},nodeIconDone:{color:theme.colors.success},nodeIconLocked:{color:'rgba(255,255,255,.16)'},nodeCopy:{paddingLeft:12,paddingTop:1,flex:1},nodeLabelRow:{minHeight:24},nodeTitle:{color:theme.colors.text,fontSize:13,fontWeight:'900',lineHeight:17,marginTop:4},nodeTitleLocked:{color:'rgba(255,255,255,.25)'},nodeMeta:{color:theme.colors.textMuted,fontSize:9.5,fontWeight:'700',marginTop:4},moreCard:{marginTop:4},moreTitle:{color:theme.colors.text,fontSize:14,fontWeight:'900'}
});