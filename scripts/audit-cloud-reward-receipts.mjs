import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/cloudAccount.ts'), 'utf8');

function requirePattern(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requirePattern(
  /const MAX_REWARD_RECEIPTS = 2_000;/,
  'Cloud reward receipt history must remain explicitly bounded.',
);
requirePattern(
  /function normalizeRewardReceiptId\(value: unknown\): string \| null \{[\s\S]*replace\(\/\[\\u0000-\\u001F\\u007F\]\/g, ''\)[\s\S]*normalize\('NFKC'\)[\s\S]*slice\(0, 160\)/,
  'Cloud reward receipt identities must reject control characters, canonicalize Unicode and remain bounded.',
);
requirePattern(
  /function mergeRewardReceiptIds\(remote: unknown, local: LocalState\['rewardReceiptIds'\]\): string\[\] \{[\s\S]*for \(const raw of \[\.\.\.remoteReceipts, \.\.\.localReceipts\]\)[\s\S]*seen\.has\(receiptId\)[\s\S]*merged\.slice\(-MAX_REWARD_RECEIPTS\)/,
  'Cross-device reward receipts must be unioned, deduplicated and bounded while preserving the latest local receipts.',
);
requirePattern(
  /rewardReceiptIds: mergeRewardReceiptIds\(settings\.rewardReceiptIds, local\.rewardReceiptIds\)/,
  'Supabase reconciliation must merge reward receipts before XP/NexCoins can be rewarded again on another device.',
);
requirePattern(
  /settings: \{[\s\S]*dailyGoalRewardDate: state\.dailyGoalRewardDate \?\? null,[\s\S]*rewardReceiptIds: state\.rewardReceiptIds \?\? \[\],/,
  'Cloud pushes must persist the bounded reward receipt history in user_progress.settings.',
);

console.log('Cloud reward receipt audit OK: receipt identities are canonicalized, bounded, merged across devices, and persisted with Supabase progress.');
