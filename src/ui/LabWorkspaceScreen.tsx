import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import { importFilesFromPhone, importFolderFromPhone } from '../lib/workspaceImport';
import { invalidateLabValidation, openLabWorkspace, stampLabValidation, updateLabFile, validateLabDraft } from '../learning/labEngine';
import { runBehavioralSuite, secretSafetyIssues } from '../learning/labBehavioralTests';
import { webPreviewDocument } from '../learning/labSession';
import { Card, Pill, PrimaryButton, ProgressBar } from './components';
import { theme } from './theme';

type Panel = 'files' | 'code' | 'preview' | 'console' | 'tools';
type Tool = 'format' | 'minify' | 'obfuscate' | 'deobfuscate';
type EditorSelection = { start: number; end: number };

const symbols = ['Tab', '{', '}', '(', ')', '[', ']', '<', '>', ';', '=', '=>', '"', "'", '/', ':'];

export function LabWorkspaceScreen({ lesson, stored, onSave, onComplete, onBack }: {
  lesson: Lesson;
  stored?: LabDraft;
  onSave: (draft: LabDraft) => void;
  onComplete: (draft: LabDraft) => void;
  onBack: () => void;
}) {
  const initial = useMemo(() => openLabWorkspace(lesson, stored), [lesson.id]);
  const initialContent = initial.draft.files[initial.draft.activeFile] ?? '';
  const [draft, setDraft] = useState(initial.draft);
  const [selection, setSelection] = useState<EditorSelection>({ start: initialContent.length, end: initialContent.length });
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState('Prêt. Modifie le code puis lance les tests.');
  const [validated, setValidated] = useState(false);
  const [panel, setPanel] = useState<Panel>('code');
  const [tool, setTool] = useState<Tool>('format');
  const [toolInput, setToolInput] = useState('');
  const [toolOutput, setToolOutput] = useState('');
  const [importing, setImporting] = useState(false);
  const mission = initial.mission;
  const files = Object.keys(draft.files);
  const content = draft.files[draft.activeFile] ?? '';
  const secrets = secretSafetyIssues(draft);
  const progress = Math.round(((draft.passedCriteria?.length ?? 0) / Math.max(1, mission.successCriteria.length)) * 100);
  const htmlPreview = useMemo(() => webPreviewDocument(draft), [draft.files]);

  function save(next: LabDraft) {
    setDraft(next);
    onSave(next);
  }

  function changeFile(filename: string) {
    const nextContent = draft.files[filename] ?? '';
    save({ ...draft, activeFile: filename, updatedAt: new Date().toISOString() });
    setSelection({ start: nextContent.length, end: nextContent.length });
    setPanel('code');
    Haptics.selectionAsync().catch(() => undefined);
  }

  function changeContent(value: string) {
    save(updateLabFile(draft, draft.activeFile, value));
    setValidated(false);
  }

  function insertSymbol(value: string) {
    const token = value === 'Tab' ? '  ' : value;
    const start = Math.max(0, Math.min(selection.start, content.length));
    const end = Math.max(start, Math.min(selection.end, content.length));
    const nextContent = `${content.slice(0, start)}${token}${content.slice(end)}`;
    const caret = start + token.length;
    changeContent(nextContent);
    setSelection({ start: caret, end: caret });
    Haptics.selectionAsync().catch(() => undefined);
  }

  async function importFiles() {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importFilesFromPhone(draft.files);
      if (!result.imported) {
        setFeedback('Aucun fichier texte importé.');
        return;
      }
      const before = new Set(Object.keys(draft.files));
      const firstNew = Object.keys(result.files).find((name) => !before.has(name));
      const nextActiveFile = firstNew ?? draft.activeFile;
      save(invalidateLabValidation({ ...draft, files: result.files, activeFile: nextActiveFile, updatedAt: new Date().toISOString() }));
      const nextContent = result.files[nextActiveFile] ?? '';
      setSelection({ start: nextContent.length, end: nextContent.length });
      setValidated(false);
      setFeedback(`${result.imported} fichier(s) importé(s)${result.renamed ? ` • ${result.renamed} renommé(s) pour éviter un écrasement` : ''}${result.skipped ? ` • ${result.skipped} ignoré(s)` : ''}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setFeedback('Import annulé ou fichier inaccessible.');
    } finally {
      setImporting(false);
    }
  }

  async function importFolder() {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importFolderFromPhone(draft.files);
      if (!result.imported) {
        setFeedback('Aucun fichier texte compatible trouvé dans ce dossier.');
        return;
      }
      const before = new Set(Object.keys(draft.files));
      const firstNew = Object.keys(result.files).find((name) => !before.has(name));
      const nextActiveFile = firstNew ?? draft.activeFile;
      save(invalidateLabValidation({ ...draft, files: result.files, activeFile: nextActiveFile, updatedAt: new Date().toISOString() }));
      const nextContent = result.files[nextActiveFile] ?? '';
      setSelection({ start: nextContent.length, end: nextContent.length });
      setValidated(false);
      setFeedback(`${result.imported} fichier(s) du dossier importé(s)${result.renamed ? ` • ${result.renamed} renommé(s)` : ''}${result.skipped ? ` • ${result.skipped} ignoré(s)` : ''}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setFeedback('Import du dossier annulé ou accès refusé.');
    } finally {
      setImporting(false);
    }
  }

  function runTests() {
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    const structural = validateLabDraft(mission, draft);
    const behavioral = runBehavioralSuite(mission, draft, nextAttempts);
    const passed = structural.passed && behavioral.passed;
    const stamped = stampLabValidation(draft, structural);
    save(stamped);
    setValidated(passed);
    const failed = behavioral.visible.filter((item) => !item.passed).map((item) => item.label);
    const pieces = [structural.feedback, failed.length ? `À corriger : ${failed.join(' • ')}` : 'Tests visibles : OK', behavioral.hiddenTotal ? `Tests cachés : ${behavioral.hiddenPassed}/${behavioral.hiddenTotal}` : '', behavioral.hint ?? ''].filter(Boolean);
    setFeedback(pieces.join('\n'));
    setPanel('console');
    Haptics.notificationAsync(passed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }

  function runTool() {
    const source = toolInput || content;
    const result = transformCode(source, tool);
    setToolOutput(result);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  function applyToolResult() {
    if (!toolOutput) return;
    changeContent(toolOutput);
    setSelection({ start: toolOutput.length, end: toolOutput.length });
    setPanel('code');
  }

  return (
    <View>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.iconButton}><Text style={styles.iconText}>‹</Text></Pressable>
        <View style={styles.titleWrap}><Text style={styles.eyebrow}>NEXCODE LAB</Text><Text style={styles.title} numberOfLines={1}>{mission.title}</Text></View>
        <Pressable onPress={runTests} style={styles.run}><Text style={styles.runText}>▶ Run</Text></Pressable>
      </View>

      <Card tone="primary" style={styles.progressCard}>
        <View style={styles.rowBetween}><Text style={styles.progressLabel}>{draft.passedCriteria?.length ?? 0}/{mission.successCriteria.length} critères</Text><Pill label={validated ? 'Validé ✓' : `${progress}%`} tone={validated ? 'success' : 'primary'} /></View>
        <ProgressBar value={progress} />
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
        <NavItem active={panel === 'files'} label="Fichiers" icon="☷" onPress={() => setPanel('files')} />
        <NavItem active={panel === 'code'} label="Code" icon="</>" onPress={() => setPanel('code')} />
        <NavItem active={panel === 'preview'} label="Preview" icon="◉" onPress={() => setPanel('preview')} />
        <NavItem active={panel === 'console'} label="Console" icon=">_" onPress={() => setPanel('console')} />
        <NavItem active={panel === 'tools'} label="Outils" icon="✦" onPress={() => setPanel('tools')} />
      </ScrollView>

      {panel === 'files' ? (
        <View style={styles.panel}>
          <View style={styles.explorerHeader}><Text style={styles.panelTitle}>Explorateur</Text><Text style={styles.fileCount}>{files.length} fichier(s)</Text></View>
          <View style={styles.importActions}>
            <Pressable disabled={importing} onPress={importFiles} style={({ pressed }) => [styles.importButton, pressed && styles.importPressed]}><Text style={styles.importGlyph}>＋</Text><View><Text style={styles.importTitle}>{importing ? 'Import…' : 'Fichiers'}</Text><Text style={styles.importMeta}>Depuis le téléphone</Text></View></Pressable>
            <Pressable disabled={importing} onPress={importFolder} style={({ pressed }) => [styles.importButton, pressed && styles.importPressed]}><Text style={styles.importGlyph}>▱</Text><View><Text style={styles.importTitle}>Dossier</Text><Text style={styles.importMeta}>Projet complet</Text></View></Pressable>
          </View>
          {files.map((filename) => <Pressable key={filename} onPress={() => changeFile(filename)} style={[styles.fileRow, draft.activeFile === filename && styles.fileRowActive]}><View style={styles.fileIcon}><Text style={styles.fileIconText}>{fileBadge(filename)}</Text></View><Text style={styles.fileName}>{filename}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
          <Text style={styles.helper}>Les imports conservent l’arborescence. En cas de même nom, NexCode garde les deux fichiers au lieu d’écraser ton code.</Text>
        </View>
      ) : null}

      {panel === 'code' ? (
        <View style={styles.panel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{files.map((filename) => <Pressable key={filename} onPress={() => changeFile(filename)} style={[styles.fileTab, draft.activeFile === filename && styles.fileTabActive]}><Text style={[styles.fileTabText, draft.activeFile === filename && styles.fileTabTextActive]}>{filename}</Text></Pressable>)}</ScrollView>
          <View style={styles.editor}>
            <View style={styles.editorBar}><Text style={styles.editorFile}>{draft.activeFile}</Text><Text style={styles.saved}>● sauvegardé</Text></View>
            <TextInput multiline value={content} selection={selection} onSelectionChange={(event) => setSelection(event.nativeEvent.selection)} onChangeText={changeContent} autoCapitalize="none" autoCorrect={false} spellCheck={false} textAlignVertical="top" style={styles.code} accessibilityLabel={`Éditeur ${draft.activeFile}`} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolBar}>{symbols.map((item) => <Pressable key={item} onPress={() => insertSymbol(item)} style={styles.symbol}><Text style={styles.symbolText}>{item}</Text></Pressable>)}</ScrollView>
          </View>
        </View>
      ) : null}

      {panel === 'preview' ? (
        <View style={styles.panel}>
          <View style={styles.previewTop}><Text style={styles.panelTitle}>Aperçu</Text><Pill label="Sandbox locale" tone="success" /></View>
          {htmlPreview ? <View style={styles.webWrap}><WebView originWhitelist={['about:blank']} source={{ html: htmlPreview, baseUrl: 'about:blank' }} style={styles.web} javaScriptEnabled domStorageEnabled={false} setSupportMultipleWindows={false} allowsFullscreenVideo={false} onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url.startsWith('data:')} /></View> : <Card><Text style={styles.emptyTitle}>Aucun aperçu visuel pour ce projet.</Text><Text style={styles.helper}>Le preview Web s’active quand le workspace contient un fichier HTML.</Text></Card>}
        </View>
      ) : null}

      {panel === 'console' ? (
        <View style={styles.panel}>
          <View style={styles.consoleHeader}><Text style={styles.panelTitle}>Console</Text><Pressable onPress={runTests} style={styles.smallRun}><Text style={styles.smallRunText}>Relancer</Text></Pressable></View>
          <View style={styles.console}><Text style={styles.consolePrompt}>$ nexcode test</Text><Text style={styles.consoleText}>{feedback}</Text>{secrets.map((issue) => <Text key={issue} style={styles.consoleWarning}>⚠ {issue}</Text>)}</View>
          {validated ? <PrimaryButton label="Terminer la mission" icon="✓" onPress={() => onComplete(draft)} /> : null}
        </View>
      ) : null}

      {panel === 'tools' ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Code Tools</Text>
          <Text style={styles.helper}>Utilise ces outils sur le fichier actuel ou colle un autre extrait.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolTabs}>
            {(['format','minify','obfuscate','deobfuscate'] as Tool[]).map((item) => <Pressable key={item} onPress={() => setTool(item)} style={[styles.toolChip, tool === item && styles.toolChipActive]}><Text style={[styles.toolChipText, tool === item && styles.toolChipTextActive]}>{toolLabel(item)}</Text></Pressable>)}
          </ScrollView>
          <TextInput multiline value={toolInput} onChangeText={setToolInput} placeholder="Laisse vide pour utiliser le fichier actuel…" placeholderTextColor={theme.colors.textMuted} style={styles.toolInput} autoCapitalize="none" autoCorrect={false} />
          <PrimaryButton label={toolLabel(tool)} icon="✦" onPress={runTool} />
          {toolOutput ? <View style={styles.toolResult}><Text style={styles.resultLabel}>RÉSULTAT</Text><ScrollView style={styles.resultScroll}><Text style={styles.resultCode}>{toolOutput}</Text></ScrollView><PrimaryButton label="Remplacer le fichier actuel" onPress={applyToolResult} /></View> : null}
        </View>
      ) : null}
    </View>
  );
}

