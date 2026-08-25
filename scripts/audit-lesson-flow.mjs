import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/ui/LessonFlowScreen.tsx', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');

assert.match(source, /\[lesson\.id, scale\]/, 'lesson flow must reset when the active lesson changes');
assert.match(source, /setStepIndex\(0\)/, 'lesson switch must reset the step index');
assert.match(source, /setAnswer\(null\)/, 'lesson switch must clear the selected quiz answer');
assert.match(source, /setSubmitted\(false\)/, 'lesson switch must clear submitted feedback');
assert.match(source, /setRecorded\(false\)/, 'lesson switch must clear per-attempt recording state');
assert.match(source, /setRecallDraft\(''\)/, 'lesson switch must clear active-recall drafts');
assert.match(source, /setRecallRevealed\(false\)/, 'lesson switch must hide old active-recall hints');
assert.match(source, /setRecallConfidence\(null\)/, 'lesson switch must clear recall confidence');
assert.match(source, /setTransferDraft\(''\)/, 'lesson switch must clear transfer drafts');

assert.match(source, /recallDraft\.trim\(\)\.length >= 3/, 'active recall must require a real written attempt');
assert.match(source, /disabled=\{!recallAttemptReady\}/, 'recall hint reveal must stay gated by the written attempt');
assert.match(source, /disabled=\{recallConfidence === null\}/, 'quiz continuation must require recall self-assessment');
assert.match(source, /transferDraft\.trim\(\)\.length >= 12/, 'transfer must require a substantive strategy');
assert.match(source, /disabled=\{!transferAttemptReady\}/, 'Lab transition must stay gated by the transfer attempt');

assert.match(source, /useMotionPreferences\(\)/, 'lesson flow must share the app-wide motion preference lifecycle');
assert.match(source, /const \{ reduceMotion, appActive \} = useMotionPreferences\(\)/, 'lesson flow must consume both reduced-motion and foreground state');
assert.match(source, /if \(reduceMotion \|\| !appActive\)/, 'mentor animation must stop for reduced motion or while the app is inactive');
assert.match(source, /if \(!appActive\) return;[\s\S]*player\.seekTo\(0\)/, 'audio feedback must stay silent while the app is inactive');
assert.match(source, /function selectionFeedback\(\)[\s\S]*if \(!appActive\) return;[\s\S]*Haptics\.selectionAsync\(\)/, 'selection haptics must stay foreground-scoped');
assert.match(source, /function notificationFeedback\([\s\S]*Haptics\.notificationAsync\(type\)/, 'quiz notification haptics must stay centralized');
assert.match(source, /notificationFeedback\(Haptics\.NotificationFeedbackType\.Success\)/, 'correct answers must keep explicit success feedback');
assert.match(source, /notificationFeedback\(Haptics\.NotificationFeedbackType\.Error\)/, 'wrong answers must keep explicit error feedback');
assert.match(source, /useAudioPlayer\(successSound\)/, 'lesson flow must keep success audio feedback wired');
assert.match(source, /useAudioPlayer\(errorSound\)/, 'lesson flow must keep error audio feedback wired');
assert.match(source, /accessibilityLiveRegion="polite"/, 'quiz feedback must stay screen-reader announced');

console.log('Lesson flow audit OK: lesson-switch reset, active recall, transfer gating, shared motion lifecycle, foreground-scoped haptics/audio and live feedback are protected.');
