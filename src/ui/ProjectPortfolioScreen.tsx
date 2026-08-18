import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GuidedProject } from '../data/curriculumCore';
import { LocalState } from '../lib/localState';
import { SkillNode } from '../learning/skillGraph';
import { buildPortfolioProof, projectReadinessAgainstGraph } from '../learning/projectPortfolioEngine';
import { defaultProjectRubric, reviewProject } from '../learning/projectEngine';
import { Card, Pill, PrimaryButton, ProgressBar, SectionHeader } from './components';
import { theme } from './theme';

export function ProjectPortfolioScreen({
  projects,
  graph,
  state,
  onProgress,
  onProof,
}: {
  projects: GuidedProject[];
  graph: SkillNode[];
  state: LocalState;
  onProgress: (project: GuidedProject, progress: number) => void;
  onProof: (proof: NonNullable<ReturnType<typeof buildPortfolioProof>>) => void;
}) {
  const [selected, setSelected] = useState<GuidedProject | null>(null);
  if (selected) {
    return <ProjectDetail project={selected} graph={graph} state={state} onBack={() => setSelected(null)} onProgress={onProgress} onProof={onProof} />;
  }
  return <View>
    <Text style={styles.eyebrow}>BUILD MODE</Text>
    <Text style={styles.title}>Construis pour prouver.</Text>
    <Text style={styles.lead}>Un projet ne devient une preuve de compétence qu’après progression, revue explicite et critères minimums atteints.</Text>
    <Card tone="primary"><Text style={styles.kicker}>PORTFOLIO</Text><Text style={styles.big}>{state.portfolioProofs.length} preuve{state.portfolioProofs.length > 1 ? 's' : ''}</Text><Text style={styles.body}>Chaque preuve conserve le score de revue et les compétences démontrées.</Text></Card>
    <SectionHeader title="Projets guidés" action={`${projects.length}`} />
    {projects.map((project) => {
      const progress = state.projectProgress[project.id] ?? 0;
      const readiness = projectReadinessAgainstGraph(project, graph, state.mastery);
      const proof = state.portfolioProofs.find((item) => item.projectId === project.id);
      return <Pressable key={project.id} onPress={() => setSelected(project)} style={styles.projectPressable}>
        <Card>
          <View style={styles.row}><Pill label={project.tech} tone="primary" /><Pill label={readiness.ready ? 'Prérequis prêts' : `${readiness.score}% prérequis`} tone={readiness.ready ? 'success' : 'warning'} />{proof ? <Pill label="Portfolio ✓" tone="success" /> : null}</View>
          <Text style={styles.cardTitle}>{project.title}</Text><Text style={styles.body}>{project.description}</Text>
          <Text style={styles.meta}>{project.steps.length} étapes • {project.skills.length} compétences • ~{project.estimatedMinutes} min</Text>
          <ProgressBar value={progress} />
        </Card>
      </Pressable>;
    })}
  </View>;
}

