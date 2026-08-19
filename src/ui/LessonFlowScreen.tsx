import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { Course, Lesson } from '../data/curriculumCore';
import { masterySnapshot } from '../learning/masteryEngine';
import { LocalState } from '../lib/localState';
import { Card, Pill, PrimaryButton, ProgressBar } from './components';
import { theme } from './theme';

const successSound = require('../../assets/sounds/success.wav');
const errorSound = require('../../assets/sounds/error.wav');
const tapSound = require('../../assets/sounds/tap.wav');

type Step = 'learn' | 'example' | 'quiz' | 'transfer' | 'lab';

export function LessonFlowScreen({ course, lesson, state, onRecord, onOpenLab, onBack }: {
  course: Course;
  lesson: Lesson;
  state: LocalState;
  onRecord: (correct: boolean, errorTag?: string) => void;
  onOpenLab: () => void;
  onBack: () => void;
}) {
  const steps = useMemo<Step[]>(() => ['learn', 'example', 'quiz', ...(lesson.transferPrompt ? ['transfer' as Step] : []), 'lab'], [lesson.id]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const successPlayer = useAudioPlayer(successSound);
  const errorPlayer = useAudioPlayer(errorSound);
  const tapPlayer = useAudioPlayer(tapSound);
  const step = steps[stepIndex];
  const correct = answer === lesson.correctIndex;
  const snapshots = useMemo(() => (lesson.skillIds ?? []).map((id) => masterySnapshot(id, state.mastery)), [lesson.id, state.mastery]);
  const mastery = snapshots.length ? Math.round(snapshots.reduce((sum, item) => sum + item.effectiveScore, 0) / snapshots.length) : 0;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  function pulse() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 28, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
    ]).start();
  }

  function sound(player: ReturnType<typeof useAudioPlayer>) {
    player.seekTo(0).then(() => player.play()).catch(() => undefined);
  }

  function next() {
    sound(tapPlayer);
    Haptics.selectionAsync().catch(() => undefined);
    pulse();
    setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  }

  function previous() {
    Haptics.selectionAsync().catch(() => undefined);
    setStepIndex((value) => Math.max(0, value - 1));
  }

  function submit() {
    if (answer === null) return;
    setSubmitted(true);
    if (!recorded) {
      onRecord(correct, correct ? undefined : `${lesson.id}.misconception`);
      setRecorded(true);
    }
    if (correct) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      sound(successPlayer);
      pulse();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      sound(errorPlayer);
    }
  }

  function retry() {
    setAnswer(null);
    setSubmitted(false);
    setRecorded(false);
  }

  return (
    <View>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} accessibilityRole="button" style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
        <View style={styles.progressWrap}><ProgressBar value={progress} /></View>
        <Pill label={`${stepIndex + 1}/${steps.length}`} tone="primary" />
      </View>

      <View style={styles.heroRow}>
        <Animated.View style={[styles.mentor, { transform: [{ scale }] }]}>
          <View style={styles.eyeRow}><View style={styles.eye} /><View style={styles.eye} /></View>
          <View style={styles.smile} />
        </Animated.View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{course.language.toUpperCase()} • {lesson.module.toUpperCase()}</Text>
          <Text style={styles.title}>{lesson.title}</Text>
          <Text style={styles.mini}>{mastery}% maîtrise • {lesson.durationMin} min</Text>
        </View>
      </View>

      {step === 'learn' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>ÉTAPE 1 • COMPRENDRE</Text>
          <Text style={styles.prompt}>Une seule idée à retenir.</Text>
          <Card tone="primary" style={styles.bigCard}>
            <Text style={styles.concept}>{lesson.concept}</Text>
            {lesson.retrievalPrompt ? <View style={styles.recall}><Text style={styles.recallLabel}>Teste ta mémoire</Text><Text style={styles.recallText}>{lesson.retrievalPrompt}</Text></View> : null}
          </Card>
          <PrimaryButton label="J’ai compris" icon="→" onPress={next} />
        </View>
      ) : null}

      {step === 'example' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>ÉTAPE 2 • REGARDER</Text>
          <Text style={styles.prompt}>Observe ce que fait le code.</Text>
          <View style={styles.codeBlock}>
            <View style={styles.codeTop}><Text style={styles.codeFile}>example.{course.language.toLowerCase().includes('python') ? 'py' : 'txt'}</Text><Text style={styles.runBadge}>EXEMPLE</Text></View>
            <Text style={styles.code}>{lesson.example}</Text>
          </View>
          <PrimaryButton label="Continuer" icon="→" onPress={next} />
        </View>
      ) : null}

      {step === 'quiz' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>À TOI DE JOUER</Text>
          <Text style={styles.question}>{lesson.question}</Text>
          <View style={styles.choices}>
            {lesson.choices.map((choice, index) => {
              const selected = answer === index;
              const revealCorrect = submitted && index === lesson.correctIndex;
              const revealWrong = submitted && selected && !correct;
              return (
                <Pressable key={`${index}:${choice}`} disabled={submitted} onPress={() => { setAnswer(index); Haptics.selectionAsync().catch(() => undefined); }} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, revealCorrect && styles.choiceCorrect, revealWrong && styles.choiceWrong, pressed && styles.pressed]}>
                  <View style={styles.choiceLetter}><Text style={styles.choiceLetterText}>{String.fromCharCode(65 + index)}</Text></View>
                  <Text style={styles.choiceText}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
          {!submitted ? <PrimaryButton label="Vérifier" disabled={answer === null} onPress={submit} /> : null}
          {submitted ? <View style={[styles.feedback, correct ? styles.feedbackGood : styles.feedbackBad]}><Text style={styles.feedbackTitle}>{correct ? 'Excellent !' : 'Presque.'}</Text><Text style={styles.feedbackText}>{lesson.explanation}</Text>{correct ? <PrimaryButton label="Étape suivante" icon="→" onPress={next} /> : <PrimaryButton label="Réessayer" onPress={retry} />}</View> : null}
        </View>
      ) : null}

      {step === 'transfer' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>MISSION FLASH</Text>
          <Text style={styles.prompt}>Utilise la même idée dans un autre contexte.</Text>
          <Card style={styles.bigCard}><Text style={styles.transfer}>{lesson.transferPrompt}</Text><Text style={styles.tip}>Pas besoin d’être parfait. Imagine d’abord la solution, puis passe au Lab.</Text></Card>
          <PrimaryButton label="Je tente la mission" icon="→" onPress={next} />
        </View>
      ) : null}

      {step === 'lab' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>FINAL • CONSTRUIRE</Text>
          <Text style={styles.prompt}>Maintenant, écris vraiment du code.</Text>
          <Card tone={correct ? 'success' : 'primary'} style={styles.bigCard}>
            <Text style={styles.labTitle}>Mission Lab</Text>
            <Text style={styles.labText}>Éditeur multi-fichiers, aperçu, console, tests et outils de code dans le même espace.</Text>
            <View style={styles.flags}><Pill label="Code" tone="primary" /><Pill label="Preview" tone="success" /><Pill label="Console" tone="warning" /><Pill label="Tools" /></View>
          </Card>
          <PrimaryButton label="Ouvrir le Lab" icon="⌘" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); onOpenLab(); }} />
        </View>
      ) : null}

      {stepIndex > 0 ? <Pressable onPress={previous} style={styles.backButton}><Text style={styles.backText}>← Étape précédente</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:18},close:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.07)',borderWidth:1,borderColor:'rgba(255,255,255,0.11)'},closeText:{color:theme.colors.text,fontSize:24,lineHeight:26},progressWrap:{flex:1},
  heroRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20},mentor:{width:58,height:58,borderRadius:22,backgroundColor:'#6677FF',alignItems:'center',justifyContent:'center',shadowColor:'#6677FF',shadowOpacity:.28,shadowRadius:16,elevation:8},eyeRow:{flexDirection:'row',gap:8},eye:{width:6,height:8,borderRadius:4,backgroundColor:'#fff'},smile:{width:18,height:8,borderBottomWidth:2,borderColor:'#fff',borderRadius:10,marginTop:6},heroCopy:{flex:1},eyebrow:{color:'#8E9AFF',fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{color:theme.colors.text,fontSize:21,fontWeight:'900',lineHeight:26,marginTop:3},mini:{color:theme.colors.textMuted,fontSize:11,marginTop:4},
  stage:{gap:14},stepLabel:{color:'#8D99FF',fontSize:10,fontWeight:'900',letterSpacing:1.25},prompt:{color:theme.colors.text,fontSize:25,fontWeight:'900',lineHeight:31},bigCard:{padding:18},concept:{color:theme.colors.text,fontSize:18,lineHeight:28,fontWeight:'700'},recall:{marginTop:18,padding:14,borderRadius:16,backgroundColor:'rgba(255,255,255,0.055)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},recallLabel:{color:'#9BA6FF',fontSize:10,fontWeight:'900',textTransform:'uppercase'},recallText:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:6},
  codeBlock:{backgroundColor:'#070B13',borderWidth:1,borderColor:'#222A3D',borderRadius:20,overflow:'hidden'},codeTop:{height:42,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#1C2435'},codeFile:{color:'#AEB8D5',fontFamily:'monospace',fontSize:11},runBadge:{color:'#7EE6B0',fontSize:9,fontWeight:'900'},code:{color:'#EAF0FF',fontFamily:'monospace',fontSize:13,lineHeight:21,padding:16,minHeight:190},
  question:{color:theme.colors.text,fontSize:23,fontWeight:'900',lineHeight:30},choices:{gap:10},choice:{minHeight:58,flexDirection:'row',alignItems:'center',gap:12,padding:12,borderRadius:16,borderWidth:1,borderColor:theme.colors.border,backgroundColor:'rgba(255,255,255,0.045)'},choiceSelected:{borderColor:'#6476FF',backgroundColor:'rgba(100,118,255,0.15)'},choiceCorrect:{borderColor:'#2E9A69',backgroundColor:'rgba(46,154,105,0.14)'},choiceWrong:{borderColor:'#B94B57',backgroundColor:'rgba(185,75,87,0.13)'},pressed:{transform:[{scale:.985}]},choiceLetter:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.07)'},choiceLetterText:{color:theme.colors.text,fontSize:11,fontWeight:'900'},choiceText:{flex:1,color:theme.colors.text,fontSize:14,lineHeight:20,fontWeight:'700'},
  feedback:{padding:16,borderRadius:18,borderWidth:1},feedbackGood:{borderColor:'#2D7655',backgroundColor:'rgba(34,116,79,0.16)'},feedbackBad:{borderColor:'#7A4148',backgroundColor:'rgba(122,65,72,0.16)'},feedbackTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},feedbackText:{color:theme.colors.textSecondary,fontSize:13,lineHeight:20,marginVertical:8},transfer:{color:theme.colors.text,fontSize:18,fontWeight:'800',lineHeight:27},tip:{color:theme.colors.textSecondary,fontSize:13,lineHeight:20,marginTop:12},labTitle:{color:theme.colors.text,fontSize:23,fontWeight:'900'},labText:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:8},flags:{flexDirection:'row',gap:7,flexWrap:'wrap',marginTop:14},backButton:{alignSelf:'center',padding:12,marginTop:14},backText:{color:theme.colors.textMuted,fontSize:12,fontWeight:'800'},
});
