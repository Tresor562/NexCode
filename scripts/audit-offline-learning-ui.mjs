import fs from 'node:fs';

const hub = fs.readFileSync('src/ui/LearningHub.tsx', 'utf8');
const app = fs.readFileSync('src/ui/NexCodeApp.tsx', 'utf8');

const requiredHubMarkers = [
  'onToggleChapterOffline',
  'Disponible hors ligne',
  'state.installedOfflinePacks.find',
  "(['lite', 'standard', 'full'] as OfflinePackKind[])",
  'onToggleChapterOffline(chapter.id, kind)',
  'accessibilityState={{ selected: active }}',
];

for (const marker of requiredHubMarkers) {
  if (!hub.includes(marker)) {
    throw new Error(`Missing offline Learning Hub integration: ${marker}`);
  }
}

if (!app.includes('onToggleChapterOffline={toggleChapterOffline}')) {
  throw new Error('NexCodeApp no longer wires chapter offline actions into LearningHub.');
}

if (!app.includes('buildChapterOfflinePack(course, chapterId, kind)')) {
  throw new Error('Chapter offline UI is not backed by the canonical offline pack builder.');
}

console.log('Offline learning UI audit passed.');
