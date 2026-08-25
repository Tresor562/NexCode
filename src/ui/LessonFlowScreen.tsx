import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { Course, Lesson } from '../data/curriculumCore';
import { masterySnapshot } from '../learning/masteryEngine';
import { LocalState } from '../lib/localState';
import { Card, Pill, PrimaryButton, ProgressBar } from './components';
import { useMotionPreferences } from './motionPreferences';
import { theme } from './theme';

const successSound = require('../../assets/sounds/success.wav');
const errorSound = require('../../assets/sounds/error.wav');
const tapSound = require('../../assets/sounds/tap.wav');

type Step = 'learn' | 'example' | 'recall' | 'quiz' | 'transfer' | 'lab';
type RecallConfidence = 'unsure' | 'close' | 'ready';

export function LessonFlowScreen({ course, lesson, state, onRecord, onOpenLab, onBack }: {
  course: Course;
  lesson: Lesson;
  state: LocalState;
  onRecord: (correct: boolean, errorTag?: string) => void;
  onOpenLab: () => void;
  onBack: () => void;
}) {
  const steps = useMemo<Step[]>(() => [
    'learn',
    'example',
    ...(lesson.retrievalPrompt ? ['recall' as Step] : []),
    'quiz',
    ...(lesson.transferPrompt ? ['transfer' as Step] : []),
    'lab',
  ], [lesson.id, lesson.retrievalPrompt, lesson.transferPrompt]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [recallDraft, setRecallDraft] = useState('');
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [recallConfidence, setRecallConfidence] = useState<RecallConfidence | null>(null);
  const [transferDraft, setTransferDraft] = useState('');
  const { reduceMotion, appActive } = useMotionPreferences();
  const scale = useRef(new Animated.Value(1)).current;
  const successPlayer = useAudioPlayer(successSound);
  const errorPlayer = useAudioPlayer(errorSound);
  const tapPlayer = useAudioPlayer(tapSound);
  const step = steps[stepIndex];
  const correct = answer === lesson.correctIndex;
  const recallAttemptReady = recallDraft.trim().length >= 3;
  const transferAttemptReady = transferDraft.trim().length >= 12;
  const snapshots = useMemo(() => (lesson.skillIds ?? []).map((id) => masterySnapshot(id, state.mastery)), [lesson.id, state.mastery]);
  const mastery = snapshots.length ? Math.round(snapshots.reduce((sum, item) => sum + item.effectiveScore, 0) / snapshots.length) : 0;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  useEffect(() => {
    if (appActive && !reduceMotion) return;
    scale.stopAnimation();
    scale.setValue(1);
  }, [appActive, reduceMotion, scale]);

  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    setStepIndex(0);
    setAnswer(null);
    setSubmitted(false);
    setRecorded(false);
    setRecallDraft('');
    setRecallRevealed(false);
    setRecallConfidence(null);
    setTransferDraft('');
  }, [lesson.id, scale]);

  function pulse() {
    if (reduceMotion || !appActive) {
      scale.stopAnimation();
      scale.setValue(1);
      return;
    }
    scale.stopAnimation();
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 28, bounciness: 10 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
    ]).start();
  }

  function sound(player: ReturnType<typeof useAudioPlayer>) {
    if (!appActive) return;
    player.seekTo(0).then(() => player.play()).catch(() => undefined);
  }

  function selectionFeedback() {
    if (!appActive) return;
    Haptics.selectionAsync().catch(() => undefined);
  }

  function notificationFeedback(type: Haptics.NotificationFeedbackType) {
    if (!appActive) return;
    Haptics.notificationAsync(type).catch(() => undefined);
  }

  function impactFeedback(style: Haptics.ImpactFeedbackStyle) {
    if (!appActive) return;
    Haptics.impactAsync(style).catch(() => undefined);
  }

  function next() {
    sound(tapPlayer);
    selectionFeedback();
    pulse();
    setStepIndex((value) => Math.min(steps.length - 1, value + 1));
  }

  function previous() {
    selectionFeedback();
    setStepIndex((value) => Math.max(0, value - 1));
  }

  function revealRecall() {
    if (!recallAttemptReady) return;
    setRecallRevealed(true);
    selectionFeedback();
    sound(tapPlayer);
  }

  function chooseConfidence(value: RecallConfidence) {
    setRecallConfidence(value);
    selectionFeedback();
  }

  function submit() {
    if (answer === null) return;
    setSubmitted(true);
    if (!recorded) {
      onRecord(correct, correct ? undefined : `${lesson.id}.misconception`);
      setRecorded(true);
    }
    if (correct) {
      notificationFeedback(Haptics.NotificationFeedbackType.Success);
      sound(successPlayer);
      pulse();
    } else {
      notificationFeedback(Haptics.NotificationFeedbackType.Error);
      sound(errorPlayer);
    }
  }

  function retry() {
    setAnswer(null);
    setSubmitted(false);
    setRecorded(false);
  }

  const mentorMood = submitted ? (correct ? '✓' : '?') : step === 'recall' ? '…' : '';

  return (
    <View>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Quitter la leçon" style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
        <View style={styles.progressWrap}><ProgressBar value={progress} /></View>
        <Pill label={`${stepIndex + 1}/${steps.length}`} tone="primary" />
      </View>

      <View style={styles.heroRow}>
        <Animated.View style={[styles.mentor, { transform: [{ scale }] }]} accessible accessibilityLabel="Mentor Nex">
          <View style={styles.eyeRow}><View style={styles.eye} /><View style={styles.eye} /></View>
          {mentorMood ? <Text style={styles.mentorMood}>{mentorMood}</Text> : <View style={styles.smile} />}
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
          <Card tone="primary" style={styles.bigCard}><Text style={styles.concept}>{lesson.concept}</Text></Card>
          <Text style={styles.coachLine}>N’essaie pas de tout mémoriser. Cherche surtout à comprendre pourquoi cette idée existe.</Text>
          <PrimaryButton label="J’ai compris" icon="→" onPress={next} />
        </View>
      ) : null}

      {step === 'example' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>ÉTAPE 2 • OBSERVER</Text>
          <Text style={styles.prompt}>Lis le code, puis prédis ce qu’il fait.</Text>
          <View style={styles.codeBlock}>
            <View style={styles.codeTop}>
              <Text style={styles.codeFile}>example.{course.language.toLowerCase().includes('python') ? 'py' : 'txt'}</Text>
              <Text style={styles.runBadge}>EXEMPLE</Text>
            </View>
            <Text style={styles.code}>{lesson.example}</Text>
          </View>
          <Text style={styles.coachLine}>Avant de continuer, explique mentalement chaque ligne avec tes propres mots.</Text>
          <PrimaryButton label="J’ai fait ma prédiction" icon="→" onPress={next} />
        </View>
      ) : null}

      {step === 'recall' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>RAPPEL ACTIF • SANS REGARDER</Text>
          <Text style={styles.prompt}>Récupère l’idée de mémoire.</Text>
          <Card style={styles.bigCard}>
            <Text style={styles.recallQuestion}>{lesson.retrievalPrompt}</Text>
            {!recallRevealed ? (
              <View style={styles.recallChallenge}>
                <Text style={styles.recallChallengeTitle}>Fais d’abord l’effort.</Text>
                <Text style={styles.recallChallengeText}>Écris ta réponse avec tes mots avant de voir le repère. Même imparfaite, une vraie tentative renforce mieux la mémoire qu’une simple relecture.</Text>
                <TextInput
                  value={recallDraft}
                  onChangeText={setRecallDraft}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  placeholder="Explique ce dont tu te souviens…"
                  placeholderTextColor={theme.colors.textMuted}
                  accessibilityLabel="Ta réponse de rappel actif"
                  accessibilityHint="Écris au moins quelques mots avant de révéler le repère"
                  style={styles.recallInput}
                />
                <Text style={styles.recallCounter}>{recallDraft.trim().length}/500 • {recallAttemptReady ? 'tentative prête' : 'écris au moins 3 caractères'}</Text>
              </View>
            ) : (
              <>
                <View style={styles.recallAttempt}>
                  <Text style={styles.recallRevealLabel}>TA RÉPONSE</Text>
                  <Text style={styles.recallAttemptText}>{recallDraft.trim()}</Text>
                </View>
                <View style={styles.recallReveal}>
                  <Text style={styles.recallRevealLabel}>REPÈRE</Text>
                  <Text style={styles.recallRevealText}>{lesson.concept}</Text>
                </View>
              </>
            )}
          </Card>

          {!recallRevealed ? <PrimaryButton label="Comparer avec le repère" disabled={!recallAttemptReady} onPress={revealRecall} /> : (
            <>
              <Text style={styles.confidenceTitle}>À quel point ta réponse était proche ?</Text>
              <View style={styles.confidenceRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="À revoir" accessibilityState={{ selected: recallConfidence === 'unsure' }} onPress={() => chooseConfidence('unsure')} style={[styles.confidence, recallConfidence === 'unsure' && styles.confidenceActive]}>
                  <Text style={styles.confidenceEmoji}>○</Text><Text style={styles.confidenceText}>À revoir</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Presque" accessibilityState={{ selected: recallConfidence === 'close' }} onPress={() => chooseConfidence('close')} style={[styles.confidence, recallConfidence === 'close' && styles.confidenceActive]}>
                  <Text style={styles.confidenceEmoji}>◐</Text><Text style={styles.confidenceText}>Presque</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Je l’avais" accessibilityState={{ selected: recallConfidence === 'ready' }} onPress={() => chooseConfidence('ready')} style={[styles.confidence, recallConfidence === 'ready' && styles.confidenceActive]}>
                  <Text style={styles.confidenceEmoji}>●</Text><Text style={styles.confidenceText}>Je l’avais</Text>
                </Pressable>
              </View>
              <PrimaryButton label="Tester pour de vrai" icon="→" disabled={recallConfidence === null} onPress={next} />
            </>
          )}
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
                <Pressable
                  key={`${index}:${choice}`}
                  disabled={submitted}
                  accessibilityRole="button"
                  accessibilityLabel={`${String.fromCharCode(65 + index)}. ${choice}`}
                  accessibilityState={{ selected, disabled: submitted }}
                  onPress={() => { setAnswer(index); selectionFeedback(); }}
                  style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, revealCorrect && styles.choiceCorrect, revealWrong && styles.choiceWrong, pressed && (reduceMotion ? styles.pressedReducedMotion : styles.pressed)]}
                >
                  <View style={styles.choiceLetter}><Text style={styles.choiceLetterText}>{String.fromCharCode(65 + index)}</Text></View>
                  <Text style={styles.choiceText}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
          {!submitted ? <PrimaryButton label="Vérifier" disabled={answer === null} onPress={submit} /> : null}
          {submitted ? (
            <View style={[styles.feedback, correct ? styles.feedbackGood : styles.feedbackBad]} accessibilityLiveRegion="polite">
              <Text style={styles.feedbackTitle}>{correct ? 'Excellent !' : 'Presque.'}</Text>
              <Text style={styles.feedbackText}>{lesson.explanation}</Text>
              {correct ? <PrimaryButton label="Étape suivante" icon="→" onPress={next} /> : <PrimaryButton label="Réessayer" onPress={retry} />}
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 'transfer' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>MISSION FLASH • TRANSFERT</Text>
          <Text style={styles.prompt}>Même idée. Nouveau contexte.</Text>
          <Card style={styles.bigCard}>
            <Text style={styles.transfer}>{lesson.transferPrompt}</Text>
            <Text style={styles.tip}>Ne cherche pas une phrase apprise par cœur. Décide comment utiliser le concept pour résoudre ce nouveau problème.</Text>
            <View style={styles.transferAttempt}>
              <Text style={styles.transferAttemptLabel}>TA STRATÉGIE</Text>
              <TextInput
                value={transferDraft}
                onChangeText={setTransferDraft}
                multiline
                maxLength={600}
                textAlignVertical="top"
                placeholder="Décris ce que tu ferais, même en pseudo-code…"
                placeholderTextColor={theme.colors.textMuted}
                accessibilityLabel="Ta stratégie pour la mission de transfert"
                accessibilityHint="Explique une vraie démarche avant de continuer vers le Lab"
                style={styles.transferInput}
              />
              <Text style={styles.transferCounter}>{transferDraft.trim().length}/600 • {transferAttemptReady ? 'stratégie prête' : 'explique ta démarche en au moins 12 caractères'}</Text>
            </View>
          </Card>
          <PrimaryButton label="Passer au Lab" icon="→" disabled={!transferAttemptReady} onPress={next} />
        </View>
      ) : null}

      {step === 'lab' ? (
        <View style={styles.stage}>
          <Text style={styles.stepLabel}>FINAL • CONSTRUIRE</Text>
          <Text style={styles.prompt}>Maintenant, écris vraiment du code.</Text>
          <Card tone={correct ? 'success' : 'primary'} style={styles.bigCard}>
            <Text style={styles.labTitle}>Mission Lab</Text>
            <Text style={styles.labText}>{lesson.labMission?.instructions ?? 'Reproduis le concept dans le Lab et vérifie toi-même le résultat.'}</Text>
            {lesson.labMission?.successCriteria?.length ? (
              <View style={styles.criteria}>
                {lesson.labMission.successCriteria.slice(0, 3).map((criterion, index) => (
                  <View key={`${index}:${criterion}`} style={styles.criterionRow}><Text style={styles.criterionDot}>✓</Text><Text style={styles.criterionText}>{criterion}</Text></View>
                ))}
              </View>
            ) : null}
            <View style={styles.flags}><Pill label="Code" tone="primary" /><Pill label="Preview" tone="success" /><Pill label="Console" tone="warning" /><Pill label="Tools" /></View>
          </Card>
          <PrimaryButton label="Ouvrir le Lab" icon="⌘" onPress={() => { impactFeedback(Haptics.ImpactFeedbackStyle.Medium); onOpenLab(); }} />
        </View>
      ) : null}

      {stepIndex > 0 ? <Pressable onPress={previous} accessibilityRole="button" accessibilityLabel="Étape précédente" style={styles.backButton}><Text style={styles.backText}>← Étape précédente</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:18},close:{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.07)',borderWidth:1,borderColor:'rgba(255,255,255,0.11)'},closeText:{color:theme.colors.text,fontSize:24,lineHeight:26},progressWrap:{flex:1},
  heroRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:20},mentor:{width:58,height:58,borderRadius:22,backgroundColor:'#6677FF',alignItems:'center',justifyContent:'center',shadowColor:'#6677FF',shadowOpacity:.28,shadowRadius:16,elevation:8},eyeRow:{flexDirection:'row',gap:8},eye:{width:6,height:8,borderRadius:4,backgroundColor:'#fff'},smile:{width:18,height:8,borderBottomWidth:2,borderColor:'#fff',borderRadius:10,marginTop:6},mentorMood:{color:'#fff',fontSize:12,fontWeight:'900',lineHeight:14,marginTop:4},heroCopy:{flex:1},eyebrow:{color:'#8E9AFF',fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{color:theme.colors.text,fontSize:21,fontWeight:'900',lineHeight:26,marginTop:3},mini:{color:theme.colors.textMuted,fontSize:11,marginTop:4},
  stage:{gap:14},stepLabel:{color:'#8D99FF',fontSize:10,fontWeight:'900',letterSpacing:1.25},prompt:{color:theme.colors.text,fontSize:25,fontWeight:'900',lineHeight:31},bigCard:{padding:18},concept:{color:theme.colors.text,fontSize:18,lineHeight:28,fontWeight:'700'},coachLine:{color:theme.colors.textMuted,fontSize:12,lineHeight:18,paddingHorizontal:2},
  codeBlock:{backgroundColor:'#070B13',borderWidth:1,borderColor:'#222A3D',borderRadius:20,overflow:'hidden'},codeTop:{height:42,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#1C2435'},codeFile:{color:'#AEB8D5',fontFamily:'monospace',fontSize:11},runBadge:{color:'#7EE6B0',fontSize:9,fontWeight:'900'},code:{color:'#EAF0FF',fontFamily:'monospace',fontSize:13,lineHeight:21,padding:16,minHeight:190},
  recallQuestion:{color:theme.colors.text,fontSize:20,lineHeight:29,fontWeight:'900'},recallChallenge:{marginTop:18,padding:14,borderRadius:16,backgroundColor:'rgba(255,255,255,0.045)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},recallChallengeTitle:{color:'#AEB8FF',fontSize:12,fontWeight:'900'},recallChallengeText:{color:theme.colors.textSecondary,fontSize:13,lineHeight:20,marginTop:6},recallInput:{minHeight:112,marginTop:14,padding:13,borderRadius:14,borderWidth:1,borderColor:'rgba(142,154,255,0.34)',backgroundColor:'rgba(5,8,16,0.42)',color:theme.colors.text,fontSize:14,lineHeight:21},recallCounter:{color:theme.colors.textMuted,fontSize:10,lineHeight:14,marginTop:7,textAlign:'right'},recallAttempt:{marginTop:18,padding:14,borderRadius:16,backgroundColor:'rgba(255,255,255,0.045)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},recallAttemptText:{color:theme.colors.textSecondary,fontSize:14,lineHeight:22,marginTop:6},recallReveal:{marginTop:10,padding:14,borderRadius:16,backgroundColor:'rgba(100,118,255,0.12)',borderWidth:1,borderColor:'rgba(100,118,255,0.28)'},recallRevealLabel:{color:'#9BA6FF',fontSize:9,fontWeight:'900',letterSpacing:1.1},recallRevealText:{color:theme.colors.text,fontSize:14,lineHeight:22,fontWeight:'700',marginTop:6},confidenceTitle:{color:theme.colors.textSecondary,fontSize:12,fontWeight:'800'},confidenceRow:{flexDirection:'row',gap:8},confidence:{flex:1,minHeight:68,paddingVertical:10,paddingHorizontal:7,borderRadius:15,borderWidth:1,borderColor:theme.colors.border,backgroundColor:'rgba(255,255,255,0.035)',alignItems:'center',justifyContent:'center',gap:5},confidenceActive:{borderColor:'#6677FF',backgroundColor:'rgba(102,119,255,0.16)'},confidenceEmoji:{color:'#AAB4FF',fontSize:15,fontWeight:'900'},confidenceText:{color:theme.colors.text,fontSize:10,fontWeight:'800',textAlign:'center'},
  question:{color:theme.colors.text,fontSize:23,fontWeight:'900',lineHeight:30},choices:{gap:10},choice:{minHeight:58,flexDirection:'row',alignItems:'center',gap:12,padding:12,borderRadius:16,borderWidth:1,borderColor:theme.colors.border,backgroundColor:'rgba(255,255,255,0.045)'},choiceSelected:{borderColor:'#6476FF',backgroundColor:'rgba(100,118,255,0.15)'},choiceCorrect:{borderColor:'#2E9A69',backgroundColor:'rgba(46,154,105,0.14)'},choiceWrong:{borderColor:'#B94B57',backgroundColor:'rgba(185,75,87,0.13)'},pressed:{transform:[{scale:.985}]},pressedReducedMotion:{opacity:.78},choiceLetter:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.07)'},choiceLetterText:{color:theme.colors.text,fontSize:11,fontWeight:'900'},choiceText:{flex:1,color:theme.colors.text,fontSize:14,lineHeight:20,fontWeight:'700'},
  feedback:{padding:16,borderRadius:18,borderWidth:1},feedbackGood:{borderColor:'#2D7655',backgroundColor:'rgba(34,116,79,0.16)'},feedbackBad:{borderColor:'#7A4148',backgroundColor:'rgba(122,65,72,0.16)'},feedbackTitle:{color:theme.colors.text,fontSize:18,fontWeight:'900'},feedbackText:{color:theme.colors.textSecondary,fontSize:13,lineHeight:20,marginVertical:8},transfer:{color:theme.colors.text,fontSize:18,fontWeight:'800',lineHeight:27},tip:{color:theme.colors.textSecondary,fontSize:13,lineHeight:20,marginTop:12},transferAttempt:{marginTop:16,padding:14,borderRadius:16,backgroundColor:'rgba(255,255,255,0.045)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},transferAttemptLabel:{color:'#9BA6FF',fontSize:9,fontWeight:'900',letterSpacing:1.1},transferInput:{minHeight:118,marginTop:10,padding:13,borderRadius:14,borderWidth:1,borderColor:'rgba(142,154,255,0.34)',backgroundColor:'rgba(5,8,16,0.42)',color:theme.colors.text,fontSize:14,lineHeight:21},transferCounter:{color:theme.colors.textMuted,fontSize:10,lineHeight:14,marginTop:7,textAlign:'right'},labTitle:{color:theme.colors.text,fontSize:23,fontWeight:'900'},labText:{color:theme.colors.textSecondary,fontSize:14,lineHeight:21,marginTop:8},criteria:{gap:8,marginTop:14},criterionRow:{flexDirection:'row',alignItems:'flex-start',gap:8},criterionDot:{color:'#70DEA8',fontSize:12,fontWeight:'900',marginTop:1},criterionText:{flex:1,color:theme.colors.textSecondary,fontSize:12,lineHeight:18},flags:{flexDirection:'row',gap:7,flexWrap:'wrap',marginTop:14},backButton:{alignSelf:'center',padding:12,marginTop:14},backText:{color:theme.colors.textMuted,fontSize:12,fontWeight:'800'},
});