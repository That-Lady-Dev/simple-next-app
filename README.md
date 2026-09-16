# kcal

A personal food and workout tracker. Take a photo of a meal, get an itemised calorie and macro estimate from Claude, correct it if needed, and save it against a daily calorie limit. Log workouts and weight alongside.

## Setup

```bash
npm install
cp .env.example .env.local   # add your Anthropic API key
npm run dev
```

Open http://localhost:3000. On a phone, add it to the home screen for an app-like experience.

## Deploy

The photo analysis runs in a server route (`app/api/analyze/route.ts`) so the API key never reaches the browser. That means the app needs a Node host, not static hosting. Vercel is the simplest option:

1. Import the repo on Vercel.
2. Add `ANTHROPIC_API_KEY` as an environment variable.
3. Deploy.

## Data

Meals, workouts, weights, and settings live in the browser's `localStorage` on the device you use. Use **Settings → Export backup** to save a JSON copy, and **Import backup** to restore it on another device.

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm run typecheck` – TypeScript check
- `npm run lint` – ESLint
