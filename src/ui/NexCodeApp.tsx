import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, SafeAreaView, ScrollView, StatusBar as RNStatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Course, Lesson, courses, guidedProjects } from '../data/courses';
import { LabDraft, loadLocalState, LocalState, saveLocalState } from '../lib/localState';
import { buildAdaptivePool, planPracticeSession } from '../learning/adaptivePractice';
import { buildChapterOfflinePack, OfflinePackKind } from '../learning/offlineEngine';
import { courseMasterySnapshot } from '../learning/masteryEngine';
import { advanceProjectProgress, recordPortfolioProof } from '../learning/projectProgressEngine';
import { recordLessonOutcome, rewardLearningCompletion } from '../learning/sessionEngine';
import { buildSkillGraph } from '../learning/skillGraph';
import { LearningHub } from './LearningHub';
import { LessonFlowScreen } from './LessonFlowScreen';
import { LabWorkspaceScreen } from './LabWorkspaceScreen';
import { ProjectPortfolioScreen } from './ProjectPortfolioScreen';
import { Card, GlassCard, Pill, ProgressBar, SectionHeader, StatTile } from './components';
import { NavGlyph, NavGlyphName } from './NavGlyph';
import { theme } from './theme';

type Tab = 'Accueil' | 'Apprendre' | 'Lab' | 'Projets' | 'Profil';
const tabs: Array<{ id: Tab; icon: NavGlyphName; label: string }> = [
  { id: 'Accueil', icon: 'home', label: 'Accueil' },
  { id: 'Apprendre', icon: 'learn', label: 'Apprendre' },
  { id: 'Lab', icon: 'lab', label: 'Lab' },
  { id: 'Projets', icon: 'projects', label: 'Projets' },
  { id: 'Profil', icon: 'profile', label: 'Profil' },
];
const goals = ['Créer des sites Web', 'Apprendre la programmation', 'Créer des APIs', 'Créer des bots', 'Maîtriser les bases de données'];
const levels = ['Je débute', 'J’ai quelques bases', 'Je code déjà'];

export default function NexCodeApp() {
  const [state, setState] = useState<LocalState>(() => loadLocalState());
  const [tab, setTab] = useState<Tab>('Apprendre');
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
    setState((current) => recordLessonOutcome(current, activeLesson, correct, errorTag).state);
  }

  function saveLabDraft(draft: LabDraft) {
    if (labLesson) setState((current) => ({ ...current, labDrafts: { ...current.labDrafts, [labLesson.id]: draft } }));
  }

  function completeLab(draft: LabDraft) {
    if (!labLesson) return;
    const completed = { ...labLesson, activityKind: 'lab' as const };
    setState((current) => {
      const attempted = recordLessonOutcome(current, completed, true, undefined).state;
      const rewarded = rewardLearningCompletion(attempted, completed);
      return {
        ...rewarded,
        labDrafts: { ...rewarded.labDrafts, [completed.id]: draft },
      };
    });
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

  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><View style={styles.app}>
    <Header streak={state.streak} xp={state.xp} nexCoins={state.nexCoins} />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {tab === 'Accueil' ? <Home state={state} session={quickSession} onOpenLesson={openLesson} onOpenLearn={() => setTab('Apprendre')} onOpenLab={() => setTab('Lab')} /> : null}
      {tab === 'Apprendre' ? <LearningHub courses={courses} state={state} onOpenLesson={openLesson} onToggleChapterOffline={toggleChapterOffline} /> : null}
      {tab === 'Lab' ? <LabLibrary state={state} onOpenLesson={openLesson} /> : null}
      {tab === 'Projets' ? <ProjectPortfolioScreen projects={guidedProjects} graph={graph} state={state} onProgress={(project, progress) => setState((current) => advanceProjectProgress(current, project, progress))} onProof={(proof) => setState((current) => recordPortfolioProof(current, proof))} onSaveProjectDraft={(project, draft) => setState((current) => ({ ...current, projectDrafts: { ...current.projectDrafts, [project.id]: draft } }))} /> : null}
      {tab === 'Profil' ? <Profile state={state} /> : null}
    </ScrollView>
    <BottomNav tab={tab} onChange={setTab} />
  </View></SafeAreaView>;
}

