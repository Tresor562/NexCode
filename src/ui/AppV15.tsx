import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Course, GuidedProject, Lesson, courses, guidedProjects } from '../data/courses';
import { loadLocalState, LocalState, saveLocalState, LabDraft } from '../lib/localState';
import { recordSkillAttempt, buildSkillGraph } from '../learning/skillGraph';
import { courseMasterySnapshot, remediationTargets } from '../learning/masteryEngine';
import { buildAdaptivePool, planPracticeSession } from '../learning/adaptivePractice';
import { LearningHub } from './LearningHub';
import { LessonFlowScreen } from './LessonFlowScreen';
import { LabWorkspaceScreen } from './LabWorkspaceScreen';
import { Card, Pill, PrimaryButton, ProgressBar, SectionHeader, StatTile } from './components';
import { theme } from './theme';

type Tab = 'Accueil' | 'Apprendre' | 'Lab' | 'Projets' | 'Profil';
const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id:'Accueil', icon:'⌂', label:'Accueil' },
  { id:'Apprendre', icon:'◫', label:'Cours' },
  { id:'Lab', icon:'</>', label:'Lab' },
  { id:'Projets', icon:'◇', label:'Projets' },
  { id:'Profil', icon:'○', label:'Profil' },
];
const goals = ['Créer des sites Web','Apprendre la programmation','Créer des APIs','Créer des bots','Maîtriser les bases de données'];

