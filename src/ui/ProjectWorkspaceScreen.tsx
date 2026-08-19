import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { GuidedProject } from '../data/curriculumCore';
import { LabDraft } from '../lib/localState';
import { importFilesFromPhone, importFolderFromPhone } from '../lib/workspaceImport';
import { Pill, PrimaryButton } from './components';
import { theme } from './theme';

type Panel = 'files' | 'code' | 'preview' | 'console';
const symbols = ['Tab', '{', '}', '(', ')', '[', ']', '<', '>', ';', '=', '=>', '"', "'", '/', ':'];

export function ProjectWorkspaceScreen({ project, stored, onSave, onBack }: {
  project: GuidedProject;
  stored?: LabDraft;
  onSave: (draft: LabDraft) => void;
  onBack: () => void;
}) {
  const initial = useMemo(() => stored ?? createProjectDraft(project), [project.id]);
  const [draft, setDraft] = useState(initial);
  const [panel, setPanel] = useState<Panel>('code');
  const [consoleText, setConsoleText] = useState('Projet prêt. Écris ton code puis lance-le.');
  const [importing, setImporting] = useState(false);
  const files = Object.keys(draft.files);
  const content = draft.files[draft.activeFile] ?? '';
  const preview = useMemo(() => buildPreview(draft.files), [draft.files]);

  function save(next: LabDraft) {
    setDraft(next);
    onSave(next);
  }

  function selectFile(filename: string) {
    save({ ...draft, activeFile: filename, updatedAt: new Date().toISOString() });
    setPanel('code');
    Haptics.selectionAsync().catch(() => undefined);
  }

  function changeContent(value: string) {
    save({ ...draft, files: { ...draft.files, [draft.activeFile]: value }, updatedAt: new Date().toISOString() });
  }

  function insertSymbol(value: string) {
    changeContent(`${content}${value === 'Tab' ? '  ' : value}`);
    Haptics.selectionAsync().catch(() => undefined);
  }

  async function importFiles() {
    if (importing) return;
    setImporting(true);
    try {
      const result = await importFilesFromPhone(draft.files);
      if (!result.imported) {
        setConsoleText('Aucun fichier compatible importé.');
        setPanel('console');
        return;
      }
      const before = new Set(Object.keys(draft.files));
      const firstNew = Object.keys(result.files).find((name) => !before.has(name));
      save({ ...draft, files: result.files, activeFile: firstNew ?? draft.activeFile, updatedAt: new Date().toISOString() });
      setConsoleText(`${result.imported} fichier(s) importé(s)${result.renamed ? ` • ${result.renamed} renommé(s)` : ''}${result.skipped ? ` • ${result.skipped} ignoré(s)` : ''}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setConsoleText('Import annulé ou fichier inaccessible.');
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
        setConsoleText('Aucun fichier compatible trouvé dans ce dossier.');
        setPanel('console');
        return;
      }
      const before = new Set(Object.keys(draft.files));
      const firstNew = Object.keys(result.files).find((name) => !before.has(name));
      save({ ...draft, files: result.files, activeFile: firstNew ?? draft.activeFile, updatedAt: new Date().toISOString() });
      setConsoleText(`${result.imported} fichier(s) du projet importé(s)${result.renamed ? ` • ${result.renamed} renommé(s)` : ''}${result.skipped ? ` • ${result.skipped} ignoré(s)` : ''}.`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setConsoleText('Import du dossier annulé ou accès refusé.');
    } finally {
      setImporting(false);
    }
  }

  function run() {
    if (preview) {
      setPanel('preview');
      setConsoleText('Preview Web actualisé.');
    } else {
      setPanel('console');
      setConsoleText(runtimeMessage(project, draft));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }

  return (
    <View>
      <View style={styles.topbar}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.titleWrap}><Text style={styles.kicker}>PROJECT IDE</Text><Text style={styles.title} numberOfLines={1}>{project.title}</Text></View>
        <Pressable onPress={run} style={styles.run}><Text style={styles.runText}>▶ Run</Text></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nav}>
        <Nav active={panel === 'files'} label="Fichiers" icon="☷" onPress={() => setPanel('files')} />
        <Nav active={panel === 'code'} label="Code" icon="</>" onPress={() => setPanel('code')} />
        <Nav active={panel === 'preview'} label="Preview" icon="◉" onPress={() => setPanel('preview')} />
        <Nav active={panel === 'console'} label="Console" icon=">_" onPress={() => setPanel('console')} />
      </ScrollView>

      {panel === 'files' ? <View style={styles.panel}>
        <View style={styles.explorerHeader}><Text style={styles.panelTitle}>Projet</Text><Text style={styles.fileCount}>{files.length} fichier(s)</Text></View>
        <View style={styles.importRow}>
          <Pressable disabled={importing} onPress={importFiles} style={({ pressed }) => [styles.importButton, pressed && styles.importPressed]}><Text style={styles.importGlyph}>＋</Text><View><Text style={styles.importTitle}>{importing ? 'Import…' : 'Fichiers'}</Text><Text style={styles.importMeta}>Téléphone</Text></View></Pressable>
          <Pressable disabled={importing} onPress={importFolder} style={({ pressed }) => [styles.importButton, pressed && styles.importPressed]}><Text style={styles.importGlyph}>▱</Text><View><Text style={styles.importTitle}>Dossier</Text><Text style={styles.importMeta}>Projet entier</Text></View></Pressable>
        </View>
        {files.map((filename) => <Pressable key={filename} onPress={() => selectFile(filename)} style={[styles.file, draft.activeFile === filename && styles.fileActive]}><View style={styles.fileBadge}><Text style={styles.fileBadgeText}>{fileBadge(filename)}</Text></View><Text style={styles.fileText}>{filename}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
        <Text style={styles.helper}>L’arborescence importée est conservée et les doublons sont renommés automatiquement pour ne jamais écraser ton code.</Text>
      </View> : null}

      {panel === 'code' ? <View style={styles.panel}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{files.map((filename) => <Pressable key={filename} onPress={() => selectFile(filename)} style={[styles.tab, draft.activeFile === filename && styles.tabActive]}><Text style={[styles.tabText, draft.activeFile === filename && styles.tabTextActive]}>{filename}</Text></Pressable>)}</ScrollView>
        <View style={styles.editor}><View style={styles.editorTop}><Text style={styles.editorName}>{draft.activeFile}</Text><Text style={styles.saved}>● sauvegardé</Text></View><TextInput multiline value={content} onChangeText={changeContent} autoCapitalize="none" autoCorrect={false} spellCheck={false} textAlignVertical="top" style={styles.code} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbols}>{symbols.map((item) => <Pressable key={item} onPress={() => insertSymbol(item)} style={styles.symbol}><Text style={styles.symbolText}>{item}</Text></Pressable>)}</ScrollView></View>
      </View> : null}

      {panel === 'preview' ? <View style={styles.panel}><View style={styles.previewHeader}><Text style={styles.panelTitle}>Preview</Text><Pill label={preview ? 'Live' : 'Non disponible'} tone={preview ? 'success' : 'warning'} /></View>{preview ? <View style={styles.webWrap}><WebView originWhitelist={['*']} source={{ html: preview }} javaScriptEnabled style={styles.web} /></View> : <View style={styles.empty}><Text style={styles.emptyTitle}>Pas de rendu visuel pour cette technologie.</Text><Text style={styles.emptyText}>Utilise la console pour vérifier le projet. Les projets Web disposent d’un aperçu en direct.</Text></View>}</View> : null}

      {panel === 'console' ? <View style={styles.panel}><View style={styles.previewHeader}><Text style={styles.panelTitle}>Console</Text><Pressable onPress={run} style={styles.rerun}><Text style={styles.rerunText}>Relancer</Text></Pressable></View><View style={styles.console}><Text style={styles.prompt}>$ nexcode project run</Text><Text style={styles.consoleText}>{consoleText}</Text></View><PrimaryButton label="Retour au code" onPress={() => setPanel('code')} /></View> : null}
    </View>
  );
}

function Nav({ active, label, icon, onPress }: { active: boolean; label: string; icon: string; onPress: () => void }) {
  return <Pressable onPress={() => { onPress(); Haptics.selectionAsync().catch(() => undefined); }} style={[styles.navItem, active && styles.navActive]}><Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text><Text style={[styles.navLabel, active && styles.navIconActive]}>{label}</Text></Pressable>;
}

function fileBadge(filename: string) {
  return (filename.split('.').pop() ?? 'TXT').toUpperCase().slice(0, 3);
}

function createProjectDraft(project: GuidedProject): LabDraft {
  const files = starterFiles(project);
  const first = Object.keys(files)[0] ?? 'main.txt';
  return { missionId: `project:${project.id}`, language: project.tech, files, activeFile: first, updatedAt: new Date().toISOString() };
}

function starterFiles(project: GuidedProject): Record<string, string> {
  const tech = `${project.tech} ${project.track}`.toLowerCase();
  if (tech.includes('html') || tech.includes('css') || tech.includes('web')) return {
    'index.html': `<!doctype html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${project.title}</title>\n  <link rel="stylesheet" href="style.css" />\n</head>\n<body>\n  <main id="app">\n    <h1>${project.title}</h1>\n    <p>Commence ton projet ici.</p>\n  </main>\n  <script src="script.js"></script>\n</body>\n</html>`,
    'style.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 24px;\n  background: #0b1020;\n  color: #f7f8ff;\n}\n',
    'script.js': "const app = document.querySelector('#app');\nconsole.log('NexCode project ready', app);\n",
  };
  if (tech.includes('python')) return { 'main.py': `# ${project.title}\n\ndef main():\n    print("NexCode project ready")\n\nif __name__ == "__main__":\n    main()\n` };
  if (tech.includes('sql') || tech.includes('donnée')) return { 'schema.sql': '-- Définis les tables du projet\nCREATE TABLE example (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);\n', 'queries.sql': '-- Écris tes requêtes ici\nSELECT * FROM example;\n' };
  if (tech.includes('node') || tech.includes('api') || tech.includes('bot') || tech.includes('javascript')) return { 'index.js': `// ${project.title}\nfunction main() {\n  console.log('NexCode project ready');\n}\n\nmain();\n`, 'README.md': `# ${project.title}\n\n${project.description}\n` };
  return { 'main.txt': `${project.title}\n\n${project.description}\n` };
}

function buildPreview(files: Record<string, string>) {
  const htmlName = Object.keys(files).find((name) => name.endsWith('.html'));
  if (!htmlName) return '';
  const css = Object.entries(files).filter(([name]) => name.endsWith('.css')).map(([, value]) => value).join('\n');
  const js = Object.entries(files).filter(([name]) => name.endsWith('.js')).map(([, value]) => value).join('\n');
  let html = files[htmlName] ?? '';
  if (css) html = html.includes('</head>') ? html.replace('</head>', `<style>${css}</style></head>`) : `<style>${css}</style>${html}`;
  if (js) html = html.includes('</body>') ? html.replace('</body>', `<script>${js}<\/script></body>`) : `${html}<script>${js}<\/script>`;
  return html;
}

function runtimeMessage(project: GuidedProject, draft: LabDraft) {
  const nonEmpty = Object.entries(draft.files).filter(([, value]) => value.trim().length > 0).length;
  return `${project.tech} • ${nonEmpty}/${Object.keys(draft.files).length} fichier(s) contenant du code.\nLe workspace est sauvegardé. L’exécution native distante des langages non-Web reste séparée du preview local.`;
}

const styles = StyleSheet.create({
  topbar:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12},back:{width:40,height:40,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,.05)',borderWidth:1,borderColor:'rgba(255,255,255,.08)'},backText:{color:theme.colors.text,fontSize:27},titleWrap:{flex:1},kicker:{color:'#8897FF',fontSize:9,fontWeight:'900',letterSpacing:1.1},title:{color:theme.colors.text,fontSize:17,fontWeight:'900',marginTop:2},run:{height:40,paddingHorizontal:15,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#6878FF'},runText:{color:'#fff',fontSize:12,fontWeight:'900'},nav:{gap:7,paddingVertical:8},navItem:{minWidth:72,paddingHorizontal:11,paddingVertical:9,borderRadius:15,alignItems:'center',gap:3,backgroundColor:'rgba(255,255,255,.035)',borderWidth:1,borderColor:'rgba(255,255,255,.07)'},navActive:{backgroundColor:'rgba(104,120,255,.16)',borderColor:'rgba(104,120,255,.45)'},navIcon:{color:theme.colors.textMuted,fontSize:13,fontWeight:'900'},navLabel:{color:theme.colors.textMuted,fontSize:9,fontWeight:'800'},navIconActive:{color:'#CBD2FF'},panel:{gap:10,marginTop:8},panelTitle:{color:theme.colors.text,fontSize:21,fontWeight:'900'},explorerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fileCount:{color:theme.colors.textMuted,fontSize:10,fontWeight:'800'},importRow:{flexDirection:'row',gap:8},importButton:{flex:1,minHeight:62,borderRadius:17,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'rgba(103,121,255,.1)',borderWidth:1,borderColor:'rgba(119,137,255,.24)'},importPressed:{opacity:.78,transform:[{scale:.985}]},importGlyph:{color:'#BDC7FF',fontSize:20,fontWeight:'900'},importTitle:{color:theme.colors.text,fontSize:12,fontWeight:'900'},importMeta:{color:theme.colors.textMuted,fontSize:9,marginTop:2},helper:{color:theme.colors.textMuted,fontSize:10.5,lineHeight:16},file:{minHeight:54,borderRadius:15,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'rgba(255,255,255,.035)',borderWidth:1,borderColor:theme.colors.border},fileActive:{borderColor:'#6375EF',backgroundColor:'rgba(99,117,239,.12)'},fileBadge:{width:34,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#172038'},fileBadgeText:{color:'#8FA0FF',fontWeight:'900',fontSize:8},fileText:{flex:1,color:theme.colors.text,fontFamily:'monospace',fontSize:11},chevron:{color:theme.colors.textMuted,fontSize:20},tabs:{gap:6},tab:{paddingHorizontal:11,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:theme.colors.border},tabActive:{backgroundColor:'#1A2451',borderColor:'#5267DB'},tabText:{color:theme.colors.textSecondary,fontSize:10,fontWeight:'700'},tabTextActive:{color:'#fff'},editor:{borderWidth:1,borderColor:theme.colors.border,borderRadius:18,overflow:'hidden',backgroundColor:'#070B13'},editorTop:{height:42,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#1E2637'},editorName:{color:theme.colors.text,fontSize:11,fontWeight:'800',fontFamily:'monospace'},saved:{color:theme.colors.success,fontSize:9,fontWeight:'800'},code:{minHeight:360,padding:14,color:'#E7EDFF',fontFamily:'monospace',fontSize:13,lineHeight:20},symbols:{gap:5,padding:8,borderTopWidth:1,borderTopColor:'#1E2637'},symbol:{minWidth:34,height:34,borderRadius:9,alignItems:'center',justifyContent:'center',backgroundColor:'#151D2D'},symbolText:{color:'#D9E0F8',fontFamily:'monospace',fontSize:12,fontWeight:'800'},previewHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},webWrap:{height:500,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:theme.colors.border,backgroundColor:'#fff'},web:{flex:1},empty:{minHeight:180,borderRadius:18,padding:18,justifyContent:'center',backgroundColor:'rgba(255,255,255,.035)',borderWidth:1,borderColor:theme.colors.border},emptyTitle:{color:theme.colors.text,fontSize:16,fontWeight:'900'},emptyText:{color:theme.colors.textSecondary,fontSize:12,lineHeight:19,marginTop:8},rerun:{paddingHorizontal:12,paddingVertical:7,borderRadius:10,backgroundColor:'#1B2550'},rerunText:{color:'#AEB9FF',fontSize:10,fontWeight:'900'},console:{minHeight:260,borderRadius:18,padding:15,backgroundColor:'#060A10',borderWidth:1,borderColor:'#20283A'},prompt:{color:'#77E8A9',fontFamily:'monospace',fontSize:12,fontWeight:'800'},consoleText:{color:'#CBD4E9',fontFamily:'monospace',fontSize:12,lineHeight:19,marginTop:12},
});
