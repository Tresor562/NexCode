import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GuidedProject } from '../data/curriculumCore';
import { LabDraft, LocalState } from '../lib/localState';
import { SkillNode } from '../learning/skillGraph';
import { buildPortfolioProof, projectReadinessAgainstGraph } from '../learning/projectPortfolioEngine';
import { defaultProjectRubric, reviewProject } from '../learning/projectEngine';
import { ProjectWorkspaceScreen } from './ProjectWorkspaceScreen';
import { Card, Pill, PrimaryButton, ProgressBar, SectionHeader } from './components';
import { theme } from './theme';

type ProjectReadiness = ReturnType<typeof projectReadinessAgainstGraph>;

function skillTitle(skillId: string, graph: SkillNode[]) {
  return graph.find((node) => node.id === skillId)?.title ?? skillId;
}

function readinessGuidance(readiness: ProjectReadiness, graph: SkillNode[]) {
  const missing = readiness.missingSkillIds.map((id) => skillTitle(id, graph));
  const weak = readiness.weakSkillIds.map((id) => skillTitle(id, graph));
  const uncertain = readiness.uncertainSkillIds.map((id) => skillTitle(id, graph));
  return {
    missing,
    weak,
    uncertain,
    unresolved: readiness.unresolvedSkillLabels,
    summary: [...missing, ...weak, ...uncertain, ...readiness.unresolvedSkillLabels].slice(0, 3),
  };
}