export default function AppV15() {
  const [state, setState] = useState<LocalState>(() => loadLocalState());
  const [tab, setTab] = useState<Tab>('Accueil');
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [labLesson, setLabLesson] = useState<Lesson | null>(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(goals[0]!);

  useEffect(() => saveLocalState(state), [state]);

  const graph = useMemo(() => buildSkillGraph(courses), []);
  const adaptivePool = useMemo(() => buildAdaptivePool(courses, graph, state.mastery, state.completedLessons), [graph, state.mastery, state.completedLessons]);
  const shortSession = useMemo(() => planPracticeSession(adaptivePool, 10), [adaptivePool]);

  function openLesson(nextCourse: Course, nextLesson: Lesson) {
    setCourse(nextCourse);
    setLesson(nextLesson);
    setLabLesson(null);
    setState((current) => ({ ...current, recentCourseId: nextCourse.id }));
  }

  function recordAttempt(correct: boolean, errorTag?: string) {
    if (!lesson) return;
    setState((current) => ({
      ...current,
      xp: current.xp + (correct ? 12 : 2),
      dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 4),
      mastery: recordSkillAttempt(current.mastery, lesson, correct, new Date(), errorTag),
      lessonAttempts: { ...current.lessonAttempts, [lesson.id]: (current.lessonAttempts[lesson.id] ?? 0) + 1 },
      lessonErrorTags: !correct && errorTag
        ? { ...current.lessonErrorTags, [lesson.id]: [...new Set([...(current.lessonErrorTags[lesson.id] ?? []), errorTag])].slice(-8) }
        : current.lessonErrorTags,
      completedLessons: correct && !current.completedLessons.includes(lesson.id)
        ? [...current.completedLessons, lesson.id]
        : current.completedLessons,
    }));
  }

  function saveLab(draft: LabDraft) {
    if (!labLesson) return;
    setState((current) => ({ ...current, labDrafts: { ...current.labDrafts, [labLesson.id]: draft } }));
  }

  function completeLab(draft: LabDraft) {
    if (!labLesson || !course) return;
    setState((current) => ({
      ...current,
      xp: current.xp + 25,
      dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 8),
      mastery: recordSkillAttempt(current.mastery, { ...labLesson, activityKind: 'lab' }, true),
      labDrafts: { ...current.labDrafts, [labLesson.id]: draft },
      completedLessons: current.completedLessons.includes(labLesson.id) ? current.completedLessons : [...current.completedLessons, labLesson.id],
    }));
    setLesson(labLesson);
    setLabLesson(null);
  }

  function toggleChapterOffline(_courseId: string, chapterId: string) {
    setState((current) => ({
      ...current,
      downloadedChapters: current.downloadedChapters.includes(chapterId)
        ? current.downloadedChapters.filter((id) => id !== chapterId)
        : [...current.downloadedChapters, chapterId],
    }));
  }

  if (!state.onboardingComplete) {
    return <Onboarding name={name} goal={goal} onName={setName} onGoal={setGoal} onFinish={() => setState((current) => ({ ...current, onboardingComplete:true, name:name.trim(), learningGoal:goal }))} />;
  }

  if (labLesson && course) {
    return (
      <Shell detail>
        <LabWorkspaceScreen
          lesson={labLesson}
          stored={state.labDrafts[labLesson.id]}
          onSave={saveLab}
          onComplete={completeLab}
          onBack={() => { setLesson(labLesson); setLabLesson(null); }}
        />
      </Shell>
    );
  }

  if (lesson && course) {
    return (
      <Shell detail>
        <LessonFlowScreen
          course={course}
          lesson={lesson}
          state={state}
          onRecord={recordAttempt}
          onOpenLab={() => setLabLesson(lesson)}
          onBack={() => { setLesson(null); setCourse(null); setTab('Apprendre'); }}
        />
      </Shell>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <Header />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {tab === 'Accueil' ? <Home state={state} session={shortSession} onOpenLesson={openLesson} /> : null}
          {tab === 'Apprendre' ? <LearningHub courses={courses} state={state} onOpenLesson={openLesson} onToggleChapterOffline={toggleChapterOffline} /> : null}
          {tab === 'Lab' ? <LabLibrary state={state} onOpenLesson={openLesson} /> : null}
          {tab === 'Projets' ? <Projects state={state} setState={setState} /> : null}
          {tab === 'Profil' ? <Profile state={state} /> : null}
        </ScrollView>
        <BottomNav tab={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  );
}

function Home({ state, session, onOpenLesson }: { state: LocalState; session: ReturnType<typeof planPracticeSession>; onOpenLesson:(course:Course,lesson:Lesson)=>void }) {
  const goalProgress = Math.min(100, Math.round((state.dailyCompleted / state.dailyGoal) * 100));
  const next = session.activities[0];
  const nextCourse = next ? courses.find((item) => item.id === next.courseId) : undefined;
  const nextLesson = nextCourse?.starterLessons.find((item) => item.id === next?.lessonId);
  const repairs = remediationTargets(state.mastery).length;
  const totalLessons = courses.reduce((sum, item) => sum + item.lessons, 0);
  return (
    <View>
      <Text style={styles.eyebrow}>AUJOURD’HUI</Text>
      <Text style={styles.pageTitle}>Bonjour {state.name || 'développeur'} 👋</Text>
      <Text style={styles.pageLead}>NexCode choisit quoi travailler selon tes erreurs, ta rétention et les preuves de maîtrise — pas seulement selon l’ordre du catalogue.</Text>
      <Card tone="primary">
        <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.kicker}>OBJECTIF DU JOUR</Text><Text style={styles.heroValue}>{state.dailyCompleted}/{state.dailyGoal} min</Text></View><Pill label={`${goalProgress}%`} tone="primary" /></View>
        <ProgressBar value={goalProgress} />
      </Card>
      <View style={styles.stats}><StatTile label="XP" value={`${state.xp}`} /><StatTile label="Série" value={`${state.streak} j`} /><StatTile label="À réparer" value={`${repairs}`} /></View>
      <SectionHeader title="Recommandé maintenant" action={`${session.estimatedMinutes} min`} />
      {nextCourse && nextLesson ? (
        <Card>
          <Pill label={next?.mode ?? 'learn'} tone={next?.mode === 'repair' ? 'warning' : next?.mode === 'lab' ? 'success' : 'primary'} />
          <Text style={styles.cardTitle}>{nextLesson.title}</Text><Text style={styles.body}>{next?.reason}</Text>
          <PrimaryButton label="Commencer cette activité" onPress={() => onOpenLesson(nextCourse, nextLesson)} />
        </Card>
      ) : <Card><Text style={styles.body}>Aucune activité urgente. Explore un parcours ou entraîne-toi librement dans le Lab.</Text></Card>}
      <SectionHeader title="Bibliothèque réelle" />
      <Card><Text style={styles.heroValue}>{totalLessons.toLocaleString()} activités</Text><Text style={styles.body}>12 parcours structurés en chapitres et unités, avec pratique, Lab, debug, révisions et checkpoints. Les compteurs viennent du contenu réellement câblé au runtime.</Text></Card>
    </View>
  );
}

