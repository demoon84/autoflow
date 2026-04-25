# Findings

## Repository Shape
- No existing `package.json`, `tsconfig.json`, or frontend build tool was present before the Electron work.
- The current implementation is shell/PowerShell CLI plus generated board templates.
- `node` and `npm` are available locally (`node v20.19.6`, `npm 10.8.2`).

## Electron Version
- `npm view electron version` returned `41.3.0` on 2026-04-24.

## Product Direction
- The desktop app should be an Autoflow operating console:
  - select a project root and board directory
  - run `status`, `doctor`, `init`, `install-stop-hook`, `watch-bg`, `watch-stop`, and `render-heartbeats`
  - show ticket counts, ticket queues, and recent logs
- The CLI remains the source of truth for board state transitions.

## shadcn Direction
- Official shadcn Vite docs use Tailwind CSS, `@tailwindcss/vite`, React, a `@/*` alias, and `components.json`.
- The `components.json` docs say `style: "new-york"` is the current style choice and `tailwind.config` can be blank for Tailwind CSS v4.
- For this Electron app, use copied shadcn-compatible components under `src/components/ui/` instead of running an interactive CLI inside the existing scaffold.
