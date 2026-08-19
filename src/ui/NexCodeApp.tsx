import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, SafeAreaView, ScrollView, StatusBar as RNStatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Course, Lesson, courses, guidedProjects } from '../data/courses';
import { LabDraft, loadLocalState, LocalState, saveLocalState } from '../lib/localState';
import { buildAdaptivePool, planPracticeSession } from '../learning/adaptivePractice';
import { buildChapterOfflinePack, OfflinePackKind } from '../learning/offlineEngine';
import { courseMasterySnapshot, remediationTargets } from '../learning/masteryEngine';
import { buildSkillGraph, recordSkillAttempt } from '../learning/skillGraph';
import { LearningHub } from './LearningHub';
import { LessonFlowScreen } from './LessonFlowScreen';
import { LabWorkspaceScreen } from './LabWorkspaceScreen';
import { ProjectPortfolioScreen } from './ProjectPortfolioScreen';
import { Card, GlassCard, Pill, PrimaryButton, ProgressBar, SectionHeader, StatTile } from './components';
import { theme } from './theme';

type Tab = 'Accueil' | 'Apprendre' | 'Lab' | 'Projets' | 'Profil';
const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'Accueil', icon: '⌂', label: 'Accueil' },
  { id: 'Apprendre', icon: '◉', label: 'Parcours' },
  { id: 'Lab', icon: '⌘', label: 'Lab' },
  { id: 'Projets', icon: '◇', label: 'Projets' },
  { id: 'Profil', icon: '●', label: 'Profil' },
];
const goals = ['Créer des sites Web', 'Apprendre la programmation', 'Créer des APIs', 'Créer des bots', 'Maîtriser les bases de données'];
const levels = ['Je débute', 'J’ai quelques bases', 'Je code déjà'];

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
  const adaptivePool = useMemo(() => buildAdaptivePool(courses, graph, state.mastery, state.completedLessons), [graph, state.mastery, state.completedLessons]);
  const quickSession = useMemo(() => planPracticeSession(adaptivePool, 10), [adaptivePool]);

  function openLesson(course: Course, lesson: Lesson) {
    setActiveCourse(course); setActiveLesson(lesson); setLabLesson(null);
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
      lessonErrorTags: !correct && errorTag ? { ...current.lessonErrorTags, [activeLesson.id]: [...new Set([...(current.lessonErrorTags[activeLesson.id] ?? []), errorTag])].slice(-8) } : current.lessonErrorTags,
      completedLessons: correct && !current.completedLessons.includes(activeLesson.id) ? [...current.completedLessons, activeLesson.id] : current.completedLessons,
    }));
  }

  function saveLabDraft(draft: LabDraft) { if (labLesson) setState((current) => ({ ...current, labDrafts: { ...current.labDrafts, [labLesson.id]: draft } })); }
  function completeLab(draft: LabDraft) {
    if (!labLesson) return;
    const completed = labLesson;
    setState((current) => ({ ...current, xp: current.xp + 25, dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 8), mastery: recordSkillAttempt(current.mastery, { ...completed, activityKind: 'lab' }, true), labDrafts: { ...current.labDrafts, [completed.id]: draft }, completedLessons: current.completedLessons.includes(completed.id) ? current.completedLessons : [...current.completedLessons, completed.id] }));
    setActiveLesson(completed); setLabLesson(null);
  }

  function toggleChapterOffline(courseId: string, chapterId: string, kind: OfflinePackKind) {
    const course = courses.find((candidate) => candidate.id === courseId); if (!course) return;
    const pack = buildChapterOfflinePack(course, chapterId, kind); if (!pack) return;
    setState((current) => {
      const exactInstalled = current.installedOfflinePacks.some((candidate) => candidate.id === pack.id);
      const withoutVariant = current.installedOfflinePacks.filter((candidate) => !(candidate.courseId === course.id && candidate.chapterIds.includes(chapterId)));
      const installedOfflinePacks = exactInstalled ? withoutVariant : [...withoutVariant, pack];
      return { ...current, installedOfflinePacks, downloadedChapters: [...new Set(installedOfflinePacks.flatMap((candidate) => candidate.chapterIds))] };
    });
  }

  if (!state.onboardingComplete) return <Onboarding name={draftName} goal={draftGoal} onName={setDraftName} onGoal={setDraftGoal} onFinish={() => setState((current) => ({ ...current, onboardingComplete: true, name: draftName.trim(), learningGoal: draftGoal }))} />;

  if (labLesson && activeCourse) return <DetailShell><LabWorkspaceScreen lesson={labLesson} stored={state.labDrafts[labLesson.id]} onSave={saveLabDraft} onComplete={completeLab} onBack={() => { setActiveLesson(labLesson); setLabLesson(null); }} /></DetailShell>;
  if (activeLesson && activeCourse) return <DetailShell><LessonFlowScreen course={activeCourse} lesson={activeLesson} state={state} onRecord={recordAttempt} onOpenLab={() => setLabLesson(activeLesson)} onBack={() => { setActiveLesson(null); setActiveCourse(null); setTab('Apprendre'); }} /></DetailShell>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <Header streak={state.streak} xp={state.xp} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === 'Accueil' ? <Home state={state} session={quickSession} onOpenLesson={openLesson} onOpenLearn={() => setTab('Apprendre')} onOpenLab={() => setTab('Lab')} /> : null}
          {tab === 'Apprendre' ? <LearningHub courses={courses} state={state} onOpenLesson={openLesson} onToggleChapterOffline={toggleChapterOffline} /> : null}
          {tab === 'Lab' ? <LabLibrary state={state} onOpenLesson={openLesson} /> : null}
          {tab === 'Projets' ? <ProjectPortfolioScreen projects={guidedProjects} graph={graph} state={state} onProgress={(project, progress) => setState((current) => ({ ...current, xp: current.xp + (progress > (current.projectProgress[project.id] ?? 0) ? 15 : 0), projectProgress: { ...current.projectProgress, [project.id]: progress } }))} onProof={(proof) => setState((current) => ({ ...current, xp: current.xp + 50, portfolioProofs: [...current.portfolioProofs.filter((item) => item.projectId !== proof.projectId), proof] }))} onSaveProjectDraft={(project, draft) => setState((current) => ({ ...current, projectDrafts: { ...current.projectDrafts, [project.id]: draft } }))} /> : null}
          {tab === 'Profil' ? <Profile state={state} /> : null}
        </ScrollView>
        <BottomNav tab={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  );
}