function ProjectDetail({ project, graph, state, onBack, onProgress, onProof }: {
  project: GuidedProject;
  graph: SkillNode[];
  state: LocalState;
  onBack: () => void;
  onProgress: (project: GuidedProject, progress: number) => void;
  onProof: (proof: NonNullable<ReturnType<typeof buildPortfolioProof>>) => void;
}) {
  const progress = state.projectProgress[project.id] ?? 0;
  const readiness = useMemo(() => projectReadinessAgainstGraph(project, graph, state.mastery), [project.id, graph, state.mastery]);
  const rubric = useMemo(() => defaultProjectRubric(project), [project.id]);
  const [achieved, setAchieved] = useState<string[]>([]);
  const review = reviewProject(project, achieved);
  const existingProof = state.portfolioProofs.find((item) => item.projectId === project.id);
  const stepSize = Math.max(1, Math.round(100 / project.steps.length));
  const completedSteps = Math.min(project.steps.length, Math.floor((progress / 100) * project.steps.length));

  function toggleRubric(id: string) {
    setAchieved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function saveProof() {
    const proof = buildPortfolioProof(project, graph, achieved);
    if (proof) onProof(proof);
  }

  return <View>
    <Pressable onPress={onBack}><Text style={styles.back}>‹ Tous les projets</Text></Pressable>
    <Text style={styles.eyebrow}>{project.track.toUpperCase()} • PROJET GUIDÉ</Text><Text style={styles.title}>{project.title}</Text><Text style={styles.lead}>{project.description}</Text>
    <Card tone="primary"><View style={styles.rowBetween}><View style={styles.flex}><Text style={styles.kicker}>READINESS</Text><Text style={styles.big}>{readiness.score}%</Text></View><Pill label={readiness.ready ? 'Prêt à construire' : 'Prérequis à renforcer'} tone={readiness.ready ? 'success' : 'warning'} /></View><Text style={styles.body}>{readiness.unresolvedSkillLabels.length ? `Compétences à relier : ${readiness.unresolvedSkillLabels.join(', ')}` : readiness.missingSkillIds.length || readiness.weakSkillIds.length ? `${readiness.missingSkillIds.length} nouvelles et ${readiness.weakSkillIds.length} faibles.` : 'Les compétences nécessaires sont suffisamment travaillées.'}</Text></Card>
    <SectionHeader title="Plan de construction" action={`${completedSteps}/${project.steps.length}`} />
    <Card>{project.steps.map((step, index) => { const done=index<completedSteps||progress>=100; const current=!done&&index===completedSteps; return <View key={step} style={styles.step}><View style={[styles.stepMark,done&&styles.stepDone,current&&styles.stepCurrent]}><Text style={styles.stepMarkText}>{done?'✓':index+1}</Text></View><View style={styles.flex}><Text style={styles.stepTitle}>{step}</Text><Text style={styles.meta}>{done?'Terminée':current?'Étape actuelle':'À venir'}</Text></View></View>})}<PrimaryButton label={progress>=100?'Construction terminée ✓':'Marquer l’étape terminée'} disabled={progress>=100} onPress={() => onProgress(project, Math.min(100, progress + stepSize))} /></Card>
    <SectionHeader title="Revue avant portfolio" action={`${review.score}/100`} />
    <Card>{rubric.map((criterion) => {const checked=achieved.includes(criterion.id);return <Pressable key={criterion.id} onPress={() => toggleRubric(criterion.id)} style={[styles.rubric,checked&&styles.rubricChecked]}><Text style={[styles.check,checked&&styles.checkOn]}>{checked?'✓':'○'}</Text><View style={styles.flex}><Text style={styles.rubricTitle}>{criterion.title} • {criterion.weight} pts</Text><Text style={styles.meta}>{criterion.description}</Text></View></Pressable>})}<Text style={styles.body}>{review.passed ? 'Revue réussie : fonctionnement et compréhension sont démontrés avec un score suffisant.' : 'La preuve exige au moins 70/100, avec Fonctionnement et Compréhension obligatoires.'}</Text><PrimaryButton label={existingProof?'Preuve déjà enregistrée ✓':'Ajouter au portfolio'} disabled={!review.passed || progress < 100 || Boolean(existingProof)} onPress={saveProof} /></Card>
  </View>;
}

const styles=StyleSheet.create({flex:{flex:1},eyebrow:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1.1,marginTop:10,marginBottom:7},title:{color:theme.colors.text,fontSize:29,fontWeight:'900',lineHeight:35},lead:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:7,marginBottom:14},kicker:{color:'#8F9CFF',fontSize:10,fontWeight:'900',letterSpacing:1},big:{color:theme.colors.text,fontSize:25,fontWeight:'900',marginTop:4},body:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginVertical:8},meta:{color:theme.colors.textMuted,fontSize:10,lineHeight:15,marginVertical:5},projectPressable:{marginBottom:10},row:{flexDirection:'row',gap:6,flexWrap:'wrap'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},cardTitle:{color:theme.colors.text,fontSize:16,fontWeight:'850',marginTop:9},back:{color:'#9DA8FF',fontSize:13,fontWeight:'800',paddingVertical:10},step:{flexDirection:'row',gap:10,alignItems:'center',marginBottom:12},stepMark:{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:theme.colors.surfaceSoft,borderWidth:1,borderColor:theme.colors.border},stepDone:{backgroundColor:theme.colors.successSoft,borderColor:'#235A40'},stepCurrent:{borderColor:'#566BE2'},stepMarkText:{color:theme.colors.text,fontSize:11,fontWeight:'900'},stepTitle:{color:theme.colors.text,fontSize:13,fontWeight:'800'},rubric:{flexDirection:'row',gap:9,paddingVertical:10,borderBottomWidth:1,borderBottomColor:theme.colors.border},rubricChecked:{backgroundColor:'#101D18'},check:{color:theme.colors.textMuted,fontSize:18},checkOn:{color:theme.colors.success},rubricTitle:{color:theme.colors.text,fontSize:12,fontWeight:'850'}});
