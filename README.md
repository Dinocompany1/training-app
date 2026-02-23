# Training App

React Native/Expo app for workout planning, quick sessions, routines, calendar, stats, and AI coach.

## Setup

1. Install dependencies

```bash
npm install
```

2. Create local env

```bash
cp .env.example .env
```

3. Start dev client

```bash
npx expo start --dev-client --host localhost
```

## iOS Run

First build native app once:

```bash
npx expo run:ios
```

Then use Metro:

```bash
npx expo start --dev-client --host localhost
```

## Quality Gates

```bash
npm run lint
npx tsc --noEmit
npm test
npm run doctor
```

## Environment Variables

- `EXPO_PUBLIC_AI_CHAT_URL` (optional): AI backend endpoint.
- `EXPO_PUBLIC_SUPABASE_URL` (optional): Supabase project URL for cloud sync.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (optional): Supabase anon key.
- `EXPO_PUBLIC_PRIVACY_POLICY_URL` (optional): Public privacy policy URL.
- `EXPO_PUBLIC_TERMS_URL` (optional): Public terms URL.
- `EXPO_PUBLIC_SUPPORT_EMAIL` (optional): Support email shown in app.

For the Supabase Edge Function AI endpoint, authenticate requests with the app user's
`Authorization: Bearer <access_token>` header and set `AI_CHAT_JWT_SECRET` on the function runtime.
For distributed rate limiting across edge instances, also set
`AI_CHAT_RATE_LIMIT_REDIS_URL` and `AI_CHAT_RATE_LIMIT_REDIS_TOKEN` on the function runtime.

Never put server-only secrets in Expo public env variables.

## Prelaunch

Use the checklist before TestFlight:

- `docs/PRELAUNCH_CHECKLIST.md`
- `docs/TEST_PLAN.md`
- `docs/RELEASE_NOTES_TEMPLATE.md`

Legal templates to publish before App Store submission:

- `docs/PRIVACY_POLICY.md`
- `docs/TERMS_OF_USE.md`