function Home({ state, session, onOpenLesson, onOpenLearn, onOpenLab }: { state: LocalState; session: ReturnType<typeof planPracticeSession>; onOpenLesson: (course: Course, lesson: Lesson) => void; onOpenLearn: () => void; onOpenLab: () => void }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(entrance, { toValue: 1, duration: 420, useNativeDriver: true }).start(); }, [entrance]);
  const progress = Math.min(100, Math.round((state.dailyCompleted / Math.max(1, state.dailyGoal)) * 100));
  const next = session.activities[0]; const nextCourse = next ? courses.find((course) => course.id === next.courseId) : undefined; const nextLesson = nextCourse?.starterLessons.find((lesson) => lesson.id === next?.lessonId);
  const repairs = remediationTargets(state.mastery).length;
  const recentCourse = courses.find((course) => course.id === state.recentCourseId) ?? courses[0];
  const recentNext = recentCourse?.starterLessons.find((lesson) => !state.completedLessons.includes(lesson.id)) ?? recentCourse?.starterLessons[0];
  return (
    <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0,1], outputRange: [10,0] }) }] }}>
      <View style={styles.heroTop}><View style={styles.flex}><Text style={styles.hello}>Salut {state.name || '👋'}</Text><Text style={styles.heroTitle}>On code quoi aujourd’hui ?</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{(state.name || 'N').slice(0,1).toUpperCase()}</Text><View style={styles.avatarOnline} /></View></View>
      <Card tone="primary" style={styles.continueCard}>
        <View style={styles.continueGlow} /><View style={styles.rowBetween}><Pill label={next?.mode === 'repair' ? 'Révision' : 'À continuer'} tone="primary" /><Text style={styles.duration}>{session.estimatedMinutes || 10} min</Text></View>
        <Text style={styles.continueTitle}>{nextLesson?.title ?? recentNext?.title ?? 'Choisis ton premier parcours'}</Text>
        <Text style={styles.continueMeta}>{nextCourse?.title ?? recentCourse?.title ?? 'NexCode'} • +12 XP</Text>
        <View style={styles.progressBlock}><View style={styles.rowBetween}><Text style={styles.progressCaption}>Objectif du jour</Text><Text style={styles.progressCaption}>{progress}%</Text></View><ProgressBar value={progress} /></View>
        <PrimaryButton icon="▶" label="Continuer" onPress={() => nextCourse && nextLesson ? onOpenLesson(nextCourse, nextLesson) : recentCourse && recentNext ? onOpenLesson(recentCourse, recentNext) : onOpenLearn()} />
      </Card>
      <View style={styles.stats}><StatTile label="Série" value={`${state.streak} 🔥`} /><StatTile label="XP" value={`${state.xp}`} /><StatTile label="À revoir" value={`${repairs}`} /></View>
      <SectionHeader title="Accès rapide" />
      <View style={styles.quickGrid}><QuickAction icon="◎" title="Parcours" subtitle="Apprendre" onPress={onOpenLearn} /><QuickAction icon="</>" title="Code Lab" subtitle="Créer & tester" onPress={onOpenLab} /></View>
      {recentCourse ? <><SectionHeader title="Ton parcours" action="Voir tout" /><Pressable onPress={onOpenLearn}><GlassCard><View style={styles.courseRow}><View style={[styles.courseIcon, { borderColor: `${recentCourse.color}88` }]}><Text style={[styles.courseIconText, { color: recentCourse.color }]}>{recentCourse.icon}</Text></View><View style={styles.flex}><Text style={styles.cardTitle}>{recentCourse.title}</Text><Text style={styles.meta}>{state.completedLessons.filter((id) => recentCourse.starterLessons.some((lesson) => lesson.id === id)).length}/{recentCourse.starterLessons.length} étapes terminées</Text></View><Text style={styles.chevron}>›</Text></View></GlassCard></Pressable></> : null}
    </Animated.View>
  );
}

