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
import { courses, guidedProjects, practiceTemplates } from './src/data/courses';
import { loadLocalState, LocalState, saveLocalState } from './src/lib/localState';
import { checkPractice, PracticeLanguage } from './src/lib/practice';

type Tab = 'Aujourd’hui' | 'Apprendre' | 'Lab' | 'Offline';

const tabs: Tab[] = ['Aujourd’hui', 'Apprendre', 'Lab', 'Offline'];
const labLanguages: PracticeLanguage[] = ['JavaScript', 'Python', 'SQL'];

export default function App() {
  const [tab, setTab] = useState<Tab>('Aujourd’hui');
  const [state, setState] = useState<LocalState>(() => loadLocalState());
  const [language, setLanguage] = useState<PracticeLanguage>('JavaScript');
  const [source, setSource] = useState(practiceTemplates.JavaScript);
  const [result, setResult] = useState('Prêt pour un test local — aucune IA nécessaire.');

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

  function toggleDownload(courseId: string) {
    setState((current) => ({
      ...current,
      downloadedCourses: current.downloadedCourses.includes(courseId)
        ? current.downloadedCourses.filter((id) => id !== courseId)
        : [...current.downloadedCourses, courseId],
    }));
  }

  function selectLanguage(next: PracticeLanguage) {
    setLanguage(next);
    setSource(practiceTemplates[next]);
    setResult('Prêt pour un test local — aucune IA nécessaire.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>NexCode</Text>
            <Text style={styles.subtitle}>Learn • Practice • Build</Text>
          </View>
          <View style={styles.offlinePill}>
            <Text style={styles.offlineText}>● Offline ready</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'Aujourd’hui' && (
            <>
              <Text style={styles.eyebrow}>TON TABLEAU DE BORD</Text>
              <Text style={styles.title}>Continue à construire.</Text>
              <Text style={styles.muted}>Une session courte suffit pour garder le rythme.</Text>

              <View style={styles.statRow}>
                <Stat label="Série" value={`🔥 ${state.streak} j`} />
                <Stat label="XP" value={`⚡ ${state.xp}`} />
                <Stat label="Objectif" value={`${state.dailyGoal}%`} />
              </View>

              <Card>
                <Text style={styles.cardKicker}>CONTINUER</Text>
                <Text style={styles.cardTitle}>JavaScript — Fonctions</Text>
                <Text style={styles.muted}>Étape suivante : écrire une fonction qui retourne une valeur.</Text>
                <Progress value={62} />
                <PrimaryButton label="Reprendre la leçon" onPress={() => setTab('Apprendre')} />
              </Card>

              <Text style={styles.sectionTitle}>Projets guidés</Text>
              {guidedProjects.map((project) => (
                <Card key={project.id} compact>
                  <Text style={styles.cardTitle}>{project.title}</Text>
                  <Text style={styles.muted}>{project.tech}</Text>
                  <Progress value={project.progress} />
                  <Text style={styles.small}>{project.progress}% terminé</Text>
                </Card>
              ))}
            </>
          )}

          {tab === 'Apprendre' && (
            <>
              <Text style={styles.eyebrow}>PARCOURS V1.5</Text>
              <Text style={styles.title}>Apprends à ton rythme.</Text>
              <Text style={styles.muted}>Les fondations restent légères et disponibles hors connexion.</Text>

              {courses.map((course) => {
                const downloaded = state.downloadedCourses.includes(course.id);
                return (
                  <Card key={course.id}>
                    <View style={styles.courseTop}>
                      <View style={[styles.courseDot, { backgroundColor: course.color }]} />
                      <View style={styles.flex}>
                        <Text style={styles.cardTitle}>{course.title}</Text>
                        <Text style={styles.small}>{course.level} • {course.lessons} leçons</Text>
                      </View>
                    </View>
                    <Text style={styles.muted}>{course.description}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.small}>{course.offlineSizeMb} Mo</Text>
                      <Text style={downloaded ? styles.success : styles.small}>
                        {downloaded ? '✓ Disponible offline' : 'Non téléchargé'}
                      </Text>
                    </View>
                    <SecondaryButton
                      label={downloaded ? 'Retirer du téléphone' : 'Télécharger le cours'}
                      onPress={() => toggleDownload(course.id)}
                    />
                  </Card>
                );
              })}
            </>
          )}

          {tab === 'Lab' && (
            <>
              <Text style={styles.eyebrow}>NEXCODE LAB</Text>
              <Text style={styles.title}>Pratique sans serveur.</Text>
              <Text style={styles.muted}>
                V1.5 valide localement des exercices ciblés JavaScript, Python et SQL sans exécuter de code non fiable dans le Cloud.
              </Text>

              <View style={styles.segmentRow}>
                {labLanguages.map((item) => (
                  <Pressable
                    key={item}
                    style={[styles.segment, language === item && styles.segmentActive]}
                    onPress={() => selectLanguage(item)}
                  >
                    <Text style={[styles.segmentText, language === item && styles.segmentTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.editor}>
                <Text style={styles.editorLabel}>{language.toUpperCase()} • LOCAL PRACTICE</Text>
                <TextInput
                  multiline
                  value={source}
                  onChangeText={setSource}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  style={styles.codeInput}
                  textAlignVertical="top"
                />
              </View>

              <PrimaryButton label="Tester ma réponse" onPress={() => setResult(checkPractice(language, source))} />
              <View style={styles.resultBox}>
                <Text style={result.startsWith('✓') ? styles.success : styles.resultText}>{result}</Text>
              </View>

              <Card>
                <Text style={styles.cardKicker}>POURQUOI CE MODE ?</Text>
                <Text style={styles.cardTitle}>Léger aujourd’hui, extensible demain.</Text>
                <Text style={styles.muted}>
                  Python et SQL commencent par des validateurs pédagogiques déterministes. Les runtimes complets pourront être ajoutés dans une mise à jour sans rendre la V1.5 lourde.
                </Text>
              </Card>
            </>
          )}

          {tab === 'Offline' && (
            <>
              <Text style={styles.eyebrow}>OFFLINE-FIRST</Text>
              <Text style={styles.title}>Tes cours voyagent avec toi.</Text>
              <Text style={styles.muted}>La progression et les packs installés sont conservés localement sur l’appareil.</Text>

              <View style={styles.statRow}>
                <Stat label="Packs" value={`${state.downloadedCourses.length}`} />
                <Stat label="Stockage" value={`${downloadedMb} Mo`} />
                <Stat label="Cloud" value="0 requis" />
              </View>

              {courses.map((course) => {
                const downloaded = state.downloadedCourses.includes(course.id);
                return (
                  <View key={course.id} style={styles.downloadRow}>
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle}>{course.title}</Text>
                      <Text style={styles.small}>{course.offlineSizeMb} Mo • {downloaded ? 'installé' : 'disponible'}</Text>
                    </View>
                    <Pressable style={[styles.iconButton, downloaded && styles.iconButtonActive]} onPress={() => toggleDownload(course.id)}>
                      <Text style={styles.iconButtonText}>{downloaded ? '✓' : '↓'}</Text>
                    </Pressable>
                  </View>
                );
              })}

              <Card>
                <Text style={styles.cardTitle}>Pensé pour les connexions faibles</Text>
                <Text style={styles.muted}>
                  Les contenus V1.5 sont embarqués et l’état est sauvegardé sur le téléphone. La synchronisation Cloud viendra plus tard comme amélioration, pas comme obligation pour apprendre.
                </Text>
              </Card>
            </>
          )}
        </ScrollView>

        <View style={styles.tabBar}>
          {tabs.map((item) => (
            <Pressable key={item} style={styles.tab} onPress={() => setTab(item)}>
              <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Card({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return <View style={[styles.card, compact && styles.cardCompact]}>{children}</View>;
}

function Progress({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressValue, { width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.primaryButton} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondaryButton} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080C18' },
  app: { flex: 1, backgroundColor: '#080C18' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#F7F9FF', fontSize: 24, fontWeight: '900', letterSpacing: 0.2 },
  subtitle: { color: '#75809A', fontSize: 11, marginTop: 2 },
  offlinePill: { backgroundColor: '#10281F', borderWidth: 1, borderColor: '#1D5D42', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
  offlineText: { color: '#6EE7A8', fontSize: 11, fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingBottom: 110 },
  eyebrow: { color: '#7D8CFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  title: { color: '#F5F7FF', fontSize: 30, fontWeight: '900', lineHeight: 36 },
  muted: { color: '#929CB3', fontSize: 14, lineHeight: 21, marginTop: 6 },
  small: { color: '#6F7A91', fontSize: 12 },
  success: { color: '#69DDA0', fontSize: 12, fontWeight: '700' },
  sectionTitle: { color: '#F2F5FF', fontSize: 19, fontWeight: '800', marginTop: 24, marginBottom: 4 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: '#11182A', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#1B2540' },
  statValue: { color: '#F7F9FF', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#748099', fontSize: 11, marginTop: 4 },
  card: { backgroundColor: '#101728', borderRadius: 20, borderWidth: 1, borderColor: '#1D2842', padding: 18, marginTop: 14 },
  cardCompact: { padding: 15 },
  cardKicker: { color: '#7888FF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardTitle: { color: '#F3F6FF', fontSize: 17, fontWeight: '800', marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: '#202A40', marginTop: 14 },
  progressValue: { height: '100%', backgroundColor: '#6678FF', borderRadius: 999 },
  primaryButton: { backgroundColor: '#6475FF', paddingVertical: 13, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#34415F', paddingVertical: 11, borderRadius: 13, alignItems: 'center', marginTop: 14 },
  secondaryButtonText: { color: '#C8D0E5', fontSize: 13, fontWeight: '700' },
  courseTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseDot: { width: 12, height: 12, borderRadius: 6 },
  flex: { flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  segment: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#11182A', borderWidth: 1, borderColor: '#1E2944' },
  segmentActive: { backgroundColor: '#6273FF', borderColor: '#7B89FF' },
  segmentText: { color: '#8994AA', fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },
  editor: { backgroundColor: '#0B1120', borderRadius: 18, borderWidth: 1, borderColor: '#25314D', marginTop: 14, overflow: 'hidden' },
  editorLabel: { color: '#6F7C98', fontSize: 10, fontWeight: '800', letterSpacing: 1, padding: 12, borderBottomWidth: 1, borderBottomColor: '#1A2440' },
  codeInput: { minHeight: 220, color: '#E9EDFF', fontSize: 14, lineHeight: 21, fontFamily: 'monospace', padding: 14 },
  resultBox: { backgroundColor: '#11182A', borderRadius: 14, borderWidth: 1, borderColor: '#1E2944', padding: 14, marginTop: 10 },
  resultText: { color: '#D1D7E8', fontSize: 13, lineHeight: 19 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#101728', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#1D2842', marginTop: 10 },
  rowTitle: { color: '#EEF2FF', fontWeight: '800', fontSize: 14 },
  iconButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#202A43', alignItems: 'center', justifyContent: 'center' },
  iconButtonActive: { backgroundColor: '#194632' },
  iconButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  tabBar: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: '#0F1627', borderWidth: 1, borderColor: '#222D47', borderRadius: 20, flexDirection: 'row', padding: 5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  tabText: { color: '#707C94', fontSize: 10, fontWeight: '700' },
  tabTextActive: { color: '#8B98FF' },
});
