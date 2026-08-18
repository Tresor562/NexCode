import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Course, Lesson } from '../data/curriculumCore';
import { masterySnapshot } from '../learning/masteryEngine';
import { LocalState } from '../lib/localState';
import { Card, Pill, PrimaryButton, ProgressBar, SectionHeader } from './components';
import { theme } from './theme';

export function LessonFlowScreen({
  course,
  lesson,
  state,
  onRecord,
  onOpenLab,
  onBack,
}: {
  course: Course;
  lesson: Lesson;
  state: LocalState;
  onRecord: (correct: boolean, errorTag?: string) => void;
  onOpenLab: () => void;
  onBack: () => void;
}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const correct = answer === lesson.correctIndex;
  const snapshots = useMemo(
    () => (lesson.skillIds ?? []).map((id) => masterySnapshot(id, state.mastery)),
    [lesson.id, state.mastery],
  );
  const mastery = snapshots.length ? Math.round(snapshots.reduce((sum, item) => sum + item.effectiveScore, 0) / snapshots.length) : 0;
  const attempts = state.lessonAttempts[lesson.id] ?? 0;

  function submit() {
    if (answer === null) return;
    setSubmitted(true);
    if (!recorded) {
      onRecord(correct, correct ? undefined : `${lesson.id}.misconception`);
      setRecorded(true);
    }
  }

  function retry() {
    setAnswer(null);
    setSubmitted(false);
    setRecorded(false);
  }

  return (
    <View>
      <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>‹ Retour au chapitre</Text></Pressable>
      <View style={styles.headerRow}>
        <Pill label={course.language} tone="primary" />
        <Pill label={`${lesson.durationMin} min`} />
        <Pill label={`Difficulté ${lesson.difficulty ?? 1}/5`} />
      </View>
      <Text style={styles.eyebrow}>{(lesson.activityKind ?? 'learn').toUpperCase()} • {lesson.module.toUpperCase()}</Text>
      <Text style={styles.title}>{lesson.title}</Text>
      <Text style={styles.lead}>Comprends, rappelle de mémoire, applique, puis entraîne-toi dans le Lab pour transformer la notion en compétence.</Text>

      <Card tone="primary">
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.kicker}>MAÎTRISE DE CETTE COMPÉTENCE</Text>
            <Text style={styles.mastery}>{mastery}%</Text>
          </View>
          <Text style={styles.meta}>{attempts} essai{attempts > 1 ? 's' : ''}</Text>
        </View>
        <ProgressBar value={mastery} />
        <Text style={styles.body}>{mastery >= 85 ? 'Solide, mais conserve les révisions espacées.' : mastery >= 55 ? 'En consolidation : pratique encore dans un contexte différent.' : 'Nouvelle compétence : vise d’abord la compréhension puis une preuve pratique.'}</Text>
      </Card>

      <SectionHeader title="1. Comprendre" />
      <Card>
        <Text style={styles.bodyLarge}>{lesson.concept}</Text>
        {lesson.retrievalPrompt ? (
          <View style={styles.recallBox}>
            <Text style={styles.kicker}>RAPPEL ACTIF</Text>
            <Text style={styles.recall}>{lesson.retrievalPrompt}</Text>
          </View>
        ) : null}
      </Card>

      <SectionHeader title="2. Observer un exemple" />
      <View style={styles.codeBlock}>
        <Text style={styles.codeLabel}>EXEMPLE • {course.language}</Text>
        <Text style={styles.code}>{lesson.example}</Text>
      </View>

      <SectionHeader title="3. Vérifier sans deviner" />
      <Card>
        <Text style={styles.question}>{lesson.question}</Text>
        <View style={styles.choices}>
          {lesson.choices.map((choice, index) => {
            const selected = answer === index;
            const revealCorrect = submitted && index === lesson.correctIndex;
            const revealWrong = submitted && selected && !correct;
            return (
              <Pressable
                key={`${index}:${choice}`}
                disabled={submitted}
                onPress={() => setAnswer(index)}
                style={[styles.choice, selected && styles.choiceSelected, revealCorrect && styles.choiceCorrect, revealWrong && styles.choiceWrong]}
              >
                <View style={styles.choiceLetter}><Text style={styles.choiceLetterText}>{String.fromCharCode(65 + index)}</Text></View>
                <Text style={styles.choiceText}>{choice}</Text>
              </Pressable>
            );
          })}
        </View>
        {!submitted ? <PrimaryButton label="Vérifier ma réponse" disabled={answer === null} onPress={submit} /> : null}
        {submitted ? (
          <View style={[styles.feedback, correct ? styles.feedbackGood : styles.feedbackBad]}>
            <Text style={[styles.feedbackTitle, correct ? styles.good : styles.bad]}>{correct ? '✓ Compréhension correcte' : 'À retravailler'}</Text>
            <Text style={styles.feedbackText}>{lesson.explanation}</Text>
            {!correct ? <PrimaryButton label="Réessayer après avoir relu l’explication" onPress={retry} /> : null}
          </View>
        ) : null}
      </Card>

      {lesson.transferPrompt ? (
        <>
          <SectionHeader title="4. Transférer la notion" />
          <Card>
            <Text style={styles.kicker}>NE RECOPIE PAS L’EXEMPLE</Text>
            <Text style={styles.bodyLarge}>{lesson.transferPrompt}</Text>
            <Text style={styles.body}>Essaie d’abord mentalement. Une compétence devient utile quand tu peux l’adapter à un contexte différent.</Text>
          </Card>
        </>
      ) : null}

      <SectionHeader title="5. Pratiquer dans le Lab" />
      <Card tone={correct ? 'success' : 'default'}>
        <Text style={styles.cardTitle}>Passe de “je comprends” à “je sais faire”.</Text>
        <Text style={styles.body}>Le Lab ouvre un workspace lié à cette leçon, sauvegarde automatiquement ton travail et vérifie structure, comportement, cas cachés et secrets évidents.</Text>
        <View style={styles.labFlags}>
          <Pill label="Multi-fichiers" tone="primary" />
          <Pill label="Autosave" tone="success" />
          <Pill label="Tests" tone="warning" />
        </View>
        <PrimaryButton label={correct ? 'Ouvrir la mission Lab' : 'Réponds correctement avant le Lab'} disabled={!correct} onPress={onOpenLab} />
      </Card>

      <SectionHeader title="6. Révision future" />
      <Card>
        <Text style={styles.body}>NexCode utilise tes essais et ta maîtrise pour reprogrammer cette compétence. Une réussite isolée ne la marque pas définitivement maîtrisée : Lab, checkpoint, boss challenge et projet servent de preuves plus fortes.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex:{flex:1}, back:{color:'#9DA8FF',fontSize:13,fontWeight:'800',paddingVertical:10}, headerRow:{flexDirection:'row',gap:7,flexWrap:'wrap',marginBottom:8}, eyebrow:{color:'#8A98FF',fontSize:10,fontWeight:'900',letterSpacing:1.1,marginTop:4,marginBottom:7}, title:{color:theme.colors.text,fontSize:28,fontWeight:'900',lineHeight:34}, lead:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:7,marginBottom:14},
  rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}, kicker:{color:'#8F9CFF',fontSize:10,fontWeight:'900',letterSpacing:1}, mastery:{color:theme.colors.text,fontSize:27,fontWeight:'900',marginTop:3,marginBottom:10}, meta:{color:theme.colors.textMuted,fontSize:11}, body:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginTop:8}, bodyLarge:{color:theme.colors.text,fontSize:15,lineHeight:23}, recallBox:{marginTop:14,padding:12,borderRadius:13,backgroundColor:theme.colors.surfaceSoft,borderWidth:1,borderColor:theme.colors.border}, recall:{color:theme.colors.textSecondary,fontSize:13,lineHeight:20,marginTop:6},
  codeBlock:{backgroundColor:'#080D18',borderWidth:1,borderColor:theme.colors.border,borderRadius:16,padding:14}, codeLabel:{color:'#8290B8',fontSize:9,fontWeight:'900',letterSpacing:1}, code:{color:'#E7EBFF',fontFamily:'monospace',fontSize:13,lineHeight:20,marginTop:10}, question:{color:theme.colors.text,fontSize:16,fontWeight:'800',lineHeight:22}, choices:{gap:8,marginVertical:14}, choice:{minHeight:52,flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:13,borderWidth:1,borderColor:theme.colors.border,backgroundColor:theme.colors.surfaceSoft}, choiceSelected:{borderColor:'#586BE1',backgroundColor:'#151E42'}, choiceCorrect:{borderColor:'#28734F',backgroundColor:theme.colors.successSoft}, choiceWrong:{borderColor:'#7B3D42',backgroundColor:'#32191E'}, choiceLetter:{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#202A43'}, choiceLetterText:{color:theme.colors.text,fontSize:11,fontWeight:'900'}, choiceText:{flex:1,color:theme.colors.textSecondary,fontSize:13,lineHeight:18}, feedback:{marginTop:12,padding:12,borderRadius:13,borderWidth:1}, feedbackGood:{borderColor:'#235A40',backgroundColor:theme.colors.successSoft}, feedbackBad:{borderColor:'#6E393E',backgroundColor:'#2C171B'}, feedbackTitle:{fontSize:13,fontWeight:'900'}, feedbackText:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginVertical:8}, good:{color:theme.colors.success}, bad:{color:'#F08B91'}, cardTitle:{color:theme.colors.text,fontSize:16,fontWeight:'850'}, labFlags:{flexDirection:'row',gap:7,flexWrap:'wrap',marginVertical:12},
});
