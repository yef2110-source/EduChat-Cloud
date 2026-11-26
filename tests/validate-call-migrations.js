import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(new URL('../supabase/migrations/202611260004_educhat_v2_call_insert_hardening.sql', import.meta.url), 'utf8');
const required = [
  /create or replace function public\\.educhat_v2_validate_call_insert\\(\\)/i,
  /auth\\.uid\\(\\)/i,
  /new\\.caller_id is distinct from actor/i,
  /new\\.status is distinct from 'invited'/i,
  /new\\.expires_at > server_now \\+ interval '60 seconds'/i,
  /public\\.educhat_v2_friendships/i,
  /new\\.created_at := server_now/i,
  /new\\.updated_at := server_now/i,
  /new\\.answered_at := null/i,
  /new\\.ended_at := null/i,
  /before insert on public\\.educhat_v2_calls/i
];
for (const pattern of required) assert.match(migration, pattern, 'Missing insert-hardening safeguard: ' + pattern);
console.log('Validated V2 call insert migration safeguards (' + required.length + ' checks)');
