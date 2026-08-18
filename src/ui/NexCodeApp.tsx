import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Course, Lesson, courses, guidedProjects } from '../data/courses';
import { LabDraft, loadLocalState, LocalState, saveLocalState } from '../lib/localState';
import { buildAdaptivePool, planPracticeSession } from '../learning/adaptivePractice';
import { buildChapterOfflinePack, estimateOfflineStorage, OfflinePackKind, offlineUpdatePlan } from '../learning/offlineEngine';
import { courseMasterySnapshot, remediationTargets } from '../learning/masteryEngine';
import { buildSkillGraph, recordSkillAttempt } from '../learning/skillGraph';
import { LearningHub } from './LearningHub';
import { LessonFlowScreen } from './LessonFlowScreen';
import { LabWorkspaceScreen } from './LabWorkspaceScreen';
import { ProjectPortfolioScreen } from './ProjectPortfolioScreen';
import { Card, Pill, PrimaryButton, ProgressBar, SectionHeader, StatTile } from './components';
import { theme } from './theme';

type Tab = 'Accueil' | 'Apprendre' | 'Lab' | 'Projets' | 'Profil';
const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'Accueil', icon: '⌂', label: 'Accueil' },
  { id: 'Apprendre', icon: '◫', label: 'Cours' },
  { id: 'Lab', icon: '</>', label: 'Lab' },
  { id: 'Projets', icon: '◇', label: 'Projets' },
  { id: 'Profil', icon: '○', label: 'Profil' },
];
const goals = ['Créer des sites Web', 'Apprendre la programmation', 'Créer des APIs', 'Créer des bots', 'Maîtriser les bases de données'];

export default function NexCodeApp() {
  const [state, setState] = useState<LocalState>(() => loadLocalState());
  const [tab, setTab] = useState<Tab>('Accueil');
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [labLesson, setLabLesson] = useState<Lesson | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftGoal, setDraftGoal] = useState(goals[0]!);

  useEffect(() => saveLocalState(state), [state]);

  const graph = useMemo(() => buildSkillGraph(courses), []);
  const adaptivePool = useMemo(
    () => buildAdaptivePool(courses, graph, state.mastery, state.completedLessons),
    [graph, state.mastery, state.completedLessons],
  );
  const quickSession = useMemo(() => planPracticeSession(adaptivePool, 10), [adaptivePool]);

  function openLesson(course: Course, lesson: Lesson) {
    setActiveCourse(course);
    setActiveLesson(lesson);
    setLabLesson(null);
    setState((current) => ({ ...current, recentCourseId: course.id }));
  }

  function recordAttempt(correct: boolean, errorTag?: string) {
    if (!activeLesson) return;
    setState((current) => ({
      ...current,
      xp: current.xp + (correct ? 12 : 2),
      dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 4),
      mastery: recordSkillAttempt(current.mastery, activeLesson, correct, new Date(), errorTag),
      lessonAttempts: { ...current.lessonAttempts, [activeLesson.id]: (current.lessonAttempts[activeLesson.id] ?? 0) + 1 },
      lessonErrorTags: !correct && errorTag
        ? { ...current.lessonErrorTags, [activeLesson.id]: [...new Set([...(current.lessonErrorTags[activeLesson.id] ?? []), errorTag])].slice(-8) }
        : current.lessonErrorTags,
      completedLessons: correct && !current.completedLessons.includes(activeLesson.id)
        ? [...current.completedLessons, activeLesson.id]
        : current.completedLessons,
    }));
  }

  function saveLabDraft(draft: LabDraft) {
    if (!labLesson) return;
    setState((current) => ({ ...current, labDrafts: { ...current.labDrafts, [labLesson.id]: draft } }));
  }

  function completeLab(draft: LabDraft) {
    if (!labLesson) return;
    const completed = labLesson;
    setState((current) => ({
      ...current,
      xp: current.xp + 25,
      dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 8),
      mastery: recordSkillAttempt(current.mastery, { ...completed, activityKind: 'lab' }, true),
      labDrafts: { ...current.labDrafts, [completed.id]: draft },
      completedLessons: current.completedLessons.includes(completed.id) ? current.completedLessons : [...current.completedLessons, completed.id],
    }));
    setActiveLesson(completed);
    setLabLesson(null);
  }

  function toggleChapterOffline(courseId: string, chapterId: string, kind: OfflinePackKind) {
    const course = courses.find((candidate) => candidate.id === courseId);
    if (!course) return;
    const pack = buildChapterOfflinePack(course, chapterId, kind);
    if (!pack) return;
    setState((current) => {
      const exactInstalled = current.installedOfflinePacks.some((candidate) => candidate.id === pack.id);
      const withoutChapterVariant = current.installedOfflinePacks.filter(
        (candidate) => !(candidate.courseId === course.id && candidate.chapterIds.includes(chapterId)),
      );
      const installedOfflinePacks = exactInstalled ? withoutChapterVariant : [...withoutChapterVariant, pack];
      return {
        ...current,
        installedOfflinePacks,
        downloadedChapters: [...new Set(installedOfflinePacks.flatMap((candidate) => candidate.chapterIds))],
      };
    });
  }

  if (!state.onboardingComplete) {
    return (
      <Onboarding
        name={draftName}
        goal={draftGoal}
        onName={setDraftName}
        onGoal={setDraftGoal}
        onFinish={() => setState((current) => ({ ...current, onboardingComplete: true, name: draftName.trim(), learningGoal: draftGoal }))}
      />
    );
  }

  if (labLesson && activeCourse) {
    return (
      <DetailShell>
        <LabWorkspaceScreen
          lesson={labLesson}
          stored={state.labDrafts[labLesson.id]}
          onSave={saveLabDraft}
          onComplete={completeLab}
          onBack={() => { setActiveLesson(labLesson); setLabLesson(null); }}
        />
      </DetailShell>
    );
  }

  if (activeLesson && activeCourse) {
    return (
      <DetailShell>
        <LessonFlowScreen
          course={activeCourse}
          lesson={activeLesson}
          state={state}
          onRecord={recordAttempt}
          onOpenLab={() => setLabLesson(activeLesson)}
          onBack={() => { setActiveLesson(null); setActiveCourse(null); setTab('Apprendre'); }}
        />
      </DetailShell>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <Header />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === 'Accueil' ? <Home state={state} session={quickSession} onOpenLesson={openLesson} /> : null}
          {tab === 'Apprendre' ? <LearningHub courses={courses} state={state} onOpenLesson={openLesson} onToggleChapterOffline={toggleChapterOffline} /> : null}
          {tab === 'Lab' ? <LabLibrary state={state} onOpenLesson={openLesson} /> : null}
          {tab === 'Projets' ? (
            <ProjectPortfolioScreen
              projects={guidedProjects}
              graph={graph}
              state={state}
              onProgress={(project, progress) => setState((current) => ({
                ...current,
                xp: current.xp + (progress > (current.projectProgress[project.id] ?? 0) ? 15 : 0),
                projectProgress: { ...current.projectProgress, [project.id]: progress },
              }))}
              onProof={(proof) => setState((current) => ({
                ...current,
                xp: current.xp + 50,
                portfolioProofs: [...current.portfolioProofs.filter((item) => item.projectId !== proof.projectId), proof],
              }))}
            />
          ) : null}
          {tab === 'Profil' ? <Profile state={state} /> : null}
        </ScrollView>
        <BottomNav tab={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  );
}