function NavItem({ active, label, icon, onPress }: { active: boolean; label: string; icon: string; onPress: () => void }) {
  return <Pressable onPress={() => { onPress(); Haptics.selectionAsync().catch(() => undefined); }} style={[styles.navItem, active && styles.navItemActive]}><Text style={[styles.navIcon, active && styles.navTextActive]}>{icon}</Text><Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text></Pressable>;
}

function fileBadge(filename: string) {
  const ext = filename.split('.').pop()?.toUpperCase() ?? 'TXT';
  return ext.slice(0, 3);
}

function toolLabel(tool: Tool) {
  return tool === 'format' ? 'Formatter' : tool === 'minify' ? 'Minifier' : tool === 'obfuscate' ? 'Obfusquer' : 'Déobfusquer';
}

function transformCode(source: string, tool: Tool) {
  if (!source.trim()) return '';
  if (tool === 'minify') return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1').replace(/\s+/g, ' ').replace(/\s*([{}();,:=+<>])\s*/g, '$1').trim();
  if (tool === 'format') return simpleFormat(source);
  if (tool === 'obfuscate') {
    const codes = Array.from(source).map((char) => char.charCodeAt(0)).join(',');
    return `eval(String.fromCharCode(${codes}))`;
  }
  const encoded = source.match(/String\.fromCharCode\(([^)]+)\)/)?.[1];
  if (!encoded) return 'Déobfuscation automatique impossible pour ce format. Utilise Analyzer pour inspecter manuellement le code.';
  return encoded.split(',').map((value) => String.fromCharCode(Number(value.trim()))).join('');
}