export function ProjectPortfolioScreen({ projects, graph, state, onProgress, onProof, onSaveProjectDraft }: {
  projects: GuidedProject[];
  graph: SkillNode[];
  state: LocalState;
  onProgress: (project: GuidedProject, progress: number) => void;
  onProof: (proof: NonNullable<ReturnType<typeof buildPortfolioProof>>) => void;
  onSaveProjectDraft: (project: GuidedProject, draft: LabDraft) => void;
}) {
  const [selected, setSelected] = useState<GuidedProject | null>(null);
  if (selected) {
    return <ProjectDetail project={selected} graph={graph} state={state} onBack={() => setSelected(null)} onProgress={onProgress} onProof={onProof} onSaveProjectDraft={onSaveProjectDraft} />;
  }

  return <View>
    <Text style={styles.eyebrow}>PROJETS</Text>
    <Text style={styles.title}>Construis quelque chose de réel.</Text>
    <Text style={styles.lead}>Choisis un projet, ouvre son IDE et avance étape par étape.</Text>
    <View style={styles.heroStats}>
      <Card tone="primary" style={styles.heroCard}><Text style={styles.kicker}>PORTFOLIO</Text><Text style={styles.big}>{state.portfolioProofs.length}</Text><Text style={styles.body}>projets validés</Text></Card>
      <Card style={styles.heroCard}><Text style={styles.kicker}>EN COURS</Text><Text style={styles.big}>{Object.keys(state.projectDrafts).length}</Text><Text style={styles.body}>workspaces</Text></Card>
    </View>
    <SectionHeader title="Projets guidés" action={`${projects.length}`} />
    {projects.map((project) => {
      const progress = state.projectProgress[project.id] ?? 0;
      const readiness = projectReadinessAgainstGraph(project, graph, state.mastery);
      const guidance = readinessGuidance(readiness, graph);
      const proof = state.portfolioProofs.find((item) => item.projectId === project.id);
      const hasDraft = Boolean(state.projectDrafts[project.id]);
      const readinessHint = readiness.ready
        ? 'Prêt à commencer.'
        : guidance.summary.length
          ? `À renforcer : ${guidance.summary.join(', ')}.`
          : `${readiness.score}% des prérequis consolidés.`;
      return <Pressable
        key={project.id}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le projet ${project.title}`}
        accessibilityHint={`${progress}% terminé. ${readinessHint}`}
        onPress={() => setSelected(project)}
        style={({ pressed }) => [styles.projectPressable, pressed && styles.pressed]}
      >
        <Card>
          <View style={styles.row}><Pill label={project.tech} tone="primary" />{hasDraft ? <Pill label="Code sauvegardé" tone="success" /> : null}{proof ? <Pill label="Portfolio ✓" tone="success" /> : null}</View>
          <Text style={styles.cardTitle}>{project.title}</Text><Text style={styles.body}>{project.description}</Text>
          <View style={styles.rowBetween}><Text style={styles.meta}>{project.steps.length} étapes • ~{project.estimatedMinutes} min</Text><Text style={styles.progressText}>{progress}%</Text></View>
          <ProgressBar value={progress} />
          <Text style={styles.readiness}>{readiness.ready ? '✓ Prêt à commencer' : `${readiness.score}% des prérequis consolidés`}</Text>
          {!readiness.ready && guidance.summary.length ? <Text style={styles.readinessDetail} numberOfLines={2}>À renforcer : {guidance.summary.join(' • ')}</Text> : null}
        </Card>
      </Pressable>;
    })}
  </View>;
}

function ProjectDetail({ project, graph, state, onBack, onProgress, onProof, onSaveProjectDraft }: {
  project: GuidedProject;
  graph: SkillNode[];
  state: LocalState;
  onBack: () => void;
  onProgress: (project: GuidedProject, progress: number) => void;
  onProof: (proof: NonNullable<ReturnType<typeof buildPortfolioProof>>) => void;
  onSaveProjectDraft: (project: GuidedProject, draft: LabDraft) => void;
}) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const progress = state.projectProgress[project.id] ?? 0;
  const readiness = useMemo(() => projectReadinessAgainstGraph(project, graph, state.mastery), [project.id, graph, state.mastery]);
  const guidance = useMemo(() => readinessGuidance(readiness, graph), [readiness, graph]);
  const rubric = useMemo(() => defaultProjectRubric(project), [project.id]);
  const [achieved, setAchieved] = useState<string[]>([]);
  const review = reviewProject(project, achieved);
  const existingProof = state.portfolioProofs.find((item) => item.projectId === project.id);
  const hasWorkspace = Boolean(state.projectDrafts[project.id]);
  const completedSteps = project.steps.length > 0
    ? Math.min(project.steps.length, Math.max(0, Math.round((progress / 100) * project.steps.length)))
    : 0;
  const nextProgress = project.steps.length > 0
    ? Math.round((Math.min(project.steps.length, completedSteps + 1) / project.steps.length) * 100)
    : 100;

  if (workspaceOpen) return <ProjectWorkspaceScreen project={project} stored={state.projectDrafts[project.id]} onSave={(draft) => onSaveProjectDraft(project, draft)} onBack={() => setWorkspaceOpen(false)} />;

  function toggleRubric(id: string) {
    setAchieved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveProof() {
    if (!hasWorkspace || progress < 100 || !review.passed || existingProof) return;
    const proof = buildPortfolioProof(project, graph, achieved);
    if (proof) onProof(proof);
  }

  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Retour à tous les projets" onPress={onBack} hitSlop={6} style={styles.backButton}>
      <Text style={styles.back}>‹ Tous les projets</Text>
    </Pressable>
    <Text style={styles.eyebrow}>{project.track.toUpperCase()} • {project.tech}</Text><Text style={styles.title}>{project.title}</Text><Text style={styles.lead}>{project.description}</Text>
    <Card tone="primary" style={styles.ideCard}><View style={styles.ideIcon} accessible={false}><Text style={styles.ideIconText}>⌘</Text></View><View style={styles.flex}><Text style={styles.ideTitle}>{state.projectDrafts[project.id] ? 'Reprendre le code' : 'Ouvrir le Project IDE'}</Text><Text style={styles.ideText}>Fichiers, éditeur mobile, preview Web et console dans un seul workspace.</Text></View><PrimaryButton label={state.projectDrafts[project.id] ? 'Reprendre' : 'Coder'} icon="→" onPress={() => setWorkspaceOpen(true)} /></Card>
    <Card>
      <View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.kicker}>PRÉREQUIS</Text><Text style={styles.big}>{readiness.score}%</Text></View><Pill label={readiness.ready ? 'Prêt' : 'À renforcer'} tone={readiness.ready ? 'success' : 'warning'} /></View>
      {readiness.ready ? <Text style={styles.body}>Tes bases sont assez solides pour apprendre en construisant.</Text> : <View style={styles.guidanceBlock}>
        {guidance.missing.length ? <Text style={styles.guidanceText}><Text style={styles.guidanceLabel}>À découvrir : </Text>{guidance.missing.join(' • ')}</Text> : null}
        {guidance.weak.length ? <Text style={styles.guidanceText}><Text style={styles.guidanceLabel}>À renforcer : </Text>{guidance.weak.join(' • ')}</Text> : null}
        {guidance.uncertain.length ? <Text style={styles.guidanceText}><Text style={styles.guidanceLabel}>Confiance à consolider : </Text>{guidance.uncertain.join(' • ')}</Text> : null}
        {guidance.unresolved.length ? <Text style={styles.guidanceText}><Text style={styles.guidanceLabel}>À mapper : </Text>{guidance.unresolved.join(' • ')}</Text> : null}
      </View>}
    </Card>
    <SectionHeader title="Plan de construction" action={`${completedSteps}/${project.steps.length}`} />
    <Card>{project.steps.map((step, index) => { const done=index<completedSteps||progress>=100; const current=!done&&index===completedSteps; return <View key={step} style={styles.step}><View style={[styles.stepMark,done&&styles.stepDone,current&&styles.stepCurrent]}><Text style={styles.stepMarkText}>{done?'✓':index+1}</Text></View><View style={styles.flex}><Text style={styles.stepTitle}>{step}</Text><Text style={styles.meta}>{done?'Terminée':current?'Étape actuelle':'À venir'}</Text></View></View>})}{!hasWorkspace && progress < 100 ? <Text style={styles.workspaceGate}>Ouvre le Project IDE et sauvegarde ton code avant de valider une étape. La progression et les récompenses doivent correspondre à du travail réel.</Text> : null}<PrimaryButton label={progress>=100?'Construction terminée ✓':hasWorkspace?'Étape terminée':'Coder avant de valider'} disabled={progress>=100 || !hasWorkspace} onPress={() => onProgress(project, nextProgress)} /></Card>
    <SectionHeader title="Revue avant portfolio" action={`${review.score}/100`} />
    <Card>{rubric.map((criterion) => {const checked=achieved.includes(criterion.id);return <Pressable key={criterion.id} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${criterion.title}, ${criterion.weight} points`} onPress={() => toggleRubric(criterion.id)} style={[styles.rubric,checked&&styles.rubricChecked]}><Text style={[styles.check,checked&&styles.checkOn]}>{checked?'✓':'○'}</Text><View style={styles.flex}><Text style={styles.rubricTitle}>{criterion.title} • {criterion.weight} pts</Text><Text style={styles.meta}>{criterion.description}</Text></View></Pressable>})}<Text style={styles.body}>{!hasWorkspace ? 'Le portfolio exige aussi un workspace sauvegardé : rouvre le Project IDE et enregistre ton code avant de publier cette preuve.' : review.passed ? 'Revue réussie. Ce projet peut devenir une preuve de portfolio.' : 'Atteins au moins 70/100 et termine le projet pour l’ajouter au portfolio.'}</Text><PrimaryButton label={existingProof?'Preuve déjà enregistrée ✓':'Ajouter au portfolio'} disabled={!hasWorkspace || !review.passed || progress < 100 || Boolean(existingProof)} onPress={saveProof} /></Card>
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eyebrow: { color: theme.colors.primaryBright, fontSize: theme.type.caption, fontWeight: theme.weight.black, letterSpacing: 1.1, marginTop: theme.space.sm, marginBottom: 7 },
  title: { color: theme.colors.text, fontSize: 29, fontWeight: theme.weight.black, lineHeight: 35 },
  lead: { color: theme.colors.textSecondary, fontSize: theme.type.body, lineHeight: 21, marginTop: 7, marginBottom: theme.space.md },
  kicker: { color: theme.colors.primaryTextSoft, fontSize: theme.type.caption, fontWeight: theme.weight.black, letterSpacing: 1 },
  big: { color: theme.colors.text, fontSize: 25, fontWeight: theme.weight.black, marginTop: theme.space.xxs },
  body: { color: theme.colors.textSecondary, fontSize: theme.type.label, lineHeight: 19, marginVertical: 8 },
  meta: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 15, marginVertical: 5 },
  projectPressable: { marginBottom: theme.space.sm },
  pressed: { opacity: .8, transform: [{ scale: .99 }] },
  row: { flexDirection: 'row', gap: theme.space.xs, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { color: theme.colors.text, fontSize: 17, fontWeight: theme.weight.black, marginTop: theme.space.sm },
  backButton: { alignSelf: 'flex-start', minHeight: theme.control.heightSm, justifyContent: 'center' },
  back: { color: theme.colors.primaryText, fontSize: 13, fontWeight: theme.weight.bold, paddingVertical: theme.space.sm },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroCard: { flex: 1 },
  progressText: { color: theme.colors.primaryText, fontSize: 10, fontWeight: theme.weight.black },
  readiness: { color: theme.colors.textMuted, fontSize: 10, fontWeight: theme.weight.semibold, marginTop: 9 },
  readinessDetail: { color: theme.colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: theme.space.xxs },
  guidanceBlock: { marginTop: theme.space.sm, gap: theme.space.xxs },
  guidanceText: { color: theme.colors.textSecondary, fontSize: theme.type.label, lineHeight: 19 },
  guidanceLabel: { color: theme.colors.text, fontWeight: theme.weight.bold },
  ideCard: { gap: theme.space.sm },
  ideIcon: { width: theme.control.heightSm, height: theme.control.heightSm, borderRadius: theme.radius.md, backgroundColor: theme.colors.primaryGlass, borderWidth: 1, borderColor: theme.colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  ideIconText: { color: theme.colors.primaryTextSoft, fontSize: theme.type.title, fontWeight: theme.weight.black },
  ideTitle: { color: theme.colors.text, fontSize: theme.type.title, fontWeight: theme.weight.black },
  ideText: { color: theme.colors.textSecondary, fontSize: theme.type.label, lineHeight: 18, marginTop: theme.space.xxs },
  step: { flexDirection: 'row', gap: theme.space.sm, alignItems: 'center', marginBottom: theme.space.md },
  stepMark: { width: 30, height: 30, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSoft, borderWidth: 1, borderColor: theme.colors.border },
  stepDone: { backgroundColor: theme.colors.successSoft, borderColor: theme.colors.successBorderStrong },
  stepCurrent: { borderColor: theme.colors.primary },
  stepMarkText: { color: theme.colors.text, fontSize: 11, fontWeight: theme.weight.black },
  stepTitle: { color: theme.colors.text, fontSize: 13, fontWeight: theme.weight.bold },
  workspaceGate: { color: theme.colors.warning, fontSize: theme.type.label, lineHeight: 19, marginBottom: theme.space.sm },
  rubric: { minHeight: theme.control.heightSm, flexDirection: 'row', gap: 9, paddingVertical: theme.space.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rubricChecked: { backgroundColor: theme.colors.successGlass },
  check: { color: theme.colors.textMuted, fontSize: theme.type.title },
  checkOn: { color: theme.colors.success },
  rubricTitle: { color: theme.colors.text, fontSize: theme.type.label, fontWeight: theme.weight.bold },
});