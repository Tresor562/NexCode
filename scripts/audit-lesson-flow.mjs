import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/ui/LessonFlowScreen.tsx', import.meta.url);
const feedbackUrl = new URL('../src/ui/learningFeedback.ts', import.meta.url);
const source = fs.readFileSync(sourceUrl, 'utf8');
const feedbackSource = fs.readFileSync(feedbackUrl, 'utf8');

assert.match(source, /\[lesson\.id, scale\]/, 'lesson flow must reset when the active lesson changes');
assert.match(source, /setStepIndex\(0\)/, 'lesson switch must reset the step index');
assert.match(source, /setAnswer\(null\)/, 'lesson switch must clear the selected quiz answer');
assert.match(source, /setSubmitted\(false\)/, 'lesson switch must clear submitted feedback');
assert.match(source, /setRecorded\(false\)/, 'lesson switch must clear per-attempt recording state');
assert.match(source, /setRecallDraft\(''\)/, 'lesson switch must clear active-recall drafts');
assert.match(source, /setRecallRevealed\(false\)/, 'lesson switch must hide old active-recall hints');
assert.match(source, /setRecallConfidence\(null\)/, 'lesson switch must clear recall confidence');
assert.match(source, /setQuizReflection\(''\)/, 'lesson switch and retry flow must clear stale quiz reflections');
assert.match(source, /setTransferDraft\(''\)/, 'lesson switch must clear transfer drafts');

assert.match(source, /recallDraft\.trim\(\)\.length >= 3/, 'active recall must require a real written attempt');
assert.match(source, /disabled=\{!recallAttemptReady\}/, 'recall hint reveal must stay gated by the written attempt');
assert.match(source, /disabled=\{recallConfidence === null\}/, 'quiz continuation must require recall self-assessment');
assert.match(source, /quizReflection\.trim\(\)\.length >= 12/, 'a correct quiz answer must require a substantive retrieval reflection');
assert.match(source, /value=\{quizReflection\}/, 'the post-quiz reflection must be an actual learner input, not decorative copy');
assert.match(source, /onChangeText=\{setQuizReflection\}/, 'the post-quiz reflection must remain interactive');
assert.match(source, /disabled=\{!quizReflectionReady\}/, 'correct-answer continuation must stay gated until the learner explains why');
assert.match(source, /accessibilityLabel="Explication de ta bonne réponse"/, 'post-quiz retrieval must remain accessible to screen-reader users');
assert.match(source, /transferDraft\.trim\(\)\.length >= 12/, 'transfer must require a substantive strategy');
assert.match(source, /disabled=\{!transferAttemptReady\}/, 'Lab transition must stay gated by the transfer attempt');

assert.match(source, /useMotionPreferences\(\)/, 'lesson flow must share the app-wide motion preference lifecycle');
assert.match(source, /const \{ reduceMotion, appActive \} = useMotionPreferences\(\)/, 'lesson flow must consume both reduced-motion and foreground state');
assert.match(source, /if \(reduceMotion \|\| !appActive\)/, 'mentor animation must stop for reduced motion or while the app is inactive');
assert.match(source, /const feedback = useRef\(createLearningFeedbackGate\(\)\)\.current;/, 'lesson flow must use the shared feedback gate');
assert.match(source, /feedback\.sound\(appActive, player\);/, 'lesson audio must route through the shared foreground/audio-supersession gate');
assert.match(source, /feedback\.selection\(appActive\);/, 'lesson selection haptics must route through the shared foreground gate');
assert.match(source, /feedback\.notification\(appActive, tone\);/, 'lesson quiz notifications must route through the shared foreground gate');
assert.match(source, /notificationFeedback\('success'\)/, 'correct answers must keep explicit success feedback');
assert.match(source, /notificationFeedback\('error'\)/, 'wrong answers must keep explicit error feedback');
assert.match(source, /useAudioPlayer\(successSound\)/, 'lesson flow must keep success audio feedback wired');
assert.match(source, /useAudioPlayer\(errorSound\)/, 'lesson flow must keep error audio feedback wired');
assert.match(source, /accessibilityLiveRegion="polite"/, 'quiz feedback must stay screen-reader announced');

assert.match(feedbackSource, /if \(!appActive(?: \|\| !nativeAppIsActive\(\))?\) return false;/, 'shared feedback gate must fail closed while the app is inactive');
assert.match(feedbackSource, /sharedAudioRequestGeneration !== generation/, 'shared audio gate must suppress stale asynchronous replay requests');
assert.doesNotMatch(source, /from 'expo-haptics'/, 'lesson flow must not bypass the shared haptic controller');
assert.doesNotMatch(source, /player\.seekTo\(0\)[\s\S]{0,80}player\.play\(\)/, 'lesson flow must not bypass shared stale-audio protection');

console.log('Lesson flow audit OK: lesson-switch reset, active recall, post-quiz retrieval reflection, transfer gating, shared motion lifecycle, centralized foreground feedback and live accessibility feedback are protected.');
