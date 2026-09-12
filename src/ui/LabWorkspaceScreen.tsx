import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Lesson } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import { importFilesFromPhone, importFolderFromPhone } from '../lib/workspaceImport';
import { addLabFile, invalidateLabValidation, openLabWorkspace, removeLabFile, renameLabFile, stampLabValidation, updateLabFile, validateLabDraft } from '../learning/labEngine';
import { runBehavioralSuite, secretSafetyIssues } from '../learning/labBehavioralTests';
import { webPreviewDocument } from '../learning/labSession';
import { Card, Pill, PrimaryButton, ProgressBar } from './components';
import { createLearningFeedbackGate } from './learningFeedback';
import { theme } from './theme';

type Panel = 'files' | 'code' | 'preview' | 'console' | 'tools';
type Tool = 'format' | 'minify' | 'obfuscate' | 'deobfuscate';
type EditorSelection = { start: number; end: number };

const symbols = ['Tab', '{', '}', '(', ')', '[', ']', '<', '>', ';', '=', '=>', '"', "'", '/', ':'];
const labFeedback = createLearningFeedbackGate();

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
  const [fileNameDraft, setFileNameDraft] = useState('');
  const [editingFile, setEditingFile] = useState<string | undefined>();
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
    labFeedback.selection(true);
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
    labFeedback.selection(true);
  }

  function startCreateFile() {
    setEditingFile(undefined);
    setFileNameDraft('');
    labFeedback.selection(true);
  }

  function startRenameFile(filename: string) {
    setEditingFile(filename);
    setFileNameDraft(filename);
    labFeedback.selection(true);
  }

  function cancelFileEdit() {
    setEditingFile(undefined);
    setFileNameDraft('');
  }

  function commitFileEdit() {
    const requested = fileNameDraft.trim();
    if (!requested) {
      setFeedback('Choisis un nom de fichier valide.');
      labFeedback.notification(true, 'error');
      return;
    }
    const next = editingFile ? renameLabFile(draft, editingFile, requested) : addLabFile(draft, requested);
    if (next === draft) {
      setFeedback(editingFile ? 'Renommage impossible : nom invalide, sensible ou déjà utilisé.' : 'Création impossible : nom invalide, sensible ou déjà utilisé.');
      labFeedback.notification(true, 'error');
      return;
    }
    save(next);
    setValidated(false);
    const nextContent = next.files[next.activeFile] ?? '';
    setSelection({ start: nextContent.length, end: nextContent.length });
    setFeedback(editingFile ? `Fichier renommé en ${next.activeFile}.` : `Fichier ${next.activeFile} créé.`);
    cancelFileEdit();
    labFeedback.notification(true, 'success');
  }

  function deleteFile(filename: string) {
    const next = removeLabFile(draft, filename);
    if (next === draft) {
      setFeedback(files.length <= 1 ? 'Le Lab doit conserver au moins un fichier éditable.' : 'Ce fichier ne peut pas être supprimé.');
      labFeedback.notification(true, 'error');
      return;
    }
    save(next);
    setValidated(false);
    const nextContent = next.files[next.activeFile] ?? '';
    setSelection({ start: nextContent.length, end: nextContent.length });
    if (editingFile === filename) cancelFileEdit();
    setFeedback(`${filename} supprimé. Validation à relancer.`);
    labFeedback.notification(true, 'success');
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
      labFeedback.notification(true, 'success');
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
      labFeedback.notification(true, 'success');
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
    labFeedback.notification(true, passed ? 'success' : 'error');
  }

  function runTool() {
    const source = toolInput || content;
    const result = transformCode(source, tool);
    setToolOutput(result);
    labFeedback.impact(true, 'light');
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
          <View style={styles.explorerHeader}>
            <View><Text style={styles.panelTitle}>Explorateur</Text><Text style={styles.fileCount}>{files.length} fichier(s)</Text></View>
            <Pressable onPress={startCreateFile} style={styles.newFileButton} accessibilityRole="button" accessibilityLabel="Créer un fichier"><Text style={styles.newFileGlyph}>＋</Text><Text style={styles.newFileText}>Nouveau</Text></Pressable>
          </View>
          <View style={styles.fileEditCard}>
            <Text style={styles.fileEditLabel}>{editingFile ? 'RENOMMER LE FICHIER' : 'NOUVEAU FICHIER'}</Text>
            <View style={styles.fileEditRow}>
              <TextInput value={fileNameDraft} onChangeText={setFileNameDraft} onSubmitEditing={commitFileEdit} placeholder={editingFile ?? 'ex. components/card.js'} placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" autoCorrect={false} returnKeyType="done" style={styles.fileNameInput} accessibilityLabel={editingFile ? `Renommer ${editingFile}` : 'Nom du nouveau fichier'} />
              <Pressable onPress={commitFileEdit} style={styles.fileEditPrimary}><Text style={styles.fileEditPrimaryText}>{editingFile ? 'OK' : 'Créer'}</Text></Pressable>
              {editingFile || fileNameDraft ? <Pressable onPress={cancelFileEdit} style={styles.fileEditCancel}><Text style={styles.fileEditCancelText}>×</Text></Pressable> : null}
            </View>
            <Text style={styles.fileEditMeta}>Chemins imbriqués acceptés. Les collisions, noms sensibles et chemins non portables sont refusés.</Text>
          </View>
          <View style={styles.importActions}>
            <Pressable disabled={importing} onPress={importFiles} style={({ pressed }) => [styles.importButton, pressed && styles.importPressed]}><Text style={styles.importGlyph}>＋</Text><View><Text style={styles.importTitle}>{importing ? 'Import…' : 'Fichiers'}</Text><Text style={styles.importMeta}>Depuis le téléphone</Text></View></Pressable>
            <Pressable disabled={importing} onPress={importFolder} style={({ pressed }) => [styles.importButton, pressed && styles.importPressed]}><Text style={styles.importGlyph}>▱</Text><View><Text style={styles.importTitle}>Dossier</Text><Text style={styles.importMeta}>Projet complet</Text></View></Pressable>
          </View>
          {files.map((filename) => (
            <View key={filename} style={[styles.fileRow, draft.activeFile === filename && styles.fileRowActive]}>
              <Pressable onPress={() => changeFile(filename)} style={styles.fileOpen} accessibilityRole="button" accessibilityLabel={`Ouvrir ${filename}`}>
                <View style={styles.fileIcon}><Text style={styles.fileIconText}>{fileBadge(filename)}</Text></View>
                <View style={styles.fileCopy}><Text style={styles.fileName} numberOfLines={1}>{filename}</Text>{draft.activeFile === filename ? <Text style={styles.fileActiveMeta}>Ouvert dans l’éditeur</Text> : null}</View>
              </Pressable>
              <Pressable onPress={() => startRenameFile(filename)} style={styles.fileAction} accessibilityRole="button" accessibilityLabel={`Renommer ${filename}`}><Text style={styles.fileActionText}>✎</Text></Pressable>
              <Pressable onPress={() => deleteFile(filename)} style={styles.fileAction} accessibilityRole="button" accessibilityLabel={`Supprimer ${filename}`}><Text style={styles.deleteActionText}>×</Text></Pressable>
            </View>
          ))}
          <Text style={styles.helper}>Le workspace est réellement multi-fichiers : crée, renomme, supprime ou importe sans écraser silencieusement ton code. Toute mutation invalide une ancienne validation.</Text>
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
          {htmlPreview ? <View style={styles.webWrap}><WebView originWhitelist={['about:blank']} source={{ html: htmlPreview, baseUrl: 'about:blank' }} style={styles.web} javaScriptEnabled domStorageEnabled={false} setSupportMultipleWindows={false} allowsFullscreenVideo={false} onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'} /></View> : <Card><Text style={styles.emptyTitle}>Aucun aperçu visuel pour ce projet.</Text><Text style={styles.helper}>Le preview Web s’active quand le workspace contient un fichier HTML.</Text></Card>}
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
  return <Pressable onPress={() => { onPress(); labFeedback.selection(true); }} style={[styles.navItem, active && styles.navItemActive]}><Text style={[styles.navIcon, active && styles.navTextActive]}>{icon}</Text><Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text></Pressable>;
}

function fileBadge(filename: string) {
  const ext = filename.split('.').pop()?.toUpperCase() ?? 'TXT';
  return ext.slice(0, 3);
}

function toolLabel(tool: Tool) {
  return tool === 'format' ? 'Formatter' : tool === 'minify' ? 'Minifier' : tool === 'obfuscate' ? 'Obfusquer' : 'Désobfusquer';
}

function transformCode(source: string, tool: Tool) {
  if (tool === 'minify') return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s+/g, ' ').replace(/\s*([{}();,:=+<>])\s*/g, '$1').trim();
  if (tool === 'format') return basicFormat(source);
  if (tool === 'obfuscate') return `/* Obfuscation légère NexCode */\n(function(){const _=${JSON.stringify(Array.from(source).map((c) => c.charCodeAt(0)))};eval(_.map(c=>String.fromCharCode(c)).join(''));})();`;
  const match = source.match(/const\s+_\s*=\s*(\[[\d,\s]+\])/);
  if (match?.[1]) { try { const arr = JSON.parse(match[1]) as number[]; return arr.map((c) => String.fromCharCode(c)).join(''); } catch { return source; } }
  return source;
}

