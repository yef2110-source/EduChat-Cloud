# EduChat V2 call signaling — setup and integration notes

The V2 call signaling migrations add authenticated call sessions, guarded status transitions, server-owned timestamps, and a client helper. This is **not yet wired into the legacy HTML client or deployed**.

## Important prerequisite (not present in this repository)

The call migration references public.educhat_v2_friendships, with user_low and user_high UUID columns, and expects V2 users to authenticate through Supabase Auth. The referenced foundation migration EduChatCloud_v2_secure_foundation.sql is **not present in this repository**. Do not attempt to apply the call migrations until that foundation exists in your staging project and its friendship schema matches the contract below.

Required foundation contract:
- public.educhat_v2_friendships exists with user_low and user_high referencing Auth UUIDs and a unique canonical pair.
- user_low < user_high is enforced (canonical ordering).
- Friendship rows are created only by a trusted backend/RPC after verifying the relationship; clients cannot freely insert friendships.
- V2 profile/auth mappings are based on Supabase Auth UUIDs, not legacy UID values.
- RLS is enabled and tested for foundation tables.

## Migration apply order

1. In a **staging** Supabase project, apply and verify the missing foundation schema described above.
2. Apply supabase/migrations/202611260001_educhat_v2_call_signaling.sql.
3. Apply supabase/migrations/202611260002_educhat_v2_call_transition_guard.sql.
4. Apply supabase/migrations/202611260003_educhat_v2_call_timestamp_hardening.sql.
5. Confirm public.educhat_v2_calls is in the supabase_realtime publication.
6. Create two staging Auth users, create their V2 profiles, and grant a friendship through the trusted backend/RPC path.
7. Test with two signed-in devices. Do not use production data before staging passes.

## Client helper

src/calls/call-signaling-client.js exports createCallSignalingClient({supabase,onIncoming,onStatus,timeoutMs}). Use the authenticated Supabase JS v2 client. Call subscribeIncoming() after authentication is ready. Use startCall(calleeAuthUuid,'audio'|'video') for outgoing calls. The helper handles ringing acknowledgement, answer, decline, end, timeout, and Realtime channel cleanup.

The database policy caps call expiration at 60 seconds after creation. Keep timeoutMs at or below 60,000 ms (the default is 45,000 ms) so client-configured timeouts fit that policy.

## Call protocol

- Caller inserts an invited call with a unique room name and expiration.
- Recipient acknowledges delivery by changing status to ringing; only then should caller UI display “Phone is ringing”.
- Recipient answers, declines, marks busy, or fails; caller may mark no_answer only after expiry.
- Participants may end an answered call.
- On answer, both clients join the same Jitsi room. Stop ringtone and unsubscribe on resolution; guard duplicate and late events by call UUID.

## Caller UI states

Connecting; Phone is ringing (recipient acknowledgement); Answered; Declined; Busy; No answer; Offline/Unreachable; Failed; Ended.

## Staging test checklist (not yet completed)

- [ ] Foundation schema exists and its friendship table matches the required contract.
- [ ] All three call migrations apply cleanly in order.
- [ ] Realtime publication membership verified.
- [ ] Two Auth users are friends; non-friends cannot create sessions.
- [ ] Incoming insert produces one incoming-call UI and recipient ringing acknowledgement.
- [ ] Caller displays ringing only after acknowledgement.
- [ ] Answer, decline, busy, no-answer timeout, and end transitions work.
- [ ] Unauthorized users cannot read or update calls.
- [ ] Call identity and server-owned timestamp fields cannot be changed.
- [ ] Concurrent incoming calls, duplicate events, late answer, reconnect/offline cases tested.
- [ ] Realtime channels clean up on sign-out/unmount.
- [ ] Two actual devices confirm identical Jitsi room joining and call UI behavior.

## Known limitations and security notes

- The HTML client still uses legacy UID-only auth and legacy tables. Do not pass legacy identity values to this V2 client.
- The V2 foundation migration is missing from this repository, so the prerequisite cannot be verified or installed from this repo alone.
- Browser Realtime cannot wake a fully closed app. That requires Web Push/FCM and backend delivery.
- Staging migrations and two-device tests are required before production use; this setup is not production-ready.