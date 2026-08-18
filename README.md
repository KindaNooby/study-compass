# Study Compass

An offline-first personal exam-preparation system. It continuously answers three questions:

1. What does the learner need to learn?
2. What can they realistically complete before the exam?
3. What is the highest-value action to take next?

Study Compass is **local-first and fully offline**. There is no backend, no account, and no sign-in. All data — curriculum, learning objectives, FSRS cards, study activities, the timetable, and progress — lives in the browser's IndexedDB on the user's device.

## Tech stack

- **Vite** + **React 19** + **TypeScript**
- **React Router v7** (imports from `react-router`)
- **Tailwind CSS v4** + **shadcn/ui** + **Lucide icons**
- **Dexie** — local IndexedDB database and reactive hooks
- **ts-fsrs** — the official FSRS spaced-repetition engine
- **Bun** — package manager and test runner
- **Framer Motion** — animations

## Getting started

```bash
bun install
bun run dev      # start the dev server
```

## Building for production

```bash
bun run build
bun run preview  # serve the built dist/ folder locally
```

The production build registers a service worker (`public/sw.js`) that caches the app shell and static assets, so the app opens and runs with no network after the first load. Serve the `dist/` folder over http(s) — not `file://` — for the service worker and offline mode to work.

## Architecture

```
Curriculum and content
          ↓
Mastery and performance model
          ↓
FSRS review engine
          ↓
Future workload forecast
          ↓
Student capacity and constraints
          ↓
Priority and allocation engine
          ↓
Daily and weekly plan
          ↓
Session results
          ↺
Adaptive replanning
```

All planner logic lives in `src/lib/planner/`:

- `types.ts` / `schemas.ts` — domain model and validation
- `db.ts` / `store.ts` — Dexie database and reactive hooks
- `selectors.ts` — derived reads (availability, progress, date helpers)
- `fsrs.ts` — ts-fsrs wrapper
- `measurement.ts` — topic performance, mastery, error categories, observed capacity
- `plan.ts` — priority, allocation, feasibility, roadmap, recovery, explanations
- `timetable.ts` — clock-slot placement and packing engine
- `repository.ts` — mutations (save, complete, snooze, replace, move)

## Scripts

```bash
bun run dev        # start the Vite dev server
bun run build      # typecheck + production build
bun run preview    # serve the production build
bun test           # run the unit tests
bun run lint       # run eslint
bun tsc -b --noEmit # typecheck without emitting
```