function simpleFormat(source: string) {
  const clean = source.replace(/\r/g, '').replace(/\s*{\s*/g, ' {\n').replace(/;\s*/g, ';\n').replace(/}\s*/g, '\n}\n');
  let depth = 0;
  return clean.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    if (line.startsWith('}')) depth = Math.max(0, depth - 1);
    const out = `${'  '.repeat(depth)}${line}`;
    if (line.endsWith('{')) depth += 1;
    return out;
  }).join('\n');
}

const styles = StyleSheet.create({
  topbar:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},iconButton:{width:40,height:40,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.06)',borderWidth:1,borderColor:'rgba(255,255,255,.1)'},iconText:{color:theme.colors.text,fontSize:27},titleWrap:{flex:1},eyebrow:{color:'#8392FF',fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginTop:2},run:{paddingHorizontal:15,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#6878FF',shadowColor:'#6878FF',shadowOpacity:.25,shadowRadius:12,elevation:6},runText:{color:'#fff',fontWeight:'900',fontSize:12},
  progressCard:{padding:12,marginBottom:10},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},progressLabel:{color:theme.colors.textSecondary,fontSize:11,fontWeight:'800'},nav:{gap:7,paddingVertical:8},navItem:{minWidth:68,paddingHorizontal:10,paddingVertical:9,borderRadius:15,alignItems:'center',gap:3,backgroundColor:'rgba(255,255,255,.04)',borderWidth:1,borderColor:'rgba(255,255,255,.07)'},navItemActive:{backgroundColor:'rgba(104,120,255,.16)',borderColor:'rgba(104,120,255,.5)'},navIcon:{color:theme.colors.textMuted,fontSize:13,fontWeight:'900'},navText:{color:theme.colors.textMuted,fontSize:9,fontWeight:'800'},navTextActive:{color:'#C9D0FF'},
  panel:{marginTop:8,gap:10},panelTitle:{color:theme.colors.text,fontSize:21,fontWeight:'900'},helper:{color:theme.colors.textMuted,fontSize:11,lineHeight:17},explorerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fileCount:{color:theme.colors.textMuted,fontSize:10,fontWeight:'800'},importActions:{flexDirection:'row',gap:8},importButton:{flex:1,minHeight:64,borderRadius:17,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(103,121,255,.1)',borderWidth:1,borderColor:'rgba(119,137,255,.24)'},importPressed:{opacity:.78,transform:[{scale:.985}]},importGlyph:{color:'#BFC8FF',fontSize:20,fontWeight:'900'},importTitle:{color:theme.colors.text,fontSize:12,fontWeight:'900'},importMeta:{color:theme.colors.textMuted,fontSize:9,marginTop:2},fileRow:{minHeight:54,borderRadius:15,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(255,255,255,.035)',borderWidth:1,borderColor:theme.colors.border},fileRowActive:{borderColor:'#5E70E8',backgroundColor:'rgba(94,112,232,.12)'},fileIcon:{width:34,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#172038'},fileIconText:{color:'#8EA0FF',fontWeight:'900',fontSize:8},fileName:{flex:1,color:theme.colors.text,fontFamily:'monospace',fontSize:11},chevron:{color:theme.colors.textMuted,fontSize:20},
  tabs:{gap:6},fileTab:{paddingHorizontal:11,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:theme.colors.border,backgroundColor:'rgba(255,255,255,.035)'},fileTabActive:{backgroundColor:'#1A2451',borderColor:'#5267DB'},fileTabText:{color:theme.colors.textSecondary,fontSize:10,fontWeight:'700'},fileTabTextActive:{color:'#fff'},editor:{borderWidth:1,borderColor:theme.colors.border,borderRadius:18,overflow:'hidden',backgroundColor:'#070B13'},editorBar:{height:42,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#1E2637'},editorFile:{color:theme.colors.text,fontSize:11,fontWeight:'800',fontFamily:'monospace'},saved:{color:theme.colors.success,fontSize:9,fontWeight:'800'},code:{minHeight:320,padding:14,color:'#E7EDFF',fontFamily:'monospace',fontSize:13,lineHeight:20},symbolBar:{gap:5,padding:8,borderTopWidth:1,borderTopColor:'#1E2637'},symbol:{minWidth:34,height:34,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#151D2D'},symbolText:{color:'#D9E0F8',fontFamily:'monospace',fontSize:12,fontWeight:'800'},
  previewTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},webWrap:{height:500,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:theme.colors.border,backgroundColor:'#fff'},web:{flex:1,backgroundColor:'#fff'},emptyTitle:{color:theme.colors.text,fontSize:15,fontWeight:'800'},consoleHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},smallRun:{paddingHorizontal:12,paddingVertical:7,borderRadius:10,backgroundColor:'#1B2550'},smallRunText:{color:'#AEB9FF',fontSize:10,fontWeight:'900'},console:{minHeight:280,borderRadius:18,padding:15,backgroundColor:'#060A10',borderWidth:1,borderColor:'#20283A'},consolePrompt:{color:'#77E8A9',fontFamily:'monospace',fontSize:12,fontWeight:'800'},consoleText:{color:'#CBD4E9',fontFamily:'monospace',fontSize:12,lineHeight:19,marginTop:12},consoleWarning:{color:'#F1BE6D',fontFamily:'monospace',fontSize:11,lineHeight:18,marginTop:9},
  toolTabs:{gap:6},toolChip:{paddingHorizontal:12,paddingVertical:8,borderRadius:12,borderWidth:1,borderColor:theme.colors.border},toolChipActive:{backgroundColor:'rgba(104,120,255,.16)',borderColor:'#6173EF'},toolChipText:{color:theme.colors.textMuted,fontSize:10,fontWeight:'800'},toolChipTextActive:{color:'#C8D0FF'},toolInput:{minHeight:120,borderRadius:16,borderWidth:1,borderColor:theme.colors.border,backgroundColor:'#080D16',padding:12,color:theme.colors.text,fontFamily:'monospace',fontSize:12,textAlignVertical:'top'},toolResult:{gap:8,borderRadius:16,padding:12,backgroundColor:'#080D16',borderWidth:1,borderColor:theme.colors.border},resultLabel:{color:'#8E9BFF',fontSize:9,fontWeight:'900',letterSpacing:1},resultScroll:{maxHeight:260},resultCode:{color:'#DDE5FA',fontFamily:'monospace',fontSize:11,lineHeight:18},
});