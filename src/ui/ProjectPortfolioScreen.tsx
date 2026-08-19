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
    <View style={styles.heroStats}><Card tone="primary" style={styles.heroCard}><Text style={styles.kicker}>PORTFOLIO</Text><Text style={styles.big}>{state.portfolioProofs.length}</Text><Text style={styles.body}>projets validés</Text></Card><Card style={styles.heroCard}><Text style={styles.kicker}>EN COURS</Text><Text style={styles.big}>{Object.keys(state.projectDrafts).length}</Text><Text style={styles.body}>workspaces</Text></Card></View>
    <SectionHeader title="Projets guidés" action={`${projects.length}`} />
    {projects.map((project) => {
      const progress = state.projectProgress[project.id] ?? 0;
      const readiness = projectReadinessAgainstGraph(project, graph, state.mastery);
      const proof = state.portfolioProofs.find((item) => item.projectId === project.id);
      const hasDraft = Boolean(state.projectDrafts[project.id]);
      return <Pressable key={project.id} onPress={() => setSelected(project)} style={({ pressed }) => [styles.projectPressable, pressed && styles.pressed]}>
        <Card>
          <View style={styles.row}><Pill label={project.tech} tone="primary" />{hasDraft ? <Pill label="Code sauvegardé" tone="success" /> : null}{proof ? <Pill label="Portfolio ✓" tone="success" /> : null}</View>
          <Text style={styles.cardTitle}>{project.title}</Text><Text style={styles.body}>{project.description}</Text>
          <View style={styles.rowBetween}><Text style={styles.meta}>{project.steps.length} étapes • ~{project.estimatedMinutes} min</Text><Text style={styles.progressText}>{progress}%</Text></View>
          <ProgressBar value={progress} />
          <Text style={styles.readiness}>{readiness.ready ? '✓ Prêt à commencer' : `${readiness.score}% des prérequis consolidés`}</Text>
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
  const rubric = useMemo(() => defaultProjectRubric(project), [project.id]);
  const [achieved, setAchieved] = useState<string[]>([]);
  const review = reviewProject(project, achieved);
  const existingProof = state.portfolioProofs.find((item) => item.projectId === project.id);
  const stepSize = Math.max(1, Math.round(100 / project.steps.length));
  const completedSteps = Math.min(project.steps.length, Math.floor((progress / 100) * project.steps.length));

  if (workspaceOpen) return <ProjectWorkspaceScreen project={project} stored={state.projectDrafts[project.id]} onSave={(draft) => onSaveProjectDraft(project, draft)} onBack={() => setWorkspaceOpen(false)} />;

  function toggleRubric(id: string) {
    setAchieved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveProof() {
    const proof = buildPortfolioProof(project, graph, achieved);
    if (proof) onProof(proof);
  }

  return <View>
    <Pressable onPress={onBack}><Text style={styles.back}>‹ Tous les projets</Text></Pressable>
    <Text style={styles.eyebrow}>{project.track.toUpperCase()} • {project.tech}</Text><Text style={styles.title}>{project.title}</Text><Text style={styles.lead}>{project.description}</Text>
    <Card tone="primary" style={styles.ideCard}><View style={styles.ideIcon}><Text style={styles.ideIconText}>⌘</Text></View><View style={styles.flex}><Text style={styles.ideTitle}>{state.projectDrafts[project.id] ? 'Reprendre le code' : 'Ouvrir le Project IDE'}</Text><Text style={styles.ideText}>Fichiers, éditeur mobile, preview Web et console dans un seul workspace.</Text></View><PrimaryButton label={state.projectDrafts[project.id] ? 'Reprendre' : 'Coder'} icon="→" onPress={() => setWorkspaceOpen(true)} /></Card>
    <Card><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.kicker}>PRÉREQUIS</Text><Text style={styles.big}>{readiness.score}%</Text></View><Pill label={readiness.ready ? 'Prêt' : 'À renforcer'} tone={readiness.ready ? 'success' : 'warning'} /></View></Card>
    <SectionHeader title="Plan de construction" action={`${completedSteps}/${project.steps.length}`} />
    <Card>{project.steps.map((step, index) => { const done=index<completedSteps||progress>=100; const current=!done&&index===completedSteps; return <View key={step} style={styles.step}><View style={[styles.stepMark,done&&styles.stepDone,current&&styles.stepCurrent]}><Text style={styles.stepMarkText}>{done?'✓':index+1}</Text></View><View style={styles.flex}><Text style={styles.stepTitle}>{step}</Text><Text style={styles.meta}>{done?'Terminée':current?'Étape actuelle':'À venir'}</Text></View></View>})}<PrimaryButton label={progress>=100?'Construction terminée ✓':'Étape terminée'} disabled={progress>=100} onPress={() => onProgress(project, Math.min(100, progress + stepSize))} /></Card>
    <SectionHeader title="Revue avant portfolio" action={`${review.score}/100`} />
    <Card>{rubric.map((criterion) => {const checked=achieved.includes(criterion.id);return <Pressable key={criterion.id} onPress={() => toggleRubric(criterion.id)} style={[styles.rubric,checked&&styles.rubricChecked]}><Text style={[styles.check,checked&&styles.checkOn]}>{checked?'✓':'○'}</Text><View style={styles.flex}><Text style={styles.rubricTitle}>{criterion.title} • {criterion.weight} pts</Text><Text style={styles.meta}>{criterion.description}</Text></View></Pressable>})}<Text style={styles.body}>{review.passed ? 'Revue réussie. Ce projet peut devenir une preuve de portfolio.' : 'Atteins au moins 70/100 et termine le projet pour l’ajouter au portfolio.'}</Text><PrimaryButton label={existingProof?'Preuve déjà enregistrée ✓':'Ajouter au portfolio'} disabled={!review.passed || progress < 100 || Boolean(existingProof)} onPress={saveProof} /></Card>
  </View>;
}

const styles=StyleSheet.create({flex:{flex:1},eyebrow:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1.1,marginTop:10,marginBottom:7},title:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:35},lead:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:7,marginBottom:14},kicker:{color:'#8F9CFF',fontSize:10,fontWeight:'900',letterSpacing:1},big:{color:theme.colors.text,fontSize:25,fontWeight:'900',marginTop:4},body:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginVertical:8},meta:{color:theme.colors.textMuted,fontSize:10,lineHeight:15,marginVertical:5},projectPressable:{marginBottom:10},pressed:{opacity:.8,transform:[{scale:.99}]},row:{flexDirection:'row',gap:6,flexWrap:'wrap'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},cardTitle:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginTop:10},back:{color:'#9DA8FF',fontSize:13,fontWeight:'800',paddingVertical:10},heroStats:{flexDirection:'row',gap:8},heroCard:{flex:1},progressText:{color:'#AEB8FF',fontSize:10,fontWeight:'900'},readiness:{color:theme.colors.textMuted,fontSize:10,fontWeight:'700',marginTop:9},ideCard:{gap:10},ideIcon:{width:44,height:44,borderRadius:15,backgroundColor:'rgba(112,126,255,.14)',borderWidth:1,borderColor:'rgba(145,156,255,.25)',alignItems:'center',justifyContent:'center'},ideIconText:{color:'#C3CAFF',fontSize:18,fontWeight:'900'},ideTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},ideText:{color:theme.colors.textSecondary,fontSize:12,lineHeight:18,marginTop:4},step:{flexDirection:'row',gap:10,alignItems:'center',marginBottom:12},stepMark:{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:theme.colors.surfaceSoft,borderWidth:1,borderColor:theme.colors.border},stepDone:{backgroundColor:theme.colors.successSoft,borderColor:'#235A40'},stepCurrent:{borderColor:'#566BE2'},stepMarkText:{color:theme.colors.text,fontSize:11,fontWeight:'900'},stepTitle:{color:theme.colors.text,fontSize:13,fontWeight:'800'},rubric:{flexDirection:'row',gap:9,paddingVertical:10,borderBottomWidth:1,borderBottomColor:theme.colors.border},rubricChecked:{backgroundColor:'#101D18'},check:{color:theme.colors.textMuted,fontSize:18},checkOn:{color:theme.colors.success},rubricTitle:{color:theme.colors.text,fontSize:12,fontWeight:'800'}});
