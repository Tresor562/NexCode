import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import { openLabWorkspace, stampLabValidation, updateLabFile, validateLabDraft } from '../learning/labEngine';
import { runBehavioralSuite, secretSafetyIssues } from '../learning/labBehavioralTests';
import { Card, Pill, PrimaryButton, ProgressBar, SectionHeader } from './components';
import { theme } from './theme';

export function LabWorkspaceScreen({
  lesson,
  stored,
  onSave,
  onComplete,
  onBack,
}: {
  lesson: Lesson;
  stored?: LabDraft;
  onSave: (draft: LabDraft) => void;
  onComplete: (draft: LabDraft) => void;
  onBack: () => void;
}) {
  const initial = useMemo(() => openLabWorkspace(lesson, stored), [lesson.id]);
  const [draft, setDraft] = useState(initial.draft);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState('Modifie réellement le workspace, puis lance les tests.');
  const [validated, setValidated] = useState(false);
  const mission = initial.mission;
  const files = Object.keys(draft.files);
  const content = draft.files[draft.activeFile] ?? '';
  const secrets = secretSafetyIssues(draft);

  function changeFile(filename: string) {
    const next = { ...draft, activeFile: filename, updatedAt: new Date().toISOString() };
    setDraft(next);
    onSave(next);
  }

  function changeContent(value: string) {
    const next = updateLabFile(draft, draft.activeFile, value);
    setDraft(next);
    onSave(next);
    setValidated(false);
  }

  function runTests() {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const structural = validateLabDraft(mission, draft);
    const behavioral = runBehavioralSuite(mission, draft, nextAttempts);
    const passed = structural.passed && behavioral.passed;
    const stamped = stampLabValidation(draft, structural);
    setDraft(stamped);
    onSave(stamped);
    setValidated(passed);
    const failed = behavioral.visible.filter((item) => !item.passed).map((item) => item.label);
    const pieces = [
      structural.feedback,
      failed.length ? `Tests à corriger : ${failed.join(' • ')}` : 'Tests visibles : OK.',
      behavioral.hiddenTotal ? `Tests cachés : ${behavioral.hiddenPassed}/${behavioral.hiddenTotal}.` : '',
      behavioral.hint ?? '',
    ].filter(Boolean);
    setFeedback(pieces.join('\n'));
  }

  const progress = Math.round(((draft.passedCriteria?.length ?? 0) / Math.max(1, mission.successCriteria.length)) * 100);

  return (
    <View>
      <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>‹ Retour au cours</Text></Pressable>
      <Text style={styles.eyebrow}>NEXCODE LAB • {mission.language.toUpperCase()}</Text>
      <Text style={styles.title}>{mission.title}</Text>
      <Text style={styles.lead}>{mission.instructions}</Text>

      <Card tone="primary">
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>CRITÈRES DE RÉUSSITE</Text>
            <Text style={styles.cardTitle}>{draft.passedCriteria?.length ?? 0}/{mission.successCriteria.length} validés</Text>
          </View>
          <Pill label={validated ? '✓ Mission validée' : 'En cours'} tone={validated ? 'success' : 'primary'} />
        </View>
        <View style={styles.spacer10} />
        <ProgressBar value={progress} />
        {mission.successCriteria.map((criterion, index) => (
          <Text key={criterion} style={styles.criterion}>{draft.passedCriteria?.includes(criterion) ? '✓' : '•'} {index + 1}. {criterion}</Text>
        ))}
      </Card>

      <SectionHeader title="Workspace" action={`${files.length} fichier${files.length > 1 ? 's' : ''}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {files.map((filename) => (
          <Pressable key={filename} onPress={() => changeFile(filename)} style={[styles.fileTab, draft.activeFile === filename && styles.fileTabActive]}>
            <Text style={[styles.fileTabText, draft.activeFile === filename && styles.fileTabTextActive]}>{filename}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.editor}>
        <View style={styles.editorBar}>
          <Text style={styles.editorFile}>{draft.activeFile}</Text>
          <Text style={styles.saved}>autosave local</Text>
        </View>
        <TextInput
          multiline
          value={content}
          onChangeText={changeContent}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          style={styles.code}
          accessibilityLabel={`Éditeur ${draft.activeFile}`}
        />
      </View>

      {mission.language === 'HTML/CSS' ? (
        <Card style={styles.preview}>
          <Text style={styles.kicker}>PREVIEW WEB</Text>
          <Text style={styles.previewText}>La V1.5 conserve le HTML/CSS/JS en fichiers séparés et vérifie la structure localement. Le rendu natif complet sera validé sur l’APK final.</Text>
        </Card>
      ) : null}

      {secrets.length ? (
        <Card>
          <Pill label="Secret potentiel détecté" tone="warning" />
          {secrets.map((issue) => <Text key={issue} style={styles.warning}>{issue}</Text>)}
          <Text style={styles.body}>Remplace toute vraie clé par une variable d’environnement ou une valeur d’exemple avant de poursuivre.</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton label={`▶ Tester la mission${attempts ? ` • essai ${attempts + 1}` : ''}`} onPress={runTests} />
      </View>

      <Card tone={validated ? 'success' : 'default'}>
        <Text style={styles.kicker}>FEEDBACK</Text>
        <Text style={styles.feedback}>{feedback}</Text>
      </Card>

      <View style={styles.actions}>
        <PrimaryButton
          label={validated ? 'Valider le Lab et retourner au cours' : 'Valide tous les tests pour continuer'}
          disabled={!validated}
          onPress={() => onComplete(draft)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1}, back:{color:'#9DA8FF',fontSize:13,fontWeight:'800',paddingVertical:10}, eyebrow:{color:'#8A98FF',fontSize:11,fontWeight:'800',letterSpacing:1.2,marginTop:4,marginBottom:8}, title:{color:theme.colors.text,fontSize:28,fontWeight:'900',lineHeight:34}, lead:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:7,marginBottom:14},
  rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}, kicker:{color:'#8F9CFF',fontSize:10,fontWeight:'900',letterSpacing:1}, cardTitle:{color:theme.colors.text,fontSize:16,fontWeight:'800',marginTop:4}, spacer10:{height:10}, criterion:{color:theme.colors.textSecondary,fontSize:12,lineHeight:18,marginTop:7}, tabs:{gap:7,paddingBottom:8}, fileTab:{paddingHorizontal:12,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:theme.colors.border,backgroundColor:theme.colors.surface}, fileTabActive:{backgroundColor:'#1B2552',borderColor:'#4D62CC'}, fileTabText:{color:theme.colors.textSecondary,fontSize:11,fontWeight:'700'}, fileTabTextActive:{color:'#fff'},
  editor:{borderWidth:1,borderColor:theme.colors.border,borderRadius:16,overflow:'hidden',backgroundColor:'#080D18'}, editorBar:{height:42,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:theme.colors.border}, editorFile:{color:theme.colors.text,fontSize:12,fontWeight:'800'}, saved:{color:theme.colors.success,fontSize:9,fontWeight:'800'}, code:{minHeight:280,padding:14,color:'#E6EBFF',fontFamily:'monospace',fontSize:13,lineHeight:20},
  preview:{marginTop:10}, previewText:{color:theme.colors.textSecondary,fontSize:12,lineHeight:18,marginTop:7}, warning:{color:theme.colors.warning,fontSize:12,fontWeight:'700',marginTop:8}, body:{color:theme.colors.textSecondary,fontSize:12,lineHeight:18,marginTop:8}, actions:{marginVertical:10}, feedback:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginTop:8},
});
