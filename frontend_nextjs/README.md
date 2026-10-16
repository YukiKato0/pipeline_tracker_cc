# Frame Creator Studio

Frontend Creator Content & Pipeline Tracker built with Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.

## Run locally

```bash
npm run dev
```

## Quality checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` uses Node's built-in test runner and TypeScript type stripping; use Node.js 22.6 or newer.

## Preview data

`/contents/demo-42` is an interactive local preview. Its content, checklist, status changes, published URL, and metric snapshots are sample-only and reset on reload. Other content IDs are not backed by a server record yet.

## API and cache

The API response/error shape and auth/session strategy are not confirmed, so the frontend does not fetch or cache private API data yet. No tokens are stored in browser storage. Status and channel filters are encoded in the URL. Once the backend contract is available, select one server-data cache strategy and scope private data to the authenticated user/session.
