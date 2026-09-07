import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const cloudSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/cloudAccount.ts'), 'utf8');
const localSource = fs.readFileSync(path.join(process.cwd(), 'src/lib/localState.ts'), 'utf8');

function requirePattern(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(
  cloudSource,
  /const MAX_REWARD_RECEIPTS = 2_000;/,
  'Cloud reward receipt history must remain explicitly bounded.',
);
requirePattern(
  cloudSource,
  /function normalizeRewardReceiptId\(value: unknown\): string \| null \{[\s\S]*replace\(\/\[\\u0000-\\u001F\\u007F\]\/g, ''\)[\s\S]*normalize\('NFKC'\)[\s\S]*slice\(0, 160\)/,
  'Cloud reward receipt identities must reject control characters, canonicalize Unicode and remain bounded.',
);
requirePattern(
  cloudSource,
  /function mergeRewardReceiptIds\(remote: unknown, local: LocalState\['rewardReceiptIds'\]\): string\[\] \{[\s\S]*for \(const raw of \[\.\.\.remoteReceipts, \.\.\.localReceipts\]\)[\s\S]*seen\.has\(receiptId\)[\s\S]*merged\.slice\(-MAX_REWARD_RECEIPTS\)/,
  'Cross-device reward receipts must be unioned, deduplicated and bounded while preserving the latest local receipts.',
);
requirePattern(
  cloudSource,
  /rewardReceiptIds: mergeRewardReceiptIds\(settings\.rewardReceiptIds, local\.rewardReceiptIds\)/,
  'Supabase reconciliation must merge reward receipts before XP/NexCoins can be rewarded again on another device.',
);
requirePattern(
  cloudSource,
  /settings: \{[\s\S]*dailyGoalRewardDate: state\.dailyGoalRewardDate \?\? null,[\s\S]*rewardReceiptIds: state\.rewardReceiptIds \?\? \[\],/,
  'Cloud pushes must persist the bounded reward receipt history in user_progress.settings.',
);

requirePattern(
  localSource,
  /function normalizeRewardReceiptId\(value: unknown\): string \{[\s\S]*normalize\('NFKC'\)[\s\S]*cleanString\([\s\S]*160\)/,
  'Local reward receipt identities must be Unicode-canonicalized before their final length and control-character cleanup.',
);
requirePattern(
  localSource,
  /function normalizeRewardReceiptIds\(value: unknown\): string\[\] \{[\s\S]*value\.slice\(-\(MAX_REWARD_RECEIPTS \* 2\)\)[\s\S]*seen\.has\(receiptId\)[\s\S]*receipts\.slice\(-MAX_REWARD_RECEIPTS\)/,
  'Local reward receipt restoration must remain bounded and deduplicate canonical identities.',
);
requirePattern(
  localSource,
  /const existingReceipts = normalizeRewardReceiptIds\(state\.rewardReceiptIds\);[\s\S]*existingReceipts\.includes\(receiptId\)/,
  'Reward crediting must compare the incoming receipt against the canonicalized local history.',
);
requirePattern(
  localSource,
  /rewardReceiptIds: normalizeRewardReceiptIds\(value\.rewardReceiptIds\)/,
  'Local state restoration must canonicalize legacy reward receipt history before it can be reused.',
);

console.log('Reward receipt audit OK: receipt identities are canonicalized, bounded, deduplicated locally and synchronized with Supabase progress.');
