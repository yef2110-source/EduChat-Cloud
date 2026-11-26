# EduChat-Cloud

Arabic-first, mobile-friendly learning and student community prototype. EduChat brings study materials, study-video discovery, student profiles, and communication features into one interface.

## Project status

This repository is an evolving prototype—not a production-ready service.

- The front-end prototype is in `index.html`; it uses browser-local storage for demo data.
- Supabase V2 call-signaling migrations and a client helper are under development.
- The V2 call signaling helper is **not connected to the legacy HTML client yet**.
- Real authentication, cross-device sync, push notifications, and production calls require backend configuration and staging verification.

See [Product roadmap](docs/PRODUCT_ROADMAP.md) for scope and [Call signaling setup](docs/CALL_SIGNALING_SETUP.md) for V2 prerequisites and limitations.

## Local checks

Requires Node.js (no install step currently required for the listed checks).

Run the complete automated checks (including study-video URL validation and local-library favorites/backup tests):

```bash
npm test
```

Individual checks are also available: `npm run test:calls`, `npm run check:html`, `npm run check:call-migrations`, `npm run test:study-videos`, and `npm run test:study-video-favorites`.

These checks validate the call helper's tests, inline JavaScript syntax in `index.html`, and expected safeguards in the call-insert migration. They do not replace browser/device, backend, security, or staging tests.

## Backend and secrets

A Supabase project and Auth UUID-based foundation schema are prerequisites for backend features. Never commit Supabase service-role keys, credentials, or other secrets.