function Home({ state, session, onOpenLesson }: { state: LocalState; session: ReturnType<typeof planPracticeSession>; onOpenLesson: (course: Course, lesson: Lesson) => void }) {
  const progress = Math.min(100, Math.round((state.dailyCompleted / state.dailyGoal) * 100));
  const next = session.activities[0];
  const nextCourse = next ? courses.find((course) => course.id === next.courseId) : undefined;
  const nextLesson = nextCourse?.starterLessons.find((lesson) => lesson.id === next?.lessonId);
  const repairs = remediationTargets(state.mastery).length;
  const totalActivities = courses.reduce((sum, course) => sum + course.lessons, 0);
  return (
    <View>
      <Text style={styles.eyebrow}>AUJOURD’HUI</Text>
      <Text style={styles.title}>Bonjour {state.name || 'développeur'} 👋</Text>
      <Text style={styles.lead}>Ton plan du jour est construit à partir des erreurs, révisions dues et preuves pratiques — pas seulement de l’ordre du cours.</Text>
      <Card tone="primary">
        <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.kicker}>OBJECTIF DU JOUR</Text><Text style={styles.big}>{state.dailyCompleted}/{state.dailyGoal} min</Text></View><Pill label={`${progress}%`} tone="primary" /></View>
        <ProgressBar value={progress} />
      </Card>
      <View style={styles.stats}><StatTile label="XP" value={`${state.xp}`} /><StatTile label="Série" value={`${state.streak} j`} /><StatTile label="À réparer" value={`${repairs}`} /></View>
      <SectionHeader title="Recommandé maintenant" action={`${session.estimatedMinutes} min`} />
      {next && nextCourse && nextLesson ? (
        <Card><Pill label={next.mode} tone={next.mode === 'repair' ? 'warning' : next.mode === 'lab' ? 'success' : 'primary'} /><Text style={styles.cardTitle}>{nextLesson.title}</Text><Text style={styles.body}>{next.reason}</Text><PrimaryButton label="Commencer" onPress={() => onOpenLesson(nextCourse, nextLesson)} /></Card>
      ) : <Card><Text style={styles.body}>Aucune activité urgente : choisis un parcours ou une mission Lab.</Text></Card>}
      <SectionHeader title="Bibliothèque réelle" />
      <Card><Text style={styles.big}>{totalActivities.toLocaleString()} activités</Text><Text style={styles.body}>12 parcours structurés en chapitres, pratique, Lab, debug, révisions et checkpoints. Les nombres proviennent du catalogue runtime.</Text></Card>
    </View>
  );
}

