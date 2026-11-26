import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(new URL('../supabase/migrations/202611260004_educhat_v2_call_insert_hardening.sql', import.meta.url), 'utf8').toLowerCase();
const required = [
  'create or replace function public.educhat_v2_validate_call_insert()',
  'auth.uid()',
  'new.caller_id is distinct from actor',
  "new.status is distinct from 'invited'",
  "new.expires_at > server_now + interval '60 seconds'",
  'public.educhat_v2_friendships',
  'new.created_at := server_now',
  'new.updated_at := server_now',
  'new.answered_at := null',
  'new.ended_at := null',
  'before insert on public.educhat_v2_calls'
];
for (const text of required) assert.ok(migration.includes(text), 'Missing insert-hardening safeguard: ' + text);
console.log('Validated V2 call insert migration safeguards (' + required.length + ' checks)');
