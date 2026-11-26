# EduChat V2 call signaling — setup and integration notes

This migration adds an authenticated call-session table with Realtime events for the incoming-call flow. It is **not yet wired into the existing HTML client and is not deployed**.

## Apply order
1. In a staging Supabase project, apply `EduChatCloud_v2_secure_foundation.sql` first (it creates V2 profiles, friendships, messages, notifications and RLS).
2. Apply `supabase/migrations/202611260001_educhat_v2_call_signaling.sql`.
3. Verify the table `public.educhat_v2_calls` is included in the `supabase_realtime` publication.
4. Create two test Auth users, create their V2 profiles, and grant friendship through the trusted backend/RPC path.
5. Test call invitations between the two signed-in devices. Never test this on production data until staging passes.

## Proposed client protocol
- Caller inserts a call row with status `invited`, a unique room name, audio/video type, and expiry 45 seconds in the future.
- Recipient subscribes to call rows where `callee_id` is their authenticated UID. On receiving an invitation, display incoming-call UI and update the row to `ringing`. This update is the caller's delivery/ringing acknowledgement.
- Recipient updates status to `answered`, `declined`, or `busy`; caller may update it to `no_answer` after the expiry or `failed` if delivery fails.
- On answer, both clients join the same Jitsi room. On end, either participant changes status to `ended`.
- Use realtime subscriptions only for the session's participants. Unsubscribe and stop ringtone when resolved; guard duplicate and late events by call UUID.

## Caller UI states
`Connecting` while invitation is being sent; `Phone is ringing` only after the recipient acknowledges with `ringing`; `Answered`; `Declined`; `Busy`; `No answer`; `Offline / Unreachable`; `Failed`; `Ended`.

## Known limitation / security note
The existing client is still UID-only legacy authentication and legacy tables are not secure. This migration is based on Supabase Auth UUIDs and friendship checks. Do not connect the legacy client to this table or call it production-ready until Auth is wired into the UI and RLS is tested. Push notifications while the app is closed require an external push delivery setup (e.g., Web Push/FCM); a Realtime event alone cannot wake a browser that is offline.