function LabLibrary({ state, onOpenLesson }: { state: LocalState; onOpenLesson: (course: Course, lesson: Lesson) => void }) {
  const labs = courses.flatMap((course) => course.starterLessons.filter((lesson) => lesson.activityKind === 'lab').slice(0, 3).map((lesson) => ({ course, lesson })));
  return (
    <View>
      <Text style={styles.eyebrow}>NEXCODE LAB</Text><Text style={styles.title}>Écris. Teste. Corrige. Explique.</Text><Text style={styles.lead}>Les missions sont liées aux compétences. Les workspaces sont multi-fichiers, sauvegardés localement et contrôlés avant validation.</Text>
      <Card tone="primary"><Text style={styles.kicker}>BROUILLONS REPRENABLES</Text><Text style={styles.big}>{Object.keys(state.labDrafts).length}</Text><Text style={styles.body}>Web, JavaScript, Python, SQL, Git, Node/API et Bots ont des environnements adaptés.</Text></Card>
      <SectionHeader title="Missions" action={`${labs.length} suggestions`} />
      {labs.map(({ course, lesson }) => (
        <Pressable key={`${course.id}:${lesson.id}`} onPress={() => onOpenLesson(course, lesson)} style={styles.gapCard}>
          <Card><View style={styles.rowBetween}><Pill label={course.language} tone="primary" /><Pill label={`D${lesson.difficulty ?? 1}`} /></View><Text style={styles.cardTitle}>{lesson.title}</Text><Text style={styles.body}>{lesson.labMission?.instructions ?? lesson.transferPrompt ?? lesson.concept}</Text></Card>
        </Pressable>
      ))}
    </View>
  );
}

function Profile({ state }: { state: LocalState }) {
  const snapshots = courses.map((course) => ({ course, snapshot: courseMasterySnapshot(course, state.mastery) }));
  const mastered = snapshots.reduce((sum, item) => sum + item.snapshot.mastered, 0);
  const skills = snapshots.reduce((sum, item) => sum + item.snapshot.total, 0);
  const storage = estimateOfflineStorage(state.installedOfflinePacks);
  const updates = offlineUpdatePlan(state.installedOfflinePacks, courses).filter((item) => item.action !== 'keep');
  return (
    <View>
      <Text style={styles.eyebrow}>PROFIL D’APPRENTISSAGE</Text><Text style={styles.title}>{state.name || 'Développeur NexCode'}</Text><Text style={styles.lead}>{state.learningGoal}</Text>
      <View style={styles.stats}><StatTile label="XP" value={`${state.xp}`} /><StatTile label="Compétences" value={`${mastered}/${skills}`} /><StatTile label="Portfolio" value={`${state.portfolioProofs.length}`} /></View>
      <SectionHeader title="Maîtrise par parcours" />
      {snapshots.map(({ course, snapshot }) => (
        <Card key={course.id} style={styles.gapCard}><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.cardTitle}>{course.title}</Text><Text style={styles.meta}>{snapshot.mastered}/{snapshot.total} solides • {snapshot.dueForReview} à revoir</Text></View><Pill label={`${snapshot.score}%`} tone={snapshot.score >= 70 ? 'success' : 'primary'} /></View><ProgressBar value={snapshot.score} /></Card>
      ))}
      <SectionHeader title="Offline" action={`${storage} Mo`} />
      <Card><Text style={styles.cardTitle}>{state.installedOfflinePacks.length} packs installés</Text><Text style={styles.body}>{updates.length ? `${updates.length} pack(s) doivent être mis à jour ou retirés après évolution du curriculum.` : 'Tous les packs installés correspondent au curriculum courant.'}</Text><Text style={styles.meta}>Lite = contenu + exemples • Standard = exercices + Lab • Full = médias inclus.</Text></Card>
      <SectionHeader title="Preuves de portfolio" action={`${state.portfolioProofs.length}`} />
      {state.portfolioProofs.length ? state.portfolioProofs.map((proof) => <Card key={proof.projectId} style={styles.gapCard}><Pill label={`${proof.score}/100`} tone="success" /><Text style={styles.cardTitle}>{proof.title}</Text><Text style={styles.body}>{proof.evidenceSummary}</Text></Card>) : <Card><Text style={styles.body}>Termine un projet puis réussis sa revue pour créer ta première preuve.</Text></Card>}
    </View>
  );
}