function LabLibrary({ state, onOpenLesson }: { state: LocalState; onOpenLesson:(course:Course,lesson:Lesson)=>void }) {
  const labActivities = courses.flatMap((course) => course.starterLessons.filter((lesson) => lesson.activityKind === 'lab').slice(0, 3).map((lesson) => ({ course, lesson })));
  const drafts = Object.keys(state.labDrafts).length;
  return <View><Text style={styles.eyebrow}>LAB</Text><Text style={styles.pageTitle}>Pratique dans un vrai contexte.</Text><Text style={styles.pageLead}>Chaque mission est liée à une compétence et produit une preuve plus forte qu’un QCM. Tes workspaces sont sauvegardés localement.</Text><Card tone="primary"><Text style={styles.kicker}>WORKSPACES</Text><Text style={styles.heroValue}>{drafts} brouillon{drafts > 1 ? 's' : ''}</Text><Text style={styles.body}>Web, JavaScript, Python, SQL, Git, Node/API et Bots utilisent des structures de fichiers adaptées.</Text></Card><SectionHeader title="Missions recommandées" action={`${labActivities.length}`} />{labActivities.map(({course,lesson}) => <Pressable key={`${course.id}:${lesson.id}`} onPress={() => onOpenLesson(course,lesson)} style={styles.projectPressable}><Card><View style={styles.rowBetween}><Pill label={course.language} tone="primary" /><Pill label={`D${lesson.difficulty ?? 1}`} /></View><Text style={styles.cardTitle}>{lesson.title}</Text><Text style={styles.body}>{lesson.labMission?.instructions ?? lesson.transferPrompt ?? lesson.concept}</Text></Card></Pressable>)}</View>;
}

function Projects({ state, setState }: { state: LocalState; setState: React.Dispatch<React.SetStateAction<LocalState>> }) {
  function advance(project: GuidedProject) {
    setState((current) => { const before=current.projectProgress[project.id] ?? 0; const next=Math.min(100,before+Math.max(10,Math.round(100/project.steps.length))); return {...current,xp:current.xp+(next>before?15:0),projectProgress:{...current.projectProgress,[project.id]:next}}; });
  }
  return <View><Text style={styles.eyebrow}>BUILD MODE</Text><Text style={styles.pageTitle}>Construis pour prouver.</Text><Text style={styles.pageLead}>Les projets servent de transfert : on combine plusieurs compétences et on crée une preuve de portfolio.</Text>{guidedProjects.map((project) => { const progress=state.projectProgress[project.id] ?? 0; return <Card key={project.id} style={styles.projectCard}><View style={styles.rowBetween}><Pill label={project.tech} tone="primary" /><Pill label={project.difficulty} tone={project.difficulty==='Facile'?'success':'warning'} /></View><Text style={styles.cardTitle}>{project.title}</Text><Text style={styles.body}>{project.description}</Text><Text style={styles.meta}>{project.skills.length} compétences • {project.steps.length} étapes • ~{project.estimatedMinutes} min</Text><ProgressBar value={progress} /><PrimaryButton label={progress>=100?'Projet terminé ✓':'Valider l’étape actuelle'} disabled={progress>=100} onPress={() => advance(project)} /></Card>; })}</View>;
}

function Profile({ state }: { state: LocalState }) {
  const snapshots = courses.map((course) => ({ course, snapshot:courseMasterySnapshot(course,state.mastery) }));
  const mastered=snapshots.reduce((sum,item)=>sum+item.snapshot.mastered,0); const skills=snapshots.reduce((sum,item)=>sum+item.snapshot.total,0);
  return <View><Text style={styles.eyebrow}>PROFIL D’APPRENTISSAGE</Text><Text style={styles.pageTitle}>{state.name || 'Développeur NexCode'}</Text><Text style={styles.pageLead}>{state.learningGoal}</Text><View style={styles.stats}><StatTile label="XP" value={`${state.xp}`} /><StatTile label="Leçons" value={`${state.completedLessons.length}`} /><StatTile label="Compétences" value={`${mastered}/${skills}`} /></View><SectionHeader title="Maîtrise par parcours" />{snapshots.map(({course,snapshot}) => <Card key={course.id} style={styles.profileCourse}><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.cardTitle}>{course.title}</Text><Text style={styles.meta}>{snapshot.mastered}/{snapshot.total} compétences solides • {snapshot.dueForReview} à revoir</Text></View><Pill label={`${snapshot.score}%`} tone={snapshot.score>=70?'success':'primary'} /></View><ProgressBar value={snapshot.score} /></Card>)}<SectionHeader title="Offline" /><Card><Text style={styles.cardTitle}>{state.downloadedChapters.length} chapitres téléchargés</Text><Text style={styles.body}>Les packs peuvent être gérés chapitre par chapitre depuis chaque parcours en Lite, Standard ou Full.</Text></Card></View>;
}

