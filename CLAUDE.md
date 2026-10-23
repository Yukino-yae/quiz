# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Local-first Chinese quiz-practice SPA. There is no backend, login, or cloud sync: all banks, questions, sessions, answers, and settings live in the browser's IndexedDB. Questions are text-only (no image questions). UI copy is Chinese and must stay mobile-first.

Stack: React 19 + TypeScript + Vite + Tailwind CSS v4, React Router 7, Dexie 4 + `dexie-react-hooks`, Zustand, Zod.

## Commands

```bash
npm install
npm run dev        # Vite dev server, default http://localhost:5173
npm run build      # tsc -b + vite build (also the type-check)
npm run lint       # oxlint
npm test           # Vitest unit tests
npm run verify:ui  # Playwright Core smoke tests; requires the dev server
npm run preview    # preview a production build
```

Run one Vitest file:

```bash
npx vitest run src/features/practice/__tests__/grading.test.ts
```

`npm run verify:ui` drives installed Chrome or Edge via `playwright-core` (override with `CHROME_PATH`), writes fixtures and screenshots under `%TEMP%`, and can target another server with `BASE_URL`. Each flow uses a fresh browser context, so IndexedDB starts empty; flows must create/import their own data. The script is plain Node (`scripts/verify-ui.mjs`), not the Playwright test runner.

## Architecture

### App shell and routes

`src/app/App.tsx` defines all routes. The practice route `/practice/:sessionId` deliberately sits outside `AppLayout` for an immersive full-screen view. Import and Settings are route-lazy-loaded. The mobile bottom nav and desktop sidebar come from `src/app/nav.ts`.

Placeholder pages: `ExamPage` (stage 5 mock exams) and most of `StatsPage` (stage 6). Stages 1-4 are implemented; stage 7 is PWA/offline work.

### Data model

`src/types/quiz.ts` is the source of truth. Important answer representations:

- Choice questions: `answer` is an array of option keys (`"A"`, `"B"`, ...).
- Judge questions: `answer` is `["true"]` or `["false"]`.
- Fill questions: `answerGroups` is one array of accepted variants per blank.
- Short questions: `referenceAnswer` plus `keywords`; empty keywords means self-assessment.
- `Session` snapshots `questionIds` and tracks `cursor`; answers reference session/question IDs.
- `PracticeMode` includes `exam` and `review` for future stages, while `PracticeRunMode` in `sessionRepository` only supports `sequence | random | wrong | favorite`.

Dexie schema and indexes are in `src/db/db.ts`. `questionStates` is keyed by `questionId` and stores mastery, favorites, wrong count, and last result. Bump the Dexie version there when indexes/schema change.

Writes go through repositories/services in `src/db/` and `src/features/`; read UIs generally use `useLiveQuery` so IndexedDB changes re-render automatically. Deleting a question also deletes its state and answers inside a transaction.

### Practice lifecycle

`src/db/sessionRepository.ts` owns sessions:

- `createPracticeSession` filters questions by type/difficulty/chapter, applies the mode, optionally restricts to an explicit `questionIds` set, then stores a snapshot for the session.
- `recordAnswer` is transactional and idempotent per session/question: it appends an answer and updates `QuestionState`. Three consecutive correct answers mark a question `mastered`; a wrong answer resets the streak.
- `advanceSession` moves `cursor`; `completeSession` computes score/elapsed time and `finishedAt`.

The wrong book is derived, not a separate table: a question is in the wrong book when `wrongCount > 0 && status !== 'mastered'` (`src/features/review/stateFilters.ts`). Favorite is independent of wrong/mastery. WrongPage can practice only its current filtered result set by passing those IDs to `createPracticeSession`.

Grading lives in `src/features/practice/grading.ts`: exact key for single/judge, set comparison for multiple, per-blank normalized comparison for fill, and all-keyword matching for short. `normalizeAnswerText` handles NFKC, case, whitespace, and common punctuation. Short answers without keywords are graded by the learner in `PracticeQuestion`.

### Import pipeline

All formats converge on `RawQuestion` → `normalizeQuestion` → `DraftQuestion`:

- `fileParser.ts` detects `.xlsx/.xlsm/.csv/.txt/.md/.docx`, rejects legacy `.xls/.doc`, reads Excel/CSV via table parsing, and parses TXT/Markdown directly. DOCX prefers tables and falls back to plain-text parsing; embedded images are ignored with a warning.
- `tableParser.ts`, `textParser.ts`, and `normalize.ts` normalize type labels, options, answers, chapters, difficulty, and tags.
- Deduplication is computed during preview by `questionKey` (type + stem), both within the file and against the target bank.
- `importService.ts` appends questions with fresh IDs and monotonically increasing `order`.

### Backup compatibility

`src/features/backup/backupService.ts` mirrors the data types with Zod schemas and supports merge/replace restore. Any change to `Question`, `QuestionState`, `Session`, or `AnswerRecord` must be reflected there (use `.default(...)` for new optional fields when reading older backups).

### UI and theming

Tailwind v4 design tokens are defined in `src/index.css` (`bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `text-fg`, `text-muted`, `bg-primary`, `bg-primary-soft`, `bg-success-soft`, `bg-danger-soft`, `bg-warning-soft`, `shadow-card`, etc.). Reuse these semantic classes instead of hard-coded colors so light/dark themes keep working. Dark mode is class-based (`.dark` with a `@custom-variant`).

Reusable primitives are under `src/components/ui/` (`Button`, `Card`, `Badge`, `buttonStyles`). Use `pb-safe` for bottom-fixed mobile UI. Theme choice is persisted by the Zustand store (`quiz-settings`) and applied by `useThemeSync`.

When adding new practice modes, update `types/quiz.ts`, labels, setup/bank-detail entry points, `sessionRepository`, and the backup Zod enum.

### Versioning

The displayed version is duplicated in `package.json`, `package-lock.json` (root fields), `src/app/AppLayout.tsx`, and `src/pages/SettingsPage.tsx`; update all four together.
