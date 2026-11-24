# Claude Instructions

Read `AGENTS.md` first. This file exists so Claude Code uses the same project
rules as Codex, Cursor, and other agents.

Durable project memory lives in `.agents/memory/`. Keep repo-boundary facts
there, especially `.agents/memory/repo-boundary.md`.

Update this file only when Claude-specific bootstrapping changes.

## Claude model routing

- Standard implementation: Claude Sonnet 5.5.
- Big implementation (large or cross-cutting changes) and planning: Claude Opus 5.5 or newer.
- Audits, major or minor: the latest Claude Fable (5.2 today). Fable never implements or edits code.