function Home({ state, session, onOpenLesson, onOpenLearn, onOpenLab }: { state: LocalState; session: ReturnType<typeof planPracticeSession>; onOpenLesson: (course: Course, lesson: Lesson) => void; onOpenLearn: () => void; onOpenLab: () => void }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start(); }, [entrance]);
  const progress = Math.min(100, Math.round((state.dailyCompleted / Math.max(1, state.dailyGoal)) * 100));
  const next = session.activities[0];
  const nextCourse = next ? courses.find((course) => course.id === next.courseId) : undefined;
  const nextLesson = nextCourse?.starterLessons.find((lesson) => lesson.id === next?.lessonId);
  const recentCourse = courses.find((course) => course.id === state.recentCourseId) ?? courses[0];
  const recentNext = recentCourse?.starterLessons.find((lesson) => !state.completedLessons.includes(lesson.id)) ?? recentCourse?.starterLessons[0];
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
    <View style={styles.heroTop}><View style={styles.flex}><Text style={styles.hello}>{state.name ? `Salut ${state.name}` : 'Salut 👋'}</Text><Text style={styles.heroTitle}>Continue ton parcours.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{(state.name || 'N').slice(0, 1).toUpperCase()}</Text><View style={styles.avatarOnline} /></View></View>
    <Pressable onPress={() => nextCourse && nextLesson ? onOpenLesson(nextCourse, nextLesson) : recentCourse && recentNext ? onOpenLesson(recentCourse, recentNext) : onOpenLearn()} style={({ pressed }) => [styles.nextCard, pressed && styles.quickPressed]}>
      <View style={styles.nextGlow} /><View style={styles.rowBetween}><Pill label="PROCHAINE ÉTAPE" tone="primary" /><Text style={styles.duration}>{session.estimatedMinutes || 10} min</Text></View><Text style={styles.nextCourse}>{nextCourse?.title ?? recentCourse?.title ?? 'NexCode'}</Text><Text style={styles.nextTitle}>{nextLesson?.title ?? recentNext?.title ?? 'Choisis ton premier parcours'}</Text><View style={styles.progressBlock}><View style={styles.rowBetween}><Text style={styles.progressCaption}>Aujourd’hui</Text><Text style={styles.progressCaption}>{progress}%</Text></View><ProgressBar value={progress} /></View><View style={styles.continueRow}><Text style={styles.continueText}>CONTINUER</Text><Text style={styles.continueArrow}>›</Text></View>
    </Pressable>
    <View style={styles.stats}><StatTile label="Série" value={`${state.streak}`} /><StatTile label="XP" value={`${state.xp}`} /><StatTile label="NexCoins" value={`${state.nexCoins}`} /></View>
    <SectionHeader title="Créer" /><View style={styles.quickGrid}><QuickAction title="Code Lab" subtitle="Coder, tester, importer" onPress={onOpenLab} /><QuickAction title="Parcours" subtitle="Reprendre le chemin" onPress={onOpenLearn} /></View>
  </Animated.View>;
}

function QuickAction({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.quickPressed]}><View style={styles.quickAccent} /><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickSubtitle}>{subtitle}</Text><Text style={styles.quickArrow}>›</Text></Pressable>;
}

function LabLibrary({ state, onOpenLesson }: { state: LocalState; onOpenLesson: (course: Course, lesson: Lesson) => void }) {
  const labs = courses.flatMap((course) => course.starterLessons.filter((lesson) => lesson.activityKind === 'lab').slice(0, 2).map((lesson) => ({ course, lesson })));
  return <View><Text style={styles.screenKicker}>CODE LAB</Text><Text style={styles.screenTitle}>Ton espace de code.</Text><Text style={styles.screenLead}>Édite, importe des fichiers, teste et visualise tes projets.</Text><View style={styles.labFeatureRow}><GlassCard style={styles.labFeature}><Text style={styles.labFeatureTitle}>Fichiers</Text><Text style={styles.labFeatureMeta}>Importer</Text></GlassCard><GlassCard style={styles.labFeature}><Text style={styles.labFeatureTitle}>Code</Text><Text style={styles.labFeatureMeta}>Éditer</Text></GlassCard><GlassCard style={styles.labFeature}><Text style={styles.labFeatureTitle}>Preview</Text><Text style={styles.labFeatureMeta}>Voir</Text></GlassCard></View><SectionHeader title="Missions" action={`${Object.keys(state.labDrafts).length} brouillon(s)`} />{labs.map(({ course, lesson }) => <Pressable key={`${course.id}:${lesson.id}`} onPress={() => onOpenLesson(course, lesson)} style={styles.gapCard}><Card><View style={styles.rowBetween}><Pill label={course.language} tone="primary" /><Text style={styles.chevron}>›</Text></View><Text style={styles.cardTitle}>{lesson.title}</Text><Text style={styles.meta}>{lesson.labMission?.instructions ?? lesson.concept}</Text></Card></Pressable>)}</View>;
}

