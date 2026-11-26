# EduChat V2 call signaling — setup and integration notes

This adds an authenticated call-session table, hardened status-transition triggers and server-owned timestamp protections, and a client helper with separate Realtime subscriptions for incoming and outgoing calls. It is **not yet wired into the existing HTML client or deployed**.

## Apply order
1. In a staging Supabase project, apply `EduChatCloud_v2_secure_foundation.sql` first (V2 profiles, friendships, messages, notifications and RLS).
2. Apply `supabase/migrations/202611260001_educhat_v2_call_signaling.sql`.
3. Apply `supabase/migrations/202611260002_educhat_v2_call_transition_guard.sql` to tighten permitted state changes.
4. Apply `supabase/migrations/202611260003_educhat_v2_call_timestamp_hardening.sql` (server-owned timestamp guard and no same-status writes).\n5. Verify `public.educhat_v2_calls` is included in the `supabase_realtime` publication.
6. Create two test Auth users, create V2 profiles, and grant friendship through the trusted backend/RPC path.
7. Test calls between two signed-in devices. Do not test on production data until staging passes.

## Client helper
`src/calls/call-signaling-client.js` exports `createCallSignalingClient({supabase,onIncoming,onStatus,timeoutMs})`. Call `subscribeIncoming()` once the authenticated user is ready. Use `startCall(calleeAuthUuid,'audio'|'video')` to create an outgoing session. The helper handles incoming ringing acknowledgement, answer, decline, end, timeout, and channel cleanup. Incoming and call-watch channels are separate to avoid losing incoming events while watching an outgoing call.

## Proposed protocol
- Caller inserts `invited` with unique room name and expiry.
- Recipient acknowledges delivery by transitioning to `ringing`; only after that should caller UI say “Phone is ringing”.
- Recipient answers or declines; caller may set `no_answer` only after expiry. Participants may end an answered call.
- On answer, both clients join the same Jitsi room. Unsubscribe and stop ringtone on resolution; guard duplicate and late events by call UUID.

## Caller UI states
Connecting; Phone is ringing (recipient acknowledgement); Answered; Declined; Busy; No answer; Offline/Unreachable; Failed; Ended.

## Test checklist (not yet run)
- [ ] Migration applied successfully in staging; realtime publication verified.
- [ ] Two Auth users are friends; non-friends cannot create sessions.
- [ ] Incoming insert produces one incoming-call UI and recipient `ringing` acknowledgement.
- [ ] Caller displays ringing only after acknowledgement.
- [ ] Answer, decline, busy, no-answer timeout, end-call transitions work.
- [ ] Concurrent incoming while busy; duplicate events; late answer after expiry; reconnect/offline cases.
- [ ] Realtime channel cleanup on sign-out/unmount.
- [ ] Test on two actual devices and confirm Jitsi room matching.

## Known limitation and security note
The current HTML app still uses legacy UID-only auth and tables. Do not wire this V2 client to legacy identity values. V2 requires Supabase Auth UUIDs and validated friendship rows. Browser Realtime cannot wake an app that is fully closed; that needs Web Push/FCM and backend delivery. Migration and tests are staging-only; this is not production-ready.
