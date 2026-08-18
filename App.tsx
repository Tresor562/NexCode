import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Course,
  GuidedProject,
  Lesson,
  courses,
  guidedProjects,
  practiceTemplates,
} from './src/data/courses';
import { loadLocalState, LocalState, saveLocalState } from './src/lib/localState';
import { checkPractice, PracticeLanguage } from './src/lib/practice';
import {
  Card,
  Pill,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  SectionHeader,
  StatTile,
} from './src/ui/components';
import { theme } from './src/ui/theme';

type Tab = 'Accueil' | 'Apprendre' | 'Lab' | 'Projets' | 'Profil';

const tabs: { id: Tab; icon: string; label: string }[] = [
  { id: 'Accueil', icon: '⌂', label: 'Accueil' },
  { id: 'Apprendre', icon: '◫', label: 'Cours' },
  { id: 'Lab', icon: '</>', label: 'Lab' },
  { id: 'Projets', icon: '◇', label: 'Projets' },
  { id: 'Profil', icon: '○', label: 'Profil' },
];

const labLanguages: PracticeLanguage[] = ['HTML/CSS', 'JavaScript', 'Python', 'SQL'];

const learningGoals = [
  'Créer des sites Web',
  'Apprendre la programmation',
  'Apprendre Python',
  'Comprendre les bases de données',
];