function Onboarding({ name, goal, onName, onGoal, onFinish }: { name: string; goal: string; onName: (value: string) => void; onGoal: (value: string) => void; onFinish: () => void }) {
  return (
    <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.onboarding} keyboardShouldPersistTaps="handled">
      <View style={styles.logo}><Text style={styles.logoText}>NC</Text></View><Pill label="NEXUS TECH • NEXCODE" tone="primary" /><Text style={styles.onboardTitle}>Apprends pour savoir faire.</Text><Text style={styles.lead}>Cours profonds, répétition espacée, Lab, projets et maîtrise mesurable — même avec une connexion limitée.</Text>
      <Text style={styles.fieldLabel}>TON PRÉNOM</Text><TextInput value={name} onChangeText={onName} placeholder="Optionnel" placeholderTextColor={theme.colors.textMuted} style={styles.input} />
      <Text style={styles.fieldLabel}>TON OBJECTIF</Text>{goals.map((item) => <Pressable key={item} onPress={() => onGoal(item)} style={[styles.goal, goal === item && styles.goalActive]}><Text style={[styles.goalText, goal === item && styles.goalTextActive]}>{goal === item ? '●' : '○'}  {item}</Text></Pressable>)}
      <PrimaryButton label="Créer mon parcours" onPress={onFinish} />
    </ScrollView></SafeAreaView>
  );
}

function DetailShell({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>;
}
function Header() { return <View style={styles.header}><View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>NC</Text></View><View><Text style={styles.brandTitle}>NexCode</Text><Text style={styles.brandSub}>Learn • Practice • Build • Master</Text></View></View><Pill label="● Offline prêt" tone="success" /></View>; }
function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) { return <View style={styles.nav}>{tabs.map((item) => { const active = item.id === tab; return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(item.id)} style={styles.navItem}><Text style={[styles.navIcon, active && styles.navActive]}>{item.icon}</Text><Text style={[styles.navLabel, active && styles.navActive]}>{item.label}</Text></Pressable>; })}</View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.colors.background},app:{flex:1,backgroundColor:theme.colors.background},content:{paddingHorizontal:16,paddingBottom:112},detailContent:{paddingHorizontal:16,paddingBottom:50},flex:{flex:1},header:{paddingHorizontal:16,paddingVertical:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#101626'},brand:{flexDirection:'row',alignItems:'center',gap:9},brandMark:{width:36,height:36,borderRadius:12,backgroundColor:'#151E40',borderWidth:1,borderColor:'#4458B5',alignItems:'center',justifyContent:'center'},brandMarkText:{color:'#AEB7FF',fontWeight:'900',fontSize:12},brandTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},brandSub:{color:theme.colors.textMuted,fontSize:8,marginTop:1},nav:{position:'absolute',left:0,right:0,bottom:0,minHeight:76,paddingBottom:8,flexDirection:'row',backgroundColor:'#0B101D',borderTopWidth:1,borderTopColor:theme.colors.border},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIcon:{color:theme.colors.textMuted,fontSize:17,fontWeight:'800'},navLabel:{color:theme.colors.textMuted,fontSize:9,fontWeight:'700',marginTop:3},navActive:{color:'#9BA7FF'},eyebrow:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1.1,marginTop:12,marginBottom:7},title:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:35},lead:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:7,marginBottom:14},kicker:{color:'#8F9CFF',fontSize:10,fontWeight:'900',letterSpacing:1},big:{color:theme.colors.text,fontSize:24,fontWeight:'900',marginTop:3,marginBottom:10},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},stats:{flexDirection:'row',gap:7,marginTop:10},cardTitle:{color:theme.colors.text,fontSize:16,fontWeight:'850',marginTop:8,marginBottom:3},body:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginVertical:7},meta:{color:theme.colors.textMuted,fontSize:10,lineHeight:15,marginVertical:7},gapCard:{marginBottom:9},onboarding:{padding:20,paddingBottom:50},logo:{width:56,height:56,borderRadius:18,backgroundColor:'#151E40',borderWidth:1,borderColor:'#4458B5',alignItems:'center',justifyContent:'center',marginBottom:12},logoText:{color:'#AEB7FF',fontSize:17,fontWeight:'900'},onboardTitle:{color:theme.colors.text,fontSize:34,fontWeight:'900',lineHeight:39,marginTop:18},fieldLabel:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1,marginTop:18,marginBottom:7},input:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:theme.colors.border,backgroundColor:theme.colors.surface,color:theme.colors.text,paddingHorizontal:14},goal:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:theme.colors.border,paddingHorizontal:13,justifyContent:'center',marginBottom:7},goalActive:{backgroundColor:'#151E40',borderColor:'#465BBD'},goalText:{color:theme.colors.textSecondary,fontSize:13,fontWeight:'700'},goalTextActive:{color:theme.colors.text},
});