function QuickAction({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.quickPressed]}><View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickSubtitle}>{subtitle}</Text></Pressable>; }

function LabLibrary({ state, onOpenLesson }: { state: LocalState; onOpenLesson: (course: Course, lesson: Lesson) => void }) {
  const labs = courses.flatMap((course) => course.starterLessons.filter((lesson) => lesson.activityKind === 'lab').slice(0, 2).map((lesson) => ({ course, lesson })));
  return <View><Text style={styles.screenKicker}>CODE LAB</Text><Text style={styles.screenTitle}>Construis pour de vrai.</Text><Text style={styles.screenLead}>Éditeur multi-fichiers, tests et projets dans le même espace.</Text><View style={styles.labFeatureRow}><GlassCard style={styles.labFeature}><Text style={styles.labFeatureIcon}>⌘</Text><Text style={styles.labFeatureTitle}>Éditeur</Text></GlassCard><GlassCard style={styles.labFeature}><Text style={styles.labFeatureIcon}>▶</Text><Text style={styles.labFeatureTitle}>Exécuter</Text></GlassCard><GlassCard style={styles.labFeature}><Text style={styles.labFeatureIcon}>▣</Text><Text style={styles.labFeatureTitle}>Preview</Text></GlassCard></View><SectionHeader title="Continuer à coder" action={`${Object.keys(state.labDrafts).length} brouillon(s)`} />{labs.map(({ course, lesson }) => <Pressable key={`${course.id}:${lesson.id}`} onPress={() => onOpenLesson(course, lesson)} style={styles.gapCard}><Card><View style={styles.rowBetween}><Pill label={course.language} tone="primary" /><Text style={styles.chevron}>›</Text></View><Text style={styles.cardTitle}>{lesson.title}</Text><Text style={styles.meta}>{lesson.labMission?.instructions ?? lesson.concept}</Text></Card></Pressable>)}</View>;
}