function Profile({ state }: { state: LocalState }) {
  const snapshots = courses.map((course) => ({ course, snapshot: courseMasterySnapshot(course, state.mastery) }));
  const mastered = snapshots.reduce((sum, item) => sum + item.snapshot.mastered, 0);
  const skills = snapshots.reduce((sum, item) => sum + item.snapshot.total, 0);
  return <View><Text style={styles.screenKicker}>PROFIL</Text><View style={styles.profileHead}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(state.name || 'N').slice(0, 1).toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.screenTitle}>{state.name || 'Développeur NexCode'}</Text><Text style={styles.screenLead}>{state.learningGoal}</Text></View></View><View style={styles.stats}><StatTile label="XP" value={`${state.xp}`} /><StatTile label="NexCoins" value={`${state.nexCoins}`} /><StatTile label="Série" value={`${state.streak}`} /></View><SectionHeader title="Compétences" action={`${mastered}/${skills}`} />{snapshots.slice(0, 6).map(({ course, snapshot }) => <Card key={course.id} style={styles.gapCard}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{course.title}</Text><Pill label={`${snapshot.score}%`} tone={snapshot.score >= 70 ? 'success' : 'primary'} /></View><View style={styles.spacer8} /><ProgressBar value={snapshot.score} /></Card>)}</View>;
}

function Onboarding({ name, goal, onName, onGoal, onFinish }: { name: string; goal: string; onName: (value: string) => void; onGoal: (value: string) => void; onFinish: () => void }) {
  const [step, setStep] = useState(0); const [level, setLevel] = useState(levels[0]!); const progress = ((step + 1) / 3) * 100;
  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><View style={styles.onboarding}><View style={styles.onboardHeader}><Text style={styles.wordmark}>NexCode</Text><Text style={styles.stepText}>{step + 1}/3</Text></View><ProgressBar value={progress} /><View style={styles.onboardBody}><View style={styles.mentorBot}><View style={styles.botAntenna} /><View style={styles.botEyeRow}><View style={styles.botEye} /><View style={styles.botEye} /></View><View style={styles.botMouth} /></View>{step === 0 ? <><Text style={styles.onboardTitle}>Qu’est-ce que tu veux construire ?</Text><Text style={styles.onboardHint}>On crée ton premier chemin à partir de cet objectif.</Text><View style={styles.choiceList}>{goals.map((item) => <Choice key={item} label={item} selected={goal === item} onPress={() => onGoal(item)} />)}</View></> : null}{step === 1 ? <><Text style={styles.onboardTitle}>Tu pars d’où ?</Text><Text style={styles.onboardHint}>Choisis simplement ce qui te ressemble aujourd’hui.</Text><View style={styles.choiceList}>{levels.map((item) => <Choice key={item} label={item} selected={level === item} onPress={() => setLevel(item)} />)}</View></> : null}{step === 2 ? <><Text style={styles.onboardTitle}>Comment on t’appelle ?</Text><Text style={styles.onboardHint}>Ton nom apparaîtra sur ton profil et tes réussites.</Text><TextInput value={name} onChangeText={onName} placeholder="Ton prénom ou pseudo" placeholderTextColor={theme.colors.textMuted} style={styles.input} autoFocus /></> : null}</View><View style={styles.onboardFooter}><Pressable onPress={() => step < 2 ? setStep((value) => value + 1) : onFinish()} style={({ pressed }) => [styles.primary, pressed && styles.quickPressed]}><Text style={styles.primaryText}>{step < 2 ? 'Continuer' : 'Entrer dans NexCode'}</Text></Pressable>{step > 0 ? <Pressable onPress={() => setStep((value) => value - 1)}><Text style={styles.backText}>Retour</Text></Pressable> : null}</View></View></SafeAreaView>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.choice, selected && styles.choiceActive, pressed && styles.quickPressed]}><View style={[styles.choiceDot, selected && styles.choiceDotActive]}>{selected ? <View style={styles.choiceDotInner} /> : null}</View><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{label}</Text></Pressable>; }
