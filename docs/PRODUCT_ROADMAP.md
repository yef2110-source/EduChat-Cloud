# EduChat — Product Development Plan

## Product direction
EduChat is a student-first learning and community platform. Social features are designed to support study—not become an entertainment feed. The Videos area is specifically **Study Videos** (lectures, topic explanations, exercise walkthroughs, revision, and summaries).

## User experience principles
- Arabic-first, RTL, mobile-first, accessible controls and readable contrast.
- Clear academic filters: education level, year, institution, major, subject, video type.
- Keep study content and friend/chat areas separate and easy to navigate.
- Fast on low bandwidth: progressive media loading, sensible previews, and no autoplay.
- Trust and safety: report flow, owner review, audit history, privacy-first defaults.

## Feature scope
- Accounts: secure sign-in, session/device management, recovery, profiles, privacy.
- Chat: messages, attachments, voice recordings, replies, edit/delete, reactions, search, delivery/read states.
- Friends: search, requests, accept/decline, block, online status, study profiles.
- Lessons: course materials, metadata, PDF/file links, favorites, access controls.
- Study Videos (prototype implemented): YouTube URL submission, title/description, subject, level and type, search, local favorites, favorites-only filter, title sorting, embedded player, duplicate-link prevention, JSON library export/import with URL validation and duplicate detection. These library features are browser-local; no cloud sync or reporting/moderation yet. No entertainment/reels feed.
- Stories: student updates with expiration and privacy controls.
- Notifications: preferences, mute/DND, private previews.
- Owner/moderation: report queue, review actions, warn/restrict/remove, audit log.
- Appearance: themes, accents, preferences persisted per account when backend is connected.

## Implementation phases
1. **Prototype UX** — navigable responsive UI, local demo persistence, sample content (current milestone).
2. **Backend foundation** — Supabase project, Auth, PostgreSQL schema, Row-Level Security (RLS), private storage buckets, migrations.
3. **Core launch** — real accounts, profiles, friends, chat, lessons, Study Videos, uploads and search.
4. **Realtime & media** — presence, typing, message state, voice notes, push notifications, realtime events.
5. **Calls & safety** — WebRTC calls with TURN, moderation queue, reporting, audit trail, abuse controls.
6. **QA & launch** — mobile/browser testing, accessibility, performance, security checks, backup/restore, deployment configuration.

## Current prototype limitations
The demo stores data in the browser's localStorage, so it is device/browser-local, not synced. YouTube URLs are supported for the Study Videos demo; uploads, comments, analytics, account permissions, notifications and backend moderation are not yet live. Do not represent these as production features until implemented and tested.

## Backend prerequisites
A Supabase project and configuration are required to implement and test real authentication, database, private media storage, realtime, and server-side moderation. Never commit service-role keys or other secrets to this repository.