function Profile({ state }: { state: LocalState }) {
  const snapshots = courses.map((course) => ({ course, snapshot: courseMasterySnapshot(course, state.mastery) })); const mastered = snapshots.reduce((sum, item) => sum + item.snapshot.mastered, 0); const skills = snapshots.reduce((sum, item) => sum + item.snapshot.total, 0);
  return <View><Text style={styles.screenKicker}>PROFIL</Text><View style={styles.profileHead}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(state.name || 'N').slice(0,1).toUpperCase()}</Text></View><View><Text style={styles.screenTitle}>{state.name || 'Développeur NexCode'}</Text><Text style={styles.screenLead}>{state.learningGoal}</Text></View></View><View style={styles.stats}><StatTile label="XP" value={`${state.xp}`} /><StatTile label="Maîtrisées" value={`${mastered}/${skills}`} /><StatTile label="Projets" value={`${state.portfolioProofs.length}`} /></View><SectionHeader title="Compétences" />{snapshots.slice(0,6).map(({ course, snapshot }) => <Card key={course.id} style={styles.gapCard}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{course.title}</Text><Pill label={`${snapshot.score}%`} tone={snapshot.score >= 70 ? 'success' : 'primary'} /></View><View style={styles.spacer8} /><ProgressBar value={snapshot.score} /></Card>)}</View>;
}

function Onboarding({ name, goal, onName, onGoal, onFinish }: { name: string; goal: string; onName: (value: string) => void; onGoal: (value: string) => void; onFinish: () => void }) {
  const [step, setStep] = useState(0); const [level, setLevel] = useState(levels[0]!); const progress = ((step + 1) / 3) * 100;
  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><View style={styles.onboarding}><View style={styles.onboardHeader}><Text style={styles.wordmark}>NexCode</Text><Text style={styles.stepText}>{step + 1}/3</Text></View><ProgressBar value={progress} /><View style={styles.onboardBody}><View style={styles.mentorBubble}><Text style={styles.mentorFace}>{step === 0 ? '◕‿◕' : step === 1 ? '⌐■_■' : '⚡'}</Text></View>{step === 0 ? <><Text style={styles.onboardTitle}>Qu’est-ce que tu veux créer ?</Text><Text style={styles.onboardHint}>On adapte ton parcours à ton objectif.</Text><View style={styles.choiceList}>{goals.map((item) => <Choice key={item} label={item} selected={goal === item} onPress={() => onGoal(item)} />)}</View></> : null}{step === 1 ? <><Text style={styles.onboardTitle}>Quel est ton niveau ?</Text><Text style={styles.onboardHint}>Pas de test compliqué. Tu pourras changer plus tard.</Text><View style={styles.choiceList}>{levels.map((item) => <Choice key={item} label={item} selected={level === item} onPress={() => setLevel(item)} />)}</View></> : null}{step === 2 ? <><Text style={styles.onboardTitle}>Comment on t’appelle ?</Text><Text style={styles.onboardHint}>Optionnel. Tu peux commencer sans compte.</Text><TextInput value={name} onChangeText={onName} placeholder="Ton prénom" placeholderTextColor={theme.colors.textMuted} style={styles.input} autoFocus /></> : null}</View><View style={styles.onboardFooter}><PrimaryButton label={step < 2 ? 'Continuer' : 'Commencer à apprendre'} onPress={() => step < 2 ? setStep((value) => value + 1) : onFinish()} />{step > 0 ? <Pressable onPress={() => setStep((value) => value - 1)}><Text style={styles.backText}>Retour</Text></Pressable> : null}</View></View></SafeAreaView>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, selected && styles.choiceActive, pressed && styles.quickPressed]}><View style={[styles.choiceDot, selected && styles.choiceDotActive]}>{selected ? <View style={styles.choiceDotInner} /> : null}</View><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text></Pressable>; }

