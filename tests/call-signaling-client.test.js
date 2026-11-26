import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallSignalingClient } from '../src/calls/call-signaling-client.js';

function mockSupabase(userId='u-caller') {
  const calls = new Map();
  const channels = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    from(table) {
      assert.equal(table, 'educhat_v2_calls');
      return {
        insert(row) {
          const inserted = { id: 'call-' + (calls.size + 1), created_at: 'now', ...row };
          calls.set(inserted.id, inserted);
          return { select: () => ({ single: async () => ({ data: inserted, error: null }) }) };
        },
        update(patch) {
          let idFilter = null, statusFilter = null, inFilter = null, callerFilter = null;
          const query = {
            eq(k, v) { if (k === 'id') idFilter = v; if (k === 'status') statusFilter = v; if (k === 'caller_id') callerFilter = v; return query; },
            in(k, vals) { if (k === 'status') inFilter = vals; return query; },
            select() { return query; },
            single: async () => resolve(true),
            maybeSingle: async () => resolve(false),
            then(resolvePromise, rejectPromise) { return resolve(false).then(resolvePromise, rejectPromise); }
          };
          async function resolve(requireRow) {
            const row = calls.get(idFilter);
            if (!row || (statusFilter && row.status !== statusFilter) || (callerFilter && row.caller_id !== callerFilter) || (inFilter && !inFilter.includes(row.status))) {
              return { data: null, error: requireRow ? { message: 'No matching call row' } : null };
            }
            Object.assign(row, patch);
            return { data: row, error: null };
          }
          return query;
        }
      };
    },
    channel(name) {
      const ch = { name, handlers: [], on(event, filter, cb) { ch.handlers.push({ event, filter, cb }); return ch; }, subscribe(cb) { ch.subscriptionCallback = cb; channels.push(ch); return ch; } };
      return ch;
    },
    removeChannel: async () => {}
  };
  return { supabase, calls, channels };
}

test('creates an invited call record and returns it', async () => {
  const m = mockSupabase(); const client = createCallSignalingClient({ supabase: m.supabase });
  const call = await client.startCall('u-recipient', 'audio', 'room-test-name-123');
  assert.equal(call.status, 'invited'); assert.equal(call.callee_id, 'u-recipient');
  await client.dispose();
});

test('rejects self-call and invalid call type', async () => {
  const m = mockSupabase('self'); const client = createCallSignalingClient({ supabase: m.supabase });
  await assert.rejects(() => client.startCall('self', 'audio'), /Invalid recipient/);
  await assert.rejects(() => client.startCall('other', 'screen'), /Invalid call type/);
  await client.dispose();
});

test('creates separate realtime channels for incoming and outgoing monitoring', async () => {
  const m = mockSupabase(); const client = createCallSignalingClient({ supabase: m.supabase });
  await client.subscribeIncoming(); await client.startCall('u-peer', 'video');
  assert.equal(m.channels.length, 2); assert.notEqual(m.channels[0].name, m.channels[1].name);
  await client.dispose();
});

test('incoming call insert is acknowledged as ringing and passed to incoming handler', async () => {
  const m = mockSupabase('u-recipient'); let incomingCall, controls;
  const client = createCallSignalingClient({ supabase: m.supabase, onIncoming: (call, actions) => { incomingCall = call; controls = actions; } });
  await client.subscribeIncoming();
  const handler = m.channels[0].handlers[0].cb;
  const row = { id: 'incoming-1', caller_id: 'u-caller', callee_id: 'u-recipient', status: 'invited', call_type: 'audio', room_name: 'room-incoming-123' };
  m.calls.set(row.id, row); await handler({ new: row });
  assert.equal(incomingCall.id, 'incoming-1'); assert.equal(incomingCall.status, 'ringing'); assert.equal(row.status, 'ringing');
  assert.equal(typeof controls.answer, 'function'); assert.equal(typeof controls.decline, 'function');
  await client.dispose();
});

test('recipient can answer an incoming ringing call', async () => {
  const m = mockSupabase('u-recipient'); const client = createCallSignalingClient({ supabase: m.supabase });
  const row = { id: 'incoming-answer', caller_id: 'u-caller', callee_id: 'u-recipient', status: 'ringing', call_type: 'video', room_name: 'room-answer-123' };
  m.calls.set(row.id, row); const result = await client.answer(row);
  assert.equal(result.status, 'answered'); assert.equal(client.activeCall.status, 'answered');
  await client.dispose();
});

test('recipient can decline an incoming ringing call', async () => {
  const m = mockSupabase('u-recipient'); const client = createCallSignalingClient({ supabase: m.supabase });
  const row = { id: 'incoming-decline', caller_id: 'u-caller', callee_id: 'u-recipient', status: 'ringing', call_type: 'audio', room_name: 'room-decline-123' };
  m.calls.set(row.id, row); await client.decline(row);
  assert.equal(row.status, 'declined'); assert.equal(client.activeCall, null);
  await client.dispose();
});


test('caller receives a no-answer status after the expiry timeout', async () => {
  const m = mockSupabase('u-caller');
  const statuses = [];
  const client = createCallSignalingClient({ supabase: m.supabase, timeoutMs: 5, onStatus: event => statuses.push(event.status) });
  const call = await client.startCall('u-peer', 'audio', 'room-timeout-123');
  await new Promise(resolve => setTimeout(resolve, 220));
  assert.equal(m.calls.get(call.id).status, 'no_answer');
  assert.ok(statuses.includes('no_answer'));
  assert.equal(client.activeCall, null);
  await client.dispose();
});
