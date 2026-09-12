import fs from 'node:fs';

const hub = fs.readFileSync('src/ui/LearningHub.tsx', 'utf8');
const app = fs.readFileSync('src/ui/NexCodeApp.tsx', 'utf8');

const requiredHubMarkers = [
  'onToggleChapterOffline',
  'Disponible hors ligne',
  'state.installedOfflinePacks.find',
  "{ kind: 'lite', label: 'Lite'",
  "{ kind: 'standard', label: 'Standard'",
  "{ kind: 'full', label: 'Complet'",
  'OFFLINE_PACK_OPTIONS.map',
  'onToggleChapterOffline(chapter.id, option.kind)',
  'accessibilityState={{ selected: active, checked: active }}',
];

for (const marker of requiredHubMarkers) {
  if (!hub.includes(marker)) {
    throw new Error(`Missing offline Learning Hub integration: ${marker}`);
  }
}

if (/onToggleChapterOffline\(chapter\.id,\s*['"]light['"]\)/.test(hub)) {
  throw new Error("Learning Hub must not emit the legacy 'light' pack kind; the canonical kind is 'lite'.");
}

if (!app.includes('onToggleChapterOffline={toggleChapterOffline}')) {
  throw new Error('NexCodeApp no longer wires chapter offline actions into LearningHub.');
}

if (!app.includes('buildChapterOfflinePack(course, chapterId, kind)')) {
  throw new Error('Chapter offline UI is not backed by the canonical offline pack builder.');
}

console.log('Offline learning UI audit passed: canonical lite/standard/full choices stay wired, accessible, and backed by the offline engine.');