function DetailShell({ children }: { children: React.ReactNode }) { return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>; }
function Header({ streak, xp }: { streak: number; xp: number }) { return <View style={styles.header}><Text style={styles.wordmark}>NexCode</Text><View style={styles.headerStats}><View style={styles.headerPill}><Text style={styles.headerPillText}>🔥 {streak}</Text></View><View style={styles.headerPill}><Text style={styles.headerPillText}>⚡ {xp}</Text></View></View></View>; }
function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) { return <View style={styles.navShell}><View style={styles.nav}>{tabs.map((item) => { const active = item.id === tab; return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(item.id)} style={styles.navItem}><View style={[styles.navIconWrap, active && styles.navIconWrapActive]}><Text style={[styles.navIcon, active && styles.navActive]}>{item.icon}</Text></View><Text style={[styles.navLabel, active && styles.navActive]}>{item.label}</Text></Pressable>; })}</View></View>; }

const androidTop = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight ?? 0, 20) : 0;
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.colors.background,paddingTop:androidTop},app:{flex:1,backgroundColor:theme.colors.background},content:{paddingHorizontal:16,paddingBottom:120},detailContent:{paddingHorizontal:16,paddingBottom:50},flex:{flex:1},
  header:{height:58,paddingHorizontal:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},wordmark:{color:theme.colors.text,fontSize:20,fontWeight:'900',letterSpacing:-.6},headerStats:{flexDirection:'row',gap:7},headerPill:{height:34,paddingHorizontal:10,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.05)',borderWidth:1,borderColor:'rgba(255,255,255,.08)'},headerPillText:{color:theme.colors.text,fontSize:11,fontWeight:'900'},
  navShell:{position:'absolute',left:10,right:10,bottom:10,borderRadius:24,backgroundColor:'rgba(13,18,31,.96)',borderWidth:1,borderColor:'rgba(255,255,255,.09)',padding:4,shadowColor:'#000',shadowOpacity:.35,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:12},nav:{height:67,flexDirection:'row'},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIconWrap:{width:36,height:31,borderRadius:12,alignItems:'center',justifyContent:'center'},navIconWrapActive:{backgroundColor:'rgba(112,126,255,.16)'},navIcon:{color:theme.colors.textMuted,fontSize:16,fontWeight:'900'},navLabel:{color:theme.colors.textMuted,fontSize:9,fontWeight:'700',marginTop:2},navActive:{color:'#B5BEFF'},
  heroTop:{flexDirection:'row',alignItems:'center',marginTop:8,marginBottom:15},hello:{color:theme.colors.textSecondary,fontSize:13,fontWeight:'700'},heroTitle:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:34,letterSpacing:-.8,marginTop:2},avatar:{width:50,height:50,borderRadius:18,backgroundColor:'rgba(112,126,255,.14)',borderWidth:1,borderColor:'rgba(148,159,255,.26)',alignItems:'center',justifyContent:'center'},avatarText:{color:'#CFD4FF',fontSize:18,fontWeight:'900'},avatarOnline:{position:'absolute',right:-1,bottom:-1,width:13,height:13,borderRadius:7,backgroundColor:theme.colors.success,borderWidth:3,borderColor:theme.colors.background},
  continueCard:{overflow:'hidden'},continueGlow:{position:'absolute',width:180,height:180,borderRadius:90,backgroundColor:'rgba(105,120,255,.13)',right:-65,top:-90},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},duration:{color:theme.colors.textSecondary,fontSize:11,fontWeight:'800'},continueTitle:{color:theme.colors.text,fontSize:22,fontWeight:'900',lineHeight:27,marginTop:17,letterSpacing:-.4},continueMeta:{color:theme.colors.textSecondary,fontSize:11.5,fontWeight:'700',marginTop:5,marginBottom:15},progressBlock:{marginBottom:15},progressCaption:{color:theme.colors.textMuted,fontSize:10,fontWeight:'700',marginBottom:7},stats:{flexDirection:'row',gap:8,marginTop:10},quickGrid:{flexDirection:'row',gap:10},quickAction:{flex:1,minHeight:130,borderRadius:22,backgroundColor:'rgba(255,255,255,.045)',borderWidth:1,borderColor:'rgba(255,255,255,.075)',padding:14},quickPressed:{opacity:.78,transform:[{scale:.985}]},quickIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(108,123,255,.15)',borderWidth:1,borderColor:'rgba(140,153,255,.22)'},quickIconText:{color:'#BBC4FF',fontSize:15,fontWeight:'900'},quickTitle:{color:theme.colors.text,fontSize:15,fontWeight:'900',marginTop:13},quickSubtitle:{color:theme.colors.textMuted,fontSize:10.5,fontWeight:'700',marginTop:3},courseRow:{flexDirection:'row',alignItems:'center',gap:11},courseIcon:{width:44,height:44,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.035)'},courseIconText:{fontSize:13,fontWeight:'900'},cardTitle:{color:theme.colors.text,fontSize:15,fontWeight:'900'},meta:{color:theme.colors.textMuted,fontSize:11,lineHeight:16,marginTop:4},chevron:{color:theme.colors.textMuted,fontSize:25},gapCard:{marginBottom:9},
  screenKicker:{color:'#98A5FF',fontSize:10,fontWeight:'900',letterSpacing:1.4,marginTop:12,marginBottom:8},screenTitle:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:34,letterSpacing:-.7},screenLead:{color:theme.colors.textSecondary,fontSize:13,lineHeight:19,marginTop:6,marginBottom:16},labFeatureRow:{flexDirection:'row',gap:8},labFeature:{flex:1,padding:11},labFeatureIcon:{color:'#B6BFFF',fontSize:16,fontWeight:'900'},labFeatureTitle:{color:theme.colors.text,fontSize:10.5,fontWeight:'800',marginTop:8},profileHead:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:10},profileAvatar:{width:62,height:62,borderRadius:21,backgroundColor:'rgba(111,126,255,.14)',borderWidth:1,borderColor:'rgba(148,160,255,.25)',alignItems:'center',justifyContent:'center'},profileAvatarText:{color:'#D0D5FF',fontSize:22,fontWeight:'900'},spacer8:{height:8},
  onboarding:{flex:1,paddingHorizontal:20,paddingBottom:18},onboardHeader:{height:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},stepText:{color:theme.colors.textMuted,fontSize:11,fontWeight:'800'},onboardBody:{flex:1,paddingTop:34},mentorBubble:{width:68,height:68,borderRadius:24,backgroundColor:'rgba(112,126,255,.13)',borderWidth:1,borderColor:'rgba(144,156,255,.25)',alignItems:'center',justifyContent:'center',marginBottom:22},mentorFace:{color:'#C7CEFF',fontSize:21,fontWeight:'900'},onboardTitle:{color:theme.colors.text,fontSize:31,fontWeight:'900',lineHeight:36,letterSpacing:-.8},onboardHint:{color:theme.colors.textSecondary,fontSize:13.5,lineHeight:20,marginTop:8,marginBottom:22},choiceList:{gap:9},choice:{minHeight:58,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,.08)',backgroundColor:'rgba(255,255,255,.035)',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:12},choiceActive:{borderColor:'rgba(124,139,255,.48)',backgroundColor:'rgba(102,118,255,.13)'},choiceDot:{width:20,height:20,borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,.18)',alignItems:'center',justifyContent:'center'},choiceDotActive:{borderColor:'#8E9AFF'},choiceDotInner:{width:10,height:10,borderRadius:5,backgroundColor:'#8E9AFF'},choiceText:{color:theme.colors.textSecondary,fontSize:13.5,fontWeight:'800'},choiceTextActive:{color:theme.colors.text},input:{minHeight:58,borderRadius:18,borderWidth:1,borderColor:'rgba(132,146,255,.38)',backgroundColor:'rgba(255,255,255,.045)',color:theme.colors.text,paddingHorizontal:16,fontSize:15},onboardFooter:{gap:12},backText:{color:theme.colors.textMuted,textAlign:'center',fontSize:12,fontWeight:'800',padding:8},
});