function DetailShell({ children }: { children: React.ReactNode }) { return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView></SafeAreaView>; }
function Header({ streak, xp, nexCoins }: { streak: number; xp: number; nexCoins: number }) { return <View style={styles.header}><Text style={styles.wordmark}>NexCode</Text><View style={styles.headerStats}><Metric mark="S" value={streak} /><Metric mark="XP" value={xp} /><Metric mark="N" value={nexCoins} /></View></View>; }
function Metric({ mark, value }: { mark: string; value: number }) { return <View style={styles.headerMetric}><View style={styles.metricMark}><Text style={styles.metricMarkText}>{mark}</Text></View><Text style={styles.metricValue}>{value}</Text></View>; }
function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) { return <View style={styles.navShell}><View style={styles.nav}>{tabs.map((item) => { const active = item.id === tab; return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(item.id)} style={styles.navItem}><View style={[styles.navIconWrap, active && styles.navIconWrapActive]}><NavGlyph name={item.icon} active={active} /></View><Text style={[styles.navLabel, active && styles.navActive]}>{item.label}</Text></Pressable>; })}</View></View>; }

const androidTop = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight ?? 0, 20) : 0;
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.colors.background,paddingTop:androidTop},app:{flex:1,backgroundColor:theme.colors.background},content:{paddingHorizontal:16,paddingBottom:120},detailContent:{paddingHorizontal:16,paddingBottom:50},flex:{flex:1},
  header:{height:60,paddingHorizontal:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},wordmark:{color:theme.colors.text,fontSize:20,fontWeight:'900',letterSpacing:-.7},headerStats:{flexDirection:'row',alignItems:'center',gap:7},headerMetric:{height:34,paddingHorizontal:8,borderRadius:13,flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,.045)',borderWidth:1,borderColor:'rgba(255,255,255,.08)'},metricMark:{minWidth:18,height:18,paddingHorizontal:3,borderRadius:6,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(107,124,255,.18)'},metricMarkText:{color:'#AEB9FF',fontSize:7,fontWeight:'900'},metricValue:{color:theme.colors.text,fontSize:10.5,fontWeight:'900'},
  navShell:{position:'absolute',left:10,right:10,bottom:10,borderRadius:25,backgroundColor:'rgba(13,18,31,.96)',borderWidth:1,borderColor:'rgba(255,255,255,.09)',padding:4,shadowColor:'#000',shadowOpacity:.34,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:12},nav:{height:69,flexDirection:'row'},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIconWrap:{width:42,height:34,borderRadius:13,alignItems:'center',justifyContent:'center'},navIconWrapActive:{backgroundColor:'rgba(112,126,255,.15)'},navLabel:{color:theme.colors.textMuted,fontSize:8.5,fontWeight:'700',marginTop:1},navActive:{color:'#B9C2FF'},
  heroTop:{flexDirection:'row',alignItems:'center',marginTop:8,marginBottom:15},hello:{color:theme.colors.textSecondary,fontSize:12.5,fontWeight:'700'},heroTitle:{color:theme.colors.text,fontSize:30,fontWeight:'900',lineHeight:35,letterSpacing:-.9,marginTop:2},avatar:{width:48,height:48,borderRadius:17,backgroundColor:'rgba(112,126,255,.13)',borderWidth:1,borderColor:'rgba(148,159,255,.25)',alignItems:'center',justifyContent:'center'},avatarText:{color:'#CFD4FF',fontSize:17,fontWeight:'900'},avatarOnline:{position:'absolute',right:-1,bottom:-1,width:12,height:12,borderRadius:6,backgroundColor:theme.colors.success,borderWidth:3,borderColor:theme.colors.background},
  nextCard:{minHeight:260,borderRadius:27,padding:18,overflow:'hidden',backgroundColor:'rgba(57,71,142,.22)',borderWidth:1,borderColor:'rgba(126,142,255,.28)'},nextGlow:{position:'absolute',width:220,height:220,borderRadius:110,backgroundColor:'rgba(100,119,255,.14)',right:-90,top:-100},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},duration:{color:theme.colors.textSecondary,fontSize:10.5,fontWeight:'800'},nextCourse:{color:'#9FABFF',fontSize:10,fontWeight:'900',letterSpacing:1,marginTop:19},nextTitle:{color:theme.colors.text,fontSize:24,fontWeight:'900',lineHeight:29,marginTop:5,letterSpacing:-.5},progressBlock:{marginTop:20,marginBottom:18},progressCaption:{color:theme.colors.textMuted,fontSize:9.5,fontWeight:'700',marginBottom:7},continueRow:{height:51,borderRadius:17,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#697AFF'},continueText:{color:'#fff',fontSize:12,fontWeight:'900',letterSpacing:.5},continueArrow:{color:'#fff',fontSize:25,fontWeight:'500'},
  stats:{flexDirection:'row',gap:8,marginTop:10},quickGrid:{flexDirection:'row',gap:10},quickAction:{flex:1,minHeight:122,borderRadius:22,backgroundColor:'rgba(255,255,255,.04)',borderWidth:1,borderColor:'rgba(255,255,255,.075)',padding:14,overflow:'hidden'},quickAccent:{position:'absolute',width:74,height:74,borderRadius:37,right:-24,top:-27,backgroundColor:'rgba(103,121,255,.11)'},quickPressed:{opacity:.78,transform:[{scale:.985}]},quickTitle:{color:theme.colors.text,fontSize:15,fontWeight:'900',marginTop:14},quickSubtitle:{color:theme.colors.textMuted,fontSize:10.5,fontWeight:'700',lineHeight:15,marginTop:4,maxWidth:'82%'},quickArrow:{position:'absolute',right:13,bottom:11,color:'#7D89A9',fontSize:24},
  cardTitle:{color:theme.colors.text,fontSize:15,fontWeight:'900'},meta:{color:theme.colors.textMuted,fontSize:11,lineHeight:16,marginTop:4},chevron:{color:theme.colors.textMuted,fontSize:25},gapCard:{marginBottom:9},screenKicker:{color:'#98A5FF',fontSize:10,fontWeight:'900',letterSpacing:1.4,marginTop:12,marginBottom:8},screenTitle:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:34,letterSpacing:-.7},screenLead:{color:theme.colors.textSecondary,fontSize:13,lineHeight:19,marginTop:6,marginBottom:16},labFeatureRow:{flexDirection:'row',gap:8},labFeature:{flex:1,padding:11},labFeatureTitle:{color:theme.colors.text,fontSize:11,fontWeight:'900'},labFeatureMeta:{color:theme.colors.textMuted,fontSize:9.5,fontWeight:'700',marginTop:5},profileHead:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:10},profileAvatar:{width:62,height:62,borderRadius:21,backgroundColor:'rgba(111,126,255,.14)',borderWidth:1,borderColor:'rgba(148,160,255,.25)',alignItems:'center',justifyContent:'center'},profileAvatarText:{color:'#D0D5FF',fontSize:22,fontWeight:'900'},spacer8:{height:8},
  onboarding:{flex:1,paddingHorizontal:20,paddingBottom:18},onboardHeader:{height:62,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},stepText:{color:theme.colors.textMuted,fontSize:11,fontWeight:'800'},onboardBody:{flex:1,paddingTop:30},mentorBot:{width:68,height:62,borderRadius:22,backgroundColor:'rgba(112,126,255,.14)',borderWidth:1,borderColor:'rgba(144,156,255,.27)',alignItems:'center',justifyContent:'center',marginBottom:22},botAntenna:{position:'absolute',top:-9,width:3,height:10,borderRadius:2,backgroundColor:'#8E9AFF'},botEyeRow:{flexDirection:'row',gap:11},botEye:{width:7,height:7,borderRadius:4,backgroundColor:'#DDE3FF'},botMouth:{width:20,height:3,borderRadius:2,backgroundColor:'#8998FF',marginTop:8},onboardTitle:{color:theme.colors.text,fontSize:31,fontWeight:'900',lineHeight:36,letterSpacing:-.8},onboardHint:{color:theme.colors.textSecondary,fontSize:13.5,lineHeight:20,marginTop:8,marginBottom:22},choiceList:{gap:9},choice:{minHeight:58,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,.08)',backgroundColor:'rgba(255,255,255,.035)',paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:12},choiceActive:{borderColor:'rgba(124,139,255,.48)',backgroundColor:'rgba(102,118,255,.13)'},choiceDot:{width:20,height:20,borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,.18)',alignItems:'center',justifyContent:'center'},choiceDotActive:{borderColor:'#8E9AFF'},choiceDotInner:{width:10,height:10,borderRadius:5,backgroundColor:'#8E9AFF'},choiceText:{color:theme.colors.textSecondary,fontSize:13.5,fontWeight:'800'},choiceTextActive:{color:theme.colors.text},input:{minHeight:58,borderRadius:18,borderWidth:1,borderColor:'rgba(132,146,255,.38)',backgroundColor:'rgba(255,255,255,.045)',color:theme.colors.text,paddingHorizontal:16,fontSize:15},onboardFooter:{gap:12},primary:{minHeight:58,borderRadius:18,backgroundColor:'#6578FF',alignItems:'center',justifyContent:'center'},primaryText:{color:'#fff',fontSize:14,fontWeight:'900'},backText:{color:theme.colors.textMuted,textAlign:'center',fontSize:12,fontWeight:'800',padding:8},
});