function Onboarding({name,goal,onName,onGoal,onFinish}:{name:string;goal:string;onName:(v:string)=>void;onGoal:(v:string)=>void;onFinish:()=>void}) {
  return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.onboarding}><View style={styles.logo}><Text style={styles.logoText}>NC</Text></View><Pill label="NEXUS TECH • NEXCODE" tone="primary" /><Text style={styles.onboardTitle}>Apprends pour savoir faire.</Text><Text style={styles.pageLead}>Cours profonds, répétition espacée, Lab, projets et maîtrise mesurable — même hors connexion.</Text><Text style={styles.fieldLabel}>TON PRÉNOM</Text><TextInput value={name} onChangeText={onName} placeholder="Optionnel" placeholderTextColor={theme.colors.textMuted} style={styles.input} /><Text style={styles.fieldLabel}>TON OBJECTIF</Text>{goals.map((item)=><Pressable key={item} onPress={()=>onGoal(item)} style={[styles.goal,goal===item&&styles.goalActive]}><Text style={[styles.goalText,goal===item&&styles.goalTextActive]}>{goal===item?'●':'○'}  {item}</Text></Pressable>)}<PrimaryButton label="Créer mon parcours" onPress={onFinish} /></ScrollView></SafeAreaView>;
}

function Shell({children}:{children:React.ReactNode;detail?:boolean}) { return <SafeAreaView style={styles.safe}><StatusBar style="light" /><ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>; }
function Header(){return <View style={styles.header}><View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>NC</Text></View><View><Text style={styles.brandTitle}>NexCode</Text><Text style={styles.brandSub}>Learn • Practice • Build • Master</Text></View></View><Pill label="● Offline prêt" tone="success" /></View>;}
function BottomNav({tab,onChange}:{tab:Tab;onChange:(tab:Tab)=>void}){return <View style={styles.nav}>{tabs.map((item)=>{const active=item.id===tab;return <Pressable key={item.id} onPress={()=>onChange(item.id)} accessibilityRole="button" accessibilityState={{selected:active}} style={styles.navItem}><Text style={[styles.navIcon,active&&styles.navActive]}>{item.icon}</Text><Text style={[styles.navLabel,active&&styles.navActive]}>{item.label}</Text></Pressable>})}</View>}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:theme.colors.background},app:{flex:1,backgroundColor:theme.colors.background},content:{paddingHorizontal:16,paddingBottom:112},detailContent:{paddingHorizontal:16,paddingBottom:48},flex:{flex:1},header:{paddingHorizontal:16,paddingVertical:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#101626'},brand:{flexDirection:'row',alignItems:'center',gap:9},brandMark:{width:36,height:36,borderRadius:12,backgroundColor:'#151E40',borderWidth:1,borderColor:'#4458B5',alignItems:'center',justifyContent:'center'},brandMarkText:{color:'#AEB7FF',fontWeight:'900',fontSize:12},brandTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},brandSub:{color:theme.colors.textMuted,fontSize:8,marginTop:1},nav:{position:'absolute',left:0,right:0,bottom:0,minHeight:76,paddingBottom:8,flexDirection:'row',backgroundColor:'#0B101D',borderTopWidth:1,borderTopColor:theme.colors.border},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIcon:{color:theme.colors.textMuted,fontSize:17,fontWeight:'800'},navLabel:{color:theme.colors.textMuted,fontSize:9,fontWeight:'700',marginTop:3},navActive:{color:'#9BA7FF'},eyebrow:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1.1,marginTop:12,marginBottom:7},pageTitle:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:35},pageLead:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:7,marginBottom:14},kicker:{color:'#8F9CFF',fontSize:10,fontWeight:'900',letterSpacing:1},heroValue:{color:theme.colors.text,fontSize:24,fontWeight:'900',marginTop:3,marginBottom:10},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},stats:{flexDirection:'row',gap:7,marginTop:10},cardTitle:{color:theme.colors.text,fontSize:16,fontWeight:'850',marginTop:8,marginBottom:3},body:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginVertical:7},meta:{color:theme.colors.textMuted,fontSize:10,lineHeight:15,marginVertical:8},projectPressable:{marginBottom:10},projectCard:{marginBottom:10},profileCourse:{marginBottom:9},onboarding:{padding:20,paddingBottom:50},logo:{width:56,height:56,borderRadius:18,backgroundColor:'#151E40',borderWidth:1,borderColor:'#4458B5',alignItems:'center',justifyContent:'center',marginBottom:12},logoText:{color:'#AEB7FF',fontSize:17,fontWeight:'900'},onboardTitle:{color:theme.colors.text,fontSize:34,fontWeight:'900',lineHeight:39,marginTop:18},fieldLabel:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1,marginTop:18,marginBottom:7},input:{minHeight:48,borderRadius:14,borderWidth:1,borderColor:theme.colors.border,backgroundColor:theme.colors.surface,color:theme.colors.text,paddingHorizontal:14},goal:{minHeight:46,borderRadius:13,borderWidth:1,borderColor:theme.colors.border,paddingHorizontal:13,justifyContent:'center',marginBottom:7},goalActive:{backgroundColor:'#151E40',borderColor:'#465BBD'},goalText:{color:theme.colors.textSecondary,fontSize:13,fontWeight:'700'},goalTextActive:{color:theme.colors.text}});
