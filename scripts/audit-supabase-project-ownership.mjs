import fs from 'node:fs';
import assert from 'node:assert/strict';

const schemaUrl = new URL('../supabase/schema.sql', import.meta.url);
const schema = fs.readFileSync(schemaUrl, 'utf8');

assert.match(schema, /drop policy if exists "project files own rows" on public\.project_files;/, 'project file policy updates must be rerunnable');
assert.match(schema, /create policy "project files own rows" on public\.project_files[\s\S]*auth\.uid\(\) = user_id[\s\S]*exists \([\s\S]*from public\.projects project[\s\S]*project\.id = project_id[\s\S]*project\.user_id = auth\.uid\(\)[\s\S]*\)[\s\S]*with check/s, 'project files must require both row ownership and ownership of the referenced project');

assert.match(schema, /drop policy if exists "learning events own rows" on public\.learning_events;/, 'learning-event policy updates must be rerunnable');
assert.match(schema, /create policy "learning events own rows" on public\.learning_events[\s\S]*auth\.uid\(\) = user_id[\s\S]*project_id is null[\s\S]*or exists \([\s\S]*from public\.projects project[\s\S]*project\.id = project_id[\s\S]*project\.user_id = auth\.uid\(\)[\s\S]*\)[\s\S]*with check/s, 'project-linked learning events must only reference projects owned by the authenticated user');

assert.doesNotMatch(schema, /create policy "project files own rows" on public\.project_files for all using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\);/, 'project files must not fall back to user_id-only isolation');
assert.doesNotMatch(schema, /create policy "learning events own rows" on public\.learning_events for all using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\);/, 'learning events must not fall back to user_id-only isolation');

console.log('Supabase project ownership audit OK: project files and project-linked learning events cannot cross account project boundaries.');