function basicFormat(source: string) {
  let indent = 0;
  const lines = source.replace(/\{/g, '{\n').replace(/\}/g, '\n}\n').replace(/;/g, ';\n').split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    if (line.startsWith('}')) indent = Math.max(0, indent - 1);
    const out = `${'  '.repeat(indent)}${line}`;
    if (line.endsWith('{')) indent += 1;
    return out;
  }).join('\n');
}

const styles = StyleSheet.create({
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  iconButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: theme.colors.text, fontSize: 28, lineHeight: 30 },
  titleWrap: { flex: 1 }, eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 },
  run: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }, runText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  progressCard: { marginTop: 8, padding: 14 }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, progressLabel: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  nav: { gap: 8, paddingVertical: 14 }, navItem: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, backgroundColor: theme.colors.surfaceStrong }, navItemActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary }, navIcon: { color: theme.colors.textMuted, fontWeight: '900' }, navText: { color: theme.colors.textMuted, fontWeight: '800', fontSize: 12 }, navTextActive: { color: theme.colors.primary },
  panel: { gap: 12, paddingBottom: 24 }, panelTitle: { color: theme.colors.text, fontWeight: '900', fontSize: 16 }, explorerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, fileCount: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', marginTop: 3 },
  newFileButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 12, backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary }, newFileGlyph: { color: theme.colors.primary, fontSize: 18, fontWeight: '900' }, newFileText: { color: theme.colors.primary, fontSize: 11, fontWeight: '900' },
  fileEditCard: { gap: 8, borderRadius: 16, padding: 12, backgroundColor: theme.colors.surfaceStrong, borderWidth: 1, borderColor: theme.colors.border }, fileEditLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }, fileEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, fileNameInput: { flex: 1, minHeight: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontFamily: 'monospace', fontSize: 12, borderWidth: 1, borderColor: theme.colors.border }, fileEditPrimary: { minHeight: 44, paddingHorizontal: 13, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }, fileEditPrimaryText: { color: '#fff', fontSize: 11, fontWeight: '900' }, fileEditCancel: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }, fileEditCancelText: { color: theme.colors.textMuted, fontSize: 22, fontWeight: '700' }, fileEditMeta: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 15 },
  importActions: { flexDirection: 'row', gap: 10 }, importButton: { flex: 1, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: theme.colors.surfaceStrong, borderWidth: 1, borderColor: theme.colors.border }, importPressed: { opacity: 0.72 }, importGlyph: { color: theme.colors.primary, fontSize: 20, fontWeight: '900' }, importTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '900' }, importMeta: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  fileRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderRadius: 14, backgroundColor: theme.colors.surfaceStrong, borderWidth: 1, borderColor: 'transparent' }, fileRowActive: { borderColor: theme.colors.primary }, fileOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 4 }, fileIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, fileIconText: { color: theme.colors.primary, fontSize: 9, fontWeight: '900' }, fileCopy: { flex: 1, minWidth: 0 }, fileName: { color: theme.colors.text, fontWeight: '800', fontSize: 12 }, fileActiveMeta: { color: theme.colors.primary, fontSize: 9, fontWeight: '800', marginTop: 3 }, fileAction: { width: 38, height: 38, borderRadius: 11, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }, fileActionText: { color: theme.colors.textMuted, fontSize: 17, fontWeight: '800' }, deleteActionText: { color: theme.colors.danger ?? '#f87171', fontSize: 20, fontWeight: '700' }, helper: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  tabs: { gap: 7 }, fileTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: theme.colors.surfaceStrong }, fileTabActive: { backgroundColor: theme.colors.primarySoft }, fileTabText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800' }, fileTabTextActive: { color: theme.colors.primary },
  editor: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#0b1020' }, editorBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 10, backgroundColor: '#11182b' }, editorFile: { color: '#f7f8ff', fontSize: 11, fontWeight: '800' }, saved: { color: '#6ee7b7', fontSize: 10, fontWeight: '800' }, code: { minHeight: 310, maxHeight: 520, color: '#e7eaf4', fontFamily: 'monospace', fontSize: 13, lineHeight: 20, padding: 14 }, symbolBar: { gap: 6, padding: 9, backgroundColor: '#11182b' }, symbol: { minWidth: 34, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 8, borderRadius: 9, backgroundColor: '#202944' }, symbolText: { color: '#f7f8ff', fontFamily: 'monospace', fontSize: 12 },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, webWrap: { height: 420, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff' }, web: { flex: 1 }, emptyTitle: { color: theme.colors.text, fontWeight: '900', marginBottom: 6 },
  consoleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, smallRun: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: theme.colors.primarySoft }, smallRunText: { color: theme.colors.primary, fontSize: 11, fontWeight: '900' }, console: { minHeight: 180, borderRadius: 17, backgroundColor: '#080d1a', padding: 14 }, consolePrompt: { color: '#6ee7b7', fontFamily: 'monospace', fontSize: 11, marginBottom: 10 }, consoleText: { color: '#d9ddeb', fontFamily: 'monospace', fontSize: 12, lineHeight: 19 }, consoleWarning: { color: '#fbbf24', fontFamily: 'monospace', fontSize: 11, lineHeight: 18, marginTop: 7 },
  toolTabs: { gap: 7 }, toolChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11, backgroundColor: theme.colors.surfaceStrong }, toolChipActive: { backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary }, toolChipText: { color: theme.colors.textMuted, fontWeight: '800', fontSize: 11 }, toolChipTextActive: { color: theme.colors.primary }, toolInput: { minHeight: 140, borderRadius: 16, padding: 13, backgroundColor: '#0b1020', color: '#f7f8ff', fontFamily: 'monospace', fontSize: 12, textAlignVertical: 'top' }, toolResult: { gap: 10, paddingTop: 4 }, resultLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, resultScroll: { maxHeight: 220, borderRadius: 14, backgroundColor: '#080d1a', padding: 12 }, resultCode: { color: '#d9ddeb', fontFamily: 'monospace', fontSize: 11, lineHeight: 18 },
});