export default function App() {
  const [tab, setTab] = useState<Tab>('Accueil');
  const [state, setState] = useState<LocalState>(() => loadLocalState());
  const [draftName, setDraftName] = useState('');
  const [draftGoal, setDraftGoal] = useState(learningGoals[0]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState<PracticeLanguage>('HTML/CSS');
  const [source, setSource] = useState(practiceTemplates['HTML/CSS']);
  const [result, setResult] = useState('Prêt. Ton exercice sera vérifié directement sur l’appareil.');

  useEffect(() => {
    saveLocalState(state);
  }, [state]);

  const downloadedMb = useMemo(
    () =>
      courses
        .filter((course) => state.downloadedCourses.includes(course.id))
        .reduce((total, course) => total + course.offlineSizeMb, 0),
    [state.downloadedCourses],
  );

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedLesson =
    selectedCourse?.starterLessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const selectedProject =
    guidedProjects.find((project) => project.id === selectedProjectId) ?? null;

  const recentCourse =
    courses.find((course) => course.id === state.recentCourseId) ?? courses[0];
  const recentLesson =
    recentCourse.starterLessons.find((lesson) => !state.completedLessons.includes(lesson.id)) ??
    recentCourse.starterLessons[0];

  const goalProgress = Math.min(100, Math.round((state.dailyCompleted / state.dailyGoal) * 100));

  function openCourse(course: Course) {
    setSelectedProjectId(null);
    setSelectedLessonId(null);
    setAnswerIndex(null);
    setSelectedCourseId(course.id);
    setState((current) => ({ ...current, recentCourseId: course.id }));
  }

  function openLesson(course: Course, lesson: Lesson) {
    setSelectedCourseId(course.id);
    setSelectedLessonId(lesson.id);
    setAnswerIndex(null);
  }

  function openProject(project: GuidedProject) {
    setSelectedCourseId(null);
    setSelectedLessonId(null);
    setSelectedProjectId(project.id);
  }

  function closeDetail() {
    setSelectedCourseId(null);
    setSelectedLessonId(null);
    setSelectedProjectId(null);
    setAnswerIndex(null);
  }

  function completeOnboarding() {
    setState((current) => ({
      ...current,
      onboardingComplete: true,
      name: draftName.trim(),
      learningGoal: draftGoal,
    }));
  }

  function toggleDownload(courseId: string) {
    setState((current) => ({
      ...current,
      downloadedCourses: current.downloadedCourses.includes(courseId)
        ? current.downloadedCourses.filter((id) => id !== courseId)
        : [...current.downloadedCourses, courseId],
    }));
  }

  function completeLesson(lesson: Lesson) {
    setState((current) => {
      if (current.completedLessons.includes(lesson.id)) return current;
      return {
        ...current,
        xp: current.xp + 20,
        dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 8),
        completedLessons: [...current.completedLessons, lesson.id],
      };
    });
  }

  function advanceProject(project: GuidedProject) {
    setState((current) => {
      const currentProgress = current.projectProgress[project.id] ?? 0;
      const step = 100 / project.steps.length;
      const nextProgress = Math.min(100, Math.round(currentProgress + step));
      return {
        ...current,
        xp: nextProgress > currentProgress ? current.xp + 15 : current.xp,
        dailyCompleted: Math.min(current.dailyGoal, current.dailyCompleted + 5),
        projectProgress: {
          ...current.projectProgress,
          [project.id]: nextProgress,
        },
      };
    });
  }

  function selectLanguage(next: PracticeLanguage) {
    setLanguage(next);
    setSource(practiceTemplates[next]);
    setResult('Prêt. Ton exercice sera vérifié directement sur l’appareil.');
  }

  if (!state.onboardingComplete) {
    return (
      <Onboarding
        name={draftName}
        goal={draftGoal}
        onNameChange={setDraftName}
        onGoalChange={setDraftGoal}
        onContinue={completeOnboarding}
      />
    );
  }

  if (selectedLesson && selectedCourse) {
    return (
      <LessonScreen
        course={selectedCourse}
        lesson={selectedLesson}
        answerIndex={answerIndex}
        completed={state.completedLessons.includes(selectedLesson.id)}
        onAnswer={setAnswerIndex}
        onComplete={() => completeLesson(selectedLesson)}
        onBack={() => {
          setSelectedLessonId(null);
          setAnswerIndex(null);
        }}
      />
    );
  }

  if (selectedCourse) {
    return (
      <CourseScreen
        course={selectedCourse}
        completedLessons={state.completedLessons}
        downloaded={state.downloadedCourses.includes(selectedCourse.id)}
        onBack={closeDetail}
        onToggleDownload={() => toggleDownload(selectedCourse.id)}
        onLesson={(lesson) => openLesson(selectedCourse, lesson)}
      />
    );
  }

  if (selectedProject) {
    return (
      <ProjectScreen
        project={selectedProject}
        progress={state.projectProgress[selectedProject.id] ?? 0}
        onBack={closeDetail}
        onAdvance={() => advanceProject(selectedProject)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <AppHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'Accueil' && (
            <HomeScreen
              state={state}
              goalProgress={goalProgress}
              recentCourse={recentCourse}
              recentLesson={recentLesson}
              onContinue={() => openLesson(recentCourse, recentLesson)}
              onLearn={() => setTab('Apprendre')}
              onLab={() => setTab('Lab')}
              onProjects={() => setTab('Projets')}
              onOffline={() => setTab('Profil')}
              onProject={(project) => openProject(project)}
            />
          )}

          {tab === 'Apprendre' && (
            <LearnScreen
              state={state}
              onCourse={openCourse}
              onToggleDownload={toggleDownload}
            />
          )}

          {tab === 'Lab' && (
            <LabScreen
              language={language}
              source={source}
              result={result}
              onLanguage={selectLanguage}
              onSource={setSource}
              onRun={() => setResult(checkPractice(language, source))}
            />
          )}

          {tab === 'Projets' && (
            <ProjectsScreen
              state={state}
              onProject={(project) => openProject(project)}
            />
          )}

          {tab === 'Profil' && (
            <ProfileScreen
              state={state}
              downloadedMb={downloadedMb}
              onToggleDownload={toggleDownload}
            />
          )}
        </ScrollView>
        <BottomNav tab={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  );
}

function Onboarding({
  name,
  goal,
  onNameChange,
  onGoalChange,
  onContinue,
}: {
  name: string;
  goal: string;
  onNameChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onContinue: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.onboarding} keyboardShouldPersistTaps="handled">
        <View style={styles.logoMark}>
          <Text style={styles.logoMarkText}>NC</Text>
        </View>
        <Pill label="NEXUS TECH • NEXCODE" tone="primary" />
        <Text style={styles.heroTitle}>Apprends. Pratique. Construis.</Text>
        <Text style={styles.heroText}>
          Une première version légère pensée pour t’emmener du premier concept au premier vrai projet,
          même avec une connexion limitée.
        </Text>

        <View style={styles.onboardingFeatureRow}>
          <MiniFeature icon="↓" title="Offline" text="Cours et progression locale" />
          <MiniFeature icon="</>" title="Lab" text="Pratique directement sur mobile" />
          <MiniFeature icon="◇" title="Projets" text="Construis pour apprendre" />
        </View>

        <Text style={styles.fieldLabel}>COMMENT VEUX-TU QU’ON T’APPELLE ?</Text>
        <TextInput
          value={name}
          onChangeText={onNameChange}
          placeholder="Ton prénom (optionnel)"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.textField}
          autoCapitalize="words"
          returnKeyType="done"
        />

        <Text style={styles.fieldLabel}>TON OBJECTIF PRINCIPAL</Text>
        <View style={styles.goalList}>
          {learningGoals.map((item) => (
            <Pressable
              key={item}
              onPress={() => onGoalChange(item)}
              style={({ pressed }) => [
                styles.goalOption,
                goal === item && styles.goalOptionActive,
                pressed && styles.pressFade,
              ]}
            >
              <View style={[styles.radio, goal === item && styles.radioActive]}>
                {goal === item ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={[styles.goalText, goal === item && styles.goalTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <PrimaryButton label="Créer mon parcours" onPress={onContinue} />
        <Text style={styles.privacyNote}>
          Aucun compte n’est requis pour commencer. Ta progression reste sur ton appareil.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AppHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>NC</Text>
        </View>
        <View>
          <Text style={styles.brand}>NexCode</Text>
          <Text style={styles.brandSubtitle}>Learn • Practice • Build</Text>
        </View>
      </View>
      <Pill label="● Offline prêt" tone="success" />
    </View>
  );
}

function HomeScreen({
  state,
  goalProgress,
  recentCourse,
  recentLesson,
  onContinue,
  onLearn,
  onLab,
  onProjects,
  onOffline,
  onProject,
}: {
  state: LocalState;
  goalProgress: number;
  recentCourse: Course;
  recentLesson: Lesson;
  onContinue: () => void;
  onLearn: () => void;
  onLab: () => void;
  onProjects: () => void;
  onOffline: () => void;
  onProject: (project: GuidedProject) => void;
}) {
  const name = state.name || 'développeur';
  const currentProject = guidedProjects.find((item) => (state.projectProgress[item.id] ?? 0) < 100) ?? guidedProjects[0];
  const projectProgress = state.projectProgress[currentProject.id] ?? 0;

  return (
    <>
      <Text style={styles.eyebrow}>AUJOURD’HUI</Text>
      <Text style={styles.pageTitle}>Bonjour {name} 👋</Text>
      <Text style={styles.pageLead}>
        Une petite session suffit. Ton objectif : progresser, pas juste collectionner des points.
      </Text>

      <Card tone="primary" style={styles.heroCard}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardEyebrow}>OBJECTIF DU JOUR</Text>
            <Text style={styles.heroCardTitle}>
              {state.dailyCompleted}/{state.dailyGoal} min de pratique
            </Text>
          </View>
          <View style={styles.goalBubble}>
            <Text style={styles.goalBubbleValue}>{goalProgress}%</Text>
          </View>
        </View>
        <ProgressBar value={goalProgress} />
        <Text style={styles.cardHint}>
          {goalProgress >= 100
            ? 'Objectif atteint. Tu peux continuer sans pression.'
            : `${Math.max(0, state.dailyGoal - state.dailyCompleted)} min pour terminer ta mission.`}
        </Text>
      </Card>

      <View style={styles.statRow}>
        <StatTile label="Série" value={`🔥 ${state.streak} j`} hint="Régularité" />
        <StatTile label="XP" value={`⚡ ${state.xp}`} hint="Progression" />
        <StatTile label="Cours offline" value={`${state.downloadedCourses.length}`} hint="Disponibles" />
      </View>

      <SectionHeader title="Continuer" action={recentCourse.language} />
      <Pressable onPress={onContinue} style={({ pressed }) => pressed && styles.pressFade}>
        <Card>
          <View style={styles.courseHeadline}>
            <CourseBadge course={recentCourse} />
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{recentCourse.title}</Text>
              <Text style={styles.metaText}>{recentLesson.durationMin} min • prochaine leçon</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={styles.lessonTitle}>{recentLesson.title}</Text>
          <Text style={styles.cardBody}>{recentLesson.concept}</Text>
          <View style={styles.inlineProgress}>
            <View style={styles.flex}><ProgressBar value={courseProgress(recentCourse, state.completedLessons)} /></View>
            <Text style={styles.progressLabel}>{courseProgress(recentCourse, state.completedLessons)}%</Text>
          </View>
        </Card>
      </Pressable>

      <SectionHeader title="Accès rapide" />
      <View style={styles.quickGrid}>
        <QuickAction icon="◫" title="Apprendre" subtitle="Reprendre un cours" onPress={onLearn} />
        <QuickAction icon="</>" title="Lab" subtitle="Tester du code" onPress={onLab} />
        <QuickAction icon="◇" title="Projets" subtitle="Construire" onPress={onProjects} />
        <QuickAction icon="↓" title="Offline" subtitle="Gérer les packs" onPress={onOffline} />
      </View>

      <SectionHeader title="Projet actuel" action={`${projectProgress}%`} />
      <Pressable onPress={() => onProject(currentProject)} style={({ pressed }) => pressed && styles.pressFade}>
        <Card>
          <View style={styles.rowBetween}>
            <Pill label={currentProject.tech} tone="primary" />
            <Pill label={currentProject.difficulty} />
          </View>
          <Text style={styles.projectTitle}>{currentProject.title}</Text>
          <Text style={styles.cardBody}>{currentProject.description}</Text>
          <View style={styles.spacer12} />
          <ProgressBar value={projectProgress} />
          <Text style={styles.cardHint}>
            {projectProgress === 0 ? 'Commence par la première étape.' : 'Continue là où tu t’es arrêté.'}
          </Text>
        </Card>
      </Pressable>
    </>
  );
}

function LearnScreen({
  state,
  onCourse,
  onToggleDownload,
}: {
  state: LocalState;
  onCourse: (course: Course) => void;
  onToggleDownload: (courseId: string) => void;
}) {
  return (
    <>
      <Text style={styles.eyebrow}>TON PARCOURS</Text>
      <Text style={styles.pageTitle}>Construis tes fondations.</Text>
      <Text style={styles.pageLead}>
        Des cours courts, une notion à la fois, puis une vérification avant de passer à la suite.
      </Text>

      <Card tone="primary" style={styles.pathCard}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.cardEyebrow}>OBJECTIF PERSONNEL</Text>
            <Text style={styles.pathTitle}>{state.learningGoal}</Text>
          </View>
          <Text style={styles.pathIcon}>↗</Text>
        </View>
        <Text style={styles.cardBody}>
          NexCode adapte l’ordre des fondations sans masquer ce que tu dois réellement apprendre.
        </Text>
      </Card>

      <SectionHeader title="Fondations V1.5" action={`${courses.length} cours`} />
      {courses.map((course) => {
        const downloaded = state.downloadedCourses.includes(course.id);
        const progress = courseProgress(course, state.completedLessons);
        return (
          <Pressable
            key={course.id}
            onPress={() => onCourse(course)}
            style={({ pressed }) => [styles.coursePressable, pressed && styles.pressFade]}
          >
            <Card>
              <View style={styles.courseHeadline}>
                <CourseBadge course={course} />
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{course.title}</Text>
                  <Text style={styles.metaText}>
                    {course.level} • {course.lessons} leçons • ~{course.estimatedHours} h
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
              <Text style={styles.cardBody}>{course.description}</Text>
              <View style={styles.courseMeta}>
                <Pill label={downloaded ? '✓ Offline' : `${course.offlineSizeMb} Mo`} tone={downloaded ? 'success' : 'neutral'} />
                <Text style={styles.progressLabel}>{progress}%</Text>
              </View>
              <ProgressBar value={progress} />
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  onToggleDownload(course.id);
                }}
                style={({ pressed }) => [styles.downloadInline, pressed && styles.pressFade]}
              >
                <Text style={styles.downloadInlineText}>
                  {downloaded ? 'Retirer le pack' : '↓ Télécharger pour apprendre hors ligne'}
                </Text>
              </Pressable>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

function LabScreen({
  language,
  source,
  result,
  onLanguage,
  onSource,
  onRun,
}: {
  language: PracticeLanguage;
  source: string;
  result: string;
  onLanguage: (language: PracticeLanguage) => void;
  onSource: (value: string) => void;
  onRun: () => void;
}) {
  const success = result.startsWith('✓');

  return (
    <>
      <Text style={styles.eyebrow}>NEXCODE LAB</Text>
      <Text style={styles.pageTitle}>Écris. Teste. Comprends.</Text>
      <Text style={styles.pageLead}>
        Un atelier mobile léger pour pratiquer immédiatement, sans IA et sans serveur obligatoire.
      </Text>

      <View style={styles.languageScroller}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageRow}>
          {labLanguages.map((item) => (
            <Pressable
              key={item}
              onPress={() => onLanguage(item)}
              style={({ pressed }) => [
                styles.languageChip,
                language === item && styles.languageChipActive,
                pressed && styles.pressFade,
              ]}
            >
              <Text style={[styles.languageText, language === item && styles.languageTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Card tone="primary">
        <Text style={styles.cardEyebrow}>MISSION</Text>
        <Text style={styles.cardTitle}>{labMission(language).title}</Text>
        <Text style={styles.cardBody}>{labMission(language).description}</Text>
      </Card>

      <View style={styles.editorShell}>
        <View style={styles.editorTopbar}>
          <View style={styles.editorDots}>
            <View style={styles.editorDot} />
            <View style={styles.editorDot} />
            <View style={styles.editorDot} />
          </View>
          <Text style={styles.editorFilename}>{labMission(language).file}</Text>
          <Pill label="LOCAL" tone="success" />
        </View>
        <TextInput
          multiline
          value={source}
          onChangeText={onSource}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          style={styles.codeInput}
          textAlignVertical="top"
          selectionColor={theme.colors.cyan}
        />
      </View>

      <PrimaryButton label="▶ Tester ma réponse" onPress={onRun} />

      <View style={[styles.console, success && styles.consoleSuccess]}>
        <View style={styles.consoleHeader}>
          <Text style={styles.consoleTitle}>FEEDBACK LOCAL</Text>
          <Text style={styles.consoleStatus}>{success ? 'VALIDÉ' : 'PRÊT'}</Text>
        </View>
        <Text style={[styles.consoleText, success && styles.consoleTextSuccess]}>{result}</Text>
      </View>

      <Card>
        <Text style={styles.cardEyebrow}>POURQUOI C’EST LÉGER</Text>
        <Text style={styles.cardTitle}>La pratique utile avant les runtimes lourds.</Text>
        <Text style={styles.cardBody}>
          Cette V1.5 vérifie des objectifs pédagogiques simples localement. Les runtimes complets pourront être ajoutés plus tard sans rendre l’apprentissage dépendant du Cloud.
        </Text>
      </Card>
    </>
  );
}

function ProjectsScreen({
  state,
  onProject,
}: {
  state: LocalState;
  onProject: (project: GuidedProject) => void;
}) {
  return (
    <>
      <Text style={styles.eyebrow}>BUILD MODE</Text>
      <Text style={styles.pageTitle}>Apprends en construisant.</Text>
      <Text style={styles.pageLead}>
        Chaque projet est découpé en étapes courtes. Tu sais toujours quoi faire ensuite et pourquoi.
      </Text>

      <Card tone="primary">
        <Text style={styles.cardEyebrow}>PHILOSOPHIE NEXCODE</Text>
        <Text style={styles.pathTitle}>Comprendre → appliquer → terminer.</Text>
        <Text style={styles.cardBody}>
          Les projets ne sont pas des démos à copier : chaque étape réutilise une compétence du parcours.
        </Text>
      </Card>

      <SectionHeader title="Projets guidés" action={`${guidedProjects.length} disponibles`} />
      {guidedProjects.map((project) => {
        const progress = state.projectProgress[project.id] ?? 0;
        return (
          <Pressable key={project.id} onPress={() => onProject(project)} style={({ pressed }) => pressed && styles.pressFade}>
            <Card style={styles.projectCard}>
              <View style={styles.rowBetween}>
                <Pill label={project.tech} tone="primary" />
                <Pill label={project.difficulty} tone={project.difficulty === 'Facile' ? 'success' : 'warning'} />
              </View>
              <Text style={styles.projectTitle}>{project.title}</Text>
              <Text style={styles.cardBody}>{project.description}</Text>
              <View style={styles.projectFooter}>
                <Text style={styles.metaText}>~{project.estimatedMinutes} min</Text>
                <Text style={styles.progressLabel}>{progress}%</Text>
              </View>
              <ProgressBar value={progress} />
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}

function ProfileScreen({
  state,
  downloadedMb,
  onToggleDownload,
}: {
  state: LocalState;
  downloadedMb: number;
  onToggleDownload: (courseId: string) => void;
}) {
  return (
    <>
      <Text style={styles.eyebrow}>TON ESPACE</Text>
      <Text style={styles.pageTitle}>{state.name || 'Développeur NexCode'}</Text>
      <Text style={styles.pageLead}>{state.learningGoal}</Text>

      <View style={styles.profileIdentity}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(state.name || 'NexCode')}</Text></View>
        <View style={styles.flex}>
          <Text style={styles.profileName}>{state.name || 'Développeur NexCode'}</Text>
          <Text style={styles.metaText}>Niveau Explorer • V1.5</Text>
        </View>
        <Pill label={`${state.xp} XP`} tone="primary" />
      </View>

      <View style={styles.statRow}>
        <StatTile label="Série" value={`${state.streak} jours`} />
        <StatTile label="Leçons" value={`${state.completedLessons.length}`} />
        <StatTile label="Offline" value={`${downloadedMb} Mo`} />
      </View>

      <SectionHeader title="Téléchargements" action={`${state.downloadedCourses.length}/${courses.length}`} />
      <Card>
        <View style={styles.offlineSummary}>
          <View style={styles.downloadIcon}><Text style={styles.downloadIconText}>↓</Text></View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Centre Offline</Text>
            <Text style={styles.cardBody}>Tes packs restent disponibles même sans connexion.</Text>
          </View>
        </View>
        <View style={styles.divider} />
        {courses.map((course, index) => {
          const downloaded = state.downloadedCourses.includes(course.id);
          return (
            <View key={course.id}>
              <View style={styles.downloadRow}>
                <CourseBadge course={course} compact />
                <View style={styles.flex}>
                  <Text style={styles.downloadTitle}>{course.title}</Text>
                  <Text style={styles.metaText}>{course.offlineSizeMb} Mo</Text>
                </View>
                <Pressable
                  onPress={() => onToggleDownload(course.id)}
                  style={({ pressed }) => [
                    styles.roundButton,
                    downloaded && styles.roundButtonActive,
                    pressed && styles.pressFade,
                  ]}
                >
                  <Text style={[styles.roundButtonText, downloaded && styles.roundButtonTextActive]}>
                    {downloaded ? '✓' : '↓'}
                  </Text>
                </Pressable>
              </View>
              {index < courses.length - 1 ? <View style={styles.slimDivider} /> : null}
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Réglages V1.5" />
      <Card>
        <SettingRow icon="◉" title="Données mobiles" subtitle="Cours téléchargés seulement sur demande" value="Éco" />
        <View style={styles.slimDivider} />
        <SettingRow icon="☾" title="Apparence" subtitle="Interface sombre optimisée" value="Sombre" />
        <View style={styles.slimDivider} />
        <SettingRow icon="⌁" title="Synchronisation" subtitle="Cloud facultatif dans une future version" value="Local" />
      </Card>

      <Text style={styles.versionText}>NexCode 1.5 • Nexus Tech</Text>
    </>
  );
}

function CourseScreen({
  course,
  completedLessons,
  downloaded,
  onBack,
  onToggleDownload,
  onLesson,
}: {
  course: Course;
  completedLessons: string[];
  downloaded: boolean;
  onBack: () => void;
  onToggleDownload: () => void;
  onLesson: (lesson: Lesson) => void;
}) {
  const progress = courseProgress(course, completedLessons);

  return (
    <DetailLayout onBack={onBack} label="Parcours">
      <View style={styles.detailHero}>
        <CourseBadge course={course} large />
        <Text style={styles.detailTitle}>{course.title}</Text>
        <Text style={styles.pageLead}>{course.description}</Text>
        <View style={styles.detailPills}>
          <Pill label={course.level} />
          <Pill label={`~${course.estimatedHours} h`} />
          <Pill label={downloaded ? '✓ Offline' : `${course.offlineSizeMb} Mo`} tone={downloaded ? 'success' : 'neutral'} />
        </View>
      </View>

      <Card tone="primary">
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Ta progression</Text>
          <Text style={styles.progressBig}>{progress}%</Text>
        </View>
        <View style={styles.spacer12} />
        <ProgressBar value={progress} />
        <View style={styles.spacer12} />
        <SecondaryButton
          label={downloaded ? 'Retirer le pack offline' : '↓ Télécharger le cours'}
          onPress={onToggleDownload}
        />
      </Card>

      <SectionHeader title="Commencer ici" action={`${course.starterLessons.length} leçons prêtes`} />
      {course.starterLessons.map((lesson, index) => {
        const completed = completedLessons.includes(lesson.id);
        return (
          <Pressable key={lesson.id} onPress={() => onLesson(lesson)} style={({ pressed }) => pressed && styles.pressFade}>
            <Card style={styles.lessonRowCard}>
              <View style={[styles.lessonNumber, completed && styles.lessonNumberComplete]}>
                <Text style={[styles.lessonNumberText, completed && styles.lessonNumberTextComplete]}>
                  {completed ? '✓' : index + 1}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.lessonRowTitle}>{lesson.title}</Text>
                <Text style={styles.metaText}>{lesson.durationMin} min • Concept + exemple + vérification</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Card>
          </Pressable>
        );
      })}

      <Card style={styles.futureContentCard}>
        <Pill label="V1.5" tone="primary" />
        <Text style={styles.cardTitle}>Le parcours va s’agrandir.</Text>
        <Text style={styles.cardBody}>
          La structure est prête pour ajouter les autres leçons sans alourdir l’application : contenu versionné, packs offline et mises à jour progressives.
        </Text>
      </Card>
    </DetailLayout>
  );
}

function LessonScreen({
  course,
  lesson,
  answerIndex,
  completed,
  onAnswer,
  onComplete,
  onBack,
}: {
  course: Course;
  lesson: Lesson;
  answerIndex: number | null;
  completed: boolean;
  onAnswer: (index: number) => void;
  onComplete: () => void;
  onBack: () => void;
}) {
  const answered = answerIndex !== null;
  const correct = answerIndex === lesson.correctIndex;

  return (
    <DetailLayout onBack={onBack} label={course.language}>
      <Text style={styles.eyebrow}>LEÇON • {lesson.durationMin} MIN</Text>
      <Text style={styles.detailTitle}>{lesson.title}</Text>
      <Text style={styles.pageLead}>Comprends l’idée, observe un exemple, puis vérifie que tu l’as vraiment comprise.</Text>

      <SectionHeader title="1. Comprendre" />
      <Card>
        <Text style={styles.cardBodyLarge}>{lesson.concept}</Text>
        <View style={styles.whyBox}>
          <Text style={styles.whyLabel}>POURQUOI TU APPRENDS ÇA</Text>
          <Text style={styles.whyText}>
            Cette notion sera réutilisée dans les exercices et les projets du parcours {course.language}.
          </Text>
        </View>
      </Card>

      <SectionHeader title="2. Voir un exemple" />
      <View style={styles.codeBlock}>
        <View style={styles.codeBlockHeader}>
          <Text style={styles.codeBlockLabel}>EXEMPLE</Text>
          <Text style={styles.codeBlockLang}>{course.language}</Text>
        </View>
        <Text style={styles.codeText}>{lesson.example}</Text>
      </View>

      <SectionHeader title="3. Vérifier" />
      <Card>
        <Text style={styles.questionText}>{lesson.question}</Text>
        <View style={styles.choiceList}>
          {lesson.choices.map((choice, index) => {
            const selected = answerIndex === index;
            const isCorrectChoice = answered && index === lesson.correctIndex;
            const isWrongChoice = selected && answered && !correct;
            return (
              <Pressable
                key={choice}
                onPress={() => onAnswer(index)}
                style={({ pressed }) => [
                  styles.choice,
                  selected && styles.choiceSelected,
                  isCorrectChoice && styles.choiceCorrect,
                  isWrongChoice && styles.choiceWrong,
                  pressed && styles.pressFade,
                ]}
              >
                <View style={styles.choiceLetter}><Text style={styles.choiceLetterText}>{String.fromCharCode(65 + index)}</Text></View>
                <Text style={styles.choiceText}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>

        {answered ? (
          <View style={[styles.feedbackBox, correct ? styles.feedbackSuccess : styles.feedbackWarning]}>
            <Text style={[styles.feedbackTitle, correct ? styles.successText : styles.warningText]}>
              {correct ? '✓ Bonne réponse' : 'Pas encore'}
            </Text>
            <Text style={styles.feedbackText}>{lesson.explanation}</Text>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="4. Valider" />
      <Card tone={completed ? 'success' : 'default'}>
        <Text style={styles.cardTitle}>{completed ? 'Leçon terminée ✓' : 'Prêt à avancer ?'}</Text>
        <Text style={styles.cardBody}>
          {completed
            ? 'Cette compétence est enregistrée sur ton appareil.'
            : 'Valide après avoir répondu correctement. NexCode ajoute 20 XP et met à jour ton objectif du jour.'}
        </Text>
        <View style={styles.spacer16} />
        <PrimaryButton
          label={completed ? 'Déjà terminée' : 'Terminer la leçon • +20 XP'}
          disabled={!correct || completed}
          onPress={onComplete}
        />
      </Card>
    </DetailLayout>
  );
}

function ProjectScreen({
  project,
  progress,
  onBack,
  onAdvance,
}: {
  project: GuidedProject;
  progress: number;
  onBack: () => void;
  onAdvance: () => void;
}) {
  const completedSteps = Math.min(project.steps.length, Math.floor((progress / 100) * project.steps.length));
  const nextIndex = Math.min(completedSteps, project.steps.length - 1);
  const complete = progress >= 100;

  return (
    <DetailLayout onBack={onBack} label="Build Mode">
      <Pill label={project.tech} tone="primary" />
      <Text style={styles.detailTitle}>{project.title}</Text>
      <Text style={styles.pageLead}>{project.description}</Text>

      <View style={styles.detailPills}>
        <Pill label={project.difficulty} tone={project.difficulty === 'Facile' ? 'success' : 'warning'} />
        <Pill label={`~${project.estimatedMinutes} min`} />
        <Pill label={`${progress}%`} tone="primary" />
      </View>

      <Card tone="primary">
        <Text style={styles.cardEyebrow}>{complete ? 'PROJET TERMINÉ' : 'PROCHAINE ÉTAPE'}</Text>
        <Text style={styles.pathTitle}>{complete ? 'Bravo. Le projet est complet.' : project.steps[nextIndex]}</Text>
        <Text style={styles.cardBody}>
          {complete
            ? 'Tu peux maintenant revoir les étapes et expliquer ce que tu as construit.'
            : 'Concentre-toi sur une seule étape. La progression se construit bloc par bloc.'}
        </Text>
      </Card>

      <SectionHeader title="Plan du projet" />
      <Card>
        {project.steps.map((step, index) => {
          const done = index < completedSteps || complete;
          const current = !complete && index === nextIndex;
          return (
            <View key={step}>
              <View style={styles.projectStep}>
                <View style={[styles.stepMarker, done && styles.stepMarkerDone, current && styles.stepMarkerCurrent]}>
                  <Text style={[styles.stepMarkerText, done && styles.stepMarkerTextDone]}>{done ? '✓' : index + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{step}</Text>
                  <Text style={styles.metaText}>{done ? 'Terminée' : current ? 'À faire maintenant' : 'À venir'}</Text>
                </View>
              </View>
              {index < project.steps.length - 1 ? <View style={styles.stepLine} /> : null}
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.cardEyebrow}>REVUE</Text>
        <Text style={styles.cardTitle}>Ne coche pas sans comprendre.</Text>
        <Text style={styles.cardBody}>
          Pour la V1.5, la validation est volontairement simple. Les futures versions pourront ajouter tests de projet et revue plus avancée.
        </Text>
        <View style={styles.spacer16} />
        <PrimaryButton
          label={complete ? 'Projet terminé ✓' : 'Marquer l’étape terminée • +15 XP'}
          disabled={complete}
          onPress={onAdvance}
        />
      </Card>
    </DetailLayout>
  );
}

function DetailLayout({
  children,
  onBack,
  label,
}: {
  children: React.ReactNode;
  onBack: () => void;
  label: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <View style={styles.detailHeader}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressFade]}>
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.detailHeaderLabel}>{label}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((item) => {
        const active = item.id === tab;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.id)}
            style={({ pressed }) => [styles.tabItem, pressed && styles.pressFade]}
          >
            <View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}>
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{item.icon}</Text>
            </View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CourseBadge({
  course,
  compact = false,
  large = false,
}: {
  course: Course;
  compact?: boolean;
  large?: boolean;
}) {
  return (
    <View
      style={[
        styles.courseBadge,
        { borderColor: course.color, backgroundColor: `${course.color}18` },
        compact && styles.courseBadgeCompact,
        large && styles.courseBadgeLarge,
      ]}
    >
      <Text
        style={[
          styles.courseBadgeText,
          { color: course.color },
          compact && styles.courseBadgeTextCompact,
          large && styles.courseBadgeTextLarge,
        ]}
      >
        {course.icon}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressFade]}>
      <View style={styles.quickIcon}><Text style={styles.quickIconText}>{icon}</Text></View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function MiniFeature({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.miniFeature}>
      <Text style={styles.miniFeatureIcon}>{icon}</Text>
      <Text style={styles.miniFeatureTitle}>{title}</Text>
      <Text style={styles.miniFeatureText}>{text}</Text>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
}: {
  icon: string;
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}><Text style={styles.settingIconText}>{icon}</Text></View>
      <View style={styles.flex}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.metaText}>{subtitle}</Text>
      </View>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

function courseProgress(course: Course, completedLessons: string[]) {
  if (course.starterLessons.length === 0) return 0;
  const completed = course.starterLessons.filter((lesson) => completedLessons.includes(lesson.id)).length;
  return Math.round((completed / course.starterLessons.length) * 100);
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return letters || 'NC';
}

function labMission(language: PracticeLanguage) {
  if (language === 'HTML/CSS') {
    return {
      title: 'Crée un titre et donne-lui du style.',
      description: 'Ta réponse doit contenir une vraie balise HTML et au moins une règle CSS.',
      file: 'index.html',
    };
  }
  if (language === 'Python') {
    return {
      title: 'Crée une fonction qui renvoie une valeur.',
      description: 'Utilise def, un paramètre et return.',
      file: 'main.py',
    };
  }
  if (language === 'SQL') {
    return {
      title: 'Lis des données depuis une table.',
      description: 'Écris une requête SELECT avec une clause FROM.',
      file: 'query.sql',
    };
  }
  return {
    title: 'Déclare une valeur et affiche-la.',
    description: 'Utilise const, let ou var puis console.log.',
    file: 'main.js',
  };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  app: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  pressFade: { opacity: 0.75 },

  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#101626',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141D3D',
    borderWidth: 1,
    borderColor: '#4559B8',
  },
  brandMarkText: { color: '#8DE5FF', fontSize: 12, fontWeight: '900' },
  brand: { color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  brandSubtitle: { color: theme.colors.textMuted, fontSize: 9, marginTop: 1 },

  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 118 },
  eyebrow: {
    color: '#8E9AFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  pageTitle: { color: theme.colors.text, fontSize: 29, lineHeight: 35, fontWeight: '900' },
  pageLead: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 7 },
  heroCard: { marginTop: 20 },
  cardEyebrow: { color: '#9CA7FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heroCardTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  cardTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  cardBody: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 7 },
  cardBodyLarge: { color: '#D7DDEF', fontSize: 15, lineHeight: 24 },
  cardHint: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  goalBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C2756',
    borderWidth: 1,
    borderColor: '#4659B2',
  },
  goalBubbleValue: { color: '#C3CAFF', fontSize: 14, fontWeight: '900' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 10 },

  courseHeadline: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBadgeCompact: { width: 38, height: 38, borderRadius: 12 },
  courseBadgeLarge: { width: 64, height: 64, borderRadius: 20, marginBottom: 16 },
  courseBadgeText: { fontSize: 13, fontWeight: '900' },
  courseBadgeTextCompact: { fontSize: 11 },
  courseBadgeTextLarge: { fontSize: 18 },
  metaText: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16 },
  chevron: { color: '#7180A4', fontSize: 28, fontWeight: '300' },
  lessonTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800', marginTop: 16 },
  inlineProgress: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 15 },
  progressLabel: { color: '#AAB4FF', fontSize: 11, fontWeight: '800' },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickAction: {
    width: '48.3%',
    minHeight: 118,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172044',
  },
  quickIconText: { color: '#9CEAFF', fontSize: 12, fontWeight: '900' },
  quickTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800', marginTop: 11 },
  quickSubtitle: { color: theme.colors.textMuted, fontSize: 10, marginTop: 3 },

  projectTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 14 },
  projectFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginBottom: 8 },
  projectCard: { marginBottom: 12 },
  pathCard: { marginTop: 20 },
  pathTitle: { color: theme.colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 4 },
  pathIcon: { color: '#91DCFF', fontSize: 26, fontWeight: '700' },
  coursePressable: { marginBottom: 12 },
  courseMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 9 },
  downloadInline: { paddingTop: 13, marginTop: 4 },
  downloadInlineText: { color: '#9BA8FF', fontSize: 11, fontWeight: '700' },

  languageScroller: { marginHorizontal: -18, marginTop: 18, marginBottom: 12 },
  languageRow: { paddingHorizontal: 18, gap: 8 },
  languageChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  languageChipActive: { backgroundColor: '#26316A', borderColor: '#5265CF' },
  languageText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  languageTextActive: { color: '#FFFFFF' },
  editorShell: {
    backgroundColor: theme.colors.code,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#283754',
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 12,
  },
  editorTopbar: {
    minHeight: 46,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#182238',
  },
  editorDots: { flexDirection: 'row', gap: 5 },
  editorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#40506D' },
  editorFilename: { flex: 1, color: '#8C98B2', fontSize: 11, textAlign: 'center', fontWeight: '700' },
  codeInput: {
    minHeight: 260,
    color: '#EAF0FF',
    fontSize: 13,
    lineHeight: 21,
    fontFamily: 'monospace',
    padding: 15,
  },
  console: {
    backgroundColor: '#0D1320',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#28334A',
    padding: 14,
    marginTop: 12,
    marginBottom: 12,
  },
  consoleSuccess: { backgroundColor: '#0D1B16', borderColor: '#22593E' },
  consoleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  consoleTitle: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  consoleStatus: { color: theme.colors.success, fontSize: 9, fontWeight: '800' },
  consoleText: { color: '#C5CDDE', fontSize: 12, lineHeight: 18, fontFamily: 'monospace' },
  consoleTextSuccess: { color: '#7DE7A9' },

  profileIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2855',
    borderWidth: 1,
    borderColor: '#485BBA',
  },
  avatarText: { color: '#A7E7FF', fontSize: 14, fontWeight: '900' },
  profileName: { color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 3 },
  offlineSummary: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  downloadIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.successSoft,
    borderWidth: 1,
    borderColor: '#235A40',
  },
  downloadIconText: { color: theme.colors.success, fontSize: 20, fontWeight: '900' },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  slimDivider: { height: 1, backgroundColor: '#172036', marginVertical: 10 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  downloadTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  roundButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceRaised,
  },
  roundButtonActive: { backgroundColor: theme.colors.successSoft, borderColor: '#235A40' },
  roundButtonText: { color: theme.colors.textSecondary, fontSize: 15, fontWeight: '800' },
  roundButtonTextActive: { color: theme.colors.success },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 54 },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSoft,
  },
  settingIconText: { color: '#A6B0C7', fontSize: 14 },
  settingTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  settingValue: { color: '#9BA8FF', fontSize: 11, fontWeight: '700' },
  versionText: { color: theme.colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 24 },

  tabBar: {
    minHeight: 74,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0A0F1B',
    borderTopWidth: 1,
    borderTopColor: '#182137',
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIconWrap: {
    minWidth: 34,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: { backgroundColor: '#202A5D' },
  tabIcon: { color: '#68758F', fontSize: 13, fontWeight: '800' },
  tabIconActive: { color: '#A9B4FF' },
  tabLabel: { color: '#68758F', fontSize: 9, marginTop: 3, fontWeight: '600' },
  tabLabelActive: { color: '#C6CCFF', fontWeight: '800' },

  onboarding: { paddingHorizontal: 20, paddingTop: 34, paddingBottom: 42 },
  logoMark: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151E40',
    borderWidth: 1,
    borderColor: '#4B5FC2',
    marginBottom: 18,
  },
  logoMarkText: { color: '#9DE9FF', fontSize: 20, fontWeight: '900' },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    marginTop: 18,
  },
  heroText: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 23, marginTop: 10 },
  onboardingFeatureRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  miniFeature: {
    flex: 1,
    minHeight: 118,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 11,
  },
  miniFeatureIcon: { color: '#94E4FF', fontSize: 15, fontWeight: '900' },
  miniFeatureTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '800', marginTop: 9 },
  miniFeatureText: { color: theme.colors.textMuted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  fieldLabel: { color: '#8E9AB6', fontSize: 9, fontWeight: '800', letterSpacing: 1.1, marginTop: 26, marginBottom: 8 },
  textField: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  goalList: { gap: 8, marginBottom: 20 },
  goalOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 14,
  },
  goalOptionActive: { borderColor: '#5265CF', backgroundColor: '#141D3E' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#52617B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#8290FF' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8290FF' },
  goalText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  goalTextActive: { color: theme.colors.text, fontWeight: '800' },
  privacyNote: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 },

  detailHeader: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#131B2E',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backButtonText: { color: theme.colors.text, fontSize: 28, lineHeight: 30, fontWeight: '300' },
  detailHeaderLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  headerSpacer: { width: 38 },
  detailContent: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 44 },
  detailHero: { marginBottom: 20 },
  detailTitle: { color: theme.colors.text, fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 12 },
  detailPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  progressBig: { color: '#B9C1FF', fontSize: 20, fontWeight: '900' },
  lessonRowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  lessonNumber: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171F34',
    borderWidth: 1,
    borderColor: '#2B3857',
  },
  lessonNumberComplete: { backgroundColor: theme.colors.successSoft, borderColor: '#235A40' },
  lessonNumberText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  lessonNumberTextComplete: { color: theme.colors.success },
  lessonRowTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  futureContentCard: { marginTop: 10 },

  whyBox: {
    marginTop: 16,
    backgroundColor: '#111A2B',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#243250',
    padding: 13,
  },
  whyLabel: { color: '#8F9BFF', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  whyText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
  codeBlock: {
    backgroundColor: theme.colors.code,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#293652',
    overflow: 'hidden',
  },
  codeBlockHeader: {
    height: 42,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#182238',
  },
  codeBlockLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  codeBlockLang: { color: '#95A2C0', fontSize: 10, fontWeight: '700' },
  codeText: { color: '#EAF0FF', fontSize: 13, lineHeight: 21, fontFamily: 'monospace', padding: 15 },
  questionText: { color: theme.colors.text, fontSize: 16, lineHeight: 23, fontWeight: '800' },
  choiceList: { gap: 8, marginTop: 16 },
  choice: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
  },
  choiceSelected: { borderColor: '#5A6ECF', backgroundColor: '#18224A' },
  choiceCorrect: { borderColor: '#2E8A5B', backgroundColor: '#10291E' },
  choiceWrong: { borderColor: '#9E4654', backgroundColor: '#2B151B' },
  choiceLetter: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202A40',
  },
  choiceLetterText: { color: '#AEB8D0', fontSize: 11, fontWeight: '800' },
  choiceText: { flex: 1, color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' },
  feedbackBox: { borderRadius: theme.radius.md, padding: 13, marginTop: 14, borderWidth: 1 },
  feedbackSuccess: { backgroundColor: theme.colors.successSoft, borderColor: '#235A40' },
  feedbackWarning: { backgroundColor: '#2A2211', borderColor: '#66511A' },
  feedbackTitle: { fontSize: 12, fontWeight: '800' },
  successText: { color: theme.colors.success },
  warningText: { color: theme.colors.warning },
  feedbackText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },

  projectStep: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  stepMarker: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171F34',
    borderWidth: 1,
    borderColor: '#2B3857',
  },
  stepMarkerDone: { backgroundColor: theme.colors.successSoft, borderColor: '#235A40' },
  stepMarkerCurrent: { backgroundColor: '#202A5D', borderColor: '#4B60C3' },
  stepMarkerText: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '800' },
  stepMarkerTextDone: { color: theme.colors.success },
  stepTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  stepTitleDone: { color: '#9CB4A8' },
  stepLine: { width: 1, height: 14, backgroundColor: '#28334B', marginLeft: 15 },

  spacer12: { height: 12 },
  spacer16: { height: 16 },
});
